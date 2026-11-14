# 才证 Embedding Training

## Recommended Model

`models/hireproof-embedding-lora-v4`

训练方法：

- BGE-M3 作为冻结底座
- PEFT LoRA 只训练最后 8 层（16–23 层）的 query/value 投影
- 显式模型级硬负例
- 对比学习
- 与原 BGE-M3 向量蒸馏
- 按验证集 Recall@5 早停

## Setup

```powershell
py -3.12 -m pip install -r ml/requirements.txt
```

提交包只保留最终 LoRA adapter。底座模型 `BAAI/bge-m3` 和可选 Reranker 由运行环境缓存或通过 `HIREPROOF_BASE_MODEL`、`HIREPROOF_RERANKER_MODEL` 指定。无 GPU 时推理服务会自动使用 CPU。

## Reproduce

```powershell
py -3.12 ml/generate_training_data.py --entities 64
py -3.12 ml/expand_queries.py
py -3.12 ml/mine_hard_negatives.py --negatives 1 --output training_data/train_hard_expanded.jsonl
py -3.12 ml/precompute_base_embeddings.py
py -3.12 ml/train_lora_contrastive.py --train-file training_data/train_hard_v4.jsonl --output-dir models/hireproof-embedding-lora-v4 --epochs 1 --batch-size 8 --learning-rate 0.00002 --lora-r 8 --lora-alpha 16 --target-layers-start 16 --teacher-dir training_data/teacher_v4
py -3.12 ml/evaluate_embedding.py --model models/hireproof-embedding-lora-v4 --output models/evaluation-hireproof-embedding-lora-v4.json
py -3.12 ml/evaluate_ensemble.py --base-model "<BGE-M3 path>" --project-model models/hireproof-embedding-lora-v4 --output models/evaluation-ensemble-lora-v4.json
py -3.12 ml/build_vector_index.py --base-model "<BGE-M3 path>" --project-model models/hireproof-embedding-lora-v4 --project-weight 0.5
py -3.12 ml/evaluate_hybrid_rerank.py
```

## Model Selection Rule

模型必须同时满足：

- Recall@5 不明显下降
- MRR 有提升
- BM25 + Dense + RRF + Reranker 的最终前五条结果优于单纯 BM25

Triplet 验证准确率不作为唯一验收指标。
