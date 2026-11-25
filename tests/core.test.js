"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  criteriaSignature,
  evaluateCandidate,
  findProtectedCriterion,
  rankCandidates,
  splitKeywords,
} = require("../lib/screening");
const { SCENARIOS, runEvaluation } = require("../scripts/evaluate_screening");
const { verifyInterviewAnalysis } = require("../lib/interview-analysis");
const {
  assessOcrQuality,
  docxXmlToText,
  extractPdf,
  extractPdfTextWithFonts,
  parsePdfCMap,
  parseResumeText,
} = require("../lib/resume");
const { redactResumeForLlm, verifyAiAnalysis } = require("../lib/evidence");
const { retrieveKnowledge } = require("../knowledge/retriever");
const {
  extractEntities,
  filterKnowledgeMatchesForCandidate,
  knowledgeEntityType,
} = require("../knowledge/entity-extractor");
const { assessExperience } = require("../knowledge/value-assessment");
const { fallbackQuestions } = require("../knowledge/interview-questions");
const { resolvePythonRuntime } = require("../lib/python");
const { buildCsv, startServer } = require("../server");

const CRITERIA = [
  {
    id: "python",
    name: "Python",
    keywords: ["Python", "FastAPI"],
    weight: 60,
    required: true,
  },
  {
    id: "delivery",
    name: "项目交付",
    keywords: ["上线", "优化", "指标"],
    weight: 40,
    required: false,
  },
];

test("cleans and deduplicates repeated keywords", () => {
  assert.deepEqual(splitKeywords("Python， FastAPI, python； SQL"), ["Python", "FastAPI", "SQL"]);
});

test("protected hiring attributes are rejected from scorecard criteria", () => {
  assert.equal(findProtectedCriterion(CRITERIA), null);
  const match = findProtectedCriterion([{
    name: "团队匹配",
    keywords: ["35 岁以内", "已婚已育"],
    weight: 100,
  }]);
  assert.equal(match.criterionName, "团队匹配");
  assert.match(match.label, /年龄|婚育/);
});

test("CSV export neutralizes spreadsheet formulas", () => {
  const csv = buildCsv({ title: "测试", criteria: [] }, [{
    rank: 1,
    profile: {
      name: '=HYPERLINK("https://evil.example","open")',
      email: "candidate@example.com",
      phone: "",
    },
    evaluation: {
      score: 80,
      gateLabel: "无硬性条件",
      criteriaResults: [],
    },
    reviewStatus: "unreviewed",
    reviewNote: "  @SUM(1,1)",
    auditHistory: [],
  }]);
  assert.match(csv, /"'=HYPERLINK/);
  assert.match(csv, /"'  @SUM/);
});

test("Python runtime discovery finds user-installed Python 3.12 without the launcher", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hireproof-python-runtime-"));
  try {
    const localAppData = path.join(tempDir, "LocalAppData");
    const pythonPath = path.join(localAppData, "Programs", "Python", "Python312", "python.exe");
    const newerPythonPath = path.join(localAppData, "Programs", "Python", "Python314", "python.exe");
    fs.mkdirSync(path.dirname(pythonPath), { recursive: true });
    fs.mkdirSync(path.dirname(newerPythonPath), { recursive: true });
    fs.writeFileSync(pythonPath, "");
    fs.writeFileSync(newerPythonPath, "");
    const runtime = resolvePythonRuntime({
      env: {
        LOCALAPPDATA: localAppData,
        PATH: "",
      },
      rootDir: tempDir,
      probeDependencies: false,
    });
    assert.equal(runtime.command, pythonPath);
    assert.equal(runtime.sourceLabel, "用户安装 Python312");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("OCR quality gate distinguishes useful resume text from garbled output", () => {
  const good = assessOcrQuality(`
陈思远
AI 应用工程师
邮箱：chen@example.com
工作经历
负责企业 RAG 知识库检索平台，使用 Python FastAPI 开发 API。
项目经历
使用 Docker 和 Kubernetes 完成生产上线，P95 延迟降低 35%。
专业技能
Python, FastAPI, RAG, Agent, Elasticsearch, Milvus
教育背景
计算机科学本科
`);
  const bad = assessOcrQuality("陈思远用工程师\n思远\n上苎．138．0℃．匚卜虐n女四彐n@额彐n");
  const partial = assessOcrQuality(`
工作经历
负责企业知识库与后端服务开发，参与项目上线和团队协作，完成接口设计、数据维护、用户需求分析和线上问题排查。
与产品、测试和业务团队协作推进交付，完善监控指标、运行日志和故障处理流程。
项目经历
使用 Agent 完成业务流程，负责数据接口设计与维护，参与架构评审、性能优化和生产环境发布。
持续跟进客户反馈，整理技术文档并推动团队复用。
专业技能
Agent, LLM
联系方式
test@example.com
`);
  assert.equal(good.level, "high");
  assert.ok(good.termHits.includes("Python"));
  assert.equal(bad.level, "low");
  assert.ok(bad.warnings.some((warning) => warning.includes("复核")));
  assert.notEqual(partial.level, "high");
});

test("missing evidence is distinct from a failed requirement and blocks the hard gate", () => {
  const result = evaluateCandidate({ text: "张三\n负责销售工作", fileName: "a.txt" }, CRITERIA);
  assert.equal(result.criteriaResults[0].level, "none");
  assert.equal(result.criteriaResults[0].status, "missing");
  assert.equal(result.gateMet, false);
  assert.match(result.gateLabel, /缺口/);
});

test("explicit negation is distinct from missing evidence and fails the hard gate", () => {
  const result = evaluateCandidate({
    text: "不具备 Python、FastAPI 和 SQL 开发能力",
    fileName: "negative.txt",
  }, [{
    id: "backend",
    name: "后端技能",
    keywords: ["Python", "FastAPI", "SQL"],
    weight: 100,
    required: true,
  }]);
  assert.equal(result.criteriaResults[0].level, "none");
  assert.equal(result.criteriaResults[0].status, "absent");
  assert.equal(result.criteriaResults[0].evidence[0].polarity, "negative");
  assert.equal(result.gateMet, false);
});

test("short Latin keywords require token boundaries", () => {
  const result = evaluateCandidate({
    text: "熟练使用 Google Cloud、Django 和 email 系统",
    fileName: "tokens.txt",
  }, [
    { id: "go", name: "Go", keywords: ["Go"], weight: 50, required: true },
    { id: "ai", name: "AI", keywords: ["AI"], weight: 50, required: true },
  ]);
  assert.equal(result.criteriaResults[0].level, "none");
  assert.equal(result.criteriaResults[1].level, "none");
  assert.equal(result.gateMet, false);
});

test("evidence levels and deterministic weighting produce a stable score", () => {
  const strong = evaluateCandidate({
    text: "使用 Python 开发 API\n落地 FastAPI 服务\n上线后性能优化 30%",
    fileName: "strong.txt",
  }, CRITERIA);
  const weak = evaluateCandidate({
    text: "了解 Python 基础语法",
    fileName: "weak.txt",
  }, CRITERIA);
  assert.equal(strong.criteriaResults[0].level, "medium");
  assert.equal(strong.gateMet, true);
  assert.ok(strong.score > weak.score);
  assert.ok(strong.criteriaResults[0].evidence[0].line >= 1);
});

test("verified interview evidence adjusts scoring and rejects invented quotes", () => {
  const candidate = {
    id: "candidate-call",
    text: "使用 Python 和 FastAPI 开发检索服务",
    fileName: "candidate-call.txt",
  };
  const base = evaluateCandidate(candidate, CRITERIA);
  const answers = [{
    questionId: "q-delivery",
    question: "请说明最能代表你的项目成果。",
    answer: "我负责项目上线并让核心指标提升 40%",
  }];
  const verified = verifyInterviewAnalysis({
    summary: "候选人说明了项目上线和指标提升结果。",
    criteria: [
      {
        criterionId: "delivery",
        level: "strong",
        confidence: 0.94,
        evidenceQuotes: ["项目上线并让核心指标提升 40%"],
        reasoning: "回答包含明确上线和指标结果",
      },
      {
        criterionId: "unknown",
        level: "strong",
        confidence: 1,
        evidenceQuotes: ["项目上线并让核心指标提升 40%"],
        reasoning: "无效评价项",
      },
    ],
  }, answers, CRITERIA);
  assert.equal(verified.criteria.find((item) => item.criterionId === "delivery").level, "strong");
  assert.equal(verified.criteria.find((item) => item.criterionId === "delivery").evidence[0].questionId, "q-delivery");
  assert.deepEqual(verified.criteria.map((item) => item.criterionId), ["python", "delivery"]);

  const adjusted = evaluateCandidate({
    ...candidate,
    webInterviews: [{
      id: "interview-1",
      endedAt: "2026-11-17T10:00:00.000Z",
      analysis: {
        interviewId: "interview-1",
        criteriaSignature: criteriaSignature(CRITERIA),
        criteria: verified.criteria,
      },
    }],
  }, CRITERIA);
  assert.ok(adjusted.score > base.score);
  assert.equal(adjusted.resumeScore, base.score);
  assert.ok(adjusted.interviewInfluence.adjustment > 0);
  assert.equal(adjusted.criteriaResults[1].interviewLevel, "strong");
  assert.equal(adjusted.criteriaResults[1].interviewEvidence[0].quote, "项目上线并让核心指标提升 40%");

  const rejected = verifyInterviewAnalysis({
    summary: "模型编造了未出现的表述。",
    criteria: [{
      criterionId: "delivery",
      level: "strong",
      confidence: 0.99,
      evidenceQuotes: ["我负责了多个十亿级项目"],
      reasoning: "未经回答支持的引用",
    }],
  }, answers, CRITERIA);
  assert.equal(rejected.criteria.find((item) => item.criterionId === "delivery").verification, "rejected");
  assert.equal(rejected.rejectedCount, 1);
});

test("human level override is retained and affects ranking", () => {
  const candidate = {
    id: "candidate-1",
    text: "负责项目上线",
    fileName: "candidate.txt",
    importedAt: new Date().toISOString(),
    overrides: {
      python: { level: "strong", note: "电话初筛已确认" },
    },
  };
  const evaluation = evaluateCandidate(candidate, CRITERIA);
  assert.equal(evaluation.criteriaResults[0].level, "strong");
  assert.equal(evaluation.criteriaResults[0].override.note, "电话初筛已确认");
  assert.equal(evaluation.gateMet, true);

  const ranked = rankCandidates([
    candidate,
    { ...candidate, id: "candidate-2", overrides: {} },
  ], CRITERIA);
  assert.equal(ranked[0].id, "candidate-1");
  assert.equal(ranked[0].rank, 1);
});

test("protected attributes do not change scoring or hard-gate decisions", () => {
  const baseText = [
    "负责企业知识库服务开发",
    "使用 Python 和 FastAPI 开发检索 API",
    "完成上线后性能优化，P95 延迟降低 30%",
  ].join("\n");
  const variedText = [
    "年龄：34 岁",
    "性别：女",
    "婚育：不适用",
    "籍贯：某地",
    baseText,
  ].join("\n");
  const base = evaluateCandidate({ text: baseText, fileName: "base.txt" }, CRITERIA);
  const varied = evaluateCandidate({ text: variedText, fileName: "varied.txt" }, CRITERIA);
  assert.equal(varied.score, base.score);
  assert.equal(varied.gateMet, base.gateMet);
  assert.deepEqual(
    varied.criteriaResults.map((result) => result.level),
    base.criteriaResults.map((result) => result.level),
  );
});

test("resume parser extracts contact details, experience and sections", () => {
  const profile = parseResumeText(`
王小明
求职意向：后端工程师
电话：13800138000
邮箱：xiaoming@example.com
5年工作经验
本科

个人简介
专注 Python 服务开发与数据平台建设，有跨团队项目经验。

专业技能
Python, FastAPI, SQL
`, { fileName: "王小明-后端.pdf" });

  assert.equal(profile.name, "王小明");
  assert.equal(profile.email, "xiaoming@example.com");
  assert.equal(profile.phone, "13800138000");
  assert.equal(profile.yearsExperience, 5);
  assert.equal(profile.education, "本科");
  assert.match(profile.summary, /Python/);
  assert.match(profile.skillsText, /FastAPI/);
  assert.equal(profile.textHash.length, 64);
});

test("email parsing removes an accidentally merged Chinese mobile prefix", () => {
  const profile = parseResumeText(`
陈思远
上海- 138-0000-0001-chen.siyuan@example.com
4 年半工作经验
`, { fileName: "陈思远-扫描.pdf" });
  assert.equal(profile.phone, "138-0000-0001");
  assert.equal(profile.email, "chen.siyuan@example.com");
});

test("DOCX XML and simple PDF text streams are extracted", () => {
  const docxText = docxXmlToText(
    "<w:document><w:body><w:p><w:r><w:t>张三</w:t></w:r></w:p><w:p><w:r><w:t>Python</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>5年</w:t></w:r></w:p></w:body></w:document>",
  );
  assert.match(docxText, /张三/);
  assert.match(docxText, /Python/);

  const pdf = Buffer.from(`%PDF-1.4
1 0 obj
<< /Length 64 >>
stream
BT /F1 12 Tf 72 720 Td (Wang Xiaoming) Tj T* (Python FastAPI) Tj ET
endstream
endobj
%%EOF`, "latin1");
  const pdfText = extractPdf(pdf);
  assert.match(pdfText, /Wang Xiaoming/);
  assert.match(pdfText, /Python FastAPI/);
});

test("CID PDF ToUnicode maps restore Chinese text", () => {
  const cmap = parsePdfCMap(Buffer.from(`
begincmap
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
2 beginbfchar
<0409> <4E0E>
<040A> <4E13>
endbfchar
endcmap
`));
  const extracted = extractPdfTextWithFonts(
    Buffer.from("BT /F1 12 Tf 72 720 Td <0409040A> Tj ET", "latin1"),
    new Map([["F1", cmap]]),
  );
  assert.equal(extracted.text.trim(), "与专");
  assert.equal(extracted.unmapped, 0);
});

test("name and half-year experience are recovered when contact appears at resume end", () => {
  const profile = parseResumeText(`
工作经历
负责 Python 服务开发
云岚数据
后端工程师
陈思远
AI 应用工程师
上海 · 138-0000-0001 · chen@example.com
4 年半 Python 与 AI 应用开发经验
`, { fileName: "01.pdf" });
  assert.equal(profile.name, "陈思远");
  assert.equal(profile.title, "AI 应用工程师");
  assert.equal(profile.yearsExperience, 4.5);
  assert.equal(profile.phone, "138-0000-0001");
});

test("avatar initials do not replace the nearby full candidate name", () => {
  const profile = parseResumeText(`
思远
陈思远
AI 应用工程师
上海 · 138-0000-0001 · chen@example.com
`, { fileName: "陈思远-简历.png" });
  assert.equal(profile.name, "陈思远");
});

test("knowledge retriever returns cited synthetic company evidence", () => {
  const pack = JSON.parse(fs.readFileSync(
    path.join(__dirname, "..", "knowledge", "demo", "星桥智能科技.json"),
    "utf8",
  ));
  const results = retrieveKnowledge(
    pack.documents,
    "星桥智能科技 RAG 检索团队 生产上线 Agent",
    { limit: 5 },
  );
  assert.ok(results.length >= 3);
  assert.ok(results.every((item) => item.sourceId && item.sourceLabel && item.synthetic));
  assert.match(results[0].title, /星桥|岗位能力/);
});

test("knowledge retriever prioritizes an exact entity named in the query", () => {
  const documents = [
    {
      id: "cloud",
      title: "云帆智算 · 技术架构概览",
      entityName: "云帆智算",
      documentType: "technology",
      sourceLabel: "demo",
      content: "云帆智算使用 RAG、Milvus 和 FastAPI 建设企业检索平台。",
      synthetic: true,
    },
    {
      id: "similar",
      title: "清栈智算科技合作教育项目",
      entityName: "清栈智算科技",
      documentType: "education",
      sourceLabel: "demo",
      content: "清栈智算科技开展 RAG 技术培训和合作教育项目。",
      synthetic: true,
    },
  ];
  const results = retrieveKnowledge(documents, "云帆智算的 RAG 技术栈是什么", { limit: 2 });
  assert.equal(results[0].entityName, "云帆智算");
});

test("demo knowledge corpus covers diverse synthetic recruiting evidence", () => {
  const pack = JSON.parse(fs.readFileSync(
    path.join(__dirname, "..", "knowledge", "demo", "星桥智能科技.json"),
    "utf8",
  ));
  const documents = pack.documents;
  assert.ok(documents.length >= 140);
  assert.equal(new Set(documents.map((document) => document.id)).size, documents.length);
  assert.equal(new Set(documents.map((document) => document.content)).size, documents.length);
  assert.ok(new Set(documents.map((document) => document.entityName)).size >= 40);
  assert.ok(documents.every((document) => document.synthetic));
  assert.ok(documents.every((document) => document.content.length >= 100));
  for (const type of ["company", "organization", "technology", "annual-report", "education", "role-standard", "paper", "patent"]) {
    assert.ok(documents.some((document) => document.documentType === type), `missing ${type}`);
  }
  const searchable = JSON.stringify(documents);
  assert.equal((searchable.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).length, 0);
  assert.equal((searchable.match(/138-0000-\d{4}/g) || []).length, 0);
});

test("resume screening knowledge pack covers 100 sanitized samples", () => {
  const packPath = path.join(__dirname, "..", "knowledge", "demo", "resume-screening-knowledge.json");
  const raw = fs.readFileSync(packPath, "utf8");
  const pack = JSON.parse(raw);
  assert.equal(pack.sampleCount, 100);
  assert.equal(pack.roleCount, 16);
  assert.equal(pack.documents.length, 17);
  assert.equal((raw.match(/### SAMPLE-/g) || []).length, 100);
  assert.equal((raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).length, 0);
  assert.equal((raw.match(/138-0000-\d{4}/g) || []).length, 0);
  assert.ok(pack.documents.every((document) => document.synthetic && document.documentType === "resume-screening"));
});

test("resume entity intelligence and evidence card stay job-related", () => {
  const candidate = {
    fileName: "陈思远-合成.txt",
    text: `陈思远
星桥智能科技
负责企业知识库团队 RAG 检索链路
主导 Agent 工具调用，回答可追溯率提升至92%
申请 DEMO-PATENT-2025-002 专利
江南智算大学 计算机科学 本科`,
    profile: { title: "AI 应用工程师", yearsExperience: 5, education: "本科" },
  };
  const criteria = [
    { id: "rag", name: "RAG 与 Agent", keywords: ["RAG", "Agent"], weight: 60, required: true },
    { id: "outcome", name: "项目成果", keywords: ["提升", "指标"], weight: 40, required: false },
  ];
  const extracted = extractEntities(candidate, {
    workHistory: [{ company: "星桥智能科技", title: "AI 应用工程师" }],
  }, [{ entityName: "星桥智能科技" }, { entityName: "江南智算大学" }]);
  assert.ok(extracted.entities.some((item) => item.type === "company" && item.name === "星桥智能科技"));
  assert.ok(extracted.entities.some((item) => item.type === "school"));
  assert.ok(extracted.entities.some((item) => item.type === "patent"));
  const evaluation = evaluateCandidate(candidate, criteria);
  const value = assessExperience({
    candidate,
    evaluation,
    criteria,
    entities: extracted.entities,
    knowledgeMatches: [],
  });
  assert.ok(value.index >= 0 && value.index <= 100);
  assert.equal(value.dimensions.find((item) => item.key === "externalCorroboration").score, null);
  assert.equal(
    value.dimensions.find((item) => item.key === "externalCorroboration").displayValue,
    "0 条",
  );
  const questions = fallbackQuestions({
    criteriaResults: evaluation.criteriaResults,
    valueAssessment: value,
    knowledgeMatches: [],
  });
  assert.ok(questions.length >= 1);
});

test("entity taxonomy distinguishes roles and skills from organizations", () => {
  const candidate = {
    fileName: "赵可欣-合成.txt",
    text: [
      "远岚数据",
      "数据工程师",
      "AI 数据",
      "武汉大学",
      "负责知识库数据清洗和检索数据接口",
    ].join("\n"),
    profile: { title: "数据工程师", yearsExperience: 4, education: "本科" },
  };
  const extracted = extractEntities(candidate, {
    workHistory: [{ company: "远岚数据", title: "数据工程师" }],
  }, [
    { entityName: "数据工程师", documentType: "role-standard" },
    { entityName: "远岚数据", documentType: "company" },
    { entityName: "武汉大学", documentType: "education" },
  ]);
  assert.ok(extracted.entities.some((item) => item.type === "company" && item.name === "远岚数据"));
  assert.ok(extracted.entities.some((item) => item.type === "role" && item.name === "数据工程师"));
  assert.ok(extracted.entities.some((item) => item.type === "school" && item.name === "武汉大学"));
  assert.ok(!extracted.entities.some((item) => item.type === "company" && item.name === "AI 数据"));
  assert.equal(knowledgeEntityType({ entityName: "数据工程师", documentType: "resume-screening" }), "role");
});

test("candidate knowledge matches keep only evidence linked to resume entities", () => {
  const entities = [
    { type: "company", name: "远岚数据" },
    { type: "school", name: "武汉大学" },
    { type: "role", name: "数据工程师" },
  ];
  const matches = [
    { id: "own-company", entityName: "远岚数据", documentType: "technology" },
    { id: "similar-company", entityName: "远岚人工智能", documentType: "technology" },
    { id: "role-standard", entityName: "远岚人工智能", documentType: "role-standard" },
    { id: "own-school", entityName: "武汉大学", documentType: "education" },
    { id: "other-school", entityName: "江南智算大学", documentType: "education" },
    { id: "resume-pattern", entityName: "数据工程师", documentType: "resume-screening" },
    { id: "method", entityName: "才证招聘知识中心", documentType: "technology" },
  ];
  const filtered = filterKnowledgeMatchesForCandidate(entities, matches);
  assert.deepEqual(filtered.map((item) => item.id), [
    "own-company",
    "own-school",
  ]);
});

test("knowledge background is displayed without changing the candidate evidence index", () => {
  const input = {
    candidate: { text: "负责数据平台建设，降低延迟 30%" },
    evaluation: {
      score: 80,
      matchedCount: 2,
      totalCriteria: 2,
      criteriaResults: [],
    },
    criteria: [],
    entities: [],
  };
  const withoutKnowledge = assessExperience({
    ...input,
    knowledgeMatches: [],
  });
  const value = assessExperience({
    ...input,
    knowledgeMatches: Array.from({ length: 5 }, (_, index) => ({
      sourceId: `source-${index}`,
      entityName: "数据工程师",
      title: "数据工程师知识片段",
    })),
  });
  const dimension = value.dimensions.find((item) => item.key === "externalCorroboration");
  assert.equal(dimension.label, "知识库背景");
  assert.equal(dimension.displayValue, "5 条");
  assert.equal(dimension.score, null);
  assert.equal(dimension.barPercent, 0);
  assert.match(dimension.note, /不计入指数/);
  assert.equal(value.index, withoutKnowledge.index);
  assert.deepEqual(value.strengths, withoutKnowledge.strengths);
  assert.deepEqual(value.gaps, withoutKnowledge.gaps);
});

test("HTTP API supports create, import, ranking, review and CSV export", async (context) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hireproof-api-test-"));
  const app = await startServer({ port: 0, dataDir: tempDir, llmClient: null });
  context.after(async () => {
    await app.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  let response = await fetch(`${app.url}/api/health`);
  assert.equal(response.status, 200);

  response = await fetch(`${app.url}/api/state`);
  const seededState = await response.json();
  assert.ok(seededState.knowledge.documentCount >= 7);
  assert.ok(seededState.knowledge.chunkCount >= 7);

  response = await fetch(`${app.url}/api/knowledge/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "星桥智能科技 RAG 检索团队", limit: 5 }),
  });
  const searchResult = await response.json();
  assert.ok(searchResult.results.length >= 2);
  assert.ok(searchResult.results.every((item) => item.sourceLabel && item.sourceId));

  response = await fetch(`${app.url}/api/knowledge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "测试知识文档",
      entityName: "测试实体",
      documentType: "technology",
      sourceLabel: "自动化测试",
      publisher: "测试发布机构",
      sourceUrl: "https://example.com/public-report",
      publishedAt: "2025-01-01",
      retrievedAt: "2026-11-14",
      license: "测试许可",
      synthetic: true,
      content: "这是一份用于验证知识库创建、引用和删除流程的虚构技术资料。",
    }),
  });
  assert.equal(response.status, 201);
  const knowledgeDocument = (await response.json()).document;
  assert.equal(knowledgeDocument.publisher, "测试发布机构");
  assert.equal(knowledgeDocument.sourceUrl, "https://example.com/public-report");
  assert.equal(knowledgeDocument.retrievedAt, "2026-11-14");
  assert.equal(knowledgeDocument.license, "测试许可");
  response = await fetch(`${app.url}/api/knowledge/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documents: [{
        title: "批量来源测试",
        documentType: "company",
        entityName: "来源测试公司",
        publisher: "来源测试机构",
        sourceUrl: "https://example.com/batch-source",
        retrievedAt: "2026-11-14",
        content: "这是一份用于验证公开资料来源批量导入接口的虚构测试内容。",
      }],
    }),
  });
  assert.equal(response.status, 201);
  const importedKnowledge = await response.json();
  assert.equal(importedKnowledge.imported, 1);
  assert.equal(importedKnowledge.documents[0].sourceUrl, "https://example.com/batch-source");
  const invalidSourceResponse = await fetch(`${app.url}/api/knowledge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "非法来源链接",
      content: "这是一份用于验证来源链接协议限制的虚构测试文档。",
      sourceUrl: "javascript:alert(1)",
    }),
  });
  assert.equal(invalidSourceResponse.status, 400);
  response = await fetch(`${app.url}/api/knowledge/${knowledgeDocument.id}`, {
    method: "DELETE",
  });
  assert.equal(response.status, 200);

  response = await fetch(`${app.url}/api/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "高级后端工程师",
      description: "需要 Python、FastAPI 和跨团队项目经验",
      criteria: CRITERIA,
    }),
  });
  assert.equal(response.status, 201);
  const created = await response.json();
  const jobId = created.job.id;
  assert.equal(created.job.criteria[0].id, "python");

  const resume = "陈晨\n13800138001\nchen@example.com\n5年工作经验\n本科\n使用 Python 开发 FastAPI API\n负责上线优化，核心指标提升30%";
  response = await fetch(`${app.url}/api/jobs/${jobId}/candidates/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: [{
        name: "陈晨.txt",
        type: "text/plain",
        data: Buffer.from(resume, "utf8").toString("base64"),
      }],
    }),
  });
  assert.equal(response.status, 200);
  const imported = await response.json();
  assert.equal(imported.imported.length, 1);

  response = await fetch(`${app.url}/api/state`);
  const state = await response.json();
  assert.doesNotMatch(JSON.stringify(state), /LLM_API_KEY|sk-[A-Za-z0-9]/);
  assert.equal(state.candidates.length, 1);
  assert.equal(state.candidates[0].profile.name, "陈晨");
  assert.equal(state.candidates[0].evaluation.gateMet, true);
  assert.ok(state.candidates[0].evaluation.score > 0);

  const candidateId = state.candidates[0].id;
  response = await fetch(`${app.url}/api/jobs/${jobId}/candidates/${candidateId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reviewer: "测试 HR",
      reviewStatus: "shortlist",
      reviewNote: "进入本轮面试",
      overrides: { python: { level: "strong", note: "代码题通过" } },
    }),
  });
  assert.equal(response.status, 200);
  const detail = await response.json();
  assert.equal(detail.candidate.reviewStatus, "shortlist");
  assert.equal(detail.candidate.reviewedBy, "测试 HR");
  assert.ok(detail.candidate.reviewedAt);
  assert.ok(detail.candidate.auditHistory.some((event) => event.action === "candidate_imported"));
  assert.ok(detail.candidate.auditHistory.some((event) => event.action === "human_review_updated"));
  assert.ok(detail.candidate.auditHistory.at(-1).details.before.reviewStatus === "unreviewed");
  assert.ok(detail.candidate.auditHistory.at(-1).details.after.reviewStatus === "shortlist");
  assert.equal(detail.candidate.evaluation.criteriaResults[0].level, "strong");

  response = await fetch(`${app.url}/api/jobs/${jobId}/candidates/${candidateId}/interview-plan`);
  assert.equal(response.status, 200);
  const interviewPlan = await response.json();
  assert.equal(interviewPlan.mode, "browser");
  assert.ok(interviewPlan.questions.length >= 3);
  assert.equal(
    new Set(interviewPlan.questions.map((question) => question.question)).size,
    interviewPlan.questions.length,
  );
  response = await fetch(`${app.url}/api/jobs/${jobId}/candidates/${candidateId}/web-interview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      consent: true,
      completionReason: "completed",
      startedAt: "2026-11-14T10:00:00.000Z",
      endedAt: "2026-11-14T10:03:00.000Z",
      durationSec: 180,
      questions: interviewPlan.questions,
      answers: [{
        questionId: interviewPlan.questions[0].id,
        question: interviewPlan.questions[0].question,
        answer: "我负责过 FastAPI 检索服务上线，并通过缓存优化降低了延迟。",
      }],
    }),
  });
  assert.equal(response.status, 201);
  const webInterview = (await response.json()).interview;
  assert.equal(webInterview.mode, "browser-voice");
  assert.equal(webInterview.status, "completed");
  assert.equal(webInterview.audioStored, false);
  assert.match(webInterview.summary, /网页 AI 初筛/);
  assert.equal(webInterview.summarySource, "rules");
  assert.equal(webInterview.analysis.source, "rules");

  response = await fetch(`${app.url}/api/jobs/${jobId}/candidates/${candidateId}`);
  const afterInterview = (await response.json()).candidate;
  assert.equal(afterInterview.webInterviews.length, 1);
  assert.ok(afterInterview.auditHistory.some((event) => event.action === "web_interview_completed"));
  assert.equal(afterInterview.evaluation.interviewInfluence.applied, false);

  response = await fetch(`${app.url}/api/call-sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateId }),
  });
  assert.equal(response.status, 201);
  const phoneSession = await response.json();
  assert.match(phoneSession.phoneUrl, /phone\.html\?session=/);
  assert.ok(phoneSession.session.token);
  response = await fetch(
    `${app.url}/api/call-sessions/${phoneSession.session.id}/events?token=${phoneSession.session.token}&after=0`,
  );
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).events, []);
  response = await fetch(`${app.url}/api/call-sessions/${phoneSession.session.id}/join?token=${phoneSession.session.token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: phoneSession.session.token }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).session.status, "joined");
  response = await fetch(`${app.url}/api/call-sessions/${phoneSession.session.id}/events?token=${phoneSession.session.token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: phoneSession.session.token,
      type: "call.ended",
      data: { consent: true, answers: [], transcript: [] },
    }),
  });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).session.status, "ended");

  response = await fetch(`${app.url}/api/jobs/${jobId}/export.csv`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-disposition"), /attachment/);
  assert.match(await response.text(), /进入本轮面试/);
});

test("HTTP API rejects protected attributes in job criteria", async (context) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hireproof-policy-test-"));
  const app = await startServer({ port: 0, dataDir: tempDir, llmClient: null });
  context.after(async () => {
    await app.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const response = await fetch(`${app.url}/api/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "受保护属性测试岗位",
      criteria: [{
        id: "protected-age",
        name: "年龄筛选",
        keywords: ["30 岁以下"],
        weight: 100,
        required: true,
      }],
    }),
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /保护属性/);
});

test("cross-origin and form-style writes are rejected", async (context) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hireproof-csrf-test-"));
  const app = await startServer({ port: 0, dataDir: tempDir, llmClient: null });
  context.after(async () => {
    await app.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const body = JSON.stringify({
    title: "跨站岗位",
    criteria: CRITERIA,
  });
  let response = await fetch(`${app.url}/api/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      Origin: "https://evil.example",
    },
    body,
  });
  assert.equal(response.status, 403);

  response = await fetch(`${app.url}/api/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: app.url,
    },
    body,
  });
  assert.equal(response.status, 201);
});

test("a second server cannot open the same data directory", async (context) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hireproof-single-instance-"));
  const first = await startServer({ port: 0, dataDir: tempDir, llmClient: null });
  context.after(async () => {
    await first.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  await assert.rejects(
    () => startServer({ port: 0, dataDir: tempDir, llmClient: null }),
    (error) => error.code === "HIREPROOF_ALREADY_RUNNING" && error.url === first.url,
  );
});

test("screening evaluation covers 8 scenarios and 32 candidates", () => {
  const candidateCount = SCENARIOS.reduce(
    (sum, scenario) => sum + scenario.candidates.length,
    0,
  );
  assert.equal(SCENARIOS.length, 8);
  assert.equal(candidateCount, 32);
  assert.ok(SCENARIOS.every((scenario) => scenario.candidates.length === 4));
  assert.deepEqual(
    SCENARIOS.map((scenario) => scenario.id),
    [
      "ai-platform",
      "data-platform",
      "agent-engineering",
      "rag-backend",
      "ai-fullstack",
      "document-intelligence",
      "llmops-platform",
      "ai-product-delivery",
    ],
  );
});

test("screening evaluation exposes reproducible metric denominators", () => {
  const report = runEvaluation();
  assert.equal(report.scenarioCount, 8);
  assert.equal(report.candidateCount, 32);
  assert.deepEqual(report.counts, {
    top1Correct: 7,
    top1Total: 8,
    gateCorrect: 30,
    gateTotal: 32,
    locatableEvidence: 72,
    evidenceTotal: 72,
    protectedAttributeInvariantCases: 32,
    protectedAttributeTotal: 32,
  });
  assert.equal(report.metrics.top1Accuracy, 7 / 8);
  assert.equal(report.metrics.gateAccuracy, 30 / 32);
  assert.equal(report.metrics.locatableEvidenceRate, 72 / 72);
  assert.equal(report.metrics.protectedAttributeInvarianceRate, 32 / 32);
  assert.ok(Math.abs(report.metrics.pairwiseRankingAccuracy - 47 / 48) < 1e-9);
});

test("demo reset restores the standard presentation dataset", async (context) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hireproof-demo-reset-"));
  const app = await startServer({ port: 0, dataDir: tempDir, llmClient: null });
  context.after(async () => {
    await app.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  let response = await fetch(`${app.url}/api/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "将被重置的岗位", criteria: CRITERIA }),
  });
  assert.equal(response.status, 201);
  const oldJob = (await response.json()).job;

  response = await fetch(`${app.url}/api/jobs/${encodeURIComponent(oldJob.id)}/candidates/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: [
        {
          name: "旧样本一.txt",
          type: "text/plain",
          data: Buffer.from("旧样本一\nold.one@example.com\n6 年工作经验\nPython FastAPI 上线优化", "utf8").toString("base64"),
        },
        {
          name: "旧样本二.txt",
          type: "text/plain",
          data: Buffer.from("旧样本二\nold.two@example.com\n5 年工作经验\nPython 后端开发与项目交付", "utf8").toString("base64"),
        },
      ],
    }),
  });
  assert.equal(response.status, 200);

  response = await fetch(`${app.url}/api/demo/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(response.status, 200);
  const reset = await response.json();
  assert.equal(reset.jobCount, 6);
  assert.equal(reset.candidateCount, 4);
  assert.ok(reset.knowledgeCount >= 7);
  assert.ok(reset.backupPath);
  assert.equal(reset.state.candidates.length, 4);
  assert.equal(reset.state.counts.total, 4);
  assert.ok(reset.state.candidates.every((candidate) => candidate.jobId === reset.jobId));
  assert.ok(reset.state.candidates.every((candidate) => candidate.fileName.startsWith("0")));
  assert.ok(!reset.state.jobs.some((job) => job.id === oldJob.id));

  const state = await fetch(`${app.url}/api/state`).then((item) => item.json());
  assert.equal(state.jobs.length, 6);
  assert.equal(state.jobs[0].title, "企业 AI 应用工程师");
  assert.ok(state.jobs.some((job) => job.title === "Java 后端工程师"));
  assert.ok(state.jobs.some((job) => job.title === "数据平台工程师"));
  assert.ok(state.jobs.some((job) => job.title === "Agent 工作流工程师"));
  assert.ok(state.jobs.some((job) => job.title === "AI 产品经理"));
  assert.ok(state.jobs.some((job) => job.title === "MLOps / AI 平台工程师"));
  assert.equal(state.candidates.length, 4);
  assert.ok(fs.existsSync(path.join(tempDir, "backups")));

  response = await fetch(`${app.url}/api/demo/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "empty" }),
  });
  assert.equal(response.status, 200);
  const emptyReset = await response.json();
  assert.equal(emptyReset.mode, "empty");
  assert.equal(emptyReset.jobCount, 6);
  assert.equal(emptyReset.candidateCount, 0);
  assert.equal(emptyReset.state.candidates.length, 0);
  assert.equal(emptyReset.state.counts.total, 0);

  const clearedState = await fetch(`${app.url}/api/state`).then((item) => item.json());
  assert.equal(clearedState.jobs.length, 6);
  assert.equal(clearedState.candidates.length, 0);
});

test("LLM evidence must exist verbatim in the resume", () => {
  const candidate = {
    fileName: "候选.txt",
    text: "王五\n使用 Python 开发支付服务\n负责上线，延迟降低 40%",
  };
  const verified = verifyAiAnalysis({
    summary: "使用 Python 开发支付服务。",
    criteria: [
      {
        criterionId: "python",
        level: "strong",
        confidence: 0.93,
        evidenceQuotes: ["使用 Python 开发支付服务"],
        reasoning: "直接相关",
      },
      {
        criterionId: "delivery",
        level: "medium",
        confidence: 0.8,
        evidenceQuotes: ["获评年度最佳员工"],
        reasoning: "虚构证据",
      },
    ],
  }, candidate, CRITERIA);
  assert.equal(verified.criteria[0].verification, "verified");
  assert.equal(verified.criteria[0].evidence[0].line, 2);
  assert.equal(verified.criteria[1].verification, "rejected");
  assert.equal(verified.criteria[1].level, "none");
});

test("resume text sent to the LLM redacts direct identifiers and protected fields", () => {
  const redacted = redactResumeForLlm(`
姓名：王小二
年龄：29
邮箱：wang@example.com
电话：13800138000
证件号：110101199001011234
使用 Python 开发服务
`, "王小二");
  assert.doesNotMatch(redacted, /王小二/);
  assert.doesNotMatch(redacted, /wang@example\.com/);
  assert.doesNotMatch(redacted, /13800138000/);
  assert.doesNotMatch(redacted, /110101199001011234/);
  assert.doesNotMatch(redacted, /年龄：29/);
  assert.match(redacted, /Python/);
});

test("LLM redaction covers protected fields outside line prefixes and common delimiters", () => {
  const redacted = redactResumeForLlm(`
张伟 | 男 | 29岁 | 已婚 | 户籍北京
个人信息：男，29岁，汉族，籍贯上海
年龄29岁 性别女 民族汉族
出生日期：1990/01/01
现住址：上海市浦东新区/张江路1号
负责面向女性用户的产品设计，使用 Python 开发推荐服务
`, "张伟");
  assert.doesNotMatch(redacted, /张伟|北京|浦东|张江路|1990|汉族|29岁|已婚/);
  assert.doesNotMatch(redacted, /(?:^|[\s|｜])男(?:$|[\s|｜])/m);
  assert.doesNotMatch(redacted, /(?:^|[\s|｜])女(?:$|[\s|｜])/m);
  assert.match(redacted, /\[个人信息已隐去\]/);
  assert.match(redacted, /女性用户/);
  assert.match(redacted, /Python/);
});

test("background AI enrichment improves matching only after validation", async (context) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hireproof-ai-test-"));
  const calls = [];
  const fakeLlm = {
    configured: true,
    model: "test-model",
    getInfo: () => ({ configured: true, model: "test-model" }),
    completeJson: async ({ system, user }) => {
      const input = JSON.parse(user);
      if (system.includes("招聘岗位评价卡生成器")) {
        calls.push("rubric");
        return {
          model: "test-model",
          usage: { total_tokens: 8 },
          data: {
            criteria: [
              { name: "Python能力", keywords: ["Python"], weight: 50, required: true },
              { name: "RAG能力", keywords: ["RAG", "检索"], weight: 30, required: false },
              { name: "项目成果", keywords: ["上线", "指标"], weight: 20, required: false },
            ],
            basisSourceIds: input.retrievedContext?.length
              ? [input.retrievedContext[0].sourceId]
              : [],
          },
        };
      }
      if (system.includes("简历结构化 Agent")) {
        calls.push("structure");
        return {
          model: "test-model",
          usage: { total_tokens: 3 },
          data: {
            profile: { currentTitle: "后端工程师", yearsExperience: 6, education: "本科" },
          },
        };
      }
      if (system.includes("岗位证据匹配 Agent")) {
        calls.push("evidence");
        const lines = input.resumeText.split("\n");
        return {
          model: "test-model",
          usage: { total_tokens: 10 },
          data: {
            criteria: [
              {
                criterionId: "python",
                level: "strong",
                confidence: 0.95,
                evidenceQuotes: [lines[3]],
                reasoning: "Python 经历直接相关",
              },
              {
                criterionId: "delivery",
                level: "medium",
                confidence: 0.8,
                evidenceQuotes: [lines[4]],
                reasoning: "包含上线和指标结果",
              },
            ],
          },
        };
      }
      if (system.includes("对话摘要 Agent")) {
        calls.push("interview-summary");
        const answer = input.answers[0].answer;
        return {
          model: "test-model",
          usage: { total_tokens: 6 },
          data: {
            summary: "候选人说明了项目上线和指标提升结果。",
            criteria: [
              {
                criterionId: "python",
                level: "none",
                confidence: 0,
                evidenceQuotes: [],
                reasoning: "本次回答未涉及 Python 使用细节",
              },
              {
                criterionId: "delivery",
                level: "strong",
                confidence: 0.94,
                evidenceQuotes: [answer],
                reasoning: "回答包含可核验的上线和指标结果",
              },
            ],
          },
        };
      }
      if (system.includes("候选人摘要 Agent")) {
        calls.push("summary");
        return {
          model: "test-model",
          usage: { total_tokens: 2 },
          data: { summary: "具备 Python 项目交付经验。" },
        };
      }
      if (system.includes("招聘面试追问生成器")) {
        calls.push("questions");
        return {
          model: "test-model",
          usage: { total_tokens: 4 },
          data: {
            questions: [
              {
                question: "请说明交易服务上线时你负责的具体部分。",
                reason: "核对项目职责边界",
                criterionId: "delivery",
                sourceIds: [],
              },
            ],
          },
        };
      }
      throw new Error("Unexpected test agent");
    },
  };
  const app = await startServer({ port: 0, dataDir: tempDir, llmClient: fakeLlm });
  context.after(async () => {
    await app.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  let response = await fetch(`${app.url}/api/jobs/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      description: "负责企业 RAG 检索、Agent 工作流和 Python 后端服务。",
    }),
  });
  assert.equal(response.status, 200);
  const rubric = await response.json();
  assert.equal(rubric.source, "llm");
  assert.equal(rubric.criteria.length, 3);
  assert.ok(rubric.contextSources.length >= 1);
  assert.ok(rubric.basisSourceIds.length >= 1);
  assert.deepEqual(calls, ["rubric"]);
  calls.length = 0;

  response = await fetch(`${app.url}/api/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "后端", criteria: CRITERIA }),
  });
  const job = (await response.json()).job;
  const resume = "孙悦\n后端工程师\n6年工作经验\n使用 Python 搭建服务\n负责上线并优化指标 30%";
  response = await fetch(`${app.url}/api/jobs/${job.id}/candidates/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: [{ name: "孙悦.txt", data: Buffer.from(resume).toString("base64") }],
    }),
  });
  assert.equal(response.status, 200);

  let candidate;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    const state = await fetch(`${app.url}/api/state`).then((item) => item.json());
    candidate = state.candidates[0];
    if (candidate?.aiStatus === "complete") break;
  }
  assert.equal(candidate.aiStatus, "complete");
  assert.equal(candidate.summary.source, "llm");
  assert.equal(candidate.summary.headline, "具备 Python 项目交付经验。");

  const detail = await fetch(`${app.url}/api/jobs/${job.id}/candidates/${candidate.id}`)
    .then((item) => item.json());
  assert.equal(detail.candidate.evaluation.criteriaResults[0].matchSource, "llm");
  assert.equal(detail.candidate.evaluation.criteriaResults[0].level, "strong");
  assert.equal(detail.candidate.evaluation.criteriaResults[0].evidence[0].line, 4);
  assert.deepEqual(calls, ["structure", "evidence", "summary", "questions"]);
  assert.equal(detail.candidate.intelligence.interviewQuestions.length, 1);
  assert.equal(detail.candidate.intelligence.interviewQuestionSource, "llm");
  assert.deepEqual(
    detail.candidate.aiAnalysis.agentTrace.map((item) => [item.id, item.status]),
    [
      ["structure", "completed"],
      ["evidence", "completed"],
      ["audit", "completed"],
      ["summary", "completed"],
    ],
  );
  assert.equal(detail.candidate.aiAnalysis.pipelineVersion, 2);

  const scoreBeforeInterview = detail.candidate.evaluation.score;
  const interviewAnswer = "我负责项目上线并让核心指标提升 40%";
  response = await fetch(`${app.url}/api/jobs/${job.id}/candidates/${candidate.id}/web-interview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      consent: true,
      completionReason: "completed",
      startedAt: "2026-11-17T10:00:00.000Z",
      endedAt: "2026-11-17T10:04:00.000Z",
      durationSec: 240,
      questions: [{
        id: "question-delivery",
        question: "请说明最能代表你的项目成果。",
        criterionId: "delivery",
      }],
      answers: [{
        questionId: "question-delivery",
        question: "请说明最能代表你的项目成果。",
        answer: interviewAnswer,
      }],
    }),
  });
  assert.equal(response.status, 201);
  const interviewReport = await response.json();
  assert.equal(interviewReport.interview.summarySource, "llm");
  assert.equal(interviewReport.interview.summary, "候选人说明了项目上线和指标提升结果。");
  assert.equal(interviewReport.interview.analysis.source, "llm");
  assert.equal(interviewReport.interview.analysis.scoreImpact.adjustment > 0, true);

  const interviewedDetail = await fetch(`${app.url}/api/jobs/${job.id}/candidates/${candidate.id}`)
    .then((item) => item.json());
  assert.ok(interviewedDetail.candidate.evaluation.score > scoreBeforeInterview);
  assert.ok(interviewedDetail.candidate.evaluation.interviewInfluence.adjustment > 0);
  assert.equal(interviewedDetail.candidate.webInterviews[0].analysis.criteria[1].level, "strong");
  assert.deepEqual(calls, ["structure", "evidence", "summary", "questions", "interview-summary"]);

  response = await fetch(`${app.url}/api/jobs/${job.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      criteria: [
        { ...CRITERIA[0], name: "Python 平台开发" },
        CRITERIA[1],
      ],
    }),
  });
  assert.equal(response.status, 200);
  const staleState = await fetch(`${app.url}/api/state`).then((item) => item.json());
  assert.equal(staleState.candidates[0].aiStatus, "stale");
  assert.equal(staleState.candidates[0].summary.source, "keyword");
  assert.equal(staleState.candidates[0].evaluation.interviewInfluence.applied, false);
});
