"""Mine model-confusable hard negatives from training-only entities."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
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
    parser.add_argument("--data-dir", type=Path, default=root / "training_data")
    parser.add_argument("--queries-file", default="train_query_positive.jsonl")
    parser.add_argument("--output", type=Path, default=root / "training_data" / "train_hard_triplets.jsonl")
    parser.add_argument("--negatives", type=int, default=1)
    args = parser.parse_args()

    corpus = read_jsonl(args.data_dir / "corpus.jsonl")
    base_rows = read_jsonl(args.data_dir / args.queries_file)
    cases = [
        {"anchor": row["query"], "positive_id": row["positive_id"]}
        for row in base_rows
    ]
    id_to_index = {row["id"]: index for index, row in enumerate(corpus)}
    train_by_type = defaultdict(list)
    for row in corpus:
        if row["split"] == "train":
            train_by_type[row["doc_type"]].append(row)

    model = SentenceTransformer(str(args.model), device="cuda")
    model.max_seq_length = 256
    corpus_vectors = model.encode(
        [row["text"] for row in corpus],
        batch_size=48,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    query_vectors = model.encode(
        [case["anchor"] for case in cases],
        batch_size=48,
        normalize_embeddings=True,
        show_progress_bar=False,
    )

    mined = 0
    with args.output.open("w", encoding="utf-8") as handle:
        for case, query_vector in zip(cases, query_vectors, strict=True):
            positive_id = case["positive_id"]
            positive_index = id_to_index[positive_id]
            positive_doc = corpus[positive_index]
            candidates = [
                item for item in train_by_type[positive_doc["doc_type"]]
                if item["id"] != positive_id
            ]
            if not candidates:
                continue
            candidate_indices = np.array([id_to_index[item["id"]] for item in candidates])
            scores = corpus_vectors[candidate_indices] @ query_vector
            order = np.argsort(-scores)[:args.negatives]
            for selected in order:
                negative = candidates[int(selected)]
                handle.write(json.dumps({
                    "anchor": case["anchor"],
                    "positive": positive_doc["text"],
                    "negative": negative["text"],
                    "positive_id": positive_id,
                    "negative_id": negative["id"],
                    "negative_score": float(scores[int(selected)]),
                }, ensure_ascii=False) + "\n")
                mined += 1
    stats = {
        "queries": len(cases),
        "hard_triplets": mined,
        "model": str(args.model),
        "split_policy": "training entities only",
    }
    (args.output.parent / "hard_negative_stats.json").write_text(
        json.dumps(stats, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
