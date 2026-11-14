"""Evaluate BM25 + fused embeddings + BGE reranker on held-out queries."""

from __future__ import annotations

import argparse
import gc
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import torch
from sentence_transformers import CrossEncoder, SentenceTransformer


def read_jsonl(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def tokenize(text: str) -> list[str]:
    text = text.lower()
    tokens = [
        match.group(0)
        for match in re.finditer(r"[a-z0-9][a-z0-9.+#_-]*", text)
        if len(match.group(0)) > 1
    ]
    for match in re.finditer(r"[\u3400-\u9fff]+", text):
        seq = match.group(0)
        tokens.extend(seq[index:index + 2] for index in range(max(0, len(seq) - 1)))
    return tokens


class BM25:
    def __init__(self, documents):
        self.documents = documents
        self.tokens = [tokenize(row["text"]) for row in documents]
        self.lengths = np.array([len(row) for row in self.tokens], dtype=float)
        self.average_length = float(self.lengths.mean())
        self.frequencies = [Counter(row) for row in self.tokens]
        self.document_frequency = Counter()
        for row in self.tokens:
            self.document_frequency.update(set(row))
        self.count = len(documents)

    def scores(self, query: str):
        query_tokens = tokenize(query)
        output = np.zeros(self.count, dtype=np.float32)
        k1, b = 1.5, 0.75
        for token in query_tokens:
            df = self.document_frequency.get(token, 0)
            if not df:
                continue
            idf = math.log(1 + (self.count - df + 0.5) / (df + 0.5))
            for index, frequency in enumerate(self.frequencies):
                tf = frequency.get(token, 0)
                if not tf:
                    continue
                denominator = tf + k1 * (1 - b + b * self.lengths[index] / self.average_length)
                output[index] += idf * tf * (k1 + 1) / denominator
        return output


def encode_model(model_path: Path, texts: list[str]) -> np.ndarray:
    model = SentenceTransformer(str(model_path), device="cuda")
    model.max_seq_length = 256
    vectors = model.encode(
        texts,
        batch_size=48,
        normalize_embeddings=True,
        show_progress_bar=False,
    ).astype("<f4")
    del model
    gc.collect()
    torch.cuda.empty_cache()
    return vectors


def recall(scores_by_query, query_to_relevant, k):
    correct = 0
    for scores in scores_by_query:
        top = np.argsort(-scores)[:k].tolist()
        if any(index in query_to_relevant for index in top):
            correct += 1
    return correct / len(scores_by_query)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--base-model",
        type=Path,
        default=Path("BAAI/bge-m3"),
    )
    parser.add_argument("--project-model", type=Path, default=root / "models" / "hireproof-embedding-lora-v3")
    parser.add_argument("--project-weight", type=float, default=0.5)
    parser.add_argument("--reranker", type=Path, default=Path(r"BAAI/bge-reranker-v2-m3"))
    parser.add_argument("--data-dir", type=Path, default=root / "training_data")
    parser.add_argument("--index-dir", type=Path, default=root / "embedding_index")
    parser.add_argument("--output", type=Path, default=root / "models" / "evaluation-hybrid-rerank.json")
    args = parser.parse_args()

    corpus = read_jsonl(args.data_dir / "corpus.jsonl")
    test_rows = read_jsonl(args.data_dir / "test_query_positive.jsonl")
    grouped = defaultdict(set)
    for row in test_rows:
        grouped[row["query"]].add(row["positive_id"])
    id_to_index = {row["id"]: index for index, row in enumerate(corpus)}
    queries = list(grouped)
    relevant = [
        {id_to_index[item] for item in grouped[query]}
        for query in queries
    ]
    bm25 = BM25(corpus)
    bm25_scores = [bm25.scores(query) for query in queries]

    base_queries = encode_model(args.base_model, queries)
    project_queries = encode_model(args.project_model, queries)
    query_vectors = base_queries * (1 - args.project_weight) + project_queries * args.project_weight
    query_vectors /= np.linalg.norm(query_vectors, axis=1, keepdims=True) + 1e-12
    index_vectors = np.memmap(args.index_dir / "vectors.f32.bin", dtype="<f4", mode="r").reshape(-1, 1024)
    dense_scores = query_vectors @ np.asarray(index_vectors).T

    rrf_candidates = []
    rrf_scores = []
    for bm25_row, dense_row in zip(bm25_scores, dense_scores, strict=True):
        bm25_top = np.argsort(-bm25_row)[:50]
        dense_top = np.argsort(-dense_row)[:50]
        fused = defaultdict(float)
        for rank, index in enumerate(bm25_top, start=1):
            fused[int(index)] += 1 / (60 + rank)
        for rank, index in enumerate(dense_top, start=1):
            fused[int(index)] += 1 / (60 + rank)
        ranked = sorted(fused.items(), key=lambda item: item[1], reverse=True)
        top = ranked[:30]
        rrf_candidates.append([index for index, _ in top])
        scores = np.full(len(corpus), -1e9, dtype=np.float32)
        for index, score in ranked:
            scores[index] = score
        rrf_scores.append(scores)

    reranker = CrossEncoder(str(args.reranker), device="cuda", local_files_only=True)
    reranked_scores = []
    blended_scores = {weight: [] for weight in (0.5, 1.0, 2.0)}
    for query, candidate_indices, rrf_row in zip(queries, rrf_candidates, rrf_scores, strict=True):
        pairs = [(query, corpus[index]["text"]) for index in candidate_indices]
        predictions = reranker.predict(pairs, batch_size=32, show_progress_bar=False)
        scores = np.full(len(corpus), -1e9, dtype=np.float32)
        for index, score in zip(candidate_indices, predictions, strict=True):
            scores[index] = float(score)
        reranked_scores.append(scores)
        rerank_rank = {
            index: rank
            for rank, index in enumerate(
                [
                    index for index, _ in sorted(
                        zip(candidate_indices, predictions, strict=True),
                        key=lambda item: float(item[1]),
                        reverse=True,
                    )
                ],
                start=1,
            )
        }
        for weight in blended_scores:
            combined = np.full(len(corpus), -1e9, dtype=np.float32)
            for index in candidate_indices:
                combined[index] = float(rrf_row[index]) + weight / (60 + rerank_rank[index])
            blended_scores[weight].append(combined)

    def metric(scores_list, k):
        correct = 0
        rr = []
        for scores, positives in zip(scores_list, relevant, strict=True):
            top = np.argsort(-scores)[:k].tolist()
            hit_rank = next((rank for rank, index in enumerate(top, start=1) if index in positives), None)
            if hit_rank:
                correct += 1
                rr.append(1 / hit_rank)
            else:
                rr.append(0)
        return {"recall": correct / len(scores_list), "mrr": float(np.mean(rr))}

    report = {
        "queries": len(queries),
        "corpus": len(corpus),
        "bm25": metric(bm25_scores, 5),
        "dense": metric(dense_scores, 5),
        "hybrid_rrf": metric(rrf_scores, 5),
        "hybrid_rrf_rerank": metric(reranked_scores, 5),
        "hybrid_rrf_rerank_blend": {
            str(weight): metric(scores, 5)
            for weight, scores in blended_scores.items()
        },
        "reranker": str(args.reranker),
        "project_weight": args.project_weight,
    }
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
