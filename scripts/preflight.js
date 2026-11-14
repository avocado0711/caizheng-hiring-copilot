"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { extractResumeFile, parseResumeText } = require("../lib/resume");
const { resolvePythonRuntime } = require("../lib/python");
const { loadEnvFile } = require("../lib/env");

const ROOT = path.resolve(__dirname, "..");
loadEnvFile(path.join(ROOT, ".env"));
const statePath = path.join(ROOT, "data", "state.json");
const adapterPath = path.join(ROOT, "models", "hireproof-embedding-lora-v4", "adapter", "adapter_model.safetensors");
const indexPath = path.join(ROOT, "embedding_index", "manifest.json");
const ocrScriptPath = path.join(ROOT, "scripts", "ocr-image.ps1");
const errors = [];
const warnings = [];
const checks = [];

function pass(message) {
  checks.push(`PASS ${message}`);
}

function warn(message) {
  warnings.push(message);
  checks.push(`WARN ${message}`);
}

function fail(message) {
  errors.push(message);
  checks.push(`FAIL ${message}`);
}

async function checkServer() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch("http://127.0.0.1:3030/api/health", {
      signal: controller.signal,
    });
    if (response.ok) pass("本地服务已在 127.0.0.1:3030 运行");
    else warn(`3030 端口有响应，但健康检查返回 ${response.status}`);
  } catch {
    pass("3030 端口当前空闲，可直接启动");
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major >= 20) pass(`Node.js ${process.versions.node}`);
  else fail(`Node.js 版本过低：${process.versions.node}，需要 >= 20`);

  if (!fs.existsSync(statePath)) {
    fail("缺少 data/state.json，请先运行 npm run demo:seed");
  } else {
    try {
      const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
      const activeJob = state.jobs?.find((job) => job.id === state.activeJobId);
      const candidates = state.candidates || [];
      if (activeJob) pass(`演示岗位：${activeJob.title}`);
      else fail("没有激活的演示岗位");
      if (candidates.length >= 3 && candidates.length <= 5) pass(`候选人数：${candidates.length}`);
      else fail(`演示候选人数应为 3–5，当前为 ${candidates.length}`);
      const blocked = candidates.filter((candidate) =>
        ["pending", "processing", "error", "stale"].includes(candidate.aiStatus));
      if (blocked.length) warn(`${blocked.length} 位候选人 AI 状态不是稳定完成态`);
      else pass("所有候选人 AI 状态稳定");
      const reviewed = candidates.filter((candidate) => candidate.reviewStatus !== "unreviewed").length;
      if (reviewed >= 2) pass(`已完成人工审核：${reviewed} 位`);
      else warn("建议至少完成 3 位候选人的演示审核结果");
      const oldBrand = JSON.stringify(state).match(/\bTTC\b/i);
      if (oldBrand) warn("演示数据仍包含旧品牌字符串");
      else pass("演示数据未包含旧品牌");
      const withAudit = candidates.filter((candidate) => Array.isArray(candidate.auditHistory)).length;
      if (withAudit === candidates.length) pass("候选人审计历史完整");
      else warn(`${candidates.length - withAudit} 位候选人缺少审计历史`);
    } catch (error) {
      fail(`data/state.json 无法解析：${error.message}`);
    }
  }

  if (fs.existsSync(adapterPath)) pass("LoRA adapter 可用");
  else warn("未找到 LoRA adapter，将只能使用 BM25 或基础模型");
  if (fs.existsSync(indexPath)) pass("向量索引 manifest 可用");
  else warn("未找到向量索引，将使用 BM25");
  const modelBytes = fs.existsSync(path.join(ROOT, "models"))
    ? (function walk(directory) {
        return fs.readdirSync(directory, { withFileTypes: true }).reduce((sum, entry) => {
          const target = path.join(directory, entry.name);
          return sum + (entry.isDirectory() ? walk(target) : fs.statSync(target).size);
        }, 0);
      })(path.join(ROOT, "models"))
    : 0;
  if (modelBytes < 20 * 1024 * 1024) pass(`模型制品体积：${(modelBytes / 1024 / 1024).toFixed(2)} MB`);
  else warn(`模型制品体积偏大：${(modelBytes / 1024 / 1024).toFixed(1)} MB`);

  if (fs.existsSync(ocrScriptPath)) pass("Windows OCR 脚本可用");
  else warn("未找到 OCR 脚本，图片简历将无法解析");

  const envPath = path.join(ROOT, ".env");
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, "utf8");
    const configured = ["LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL"].filter((key) =>
      new RegExp(`^${key}=.+`, "m").test(env));
    if (configured.length === 3) pass("外部 LLM 配置完整");
    else if (configured.length === 0) warn("外部 LLM 未配置，将使用规则基线");
    else fail(`外部 LLM 配置不完整：缺少 ${["LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL"].filter((key) => !configured.includes(key)).join("、")}`);
  } else {
    warn("未找到 .env，将使用规则基线");
  }

  const python = resolvePythonRuntime();
  const pythonResult = spawnSync(
    python.command,
    [...python.args, "--version"],
    { encoding: "utf8" },
  );
  if (pythonResult.status === 0) {
    const version = (pythonResult.stdout || pythonResult.stderr).trim();
    pass(`Python 可用：${version}（${python.sourceLabel}，${python.command}）`);
    const dependencyResult = spawnSync(
      python.command,
      [
        ...python.args,
        "-c",
        "import importlib.util; names=['numpy','torch','transformers','sentence_transformers','peft','pypdfium2','rapidocr_onnxruntime','cv2','onnxruntime']; missing=[name for name in names if importlib.util.find_spec(name) is None]; print('ok' if not missing else ','.join(missing))",
      ],
      { encoding: "utf8" },
    );
    const dependencyStatus = (dependencyResult.stdout || "").trim();
    if (dependencyResult.status === 0 && dependencyStatus === "ok") {
      pass("本地向量依赖完整");
    } else {
      warn(`Python 缺少本地向量依赖：${dependencyStatus || (dependencyResult.stderr || "未知错误").trim()}`);
    }
  } else {
    warn(`未找到可运行的 Python，当前使用 ${python.sourceLabel}；请设置 HIREPROOF_PYTHON 或安装 Python 3.12`);
  }

  const parsed = parseResumeText("测试候选人\n5 年工作经验\nPython FastAPI RAG", { fileName: "preflight.txt" });
  if (parsed.yearsExperience === 5 || parsed.skills.includes("Python")) pass("简历规则解析冒烟测试通过");
  else fail("简历规则解析冒烟测试失败");

  const ocrSamplePath = path.join(ROOT, "sample-resumes", "preview-01.png");
  if (process.platform === "win32" && fs.existsSync(ocrSamplePath)) {
    try {
      const sample = fs.readFileSync(ocrSamplePath);
      const extracted = await extractResumeFile({
        name: "preflight-preview.png",
        type: "image/png",
        data: sample.toString("base64"),
      });
      if (extracted.method === "windows-ocr" && extracted.text.length >= 120) {
        warn(`RapidOCR 不可用，Windows OCR 冒烟测试通过：${extracted.text.length} 字`);
      } else if (extracted.text.length >= 120) {
        pass(`OCR 冒烟测试通过：${extracted.ocr?.engine || extracted.method}，${extracted.text.length} 字，质量 ${extracted.extractionQuality.score}/100`);
      } else {
        warn("OCR 返回文字过少");
      }
    } catch (error) {
      warn(`OCR 冒烟测试失败：${error.message}`);
    }
  }

  await checkServer();
  console.log(checks.join("\n"));
  console.log(`\n结果：${errors.length ? "未通过" : "通过"}；错误 ${errors.length}，警告 ${warnings.length}`);
  if (errors.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
