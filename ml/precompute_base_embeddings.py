"""Precompute frozen teacher embeddings for distillation training."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer


def read_jsonl(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--model",
        type=Path,
        default=Path("BAAI/bge-m3"),
    )
    parser.add_argument("--triplets", type=Path, default=root / "training_data" / "train_hard_expanded.jsonl")
    parser.add_argument("--output-dir", type=Path, default=root / "training_data" / "teacher")
    args = parser.parse_args()
    rows = read_jsonl(args.triplets)
    texts = []
    seen = set()
    for row in rows:
        for key in ("anchor", "positive", "negative"):
            text = row[key]
            if text not in seen:
                seen.add(text)
                texts.append(text)
    model = SentenceTransformer(str(args.model), device="cuda")
    model.max_seq_length = 256
    vectors = model.encode(
        texts,
        batch_size=64,
        normalize_embeddings=True,
        show_progress_bar=False,
    ).astype("<f4")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "texts.jsonl").write_text(
        "".join(json.dumps({"text": text}, ensure_ascii=False) + "\n" for text in texts),
        encoding="utf-8",
    )
    (args.output_dir / "vectors.npy").write_bytes(vectors.tobytes(order="C"))
    manifest = {
        "texts": len(texts),
        "dimension": int(vectors.shape[1]),
        "dtype": "float32",
        "normalized": True,
        "source_model": str(args.model),
    }
    (args.output_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
