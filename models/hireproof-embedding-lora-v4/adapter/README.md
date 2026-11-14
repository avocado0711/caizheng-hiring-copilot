---
base_model: BAAI/bge-m3
library_name: peft
tags:
  - sentence-transformers
  - feature-extraction
  - lora
---

# 才证 Embedding LoRA v4

该目录只保存比赛展示所需的 LoRA adapter，不包含 BGE-M3 底座权重。

- 底座模型：`BAAI/bge-m3`
- 方法：LoRA + 显式硬负例 + 基础向量蒸馏
- 目标层：16–23 层
- 目标模块：query、value
- LoRA rank：8
- 训练数据：全部为比赛合成数据
- 适用场景：企业知识库、团队、技术资料与岗位标准的领域检索
- 不适用场景：个人价值判断、录用结论或未经授权的人选画像
