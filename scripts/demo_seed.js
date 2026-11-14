"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { acquireDataLock, startServer } = require("../server");
const {
  DEMO_DECISIONS,
  DEMO_JOB_CARDS,
  DEMO_RESUMES,
  toDemoFilePayload,
} = require("../lib/demo");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const TARGET = path.join(DATA_DIR, "state.json");

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `请求失败：${response.status}`);
  return body;
}

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hireproof-demo-"));
  let app;
  try {
    let vectorServiceUrl = null;
    try {
      const health = await fetch("http://127.0.0.1:3041/health", {
        signal: AbortSignal.timeout(1200),
      });
      if (health.ok) vectorServiceUrl = "http://127.0.0.1:3041";
    } catch {
      // Demo generation still works with BM25 only.
    }
    app = await startServer({
      port: 0,
      dataDir: tempDir,
      llmClient: null,
      vectorServiceUrl,
    });
    const [primaryJobCard, ...additionalJobCards] = DEMO_JOB_CARDS;
    for (const card of [...additionalJobCards].reverse()) {
      await request(`${app.url}/api/jobs`, {
        method: "POST",
        body: JSON.stringify(card),
      });
    }
    const jobResult = await request(`${app.url}/api/jobs`, {
      method: "POST",
      body: JSON.stringify(primaryJobCard),
    });
    const jobId = jobResult.job.id;
    await request(`${app.url}/api/jobs/${encodeURIComponent(jobId)}/candidates/import`, {
      method: "POST",
      body: JSON.stringify({ files: DEMO_RESUMES.map(toDemoFilePayload) }),
    });
    const state = await request(`${app.url}/api/state`);
    const byFile = new Map(state.candidates.map((candidate) => [candidate.fileName, candidate]));
    for (const decision of DEMO_DECISIONS) {
      const candidate = byFile.get(decision.fileName);
      if (!candidate) continue;
      await request(`${app.url}/api/jobs/${encodeURIComponent(jobId)}/candidates/${encodeURIComponent(candidate.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          reviewer: "演示 HR",
          reviewStatus: decision.reviewStatus,
          reviewNote: decision.reviewNote,
          overrides: decision.overrides,
        }),
      });
    }
    if (vectorServiceUrl) {
      await request(`${app.url}/api/knowledge/reindex`, {
        method: "POST",
        body: JSON.stringify({ documentType: "resume-screening" }),
      });
    }

    fs.mkdirSync(DATA_DIR, { recursive: true });
    let targetLock;
    try {
      targetLock = acquireDataLock(DATA_DIR);
    } catch (error) {
      if (error.code !== "HIREPROOF_ALREADY_RUNNING") throw error;
      const runningUrl = error.url || "http://127.0.0.1:3030";
      await request(`${runningUrl}/api/demo/reset`, {
        method: "POST",
        body: "{}",
      });
      console.log(`检测到才证服务正在运行，已通过接口重置演示数据：${runningUrl}`);
      return;
    }
    try {
      if (fs.existsSync(TARGET)) {
        const backupDir = path.join(DATA_DIR, "backups");
        fs.mkdirSync(backupDir, { recursive: true });
        const backup = path.join(
          backupDir,
          `state-before-demo-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
        );
        fs.copyFileSync(TARGET, backup);
        console.log(`已备份原数据：${backup}`);
      }
      const generated = path.join(tempDir, "state.json");
      const tempTarget = `${TARGET}.${process.pid}.tmp`;
      fs.copyFileSync(generated, tempTarget);
      fs.renameSync(tempTarget, TARGET);
      console.log(`演示数据已生成：${DEMO_JOB_CARDS.length} 个岗位评价卡、4 位候选人，规则基线稳定可复现。`);
    } finally {
      targetLock.release();
    }
  } finally {
    if (app) await app.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
