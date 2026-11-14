"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { RESUME_NAMES, candidateEmail } = require("./names");

const OUTPUT_DIR = path.join(__dirname, "html");

const candidates = [
  {
    slug: "ai-app-01",
    name: RESUME_NAMES[0],
    role: "AI 应用工程师",
    city: "上海",
    phone: "138-0000-0001",
    email: candidateEmail(1),
    summary:
      "4 年半 Python 与 AI 应用开发经验，长期负责企业知识库、RAG 检索链路和 Agent 工作流落地，熟悉从需求拆解、原型验证到生产部署的完整流程。",
    skills: [
      ["编程", "Python、FastAPI、SQL、TypeScript"],
      ["AI 应用", "RAG、Agent、LangChain、LlamaIndex、Prompt Engineering"],
      ["数据与中间件", "PostgreSQL、Redis、Elasticsearch、Milvus"],
      ["工程化", "Docker、Kubernetes、GitLab CI、OpenTelemetry"],
    ],
    education: [
      ["浙江大学", "计算机科学与技术 · 本科", "2017.09—2021.06", "核心课程：数据结构、操作系统、机器学习、数据库系统"],
    ],
    experiences: [
      {
        company: "星桥智能科技",
        title: "AI 应用工程师",
        period: "2023.04—至今",
        location: "上海",
        bullets: [
          "负责企业知识库问答平台的检索链路，基于 Elasticsearch 与 Milvus 设计混合召回和重排方案，支撑 20 万级文档检索。",
          "将需求分析、Agent 编排、工具调用和效果评测拆成可观测流水线，线上问题平均定位时间从半天缩短到 1 小时以内。",
          "与产品、算法和交付团队协作，推动 6 个企业客户完成从 PoC 到生产上线。",
        ],
      },
      {
        company: "云岚数据",
        title: "Python 后端开发工程师",
        period: "2021.07—2023.03",
        location: "杭州",
        bullets: [
          "开发内部检索服务与数据清洗任务，使用 FastAPI 提供统一查询接口。",
          "参与日志检索系统的查询性能优化，通过缓存和索引调整降低 P95 延迟约 35%。",
        ],
      },
    ],
    projects: [
      {
        name: "企业知识库 Agent",
        role: "核心开发 / 项目负责人",
        period: "2024.03—2025.02",
        tech: "Python、LangChain、Milvus、Elasticsearch、FastAPI",
        bullets: [
          "从 0 到 1 搭建检索增强生成与工具调用框架，支持制度问答、工单查询和文档摘要。",
          "设计离线评测集和线上反馈机制，回答可追溯率提升至 92%，人工复核量下降约 30%。",
        ],
      },
      {
        name: "私有文档搜索引擎",
        role: "后端负责人",
        period: "2022.05—2022.12",
        tech: "Python、Elasticsearch、Redis",
        bullets: ["完成权限过滤、增量索引和搜索结果重排，日查询量约 15 万次。"],
      },
    ],
    extras: ["开源项目 RAG-Workbench 维护者；内部技术分享讲师；英语 CET-6"],
  },
  {
    slug: "nlp-02",
    name: RESUME_NAMES[1],
    role: "NLP 算法工程师 / LLM 应用",
    city: "北京",
    phone: "138-0000-0002",
    email: candidateEmail(2),
    summary:
      "硕士毕业后从事 NLP 与 LLM 算法研发，具备数据构建、模型微调、评测分析和推理优化经验，正在转向面向业务的 AI 应用工程。",
    skills: [
      ["语言与框架", "Python、PyTorch、Transformers、PEFT、vLLM"],
      ["算法方向", "文本分类、信息抽取、指令微调、RAG、模型评测"],
      ["工程工具", "Linux、Docker、Git、Weights & Biases"],
    ],
    education: [
      ["清华大学", "电子信息 · 硕士", "2021.09—2024.06", "研究方向：低资源文本信息抽取"],
      ["武汉大学", "软件工程 · 本科", "2017.09—2021.06", "GPA 3.7/4.0"],
    ],
    experiences: [
      {
        company: "澜图科技有限公司",
        title: "NLP 算法工程师",
        period: "2024.07—至今",
        location: "北京",
        bullets: [
          "负责合同信息抽取模型的训练与评测，构建 1.2 万条标注样本和自动化回归集。",
          "完成 7B 开源模型的 LoRA 微调与 vLLM 部署，关键字段抽取 F1 提升 9.6 个百分点。",
          "参与检索增强问答项目，负责切片策略、召回评测和答案忠实度分析。",
        ],
      },
    ],
    projects: [
      {
        name: "合同要素抽取助手",
        role: "算法负责人",
        period: "2025.01—2025.09",
        tech: "PyTorch、Transformers、PEFT、FastAPI",
        bullets: [
          "设计规则与大模型协同的抽取流程，支持 18 类合同要素并保留原文定位。",
          "建立 bad case 聚类和版本对比机制，将新增领域适配周期从两周缩短到四天。",
        ],
      },
      {
        name: "RAG 问答评测集",
        role: "主要贡献者",
        period: "2024.10—2025.01",
        tech: "Python、BM25、Embedding、RAGAS",
        bullets: ["构建 600 条带证据标注的问答评测集，覆盖召回、重排和生成三个阶段。"],
      },
    ],
    extras: ["发表 ACL Findings 论文 1 篇（第二作者）；熟练掌握英文技术文档阅读"],
  },
  {
    slug: "backend-03",
    name: RESUME_NAMES[2],
    role: "高级后端工程师",
    city: "上海",
    phone: "138-0000-0003",
    email: candidateEmail(3),
    summary:
      "7 年互联网后端研发经验，主要技术方向为 Java、Go 与高并发交易系统，近两年参与 AI 应用平台的工程化建设。",
    skills: [
      ["编程", "Java、Go、SQL、Python（项目使用）"],
      ["后端", "Spring Boot、微服务、Kafka、MySQL、Redis、Elasticsearch"],
      ["架构", "高并发、分布式事务、服务治理、可观测性"],
    ],
    education: [
      ["南京大学", "软件工程 · 本科", "2015.09—2019.06", "主修软件工程、数据库、分布式系统"],
    ],
    experiences: [
      {
        company: "北辰云服务",
        title: "高级后端工程师",
        period: "2022.08—至今",
        location: "上海",
        bullets: [
          "负责智能客服平台后端架构，设计会话、知识库、权限和异步任务服务。",
          "参与 RAG 服务的检索网关和缓存层开发，使用 Python 编写离线评测工具。",
          "推动订单系统服务拆分，高峰吞吐提升约 2.3 倍。",
        ],
      },
      {
        company: "衡远网络",
        title: "Java 开发工程师",
        period: "2019.07—2022.07",
        location: "南京",
        bullets: ["负责交易与结算模块，维护日均百万级请求的核心链路。"],
      },
    ],
    projects: [
      {
        name: "智能客服知识库网关",
        role: "后端负责人",
        period: "2024.02—2025.06",
        tech: "Go、Python、Redis、Elasticsearch",
        bullets: [
          "负责检索接口、租户隔离和限流熔断，保障 300 多家企业客户稳定使用。",
          "与算法团队共同完成混合召回方案上线，线上平均响应时间低于 1.5 秒。",
        ],
      },
    ],
    extras: ["开源 Spring 网关插件作者；具备团队技术评审和新人培养经验"],
  },
  {
    slug: "product-04",
    name: RESUME_NAMES[3],
    role: "AI 产品经理",
    city: "杭州",
    phone: "138-0000-0004",
    email: candidateEmail(4),
    summary:
      "2 年 B 端产品经验，参与 AI 客服和知识库产品从需求分析到试点交付，能够独立完成用户研究、指标设计和跨团队推进。",
    skills: [
      ["产品", "需求分析、原型设计、用户研究、数据分析"],
      ["AI 基础", "RAG 产品形态、Prompt 设计、模型评测指标"],
      ["工具", "SQL、Axure、Figma、Postman"],
    ],
    education: [
      ["北京邮电大学", "信息管理与信息系统 · 本科", "2018.09—2022.06", "辅修数据科学基础课程"],
    ],
    experiences: [
      {
        company: "知序科技",
        title: "AI 产品经理",
        period: "2024.06—至今",
        location: "杭州",
        bullets: [
          "负责企业知识库助手的需求规划和版本节奏，覆盖文档接入、权限、问答和反馈闭环。",
          "联合算法团队制定问题集和验收标准，跟踪回答准确率、拒答率与人工转接率。",
          "推动 3 家试点客户完成内部灰度，形成标准化交付手册。",
        ],
      },
      {
        company: "衡星软件",
        title: "产品助理",
        period: "2022.07—2024.05",
        location: "南京",
        bullets: ["负责 CRM 产品需求梳理、原型制作和客户问题跟踪。"],
      },
    ],
    projects: [
      {
        name: "企业知识库助手",
        role: "产品负责人",
        period: "2024.09—2025.07",
        tech: "RAG 产品、SQL、埋点分析",
        bullets: [
          "设计引用来源、低置信度提示和人工反馈机制，试点用户周活跃率达到 61%。",
          "梳理 120 条高频问题作为首轮验收集，推动关键问题解决率达到 84%。",
        ],
      },
    ],
    extras: ["PMP 在学；有客户访谈和技术方案评审经验"],
  },
  {
    slug: "data-05",
    name: RESUME_NAMES[4],
    role: "数据工程师",
    city: "上海",
    phone: "138-0000-0005",
    email: candidateEmail(5),
    summary:
      "4 年数据工程经验，负责数据管道、指标体系与检索数据治理，熟悉 Python、Spark 和向量数据处理，参与过两个 RAG 项目的数据侧建设。",
    skills: [
      ["编程", "Python、SQL、Scala"],
      ["数据工程", "Spark、Flink、Airflow、dbt、Kafka"],
      ["AI 数据", "Embedding、文本清洗、知识切分、向量检索"],
      ["平台", "Hive、ClickHouse、Milvus、Docker"],
    ],
    education: [
      ["武汉大学", "数据科学与大数据技术 · 本科", "2017.09—2021.06", "主修数据挖掘、统计学习、数据库"],
    ],
    experiences: [
      {
        company: "远岚数据",
        title: "数据工程师",
        period: "2021.07—至今",
        location: "上海",
        bullets: [
          "建设指标平台和实时数据管道，日处理事件约 8,000 万条。",
          "负责知识库数据清洗、切片、元数据补全和质量监控，支持多租户检索场景。",
          "制定数据版本与回滚流程，降低模型评测结果不可复现的问题。",
        ],
      },
    ],
    projects: [
      {
        name: "企业文档数据治理平台",
        role: "数据负责人",
        period: "2024.03—2025.08",
        tech: "Python、Spark、Airflow、Milvus",
        bullets: [
          "建立 6 类文档质量规则和增量索引任务，将无效切片比例降低约 28%。",
          "为 RAG 团队提供按业务域、权限和时间分区的检索数据接口。",
        ],
      },
    ],
    extras: ["阿里云大数据认证；具备跨团队数据口径协调经验"],
  },
  {
    slug: "fullstack-06",
    name: RESUME_NAMES[5],
    role: "全栈工程师",
    city: "深圳",
    phone: "138-0000-0006",
    email: candidateEmail(6),
    summary:
      "6 年全栈开发经验，近两年独立完成多个 LLM 工具和 Agent 原型，能够快速从需求走到可演示产品。",
    skills: [
      ["前端", "React、Vue、TypeScript"],
      ["后端", "Python、Node.js、FastAPI、Express"],
      ["AI 应用", "Agent、Function Calling、RAG、OpenAI-compatible API"],
      ["其他", "Docker、PostgreSQL、Redis"],
    ],
    education: [
      ["深圳信息职业技术学院", "软件技术 · 专科", "2016.09—2019.06", "在校期间参与多项 Web 开发项目"],
    ],
    experiences: [
      {
        company: "启点数字工作室",
        title: "全栈工程师",
        period: "2021.02—至今",
        location: "深圳",
        bullets: [
          "独立负责内部工具和客户项目，覆盖需求、前后端开发、部署与运维。",
          "开发 Agent 工作流编排工具，支持工具注册、会话记忆和执行日志。",
          "为电商客户搭建商品内容生成与审核流程，人工改写量下降约 25%。",
        ],
      },
      {
        company: "微光技术",
        title: "Web 开发工程师",
        period: "2019.07—2021.01",
        location: "广州",
        bullets: ["参与管理后台和营销活动页开发，负责组件库维护。"],
      },
    ],
    projects: [
      {
        name: "多工具 Agent Studio",
        role: "独立开发",
        period: "2025.01—2025.10",
        tech: "React、FastAPI、PostgreSQL、Redis",
        bullets: [
          "实现工具调用、任务拆解、运行记录和人工接管，完成 4 个内部场景试点。",
          "项目从 0 到 1 上线，开源后获得 900+ Star。",
        ],
      },
    ],
    extras: ["作品集：portfolio.example.com；自驱学习能力较强"],
  },
  {
    slug: "ml-07",
    name: RESUME_NAMES[6],
    role: "机器学习工程师",
    city: "上海",
    phone: "138-0000-0007",
    email: candidateEmail(7),
    summary:
      "3 年半机器学习工程经验，专注搜索、推荐与生成式检索，具备从数据构建到线上服务的完整经验。",
    skills: [
      ["编程", "Python、SQL、PyTorch"],
      ["方向", "搜索排序、向量召回、RAG、模型评测"],
      ["工程", "FastAPI、Milvus、Kafka、Docker、Kubernetes"],
    ],
    education: [
      ["上海交通大学", "计算机技术 · 硕士", "2020.09—2023.03", "研究方向：稠密文本检索"],
      ["华东理工大学", "计算机科学与技术 · 本科", "2016.09—2020.06", "专业排名前 10%"],
    ],
    experiences: [
      {
        company: "拾光智能",
        title: "机器学习工程师",
        period: "2023.04—至今",
        location: "上海",
        bullets: [
          "负责多路召回与排序模型迭代，构建离线评测和线上 A/B 实验流程。",
          "将业务知识库接入 RAG 链路，优化切片和重排策略，Top-5 命中率提升 11%。",
          "参与模型服务部署和容量评估，支持日均 60 万次查询。",
        ],
      },
    ],
    projects: [
      {
        name: "客服知识检索系统",
        role: "核心算法开发",
        period: "2024.02—2025.03",
        tech: "PyTorch、Milvus、FastAPI",
        bullets: [
          "训练领域 Embedding 并设计关键词与向量混合召回，减少长尾问题漏召回。",
          "建立检索与生成分离的评测集，支持按业务线追踪版本效果。",
        ],
      },
    ],
    extras: ["发表中文信息处理会议论文 1 篇；熟悉英文论文复现"],
  },
  {
    slug: "architect-08",
    name: RESUME_NAMES[7],
    role: "后端架构师",
    city: "上海",
    phone: "138-0000-0008",
    email: candidateEmail(8),
    summary:
      "7 年平台研发和架构经验，负责过智能文档处理、搜索服务和 AI 工作流平台，重视可维护性、稳定性和交付效率。",
    skills: [
      ["编程", "Python、Go、Java、SQL"],
      ["平台", "FastAPI、Spring Boot、Kafka、Elasticsearch、Kubernetes"],
      ["AI 工程", "RAG、Agent 工作流、模型服务、评测体系"],
      ["管理", "技术方案评审、跨团队协作、研发流程建设"],
    ],
    education: [
      ["中南大学", "计算机科学与技术 · 本科", "2013.09—2017.06", "主修数据结构、操作系统、计算机网络"],
    ],
    experiences: [
      {
        company: "瀚川智能",
        title: "平台架构师",
        period: "2022.03—至今",
        location: "上海",
        bullets: [
          "负责智能内容平台的总体架构，覆盖文档解析、RAG、Agent 编排和人工审核。",
          "带领 5 人小组完成平台从 0 到 1 建设，半年内接入 12 条业务线。",
          "设计灰度发布、降级和审计机制，保障模型升级期间的业务连续性。",
        ],
      },
      {
        company: "一川软件",
        title: "高级后端工程师",
        period: "2017.07—2022.02",
        location: "长沙",
        bullets: ["负责企业搜索与流程平台，主导服务拆分和权限治理。"],
      },
    ],
    projects: [
      {
        name: "统一 AI 工作流平台",
        role: "架构负责人",
        period: "2023.05—2025.08",
        tech: "Python、Go、Kubernetes、Kafka、Redis",
        bullets: [
          "支持 Prompt、RAG、工具调用和人工节点的可视化编排，服务 8 个业务团队。",
          "建立模型调用配额、成本统计和敏感信息检查，月度推理成本下降约 22%。",
        ],
      },
    ],
    extras: ["内部架构委员会成员；有 5 人团队管理经验"],
  },
  {
    slug: "frontend-09",
    name: RESUME_NAMES[8],
    role: "前端工程师 / AI 产品体验",
    city: "上海",
    phone: "138-0000-0009",
    email: candidateEmail(9),
    summary:
      "2 年半前端开发经验，主要负责 AI 对话产品的交互与工程实现，参与流式输出、会话管理和可观测体验建设。",
    skills: [
      ["前端", "React、TypeScript、Next.js、Tailwind CSS"],
      ["AI 交互", "流式输出、Markdown 渲染、引用展示、Prompt 调试面板"],
      ["基础后端", "Node.js、Python（脚本与接口联调）"],
    ],
    education: [
      ["中国传媒大学", "数字媒体技术 · 本科", "2019.09—2023.06", "主修交互设计、Web 开发、数据可视化"],
    ],
    experiences: [
      {
        company: "界面智能",
        title: "前端工程师",
        period: "2024.03—至今",
        location: "上海",
        bullets: [
          "负责 AI 助手 Web 端开发，支持 Markdown、引用来源、工具调用状态和流式响应。",
          "建设前端埋点和性能监控，定位并优化长会话卡顿问题。",
          "与产品团队完成 Prompt 调试面板，缩短内部试用反馈迭代周期。",
        ],
      },
      {
        company: "青禾互动",
        title: "前端开发实习生",
        period: "2023.07—2024.02",
        location: "北京",
        bullets: ["参与数据看板和营销活动页开发。"],
      },
    ],
    projects: [
      {
        name: "Agent 对话工作台",
        role: "前端负责人",
        period: "2025.02—2025.09",
        tech: "React、SSE、Zustand",
        bullets: [
          "实现多会话、工具状态追踪和引用侧栏，支持 5 类 Agent 工具。",
          "通过组件拆分和渲染优化，长对话首屏可交互时间降低约 30%。",
        ],
      },
    ],
    extras: ["个人技术博客；重视交互细节与可访问性"],
  },
  {
    slug: "python-10",
    name: RESUME_NAMES[9],
    role: "Python 开发工程师",
    city: "苏州",
    phone: "138-0000-0010",
    email: candidateEmail(10),
    summary:
      "4 年 Python 和企业自动化经验，负责数据处理、RPA、内部工具和轻量 AI 功能集成，擅长快速定位业务重复流程。",
    skills: [
      ["编程", "Python、SQL、JavaScript"],
      ["工程", "FastAPI、Django、Celery、MySQL、Redis"],
      ["自动化", "Scrapy、Playwright、任务调度、文件处理"],
      ["AI", "LLM API、文本分类、基础 Prompt 设计"],
    ],
    education: [
      ["大连理工大学城市学院", "软件工程 · 本科", "2017.09—2021.06", "主修 Python、数据库和 Web 开发"],
    ],
    experiences: [
      {
        company: "恒简信息",
        title: "Python 开发工程师",
        period: "2021.07—至今",
        location: "苏州",
        bullets: [
          "开发企业数据采集、清理和报表自动化工具，累计服务 20 多个内部流程。",
          "使用 LLM API 完成工单分类和摘要，减少人工录入工作量。",
          "负责任务队列和失败重试机制，改善批处理稳定性。",
        ],
      },
    ],
    projects: [
      {
        name: "合同归档自动化",
        role: "核心开发",
        period: "2023.08—2024.02",
        tech: "Python、OCR、Celery、MySQL",
        bullets: [
          "实现合同上传、OCR、字段提取和归档校验流程，支持每日约 800 份文档。",
          "设计异常队列和人工复核页面，将归档失败率控制在 2% 以下。",
        ],
      },
    ],
    extras: ["有 Linux 运维和脚本编写经验；目前主要工作地点为苏州"],
  },
  {
    slug: "product-11",
    name: RESUME_NAMES[10],
    role: "企业软件产品经理",
    city: "广州",
    phone: "138-0000-0011",
    email: candidateEmail(11),
    summary:
      "5 年企业软件产品经验，负责招聘、协同和数据分析产品，具备较强的业务抽象和跨团队推进能力。",
    skills: [
      ["产品", "B 端产品设计、流程梳理、需求优先级、数据分析"],
      ["技术理解", "SQL、API、低代码平台、基础 AI 产品概念"],
      ["协作", "敏捷项目管理、客户访谈、方案汇报"],
    ],
    education: [
      ["中山大学", "信息管理与信息系统 · 本科", "2015.09—2019.06", "主修数据库、管理信息系统"],
    ],
    experiences: [
      {
        company: "知己协同",
        title: "高级产品经理",
        period: "2022.04—至今",
        location: "广州",
        bullets: [
          "负责企业协同平台工作流产品，覆盖表单、审批、消息和权限模块。",
          "参与 AI 摘要功能需求设计，推动摘要结果与原始文档引用关联。",
          "建立客户反馈分层机制，推动季度路线图与交付团队对齐。",
        ],
      },
      {
        company: "穗云软件",
        title: "产品经理",
        period: "2019.07—2022.03",
        location: "广州",
        bullets: ["负责招聘管理系统需求分析和客户实施。"],
      },
    ],
    projects: [
      {
        name: "招聘流程协同平台",
        role: "产品负责人",
        period: "2024.01—2025.05",
        tech: "B 端产品、SQL、数据分析",
        bullets: [
          "梳理简历分配、面试安排和反馈提醒流程，试点团队平均处理时长下降 18%。",
          "设计候选人状态看板和批量操作，减少招聘协调人员的重复录入。",
        ],
      },
    ],
    extras: ["具备招聘业务理解；非算法研发背景"],
  },
  {
    slug: "vision-12",
    name: RESUME_NAMES[11],
    role: "计算机视觉工程师",
    city: "北京",
    phone: "138-0000-0012",
    email: candidateEmail(12),
    summary:
      "3 年计算机视觉与模型部署经验，负责图像分类、目标检测和边缘设备推理优化，具备完整的数据和工程闭环能力。",
    skills: [
      ["编程", "Python、C++、SQL"],
      ["模型", "PyTorch、YOLO、ONNX、TensorRT"],
      ["工程", "Docker、FastAPI、Linux、CUDA"],
    ],
    education: [
      ["华中科技大学", "自动化 · 硕士", "2020.09—2023.06", "研究方向：工业视觉缺陷检测"],
      ["合肥工业大学", "自动化 · 本科", "2016.09—2020.06", "获校级一等奖学金"],
    ],
    experiences: [
      {
        company: "锐视科技",
        title: "计算机视觉工程师",
        period: "2023.07—至今",
        location: "北京",
        bullets: [
          "负责工业质检模型训练、评估和部署，支持 4 种产线设备。",
          "使用 ONNX 与 TensorRT 优化推理，单帧耗时从 46 ms 降至 27 ms。",
          "建设图片标注、版本管理和离线回归流程。",
        ],
      },
    ],
    projects: [
      {
        name: "边缘端缺陷检测系统",
        role: "算法与部署负责人",
        period: "2024.04—2025.06",
        tech: "PyTorch、TensorRT、C++",
        bullets: [
          "完成小目标检测模型改造和量化部署，召回率提升 6.8%。",
          "将模型服务接入产线 MES，支持实时报警和结果追溯。",
        ],
      },
    ],
    extras: ["全国大学生智能车竞赛国赛二等奖；英语 CET-6"],
  },
  {
    slug: "recommendation-13",
    name: RESUME_NAMES[12],
    role: "推荐算法工程师",
    city: "上海",
    phone: "138-0000-0013",
    email: candidateEmail(13),
    summary:
      "4 年推荐系统经验，负责召回、排序、冷启动和线上实验，具备从 0 到 1 建设推荐能力的完整实践。",
    skills: [
      ["编程", "Python、SQL、Spark"],
      ["模型", "TensorFlow、PyTorch、DeepFM、双塔召回"],
      ["工程", "Kafka、Redis、Hive、Docker"],
    ],
    education: [
      ["西安电子科技大学", "人工智能 · 本科", "2017.09—2021.06", "主修机器学习、数据挖掘、算法设计"],
    ],
    experiences: [
      {
        company: "潮汐内容",
        title: "推荐算法工程师",
        period: "2021.07—至今",
        location: "上海",
        bullets: [
          "负责内容推荐召回与排序模型迭代，持续优化点击率和多样性指标。",
          "搭建冷启动内容分发策略，将新内容首日曝光量提升约 35%。",
          "参与推荐平台建设，封装特征、训练、评估和上线流程。",
        ],
      },
    ],
    projects: [
      {
        name: "内容推荐平台 0→1",
        role: "核心算法开发",
        period: "2022.03—2023.05",
        tech: "Python、Spark、TensorFlow、Redis",
        bullets: [
          "从零实现热门召回、双塔召回和排序基线，支撑首页与频道场景。",
          "建立离线指标、线上实验和特征回填流程，缩短模型迭代周期。",
        ],
      },
    ],
    extras: ["有推荐系统线上实验经验；工作稳定，技术表达清晰"],
  },
  {
    slug: "java-14",
    name: RESUME_NAMES[13],
    role: "Java 后端工程师",
    city: "成都",
    phone: "138-0000-0014",
    email: candidateEmail(14),
    summary:
      "5 年 Java 微服务研发经验，参与过搜索、工单和智能客服系统建设，具备良好的工程基础和开源协作习惯。",
    skills: [
      ["编程", "Java、Kotlin、SQL、少量 Python"],
      ["框架", "Spring Cloud、MyBatis、Kafka、Redis、Elasticsearch"],
      ["工程", "Linux、Docker、GitHub Actions、Prometheus"],
    ],
    education: [
      ["四川大学", "软件工程 · 本科", "2016.09—2020.06", "主修软件设计、数据库、分布式系统"],
    ],
    experiences: [
      {
        company: "青杉科技",
        title: "Java 后端工程师",
        period: "2020.07—至今",
        location: "成都",
        bullets: [
          "负责客服工单与搜索服务，设计异步事件和权限数据模型。",
          "参与智能客服项目后端接入，调用 Python 模型服务并处理超时降级。",
          "维护开源 Java 工具库，持续参与 Issue 和 Code Review。",
        ],
      },
    ],
    projects: [
      {
        name: "客服工单搜索",
        role: "后端核心开发",
        period: "2023.02—2024.04",
        tech: "Java、Elasticsearch、Kafka",
        bullets: [
          "实现工单索引、增量同步和权限过滤，支持 1,500 万条历史工单。",
          "优化热点查询缓存，P95 查询耗时降低约 42%。",
        ],
      },
    ],
    extras: ["GitHub 开源项目 1.4k Star；目前主要使用 Java，Python 仅项目联调使用"],
  },
  {
    slug: "research-15",
    name: RESUME_NAMES[14],
    role: "大模型算法研究员",
    city: "上海",
    phone: "138-0000-0015",
    email: candidateEmail(15),
    summary:
      "硕士毕业后从事大模型对齐与评测研究，具备论文复现、数据构造和实验分析能力，希望转向更贴近实际产品的 AI 应用研发。",
    skills: [
      ["研究", "LLM 对齐、指令数据、模型评测、文本生成"],
      ["编程", "Python、PyTorch、Transformers、PEFT"],
      ["工具", "Linux、Git、LaTeX、Docker"],
    ],
    education: [
      ["复旦大学", "计算机科学 · 硕士", "2021.09—2024.06", "研究方向：大模型指令数据质量"],
      ["南京理工大学", "计算机科学与技术 · 本科", "2017.09—2021.06", "专业排名前 15%"],
    ],
    experiences: [
      {
        company: "明理人工智能实验室",
        title: "研究工程师",
        period: "2024.07—至今",
        location: "上海",
        bullets: [
          "参与指令数据构建和模型微调实验，负责数据过滤与评测脚本。",
          "复现 4 篇 LLM 对齐论文，形成内部实验报告和可复用基线。",
          "参与中文事实性评测集构建，覆盖问答、摘要和工具调用场景。",
        ],
      },
    ],
    projects: [
      {
        name: "指令数据质量评估",
        role: "主要研究者",
        period: "2023.03—2024.05",
        tech: "Python、PyTorch、LLM",
        bullets: [
          "设计多维数据质量指标，分析数据复杂度与模型性能之间的关系。",
          "相关成果发表于中文核心会议，并整理为开源评测脚本。",
        ],
      },
    ],
    extras: ["发表论文 2 篇；英语读写流利；偏研究型，业务工程经验较少"],
  },
  {
    slug: "mlops-16",
    name: RESUME_NAMES[15],
    role: "MLOps / AI 平台工程师",
    city: "上海",
    phone: "138-0000-0016",
    email: candidateEmail(16),
    summary:
      "4 年 AI 平台与 MLOps 经验，负责模型部署、推理服务、GPU 资源管理和实验平台建设，关注稳定性与成本。",
    skills: [
      ["编程", "Python、Go、Shell、SQL"],
      ["平台", "Kubernetes、Docker、Ray、MLflow、Prometheus"],
      ["模型服务", "vLLM、Triton、ONNX、模型量化"],
      ["AI 应用", "LLM 推理、RAG 服务、Agent 运行环境"],
    ],
    education: [
      ["东南大学", "计算机科学与技术 · 本科", "2017.09—2021.06", "主修操作系统、计算机网络、机器学习"],
    ],
    experiences: [
      {
        company: "矩阵算力",
        title: "AI 平台工程师",
        period: "2021.07—至今",
        location: "上海",
        bullets: [
          "维护 GPU 训练与推理平台，支持模型服务上线、扩缩容和故障恢复。",
          "使用 vLLM 和 Triton 部署多类模型，建立延迟、吞吐和成本监控。",
          "开发 Agent 运行沙箱，提供工具调用审计和资源隔离。",
        ],
      },
    ],
    projects: [
      {
        name: "LLM 推理服务平台",
        role: "平台负责人",
        period: "2024.01—2025.08",
        tech: "Kubernetes、vLLM、Go、Prometheus",
        bullets: [
          "支持 12 个模型按需部署，建立请求排队、限流和自动扩缩容机制。",
          "通过量化与批处理策略降低单位请求成本约 28%。",
        ],
      },
    ],
    extras: ["CKA 认证；有 GPU 集群运维经验；擅长跨团队排查线上问题"],
  },
];

const collaborationStyles = [
  "在方案评审前补齐异常场景、兼容范围和回滚路径",
  "习惯把关键决策、风险和后续动作同步到项目文档",
  "注重与上下游团队提前对齐接口边界和验收口径",
  "会在版本上线后组织复盘，持续跟踪问题闭环",
];

function enrichCandidate(candidate, index) {
  const currentExperience = candidate.experiences[0];
  const firstProject = candidate.projects[0];
  const collaboration = collaborationStyles[index % collaborationStyles.length];
  const teamSize = 4 + (index % 7);

  candidate.summary += ` 在过往项目中参与了需求理解、技术方案、开发验证和上线复盘等环节，能够围绕业务目标主动梳理约束、拆解任务，并与产品、算法、测试和运维等角色保持协作。${index % 2 === 0 ? "工作中重视文档沉淀、工程质量和长期可维护性。" : "面对不完整的需求和试运行阶段的反馈，习惯先验证关键假设，再逐步收敛方案。"}`;

  currentExperience.bullets.splice(
    1,
    0,
    `与产品、测试和上下游服务团队协作完成需求澄清、接口联调和灰度验证，上线后持续跟进日志、监控和用户反馈，处理试运行阶段出现的数据和配置问题。`,
  );
  currentExperience.bullets.push(
    `参与约 ${teamSize} 人项目组的代码审查、方案讨论和故障排查；${collaboration}，并把可复用的处理方式整理到团队文档中。`,
  );

  for (const experience of candidate.experiences.slice(1)) {
    experience.bullets.push(
      "参与项目例会、技术评审和上线支持，逐步熟悉从需求确认、开发排期到发布复盘的完整工程流程。",
    );
  }

  candidate.projects.forEach((project, projectIndex) => {
    project.bullets.unshift(
      projectIndex === 0
        ? `项目背景：业务处于持续推进和需求变化较快的阶段，需要在交付速度、使用效果和维护成本之间做平衡。`
        : `项目背景：团队希望把前期零散能力沉淀为可复用方案，同时兼顾现有系统兼容和后续扩展。`,
    );
    project.bullets.push(
      `个人工作：结合${project.tech}参与方案设计和核心实现，重点关注数据边界、异常场景和上线风险；与相关角色协作完成联调、验收和问题复盘。`,
    );
  });

  candidate.extras.push(
    index % 2 === 0
      ? "工作偏好：重视问题理解、工程质量、文档沉淀与长期可维护性"
      : "工作偏好：愿意承担跨团队协作、复杂问题拆解和阶段性交付压力",
  );
}

candidates.forEach((candidate, index) => enrichCandidate(candidate, index));

const palettes = [
  { accent: "#176b52", soft: "#e7f2ec", ink: "#1e2c25" },
  { accent: "#234d78", soft: "#e8eff6", ink: "#1c2936" },
  { accent: "#9a4e30", soft: "#f7eee9", ink: "#38241d" },
  { accent: "#5b4a87", soft: "#f0edf7", ink: "#2d263e" },
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderResume(candidate, index) {
  const palette = palettes[index % palettes.length];
  const layout = index % 4;
  const initials = candidate.name.slice(-2);

  const experienceHtml = candidate.experiences
    .map(
      (experience) => `
        <section class="entry">
          <div class="entry-head">
            <div>
              <h3>${escapeHtml(experience.company)}</h3>
              <p class="role">${escapeHtml(experience.title)}</p>
            </div>
            <div class="entry-meta">
              <span>${escapeHtml(experience.period)}</span>
              <span>${escapeHtml(experience.location)}</span>
            </div>
          </div>
          <ul>${experience.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </section>
      `,
    )
    .join("");

  const projectHtml = candidate.projects
    .map(
      (project) => `
        <section class="project">
          <div class="project-head">
            <div>
              <h3>${escapeHtml(project.name)}</h3>
              <p class="role">${escapeHtml(project.role)}</p>
            </div>
            <span>${escapeHtml(project.period)}</span>
          </div>
          <p class="tech">技术栈：${escapeHtml(project.tech)}</p>
          <ul>${project.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </section>
      `,
    )
    .join("");

  const educationHtml = candidate.education
    .map(
      ([school, degree, period, detail]) => `
        <section class="education-row">
          <div>
            <h3>${escapeHtml(school)}</h3>
            <p>${escapeHtml(degree)}</p>
          </div>
          <div class="education-meta">
            <span>${escapeHtml(period)}</span>
            <span>${escapeHtml(detail)}</span>
          </div>
        </section>
      `,
    )
    .join("");

  const skillHtml = candidate.skills
    .map(
      ([label, content]) => `
        <div class="skill-row">
          <strong>${escapeHtml(label)}</strong>
          <span>${escapeHtml(content)}</span>
        </div>
      `,
    )
    .join("");

  const body = `
    <main class="resume layout-${layout}">
      <header class="hero">
        <div class="identity">
          <div class="avatar">${escapeHtml(initials)}</div>
          <div>
            <div class="name-row">
              <h1>${escapeHtml(candidate.name)}</h1>
              <span class="target">${escapeHtml(candidate.role)}</span>
            </div>
            <p class="contact">
              ${escapeHtml(candidate.city)} · ${escapeHtml(candidate.phone)} ·
              ${escapeHtml(candidate.email)}
            </p>
          </div>
        </div>
        <p class="summary">${escapeHtml(candidate.summary)}</p>
      </header>

      <div class="content">
        <section class="block">
          <h2><span>01</span> 工作经历</h2>
          ${experienceHtml}
        </section>

        <section class="block">
          <h2><span>02</span> 项目经历</h2>
          ${projectHtml}
        </section>

        <div class="lower-grid">
          <section class="side-block">
            <h2>专业技能</h2>
            <div class="skill-list">${skillHtml}</div>
          </section>
          <section class="side-block">
            <h2>教育背景</h2>
            ${educationHtml}
          </section>
        </div>

        <section class="side-block">
          <h2>补充信息</h2>
          <ul class="extras">${candidate.extras.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </section>
      </div>

      <footer>
        <span>虚构简历样本 · 仅供 才证 招聘筛选系统测试</span>
        <span>${String(index + 1).padStart(2, "0")} / ${candidates.length}</span>
      </footer>
    </main>
  `;

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(candidate.name)} - ${escapeHtml(candidate.role)}</title>
  <style>
    @page { size: A4; margin: 11mm 14mm 12mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      color: ${palette.ink};
      background: #fff;
      padding: 11mm 14mm 12mm;
      font-family: "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .resume {
      position: relative;
      width: 100%;
      min-height: 265mm;
      overflow: visible;
      background: #fff;
    }
    .resume::before {
      position: absolute;
      top: 0;
      right: 0;
      width: 48mm;
      height: 40mm;
      border-radius: 0 0 0 48mm;
      background: ${palette.soft};
      content: "";
    }
    .hero {
      position: relative;
      z-index: 1;
      padding: 3mm 0 7mm;
      border-bottom: 1.2px solid ${palette.accent};
    }
    .identity { display: flex; align-items: center; gap: 5mm; }
    .avatar {
      display: grid;
      width: 17mm;
      height: 17mm;
      flex: 0 0 17mm;
      place-items: center;
      border-radius: 4mm;
      color: #fff;
      background: ${palette.accent};
      font-size: 17px;
      font-weight: 700;
      letter-spacing: 1px;
    }
    .name-row { display: flex; align-items: baseline; gap: 4mm; }
    h1 { margin: 0; font-size: 25px; letter-spacing: 2px; }
    .target {
      color: ${palette.accent};
      font-size: 12px;
      font-weight: 700;
    }
    .contact { margin: 2.5mm 0 0; color: #5d6963; font-size: 9.5px; }
    .summary {
      margin: 5mm 0 0;
      max-width: 180mm;
      color: #4d5b54;
      font-size: 10px;
      line-height: 1.72;
    }
    .content { padding-top: 6mm; }
    .block { margin-bottom: 6mm; }
    .block h2, .side-block h2 {
      margin: 0 0 4mm;
      padding-bottom: 1.6mm;
      border-bottom: 1px solid #e3e9e5;
      color: ${palette.accent};
      font-size: 12px;
      letter-spacing: 1px;
    }
    .block h2 span {
      margin-right: 2mm;
      color: #9eaaa3;
      font-size: 9px;
    }
    .entry, .project {
      break-inside: avoid;
      margin-bottom: 5mm;
    }
    .entry-head, .project-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 4mm;
    }
    .entry h3, .project h3, .education-row h3 {
      margin: 0;
      color: ${palette.ink};
      font-size: 11.5px;
    }
    .role {
      margin: 1mm 0 0;
      color: ${palette.accent};
      font-size: 9.5px;
      font-weight: 700;
    }
    .entry-meta, .education-meta {
      display: flex;
      min-width: 38mm;
      flex-direction: column;
      gap: 1mm;
      color: #66726c;
      font-size: 8.5px;
      text-align: right;
    }
    .project-head > span { color: #66726c; font-size: 8.5px; white-space: nowrap; }
    .tech {
      margin: 1.5mm 0 1mm;
      padding: 1.5mm 2.5mm;
      border-radius: 2mm;
      color: ${palette.accent};
      background: ${palette.soft};
      font-size: 8.3px;
    }
    ul { margin: 1.5mm 0 0; padding-left: 4mm; }
    li {
      margin: 0 0 1.4mm;
      color: #39463f;
      font-size: 9.4px;
      line-height: 1.75;
    }
    .education-row {
      display: flex;
      break-inside: avoid;
      justify-content: space-between;
      gap: 4mm;
      margin-bottom: 3mm;
    }
    .education-row p { margin: 1mm 0 0; color: #5f6b65; font-size: 9px; }
    .lower-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
      gap: 8mm;
      margin-top: 1mm;
      break-inside: avoid;
    }
    .side-block { margin-bottom: 6mm; }
    .skill-list { display: grid; grid-template-columns: 1fr 1fr; gap: 0 5mm; }
    .skill-row {
      margin-bottom: 3.2mm;
      padding-bottom: 3mm;
      border-bottom: 1px solid #edf0ee;
    }
    .skill-row:last-child { border-bottom: 0; }
    .skill-row strong {
      display: block;
      margin-bottom: 1mm;
      color: ${palette.ink};
      font-size: 9px;
    }
    .skill-row span { color: #59665f; font-size: 8.6px; line-height: 1.55; }
    .extras { padding-left: 3.5mm; }
    .extras li { font-size: 8.6px; }
    footer {
      display: flex;
      justify-content: space-between;
      margin-top: 7mm;
      padding-top: 2mm;
      border-top: 1px solid #e9edeb;
      color: #a1aaa5;
      font-size: 7px;
    }
    .layout-1::before { border-radius: 0 0 0 0; width: 100%; height: 34mm; }
    .layout-1 .hero { padding-top: 6mm; }
    .layout-2 .avatar { border-radius: 50%; background: #fff; color: ${palette.accent}; border: 1px solid ${palette.accent}; }
    .layout-2 .target { padding: 1.2mm 2.5mm; border-radius: 5mm; background: ${palette.soft}; }
    .layout-3::before { width: 5mm; height: 40mm; border-radius: 0 0 5mm 0; background: ${palette.soft}; }
    @media print {
      body { padding: 0; }
      .resume { min-height: 0; }
      .hero, .entry-head, .project-head, .lower-grid, footer { break-inside: avoid; }
    }
  </style>
</head>
<body>${body}</body>
</html>`;
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
for (const entry of fs.readdirSync(OUTPUT_DIR)) {
  if (entry.toLocaleLowerCase().endsWith(".html")) {
    fs.rmSync(path.join(OUTPUT_DIR, entry), { force: true });
  }
}

const manifest = candidates.map((candidate, index) => {
  const sequence = String(index + 1).padStart(2, "0");
  const filename = `${sequence}-${candidate.name}-${candidate.role.replaceAll("/", "-")}`;
  const htmlPath = path.join(OUTPUT_DIR, `${filename}.html`);
  fs.writeFileSync(htmlPath, renderResume(candidate, index), "utf8");
  return {
    sequence,
    name: candidate.name,
    target_role: candidate.role,
    city: candidate.city,
    html_file: path.basename(htmlPath),
    pdf_file: `${filename}.pdf`,
  };
});

fs.writeFileSync(
  path.join(__dirname, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(`Generated ${manifest.length} resume HTML files in ${OUTPUT_DIR}`);
