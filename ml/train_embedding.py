"""Fine-tune a local Chinese embedding model on the synthetic 才证 corpus."""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader
from sentence_transformers import InputExample, SentenceTransformer, losses, models
from sentence_transformers.evaluation import TripletEvaluator


DEFAULT_BASE = Path(
    r"BAAI/bge-small-zh-v1.5"
    r"\snapshots\7999e1d3359715c523056ef9478215996d62a620"
)


def read_jsonl(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-model", type=Path, default=DEFAULT_BASE)
    parser.add_argument("--data-dir", type=Path, default=root / "training_data")
    parser.add_argument("--output-dir", type=Path, default=root / "models" / "hireproof-embedding-v1")
    parser.add_argument("--epochs", type=int, default=2)
    parser.add_argument("--batch-size", type=int, default=24)
    parser.add_argument("--max-seq-length", type=int, default=256)
    parser.add_argument("--evaluation-steps", type=int, default=200)
    parser.add_argument("--adapter-only", action="store_true")
    parser.add_argument("--learning-rate", type=float, default=None)
    args = parser.parse_args()

    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is required for this training profile")
    if not args.base_model.exists():
        raise FileNotFoundError(args.base_model)

    train_rows = read_jsonl(args.data_dir / "train_triplets.jsonl")
    val_rows = read_jsonl(args.data_dir / "val_triplets.jsonl")
    if not train_rows:
        raise RuntimeError("No training triplets found")
    train_examples = [
        InputExample(texts=[row["anchor"], row["positive"], row["negative"]])
        for row in train_rows
    ]
    val_anchors = [row["anchor"] for row in val_rows]
    val_positives = [row["positive"] for row in val_rows]
    val_negatives = [row["negative"] for row in val_rows]

    model = SentenceTransformer(str(args.base_model), device="cuda")
    if args.adapter_only:
        embedding_dimension = model.get_sentence_embedding_dimension()
        transformer = model[0]
        pooling = model[1]
        normalize = model[2]
        transformer.auto_model.requires_grad_(False)
        adapter = models.Dense(
            in_features=embedding_dimension,
            out_features=embedding_dimension,
            bias=True,
            activation_function=nn.Identity(),
        )
        with torch.no_grad():
            adapter.linear.weight.copy_(torch.eye(embedding_dimension))
            adapter.linear.bias.zero_()
        model = SentenceTransformer(modules=[transformer, pooling, adapter, normalize], device="cuda")
        for parameter in model[0].parameters():
            parameter.requires_grad = False
    model.max_seq_length = args.max_seq_length
    train_loader = DataLoader(train_examples, batch_size=args.batch_size, shuffle=True)
    train_loss = losses.TripletLoss(
        model=model,
        distance_metric=losses.TripletDistanceMetric.COSINE,
        triplet_margin=0.2,
    )
    evaluator = TripletEvaluator(
        anchors=val_anchors,
        positives=val_positives,
        negatives=val_negatives,
        name="hireproof-val",
        batch_size=32,
        show_progress_bar=False,
        write_csv=True,
    )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    started = time.time()
    model.fit(
        train_objectives=[(train_loader, train_loss)],
        evaluator=evaluator,
        epochs=args.epochs,
        evaluation_steps=args.evaluation_steps,
        warmup_steps=min(200, max(20, len(train_loader))),
        optimizer_class=torch.optim.AdamW,
        optimizer_params={
            "lr": args.learning_rate
            if args.learning_rate is not None
            else (3e-4 if args.adapter_only else 1e-5)
        },
        weight_decay=0.01,
        max_grad_norm=1.0,
        use_amp=True,
        output_path=str(args.output_dir),
        save_best_model=True,
        checkpoint_path=str(args.output_dir / "checkpoints"),
        checkpoint_save_steps=500,
        checkpoint_save_total_limit=2,
        show_progress_bar=False,
    )
    model.save(str(args.output_dir))
    metrics = evaluator(model)
    manifest = {
        "model_name": "hireproof-embedding-v1",
        "base_model": str(args.base_model),
        "domain": "recruitment, talent intelligence, enterprise AI, RAG evidence retrieval",
        "training_examples": len(train_examples),
        "validation_examples": len(val_rows),
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "max_seq_length": args.max_seq_length,
        "learning_rate": args.learning_rate
        if args.learning_rate is not None
        else (3e-4 if args.adapter_only else 1e-5),
        "training_mode": "adapter_only_identity_initialized" if args.adapter_only else "full_finetune",
        "loss": "TripletLoss(cosine, margin=0.2)",
        "gpu": torch.cuda.get_device_name(0),
        "training_seconds": round(time.time() - started, 2),
        "validation_metrics": metrics,
        "synthetic_data_only": True,
    }
    (args.output_dir / "training_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
