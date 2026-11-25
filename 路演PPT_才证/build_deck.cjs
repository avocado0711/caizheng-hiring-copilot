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
const SHOT_DIR = path.resolve(__dirname, "screenshots");

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
  addText(slide, `${String(page).padStart(2, "0")} / 14`, W - M - 1.05, H - 0.35, 1.05, 0.18, 7.6, muted, {
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
【0:00–0:08】
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
【0:07–0:22】
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
【0:22–0:36】
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
【0:36–0:52】
完整链路从岗位评价卡开始。HR 确认评价项、权重和硬门槛之后，简历进入解析和结构化。100 份系统模拟简历用于验证流程和数据范围，不代表真实候选人效果。四个 Agent 分别完成结构化、匹配、审计和摘要，之后系统用固定规则计分排序。
`);
}

// 05 — RAG pipeline
{
  const s = pptx.addSlide();
  addHeader(s, "04 / RAG PIPELINE");
  addTitle(s, "RAG 不是“搜一段资料”，\n而是装配一份可引用的上下文。", { y: 1.10, size: 32 });

  addText(s, "01 / QUERY", 0.76, 2.53, 1.85, 0.22, 7.4, BLUE, {
    fontFace: MONO,
    bold: true,
    charSpacing: 0.70,
  });
  addText(s, "岗位评价项\n简历实体\n证据缺口", 0.76, 2.92, 2.14, 1.13, 15.0, INK, {
    bold: true,
    lineSpacingMultiple: 1.30,
  });
  addText(s, "公司 / 团队 / 学校\n论文 / 专利 / 岗位标准", 0.76, 4.54, 2.30, 0.62, 9.4, MUTED, {
    lineSpacingMultiple: 1.22,
  });

  connector(s, 3.12, 3.42, 3.46, 3.42, BLUE, 0.9, true);

  addRect(s, 3.50, 2.66, 2.95, 0.58, "E4E3DE");
  addText(s, "BM25 / 词法召回", 3.68, 2.78, 1.70, 0.22, 9.2, INK, { bold: true });
  addText(s, "中文 bi-gram · 标题 / 实体加权", 5.10, 2.79, 1.20, 0.20, 6.9, MUTED, {
    fontFace: MONO,
    align: "right",
  });
  addRect(s, 3.50, 3.48, 2.95, 0.58, WHITE);
  addRect(s, 3.50, 3.48, 0.06, 0.58, BLUE);
  addText(s, "Dense / 语义召回", 3.68, 3.60, 1.70, 0.22, 9.2, INK, { bold: true });
  addText(s, "BGE-M3 50% + LoRA 50%", 4.84, 3.61, 1.48, 0.20, 6.9, MUTED, {
    fontFace: MONO,
    align: "right",
  });
  connector(s, 6.45, 2.95, 6.76, 3.28, BLUE, 0.8);
  connector(s, 6.45, 3.77, 6.76, 3.44, BLUE, 0.8);

  addText(s, "02 / FUSION", 6.88, 2.53, 1.50, 0.22, 7.4, BLUE, {
    fontFace: MONO,
    bold: true,
    charSpacing: 0.70,
  });
  addText(s, "RRF", 6.90, 2.95, 1.20, 0.44, 25, INK, { fontFace: MONO, bold: true });
  addText(s, "去重融合 Top 30", 6.90, 3.50, 1.45, 0.50, 10.0, MUTED, {
    lineSpacingMultiple: 1.2,
  });
  connector(s, 8.32, 3.34, 8.70, 3.34, BLUE, 0.9, true);

  addText(s, "03 / RERANK", 8.76, 2.53, 1.50, 0.22, 7.4, BLUE, {
    fontFace: MONO,
    bold: true,
    charSpacing: 0.70,
  });
  addText(s, "可选 Reranker", 8.78, 2.96, 1.58, 0.36, 15.0, INK, { bold: true });
  addText(s, "BGE 交叉编码器\n权重 1.0", 8.78, 3.46, 1.55, 0.55, 9.4, MUTED, {
    lineSpacingMultiple: 1.2,
  });
  connector(s, 10.44, 3.34, 10.78, 3.34, BLUE, 0.9, true);

  addText(s, "04 / CONTEXT PACK", 10.84, 2.53, 1.70, 0.22, 7.0, BLUE, {
    fontFace: MONO,
    bold: true,
    charSpacing: 0.55,
  });
  addText(s, "Top 5", 10.86, 2.92, 1.48, 0.42, 24, INK, { fontFace: MONO, bold: true });
  addText(s, "带来源的可引用片段", 10.86, 3.50, 1.62, 0.48, 9.6, MUTED, {
    lineSpacingMultiple: 1.2,
  });

  addRule(s, M, 5.02, W - M * 2, RULE, 0.7);
  addText(s, "CONTEXT RECORD", M, 5.22, 1.72, 0.22, 7.4, MUTED, {
    fontFace: MONO,
    charSpacing: 0.7,
  });
  const fields = ["标题", "实体", "发布者", "时间", "授权", "置信度", "虚构标记"];
  for (let i = 0; i < fields.length; i += 1) {
    addPill(s, fields[i], 2.36 + i * 1.38, 5.17, 1.10, i === 5 ? GREEN : BLUE, { size: 7.1 });
  }
  addBody(s, "用法：岗位标准补充 · 组织 / 团队背景 · 论文 / 专利佐证 · 电话追问上下文", 0.76, 5.72, 10.90, 0.28, 10.4, INK, {
    lineSpacingMultiple: 1.15,
  });
  addRect(s, 0.72, 6.25, 11.90, 0.46, BLUE_SOFT);
  addText(s, "公开资料只能佐证组织或项目背景，不能直接证明个人贡献；知识库缺失不是负面结论。", 0.98, 6.36, 11.34, 0.22, 10.8, INK, {
    align: "center",
  });
  addFooter(s, 5);
  addNotes(s, `
【0:52–1:10】
RAG 在这里不是简单搜索一段公开资料。系统先根据岗位评价项、简历实体和证据缺口生成查询，再同时走中文 BM25 和融合向量召回；两路结果经过 RRF 融合出 Top 30，可选 Reranker 再提高排序质量，最后形成带标题、来源、日期、授权和置信度的 Top 5 上下文。公开资料只能帮助解释组织和项目背景，不能拿来证明个人贡献。
`);
}

// 06 — Evidence chain
{
  const s = pptx.addSlide();
  addHeader(s, "05 / EVIDENCE LINEAGE");
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
  addFooter(s, 6);
  addNotes(s, `
【1:10–1:25】
这条链路的关键，是每条有效证据都能回到原文。比如岗位要求 RAG 能力，系统不会只给一个“匹配”，而是展示原文、行号、审计状态和置信度，再进入权重计算，最后记录 HR 的人工判断。我们还明确区分“未提及”和“明确不具备”。
`);
}

// 07 — Four-agent architecture
{
  const s = pptx.addSlide();
  addHeader(s, "06 / AGENT PROTOCOL");
  addTitle(s, "四个 Agent：职责明确，状态可校验。", { y: 1.15, size: 32 });

  addRule(s, 1.10, 2.45, 10.92, INK, 1.0);
  const agents = [
    {
      x: 0.75,
      no: "01",
      name: "简历结构化",
      role: "把原文拆成事实，\n不做岗位匹配。",
      input: "脱敏简历\n确定性解析信息",
      output: "profile\nworkHistory\nnotes",
      rule: "只读事实；不做匹配；\n不输出姓名或保护字段。",
    },
    {
      x: 3.78,
      no: "02",
      name: "岗位证据匹配",
      role: "逐项寻找岗位相关证据，\n并交出原文。",
      input: "岗位评价卡\n简历原文 + profile",
      output: "等级 / 置信度\n逐字引用\n匹配理由",
      rule: "未提到 = none；\n非 none 必须有连续原文。",
    },
    {
      x: 6.81,
      no: "03",
      name: "证据审计",
      role: "检查引用、硬性缺口\n和字段冲突。",
      input: "已校验的评价项\n规则解析 profile",
      output: "status / issues\nverifiedCount\nrejectedCount",
      rule: "确定性规则，不调用 LLM；\n丢弃无法定位的引用。",
    },
    {
      x: 9.84,
      no: "04",
      name: "候选人摘要",
      role: "只压缩已审计证据，\n辅助阅读。",
      input: "仅已审计证据\n结构化 profile",
      output: "≤180 字客观摘要",
      rule: "不改证据、不重评分；\n无有效证据则跳过。",
    },
  ];
  for (let index = 0; index < agents.length; index += 1) {
    const agent = agents[index];
    addCircle(s, agent.x + 0.10, 2.35, 0.20, index === 1 ? BLUE : WHITE, index === 1 ? BLUE : INK, 0.9);
    addText(s, agent.no, agent.x, 2.03, 0.50, 0.20, 7.4, MUTED, {
      fontFace: MONO,
      bold: true,
    });
    addText(s, agent.name, agent.x, 2.82, 2.58, 0.40, 20.5, INK, { bold: true });
    addBody(s, agent.role, agent.x, 3.22, 2.60, 0.48, 8.7, BLUE, {
      bold: true,
      lineSpacingMultiple: 1.16,
    });
    addText(s, "输入", agent.x, 3.83, 0.42, 0.18, 7.3, BLUE, { bold: true });
    addBody(s, agent.input, agent.x + 0.44, 3.80, 2.13, 0.54, 8.8, MUTED, { lineSpacingMultiple: 1.15 });
    addText(s, "产出", agent.x, 4.45, 0.44, 0.18, 7.3, BLUE, { bold: true });
    addBody(s, agent.output, agent.x + 0.52, 4.41, 2.06, 0.64, 9.0, INK, {
      bold: true,
      lineSpacingMultiple: 1.14,
    });
    addText(s, "边界", agent.x, 5.20, 0.44, 0.18, 7.3, AMBER, { bold: true });
    addBody(s, agent.rule, agent.x + 0.54, 5.16, 2.08, 0.58, 8.3, MUTED, { lineSpacingMultiple: 1.16 });
    if (index < agents.length - 1) {
      addRule(s, agent.x + 2.86, 2.85, 0, RULE, 0.55);
      connector(s, agent.x + 2.65, 3.00, agent.x + 2.98, 3.00, BLUE, 0.65, true);
    }
  }

  addRule(s, M, 5.90, W - M * 2, RULE, 0.7);
  addText(s, "ORCHESTRATOR", M, 6.07, 1.55, 0.20, 7.2, MUTED, {
    fontFace: MONO,
    charSpacing: 0.70,
  });
  addText(s, "状态：queued → running → completed / failed / fallback", 2.20, 6.03, 5.60, 0.24, 9.2, INK, {
    fontFace: MONO,
    bold: true,
  });
  addText(s, "只有通过审计的证据才进入规则计分；失败状态与耗时全程写入 trace。", 7.93, 6.03, 4.28, 0.24, 9.2, MUTED, {
    align: "right",
  });
  addText(s, "结构化失败 → 确定性 profile ｜ 匹配失败 → 关键词基线 ｜ 审计失败 → attention ｜ 摘要失败 → 空摘要", M, 6.51, 11.9, 0.24, 8.5, AMBER, {
    fontFace: MONO,
    align: "center",
  });
  addFooter(s, 7);
  addNotes(s, `
【1:25–1:47】
四个 Agent 不是并列聊天，而是严格串行。结构化 Agent 只看脱敏简历；证据匹配 Agent 把每个评价项映射到逐字原文；证据审计是确定性规则，会丢弃无法机校的引用并检查硬性缺口；摘要 Agent 只能使用已审计证据。编排器记录每个阶段的状态、耗时和回退，只有通过审计的证据才进入计分。
`);
}

// 08 — Real product modules
{
  const s = pptx.addSlide();
  addHeader(s, "07 / PRODUCT PROOF");
  addTitle(s, "真实工作台：标准、检索和证据，\n都已经可以被操作与复核。", { y: 1.08, size: 31 });

  addText(s, "01 / ROLE SCORECARD", 0.75, 2.22, 2.10, 0.21, 7.3, BLUE, {
    fontFace: MONO,
    bold: true,
    charSpacing: 0.62,
  });
  s.addImage({
    path: path.join(SHOT_DIR, "01-job-scorecard-clean.png"),
    x: 0.72, y: 2.54, w: 7.82, h: 2.69,
  });
  addRect(s, 0.72, 2.54, 7.82, 2.69, WHITE, { transparency: 100, line: RULE, lineWidth: 0.55 });

  addText(s, "02 / SOURCE-GROUNDED RESULT", 9.02, 2.22, 3.12, 0.21, 7.0, BLUE, {
    fontFace: MONO,
    bold: true,
    charSpacing: 0.58,
  });
  s.addImage({
    path: path.join(SHOT_DIR, "03-knowledge-result-clean.png"),
    x: 8.94, y: 2.54, w: 3.62, h: 0.79,
  });
  addRect(s, 8.94, 2.54, 3.62, 0.79, WHITE, { transparency: 100, line: RULE, lineWidth: 0.55 });

  addText(s, "03 / VERIFIED EVIDENCE ITEM", 9.02, 3.61, 3.12, 0.21, 7.0, BLUE, {
    fontFace: MONO,
    bold: true,
    charSpacing: 0.58,
  });
  s.addImage({
    path: path.join(SHOT_DIR, "02-candidate-evidence-item-clean.png"),
    x: 8.94, y: 3.94, w: 3.62, h: 2.15,
  });
  addRect(s, 8.94, 3.94, 3.62, 2.15, WHITE, { transparency: 100, line: RULE, lineWidth: 0.55 });

  addBody(s, "评价卡先锁定标准；知识检索返回带来源的单条结果；\n候选人证据卡保留原文、行号和置信度。", 0.76, 5.48, 7.72, 0.69, 13.0, INK, {
    lineSpacingMultiple: 1.28,
  });
  addPill(s, "LIVE WORKBENCH", 0.76, 6.35, 1.65, BLUE, {
    fill: BLUE_SOFT,
    size: 6.8,
    h: 0.29,
  });
  addText(s, "左侧锁定规则，右侧拿回证据；三个模块都在当前版本中真实可操作。", 2.58, 6.38, 9.80, 0.22, 9.2, MUTED, {
    fontFace: MONO,
  });
  addFooter(s, 8);
  addNotes(s, `
【1:47–2:05】
这一页不是概念图，而是当前工作台里的真实模块。岗位评价卡锁定关键词、权重和硬门槛；知识检索返回一条带来源和虚构标记的结果；候选人证据卡保留逐字原文、行号和置信度。每一张截图只保留一个模块，方便评委看清产品已经在什么位置承接判断。
`);
}

// 09 — Innovation guardrails
{
  const s = pptx.addSlide();
  addHeader(s, "08 / FOUR GUARDRAILS");
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
  addFooter(s, 9);
  addNotes(s, `
【2:05–2:18】
这里有四道护栏。第一，证据绑定；第二，Agent 职责分离；第三，评分和排序由确定性代码完成；第四，所有人工覆盖和状态变化都有审计记录。所以我们的差异化不是更会聊天，而是让 AI 的输出更值得相信，并且在模型失败时还能回退。
`);
}

// 10 — Hard problems
{
  const s = pptx.addSlide();
  addHeader(s, "09 / TECHNICAL MOAT");
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
  addFooter(s, 10);
  addNotes(s, `
【2:18–2:34】
真正的工程难点，是引用幻觉、复杂文档、领域语义和隐私公平。我们的解法分别是逐字证据校验、多解析器与 OCR 质量门禁、LoRA 加混合检索，以及保护性字段拒绝、发送前脱敏和本地优先。
`);
}

// 11 — Proof and data
{
  const s = pptx.addSlide();
  addHeader(s, "10 / VERIFICATION", true);
  addTitle(s, "用可重复证据，\n证明这条链路真的能跑。", {
    y: 1.09, size: 36, color: WHITE,
  });
  addText(s, "SYNTHETIC BENCHMARK / ENGINEERING REGRESSION", 8.50, 1.13, 4.1, 0.22, 7.3, "8495A9", {
    fontFace: MONO,
    align: "right",
    charSpacing: 0.65,
  });

  const kpis = [
    { x: 0.76, value: "37/37", label: "AUTOMATED TESTS", note: "自动化测试通过" },
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
  addText(s, "SCREENING REGRESSION / 8 个合成场景 · 32 位候选人 · Top-1 7/8 · 硬门槛 30/32 · 证据定位 72/72", 0.76, 6.03, 11.65, 0.24, 8.2, "8095AD", {
    fontFace: MONO,
  });
  addText(s, "以上为合成数据与工程回归结果，不代表真实招聘效果。下一步补充真实脱敏样本与 HR 盲评。", 0.76, 6.43, 11.65, 0.26, 8.8, "8095AD", {
    fontFace: MONO,
  });
  addFooter(s, 11, true);
  addNotes(s, `
【2:34–2:56】
目前项目已经通过 37 项自动化测试；招聘筛选工程回归覆盖 8 个合成场景、32 位候选人，Top-1 准确率 87.5%，硬门槛准确率 93.8%，证据引用 72/72 可定位。合成 PDF 的 OCR 字符准确率是 98.44%；领域 Dense Recall@5 从 0.450 提升到 0.526。100 份系统模拟简历用于扩充场景与知识测试，不是真实候选人效果。端到端 Recall@5 也从 0.552 提升到 0.557。下一步会做真实脱敏样本和 HR 盲评。
`);
}

// 12 — Value and path
{
  const s = pptx.addSlide();
  addHeader(s, "11 / VALUE & PATH");
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
  addFooter(s, 12);
  addNotes(s, `
【2:56–3:15】
才证的价值不是替 HR 做决定，而是让标准更一致、依据更透明、AI 使用更安全。我们最终想做的是招聘基础设施：让每一个判断，都值得相信。谢谢各位。
`);
}

// 13 — Outlook
{
  const s = pptx.addSlide();
  addHeader(s, "12 / OUTLOOK");
  addTitle(s, "如果产品真正落地，\n下一步不是加更多 AI，而是补信任基础设施。", { y: 1.10, size: 31 });

  addRule(s, 1.05, 2.47, 11.24, INK, 1.0);
  const priorities = [
    {
      x: 0.75,
      no: "01",
      eyebrow: "EFFECTIVENESS",
      title: "真实效果验证",
      body: "引入真实脱敏样本与 HR 盲评；\n持续复盘误报、漏报和评分校准。",
    },
    {
      x: 3.78,
      no: "02",
      eyebrow: "KNOWLEDGE",
      title: "知识与数据体系",
      body: "用 100 份模拟简历扩展场景；\n完善来源、版本、增量索引与隔离。",
    },
    {
      x: 6.81,
      no: "03",
      eyebrow: "ENTERPRISE",
      title: "企业级接入",
      body: "对接 ATS / HR SaaS；\n补齐角色权限、数据保留、\n可观测性与 SLA。",
    },
    {
      x: 9.84,
      no: "04",
      eyebrow: "VOICE + PRODUCT LOOP",
      title: "真实电话闭环",
      body: "调用实时语音 API 拨号 / 接听；\n流式转写 → 摘要 → 证据回写。",
    },
  ];
  for (let index = 0; index < priorities.length; index += 1) {
    const item = priorities[index];
    addText(s, item.no, item.x, 2.13, 0.46, 0.20, 7.3, BLUE, {
      fontFace: MONO,
      bold: true,
    });
    addText(s, item.eyebrow, item.x + 0.50, 2.12, 1.95, 0.20, 7.0, MUTED, {
      fontFace: MONO,
      charSpacing: 0.62,
    });
    addCircle(s, item.x + 0.10, 2.98, 0.18, index === 0 ? BLUE : WHITE, index === 0 ? BLUE : INK, 0.85);
    addText(s, item.title, item.x, 3.36, 2.60, 0.38, 19.5, INK, { bold: true });
    addBody(s, item.body, item.x, 4.02, 2.58, 0.86, 11.4, MUTED, {
      lineSpacingMultiple: 1.25,
    });
    if (index < priorities.length - 1) addRule(s, item.x + 2.86, 2.88, 0, RULE, 0.60);
  }

  addRule(s, M, 5.12, W - M * 2, RULE, 0.65);
  addText(s, "LANDING PATH", M, 5.31, 1.55, 0.20, 7.2, MUTED, {
    fontFace: MONO,
    charSpacing: 0.70,
  });
  const stages = [
    { x: 2.30, name: "POC", note: "单一岗位 + 基线与盲评" },
    { x: 5.85, name: "PILOT", note: "ATS 接入 + HR 真实流程" },
    { x: 9.40, name: "PRODUCTION", note: "权限隔离 + 稳定性与治理" },
  ];
  connector(s, 2.70, 5.46, 10.62, 5.46, BLUE, 0.8, true);
  for (const stage of stages) {
    addCircle(s, stage.x, 5.37, 0.18, WHITE, BLUE, 0.8);
    addText(s, stage.name, stage.x - 0.10, 5.73, 1.45, 0.28, 12.0, INK, {
      fontFace: MONO,
      bold: true,
    });
    addText(s, stage.note, stage.x - 0.10, 6.07, 2.50, 0.22, 8.5, MUTED, {
      fontFace: MONO,
    });
  }

  addText(s, "从“可解释”走向“可验证”，最终成为可规模化复制的招聘决策基础设施。", M, 6.56, 11.90, 0.32, 15.5, BLUE, {
    bold: true,
    align: "center",
  });
  addFooter(s, 13);
  addNotes(s, `
【3:15–4:00】
如果才证真正进入企业，下一步不是继续堆模型，而是补信任基础设施：用真实脱敏样本和 HR 盲评验证效果；把 100 份模拟简历继续扩展成更完整的数据与知识体系；对接 ATS、HR SaaS，并补齐权限、保留和 SLA；最后接入实时语音 API，让 AI 真正能够拨号和接听，通过流式转写、通话摘要和证据回写形成完整闭环。我们的目标是让才证从“可解释”走向“可验证”，最终成为可规模化复制的招聘决策基础设施。谢谢各位。
`);
}

// 14 — Submission appendix
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
    ["第三方代码 / 工具库", "Node.js · BAAI/bge-m3 · PyTorch · Transformers · Sentence-Transformers · PEFT/LoRA · NumPy · PDFium · RapidOCR/ONNX Runtime · Web Speech API · 实时语音 API（部署时选型）"],
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
  addFooter(s, 14);
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
