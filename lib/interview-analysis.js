"use strict";

const {
  cleanText,
  LEVEL_META,
  normalizeCriteria,
} = require("./screening");
const { normalizeForEvidence } = require("./evidence");

const INTERVIEW_EVIDENCE_WEIGHT = 0.35;
const LEVELS = new Set(Object.keys(LEVEL_META));

function findQuoteInAnswers(answers, quote) {
  const quoteKey = normalizeForEvidence(quote);
  if (quoteKey.length < 2) return null;
  return answers.find((answer) => (
    normalizeForEvidence(answer.answer).includes(quoteKey)
  )) || null;
}

function verifyInterviewAnalysis(analysis, answers, criteria) {
  const normalizedCriteria = normalizeCriteria(criteria);
  const criterionIds = new Set(normalizedCriteria.map((criterion) => criterion.id));
  const safeAnswers = (Array.isArray(answers) ? answers : [])
    .map((answer) => ({
      questionId: cleanText(answer.questionId || "").slice(0, 80),
      question: cleanText(answer.question || "").slice(0, 500),
      answer: cleanText(answer.answer || "").slice(0, 2_000),
    }))
    .filter((answer) => answer.answer);
  const sourceCriteria = Array.isArray(analysis?.criteria) ? analysis.criteria : [];
  const byCriterion = new Map();
  for (const item of sourceCriteria) {
    const criterionId = String(item?.criterionId || "");
    if (criterionIds.has(criterionId) && !byCriterion.has(criterionId)) {
      byCriterion.set(criterionId, item);
    }
  }

  let verifiedCount = 0;
  let rejectedCount = 0;
  const verifiedCriteria = [];
  for (const criterion of normalizedCriteria) {
    const item = byCriterion.get(criterion.id);
    if (!item) {
      verifiedCriteria.push({
        criterionId: criterion.id,
        level: "none",
        confidence: 0,
        evidence: [],
        status: "missing",
        reasoning: "",
        verification: "verified",
      });
      continue;
    }
    const level = LEVELS.has(String(item.level || "")) ? String(item.level) : "none";
    const evidence = [];
    for (const rawQuote of (Array.isArray(item.evidenceQuotes) ? item.evidenceQuotes : []).slice(0, 4)) {
      const quote = cleanText(rawQuote).slice(0, 240);
      const matchedAnswer = findQuoteInAnswers(safeAnswers, quote);
      if (!matchedAnswer) continue;
      evidence.push({
        quote,
        questionId: matchedAnswer.questionId,
        question: matchedAnswer.question,
        source: "AI 通话回答",
        matchedKeyword: "对话证据",
      });
    }
    if (level !== "none" && !evidence.length) {
      rejectedCount += 1;
      verifiedCriteria.push({
        criterionId: criterion.id,
        level: "none",
        confidence: 0,
        evidence: [],
        status: "missing",
        reasoning: "模型结论没有提供可在候选人回答中逐字核验的引用，已回退为未提及。",
        verification: "rejected",
      });
      continue;
    }
    verifiedCount += 1;
    verifiedCriteria.push({
      criterionId: criterion.id,
      level,
      confidence: Math.min(1, Math.max(0, Number(item.confidence) || 0)),
      evidence,
      status: level === "none" ? "missing" : "stated",
      reasoning: cleanText(item.reasoning || "").slice(0, 300),
      verification: "verified",
    });
  }

  return {
    summary: cleanText(analysis?.summary || "").slice(0, 500),
    criteria: verifiedCriteria,
    verifiedCount,
    rejectedCount,
  };
}

module.exports = {
  INTERVIEW_EVIDENCE_WEIGHT,
  verifyInterviewAnalysis,
};
