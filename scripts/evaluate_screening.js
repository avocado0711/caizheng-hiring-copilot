"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  evaluateCandidate,
  rankCandidates,
} = require("../lib/screening");

const CRITERIA = [
  {
    id: "rag",
    name: "RAG 与检索系统",
    keywords: ["RAG", "检索", "向量", "重排序"],
    weight: 40,
    required: true,
  },
  {
    id: "python",
    name: "Python 后端",
    keywords: ["Python", "FastAPI", "API"],
    weight: 35,
    required: true,
  },
  {
    id: "delivery",
    name: "生产交付与结果",
    keywords: ["上线", "性能", "指标", "稳定性"],
    weight: 25,
    required: false,
  },
];

const SCENARIOS = [
  {
    id: "ai-platform",
    name: "企业 AI 应用工程师",
    candidates: [
      {
        id: "strong",
        expectedRank: 1,
        expectedGate: true,
        text: "负责 RAG 检索平台与向量召回\n使用 Python FastAPI 开发检索 API\n上线后优化性能，P95 指标降低 35%",
      },
      {
        id: "medium",
        expectedRank: 2,
        expectedGate: true,
        text: "使用 Python FastAPI 开发后端 API\n参与知识库检索项目并完成上线",
      },
      {
        id: "low",
        expectedRank: 3,
        expectedGate: true,
        text: "参与向量数据管道建设\n使用 API 完成服务端接口开发",
      },
      {
        id: "weak",
        expectedRank: 4,
        expectedGate: false,
        text: "使用 Java 开发交易服务\n参与系统上线和稳定性治理",
      },
    ],
  },
  {
    id: "data-platform",
    name: "数据平台工程师",
    candidates: [
      {
        id: "strong",
        expectedRank: 1,
        expectedGate: true,
        text: "负责 Python 数据平台和 API 开发\n建设检索服务与向量数据管道\n上线后优化性能，核心指标提升 40%",
      },
      {
        id: "medium",
        expectedRank: 2,
        expectedGate: true,
        text: "使用 Python 完成数据清洗和 API 开发\n参与检索数据服务上线",
      },
      {
        id: "low",
        expectedRank: 3,
        expectedGate: true,
        text: "使用 Python 维护数据服务\n参与向量索引和检索任务",
      },
      {
        id: "weak",
        expectedRank: 4,
        expectedGate: false,
        text: "负责市场活动和用户增长运营\n完成活动复盘和指标分析",
      },
    ],
  },
  {
    id: "agent-engineering",
    name: "Agent 工作流工程师",
    candidates: [
      {
        id: "strong",
        expectedRank: 1,
        expectedGate: true,
        text: "负责 RAG Agent 工作流和检索工具调用\n使用 Python FastAPI 开发 API\n上线后建立审计和稳定性指标",
      },
      {
        id: "medium",
        expectedRank: 2,
        expectedGate: true,
        text: "使用 Python 开发 API 与向量检索任务\n参与 Agent 工具调用和上线测试",
      },
      {
        id: "low",
        expectedRank: 3,
        expectedGate: true,
        text: "维护 RAG Agent 配置\n使用 FastAPI 提供内部接口",
      },
      {
        id: "weak",
        expectedRank: 4,
        expectedGate: false,
        text: "负责视觉设计项目并完成用户访谈\n输出产品原型和运营活动方案",
      },
    ],
  },
  {
    id: "rag-backend",
    name: "RAG 后端工程师",
    candidates: [
      {
        id: "strong",
        expectedRank: 1,
        expectedGate: true,
        text: "负责 RAG 检索与向量重排序服务\n使用 Python FastAPI 开发检索 API\n上线后优化性能并监控核心指标",
      },
      {
        id: "medium",
        expectedRank: 2,
        expectedGate: true,
        text: "建设向量召回与重排序模块\n使用 FastAPI 开发后端 API\n完成上线后的性能优化",
      },
      {
        id: "low",
        expectedRank: 3,
        expectedGate: true,
        text: "参与 RAG 功能开发\n使用 Python 完成接口联调",
      },
      {
        id: "weak",
        expectedRank: 4,
        expectedGate: false,
        text: "负责电商活动运营\n完成用户增长和转化分析",
      },
    ],
  },
  {
    id: "ai-fullstack",
    name: "AI 全栈工程师",
    candidates: [
      {
        id: "strong",
        expectedRank: 1,
        expectedGate: true,
        text: "负责 RAG 检索平台与向量召回\n使用 Python FastAPI 开发服务端 API\n上线后优化性能和稳定性指标",
      },
      {
        id: "medium",
        expectedRank: 2,
        expectedGate: true,
        text: "开发检索管理后台与向量检索接口\n使用 Python 和 API 完成服务端联调\n参与产品上线",
      },
      {
        id: "low",
        expectedRank: 3,
        expectedGate: true,
        text: "使用 Python 编写检索脚本\n参与 API 接口测试",
      },
      {
        id: "weak",
        expectedRank: 4,
        expectedGate: false,
        text: "负责品牌视觉设计和活动策划\n输出传播素材与项目复盘",
      },
    ],
  },
  {
    id: "document-intelligence",
    name: "文档智能工程师",
    candidates: [
      {
        id: "strong",
        expectedRank: 1,
        expectedGate: true,
        text: "负责 RAG 检索和向量索引构建\n使用 Python FastAPI 开发文档解析 API\n上线后优化性能与稳定性指标",
      },
      {
        id: "medium",
        expectedRank: 2,
        expectedGate: true,
        text: "完成扫描文档解析与向量入库\n使用 Python 开发 API 服务\n参与文档平台上线",
      },
      {
        id: "low",
        expectedRank: 3,
        expectedGate: true,
        text: "使用 Python 清洗文档数据\n维护检索关键词库",
      },
      {
        id: "weak",
        expectedRank: 4,
        expectedGate: false,
        text: "负责行政采购和供应商管理\n完成成本分析与合同归档",
      },
    ],
  },
  {
    id: "llmops-platform",
    name: "LLMOps / AI 平台工程师",
    candidates: [
      {
        id: "strong",
        expectedRank: 1,
        expectedGate: true,
        text: "负责 RAG 检索平台与向量服务运维\n使用 Python FastAPI 管理模型 API\n上线后优化性能和稳定性指标",
      },
      {
        id: "medium",
        expectedRank: 2,
        expectedGate: true,
        text: "维护向量检索任务和模型 API\n使用 Python 完成平台服务开发\n参与生产上线",
      },
      {
        id: "low",
        expectedRank: 3,
        expectedGate: true,
        text: "协助维护 RAG 知识库\n使用 API 查询模型状态",
      },
      {
        id: "weak",
        expectedRank: 4,
        expectedGate: false,
        text: "负责销售培训与渠道运营\n完成课程安排和业绩统计",
      },
    ],
  },
  {
    id: "ai-product-delivery",
    name: "AI 产品交付工程师",
    candidates: [
      {
        id: "strong-rag",
        expectedRank: 1,
        expectedGate: true,
        text: "负责 RAG 检索与向量召回方案\n使用 FastAPI 完成接口联调\n参与产品上线和质量评估",
      },
      {
        id: "strong-backend",
        expectedRank: 2,
        expectedGate: true,
        text: "使用 Python FastAPI 开发 AI 产品后端 API\n上线后优化性能、稳定性与核心指标\n参与 RAG 业务需求评估",
      },
      {
        id: "concept-only",
        expectedRank: 3,
        expectedGate: false,
        text: "了解 RAG 检索概念\n使用 Python 编写演示脚本\n尚未进入生产交付",
      },
      {
        id: "semantic-only",
        expectedRank: 4,
        expectedGate: true,
        text: "参与语义检索与知识库产品设计\n使用 Flask 完成内部工具开发\n推动业务团队完成上线验收",
      },
    ],
  },
];

const PROTECTED_LINES = [
  "年龄：36 岁",
  "性别：男",
  "婚育：已婚",
  "籍贯：某地",
  "民族：某民族",
];

function pairwiseAccuracy(expectedRanks, actualRanks) {
  let correct = 0;
  let total = 0;
  for (let left = 0; left < expectedRanks.length; left += 1) {
    for (let right = left + 1; right < expectedRanks.length; right += 1) {
      total += 1;
      if (Math.sign(expectedRanks[left] - expectedRanks[right])
        === Math.sign(actualRanks[left] - actualRanks[right])) {
        correct += 1;
      }
    }
  }
  return total ? correct / total : 1;
}

function runEvaluation() {
  let gateCorrect = 0;
  let gateTotal = 0;
  let top1Correct = 0;
  let evidenceTotal = 0;
  let locatableEvidence = 0;
  let sensitivityTotal = 0;
  let invariantSensitiveCases = 0;
  const pairwise = [];
  const scenarioResults = [];

  for (const scenario of SCENARIOS) {
    const ranked = rankCandidates(
      scenario.candidates.map((candidate) => ({
        ...candidate,
        fileName: `${candidate.id}.txt`,
        importedAt: `2026-01-01T00:00:0${candidate.expectedRank}Z`,
      })),
      CRITERIA,
    );
    const byId = new Map(ranked.map((candidate) => [candidate.id, candidate]));
    const expectedRanks = scenario.candidates.map((candidate) => candidate.expectedRank);
    const actualRanks = scenario.candidates.map((candidate) => byId.get(candidate.id).rank);
    pairwise.push(pairwiseAccuracy(expectedRanks, actualRanks));
    const topExpected = scenario.candidates.find((candidate) => candidate.expectedRank === 1)?.id;
    if (ranked[0]?.id === topExpected) top1Correct += 1;

    for (const candidate of scenario.candidates) {
      const actual = byId.get(candidate.id);
      gateTotal += 1;
      if (actual.evaluation.gateMet === candidate.expectedGate) gateCorrect += 1;
      for (const result of actual.evaluation.criteriaResults) {
        for (const evidence of result.evidence) {
          evidenceTotal += 1;
          if (candidate.text.includes(evidence.quote.replace(/\.\.\.$/, ""))) {
            locatableEvidence += 1;
          }
        }
      }
      const base = evaluateCandidate(candidate, CRITERIA);
      const varied = evaluateCandidate({
        ...candidate,
        text: `${PROTECTED_LINES.join("\n")}\n${candidate.text}`,
      }, CRITERIA);
      sensitivityTotal += 1;
      if (
        base.score === varied.score
        && base.gateMet === varied.gateMet
        && base.criteriaResults.every(
          (result, index) => result.level === varied.criteriaResults[index].level,
        )
      ) invariantSensitiveCases += 1;
    }

    scenarioResults.push({
      id: scenario.id,
      name: scenario.name,
      expectedOrder: expectedRanks,
      actualOrder: actualRanks,
      top1: ranked[0]?.id === topExpected,
      gates: scenario.candidates.map((candidate) => ({
        id: candidate.id,
        expected: candidate.expectedGate,
        actual: byId.get(candidate.id).evaluation.gateMet,
      })),
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    dataset: "内置虚构职位与简历场景 v2，仅用于工程回归，不代表真实招聘效果",
    datasetVersion: "2026-11-synthetic-v2",
    generatedBy: "scripts/evaluate_screening.js",
    criteria: CRITERIA,
    scenarioCount: SCENARIOS.length,
    candidateCount: SCENARIOS.reduce((sum, scenario) => sum + scenario.candidates.length, 0),
    counts: {
      top1Correct,
      top1Total: SCENARIOS.length,
      gateCorrect,
      gateTotal,
      locatableEvidence,
      evidenceTotal,
      protectedAttributeInvariantCases: invariantSensitiveCases,
      protectedAttributeTotal: sensitivityTotal,
    },
    metrics: {
      top1Accuracy: top1Correct / SCENARIOS.length,
      pairwiseRankingAccuracy: pairwise.reduce((sum, value) => sum + value, 0) / pairwise.length,
      gateAccuracy: gateCorrect / gateTotal,
      locatableEvidenceRate: evidenceTotal ? locatableEvidence / evidenceTotal : 1,
      protectedAttributeInvarianceRate: sensitivityTotal
        ? invariantSensitiveCases / sensitivityTotal
        : 1,
    },
    scenarios: scenarioResults,
  };
}

if (require.main === module) {
  const outputIndex = process.argv.indexOf("--output");
  const outputPath = outputIndex >= 0
    ? path.resolve(process.argv[outputIndex + 1])
    : path.resolve(__dirname, "../evaluation/screening-results.json");
  const report = runEvaluation();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report.metrics, null, 2));
  console.log(`报告已写入：${outputPath}`);
}

module.exports = { CRITERIA, SCENARIOS, runEvaluation };
