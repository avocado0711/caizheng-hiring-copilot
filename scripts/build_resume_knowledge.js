"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  extractResumeFile,
  parseResumeText,
} = require("../lib/resume");
const { redactResumeForLlm } = require("../lib/evidence");
const { SKILL_TERMS, cleanText } = require("../lib/screening");
const { JsonStore } = require("../lib/store");
const { importKnowledgeDocuments } = require("../knowledge/store");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_SOURCE = "D:\\26572\\简历筛选";
const DEFAULT_OUTPUT = path.join(ROOT, "knowledge", "demo", "resume-screening-knowledge.json");

function parseFilename(fileName) {
  const match = fileName.match(/^(\d+)-(.+?)-(.+)\.pdf$/i);
  if (!match) throw new Error(`无法从文件名解析岗位：${fileName}`);
  return {
    sequence: match[1],
    name: match[2],
    role: match[3].replace(/\s*-\s*/g, " / ").trim(),
  };
}

function sectionLines(text, startHeading, endHeadings) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  const start = lines.findIndex((line) => cleanText(line).includes(startHeading));
  if (start < 0) return [];
  const end = lines.findIndex((line, index) =>
    index > start && endHeadings.some((heading) => cleanText(line).includes(heading)));
  return lines.slice(start + 1, end > start ? end : undefined).map(cleanText).filter(Boolean);
}

function uniqueEvidence(lines, pattern, limit = 4) {
  return [...new Set(lines.filter((line) => pattern.test(line)))].slice(0, limit);
}

function roleId(role) {
  const hash = crypto.createHash("sha1").update(role).digest("hex").slice(0, 10);
  return `resume-role-${hash}`;
}

function caseSection(sample) {
  const work = sectionLines(sample.text, "工作经历", ["项目经历", "专业技能", "教育背景"]);
  const projects = sectionLines(sample.text, "项目经历", ["专业技能", "教育背景", "补充信息"]);
  const outcomes = uniqueEvidence(
    [...work, ...projects],
    /\d+(?:\.\d+)?%|\d+(?:\.\d+)?\s*倍|吞吐|延迟|准确率|召回率|提升|降低|增长|万级|百万|千万|亿/i,
    5,
  );
  const responsibilities = uniqueEvidence(
    [...work, ...projects],
    /负责|主导|设计|架构|实现|推动|牵头|负责人|核心开发/,
    5,
  );
  return [
    `### SAMPLE-${sample.sequence} · ${sample.role}`,
    `经验与学历：${sample.profile.yearsExperience == null ? "未识别" : `${sample.profile.yearsExperience} 年`} · ${sample.profile.education || "未识别"}`,
    `技能证据：${sample.profile.skillsText || "未识别"}`,
    responsibilities.length ? `职责证据：\n${responsibilities.map((line) => `- ${line}`).join("\n")}` : "",
    outcomes.length ? `量化成果：\n${outcomes.map((line) => `- ${line}`).join("\n")}` : "",
    `脱敏简历原文：\n${sample.safeText}`,
  ].filter(Boolean).join("\n\n");
}

async function loadResume(sourceDir, fileName) {
  const filePath = path.join(sourceDir, fileName);
  const metadata = parseFilename(fileName);
  const buffer = fs.readFileSync(filePath);
  const extracted = await extractResumeFile({
    name: fileName,
    type: "application/pdf",
    data: buffer.toString("base64"),
  });
  const profile = parseResumeText(extracted.text, { fileName });
  const safeText = redactResumeForLlm(extracted.text, profile.name || metadata.name)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return {
    ...metadata,
    profile,
    text: extracted.text,
    safeText,
  };
}

function buildPack(samples) {
  const roleGroups = new Map();
  for (const sample of samples) {
    if (!roleGroups.has(sample.role)) roleGroups.set(sample.role, []);
    roleGroups.get(sample.role).push(sample);
  }
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const skillCounts = new Map();
  for (const sample of samples) {
    const text = `${sample.profile.skillsText}\n${sample.text}`.toLocaleLowerCase();
    for (const skill of SKILL_TERMS) {
      if (text.includes(skill.toLocaleLowerCase())) {
        skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1);
      }
    }
  }
  const topSkills = [...skillCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 40)
    .map(([skill, count]) => `${skill}(${count})`)
    .join("、");
  const documents = [{
    id: "resume-corpus-overview-100",
    title: "合成简历样本库 · 100 份岗位与能力证据总览",
    documentType: "resume-screening",
    entityName: "才证合成招聘知识库",
    publisher: "才证项目合成简历样本库",
    sourceLabel: "100 份合成简历结构化学习 · 已脱敏",
    sourceUrl: "",
    publishedAt: today,
    retrievedAt: today,
    synthetic: true,
    license: "competition-synthetic-data-only",
    content: [
      `覆盖简历：${samples.length} 份。`,
      `覆盖岗位方向：${roleGroups.size} 类。`,
      `岗位分布：${[...roleGroups.entries()].map(([role, items]) => `${role} ${items.length} 份`).join("；")}。`,
      `高频技能与工具：${topSkills || "未识别"}。`,
      "用途：补充岗位常见能力组合、项目表达方式、成果指标和面试追问模式。",
      "限制：这是合成样本的结构化知识，不代表真实候选人、真实学校或企业信息，不能替代候选人自己的简历原文证据。",
      "隐私处理：已删除姓名、邮箱、电话、证件号和受保护属性；仅保留岗位相关经历、技术、项目职责和成果表达。",
    ].join("\n\n"),
  }];
  for (const [role, items] of [...roleGroups.entries()].sort((left, right) => left[0].localeCompare(right[0], "zh-CN"))) {
    const roleSkills = new Map();
    for (const item of items) {
      const text = `${item.profile.skillsText}\n${item.text}`.toLocaleLowerCase();
      for (const skill of SKILL_TERMS) {
        if (text.includes(skill.toLocaleLowerCase())) {
          roleSkills.set(skill, (roleSkills.get(skill) || 0) + 1);
        }
      }
    }
    documents.push({
      id: roleId(role),
      title: `${role} · 合成简历证据与能力模式（${items.length} 份）`,
      documentType: "resume-screening",
      entityName: role,
      publisher: "才证项目合成简历样本库",
      sourceLabel: `100 份合成简历岗位聚合 · ${role}`,
      sourceUrl: "",
      publishedAt: today,
      retrievedAt: today,
      synthetic: true,
      license: "competition-synthetic-data-only",
      content: [
        `岗位方向：${role}`,
        `样本数量：${items.length}`,
        `常见技能：${[...roleSkills.entries()].sort((a, b) => b[1] - a[1]).map(([skill, count]) => `${skill}(${count})`).join("、") || "未识别"}`,
        "使用说明：以下内容用于学习岗位常见证据表达；评价真实候选人时仍必须引用其本人简历，不得把其他样本当作候选人经历。",
        ...items
          .sort((left, right) => left.sequence.localeCompare(right.sequence))
          .map(caseSection),
      ].join("\n\n"),
    });
  }
  return {
    version: 1,
    generatedAt: now,
    source: "100份合成简历",
    sampleCount: samples.length,
    roleCount: roleGroups.size,
    disclaimer: "全部内容为比赛合成数据；已脱敏，不代表真实候选人或真实招聘结论。",
    documents,
  };
}

async function main() {
  const sourceIndex = process.argv.indexOf("--source");
  const outputIndex = process.argv.indexOf("--output");
  const sourceDir = path.resolve(sourceIndex >= 0 ? process.argv[sourceIndex + 1] : DEFAULT_SOURCE);
  const outputPath = path.resolve(outputIndex >= 0 ? process.argv[outputIndex + 1] : DEFAULT_OUTPUT);
  if (!fs.existsSync(sourceDir)) throw new Error(`简历目录不存在：${sourceDir}`);
  const files = fs.readdirSync(sourceDir)
    .filter((fileName) => fileName.toLocaleLowerCase().endsWith(".pdf"))
    .sort((left, right) => left.localeCompare(right, "zh-CN", { numeric: true }));
  if (files.length !== 100) throw new Error(`预期 100 份 PDF，实际发现 ${files.length} 份`);
  const samples = [];
  for (const [index, fileName] of files.entries()) {
    process.stdout.write(`\r学习简历 ${index + 1}/${files.length}`);
    samples.push(await loadResume(sourceDir, fileName));
  }
  process.stdout.write("\n");
  const pack = buildPack(samples);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
  console.log(`已生成知识包：${outputPath}`);
  console.log(`覆盖 ${pack.sampleCount} 份简历、${pack.roleCount} 个岗位方向、${pack.documents.length} 份知识文档。`);

  if (process.argv.includes("--apply")) {
    let imported = 0;
    try {
      const response = await fetch("http://127.0.0.1:3030/api/knowledge/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents: pack.documents }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `导入失败（${response.status}）`);
      imported = result.imported || 0;
    } catch {
      const store = new JsonStore(path.join(ROOT, "data", "state.json"));
      imported = importKnowledgeDocuments(store, pack.documents).length;
    }
    console.log(`已导入 ${imported} 份新知识文档。`);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
