"use strict";

const state = {
  data: null,
  editingJobId: null,
  criteria: [],
  pendingFiles: [],
  currentView: "job",
  resultView: "ranking",
  drawerCandidateId: null,
  drawerReturnCandidateId: null,
  drawerReturnFocusElement: null,
  resumePreviewCandidateId: null,
  resumePreviewReturnFocusElement: null,
  resumePreviewText: "",
  jobDirty: false,
  isNewJob: false,
  isImporting: false,
  importCancelled: false,
  importController: null,
  stateRequestRevision: 0,
};

const LEVEL_OPTIONS = [
  ["strong", "强"],
  ["medium", "中"],
  ["weak", "弱"],
  ["none", "未提及"],
];

const STATUS_LABELS = {
  unreviewed: "待审核",
  shortlist: "短名单",
  discuss: "待讨论",
  reject: "不通过",
};

const AGENT_STATUS_LABELS = {
  queued: "排队",
  running: "执行中",
  completed: "完成",
  fallback: "已回退",
  failed: "失败",
  skipped: "跳过",
};

const AUDIT_ACTION_LABELS = {
  candidate_imported: "导入候选人",
  ai_analysis_started: "开始 AI 分析",
  ai_analysis_completed: "AI 分析完成",
  ai_analysis_failed: "AI 分析失败",
  criteria_changed: "评价标准变更",
  human_review_updated: "人工审核更新",
  web_interview_completed: "完成网页 AI 初筛",
  web_interview_declined: "拒绝网页 AI 初筛",
  web_interview_follow_up: "网页 AI 初筛待随访",
};

const TOUR_STEPS = [
  {
    view: "job",
    selector: "#job-switcher",
    title: "从一个岗位开始",
    copy: "右上角是当前工作区。每个岗位拥有独立的评价卡、候选人和排序结果，切换岗位不会混淆数据。",
  },
  {
    view: "job",
    selector: "#job-description",
    title: "先把标准说清楚",
    copy: "粘贴 JD 后，可以让评价卡 Agent 生成建议。关键词、权重和硬性条件最终由你确认，所有人随后都使用同一套标准。",
  },
  {
    view: "import",
    selector: "#drop-zone",
    title: "批量导入，自动留痕",
    copy: "拖入 PDF、DOCX、文本或图片即可。系统会提取原文、识别重复简历，并把每个结论定位到具体行。",
  },
  {
    view: "knowledge",
    selector: "#knowledge-search-input",
    title: "让判断有来源可循",
    copy: "公开知识库可以检索公司、团队、论文、专利和岗位标准。所有结果都会显示来源、日期和虚构演示标记。",
  },
  {
    view: "review",
    selector: "#view-review .metric-grid",
    title: "先过硬门槛，再看匹配度",
    copy: "排序会先检查硬性条件，再比较匹配分。点击任意候选人，可以查看原文证据、Agent 审计结果并人工覆盖等级。",
  },
  {
    view: "interview",
    selector: "#interview-candidate-select",
    title: "让 AI 先完成网页初筛",
    copy: "选择候选人并确认授权后，浏览器会朗读基于证据缺口生成的问题。音频不离开浏览器，只保存候选人同意后的转写文字。",
  },
  {
    view: "review",
    selector: "#help-button",
    title: "随时重新了解",
    copy: "再次点击右上角问号即可播放这次引导。模型 Agent 只负责结构化、匹配、审计和摘要，最终录用判断始终由 HR 完成。",
  },
];

const tourState = {
  active: false,
  index: 0,
  returnView: "job",
  requestId: 0,
};

const HELP_TOUR_STORAGE_KEY = "caizheng.help-tour.v2.completed";
const INTRO_STORAGE_KEY = "caizheng.intro.v2.completed";

let aiPollTimer = null;

const introState = {
  active: false,
  revealing: false,
  resolve: null,
  revealTimer: null,
  finishTimer: null,
};

const webInterview = {
  status: "idle",
  candidateId: null,
  plan: null,
  planLoading: false,
  dialog: [],
  turnIndex: 0,
  transcript: [],
  answers: [],
  startedAt: null,
  endedAt: null,
  timer: null,
  recognition: null,
  listening: false,
  speaking: false,
  consentDeclined: false,
  consentConfirmed: false,
};

const phonePairing = {
  active: false,
  sessionId: "",
  token: "",
  candidateId: "",
  phoneUrl: "",
  status: "idle",
  pollTimer: null,
  lastEventSeq: 0,
  savingReport: false,
  returnFocusElement: null,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "时间未知";
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `请求失败（${response.status}）`);
  return data;
}

let toastTimer = null;

function toast(message, isError = false) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.toggle("is-error", isError);
  element.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("is-visible"), 3600);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function getFocusableElements(container) {
  return $$(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    container,
  ).filter((element) => element.getClientRects().length > 0);
}

function trapFocus(event, container) {
  if (event.key !== "Tab") return false;
  const focusable = getFocusableElements(container);
  if (!focusable.length) {
    event.preventDefault();
    container.focus?.({ preventScroll: true });
    return true;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) {
    event.preventDefault();
    first.focus();
  }
  return true;
}

function setAppInert(inert) {
  const appShell = $(".app-shell");
  if (appShell) appShell.inert = inert;
}

function hasCompletedIntro() {
  try {
    return window.localStorage.getItem(INTRO_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function markIntroCompleted() {
  try {
    window.localStorage.setItem(INTRO_STORAGE_KEY, "true");
  } catch {
    // The site remains usable when browser storage is unavailable.
  }
}

function finishIntroSequence() {
  if (!introState.active) return;
  introState.active = false;
  introState.revealing = false;
  clearTimeout(introState.revealTimer);
  clearTimeout(introState.finishTimer);
  markIntroCompleted();
  $("#intro-sequence").hidden = true;
  document.body.classList.remove("is-intro", "is-intro-visible", "is-intro-revealing");
  setAppInert(false);
  const resolve = introState.resolve;
  introState.resolve = null;
  resolve?.();
}

function revealIntroSequence() {
  if (!introState.active || introState.revealing) return;
  introState.revealing = true;
  clearTimeout(introState.revealTimer);
  clearTimeout(introState.finishTimer);
  document.body.classList.add("is-intro-revealing");
  introState.finishTimer = setTimeout(
    finishIntroSequence,
    900,
  );
}

function playIntroSequence({ force = false } = {}) {
  if (!force && hasCompletedIntro()) return Promise.resolve();
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    markIntroCompleted();
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    introState.active = true;
    introState.revealing = false;
    introState.resolve = resolve;
    $("#intro-sequence").hidden = false;
    document.body.classList.add("is-intro");
    setAppInert(true);
    requestAnimationFrame(() => {
      if (!introState.active) return;
      document.body.classList.add("is-intro-visible");
      $("#intro-skip").focus({ preventScroll: true });
    });
    introState.revealTimer = setTimeout(revealIntroSequence, 1450);
    introState.finishTimer = setTimeout(finishIntroSequence, 2350);
  });
}

function positionTour(rect) {
  const spotlight = $("#tour-spotlight");
  const card = $("#tour-card");
  const padding = 7;
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight;
  const left = clamp(rect.left - padding, 8, viewportWidth - 18);
  const top = clamp(rect.top - padding, 8, viewportHeight - 18);
  const width = Math.max(28, Math.min(rect.width + padding * 2, viewportWidth - left - 8));
  const height = Math.max(28, Math.min(rect.height + padding * 2, viewportHeight - top - 8));

  spotlight.style.left = `${left}px`;
  spotlight.style.top = `${top}px`;
  spotlight.style.width = `${width}px`;
  spotlight.style.height = `${height}px`;

  if (viewportWidth <= 640) {
    card.style.left = "12px";
    card.style.right = "12px";
    card.style.top = "auto";
    card.style.bottom = "12px";
    return;
  }

  const cardWidth = Math.min(390, viewportWidth - 32);
  card.style.width = `${cardWidth}px`;
  card.style.left = `${clamp(rect.left + rect.width / 2 - cardWidth / 2, 16, viewportWidth - cardWidth - 16)}px`;
  const cardHeight = card.offsetHeight || 250;
  const below = top + height + 18;
  const above = top - cardHeight - 18;
  card.style.top = `${below + cardHeight < viewportHeight - 16 ? below : Math.max(16, above)}px`;
  card.style.bottom = "auto";
}

async function showTourStep(index, { initial = false } = {}) {
  const step = TOUR_STEPS[index];
  if (!step) return closeHelpTour();
  tourState.index = index;
  const requestId = ++tourState.requestId;

  if (step.view && state.currentView !== step.view) {
    switchView(step.view, false);
  }

  $("#tour-step-label").textContent = `${String(index + 1).padStart(2, "0")} / ${String(TOUR_STEPS.length).padStart(2, "0")}`;
  $("#tour-title").textContent = step.title;
  $("#tour-copy").textContent = step.copy;
  $("#tour-progress").innerHTML = TOUR_STEPS.map(
    (_, dotIndex) => `<span class="${dotIndex === index ? "is-current" : ""}"></span>`,
  ).join("");
  $("#tour-prev-button").disabled = index === 0;
  $("#tour-next-button").textContent = index === TOUR_STEPS.length - 1 ? "开始使用" : "下一步";

  await nextFrame();
  if (!tourState.active || requestId !== tourState.requestId) return;

  let target = $(step.selector);
  if (!target || target.getClientRects().length === 0) {
    target = $(`#view-${step.view} .card`) || $("#help-button");
  }
  if (initial) {
    target.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
  } else {
    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    await new Promise((resolve) => setTimeout(resolve, 380));
    if (!tourState.active || requestId !== tourState.requestId) return;
  }

  const rect = target.getBoundingClientRect();
  const layer = $("#tour-layer");
  if (initial) {
    layer.hidden = false;
    layer.style.visibility = "hidden";
    positionTour(rect);
    layer.style.visibility = "";
  } else {
    positionTour(rect);
  }
  $("#tour-next-button").focus({ preventScroll: true });
}

function startHelpTour() {
  if (tourState.active) return;
  if ($("#candidate-drawer").classList.contains("is-open")) closeDrawer();
  tourState.active = true;
  tourState.returnView = state.currentView;
  tourState.index = 0;
  $("#help-button").setAttribute("aria-expanded", "true");
  document.body.classList.add("is-touring");
  setAppInert(true);
  showTourStep(0, { initial: true });
}

function hasCompletedHelpTour() {
  try {
    return window.localStorage.getItem(HELP_TOUR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function markHelpTourCompleted() {
  try {
    window.localStorage.setItem(HELP_TOUR_STORAGE_KEY, "true");
  } catch {
    // The guided tour still works when storage is unavailable.
  }
}

function closeHelpTour() {
  if (!tourState.active) return;
  markHelpTourCompleted();
  const returnView = tourState.returnView;
  tourState.active = false;
  tourState.requestId += 1;
  $("#tour-layer").hidden = true;
  $("#tour-layer").style.visibility = "";
  $("#tour-spotlight").removeAttribute("style");
  $("#tour-card").removeAttribute("style");
  $("#help-button").setAttribute("aria-expanded", "false");
  document.body.classList.remove("is-touring");
  setAppInert(false);
  if (["job", "import", "knowledge", "review", "interview"].includes(returnView)) switchView(returnView, false);
  $("#help-button").focus({ preventScroll: true });
}

function moveTour(direction) {
  const nextIndex = tourState.index + direction;
  if (nextIndex < 0) return;
  if (nextIndex >= TOUR_STEPS.length) {
    closeHelpTour();
    return;
  }
  showTourStep(nextIndex);
}

function currentJob() {
  if (!state.data || !state.editingJobId) return null;
  return state.data.jobs.find((job) => job.id === state.editingJobId) || null;
}

function activeImportedCandidates() {
  if (!state.editingJobId) return [];
  return (state.data?.candidates || []).filter(
    (candidate) => candidate.jobId === state.editingJobId,
  );
}

function applyStateSnapshot(data, { preserveDraft = false } = {}) {
  state.data = data;
  const previousJobId = state.editingJobId;
  const currentExists = state.data.jobs.some((job) => job.id === previousJobId);
  state.editingJobId = currentExists
    ? previousJobId
    : (state.data.activeJobId || state.data.jobs[0]?.id || null);
  state.isNewJob = !state.editingJobId;
  render();
  if (!preserveDraft) {
    loadCurrentJobIntoForm();
  }
  scheduleAiPolling();
}

async function loadState({ preserveDraft = false } = {}) {
  const revision = ++state.stateRequestRevision;
  const data = await api("/api/state");
  if (revision !== state.stateRequestRevision) return false;
  applyStateSnapshot(data, { preserveDraft });
  return true;
}

function invalidateStateRefreshes() {
  state.stateRequestRevision += 1;
  clearTimeout(aiPollTimer);
  aiPollTimer = null;
}

function render() {
  renderJobSwitcher();
  renderCounters();
  renderAiStatus();
  renderJobPage();
  renderImportPage();
  renderKnowledgePage();
  renderReviewPage();
  renderInterviewPage();
  renderWorkflowGuide();
}

function renderAiStatus() {
  const chip = $("#ai-chip");
  const ai = state.data?.ai;
  if (ai?.configured) {
    chip.classList.remove("is-offline");
    chip.textContent = "AI · 4-Agent";
    chip.title = "模型 4-Agent 流水线：结构化、证据匹配、证据审计、摘要";
  } else {
    chip.classList.add("is-offline");
    chip.textContent = "规则基线";
    chip.title = "未配置模型，当前使用关键词证据匹配";
  }
}

function hasPendingAi() {
  return activeImportedCandidates().some(
    (candidate) => candidate.aiStatus === "pending" || candidate.aiStatus === "processing",
  );
}

function scheduleAiPolling() {
  clearTimeout(aiPollTimer);
  if (!state.data?.ai?.configured || !hasPendingAi()) return;
  aiPollTimer = setTimeout(async () => {
    const revision = state.stateRequestRevision;
    try {
      const data = await api("/api/state");
      if (revision !== state.stateRequestRevision) return;
      state.data = data;
      renderCounters();
      renderAiStatus();
      renderReviewPage();
      renderWorkflowGuide();
      if (state.drawerCandidateId && $("#candidate-drawer").classList.contains("is-open")) {
        const candidate = activeImportedCandidates().find((item) => item.id === state.drawerCandidateId);
        const active = document.activeElement;
        const editing = active?.closest?.("#candidate-drawer")
          && active.matches?.("input, textarea, select");
        if (candidate && !editing) {
          await openCandidate(candidate.id, { shell: false, quiet: true });
        }
      }
      scheduleAiPolling();
    } catch (error) {
      toast(`刷新模型分析结果失败：${error.message}`, true);
      aiPollTimer = setTimeout(scheduleAiPolling, 3000);
    }
  }, 2200);
}

function renderJobSwitcher() {
  const select = $("#job-switcher");
  const jobs = state.data?.jobs || [];
  if (!jobs.length) {
    select.innerHTML = '<option value="">尚未创建岗位</option>';
    select.disabled = true;
    return;
  }
  select.disabled = state.isImporting;
  select.innerHTML = jobs.map((job) => (
    `<option value="${escapeAttr(job.id)}" ${job.id === state.editingJobId ? "selected" : ""}>${escapeHtml(job.title)}</option>`
  )).join("");
}

function renderCounters() {
  const count = activeImportedCandidates().length;
  $("#nav-candidate-count").textContent = count;
  $("#criteria-nav-count").textContent = state.criteria.length || 0;
  $("#imported-count").textContent = count;
  $("#nav-knowledge-count").textContent = state.data?.knowledge?.documentCount || 0;
  $("#interview-nav-count").textContent = count;
  $("#interview-candidate-count").textContent = count;
}

function renderJobPage() {
  const job = currentJob();
  $("#job-form").hidden = !job && !state.isNewJob;
  $("#job-empty").hidden = Boolean(job) || state.isNewJob;
  $("#criteria-count").textContent = String(state.criteria.length || 0);
  if (!job) {
    $("#criteria-count").textContent = "0";
  }
}

function loadCurrentJobIntoForm() {
  const job = currentJob();
  if (!job) {
    $("#job-title").value = "";
    $("#job-description").value = "";
    state.criteria = [];
    renderCriteria();
    setJobDirty(false, "填写岗位名称开始");
    return;
  }
  $("#job-title").value = job.title || "";
  $("#job-description").value = job.description || "";
  state.criteria = (job.criteria || []).map((criterion) => ({ ...criterion, keywords: [...(criterion.keywords || [])] }));
  renderCriteria();
  setJobDirty(false);
}

function setJobDirty(dirty, messageText = "") {
  state.jobDirty = dirty;
  const message = $("#job-form-message");
  message.textContent = messageText || (dirty ? "有尚未保存的修改" : "评价卡已保存");
  $("#save-state").textContent = dirty ? "有未保存修改" : "数据保存在本机";
  renderWorkflowGuide();
}

function renderCriteria() {
  const list = $("#criteria-list");
  if (!state.criteria.length) {
    list.innerHTML = '<div class="evidence-empty">还没有评价项。从 JD 生成，或手动添加。</div>';
    updateWeightTotal();
    return;
  }
  list.innerHTML = state.criteria.map((criterion, index) => `
    <div class="criterion-row" data-index="${index}" data-id="${escapeAttr(criterion.id || "")}">
      <div class="criterion-name-wrap">
        <input class="criterion-name" type="text" maxlength="60" value="${escapeAttr(criterion.name || "")}" aria-label="评价项名称">
      </div>
      <input class="criterion-keywords keyword-input" type="text" value="${escapeAttr((criterion.keywords || []).join(", "))}" aria-label="证据关键词">
      <input class="criterion-weight small-input" type="number" min="0" max="100" step="1" value="${Number(criterion.weight) || 0}" aria-label="权重">
      <label class="check-wrap" title="设为硬性条件">
        <input class="criterion-required" type="checkbox" ${criterion.required ? "checked" : ""} aria-label="硬性条件">
      </label>
      <button type="button" class="remove-criterion" aria-label="删除评价项">×</button>
    </div>
  `).join("");
  updateWeightTotal();
}

function collectCriteriaFromForm() {
  return $$(".criterion-row", $("#criteria-list")).map((row) => ({
    id: row.dataset.id || `criterion-${crypto.randomUUID?.() || Date.now()}`,
    name: $(".criterion-name", row).value.trim(),
    keywords: $(".criterion-keywords", row).value
      .split(/[,，;；\n|/]+/)
      .map((item) => item.trim())
      .filter(Boolean),
    weight: Math.max(0, Math.min(100, Number($(".criterion-weight", row).value) || 0)),
    required: $(".criterion-required", row).checked,
    suggested: false,
  }));
}

function updateWeightTotal() {
  const rows = $$(".criterion-row", $("#criteria-list"));
  const total = rows.reduce((sum, row) => sum + (Number($(".criterion-weight", row)?.value) || 0), 0);
  $("#weight-total").textContent = String(total);
  $("#criteria-count").textContent = String(rows.length);
  $("#criteria-nav-count").textContent = String(rows.length);
}

function addCriterion(criterion = {}) {
  state.criteria = collectCriteriaFromForm();
  state.criteria.push({
    id: `criterion-${crypto.randomUUID?.() || Date.now()}`,
    name: criterion.name || "新评价项",
    keywords: criterion.keywords || [],
    weight: criterion.weight ?? 10,
    required: Boolean(criterion.required),
    suggested: false,
  });
  renderCriteria();
  setJobDirty(true);
}

async function saveJob(event) {
  event.preventDefault();
  const title = $("#job-title").value.trim();
  if (!title) {
    toast("请填写岗位名称", true);
    $("#job-title").focus();
    return;
  }
  const criteria = collectCriteriaFromForm().filter((criterion) => criterion.name);
  if (!criteria.length) {
    toast("至少保留一个评价项", true);
    return;
  }
  if (criteria.reduce((sum, criterion) => sum + criterion.weight, 0) <= 0) {
    toast("评价项权重总和必须大于 0", true);
    return;
  }
  const button = $("#save-job-button");
  button.disabled = true;
  button.textContent = "保存中…";
  try {
    const payload = {
      title,
      description: $("#job-description").value.trim(),
      criteria,
    };
    if (state.editingJobId) {
      await api(`/api/jobs/${encodeURIComponent(state.editingJobId)}`, {
        method: "PUT",
        body: JSON.stringify({ ...payload, activate: true }),
      });
    } else {
      const result = await api("/api/jobs", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      state.editingJobId = result.job.id;
      state.isNewJob = false;
    }
    await loadState();
    setJobDirty(false);
    toast("评价卡已保存，后续导入将使用这套标准");
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "保存评价卡";
  }
}

async function suggestCriteria() {
  const description = $("#job-description").value.trim();
  if (!description) {
    toast("请先粘贴岗位描述", true);
    $("#job-description").focus();
    return;
  }
  const button = $("#suggest-button");
  button.disabled = true;
  button.textContent = "生成中…";
  try {
    const result = await api("/api/jobs/suggest", {
      method: "POST",
      body: JSON.stringify({ description }),
    });
    state.criteria = result.criteria.map((criterion) => ({
      ...criterion,
      id: `criterion-${crypto.randomUUID?.() || Date.now() + Math.random()}`,
    }));
    renderCriteria();
    setJobDirty(true);
    if (result.warning) {
      toast(result.warning, true);
    } else {
      toast(result.source === "llm"
        ? `模型已结合 ${result.basisSourceIds?.length || 0} 条知识来源生成评价项`
        : "已生成规则版评价项，请确认关键词和权重后保存");
    }
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "从 JD 生成评价项";
  }
}

function startNewJob() {
  if (state.isImporting) {
    toast("简历正在导入，请完成或取消后再新建岗位", true);
    return;
  }
  const alreadyBlank = !currentJob()
    && state.isNewJob
    && !$("#job-title").value.trim()
    && !$("#job-description").value.trim()
    && state.criteria.length === 0;
  if (alreadyBlank) {
    switchView("job");
    $("#job-title").focus();
    toast("已经是新建岗位，请填写岗位名称");
    return;
  }
  if (state.jobDirty && !window.confirm("当前评价卡还有未保存修改。新建岗位会丢弃这些修改，是否继续？")) {
    return;
  }
  state.editingJobId = null;
  state.isNewJob = true;
  state.criteria = [];
  $("#job-title").value = "";
  $("#job-description").value = "";
  renderJobSwitcher();
  renderJobPage();
  renderCriteria();
  setJobDirty(false, "填写岗位名称开始");
  switchView("job");
  $("#job-title").focus();
  toast("已新建空白岗位，请填写岗位信息");
}

async function switchJob(jobId) {
  if (!jobId || jobId === state.editingJobId) return;
  if (state.isImporting) {
    renderJobSwitcher();
    toast("简历正在导入，暂不能切换岗位", true);
    return;
  }
  if (state.jobDirty && !window.confirm("当前评价卡还有未保存修改。切换岗位会丢弃这些修改，是否继续？")) {
    renderJobSwitcher();
    return;
  }
  try {
    await api(`/api/jobs/${encodeURIComponent(jobId)}/activate`, {
      method: "POST",
      body: "{}",
    });
    state.editingJobId = jobId;
    state.isNewJob = false;
    state.data.activeJobId = jobId;
    await loadState();
  } catch (error) {
    toast(error.message, true);
  }
}

function switchView(view, updateHash = true) {
  if (!["job", "import", "knowledge", "review", "interview"].includes(view)) return;
  if (
    state.currentView === "interview"
    && view !== "interview"
    && ["dialing", "connected", "listening", "speaking"].includes(webInterview.status)
    && !window.confirm("当前网页初筛尚未结束，离开会结束并保存已有回答。是否继续？")
  ) return;
  if (
    state.currentView === "interview"
    && view !== "interview"
    && webInterview.startedAt
    && !webInterview.endedAt
  ) {
    finishWebInterview({ reason: "navigation" });
  }
  state.currentView = view;
  $$(".view").forEach((element) => element.classList.toggle("is-active", element.id === `view-${view}`));
  $$(".nav-item").forEach((element) => element.classList.toggle("is-active", element.dataset.view === view));
  const stageByView = { job: 0, import: 1, knowledge: 2, review: 3, interview: 3 };
  const currentStage = stageByView[view] ?? 0;
  $$(".system-pipeline [data-stage]").forEach((element) => {
    const stage = Number(element.dataset.stage);
    element.classList.toggle("is-current", stage === currentStage);
    element.classList.toggle("is-done", stage < currentStage);
  });
  $$(".workspace-progress span").forEach((element, index) => {
    element.classList.toggle("is-active", index === currentStage);
  });
  if (updateHash && window.location.hash !== `#${view}`) {
    history.replaceState(null, "", `#${view}`);
  }
  if (view === "review") renderReviewPage();
  if (view === "knowledge") renderKnowledgePage();
  if (view === "interview") renderInterviewPage();
  renderWorkflowGuide();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

const PENDING_FILE_STATUS_LABELS = {
  queued: "等待解析",
  processing: "解析中",
  complete: "已完成",
  error: "解析失败",
};

function renderImportPage() {
  const list = $("#pending-files");
  const pendingBytes = state.pendingFiles.reduce((sum, item) => sum + item.file.size, 0);
  if (!state.pendingFiles.length) {
    list.innerHTML = '<li class="empty-line">还没有选择文件</li>';
  } else {
    list.innerHTML = state.pendingFiles.map((item, index) => {
      const status = item.status || "queued";
      return `
        <li class="pending-file-item is-${escapeAttr(status)}">
          <span>${escapeHtml(item.file.name)}</span>
          <small>
            ${formatBytes(item.file.size)}
            <b class="pending-file-status" title="${escapeAttr(item.error || "")}">${escapeHtml(PENDING_FILE_STATUS_LABELS[status] || status)}</b>
            ${state.isImporting ? "" : `<button type="button" class="text-button" data-remove-file="${index}">移除</button>`}
          </small>
        </li>
      `;
    }).join("");
  }
  const disabled = state.isImporting || !currentJob() || !state.pendingFiles.length;
  const importButton = $("#import-button");
  importButton.disabled = disabled;
  importButton.title = state.isImporting
    ? "简历正在解析，请等待当前批次完成"
    : !currentJob()
    ? "请先创建或选择岗位评价卡"
    : !state.pendingFiles.length
      ? "请先拖入或选择简历文件"
      : "开始解析简历并生成证据卡";
  $("#clear-files-button").disabled = state.isImporting;
  $("#paste-import-button").disabled = state.isImporting;
  $("#new-job-button").disabled = state.isImporting;
  $("#job-switcher").disabled = state.isImporting || !state.data?.jobs?.length;
  $("#import-limit-note").textContent = state.pendingFiles.length
    ? `已选择 ${state.pendingFiles.length} 份 · ${formatBytes(pendingBytes)}；请求会按 45 MB 自动拆批。`
    : "单份上限 15 MB；请求会按总大小自动拆批。";
}

function updateImportProgress(processed, total, detail, title = "正在生成候选人证据卡") {
  const panel = $("#import-progress-panel");
  panel.hidden = false;
  $("#import-progress-title").textContent = title;
  $("#import-progress-count").textContent = `${processed} / ${total}`;
  $("#import-progress-detail").textContent = detail;
  $("#import-progress-fill").style.width = `${total ? Math.round((processed / total) * 100) : 0}%`;
}

function resetImportProgress() {
  const panel = $("#import-progress-panel");
  panel.hidden = true;
  $("#import-progress-fill").style.width = "0%";
  $("#cancel-import-button").disabled = false;
  $("#cancel-import-button").textContent = "取消后续";
}

const KNOWLEDGE_TYPE_LABELS = {
  company: "公司",
  organization: "组织",
  "annual-report": "年报",
  technology: "技术资料",
  paper: "论文",
  patent: "专利",
  education: "教育背景",
  "role-standard": "岗位标准",
  "resume-screening": "简历样本",
};

function renderKnowledgePage() {
  const knowledge = state.data?.knowledge || {
    documentCount: 0,
    entityCount: 0,
    chunkCount: 0,
    syntheticCount: 0,
    documents: [],
  };
  $("#knowledge-doc-count").textContent = String(knowledge.documentCount || 0);
  $("#knowledge-metric-docs").textContent = String(knowledge.documentCount || 0);
  $("#knowledge-metric-entities").textContent = String(knowledge.entityCount || 0);
  $("#knowledge-metric-chunks").textContent = String(
    knowledge.vectorDocumentCount || knowledge.chunkCount || 0,
  );
  $("#knowledge-metric-synthetic").textContent = String(knowledge.syntheticCount || 0);

  const list = $("#knowledge-document-list");
  if (!knowledge.documents?.length) {
    list.innerHTML = '<div class="evidence-empty">知识库为空。可以添加公司、组织、论文或岗位标准资料。</div>';
    return;
  }
  list.innerHTML = knowledge.documents.map((document) => `
    <article class="knowledge-document">
      <div class="knowledge-document-head">
        <div>
          <strong>${escapeHtml(document.title)}</strong>
          <small>${escapeHtml(document.entityName || "未指定实体")} · ${escapeHtml(KNOWLEDGE_TYPE_LABELS[document.documentType] || document.documentType)}${document.publisher ? ` · ${escapeHtml(document.publisher)}` : ""}</small>
        </div>
        <button class="knowledge-delete" type="button" data-delete-knowledge="${escapeAttr(document.id)}" aria-label="删除知识文档">×</button>
      </div>
      <p>${escapeHtml(document.preview || "")}</p>
      <div class="knowledge-document-foot">
        <span class="knowledge-tag">${document.characterCount || 0} 字</span>
        ${document.publishedAt ? `<span class="knowledge-tag">${escapeHtml(document.publishedAt)}</span>` : ""}
        ${document.retrievedAt ? `<span class="knowledge-tag">抓取 ${escapeHtml(document.retrievedAt)}</span>` : ""}
        ${document.license ? `<span class="knowledge-tag" title="来源许可">${escapeHtml(document.license)}</span>` : ""}
        ${document.synthetic ? '<span class="knowledge-tag is-synthetic">虚构演示</span>' : '<span class="knowledge-tag">用户资料</span>'}
        ${safeExternalUrl(document.sourceUrl) ? `<a class="knowledge-source-link" href="${escapeAttr(safeExternalUrl(document.sourceUrl))}" target="_blank" rel="noreferrer">查看来源 ↗</a>` : ""}
      </div>
    </article>
  `).join("");
}

function renderKnowledgeSearchResults(results, mode = "bm25") {
  const container = $("#knowledge-search-results");
  if (!results.length) {
    container.innerHTML = '<div class="evidence-empty">没有检索到相关知识片段。</div>';
    return;
  }
  const modeLabel = mode === "hybrid-rerank"
    ? "BM25 + LoRA 向量 + RRF + Reranker"
    : mode === "hybrid-rrf"
      ? "BM25 + LoRA 向量 + RRF"
    : mode === "bm25-fallback"
      ? "BM25 回退（向量服务未就绪）"
      : "BM25 检索";
  container.innerHTML = `<div class="knowledge-result-meta"><span>${escapeHtml(modeLabel)}</span></div>` + results.map((result) => `
    <div class="knowledge-result">
      <div class="knowledge-result-head">
        <strong>${escapeHtml(result.title)}</strong>
        <span class="knowledge-result-score">相关度 ${Math.round(result.score * 100) / 100}</span>
      </div>
      <p>${escapeHtml(result.snippet)}</p>
      <div class="knowledge-result-meta">
        <span>${escapeHtml(result.entityName || "未指定实体")}</span>
        <span>${escapeHtml(result.sourceLabel || "未指定来源")}</span>
        ${result.publisher ? `<span>${escapeHtml(result.publisher)}</span>` : ""}
        ${result.publishedAt ? `<span>${escapeHtml(result.publishedAt)}</span>` : ""}
        ${result.retrievedAt ? `<span>抓取 ${escapeHtml(result.retrievedAt)}</span>` : ""}
        ${result.license ? `<span>许可：${escapeHtml(result.license)}</span>` : ""}
        ${result.synthetic ? "<span>虚构演示资料</span>" : ""}
        ${safeExternalUrl(result.sourceUrl) ? `<a href="${escapeAttr(safeExternalUrl(result.sourceUrl))}" target="_blank" rel="noreferrer">查看原文 ↗</a>` : ""}
      </div>
    </div>
  `).join("");
}

async function searchKnowledge() {
  const query = $("#knowledge-search-input").value.trim();
  if (!query) {
    toast("请输入要检索的问题", true);
    $("#knowledge-search-input").focus();
    return;
  }
  const button = $("#knowledge-search-button");
  button.disabled = true;
  button.textContent = "检索中…";
  try {
    const result = await api("/api/knowledge/search", {
      method: "POST",
      body: JSON.stringify({
        query,
        limit: 8,
        rerank: $("#knowledge-rerank-toggle").checked,
      }),
    });
    renderKnowledgeSearchResults(result.results || [], result.mode);
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "检索";
  }
}

async function addKnowledgeDocument() {
  const title = $("#knowledge-title").value.trim();
  const content = $("#knowledge-content").value.trim();
  if (!title || !content) {
    toast("请填写知识标题和正文", true);
    return;
  }
  const button = $("#add-knowledge-button");
  button.disabled = true;
  button.textContent = "添加中…";
  try {
    await api("/api/knowledge", {
      method: "POST",
      body: JSON.stringify({
        title,
        entityName: $("#knowledge-entity").value.trim(),
        documentType: $("#knowledge-type").value,
        sourceLabel: $("#knowledge-source").value.trim() || "用户导入资料",
        publisher: $("#knowledge-publisher").value.trim(),
        sourceUrl: $("#knowledge-source-url").value.trim(),
        publishedAt: $("#knowledge-date").value,
        retrievedAt: $("#knowledge-retrieved-date").value,
        synthetic: $("#knowledge-synthetic").checked,
        content,
        license: $("#knowledge-license").value.trim() || "未声明，使用前需确认授权",
      }),
    });
    $("#knowledge-title").value = "";
    $("#knowledge-entity").value = "";
    $("#knowledge-source").value = "";
    $("#knowledge-publisher").value = "";
    $("#knowledge-source-url").value = "";
    $("#knowledge-license").value = "";
    $("#knowledge-date").value = "";
    $("#knowledge-retrieved-date").value = "";
    $("#knowledge-content").value = "";
    await loadState({ preserveDraft: true });
    toast("知识资料已加入本地知识库");
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "添加到知识库";
  }
}

async function importKnowledgePack() {
  const input = $("#knowledge-pack-input");
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 25 * 1024 * 1024) {
    toast("知识资料包不能超过 25 MB", true);
    input.value = "";
    return;
  }
  const button = $("#import-knowledge-pack-button");
  button.disabled = true;
  button.textContent = "导入中…";
  try {
    const parsed = JSON.parse(await file.text());
    const documents = Array.isArray(parsed) ? parsed : parsed.documents;
    if (!Array.isArray(documents) || !documents.length) {
      throw new Error("资料包必须包含 documents 数组");
    }
    const result = await api("/api/knowledge/import", {
      method: "POST",
      body: JSON.stringify({ documents }),
    });
    await loadState({ preserveDraft: true });
    toast(`已导入 ${result.imported} 份公开资料来源`);
  } catch (error) {
    toast(`资料包导入失败：${error.message}`, true);
  } finally {
    input.value = "";
    button.disabled = false;
    button.textContent = "导入资料包";
  }
}

async function deleteKnowledgeDocument(documentId) {
  const document = state.data?.knowledge?.documents?.find((item) => item.id === documentId);
  if (!window.confirm(`确定删除“${document?.title || "该知识资料"}”吗？`)) return;
  try {
    await api(`/api/knowledge/${encodeURIComponent(documentId)}`, { method: "DELETE" });
    await loadState({ preserveDraft: true });
    toast("知识资料已删除");
  } catch (error) {
    toast(error.message, true);
  }
}

function addPendingFiles(files) {
  if (state.isImporting) {
    toast("当前批次仍在解析，请完成或取消后再添加文件", true);
    return { added: 0, rejected: 0 };
  }
  const accepted = [...files].filter((file) => file.size <= 15 * 1024 * 1024);
  const rejected = [...files].length - accepted.length;
  const beforeCount = state.pendingFiles.length;
  const existing = new Set(state.pendingFiles.map((item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`));
  for (const file of accepted) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (!existing.has(key)) {
      existing.add(key);
      state.pendingFiles.push({ file, status: "queued", error: "" });
    }
  }
  if (state.pendingFiles.length > 100) {
    state.pendingFiles = state.pendingFiles.slice(0, 100);
    toast("单次最多保留 100 份简历", true);
  } else if (rejected) {
    toast(`${rejected} 个文件超过 15 MB，已跳过`, true);
  }
  renderImportPage();
  return {
    added: state.pendingFiles.length - beforeCount,
    rejected,
  };
}

function hasDraggedFiles(event) {
  return Array.from(event.dataTransfer?.types || []).includes("Files");
}

function setFileDragActive(active) {
  document.body.classList.toggle("is-file-dragging", active);
  $("#drop-zone")?.classList.toggle("is-dragging", active);
}

function receiveDroppedFiles(fileList) {
  const files = [...(fileList || [])];
  if (!files.length) return;
  if (state.isImporting) {
    toast("当前批次仍在解析，请完成或取消后再添加文件", true);
    return;
  }
  if (state.currentView !== "import") switchView("import", false);
  const result = addPendingFiles(files);
  if (result.added > 0) {
    toast(currentJob()
      ? `已接收 ${result.added} 份简历，确认后开始解析`
      : `已接收 ${result.added} 份简历，请先创建或选择岗位`);
  } else if (!result.rejected) {
    toast("这些文件已经在待解析列表中");
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error(`无法读取 ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function prepareFilePayload(files) {
  return Promise.all(files.map(async (file) => ({
    name: file.name,
    type: file.type,
    data: await fileToBase64(file),
  })));
}

function buildImportBatches(items, maxBatchBytes = 45 * 1024 * 1024) {
  const batches = [];
  let current = [];
  let currentBytes = 0;
  for (const item of items) {
    const fileBytes = Number(item.file?.size) || 0;
    if (current.length && (current.length >= 4 || currentBytes + fileBytes > maxBatchBytes)) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(item);
    currentBytes += fileBytes;
  }
  if (current.length) batches.push(current);
  return batches;
}

function renderImportLog(result) {
  $("#import-log-card").hidden = false;
  const rows = [
    ...(result.ai?.enabled ? [`
      <div class="import-row">
        <span class="ok">AI</span>
        <span>4-Agent 分析流水线</span>
        <span>${result.ai.queued ? `${result.ai.queued} 份排队中` : "已启用"}</span>
      </div>
    `] : []),
    ...result.imported.map((item) => `
      <div class="import-row">
        <span class="ok">✓</span>
        <span>${escapeHtml(item.name)} <small>${escapeHtml(item.fileName)}</small></span>
        <span>${item.warningCount ? `${item.warningCount} 个提醒` : "已生成证据卡"}</span>
      </div>
    `),
    ...result.errors.map((item) => `
      <div class="import-row">
        <span class="error">!</span>
        <span>${escapeHtml(item.fileName)}</span>
        <span class="error">${escapeHtml(item.message)}</span>
      </div>
    `),
  ];
  $("#import-log").innerHTML = rows.join("") || '<div class="evidence-empty">没有处理结果</div>';
}

async function importFiles() {
  const targetJobId = state.editingJobId;
  if (!currentJob() || !targetJobId) {
    toast("请先创建或选择岗位", true);
    return;
  }
  if (!state.pendingFiles.length) return;
  if (state.isImporting) return;
  const items = [...state.pendingFiles];
  const total = items.length;
  if (!total) return;
  state.isImporting = true;
  state.importCancelled = false;
  state.importController = new AbortController();
  const button = $("#import-button");
  button.disabled = true;
  button.textContent = `正在解析 0 / ${total} 份简历…`;
  items.forEach((item) => {
    item.status = "queued";
    item.error = "";
  });
  renderImportPage();
  updateImportProgress(0, total, "正在读取文件并进行文本提取。", "正在准备简历文件");
  try {
    const aggregate = {
      imported: [],
      errors: [],
      ai: { enabled: false, queued: 0 },
    };
    let processed = 0;
    const batches = buildImportBatches(items);
    for (const chunk of batches) {
      if (state.importCancelled) break;
      chunk.forEach((item) => {
        item.status = "processing";
      });
      updateImportProgress(
        processed,
        total,
        `正在读取第 ${processed + 1}–${Math.min(processed + chunk.length, total)} 份简历的文本与结构。`,
      );
      renderImportPage();
      try {
        const files = await prepareFilePayload(chunk.map((item) => item.file));
        const result = await api(`/api/jobs/${encodeURIComponent(targetJobId)}/candidates/import`, {
          method: "POST",
          body: JSON.stringify({ files }),
          signal: state.importController.signal,
        });
        aggregate.imported.push(...result.imported);
        aggregate.errors.push(...result.errors);
        if (result.ai?.enabled) {
          aggregate.ai.enabled = true;
          aggregate.ai.queued += Number(result.ai.queued || 0);
        }
        const importedNames = new Set(result.imported.map((item) => item.fileName));
        const errorMessages = new Map(result.errors.map((item) => [item.fileName, item.message]));
        chunk.forEach((item) => {
          if (importedNames.has(item.file.name)) {
            item.status = "complete";
          } else {
            item.status = "error";
            item.error = errorMessages.get(item.file.name) || "解析失败";
          }
        });
      } catch (error) {
        if (state.importCancelled || error.name === "AbortError") {
          chunk.forEach((item) => {
            item.status = "queued";
          });
          break;
        }
        chunk.forEach((item) => {
          item.status = "error";
          item.error = error.message;
          aggregate.errors.push({
            fileName: item.file.name,
            message: error.message,
          });
        });
      }
      processed += chunk.length;
      button.textContent = `正在解析 ${processed} / ${total} 份简历…`;
      updateImportProgress(
        processed,
        total,
        processed < total
          ? "正在继续处理后续文件，已完成的文件会保留在结果中。"
          : "全部文件处理完成，正在汇总证据卡。",
      );
      renderImportPage();
    }

    if (aggregate.imported.length || aggregate.errors.length) {
      renderImportLog(aggregate);
    }
    state.pendingFiles = state.pendingFiles.filter((item) => item.status !== "complete");
    renderImportPage();
    await loadState({ preserveDraft: true });
    if (state.importCancelled) {
      toast("已取消后续解析，未完成文件已保留");
    } else if (aggregate.imported.length && aggregate.errors.length) {
      toast(`已导入 ${aggregate.imported.length} 份，另有 ${aggregate.errors.length} 份失败并保留`, true);
    } else if (aggregate.imported.length) {
      toast(aggregate.ai.enabled
        ? `已导入 ${aggregate.imported.length} 份简历，Agent 正在后台抽取证据`
        : `已生成 ${aggregate.imported.length} 份候选人证据卡`);
    } else {
      toast("没有成功解析的简历，请查看错误信息", true);
    }
  } catch (error) {
    toast(error.message, true);
  } finally {
    state.isImporting = false;
    state.importController = null;
    state.pendingFiles.forEach((item) => {
      if (item.status === "processing") item.status = "queued";
    });
    resetImportProgress();
    renderImportPage();
    button.textContent = "开始解析并生成证据卡";
  }
}

function cancelImport() {
  if (!state.isImporting || !state.importController) return;
  state.importCancelled = true;
  state.importController.abort();
  $("#cancel-import-button").disabled = true;
  $("#cancel-import-button").textContent = "正在取消…";
  $("#import-progress-title").textContent = "正在停止后续解析";
  $("#import-progress-detail").textContent = "已完成的简历会保留，当前文件会回到待解析状态。";
}

async function importPastedResume() {
  if (!currentJob()) {
    toast("请先创建或选择岗位", true);
    return;
  }
  const text = $("#paste-text").value.trim();
  if (text.length < 20) {
    toast("请粘贴一份完整的简历文字", true);
    return;
  }
  const name = $("#paste-name").value.trim();
  const fileName = `${(name || "粘贴简历").replace(/[\\/:*?"<>|]/g, "_")}.txt`;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const file = new File([blob], fileName, { type: "text/plain" });
  const button = $("#paste-import-button");
  button.disabled = true;
  button.textContent = "解析中…";
  try {
    const result = await api(`/api/jobs/${encodeURIComponent(state.editingJobId)}/candidates/import`, {
      method: "POST",
      body: JSON.stringify({ files: await prepareFilePayload([file]) }),
    });
    renderImportLog(result);
    if (result.imported.length) {
      $("#paste-name").value = "";
      $("#paste-text").value = "";
      toast(result.ai?.enabled ? "已导入，Agent 正在后台分析" : "已生成粘贴简历的证据卡");
      await loadState();
    } else {
      toast(result.errors[0]?.message || "解析失败", true);
    }
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "解析粘贴内容";
  }
}

function filteredCandidates() {
  const search = $("#candidate-search").value.trim().toLocaleLowerCase();
  const status = $("#status-filter").value;
  const duplicatesOnly = $("#duplicate-filter").checked;
  return activeImportedCandidates().filter((candidate) => {
    if (status !== "all" && candidate.reviewStatus !== status) return false;
    if (duplicatesOnly && !candidate.duplicateOf) return false;
    if (!search) return true;
    const haystack = [
      candidate.profile?.name,
      candidate.profile?.email,
      candidate.fileName,
      candidate.summary?.headline,
    ].join(" ").toLocaleLowerCase();
    return haystack.includes(search);
  });
}

function renderReviewPage() {
  const candidates = activeImportedCandidates();
  const eligible = candidates.filter((candidate) => candidate.evaluation?.gateMet).length;
  const shortlist = candidates.filter((candidate) => candidate.reviewStatus === "shortlist").length;
  const attention = candidates.filter((candidate) => candidate.reviewStatus === "discuss" || candidate.duplicateOf).length;
  $("#metric-total").textContent = String(candidates.length);
  $("#metric-eligible").textContent = String(eligible);
  $("#metric-shortlist").textContent = String(shortlist);
  $("#metric-attention").textContent = String(attention);
  const reanalyzeCount = candidates.filter(
    (candidate) => candidate.aiStatus === "stale" || candidate.aiStatus === "error",
  ).length;
  const reanalyzeButton = $("#reanalyze-all-button");
  reanalyzeButton.hidden = !state.data?.ai?.configured || reanalyzeCount === 0;
  reanalyzeButton.textContent = `重试 AI（${reanalyzeCount}）`;
  reanalyzeButton.title = `重新分析 ${reanalyzeCount} 份待重算简历`;

  const filtered = filteredCandidates();
  renderRanking(filtered);
  renderMatrix(filtered);
  $("#ranking-view").hidden = state.resultView !== "ranking";
  $("#matrix-view").hidden = state.resultView !== "matrix";
}

function selectedInterviewCandidate() {
  return activeImportedCandidates().find((candidate) => candidate.id === webInterview.candidateId) || null;
}

function renderInterviewPage() {
  const candidates = activeImportedCandidates();
  const select = $("#interview-candidate-select");
  if (!select) return;
  const previousValue = webInterview.candidateId || select.value;
  select.innerHTML = candidates.length
    ? candidates.map((candidate) => (
        `<option value="${escapeAttr(candidate.id)}">${escapeHtml(candidate.profile?.name || candidate.fileName)}</option>`
      )).join("")
    : '<option value="">请先导入简历</option>';
  if (candidates.length) {
    webInterview.candidateId = candidates.some((candidate) => candidate.id === previousValue)
      ? previousValue
      : candidates[0].id;
    select.value = webInterview.candidateId;
  } else {
    webInterview.candidateId = null;
    webInterview.plan = null;
  }
  select.disabled = !candidates.length || !["idle", "completed", "failed"].includes(webInterview.status);

  const setupPanel = $("#interview-setup-panel");
  const callPanel = $("#interview-call-panel");
  const reportPanel = $("#interview-report-panel");
  const empty = $("#interview-empty");
  const hasCandidates = candidates.length > 0;
  empty.hidden = hasCandidates;
  setupPanel.hidden = !hasCandidates || !["idle", "failed"].includes(webInterview.status);
  callPanel.hidden = !["dialing", "connected", "speaking", "listening", "saving"].includes(webInterview.status);
  reportPanel.hidden = webInterview.status !== "completed";

  const candidate = selectedInterviewCandidate();
  if (candidate) {
    const candidateSummary = [
      candidate.profile?.title,
      candidate.profile?.yearsExperience != null ? `${candidate.profile.yearsExperience} 年经验` : "",
      candidate.evaluation?.gateLabel,
    ].filter(Boolean).join(" · ");
    $("#interview-candidate-summary").textContent = candidateSummary || candidate.fileName;
    $("#interview-call-name").textContent = candidate.profile?.name || candidate.fileName;
    $("#interview-call-title").textContent = `${candidate.profile?.title || "候选人"} · ${currentJob()?.title || ""}`;
  } else {
    $("#interview-candidate-summary").textContent = "请选择一位已完成简历解析的候选人。";
  }

  if (state.currentView === "interview" && candidate) {
    if (!webInterview.plan || webInterview.plan.candidate?.id !== candidate.id) {
      loadInterviewPlan(candidate.id);
    }
  }
  renderInterviewPlan();
  const startButton = $("#interview-start-button");
  startButton.disabled = !candidate
    || !webInterview.plan
    || !$("#interview-consent").checked
    || !["idle", "failed"].includes(webInterview.status);
  $("#phone-pairing-button").disabled = !candidate
    || !webInterview.plan
    || !$("#interview-consent").checked
    || !["idle", "failed"].includes(webInterview.status);
  const recognitionSupported = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  $("#interview-mic-button").disabled = !recognitionSupported;
  $("#interview-mic-help").textContent = recognitionSupported
    ? "点击“开始说话”，浏览器会实时转写；再点击一次结束录音。"
    : "当前浏览器不支持语音识别，请直接输入回答。建议使用最新版 Edge 或 Chrome。";
}

async function loadInterviewPlan(candidateId) {
  if (!candidateId || !state.editingJobId || webInterview.planLoading) return;
  if (webInterview.plan?.candidate?.id === candidateId) return;
  webInterview.planLoading = true;
  let failed = false;
  $("#interview-plan-list").innerHTML = '<div class="evidence-empty">正在根据简历证据缺口生成追问…</div>';
  try {
    const result = await api(
      `/api/jobs/${encodeURIComponent(state.editingJobId)}/candidates/${encodeURIComponent(candidateId)}/interview-plan`,
    );
    if (webInterview.candidateId !== candidateId) return;
    webInterview.plan = result;
    renderInterviewPlan();
  } catch (error) {
    if (webInterview.candidateId !== candidateId) return;
    failed = true;
    webInterview.plan = null;
    $("#interview-plan-list").innerHTML = `<div class="evidence-empty">${escapeHtml(error.message)}</div>`;
  } finally {
    webInterview.planLoading = false;
    const startButton = $("#interview-start-button");
    startButton.disabled = !webInterview.plan
      || !$("#interview-consent").checked
      || !selectedInterviewCandidate()
      || !["idle", "failed"].includes(webInterview.status);
    if (
      state.currentView === "interview"
      && !failed
      && webInterview.candidateId
      && webInterview.plan?.candidate?.id !== webInterview.candidateId
    ) {
      loadInterviewPlan(webInterview.candidateId);
    }
  }
}

function renderInterviewPlan() {
  const container = $("#interview-plan-list");
  if (!container) return;
  if (!webInterview.plan?.questions?.length) {
    container.innerHTML = '<div class="evidence-empty">选择候选人后生成问题。</div>';
    return;
  }
  container.innerHTML = `
    <div class="interview-plan-head">
      <strong>${escapeHtml(webInterview.plan.jobTitle)}</strong>
      <span>${webInterview.plan.questions.length} 个证据导向问题</span>
    </div>
    ${webInterview.plan.questions.map((question, index) => `
      <article class="interview-plan-item">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <div>
          <strong>${escapeHtml(question.question)}</strong>
          <small>${escapeHtml(question.reason || "根据岗位评价项生成")}</small>
        </div>
      </article>
    `).join("")}
  `;
}

function setInterviewStage(status, label) {
  webInterview.status = status;
  $("#interview-call-status").textContent = label;
  $("#interview-stage-label").textContent = label;
  const orb = $("#interview-call-orb");
  orb.classList.toggle("is-speaking", ["speaking", "dialing"].includes(status));
  orb.classList.toggle("is-listening", status === "listening");
}

function addInterviewTranscript(role, text) {
  const record = { role, text: cleanInterviewText(text), at: new Date().toISOString() };
  if (!record.text) return;
  webInterview.transcript.push(record);
  const log = $("#interview-transcript");
  const item = document.createElement("div");
  item.className = `interview-message is-${role}`;
  item.innerHTML = `
    <span>${role === "ai" ? "AI" : "候选人"}</span>
    <p>${escapeHtml(record.text)}</p>
    <time>${escapeHtml(formatDateTime(record.at))}</time>
  `;
  log.appendChild(item);
  log.scrollTop = log.scrollHeight;
}

function cleanInterviewText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function speakInterviewPrompt(text, onComplete) {
  const answerComposer = $("#interview-answer-composer");
  answerComposer.hidden = true;
  addInterviewTranscript("ai", text);
  $("#interview-question-text").textContent = text;
  if (!("speechSynthesis" in window) || typeof window.SpeechSynthesisUtterance !== "function") {
    setInterviewStage("connected", "等待候选人回答");
    answerComposer.hidden = false;
    onComplete?.();
    return;
  }
  window.speechSynthesis.cancel();
  webInterview.speaking = true;
  setInterviewStage("speaking", "AI 正在说话");
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 0.96;
  utterance.pitch = 1;
  const voices = window.speechSynthesis.getVoices();
  utterance.voice = voices.find((voice) => /^zh[-_]/i.test(voice.lang)) || voices[0] || null;
  const complete = () => {
    if (!webInterview.speaking) return;
    webInterview.speaking = false;
    setInterviewStage("connected", "等待候选人回答");
    answerComposer.hidden = false;
    $("#interview-answer-input").focus();
    onComplete?.();
  };
  utterance.onend = complete;
  utterance.onerror = complete;
  window.speechSynthesis.speak(utterance);
}

function startInterviewTimer() {
  clearInterval(webInterview.timer);
  const tick = () => {
    if (!webInterview.startedAt || webInterview.endedAt) return;
    const elapsed = Math.floor((Date.now() - new Date(webInterview.startedAt).getTime()) / 1000);
    $("#interview-call-timer").textContent = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
    if (elapsed >= 8 * 60) finishWebInterview({ reason: "timeout" });
  };
  tick();
  webInterview.timer = setInterval(tick, 1000);
}

function buildInterviewDialog() {
  const questions = webInterview.plan?.questions || [];
  webInterview.dialog = [
    {
      id: "consent",
      type: "consent",
      text: `你好，我是才证 AI 招聘助理。本次为你应聘的“${webInterview.plan?.jobTitle || "当前岗位"}”进行初步沟通。本次对话会转写为招聘记录，但不会保存录音。你是否同意继续？`,
    },
    {
      id: "availability",
      type: "availability",
      text: "好的。本次沟通预计需要三到五分钟，现在是否方便继续？",
    },
    ...questions.map((question) => ({
      id: question.id,
      type: "question",
      text: question.question,
      criterionId: question.criterionId,
    })),
  ];
}

function askCurrentInterviewQuestion() {
  const current = webInterview.dialog[webInterview.turnIndex];
  if (!current) {
    finishWebInterview({ reason: "completed" });
    return;
  }
  speakInterviewPrompt(current.text);
}

function startWebInterview() {
  if (!webInterview.plan || !selectedInterviewCandidate() || !$("#interview-consent").checked) {
    toast("请先选择候选人并确认通话授权", true);
    return;
  }
  clearInterviewRuntime();
  webInterview.transcript = [];
  webInterview.answers = [];
  webInterview.turnIndex = 0;
  webInterview.endedAt = null;
  webInterview.consentDeclined = false;
  webInterview.consentConfirmed = false;
  webInterview.startedAt = new Date().toISOString();
  buildInterviewDialog();
  $("#interview-setup-panel").hidden = true;
  $("#interview-call-panel").hidden = false;
  $("#interview-report-panel").hidden = true;
  $("#interview-transcript").innerHTML = "";
  $("#interview-answer-input").value = "";
  setInterviewStage("dialing", "正在拨号");
  $("#interview-question-text").textContent = "正在建立安全的浏览器语音会话…";
  window.setTimeout(() => {
    setInterviewStage("connected", "通话已接通");
    startInterviewTimer();
    window.setTimeout(askCurrentInterviewQuestion, 500);
  }, 900);
}

function clearInterviewRuntime() {
  clearInterval(webInterview.timer);
  webInterview.timer = null;
  if (webInterview.recognition && webInterview.listening) {
    try { webInterview.recognition.stop(); } catch { /* noop */ }
  }
  webInterview.listening = false;
  webInterview.speaking = false;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  $("#interview-mic-button").textContent = "开始说话";
}

function stopInterviewRecognition() {
  if (!webInterview.recognition || !webInterview.listening) return;
  try { webInterview.recognition.stop(); } catch { /* noop */ }
}

function toggleInterviewMic() {
  if (webInterview.listening) {
    stopInterviewRecognition();
    return;
  }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    toast("当前浏览器不支持语音识别，请直接输入回答", true);
    return;
  }
  const recognition = new Recognition();
  recognition.lang = "zh-CN";
  recognition.continuous = true;
  recognition.interimResults = true;
  const baseText = cleanInterviewText($("#interview-answer-input").value);
  recognition.onstart = () => {
    webInterview.listening = true;
    setInterviewStage("listening", "正在聆听回答");
    $("#interview-mic-button").textContent = "停止录音";
  };
  recognition.onresult = (event) => {
    const recognized = Array.from(event.results)
      .map((result) => result[0]?.transcript || "")
      .join("");
    $("#interview-answer-input").value = [baseText, recognized]
      .filter(Boolean)
      .join(baseText && recognized ? " " : "")
      .trim();
  };
  recognition.onerror = (event) => {
    if (event.error === "not-allowed") toast("麦克风权限被拒绝，请在浏览器设置中允许后重试", true);
    else if (event.error !== "no-speech") toast(`语音识别暂不可用：${event.error}`, true);
  };
  recognition.onend = () => {
    webInterview.listening = false;
    webInterview.recognition = null;
    $("#interview-mic-button").textContent = "开始说话";
    if (["listening"].includes(webInterview.status)) setInterviewStage("connected", "请确认并提交回答");
  };
  webInterview.recognition = recognition;
  try {
    recognition.start();
  } catch (error) {
    toast(`无法启动麦克风：${error.message}`, true);
  }
}

function submitInterviewAnswer() {
  const input = $("#interview-answer-input");
  const answer = cleanInterviewText(input.value);
  if (!answer) {
    toast("请先输入或说出你的回答", true);
    input.focus();
    return;
  }
  stopInterviewRecognition();
  const current = webInterview.dialog[webInterview.turnIndex];
  if (!current) return;
  const consentPattern = /同意|可以|好的|没问题|继续/;
  const declinePattern = /不同意|不愿意|拒绝|不想/;
  const unavailablePattern = /不方便|没时间|稍后|改天|正在忙/;
  if (current.type === "consent" && declinePattern.test(answer)) {
    webInterview.consentDeclined = true;
    finishWebInterview({ reason: "declined" });
    return;
  }
  if (current.type === "consent" && !consentPattern.test(answer)) {
    $("#interview-question-text").textContent = "我需要确认你的意愿。请明确回答“同意”或“不同意”。";
    speakInterviewPrompt("我需要确认你的意愿。你是否同意继续本次 AI 初筛？");
    return;
  }
  if (current.type === "consent") webInterview.consentConfirmed = true;
  if (current.type === "availability" && unavailablePattern.test(answer)) {
    finishWebInterview({ reason: "reschedule" });
    return;
  }
  addInterviewTranscript("candidate", answer);
  webInterview.answers.push({
    questionId: current.id,
    question: current.text,
    answer,
  });
  input.value = "";
  $("#interview-answer-composer").hidden = true;
  webInterview.turnIndex += 1;
  if (webInterview.turnIndex >= webInterview.dialog.length) {
    finishWebInterview({ reason: "completed" });
  } else {
    setInterviewStage("speaking", "AI 正在准备下一问");
    window.setTimeout(askCurrentInterviewQuestion, 350);
  }
}

function renderInterviewReport(interview) {
  webInterview.status = "completed";
  $("#interview-call-panel").hidden = true;
  $("#interview-report-panel").hidden = false;
  $("#interview-report-title").textContent = interview.status === "declined"
    ? "候选人未同意继续"
    : interview.status === "follow_up_required"
      ? "需要重新安排时间"
      : "本次 AI 初筛已完成";
  $("#interview-report-summary").textContent = interview.summary;
  $("#interview-report-highlights").innerHTML = (interview.highlights || []).length
    ? interview.highlights.map((item) => `
        <article>
          <span>回答记录</span>
          <strong>${escapeHtml(item.question)}</strong>
          <p>${escapeHtml(item.answer)}</p>
        </article>
      `).join("")
    : '<div class="evidence-empty">本次没有进入岗位问题环节。</div>';
}

async function finishWebInterview({ reason = "completed" } = {}) {
  if (!webInterview.startedAt || webInterview.endedAt) return;
  webInterview.endedAt = new Date().toISOString();
  clearInterviewRuntime();
  setInterviewStage("saving", "正在生成通话报告");
  const durationSec = Math.max(
    0,
    Math.round((new Date(webInterview.endedAt).getTime() - new Date(webInterview.startedAt).getTime()) / 1000),
  );
  const planQuestionIds = new Set((webInterview.plan?.questions || []).map((question) => question.id));
  const jobAnswers = webInterview.answers.filter((answer) => planQuestionIds.has(answer.questionId));
  try {
    const result = await api(
      `/api/jobs/${encodeURIComponent(state.editingJobId)}/candidates/${encodeURIComponent(webInterview.candidateId)}/web-interview`,
      {
        method: "POST",
        body: JSON.stringify({
          consent: webInterview.consentConfirmed && !webInterview.consentDeclined,
          completionReason: reason,
          startedAt: webInterview.startedAt,
          endedAt: webInterview.endedAt,
          durationSec,
          questions: webInterview.plan?.questions || [],
          answers: jobAnswers,
        }),
      },
    );
    renderInterviewReport(result.interview);
    await loadState({ preserveDraft: true });
    toast(result.interview.status === "declined" ? "已记录候选人拒绝，未进入岗位问题" : "网页 AI 初筛已完成并写入审计记录");
  } catch (error) {
    webInterview.status = "failed";
    $("#interview-call-panel").hidden = true;
    $("#interview-report-panel").hidden = false;
    $("#interview-report-title").textContent = "报告保存失败";
    $("#interview-report-summary").textContent = error.message;
    $("#interview-report-highlights").innerHTML = "";
    toast(error.message, true);
  }
}

function resetInterviewPage() {
  clearInterviewRuntime();
  webInterview.status = "idle";
  webInterview.plan = null;
  webInterview.startedAt = null;
  webInterview.endedAt = null;
  webInterview.transcript = [];
  webInterview.answers = [];
  webInterview.dialog = [];
  webInterview.turnIndex = 0;
  webInterview.consentDeclined = false;
  webInterview.consentConfirmed = false;
  $("#interview-consent").checked = false;
  $("#interview-report-panel").hidden = true;
  $("#interview-call-panel").hidden = true;
  $("#interview-setup-panel").hidden = false;
  renderInterviewPage();
}

function showPhonePairingShell() {
  phonePairing.returnFocusElement = $("#phone-pairing-button");
  $("#phone-pair-backdrop").hidden = false;
  $("#phone-pair-modal").hidden = false;
  $("#phone-pair-modal").setAttribute("aria-hidden", "false");
  document.body.classList.add("has-open-phone-pair");
  setAppInert(true);
  requestAnimationFrame(() => $("#phone-pair-close").focus({ preventScroll: true }));
}

function closePhonePairing() {
  clearTimeout(phonePairing.pollTimer);
  phonePairing.pollTimer = null;
  phonePairing.active = false;
  phonePairing.sessionId = "";
  phonePairing.token = "";
  phonePairing.candidateId = "";
  phonePairing.lastEventSeq = 0;
  phonePairing.savingReport = false;
  $("#phone-pair-backdrop").hidden = true;
  $("#phone-pair-modal").hidden = true;
  $("#phone-pair-modal").setAttribute("aria-hidden", "true");
  $("#phone-pair-live").hidden = true;
  $("#phone-pair-transcript").innerHTML = "";
  document.body.classList.remove("has-open-phone-pair");
  if (!tourState.active && !$("#candidate-drawer").classList.contains("is-open")) {
    setAppInert(false);
  }
  requestAnimationFrame(() => phonePairing.returnFocusElement?.focus({ preventScroll: true }));
}

function renderPhonePairingQr(url) {
  if (typeof qrcode !== "function") {
    $("#phone-pair-qr").innerHTML = '<div class="evidence-empty">二维码组件加载失败，请改用手机访问下方链接。</div>';
    return;
  }
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  $("#phone-pair-qr").innerHTML = qr.createImgTag(6, 12);
  const image = $("#phone-pair-qr img");
  if (image) image.alt = "手机扫码接听 AI 招聘来电";
}

async function startPhonePairing() {
  const candidate = selectedInterviewCandidate();
  if (!candidate || !webInterview.plan || !$("#interview-consent").checked) {
    toast("请先选择候选人并确认通话授权", true);
    return;
  }
  phonePairing.active = true;
  phonePairing.candidateId = candidate.id;
  phonePairing.lastEventSeq = 0;
  phonePairing.savingReport = false;
  $("#phone-pair-live").hidden = true;
  $("#phone-pair-transcript").innerHTML = "";
  $("#phone-pair-status").textContent = "正在准备安全连接";
  $("#phone-pair-copy").textContent = "正在创建一次性手机接听会话，请稍候。";
  $("#phone-pair-url").textContent = "";
  $("#phone-pair-qr").innerHTML = '<div class="phone-pair-loading"><i></i><span>正在生成二维码</span></div>';
  showPhonePairingShell();
  try {
    const result = await api("/api/call-sessions", {
      method: "POST",
      body: JSON.stringify({ candidateId: candidate.id }),
    });
    phonePairing.sessionId = result.session.id;
    phonePairing.token = result.session.token || "";
    // The token is deliberately not returned in the public session summary.
    if (!phonePairing.token) {
      const separator = result.phoneUrl.includes("?") ? "&" : "?";
      const phoneUrl = new URL(result.phoneUrl);
      phonePairing.token = phoneUrl.searchParams.get("token") || "";
      phonePairing.phoneUrl = `${phoneUrl.origin}${phoneUrl.pathname}${phoneUrl.search}`;
    } else {
      phonePairing.phoneUrl = result.phoneUrl;
    }
    renderPhonePairingQr(result.phoneUrl);
    $("#phone-pair-url").textContent = result.phoneUrl;
    $("#phone-pair-security-note").textContent = result.secure
      ? "已启用 HTTPS，手机麦克风可以正常使用。"
      : "当前为局域网 HTTP。若手机无法使用麦克风，请使用页面中的文字输入。";
    $("#phone-pair-status").textContent = "等待手机扫码";
    $("#phone-pair-copy").textContent = "用手机扫描二维码，进入才证 AI 招聘来电页面。";
    pollPhonePairing();
  } catch (error) {
    phonePairing.active = false;
    $("#phone-pair-status").textContent = "创建失败";
    $("#phone-pair-copy").textContent = error.message;
    $("#phone-pair-qr").innerHTML = `<div class="evidence-empty">${escapeHtml(error.message)}</div>`;
  }
}

function addPhonePairTranscript(role, text) {
  const value = cleanInterviewText(text);
  if (!value) return;
  const row = document.createElement("p");
  row.className = `is-${role}`;
  row.innerHTML = `<strong>${role === "ai" ? "AI" : "候选人"}</strong>${escapeHtml(value)}`;
  $("#phone-pair-transcript").appendChild(row);
  $("#phone-pair-transcript").scrollTop = $("#phone-pair-transcript").scrollHeight;
}

async function pollPhonePairing() {
  if (!phonePairing.active || !phonePairing.sessionId) return;
  clearTimeout(phonePairing.pollTimer);
  try {
    const query = `token=${encodeURIComponent(phonePairing.token)}&after=${phonePairing.lastEventSeq}`;
    const result = await api(
      `/api/call-sessions/${encodeURIComponent(phonePairing.sessionId)}/events?${query}`,
    );
    for (const event of result.events || []) {
      phonePairing.lastEventSeq = Math.max(phonePairing.lastEventSeq, event.seq);
      if (event.type === "phone.joined") {
        $("#phone-pair-status").textContent = "手机已接入，等待接听";
      } else if (event.type === "call.accepted") {
        $("#phone-pair-status").textContent = "通话中";
        $("#phone-pair-copy").textContent = "手机已接听，AI 正在进行岗位初筛。";
        $("#phone-pair-live").hidden = false;
      } else if (event.type === "ai.speaking") {
        addPhonePairTranscript("ai", event.data?.text);
      } else if (event.type === "candidate.transcript") {
        addPhonePairTranscript("candidate", event.data?.answer);
      } else if (event.type === "call.ended") {
        $("#phone-pair-status").textContent = "通话结束，正在生成报告";
        await savePhoneInterviewReport(event.data || {});
        return;
      }
    }
    if (result.session?.status === "ended" && !phonePairing.savingReport) {
      $("#phone-pair-status").textContent = "通话已结束";
    }
  } catch (error) {
    $("#phone-pair-status").textContent = `连接重试中 · ${error.message}`;
  }
  if (phonePairing.active) {
    phonePairing.pollTimer = setTimeout(pollPhonePairing, 800);
  }
}

async function savePhoneInterviewReport(data) {
  if (phonePairing.savingReport || !phonePairing.candidateId) return;
  phonePairing.savingReport = true;
  clearTimeout(phonePairing.pollTimer);
  try {
    const result = await api(
      `/api/jobs/${encodeURIComponent(state.editingJobId)}/candidates/${encodeURIComponent(phonePairing.candidateId)}/web-interview`,
      {
        method: "POST",
        body: JSON.stringify({
          consent: Boolean(data.consent),
          completionReason: data.completionReason || "completed",
          startedAt: data.startedAt,
          endedAt: data.endedAt,
          durationSec: data.durationSec,
          questions: data.questions || webInterview.plan?.questions || [],
          answers: data.answers || [],
          mode: "phone-pair-demo",
        }),
      },
    );
    webInterview.candidateId = phonePairing.candidateId;
    webInterview.status = "completed";
    renderInterviewReport(result.interview);
    $("#phone-pair-status").textContent = "报告已生成并同步";
    await loadState({ preserveDraft: true });
    toast("手机 AI 初筛已完成，报告已写入候选人审计记录");
    window.setTimeout(() => {
      closePhonePairing();
      $("#interview-call-panel").hidden = true;
      $("#interview-report-panel").hidden = false;
    }, 700);
  } catch (error) {
    phonePairing.savingReport = false;
    $("#phone-pair-status").textContent = `报告保存失败 · ${error.message}`;
  }
}

function renderWorkflowGuide() {
  const guide = $("#workflow-guide");
  if (!guide) return;
  if (["knowledge", "interview"].includes(state.currentView)) {
    guide.hidden = true;
    return;
  }

  const job = currentJob();
  const candidates = activeImportedCandidates();
  const pendingCount = state.pendingFiles.length;
  const unreviewedCount = candidates.filter((candidate) => candidate.reviewStatus === "unreviewed").length;
  const attentionCount = candidates.filter(
    (candidate) => candidate.reviewStatus === "discuss" || candidate.duplicateOf,
  ).length;
  const aiPendingCount = candidates.filter(
    (candidate) => candidate.aiStatus === "pending" || candidate.aiStatus === "processing",
  ).length;
  const aiFailedCount = candidates.filter(
    (candidate) => candidate.aiStatus === "stale" || candidate.aiStatus === "error",
  ).length;
  const title = $("#job-title").value.trim();
  const criterionRows = $$(".criterion-row", $("#criteria-list"));
  const namedCriteria = criterionRows.filter((row) => $(".criterion-name", row).value.trim());
  const weightTotal = criterionRows.reduce(
    (sum, row) => sum + (Number($(".criterion-weight", row)?.value) || 0),
    0,
  );

  let guidance;
  if ((state.currentView === "job" || state.isNewJob) && !title) {
    guidance = {
      tone: "blocked",
      step: "01",
      kicker: "流程停在这里",
      title: "缺少岗位名称",
      copy: "岗位名称是评价卡和后续所有筛选规则的基础，填写后才能继续。",
      action: "focus-job-title",
      actionLabel: "填写岗位名称",
    };
  } else if ((state.currentView === "job" || state.isNewJob) && namedCriteria.length === 0) {
    guidance = {
      tone: "blocked",
      step: "01",
      kicker: "还缺一个关键条件",
      title: "评价卡还没有有效评价项",
      copy: "从 JD 生成评价项，或手动添加至少一个岗位相关能力。",
      action: "focus-criteria",
      actionLabel: "添加评价项",
    };
  } else if ((state.currentView === "job" || state.isNewJob) && weightTotal <= 0) {
    guidance = {
      tone: "blocked",
      step: "01",
      kicker: "权重尚未完成",
      title: "所有评价项权重合计为 0",
      copy: "为至少一个评价项设置大于 0 的权重，候选人才能进入稳定排序。",
      action: "focus-weight",
      actionLabel: "设置评价权重",
    };
  } else if ((state.currentView === "job" || state.isNewJob) && state.jobDirty) {
    guidance = {
      tone: "next",
      step: "01",
      kicker: "下一步",
      title: "评价卡还有未保存的修改",
      copy: "保存后，新的岗位标准才会用于简历证据匹配。",
      action: "save-job",
      actionLabel: "保存评价卡",
    };
  } else if (!job) {
    guidance = {
      tone: "blocked",
      step: "01",
      kicker: "流程被阻断",
      title: "缺少岗位评价卡",
      copy: "需要先创建岗位名称和评价项，才能导入简历并生成可比较的筛选结果。",
      action: "focus-job",
      actionLabel: "创建岗位评价卡",
    };
  } else if (state.jobDirty) {
    guidance = {
      tone: "blocked",
      step: "01",
      kicker: "流程被阻断",
      title: "岗位标准有修改尚未保存",
      copy: "请先保存评价卡，否则导入或重新分析会继续使用旧标准。",
      action: "focus-job",
      actionLabel: "返回保存评价卡",
    };
  } else if (pendingCount > 0) {
    guidance = {
      tone: "next",
      step: "02",
      kicker: "文件已经就绪",
      title: `还有 ${pendingCount} 份简历等待解析`,
      copy: "确认文件无误后开始解析，系统会按当前岗位标准生成证据卡。",
      action: state.currentView === "import" ? "run-import" : "focus-import",
      actionLabel: state.currentView === "import" ? "开始解析简历" : "去解析简历",
    };
  } else if (candidates.length === 0) {
    guidance = {
      tone: "blocked",
      step: "02",
      kicker: "缺少候选人资料",
      title: "还没有可解析的简历",
      copy: "拖入或选择简历文件，完成导入后再进入证据比较与人工审核。",
      action: "choose-files",
      actionLabel: "选择简历文件",
    };
  } else if (aiPendingCount > 0) {
    guidance = {
      tone: "progress",
      step: "03",
      kicker: "Agent 正在处理",
      title: `还有 ${aiPendingCount} 份简历正在审计证据`,
      copy: "可以继续查看候选人详情；完成前当前分数仍可能使用关键词基线。",
      action: "start-review",
      actionLabel: "查看当前结果",
    };
  } else if (aiFailedCount > 0 && state.data?.ai?.configured) {
    guidance = {
      tone: "blocked",
      step: "03",
      kicker: "证据需要重新计算",
      title: `${aiFailedCount} 位候选人的 AI 证据待重试`,
      copy: "当前排序可以使用关键词基线，但重新分析后会按最新岗位标准更新证据。",
      action: "retry-ai",
      actionLabel: "重新分析",
    };
  } else if (unreviewedCount > 0) {
    guidance = {
      tone: "next",
      step: "04",
      kicker: "还差人工决策",
      title: `${unreviewedCount} 位候选人尚未审核`,
      copy: "排序只是起点。请核对原文证据，并标记短名单、待讨论或不通过。",
      action: "start-review",
      actionLabel: "开始人工审核",
    };
  } else if (attentionCount > 0) {
    guidance = {
      tone: "blocked",
      step: "04",
      kicker: "建议重点复核",
      title: `有 ${attentionCount} 位候选人需要讨论或去重`,
      copy: "处理待讨论与重复简历后，再导出本轮筛选结果。",
      action: "review-attention",
      actionLabel: "查看待处理结果",
    };
  } else {
    guidance = {
      tone: "complete",
      step: "04",
      kicker: "本轮流程已完成",
      title: "所有候选人均已完成人工审核",
      copy: "可以导出筛选结果，或继续导入新的简历。",
      action: "export-results",
      actionLabel: "导出 CSV",
    };
  }

  guide.hidden = false;
  guide.className = `workflow-guide is-${guidance.tone}`;
  $("#workflow-guide-step").textContent = guidance.step;
  $("#workflow-guide-kicker").textContent = guidance.kicker;
  $("#workflow-guide-title").textContent = guidance.title;
  $("#workflow-guide-copy").textContent = guidance.copy;
  const action = $("#workflow-guide-action");
  action.textContent = guidance.actionLabel;
  action.dataset.guideAction = guidance.action;
}

async function handleWorkflowGuideAction(action) {
  if (!action) return;
  if (action === "focus-job-title") {
    switchView("job");
    await nextFrame();
    $("#job-title").focus();
    return;
  }
  if (action === "focus-criteria") {
    switchView("job");
    await nextFrame();
    $(".criteria-card").scrollIntoView({ behavior: "smooth", block: "center" });
    $("#add-criterion-button").focus({ preventScroll: true });
    return;
  }
  if (action === "focus-weight") {
    switchView("job");
    await nextFrame();
    ($(".criterion-weight") || $("#add-criterion-button")).focus();
    return;
  }
  if (action === "save-job") {
    $("#job-form").requestSubmit();
    return;
  }
  if (action === "focus-job") {
    switchView("job");
    await nextFrame();
    currentJob() ? $("#job-title").focus() : startNewJob();
    return;
  }
  if (action === "choose-files") {
    switchView("import");
    await nextFrame();
    $("#file-input").click();
    return;
  }
  if (action === "run-import") {
    switchView("import");
    await nextFrame();
    if (!$("#import-button").disabled) importFiles();
    return;
  }
  if (action === "focus-import") {
    switchView("import");
    await nextFrame();
    $("#drop-zone").focus();
    return;
  }
  if (action === "start-review") {
    switchView("review");
    await nextFrame();
    $(".review-card").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (action === "retry-ai") {
    switchView("review");
    await nextFrame();
    await reanalyzeAllCandidates();
    return;
  }
  if (action === "review-attention") {
    $("#duplicate-filter").checked = true;
    switchView("review");
    return;
  }
  if (action === "export-results") {
    $("#export-button").click();
  }
}

async function reanalyzeAllCandidates() {
  const button = $("#reanalyze-all-button");
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "提交中…";
  try {
    const result = await api(`/api/jobs/${encodeURIComponent(state.editingJobId)}/reanalyze`, {
      method: "POST",
      body: "{}",
    });
    await loadState({ preserveDraft: true });
    toast(result.queued
      ? `已提交 ${result.queued} 份简历重新分析`
      : "没有需要重新分析的简历");
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function gateClass(evaluation) {
  if (!evaluation?.requiredTotal) return "neutral";
  return evaluation.gateMet ? "pass" : "fail";
}

function candidateAiBadge(candidate) {
  if (candidate.aiStatus === "complete") return '<span class="ai-badge">4-Agent 已校验</span>';
  if (candidate.aiStatus === "stale") return '<span class="ai-badge pending">AI 待重算</span>';
  if (candidate.aiStatus === "error") return '<span class="ai-badge error">AI 回退</span>';
  if (candidate.aiStatus === "pending" || candidate.aiStatus === "processing") {
    return `<span class="ai-badge pending">${escapeHtml(candidate.agentStage === "queued" ? "Agent 排队" : "4-Agent 运行中")}</span>`;
  }
  return "";
}

function candidateExtractionBadge(candidate) {
  const quality = candidate.extractionQuality;
  if (!quality || quality.level === "high") return "";
  if (quality.level === "low") {
    return `<span class="ai-badge error" title="OCR 质量 ${quality.score}/100">OCR 质量低</span>`;
  }
  return `<span class="ai-badge pending" title="OCR 质量 ${quality.score}/100">OCR 待复核</span>`;
}

function candidateRetryButton(candidate) {
  if (!["stale", "error"].includes(candidate.aiStatus) || !state.data?.ai?.configured) return "";
  return `
    <button
      type="button"
      class="candidate-retry-button"
      data-retry-candidate="${escapeAttr(candidate.id)}"
      aria-label="重新分析 ${escapeAttr(candidate.profile?.name || "候选人")} 的 AI 证据"
    >重试</button>
  `;
}

function renderRanking(candidates) {
  const body = $("#ranking-body");
  const cardList = $("#ranking-card-list");
  const empty = $("#ranking-empty");
  if (!candidates.length) {
    body.innerHTML = "";
    cardList.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  const cards = [];
  body.innerHTML = candidates.map((candidate) => {
    const coverage = candidate.evaluation.totalCriteria
      ? Math.round((candidate.evaluation.matchedCount / candidate.evaluation.totalCriteria) * 100)
      : 0;
    const duplicate = candidate.duplicateOf ? '<span class="duplicate-badge">重复?</span>' : "";
    const aiBadge = candidateAiBadge(candidate);
    const extractionBadge = candidateExtractionBadge(candidate);
    const retryButton = candidateRetryButton(candidate);
    const gate = candidate.evaluation.gateLabel;
    const valueAssessment = candidate.intelligence?.valueAssessment;
    const profileLine = [candidate.profile?.title, candidate.profile?.email, candidate.profile?.yearsExperience ? `${candidate.profile.yearsExperience} 年经验` : ""]
      .filter(Boolean).join(" · ");
    cards.push(`
      <article class="mobile-candidate-card" data-candidate-id="${escapeAttr(candidate.id)}">
        <div class="mobile-candidate-head">
          <span class="mobile-candidate-rank">${String(candidate.rank).padStart(2, "0")}</span>
          <div class="mobile-candidate-identity">
            <div class="mobile-candidate-name">
              <h3>
                <button type="button" class="candidate-name-button" data-view-resume="${escapeAttr(candidate.id)}" aria-label="查看 ${escapeAttr(candidate.profile?.name || "候选人")} 的原简历">
                  ${escapeHtml(candidate.profile?.name || "未命名候选人")}
                </button>
              </h3>
              ${aiBadge}
              ${extractionBadge}
              ${duplicate}
            </div>
            <p>${escapeHtml(profileLine || candidate.fileName)}</p>
          </div>
          <div class="mobile-candidate-score">
            <strong>${candidate.evaluation.score}</strong>
            <small>匹配分</small>
          </div>
        </div>
        <div class="mobile-candidate-metrics">
          <div>
            <span>经历证据</span>
            <strong>${valueAssessment ? `${valueAssessment.index} · ${escapeHtml(valueAssessment.level)}` : "待生成"}</strong>
          </div>
          <div>
            <span>评价项覆盖</span>
            <strong>${candidate.evaluation.matchedCount}/${candidate.evaluation.totalCriteria}</strong>
          </div>
          <div>
            <span>硬性条件</span>
            <strong class="gate-pill ${gateClass(candidate.evaluation)}">${escapeHtml(gate)}</strong>
          </div>
        </div>
        <div class="mobile-candidate-footer">
          <span class="status-pill status-${escapeAttr(candidate.reviewStatus)}">${escapeHtml(STATUS_LABELS[candidate.reviewStatus] || candidate.reviewStatus)}</span>
          <div class="mobile-candidate-actions">
            ${retryButton}
            <button type="button" class="button button-secondary button-small" data-open-candidate="${escapeAttr(candidate.id)}">查看证据</button>
          </div>
        </div>
      </article>
    `);
    return `
      <tr data-candidate-id="${escapeAttr(candidate.id)}" tabindex="0">
        <td><span class="rank-number">${String(candidate.rank).padStart(2, "0")}</span></td>
        <td class="candidate-cell">
          <div class="candidate-name-line">
            <strong>
              <button type="button" class="candidate-name-button" data-view-resume="${escapeAttr(candidate.id)}" aria-label="查看 ${escapeAttr(candidate.profile?.name || "候选人")} 的原简历">
                ${escapeHtml(candidate.profile?.name || "未命名候选人")}
              </button>
              ${aiBadge} ${extractionBadge} ${duplicate}
            </strong>
            ${retryButton}
          </div>
          <small>${escapeHtml(profileLine || candidate.fileName)}</small>
        </td>
        <td><span class="score">${candidate.evaluation.score}</span></td>
        <td>${valueAssessment
          ? `<span class="experience-value-pill">${valueAssessment.index} · ${escapeHtml(valueAssessment.level)}</span>`
          : '<span class="helper">待生成</span>'}</td>
        <td><span class="gate-pill ${gateClass(candidate.evaluation)}">${escapeHtml(gate)}</span></td>
        <td>
          <div class="coverage">
            <span class="coverage-track"><i class="coverage-fill" style="width:${coverage}%"></i></span>
            <span>${candidate.evaluation.matchedCount}/${candidate.evaluation.totalCriteria}</span>
          </div>
        </td>
        <td><span class="status-pill status-${escapeAttr(candidate.reviewStatus)}">${escapeHtml(STATUS_LABELS[candidate.reviewStatus] || candidate.reviewStatus)}</span></td>
      </tr>
    `;
  }).join("");
  cardList.innerHTML = cards.join("");
}

function renderMatrix(candidates) {
  const criteria = currentJob()?.criteria || [];
  $("#matrix-head").innerHTML = `
    <tr>
      <th>候选人</th>
      ${criteria.map((criterion) => `<th title="${escapeAttr(criterion.name)}">${escapeHtml(criterion.name)}</th>`).join("")}
      <th>分数</th>
    </tr>
  `;
  $("#matrix-body").innerHTML = candidates.map((candidate) => `
    <tr data-candidate-id="${escapeAttr(candidate.id)}" tabindex="0" aria-label="查看 ${escapeAttr(candidate.profile?.name || candidate.fileName)} 的证据">
      <td>
        <button type="button" class="candidate-name-button" data-view-resume="${escapeAttr(candidate.id)}" aria-label="查看 ${escapeAttr(candidate.profile?.name || candidate.fileName)} 的原简历">
          ${escapeHtml(candidate.profile?.name || candidate.fileName)}
        </button>
      </td>
      ${(candidate.evaluation.criteriaResults || []).map((result) => `
        <td title="${escapeAttr(result.evidence[0]?.quote || result.status)}">
          <span class="level-chip ${escapeAttr(result.level)} ${result.override ? "has-override" : ""}">${escapeHtml(result.level === "none" ? "—" : LEVEL_OPTIONS.find(([value]) => value === result.level)?.[1])}</span>
        </td>
      `).join("")}
      <td><span class="score">${candidate.evaluation.score}</span></td>
    </tr>
  `).join("");
}

function openDrawerShell() {
  $("#drawer-backdrop").hidden = false;
  $("#candidate-drawer").classList.add("is-open");
  $("#candidate-drawer").setAttribute("aria-hidden", "false");
  document.body.classList.add("has-open-drawer");
  setAppInert(true);
  requestAnimationFrame(() => $("#drawer-close-button").focus({ preventScroll: true }));
}

function closeDrawer() {
  const returnCandidateId = state.drawerReturnCandidateId;
  const returnFocusElement = state.drawerReturnFocusElement;
  state.drawerCandidateId = null;
  state.drawerReturnCandidateId = null;
  state.drawerReturnFocusElement = null;
  $("#drawer-backdrop").hidden = true;
  $("#candidate-drawer").classList.remove("is-open");
  $("#candidate-drawer").setAttribute("aria-hidden", "true");
  document.body.classList.remove("has-open-drawer");
  if (!tourState.active) setAppInert(false);
  requestAnimationFrame(() => {
    if (returnFocusElement?.isConnected && returnFocusElement.getClientRects().length) {
      returnFocusElement.focus({ preventScroll: true });
      return;
    }
    const matches = returnCandidateId
      ? $$(`[data-candidate-id="${CSS.escape(returnCandidateId)}"]`)
      : [];
    const visibleTarget = matches.find((element) => element.getClientRects().length > 0);
    const focusTarget = visibleTarget?.querySelector("[data-open-candidate]")
      || (visibleTarget?.tabIndex >= 0 ? visibleTarget : null);
    (focusTarget || $(".nav-item.is-active") || $("#help-button"))?.focus({ preventScroll: true });
  });
}

function openResumePreviewShell(returnFocusElement) {
  state.resumePreviewReturnFocusElement = returnFocusElement || document.activeElement;
  $("#resume-preview-backdrop").hidden = false;
  $("#resume-preview").hidden = false;
  $("#resume-preview").setAttribute("aria-hidden", "false");
  document.body.classList.add("has-open-resume");
  setAppInert(true);
  requestAnimationFrame(() => $("#resume-preview-close").focus({ preventScroll: true }));
}

function closeResumePreview() {
  const returnFocus = state.resumePreviewReturnFocusElement;
  state.resumePreviewCandidateId = null;
  state.resumePreviewReturnFocusElement = null;
  state.resumePreviewText = "";
  $("#resume-preview").hidden = true;
  $("#resume-preview").setAttribute("aria-hidden", "true");
  $("#resume-preview-backdrop").hidden = true;
  $("#resume-preview-search").value = "";
  document.body.classList.remove("has-open-resume");
  if (!tourState.active && !$("#candidate-drawer").classList.contains("is-open")) {
    setAppInert(false);
  }
  requestAnimationFrame(() => {
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    else $("#ranking-body [data-view-resume]")?.focus({ preventScroll: true });
  });
}

async function openResumePreview(candidateId, returnFocusElement) {
  if (!candidateId || !state.editingJobId) return;
  state.resumePreviewCandidateId = candidateId;
  openResumePreviewShell(returnFocusElement);
  $("#resume-preview-title").textContent = "正在读取简历原文";
  $("#resume-preview-subtitle").textContent = "";
  $("#resume-preview-count").textContent = "";
  $("#resume-preview-document").innerHTML = '<div class="evidence-empty">正在读取候选人解析原文…</div>';
  try {
    const result = await api(
      `/api/jobs/${encodeURIComponent(state.editingJobId)}/candidates/${encodeURIComponent(candidateId)}`,
    );
    if (state.resumePreviewCandidateId !== candidateId) return;
    const candidate = result.candidate;
    state.resumePreviewText = candidate.text || "";
    $("#resume-preview-title").textContent = candidate.profile?.name || candidate.fileName || "简历原文";
    $("#resume-preview-subtitle").textContent = [
      candidate.fileName,
      candidate.extractionMethod,
      candidate.profile?.title,
    ].filter(Boolean).join(" · ");
    renderResumePreview();
  } catch (error) {
    $("#resume-preview-title").textContent = "无法读取简历原文";
    $("#resume-preview-document").innerHTML = `<div class="evidence-empty">${escapeHtml(error.message)}</div>`;
  }
}

function resumeHighlight(line, query) {
  if (!query) return escapeHtml(line);
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = String(line).split(new RegExp(`(${escapedQuery})`, "gi"));
  return parts.map((part) => (
    part.toLocaleLowerCase() === query.toLocaleLowerCase()
      ? `<mark>${escapeHtml(part)}</mark>`
      : escapeHtml(part)
  )).join("");
}

function renderResumePreview() {
  const query = $("#resume-preview-search").value.trim();
  const text = state.resumePreviewText || "";
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const matches = query
    ? lines.filter((line) => line.toLocaleLowerCase().includes(query.toLocaleLowerCase())).length
    : 0;
  $("#resume-preview-count").textContent = query
    ? `${lines.length} 行 · ${matches} 处匹配`
    : `${lines.length} 行 · ${text.length} 字`;
  $("#resume-preview-document").innerHTML = lines.map((line, index) => `
    <div class="resume-line ${query && line.toLocaleLowerCase().includes(query.toLocaleLowerCase()) ? "is-match" : ""}">
      <span>${String(index + 1).padStart(4, "0")}</span>
      <code>${resumeHighlight(line || " ", query)}</code>
    </div>
  `).join("");
  if (query) {
    const firstMatch = $(".resume-line.is-match", $("#resume-preview-document"));
    firstMatch?.scrollIntoView({ block: "center" });
  } else {
    $(".resume-preview-scroll").scrollTop = 0;
  }
}

function renderExperienceIntelligence(candidate) {
  const intelligence = candidate.intelligence;
  if (!intelligence?.valueAssessment) {
    return '<div class="evidence-empty">该候选人还没有生成经历证据卡。完成一次 Agent 分析后会显示。</div>';
  }
  const value = intelligence.valueAssessment;
  const entities = intelligence.entities || [];
  const matches = intelligence.knowledgeMatches || [];
  return `
    <div class="experience-card">
      <div class="experience-card-head">
        <div>
          <span>EXPERIENCE EVIDENCE</span>
          <strong>${escapeHtml(value.level)}</strong>
        </div>
        <div class="experience-index">${value.index}<small>/100</small></div>
      </div>
      <div class="value-dimension-list">
        ${(value.dimensions || []).map((dimension) => `
          <div class="value-dimension-row">
            <span>${escapeHtml(dimension.label)}</span>
            <div class="value-bar" title="${escapeAttr(dimension.note || "")}"><i style="width:${dimension.score == null ? 0 : clamp(dimension.score, 0, 100)}%"></i></div>
            <strong>${dimension.score == null ? "N/A" : dimension.score}</strong>
          </div>
        `).join("")}
      </div>
      <p class="experience-disclaimer">${escapeHtml(value.disclaimer || "")}</p>
    </div>
    <div class="entity-chip-list" style="margin-top:12px">
      ${entities.slice(0, 12).map((entity) => `<span class="entity-chip"><strong>${escapeHtml(entity.type)}</strong> ${escapeHtml(entity.name)}</span>`).join("") || '<span class="helper">未识别到公司、团队、学校、论文或专利实体</span>'}
    </div>
    ${matches.length ? `
      <div style="margin-top:14px">
        ${matches.slice(0, 5).map((match) => `
          <div class="knowledge-citation">
            <strong>${escapeHtml(match.title)}</strong>
            <p>${escapeHtml(match.snippet)}</p>
            <small>${escapeHtml(match.sourceLabel || "未指定来源")} · ${escapeHtml(match.publishedAt || "无日期")}${match.synthetic ? " · 虚构演示资料" : ""}</small>
            ${safeExternalUrl(match.sourceUrl) ? `<a class="knowledge-source-link" href="${escapeAttr(safeExternalUrl(match.sourceUrl))}" target="_blank" rel="noreferrer">查看公开来源 ↗</a>` : ""}
          </div>
        `).join("")}
      </div>
    ` : '<div class="evidence-empty" style="margin-top:12px">当前知识库没有检索到可用于背景佐证的资料。</div>'}
  `;
}

async function openCandidate(candidateId, options = {}) {
  const shouldOpenShell = options.shell !== false
    && !$("#candidate-drawer").classList.contains("is-open");
  state.drawerCandidateId = candidateId;
  if (shouldOpenShell) {
    state.drawerReturnCandidateId = candidateId;
    state.drawerReturnFocusElement = options.returnFocusElement || document.activeElement;
    openDrawerShell();
  }
  if (options.quiet !== true) {
    $("#drawer-content").innerHTML = '<div class="evidence-empty">正在读取证据卡…</div>';
  }
  try {
    const result = await api(`/api/jobs/${encodeURIComponent(state.editingJobId)}/candidates/${encodeURIComponent(candidateId)}`);
    renderCandidateDrawer(result.candidate);
  } catch (error) {
    $("#drawer-content").innerHTML = `<div class="evidence-empty">${escapeHtml(error.message)}</div>`;
  }
}

function renderCandidateDrawer(candidate) {
  const evaluation = candidate.evaluation;
  const warnings = candidate.warnings || [];
  const aiConfigured = Boolean(state.data?.ai?.configured);
  const aiStatus = candidate.aiStatus || "disabled";
  const agentTrace = candidate.aiAnalysis?.agentTrace || candidate.agentTrace || [];
  const aiPanel = aiStatus === "processing" || aiStatus === "pending"
    ? `<div class="ai-analysis-panel"><strong>4-Agent 流水线正在执行</strong><br>当前分数仍使用关键词基线，全部 Agent 完成后会自动刷新并重新计算。</div>`
    : aiStatus === "complete"
      ? `<div class="ai-analysis-panel"><strong>4-Agent 证据审计已完成</strong><br>结构化、匹配、审计和摘要分别执行；只有能在简历中逐字定位的引用才会参与评分。</div>`
      : aiStatus === "stale"
        ? `<div class="ai-analysis-panel"><strong>评价卡已变化，旧 AI 证据已停用</strong><br>当前分数已回退到关键词基线。点击下方按钮按最新标准重新分析。</div>`
      : aiStatus === "error"
        ? `<div class="ai-analysis-panel error"><strong>模型分析失败，已回退</strong><br>${escapeHtml(candidate.aiError || "当前使用关键词基线结果")}</div>`
        : `<div class="ai-analysis-panel"><strong>规则基线</strong><br>${aiConfigured ? "尚未用模型 Agent 分析这份简历。" : "未配置模型，当前只使用关键词证据匹配。"}</div>`;
  $("#drawer-title").textContent = candidate.profile?.name || "未命名候选人";
  $("#drawer-subtitle").textContent = [
    candidate.fileName,
    candidate.extractionMethod,
    candidate.extractionQuality ? `OCR ${candidate.extractionQuality.score}/100` : "",
    candidate.profile?.email,
    candidate.profile?.phone,
  ].filter(Boolean).join(" · ");

  $("#drawer-content").innerHTML = `
    <div class="drawer-summary">${escapeHtml(candidate.summary?.headline || "暂无可用摘要")}</div>
    <div class="drawer-interview-launch">
      <button type="button" class="button button-secondary button-small" data-open-web-interview="${escapeAttr(candidate.id)}">发起网页 AI 初筛</button>
      <span>浏览器语音 · 不保存录音</span>
    </div>
    ${aiPanel}
    ${agentTrace.length ? `
      <div class="agent-trace">
        ${agentTrace.map((agent, index) => `
          <div class="agent-step is-${escapeAttr(agent.status)}">
            <span class="agent-index">${String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>${escapeHtml(agent.name)}</strong>
              <small>${escapeHtml(agent.status === "running" ? agent.role : agent.error || agent.role)}</small>
            </div>
            <span class="agent-state">${escapeHtml(AGENT_STATUS_LABELS[agent.status] || agent.status)}${agent.durationMs != null ? ` · ${(agent.durationMs / 1000).toFixed(1)}s` : ""}</span>
          </div>
        `).join("")}
      </div>
    ` : ""}
    <div class="drawer-stats">
      <div class="drawer-stat"><span>匹配分</span><strong>${evaluation.score}</strong></div>
      <div class="drawer-stat"><span>评价项覆盖</span><strong>${evaluation.matchedCount}/${evaluation.totalCriteria}</strong></div>
      <div class="drawer-stat"><span>证据条数</span><strong>${evaluation.evidenceCount}</strong></div>
    </div>
    <section class="drawer-section">
      <h3>经历含金量证据卡</h3>
      ${renderExperienceIntelligence(candidate)}
    </section>
    <section class="drawer-section">
      <h3>面试追问建议</h3>
      ${(candidate.intelligence?.interviewQuestions || []).length
        ? candidate.intelligence.interviewQuestions.map((item) => `
          <div class="interview-question">
            <strong>${escapeHtml(item.question)}</strong>
            <small>${escapeHtml(item.reason || "")}${item.sourceIds?.length ? ` · 来源 ${escapeHtml(item.sourceIds.join(", "))}` : ""}</small>
          </div>
        `).join("")
        : '<div class="evidence-empty">暂无面试追问建议。</div>'}
    </section>
    <section class="drawer-section">
      <h3>网页 AI 初筛记录</h3>
      ${(candidate.webInterviews || []).length ? `
        <div class="web-interview-history">
          ${candidate.webInterviews.map((interview) => `
            <article>
              <div>
                <strong>${escapeHtml(
                  interview.status === "declined"
                    ? "候选人未同意继续"
                    : interview.status === "follow_up_required"
                      ? "需要重新安排"
                      : "完成网页 AI 初筛",
                )}</strong>
                <span>${escapeHtml(formatDateTime(interview.endedAt || interview.createdAt))} · ${Math.max(1, Math.round((interview.durationSec || 0) / 60))} 分钟</span>
              </div>
              <p>${escapeHtml(interview.summary || "")}</p>
              <small>不保存录音 · ${interview.answers?.length || 0} 条岗位问题回答</small>
            </article>
          `).join("")}
        </div>
      ` : '<div class="evidence-empty">尚未发起网页 AI 初筛。</div>'}
    </section>
    ${warnings.length ? `<div class="warning-list">${warnings.map((warning) => `<div class="warning-item">${escapeHtml(warning)}</div>`).join("")}</div>` : ""}
    <section class="drawer-section">
      <h3>人工审核</h3>
      ${aiConfigured ? `
        <div class="ai-analysis-actions">
          <span class="helper">重新分析会覆盖上一次自动证据，但不会删除人工覆盖。</span>
          <button type="button" class="button button-quiet button-small analyze-candidate-button" ${aiStatus === "processing" || aiStatus === "pending" ? "disabled" : ""}>
            ${aiStatus === "processing" || aiStatus === "pending" ? "分析中…" : "重新运行 Agent 分析"}
          </button>
        </div>
      ` : ""}
      <div class="review-row">
        <label for="drawer-reviewer">审核人</label>
        <input id="drawer-reviewer" type="text" maxlength="120" value="${escapeAttr(candidate.reviewedBy || "")}" placeholder="例如：HR 张敏">
        <label for="drawer-review-status">审核状态</label>
        <select id="drawer-review-status">
          ${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${candidate.reviewStatus === value ? "selected" : ""}>${label}</option>`).join("")}
        </select>
        <label for="drawer-review-note">审核备注</label>
        <textarea id="drawer-review-note" rows="3" maxlength="2000" placeholder="记录判断依据、待确认信息或例外原因">${escapeHtml(candidate.reviewNote || "")}</textarea>
      </div>
    </section>
    <section class="drawer-section">
      <h3>决策审计记录</h3>
      ${(candidate.auditHistory || []).length ? `
        <div class="audit-timeline">
          ${[...candidate.auditHistory].reverse().map((event) => `
            <article class="audit-event">
              <span class="audit-event-dot" aria-hidden="true"></span>
              <div>
                <strong>${escapeHtml(event.summary || event.action)}</strong>
                <p>${escapeHtml(event.actor || "system")} · ${escapeHtml(AUDIT_ACTION_LABELS[event.action] || event.action || "更新")}</p>
                <time datetime="${escapeAttr(event.at || "")}">${escapeHtml(formatDateTime(event.at))}</time>
              </div>
            </article>
          `).join("")}
        </div>
      ` : '<div class="evidence-empty">暂无审计记录。</div>'}
    </section>
    <section class="drawer-section">
      <h3>评价项证据</h3>
      ${evaluation.criteriaResults.map((result) => `
        <div class="evidence-item" data-criterion-id="${escapeAttr(result.id)}" data-detected-level="${escapeAttr(result.detectedLevel)}">
          <div class="evidence-top">
            <strong>${escapeHtml(result.name)} ${result.required ? '<span class="gate-pill fail">硬性</span>' : ""}</strong>
            <select class="override-select" aria-label="${escapeAttr(result.name)}覆盖等级">
              <option value="">自动</option>
              ${LEVEL_OPTIONS.map(([value, label]) => `<option value="${value}" ${result.override?.level === value ? "selected" : ""}>${label}</option>`).join("")}
            </select>
          </div>
          ${result.evidence.length
            ? result.evidence.map((evidence) => `
              <blockquote class="evidence-quote">${escapeHtml(evidence.quote)}</blockquote>
              <div class="evidence-meta">
                <span>原文第 ${evidence.line} 行</span>
                <span>${result.matchSource === "llm"
                  ? "模型证据已校验"
                  : result.matchSource === "human"
                    ? "人工覆盖"
                    : evidence.polarity === "negative"
                      ? `否定表述：${escapeHtml(evidence.matchedKeyword)}`
                      : `命中：${escapeHtml(evidence.matchedKeyword)}`}</span>
                <span>置信度 ${Math.round(result.confidence * 100)}%</span>
              </div>
            `).join("")
            : `<div class="evidence-empty">${result.status === "absent"
              ? "简历中有明确否定表述，系统将其视为“明确不具备”。"
              : "简历中未发现该评价项的关键词证据。系统将其视为“未提及”，不直接视为“不具备”。"}</div>`}
          ${result.reasoning ? `<div class="evidence-meta"><span>理由：${escapeHtml(result.reasoning)}</span></div>` : ""}
          <input class="override-note" type="text" maxlength="300" value="${escapeAttr(result.override?.note || "")}" placeholder="人工覆盖说明（可选）">
        </div>
      `).join("")}
    </section>
    <section class="drawer-section">
      <h3>提取原文</h3>
      <pre class="raw-resume">${escapeHtml(candidate.text || "")}</pre>
    </section>
  `;
}

async function saveCandidateReview() {
  if (!state.drawerCandidateId) return;
  const overrides = {};
  $$(".evidence-item", $("#drawer-content")).forEach((item) => {
    const level = $(".override-select", item).value;
    if (!level) return;
    overrides[item.dataset.criterionId] = {
      level,
      note: $(".override-note", item).value.trim(),
    };
  });
  const button = $("#drawer-save-button");
  button.disabled = true;
  button.textContent = "保存中…";
  try {
    await api(`/api/jobs/${encodeURIComponent(state.editingJobId)}/candidates/${encodeURIComponent(state.drawerCandidateId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        reviewer: $("#drawer-reviewer").value.trim(),
        reviewStatus: $("#drawer-review-status").value,
        reviewNote: $("#drawer-review-note").value.trim(),
        overrides,
      }),
    });
    const candidateId = state.drawerCandidateId;
    await loadState({ preserveDraft: true });
    await openCandidate(candidateId);
    toast("人工审核结果已保存");
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "保存人工调整";
  }
}

async function analyzeCandidateAgain() {
  if (!state.drawerCandidateId) return;
  const button = $(".analyze-candidate-button", $("#drawer-content"));
  if (button) {
    button.disabled = true;
    button.textContent = "提交中…";
  }
  try {
    await api(`/api/jobs/${encodeURIComponent(state.editingJobId)}/candidates/${encodeURIComponent(state.drawerCandidateId)}/analyze`, {
      method: "POST",
      body: "{}",
    });
    await loadState({ preserveDraft: true });
    await openCandidate(state.drawerCandidateId, { shell: false });
    toast("已提交 Agent 分析，完成后会自动刷新");
  } catch (error) {
    toast(error.message, true);
    if (button) {
      button.disabled = false;
      button.textContent = "重新运行 Agent 分析";
    }
  }
}

async function reanalyzeCandidateById(candidateId, button) {
  if (!candidateId || !state.data?.ai?.configured) return;
  const originalText = button?.textContent || "重试";
  if (button) {
    button.disabled = true;
    button.textContent = "提交中…";
  }
  try {
    await api(`/api/jobs/${encodeURIComponent(state.editingJobId)}/candidates/${encodeURIComponent(candidateId)}/analyze`, {
      method: "POST",
      body: "{}",
    });
    await loadState({ preserveDraft: true });
    toast("已提交重新分析，完成后会自动刷新");
  } catch (error) {
    toast(error.message, true);
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

async function deleteCandidate() {
  if (!state.drawerCandidateId) return;
  const name = $("#drawer-title").textContent;
  if (!window.confirm(`确定移除“${name}”及其本地简历原文吗？此操作不可恢复。`)) return;
  try {
    await api(`/api/jobs/${encodeURIComponent(state.editingJobId)}/candidates/${encodeURIComponent(state.drawerCandidateId)}`, {
      method: "DELETE",
    });
    closeDrawer();
    await loadState({ preserveDraft: true });
    toast("候选人已移除");
  } catch (error) {
    toast(error.message, true);
  }
}

async function resetDemoWorkspaceFromUi() {
  if (state.isImporting) {
    toast("请等待当前简历导入完成后再重置演示数据", true);
    return;
  }
  const confirmed = window.confirm(
    "将清除当前活动记录，并恢复标准演示岗位、候选人、审核状态和知识库。原数据会先备份到 data/backups。是否继续？",
  );
  if (!confirmed) return;

  const button = $("#demo-reset-button");
  button.disabled = true;
  button.textContent = "正在重置…";
  try {
    invalidateStateRefreshes();
    if ($("#candidate-drawer").classList.contains("is-open")) closeDrawer();
    if (!$("#resume-preview").hidden) closeResumePreview();
    resetInterviewPage();
    $("#candidate-search").value = "";
    $("#status-filter").value = "all";
    $("#duplicate-filter").checked = false;
    state.resultView = "ranking";
    $$(".segmented [data-result-view]").forEach((item) => {
      const selected = item.dataset.resultView === "ranking";
      item.classList.toggle("is-active", selected);
      item.setAttribute("aria-selected", String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    const result = await api("/api/demo/reset", {
      method: "POST",
      body: "{}",
    });
    state.pendingFiles = [];
    state.jobDirty = false;
    if (result.state) {
      applyStateSnapshot(result.state);
    } else {
      await loadState();
    }
    switchView("job", false);
    toast(
      result.backupPath
        ? `演示数据已重置，原数据已备份至 ${result.backupPath}`
        : "演示数据已重置",
    );
  } catch (error) {
    scheduleAiPolling();
    toast(`重置演示失败：${error.message}`, true);
  } finally {
    button.disabled = false;
    button.textContent = "↺ 重置演示数据";
  }
}

function bindEvents() {
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
  $("#help-button").addEventListener("click", startHelpTour);
  $("#tour-close-button").addEventListener("click", closeHelpTour);
  $("#tour-skip-button").addEventListener("click", closeHelpTour);
  $("#tour-prev-button").addEventListener("click", () => moveTour(-1));
  $("#tour-next-button").addEventListener("click", () => moveTour(1));
  $("#new-job-button").addEventListener("click", startNewJob);
  $("#intro-skip").addEventListener("click", revealIntroSequence);
  $("#demo-reset-button").addEventListener("click", resetDemoWorkspaceFromUi);
  $("#job-empty").addEventListener("click", startNewJob);
  $("#interview-candidate-select").addEventListener("change", (event) => {
    if (!["idle", "completed", "failed"].includes(webInterview.status)) return;
    webInterview.status = "idle";
    webInterview.candidateId = event.target.value;
    webInterview.plan = null;
    webInterview.startedAt = null;
    webInterview.endedAt = null;
    webInterview.transcript = [];
    webInterview.answers = [];
    $("#interview-consent").checked = false;
    $("#interview-report-panel").hidden = true;
    renderInterviewPage();
  });
  $("#interview-consent").addEventListener("change", renderInterviewPage);
  $("#interview-start-button").addEventListener("click", startWebInterview);
  $("#phone-pairing-button").addEventListener("click", startPhonePairing);
  $("#phone-pair-close").addEventListener("click", closePhonePairing);
  $("#phone-pair-cancel").addEventListener("click", closePhonePairing);
  $("#phone-pair-backdrop").addEventListener("click", closePhonePairing);
  $("#interview-mic-button").addEventListener("click", toggleInterviewMic);
  $("#interview-submit-answer-button").addEventListener("click", submitInterviewAnswer);
  $("#interview-end-button").addEventListener("click", () => {
    if (window.confirm("确定结束本次网页初筛吗？已有回答会保存。")) {
      finishWebInterview({ reason: "manual_end" });
    }
  });
  $("#interview-restart-button").addEventListener("click", resetInterviewPage);
  $("#interview-view-candidate-button").addEventListener("click", () => {
    if (webInterview.candidateId) openCandidate(webInterview.candidateId);
  });
  $("#interview-answer-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      submitInterviewAnswer();
    }
  });
  $("#workflow-guide-action").addEventListener("click", (event) => {
    handleWorkflowGuideAction(event.currentTarget.dataset.guideAction);
  });
  $("#job-switcher").addEventListener("change", (event) => switchJob(event.target.value));
  $("#job-form").addEventListener("submit", saveJob);
  $("#suggest-button").addEventListener("click", suggestCriteria);
  $("#add-criterion-button").addEventListener("click", () => addCriterion());
  $("#job-title").addEventListener("input", () => setJobDirty(true));
  $("#job-description").addEventListener("input", () => setJobDirty(true));
  $("#criteria-list").addEventListener("input", () => setJobDirty(true));
  $("#criteria-list").addEventListener("change", () => setJobDirty(true));
  $("#criteria-list").addEventListener("click", (event) => {
    const remove = event.target.closest(".remove-criterion");
    if (!remove) return;
    state.criteria = collectCriteriaFromForm();
    const row = remove.closest(".criterion-row");
    state.criteria.splice(Number(row.dataset.index), 1);
    renderCriteria();
    setJobDirty(true);
  });

  const dropZone = $("#drop-zone");
  const fileInput = $("#file-input");
  dropZone.addEventListener("click", () => {
    if (state.isImporting) {
      toast("当前批次仍在解析，请稍后再添加文件", true);
      return;
    }
    fileInput.click();
  });
  dropZone.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (state.isImporting) {
      toast("当前批次仍在解析，请稍后再添加文件", true);
      return;
    }
    fileInput.click();
  });
  fileInput.addEventListener("change", () => {
    addPendingFiles(fileInput.files);
    fileInput.value = "";
  });

  ["dragenter", "dragover"].forEach((type) => dropZone.addEventListener(type, (event) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setFileDragActive(true);
  }));
  dropZone.addEventListener("dragleave", (event) => {
    if (dropZone.contains(event.relatedTarget)) return;
    setFileDragActive(false);
  });
  dropZone.addEventListener("drop", (event) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    setFileDragActive(false);
    receiveDroppedFiles(event.dataTransfer.files);
  });

  ["dragenter", "dragover"].forEach((type) => window.addEventListener(type, (event) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!document.body.classList.contains("is-file-dragging") && state.currentView !== "import") {
      switchView("import", false);
    }
    setFileDragActive(true);
  }));
  window.addEventListener("dragleave", (event) => {
    if (!event.relatedTarget) setFileDragActive(false);
  });
  window.addEventListener("drop", (event) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    setFileDragActive(false);
    if (!event.target.closest?.("#drop-zone")) {
      receiveDroppedFiles(event.dataTransfer.files);
    }
  });
  window.addEventListener("dragend", () => setFileDragActive(false));
  $("#pending-files").addEventListener("click", (event) => {
    const remove = event.target.closest("[data-remove-file]");
    if (!remove || state.isImporting) return;
    state.pendingFiles.splice(Number(remove.dataset.removeFile), 1);
    renderImportPage();
  });
  $("#clear-files-button").addEventListener("click", () => {
    if (state.isImporting) return;
    state.pendingFiles = [];
    renderImportPage();
  });
  $("#import-button").addEventListener("click", importFiles);
  $("#cancel-import-button").addEventListener("click", cancelImport);
  $("#paste-import-button").addEventListener("click", importPastedResume);
  $("#go-review-button").addEventListener("click", () => switchView("review"));
  $("#empty-import-button").addEventListener("click", () => switchView("import"));
  $("#knowledge-search-button").addEventListener("click", searchKnowledge);
  $("#knowledge-search-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchKnowledge();
    }
  });
  $("#add-knowledge-button").addEventListener("click", addKnowledgeDocument);
  $("#import-knowledge-pack-button").addEventListener("click", () => $("#knowledge-pack-input").click());
  $("#knowledge-pack-input").addEventListener("change", importKnowledgePack);
  $("#knowledge-document-list").addEventListener("click", (event) => {
    const remove = event.target.closest("[data-delete-knowledge]");
    if (remove) deleteKnowledgeDocument(remove.dataset.deleteKnowledge);
  });

  $("#candidate-search").addEventListener("input", renderReviewPage);
  $("#status-filter").addEventListener("change", renderReviewPage);
  $("#duplicate-filter").addEventListener("change", renderReviewPage);
  $$(".segmented [data-result-view]").forEach((button) => button.addEventListener("click", () => {
    state.resultView = button.dataset.resultView;
    $$(".segmented [data-result-view]").forEach((item) => {
      const selected = item === button;
      item.classList.toggle("is-active", selected);
      item.setAttribute("aria-selected", String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    renderReviewPage();
  }));
  $(".segmented").addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = $$(".segmented [data-result-view]");
    const currentIndex = tabs.indexOf(document.activeElement);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault();
    tabs[nextIndex].focus();
    tabs[nextIndex].click();
  });
  $("#ranking-body").addEventListener("click", (event) => {
    const retry = event.target.closest("[data-retry-candidate]");
    if (retry) {
      event.stopPropagation();
      reanalyzeCandidateById(retry.dataset.retryCandidate, retry);
      return;
    }
    const resumeButton = event.target.closest("[data-view-resume]");
    if (resumeButton) {
      event.stopPropagation();
      openResumePreview(resumeButton.dataset.viewResume, resumeButton);
      return;
    }
    const row = event.target.closest("[data-candidate-id]");
    if (row) openCandidate(row.dataset.candidateId, { returnFocusElement: row });
  });
  $("#ranking-body").addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target.closest("button, input, select, textarea, a")) return;
    const row = event.target.closest("[data-candidate-id]");
    if (row) {
      event.preventDefault();
      openCandidate(row.dataset.candidateId, { returnFocusElement: row });
    }
  });
  $("#ranking-card-list").addEventListener("click", (event) => {
    const retry = event.target.closest("[data-retry-candidate]");
    if (retry) {
      event.stopPropagation();
      reanalyzeCandidateById(retry.dataset.retryCandidate, retry);
      return;
    }
    const resumeButton = event.target.closest("[data-view-resume]");
    if (resumeButton) {
      event.stopPropagation();
      openResumePreview(resumeButton.dataset.viewResume, resumeButton);
      return;
    }
    const card = event.target.closest("[data-candidate-id]");
    if (card) {
      openCandidate(card.dataset.candidateId, {
        returnFocusElement: event.target.closest("[data-open-candidate]") || card,
      });
    }
  });
  $("#matrix-body").addEventListener("click", (event) => {
    const resumeButton = event.target.closest("[data-view-resume]");
    if (resumeButton) {
      event.stopPropagation();
      openResumePreview(resumeButton.dataset.viewResume, resumeButton);
      return;
    }
    const row = event.target.closest("[data-candidate-id]");
    if (row) openCandidate(row.dataset.candidateId, { returnFocusElement: row });
  });
  $("#matrix-body").addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target.closest("button, input, select, textarea, a")) return;
    const row = event.target.closest("[data-candidate-id]");
    if (row) {
      event.preventDefault();
      openCandidate(row.dataset.candidateId, { returnFocusElement: row });
    }
  });
  $("#drawer-close-button").addEventListener("click", closeDrawer);
  $("#drawer-backdrop").addEventListener("click", closeDrawer);
  $("#resume-preview-close").addEventListener("click", closeResumePreview);
  $("#resume-preview-backdrop").addEventListener("click", closeResumePreview);
  $("#resume-preview-search").addEventListener("input", renderResumePreview);
  $("#resume-preview-copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(state.resumePreviewText);
      toast("简历原文已复制");
    } catch {
      toast("复制失败，请手动选择文本", true);
    }
  });
  $("#drawer-save-button").addEventListener("click", saveCandidateReview);
  $("#drawer-delete-button").addEventListener("click", deleteCandidate);
  $("#drawer-content").addEventListener("click", (event) => {
    const interviewButton = event.target.closest("[data-open-web-interview]");
    if (interviewButton) {
      webInterview.candidateId = interviewButton.dataset.openWebInterview;
      webInterview.plan = null;
      webInterview.status = "idle";
      $("#interview-consent").checked = false;
      closeDrawer();
      switchView("interview");
      return;
    }
    if (event.target.closest(".analyze-candidate-button")) analyzeCandidateAgain();
  });
  $("#export-button").addEventListener("click", () => {
    if (!state.editingJobId) {
      toast("当前没有可导出的岗位", true);
      return;
    }
    window.location.href = `/api/jobs/${encodeURIComponent(state.editingJobId)}/export.csv`;
  });
  $("#reanalyze-all-button").addEventListener("click", reanalyzeAllCandidates);
  document.addEventListener("keydown", (event) => {
    if (introState.active) {
      if (event.key === "Tab") {
        trapFocus(event, $("#intro-sequence"));
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        revealIntroSequence();
      }
      return;
    }
    if (tourState.active) {
      if (event.key === "Tab") {
        trapFocus(event, $("#tour-card"));
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeHelpTour();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        moveTour(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveTour(-1);
      }
      return;
    }
    if (!$("#resume-preview").hidden) {
      if (event.key === "Tab") return trapFocus(event, $("#resume-preview"));
      if (event.key === "Escape") {
        event.preventDefault();
        closeResumePreview();
      }
      return;
    }
    if (!$("#phone-pair-modal").hidden) {
      if (event.key === "Tab") return trapFocus(event, $("#phone-pair-modal"));
      if (event.key === "Escape") {
        event.preventDefault();
        closePhonePairing();
      }
      return;
    }
    if ($("#candidate-drawer").classList.contains("is-open")) {
      if (event.key === "Tab") return trapFocus(event, $("#candidate-drawer"));
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
      }
    }
  });
  window.addEventListener("resize", () => {
    renderAiStatus();
    if (tourState.active) {
      const step = TOUR_STEPS[tourState.index];
      const target = $(step.selector);
      if (target) positionTour(target.getBoundingClientRect());
    }
  });
  window.addEventListener("beforeunload", (event) => {
    const activeInterview = webInterview.startedAt && !webInterview.endedAt;
    if (!state.jobDirty && !activeInterview && !phonePairing.active) return;
    event.preventDefault();
    event.returnValue = "";
  });
  window.addEventListener("pagehide", clearInterviewRuntime);
  window.addEventListener("pagehide", () => {
    clearTimeout(introState.revealTimer);
    clearTimeout(introState.finishTimer);
  });
}

async function init() {
  bindEvents();
  try {
    await loadState();
    const initialView = window.location.hash.slice(1);
    if (["job", "import", "knowledge", "review", "interview"].includes(initialView)) switchView(initialView, false);
    const params = new URLSearchParams(window.location.search);
    const forceTour = params.get("tour") === "1";
    const freshDemo = params.get("fresh") === "1";
    const suppressIntro = (!freshDemo && forceTour) || params.get("intro") === "0";
    const shouldTour = forceTour || freshDemo || !hasCompletedHelpTour();
    const shouldPlayIntro = !suppressIntro && (freshDemo || !hasCompletedIntro());
    if (freshDemo || forceTour) {
      params.delete("fresh");
      params.delete("tour");
      const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
      history.replaceState(null, "", cleanUrl);
    }
    if (shouldPlayIntro) {
      await playIntroSequence({ force: freshDemo });
      if (shouldTour) {
        window.setTimeout(() => {
          if (!tourState.active) startHelpTour();
        }, 380);
      }
    } else if (shouldTour) {
      window.setTimeout(() => {
        if (!tourState.active) startHelpTour();
      }, 650);
    }
  } catch (error) {
    toast(`无法读取本地数据：${error.message}`, true);
  }
}

init();
