# 才证 Embedding LoRA v4

本模型用于 才证 的合成招聘知识检索实验，底座为 `BAAI/bge-m3`，提交目录仅保留约 1 MB 的 LoRA adapter。

## 复现

```powershell
python -m pip install -r ml/requirements.txt
python ml/embedding_service.py --base-model BAAI/bge-m3
```

服务器会优先读取以下环境变量：

- `HIREPROOF_BASE_MODEL`
- `HIREPROOF_LORA_ADAPTER`
- `HIREPROOF_RERANKER_MODEL`
- `HIREPROOF_EMBEDDING_DEVICE`

没有 GPU 时自动使用 CPU；向量服务不可用时应用回退到 BM25。

## 评估摘要

- 基础 BGE-M3 Dense Recall@5：0.450
- LoRA-v4 Dense Recall@5：0.526
- 50% 基础向量 + 50% LoRA 向量 Recall@5：0.535
- 最终 BM25 + Dense + RRF Recall@5：0.557

当前指标来自按虚构企业实体隔离的合成测试集，不代表真实招聘效果。
