"use strict";

const { cleanText } = require("../lib/screening");

function fallbackQuestions({
  criteriaResults = [],
  valueAssessment,
  knowledgeMatches = [],
  candidateText = "",
}) {
  const questions = [];
  const missing = criteriaResults.filter((result) => result.level === "none");
  const weak = criteriaResults.filter((result) => result.level === "weak");
  for (const result of [...missing, ...weak].slice(0, 3)) {
    questions.push({
      question: `请具体说明你在“${result.name}”相关工作中的职责、方法、难点和最终结果。`,
      reason: result.level === "none"
        ? "简历未发现该岗位评价项的直接证据"
        : "该岗位评价项目前只有较弱证据",
      criterionId: result.id,
      sourceIds: [],
    });
  }
  if (!valueAssessment?.quantifiedEvidence?.length) {
    questions.push({
      question: "能否补充一个可以量化的项目结果，例如效率、性能、准确率、成本或业务指标？",
      reason: "简历成果主要以职责描述为主，缺少可比较指标",
      criterionId: "",
      sourceIds: [],
    });
  }
  const corroboratingMatches = knowledgeMatches
    .filter((match) => !match.entityName || String(candidateText).includes(match.entityName))
    .slice(0, 2);
  for (const match of corroboratingMatches) {
    questions.push({
      question: `公开资料显示“${match.entityName || match.title}”与当前岗位背景存在关联。请说明你个人负责的具体部分、技术边界和可核验结果。`,
      reason: "公开资料可以佐证组织或项目背景，但不能直接证明个人贡献",
      criterionId: "",
      sourceIds: [match.sourceId],
    });
  }
  if (!questions.length) {
    questions.push({
      question: "请选一个最有代表性的项目，说明你的角色、最困难的技术判断以及上线后的实际影响。",
      reason: "进一步验证简历中最强的经历证据",
      criterionId: "",
      sourceIds: [],
    });
  }
  return [...new Map(
    questions.map((item) => [item.question.toLocaleLowerCase(), item]),
  ).values()].slice(0, 5);
}

async function generateInterviewQuestions({
  llmClient,
  candidate,
  criteriaResults,
  valueAssessment,
  knowledgeMatches,
}) {
  const fallback = fallbackQuestions({
    criteriaResults,
    valueAssessment,
    knowledgeMatches,
    candidateText: candidate.text,
  });
  if (!llmClient?.configured) return { questions: fallback, source: "rules" };

  const evidence = criteriaResults.map((result) => ({
    criterion: result.name,
    level: result.level,
    evidence: (result.evidence || []).map((item) => item.quote),
    reasoning: result.reasoning,
  }));
  const publicContext = (knowledgeMatches || []).slice(0, 5).map((match) => ({
    sourceId: match.sourceId,
    title: match.title,
    entityName: match.entityName,
    snippet: match.snippet,
    synthetic: match.synthetic,
  }));
  const system = `你是招聘面试追问生成器。只根据已校验岗位证据、证据缺口和提供的公开知识片段生成追问。
输出 JSON：
{
  "questions": [
    {
      "question": "具体、可回答的追问",
      "reason": "为什么需要问",
      "criterionId": "关联评价项id或空字符串",
      "sourceIds": ["只能使用输入中的 sourceId"]
    }
  ]
}
要求：
1. 生成3到5个问题，不要问年龄、性别、婚育、籍贯等保护性信息。
2. 优先追问缺失、较弱或含糊的证据。
3. 公开资料只能用于核对个人职责和项目背景，不能直接断言个人能力。
4. 不要重复简历中已经明确回答的信息。`;
  try {
    const result = await llmClient.completeJson({
      system,
      user: JSON.stringify({
        candidate: {
          title: candidate.profile?.title || "",
          yearsExperience: candidate.profile?.yearsExperience ?? null,
        },
        verifiedEvidence: evidence,
        evidenceGaps: valueAssessment?.gaps || [],
        publicContext,
      }),
      maxTokens: 1_400,
    });
    const allowedSources = new Set(publicContext.map((item) => item.sourceId));
    const questions = (result.data?.questions || [])
      .map((item) => ({
        question: cleanText(item.question).slice(0, 240),
        reason: cleanText(item.reason).slice(0, 200),
        criterionId: cleanText(item.criterionId).slice(0, 120),
        sourceIds: (Array.isArray(item.sourceIds) ? item.sourceIds : [])
          .filter((sourceId) => allowedSources.has(sourceId)),
      }))
      .filter((item) => item.question)
      .slice(0, 5);
    return questions.length
      ? { questions, source: "llm", usage: result.usage }
      : { questions: fallback, source: "rules" };
  } catch (error) {
    return {
      questions: fallback,
      source: "rules",
      error: cleanText(error.message).slice(0, 300),
    };
  }
}

module.exports = {
  fallbackQuestions,
  generateInterviewQuestions,
};
