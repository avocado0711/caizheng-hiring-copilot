"use strict";

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function tokenize(value) {
  const text = String(value ?? "").toLocaleLowerCase();
  const tokens = [];
  for (const match of text.matchAll(/[a-z0-9][a-z0-9.+#_-]*/g)) {
    if (match[0].length >= 2) tokens.push(match[0]);
  }
  for (const match of text.matchAll(/[\u3400-\u9fff]+/g)) {
    const sequence = match[0];
    for (let index = 0; index < sequence.length - 1; index += 1) {
      tokens.push(sequence.slice(index, index + 2));
    }
    if (sequence.length <= 6) tokens.push(sequence);
  }
  return tokens;
}

function splitLongParagraph(text, maxLength) {
  if (text.length <= maxLength) return [text];
  const pieces = [];
  let cursor = 0;
  while (cursor < text.length) {
    let end = Math.min(text.length, cursor + maxLength);
    if (end < text.length) {
      const sentenceEnd = Math.max(
        text.lastIndexOf("。", end),
        text.lastIndexOf("；", end),
        text.lastIndexOf("，", end),
      );
      if (sentenceEnd > cursor + maxLength * 0.55) end = sentenceEnd + 1;
    }
    pieces.push(text.slice(cursor, end).trim());
    cursor = end;
  }
  return pieces;
}

function chunkDocument(document) {
  const paragraphs = String(document.content || "")
    .split(/\n+/)
    .map(clean)
    .filter(Boolean);
  const chunks = [];
  let current = "";
  let index = 1;
  const flush = () => {
    const text = clean(current);
    if (text) {
      chunks.push({
        id: `${document.id}-chunk-${index}`,
        documentId: document.id,
        index,
        text,
        title: document.title,
        documentType: document.documentType,
        entityName: document.entityName,
        sourceLabel: document.sourceLabel,
        publisher: document.publisher || "",
        sourceUrl: document.sourceUrl || "",
        publishedAt: document.publishedAt,
        retrievedAt: document.retrievedAt || "",
        license: document.license || "",
        synthetic: Boolean(document.synthetic),
      });
      index += 1;
    }
    current = "";
  };
  for (const paragraph of paragraphs) {
    for (const piece of splitLongParagraph(paragraph, 520)) {
      if (!current) current = piece;
      else if (current.length + piece.length + 2 <= 620) current += `\n${piece}`;
      else {
        flush();
        current = piece;
      }
    }
  }
  flush();
  return chunks;
}

function buildCorpus(documents) {
  const chunks = [];
  for (const document of documents || []) chunks.push(...chunkDocument(document));
  const tokenized = chunks.map((chunk) => ({
    ...chunk,
    tokens: tokenize([
      chunk.title,
      chunk.entityName,
      chunk.documentType,
      chunk.text,
    ].join(" ")),
  }));
  const documentFrequency = new Map();
  for (const chunk of tokenized) {
    for (const token of new Set(chunk.tokens)) {
      documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
    }
  }
  return {
    chunks: tokenized,
    documentFrequency,
    averageLength: tokenized.length
      ? tokenized.reduce((sum, chunk) => sum + chunk.tokens.length, 0) / tokenized.length
      : 0,
  };
}

function retrieveKnowledge(documents, query, options = {}) {
  const corpus = buildCorpus(documents);
  const queryTokens = tokenize(query);
  const querySet = [...new Set(queryTokens)];
  if (!querySet.length || !corpus.chunks.length) return [];
  const limit = Math.max(1, Math.min(12, Number(options.limit) || 6));
  const k1 = 1.45;
  const b = 0.72;
  const entityNames = (options.entityNames || []).map((name) => clean(name).toLocaleLowerCase());
  const queryText = String(query || "").toLocaleLowerCase();

  const scored = corpus.chunks.map((chunk) => {
    const frequencies = new Map();
    for (const token of chunk.tokens) frequencies.set(token, (frequencies.get(token) || 0) + 1);
    let score = 0;
    for (const token of querySet) {
      const tf = frequencies.get(token) || 0;
      if (!tf) continue;
      const df = corpus.documentFrequency.get(token) || 0;
      const idf = Math.log(1 + (corpus.chunks.length - df + 0.5) / (df + 0.5));
      const denominator = tf + k1 * (1 - b + b * chunk.tokens.length / Math.max(1, corpus.averageLength));
      score += idf * ((tf * (k1 + 1)) / denominator);
    }
    if (chunk.title && queryText.includes(chunk.title.toLocaleLowerCase())) score += 3;
    if (chunk.entityName && entityNames.includes(chunk.entityName.toLocaleLowerCase())) score += 4;
    if (chunk.synthetic) score *= 0.98;
    return { ...chunk, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item, index) => ({
      sourceId: item.documentId,
      chunkId: item.id,
      title: item.title,
      entityName: item.entityName,
      documentType: item.documentType,
      sourceLabel: item.sourceLabel,
      publisher: item.publisher,
      sourceUrl: item.sourceUrl,
      publishedAt: item.publishedAt,
      retrievedAt: item.retrievedAt,
      license: item.license,
      synthetic: item.synthetic,
      snippet: item.text.length > 460 ? `${item.text.slice(0, 457)}...` : item.text,
      score: Number(item.score.toFixed(3)),
      confidence: Number(Math.min(0.98, 0.48 + item.score / 30).toFixed(2)),
      rank: index + 1,
    }));
}

function countKnowledgeChunks(documents) {
  return buildCorpus(documents).chunks.length;
}

module.exports = {
  buildCorpus,
  chunkDocument,
  countKnowledgeChunks,
  retrieveKnowledge,
  tokenize,
};
