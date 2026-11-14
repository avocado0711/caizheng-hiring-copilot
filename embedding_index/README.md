# Project Vector Index

该目录由 `ml/build_vector_index.py` 生成，当前使用 50% BGE-M3 + 50% `hireproof-embedding-lora-v4` 的融合向量。

- `vectors.f32.bin`：归一化 float32 向量
- `metadata.json`：向量顺序对应的知识片段和来源元数据
- `manifest.json`：模型、维度、数量、SHA-256 和融合权重

推荐查询流程：

```text
BM25 召回
+ BGE-M3 与项目适配向量的融合召回
→ RRF 去重融合 Top 30
→ BGE reranker 小幅加权（权重 1.0）
→ Top 5
```

所有训练和建库内容均为比赛合成数据。
