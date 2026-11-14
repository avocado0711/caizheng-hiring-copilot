"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function clean(value) {
  return String(value ?? "").replace(/\0/g, "").replace(/\r\n?/g, "\n").trim();
}

function normalizeSourceUrl(value) {
  const raw = clean(value).slice(0, 500);
  if (!raw) return "";
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`来源链接格式无效：${raw}`);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("来源链接只允许 http 或 https 地址");
  }
  return url.toString();
}

function normalizeDocument(input) {
  const now = new Date().toISOString();
  const content = clean(input?.content).slice(0, 200_000);
  if (content.length < 20) throw new Error("知识文档内容过短");
  return {
    id: String(input?.id || `knowledge-${crypto.randomUUID()}`),
    title: clean(input?.title || "未命名知识文档").slice(0, 180),
    documentType: clean(input?.documentType || "company").slice(0, 40),
    entityName: clean(input?.entityName || "").slice(0, 120),
    sourceLabel: clean(input?.sourceLabel || "用户导入资料").slice(0, 180),
    publisher: clean(input?.publisher || "").slice(0, 180),
    sourceUrl: normalizeSourceUrl(input?.sourceUrl),
    publishedAt: clean(input?.publishedAt || "").slice(0, 40),
    retrievedAt: clean(input?.retrievedAt || "").slice(0, 40),
    synthetic: Boolean(input?.synthetic),
    license: clean(input?.license || "未声明，使用前需确认授权").slice(0, 180),
    content,
    createdAt: input?.createdAt || now,
    updatedAt: now,
  };
}

function seedKnowledge(store, filePath) {
  let added = 0;
  if (fs.existsSync(filePath)) {
    const pack = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const existingIds = new Set(store.state.knowledgeDocuments.map((document) => document.id));
    for (const document of pack.documents || []) {
      const normalized = normalizeDocument(document);
      if (existingIds.has(normalized.id)) continue;
      existingIds.add(normalized.id);
      store.state.knowledgeDocuments.push(normalized);
      added += 1;
    }
  }
  const wasSeeded = store.state.knowledgeSeeded;
  store.state.knowledgeSeeded = true;
  if (added || !wasSeeded) store.save();
  return added;
}

function createKnowledgeDocument(store, input) {
  const document = normalizeDocument(input);
  store.state.knowledgeDocuments.push(document);
  store.save();
  return document;
}

function importKnowledgeDocuments(store, documents) {
  if (!Array.isArray(documents) || !documents.length) {
    throw new Error("资料包中没有可导入的文档");
  }
  if (documents.length > 200) throw new Error("单次最多导入 200 份知识资料");
  const existingIds = new Set(store.state.knowledgeDocuments.map((document) => document.id));
  const normalized = documents
    .map((document) => normalizeDocument(document))
    .filter((document) => !existingIds.has(document.id));
  if (!normalized.length) return [];
  store.state.knowledgeDocuments.push(...normalized);
  store.save();
  return normalized;
}

function removeKnowledgeDocument(store, documentId) {
  const before = store.state.knowledgeDocuments.length;
  store.state.knowledgeDocuments = store.state.knowledgeDocuments.filter(
    (document) => document.id !== documentId,
  );
  if (before === store.state.knowledgeDocuments.length) return false;
  store.save();
  return true;
}

function knowledgeSummary(documents) {
  const entities = new Set();
  const types = new Set();
  for (const document of documents || []) {
    if (document.entityName) entities.add(document.entityName);
    if (document.documentType) types.add(document.documentType);
  }
  return {
    documentCount: (documents || []).length,
    entityCount: entities.size,
    typeCount: types.size,
    syntheticCount: (documents || []).filter((document) => document.synthetic).length,
  };
}

function publicKnowledgeDocuments(documents, options = {}) {
  return (documents || []).map((document) => ({
    id: document.id,
    title: document.title,
    documentType: document.documentType,
    entityName: document.entityName,
    sourceLabel: document.sourceLabel,
    publisher: document.publisher,
    sourceUrl: document.sourceUrl,
    publishedAt: document.publishedAt,
    retrievedAt: document.retrievedAt,
    synthetic: document.synthetic,
    license: document.license,
    characterCount: document.content.length,
    preview: options.includeContent
      ? document.content.slice(0, 800)
      : document.content.replace(/\s+/g, " ").slice(0, 140),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  }));
}

module.exports = {
  createKnowledgeDocument,
  importKnowledgeDocuments,
  knowledgeSummary,
  normalizeDocument,
  publicKnowledgeDocuments,
  removeKnowledgeDocument,
  seedKnowledge,
};
