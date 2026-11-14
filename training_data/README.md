# Training Data

所有资料均为合成数据，不包含真实候选人、真实简历或未授权个人信息。

数据生成命令：

```powershell
py -3.12 ml/generate_training_data.py --entities 64
```

生成内容：

- `corpus.jsonl`：完整合成知识片段
- `train_triplets.jsonl`：训练查询、正例和硬负例
- `val_triplets.jsonl`：验证三元组
- `test_cases.jsonl`：留出实体上的测试查询
- `dataset_stats.json`：数量与切分统计

训练集、验证集和测试集按虚构企业实体隔离，避免实体名称泄漏造成虚高评估。
