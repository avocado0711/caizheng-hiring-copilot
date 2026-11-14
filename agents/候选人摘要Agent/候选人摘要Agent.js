"use strict";

const { safeFileName } = require("../shared");

const metadata = Object.freeze({
  id: "summary",
  name: "候选人摘要 Agent",
  role: "只基于已审计证据生成客观摘要。",
});

async function run({ llmClient, candidate, profile, criteria }) {
  const verifiedEvidence = (Array.isArray(criteria) ? criteria : [])
    .filter((criterion) => criterion.verification === "verified")
    .map((criterion) => ({
      criterionId: criterion.criterionId,
      level: criterion.level,
      confidence: criterion.confidence,
      evidenceQuotes: (criterion.evidence || []).map((item) => item.quote),
      reasoning: criterion.reasoning,
    }));
  const system = `你是“候选人摘要 Agent”。只根据已校验的结构化信息和工作证据撰写客观摘要。
输出 JSON：{"summary":"不超过180字"}
要求：
1. 不添加输入中没有的事实，不写主观赞美，不推断敏感属性。
2. 不使用姓名、联系方式、年龄、性别、婚育、民族、籍贯或住址。
3. 优先说明相关经历、技能和可核验成果；信息不足时明确说明。
4. 不重新判断等级，不修改已有证据。`;
  return llmClient.completeJson({
    system,
    user: JSON.stringify({
      fileName: safeFileName(candidate.fileName, candidate.profile?.name),
      profile: profile || {},
      verifiedEvidence,
    }),
    maxTokens: 900,
  });
}

module.exports = { metadata, run };
