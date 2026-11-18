"use strict";

const LEVEL_META = Object.freeze({
  strong: { label: "强", score: 1, rank: 3 },
  medium: { label: "中", score: 2 / 3, rank: 2 },
  weak: { label: "弱", score: 1 / 3, rank: 1 },
  none: { label: "未提及", score: 0, rank: 0 },
});
const INTERVIEW_EVIDENCE_WEIGHT = 0.35;

const SKILL_TERMS = [
  "Python", "Java", "JavaScript", "TypeScript", "Go", "Golang", "C++", "C#",
  "SQL", "MySQL", "PostgreSQL", "Redis", "MongoDB", "Elasticsearch",
  "React", "Vue", "Angular", "Node.js", "FastAPI", "Django", "Spring",
  "Kubernetes", "Docker", "AWS", "Azure", "GCP", "Linux",
  "数据分析", "数据仓库", "数据治理", "机器学习", "深度学习", "大模型",
  "产品设计", "项目管理", "用户研究", "运营", "销售", "招聘", "财务",
  "供应链", "风控", "审计", "Excel", "PowerBI", "Tableau",
];

const PROTECTED_CRITERION_RULES = Object.freeze([
  { label: "年龄或出生日期", pattern: /年龄|出生(?:日期|年月)|\d{1,3}\s*周?岁/i },
  { label: "性别", pattern: /性别|男性|女性|男士|女士/i },
  { label: "婚育状况", pattern: /婚育|婚姻|已婚|未婚|离异|配偶|生育|怀孕|备孕|子女|宝妈|奶爸/i },
  { label: "民族", pattern: /民族|汉族|少数民族/i },
  { label: "籍贯或出生地", pattern: /籍贯|老家|出生地/i },
  { label: "户籍", pattern: /户籍/i },
  { label: "家庭住址", pattern: /家庭住址|现住址|通信地址|详细住址/i },
  { label: "身份证件", pattern: /身份证|证件号/i },
  { label: "照片或外貌", pattern: /照片|头像|长相|容貌/i },
  { label: "健康或残疾信息", pattern: /健康状况|健康状态|疾病|病史|残疾|体检/i },
]);

function cleanText(value) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function splitKeywords(value) {
  const source = Array.isArray(value) ? value : String(value ?? "").split(/[,，;；\n|/]+/);
  const seen = new Set();
  return source
    .map((item) => cleanText(item).trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeCriteria(criteria) {
  if (!Array.isArray(criteria)) return [];
  return criteria.slice(0, 20).map((criterion, index) => ({
    id: String(criterion?.id || `criterion-${index + 1}`),
    name: cleanText(criterion?.name || `评价项 ${index + 1}`).slice(0, 60),
    description: cleanText(criterion?.description || "").slice(0, 300),
    keywords: splitKeywords(criterion?.keywords).slice(0, 40),
    weight: clampNumber(criterion?.weight, 0, 100, 10),
    required: Boolean(criterion?.required),
    suggested: Boolean(criterion?.suggested),
  }));
}

function findProtectedCriterion(criteria) {
  for (const criterion of normalizeCriteria(criteria)) {
    const searchable = [
      criterion.name,
      criterion.description,
      ...criterion.keywords,
    ].join(" ");
    const matchedRule = PROTECTED_CRITERION_RULES.find((rule) => rule.pattern.test(searchable));
    if (matchedRule) {
      return {
        criterionId: criterion.id,
        criterionName: criterion.name,
        label: matchedRule.label,
      };
    }
  }
  return null;
}

function criteriaSignature(criteria) {
  return JSON.stringify(normalizeCriteria(criteria).map((criterion) => ({
    id: criterion.id,
    name: criterion.name,
    description: criterion.description,
    keywords: criterion.keywords,
    required: criterion.required,
  })));
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function termVariants(term) {
  const normalized = term.toLocaleLowerCase();
  const variants = new Set([normalized]);
  if (normalized.endsWith("经验")) variants.add(normalized.slice(0, -2));
  if (normalized.endsWith("能力")) variants.add(normalized.slice(0, -2));
  return [...variants].filter((value) => value.length >= 2);
}

function keywordOccurrences(line, keyword) {
  const occurrences = [];
  for (const variant of termVariants(keyword)) {
    if (!/[A-Za-z0-9]/.test(variant)) {
      let offset = 0;
      while (offset < line.length) {
        const index = line.indexOf(variant, offset);
        if (index < 0) break;
        occurrences.push(index);
        offset = index + Math.max(1, variant.length);
      }
      continue;
    }
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const startsWithAscii = /^[A-Za-z0-9]/.test(variant);
    const endsWithAscii = /[A-Za-z0-9]$/.test(variant);
    const pattern = new RegExp(
      `${startsWithAscii ? "(?<![A-Za-z0-9])" : ""}${escaped}${endsWithAscii ? "(?![A-Za-z0-9])" : ""}`,
      "gi",
    );
    for (const match of line.matchAll(pattern)) occurrences.push(match.index);
  }
  return [...new Set(occurrences)].sort((left, right) => left - right);
}

function occurrenceIsNegated(line, index) {
  const prefix = line
    .slice(0, index)
    .split(/[，,。；;！？!?]|(?:但|但是|然而|不过|而是)/)
    .at(-1) || "";
  return /(?:不具备|不熟悉|不会|未使用|未掌握|不掌握|未接触|不涉及|缺乏|没有|无经验|零经验|零基础)/i
    .test(prefix);
}

function findCriterionEvidence(text, criterion, sourceName = "简历") {
  const keywords = splitKeywords(criterion.keywords);
  if (!keywords.length) {
    return {
      level: "none",
      confidence: 0,
      matchedKeywords: [],
      evidence: [],
      status: "missing",
      sourceName,
    };
  }

  const lines = cleanText(text).split("\n");
  const evidence = [];
  const matchedKeywords = new Set();
  const negativeKeywords = new Set();
  const evidenceKeys = new Set();

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex].trim();
    if (!line) continue;
    for (const keyword of keywords) {
      const occurrences = keywordOccurrences(line, keyword);
      if (!occurrences.length) continue;
      const positiveOccurrences = occurrences.filter((index) => !occurrenceIsNegated(line, index));
      if (positiveOccurrences.length) matchedKeywords.add(keyword);
      else negativeKeywords.add(keyword);
      const polarity = positiveOccurrences.length ? "positive" : "negative";
      if (positiveOccurrences.length || occurrences.length) {
        const snippet = line.length > 220 ? `${line.slice(0, 217)}...` : line;
        const key = `${snippet.toLocaleLowerCase()}:${polarity}`;
        if (!evidenceKeys.has(key) && evidence.length < 4) {
          evidenceKeys.add(key);
          evidence.push({
            quote: snippet,
            line: lineIndex + 1,
            source: sourceName,
            matchedKeyword: keyword,
            polarity,
          });
        }
      }
    }
  }

  const count = matchedKeywords.size;
  const level = count >= 3 ? "strong" : count >= 2 ? "medium" : count === 1 ? "weak" : "none";
  const status = count
    ? (negativeKeywords.size ? "conflicting" : "stated")
    : (negativeKeywords.size ? "absent" : "missing");
  return {
    level,
    confidence: count === 0 && negativeKeywords.size
      ? Math.min(0.9, 0.68 + negativeKeywords.size * 0.06)
      : count === 0
        ? 0
        : Math.min(0.96, 0.58 + count * 0.09 + evidence.length * 0.03),
    matchedKeywords: [...matchedKeywords],
    negativeKeywords: [...negativeKeywords],
    evidence,
    status,
    sourceName,
  };
}

function latestInterviewAnalysis(candidate, signature) {
  const interviews = (Array.isArray(candidate?.webInterviews) ? candidate.webInterviews : [])
    .filter((interview) => (
      interview?.analysis?.criteriaSignature === signature
      && Array.isArray(interview.analysis.criteria)
    ))
    .sort((left, right) => (
      new Date(right.endedAt || right.createdAt || 0).getTime()
      - new Date(left.endedAt || left.createdAt || 0).getTime()
    ));
  return interviews[0]?.analysis || null;
}

function resultHasEvidence(result) {
  if (result.override) return result.level !== "none";
  return result.level !== "none" || result.interviewLevel !== "none";
}

function evaluateCandidate(candidate, criteria) {
  const normalized = normalizeCriteria(criteria);
  const signature = criteriaSignature(normalized);
  const aiStatusBlocked = ["pending", "processing", "error", "stale"].includes(candidate?.aiStatus);
  const aiAnalysisIsCurrent = !aiStatusBlocked && candidate?.aiAnalysis?.criteriaSignature === signature;
  const interviewAnalysis = latestInterviewAnalysis(candidate, signature);
  const interviewSignals = new Map(
    (interviewAnalysis?.criteria || []).map((item) => [item.criterionId, item]),
  );
  const overrides = candidate?.overrides && typeof candidate.overrides === "object"
    ? candidate.overrides
    : {};

  const results = normalized.map((criterion) => {
    const keywordMatch = findCriterionEvidence(candidate?.text || "", criterion, candidate?.fileName || "简历");
    const aiMatch = aiAnalysisIsCurrent ? candidate?.aiAnalysis?.criteria?.find(
      (item) => item.criterionId === criterion.id && item.verification === "verified",
    ) : null;
    const match = aiMatch
      ? {
          level: LEVEL_META[aiMatch.level] ? aiMatch.level : "none",
          confidence: clampNumber(aiMatch.confidence, 0, 1, 0),
          matchedKeywords: [],
          evidence: Array.isArray(aiMatch.evidence) ? aiMatch.evidence : [],
          status: aiMatch.status || (aiMatch.level === "none" ? "missing" : "stated"),
          sourceName: candidate?.fileName || "简历",
          reasoning: cleanText(aiMatch.reasoning || ""),
          matchSource: "llm",
        }
      : {
          ...keywordMatch,
          reasoning: "",
          matchSource: "keyword",
        };
    const override = overrides[criterion.id];
    const humanOverride = override && LEVEL_META[override.level]
      ? {
          level: override.level,
          note: cleanText(override.note || "").slice(0, 300),
        }
      : null;
    const rawInterviewSignal = interviewSignals.get(criterion.id);
    const interviewSignal = rawInterviewSignal?.verification === "verified"
      ? rawInterviewSignal
      : null;
    const interviewLevel = LEVEL_META[interviewSignal?.level] ? interviewSignal.level : "none";
    const level = humanOverride?.level || match.level;
    const resumeCriterionScore = LEVEL_META[level]?.score || 0;
    const interviewCriterionScore = LEVEL_META[interviewLevel]?.score || 0;
    const criterionScore = !humanOverride && interviewLevel !== "none"
      ? (resumeCriterionScore * (1 - INTERVIEW_EVIDENCE_WEIGHT))
        + (interviewCriterionScore * INTERVIEW_EVIDENCE_WEIGHT)
      : resumeCriterionScore;
    return {
      ...criterion,
      ...match,
      detectedLevel: match.level,
      resumeLevel: match.level,
      level,
      criterionScore,
      interviewLevel,
      interviewConfidence: interviewSignal?.confidence || 0,
      interviewEvidence: interviewSignal?.evidence || [],
      interviewReasoning: interviewSignal?.reasoning || "",
      override: humanOverride,
      matchSource: humanOverride ? "human" : match.matchSource,
    };
  });

  const weightTotal = results.reduce((sum, result) => sum + Math.max(0.01, result.weight), 0);
  const resumeWeightedScore = results.reduce(
    (sum, result) => sum + (LEVEL_META[result.level]?.score || 0) * result.weight,
    0,
  );
  const combinedWeightedScore = results.reduce(
    (sum, result) => sum + result.criterionScore * result.weight,
    0,
  );
  const resumeScore = Math.round((resumeWeightedScore / Math.max(0.01, weightTotal)) * 100);
  const score = Math.round((combinedWeightedScore / Math.max(0.01, weightTotal)) * 100);
  const requiredResults = results.filter((result) => result.required);
  const gateMet = requiredResults.every(resultHasEvidence);
  const matched = results.filter(resultHasEvidence);
  const resumeMatched = results.filter((result) => result.level !== "none");
  const resumeEvidenceCount = results.reduce((sum, result) => sum + result.evidence.length, 0);
  const interviewEvidenceCount = results.reduce(
    (sum, result) => sum + result.interviewEvidence.length,
    0,
  );
  const interviewCriteriaCovered = results.filter((result) => result.interviewLevel !== "none").length;

  return {
    score,
    resumeScore,
    gateMet,
    gateLabel: requiredResults.length ? (gateMet ? "硬性条件已覆盖" : "存在硬性缺口") : "无硬性条件",
    requiredTotal: requiredResults.length,
    requiredMet: requiredResults.filter(resultHasEvidence).length,
    matchedCount: matched.length,
    resumeMatchedCount: resumeMatched.length,
    totalCriteria: results.length,
    evidenceCount: resumeEvidenceCount + interviewEvidenceCount,
    resumeEvidenceCount,
    interviewEvidenceCount,
    interviewInfluence: {
      applied: interviewCriteriaCovered > 0,
      weight: INTERVIEW_EVIDENCE_WEIGHT,
      interviewId: interviewAnalysis?.interviewId || null,
      criteriaCovered: interviewCriteriaCovered,
      adjustment: score - resumeScore,
      scoreBefore: resumeScore,
      scoreAfter: score,
    },
    criteriaResults: results,
  };
}

function rankCandidates(candidates, criteria) {
  return candidates
    .map((candidate) => ({
      ...candidate,
      evaluation: evaluateCandidate(candidate, criteria),
    }))
    .sort((left, right) => {
      if (left.evaluation.gateMet !== right.evaluation.gateMet) {
        return left.evaluation.gateMet ? -1 : 1;
      }
      if (left.evaluation.score !== right.evaluation.score) {
        return right.evaluation.score - left.evaluation.score;
      }
      return String(left.importedAt).localeCompare(String(right.importedAt));
    })
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}

function buildCandidateSummary(candidate, evaluation) {
  const years = candidate?.profile?.yearsExperience;
  const education = candidate?.profile?.education;
  const matched = evaluation.criteriaResults
    .filter(resultHasEvidence)
    .sort((a, b) => (
      Math.max(LEVEL_META[b.level]?.rank || 0, LEVEL_META[b.interviewLevel]?.rank || 0)
      - Math.max(LEVEL_META[a.level]?.rank || 0, LEVEL_META[a.interviewLevel]?.rank || 0)
    ));
  const highlights = matched.slice(0, 3).map((result) => {
    const quote = result.evidence[0]?.quote || result.interviewEvidence[0]?.quote || result.name;
    return `${result.name}：${quote}`;
  });
  const prefix = [
    years ? `${years} 年经验` : "",
    education || "",
  ].filter(Boolean).join(" · ");
  const signature = criteriaSignature(evaluation.criteriaResults);
  const aiStatusBlocked = ["pending", "processing", "error", "stale"].includes(candidate?.aiStatus);
  const aiSummary = !aiStatusBlocked && candidate?.aiAnalysis?.criteriaSignature === signature
    ? cleanText(candidate.aiAnalysis.summary || "")
    : "";
  return {
    headline: aiSummary || (highlights.length ? `${prefix ? `${prefix}；` : ""}${highlights.join("；")}` : (prefix || "简历中未发现评价项证据")),
    source: aiSummary ? "llm" : "keyword",
    strengths: matched.slice(0, 4).map((result) => result.name),
    gaps: evaluation.criteriaResults
      .filter((result) => result.required && result.level === "none")
      .map((result) => `${result.name}${result.status === "absent" ? "（明确否定）" : "（未提及）"}`),
    missing: evaluation.criteriaResults
      .filter((result) => result.level === "none")
      .map((result) => `${result.name}${result.status === "absent" ? "（明确否定）" : "（未提及）"}`),
  };
}

function suggestCriteria(description) {
  const text = cleanText(description);
  const detectedSkills = SKILL_TERMS.filter((skill) => text.toLocaleLowerCase().includes(skill.toLocaleLowerCase()));
  const criteria = [
    {
      id: "criterion-experience",
      name: "相关工作经验",
      description: "与目标岗位直接相关的工作年限、职责范围和工作复杂度。",
      keywords: ["年经验", "工作经历", "负责", "主导", ...detectedSkills.slice(0, 3)],
      weight: 30,
      required: true,
    },
    {
      id: "criterion-skills",
      name: "核心技能",
      description: "岗位要求中的关键工具、技术或专业能力。",
      keywords: detectedSkills.length ? detectedSkills : ["技能", "熟练", "掌握"],
      weight: 30,
      required: true,
    },
    {
      id: "criterion-delivery",
      name: "项目成果",
      description: "有明确产出、指标或业务结果的代表性项目。",
      keywords: ["项目", "上线", "交付", "优化", "提升", "降低", "指标", "结果"],
      weight: 20,
      required: false,
    },
    {
      id: "criterion-collaboration",
      name: "跨团队协作",
      description: "推动多方协作、沟通和解决复杂问题的证据。",
      keywords: ["跨团队", "协作", "沟通", "推动", "协调", "合作"],
      weight: 10,
      required: false,
    },
    {
      id: "criterion-education",
      name: "教育背景",
      description: "与岗位相关的学历或专业基础；仅作为岗位相关条件使用。",
      keywords: ["本科", "硕士", "博士", "学历", "专业"],
      weight: 10,
      required: false,
    },
  ];
  return criteria.map((criterion) => ({ ...criterion, suggested: true }));
}

module.exports = {
  INTERVIEW_EVIDENCE_WEIGHT,
  LEVEL_META,
  SKILL_TERMS,
  buildCandidateSummary,
  cleanText,
  criteriaSignature,
  evaluateCandidate,
  findProtectedCriterion,
  findCriterionEvidence,
  normalizeCriteria,
  rankCandidates,
  splitKeywords,
  suggestCriteria,
};
