"""Train a PEFT LoRA adapter for a SentenceTransformers embedding model."""

from __future__ import annotations

import argparse
import copy
import gc
import json
import math
import time
from pathlib import Path

import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset
from sentence_transformers import SentenceTransformer
from peft import LoraConfig, TaskType, get_peft_model


def read_jsonl(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


class TripletRows(Dataset):
    def __init__(self, rows: list[dict]):
        self.rows = rows

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int):
        row = self.rows[index]
        return row["anchor"], row["positive"], row["negative"]


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    default_base = Path("BAAI/bge-m3")
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-model", type=Path, default=default_base)
    parser.add_argument("--data-dir", type=Path, default=root / "training_data")
    parser.add_argument("--output-dir", type=Path, default=root / "models" / "hireproof-embedding-lora")
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--learning-rate", type=float, default=8e-5)
    parser.add_argument("--max-length", type=int, default=256)
    parser.add_argument("--margin", type=float, default=0.2)
    parser.add_argument("--eval-steps", type=int, default=100)
    parser.add_argument("--eval-limit", type=int, default=196)
    parser.add_argument("--max-train", type=int, default=0)
    parser.add_argument("--train-file", default="train_triplets.jsonl")
    parser.add_argument("--lora-r", type=int, default=8)
    parser.add_argument("--lora-alpha", type=int, default=16)
    args = parser.parse_args()

    train_rows = read_jsonl(args.data_dir / args.train_file)
    val_rows = read_jsonl(args.data_dir / "val_triplets.jsonl")
    if args.max_train:
        train_rows = train_rows[:args.max_train]
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is required")
    if not args.base_model.exists():
        raise FileNotFoundError(args.base_model)

    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True
    model = SentenceTransformer(str(args.base_model), device="cuda")
    model.max_seq_length = args.max_length
    transformer = model[0]
    pooling = model[1]
    normalize = model[2]
    tokenizer = transformer.tokenizer
    peft_config = LoraConfig(
        task_type=TaskType.FEATURE_EXTRACTION,
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        lora_dropout=0.05,
        bias="none",
        target_modules=["query", "key", "value", "dense"],
    )
    lora_model = get_peft_model(transformer.auto_model, peft_config)
    transformer.auto_model = lora_model
    lora_model.to("cuda")

    def encode(texts: list[str]):
        encoded = tokenizer(
            texts,
            padding=True,
            truncation=True,
            max_length=args.max_length,
            return_tensors="pt",
        ).to("cuda")
        output = lora_model(**encoded).last_hidden_state[:, 0]
        return F.normalize(output, p=2, dim=1)

    @torch.no_grad()
    def evaluate(rows: list[dict], limit: int = 0) -> float:
        lora_model.eval()
        rows = rows[:limit] if limit else rows
        correct = 0
        for start in range(0, len(rows), 24):
            batch = rows[start:start + 24]
            size = len(batch)
            vectors = encode(
                [row["anchor"] for row in batch]
                + [row["positive"] for row in batch]
                + [row["negative"] for row in batch]
            )
            anchors = vectors[:size]
            positives = vectors[size:size * 2]
            negatives = vectors[size * 2:size * 3]
            positive_scores = (anchors * positives).sum(dim=1)
            negative_scores = (anchors * negatives).sum(dim=1)
            correct += int((positive_scores > negative_scores).sum().item())
        return correct / max(1, len(rows))

    initial_accuracy = evaluate(val_rows, args.eval_limit)
    trainable_parameters = [parameter for parameter in lora_model.parameters() if parameter.requires_grad]
    trainable_count = sum(parameter.numel() for parameter in trainable_parameters)
    optimizer = torch.optim.AdamW(trainable_parameters, lr=args.learning_rate, weight_decay=0.01)
    loader = DataLoader(TripletRows(train_rows), batch_size=args.batch_size, shuffle=True)
    best_accuracy = initial_accuracy
    best_state = {
        name: parameter.detach().cpu().clone()
        for name, parameter in lora_model.named_parameters()
        if parameter.requires_grad
    }
    history = [{"step": 0, "validation_triplet_accuracy": initial_accuracy}]
    global_step = 0
    started = time.time()

    for epoch in range(args.epochs):
        lora_model.train()
        for anchors, positives, negatives in loader:
            size = len(anchors)
            vectors = encode(list(anchors) + list(positives) + list(negatives))
            anchor_vectors = vectors[:size]
            positive_vectors = vectors[size:size * 2]
            negative_vectors = vectors[size * 2:size * 3]
            loss = F.relu(
                (anchor_vectors * negative_vectors).sum(dim=1)
                - (anchor_vectors * positive_vectors).sum(dim=1)
                + args.margin
            ).mean()
            optimizer.zero_grad(set_to_none=True)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(trainable_parameters, 1.0)
            optimizer.step()
            global_step += 1
            if global_step % args.eval_steps == 0:
                accuracy = evaluate(val_rows, args.eval_limit)
                history.append({
                    "step": global_step,
                    "train_loss": float(loss.detach().cpu()),
                    "validation_triplet_accuracy": accuracy,
                })
                print(json.dumps(history[-1], ensure_ascii=False), flush=True)
                if accuracy > best_accuracy:
                    best_accuracy = accuracy
                    best_state = {
                        name: parameter.detach().cpu().clone()
                        for name, parameter in lora_model.named_parameters()
                        if parameter.requires_grad
                    }

    final_accuracy = evaluate(val_rows)
    history.append({"step": global_step, "validation_triplet_accuracy": final_accuracy})
    if final_accuracy > best_accuracy:
        best_accuracy = final_accuracy
        best_state = {
            name: parameter.detach().cpu().clone()
            for name, parameter in lora_model.named_parameters()
            if parameter.requires_grad
        }
    with torch.no_grad():
        for name, parameter in lora_model.named_parameters():
            if name in best_state:
                parameter.copy_(best_state[name].to(parameter.device))

    adapter_dir = args.output_dir / "adapter"
    adapter_dir.mkdir(parents=True, exist_ok=True)
    lora_model.save_pretrained(adapter_dir)
    merged_model = lora_model.merge_and_unload()
    transformer.auto_model = merged_model
    merged = SentenceTransformer(modules=[transformer, pooling, normalize], device="cuda")
    merged.max_seq_length = args.max_length
    merged.save(str(args.output_dir))

    manifest = {
        "model_name": "hireproof-embedding-lora",
        "base_model": str(args.base_model),
        "method": "PEFT LoRA",
        "lora_r": args.lora_r,
        "lora_alpha": args.lora_alpha,
        "lora_dropout": 0.05,
        "target_modules": ["query", "key", "value", "dense"],
        "trainable_parameters": trainable_count,
        "training_examples": len(train_rows),
        "validation_examples": len(val_rows),
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "learning_rate": args.learning_rate,
        "initial_validation_accuracy": initial_accuracy,
        "best_validation_accuracy": best_accuracy,
        "final_validation_accuracy": final_accuracy,
        "training_seconds": round(time.time() - started, 2),
        "history": history,
        "synthetic_data_only": True,
    }
    (args.output_dir / "training_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
