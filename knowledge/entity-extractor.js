"use strict";

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function lineEvidence(lines, index) {
  return {
    quote: lines[index].slice(0, 240),
    line: index + 1,
  };
}

function addEntity(target, seen, entity) {
  const name = clean(entity.name).replace(/[，。；、]+$/g, "").slice(0, 120);
  if (name.length < 2) return;
  const key = `${entity.type}:${name.toLocaleLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  target.push({ ...entity, name });
}

function knowledgeEntityType(document) {
  const documentType = String(document?.documentType || "").toLocaleLowerCase();
  const entityName = clean(document?.entityName);
  if (documentType === "education" || /大学|学院|学校|University|College/i.test(entityName)) {
    return "school";
  }
  if (documentType === "role-standard" || documentType === "resume-screening") {
    return "role";
  }
  if (documentType === "organization") return "organization";
  if (documentType === "technology" && entityName === "才证招聘知识中心") {
    return "organization";
  }
  if (["company", "technology", "annual-report", "paper", "patent"].includes(documentType)) {
    return "company";
  }
  return "organization";
}

function normalizeEntityName(value) {
  return clean(value)
    .toLocaleLowerCase()
    .replace(/[（）()【】\[\]·,，。；;：:\s_-]/g, "")
    .replace(/(?:股份有限公司|有限责任公司|有限公司|集团)$/g, "");
}

const ENTITY_LINKED_DOCUMENT_TYPES = new Set([
  "company",
  "organization",
  "technology",
  "annual-report",
  "paper",
  "patent",
  "education",
]);

function filterKnowledgeMatchesForCandidate(entities, knowledgeMatches) {
  const companyNames = new Set(
    (entities || [])
      .filter((entity) => entity.type === "company")
      .map((entity) => normalizeEntityName(entity.name))
      .filter(Boolean),
  );
  const schoolNames = new Set(
    (entities || [])
      .filter((entity) => entity.type === "school")
      .map((entity) => normalizeEntityName(entity.name))
      .filter(Boolean),
  );

  return (knowledgeMatches || []).filter((match) => {
    const documentType = String(match?.documentType || "").toLocaleLowerCase();
    const entityName = normalizeEntityName(match?.entityName);
    if (!ENTITY_LINKED_DOCUMENT_TYPES.has(documentType)) return false;
    if (documentType === "education") return Boolean(entityName && schoolNames.has(entityName));
    return Boolean(entityName && companyNames.has(entityName));
  });
}

function extractEntities(candidate, structured = {}, knowledgeDocuments = []) {
  const lines = String(candidate?.text || "").split("\n").map(clean).filter(Boolean);
  const entities = [];
  const seen = new Set();
  const knownEntities = new Map();
  for (const document of knowledgeDocuments || []) {
    const name = clean(document.entityName);
    const key = name.toLocaleLowerCase();
    if (!name || knownEntities.has(key)) continue;
    knownEntities.set(key, {
      name,
      type: knowledgeEntityType(document),
    });
  }

  for (const item of structured?.workHistory || []) {
    if (item?.company) {
      addEntity(entities, seen, {
        type: "company",
        name: item.company,
        evidence: item.title ? `${item.company} · ${item.title}` : item.company,
        confidence: 0.92,
        source: "resume",
      });
    }
    if (item?.team) {
      addEntity(entities, seen, {
        type: "team",
        name: item.team,
        evidence: item.company ? `${item.company} · ${item.team}` : item.team,
        confidence: 0.84,
        source: "resume",
      });
    }
  }

  lines.forEach((line, index) => {
    for (const knownEntity of knownEntities.values()) {
      if (line.includes(knownEntity.name)) {
        addEntity(entities, seen, {
          type: knownEntity.type,
          name: knownEntity.name,
          ...lineEvidence(lines, index),
          confidence: 0.95,
          source: "knowledge-match",
        });
      }
    }

    if (
      line.length <= 42
      && (
        /有限公司$|集团$|科技$|网络$|云服务$|研究院$|银行$|证券$/.test(line)
        || /^[\u3400-\u9fff]{2,}数据$/.test(line)
      )
      && !/[。；]/.test(line)
    ) {
      addEntity(entities, seen, {
        type: "company",
        name: line,
        ...lineEvidence(lines, index),
        confidence: 0.82,
        source: "resume",
      });
    }

    if (/大学|学院|学校|University|College/i.test(line) && line.length <= 100) {
      const school = line.match(/[\u3400-\u9fffA-Za-z·]{2,40}(?:大学|学院|学校|University|College)/i)?.[0] || line;
      addEntity(entities, seen, {
        type: "school",
        name: school,
        ...lineEvidence(lines, index),
        confidence: 0.8,
        source: "resume",
      });
    }

    if (/团队|事业部|部门|实验室|研发中心/.test(line) && line.length <= 130) {
      const team = line.match(/[\u3400-\u9fffA-Za-z0-9·]{2,30}(?:团队|事业部|部门|实验室|研发中心)/)?.[0] || line;
      addEntity(entities, seen, {
        type: "team",
        name: team.replace(/^(?:负责|主导|参与|加入)/, ""),
        ...lineEvidence(lines, index),
        confidence: 0.72,
        source: "resume",
      });
    }

    if (/论文|Paper|arXiv|DOI|期刊|会议/i.test(line) && line.length <= 220) {
      const name = line.match(/《([^》]{2,100})》/)?.[1]
        || line.match(/(?:论文|Paper)[:：\s]*([^\n。]{3,100})/i)?.[1]
        || line;
      addEntity(entities, seen, {
        type: "paper",
        name,
        ...lineEvidence(lines, index),
        confidence: 0.76,
        source: "resume",
      });
    }

    if (/专利|Patent|公开号|申请号|授权号|CN\d{6,}/i.test(line) && line.length <= 220) {
      const publication = line.match(/(?:CN|DEMO-)[A-Za-z0-9-]{5,}/i)?.[0];
      const name = line.match(/《([^》]{2,100})》/)?.[1]
        || line.match(/(?:专利|Patent)[:：\s]*([^\n。]{3,100})/i)?.[1]
        || line;
      addEntity(entities, seen, {
        type: "patent",
        name: publication || name,
        publication,
        ...lineEvidence(lines, index),
        confidence: publication ? 0.88 : 0.68,
        source: "resume",
      });
    }
  });

  const counts = entities.reduce((result, entity) => {
    result[entity.type] = (result[entity.type] || 0) + 1;
    return result;
  }, {});
  return { entities: entities.slice(0, 40), counts };
}

function buildEntityQuery(entities, criteria = []) {
  return [
    ...(entities || []).map((entity) => entity.name),
    ...(criteria || []).map((criterion) => criterion.name),
  ].filter(Boolean).join(" ");
}

module.exports = {
  buildEntityQuery,
  extractEntities,
  filterKnowledgeMatchesForCandidate,
  knowledgeEntityType,
  normalizeEntityName,
};
