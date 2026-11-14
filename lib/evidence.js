"use strict";

const { cleanText, normalizeCriteria, LEVEL_META } = require("./screening");

const LEVELS = new Set(Object.keys(LEVEL_META));

function normalizeForEvidence(value) {
  return String(value ?? "")
    .replace(/^[\s"'“”‘’`]+|[\s"'“”‘’`]+$/g, "")
    .replace(/^[•·\-*]\s*/, "")
    .replace(/\s+/g, "")
    .toLocaleLowerCase();
}

function findEvidenceLine(text, quote) {
  const quoteKey = normalizeForEvidence(quote);
  if (quoteKey.length < 2) return null;
  const compact = String(text).replace(/\s+/g, "");
  if (!compact.toLocaleLowerCase().includes(quoteKey)) return null;
  const quoteHead = quoteKey.slice(0, Math.min(20, quoteKey.length));
  const lines = String(text).split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    if (normalizeForEvidence(lines[index]).includes(quoteHead)) return index + 1;
  }
  return 1;
}

function verifyAiAnalysis(analysis, candidate, criteria) {
  const normalizedCriteria = normalizeCriteria(criteria);
  const criterionIds = new Set(normalizedCriteria.map((criterion) => criterion.id));
  const sourceCriteria = Array.isArray(analysis?.criteria) ? analysis.criteria : [];
  const verifiedCriteria = [];

  for (const item of sourceCriteria) {
    const criterionId = String(item?.criterionId || "");
    const level = String(item?.level || "none");
    if (!criterionIds.has(criterionId) || !LEVELS.has(level)) continue;
    const quotes = Array.isArray(item?.evidenceQuotes) ? item.evidenceQuotes : [];
    const evidence = [];
    for (const rawQuote of quotes.slice(0, 4)) {
      const quote = cleanText(rawQuote).slice(0, 240);
      const line = findEvidenceLine(candidate.text, quote);
      if (line === null) continue;
      evidence.push({
        quote,
        line,
        source: candidate.fileName || "简历",
        matchedKeyword: "模型证据",
      });
    }
    if (level !== "none" && !evidence.length) {
      verifiedCriteria.push({
        criterionId,
        level: "none",
        confidence: 0,
        evidence: [],
        status: "missing",
        reasoning: "模型结论未提供可在简历原文中核验的引用，已回退为未提及。",
        verification: "rejected",
      });
      continue;
    }
    const confidence = Math.min(1, Math.max(0, Number(item?.confidence) || 0));
    verifiedCriteria.push({
      criterionId,
      level,
      confidence,
      evidence,
      status: level === "none" ? "missing" : "stated",
      reasoning: cleanText(item?.reasoning || "").slice(0, 300),
      verification: "verified",
    });
  }

  return {
    summary: cleanText(analysis?.summary || "").slice(0, 500),
    currentTitle: cleanText(analysis?.profile?.currentTitle || "").slice(0, 100),
    yearsExperience: Number.isFinite(Number(analysis?.profile?.yearsExperience))
      ? Math.min(60, Math.max(0, Number(analysis.profile.yearsExperience)))
      : null,
    education: cleanText(analysis?.profile?.education || "").slice(0, 40),
    criteria: verifiedCriteria,
    truncated: Boolean(analysis?.truncated),
  };
}

function redactResumeForLlm(text, candidateName = "") {
  const protectedLine = /^\s*(?:年龄|性别|婚育|婚姻状况|民族|籍贯|户籍|住址|家庭住址|身份证|照片|出生日期|出生年月)\s*[：:]/i;
  const name = cleanText(candidateName);
  return String(text ?? "")
    .split("\n")
    .filter((line) => !protectedLine.test(line))
    .map((line) => {
      if (/^\s*(?:姓\s*名|name)\s*[：:]/i.test(line)) return "姓名：[已隐去]";
      let redacted = line
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[邮箱已隐去]")
        .replace(/(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d[-\s]?\d{4}[-\s]?\d{4}(?!\d)/g, "[电话已隐去]")
        .replace(/(?<!\d)\d{17}[\dXx](?!\d)/g, "[证件号已隐去]");
      if (name.length >= 2) redacted = redacted.split(name).join("[姓名已隐去]");
      return redacted;
    })
    .join("\n");
}

function sumUsage(items) {
  const total = {};
  for (const usage of items.filter(Boolean)) {
    for (const [key, value] of Object.entries(usage)) {
      if (typeof value === "number") total[key] = (total[key] || 0) + value;
    }
  }
  return Object.keys(total).length ? total : null;
}

module.exports = {
  findEvidenceLine,
  normalizeForEvidence,
  redactResumeForLlm,
  sumUsage,
  verifyAiAnalysis,
};
