"""Build the project vector index from fused base and adapted embeddings."""

from __future__ import annotations

import argparse
import gc
import hashlib
import json
from pathlib import Path

import numpy as np
import torch
from sentence_transformers import SentenceTransformer


def read_jsonl(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def encode_model(model_path: Path, corpus: list[dict]) -> np.ndarray:
    model = SentenceTransformer(str(model_path), device="cuda")
    model.max_seq_length = 256
    vectors = model.encode(
        [row["text"] for row in corpus],
        batch_size=48,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    del model
    gc.collect()
    torch.cuda.empty_cache()
    return np.asarray(vectors, dtype=np.float32)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-model", type=Path, required=True)
    parser.add_argument("--project-model", type=Path, required=True)
    parser.add_argument("--project-weight", type=float, default=0.15)
    parser.add_argument("--corpus", type=Path, default=root / "training_data" / "corpus.jsonl")
    parser.add_argument("--output-dir", type=Path, default=root / "embedding_index")
    args = parser.parse_args()
    corpus = read_jsonl(args.corpus)
    base = encode_model(args.base_model, corpus)
    project = encode_model(args.project_model, corpus)
    vectors = base * (1 - args.project_weight) + project * args.project_weight
    vectors /= np.linalg.norm(vectors, axis=1, keepdims=True) + 1e-12
    vectors = vectors.astype("<f4")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    binary_path = args.output_dir / "vectors.f32.bin"
    binary_path.write_bytes(vectors.tobytes(order="C"))
    metadata = []
    for row in corpus:
        metadata.append({
            "id": row["id"],
            "text": row["text"],
            "title": row["title"],
            "documentType": row["doc_type"],
            "entityId": row["entity_id"],
            "entityName": row["entity_name"],
            "split": row["split"],
            "synthetic": row["synthetic"],
        })
    (args.output_dir / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    manifest = {
        "version": 1,
        "project": "才证 recruitment evidence intelligence",
        "baseModel": str(args.base_model),
        "projectModel": str(args.project_model),
        "projectVectorWeight": args.project_weight,
        "dimension": int(vectors.shape[1]),
        "documents": int(vectors.shape[0]),
        "dtype": "float32",
        "normalized": True,
        "binaryFile": binary_path.name,
        "binarySha256": hashlib.sha256(binary_path.read_bytes()).hexdigest(),
        "metadataFile": "metadata.json",
        "syntheticDataOnly": True,
        "createdAt": __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).isoformat(),
    }
    (args.output_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
