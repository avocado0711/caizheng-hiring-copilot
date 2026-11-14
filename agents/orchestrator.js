"use strict";

const {
  cleanText,
  criteriaSignature,
} = require("../lib/screening");
const {
  sumUsage,
  verifyAiAnalysis,
} = require("../lib/evidence");
const resumeStructure = require("./简历结构化Agent/简历结构化Agent");
const evidenceMatching = require("./岗位证据匹配Agent/岗位证据匹配Agent");
const evidenceAudit = require("./证据审计Agent/证据审计Agent");
const candidateSummary = require("./候选人摘要Agent/候选人摘要Agent");

const AGENT_PIPELINE_VERSION = 2;
const AGENTS = [resumeStructure, evidenceMatching, evidenceAudit, candidateSummary];
const AGENT_DEFINITIONS = Object.freeze(AGENTS.map((agent) => ({ ...agent.metadata })));

function createAgentTrace() {
  return AGENT_DEFINITIONS.map((agent) => ({
    ...agent,
    status: "queued",
    durationMs: null,
    error: "",
  }));
}

async function runTraceStage(trace, id, runner, onUpdate = null) {
  const stage = trace.find((item) => item.id === id);
  stage.status = "running";
  stage.startedAt = new Date().toISOString();
  onUpdate?.({ currentStage: id, trace });
  const started = Date.now();
  try {
    const result = await runner();
    stage.status = "completed";
    stage.durationMs = Date.now() - started;
    stage.finishedAt = new Date().toISOString();
    onUpdate?.({ currentStage: id, trace });
    return { ok: true, result };
  } catch (error) {
    stage.status = "failed";
    stage.durationMs = Date.now() - started;
    stage.finishedAt = new Date().toISOString();
    stage.error = cleanText(error.message || "Agent 执行失败").slice(0, 300);
    onUpdate?.({ currentStage: id, trace });
    return { ok: false, error };
  }
}

async function runScreeningAgents({
  llmClient,
  candidate,
  criteria,
  deterministicProfile = {},
  onUpdate = null,
}) {
  if (!llmClient?.configured) {
    return {
      skipped: true,
      trace: createAgentTrace(),
      error: "LLM 未配置",
    };
  }

  const trace = createAgentTrace();
  const usages = [];
  let model = llmClient.model;
  let profile = resumeStructure.normalizeProfile({}, deterministicProfile);
  onUpdate?.({ currentStage: "queued", trace });

  const structureStage = await runTraceStage(
    trace,
    "structure",
    () => resumeStructure.run({ llmClient, candidate }),
    onUpdate,
  );
  if (structureStage.ok) {
    profile = resumeStructure.normalizeProfile(
      structureStage.result.data?.profile,
      deterministicProfile,
    );
    usages.push(structureStage.result.usage);
    model = structureStage.result.model || model;
  } else {
    trace.find((item) => item.id === "structure").status = "fallback";
    onUpdate?.({ currentStage: "structure", trace });
  }

  const evidenceStage = await runTraceStage(
    trace,
    "evidence",
    () => evidenceMatching.run({ llmClient, candidate, criteria, profile }),
    onUpdate,
  );
  if (!evidenceStage.ok) {
    return {
      skipped: false,
      failed: true,
      error: evidenceStage.error,
      trace,
      profile,
      model,
      usage: sumUsage(usages),
    };
  }
  usages.push(evidenceStage.result.usage);
  model = evidenceStage.result.model || model;

  const verified = verifyAiAnalysis({
    summary: "",
    criteria: evidenceStage.result.data?.criteria || [],
  }, candidate, criteria);

  const auditStage = await runTraceStage(
    trace,
    "audit",
    () => evidenceAudit.run({ candidate, criteria, verified, profile }),
    onUpdate,
  );
  const audit = auditStage.ok
    ? auditStage.result
    : {
        status: "attention",
        issues: ["证据审计 Agent 执行失败"],
        verifiedCount: 0,
        rejectedCount: 0,
      };
  if (!auditStage.ok) {
    trace.find((item) => item.id === "audit").status = "fallback";
    onUpdate?.({ currentStage: "audit", trace });
  }

  let summary = "";
  const matchedCount = verified.criteria.filter(
    (item) => item.verification === "verified" && item.level !== "none",
  ).length;
  if (matchedCount) {
    const summaryStage = await runTraceStage(
      trace,
      "summary",
      () => candidateSummary.run({
        llmClient,
        candidate,
        profile,
        criteria: verified.criteria,
      }),
      onUpdate,
    );
    if (summaryStage.ok) {
      summary = cleanText(summaryStage.result.data?.summary || "").slice(0, 500);
      usages.push(summaryStage.result.usage);
      model = summaryStage.result.model || model;
    } else {
      trace.find((item) => item.id === "summary").status = "fallback";
      onUpdate?.({ currentStage: "summary", trace });
    }
  } else {
    trace.find((item) => item.id === "summary").status = "skipped";
    onUpdate?.({ currentStage: "summary", trace });
  }

  return {
    skipped: false,
    failed: false,
    profile,
    criteria: verified.criteria,
    summary,
    audit,
    workHistory: structureStage.ok
      ? (structureStage.result.data?.workHistory || [])
      : [],
    structureNotes: structureStage.ok
      ? (structureStage.result.data?.notes || [])
      : [],
    trace,
    model,
    usage: sumUsage(usages),
    criteriaSignature: criteriaSignature(criteria),
  };
}

module.exports = {
  AGENT_DEFINITIONS,
  AGENT_PIPELINE_VERSION,
  createAgentTrace,
  runScreeningAgents,
};
