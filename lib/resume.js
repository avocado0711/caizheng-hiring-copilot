"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { cleanText } = require("./screening");
const { resolvePythonRuntime } = require("./python");

const execFileAsync = promisify(execFile);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".bmp", ".gif", ".tif", ".tiff", ".webp"]);
const TEXT_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".text"]);
const OCR_SECTION_TERMS = [
  "工作经历", "项目经历", "项目经验", "专业技能", "技能", "教育背景",
  "教育经历", "个人简介", "自我评价", "求职意向", "联系方式",
];
const OCR_TECH_TERMS = [
  "Python", "Java", "JavaScript", "TypeScript", "Go", "C++", "SQL",
  "FastAPI", "Django", "Flask", "React", "Vue", "Node", "Docker",
  "Kubernetes", "Redis", "MySQL", "PostgreSQL", "Elasticsearch", "Milvus",
  "RAG", "Agent", "LLM", "PyTorch", "TensorFlow", "LangChain",
];
const OCR_BODY_TERMS = [
  "工作", "项目", "经验", "负责", "开发", "使用", "平台", "系统",
  "服务", "数据", "业务", "团队", "完成", "设计", "优化", "技术",
  "公司", "工程师", "本科", "硕士", "检索", "接口", "指标", "产品",
  "生产", "构建", "管理", "维护", "实现", "参与", "主导", "交付",
  "客户", "用户", "需求", "测试", "上线", "架构", "算法", "模型",
  "分析", "沟通", "协作",
];

function decodeText(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString("utf16le");
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.allocUnsafe(buffer.length - 2);
    for (let index = 2; index + 1 < buffer.length; index += 2) {
      swapped[index - 2] = buffer[index + 1];
      swapped[index - 1] = buffer[index];
    }
    return swapped.toString("utf16le");
  }
  return buffer.toString("utf8").replace(/^\uFEFF/, "");
}

function normalizeResumeText(value) {
  return cleanText(value)
    .replace(/([\u3400-\u9fff]) +(?=[\u3400-\u9fff])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function assessOcrQuality(text) {
  const normalized = normalizeResumeText(text);
  const compact = normalized.replace(/\s+/g, "");
  const lines = normalized.split("\n").filter((line) => line.trim());
  const sections = OCR_SECTION_TERMS.filter((term) => normalized.includes(term));
  const termHits = OCR_TECH_TERMS.filter((term) =>
    new RegExp(`(?:^|[^A-Za-z0-9+#.])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^A-Za-z0-9+#.])`, "i")
      .test(normalized));
  const hasContact = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(normalized)
    || /(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d[-\s]?\d{4}[-\s]?\d{4}(?!\d)/.test(normalized);
  const chineseCharacters = (normalized.match(/[\u3400-\u9fff]/g) || []).length;
  const bodyTermOccurrences = OCR_BODY_TERMS.reduce(
    (total, term) => total + (normalized.match(new RegExp(term, "g")) || []).length,
    0,
  );
  const bodyTermDensity = chineseCharacters
    ? bodyTermOccurrences / chineseCharacters
    : 1;

  let score = 0;
  if (compact.length >= 500) score += 20;
  else if (compact.length >= 250) score += 14;
  else if (compact.length >= 120) score += 8;
  else score += 2;
  if (sections.length >= 2) score += 20;
  else if (sections.length === 1) score += 10;
  if (termHits.length >= 3) score += 20;
  else if (termHits.length >= 1) score += 10;
  if (bodyTermDensity >= 0.08) score += 20;
  else if (bodyTermDensity >= 0.05) score += 12;
  else if (bodyTermDensity >= 0.03) score += 5;
  if (hasContact) score += 10;
  if (lines.length >= 8) score += 10;
  else if (lines.length >= 3) score += 5;
  if (chineseCharacters >= 100 && bodyTermDensity < 0.03) score = Math.min(score, 44);
  else if (chineseCharacters >= 100 && bodyTermDensity < 0.08) score = Math.min(score, 64);
  if (compact.length >= 180 && termHits.length < 3) score = Math.min(score, 64);
  score = Math.min(100, score);

  const level = score >= 65 ? "high" : score >= 45 ? "review" : "low";
  const label = level === "high"
    ? "OCR 质量良好"
    : level === "review"
      ? "OCR 需复核"
      : "OCR 质量较低";
  const warnings = [];
  if (level !== "high") {
    warnings.push(`${label}（${score}/100），需人工复核姓名、技能和关键经历`);
  }
  if (!sections.length) {
    warnings.push("OCR 未识别到常见的简历章节标题");
  }
  if (!termHits.length) {
    warnings.push("OCR 未识别到常见技术技能词");
  }
  return {
    score,
    level,
    label,
    characterCount: compact.length,
    lineCount: lines.length,
    sectionHeadings: sections,
    termHits,
    hasContact,
    chineseCharacters,
    bodyTermOccurrences,
    bodyTermDensity: Number(bodyTermDensity.toFixed(3)),
    warnings,
  };
}

function findZipEnd(buffer) {
  const minOffset = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

function readZipEntries(buffer) {
  const endOffset = findZipEnd(buffer);
  if (endOffset < 0) throw new Error("DOCX 文件结构无效：未找到 ZIP 目录");
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  let offset = buffer.readUInt32LE(endOffset + 16);
  const entries = new Map();

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");

    if (localOffset + 30 <= buffer.length && buffer.readUInt32LE(localOffset) === 0x04034b50) {
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      let data;
      if (method === 0) data = compressed;
      else if (method === 8) data = zlib.inflateRawSync(compressed);
      if (data) entries.set(name, data);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function decodeXmlEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function docxXmlToText(xml) {
  return normalizeResumeText(
    decodeXmlEntities(
      xml
        .replace(/<w:tab\b[^>]*\/>/gi, "\t")
        .replace(/<w:br\b[^>]*\/>/gi, "\n")
        .replace(/<\/w:p>/gi, "\n")
        .replace(/<\/w:tr>/gi, "\n")
        .replace(/<\/w:tc>/gi, "\t")
        .replace(/<[^>]+>/g, ""),
    ),
  );
}

function extractDocx(buffer) {
  const entries = readZipEntries(buffer);
  const document = entries.get("word/document.xml");
  if (!document) throw new Error("DOCX 中未找到正文 word/document.xml");
  const text = docxXmlToText(document.toString("utf8"));
  if (!text) throw new Error("DOCX 中没有可提取的文字");
  return text;
}

function decodePdfLiteral(value) {
  return value
    .replace(/\\([nrtbf()\\])/g, (_, char) => ({
      n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\",
    }[char]))
    .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)));
}

function extractPdfOperators(value) {
  const parts = [];
  const pattern = /\(((?:\\.|[^\\)])*)\)\s*(?:Tj|'|")|<([0-9a-fA-F\s]+)>\s*Tj|\[(.*?)\]\s*TJ/g;
  let match;
  while ((match = pattern.exec(value))) {
    if (match[1] !== undefined) {
      parts.push(decodePdfLiteral(match[1]));
    } else if (match[2] !== undefined) {
      const hex = match[2].replace(/\s/g, "");
      const bytes = [];
      for (let index = 0; index + 1 < hex.length; index += 2) {
        bytes.push(parseInt(hex.slice(index, index + 2), 16));
      }
      parts.push(Buffer.from(bytes).toString("utf16le"));
    } else if (match[3] !== undefined) {
      const arrayPattern = /\(((?:\\.|[^\\)])*)\)/g;
      let arrayMatch;
      while ((arrayMatch = arrayPattern.exec(match[3]))) {
        parts.push(decodePdfLiteral(arrayMatch[1]));
      }
    }
  }
  return parts.join(" ");
}

function parsePdfObjects(buffer) {
  const source = buffer.toString("latin1");
  const objects = new Map();
  const headerPattern = /(?:^|[\r\n])(\d+)\s+(\d+)\s+obj\b/g;
  let match;
  while ((match = headerPattern.exec(source))) {
    const objectId = Number(match[1]);
    const start = headerPattern.lastIndex;
    let endObject = source.indexOf("endobj", start);
    if (endObject < 0) endObject = source.length;
    const body = source.slice(start, endObject);
    const streamMatch = /\bstream(?:\r\n|\n|\r)/.exec(body);
    let dictionary = body;
    let data = null;
    if (streamMatch) {
      dictionary = body.slice(0, streamMatch.index);
      const dataStart = start + streamMatch.index + streamMatch[0].length;
      const endStream = source.indexOf("endstream", dataStart);
      if (endStream >= 0) {
        const declaredLength = Number(dictionary.match(/\/Length\s+(\d+)\b/)?.[1]);
        let rawEnd = endStream;
        if (
          Number.isFinite(declaredLength)
          && declaredLength >= 0
          && dataStart + declaredLength <= buffer.length
        ) {
          rawEnd = dataStart + declaredLength;
        } else {
          while (rawEnd > dataStart && [10, 13].includes(buffer[rawEnd - 1])) rawEnd -= 1;
        }
        const raw = buffer.subarray(dataStart, rawEnd);
        if (/\/Filter\s*(?:\[\s*)?\/FlateDecode\b/.test(dictionary)) {
          try {
            data = zlib.inflateSync(raw);
          } catch {
            try {
              data = zlib.inflateRawSync(raw);
            } catch {
              data = null;
            }
          }
        } else {
          data = raw;
        }
      }
    }
    objects.set(objectId, { dictionary, data });
  }
  return objects;
}

function decodeCMapUnicode(hex) {
  const clean = String(hex || "").replace(/\s/g, "");
  let value = "";
  for (let index = 0; index + 3 < clean.length; index += 4) {
    value += String.fromCharCode(parseInt(clean.slice(index, index + 4), 16));
  }
  if (!value && clean.length >= 2) value = String.fromCharCode(parseInt(clean, 16));
  return value;
}

function parsePdfCMap(data) {
  const source = data.toString("latin1");
  const codes = new Map();
  let codeBytes = 2;
  const codeSpace = source.match(/begincodespacerange\s*<([0-9a-fA-F]+)>/);
  if (codeSpace) codeBytes = Math.max(1, Math.min(4, Math.ceil(codeSpace[1].length / 2)));

  for (const section of source.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of section[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      codeBytes = Math.max(1, Math.ceil(pair[1].length / 2));
      codes.set(parseInt(pair[1], 16), decodeCMapUnicode(pair[2]));
    }
  }

  for (const section of source.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    const body = section[1];
    for (const range of body.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:<([0-9a-fA-F]+)>|\[([\s\S]*?)\])/g)) {
      const start = parseInt(range[1], 16);
      const end = parseInt(range[2], 16);
      if (end < start || end - start > 65_535) continue;
      if (range[3]) {
        const destination = decodeCMapUnicode(range[3]);
        const base = destination.charCodeAt(0);
        for (let code = start; code <= end; code += 1) {
          codes.set(code, String.fromCharCode(base + code - start));
        }
      } else if (range[4]) {
        const destinations = [...range[4].matchAll(/<([0-9a-fA-F]+)>/g)]
          .map((item) => decodeCMapUnicode(item[1]));
        destinations.forEach((value, index) => {
          if (start + index <= end) codes.set(start + index, value);
        });
      }
    }
  }
  return codes.size ? { codes, codeBytes } : null;
}

function buildPdfFontMaps(objects) {
  const fonts = new Map();
  for (const object of objects.values()) {
    const fontDictionary = object.dictionary.match(/\/Font\s*<<([\s\S]*?)>>/);
    if (!fontDictionary) continue;
    for (const resource of fontDictionary[1].matchAll(/\/([A-Za-z0-9_.-]+)\s+(\d+)\s+0\s+R/g)) {
      const resourceName = resource[1];
      const fontId = Number(resource[2]);
      const fontObject = objects.get(fontId);
      if (!fontObject) continue;
      const cmapId = Number(fontObject.dictionary.match(/\/ToUnicode\s+(\d+)\s+0\s+R/)?.[1]);
      const cmapObject = cmapId ? objects.get(cmapId) : null;
      if (cmapObject?.data) {
        const cmap = parsePdfCMap(cmapObject.data);
        if (cmap) fonts.set(resourceName, cmap);
      }
    }
  }
  return fonts;
}

function decodePdfBytes(bytes, fontMap, forceUtf16 = false) {
  if (fontMap) {
    let value = "";
    let unmapped = 0;
    for (let index = 0; index < bytes.length;) {
      let matched = false;
      for (let width = fontMap.codeBytes; width >= 1; width -= 1) {
        if (index + width > bytes.length) continue;
        let code = 0;
        for (let offset = 0; offset < width; offset += 1) code = (code << 8) | bytes[index + offset];
        if (fontMap.codes.has(code)) {
          value += fontMap.codes.get(code);
          index += width;
          matched = true;
          break;
        }
      }
      if (!matched) {
        unmapped += 1;
        index += fontMap.codeBytes;
      }
    }
    return { text: value, unmapped };
  }
  if (forceUtf16 && bytes.length % 2 === 0) {
    const swapped = Buffer.allocUnsafe(bytes.length);
    for (let index = 0; index + 1 < bytes.length; index += 2) {
      swapped[index] = bytes[index + 1];
      swapped[index + 1] = bytes[index];
    }
    return { text: swapped.toString("utf16le"), unmapped: 0 };
  }
  return {
    text: Buffer.from(bytes).toString("latin1"),
    unmapped: 0,
  };
}

function extractPdfTextWithFonts(data, fonts) {
  const source = data.toString("latin1");
  const tokenPattern = /\/([A-Za-z0-9_.-]+)\s+[-+]?(?:\d*\.)?\d+\s+Tf|\(((?:\\.|[^\\)])*)\)\s*(?:Tj|'|")|<([0-9a-fA-F\s]+)>\s*Tj|\[(.*?)\]\s*TJ|([-+]?(?:\d*\.)?\d+)\s+([-+]?(?:\d*\.)?\d+)\s+(?:Td|TD)\b|\b(T\*|Tm|ET)\b/g;
  let fontMap = null;
  let text = "";
  let unmapped = 0;
  let hasText = false;
  const append = (value, forceUtf16 = false, bytes = null) => {
    const decoded = bytes
      ? decodePdfBytes(bytes, fontMap, forceUtf16)
      : { text: value, unmapped: 0 };
    text += decoded.text;
    unmapped += decoded.unmapped;
    if (decoded.text) hasText = true;
  };

  for (const match of source.matchAll(tokenPattern)) {
    if (match[1]) {
      fontMap = fonts.get(match[1]) || null;
    } else if (match[2] !== undefined) {
      append("", false, Buffer.from(decodePdfLiteral(match[2]), "latin1"));
    } else if (match[3] !== undefined) {
      append("", true, Buffer.from(match[3].replace(/\s/g, ""), "hex"));
    } else if (match[4] !== undefined) {
      const array = match[4];
      for (const item of array.matchAll(/\(((?:\\.|[^\\)])*)\)|<([0-9a-fA-F\s]+)>/g)) {
        if (item[1] !== undefined) append("", false, Buffer.from(decodePdfLiteral(item[1]), "latin1"));
        else append("", true, Buffer.from(item[2].replace(/\s/g, ""), "hex"));
      }
    } else if (match[5] !== undefined) {
      if (Math.abs(Number(match[6])) > 0.1 && hasText && !text.endsWith("\n")) text += "\n";
    } else if (match[7]) {
      const operator = match[7];
      if ((operator === "Tm" || operator === "ET") && hasText && !text.endsWith("\n")) text += "\n";
      if (operator === "T*" && !text.endsWith("\n")) text += "\n";
    }
  }
  return { text, unmapped };
}

function pdfTextLooksUsable(text, hadCidFonts, unmapped) {
  if (!text.trim()) return false;
  const suspicious = (text.match(/[\uE000-\uF8FF\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) || []).length;
  if (suspicious / Math.max(1, text.length) > 0.02) return false;
  if (hadCidFonts && unmapped > text.length * 0.25) return false;
  return true;
}

function extractPdf(buffer) {
  const objects = parsePdfObjects(buffer);
  const fonts = buildPdfFontMaps(objects);
  const pages = [];
  let unmapped = 0;
  const contentIds = new Set();
  for (const object of objects.values()) {
    if (!/\/Type\s*\/Page\b/.test(object.dictionary)) continue;
    const contents = object.dictionary.match(/\/Contents\s*(?:(\d+)\s+0\s+R|\[([\s\S]*?)\])/);
    if (!contents) continue;
    if (contents[1]) contentIds.add(Number(contents[1]));
    if (contents[2]) {
      for (const reference of contents[2].matchAll(/(\d+)\s+0\s+R/g)) {
        contentIds.add(Number(reference[1]));
      }
    }
  }
  for (const contentId of contentIds) {
    const object = objects.get(contentId);
    if (!object?.data) continue;
    const source = object.data.toString("latin1");
    if (!/\bBT\b/.test(source) || !/\b(?:Tj|TJ)\b/.test(source)) continue;
    const extracted = extractPdfTextWithFonts(object.data, fonts);
    if (extracted.text.trim()) pages.push(extracted.text);
    unmapped += extracted.unmapped;
  }
  const mappedText = normalizeResumeText(pages.join("\n"));
  if (pdfTextLooksUsable(mappedText, fonts.size > 0, unmapped)) return mappedText;

  // Fallback for simple text PDFs that do not use CID fonts or ToUnicode maps.
  const chunks = [];
  const source = buffer.toString("latin1");
  const streamPattern = /stream\r?\n/g;
  let match;
  while ((match = streamPattern.exec(source))) {
    const start = match.index + match[0].length;
    const end = source.indexOf("endstream", start);
    if (end < 0) break;
    const raw = buffer.subarray(start, end);
    let decoded = "";
    try {
      decoded = zlib.inflateSync(raw).toString("latin1");
    } catch {
      decoded = raw.toString("latin1");
    }
    if (/\bBT\b/.test(decoded) && /\b(?:Tj|TJ)\b/.test(decoded)) {
      const text = extractPdfOperators(decoded);
      if (text.trim()) chunks.push(text);
    }
  }
  const fallbackText = normalizeResumeText(chunks.join("\n"));
  if (pdfTextLooksUsable(fallbackText, fonts.size > 0, 0)) return fallbackText;
  if (!fallbackText) {
    throw new Error("PDF 未提取到文字，可能是扫描件、复杂字体或加密文件；可改用图片 OCR 或粘贴文字");
  }
  throw new Error("PDF 使用复杂中文字体编码，未能可靠还原文字；请粘贴文字或改用图片 OCR");
}

function extractJsonText(buffer) {
  const parsed = JSON.parse(decodeText(buffer));
  if (Array.isArray(parsed)) {
    const text = parsed.map((item) => item?.text || item?.content || "").filter(Boolean).join("\n");
    if (text.trim()) return normalizeResumeText(text);
  }
  if (parsed && typeof parsed === "object") {
    const text = parsed.text || parsed.content || parsed.allText;
    if (typeof text === "string" && text.trim()) return normalizeResumeText(text);
  }
  throw new Error("JSON 文件中未找到 text/content 字段");
}

async function runWindowsOcr(filePath) {
  const scriptPath = path.join(__dirname, "..", "scripts", "ocr-image.ps1");
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-Path", filePath],
    { timeout: 90_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
  );
  const parsed = JSON.parse(String(stdout).trim());
  if (!parsed.text || !String(parsed.text).trim()) throw new Error("OCR 未识别到文字");
  return parsed;
}

async function runRapidOcr(filePath) {
  const python = resolvePythonRuntime();
  const scriptPath = path.join(__dirname, "..", "ml", "rapid_ocr.py");
  const { stdout } = await execFileAsync(
    python.command,
    [...python.args, scriptPath, filePath],
    {
      timeout: 180_000,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
      },
    },
  );
  const parsed = JSON.parse(String(stdout).trim());
  if (!parsed.text || !String(parsed.text).trim()) throw new Error("RapidOCR 未识别到文字");
  return parsed;
}

async function runPreferredOcr(filePath) {
  const configuredEngine = String(process.env.HIREPROOF_OCR_ENGINE || "rapidocr")
    .trim()
    .toLocaleLowerCase();
  let rapidError = null;
  if (configuredEngine !== "windows") {
    try {
      const parsed = await runRapidOcr(filePath);
      return {
        ...parsed,
        engine: "rapidocr",
        fallbackWarnings: [],
      };
    } catch (error) {
      rapidError = error;
    }
  }

  const parsed = await runWindowsOcr(filePath);
  return {
    ...parsed,
    engine: "windows-ocr",
    fallbackWarnings: rapidError
      ? [`RapidOCR 不可用，已降级到 Windows OCR：${cleanText(rapidError.message).slice(0, 160)}`]
      : [],
  };
}

async function extractImage(buffer, extension) {
  if (process.platform !== "win32") {
    throw new Error("当前系统不支持内置 Windows OCR，请粘贴简历文字或改用文本文件");
  }
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hireproof-resume-"));
  const filePath = path.join(tempDir, `resume${extension}`);
  fs.writeFileSync(filePath, buffer);
  try {
    const parsed = await runPreferredOcr(filePath);
    const text = normalizeResumeText(parsed.text);
    const extractionQuality = assessOcrQuality(text);
    const warnings = [...(parsed.fallbackWarnings || []), ...extractionQuality.warnings];
    return {
      text,
      method: parsed.engine,
      extractionQuality,
      warnings,
      ocr: {
        engine: parsed.engine,
        language: parsed.language || "",
        meanConfidence: parsed.meanConfidence ?? null,
        passes: parsed.passes || [],
        preprocess: parsed.preprocess || null,
        lines: parsed.lines || [],
      },
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function extractPdfWithOcr(buffer) {
  if (process.platform !== "win32") {
    throw new Error("扫描 PDF 自动 OCR 目前仅支持 Windows");
  }
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hireproof-pdf-ocr-"));
  const sourcePath = path.join(tempDir, "resume.pdf");
  const imageDir = path.join(tempDir, "pages");
  fs.writeFileSync(sourcePath, buffer);
  try {
    const python = resolvePythonRuntime();
    const rendererPath = path.join(__dirname, "..", "ml", "render_pdf.py");
    const { stdout } = await execFileAsync(
      python.command,
      [
        ...python.args,
        rendererPath,
        "--input",
        sourcePath,
        "--output-dir",
        imageDir,
        "--dpi",
        "220",
        "--max-pages",
        "20",
      ],
      {
        timeout: 180_000,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
      },
    );
    const rendered = JSON.parse(String(stdout).trim());
    const pageTexts = [];
    const pageOcr = [];
    for (const page of rendered.pages || []) {
      const parsed = await runPreferredOcr(page.path);
      pageTexts.push(parsed.text);
      pageOcr.push({
        page: page.page,
        engine: parsed.engine,
        language: parsed.language || "",
        meanConfidence: parsed.meanConfidence ?? null,
        passes: parsed.passes || [],
        preprocess: parsed.preprocess || null,
        lines: parsed.lines || [],
      });
    }
    const text = normalizeResumeText(pageTexts.join("\n"));
    if (!text) throw new Error("扫描 PDF 未识别到文字");
    const extractionQuality = assessOcrQuality(text);
    const engines = [...new Set(pageOcr.map((page) => page.engine))];
    const fallbackWarnings = pageOcr.some((page) => page.engine !== "rapidocr")
      ? ["部分页面已降级到 Windows OCR"]
      : [];
    const warnings = [...fallbackWarnings, ...extractionQuality.warnings];
    if (rendered.truncated) {
      warnings.push(`PDF 共 ${rendered.pageCount} 页，仅识别前 ${rendered.renderedPages} 页`);
    }
    return {
      text,
      method: engines.length === 1 && engines[0] === "rapidocr" ? "pdf-rapidocr" : "pdf-ocr",
      extractionQuality,
      warnings,
      ocr: {
        pageCount: rendered.pageCount,
        renderedPages: rendered.renderedPages,
        truncated: rendered.truncated,
        dpi: rendered.dpi,
        engines,
        pages: pageOcr,
      },
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function extractResumeFile(file) {
  if (!file || typeof file.name !== "string" || typeof file.data !== "string") {
    throw new Error("文件数据无效");
  }
  const extension = path.extname(file.name).toLocaleLowerCase();
  const buffer = Buffer.from(file.data, "base64");
  if (!buffer.length) throw new Error("文件为空");
  let text;
  let method;
  let extractionQuality = null;
  let warnings = [];
  let ocr = null;

  if (TEXT_EXTENSIONS.has(extension)) {
    text = normalizeResumeText(decodeText(buffer));
    method = "text";
  } else if (extension === ".docx") {
    text = extractDocx(buffer);
    method = "docx";
  } else if (extension === ".pdf") {
    try {
      text = extractPdf(buffer);
      method = "pdf";
    } catch (nativeError) {
      try {
        const extracted = await extractPdfWithOcr(buffer);
        text = extracted.text;
        method = extracted.method;
        extractionQuality = extracted.extractionQuality;
        warnings = extracted.warnings;
        ocr = extracted.ocr;
      } catch (ocrError) {
        throw new Error(`${nativeError.message}；扫描 PDF OCR 回退失败：${ocrError.message}`);
      }
    }
  } else if (extension === ".json") {
    text = extractJsonText(buffer);
    method = "json";
  } else if (IMAGE_EXTENSIONS.has(extension)) {
    const extracted = await extractImage(buffer, extension);
    text = extracted.text;
    method = extracted.method;
    extractionQuality = extracted.extractionQuality;
    warnings = extracted.warnings;
    ocr = extracted.ocr;
  } else if (extension === ".doc") {
    throw new Error("暂不支持旧版 .doc，请另存为 .docx 或粘贴文字");
  } else {
    throw new Error(`不支持的文件类型：${extension || "未知"}`);
  }

  if (!cleanText(text)) throw new Error("没有提取到有效文字");
  return {
    text: normalizeResumeText(text),
    method,
    bufferSize: buffer.length,
    extractionQuality,
    warnings,
    ocr,
  };
}

function looksLikePersonName(line) {
  if (!line || line.length > 24) return false;
  if (/[@：:]|\d{7,}|简历|求职|个人资料|resume|curriculum/i.test(line)) return false;
  if (/^(男|女|未婚|已婚|年龄|电话|邮箱|教育背景|工作经历|项目经历|项目经验|个人简介|自我评价|专业技能|求职意向|联系方式)/.test(line)) return false;
  return /^[\u3400-\u9fff·]{2,12}$/.test(line) || /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(line);
}

function scorePersonName(line) {
  if (!looksLikePersonName(line)) return -Infinity;
  const length = (line.match(/[\u3400-\u9fff]/g) || []).length || line.split(/\s+/).length;
  let score = length <= 4 ? 4 : length <= 6 ? 1 : 6 - length;
  if (/工程师|经理|架构师|设计师|研究员|分析师|负责人|开发|运营|顾问|专家/.test(line)) score -= 10;
  if (/大学|学院|公司|科技|集团|有限|中心/.test(line)) score -= 12;
  if (/经验|负责|评审|培养|工作地点|专业|技能|项目|数据|平台/.test(line)) score -= 10;
  return score;
}

function preferFullNameLine(selected, lines, selectedIndex) {
  const name = cleanText(selected);
  if (!/^[\u3400-\u9fff]{2}$/.test(name)) return name;
  const nearby = lines
    .map((line, index) => ({ line: cleanText(line), index }))
    .filter((item) =>
      Math.abs(item.index - selectedIndex) <= 2
      && item.line.length > name.length
      && item.line.length <= name.length + 2
      && item.line.endsWith(name)
      && looksLikePersonName(item.line))
    .sort((left, right) => left.line.length - right.line.length);
  return nearby[0]?.line || name;
}

function detectName(lines, fileName) {
  for (const line of lines) {
    const labelled = line.match(/(?:姓\s*名|Name)\s*[：:]\s*([^\n|，,]{1,30})/i);
    if (labelled) return cleanText(labelled[1]).replace(/\s+/g, " ").slice(0, 30);
  }

  const contactIndex = lines.findIndex((line) => /@|\d{7,}/.test(line));
  if (contactIndex >= 0) {
    const nearby = lines
      .map((line, index) => ({
        line,
        score: index < contactIndex && index >= Math.max(0, contactIndex - 6)
          ? scorePersonName(line) - (contactIndex - index) * 2
          : -Infinity,
        index,
      }))
      .filter((item) => Number.isFinite(item.score))
      .sort((left, right) => right.score - left.score || right.index - left.index);
    if (nearby.length) return preferFullNameLine(nearby[0].line, lines, nearby[0].index);
  }

  const leading = lines
    .slice(0, 20)
    .map((line, index) => ({ line, score: scorePersonName(line), index }))
    .filter((item) => Number.isFinite(item.score))
    .sort((left, right) => right.score - left.score || left.index - right.index);
  if (leading.length) return preferFullNameLine(leading[0].line, lines, leading[0].index);

  const stem = path.basename(fileName, path.extname(fileName))
    .replace(/(?:简历|resume|cv|候选人)/gi, "")
    .replace(/[_-]?\d{6,}$/g, "")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!stem || /^\d+$/.test(stem)) return "未命名候选人";
  return stem.slice(0, 30);
}

function extractSection(text, headings) {
  const lines = text.split("\n");
  const headingPattern = new RegExp(`^(?:${headings.join("|")})\\s*[：:]?\\s*$`, "i");
  const anyHeading = /^(?:教育背景|工作经历|项目经历|专业技能|技能|个人简介|自我评价|求职意向|联系方式|工作经历|项目经验|教育经历|证书|语言能力)\s*[：:]?\s*$/i;
  for (let index = 0; index < lines.length; index += 1) {
    if (!headingPattern.test(lines[index].trim())) continue;
    const values = [];
    for (let cursor = index + 1; cursor < lines.length && values.length < 8; cursor += 1) {
      const line = lines[cursor].trim();
      if (!line) continue;
      if (anyHeading.test(line)) break;
      values.push(line);
    }
    if (values.length) return values.join(" ").slice(0, 600);
  }
  return "";
}

function parseResumeText(text, options = {}) {
  const normalized = normalizeResumeText(text);
  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  let email = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  if (email) {
    email = email.replace(
      /^(?:\+?86[-\s]?)?1[3-9]\d(?:[-\s]?\d){8}[-\s]*/,
      "",
    );
  }
  const phoneMatch = normalized.match(/(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d[-\s]?\d{4}[-\s]?\d{4}(?!\d)|(?<!\d)\+?\d{2,4}[-\s]?\d{6,10}(?!\d)/);
  const phone = phoneMatch?.[0]?.replace(/\s+/g, "") || "";
  const explicitYears = normalized.match(/(?:工作)?(?:经验|经历)\s*[：:]?\s*(\d{1,2})(?:\+)?\s*年/i)
    || normalized.match(/(\d{1,2})(?:\+)?\s*年\s*(半)?(?:以上)?(?:的)?(?:相关)?(?:工作|开发|从业)(?:经验)?/i)
    || normalized.match(/(\d{1,2})\s*年\s*半(?:以上)?(?:相关)?(?:工作)?经验/i)
    || normalized.match(/(\d{1,2})\s*年\s*(半)?[^\n]{0,24}(?:经验|工作)/i);
  const yearsExperience = explicitYears
    ? Number(explicitYears[1]) + (/年\s*半/.test(explicitYears[0]) || explicitYears[2] ? 0.5 : 0)
    : null;
  const education = ["博士", "硕士", "本科", "大专", "专科", "高中"]
    .find((item) => normalized.includes(item)) || "";
  const name = cleanText(options.name || detectName(lines, options.fileName || "resume.txt")).slice(0, 30);
  const summary = extractSection(normalized, ["个人简介", "自我评价", "职业概要", "个人总结", "summary", "profile", "about"]);
  const skillsText = extractSection(normalized, ["专业技能", "技能", "核心能力", "skills", "technical skills"]);
  let title = normalized.match(/(?:求职意向|目标岗位|应聘职位|意向岗位)\s*[：:]\s*([^\n]{2,40})/i)?.[1]?.trim() || "";
  const contactIndex = lines.findIndex((line) => /@|\d{7,}/.test(line));
  if (!title && contactIndex >= 0) {
    for (let index = contactIndex - 1; index >= Math.max(0, contactIndex - 4); index -= 1) {
      const line = lines[index];
      if (/工程师|经理|架构师|设计师|研究员|分析师|负责人|顾问|专家/.test(line)) {
        title = line;
        break;
      }
      if (looksLikePersonName(line)) continue;
      if (line && line.length <= 60 && !/@|\d{7,}/.test(line) && !/^(?:\d+\s*\/\s*\d+|第?\d+页)$/.test(line)) {
        title = line;
        break;
      }
    }
  }

  return {
    name,
    email,
    phone,
    title,
    yearsExperience,
    education,
    summary,
    skillsText,
    lineCount: lines.length,
    characterCount: normalized.length,
    textHash: crypto.createHash("sha256").update(normalized).digest("hex"),
  };
}

function identityKeys(profile) {
  const keys = [];
  if (profile?.email) keys.push(`email:${String(profile.email).toLocaleLowerCase()}`);
  if (profile?.phone) keys.push(`phone:${String(profile.phone).replace(/\D/g, "")}`);
  return keys;
}

module.exports = {
  IMAGE_EXTENSIONS,
  TEXT_EXTENSIONS,
  assessOcrQuality,
  decodeText,
  detectName,
  docxXmlToText,
  extractDocx,
  extractPdf,
  extractPdfTextWithFonts,
  extractResumeFile,
  identityKeys,
  normalizeResumeText,
  parsePdfCMap,
  parsePdfObjects,
  parseResumeText,
  readZipEntries,
  buildPdfFontMaps,
};
