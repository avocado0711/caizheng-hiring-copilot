# Agent Modules

候选人筛选流水线由四个独立 Agent 组成，另有对话摘要 Agent 处理 AI 初筛回答：

| 目录 | Agent | 职责 |
| --- | --- | --- |
| `简历结构化Agent/简历结构化Agent.js` | 简历结构化 Agent | 提取职位、年限、学历、地点、技能和工作经历 |
| `岗位证据匹配Agent/岗位证据匹配Agent.js` | 岗位证据匹配 Agent | 将简历事实映射到岗位评价项并返回原文引用 |
| `证据审计Agent/证据审计Agent.js` | 证据审计 Agent | 校验原文、硬性条件、置信度和信息缺口 |
| `候选人摘要Agent/候选人摘要Agent.js` | 候选人摘要 Agent | 只基于已审计证据生成客观摘要 |
| `对话摘要Agent/对话摘要Agent.js` | 对话摘要 Agent | 生成通话摘要，并识别经回答原文核验后参与评分的岗位信号 |

`orchestrator.js` 只负责执行顺序、状态记录和失败回退，不包含具体 Agent 的业务规则。

## Agent 接口

每个目录统一导出元数据和执行函数：

```js
module.exports = {
  metadata: { id, name, role },
  run: async (context) => result,
};
```

修改某个 Agent 时，只需要更新对应目录，不影响其他 Agent 或确定性评分代码。
