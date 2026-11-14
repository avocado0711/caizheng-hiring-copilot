"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { spawnSync } = require("node:child_process");

const ROOT = __dirname;
const SOURCES = [
  {
    htmlDir: path.join(ROOT, "html"),
    pdfDir: path.join(ROOT, "pdf"),
  },
  {
    htmlDir: path.join(ROOT, "more-html"),
    pdfDir: path.join(ROOT, "more-pdf"),
  },
];

const edgeCandidates = [
  process.env.HIREPROOF_EDGE_PATH,
  process.env["ProgramFiles(x86)"]
    ? path.join(process.env["ProgramFiles(x86)"], "Microsoft", "Edge", "Application", "msedge.exe")
    : "",
  process.env.ProgramFiles
    ? path.join(process.env.ProgramFiles, "Microsoft", "Edge", "Application", "msedge.exe")
    : "",
].filter(Boolean);
const edgePath = edgeCandidates.find((candidate) => fs.existsSync(candidate));
if (!edgePath) throw new Error("Microsoft Edge was not found");

const limitArg = process.argv.find((value) => value.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Number.POSITIVE_INFINITY;
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "caizheng-pdf-profile-"));
let rendered = 0;

try {
  for (const source of SOURCES) {
    fs.mkdirSync(source.pdfDir, { recursive: true });
    const htmlFiles = fs.readdirSync(source.htmlDir)
      .filter((fileName) => fileName.toLocaleLowerCase().endsWith(".html"))
      .sort((left, right) => left.localeCompare(right, "zh-CN", { numeric: true }));
    const expectedPdfs = new Set(htmlFiles.map((fileName) => fileName.replace(/\.html$/i, ".pdf")));

    for (const htmlFile of htmlFiles) {
      if (rendered >= limit) break;
      const pdfFile = htmlFile.replace(/\.html$/i, ".pdf");
      const htmlPath = path.join(source.htmlDir, htmlFile);
      const pdfPath = path.join(source.pdfDir, pdfFile);
      const result = spawnSync(edgePath, [
        "--headless=new",
        "--disable-gpu",
        "--disable-extensions",
        "--disable-sync",
        "--no-first-run",
        "--no-default-browser-check",
        "--no-pdf-header-footer",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=1200",
        `--user-data-dir=${profileDir}`,
        `--print-to-pdf=${pdfPath}`,
        pathToFileURL(htmlPath).href,
      ], {
        encoding: "utf8",
        timeout: 60_000,
        windowsHide: true,
      });
      if (result.status !== 0 || !fs.existsSync(pdfPath)) {
        const detail = (result.stderr || result.stdout || "unknown Edge error").trim();
        throw new Error(`Failed to render ${htmlFile}: ${detail}`);
      }
      const size = fs.statSync(pdfPath).size;
      if (size < 1_000) throw new Error(`Rendered PDF is too small: ${pdfFile} (${size} bytes)`);
      rendered += 1;
      process.stdout.write(`\rRendered ${rendered} PDF`);
    }

    if (rendered >= limit) break;
    for (const fileName of fs.readdirSync(source.pdfDir)) {
      if (fileName.toLocaleLowerCase().endsWith(".pdf") && !expectedPdfs.has(fileName)) {
        fs.rmSync(path.join(source.pdfDir, fileName), { force: true });
      }
    }
  }
  process.stdout.write("\n");
  console.log(`Rendered ${rendered} resume PDFs with Microsoft Edge.`);
} finally {
  fs.rmSync(profileDir, { recursive: true, force: true });
}
