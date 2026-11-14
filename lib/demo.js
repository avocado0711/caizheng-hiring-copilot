"use strict";

const DEMO_JOB = Object.freeze({
  title: "企业 AI 应用工程师",
  description: [
    "负责企业知识库、RAG 检索链路与 Agent 工作流建设。",
    "要求具备 Python / FastAPI 后端开发经验，理解向量召回、重排序和引用追溯。",
    "关注生产上线、性能稳定性、权限审计和人工决策留痕。",
  ].join("\n"),
});

const DEMO_CRITERIA = Object.freeze([
  {
    id: "rag",
    name: "RAG 与检索系统",
    description: "是否有检索、向量召回、重排序或引用追溯的直接证据。",
    keywords: ["RAG", "检索", "向量", "重排序", "引用"],
    weight: 30,
    required: true,
  },
  {
    id: "python",
    name: "Python 后端开发",
    description: "是否有 Python、FastAPI 或后端 API 的生产实践。",
    keywords: ["Python", "FastAPI", "API", "后端"],
    weight: 25,
    required: true,
  },
  {
    id: "agent",
    name: "Agent 工作流",
    description: "是否参与工具调用、工作流、权限或审计能力建设。",
    keywords: ["Agent", "工作流", "工具调用", "审计", "权限"],
    weight: 25,
    required: false,
  },
  {
    id: "delivery",
    name: "生产交付与结果",
    description: "是否有上线、性能、稳定性或业务指标证据。",
    keywords: ["上线", "性能", "稳定性", "指标", "延迟"],
    weight: 20,
    required: false,
  },
]);

const DEMO_JOB_CARDS = Object.freeze([
  {
    title: DEMO_JOB.title,
    description: DEMO_JOB.description,
    criteria: DEMO_CRITERIA,
  },
  {
    title: "Java 后端工程师",
    description: [
      "负责交易与业务中台的后端服务设计和核心模块开发。",
      "要求熟悉 Java、Spring Boot、数据库与缓存，能够处理高并发和稳定性问题。",
      "有微服务治理、监控告警、生产发布和跨团队交付经验优先。",
    ].join("\n"),
    criteria: [
      {
        id: "java-api",
        name: "Java API 与微服务",
        description: "是否具备 Java、Spring Boot、接口设计或微服务的直接开发证据。",
        keywords: ["Java", "Spring Boot", "RESTful API", "微服务", "接口"],
        weight: 30,
        required: true,
      },
      {
        id: "database",
        name: "数据库与缓存",
        description: "是否能证明 SQL、关系型数据库或缓存的实践能力。",
        keywords: ["SQL", "MySQL", "PostgreSQL", "Redis", "索引"],
        weight: 20,
        required: true,
      },
      {
        id: "stability",
        name: "高并发与稳定性",
        description: "是否处理过高并发、性能优化、监控或故障问题。",
        keywords: ["高并发", "性能", "稳定性", "监控", "故障"],
        weight: 25,
        required: false,
      },
      {
        id: "delivery",
        name: "生产交付",
        description: "是否有上线、发布、回滚或业务结果证据。",
        keywords: ["上线", "发布", "回滚", "交付", "指标"],
        weight: 15,
        required: false,
      },
      {
        id: "engineering",
        name: "工程化能力",
        description: "是否使用容器、持续集成或自动化手段交付服务。",
        keywords: ["Docker", "Kubernetes", "持续集成", "持续交付", "自动化"],
        weight: 10,
        required: false,
      },
    ],
  },
  {
    title: "数据平台工程师",
    description: [
      "建设企业级数据采集、加工、建模和服务平台。",
      "要求掌握 SQL、数据仓库与批流处理，能够保障数据质量和任务稳定性。",
      "关注成本、时效、血缘、监控和平台化交付。",
    ].join("\n"),
    criteria: [
      {
        id: "pipeline",
        name: "数据管道与仓库",
        description: "是否有数据管道、数据仓库或批流处理平台的直接经验。",
        keywords: ["ETL", "数据管道", "数据仓库", "批处理", "流处理"],
        weight: 30,
        required: true,
      },
      {
        id: "modeling",
        name: "SQL 与数据建模",
        description: "是否能证明 SQL、数据建模或治理能力。",
        keywords: ["SQL", "数据建模", "维度模型", "数据治理", "数据质量"],
        weight: 25,
        required: true,
      },
      {
        id: "compute",
        name: "大数据计算",
        description: "是否使用 Spark、Flink 或 Python 完成数据处理任务。",
        keywords: ["Spark", "Flink", "Python", "Java", "计算引擎"],
        weight: 20,
        required: false,
      },
      {
        id: "quality",
        name: "数据质量与可观测性",
        description: "是否有质量校验、血缘、监控或告警实践。",
        keywords: ["数据质量", "血缘", "监控", "告警", "校验"],
        weight: 15,
        required: false,
      },
      {
        id: "platform-delivery",
        name: "平台交付与 SLA",
        description: "是否有平台上线、SLA、成本或时效优化证据。",
        keywords: ["上线", "SLA", "成本", "时效", "指标"],
        weight: 10,
        required: false,
      },
    ],
  },
  {
    title: "Agent 工作流工程师",
    description: [
      "负责企业 Agent 工作流、工具调用协议和运行治理能力建设。",
      "要求理解 RAG、Function Calling、权限边界和失败回放。",
      "候选人需要能够设计评测集并推动 Agent 从原型进入生产。",
    ].join("\n"),
    criteria: [
      {
        id: "agent-orchestration",
        name: "Agent 编排与工具调用",
        description: "是否有 Agent、工作流编排或工具调用的直接开发证据。",
        keywords: ["Agent", "工作流", "工具调用", "Function Calling", "编排"],
        weight: 35,
        required: true,
      },
      {
        id: "rag",
        name: "RAG 与检索",
        description: "是否理解检索、向量召回、重排序和引用约束。",
        keywords: ["RAG", "检索", "向量", "重排序", "引用"],
        weight: 25,
        required: true,
      },
      {
        id: "backend",
        name: "后端服务能力",
        description: "是否具备 Python、FastAPI 或 API 服务的工程实践。",
        keywords: ["Python", "FastAPI", "API", "服务", "后端"],
        weight: 20,
        required: false,
      },
      {
        id: "governance",
        name: "权限、审计与评测",
        description: "是否有权限、审计、沙箱、评测或失败回放实践。",
        keywords: ["权限", "审计", "沙箱", "评测", "回放"],
        weight: 20,
        required: false,
      },
    ],
  },
  {
    title: "AI 产品经理",
    description: [
      "负责企业 AI 产品的需求分析、产品规划和交付落地。",
      "要求理解 LLM、RAG 与 Agent 的能力边界，并能定义质量指标。",
      "需要推动算法、工程、设计和业务团队完成产品闭环。",
    ].join("\n"),
    criteria: [
      {
        id: "product-definition",
        name: "产品定义与用户研究",
        description: "是否有需求分析、产品设计、规划或用户研究的直接证据。",
        keywords: ["需求分析", "产品设计", "产品规划", "用户研究", "用户访谈"],
        weight: 30,
        required: true,
      },
      {
        id: "ai-product",
        name: "AI 产品理解",
        description: "是否理解大模型、RAG、Agent 或 Prompt Engineering 的产品应用。",
        keywords: ["大模型", "LLM", "RAG", "Agent", "Prompt Engineering"],
        weight: 30,
        required: true,
      },
      {
        id: "product-metrics",
        name: "指标与实验",
        description: "是否定义过业务指标并开展实验、分析或效果评估。",
        keywords: ["指标", "转化率", "留存", "A/B", "实验"],
        weight: 25,
        required: false,
      },
      {
        id: "product-delivery",
        name: "跨团队交付",
        description: "是否有推动产品上线、跨团队协作或业务结果的证据。",
        keywords: ["上线", "交付", "跨团队", "协作", "业务结果"],
        weight: 15,
        required: false,
      },
    ],
  },
  {
    title: "MLOps / AI 平台工程师",
    description: [
      "负责模型服务、推理平台、训练与发布流水线建设。",
      "要求掌握容器、集群、监控和模型版本管理，保障服务稳定性。",
      "关注 GPU 资源、权限隔离、成本和生产环境可观测性。",
    ].join("\n"),
    criteria: [
      {
        id: "model-serving",
        name: "模型服务与推理",
        description: "是否有模型服务、推理优化、部署或 MLOps 的直接经验。",
        keywords: ["模型服务", "推理", "MLOps", "部署", "GPU"],
        weight: 30,
        required: true,
      },
      {
        id: "platform-infra",
        name: "容器与集群",
        description: "是否使用 Docker、Kubernetes、Linux 或云平台交付服务。",
        keywords: ["Docker", "Kubernetes", "Linux", "集群", "云平台"],
        weight: 25,
        required: true,
      },
      {
        id: "observability",
        name: "可观测性",
        description: "是否有监控、日志、告警、链路追踪或延迟优化实践。",
        keywords: ["监控", "日志", "告警", "链路追踪", "延迟"],
        weight: 20,
        required: false,
      },
      {
        id: "ml-pipeline",
        name: "模型流水线",
        description: "是否有持续集成、持续交付、流水线或模型版本管理经验。",
        keywords: ["持续集成", "持续交付", "流水线", "模型版本", "自动化"],
        weight: 15,
        required: false,
      },
      {
        id: "platform-security",
        name: "权限与安全",
        description: "是否有权限控制、审计、资源隔离或安全治理证据。",
        keywords: ["权限", "审计", "隔离", "安全", "成本"],
        weight: 10,
        required: false,
      },
    ],
  },
]);

const DEMO_RESUMES = Object.freeze([
  {
    fileName: "01-林知远-AI应用工程师.txt",
    text: [
      "林知远",
      "lin.zhiyuan@example.com",
      "7 年工作经验",
      "本科",
      "负责企业 RAG 知识库、混合检索和向量召回平台。",
      "使用 Python、FastAPI 开发检索 API，完成重排序和引用追溯。",
      "建设 Agent 工具调用、权限审计和失败回放能力。",
      "服务上线后 P95 延迟降低 38%，建立稳定性与效果评测指标。",
    ].join("\n"),
  },
  {
    fileName: "02-苏雨澄-后端工程师.txt",
    text: [
      "苏雨澄",
      "su.yucheng@example.com",
      "6 年工作经验",
      "本科",
      "使用 Python 和 FastAPI 开发高并发后端 API。",
      "负责稳定性治理、缓存与监控，完成核心服务上线。",
      "性能优化后吞吐量提升 45%。",
      "目前没有企业知识库或 RAG 检索系统的直接项目经历。",
    ].join("\n"),
  },
  {
    fileName: "03-陈嘉树-数据产品经理.txt",
    text: [
      "陈嘉树",
      "chen.jiashu@example.com",
      "5 年工作经验",
      "硕士",
      "负责数据产品需求分析、用户研究和项目推进。",
      "设计数据指标和运营活动，推动跨团队交付。",
      "参与数据平台上线并完成用户反馈闭环。",
    ].join("\n"),
  },
  {
    fileName: "04-林知远-重复简历.txt",
    text: [
      "林知远",
      "lin.zhiyuan@example.com",
      "7 年工作经验",
      "本科",
      "负责企业 RAG 知识库、混合检索和向量召回平台。",
      "使用 Python、FastAPI 开发检索 API，完成重排序和引用追溯。",
      "建设 Agent 工具调用、权限审计和失败回放能力。",
      "重复投递版本：服务上线后 P95 延迟降低 38%。",
    ].join("\n"),
  },
]);

const DEMO_DECISIONS = Object.freeze([
  {
    fileName: "01-林知远-AI应用工程师.txt",
    reviewStatus: "shortlist",
    reviewNote: "RAG、Python 后端、Agent 和生产结果均有直接证据，进入技术面。",
    overrides: {},
  },
  {
    fileName: "02-苏雨澄-后端工程师.txt",
    reviewStatus: "discuss",
    reviewNote: "后端能力较强，但 RAG 硬性条件缺少直接项目证据，建议面试确认。",
    overrides: {},
  },
  {
    fileName: "03-陈嘉树-数据产品经理.txt",
    reviewStatus: "reject",
    reviewNote: "当前岗位与数据产品经历不匹配，建议进入其他岗位人才库。",
    overrides: {},
  },
  {
    fileName: "04-林知远-重复简历.txt",
    reviewStatus: "unreviewed",
    reviewNote: "与第一份简历邮箱和正文高度重复，保留用于重复检测演示。",
    overrides: {},
  },
]);

function toDemoFilePayload(item) {
  return {
    name: item.fileName,
    type: "text/plain",
    data: Buffer.from(item.text, "utf8").toString("base64"),
  };
}

module.exports = {
  DEMO_CRITERIA,
  DEMO_DECISIONS,
  DEMO_JOB,
  DEMO_JOB_CARDS,
  DEMO_RESUMES,
  toDemoFilePayload,
};
