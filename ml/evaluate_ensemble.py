"""Evaluate weighted fusion of base and project-adapted embeddings."""

from __future__ import annotations

import argparse
import gc
import json
from collections import defaultdict
from pathlib import Path

import numpy as np
import torch
from sentence_transformers import SentenceTransformer


def read_jsonl(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def encode(model_path: Path, corpus: list[dict], queries: list[str]):
    model = SentenceTransformer(str(model_path), device="cuda")
    model.max_seq_length = 256
    corpus_vectors = model.encode(
        [row["text"] for row in corpus],
        batch_size=48,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    query_vectors = model.encode(
        queries,
        batch_size=48,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    del model
    gc.collect()
    torch.cuda.empty_cache()
    return corpus_vectors, query_vectors


def metrics_for(query_vectors, corpus_vectors, cases, corpus):
    id_to_index = {row["id"]: index for index, row in enumerate(corpus)}
    scores = query_vectors @ corpus_vectors.T
    recalls = {1: 0, 3: 0, 5: 0, 10: 0}
    rr = []
    ranks = []
    for case, row_scores in zip(cases, scores, strict=True):
        targets = {id_to_index[item] for item in case["positive_ids"]}
        ranking = np.argsort(-row_scores)
        rank = min(int(np.where(ranking == target)[0][0]) + 1 for target in targets)
        ranks.append(rank)
        rr.append(1 / rank)
        for k in recalls:
            if any(int(np.where(ranking == target)[0][0]) + 1 <= k for target in targets):
                recalls[k] += 1
    return {
        "recall_at_1": recalls[1] / len(cases),
        "recall_at_3": recalls[3] / len(cases),
        "recall_at_5": recalls[5] / len(cases),
        "recall_at_10": recalls[10] / len(cases),
        "mrr": float(np.mean(rr)),
        "mean_rank": float(np.mean(ranks)),
        "median_rank": float(np.median(ranks)),
    }


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-model", type=Path, required=True)
    parser.add_argument("--project-model", type=Path, required=True)
    parser.add_argument("--data-dir", type=Path, default=root / "training_data")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    corpus = read_jsonl(args.data_dir / "corpus.jsonl")
    rows = read_jsonl(args.data_dir / "test_query_positive.jsonl")
    grouped = defaultdict(set)
    for row in rows:
        grouped[row["query"]].add(row["positive_id"])
    cases = [
        {"query": query, "positive_ids": list(positive_ids)}
        for query, positive_ids in grouped.items()
    ]
    queries = [case["query"] for case in cases]
    base_corpus, base_queries = encode(args.base_model, corpus, queries)
    project_corpus, project_queries = encode(args.project_model, corpus, queries)
    results = []
    for project_weight in (0.25, 0.5, 0.75, 1.0):
        corpus_vectors = base_corpus * (1 - project_weight) + project_corpus * project_weight
        query_vectors = base_queries * (1 - project_weight) + project_queries * project_weight
        corpus_vectors /= np.linalg.norm(corpus_vectors, axis=1, keepdims=True) + 1e-12
        query_vectors /= np.linalg.norm(query_vectors, axis=1, keepdims=True) + 1e-12
        results.append({
            "project_weight": project_weight,
            **metrics_for(query_vectors, corpus_vectors, cases, corpus),
        })
    best = max(results, key=lambda item: (item["recall_at_5"], item["mrr"]))
    payload = {
        "base_model": str(args.base_model),
        "project_model": str(args.project_model),
        "results": results,
        "best": best,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
