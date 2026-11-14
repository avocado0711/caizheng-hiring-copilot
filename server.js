"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { URL } = require("node:url");
const {
  AGENT_PIPELINE_VERSION,
  createAgentTrace,
  runScreeningAgents,
} = require("./agents/orchestrator");
const { loadEnvFile } = require("./lib/env");
const { createLlmClientFromEnv } = require("./lib/llm");
const { resolvePythonRuntime } = require("./lib/python");
const {
  buildCandidateSummary,
  cleanText,
  criteriaSignature,
  evaluateCandidate,
  findProtectedCriterion,
  normalizeCriteria,
  rankCandidates,
  splitKeywords,
  suggestCriteria: suggestCriteriaFallback,
  LEVEL_META,
} = require("./lib/screening");
const {
  extractResumeFile,
  identityKeys,
  parseResumeText,
} = require("./lib/resume");
const { JsonStore } = require("./lib/store");
const {
  DEMO_DECISIONS,
  DEMO_JOB_CARDS,
  DEMO_RESUMES,
  toDemoFilePayload,
} = require("./lib/demo");
const {
  createKnowledgeDocument,
  importKnowledgeDocuments,
  knowledgeSummary,
  publicKnowledgeDocuments,
  removeKnowledgeDocument,
  seedKnowledge,
} = require("./knowledge/store");
const {
  countKnowledgeChunks,
  retrieveKnowledge,
} = require("./knowledge/retriever");
const {
  buildEntityQuery,
  extractEntities,
} = require("./knowledge/entity-extractor");
const { assessExperience } = require("./knowledge/value-assessment");
const {
  fallbackQuestions,
  generateInterviewQuestions,
} = require("./knowledge/interview-questions");
const { generateJobCriteria } = require("./workflows/岗位评价卡生成");

loadEnvFile();

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DEFAULT_DATA_DIR = path.join(ROOT_DIR, "data");
const DEMO_KNOWLEDGE_PATH = path.join(ROOT_DIR, "knowledge", "demo", "星桥智能科技.json");
const RESUME_KNOWLEDGE_PATH = path.join(ROOT_DIR, "knowledge", "demo", "resume-screening-knowledge.json");
const VECTOR_INDEX_DIR = path.join(ROOT_DIR, "embedding_index");
const MAX_JSON_BYTES = 80 * 1024 * 1024;
const MAX_FILES = 100;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_IMPORT_TOTAL_BYTES = 60 * 1024 * 1024;
const AI_CONCURRENCY = 3;
const PHONE_SESSION_TTL_MS = 15 * 60 * 1000;
const REVIEW_STATUSES = new Set(["unreviewed", "shortlist", "discuss", "reject"]);
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const phoneSessions = new Map();
let activeServerPort = Number(process.env.PORT || 3030);
let phonePublicBaseUrl = String(process.env.HIREPROOF_PUBLIC_URL || "").replace(/\/+$/, "");
let phoneTunnelPromise = null;
let phoneTunnelProcess = null;

function jsonResponse(response, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  response.end(body);
}

function textResponse(
  response,
  status,
  body,
  contentType = "text/plain; charset=utf-8",
  extraHeaders = {},
) {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  });
  response.end(body);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_JSON_BYTES) {
        reject(new Error("请求体积超过 80 MB 限制"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("请求 JSON 格式无效"));
      }
    });
    request.on("error", reject);
  });
}

function stableCriterionId(prefix = "criterion") {
  return `${prefix}-${crypto.randomUUID()}`;
}

function prepareCriteria(criteria, previous = []) {
  const byId = new Map(previous.map((criterion) => [criterion.id, criterion]));
  const normalized = normalizeCriteria(criteria).map((criterion) => ({
    ...criterion,
    id: criterion.id && !criterion.id.startsWith("criterion-") ? criterion.id : (byId.has(criterion.id) ? criterion.id : stableCriterionId()),
  }));
  const protectedMatch = findProtectedCriterion(normalized);
  if (protectedMatch) {
    throw new Error(
      `评价项“${protectedMatch.criterionName}”包含与岗位能力无关的保护属性（${protectedMatch.label}），请删除后再保存`,
    );
  }
  return normalized;
}

function serializeJob(job) {
  return {
    ...job,
    criteria: normalizeCriteria(job.criteria),
  };
}

function decorateCandidates(job) {
  const candidates = rankCandidates(
    jobCandidatesForStore(job),
    job.criteria,
  );
  return candidates.map((candidate) => {
    const summary = buildCandidateSummary(candidate, candidate.evaluation);
    const {
      text,
      profile,
      overrides,
      aiAnalysis,
      auditHistory,
      webInterviews,
      ...safe
    } = candidate;
    return {
      ...safe,
      profile: profile || {},
      overrides: overrides || {},
      auditCount: auditHistory?.length || 0,
      webInterviewCount: webInterviews?.length || 0,
      summary,
      aiStatus: candidate.aiStatus || "disabled",
      aiModel: aiAnalysis?.model || null,
    };
  });
}

let activeStore = null;
let activeLlm = null;
let activeVectorIndex = null;
let activeVectorServiceUrl = null;
let demoResetInProgress = false;

function jobCandidatesForStore(job) {
  return activeStore ? activeStore.jobCandidates(job.id) : [];
}

function publicState() {
  const jobs = activeStore.state.jobs.map(serializeJob);
  const activeJob = jobs.find((job) => job.id === activeStore.state.activeJobId) || jobs[0] || null;
  return {
    version: activeStore.state.version,
    ai: activeLlm?.getInfo() || { configured: false, provider: "Rules", model: null },
    activeJobId: activeJob?.id || null,
    jobs: jobs.map((job) => ({
      ...job,
      candidateCount: activeStore.jobCandidates(job.id).length,
    })),
    candidates: activeJob ? decorateCandidates(activeJob) : [],
    knowledge: {
      ...knowledgeSummary(activeStore.state.knowledgeDocuments),
      chunkCount: countKnowledgeChunks(activeStore.state.knowledgeDocuments),
      vectorDocumentCount: activeVectorIndex?.metadata.length || 0,
      vectorDimension: activeVectorIndex?.dimension || 0,
      documents: publicKnowledgeDocuments(activeStore.state.knowledgeDocuments),
    },
    counts: activeStore.state.candidates.reduce((result, candidate) => {
      result.total += 1;
      return result;
    }, { total: 0 }),
  };
}

function sanitizeCandidateDetail(candidate, job) {
  const evaluation = evaluateCandidate(candidate, job.criteria);
  const summary = buildCandidateSummary(candidate, evaluation);
  return {
    ...candidate,
    evaluation,
    summary,
  };
}

function appendCandidateAudit(candidate, { actor = "system", action, summary, details = {} }) {
  if (!Array.isArray(candidate.auditHistory)) candidate.auditHistory = [];
  candidate.auditHistory.push({
    id: `audit-${crypto.randomUUID()}`,
    at: new Date().toISOString(),
    actor: cleanText(actor || "system").slice(0, 120),
    action: cleanText(action || "updated").slice(0, 120),
    summary: cleanText(summary || "").slice(0, 500),
    details,
  });
}

function normalizeStoredAiStatuses(store) {
  let changed = false;
  for (const candidate of store.state.candidates) {
    if (!Array.isArray(candidate.auditHistory)) {
      candidate.auditHistory = [];
      changed = true;
    }
    if (candidate.reviewedAt === undefined) {
      candidate.reviewedAt = null;
      changed = true;
    }
    if (candidate.reviewedBy === undefined) {
      candidate.reviewedBy = "";
      changed = true;
    }
    if (!Array.isArray(candidate.webInterviews)) {
      candidate.webInterviews = [];
      changed = true;
    }
    if (!candidate.aiAnalysis || !["complete", "error"].includes(candidate.aiStatus)) continue;
    const job = store.getJob(candidate.jobId);
    if (!job) continue;
    if (
      candidate.aiAnalysis.pipelineVersion !== AGENT_PIPELINE_VERSION
      || candidate.aiAnalysis.criteriaSignature !== criteriaSignature(job.criteria)
    ) {
      candidate.aiStatus = "stale";
      changed = true;
    }
  }
  if (changed) store.save();
}

function loadVectorIndex() {
  const manifestPath = path.join(VECTOR_INDEX_DIR, "manifest.json");
  const metadataPath = path.join(VECTOR_INDEX_DIR, "metadata.json");
  const binaryPath = path.join(VECTOR_INDEX_DIR, "vectors.f32.bin");
  if (![manifestPath, metadataPath, binaryPath].every((item) => fs.existsSync(item))) {
    return null;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  const buffer = fs.readFileSync(binaryPath);
  const vectors = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
  return {
    manifest,
    metadata,
    vectors,
    dimension: Number(manifest.dimension),
  };
}

async function postVectorService(route, payload, timeoutMs = 20_000) {
  if (!activeVectorServiceUrl) throw new Error("向量服务未启动");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${activeVectorServiceUrl}${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `向量服务返回 ${response.status}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

function knowledgeCorpusDocuments() {
  const documents = new Map();
  for (const document of activeVectorIndex?.metadata || []) {
    documents.set(document.id, {
      id: document.id,
      title: document.title,
      documentType: document.documentType,
      entityName: document.entityName,
      sourceLabel: `领域训练语料 · ${document.entityName}`,
      publishedAt: "",
      synthetic: true,
      content: document.text,
    });
  }
  for (const document of activeStore?.state.knowledgeDocuments || []) {
    documents.set(document.id, {
      ...document,
      vector: Array.isArray(document.vector) ? document.vector : null,
    });
  }
  return [...documents.values()];
}

function searchDenseKnowledge(queryVector, documents, limit = 20) {
  if (!activeVectorIndex || queryVector.length !== activeVectorIndex.dimension) return [];
  const count = activeVectorIndex.metadata.length;
  const scored = [];
  for (let index = 0; index < count; index += 1) {
    let score = 0;
    const offset = index * activeVectorIndex.dimension;
    for (let dimension = 0; dimension < activeVectorIndex.dimension; dimension += 1) {
      score += queryVector[dimension] * activeVectorIndex.vectors[offset + dimension];
    }
    scored.push({ id: activeVectorIndex.metadata[index].id, score });
  }
  for (const document of documents) {
    if (!Array.isArray(document.vector) || document.vector.length !== queryVector.length) continue;
    let score = 0;
    for (let dimension = 0; dimension < queryVector.length; dimension += 1) {
      score += queryVector[dimension] * document.vector[dimension];
    }
    scored.push({ id: document.id, score });
  }
  return scored
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

async function searchKnowledgeHybrid(query, limit = 8, options = {}) {
  const documents = knowledgeCorpusDocuments();
  const bm25Results = retrieveKnowledge(documents, query, { limit: 50 });
  if (!activeVectorIndex || !activeVectorServiceUrl) {
    return { results: bm25Results.slice(0, limit), mode: "bm25" };
  }
  try {
    const embedded = await postVectorService("/embed", { texts: [query] }, 30_000);
    const denseResults = searchDenseKnowledge(embedded.vectors[0], documents, 50);
    const documentById = new Map(documents.map((document) => [document.id, document]));
    const candidates = new Map();
    const addCandidate = (id, score, rank, source) => {
      if (!id || !documentById.has(id)) return;
      const current = candidates.get(id) || {
        id,
        document: documentById.get(id),
        rrf: 0,
        sources: new Set(),
      };
      current.rrf += 1 / (60 + rank);
      current.sources.add(source);
      candidates.set(id, current);
    };
    bm25Results.forEach((result, index) => addCandidate(result.sourceId, result.score, index + 1, "bm25"));
    denseResults.forEach((result, index) => {
      addCandidate(result.id, result.score, index + 1, "dense");
    });
    const ranked = [...candidates.values()]
      .sort((left, right) => right.rrf - left.rrf)
      .slice(0, 30);
    if (!ranked.length) return { results: bm25Results.slice(0, limit), mode: "bm25" };
    const toResult = (item, score, index, extra = {}) => ({
      sourceId: item.id,
      chunkId: item.id,
      title: item.document.title,
      entityName: item.document.entityName,
      documentType: item.document.documentType,
      sourceLabel: item.document.sourceLabel,
      publisher: item.document.publisher || "",
      sourceUrl: item.document.sourceUrl || "",
      publishedAt: item.document.publishedAt,
      retrievedAt: item.document.retrievedAt || "",
      license: item.document.license || "",
      synthetic: Boolean(item.document.synthetic),
      snippet: item.document.content.length > 460
        ? `${item.document.content.slice(0, 457)}...`
        : item.document.content,
      score: Number(score.toFixed(4)),
      confidence: Number(Math.min(0.98, 0.5 + score * 5).toFixed(2)),
      rank: index + 1,
      ...extra,
    });
    if (!options.rerank) {
      return {
        mode: "hybrid-rrf",
        results: ranked.slice(0, limit).map((item, index) => toResult(
          item,
          item.rrf,
          index,
          { retrievalSources: [...item.sources] },
        )),
      };
    }
    const reranked = await postVectorService("/rerank", {
      query,
      documents: ranked.map((item) => item.document.content),
    }, 60_000);
    const rerankOrder = ranked
      .map((item, index) => ({ item, score: Number(reranked.scores?.[index] || 0) }))
      .sort((left, right) => right.score - left.score);
    const rerankRank = new Map(rerankOrder.map((entry, index) => [entry.item.id, index + 1]));
    const finalRanked = ranked
      .map((item) => ({
        item,
        score: item.rrf + 1 / (60 + (rerankRank.get(item.id) || 60)),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
    return {
      mode: "hybrid-rerank",
      results: finalRanked.map(({ item, score }, index) => toResult(
        item,
        score,
        index,
        { retrievalSources: [...item.sources] },
      )),
    };
  } catch (error) {
    console.error("混合检索失败，回退 BM25：", error.message);
    return { results: bm25Results.slice(0, limit), mode: "bm25-fallback" };
  }
}

function createJob(input, store) {
  const title = cleanText(input?.title || "").slice(0, 100);
  if (!title) throw new Error("请填写岗位名称");
  const description = cleanText(input?.description || "").slice(0, 20_000);
  const suggestions = suggestCriteriaFallback(description).map((criterion) => ({
    ...criterion,
    id: stableCriterionId(),
    suggested: true,
  }));
  const criteria = prepareCriteria(
    Array.isArray(input?.criteria) && input.criteria.length ? input.criteria : suggestions,
  );
  const now = new Date().toISOString();
  const job = {
    id: `job-${crypto.randomUUID()}`,
    title,
    description,
    criteria,
    createdAt: now,
    updatedAt: now,
  };
  store.state.jobs.unshift(job);
  store.state.activeJobId = job.id;
  store.save();
  return job;
}

function updateJob(job, input, store) {
  if (input.title !== undefined) {
    const title = cleanText(input.title).slice(0, 100);
    if (!title) throw new Error("岗位名称不能为空");
    job.title = title;
  }
  if (input.description !== undefined) {
    job.description = cleanText(input.description).slice(0, 20_000);
  }
  if (input.criteria !== undefined) {
    const criteria = prepareCriteria(input.criteria, job.criteria);
    if (!criteria.length) throw new Error("至少保留一个评价项");
    if (criteria.reduce((sum, criterion) => sum + criterion.weight, 0) <= 0) {
      throw new Error("评价项权重总和必须大于 0");
    }
    const previousSignature = criteriaSignature(job.criteria);
    job.criteria = criteria;
    if (previousSignature !== criteriaSignature(criteria)) {
      for (const candidate of store.jobCandidates(job.id)) {
        if (candidate.aiAnalysis && ["complete", "error"].includes(candidate.aiStatus)) {
          candidate.aiStatus = "stale";
          appendCandidateAudit(candidate, {
            actor: "system",
            action: "criteria_changed",
            summary: "岗位评价卡已变化，旧 AI 证据标记为待重算",
          });
        }
      }
    }
  }
  job.updatedAt = new Date().toISOString();
  if (input.activate) store.state.activeJobId = job.id;
  store.save();
  return job;
}

function findDuplicate(candidate, pool) {
  const keys = new Set(identityKeys(candidate.profile));
  const hash = candidate.profile?.textHash;
  for (const existing of pool) {
    if (hash && hash === existing.profile?.textHash) return existing;
    if (identityKeys(existing.profile).some((key) => keys.has(key))) return existing;
  }
  return null;
}

async function importCandidates(job, input, store, llmClient = null) {
  const files = Array.isArray(input?.files) ? input.files : [];
  if (!files.length) throw new Error("请选择至少一份简历");
  if (files.length > MAX_FILES) throw new Error(`单次最多导入 ${MAX_FILES} 份简历`);

  const imported = [];
  const errors = [];
  const pool = [...store.jobCandidates(job.id)];
  let totalBytes = 0;

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    try {
      if (!file || typeof file.data !== "string") throw new Error("文件内容为空");
      const estimatedBytes = Math.floor(file.data.length * 0.75);
      if (estimatedBytes > MAX_FILE_BYTES) throw new Error("单个文件超过 15 MB 限制");
      totalBytes += estimatedBytes;
      if (totalBytes > MAX_IMPORT_TOTAL_BYTES) {
        throw new Error("单次请求简历总大小不能超过 60 MB，请分批导入");
      }
      const extracted = await extractResumeFile(file);
      const profile = parseResumeText(extracted.text, { fileName: file.name });
      const now = new Date().toISOString();
      const candidate = {
        id: `candidate-${crypto.randomUUID()}`,
        jobId: job.id,
        fileName: cleanText(file.name).slice(0, 240),
        importedAt: now,
        updatedAt: now,
        text: extracted.text,
        extractionMethod: extracted.method,
        profile,
        reviewStatus: "unreviewed",
        reviewNote: "",
        reviewedAt: null,
        reviewedBy: "",
        overrides: {},
        duplicateOf: null,
        warnings: [...(extracted.warnings || [])],
        extractionQuality: extracted.extractionQuality || null,
        ocr: extracted.ocr || null,
        aiStatus: llmClient?.configured ? "pending" : "disabled",
        aiAnalysis: null,
        aiError: "",
        agentStage: llmClient?.configured ? "queued" : "disabled",
        agentTrace: llmClient?.configured ? createAgentTrace() : [],
        auditHistory: [],
        webInterviews: [],
      };
      if (!profile.email && !profile.phone) candidate.warnings.push("未识别到邮箱或手机号，建议人工检查");
      if (
        extracted.text.length < 120
        && !candidate.warnings.some((warning) => warning.includes("文字较少") || warning.includes("OCR"))
      ) {
        candidate.warnings.push("提取文字较少，可能存在漏识别");
      }
      const duplicate = findDuplicate(candidate, pool);
      if (duplicate) {
        candidate.duplicateOf = duplicate.id;
        candidate.warnings.push(`疑似与“${duplicate.profile?.name || duplicate.fileName}”重复`);
      }
      appendCandidateAudit(candidate, {
        action: "candidate_imported",
        summary: duplicate ? "导入简历，并检测到疑似重复" : "导入简历并生成规则基线证据卡",
        details: {
          fileName: candidate.fileName,
          extractionMethod: candidate.extractionMethod,
          extractionQuality: candidate.extractionQuality,
          duplicateOf: candidate.duplicateOf,
        },
      });
      candidate.intelligence = await buildCandidateIntelligence({
        candidate,
        criteria: job.criteria,
        evaluation: evaluateCandidate(candidate, job.criteria),
        structured: {},
        llmClient: null,
        knowledgeDocuments: store.state.knowledgeDocuments,
      });
      pool.push(candidate);
      store.state.candidates.push(candidate);
      imported.push({
        id: candidate.id,
        name: profile.name,
        fileName: candidate.fileName,
        warningCount: candidate.warnings.length,
      });
    } catch (error) {
      errors.push({
        fileName: file?.name || `第 ${index + 1} 个文件`,
        message: error.message || "解析失败",
      });
    }
  }

  if (imported.length) store.save();
  if (imported.length && llmClient?.configured) {
    const jobId = job.id;
    const criteria = serializeJob(job).criteria.map((criterion) => ({
      ...criterion,
      keywords: [...criterion.keywords],
    }));
    const ids = imported.map((item) => item.id);
    setTimeout(() => {
      enrichCandidates(jobId, criteria, ids, store, llmClient).catch((error) => {
        console.error("Agent 批量分析失败：", error.message);
      });
    }, 0);
  }
  return {
    imported,
    errors,
    ai: {
      enabled: Boolean(llmClient?.configured),
      model: llmClient?.configured ? llmClient.model : null,
      queued: llmClient?.configured ? imported.length : 0,
    },
  };
}

async function enrichCandidate(jobId, criteria, candidateId, store, llmClient) {
  const candidate = store.getCandidate(jobId, candidateId);
  if (!candidate) return;
  candidate.aiStatus = "processing";
  candidate.aiError = "";
  candidate.agentStage = "queued";
  candidate.agentTrace = createAgentTrace();
  appendCandidateAudit(candidate, {
    actor: "agent-system",
    action: "ai_analysis_started",
    summary: "开始执行结构化、证据匹配、审计与摘要流水线",
  });
  candidate.updatedAt = new Date().toISOString();
  store.save();
  try {
    const result = await runScreeningAgents({
      llmClient,
      candidate,
      criteria,
      deterministicProfile: candidate.profile,
      onUpdate: ({ currentStage, trace }) => {
        const current = store.getCandidate(jobId, candidateId);
        if (!current) return;
        current.agentStage = currentStage;
        current.agentTrace = trace.map((item) => ({ ...item }));
        current.updatedAt = new Date().toISOString();
        store.save();
      },
    });
    if (result.failed) throw result.error || new Error("证据匹配 Agent 执行失败");
    candidate.aiAnalysis = {
      criteria: result.criteria || [],
      summary: result.summary || "",
      profile: result.profile || {},
      workHistory: result.workHistory || [],
      structureNotes: result.structureNotes || [],
      audit: result.audit || { status: "attention", issues: [] },
      criteriaSignature: result.criteriaSignature || criteriaSignature(criteria),
      model: result.model,
      provider: "LLM",
      generatedAt: new Date().toISOString(),
      usage: result.usage,
      agentTrace: result.trace,
      pipelineVersion: AGENT_PIPELINE_VERSION,
    };
    candidate.agentTrace = result.trace;
    candidate.agentStage = "completed";
    const currentJob = store.getJob(jobId);
    candidate.aiStatus = currentJob && criteriaSignature(currentJob.criteria) === criteriaSignature(criteria)
      ? "complete"
      : "stale";
    candidate.aiError = "";
    if (!candidate.profile.title && result.profile.currentTitle) {
      candidate.profile.title = result.profile.currentTitle;
    }
    if (candidate.profile.yearsExperience == null && result.profile.yearsExperience != null) {
      candidate.profile.yearsExperience = result.profile.yearsExperience;
    }
    if (!candidate.profile.education && result.profile.education) {
      candidate.profile.education = result.profile.education;
    }
    for (const issue of result.audit?.issues || []) {
      if (!candidate.warnings.includes(issue)) candidate.warnings.push(issue);
    }
    appendCandidateAudit(candidate, {
      actor: "agent-system",
      action: "ai_analysis_completed",
      summary: `AI 证据分析完成，状态：${candidate.aiStatus}`,
      details: {
        model: result.model,
        auditStatus: result.audit?.status || "unknown",
        verifiedCount: result.audit?.verifiedCount || 0,
        rejectedCount: result.audit?.rejectedCount || 0,
        usage: result.usage || null,
      },
    });
    candidate.intelligence = await buildCandidateIntelligence({
      candidate,
      criteria,
      evaluation: evaluateCandidate(candidate, criteria),
      structured: {
        workHistory: result.workHistory || [],
        notes: result.structureNotes || [],
      },
      llmClient,
      knowledgeDocuments: store.state.knowledgeDocuments,
    });
  } catch (error) {
    candidate.aiStatus = "error";
    candidate.aiError = cleanText(error.message || "模型分析失败").slice(0, 500);
    appendCandidateAudit(candidate, {
      actor: "agent-system",
      action: "ai_analysis_failed",
      summary: "AI 证据分析失败，已回退到关键词基线",
      details: { error: candidate.aiError },
    });
    const warning = "模型 Agent 执行失败，当前结果已回退到关键词基线";
    if (!candidate.warnings.includes(warning)) candidate.warnings.push(warning);
  } finally {
    candidate.updatedAt = new Date().toISOString();
    store.save();
  }
}

async function enrichCandidates(jobId, criteria, candidateIds, store, llmClient) {
  let cursor = 0;
  async function worker() {
    while (cursor < candidateIds.length) {
      const index = cursor;
      cursor += 1;
      await enrichCandidate(jobId, criteria, candidateIds[index], store, llmClient);
    }
  }
  const workers = Array.from(
    { length: Math.min(AI_CONCURRENCY, candidateIds.length) },
    () => worker(),
  );
  await Promise.allSettled(workers);
}

function backupStateBeforeDemo(store) {
  if (!fs.existsSync(store.filePath)) return null;
  const backupDir = path.join(path.dirname(store.filePath), "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `state-before-demo-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  fs.copyFileSync(store.filePath, backupPath);
  return path.relative(ROOT_DIR, backupPath);
}

async function buildDemoWorkspaceState({ includeCandidates = true } = {}) {
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), "caizheng-demo-reset-"));
  try {
    const stagingStore = new JsonStore(path.join(stagingDir, "state.json"));
    seedKnowledge(stagingStore, DEMO_KNOWLEDGE_PATH);
    seedKnowledge(stagingStore, RESUME_KNOWLEDGE_PATH);
    const [primaryJobCard, ...additionalJobCards] = DEMO_JOB_CARDS;
    for (const card of [...additionalJobCards].reverse()) {
      createJob(card, stagingStore);
    }
    const job = createJob(primaryJobCard, stagingStore);
    let imported = { errors: [] };
    if (includeCandidates) {
      imported = await importCandidates(job, {
        files: DEMO_RESUMES.map(toDemoFilePayload),
      }, stagingStore, null);
      const byFile = new Map(
        stagingStore.jobCandidates(job.id).map((candidate) => [candidate.fileName, candidate]),
      );
      for (const decision of DEMO_DECISIONS) {
        const candidate = byFile.get(decision.fileName);
        if (!candidate) continue;
        updateCandidate(candidate, {
          reviewer: "演示 HR",
          reviewStatus: decision.reviewStatus,
          reviewNote: decision.reviewNote,
          overrides: decision.overrides,
        }, stagingStore);
      }
    }
    stagingStore.save();
    return {
      state: stagingStore.state,
      imported,
      jobId: job.id,
    };
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

async function resetDemoWorkspace(store, options = {}) {
  const backupPath = backupStateBeforeDemo(store);
  const mode = options.mode === "empty" ? "empty" : "standard";
  const demo = await buildDemoWorkspaceState({
    includeCandidates: mode === "standard",
  });

  // Swap only after the complete demo dataset is ready, so readers never
  // observe a partially reset workspace.
  store.state = demo.state;
  store.save();

  let knowledgeVector = { indexed: 0, failed: 0 };
  if (activeVectorServiceUrl) {
    const resumeKnowledge = store.state.knowledgeDocuments.filter(
      (document) => document.documentType === "resume-screening",
    );
    knowledgeVector = await indexKnowledgeDocuments(resumeKnowledge);
  }
  store.save();
  return {
    mode,
    jobId: demo.jobId,
    jobCount: store.state.jobs.length,
    candidateCount: store.jobCandidates(demo.jobId).length,
    knowledgeCount: store.state.knowledgeDocuments.length,
    knowledgeVector,
    backupPath,
    errors: demo.imported.errors,
  };
}

function updateCandidate(candidate, input, store) {
  const before = {
    reviewStatus: candidate.reviewStatus,
    reviewNote: candidate.reviewNote,
    overrides: JSON.stringify(candidate.overrides || {}),
  };
  if (input.reviewer !== undefined) {
    candidate.reviewedBy = cleanText(input.reviewer || "").slice(0, 120);
  }
  if (input.reviewStatus !== undefined) {
    if (!REVIEW_STATUSES.has(input.reviewStatus)) throw new Error("审核状态无效");
    candidate.reviewStatus = input.reviewStatus;
  }
  if (input.reviewNote !== undefined) {
    candidate.reviewNote = cleanText(input.reviewNote).slice(0, 2_000);
  }
  if (input.overrides !== undefined) {
    if (!input.overrides || typeof input.overrides !== "object" || Array.isArray(input.overrides)) {
      throw new Error("评价覆盖数据无效");
    }
    const overrides = {};
    for (const [criterionId, override] of Object.entries(input.overrides)) {
      if (!LEVEL_META[override?.level]) continue;
      overrides[criterionId] = {
        level: override.level,
        note: cleanText(override.note || "").slice(0, 300),
      };
    }
    candidate.overrides = overrides;
  }
  const after = {
    reviewStatus: candidate.reviewStatus,
    reviewNote: candidate.reviewNote,
    overrides: JSON.stringify(candidate.overrides || {}),
  };
  const changedFields = [];
  if (before.reviewStatus !== after.reviewStatus) changedFields.push("审核状态");
  if (before.reviewNote !== after.reviewNote) changedFields.push("审核备注");
  if (before.overrides !== after.overrides) changedFields.push("评价等级覆盖");
  if (changedFields.length) {
    candidate.reviewedAt = new Date().toISOString();
    appendCandidateAudit(candidate, {
      actor: candidate.reviewedBy || "本地审核员",
      action: "human_review_updated",
      summary: `人工更新：${changedFields.join("、")}`,
      details: {
        before: {
          reviewStatus: before.reviewStatus,
          reviewNote: before.reviewNote,
          overrides: JSON.parse(before.overrides),
        },
        after: {
          reviewStatus: after.reviewStatus,
          reviewNote: after.reviewNote,
          overrides: JSON.parse(after.overrides),
        },
      },
    });
  }
  candidate.updatedAt = new Date().toISOString();
  store.save();
  return candidate;
}

async function buildCandidateIntelligence({
  candidate,
  criteria,
  evaluation,
  structured = {},
  llmClient,
  knowledgeDocuments,
}) {
  const entityResult = extractEntities(candidate, structured, knowledgeDocuments);
  const entityNames = entityResult.entities.map((entity) => entity.name);
  const evidenceTerms = (evaluation?.criteriaResults || [])
    .filter((result) => result.level !== "none")
    .flatMap((result) => [result.name, ...(result.matchedKeywords || [])])
    .slice(0, 20);
  const query = [
    candidate.profile?.title,
    buildEntityQuery(entityResult.entities, criteria),
    ...evidenceTerms,
  ].filter(Boolean).join(" ");
  const knowledgeSearch = await searchKnowledgeHybrid(query, 8);
  const knowledgeMatches = knowledgeSearch.results;
  const valueAssessment = assessExperience({
    candidate,
    evaluation,
    criteria,
    entities: entityResult.entities,
    knowledgeMatches,
    knowledgeRetrievalMode: knowledgeSearch.mode,
  });
  const interview = await generateInterviewQuestions({
    llmClient,
    candidate,
    criteriaResults: evaluation?.criteriaResults || [],
    valueAssessment,
    knowledgeMatches,
  });
  return {
    generatedAt: new Date().toISOString(),
    entities: entityResult.entities,
    entityCounts: entityResult.counts,
    knowledgeMatches,
    valueAssessment,
    interviewQuestions: interview.questions,
    interviewQuestionSource: interview.source,
    interviewQuestionError: interview.error || "",
    disclaimer: "公开信息仅用于解释组织、团队和成果背景，不能替代简历原文或人工判断。",
  };
}

function buildWebInterviewPlan(job, candidate) {
  const evaluation = evaluateCandidate(candidate, job.criteria);
  const intelligence = candidate.intelligence || {};
  let questions = Array.isArray(intelligence.interviewQuestions)
    ? intelligence.interviewQuestions
    : [];
  if (!questions.length) {
    questions = fallbackQuestions({
      criteriaResults: evaluation.criteriaResults,
      valueAssessment: intelligence.valueAssessment,
      knowledgeMatches: intelligence.knowledgeMatches || [],
      candidateText: candidate.text,
    });
  }
  const seenQuestions = new Set();
  questions = questions.filter((item) => {
    const key = cleanText(item.question).toLocaleLowerCase();
    if (!key || seenQuestions.has(key)) return false;
    seenQuestions.add(key);
    return true;
  });
  const supplementalQuestions = [
    {
      question: "请选一个最能代表你岗位能力的项目，说明你的个人职责、关键技术判断和上线后的实际结果。",
      reason: "用可核验的项目经历补充简历摘要",
      criterionId: "",
      sourceIds: [],
    },
    {
      question: "你如何评估 AI 应用上线后的质量和稳定性？请结合具体指标或故障处理经历说明。",
      reason: "确认生产交付、监控和问题处理能力",
      criterionId: "",
      sourceIds: [],
    },
  ];
  for (const supplemental of supplementalQuestions) {
    if (questions.length >= 3) break;
    if (!questions.some((item) => cleanText(item.question) === supplemental.question)) {
      questions.push(supplemental);
    }
  }
  return {
    mode: "browser",
    jobTitle: job.title,
    candidate: {
      id: candidate.id,
      name: candidate.profile?.name || candidate.fileName,
      title: candidate.profile?.title || "",
      yearsExperience: candidate.profile?.yearsExperience ?? null,
    },
    disclosure: "本次为由才证 AI 发起的网页语音岗位初筛。网页应用不保存录音，只接收转写文字用于生成招聘记录；浏览器语音识别可能受其自身数据政策约束。",
    questions: questions.slice(0, 5).map((item, index) => ({
      id: `question-${index + 1}`,
      question: cleanText(item.question).slice(0, 500),
      reason: cleanText(item.reason || "").slice(0, 300),
      criterionId: cleanText(item.criterionId || "").slice(0, 120),
      sourceIds: Array.isArray(item.sourceIds) ? item.sourceIds.slice(0, 5) : [],
    })),
  };
}

function summarizeWebInterview(input, questions) {
  const answers = (Array.isArray(input.answers) ? input.answers : [])
    .map((answer) => ({
      questionId: cleanText(answer.questionId || "").slice(0, 80),
      question: cleanText(answer.question || "").slice(0, 500),
      answer: cleanText(answer.answer || "").slice(0, 2_000),
    }))
    .filter((answer) => answer.answer);
  const substantive = answers.filter((answer) => answer.answer.length >= 8);
  const effectiveQuestions = Array.isArray(questions) ? questions.length : substantive.length;
  const highlights = substantive.slice(0, 4).map((answer) => ({
    questionId: answer.questionId,
    question: answer.question,
    answer: answer.answer.slice(0, 300),
  }));
  const unanswered = (Array.isArray(questions) ? questions : [])
    .filter((question) => !substantive.some((answer) => answer.questionId === question.id))
    .map((question) => question.id);
  return {
    summary: `候选人完成网页 AI 初筛，共回答 ${substantive.length}/${effectiveQuestions} 个计划问题。该记录只基于候选人主动回答，不包含声音情绪或性格判断。`,
    highlights,
    unansweredQuestionIds: unanswered,
  };
}

function findLanAddress() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  const ignoredInterface = /vEthernet|VMware|VirtualBox|Tailscale|ZeroTier|WSL|Docker|Loopback/i;
  for (const [name, addresses] of Object.entries(interfaces)) {
    if (ignoredInterface.test(name)) continue;
    for (const address of addresses || []) {
      if (address.family !== "IPv4" || address.internal) continue;
      candidates.push(address.address);
    }
  }
  return [...new Set(candidates)].sort((left, right) => {
    const score = (address) => (
      address.startsWith("192.168.") ? 0
        : address.startsWith("10.") ? 1
          : /^172\.(?:1[6-9]|2\d|3[01])\./.test(address) ? 2
            : 3
    );
    return score(left) - score(right);
  })[0] || "127.0.0.1";
}

function phoneBaseUrl() {
  if (phonePublicBaseUrl) return phonePublicBaseUrl;
  return `http://${findLanAddress()}:${activeServerPort}`;
}

function cleanPhoneToken(value) {
  return String(value || "").replace(/[^a-f0-9]/gi, "").slice(0, 80);
}

function tokensMatch(expected, received) {
  const left = Buffer.from(String(expected || ""));
  const right = Buffer.from(String(received || ""));
  return left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
}

function prunePhoneSessions() {
  const now = Date.now();
  for (const [id, session] of phoneSessions) {
    if (new Date(session.expiresAt).getTime() <= now) phoneSessions.delete(id);
  }
}

function createPhoneSession(input) {
  prunePhoneSessions();
  const candidate = activeStore?.state.candidates.find((item) => item.id === input?.candidateId);
  if (!candidate) throw new Error("候选人不存在");
  const job = activeStore.getJob(candidate.jobId);
  if (!job) throw new Error("岗位不存在");
  const id = `phone-${crypto.randomUUID()}`;
  const token = crypto.randomBytes(24).toString("hex");
  const now = new Date();
  const session = {
    id,
    token,
    candidateId: candidate.id,
    jobId: job.id,
    plan: buildWebInterviewPlan(job, candidate),
    status: "waiting",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + PHONE_SESSION_TTL_MS).toISOString(),
    joinedAt: null,
    connectedAt: null,
    endedAt: null,
    events: [],
  };
  phoneSessions.set(id, session);
  return session;
}

function getPhoneSession(id, token) {
  prunePhoneSessions();
  const session = phoneSessions.get(String(id || ""));
  if (!session || !tokensMatch(session.token, cleanPhoneToken(token))) {
    throw new Error("手机接听会话不存在或已过期");
  }
  return session;
}

function appendPhoneSessionEvent(session, type, data = {}) {
  const allowedTypes = new Set([
    "phone.joined",
    "call.accepted",
    "ai.speaking",
    "candidate.transcript",
    "call.ended",
  ]);
  if (!allowedTypes.has(type)) throw new Error("不支持的通话事件");
  const event = {
    seq: session.events.length + 1,
    type,
    at: new Date().toISOString(),
    data,
  };
  session.events.push(event);
  if (type === "phone.joined" && session.status === "waiting") {
    session.status = "joined";
    session.joinedAt = event.at;
  }
  if (type === "call.accepted") {
    session.status = "connected";
    session.connectedAt = event.at;
  }
  if (type === "call.ended") {
    session.status = "ended";
    session.endedAt = event.at;
  }
  return event;
}

function publicPhoneSession(session) {
  return {
    id: session.id,
    status: session.status,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    joinedAt: session.joinedAt,
    connectedAt: session.connectedAt,
    endedAt: session.endedAt,
  };
}

function isLoopbackAddress(address) {
  return address === "127.0.0.1"
    || address === "::1"
    || address === "::ffff:127.0.0.1";
}

function isLocalRequest(request) {
  const forwarded = request.headers["cf-connecting-ip"] || request.headers["x-forwarded-for"];
  return !forwarded && isLoopbackAddress(request.socket.remoteAddress);
}

function isPublicPhoneRequest(method, pathname) {
  if (["GET", "HEAD"].includes(method) && ["/phone.html", "/phone.css", "/phone.js"].includes(pathname)) {
    return true;
  }
  return /^\/api\/call-sessions\/[^/]+\/(?:join|status|events)$/.test(pathname);
}

function isTrustedPhoneWriteRequest(request) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return true;
  const contentType = String(request.headers["content-type"] || "")
    .split(";")[0]
    .trim()
    .toLocaleLowerCase();
  if (contentType !== "application/json") return false;
  const host = String(request.headers.host || "");
  const origin = String(request.headers.origin || "");
  if (!host || !origin) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function findCloudflaredExecutable() {
  const configured = process.env.HIREPROOF_CLOUDFLARED;
  const candidates = [
    configured,
    "cloudflared",
    "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe",
    "C:\\Program Files\\cloudflared\\cloudflared.exe",
  ].filter(Boolean);
  return candidates.find((candidate) => candidate === "cloudflared" || fs.existsSync(candidate)) || null;
}

function startPhoneQuickTunnel(localUrl) {
  if (process.env.HIREPROOF_PUBLIC_URL) return Promise.resolve(process.env.HIREPROOF_PUBLIC_URL);
  const executable = findCloudflaredExecutable();
  if (!executable) {
    console.warn("未找到 cloudflared，手机接听将回退到局域网 HTTP。");
    return Promise.resolve("");
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (url) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (url) {
        phonePublicBaseUrl = url.replace(/\/+$/, "");
        console.log(`手机接听 HTTPS 地址：${phonePublicBaseUrl}`);
        resolve(phonePublicBaseUrl);
      } else {
        console.warn("Cloudflare 隧道未能在限定时间内建立，手机接听将回退到局域网 HTTP。");
        resolve("");
      }
    };
    const child = spawn(executable, [
      "tunnel",
      "--url",
      localUrl,
      "--no-autoupdate",
      "--edge-ip-version",
      "4",
      "--retries",
      "2",
    ], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    phoneTunnelProcess = child;
    const inspect = (chunk) => {
      const text = String(chunk || "");
      const match = text.match(/https:\/\/([a-z0-9]+(?:-[a-z0-9]+)+)\.trycloudflare\.com/i);
      if (match) finish(match[0]);
    };
    child.stdout?.on("data", inspect);
    child.stderr?.on("data", inspect);
    child.once("error", () => finish(""));
    child.once("exit", (code) => {
      if (!settled && code) finish("");
    });
    const stopTunnel = () => {
      if (!child.killed) child.kill();
    };
    process.once("exit", stopTunnel);
    const timer = setTimeout(() => finish(""), 15_000);
  });
}

function csvEscape(value) {
  const raw = String(value ?? "");
  const text = /^[\u0009\u000A\u000D ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsv(job, candidates) {
  const criteria = normalizeCriteria(job.criteria);
  const headers = [
    "排名", "姓名", "邮箱", "电话", "总分", "硬性条件", "审核状态",
    "审核人", "审核时间", "最近决策记录",
    ...criteria.map((criterion) => criterion.name), "审核备注", "简历文件",
  ];
  const rows = candidates.map((candidate) => [
    candidate.rank,
    candidate.profile?.name,
    candidate.profile?.email,
    candidate.profile?.phone,
    candidate.evaluation.score,
    candidate.evaluation.gateLabel,
    candidate.reviewStatus,
    candidate.reviewedBy,
    candidate.reviewedAt,
    candidate.auditHistory?.at(-1)?.summary || "",
    ...candidate.evaluation.criteriaResults.map(
      (result) => `${LEVEL_META[result.level].label}${result.override ? "（人工）" : ""}`,
    ),
    candidate.reviewNote,
    candidate.fileName,
  ]);
  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

function getRouteParts(pathname) {
  return pathname.split("/").filter(Boolean).map(decodeURIComponent);
}

async function handleApi(request, response, url) {
  const parts = getRouteParts(url.pathname);
  if (request.method === "GET" && url.pathname === "/api/health") {
    jsonResponse(response, 200, {
      ok: true,
      time: new Date().toISOString(),
      ai: activeLlm?.getInfo() || { configured: false, provider: "Rules", model: null },
    });
    return true;
  }
  if (request.method === "GET" && url.pathname === "/api/state") {
    jsonResponse(response, 200, publicState());
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/call-sessions") {
    const input = await readJson(request);
    if (phoneTunnelPromise) await phoneTunnelPromise.catch(() => "");
    const session = createPhoneSession(input);
    const phoneUrl = `${phoneBaseUrl()}/phone.html?session=${encodeURIComponent(session.id)}&token=${encodeURIComponent(session.token)}`;
    jsonResponse(response, 201, {
      session: { ...publicPhoneSession(session), token: session.token },
      phoneUrl,
      secure: phoneUrl.startsWith("https://"),
    });
    return true;
  }
  if (parts[0] === "api" && parts[1] === "call-sessions" && parts[2]) {
    const session = getPhoneSession(parts[2], url.searchParams.get("token"));
    if (request.method === "GET" && parts[3] === "status" && parts.length === 4) {
      jsonResponse(response, 200, { session: publicPhoneSession(session) });
      return true;
    }
    if (request.method === "GET" && parts[3] === "events" && parts.length === 4) {
      const after = Math.max(0, Number(url.searchParams.get("after")) || 0);
      jsonResponse(response, 200, {
        session: publicPhoneSession(session),
        events: session.events.filter((event) => event.seq > after),
      });
      return true;
    }
    if (request.method === "POST" && parts[3] === "join" && parts.length === 4) {
      const input = await readJson(request);
      getPhoneSession(session.id, input.token);
      if (!session.joinedAt) appendPhoneSessionEvent(session, "phone.joined");
      jsonResponse(response, 200, {
        session: publicPhoneSession(session),
        plan: session.plan,
      });
      return true;
    }
    if (request.method === "POST" && parts[3] === "events" && parts.length === 4) {
      const input = await readJson(request);
      getPhoneSession(session.id, input.token);
      const data = input.data && typeof input.data === "object" ? input.data : {};
      if (JSON.stringify(data).length > 120_000) throw new Error("手机通话事件内容过大");
      const event = appendPhoneSessionEvent(session, cleanText(input.type || ""), data);
      jsonResponse(response, 201, { event, session: publicPhoneSession(session) });
      return true;
    }
  }
  if (request.method === "GET" && url.pathname === "/api/knowledge") {
    jsonResponse(response, 200, {
      ...knowledgeSummary(activeStore.state.knowledgeDocuments),
      chunkCount: countKnowledgeChunks(activeStore.state.knowledgeDocuments),
      documents: publicKnowledgeDocuments(activeStore.state.knowledgeDocuments),
    });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/knowledge") {
    const input = await readJson(request);
    const document = createKnowledgeDocument(activeStore, input);
    if (activeVectorServiceUrl) {
      try {
        const embedded = await postVectorService("/embed", {
          texts: [`${document.title}\n${document.content}`],
        }, 30_000);
        document.vector = embedded.vectors?.[0] || null;
        document.vectorModel = activeVectorIndex?.manifest?.projectModel || "project-embedding";
        document.vectorIndexedAt = new Date().toISOString();
        activeStore.save();
      } catch (error) {
        document.vectorError = cleanText(error.message).slice(0, 200);
        activeStore.save();
      }
    }
    jsonResponse(response, 201, {
      document: publicKnowledgeDocuments([document])[0],
    });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/knowledge/import") {
    const input = await readJson(request);
    const documents = importKnowledgeDocuments(activeStore, input.documents);
    const vector = await indexKnowledgeDocuments(documents);
    jsonResponse(response, 201, {
      imported: documents.length,
      vector,
      documents: publicKnowledgeDocuments(documents),
    });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/knowledge/reindex") {
    if (!activeVectorServiceUrl) {
      jsonResponse(response, 503, { error: "本地向量服务未就绪" });
      return true;
    }
    const input = await readJson(request);
    const documentType = cleanText(input.documentType || "");
    const documents = activeStore.state.knowledgeDocuments.filter(
      (document) => !documentType || document.documentType === documentType,
    );
    const result = await indexKnowledgeDocuments(documents);
    jsonResponse(response, 200, { ...result, total: documents.length });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/knowledge/search") {
    const input = await readJson(request);
    const query = cleanText(input.query || "");
    if (!query) throw new Error("请输入检索问题");
    const search = await searchKnowledgeHybrid(
      query,
      Math.min(12, Number(input.limit) || 8),
      { rerank: Boolean(input.rerank) },
    );
    jsonResponse(response, 200, { query, mode: search.mode, results: search.results });
    return true;
  }
  if (parts[0] === "api" && parts[1] === "knowledge" && parts[2] && request.method === "DELETE") {
    const removed = removeKnowledgeDocument(activeStore, parts[2]);
    jsonResponse(response, removed ? 200 : 404, removed ? { ok: true } : { error: "知识文档不存在" });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/demo/reset") {
    if (demoResetInProgress) {
      jsonResponse(response, 409, { error: "演示数据正在重置，请稍候" });
      return true;
    }
    demoResetInProgress = true;
    try {
      const input = await readJson(request);
      const result = await resetDemoWorkspace(activeStore, { mode: input.mode });
      jsonResponse(response, 200, {
        ok: true,
        ...result,
        state: publicState(),
      });
    } finally {
      demoResetInProgress = false;
    }
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/jobs/suggest") {
    const input = await readJson(request);
    if (!cleanText(input.description || "")) throw new Error("请先填写岗位描述");
    let warning = "";
    if (activeLlm?.configured) {
      try {
        const semanticContext = await searchKnowledgeHybrid(input.description, 6);
        const result = await generateJobCriteria({
          llmClient: activeLlm,
          description: input.description,
          knowledgeDocuments: activeStore.state.knowledgeDocuments,
          retrievedContext: semanticContext.results,
        });
        const suggested = prepareCriteria(
          normalizeCriteria(result.criteria)
            .filter((criterion) => criterion.name)
            .map((criterion) => ({
              ...criterion,
              keywords: criterion.keywords.length ? criterion.keywords : [criterion.name],
            })),
        ).slice(0, 8);
        if (suggested.length >= 3) {
          jsonResponse(response, 200, {
            criteria: suggested.map((criterion) => ({ ...criterion, suggested: true })),
            source: "llm",
            model: result.model,
            basisSourceIds: result.basisSourceIds,
            contextSources: result.contextSources,
            retrievalMode: semanticContext.mode,
          });
          return true;
        }
      } catch (error) {
        warning = `模型评价卡生成失败，已使用本地规则：${cleanText(error.message).slice(0, 160)}`;
        console.error("LLM 评价卡生成失败，使用规则回退：", error.message);
      }
    }
    jsonResponse(response, 200, {
      criteria: suggestCriteriaFallback(input.description),
      source: "rules",
      warning,
    });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/jobs") {
    const input = await readJson(request);
    const job = createJob(input, activeStore);
    jsonResponse(response, 201, { job: serializeJob(job) });
    return true;
  }

  if (parts[0] !== "api" || parts[1] !== "jobs" || !parts[2]) return false;
  const job = activeStore.getJob(parts[2]);
  if (!job) {
    jsonResponse(response, 404, { error: "岗位不存在" });
    return true;
  }

  if (request.method === "GET" && parts.length === 3) {
    jsonResponse(response, 200, {
      job: serializeJob(job),
      candidates: decorateCandidates(job),
    });
    return true;
  }
  if (request.method === "PUT" && parts.length === 3) {
    const input = await readJson(request);
    updateJob(job, input, activeStore);
    jsonResponse(response, 200, { job: serializeJob(job) });
    return true;
  }
  if (request.method === "DELETE" && parts.length === 3) {
    activeStore.removeJob(job.id);
    jsonResponse(response, 200, { ok: true });
    return true;
  }
  if (request.method === "POST" && parts[3] === "activate" && parts.length === 4) {
    activeStore.state.activeJobId = job.id;
    activeStore.save();
    jsonResponse(response, 200, { ok: true });
    return true;
  }
  if (request.method === "POST" && parts[3] === "reanalyze" && parts.length === 4) {
    if (!activeLlm?.configured) {
      jsonResponse(response, 503, { error: "LLM 未配置" });
      return true;
    }
    const candidates = activeStore.jobCandidates(job.id).filter(
      (candidate) => ["stale", "error"].includes(candidate.aiStatus),
    );
    if (!candidates.length) {
      jsonResponse(response, 200, { queued: 0 });
      return true;
    }
    for (const candidate of candidates) {
      candidate.aiStatus = "pending";
      candidate.aiError = "";
      candidate.updatedAt = new Date().toISOString();
    }
    activeStore.save();
    const criteria = normalizeCriteria(job.criteria);
    const ids = candidates.map((candidate) => candidate.id);
    setTimeout(() => {
      enrichCandidates(job.id, criteria, ids, activeStore, activeLlm).catch((error) => {
        console.error("Agent 批量重算失败：", error.message);
      });
    }, 0);
    jsonResponse(response, 202, { queued: ids.length });
    return true;
  }
  if (request.method === "POST" && parts[3] === "candidates" && parts[4] === "import" && parts.length === 5) {
    const input = await readJson(request);
    const result = await importCandidates(job, input, activeStore, activeLlm);
    jsonResponse(response, 200, result);
    return true;
  }
  if (parts[3] === "candidates" && parts[4]) {
    const candidate = activeStore.getCandidate(job.id, parts[4]);
    if (!candidate) {
      jsonResponse(response, 404, { error: "候选人不存在" });
      return true;
    }
    if (request.method === "GET" && parts[5] === "interview-plan" && parts.length === 6) {
      jsonResponse(response, 200, buildWebInterviewPlan(job, candidate));
      return true;
    }
    if (request.method === "GET" && parts.length === 5) {
      jsonResponse(response, 200, { candidate: sanitizeCandidateDetail(candidate, job) });
      return true;
    }
    if (request.method === "PATCH" && parts.length === 5) {
      const input = await readJson(request);
      updateCandidate(candidate, input, activeStore);
      const evaluation = evaluateCandidate(candidate, job.criteria);
      const existingQuestions = candidate.intelligence?.interviewQuestions || [];
      const intelligence = await buildCandidateIntelligence({
        candidate,
        criteria: job.criteria,
        evaluation,
        structured: { workHistory: candidate.aiAnalysis?.workHistory || [] },
        llmClient: null,
        knowledgeDocuments: activeStore.state.knowledgeDocuments,
      });
      intelligence.interviewQuestions = existingQuestions;
      candidate.intelligence = intelligence;
      activeStore.save();
      jsonResponse(response, 200, { candidate: sanitizeCandidateDetail(candidate, job) });
      return true;
    }
    if (request.method === "DELETE" && parts.length === 5) {
      activeStore.removeCandidate(job.id, candidate.id);
      jsonResponse(response, 200, { ok: true });
      return true;
    }
    if (request.method === "POST" && parts[5] === "web-interview" && parts.length === 6) {
      const input = await readJson(request);
      const consent = Boolean(input.consent);
      const questions = (Array.isArray(input.questions) ? input.questions : [])
        .slice(0, 8)
        .map((question, index) => ({
          id: cleanText(question.id || `question-${index + 1}`).slice(0, 80),
          question: cleanText(question.question || "").slice(0, 500),
          criterionId: cleanText(question.criterionId || "").slice(0, 120),
        }))
        .filter((question) => question.question);
      const answers = (Array.isArray(input.answers) ? input.answers : [])
        .slice(0, 20)
        .map((answer) => ({
          questionId: cleanText(answer.questionId || "").slice(0, 80),
          question: cleanText(answer.question || "").slice(0, 500),
          answer: cleanText(answer.answer || "").slice(0, 2_000),
        }));
      const report = summarizeWebInterview({ answers }, questions);
      const now = new Date().toISOString();
      const completionReason = cleanText(input.completionReason || "completed").slice(0, 80);
      const status = !consent
        ? "declined"
        : completionReason === "reschedule"
          ? "follow_up_required"
          : "completed";
      const interview = {
        id: `web-interview-${crypto.randomUUID()}`,
        mode: input.mode === "phone-pair-demo" ? "phone-pair-demo" : "browser-voice",
        status,
        consent,
        completionReason,
        startedAt: cleanText(input.startedAt || "").slice(0, 40) || now,
        endedAt: cleanText(input.endedAt || "").slice(0, 40) || now,
        durationSec: Math.max(0, Math.min(7_200, Number(input.durationSec) || 0)),
        questions,
        answers,
        summary: !consent
          ? "候选人在通话开始时未同意继续，本次未进入岗位问题环节。"
          : completionReason === "reschedule"
            ? "候选人当前不方便继续，本次未进入完整岗位问题环节，建议重新安排时间。"
            : report.summary,
        highlights: consent ? report.highlights : [],
        unansweredQuestionIds: consent ? report.unansweredQuestionIds : questions.map((item) => item.id),
        audioStored: false,
        createdAt: now,
      };
      if (!Array.isArray(candidate.webInterviews)) candidate.webInterviews = [];
      candidate.webInterviews.unshift(interview);
      candidate.webInterviews = candidate.webInterviews.slice(0, 20);
      candidate.updatedAt = now;
      appendCandidateAudit(candidate, {
        actor: "browser-voice-agent",
        action: !consent
          ? "web_interview_declined"
          : completionReason === "reschedule"
            ? "web_interview_follow_up"
            : "web_interview_completed",
        summary: interview.summary,
        details: {
          interviewId: interview.id,
          durationSec: interview.durationSec,
          answerCount: interview.answers.filter((item) => item.answer.length >= 8).length,
          audioStored: false,
        },
      });
      activeStore.save();
      jsonResponse(response, 201, { interview });
      return true;
    }
    if (request.method === "POST" && parts[5] === "analyze" && parts.length === 6) {
      if (!activeLlm?.configured) {
        jsonResponse(response, 503, { error: "LLM 未配置" });
        return true;
      }
      candidate.aiStatus = "pending";
      candidate.aiError = "";
      candidate.updatedAt = new Date().toISOString();
      activeStore.save();
      const criteria = normalizeCriteria(job.criteria);
      setTimeout(() => {
        enrichCandidates(job.id, criteria, [candidate.id], activeStore, activeLlm).catch((error) => {
          console.error("Agent 单人分析失败：", error.message);
        });
      }, 0);
      jsonResponse(response, 202, {
        ok: true,
        candidate: sanitizeCandidateDetail(candidate, job),
      });
      return true;
    }
  }
  if (request.method === "GET" && parts[3] === "export.csv") {
    const candidates = rankCandidates(activeStore.jobCandidates(job.id), job.criteria);
    const csv = `\uFEFF${buildCsv(job, candidates)}`;
    const safeName = job.title.replace(/[\\/:*?"<>|]/g, "_");
    textResponse(
      response,
      200,
      csv,
      "text/csv; charset=utf-8",
      {
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${safeName}-候选人筛选.csv`)}`,
      },
    );
    return true;
  }
  return false;
}

function serveStatic(request, response, url) {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    textResponse(response, 400, "Invalid path");
    return;
  }
  const filePath = path.resolve(PUBLIC_DIR, `.${decoded}`);
  if (!(filePath === PUBLIC_DIR || filePath.startsWith(`${PUBLIC_DIR}${path.sep}`))) {
    textResponse(response, 403, "Forbidden");
    return;
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    textResponse(response, 404, "Not found");
    return;
  }
  const extension = path.extname(filePath).toLocaleLowerCase();
  const body = fs.readFileSync(filePath);
  response.writeHead(200, {
    "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  response.end(body);
}

async function indexKnowledgeDocuments(documents) {
  if (!activeVectorServiceUrl) return { indexed: 0, failed: documents.length };
  let indexed = 0;
  let failed = 0;
  for (const document of documents) {
    try {
      const embedded = await postVectorService("/embed", {
        texts: [`${document.title}\n${document.content}`],
      }, 45_000);
      document.vector = embedded.vectors?.[0] || null;
      document.vectorModel = activeVectorIndex?.manifest?.projectModel || "project-embedding";
      document.vectorIndexedAt = new Date().toISOString();
      document.vectorError = "";
      indexed += 1;
    } catch (error) {
      document.vectorError = cleanText(error.message).slice(0, 200);
      failed += 1;
    }
  }
  activeStore.save();
  return { indexed, failed };
}

function createRequestHandler(store, options = {}) {
  activeStore = store;
  activeLlm = options.llmClient || null;
  return async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    response.setHeader("X-Frame-Options", "DENY");
    try {
      if (!isLocalRequest(request) && !isPublicPhoneRequest(request.method, url.pathname)) {
        jsonResponse(response, 403, { error: "手机演示通道仅允许访问接听页面" });
        return;
      }
      if (url.pathname.startsWith("/api/")) {
        if (
          !isTrustedWriteRequest(request)
          && !(isPublicPhoneRequest(request.method, url.pathname) && isTrustedPhoneWriteRequest(request))
        ) {
          jsonResponse(response, 403, { error: "拒绝跨站或非 JSON 写请求" });
          return;
        }
        const handled = await handleApi(request, response, url);
        if (!handled) jsonResponse(response, 404, { error: "接口不存在" });
        return;
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        textResponse(response, 405, "Method not allowed");
        return;
      }
      serveStatic(request, response, url);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ${request.method} ${url.pathname}:`, error);
      if (!response.headersSent) {
        jsonResponse(response, 400, { error: error.message || "请求失败" });
      } else {
        response.end();
      }
    }
  };
}

function isTrustedWriteRequest(request) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return true;
  let requestHost;
  try {
    requestHost = new URL(`http://${request.headers.host || ""}`);
  } catch {
    return false;
  }
  const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
  if (!loopbackHosts.has(requestHost.hostname)) return false;
  if (request.headers["sec-fetch-site"] === "cross-site") return false;

  const origin = request.headers.origin;
  if (origin) {
    try {
      const parsedOrigin = new URL(origin);
      if (parsedOrigin.protocol !== "http:" || parsedOrigin.host !== requestHost.host) {
        return false;
      }
    } catch {
      return false;
    }
  }

  if (["POST", "PUT", "PATCH"].includes(request.method)) {
    const contentType = String(request.headers["content-type"] || "")
      .split(";")[0]
      .trim()
      .toLocaleLowerCase();
    if (contentType !== "application/json") return false;
  }
  return true;
}

function listenWithFallback(server, startPort, host) {
  return new Promise((resolve, reject) => {
    let port = startPort;
    const attempt = () => {
      const onError = (error) => {
        server.off("listening", onListening);
        if (error.code === "EADDRINUSE" && port < startPort + 20) {
          port += 1;
          attempt();
          return;
        }
        reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve(server.address().port);
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, host);
    };
    attempt();
  });
}

function processIsRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function acquireDataLock(dataDir) {
  const lockPath = path.join(dataDir, ".caizheng.lock");
  const lockId = crypto.randomUUID();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const descriptor = fs.openSync(lockPath, "wx");
      fs.closeSync(descriptor);
      const payload = {
        id: lockId,
        pid: process.pid,
        createdAt: new Date().toISOString(),
        port: null,
        url: null,
      };
      fs.writeFileSync(lockPath, JSON.stringify(payload), "utf8");
      let released = false;
      return {
        update(changes) {
          if (released) return;
          Object.assign(payload, changes);
          fs.writeFileSync(lockPath, JSON.stringify(payload), "utf8");
        },
        release() {
          if (released) return;
          released = true;
          try {
            const current = JSON.parse(fs.readFileSync(lockPath, "utf8"));
            if (current.id === lockId) fs.unlinkSync(lockPath);
          } catch {
            // Another process may already have cleaned up a stale lock.
          }
        },
      };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      let current = null;
      try {
        current = JSON.parse(fs.readFileSync(lockPath, "utf8"));
      } catch {
        current = null;
      }
      if (current && processIsRunning(Number(current.pid))) {
        const conflict = new Error("当前数据目录已有才证实例在运行");
        conflict.code = "HIREPROOF_ALREADY_RUNNING";
        conflict.pid = Number(current.pid);
        conflict.url = current.url || null;
        throw conflict;
      }
      if (!current) {
        let ageMs = Number.POSITIVE_INFINITY;
        try {
          ageMs = Date.now() - fs.statSync(lockPath).mtimeMs;
        } catch {
          // The lock disappeared; retry normally.
        }
        if (ageMs < 5_000) {
          const conflict = new Error("另一个才证实例正在初始化数据目录");
          conflict.code = "HIREPROOF_ALREADY_RUNNING";
          conflict.url = null;
          throw conflict;
        }
      }
      try {
        fs.unlinkSync(lockPath);
      } catch {
        // Retry once to let another startup clean up its own stale lock.
      }
    }
  }
  throw new Error("无法获取才证数据目录锁");
}

async function startServer(options = {}) {
  const host = options.host || "127.0.0.1";
  const startPort = Number(options.port ?? process.env.PORT ?? 3030);
  const dataDir = options.dataDir
    || process.env.HIREPROOF_DATA_DIR
    || DEFAULT_DATA_DIR;
  fs.mkdirSync(dataDir, { recursive: true });
  const lock = acquireDataLock(dataDir);
  try {
    const store = new JsonStore(path.join(dataDir, "state.json"));
    activeVectorIndex = loadVectorIndex();
    activeVectorServiceUrl = options.vectorServiceUrl
      || process.env.HIREPROOF_VECTOR_SERVICE_URL
      || null;
    seedKnowledge(store, DEMO_KNOWLEDGE_PATH);
    normalizeStoredAiStatuses(store);
    const llmClient = Object.prototype.hasOwnProperty.call(options, "llmClient")
      ? options.llmClient
      : createLlmClientFromEnv();
    const server = http.createServer(createRequestHandler(store, { llmClient }));
    const port = await listenWithFallback(server, startPort, host);
    activeServerPort = port;
    const displayHost = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
    const url = `http://${displayHost}:${port}`;
    lock.update({ port, url });
    const exitHandler = () => lock.release();
    process.once("exit", exitHandler);
    let closed = false;
    return {
      server,
      port,
      store,
      llmClient,
      url,
      lanUrl: `http://${findLanAddress()}:${port}`,
      close: () => new Promise((resolve, reject) => {
        if (closed) {
          resolve();
          return;
        }
        closed = true;
        server.close((error) => {
          process.removeListener("exit", exitHandler);
          lock.release();
          if (error) reject(error);
          else resolve();
        });
      }),
    };
  } catch (error) {
    lock.release();
    throw error;
  }
}

async function ensureVectorService() {
  if (process.env.HIREPROOF_DISABLE_VECTOR_SERVICE === "1") return null;
  const serviceUrl = process.env.HIREPROOF_VECTOR_SERVICE_URL
    || "http://127.0.0.1:3041";
  process.env.HIREPROOF_VECTOR_SERVICE_URL = serviceUrl;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 600);
    const response = await fetch(`${serviceUrl}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (response.ok) return null;
  } catch {
    // Start the local model service when it is not already running.
  }
  const scriptPath = path.join(ROOT_DIR, "ml", "embedding_service.py");
  if (!fs.existsSync(scriptPath)) return null;
  const pythonRuntime = resolvePythonRuntime();
  const servicePort = new URL(serviceUrl).port || "3041";
  const pythonArguments = [
    ...pythonRuntime.args,
    scriptPath,
    "--port",
    servicePort,
  ];
  const child = spawn(pythonRuntime.command, pythonArguments, {
    cwd: ROOT_DIR,
    windowsHide: true,
    stdio: "ignore",
    env: {
      ...process.env,
      HF_HUB_OFFLINE: "1",
      TRANSFORMERS_OFFLINE: "1",
    },
  });
  child.once("error", (error) => {
    console.warn(`本地向量服务启动失败，将使用 BM25：${error.message}`);
  });
  child.once("exit", (code) => {
    if (code && code !== 0) {
      console.warn(`本地向量服务已退出（${code}），当前继续使用 BM25。`);
    }
  });
  console.log(
    `本地向量与 Reranker 服务启动中（Python: ${pythonRuntime.sourceLabel}），就绪前自动使用 BM25。`,
  );
  const stopChild = () => {
    if (!child.killed) child.kill();
  };
  process.once("exit", stopChild);
  process.once("SIGINT", () => {
    stopChild();
    process.exit(130);
  });
  return child;
}

function findEdgeExecutable() {
  if (process.platform !== "win32") return null;
  const candidates = [
    process.env.HIREPROOF_EDGE_PATH,
    process.env["ProgramFiles(x86)"]
      ? path.join(process.env["ProgramFiles(x86)"], "Microsoft", "Edge", "Application", "msedge.exe")
      : "",
    process.env.ProgramFiles
      ? path.join(process.env.ProgramFiles, "Microsoft", "Edge", "Application", "msedge.exe")
      : "",
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "Application", "msedge.exe")
      : "",
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function openBrowser(url, options = {}) {
  if (process.platform !== "win32") return false;
  const preferEdge = Boolean(options.preferEdge);
  const edgeExecutable = preferEdge ? findEdgeExecutable() : null;
  const command = edgeExecutable || "cmd.exe";
  const args = edgeExecutable
    ? ["--new-window", url]
    : ["/c", "start", "", url];
  try {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
    return Boolean(edgeExecutable);
  } catch (error) {
    console.warn(`无法自动打开浏览器：${error.message}`);
    return false;
  }
}

function withFreshDemoParam(url) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("fresh", "1");
    return parsed.toString();
  } catch {
    return url;
  }
}

async function resetRunningDemo(startPort) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1800);
  try {
    const baseUrl = `http://127.0.0.1:${startPort}`;
    const health = await fetch(`${baseUrl}/api/health`, { signal: controller.signal });
    if (!health.ok) return null;
    const reset = await fetch(`${baseUrl}/api/demo/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      signal: controller.signal,
    });
    if (!reset.ok) return null;
    return baseUrl;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

if (require.main === module) {
  const run = async () => {
    const phoneDemo = process.argv.includes("--phone-demo")
      || process.env.HIREPROOF_PHONE_DEMO === "1";
    const freshDemo = process.argv.includes("--fresh-demo");
    const shouldOpen = process.argv.includes("--open") || process.argv.includes("--open-edge");
    const startPort = Number(process.env.PORT || 3030);
    if (freshDemo) {
      const runningUrl = await resetRunningDemo(startPort);
      if (runningUrl) {
        console.log(`才证 演示已重新准备：${runningUrl}`);
        if (shouldOpen) {
          const openedWithEdge = openBrowser(withFreshDemoParam(runningUrl), {
            preferEdge: process.argv.includes("--open-edge"),
          });
          if (openedWithEdge) console.log("已使用 Microsoft Edge 打开全新首次访问页面。");
        }
        return;
      }
    }
    await ensureVectorService();
    const { url, lanUrl, llmClient } = await startServer({
      host: phoneDemo ? "0.0.0.0" : undefined,
    });
      console.log(`才证 招聘决策台已启动：${url}`);
      console.log(llmClient?.configured
        ? `LLM 已接入：${llmClient.model}`
        : "LLM 未配置，当前使用本地关键词基线");
      console.log("数据仅保存在本机 data/state.json；按 Ctrl+C 停止。");
      if (phoneDemo) {
        console.log(`手机接听局域网地址：${lanUrl}`);
        phoneTunnelPromise = startPhoneQuickTunnel(url);
      }
      if (shouldOpen && process.platform === "win32") {
        const targetUrl = freshDemo ? withFreshDemoParam(url) : url;
        const openedWithEdge = openBrowser(targetUrl, {
          preferEdge: process.argv.includes("--open-edge"),
        });
        if (openedWithEdge) console.log("已使用 Microsoft Edge 打开。");
      }
  };
  run().catch((error) => {
      if (error.code === "HIREPROOF_ALREADY_RUNNING") {
        console.log(`才证 已在运行${error.url ? `：${error.url}` : ""}，本实例不会再次写入数据。`);
        if (error.url && (process.argv.includes("--open") || process.argv.includes("--open-edge"))) {
          openBrowser(process.argv.includes("--fresh-demo") ? withFreshDemoParam(error.url) : error.url, {
            preferEdge: process.argv.includes("--open-edge"),
          });
        }
        return;
      }
      console.error("启动失败：", error);
      process.exitCode = 1;
  });
}

module.exports = {
  acquireDataLock,
  buildCsv,
  createJob,
  createRequestHandler,
  csvEscape,
  importCandidates,
  findEdgeExecutable,
  listenWithFallback,
  openBrowser,
  prepareCriteria,
  publicState,
  resetDemoWorkspace,
  startServer,
  updateCandidate,
  updateJob,
};
