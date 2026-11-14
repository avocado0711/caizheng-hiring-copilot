"use strict";

const path = require("node:path");
const pptxgen = require("./.ppt-tools/node_modules/pptxgenjs");

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "才证团队";
pptx.company = "才证";
pptx.subject = "AI 赋能招聘与人才挖掘黑客松项目路演";
pptx.title = "才证｜招聘决策台";
pptx.lang = "zh-CN";
pptx.theme = {
  headFontFace: "Noto Sans SC",
  bodyFontFace: "Noto Sans SC",
  lang: "zh-CN",
};

const W = 13.333;
const H = 7.5;
const M = 0.68;
const BG = "F4F3EF";
const WHITE = "FFFFFF";
const INK = "1D1D1F";
const MUTED = "666A70";
const FAINT = "9B9D9F";
const RULE = "C8C7C1";
const BLUE = "0071E3";
const BLUE_SOFT = "E8F2FD";
const GREEN = "248A5B";
const AMBER = "A46511";
const DARK = "111214";
const LOGO = path.resolve(__dirname, "..", "public", "assets", "logo-mark.png");

const FONT = "Noto Sans SC";
const MONO = "Source Code Pro";

function addText(slide, text, x, y, w, h, size = 16, color = INK, options = {}) {
  slide.addText(text, {
    x, y, w, h,
    fontFace: options.fontFace || FONT,
    fontSize: size,
    color,
    bold: Boolean(options.bold),
    margin: options.margin ?? 0,
    breakLine: false,
    valign: options.valign || "top",
    align: options.align || "left",
    charSpacing: options.charSpacing ?? 0,
    lineSpacingMultiple: options.lineSpacingMultiple ?? 1,
    fit: options.fit || "shrink",
    isTextBox: true,
    transparency: options.transparency || 0,
  });
}

function addRule(slide, x, y, w, color = RULE, pt = 0.6) {
  slide.addShape(pptx.ShapeType.line, {
    x, y, w, h: 0,
    line: { color, width: pt },
  });
}

function addRect(slide, x, y, w, h, fill, options = {}) {
  slide.addShape(pptx.ShapeType.rect, {
    x, y, w, h,
    fill: { color: fill, transparency: options.transparency || 0 },
    line: options.line
      ? { color: options.line, width: options.lineWidth || 0.6, transparency: options.lineTransparency || 0 }
      : { color: fill, transparency: 100 },
  });
}

function addCircle(slide, x, y, d, fill, line = fill, lineWidth = 0.8) {
  slide.addShape(pptx.ShapeType.ellipse, {
    x, y, w: d, h: d,
    fill: { color: fill },
    line: { color: line, width: lineWidth },
  });
}

function addPill(slide, text, x, y, w, color = BLUE, options = {}) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h: options.h || 0.28,
    rectRadius: 0.06,
    fill: { color: options.fill || WHITE, transparency: options.fillTransparency || 0 },
    line: { color, width: options.lineWidth || 0.7 },
  });
  addText(slide, text, x + 0.06, y + 0.055, w - 0.12, (options.h || 0.28) - 0.08, options.size || 7.1, color, {
    fontFace: MONO,
    bold: true,
    align: "center",
    charSpacing: 0.7,
  });
}

function addHeader(slide, section, dark = false) {
  const ink = dark ? WHITE : INK;
  const muted = dark ? "9AA9BB" : MUTED;
  slide.background = { color: dark ? DARK : BG };
  slide.addImage({ path: LOGO, x: M, y: 0.27, w: 0.24, h: 0.24 });
  addText(slide, "才证 / 招聘决策台", M + 0.31, 0.27, 3.4, 0.27, 10.5, ink, { bold: true, charSpacing: 0.40 });
  addText(slide, section, 10.85, 0.27, 1.8, 0.22, 7.4, muted, {
    fontFace: MONO,
    align: "right",
    charSpacing: 0.7,
  });
  addRule(slide, M, 0.77, W - M * 2, dark ? "35404C" : RULE, 0.55);
}

function addFooter(slide, page, dark = false) {
  const muted = dark ? "8D9BAD" : MUTED;
  addText(slide, "让每个招聘判断，都有原文证据。", M, H - 0.35, 5.4, 0.18, 7.6, muted, {
    fontFace: MONO,
    charSpacing: 0.45,
  });
  addText(slide, `${String(page).padStart(2, "0")} / 10`, W - M - 1.05, H - 0.35, 1.05, 0.18, 7.6, muted, {
    fontFace: MONO,
    align: "right",
    charSpacing: 0.55,
  });
}

function addTitle(slide, text, options = {}) {
  addText(
    slide,
    text,
    options.x ?? M,
    options.y ?? 1.12,
    options.w ?? 11.8,
    options.h ?? 1.4,
    options.size ?? 35,
    options.color ?? INK,
    {
      bold: options.bold ?? true,
      lineSpacingMultiple: options.lineSpacingMultiple ?? 0.98,
      fit: "shrink",
      charSpacing: options.charSpacing ?? -0.45,
    },
  );
}

function addNotes(slide, text) {
  slide.addNotes(text.trim());
}

function addBody(slide, text, x, y, w, h, size = 14, color = INK, options = {}) {
  addText(slide, text, x, y, w, h, size, color, {
    lineSpacingMultiple: options.lineSpacingMultiple ?? 1.2,
    margin: options.margin ?? 0,
    valign: options.valign || "top",
    fontFace: options.fontFace || FONT,
    bold: options.bold || false,
    fit: "shrink",
  });
}

function connector(slide, x1, y1, x2, y2, color = BLUE, width = 0.8, arrow = false) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  slide.addShape(pptx.ShapeType.line, {
    x, y, w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
    line: {
      color, width,
      endArrowType: arrow && x2 >= x1 ? "triangle" : "none",
      beginArrowType: arrow && x2 < x1 ? "triangle" : "none",
    },
  });
}

// 01 — Cover
{
  const s = pptx.addSlide();
  addHeader(s, "EVIDENCE-BOUND HIRING / 2026");
  addText(s, "证据先于", 0.72, 1.52, 6.4, 0.9, 51, INK, {
    bold: true,
    fit: "shrink",
    charSpacing: -1.2,
  });
  addText(s, "结论。", 0.72, 2.43, 4.7, 0.95, 51, BLUE, {
    bold: true,
    fit: "shrink",
    charSpacing: -1.2,
  });
  addBody(s, "把岗位标准变成可验证的招聘证据链。\nAI 提供证据，规则负责计算，HR 完成决策。", 0.76, 4.12, 6.05, 0.9, 18, INK, {
    lineSpacingMultiple: 1.35,
  });

  addRule(s, 7.45, 1.55, 0, RULE, 0.7);
  addRule(s, 12.55, 1.55, 0, RULE, 0.7);
  addText(s, "EVIDENCE PATH / 001", 7.80, 1.84, 3.8, 0.25, 8.4, MUTED, {
    fontFace: MONO,
    charSpacing: 0.75,
  });
  addRule(s, 7.82, 3.20, 4.45, INK, 0.8);
  const nodes = [
    { x: 7.82, label: "原文", note: "简历第 23 行", fill: BG, line: INK },
    { x: 9.58, label: "审计", note: "逐字定位通过", fill: BLUE, line: BLUE },
    { x: 11.42, label: "决策", note: "HR 人工确认", fill: BG, line: INK },
  ];
  for (const node of nodes) {
    addCircle(s, node.x, 3.105, 0.19, node.fill, node.line, 0.9);
    addText(s, node.label, node.x - 0.12, 3.43, 0.8, 0.25, 9.8, INK, { bold: true, align: "center" });
    addText(s, node.note, node.x - 0.46, 3.75, 1.46, 0.22, 8.1, MUTED, { align: "center" });
  }
  addBody(s, "每一条有效结论，都能回到一段原文、\n一条规则和一次由人负责的决定。", 7.82, 4.42, 4.38, 0.85, 16, INK, {
    lineSpacingMultiple: 1.3,
  });

  addNotes(s, `
【0:00–0:10】
各位评委好，我们是才证。我们不把录用决定交给大模型，而是让 AI 为每一个招聘判断提供可核验的证据。
`);
}

// 02 — Problem
{
  const s = pptx.addSlide();
  addHeader(s, "01 / THE PROBLEM");
  addTitle(s, "招聘缺的不是更多简历，\n而是可复核的判断。", { y: 1.16, size: 38 });
  const columns = [
    {
      x: 0.73,
      title: "标准漂移",
      body: "同一岗位，不同 HR 使用\n不同的理解与筛选尺度。",
      note: "STANDARD DRIFT",
    },
    {
      x: 4.32,
      title: "黑箱风险",
      body: "模型直接给结论，依据\n模糊，引用容易幻觉。",
      note: "BLACK-BOX SCORING",
    },
    {
      x: 7.91,
      title: "成本外溢",
      body: "重复阅读与首轮沟通，\n持续占用招聘人力。",
      note: "HIDDEN COST",
    },
  ];
  for (let i = 0; i < columns.length; i += 1) {
    const item = columns[i];
    addText(s, item.note, item.x, 3.02, 2.6, 0.22, 7.4, BLUE, {
      fontFace: MONO,
      charSpacing: 0.7,
    });
    addText(s, item.title, item.x, 3.47, 2.9, 0.48, 23, INK, { bold: true });
    addBody(s, item.body, item.x, 4.14, 2.8, 0.9, 16, MUTED, { lineSpacingMultiple: 1.3 });
    if (i < columns.length - 1) addRule(s, item.x + 3.18, 3.0, 0, RULE, 0.65);
  }
  addText(s, "100", 10.80, 2.90, 1.55, 0.65, 31, BLUE, {
    fontFace: MONO,
    bold: true,
    align: "right",
  });
  addText(s, "份系统模拟简历\n放大的是问题，不是信任", 10.54, 3.65, 1.84, 0.8, 10.5, MUTED, {
    align: "right",
    lineSpacingMultiple: 1.25,
  });
  addRule(s, M, 5.80, W - M * 2, INK, 1.15);
  addText(s, "更危险的是", M, 6.11, 1.4, 0.28, 9.2, AMBER, {
    fontFace: MONO,
    bold: true,
    charSpacing: 0.5,
  });
  addText(s, "错误一旦发生，很难知道错在哪里。", M + 1.55, 6.00, 9.7, 0.42, 19, INK, {
    bold: true,
    fit: "shrink",
  });
  addFooter(s, 2);
  addNotes(s, `
【0:10–0:35】
招聘每天收到大量简历，但真正的难点不只是看得慢。第一，标准容易漂移；第二，模型直接给结论时，HR 很难复核；第三，首轮沟通会不断消耗人力。100 份模拟简历会让这些问题被放大，但不会自动产生信任。
`);
}

// 03 — Insight
{
  const s = pptx.addSlide();
  addHeader(s, "02 / THE SHIFT");
  addTitle(s, "把“AI 判断人”，\n改成“AI 证明岗位匹配”。", { y: 1.13, size: 38 });

  addRect(s, 0.72, 3.02, 5.38, 2.58, "E5E4DF");
  addText(s, "TRADITIONAL AI SCREENING", 0.98, 3.30, 3.6, 0.22, 7.6, MUTED, {
    fontFace: MONO,
    charSpacing: 0.7,
  });
  addText(s, "结论先行", 0.98, 3.78, 2.1, 0.42, 22, INK, { bold: true });
  addBody(s, "先总结、先打分\n人再猜依据。", 0.98, 4.35, 4.5, 0.7, 16, MUTED, { lineSpacingMultiple: 1.3 });

  addRule(s, 6.24, 4.25, 0.82, BLUE, 1.1);
  connector(s, 6.55, 4.25, 6.96, 4.25, BLUE, 1.1, true);
  addRect(s, 7.22, 3.02, 5.40, 2.58, WHITE);
  addRect(s, 7.22, 3.02, 0.07, 2.58, BLUE);
  addText(s, "HIREPROOF / EVIDENCE-FIRST", 7.53, 3.30, 4.2, 0.22, 7.6, BLUE, {
    fontFace: MONO,
    charSpacing: 0.7,
  });
  addText(s, "证据先行", 7.53, 3.78, 2.1, 0.42, 22, INK, { bold: true });
  addBody(s, "锁定标准 → 生成证据 → 规则计分\n→ 人工决策，每一步都可回看。", 7.53, 4.35, 4.5, 0.72, 16, INK, {
    lineSpacingMultiple: 1.3,
  });

  addRule(s, M, 6.13, W - M * 2, INK, 1.15);
  addText(s, "LLM 只处理语义；决定权交给可审计的规则与人。", M, 6.39, 11.8, 0.34, 18, INK, {
    bold: true,
    align: "center",
  });
  addFooter(s, 3);
  addNotes(s, `
【0:35–0:55】
所以我们的核心转变，是把“让 AI 判断人”改成“让 AI 证明岗位匹配”。大模型只处理语义，计分、硬门槛和排序由确定性规则完成，最终决定仍然交给 HR。
`);
}

// 04 — Workflow
{
  const s = pptx.addSlide();
  addHeader(s, "03 / WORKFLOW");
  addTitle(s, "从一份 JD，到一条可审计的招聘决策链。", { y: 1.15, size: 33 });

  const steps = [
    { x: 0.82, no: "01", title: "锁定标准", body: "JD → 评价项 / 权重 / 硬门槛\nHR 确认后冻结" },
    { x: 2.86, no: "02", title: "进入证据流水线", body: "100 份模拟简历\nPDF / Word / 图片" },
    { x: 4.90, no: "03", title: "四 Agent 协作", body: "结构化 → 匹配 → 审计\n→ 摘要" },
    { x: 6.94, no: "04", title: "确定性决策", body: "匹配分 / 硬门槛 / 排序\n证据矩阵" },
    { x: 8.98, no: "05", title: "HR 审核", body: "覆盖等级 / 备注\n状态与历史留痕" },
    { x: 11.02, no: "06", title: "电话初筛", body: "证据缺口 → 追问\n报告回写证据链" },
  ];
  addRule(s, 1.08, 2.68, 10.98, INK, 1.0);
  for (const step of steps) {
    const isAgentStage = step.no === "03";
    addCircle(s, step.x + 0.15, 2.58, 0.20, isAgentStage ? BLUE : WHITE, isAgentStage ? BLUE : INK, 0.9);
    addText(s, step.no, step.x, 2.26, 0.50, 0.20, 7.2, MUTED, {
      fontFace: MONO,
      bold: true,
    });
    addText(s, step.title, step.x, 3.03, 1.72, 0.36, 17, INK, {
      bold: true,
      fit: "shrink",
    });
    addBody(s, step.body, step.x, 3.62, 1.70, 0.78, 11.3, MUTED, {
      lineSpacingMultiple: 1.22,
    });
  }

  addText(s, "四 Agent / 职责隔离", 4.88, 4.45, 2.4, 0.22, 7.4, BLUE, {
    fontFace: MONO,
    charSpacing: 0.65,
  });
  const agentLabels = ["结构", "匹配", "审计", "摘要"];
  for (let i = 0; i < agentLabels.length; i += 1) {
    addPill(s, agentLabels[i], 4.88 + i * 0.66, 4.76, 0.58, BLUE, { size: 7.1 });
  }
  connector(s, 10.98, 4.38, 8.18, 4.38, BLUE, 0.75, true);
  addText(s, "电话回答重新进入证据链", 8.55, 4.48, 2.4, 0.24, 8.5, BLUE, {
    fontFace: MONO,
  });

  addRule(s, M, 5.42, W - M * 2, RULE, 0.65);
  addText(s, "RAG SIDE CHANNEL", M, 5.62, 1.8, 0.22, 7.5, MUTED, {
    fontFace: MONO,
    charSpacing: 0.7,
  });
  addBody(s, "公开信息知识库 · 公司 / 团队 / 论文 / 专利\n来源 · 日期 · 授权 · 置信度", 2.51, 5.58, 4.8, 0.76, 12.0, INK, {
    lineSpacingMultiple: 1.25,
  });
  addText(s, "模型失败", 7.75, 5.62, 0.82, 0.22, 7.6, AMBER, { fontFace: MONO, charSpacing: 0.4 });
  addText(s, "→ 关键词基线", 8.67, 5.58, 1.5, 0.30, 12.5, INK, { bold: true });
  addText(s, "标准变化", 10.26, 5.62, 0.82, 0.22, 7.6, AMBER, { fontFace: MONO, charSpacing: 0.4 });
  addText(s, "→ 旧证据失效", 11.18, 5.58, 1.45, 0.30, 12.5, INK, { bold: true });

  addRect(s, 0.72, 6.35, 11.90, 0.44, BLUE_SOFT);
  addText(s, "同一岗位的所有候选人共享同一套评价卡、权重和硬门槛；模型或供应商变化不会改变业务规则。", 1.00, 6.45, 11.25, 0.22, 11.1, INK, {
    align: "center",
  });
  addFooter(s, 4);
  addNotes(s, `
【0:55–1:35】
完整链路从岗位评价卡开始。HR 确认评价项、权重和硬门槛之后，简历进入解析和结构化。100 份系统模拟简历用于验证流程和数据范围，不代表真实候选人效果。四个 Agent 分别完成结构化、匹配、审计和摘要，之后系统用固定规则计分排序。
`);
}

// 05 — Evidence chain
{
  const s = pptx.addSlide();
  addHeader(s, "04 / EVIDENCE LINEAGE");
  addTitle(s, "一条证据，如何走到最终决策。", { y: 1.15, size: 34 });

  addText(s, "23", 0.72, 2.00, 1.17, 1.14, 58, "D8D7D1", {
    fontFace: MONO,
    bold: true,
    align: "right",
  });
  addText(s, "原文行号", 1.97, 2.35, 1.0, 0.22, 8.0, MUTED, {
    fontFace: MONO,
    charSpacing: 0.65,
  });
  addText(s, "“使用 Python、FastAPI 开发检索 API，\n完成重排序和引用追溯。”", 2.98, 2.00, 8.70, 1.08, 24, INK, {
    bold: false,
    lineSpacingMultiple: 1.28,
  });
  addText(s, "岗位评价项：RAG 工程能力 · 合成样本", 2.98, 3.22, 5.20, 0.24, 9.2, MUTED, {
    fontFace: MONO,
  });

  addRule(s, M, 4.02, W - M * 2, RULE, 0.75);
  const chain = [
    { x: 0.75, label: "原文定位", value: "LOCATED" },
    { x: 3.98, label: "证据等级", value: "强 / 已审计" },
    { x: 7.15, label: "规则计分", value: "权重 × 等级" },
    { x: 10.17, label: "人工决策", value: "覆盖 + 留痕" },
  ];
  for (let i = 0; i < chain.length; i += 1) {
    const item = chain[i];
    addCircle(s, item.x - 0.27, 4.77, 0.18, i === 1 ? BLUE : WHITE, i === 1 ? BLUE : INK, 0.8);
    addText(s, item.label, item.x, 4.28, 1.55, 0.23, 8.0, MUTED, {
      fontFace: MONO,
      charSpacing: 0.7,
    });
    addText(s, item.value, item.x, 4.74, 2.34, 0.36, 17.0, INK, {
      bold: true,
    });
    if (i < chain.length - 1) connector(s, item.x + 2.30, 4.86, chain[i + 1].x - 0.43, 4.86, RULE, 0.7);
  }
  addRule(s, M, 5.34, W - M * 2, RULE, 0.75);

  addRect(s, 0.72, 5.95, 3.42, 0.54, BLUE_SOFT);
  addText(s, "未提及 ≠ 明确不具备", 0.94, 6.08, 2.96, 0.24, 12.2, BLUE, {
    bold: true,
    align: "center",
  });
  addBody(s, "信息缺失不会被误判成负面事实。模型证据无法逐字定位时，\n不得进入评分；系统回退到透明、可重复的关键词基线。", 4.62, 5.92, 7.58, 0.73, 12.7, INK, {
    lineSpacingMultiple: 1.28,
  });
  addFooter(s, 5);
  addNotes(s, `
【1:35–2:10】
这条链路的关键，是每条有效证据都能回到原文。比如岗位要求 RAG 能力，系统不会只给一个“匹配”，而是展示原文、行号、审计状态和置信度，再进入权重计算，最后记录 HR 的人工判断。我们还明确区分“未提及”和“明确不具备”。
`);
}

// 06 — Innovation guardrails
{
  const s = pptx.addSlide();
  addHeader(s, "05 / FOUR GUARDRAILS");
  addTitle(s, "不是更会聊天，而是更会证明。", { y: 1.15, size: 38 });

  const rows = [
    { y: 2.58, no: "01", title: "证据绑定", body: "原文、行号、来源和状态，缺一不可。", state: "LOCATED" },
    { y: 3.45, no: "02", title: "职责分离", body: "四个 Agent 各做一件事，摘要不能修改证据。", state: "SEPARATED" },
    { y: 4.32, no: "03", title: "确定性决策", body: "模型不负责计分、排序和最终录用。", state: "AUDITABLE" },
    { y: 5.19, no: "04", title: "人工负责", body: "覆盖、备注、状态变化全部写入审计历史。", state: "HUMAN FINAL" },
  ];
  addRule(s, M, 2.35, W - M * 2, INK, 1.0);
  for (const row of rows) {
    addText(s, row.no, 0.72, row.y, 0.45, 0.20, 7.5, BLUE, { fontFace: MONO, bold: true });
    addText(s, row.title, 1.45, row.y - 0.10, 2.40, 0.34, 19, INK, { bold: true });
    addBody(s, row.body, 4.16, row.y - 0.08, 6.60, 0.35, 13.2, MUTED, { lineSpacingMultiple: 1.15 });
    addPill(s, row.state, 11.12, row.y - 0.08, 1.34, row.state === "HUMAN FINAL" ? AMBER : BLUE, { size: 6.8 });
    addRule(s, M, row.y + 0.66, W - M * 2, RULE, 0.55);
  }
  addText(s, "Evidence-first · Deterministic · Auditable · Human-in-the-loop", M, 6.15, 11.9, 0.32, 15.0, BLUE, {
    fontFace: MONO,
    bold: true,
    align: "center",
    charSpacing: 0.2,
  });
  addFooter(s, 6);
  addNotes(s, `
【2:10–2:45】
这里有四道护栏。第一，证据绑定；第二，Agent 职责分离；第三，评分和排序由确定性代码完成；第四，所有人工覆盖和状态变化都有审计记录。所以我们的差异化不是更会聊天，而是让 AI 的输出更值得相信，并且在模型失败时还能回退。
`);
}

// 07 — Hard problems
{
  const s = pptx.addSlide();
  addHeader(s, "06 / TECHNICAL MOAT");
  addTitle(s, "最难的不是调用模型，\n而是让模型输出值得相信。", { y: 1.13, size: 35 });
  addRule(s, 6.66, 3.0, 0, RULE, 0.7);
  addRule(s, M, 4.58, W - M * 2, RULE, 0.7);

  const quadrants = [
    {
      x: 0.75, y: 3.02, eyebrow: "HALLUCINATED CITATION",
      title: "引用幻觉", body: "逐字校验；\n定位失败即淘汰证据。",
    },
    {
      x: 7.08, y: 3.02, eyebrow: "DOCUMENT NOISE",
      title: "文档噪声", body: "多格式解析 + CID 映射\n+ OCR 质量门禁。",
    },
    {
      x: 0.75, y: 4.90, eyebrow: "DOMAIN SEMANTIC GAP",
      title: "领域语义缺口", body: "LoRA-v4 + BM25 + Dense\n+ RRF + Reranker。",
    },
    {
      x: 7.08, y: 4.90, eyebrow: "PRIVACY & FAIRNESS",
      title: "隐私与公平", body: "保护字段拒绝 + 发送前脱敏\n+ 本地优先 + 电话知情同意。",
    },
  ];
  for (const q of quadrants) {
    addText(s, q.eyebrow, q.x, q.y, 4.2, 0.20, 7.1, MUTED, {
      fontFace: MONO,
      charSpacing: 0.68,
    });
    addText(s, q.title, q.x, q.y + 0.31, 4.5, 0.42, 24, INK, { bold: true });
    addBody(s, q.body, q.x, q.y + 0.92, 4.75, 0.74, 13.0, MUTED, { lineSpacingMultiple: 1.25 });
  }
  addText(s, "模型可替换 · 规则不变 · 失败可回退", M, 6.63, W - M * 2, 0.26, 9.4, BLUE, {
    fontFace: MONO,
    bold: true,
    align: "center",
    charSpacing: 0.55,
  });
  addFooter(s, 7);
  addNotes(s, `
【2:45–3:10】
真正的工程难点，是引用幻觉、复杂文档、领域语义和隐私公平。我们的解法分别是逐字证据校验、多解析器与 OCR 质量门禁、LoRA 加混合检索，以及保护性字段拒绝、发送前脱敏和本地优先。
`);
}

// 08 — Proof and data
{
  const s = pptx.addSlide();
  addHeader(s, "07 / VERIFICATION", true);
  addTitle(s, "用可重复证据，\n证明这条链路真的能跑。", {
    y: 1.09, size: 36, color: WHITE,
  });
  addText(s, "SYNTHETIC BENCHMARK / ENGINEERING REGRESSION", 8.50, 1.13, 4.1, 0.22, 7.3, "8495A9", {
    fontFace: MONO,
    align: "right",
    charSpacing: 0.65,
  });

  const kpis = [
    { x: 0.76, value: "27/27", label: "AUTOMATED TESTS", note: "自动化测试通过" },
    { x: 4.50, value: "98.44%", label: "OCR CHARACTER ACCURACY", note: "3 份合成 PDF 字符准确率" },
    { x: 8.40, value: "+16.9%", label: "DENSE RECALL@5 RELATIVE", note: "0.450 → 0.526" },
  ];
  for (const kpi of kpis) {
    addText(s, kpi.value, kpi.x, 3.10, 3.04, 0.66, 36, WHITE, {
      fontFace: MONO,
      bold: true,
      align: "left",
    });
    addText(s, kpi.label, kpi.x, 3.88, 3.20, 0.18, 6.6, "6F8CB2", {
      fontFace: MONO,
      charSpacing: 0.62,
    });
    addText(s, kpi.note, kpi.x, 4.14, 3.10, 0.24, 9.1, "B8C6D8", {
      fontFace: MONO,
    });
  }
  addRule(s, M, 4.82, W - M * 2, "394654", 0.65);

  addText(s, "END-TO-END RECALL@5", 0.76, 5.14, 2.2, 0.22, 7.0, "8095AD", {
    fontFace: MONO,
    charSpacing: 0.65,
  });
  addText(s, "BM25  0.552", 0.76, 5.49, 1.76, 0.32, 16.0, WHITE, {
    fontFace: MONO,
    bold: true,
  });
  connector(s, 2.46, 5.64, 3.28, 5.64, "617A9C", 1.0, true);
  addText(s, "RRF  0.557", 3.40, 5.49, 1.72, 0.32, 16.0, WHITE, {
    fontFace: MONO,
    bold: true,
  });
  addText(s, "100", 6.02, 5.07, 1.35, 0.58, 31, BLUE, {
    fontFace: MONO,
    bold: true,
  });
  addText(s, "份系统模拟简历\n用于场景与知识扩展测试", 7.00, 5.08, 2.30, 0.64, 9.7, "C0CAD7", {
    lineSpacingMultiple: 1.2,
  });
  addPill(s, "HUMAN FINAL / 0 AUTO-HIRE", 10.18, 5.10, 2.42, BLUE, {
    fill: DARK, size: 6.4, h: 0.30,
  });
  addText(s, "以上为合成数据与工程回归结果，不代表真实招聘效果。下一步补充真实脱敏样本与 HR 盲评。", 0.76, 6.22, 11.65, 0.26, 8.8, "8095AD", {
    fontFace: MONO,
  });
  addFooter(s, 8, true);
  addNotes(s, `
【3:10–3:40】
目前项目已经通过 27 项自动化测试；合成 PDF 的 OCR 字符准确率是 98.44%；领域 Dense Recall@5 从 0.450 提升到 0.526。100 份系统模拟简历用于扩充场景与知识测试，不是真实候选人效果。端到端 Recall@5 也从 0.552 提升到 0.557。下一步会做真实脱敏样本和 HR 盲评。
`);
}

// 09 — Value and path
{
  const s = pptx.addSlide();
  addHeader(s, "08 / VALUE & PATH");
  addTitle(s, "从筛选工具，\n走向可审计的招聘基础设施。", { y: 1.13, size: 35 });

  addRule(s, 1.24, 3.17, 10.86, INK, 1.0);
  const phases = [
    { x: 1.05, phase: "现在", title: "完整可运行演示", body: "简历解析 · 四 Agent · 排序\n审核 · RAG · 电话初筛" },
    { x: 4.86, phase: "下一步", title: "可信度验证", body: "真实脱敏 HR 盲评\n扫描件与误报漏报分析" },
    { x: 8.67, phase: "规模化", title: "企业级基础设施", body: "ATS / HR SaaS 集成\n权限 · 保留策略 · SLA" },
  ];
  for (const phase of phases) {
    addCircle(s, phase.x + 0.13, 3.07, 0.20, WHITE, INK, 0.9);
    addText(s, phase.phase, phase.x, 2.70, 1.10, 0.23, 8.0, BLUE, {
      fontFace: MONO,
      bold: true,
      charSpacing: 0.65,
    });
    addText(s, phase.title, phase.x, 3.50, 2.85, 0.38, 18.5, INK, { bold: true });
    addBody(s, phase.body, phase.x, 4.08, 2.95, 0.75, 12.4, MUTED, { lineSpacingMultiple: 1.25 });
  }

  addText(s, "信任", 0.76, 5.36, 1.0, 0.28, 9.1, MUTED, { fontFace: MONO, charSpacing: 0.7 });
  addText(s, "更快建立信任 · 更一致地执行标准 · 更安全地使用 AI", 1.86, 5.25, 9.60, 0.44, 18.3, INK, {
    bold: true,
    align: "center",
  });
  addRule(s, M, 6.05, W - M * 2, RULE, 0.6);
  addText(s, "不是让 AI 更会判断人，\n而是让每个判断更值得相信。", 0.76, 6.22, 11.80, 0.78, 22, BLUE, {
    bold: true,
    align: "center",
    lineSpacingMultiple: 1.0,
  });
  addFooter(s, 9);
  addNotes(s, `
【3:40–4:00】
才证的价值不是替 HR 做决定，而是让标准更一致、依据更透明、AI 使用更安全。我们最终想做的是招聘基础设施：让每一个判断，都值得相信。谢谢各位。
`);
}

// 10 — Submission appendix
{
  const s = pptx.addSlide();
  addHeader(s, "APPENDIX / SUBMISSION");
  addTitle(s, "正式项目提交信息", { y: 1.12, size: 32 });
  addText(s, "附录页，不占用 4 分钟主路演", 9.60, 1.18, 3.04, 0.22, 7.6, MUTED, {
    fontFace: MONO,
    align: "right",
    charSpacing: 0.6,
  });

  const rows = [
    ["项目名称", "才证｜招聘决策台"],
    ["20 字内简介", "把岗位标准变成可验证的招聘证据链。"],
    ["团队成员", "[请填写]"],
    ["参赛赛道", "TTC｜AI 赋能招聘与人才挖掘 [请复核]"],
    ["第三方代码 / 工具库", "Node.js · BAAI/bge-m3 · PyTorch · Transformers · Sentence-Transformers · PEFT/LoRA · NumPy · PDFium · RapidOCR/ONNX Runtime · Web Speech API"],
    ["开赛前已有内容", "对应 commit：[请根据仓库历史填写，不得杜撰]"],
    ["三行进化说明", "比较指标：[请填写] ｜ 学到的：[请填写] ｜ 回退方式：[请填写]"],
  ];
  const tableX = 0.74;
  const tableY = 2.08;
  const tableW = 11.82;
  const labelW = 1.82;
  const rowHeights = [0.46, 0.46, 0.42, 0.42, 0.70, 0.56, 0.58];
  let currentY = tableY;
  for (let index = 0; index < rows.length; index += 1) {
    const rowHeight = rowHeights[index];
    addRect(s, tableX, currentY, tableW, rowHeight, index % 2 === 0 ? WHITE : "EEEDE8");
    addRule(s, tableX, currentY, tableW, RULE, 0.45);
    addRule(s, tableX, currentY + rowHeight, tableW, RULE, 0.45);
    addRule(s, tableX + labelW, currentY, 0, RULE, 0.45);
    addText(s, rows[index][0], tableX + 0.10, currentY + 0.08, labelW - 0.18, rowHeight - 0.12, 8.0, MUTED, {
      fontFace: MONO,
      bold: true,
      valign: "mid",
    });
    addText(s, rows[index][1], tableX + labelW + 0.14, currentY + 0.07, tableW - labelW - 0.26, rowHeight - 0.12, index === 4 ? 7.5 : 8.2, INK, {
      valign: "mid",
      fit: "shrink",
      lineSpacingMultiple: 1.1,
    });
    currentY += rowHeight;
  }
  addRule(s, tableX, currentY, 0, RULE, 0.45);
  addRule(s, tableX + tableW, tableY, 0, RULE, 0.45);
  addRule(s, tableX + tableW, currentY, 0, RULE, 0.45);
  addText(s, "合规说明", 0.76, 6.18, 0.92, 0.22, 7.4, AMBER, {
    fontFace: MONO,
    bold: true,
    charSpacing: 0.6,
  });
  addText(s, "演示仅使用虚构候选人 / 企业 / 合成数据；真实数据必须取得授权并完成脱敏。项目仍在迭代，最终功能与指标以提交版本为准。", 1.72, 6.14, 10.50, 0.46, 8.6, MUTED, {
    lineSpacingMultiple: 1.2,
  });
  addFooter(s, 10);
  addNotes(s, "附录说明：此页供正式提交与问答使用，不进入 4 分钟主路演。团队成员、参赛赛道与赛前 commit 需由项目成员核对后填写。");
}

const output = path.resolve(__dirname, "才证_招聘决策台_黑客松路演.pptx");
pptx.writeFile({ fileName: output })
  .then((file) => {
    console.log(file);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
