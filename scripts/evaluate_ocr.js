"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const {
  assessOcrQuality,
  extractResumeFile,
  extractPdf,
  normalizeResumeText,
  parseResumeText,
} = require("../lib/resume");
const { resolvePythonRuntime } = require("../lib/python");

const ROOT = path.resolve(__dirname, "..");
const execFileAsync = promisify(execFile);
const SKILL_TERMS = [
  "Python", "FastAPI", "Django", "Flask", "Java", "JavaScript",
  "TypeScript", "Go", "Node.js", "React", "Vue", "SQL", "Redis",
  "PostgreSQL", "Elasticsearch", "Milvus", "Docker", "Kubernetes",
  "RAG", "Agent", "LangChain", "PyTorch", "TensorFlow", "LLM",
];

const CASES = [
  {
    id: "01-160dpi",
    pdf: "sample-resumes/pdf/01.pdf",
    dpi: 160,
  },
  {
    id: "01-220dpi",
    pdf: "sample-resumes/pdf/01.pdf",
    dpi: 220,
  },
  {
    id: "06-160dpi",
    pdf: "sample-resumes/pdf/06.pdf",
    dpi: 160,
  },
  {
    id: "06-220dpi",
    pdf: "sample-resumes/pdf/06.pdf",
    dpi: 220,
  },
  {
    id: "17-220dpi",
    pdf: "sample-resumes/more-pdf/17.pdf",
    dpi: 220,
  },
];

function decodeHtml(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, "&");
}

function htmlToText(html) {
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html;
  return normalizeResumeText(decodeHtml(
    body
      .replace(/<(?:style|script|svg)\b[^>]*>[\s\S]*?<\/(?:style|script|svg)>/gi, "\n")
      .replace(/<br\b[^>]*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|section|article|li|tr|h[1-6])\s*>/gi, "\n")
      .replace(/<\/t[dh]\s*>/gi, "\t")
      .replace(/<[^>]+>/g, ""),
  ));
}

function htmlTitle(html) {
  const title = decodeHtml(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  return normalizeResumeText(title.split(/\s+-\s+/).slice(1).join(" - "));
}

function comparable(value) {
  return normalizeResumeText(value)
    .toLocaleLowerCase()
    .replace(/[^\u3400-\u9fffA-Za-z0-9+#.]/g, "");
}

function editDistance(left, right) {
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution = previous[rightIndex - 1]
        + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        substitution,
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function characterBagErrorRate(truth, ocr) {
  const counts = new Map();
  for (const character of truth) {
    counts.set(character, (counts.get(character) || 0) + 1);
  }
  let matched = 0;
  for (const character of ocr) {
    const remaining = counts.get(character) || 0;
    if (remaining <= 0) continue;
    matched += 1;
    counts.set(character, remaining - 1);
  }
  return 1 - matched / Math.max(1, truth.length);
}

function hasTerm(text, term) {
  return new RegExp(`(?:^|[^A-Za-z0-9+#.])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^A-Za-z0-9+#.])`, "i")
    .test(text);
}

function fieldAccuracy(truthProfile, ocrProfile) {
  const normalizedField = (value) => String(value || "")
    .toLocaleLowerCase()
    .replace(/[\s·|/，,。.;；:：-]+/g, "");
  const checks = {
    name: Boolean(truthProfile.name && truthProfile.name === ocrProfile.name),
    email: Boolean(
      truthProfile.email
      && truthProfile.email.toLocaleLowerCase() === String(ocrProfile.email || "").toLocaleLowerCase(),
    ),
    phone: Boolean(
      truthProfile.phone
      && truthProfile.phone.replace(/\D/g, "") === String(ocrProfile.phone || "").replace(/\D/g, ""),
    ),
    yearsExperience: truthProfile.yearsExperience != null
      && truthProfile.yearsExperience === ocrProfile.yearsExperience,
    title: Boolean(
      truthProfile.title
      && normalizedField(truthProfile.title) === normalizedField(ocrProfile.title),
    ),
  };
  const applicable = Object.entries(checks).filter(([key]) => {
    if (key === "email") return Boolean(truthProfile.email);
    if (key === "phone") return Boolean(truthProfile.phone);
    if (key === "yearsExperience") return truthProfile.yearsExperience != null;
    return true;
  });
  return {
    checks,
    correct: applicable.filter(([, correct]) => correct).length,
    applicable: applicable.length,
    rate: applicable.length
      ? applicable.filter(([, correct]) => correct).length / applicable.length
      : 0,
  };
}

async function run() {
  const results = [];
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hireproof-ocr-benchmark-"));
  const python = resolvePythonRuntime();
  const rendererPath = path.join(ROOT, "ml", "render_pdf.py");
  try {
    for (const [index, item] of CASES.entries()) {
      const pdfPath = path.join(ROOT, item.pdf);
      const pdfBuffer = fs.readFileSync(pdfPath);
      const outputDir = path.join(tempRoot, `case-${index + 1}`);
      const renderedResult = await execFileAsync(
        python.command,
        [
          ...python.args,
          rendererPath,
          "--input",
          pdfPath,
          "--output-dir",
          outputDir,
          "--dpi",
          String(item.dpi),
          "--max-pages",
          "20",
        ],
        { encoding: "utf8", timeout: 120_000, maxBuffer: 8 * 1024 * 1024 },
      );
      const rendered = JSON.parse(renderedResult.stdout.trim());
      const truthText = extractPdf(pdfBuffer);
      const pageExtractions = [];
      for (const page of rendered.pages) {
        const image = fs.readFileSync(page.path);
        const extracted = await extractResumeFile({
          name: `${item.id}-page-${page.page}.png`,
          type: "image/png",
          data: image.toString("base64"),
        });
        pageExtractions.push({ page, extracted });
      }
      const ocrText = normalizeResumeText(
        pageExtractions.map((entry) => entry.extracted.text).join("\n"),
      );
      const ocrEngine = pageExtractions[0]?.extracted.ocr?.engine || "unknown";
      const meanConfidence = pageExtractions.reduce(
        (sum, entry) => sum + (entry.extracted.ocr?.meanConfidence || 0),
        0,
      ) / Math.max(1, pageExtractions.length);
      const truthComparable = comparable(truthText);
      const ocrComparable = comparable(ocrText);
      const characterErrorRate = characterBagErrorRate(truthComparable, ocrComparable);
      const truthTerms = SKILL_TERMS.filter((term) => hasTerm(truthText, term));
      const foundTerms = truthTerms.filter((term) => hasTerm(ocrText, term));
      const truthProfile = parseResumeText(truthText, { fileName: path.basename(item.pdf) });
      const ocrProfile = parseResumeText(ocrText, { fileName: `${item.id}.png` });
      const fields = fieldAccuracy(truthProfile, ocrProfile);
      const quality = assessOcrQuality(ocrText);
      results.push({
        id: item.id,
        pdf: item.pdf,
        dpi: item.dpi,
        pages: rendered.renderedPages,
        renderedWidth: rendered.pages[0]?.width || null,
        renderedHeight: rendered.pages[0]?.height || null,
        extractionMethod: `pdf-${ocrEngine}`,
        ocrEngine,
        meanConfidence: Number(meanConfidence.toFixed(4)),
        quality,
        characterErrorRate: Number(characterErrorRate.toFixed(4)),
        sequenceCharacterErrorRate: Number(
          (editDistance(truthComparable, ocrComparable) / Math.max(1, truthComparable.length)).toFixed(4),
        ),
        truthCharacters: truthComparable.length,
        ocrCharacters: ocrComparable.length,
        skillRecall: truthTerms.length ? Number((foundTerms.length / truthTerms.length).toFixed(4)) : 1,
        skillMisses: truthTerms.filter((term) => !foundTerms.includes(term)),
        fields,
        extractedFields: {
          name: ocrProfile.name,
          title: ocrProfile.title,
          email: ocrProfile.email,
          phone: ocrProfile.phone,
          yearsExperience: ocrProfile.yearsExperience,
        },
        truthFields: {
          name: truthProfile.name,
          title: truthProfile.title,
          email: truthProfile.email,
          phone: truthProfile.phone,
          yearsExperience: truthProfile.yearsExperience,
        },
      });
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  const average = (selector) => results.reduce((sum, item) => sum + selector(item), 0) / results.length;
  const report = {
    generatedAt: new Date().toISOString(),
    dataset: "3 份合成简历原生 PDF，渲染为 160/220 DPI 扫描图片；同一 PDF 原生文字作为真值",
    metrics: {
      characterErrorRate: Number(average((item) => item.characterErrorRate).toFixed(4)),
      characterAccuracy: Number((1 - average((item) => item.characterErrorRate)).toFixed(4)),
      sequenceCharacterErrorRate: Number(
        average((item) => item.sequenceCharacterErrorRate).toFixed(4),
      ),
      skillRecall: Number(average((item) => item.skillRecall).toFixed(4)),
      fieldAccuracy: Number(average((item) => item.fields.rate).toFixed(4)),
      reviewRate: Number(average((item) => item.quality.level === "high" ? 0 : 1).toFixed(4)),
    },
    results,
  };
  const outputIndex = process.argv.indexOf("--output");
  const outputPath = outputIndex >= 0
    ? path.resolve(process.argv[outputIndex + 1])
    : path.join(ROOT, "evaluation", "ocr-results.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return { report, outputPath };
}

if (require.main === module) {
  run().then(({ report, outputPath }) => {
    console.log(JSON.stringify(report.metrics, null, 2));
    for (const item of report.results) {
      console.log(
        `${item.id}: CER ${(item.characterErrorRate * 100).toFixed(1)}%`
        + `, skills ${(item.skillRecall * 100).toFixed(1)}%`
        + `, fields ${(item.fields.rate * 100).toFixed(1)}%`
        + `, quality ${item.quality.score}/100 (${item.quality.level})`,
      );
    }
    console.log(`报告已写入：${outputPath}`);
  }).catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  CASES,
  characterBagErrorRate,
  editDistance,
  fieldAccuracy,
  htmlToText,
  htmlTitle,
  run,
};
