"use strict";

const fs = require("node:fs");
const path = require("node:path");

const OUTPUT_DIR = path.join(__dirname, "more-html");
const MANIFEST_PATH = path.join(__dirname, "manifest-more.json");

const surnames = [
  "王", "李", "张", "刘", "杨", "黄", "赵", "吴", "周", "徐",
  "孙", "马", "朱", "胡", "郭", "何", "高", "林", "罗", "郑",
  "梁", "谢", "宋", "唐", "许", "韩", "邓", "曹", "彭", "曾",
];

const givenNames = [
  "景行", "若溪", "明轩", "予安", "星河", "书瑶", "天佑", "语晨",
  "皓然", "清越", "远航", "知远", "南星", "芷晴", "奕辰", "思齐",
  "瑾瑜", "云舟", "安澜", "文昊", "静姝", "承泽", "佳禾", "沐阳",
  "子涵", "立恒", "嘉琪", "以宁", "皓宁", "若川", "景尧", "雅楠",
  "启航", "锦程", "明泽", "澜心", "予晨", "嘉树", "修远", "亭宇",
  "柏舟", "瑾萱", "泽宇", "清和", "星野", "南乔", "宜修", "朝闻",
];

const existingNames = new Set([
  "陈思远", "林雨桐", "周嘉宁", "王浩宇", "赵可欣", "许博文", "刘一诺",
  "孙明哲", "唐诗涵", "郑子墨", "何安然", "高远", "罗佳怡", "梁泽宇",
  "沈知夏", "蒋文博",
]);

const cities = [
  "上海", "北京", "杭州", "深圳", "广州", "成都", "南京", "苏州",
  "武汉", "西安", "合肥", "长沙", "青岛", "厦门", "重庆", "天津",
];

const schools = [
  "浙江大学", "上海交通大学", "复旦大学", "中国科学技术大学", "南京大学",
  "武汉大学", "华中科技大学", "哈尔滨工业大学", "西安交通大学", "北京邮电大学",
  "电子科技大学", "西安电子科技大学", "东南大学", "四川大学", "同济大学",
  "北京航空航天大学", "中山大学", "华南理工大学", "山东大学", "吉林大学",
  "湖南大学", "重庆大学", "深圳大学", "南京邮电大学", "杭州电子科技大学",
  "广东工业大学", "苏州大学", "合肥工业大学", "中国海洋大学", "西南交通大学",
];

const companyPrefixes = [
  "云帆", "星港", "澄川", "澜石", "北辰", "远屿", "青岚", "矩阵",
  "一序", "知微", "数栖", "霁光", "泷川", "云策", "明栈", "元景",
  "汇流", "澄舟", "拓界", "砚山", "栈桥", "灵犀", "深度", "森屿",
  "乾元", "栖云", "未名", "澜湾", "初见", "苍穹", "合流", "光锥",
  "极栈", "问川", "原野", "海屿", "序章", "云阶", "星图", "清源",
];

const companySuffixes = [
  "科技", "智能", "数据", "云服务", "网络", "信息", "软件", "数字",
  "系统", "机器人", "智造",
];

const palettes = [
  { accent: "#176b52", soft: "#e7f2ec", ink: "#1e2c25" },
  { accent: "#234d78", soft: "#e8eff6", ink: "#1c2936" },
  { accent: "#9a4e30", soft: "#f7eee9", ink: "#38241d" },
  { accent: "#5b4a87", soft: "#f0edf7", ink: "#2d263e" },
];

const roleSpecs = [
  {
    title: "AI 应用工程师",
    major: "计算机科学与技术",
    skills: [
      ["编程", "Python、FastAPI、TypeScript、SQL"],
      ["AI 应用", "RAG、Agent、LangChain、Prompt Engineering"],
      ["平台", "Milvus、Elasticsearch、Redis、PostgreSQL"],
      ["工程化", "Docker、Kubernetes、GitLab CI"],
    ],
    variants: [
      {
        summary: "负责企业知识库和检索增强应用，具备 Python 服务开发、Agent 编排和线上效果评估经验。",
        project: "企业知识库问答平台",
        projectRole: "核心开发",
        tech: "Python、LangChain、Milvus、FastAPI",
        bullets: ["设计混合召回和重排链路，支持 16 万份企业文档检索。", "建立问答评测集与线上反馈闭环，引用可追溯率达到 92%。"],
      },
      {
        summary: "从后端转向 AI 应用研发，参与客服 Agent、工具调用和知识库检索项目。",
        project: "客服 Agent 工作台",
        projectRole: "AI 应用开发",
        tech: "Python、FastAPI、Redis、OpenAI-compatible API",
        bullets: ["实现工具注册、会话管理和执行日志，接入订单与工单查询。", "通过异步任务和超时降级，首轮问题解决率提升约 18%。"],
      },
      {
        summary: "专注大模型应用工程化，负责 RAG 数据链路、服务部署和成本优化。",
        project: "研发知识检索助手",
        projectRole: "项目负责人",
        tech: "Python、LlamaIndex、Elasticsearch、Kubernetes",
        bullets: ["主导从 PoC 到生产上线，覆盖 7 个研发团队和 5 万篇内部文档。", "引入缓存与批量推理，月度模型调用成本下降约 21%。"],
      },
      {
        summary: "主要从事 Python 数据服务与 LLM 功能集成，正在补充 Agent 与模型评测经验。",
        project: "合同审查 Copilot",
        projectRole: "后端与集成开发",
        tech: "Python、FastAPI、PostgreSQL、LLM API",
        bullets: ["实现文档切分、条款检索和结果结构化输出，支持人工复核。", "构建失败重试与敏感信息检查流程，单份合同处理时间低于 2 分钟。"],
      },
      {
        summary: "具备企业搜索和 AI 应用交付经验，擅长把模糊业务需求拆解为可验证的技术方案。",
        project: "多租户智能文档平台",
        projectRole: "核心开发 / 技术接口人",
        tech: "Python、Milvus、Elasticsearch、Docker",
        bullets: ["完成权限过滤、检索和生成链路，支持多业务线独立配置。", "推动 4 家客户完成灰度上线，沉淀标准化交付与评测手册。"],
      },
      {
        summary: "偏 AI 应用产品和工程结合，参与对话体验、引用展示与运行时监控建设。",
        project: "AI 助手运行平台",
        projectRole: "应用工程师",
        tech: "Python、React、LangChain、OpenTelemetry",
        bullets: ["实现会话、工具调用状态和引用来源展示，支持 6 类业务场景。", "建设请求追踪看板，将平均故障定位时间缩短到 40 分钟以内。"],
      },
    ],
  },
  {
    title: "NLP 算法工程师 / LLM 应用",
    major: "人工智能",
    skills: [
      ["编程", "Python、PyTorch、SQL、Linux"],
      ["算法", "文本分类、信息抽取、指令微调、RAG"],
      ["模型工具", "Transformers、PEFT、vLLM、LLaMA-Factory"],
      ["评测", "离线评测、A/B 测试、bad case 分析"],
    ],
    variants: [
      {
        summary: "从事文本信息抽取和大模型微调，熟悉数据构造、训练评测与推理部署。",
        project: "合同要素抽取模型",
        projectRole: "算法负责人",
        tech: "PyTorch、Transformers、PEFT",
        bullets: ["构建 1.5 万条领域标注集，关键字段 F1 提升 8.9 个百分点。", "完成 LoRA 微调和 vLLM 部署，支持 12 类合同要素。"],
      },
      {
        summary: "负责客服场景文本分类和摘要生成，关注模型效果与线上成本之间的平衡。",
        project: "客服工单智能摘要",
        projectRole: "核心算法开发",
        tech: "Python、Transformers、FastAPI",
        bullets: ["设计分层分类和摘要流程，人工阅读时长平均下降约 27%。", "建立基于人工偏好的评测集，持续跟踪事实性与完整性。"],
      },
      {
        summary: "具备大模型指令数据、模型微调和 RAG 问答经验，正在加强工程部署能力。",
        project: "行业问答模型优化",
        projectRole: "算法工程师",
        tech: "PyTorch、PEFT、RAG、Milvus",
        bullets: ["优化指令数据配比与拒答样例，问答准确率提升 7.4%。", "参与检索切片和重排实验，构建三阶段离线评测流程。"],
      },
      {
        summary: "专注自然语言处理与知识抽取，熟悉从数据清洗到线上服务的算法工程链路。",
        project: "企业实体关系抽取",
        projectRole: "主要开发",
        tech: "Python、PyTorch、BERT、Elasticsearch",
        bullets: ["完成多实体关系抽取和实体对齐，准确率达到业务验收标准。", "开发增量训练与版本回归脚本，缩短模型更新周期。"],
      },
      {
        summary: "研究方向为大模型评测与对齐，参与过问答、摘要和工具调用数据建设。",
        project: "LLM 事实性评测集",
        projectRole: "研究工程师",
        tech: "Python、Transformers、RAGAS",
        bullets: ["构建 800 条带证据标注的中文问答样本，覆盖多个业务场景。", "分析检索与生成对事实性的影响，形成可复用评测报告。"],
      },
    ],
  },
  {
    title: "高级后端工程师",
    major: "软件工程",
    skills: [
      ["编程", "Java、Go、Python、SQL"],
      ["后端", "Spring Boot、微服务、Kafka、Redis"],
      ["数据", "MySQL、PostgreSQL、Elasticsearch"],
      ["架构", "高并发、服务治理、可观测性"],
    ],
    variants: [
      {
        summary: "负责高并发业务系统和在线服务架构，近两年参与智能客服与 RAG 网关建设。",
        project: "智能客服服务网关",
        projectRole: "后端负责人",
        tech: "Go、Python、Redis、Elasticsearch",
        bullets: ["设计租户隔离、限流和熔断机制，保障高峰流量稳定。", "接入检索与生成服务，建立超时降级和调用追踪。"],
      },
      {
        summary: "长期从事交易与订单系统研发，擅长性能优化、异步任务和故障排查。",
        project: "订单链路重构",
        projectRole: "核心后端开发",
        tech: "Java、MySQL、Kafka、Redis",
        bullets: ["拆分热点服务并优化数据库访问，峰值吞吐提升约 2 倍。", "建立容量压测和告警机制，减少高峰期超时问题。"],
      },
      {
        summary: "具备 Python 和 Go 服务研发经验，参与过模型服务接入和 AI 工作流后端。",
        project: "AI 工作流后端",
        projectRole: "后端接口人",
        tech: "Python、FastAPI、Kafka、PostgreSQL",
        bullets: ["实现节点编排、运行状态和审计日志，支持多团队复用。", "设计异步重试和幂等机制，任务失败率控制在 1% 以内。"],
      },
      {
        summary: "专注企业级服务治理和权限系统，参与知识库与搜索服务的数据接口建设。",
        project: "企业知识库权限网关",
        projectRole: "后端开发",
        tech: "Go、Redis、MySQL",
        bullets: ["统一认证、租户和资源权限模型，覆盖 30 多个业务应用。", "完成热点缓存和批量鉴权优化，P95 延迟降低约 36%。"],
      },
      {
        summary: "偏业务后端和系统稳定性，具备跨团队协作、方案评审与线上应急经验。",
        project: "工单搜索与分配系统",
        projectRole: "技术负责人",
        tech: "Java、Elasticsearch、Kafka",
        bullets: ["完成搜索、排序和自动分配链路，支持日均 20 万次查询。", "推动灰度发布与回滚流程，线上变更事故明显减少。"],
      },
    ],
  },
  {
    title: "AI 产品经理",
    major: "信息管理与信息系统",
    skills: [
      ["产品能力", "需求分析、用户研究、原型设计、指标设计"],
      ["AI 理解", "RAG、Agent、模型评测、Prompt 设计"],
      ["分析工具", "SQL、Axure、Figma、Postman"],
      ["协作", "敏捷项目管理、客户访谈、技术方案评审"],
    ],
    variants: [
      {
        summary: "负责企业知识库与对话产品，能够把客户场景拆解为可验收的 AI 产品需求。",
        project: "企业知识库助手",
        projectRole: "产品负责人",
        tech: "RAG 产品、SQL、埋点分析",
        bullets: ["设计引用来源、低置信度提示与人工反馈机制。", "组织 120 条首轮验收问题，推动关键问题解决率达到 84%。"],
      },
      {
        summary: "具备招聘 SaaS 和智能客服产品经验，重视流程效率、可解释性和交付体验。",
        project: "招聘流程智能助手",
        projectRole: "高级产品经理",
        tech: "B 端产品、SQL、流程设计",
        bullets: ["梳理简历分配、面试安排和反馈提醒流程，减少重复录入。", "设计 AI 摘要和候选人状态看板，试点团队处理时长下降约 18%。"],
      },
      {
        summary: "从数据产品转向 AI 产品，擅长指标定义、灰度验证和跨团队推进。",
        project: "智能工单助手",
        projectRole: "AI 产品经理",
        tech: "RAG、Agent、数据分析",
        bullets: ["定义分类、摘要和推荐回复的产品边界与评测指标。", "推动 3 个试点团队完成灰度，缩短首次响应时间。"],
      },
      {
        summary: "负责 B 端协同产品，关注复杂权限、人工审核与 AI 结果可追溯。",
        project: "法务合同审查 Copilot",
        projectRole: "产品负责人",
        tech: "LLM 应用、流程设计、埋点分析",
        bullets: ["设计条款风险分级、原文定位和人工确认流程。", "组织法律顾问参与评测，形成按风险类型的验收标准。"],
      },
      {
        summary: "具备客户交付和产品规划经验，能够快速理解业务场景并形成标准方案。",
        project: "智能文档处理平台",
        projectRole: "产品经理",
        tech: "OCR、RAG、SaaS",
        bullets: ["规划文档接入、解析、检索和审核闭环，覆盖 4 类业务。", "沉淀客户实施模板和常见问题库，降低新项目交付成本。"],
      },
      {
        summary: "关注 AI 产品的模型能力边界，擅长把不确定性转化为明确的用户提示与人工接管。",
        project: "AI 客服体验升级",
        projectRole: "核心产品经理",
        tech: "LLM 应用、A/B 测试、SQL",
        bullets: ["设计拒答、引用和转人工策略，降低错误回答带来的用户困扰。", "建立分场景体验指标与周度复盘机制，推动版本持续迭代。"],
      },
    ],
  },
  {
    title: "数据工程师",
    major: "数据科学与大数据技术",
    skills: [
      ["编程", "Python、SQL、Scala、Shell"],
      ["数据工程", "Spark、Flink、Airflow、Kafka"],
      ["数据平台", "Hive、ClickHouse、PostgreSQL"],
      ["AI 数据", "文本清洗、Embedding、向量检索"],
    ],
    variants: [
      {
        summary: "负责实时与离线数据管道，近两年参与知识库数据治理和向量检索数据建设。",
        project: "企业文档数据治理",
        projectRole: "数据负责人",
        tech: "Python、Spark、Airflow、Milvus",
        bullets: ["建立切片质量规则与增量索引流程，无效数据比例降低约 28%。", "提供按业务域和权限分区的基础数据接口。"],
      },
      {
        summary: "长期建设业务指标平台和事件数据管道，具备数据版本与质量监控经验。",
        project: "实时指标体系",
        projectRole: "核心数据开发",
        tech: "Flink、Kafka、ClickHouse",
        bullets: ["支持 60 多个核心指标实时计算，保障分钟级延迟。", "建设数据口径文档和异常告警，减少跨团队口径争议。"],
      },
      {
        summary: "擅长数据清洗、检索数据处理与评测集构建，关注 AI 数据链路可复现性。",
        project: "RAG 知识数据流水线",
        projectRole: "数据工程师",
        tech: "Python、Spark、Embedding、Elasticsearch",
        bullets: ["完成文档解析、去重、切片和元数据补全，支持 12 万份文档。", "建立版本化评测集，支持模型与检索策略对比。"],
      },
      {
        summary: "从事数据仓库与分析平台研发，具备复杂 SQL 和性能优化经验。",
        project: "经营分析数仓升级",
        projectRole: "数据开发",
        tech: "SQL、Spark、Hive、dbt",
        bullets: ["重构主题域模型和任务依赖，批处理耗时缩短约 40%。", "推动指标口径统一和数据血缘建设。"],
      },
      {
        summary: "具备数据平台、数据治理和跨团队协作经验，参与过模型训练数据准备。",
        project: "训练数据管理平台",
        projectRole: "平台数据负责人",
        tech: "Python、Airflow、MinIO、PostgreSQL",
        bullets: ["支持数据导入、清洗、标注和版本追踪，服务 5 个算法小组。", "建立数据访问控制与生命周期策略，提升实验可复现性。"],
      },
    ],
  },
  {
    title: "全栈工程师",
    major: "软件工程",
    skills: [
      ["前端", "React、Vue、TypeScript、Next.js"],
      ["后端", "Python、Node.js、FastAPI、Express"],
      ["数据库", "PostgreSQL、Redis、MongoDB"],
      ["工程", "Docker、CI/CD、Linux"],
    ],
    variants: [
      {
        summary: "能够独立完成 Web 产品从需求、前后端到部署的全链路开发，近两年参与 LLM 工具建设。",
        project: "Agent 编排工作台",
        projectRole: "独立开发",
        tech: "React、FastAPI、PostgreSQL、Redis",
        bullets: ["实现工具注册、会话记忆和运行日志，完成 4 个内部场景试点。", "从 0 到 1 上线，开放部分组件并形成团队复用。"],
      },
      {
        summary: "负责企业管理系统和内部效率工具，擅长快速交付与业务系统集成。",
        project: "客户运营工作台",
        projectRole: "全栈负责人",
        tech: "Vue、Node.js、MySQL",
        bullets: ["完成权限、审批、报表和消息模块，服务 20 多个业务团队。", "优化接口和前端加载策略，首屏时间降低约 32%。"],
      },
      {
        summary: "具备 AI 对话产品前后端经验，关注流式响应、引用展示与数据追踪。",
        project: "知识问答产品",
        projectRole: "全栈开发",
        tech: "Next.js、Python、SSE、Milvus",
        bullets: ["实现流式回答、引用侧栏和会话管理，支持多租户部署。", "建设前后端埋点，形成用户反馈和失败案例分析闭环。"],
      },
      {
        summary: "独立开发者背景，完成过多个 SaaS 和效率工具项目，工程覆盖面较广。",
        project: "智能文档工作台",
        projectRole: "独立开发",
        tech: "React、Node.js、PostgreSQL、OCR",
        bullets: ["实现上传、解析、编辑、导出和分享流程，支持批量处理。", "上线后累计服务 200 多名付费用户。"],
      },
      {
        summary: "长期从事企业 Web 应用开发，熟悉前后端接口设计、权限与发布流程。",
        project: "企业采购协同平台",
        projectRole: "全栈开发",
        tech: "Java、Vue、MySQL、Redis",
        bullets: ["完成供应商、询价、审批和合同模块，支持多组织权限。", "协同测试与运维完成上线和性能压测。"],
      },
    ],
  },
  {
    title: "机器学习工程师",
    major: "计算机科学与技术",
    skills: [
      ["编程", "Python、SQL、PyTorch"],
      ["方向", "搜索排序、推荐、向量召回、RAG"],
      ["工程", "FastAPI、Kafka、Milvus、Docker"],
      ["评测", "离线指标、线上 A/B 实验、模型监控"],
    ],
    variants: [
      {
        summary: "负责搜索与推荐模型迭代，具备训练、评测和线上服务完整经验。",
        project: "内容推荐排序模型",
        projectRole: "核心算法开发",
        tech: "PyTorch、Spark、Redis",
        bullets: ["迭代召回与排序模型，核心互动指标提升约 6%。", "搭建实验分析流程，支持多策略在线对比。"],
      },
      {
        summary: "专注向量检索和 RAG 效果优化，熟悉 Embedding、重排与评测。",
        project: "企业知识向量检索",
        projectRole: "算法工程师",
        tech: "PyTorch、Milvus、Transformers",
        bullets: ["训练领域 Embedding 并优化重排策略，Top-5 命中率提升 11%。", "建设检索评测集，支持按业务线追踪版本效果。"],
      },
      {
        summary: "从事预测模型与特征工程，关注模型解释性、稳定性和业务收益。",
        project: "用户流失预测",
        projectRole: "模型负责人",
        tech: "Python、LightGBM、Spark",
        bullets: ["构建特征体系和预测模型，召回率提升约 9%。", "设计模型监控与定期重训机制，减少效果漂移。"],
      },
      {
        summary: "具备推荐系统和模型服务经验，能够独立完成从数据到上线的算法闭环。",
        project: "冷启动推荐策略",
        projectRole: "算法与工程开发",
        tech: "Python、TensorFlow、Redis",
        bullets: ["设计内容召回与探索策略，新内容首日曝光提升约 35%。", "完成在线服务接入和降级逻辑，保障请求稳定。"],
      },
      {
        summary: "研究方向为机器学习与文本检索，正在加强大规模线上服务经验。",
        project: "多路召回搜索基线",
        projectRole: "主要开发",
        tech: "PyTorch、Faiss、FastAPI",
        bullets: ["实现关键词、向量和热门三路召回，完成离线调参。", "构建可复现实验脚本与指标看板。"],
      },
    ],
  },
  {
    title: "后端架构师",
    major: "计算机科学与技术",
    skills: [
      ["编程", "Python、Go、Java、SQL"],
      ["架构", "微服务、事件驱动、高可用、数据一致性"],
      ["平台", "Kafka、Redis、Elasticsearch、Kubernetes"],
      ["管理", "方案评审、技术规划、跨团队协作"],
    ],
    variants: [
      {
        summary: "负责大型业务平台架构和技术规划，具备团队带领与跨系统治理经验。",
        project: "统一内容平台架构",
        projectRole: "架构负责人",
        tech: "Go、Kafka、Redis、Kubernetes",
        bullets: ["完成搜索、审核、发布和权限服务的架构整合。", "带领 6 人团队支撑 10 多条业务线持续接入。"],
      },
      {
        summary: "长期从事交易系统和基础服务建设，重视稳定性、容量与可观测性。",
        project: "核心交易平台升级",
        projectRole: "后端架构师",
        tech: "Java、MySQL、Kafka",
        bullets: ["拆分核心链路并设计一致性方案，支撑峰值流量增长。", "完善容量规划、演练和故障恢复流程。"],
      },
      {
        summary: "具备 AI 平台架构经验，负责模型服务、工作流和审计机制设计。",
        project: "AI 工作流平台",
        projectRole: "平台架构师",
        tech: "Python、Go、Kubernetes、Kafka",
        bullets: ["设计模型调用、工具执行和人工节点的统一编排框架。", "建立配额、成本与敏感信息检查机制。"],
      },
      {
        summary: "负责企业搜索和知识管理架构，关注数据权限、检索质量与可扩展性。",
        project: "企业知识平台",
        projectRole: "技术负责人",
        tech: "Elasticsearch、Python、Redis",
        bullets: ["统一索引、权限和查询服务，支持多业务数据接入。", "建立灰度与回滚机制，降低检索策略变更风险。"],
      },
      {
        summary: "偏技术管理和平台治理，具备多团队协同与研发流程建设经验。",
        project: "服务治理平台",
        projectRole: "架构与团队负责人",
        tech: "Go、Kubernetes、Prometheus",
        bullets: ["建设服务注册、限流、配置和监控能力，覆盖 40 多个服务。", "推动研发规范和发布流程落地，减少线上配置问题。"],
      },
    ],
  },
  {
    title: "前端工程师 / AI 产品体验",
    major: "数字媒体技术",
    skills: [
      ["前端", "React、TypeScript、Next.js、浏览性能"],
      ["AI 体验", "流式输出、Markdown、引用展示、工具状态"],
      ["工程", "Node.js、SSE、状态管理、自动化测试"],
      ["设计协作", "Figma、交互规范、可访问性"],
    ],
    variants: [
      {
        summary: "负责 AI 对话与 Agent 产品前端，擅长复杂状态展示和实时交互。",
        project: "Agent 对话工作台",
        projectRole: "前端负责人",
        tech: "React、TypeScript、SSE",
        bullets: ["实现多会话、工具调用状态和引用侧栏。", "拆分渲染热点，长对话可交互时间降低约 30%。"],
      },
      {
        summary: "具备企业 SaaS 和 AI 助手前端经验，关注信息架构与可用性。",
        project: "企业知识助手 Web 端",
        projectRole: "核心前端开发",
        tech: "Vue、TypeScript、SSE",
        bullets: ["完成检索、问答、来源预览和反馈交互。", "建设组件库和设计规范，提升多页面复用率。"],
      },
      {
        summary: "专注数据可视化和复杂业务界面，参与模型评测与运营后台建设。",
        project: "模型评测看板",
        projectRole: "前端开发",
        tech: "React、ECharts、Node.js",
        bullets: ["实现数据集、指标、bad case 和版本对比视图。", "优化大表格与图表渲染性能，支持万级数据浏览。"],
      },
      {
        summary: "全栈背景偏前端，能够独立完成 AI 工具从原型到上线的交互和工程实现。",
        project: "提示词调试工具",
        projectRole: "独立前端开发",
        tech: "Next.js、TypeScript、FastAPI",
        bullets: ["实现 Prompt 版本、参数调整、流式结果和并排对比。", "沉淀内部模板与使用文档，提高产品与算法协作效率。"],
      },
      {
        summary: "重视产品体验与前端工程质量，具备性能监控、埋点和灰度发布经验。",
        project: "智能客服前端升级",
        projectRole: "前端负责人",
        tech: "React、Sentry、WebSocket",
        bullets: ["重构会话与转人工流程，降低用户操作步骤。", "接入性能与异常监控，持续修复高频前端问题。"],
      },
    ],
  },
  {
    title: "Python 开发工程师",
    major: "软件工程",
    skills: [
      ["编程", "Python、SQL、JavaScript"],
      ["后端", "FastAPI、Django、Celery、Redis"],
      ["自动化", "Scrapy、Playwright、文件处理、任务调度"],
      ["AI 集成", "LLM API、文本分类、Prompt 设计"],
    ],
    variants: [
      {
        summary: "负责企业自动化工具和数据服务，擅长将重复业务流程沉淀为稳定脚本与平台。",
        project: "业务数据自动化平台",
        projectRole: "核心开发",
        tech: "Python、FastAPI、Celery",
        bullets: ["整合数据采集、清洗、校验和报表流程，服务 20 多个团队。", "设计任务重试与告警机制，减少人工值守。"],
      },
      {
        summary: "具备 Python Web 和任务队列经验，参与过合同 OCR 与字段提取流程。",
        project: "合同归档自动化",
        projectRole: "后端开发",
        tech: "Python、OCR、MySQL、Celery",
        bullets: ["实现上传、识别、字段提取与归档校验流程。", "建立异常队列和人工复核页面，日均处理约 800 份文档。"],
      },
      {
        summary: "专注数据采集、内部工具和轻量 AI 集成，能够快速定位业务流程中的低效环节。",
        project: "工单智能分类",
        projectRole: "独立开发",
        tech: "Python、LLM API、FastAPI",
        bullets: ["实现工单清洗、分类和摘要，减少人工录入。", "保留置信度与人工修正记录，支持后续规则优化。"],
      },
      {
        summary: "长期维护 Python 服务和脚本工具，具备 Linux 部署、日志分析和故障排查能力。",
        project: "内部服务运维平台",
        projectRole: "Python 开发",
        tech: "Python、Django、Docker",
        bullets: ["整合发布、巡检、日志和告警能力，减少重复运维操作。", "优化批处理任务执行方式，平均运行时间缩短约 25%。"],
      },
      {
        summary: "具备 Web 开发和数据处理经验，正在转向 AI 应用与 Agent 工作流开发。",
        project: "销售线索整理助手",
        projectRole: "开发工程师",
        tech: "Python、FastAPI、PostgreSQL",
        bullets: ["完成线索抓取、去重、摘要和优先级排序。", "接入人工审核和结果导出，支持日常销售运营。"],
      },
    ],
  },
  {
    title: "企业软件产品经理",
    major: "信息管理与信息系统",
    skills: [
      ["产品", "B 端产品、流程设计、需求优先级、数据分析"],
      ["业务", "CRM、招聘、协同、知识管理"],
      ["技术理解", "SQL、API、低代码、基础 AI 产品概念"],
      ["协作", "客户访谈、敏捷项目、方案汇报"],
    ],
    variants: [
      {
        summary: "负责企业协同与流程产品，具备复杂权限、审批和客户交付经验。",
        project: "企业流程协同平台",
        projectRole: "产品负责人",
        tech: "B 端产品、SQL、低代码",
        bullets: ["梳理表单、审批、消息和权限模块，覆盖 30 多个部门。", "建立反馈分层与版本路线图，降低客户定制成本。"],
      },
      {
        summary: "具备招聘与人力系统产品经验，关注批量处理和候选人体验。",
        project: "招聘流程管理平台",
        projectRole: "高级产品经理",
        tech: "SaaS、SQL、数据分析",
        bullets: ["设计简历分配、面试安排和反馈提醒流程。", "加入批量筛选和候选人状态看板，减少重复操作。"],
      },
      {
        summary: "从实施顾问转型产品经理，擅长理解客户真实工作流和落地约束。",
        project: "客户服务知识库",
        projectRole: "产品经理",
        tech: "知识管理、AI 助手、SQL",
        bullets: ["完成知识分类、权限、检索和反馈闭环设计。", "组织客户共建内容规范，提高知识复用率。"],
      },
      {
        summary: "负责数据分析与企业运营产品，具备指标体系与权限管理经验。",
        project: "经营分析工作台",
        projectRole: "核心产品经理",
        tech: "BI、SQL、指标体系",
        bullets: ["规划指标口径、看板和异常提醒功能。", "推动数据团队与业务团队建立统一口径流程。"],
      },
      {
        summary: "关注企业软件的 AI 化体验，能够区分自动化能力与人工兜底边界。",
        project: "合同流程智能化",
        projectRole: "AI 产品经理",
        tech: "OCR、LLM、工作流",
        bullets: ["设计字段识别、风险提示和人工确认节点。", "制定分阶段验收指标与灰度发布方案。"],
      },
    ],
  },
  {
    title: "计算机视觉工程师",
    major: "自动化",
    skills: [
      ["编程", "Python、C++、SQL"],
      ["模型", "PyTorch、YOLO、ONNX、TensorRT"],
      ["工程", "Docker、FastAPI、Linux、CUDA"],
      ["方向", "目标检测、图像分类、分割、边缘部署"],
    ],
    variants: [
      {
        summary: "负责工业视觉模型训练和部署，熟悉数据标注、量化与边缘推理。",
        project: "边缘端缺陷检测",
        projectRole: "算法与部署负责人",
        tech: "PyTorch、TensorRT、C++",
        bullets: ["改造小目标检测模型，召回率提升 6.8%。", "完成量化部署并接入产线系统，支持实时报警。"],
      },
      {
        summary: "从事图像分类和目标检测，参与过摄像头视频分析与模型服务化。",
        project: "园区安全检测系统",
        projectRole: "核心算法开发",
        tech: "PyTorch、YOLO、FastAPI",
        bullets: ["训练人员、车辆和区域入侵检测模型，适配多路视频。", "优化批处理推理，服务端吞吐提升约 1.6 倍。"],
      },
      {
        summary: "具备视觉算法与工程经验，关注模型在真实设备和复杂光照下的稳定性。",
        project: "车载视觉感知预研",
        projectRole: "算法工程师",
        tech: "Python、PyTorch、ONNX",
        bullets: ["完成目标检测基线复现与场景数据评估。", "分析夜间和遮挡场景误差，形成优化方案。"],
      },
      {
        summary: "负责图像分割和数据闭环，具备跨算法、平台与业务团队协作经验。",
        project: "医学图像分割辅助",
        projectRole: "模型开发",
        tech: "PyTorch、MONAI、Python",
        bullets: ["完成数据清洗、训练和可视化评测流程。", "与业务专家共同制定标注规范和验收指标。"],
      },
      {
        summary: "偏 CV 工程化与模型服务，参与多模型接入、监控和性能优化。",
        project: "视觉模型服务中台",
        projectRole: "工程负责人",
        tech: "Python、Triton、Docker、Kubernetes",
        bullets: ["统一模型加载、请求路由和监控接口，接入 8 个模型。", "通过动态批处理降低 GPU 空转和单位请求成本。"],
      },
    ],
  },
  {
    title: "推荐算法工程师",
    major: "人工智能",
    skills: [
      ["编程", "Python、SQL、Spark"],
      ["模型", "TensorFlow、PyTorch、双塔召回、排序模型"],
      ["工程", "Kafka、Redis、Hive、Docker"],
      ["业务", "推荐策略、冷启动、A/B 实验、指标分析"],
    ],
    variants: [
      {
        summary: "负责内容推荐召回与排序，具备从数据处理到线上实验的完整经验。",
        project: "内容推荐召回升级",
        projectRole: "算法负责人",
        tech: "Python、TensorFlow、Spark",
        bullets: ["引入双塔召回并优化特征，核心点击指标提升约 5%。", "建立离线指标与在线实验双向验证流程。"],
      },
      {
        summary: "专注电商推荐和商品理解，关注多样性、冷启动与商业目标平衡。",
        project: "商品冷启动推荐",
        projectRole: "核心算法开发",
        tech: "PyTorch、Redis、Kafka",
        bullets: ["设计内容理解与探索策略，新商品曝光提升约 28%。", "构建实验分层分析，减少不同人群之间的效果偏差。"],
      },
      {
        summary: "具备推荐系统平台建设经验，负责特征、模型训练与上线流程。",
        project: "推荐平台 0→1",
        projectRole: "主要开发",
        tech: "Python、Spark、TensorFlow",
        bullets: ["从零实现热门召回、双塔召回和排序基线。", "封装特征、训练、评估和上线流程，支持多场景复用。"],
      },
      {
        summary: "研究方向为推荐与用户建模，正在积累大规模线上业务经验。",
        project: "兴趣画像与召回实验",
        projectRole: "算法工程师",
        tech: "PyTorch、Faiss、Hive",
        bullets: ["构建用户兴趣特征并完成召回实验对比。", "整理实验复现脚本和指标看板。"],
      },
      {
        summary: "负责推荐策略和供需匹配，擅长用数据和实验定位业务问题。",
        project: "本地生活供需匹配",
        projectRole: "推荐算法开发",
        tech: "Python、XGBoost、Spark",
        bullets: ["优化候选生成和重排规则，提升有效点击率。", "建立区域、时段和用户分群的实验分析体系。"],
      },
    ],
  },
  {
    title: "Java 后端工程师",
    major: "软件工程",
    skills: [
      ["编程", "Java、Kotlin、SQL、少量 Python"],
      ["框架", "Spring Cloud、MyBatis、Kafka、Redis"],
      ["数据", "MySQL、Elasticsearch、PostgreSQL"],
      ["工程", "Docker、Linux、Prometheus、CI/CD"],
    ],
    variants: [
      {
        summary: "负责 Java 微服务和企业业务系统，参与智能客服与搜索服务接入。",
        project: "客服工单搜索",
        projectRole: "核心后端开发",
        tech: "Java、Elasticsearch、Kafka",
        bullets: ["实现索引、增量同步和权限过滤，支持千万级历史数据。", "优化热点查询缓存，P95 延迟降低约 42%。"],
      },
      {
        summary: "长期从事交易与结算后端开发，熟悉并发、事务和系统稳定性治理。",
        project: "结算服务重构",
        projectRole: "后端负责人",
        tech: "Java、MySQL、Redis",
        bullets: ["拆分结算任务并设计幂等处理，降低重复记账风险。", "完善监控与补偿任务，提升日终处理稳定性。"],
      },
      {
        summary: "具备企业搜索和权限系统经验，擅长接口设计与服务治理。",
        project: "企业搜索权限网关",
        projectRole: "后端开发",
        tech: "Java、Spring Cloud、Elasticsearch",
        bullets: ["统一查询、鉴权和租户隔离接口。", "完善超时、熔断和缓存策略。"],
      },
      {
        summary: "参与过 AI 平台后端和模型服务接入，Python 主要用于联调与运维脚本。",
        project: "模型任务调度平台",
        projectRole: "Java 服务开发",
        tech: "Java、Kafka、MySQL",
        bullets: ["实现任务提交、状态流转和失败重试。", "设计资源配额与审计日志接口。"],
      },
      {
        summary: "重视工程质量与线上稳定性，具备跨团队问题排查和发布治理经验。",
        project: "消息通知平台",
        projectRole: "核心开发",
        tech: "Java、Kafka、Redis",
        bullets: ["支持短信、推送和站内信统一编排，日发送量约 200 万。", "建立失败补偿与发送审计机制。"],
      },
    ],
  },
  {
    title: "大模型算法研究员",
    major: "计算机科学",
    skills: [
      ["研究", "LLM 对齐、指令数据、模型评测、文本生成"],
      ["编程", "Python、PyTorch、Transformers、PEFT"],
      ["实验", "实验设计、消融分析、论文复现、数据标注"],
      ["工具", "Linux、Git、LaTeX、Docker"],
    ],
    variants: [
      {
        summary: "研究方向为大模型对齐与评测，具备完整的实验设计和论文复现能力。",
        project: "指令数据质量研究",
        projectRole: "主要研究者",
        tech: "Python、PyTorch、LLM",
        bullets: ["构建多维质量指标并分析其与模型能力的关联。", "整理评测脚本与实验记录，支持团队复现。"],
      },
      {
        summary: "从事实用性对齐和中文事实性研究，参与数据构造、训练和评测。",
        project: "中文事实性评测集",
        projectRole: "研究工程师",
        tech: "Python、Transformers、RAGAS",
        bullets: ["构建带证据标注的问答样本并设计一致性评分。", "分析检索增强与提示策略对事实性的影响。"],
      },
      {
        summary: "关注小模型高效微调和推理优化，具备 LoRA、量化和部署经验。",
        project: "小模型领域适配",
        projectRole: "算法研究员",
        tech: "PyTorch、PEFT、vLLM",
        bullets: ["比较多种微调策略和参数配置，形成领域适配指南。", "完成推理性能与效果权衡实验。"],
      },
      {
        summary: "研究方向为工具调用与 Agent 评测，参与多步骤任务数据集建设。",
        project: "Agent 工具调用评测",
        projectRole: "核心研究者",
        tech: "Python、LLM、Agent",
        bullets: ["设计多工具、多约束任务的评测框架。", "分析规划、参数生成和错误恢复能力。"],
      },
      {
        summary: "偏模型安全和输出可靠性研究，关注拒答、引用和幻觉检测。",
        project: "模型可靠性评测",
        projectRole: "研究工程师",
        tech: "Python、Transformers、评测框架",
        bullets: ["构建事实性、拒答和安全边界的组合测试集。", "形成错误类型分层与改进建议报告。"],
      },
    ],
  },
  {
    title: "MLOps / AI 平台工程师",
    major: "计算机科学与技术",
    skills: [
      ["编程", "Python、Go、Shell、SQL"],
      ["平台", "Kubernetes、Docker、Ray、MLflow"],
      ["模型服务", "vLLM、Triton、ONNX、模型量化"],
      ["运维", "Prometheus、日志、GPU 资源、故障恢复"],
    ],
    variants: [
      {
        summary: "负责模型训练与推理平台，具备 GPU 资源管理、服务治理和监控经验。",
        project: "LLM 推理服务平台",
        projectRole: "平台负责人",
        tech: "Kubernetes、vLLM、Go、Prometheus",
        bullets: ["支持多模型按需部署，建立排队、限流与扩缩容。", "通过量化与批处理降低单位推理成本约 28%。"],
      },
      {
        summary: "专注 AI 基础设施与实验平台，改善模型训练、追踪和上线效率。",
        project: "模型实验管理平台",
        projectRole: "核心平台开发",
        tech: "Python、MLflow、Kubernetes",
        bullets: ["统一参数、数据版本、指标和产物记录。", "建立训练任务模板和资源配额，减少重复配置。"],
      },
      {
        summary: "具备云原生和数据平台背景，参与过 RAG 服务部署与可观测性建设。",
        project: "RAG 服务运行平台",
        projectRole: "平台工程师",
        tech: "Kubernetes、Python、OpenTelemetry",
        bullets: ["封装检索、模型和缓存服务部署模板。", "建设请求追踪、错误率和成本看板。"],
      },
      {
        summary: "负责 GPU 集群和模型服务运维，关注容量、稳定性和故障演练。",
        project: "GPU 资源调度优化",
        projectRole: "基础设施负责人",
        tech: "Kubernetes、Ray、Prometheus",
        bullets: ["引入队列与节点标签调度，提升 GPU 利用率。", "制定故障恢复与容量预警流程。"],
      },
      {
        summary: "具备后端和 MLOps 交叉经验，能够把模型能力封装为稳定内部服务。",
        project: "模型网关建设",
        projectRole: "核心开发",
        tech: "Python、FastAPI、Kubernetes",
        bullets: ["统一模型调用、密钥、配额和审计接口。", "实现超时、重试和多供应商切换。"],
      },
    ],
  },
];

function mulberry32(seed) {
  return function random() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(20261114);

function pick(list) {
  return list[Math.floor(random() * list.length)];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function makeNames(count) {
  const names = [];
  const used = new Set(existingNames);
  const start = Math.floor(random() * givenNames.length);

  for (let offset = 0; names.length < count; offset += 1) {
    const surname = surnames[offset % surnames.length];
    const given = givenNames[(start + Math.floor(offset / surnames.length) * 7) % givenNames.length];
    const name = `${surname}${given}`;
    if (!used.has(name)) {
      used.add(name);
      names.push(name);
    }
  }

  return names;
}

function monthLabel(totalMonths) {
  const year = Math.floor(totalMonths / 12);
  const month = totalMonths % 12 || 12;
  return `${year}.${String(month).padStart(2, "0")}`;
}

function workPeriod(startMonths, endMonths) {
  return `${monthLabel(startMonths)}—${endMonths === null ? "至今" : monthLabel(endMonths)}`;
}

function companyName(index) {
  return `${companyPrefixes[index % companyPrefixes.length]}${companySuffixes[index % companySuffixes.length]}`;
}

function chooseYears(roleIndex, variant) {
  const sets = [
    [2.2, 3.4, 4.6, 5.3, 6.1],
    [1.8, 2.8, 3.6, 4.8, 6.5],
    [3.5, 4.7, 5.8, 6.9, 8.2],
    [1.9, 2.6, 3.8, 5.1, 6.4],
  ];
  const monthOffsets = [1, 4, 7, 10, 2];
  return sets[roleIndex % sets.length][variant] + monthOffsets[variant] / 12;
}

function chooseDegree(roleIndex, variant) {
  if (roleIndex === 14) {
    return variant === 4 ? "本科" : "硕士";
  }
  if ([1, 6, 7, 12].includes(roleIndex)) {
    return variant >= 3 ? "硕士" : "本科";
  }
  if (roleIndex === 5 && variant === 4) {
    return "专科";
  }
  if (roleIndex === 9 && variant === 0) {
    return "专科";
  }
  if ([3, 10].includes(roleIndex) && variant % 2 === 0) {
    return "硕士";
  }
  return "本科";
}

function degreeText(degree) {
  return degree === "硕士" ? "硕士" : degree === "专科" ? "专科" : "本科";
}

function skillGroupsFor(spec, variant) {
  const groups = spec.skills.map(([label, content]) => [label, content]);
  if (variant % 3 === 0) {
    groups[0][1] += "、Git";
  }
  if (variant % 3 === 1) {
    groups.push(["补充能力", "技术文档、问题拆解、跨团队协作"]);
  }
  if (variant % 3 === 2) {
    groups.push(["语言", "英语 CET-6，可阅读英文技术资料"]);
  }
  return groups;
}

function experienceBullets(spec, variant, years, sequence, projectName) {
  const teamSize = 4 + ((sequence + variant * 3) % 8);
  const phase = ["业务快速增长期", "平台重构期", "多业务线扩张期", "从试点到规模化推广阶段"][
    (sequence + variant) % 4
  ];
  const reviewStyle = [
    "坚持在方案评审前补充异常场景和回滚路径",
    "习惯将关键决策、风险和后续动作记录在项目文档中",
    "注重与上下游团队提前对齐接口边界和验收口径",
    "会在版本上线后组织复盘，跟踪问题闭环",
  ][(sequence + variant * 2) % 4];

  if (spec.title.includes("产品")) {
    return [
      `参与${projectName}从场景调研、需求梳理到上线复盘的完整过程，结合${phase}的实际约束拆分版本目标，维护需求池、验收标准和迭代节奏。`,
      `与研发、算法、设计、销售和客户成功团队保持日常协作，将模型能力边界转化为用户可以理解的产品规则，重点处理权限、引用、低置信度提示和人工接管等细节。`,
      `通过客户访谈、行为数据和一线反馈识别高频问题，结合业务收益与实现成本调整优先级；${reviewStyle}，避免只在演示环境里验证功能。`,
      `参与${teamSize}人左右的跨职能项目组，长期跟进试点客户的配置、培训和问题反馈，协助把单点需求沉淀为可复用的产品方案。`,
    ];
  }

  if (spec.title.includes("研究员")) {
    return [
      `参与${projectName}的研究与验证工作，围绕${phase}中的真实问题设计实验，完成数据准备、基线复现、训练评测和结果分析。`,
      `对实验中的异常结果进行分层排查，区分数据质量、评测口径、训练配置和模型能力造成的影响，并记录可复现的实验条件与关键结论。`,
      `与算法工程师和应用团队讨论研究结果如何进入实际系统，参与评测集整理、bad case 归类和后续优化建议，避免只停留在离线指标层面。`,
      `参与${teamSize}人左右的研究或项目小组，定期进行论文分享与实验复盘；${reviewStyle}，对研究结论保持审慎并主动标注局限性。`,
    ];
  }

  if (spec.title.includes("架构")) {
    return [
      `负责相关平台和公共能力的架构规划，结合${phase}下的业务节奏拆解技术目标，明确服务边界、数据流、权限模型和演进路径。`,
      `参与核心模块设计与关键代码评审，统筹容量、稳定性、成本和交付周期之间的取舍；在存在技术债时，会区分短期兼容方案与后续治理计划。`,
      `与产品、算法、数据和运维团队共同推进方案落地，建立发布检查、灰度、监控、降级和回滚机制，重点减少跨系统变更带来的不确定性。`,
      `参与${teamSize}人以上团队的技术管理和人才培养，推动设计文档、评审记录和故障复盘规范；${reviewStyle}，并持续跟进复杂问题的闭环。`,
    ];
  }

  return [
    `负责${projectName}的需求分析、技术方案和主要模块开发，结合${phase}的业务特点拆分任务，确保接口、数据结构和异常处理能够支持后续扩展。`,
    `在实现过程中与产品、算法、测试和运维团队协作，参与接口联调、性能检查、灰度验证和上线支持，及时处理试运行阶段暴露的问题。`,
    `围绕稳定性、可维护性和使用效果迭代实现方案，补充日志、监控、降级和配置能力；对临时方案会记录适用边界和后续治理计划。`,
    `参与${teamSize}人左右的项目组，承担代码审查、技术文档和问题排查等公共工作；${reviewStyle}，并主动把项目经验整理给团队复用。`,
  ];
}

function projectContext(spec) {
  if (spec.title.includes("产品")) {
    return "项目需要在不完全确定的模型能力上设计可用流程，并同时兼顾业务效率、结果可解释性和人工复核成本。";
  }
  if (spec.title.includes("数据")) {
    return "项目涉及多源数据接入、口径统一和质量监控，需要保证数据可追溯，并支持后续需求快速变化。";
  }
  if (spec.title.includes("算法") || spec.title.includes("机器学习") || spec.title.includes("推荐") || spec.title.includes("视觉") || spec.title.includes("研究员")) {
    return "项目不仅关注离线指标，还需要把数据质量、线上时延、资源成本和真实场景误差纳入共同评估。";
  }
  if (spec.title.includes("架构") || spec.title.includes("MLOps") || spec.title.includes("平台")) {
    return "项目需要协调多个业务团队和基础设施约束，在交付速度、稳定性、可观测性与长期维护成本之间做平衡。";
  }
  return "项目处于从试点走向多团队使用的阶段，需要在有限时间里完成需求收敛、技术验证和生产化准备。";
}

function generateCandidate(sequence, roleIndex, variant, name) {
  const spec = roleSpecs[roleIndex];
  const variantData = spec.variants[variant % spec.variants.length];
  const secondaryData = spec.variants[(variant + 2) % spec.variants.length];
  const years = chooseYears(roleIndex, variant);
  const degree = chooseDegree(roleIndex, variant);
  const city = cities[(sequence * 3 + variant) % cities.length];
  const currentMonth = 2026 * 12 + 11;
  const totalMonths = Math.round(years * 12);
  const careerStart = currentMonth - totalMonths;
  const secondExperience = years >= 4.2;
  const currentStart = secondExperience ? careerStart + Math.round(totalMonths * 0.52) : careerStart;
  const previousEnd = currentStart - 1;
  const currentCompany = companyName(sequence + roleIndex * 2);
  const previousCompany = companyName(sequence * 5 + roleIndex + 17);
  const school = schools[(sequence * 7 + roleIndex) % schools.length];
  const degreeYears = degree === "硕士" ? 3 : degree === "专科" ? 3 : 4;
  const educationEnd = careerStart - 2 - (variant % 4);
  const educationStart = educationEnd - degreeYears * 12;
  const secondaryProjectStart = secondExperience ? careerStart + 5 : currentStart + 2;
  const secondaryProjectEnd = secondExperience
    ? currentStart - 2
    : currentStart + 10 + (variant % 4);

  const experiences = [
    {
      company: currentCompany,
      title: spec.title,
      period: workPeriod(currentStart, null),
      location: city,
      bullets: experienceBullets(spec, variant, years, sequence, variantData.project),
    },
  ];

  if (secondExperience) {
    experiences.push({
      company: previousCompany,
      title: variant % 2 === 0 ? "开发工程师" : "项目工程师",
      period: workPeriod(careerStart, previousEnd),
      location: cities[(sequence + variant + 2) % cities.length],
      bullets: [
        `参与内部业务系统的基础功能开发，按照需求文档完成接口、数据处理和页面联调，并在测试阶段跟进缺陷修复。`,
        `参与项目例会、技术评审和上线支持，逐步熟悉从需求确认、开发排期到发布复盘的完整工程流程。`,
      ],
    });
  }

  const projectBullets = [
    `项目背景：${projectContext(spec)}`,
    variantData.bullets[0],
    `个人工作：结合${variantData.tech}完成方案设计与核心实现，过程中重点检查数据边界、异常场景和后续扩展方式；与${3 + ((sequence + variant) % 4)}个相关角色协作推进联调和验收。`,
    variantData.bullets[1],
  ];

  const secondaryBullets = [
    `参与${secondaryData.project}的前期调研和模块建设，负责${secondaryData.projectRole}相关任务，配合团队补齐需求说明、接口约定和测试用例。`,
    secondaryData.bullets[0],
  ];

  const extras = [];
  if (variant === 0) extras.push("维护过个人技术项目或参与开源社区问题讨论，能够持续输出使用文档");
  if (variant === 1) extras.push("参与过团队技术评审和新人辅导，习惯在协作中同步风险与进度");
  if (variant === 2) extras.push("具备英文技术文档阅读和书面沟通能力，参与过海外产品或资料协作");
  if (variant === 3) extras.push("有内部技术分享、方案汇报和跨部门沟通经验");
  if (variant === 4) extras.push("经历过业务快速增长期和需求频繁变化，能够主动调整实现节奏");
  if (variant === 5) extras.push("近期持续关注多模态、Agent 和模型评测相关实践");
  if (extras.length === 0) extras.push(`期望方向：${spec.title}`);
  extras.push(`期望工作地点：${city}`);
  extras.push(
    variant % 2 === 0
      ? "工作偏好：重视问题理解、工程质量与长期可维护性"
      : "工作偏好：愿意承担跨团队协作和复杂问题拆解",
  );

  const roundedYears = Math.round(years * 2) / 2;

  return {
    sequence,
    name,
    role: spec.title,
    city,
    phone: `138-0000-${String(sequence).padStart(4, "0")}`,
    email: `candidate${sequence}@example.com`,
    summary: `约 ${roundedYears} 年相关经验。${variantData.summary}过往工作覆盖需求理解、方案设计、开发验证和上线复盘等环节，能够在业务目标不够清晰时主动补充信息、拆解问题并推动相关角色形成一致方案。${variant % 2 === 1 ? "更偏好在真实业务约束下持续迭代，而不是只追求短期功能交付。" : "重视文档沉淀、工程质量与后续维护，也会在项目结束后整理问题和方法供团队复用。"}`,
    skills: skillGroupsFor(spec, variant),
    education: [
      [
        school,
        `${spec.major} · ${degreeText(degree)}`,
        workPeriod(educationStart, educationEnd),
        degree === "硕士"
          ? "核心课程：机器学习、算法设计、分布式系统"
          : degree === "专科"
            ? "主修课程：程序设计、数据库、Web 开发"
            : "核心课程：数据结构、操作系统、数据库系统",
      ],
    ],
    experiences,
    projects: [
      {
        name: variantData.project,
        role: variantData.projectRole,
        period: workPeriod(currentStart + 3 + (variant % 5), null),
        tech: variantData.tech,
        bullets: projectBullets,
      },
      {
        name: secondaryData.project,
        role: secondaryData.projectRole,
        period: workPeriod(secondaryProjectStart, secondaryProjectEnd),
        tech: secondaryData.tech,
        bullets: secondaryBullets,
      },
    ],
    extras,
    quality: {
      rag: /RAG|知识|检索|文档|问答/.test(
        `${variantData.project}${variantData.tech}${variantData.bullets.join("")}`,
      ),
      agent: /Agent|工作流|工具调用/.test(
        `${variantData.project}${variantData.tech}${variantData.bullets.join("")}`,
      ),
      zeroToOne: variant % 4 === 0 || /从零|0→1|从 0/.test(variantData.bullets.join("")),
      leadership: /负责人|主导|架构/.test(variantData.projectRole),
      openSource: variant === 0,
    },
  };
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
          <div><h3>${escapeHtml(school)}</h3><p>${escapeHtml(degree)}</p></div>
          <div class="education-meta"><span>${escapeHtml(period)}</span><span>${escapeHtml(detail)}</span></div>
        </section>
      `,
    )
    .join("");

  const skillHtml = candidate.skills
    .map(
      ([label, content]) => `
        <div class="skill-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(content)}</span></div>
      `,
    )
    .join("");

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
    .hero { position: relative; padding: 3mm 0 7mm; border-bottom: 1.2px solid ${palette.accent}; }
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
    }
    .name-row { display: flex; align-items: baseline; gap: 4mm; }
    h1 { margin: 0; font-size: 25px; letter-spacing: 2px; }
    .target { color: ${palette.accent}; font-size: 12px; font-weight: 700; }
    .contact { margin: 2.5mm 0 0; color: #5d6963; font-size: 9.5px; }
    .summary { margin: 5mm 0 0; max-width: 174mm; color: #4d5b54; font-size: 10px; line-height: 1.72; }
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
    .block h2 span { margin-right: 2mm; color: #9eaaa3; font-size: 9px; }
    .entry, .project { margin-bottom: 5mm; break-inside: avoid; }
    .entry-head, .project-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 4mm; }
    .entry h3, .project h3, .education-row h3 { margin: 0; font-size: 11.4px; }
    .role { margin: 1mm 0 0; color: ${palette.accent}; font-size: 9.4px; font-weight: 700; }
    .entry-meta, .education-meta {
      display: flex; min-width: 37mm; flex-direction: column; gap: 1mm;
      color: #66726c; font-size: 8.4px; text-align: right;
    }
    .project-head > span { color: #66726c; font-size: 8.4px; white-space: nowrap; }
    .tech { margin: 1.5mm 0 1mm; padding: 1.4mm 2.4mm; border-radius: 2mm; color: ${palette.accent}; background: ${palette.soft}; font-size: 8.2px; }
    ul { margin: 1.4mm 0 0; padding-left: 4mm; }
    li { margin-bottom: 1.4mm; color: #39463f; font-size: 9.4px; line-height: 1.75; }
    .education-row { display: flex; justify-content: space-between; gap: 4mm; }
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
    .skill-row { margin-bottom: 3mm; padding-bottom: 2.8mm; border-bottom: 1px solid #edf0ee; }
    .skill-row:last-child { border-bottom: 0; }
    .skill-row strong { display: block; margin-bottom: 1mm; font-size: 9px; }
    .skill-row span { color: #59665f; font-size: 8.5px; line-height: 1.5; }
    .extras { padding-left: 3.5mm; }
    .extras li { font-size: 8.5px; }
    footer {
      display: flex;
      justify-content: space-between;
      margin-top: 7mm;
      padding-top: 2mm;
      border-top: 1px solid #e9edeb;
      color: #a1aaa5;
      font-size: 7px;
    }
    .layout-1::before { width: 100%; height: 34mm; border-radius: 0; }
    .layout-2 .avatar { border-radius: 50%; color: ${palette.accent}; background: #fff; border: 1px solid ${palette.accent}; }
    .layout-2 .target { padding: 1.2mm 2.5mm; border-radius: 5mm; background: ${palette.soft}; }
    .layout-3::before { width: 5mm; height: 40mm; border-radius: 0 0 5mm 0; }
    @media print {
      body { padding: 0; }
      .resume { min-height: 0; }
      .hero, .entry-head, .project-head, .lower-grid, footer { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main class="resume layout-${layout}">
    <header class="hero">
      <div class="identity">
        <div class="avatar">${escapeHtml(initials)}</div>
        <div>
          <div class="name-row"><h1>${escapeHtml(candidate.name)}</h1><span class="target">${escapeHtml(candidate.role)}</span></div>
          <p class="contact">${escapeHtml(candidate.city)} · ${escapeHtml(candidate.phone)} · ${escapeHtml(candidate.email)}</p>
        </div>
      </div>
      <p class="summary">${escapeHtml(candidate.summary)}</p>
    </header>
    <div class="content">
      <section class="block"><h2><span>01</span> 工作经历</h2>${experienceHtml}</section>
      <section class="block"><h2><span>02</span> 项目经历</h2>${projectHtml}</section>
      <div class="lower-grid">
        <section class="side-block"><h2>专业技能</h2><div class="skill-list">${skillHtml}</div></section>
        <section class="side-block"><h2>教育背景</h2>${educationHtml}</section>
      </div>
      <section class="side-block"><h2>补充信息</h2><ul class="extras">${candidate.extras.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
    </div>
    <footer><span>虚构简历样本 · 仅供 才证 招聘筛选系统测试</span><span>${candidate.sequence} / 100</span></footer>
  </main>
</body>
</html>`;
}

const roleCounts = roleSpecs.map((_, index) => (index < 4 ? 6 : 5));
const names = makeNames(roleCounts.reduce((sum, value) => sum + value, 0));
const candidates = [];
let nameIndex = 0;
let sequence = 17;

roleCounts.forEach((count, roleIndex) => {
  for (let variant = 0; variant < count; variant += 1) {
    const candidate = generateCandidate(sequence, roleIndex, variant, names[nameIndex]);
    candidates.push(candidate);
    nameIndex += 1;
    sequence += 1;
  }
});

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const manifest = candidates.map((candidate, index) => {
  const filename = `${candidate.sequence}-${candidate.name}-${candidate.role.replaceAll("/", "-")}`;
  const htmlPath = path.join(OUTPUT_DIR, `${filename}.html`);
  fs.writeFileSync(htmlPath, renderResume(candidate, index), "utf8");
  return {
    sequence: String(candidate.sequence),
    name: candidate.name,
    target_role: candidate.role,
    city: candidate.city,
    years: Number(candidate.summary.match(/^([0-9.]+)/)?.[1] || 0),
    quality: candidate.quality,
    html_file: path.basename(htmlPath),
    pdf_file: `${filename}.pdf`,
  };
});

fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Generated ${manifest.length} additional resume HTML files in ${OUTPUT_DIR}`);
