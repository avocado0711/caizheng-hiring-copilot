"use strict";

const { LEVEL_META } = require("../../lib/screening");

const metadata = Object.freeze({
  id: "audit",
  name: "证据审计 Agent",
  role: "校验引用、硬性条件、低置信度和信息缺口。",
});

function run({ candidate, criteria, verified, profile }) {
  const issues = [];
  const rejected = verified.criteria.filter((item) => item.verification === "rejected");
  if (rejected.length) {
    issues.push(`${rejected.length} 个模型结论因原文引用无法核验而被丢弃`);
  }

  const resultByCriterion = new Map(verified.criteria.map((item) => [item.criterionId, item]));
  const missingRequired = criteria.filter((criterion) => {
    if (!criterion.required) return false;
    const result = resultByCriterion.get(criterion.id);
    return !result || result.level === "none";
  });
  if (missingRequired.length) {
    issues.push(`硬性评价项未在简历中发现证据：${missingRequired.map((criterion) => criterion.name).join("、")}`);
  }

  const omitted = criteria.filter((criterion) => !resultByCriterion.has(criterion.id));
  if (omitted.length) {
    issues.push(`证据匹配 Agent 未返回 ${omitted.length} 个评价项，系统将使用关键词基线补齐`);
  }

  const weakStrong = verified.criteria.filter(
    (item) => LEVEL_META[item.level] && item.level === "strong" && item.confidence < 0.55,
  );
  if (weakStrong.length) {
    issues.push(`${weakStrong.length} 个“强”等级置信度偏低，建议人工复核`);
  }

  if (!candidate.profile?.email && !candidate.profile?.phone) {
    issues.push("未识别到邮箱或电话，身份与联系方式需人工核对");
  }

  if (candidate.profile?.yearsExperience != null && profile.yearsExperience != null) {
    const difference = Math.abs(candidate.profile.yearsExperience - profile.yearsExperience);
    if (difference >= 1) {
      issues.push(`工作年限提取存在差异：规则 ${candidate.profile.yearsExperience} 年，结构化 Agent ${profile.yearsExperience} 年`);
    }
  }

  return {
    status: issues.length ? "attention" : "pass",
    issues,
    verifiedCount: verified.criteria.filter((item) => item.verification === "verified").length,
    rejectedCount: rejected.length,
  };
}

module.exports = { metadata, run };
