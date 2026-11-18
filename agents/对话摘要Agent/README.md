# 对话摘要 Agent

## 输入

- 岗位评价项
- 已征得同意的通话问题
- 候选人逐题回答

## 输出

```json
{
  "summary": "不超过220字的客观摘要",
  "criteria": [
    {
      "criterionId": "来自输入评价项",
      "level": "strong|medium|weak|none",
      "confidence": 0.9,
      "evidenceQuotes": ["候选人回答中的逐字片段"],
      "reasoning": "识别理由"
    }
  ]
}
```

该 Agent 只识别候选人回答，不判断录用结果，也不推断性格、情绪或保护性属性。摘要用于候选人详情面板；岗位信号只有通过回答原文核验后，才会按固定权重参与综合评分。

实现文件：`对话摘要Agent.js`
