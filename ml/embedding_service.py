"""Local HTTP service for fused BGE-M3/LoRA embeddings and reranking."""

from __future__ import annotations

import argparse
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from peft import PeftModel
from sentence_transformers import CrossEncoder, SentenceTransformer


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BASE = os.getenv("HIREPROOF_BASE_MODEL", "BAAI/bge-m3")
DEFAULT_ADAPTER = Path(os.getenv(
    "HIREPROOF_LORA_ADAPTER",
    PROJECT_ROOT / "models" / "hireproof-embedding-lora-v4" / "adapter",
))
DEFAULT_RERANKER = os.getenv("HIREPROOF_RERANKER_MODEL", "BAAI/bge-reranker-v2-m3")
DEFAULT_DEVICE = os.getenv(
    "HIREPROOF_EMBEDDING_DEVICE",
    "cuda" if torch.cuda.is_available() else "cpu",
)


class ModelState:
    def __init__(self, base_model: str, adapter: Path, reranker: str, project_weight: float):
        self.project_weight = project_weight
        self.device = DEFAULT_DEVICE
        model = SentenceTransformer(str(base_model), device=self.device)
        model.max_seq_length = 256
        transformer = model[0]
        self.tokenizer = transformer.tokenizer
        self.peft_model = PeftModel.from_pretrained(transformer.auto_model, str(adapter))
        self.peft_model.to(self.device)
        self.peft_model.eval()
        self.reranker_path = reranker
        self.reranker = None
        self.lock = threading.Lock()

    @torch.no_grad()
    def embed(self, texts: list[str]) -> np.ndarray:
        vectors = []
        for start in range(0, len(texts), 24):
            batch = texts[start:start + 24]
            inputs = self.tokenizer(
                batch,
                padding=True,
                truncation=True,
                max_length=256,
                return_tensors="pt",
            ).to(self.device)
            with self.peft_model.disable_adapter():
                base = self.peft_model(**inputs).last_hidden_state[:, 0]
            base = F.normalize(base, p=2, dim=1)
            adapted = F.normalize(
                self.peft_model(**inputs).last_hidden_state[:, 0],
                p=2,
                dim=1,
            )
            fused = base * (1 - self.project_weight) + adapted * self.project_weight
            fused = F.normalize(fused, p=2, dim=1)
            vectors.append(fused.cpu().numpy().astype("<f4"))
        return np.concatenate(vectors, axis=0) if vectors else np.empty((0, 1024), dtype="<f4")

    @torch.no_grad()
    def rerank(self, query: str, documents: list[str]) -> list[float]:
        if self.reranker is None:
            print("Loading reranker on first deep-search request...", flush=True)
            self.reranker = CrossEncoder(
                str(self.reranker_path),
                device=self.device,
                local_files_only=Path(self.reranker_path).exists(),
            )
        pairs = [(query, document) for document in documents]
        scores = self.reranker.predict(
            pairs,
            batch_size=16,
            show_progress_bar=False,
        )
        return [float(score) for score in scores]


def make_handler(state: ModelState):
    class Handler(BaseHTTPRequestHandler):
        def send_json(self, status: int, payload: dict) -> None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self) -> None:
            if self.path == "/health":
                self.send_json(200, {
                    "ok": True,
                    "embeddingDimension": 1024,
                    "projectWeight": state.project_weight,
                    "device": state.device,
                    "rerankerLoaded": state.reranker is not None,
                })
            else:
                self.send_json(404, {"error": "not found"})

        def do_POST(self) -> None:
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length <= 0 or length > 2_000_000:
                    raise ValueError("invalid request body")
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                with state.lock:
                    if self.path == "/embed":
                        texts = [str(item) for item in payload.get("texts", [])]
                        if not texts:
                            raise ValueError("texts is required")
                        vectors = state.embed(texts)
                        self.send_json(200, {"vectors": vectors.tolist()})
                        return
                    if self.path == "/rerank":
                        query = str(payload.get("query", ""))
                        documents = [str(item) for item in payload.get("documents", [])]
                        if not query or not documents:
                            raise ValueError("query and documents are required")
                        scores = state.rerank(query, documents)
                        self.send_json(200, {"scores": scores})
                        return
                self.send_json(404, {"error": "not found"})
            except Exception as error:
                self.send_json(400, {"error": str(error)})

        def log_message(self, format, *args):
            return

    return Handler


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=3041)
    parser.add_argument("--base-model", default=DEFAULT_BASE)
    parser.add_argument("--adapter", type=Path, default=DEFAULT_ADAPTER)
    parser.add_argument("--reranker", default=DEFAULT_RERANKER)
    parser.add_argument("--project-weight", type=float, default=0.5)
    args = parser.parse_args()
    print("Loading local embedding and reranker models...", flush=True)
    state = ModelState(args.base_model, args.adapter, args.reranker, args.project_weight)
    server = ThreadingHTTPServer((args.host, args.port), make_handler(state))
    print(f"Embedding service ready: http://{args.host}:{args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
