"use strict";

const fs = require("node:fs");
const path = require("node:path");

const OUTPUT_PATH = path.join(__dirname, "demo", "星桥智能科技.json");
const RETRIEVED_AT = "2026-11-14";
const LICENSE = "competition-demo-only";
const PUBLISHER = "比赛虚构资料";

const companies = [
  {
    slug: "yunfan",
    name: "云帆智算",
    city: "上海",
    founded: 2016,
    employees: 680,
    industry: "企业知识库、RAG 与智能体平台",
    focus: "多源文档解析、混合检索、工具调用和权限审计",
    products: ["云帆知识中枢", "FlowPilot 智能体平台"],
    stack: ["Python", "FastAPI", "Milvus", "Elasticsearch", "Kubernetes"],
    teams: "知识工程、检索算法、Agent 平台、交付与安全",
    clients: "制造、零售和企业服务客户",
    metric: "知识问答首条命中率提升 18%，平均响应时间低于 1.8 秒",
  },
  {
    slug: "beichen",
    name: "北辰数科",
    city: "北京",
    founded: 2014,
    employees: 920,
    industry: "金融风控与数据中台",
    focus: "实时风控、指标平台、数据血缘和合规审计",
    products: ["北辰指标云", "RiskGraph 风控图谱"],
    stack: ["Java", "Flink", "ClickHouse", "Kafka", "PostgreSQL"],
    teams: "实时计算、风险策略、数据治理和平台运维",
    clients: "银行、保险和消费金融场景",
    metric: "风险规则发布周期由三天缩短到六小时，关键指标可追溯率达到 96%",
  },
  {
    slug: "qingyuan",
    name: "清源机器人",
    city: "深圳",
    founded: 2017,
    employees: 760,
    industry: "工业机器人与视觉质检",
    focus: "边缘推理、缺陷检测、设备控制和生产数据闭环",
    products: ["清源视觉工作站", "EdgeInspect 质检平台"],
    stack: ["C++", "Python", "PyTorch", "ONNX Runtime", "Docker"],
    teams: "视觉算法、运动控制、边缘工程和现场交付",
    clients: "电子制造、汽车零部件和精密装配企业",
    metric: "典型缺陷召回率提升 12%，单件检测耗时降低 35%",
  },
  {
    slug: "lantu",
    name: "澜图科技",
    city: "杭州",
    founded: 2019,
    employees: 410,
    industry: "合同智能与文档理解",
    focus: "合同要素抽取、条款对比、文档检索和风险提示",
    products: ["澜图合同助手", "DocInsight 文档解析服务"],
    stack: ["Python", "Transformers", "PaddleOCR", "FastAPI", "PostgreSQL"],
    teams: "文档算法、法律知识工程、产品与客户成功",
    clients: "法务、采购和企业共享服务中心",
    metric: "合同关键字段抽取准确率达到 94%，人工复核量下降 42%",
  },
  {
    slug: "hengyuan",
    name: "衡远云服",
    city: "南京",
    founded: 2013,
    employees: 1180,
    industry: "云原生与微服务平台",
    focus: "服务治理、容器平台、可观测性和故障应急",
    products: ["衡远云平台", "TraceHub 可观测套件"],
    stack: ["Java", "Go", "Kubernetes", "Prometheus", "OpenTelemetry"],
    teams: "云平台、微服务框架、SRE 和解决方案架构",
    clients: "政务、能源和大型集团客户",
    metric: "核心平台年度可用性达到 99.97%，变更平均回滚时间低于四分钟",
  },
  {
    slug: "zhixu",
    name: "知序智能",
    city: "上海",
    founded: 2020,
    employees: 260,
    industry: "招聘 AI 与人才情报",
    focus: "简历解析、岗位画像、证据化匹配和面试辅助",
    products: ["知序招聘助手", "TalentGraph 人才图谱"],
    stack: ["Python", "FastAPI", "PostgreSQL", "Redis", "BGE-M3"],
    teams: "招聘产品、人才算法、知识工程和数据安全",
    clients: "科技、零售和先进制造企业",
    metric: "简历首轮筛选时间缩短 55%，所有自动结论均保留原文定位",
  },
  {
    slug: "yuanyu",
    name: "远屿系统",
    city: "成都",
    founded: 2018,
    employees: 390,
    industry: "实时数据工程",
    focus: "流批一体、数据质量、指标口径和任务调度",
    products: ["远屿数据管道", "MetricFlow 指标平台"],
    stack: ["Flink", "Spark", "Python", "Airflow", "Hive"],
    teams: "实时计算、数据平台、质量治理和交付",
    clients: "物流、电商和互联网平台",
    metric: "关键任务准时率提升至 99.5%，数据异常平均发现时间缩短 60%",
  },
  {
    slug: "yichuan",
    name: "一川软件",
    city: "苏州",
    founded: 2011,
    employees: 540,
    industry: "企业搜索与知识管理",
    focus: "全文检索、权限过滤、知识分类和搜索结果治理",
    products: ["一川企业搜索", "KMS 知识协同平台"],
    stack: ["Java", "Elasticsearch", "Redis", "Vue", "Linux"],
    teams: "搜索工程、内容治理、前端体验和客户交付",
    clients: "专业服务、教育集团和制造企业",
    metric: "长尾问题检索召回率提升 21%，无效结果反馈下降 33%",
  },
  {
    slug: "xinggang",
    name: "星港网络",
    city: "广州",
    founded: 2015,
    employees: 1560,
    industry: "电商交易与供应链",
    focus: "高并发交易、库存协同、订单履约和商家服务",
    products: ["星港交易云", "SupplyLink 供应链协同"],
    stack: ["Java", "Spring Boot", "MySQL", "Redis", "Kafka"],
    teams: "交易平台、履约系统、支付清结算和稳定性保障",
    clients: "品牌商家、渠道商和仓储物流企业",
    metric: "大促峰值吞吐提升 2.4 倍，订单链路 P99 延迟降低 28%",
  },
  {
    slug: "chengchuan",
    name: "澄川信息",
    city: "武汉",
    founded: 2017,
    employees: 620,
    industry: "智能制造与 MES",
    focus: "生产排程、质量追溯、设备互联和车间可视化",
    products: ["澄川制造执行平台", "FactoryScope 生产看板"],
    stack: ["C#", "Java", "PostgreSQL", "MQTT", "Docker"],
    teams: "制造咨询、MES 研发、工业协议和项目实施",
    clients: "汽车零部件、电子装配和新材料工厂",
    metric: "排产准备时间降低 40%，质量追溯查询从小时级缩短到分钟级",
  },
  {
    slug: "mingzhan",
    name: "明栈科技",
    city: "厦门",
    founded: 2019,
    employees: 310,
    industry: "低代码与业务流程自动化",
    focus: "表单编排、流程引擎、权限配置和系统集成",
    products: ["明栈流程云", "FormKit 低代码工作台"],
    stack: ["TypeScript", "React", "Node.js", "PostgreSQL", "Docker"],
    teams: "产品研发、流程引擎、集成生态和客户成功",
    clients: "区域政企、零售连锁和企业职能部门",
    metric: "标准审批流程交付周期缩短 50%，重复配置工作减少 35%",
  },
  {
    slug: "shuqi",
    name: "数栖科技",
    city: "杭州",
    founded: 2018,
    employees: 470,
    industry: "推荐系统与用户增长",
    focus: "多路召回、排序模型、实验平台和内容理解",
    products: ["数栖推荐引擎", "GrowthLab 实验平台"],
    stack: ["Python", "PyTorch", "Spark", "Flink", "Redis"],
    teams: "推荐算法、用户画像、实验科学和工程平台",
    clients: "内容平台、在线教育和消费品牌",
    metric: "推荐点击率提升 9%，实验发布周期从一周缩短到一天",
  },
  {
    slug: "jiguang",
    name: "霁光数字",
    city: "北京",
    founded: 2016,
    employees: 350,
    industry: "数字内容与营销智能",
    focus: "内容生成、素材审核、投放分析和品牌知识管理",
    products: ["霁光内容工厂", "BrandScope 营销分析"],
    stack: ["TypeScript", "Python", "LLM API", "PostgreSQL", "React"],
    teams: "内容策略、生成式 AI、数据分析与品牌运营",
    clients: "消费品牌、文旅机构和内容服务商",
    metric: "营销素材初稿周期缩短 48%，品牌规范审核覆盖率提升到 97%",
  },
  {
    slug: "yunce",
    name: "云策智能",
    city: "长沙",
    founded: 2020,
    employees: 280,
    industry: "智能客服与 Agent 运营",
    focus: "会话理解、知识检索、工具调用和人工协同",
    products: ["云策客服 Agent", "OpsDesk 坐席助手"],
    stack: ["Python", "FastAPI", "Redis", "Milvus", "RAG"],
    teams: "对话算法、知识运营、产品与交付",
    clients: "电商、运营商和企业服务团队",
    metric: "一次解决率提升 14%，人工转接率下降 19%",
  },
  {
    slug: "yuanjing",
    name: "元景数据",
    city: "合肥",
    founded: 2017,
    employees: 510,
    industry: "隐私计算与数据流通",
    focus: "联邦学习、可信执行环境、数据授权和审计",
    products: ["元景隐私计算平台", "DataTrust 数据合作网关"],
    stack: ["Python", "Go", "Kubernetes", "SQL", "Linux"],
    teams: "密码协议、平台工程、数据合规和行业方案",
    clients: "金融、医疗和公共数据合作项目",
    metric: "联合建模任务交付周期缩短 30%，数据使用审计覆盖全部作业",
  },
  {
    slug: "huiliu",
    name: "汇流云",
    city: "青岛",
    founded: 2015,
    employees: 830,
    industry: "数据分析与商业智能",
    focus: "自助分析、指标体系、语义层和经营监控",
    products: ["汇流分析云", "MetricBoard 经营驾驶舱"],
    stack: ["SQL", "ClickHouse", "TypeScript", "Vue", "Airflow"],
    teams: "指标产品、分析工程、可视化与数据咨询",
    clients: "零售、物流和集团经营管理部门",
    metric: "重复取数需求下降 38%，经营日报生成时间缩短到十分钟以内",
  },
  {
    slug: "chengzhou",
    name: "澄舟网络",
    city: "西安",
    founded: 2014,
    employees: 1240,
    industry: "内容社区与社交产品",
    focus: "内容分发、社区治理、实时消息和创作者工具",
    products: ["澄舟内容社区", "CreatorKit 创作平台"],
    stack: ["Go", "React", "Kafka", "MySQL", "Elasticsearch"],
    teams: "社区产品、推荐工程、内容安全和服务端平台",
    clients: "兴趣社区、知识分享和专业内容平台",
    metric: "社区内容审核时延降低 45%，核心页面可交互时间提升 27%",
  },
  {
    slug: "tuojie",
    name: "拓界智造",
    city: "重庆",
    founded: 2016,
    employees: 970,
    industry: "新能源电池与储能",
    focus: "电池管理、储能调度、生产数据和设备安全",
    products: ["拓界储能控制系统", "BatteryOS 电池管理平台"],
    stack: ["C++", "Python", "MQTT", "TimescaleDB", "Linux"],
    teams: "储能算法、嵌入式平台、云端服务和现场运维",
    clients: "工商业储能、园区能源和新能源设备企业",
    metric: "储能调度策略测试周期缩短 32%，关键设备告警漏报率下降 18%",
  },
  {
    slug: "yanshan",
    name: "砚山软件",
    city: "天津",
    founded: 2012,
    employees: 720,
    industry: "医疗信息化",
    focus: "电子病历、临床路径、数据交换和医疗质量控制",
    products: ["砚山临床协同平台", "HealthBridge 数据交换"],
    stack: ["Java", "Oracle", "Vue", "Docker", "HL7"],
    teams: "临床产品、数据交换、实施交付和合规安全",
    clients: "综合医院、专科医院和区域医疗平台",
    metric: "跨系统数据交换成功率提升到 99.2%，临床数据核对时间下降 40%",
  },
  {
    slug: "zhanqiao",
    name: "栈桥科技",
    city: "上海",
    founded: 2018,
    employees: 330,
    industry: "API 网关与可观测性",
    focus: "统一接入、流量治理、链路追踪和故障诊断",
    products: ["栈桥 API 网关", "ScopeOne 可观测平台"],
    stack: ["Go", "Envoy", "OpenTelemetry", "ClickHouse", "Kubernetes"],
    teams: "网关研发、可观测性、SRE 和开发者体验",
    clients: "金融科技、SaaS 和中大型研发组织",
    metric: "接口故障定位时间缩短 52%，网关规则发布耗时降低 36%",
  },
  {
    slug: "lingxi",
    name: "灵犀交互",
    city: "深圳",
    founded: 2021,
    employees: 240,
    industry: "语音交互与智能硬件",
    focus: "语音识别、对话管理、端云协同和隐私保护",
    products: ["灵犀语音助手", "VoiceEdge 端侧交互套件"],
    stack: ["C++", "Python", "ONNX", "WebSocket", "Linux"],
    teams: "语音算法、端侧工程、对话产品和硬件协作",
    clients: "车载设备、智能家居和公共服务终端",
    metric: "噪声场景识别准确率提升 11%，端侧首字响应时间降低 30%",
  },
  {
    slug: "shendu",
    name: "深度矩阵",
    city: "北京",
    founded: 2019,
    employees: 580,
    industry: "大模型训练与 MLOps",
    focus: "分布式训练、模型评测、推理服务和资源调度",
    products: ["DeepGrid 训练平台", "ModelServe 推理云"],
    stack: ["PyTorch", "CUDA", "Kubernetes", "vLLM", "Prometheus"],
    teams: "训练框架、推理优化、平台工程和模型评测",
    clients: "科研机构、AI 应用企业和算力平台",
    metric: "集群平均利用率提升 23%，模型发布回滚时间缩短到五分钟",
  },
  {
    slug: "senyu",
    name: "森屿教育",
    city: "南京",
    founded: 2016,
    employees: 680,
    industry: "在线教育与学习服务",
    focus: "自适应学习、课程知识图谱和教学效果分析",
    products: ["森屿自适应课堂", "LearnGraph 课程平台"],
    stack: ["TypeScript", "Python", "PostgreSQL", "Redis", "React"],
    teams: "教研、学习算法、产品研发和师资运营",
    clients: "职业培训机构、高校继续教育和企业学习平台",
    metric: "课程完成率提升 16%，教师备课重复劳动下降 28%",
  },
  {
    slug: "qianyuan",
    name: "乾元物流",
    city: "郑州",
    founded: 2013,
    employees: 1450,
    industry: "智慧物流与供应链",
    focus: "运输调度、仓配协同、轨迹预测和异常处理",
    products: ["乾元运输云", "RouteMind 调度平台"],
    stack: ["Java", "Python", "Kafka", "PostgreSQL", "Flink"],
    teams: "调度算法、TMS 研发、仓储运营和数据平台",
    clients: "品牌供应链、区域仓配和第三方物流企业",
    metric: "车辆空驶率下降 8%，异常订单平均处置时间缩短 37%",
  },
];

const universities = [
  ["江南智算大学", "南京", "人工智能学院", "计算机科学、智能系统与数据工程", "知识图谱、检索增强生成和企业智能"],
  ["东海理工大学", "上海", "信息工程学院", "软件工程、分布式系统与工业互联网", "边缘智能、制造数据治理和系统可靠性"],
  ["中原数字大学", "郑州", "数据科学学院", "数据科学、统计学习与商业分析", "时空数据、供应链优化和因果推断"],
  ["南湾科技大学", "深圳", "计算机学院", "人工智能、网络空间安全与软件工程", "多模态检索、语音交互和隐私计算"],
  ["北岭信息大学", "北京", "计算机与通信学院", "计算机技术、通信工程与智能计算", "大模型评测、推理优化和智能体安全"],
  ["明湖大学", "杭州", "数字技术学院", "电子商务、软件工程与信息系统", "推荐系统、用户行为建模和内容治理"],
  ["云麓工业大学", "长沙", "智能制造学院", "自动化、工业工程与机器人技术", "工业视觉、设备预测维护和数字孪生"],
  ["海城交通大学", "青岛", "物流与信息学院", "交通工程、物流管理与数据科学", "路径规划、仓配优化和运输风险预测"],
];

const roleStandards = [
  {
    slug: "ai-app",
    title: "AI 应用工程师",
    criteria: ["RAG 与检索链路", "Python/FastAPI 后端", "Agent 工具调用", "生产交付与评测"],
    evidence: ["可定位到原文的项目职责", "上线后的延迟、质量或成本指标", "权限、审计和失败回退机制"],
    risks: ["只列框架名称没有实际项目", "把模型效果全部归因于个人", "无法解释引用追溯和异常处理"],
  },
  {
    slug: "mlops",
    title: "MLOps / AI 平台工程师",
    criteria: ["模型服务与推理", "容器和集群", "可观测性", "模型版本与发布"],
    evidence: ["部署规模与资源使用", "灰度、回滚和容量规划记录", "故障处理和生产稳定性数据"],
    risks: ["只有证书没有平台实践", "把通用运维经验等同于 MLOps", "无法说明模型升级对业务的影响"],
  },
  {
    slug: "data",
    title: "数据平台工程师",
    criteria: ["数据管道", "SQL 与数据建模", "质量治理", "批流计算和服务 SLA"],
    evidence: ["数据规模、任务时效和稳定性", "质量规则与异常处理", "指标口径和血缘管理"],
    risks: ["只会单机脚本", "忽略数据质量和回滚", "无法解释口径冲突"],
  },
  {
    slug: "backend",
    title: "高级后端工程师",
    criteria: ["API 与微服务", "数据库和缓存", "高并发稳定性", "生产发布与回滚"],
    evidence: ["吞吐、延迟和可用性指标", "服务拆分与治理实践", "故障复盘和容量评估"],
    risks: ["只强调技术栈", "没有线上责任边界", "性能结论缺少测量方法"],
  },
  {
    slug: "product",
    title: "AI 产品经理",
    criteria: ["用户研究", "AI 能力边界", "指标与实验", "跨团队交付"],
    evidence: ["用户问题和需求依据", "试用到上线的完整闭环", "质量、效率和业务结果指标"],
    risks: ["只做功能罗列", "无法解释模型失败场景", "把团队成果写成个人成果"],
  },
  {
    slug: "nlp",
    title: "NLP 算法工程师",
    criteria: ["数据构建", "模型训练与微调", "评测设计", "线上推理与业务适配"],
    evidence: ["数据集规模和标注规则", "基线与对照实验结果", "线上延迟、召回和错误分析"],
    risks: ["只报指标不说明口径", "没有坏例分析", "训练成果无法进入生产"],
  },
  {
    slug: "recommend",
    title: "推荐算法工程师",
    criteria: ["多路召回", "排序模型", "A/B 实验", "特征和样本治理"],
    evidence: ["实验分组、样本量和置信区间", "核心指标与长期体验平衡", "线上效果和回滚记录"],
    risks: ["把相关性当因果", "只追求短期点击率", "无法解释实验设计"],
  },
  {
    slug: "frontend",
    title: "前端工程师 / AI 产品体验",
    criteria: ["复杂交互实现", "流式与异步状态", "性能与可访问性", "前端可观测性"],
    evidence: ["真实产品页面和交互流程", "首屏、交互延迟和稳定性指标", "键盘、移动端和异常状态处理"],
    risks: ["只展示视觉稿", "忽略加载与失败状态", "无法说明性能优化方法"],
  },
];

const methodologies = [
  ["evidence-scorecard", "招聘证据评分卡设计原则", "评分项应绑定岗位任务和可验证证据，权重反映岗位优先级；姓名、年龄、性别、婚育、籍贯等保护属性不得进入评分项。"],
  ["experience-value", "经历含金量的可复核判断", "判断经历含金量时应区分个人职责、团队成果、项目复杂度和可验证结果。公司规模或学校名称只能作为语境，不能替代岗位证据。"],
  ["interview-consent", "AI 电话初筛的告知与授权", "通话前必须说明 AI 身份、语音识别方式和转写用途，获得明确同意后才能继续；候选人拒绝时应立即停止并记录结果。"],
  ["jd-quality", "岗位 JD 质量检查清单", "高质量 JD 应包含业务目标、核心职责、必要技能、可接受经验边界和成功指标，避免将保护属性或不相关偏好写成硬性条件。"],
  ["ocr-quality", "简历 OCR 质量与人工复核", "低质量 OCR 不得直接用于淘汰。系统应提示文字覆盖率、字段冲突和关键段落缺失，并要求人工核对姓名、技能和项目经历。"],
  ["rag-evaluation", "RAG 检索与回答评测方法", "评测应分别覆盖召回、重排、引用忠实度和答案完整性；记录数据切分、查询集、基线版本和失败样本，避免只展示成功案例。"],
  ["public-source", "公开信息来源核验规范", "公开资料应保留发布机构、来源链接、发布日期和抓取时间。没有授权或无法验证来源的信息不得用于个人价值判断。"],
  ["synthetic-data", "合成候选人数据使用规则", "比赛和生产演练应使用合成身份、示例邮箱和虚构电话。不得把公开人物的姓名、履历或论文记录拼接成候选人画像。"],
];

function dateFor(index) {
  const month = String(1 + (index % 9)).padStart(2, "0");
  const day = String(5 + ((index * 3) % 20)).padStart(2, "0");
  return `2025-${month}-${day}`;
}

function baseDocument(index, values) {
  return {
    ...values,
    publishedAt: dateFor(index),
    retrievedAt: RETRIEVED_AT,
    synthetic: true,
    license: LICENSE,
    publisher: PUBLISHER,
    sourceUrl: "",
  };
}

function buildPack(coreDocuments) {
  const documents = [...coreDocuments];

  companies.forEach((company, index) => {
    const prefix = `demo-company-${company.slug}`;
    const productText = company.products.join("、");
    const stackText = company.stack.join("、");
    documents.push(baseDocument(index, {
      id: `${prefix}-profile`,
      title: `${company.name} · 公司与产品简介（虚构演示）`,
      documentType: "company",
      entityName: company.name,
      sourceLabel: "比赛演示资料 · 虚构公司简介",
      content: `${company.name} 是一家虚构的${company.industry}公司，成立于 ${company.founded} 年，总部位于${company.city}，团队规模约 ${company.employees} 人。公司聚焦${company.focus}。\n\n核心产品包括${productText}，主要面向${company.clients}。技术体系覆盖${stackText}，强调数据隔离、来源引用、人工复核和运行审计。\n\n比赛资料设定其公开成果为：${company.metric}。本资料完全虚构，仅用于招聘证据、岗位分析和 RAG 检索演示。`,
    }));
    documents.push(baseDocument(index, {
      id: `${prefix}-org`,
      title: `${company.name} · 研发组织与团队职责（虚构演示）`,
      documentType: "organization",
      entityName: company.name,
      sourceLabel: "比赛演示资料 · 虚构组织说明",
      content: `${company.name} 的虚构研发组织包括${company.teams}等团队。产品团队负责岗位任务、用户反馈和版本优先级；算法团队负责数据、模型和评测；工程团队负责服务稳定性、权限、可观测性与交付。\n\n跨团队项目采用需求澄清、技术方案评审、灰度发布和复盘制度。候选人是否具备真实协作经验，应通过其承担的具体职责、交付边界和问题处理记录判断，不能仅凭组织名称推断。`,
    }));
    documents.push(baseDocument(index, {
      id: `${prefix}-tech`,
      title: `${company.name} · 技术架构概览（虚构演示）`,
      documentType: "technology",
      entityName: company.name,
      sourceLabel: "比赛演示资料 · 虚构技术概览",
      content: `${company.name} 的演示技术架构以 ${stackText} 为主，围绕${company.focus}建设。系统包含接入层、业务服务、数据处理、模型推理和管理审计模块，并要求记录输入来源、版本、关键配置和失败回退。\n\n在生产场景中，团队关注延迟、吞吐、资源成本、权限隔离和可观测性。该资料用于考察候选人对架构取舍和工程边界的理解，不代表任何真实企业系统。`,
    }));
    documents.push(baseDocument(index, {
      id: `${prefix}-annual`,
      title: `${company.name} · 2025 年度业务摘要（虚构演示）`,
      documentType: "annual-report",
      entityName: company.name,
      sourceLabel: "比赛演示资料 · 虚构年度摘要",
      content: `${company.name} 的 2025 年虚构业务摘要设定：现有员工约 ${company.employees} 人，服务${company.clients}，研发投入持续集中于${company.focus}。年度重点包括核心产品升级、交付标准化、权限审计和质量评测。\n\n演示经营指标为：${company.metric}。上述数据和业务信息全部为比赛合成资料，不对应任何真实企业。`,
    }));

    if (index < 8) {
      documents.push(baseDocument(index + 30, {
        id: `${prefix}-paper-index`,
        title: `${company.name} · 技术论文索引（虚构演示）`,
        documentType: "paper",
        entityName: company.name,
        sourceLabel: "比赛演示资料 · 虚构论文索引",
        content: `本索引收录${company.name}研发团队围绕${company.focus}整理的虚构技术论文条目，研究方向包括检索质量、模型评测、工程稳定性、数据治理和人机协作。\n\n示例成果关注：不同召回策略的对照实验、系统延迟与质量的权衡、失败样本归因、权限审计和线上回滚。所有论文标题、作者、指标与发表信息均为比赛合成，不得当作真实研究成果引用。`,
      }));
    }
    if (index >= 8 && index < 16) {
      documents.push(baseDocument(index + 32, {
        id: `${prefix}-patent-index`,
        title: `${company.name} · 专利公开信息索引（虚构演示）`,
        documentType: "patent",
        entityName: company.name,
        sourceLabel: "比赛演示资料 · 虚构专利索引",
        content: `${company.name} 的虚构专利索引编号为 DEMO-PATENT-${company.slug.toUpperCase()}-2025。示例主题覆盖${company.focus}相关的数据处理、任务编排、状态监控和权限控制。\n\n检索专利时应核对申请主体、公开日期、权利要求和来源，不得把专利数量直接等同于个人能力。本条目为虚构比赛资料。`,
      }));
    }
  });

  universities.forEach(([name, city, college, majors, research], index) => {
    documents.push(baseDocument(index + 50, {
      id: `demo-education-${index + 1}`,
      title: `${name} · ${college}专业与研究介绍（虚构演示）`,
      documentType: "education",
      entityName: name,
      sourceLabel: "比赛演示资料 · 虚构学校专业介绍",
      content: `${name} 是一所比赛用虚构高校，校址设定为${city}。${college}开设${majors}等方向，课程覆盖数据结构、操作系统、数据库、机器学习、软件工程和工程实践。\n\n重点研究场景包括${research}。资料只用于理解学校专业课程和研究语境，不能把学校名称直接视为候选人能力或岗位适配度。`,
    }));
  });

  roleStandards.forEach((role, index) => {
    documents.push(baseDocument(index + 60, {
      id: `demo-role-${role.slug}`,
      title: `${role.title} · 岗位能力与证据标准（虚构演示）`,
      documentType: "role-standard",
      entityName: role.title,
      sourceLabel: "比赛演示资料 · 虚构岗位标准",
      content: `该虚构岗位标准包含四类核心评价项：${role.criteria.join("、")}。有效证据包括${role.evidence.join("、")}。\n\n常见误判风险包括：${role.risks.join("；")}。岗位评价卡应由 HR 根据真实 JD 调整，系统只提供一致的证据检查框架，不自动作出录用决定。`,
    }));
  });

  methodologies.forEach(([slug, title, content], index) => {
    documents.push(baseDocument(index + 70, {
      id: `demo-method-${slug}`,
      title: `${title}（虚构演示）`,
      documentType: "technology",
      entityName: "才证招聘知识中心",
      sourceLabel: "比赛演示资料 · 招聘方法说明",
      content: `${content}\n\n本文为比赛合成方法论，用于说明系统如何组织证据、呈现来源和控制风险，不构成法律意见、招聘结论或对真实个人的评价。`,
    }));
  });

  return {
    version: 2,
    generatedAt: RETRIEVED_AT,
    disclaimer: "除星桥智算联合实验室等明确标注虚构的核心演示资料外，本文件中的企业、高校、团队、论文、专利和业务数字均为比赛合成资料，与任何现实组织或个人无关。",
    documents,
  };
}

const current = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8"));
const coreDocuments = (current.documents || []).filter((document) => document.id.startsWith("demo-xingqiao-"));
const pack = buildPack(coreDocuments);
const ids = new Set(pack.documents.map((document) => document.id));
if (ids.size !== pack.documents.length) throw new Error("Generated knowledge document IDs must be unique");
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
console.log(`Generated ${pack.documents.length} demo knowledge documents.`);
