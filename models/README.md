# Model Artifacts

提交目录只保留最终约 1 MB 的 LoRA adapter 和必要评估文件，不包含 BGE-M3 底座权重或训练中间 checkpoint。

## 保留内容

- `hireproof-embedding-lora-v4/adapter/`：最终 PEFT adapter
- `hireproof-embedding-lora-v4/training_manifest.json`：训练摘要
- `evaluation-*.json`：基础模型、融合向量和混合检索的最终评估结果

## 外部依赖

- 基础向量模型：`BAAI/bge-m3`
- 可选重排序模型：`BAAI/bge-reranker-v2-m3`

可通过 `HIREPROOF_BASE_MODEL`、`HIREPROOF_RERANKER_MODEL` 指向本地目录；模型不可用时应用自动回退到 BM25。
