"""Evaluate an embedding model on entity-isolated retrieval cases."""

from __future__ import annotations

import argparse
import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer


def read_jsonl(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def evaluate(model_path: Path, data_dir: Path, queries_file: str, output_path: Path) -> dict:
    corpus = read_jsonl(data_dir / "corpus.jsonl")
    rows = read_jsonl(data_dir / queries_file)
    grouped = defaultdict(set)
    for row in rows:
        grouped[row["query"]].add(row["positive_id"])
    queries = list(grouped)
    relevant_ids = [grouped[query] for query in queries]
    id_to_index = {row["id"]: index for index, row in enumerate(corpus)}
    model = SentenceTransformer(str(model_path), device="cuda")
    model.max_seq_length = 256

    corpus_vectors = model.encode(
        [row["text"] for row in corpus],
        batch_size=64,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    query_vectors = model.encode(
        queries,
        batch_size=64,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    scores = query_vectors @ corpus_vectors.T
    recalls = {1: 0, 3: 0, 5: 0, 10: 0}
    reciprocal_ranks = []
    ranks = []
    ndcg_total = 0.0
    for relevant, row_scores in zip(relevant_ids, scores, strict=True):
        targets = {id_to_index[item] for item in relevant}
        ranking = np.argsort(-row_scores)
        rank = min(
            int(np.where(ranking == target)[0][0]) + 1
            for target in targets
        )
        ranks.append(rank)
        reciprocal_ranks.append(1.0 / rank)
        for k in recalls:
            if rank <= k:
                recalls[k] += 1
        dcg = sum(
            1 / math.log2(position + 2)
            for position, index in enumerate(ranking[:5].tolist())
            if index in targets
        )
        ideal = sum(1 / math.log2(position + 2) for position in range(min(5, len(targets))))
        ndcg_total += dcg / max(ideal, 1e-12)

    metrics = {
        "model_path": str(model_path),
        "queries": len(queries),
        "corpus": len(corpus),
        "recall_at_1": recalls[1] / len(queries),
        "recall_at_3": recalls[3] / len(queries),
        "recall_at_5": recalls[5] / len(queries),
        "recall_at_10": recalls[10] / len(queries),
        "ndcg_at_5": ndcg_total / len(queries),
        "mrr": float(np.mean(reciprocal_ranks)),
        "mean_rank": float(np.mean(ranks)),
        "median_rank": float(np.median(ranks)),
    }
    output_path.write_text(
        json.dumps(metrics, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return metrics


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--data-dir", type=Path, default=root / "training_data")
    parser.add_argument("--queries-file", default="test_query_positive.jsonl")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    print(json.dumps(
        evaluate(args.model, args.data_dir, args.queries_file, args.output),
        ensure_ascii=False,
        indent=2,
    ))


if __name__ == "__main__":
    main()
