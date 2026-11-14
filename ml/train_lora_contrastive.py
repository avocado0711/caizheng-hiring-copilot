"""LoRA contrastive training with explicit hard negatives and base distillation."""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset
from sentence_transformers import SentenceTransformer
from peft import LoraConfig, TaskType, get_peft_model


def read_jsonl(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


class DistilledTriplets(Dataset):
    def __init__(self, rows, text_to_teacher):
        self.rows = rows
        self.text_to_teacher = text_to_teacher

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, index):
        row = self.rows[index]
        return (
            row["anchor"],
            row["positive"],
            row["negative"],
            self.text_to_teacher[row["anchor"]],
            self.text_to_teacher[row["positive"]],
            self.text_to_teacher[row["negative"]],
        )


def collate(items):
    return (
        [item[0] for item in items],
        [item[1] for item in items],
        [item[2] for item in items],
        torch.stack([torch.from_numpy(item[3]) for item in items]),
        torch.stack([torch.from_numpy(item[4]) for item in items]),
        torch.stack([torch.from_numpy(item[5]) for item in items]),
    )


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    default_base = Path("BAAI/bge-m3")
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-model", type=Path, default=default_base)
    parser.add_argument("--data-dir", type=Path, default=root / "training_data")
    parser.add_argument("--train-file", default="train_hard_v4.jsonl")
    parser.add_argument("--output-dir", type=Path, default=root / "models" / "hireproof-embedding-lora-v3")
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument("--batch-size", type=int, default=6)
    parser.add_argument("--learning-rate", type=float, default=2e-5)
    parser.add_argument("--max-length", type=int, default=256)
    parser.add_argument("--temperature", type=float, default=0.05)
    parser.add_argument("--distill-weight", type=float, default=0.2)
    parser.add_argument("--eval-steps", type=int, default=200)
    parser.add_argument("--patience", type=int, default=3)
    parser.add_argument("--lora-r", type=int, default=4)
    parser.add_argument("--lora-alpha", type=int, default=8)
    parser.add_argument("--target-layers-start", type=int, default=20)
    parser.add_argument("--teacher-dir", type=Path, default=root / "training_data" / "teacher")
    parser.add_argument("--validation-file", default="val_query_positive.jsonl")
    parser.add_argument("--eval-query-limit", type=int, default=0)
    args = parser.parse_args()

    train_rows = read_jsonl(args.data_dir / args.train_file)
    teacher_rows = read_jsonl(args.teacher_dir / "texts.jsonl")
    teacher_vectors = np.memmap(
        args.teacher_dir / "vectors.npy",
        dtype="<f4",
        mode="r",
    ).reshape(-1, 1024)
    text_to_teacher = {
        row["text"]: np.asarray(teacher_vectors[index], dtype="<f4")
        for index, row in enumerate(teacher_rows)
    }
    val_rows = read_jsonl(args.data_dir / args.validation_file)
    corpus = read_jsonl(args.data_dir / "corpus.jsonl")
    val_corpus = [row for row in corpus if row["split"] == "validation"]
    val_doc_index = {row["id"]: index for index, row in enumerate(val_corpus)}
    val_unique = {}
    for row in val_rows:
        val_unique[(row["query"], row["positive_id"])] = row
    val_cases = list(val_unique.values())
    if args.eval_query_limit:
        val_cases = val_cases[:args.eval_query_limit]

    model = SentenceTransformer(str(args.base_model), device="cuda")
    model.max_seq_length = args.max_length
    transformer = model[0]
    pooling = model[1]
    normalize = model[2]
    tokenizer = transformer.tokenizer
    lora_model = get_peft_model(
        transformer.auto_model,
        LoraConfig(
            task_type=TaskType.FEATURE_EXTRACTION,
            r=args.lora_r,
            lora_alpha=args.lora_alpha,
            lora_dropout=0.05,
            bias="none",
            target_modules=["query", "value"],
            layers_to_transform=list(range(args.target_layers_start, 24)),
        ),
    )
    transformer.auto_model = lora_model
    lora_model.to("cuda")

    def encode(texts, batch_size=32):
        vectors = []
        for start in range(0, len(texts), batch_size):
            batch = texts[start:start + batch_size]
            encoded = tokenizer(
                batch,
                padding=True,
                truncation=True,
                max_length=args.max_length,
                return_tensors="pt",
            ).to("cuda")
            output = lora_model(**encoded).last_hidden_state[:, 0]
            vectors.append(F.normalize(output, p=2, dim=1))
        return torch.cat(vectors, dim=0) if vectors else torch.empty((0, 1024), device="cuda")

    @torch.no_grad()
    def validation_recall():
        lora_model.eval()
        corpus_vectors = encode([row["text"] for row in val_corpus])
        query_vectors = encode([row["query"] for row in val_cases])
        scores = query_vectors @ corpus_vectors.T
        ranking = torch.argsort(scores, dim=1, descending=True)[:, :5].cpu().numpy()
        correct = 0
        for row, indices in zip(val_cases, ranking, strict=True):
            if val_doc_index[row["positive_id"]] in set(indices.tolist()):
                correct += 1
        return correct / max(1, len(val_cases))

    initial_recall = validation_recall()
    dataset = DistilledTriplets(train_rows, text_to_teacher)
    loader = DataLoader(dataset, batch_size=args.batch_size, shuffle=True, collate_fn=collate)
    trainable = [parameter for parameter in lora_model.parameters() if parameter.requires_grad]
    optimizer = torch.optim.AdamW(trainable, lr=args.learning_rate, weight_decay=0.01)
    scaler = torch.amp.GradScaler("cuda")
    best_recall = initial_recall
    best_state = {
        name: parameter.detach().cpu().clone()
        for name, parameter in lora_model.named_parameters()
        if parameter.requires_grad
    }
    history = [{"step": 0, "validation_recall_at_5": initial_recall}]
    global_step = 0
    stale_evaluations = 0
    started = time.time()

    for epoch in range(args.epochs):
        lora_model.train()
        for anchors, positives, negatives, teacher_a, teacher_p, teacher_n in loader:
            size = len(anchors)
            vectors = encode(list(anchors) + list(positives) + list(negatives))
            anchor_vectors = vectors[:size]
            positive_vectors = vectors[size:size * 2]
            negative_vectors = vectors[size * 2:size * 3]
            candidate_vectors = torch.cat([positive_vectors, negative_vectors], dim=0)
            logits = anchor_vectors @ candidate_vectors.T / args.temperature
            labels = torch.arange(size, device="cuda")
            contrastive_loss = F.cross_entropy(logits, labels)
            teacher_a = teacher_a.to("cuda")
            teacher_p = teacher_p.to("cuda")
            teacher_n = teacher_n.to("cuda")
            distill_loss = (
                (1 - (anchor_vectors * teacher_a).sum(dim=1)).mean()
                + (1 - (positive_vectors * teacher_p).sum(dim=1)).mean()
                + (1 - (negative_vectors * teacher_n).sum(dim=1)).mean()
            ) / 3
            loss = contrastive_loss + args.distill_weight * distill_loss
            optimizer.zero_grad(set_to_none=True)
            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(trainable, 1.0)
            scaler.step(optimizer)
            scaler.update()
            global_step += 1
            if global_step % args.eval_steps == 0:
                recall = validation_recall()
                history.append({
                    "step": global_step,
                    "loss": float(loss.detach().cpu()),
                    "contrastive_loss": float(contrastive_loss.detach().cpu()),
                    "distill_loss": float(distill_loss.detach().cpu()),
                    "validation_recall_at_5": recall,
                })
                print(json.dumps(history[-1], ensure_ascii=False), flush=True)
                if recall > best_recall:
                    best_recall = recall
                    stale_evaluations = 0
                    best_state = {
                        name: parameter.detach().cpu().clone()
                        for name, parameter in lora_model.named_parameters()
                        if parameter.requires_grad
                    }
                else:
                    stale_evaluations += 1
                    if stale_evaluations >= args.patience:
                        print("Early stopping: validation Recall@5 did not improve.", flush=True)
                        break
        if stale_evaluations >= args.patience:
            break

    with torch.no_grad():
        for name, parameter in lora_model.named_parameters():
            if name in best_state:
                parameter.copy_(best_state[name].to(parameter.device))
    final_recall = validation_recall()
    adapter_dir = args.output_dir / "adapter"
    adapter_dir.mkdir(parents=True, exist_ok=True)
    lora_model.save_pretrained(adapter_dir)
    transformer.auto_model = lora_model.merge_and_unload()
    merged = SentenceTransformer(modules=[transformer, pooling, normalize], device="cuda")
    merged.max_seq_length = args.max_length
    merged.save(str(args.output_dir))
    manifest = {
        "model_name": "hireproof-embedding-lora-v3",
        "base_model": str(args.base_model),
        "method": "LoRA + explicit hard negatives + base distillation",
        "train_examples": len(train_rows),
        "validation_queries": len(val_cases),
        "batch_size": args.batch_size,
        "learning_rate": args.learning_rate,
        "temperature": args.temperature,
        "distill_weight": args.distill_weight,
        "lora_r": args.lora_r,
        "lora_alpha": args.lora_alpha,
        "target_layers": list(range(args.target_layers_start, 24)),
        "target_modules": ["query", "value"],
        "trainable_parameters": sum(parameter.numel() for parameter in trainable),
        "initial_validation_recall_at_5": initial_recall,
        "best_validation_recall_at_5": best_recall,
        "final_validation_recall_at_5": final_recall,
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
