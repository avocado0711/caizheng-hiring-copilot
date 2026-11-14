"use strict";

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function uniqueMatches(list) {
  const seen = new Set();
  return (list || []).filter((item) => {
    const key = item.sourceId || item.chunkId;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function assessExperience({
  candidate,
  evaluation,
  criteria = [],
  entities = [],
  knowledgeMatches = [],
}) {
  const text = String(candidate?.text || "");
  const quantitativeLines = new Set(
    (text.match(/[^\n]*(?:\d+(?:\.\d+)?%|\d+(?:\.\d+)?\s*倍|百万|千万|亿|吞吐|延迟|转化率|准确率|召回率|提升|降低|减少|增长)[^\n]*/g) || [])
      .map((line) => line.trim())
      .filter(Boolean),
  );
  const responsibilityLines = new Set(
    (text.match(/[^\n]*(?:主导|负责|设计|架构|实现|推动|牵头|负责人|owner|核心开发)[^\n]*/gi) || [])
      .map((line) => line.trim())
      .filter(Boolean),
  );
  const complexityTerms = new Set(
    (text.match(/高并发|分布式|大规模|百万级|千万级|多租户|实时|核心链路|跨团队|生产上线|模型推理|RAG|Agent|向量检索/gi) || [])
      .map((item) => item.toLocaleLowerCase()),
  );
  const matches = uniqueMatches(knowledgeMatches);
  const matchedCriteria = (evaluation?.criteriaResults || [])
    .filter((result) => result.level !== "none");
  const completeness = evaluation?.totalCriteria
    ? (evaluation.matchedCount / evaluation.totalCriteria) * 100
    : 0;

  const dimensions = [
    {
      key: "roleRelevance",
      label: "岗位相关证据",
      score: clamp(evaluation?.score || 0),
      note: `已覆盖 ${evaluation?.matchedCount || 0}/${evaluation?.totalCriteria || criteria.length} 个评价项`,
    },
    {
      key: "outcomeEvidence",
      label: "成果可验证度",
      score: clamp(18 + quantitativeLines.size * 18),
      note: quantitativeLines.size
        ? `发现 ${quantitativeLines.size} 条包含指标或量化结果的表述`
        : "简历中尚未发现明确量化结果",
    },
    {
      key: "responsibilityDepth",
      label: "职责深度",
      score: clamp(16 + responsibilityLines.size * 14),
      note: `发现 ${responsibilityLines.size} 条职责或主导性表述`,
    },
    {
      key: "complexity",
      label: "场景复杂度",
      score: clamp(15 + complexityTerms.size * 15),
      note: complexityTerms.size
        ? `涉及 ${complexityTerms.size} 类复杂场景关键词`
        : "尚未体现复杂系统或高影响业务场景",
    },
    {
      key: "evidenceCompleteness",
      label: "证据完整度",
      score: clamp(completeness),
      note: `${matchedCriteria.length} 个评价项具备可用证据`,
    },
    {
      key: "externalCorroboration",
      label: "知识库背景",
      score: null,
      displayValue: `${matches.length} 条`,
      barPercent: 0,
      note: matches.length
        ? `命中 ${matches.length} 条候选人经历关联资料；不计入指数`
        : "没有与候选人经历直接关联的资料；不影响指数",
    },
  ];

  const weightedDimensions = dimensions.filter((dimension) => dimension.score != null);
  const weightMap = {
    roleRelevance: 0.28,
    outcomeEvidence: 0.2,
    responsibilityDepth: 0.16,
    complexity: 0.14,
    evidenceCompleteness: 0.12,
  };
  const weightTotal = weightedDimensions.reduce(
    (sum, dimension) => sum + (weightMap[dimension.key] || 0),
    0,
  );
  const index = weightTotal
    ? Math.round(weightedDimensions.reduce(
        (sum, dimension) => sum + dimension.score * (weightMap[dimension.key] || 0),
        0,
      ) / weightTotal)
    : 0;
  const level = index >= 76
    ? "证据较强"
    : index >= 58
      ? "证据中等"
      : index >= 38
        ? "需要补证"
        : "信息不足";

  return {
    index,
    level,
    dimensions,
    quantifiedEvidence: [...quantitativeLines].slice(0, 6),
    responsibilityEvidence: [...responsibilityLines].slice(0, 6),
    entityCounts: entities.reduce((result, entity) => {
      result[entity.type] = (result[entity.type] || 0) + 1;
      return result;
    }, {}),
    strengths: [
      ...(evaluation?.criteriaResults || [])
        .filter((result) => ["strong", "medium"].includes(result.level))
        .map((result) => result.name),
    ].slice(0, 5),
    gaps: [
      ...(evaluation?.criteriaResults || [])
        .filter((result) => result.level === "none")
        .map((result) => `${result.name}未发现证据`),
    ].slice(0, 5),
    disclaimer: "知识库背景只展示与候选人本人经历实体关联的资料数量，不参与指数计算，也不代表个人价值或录用结论。",
  };
}

module.exports = { assessExperience };
