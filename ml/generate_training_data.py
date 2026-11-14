"""Generate a large, fully synthetic recruitment/RAG embedding corpus.

The split is made by fictional entity, so no company appears in both training
and evaluation data.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import re
from collections import Counter, defaultdict
from pathlib import Path


PREFIXES = [
    "星澜", "云阶", "北辰", "智川", "远岚", "元穹", "清栈", "澜图",
    "极栈", "明穹", "观澜", "数屿", "灵枢", "鲸算", "原界", "启元",
]
SUFFIXES = [
    "智算科技", "云服务", "数据智能", "智能科技", "人工智能", "数字科技",
]
CITIES = ["上海", "杭州", "北京", "深圳", "成都", "南京", "苏州", "武汉", "广州", "西安"]
DOMAINS = [
    "企业知识库", "金融风控", "制造质检", "零售决策", "医疗文本",
    "供应链优化", "智能客服", "代码生成", "多模态检索", "模型推理平台",
]
PRODUCTS = [
    "知识引擎", "AgentFlow 平台", "ModelServe 推理服务", "检索增强生成平台",
    "企业数据助手", "多智能体工作台",
]
TEAMS = [
    "知识检索团队", "Agent 平台团队", "模型推理团队", "数据工程团队",
    "企业交付团队", "安全与权限团队", "评测与可观测性团队",
]
ROLES = [
    "AI 应用工程师", "RAG 平台工程师", "Agent 平台工程师", "推理优化工程师",
    "数据平台工程师", "AI 产品经理", "算法工程师", "解决方案架构师",
]
TECHNOLOGIES = [
    "Python", "Go", "FastAPI", "PostgreSQL", "Milvus", "Elasticsearch",
    "Kubernetes", "vLLM", "LangChain", "OpenTelemetry", "Redis", "Kafka",
]
PROJECTS = [
    "企业知识库混合召回", "智能体工具调用审计", "高并发推理网关",
    "多租户权限检索", "合同归档自动化", "客服回答引用校验",
    "模型灰度发布平台", "检索效果离线评测",
]
DOC_TYPES = [
    "company", "product", "organization", "project", "annual-report",
    "role-standard", "paper", "patent", "technology", "hiring-policy",
    "privacy-policy", "interview-rubric", "incident-report", "education",
]


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def stable_id(*parts: object) -> str:
    return hashlib.sha1("|".join(map(str, parts)).encode("utf-8")).hexdigest()[:16]


def tokenize_for_negative(text: str) -> set[str]:
    normalized = text.lower()
    tokens = {m.group(0) for m in re.finditer(r"[a-z0-9][a-z0-9.+#_-]*", normalized) if len(m.group(0)) > 1}
    for match in re.finditer(r"[\u3400-\u9fff]+", normalized):
        seq = match.group(0)
        tokens.update(seq[i:i + 2] for i in range(max(0, len(seq) - 1)))
    return tokens


def make_entity_docs(entity_index: int) -> list[dict]:
    prefix = PREFIXES[entity_index % len(PREFIXES)]
    suffix = SUFFIXES[entity_index % len(SUFFIXES)]
    name = f"{prefix}{suffix}"
    city = CITIES[entity_index % len(CITIES)]
    second_city = CITIES[(entity_index + 3) % len(CITIES)]
    domain = DOMAINS[entity_index % len(DOMAINS)]
    product_a = PRODUCTS[entity_index % len(PRODUCTS)]
    product_b = PRODUCTS[(entity_index + 2) % len(PRODUCTS)]
    team_a = TEAMS[entity_index % len(TEAMS)]
    team_b = TEAMS[(entity_index + 3) % len(TEAMS)]
    role = ROLES[entity_index % len(ROLES)]
    tech_a = TECHNOLOGIES[entity_index % len(TECHNOLOGIES)]
    tech_b = TECHNOLOGIES[(entity_index + 4) % len(TECHNOLOGIES)]
    project = PROJECTS[entity_index % len(PROJECTS)]
    founded = 2014 + entity_index % 9
    clients = 80 + entity_index * 13
    requests = 12 + entity_index * 7
    metric = 18 + entity_index * 3
    patent_no = f"DEMO-PATENT-{name[:2]}-{entity_index + 1:04d}"
    paper_no = f"DEMO-PAPER-{name[:2]}-{entity_index + 1:04d}"
    team_topic = ["检索链路", "工具调用", "推理调度", "权限隔离", "离线评测"][entity_index % 5]

    specs = [
        (
            "company",
            f"{name}公司简介",
            f"{name}是一家比赛虚构的企业人工智能科技公司，成立于 {founded} 年，总部位于{city}，并在{second_city}设有研发中心。公司聚焦{domain}，主要产品包括{product_a}和{product_b}。企业强调来源引用、数据隔离、运行审计和可观测性，服务对象以中大型企业为主。",
            [
                f"哪家虚构公司总部位于{city}并专注{domain}？",
                f"{name}的核心产品是什么？",
                f"哪些资料介绍{name}的企业 AI 产品方向？",
            ],
        ),
        (
            "product",
            f"{name}{product_a}产品说明",
            f"{name}的{product_a}提供文档解析、章节切分、混合检索、引用追溯和租户权限过滤能力。产品支持{tech_a}与{tech_b}，面向{domain}场景。重要输出必须携带原文片段、文档版本和来源标识，不能只返回模型生成的答案。",
            [
                f"{product_a}支持哪些检索和权限能力？",
                f"哪些知识资料描述{name}的引用追溯机制？",
                f"{domain}产品如何处理文档版本和来源标识？",
            ],
        ),
        (
            "organization",
            f"{name}研发组织说明",
            f"{name}的{team_a}负责{team_topic}、检索效果评估和生产问题定位；{team_b}负责 Agent 工作流、工具权限和运行轨迹审计。团队需要与产品、算法和企业交付共同完成灰度发布，并为每个重要结论保留可回放证据。",
            [
                f"{name}的{team_a}负责什么？",
                f"谁负责 Agent 工具权限和运行轨迹审计？",
                f"{name}如何组织生产上线和问题回放？",
            ],
        ),
        (
            "project",
            f"{name}{project}项目案例",
            f"{name}的{project}项目使用 {tech_a}、{tech_b} 和向量召回构建核心链路。项目上线后 P95 延迟降至 320 毫秒，指标改善约 {metric}%，覆盖 {clients} 家企业客户，并支持灰度发布、失败重试和人工审批。",
            [
                f"{project}上线后取得了哪些指标？",
                f"{name}如何降低检索延迟并支持灰度发布？",
                f"哪些案例包含企业知识库生产上线和量化结果？",
            ],
        ),
        (
            "annual-report",
            f"{name}年度业务摘要",
            f"在比赛虚构年度摘要中，{name}拥有约 {clients} 家企业客户，日均处理知识查询 {requests} 万次，研发投入占比约 {25 + entity_index % 15}%。重点投入{team_topic}、Agent 评测、推理优化和权限隔离。所有数字均为演示数据，不代表现实企业。",
            [
                f"{name}的客户规模和知识查询量是多少？",
                f"哪些公司公开资料强调 Agent 评测和权限隔离？",
                f"{name}年度研发投入重点是什么？",
            ],
        ),
        (
            "role-standard",
            f"{name}{role}岗位标准",
            f"{name}的{role}需要掌握 {tech_a} 或 {tech_b}，理解 API、数据处理、RAG 检索、引用约束、评测方法和生产可观测性。高级岗位还应体现跨团队推动、灰度上线、故障处理和业务结果。论文、专利和学校背景只在岗位相关时作为辅助证据。",
            [
                f"{role}需要哪些可核验能力证据？",
                f"{name}如何定义 RAG 岗位的生产上线和评测要求？",
                f"招聘评价卡应如何核验 Agent 项目的真实职责？",
            ],
        ),
        (
            "paper",
            f"{name}论文索引 {paper_no}",
            f"虚构论文 {paper_no}《面向{domain}的引用约束检索增强生成》研究混合召回、重排和答案引用校验。论文强调公开资料只能作为背景信息，需要与候选人的真实项目证据区分。作者、编号和摘要均为比赛演示数据。",
            [
                f"哪些论文研究{domain}的引用约束 RAG？",
                f"{paper_no}的主要研究问题是什么？",
                f"如何避免公开论文被错误当作候选人个人成果？",
            ],
        ),
        (
            "patent",
            f"{name}专利索引 {patent_no}",
            f"虚构专利 {patent_no} 涉及一种面向多租户知识库的权限感知检索方法，包括查询改写、租户过滤、证据重排和引用溯源。专利适用于{domain}，编号仅用于比赛演示，不对应任何现实专利。",
            [
                f"{patent_no}涉及什么技术？",
                f"哪些专利描述多租户权限感知检索？",
                f"专利公开信息如何辅助核验候选人项目背景？",
            ],
        ),
        (
            "technology",
            f"{name}技术架构说明",
            f"{name}采用 BM25 与向量召回结合的混合检索，并使用重排模型提高证据相关性。Agent 运行阶段记录结构化、检索、工具调用、审计和摘要轨迹。模型服务支持灰度、降级、批处理和监控。技术资料强调低延迟、可追溯和权限控制。",
            [
                f"{name}的混合检索架构包含哪些步骤？",
                f"哪些技术资料同时提到 BM25、向量召回和重排？",
                f"Agent 运行轨迹如何记录和审计？",
            ],
        ),
        (
            "hiring-policy",
            f"{name}招聘数据规范",
            f"{name}招聘流程要求评价项与岗位直接相关，禁止使用年龄、性别、婚育、籍贯、民族、健康和照片作为筛选依据。真实简历和通话必须取得授权；比赛演示使用合成数据。公开信息只能辅助解释组织背景，不能直接替代个人证据。",
            [
                f"{name}招聘时禁止使用哪些保护性信息？",
                f"招聘评价卡如何遵守数据合规和授权要求？",
                f"公开信息能否直接替代候选人的个人证据？",
            ],
        ),
        (
            "privacy-policy",
            f"{name}模型与数据安全规范",
            f"{name}的模型服务要求租户隔离、最小权限、日志脱敏和删除传播。知识文档更新后需要删除旧向量并重建索引；候选人删除时必须同步清理简历片段、外部分析结果和公开资料引用。模型不能跨岗位读取候选人数据。",
            [
                f"知识文档更新后向量索引如何处理？",
                f"候选人删除时需要清理哪些数据和引用？",
                f"模型服务如何实现租户隔离和最小权限？",
            ],
        ),
        (
            "interview-rubric",
            f"{name}{role}面试评价表",
            f"{name}的{role}面试重点核验真实项目职责、复杂场景、可量化成果、生产故障处理和跨团队协作。追问要求候选人说明个人边界，不能把团队成果直接归为个人贡献。公开资料用于核对组织和项目背景，最终判断由 HR 完成。",
            [
                f"{role}面试如何核验个人职责和量化成果？",
                f"哪些评价表要求追问项目边界和团队贡献？",
                f"公开资料在面试评价中应如何使用？",
            ],
        ),
        (
            "incident-report",
            f"{name}生产故障复盘",
            f"{name}的{project}曾发生索引更新延迟，导致部分检索结果引用了旧版本文档。团队通过版本号、双写校验和回滚机制修复问题，并在 Agent 运行轨迹中加入知识索引版本。复盘要求所有后续分析标记知识索引是否过期。",
            [
                f"{project}的知识索引故障是如何修复的？",
                f"哪些资料记录知识版本回滚和双写校验？",
                f"知识索引过期时候选人证据卡应如何处理？",
            ],
        ),
        (
            "education",
            f"{name}合作教育项目",
            f"{name}与比赛虚构的江南智算大学合作开展信息检索与智能体课程，覆盖 Python、数据库、机器学习、RAG、Agent 安全和软件工程。教育背景只用于说明课程相关性，不构成对任何真实学校或个人的排名。",
            [
                f"江南智算大学课程与 RAG 岗位有什么关系？",
                f"哪些教育项目覆盖信息检索和 Agent 安全？",
                f"教育背景在招聘评价中应如何使用？",
            ],
        ),
    ]

    docs = []
    for doc_type, title, content, queries in specs:
        doc_id = f"{doc_type}-{stable_id(name, doc_type)}"
        docs.append({
            "id": doc_id,
            "text": clean(content),
            "title": title,
            "doc_type": doc_type,
            "entity_id": f"entity-{entity_index:03d}",
            "entity_name": name,
            "city": city,
            "synthetic": True,
            "queries": [clean(query) for query in queries],
        })
    return docs


def add_project_seed_documents(docs: list[dict], seed_path: Path) -> None:
    if not seed_path.exists():
        return
    pack = json.loads(seed_path.read_text(encoding="utf-8"))
    for index, document in enumerate(pack.get("documents", [])):
        docs.append({
            "id": f"project-seed-{document.get('id', index)}",
            "text": clean(document.get("content", "")),
            "title": document.get("title", "项目演示知识"),
            "doc_type": document.get("documentType", "company"),
            "entity_id": "project-seed",
            "entity_name": document.get("entityName", "星桥智能科技"),
            "city": "上海",
            "synthetic": True,
            "queries": [
                f"{document.get('entityName', '星桥智能科技')}的这份资料说明了什么？",
                clean(document.get("title", "项目知识资料")),
            ],
        })


def build_dataset(entity_count: int, seed_path: Path) -> tuple[list[dict], list[dict], list[dict], list[dict]]:
    docs = []
    for index in range(entity_count):
        docs.extend(make_entity_docs(index))
    add_project_seed_documents(docs, seed_path)

    entity_ids = sorted({doc["entity_id"] for doc in docs if doc["entity_id"] != "project-seed"})
    rng = random.Random(20261114)
    rng.shuffle(entity_ids)
    train_end = int(len(entity_ids) * 0.78)
    val_end = train_end + int(len(entity_ids) * 0.11)
    split_by_entity = {}
    for entity_id in entity_ids[:train_end]:
        split_by_entity[entity_id] = "train"
    for entity_id in entity_ids[train_end:val_end]:
        split_by_entity[entity_id] = "validation"
    for entity_id in entity_ids[val_end:]:
        split_by_entity[entity_id] = "test"
    split_by_entity["project-seed"] = "train"

    by_type = defaultdict(list)
    tokens_by_doc = {}
    for doc in docs:
        doc["split"] = split_by_entity[doc["entity_id"]]
        by_type[doc["doc_type"]].append(doc)
        tokens_by_doc[doc["id"]] = tokenize_for_negative(f"{doc['title']} {doc['text']}")

    train_triplets = []
    val_triplets = []
    eval_cases = []
    for doc in docs:
        candidates = [item for item in by_type[doc["doc_type"]] if item["entity_id"] != doc["entity_id"]]
        if not candidates:
            continue
        positive_tokens = tokens_by_doc[doc["id"]]
        candidates.sort(
            key=lambda item: len(positive_tokens & tokens_by_doc[item["id"]]),
            reverse=True,
        )
        hard_negatives = candidates[:max(2, min(8, len(candidates)))]
        for query in doc["queries"]:
            negatives = rng.sample(hard_negatives, min(2, len(hard_negatives)))
            for negative in negatives:
                row = {
                    "anchor": query,
                    "positive": doc["text"],
                    "negative": negative["text"],
                    "positive_id": doc["id"],
                    "negative_id": negative["id"],
                }
                if doc["split"] == "train":
                    train_triplets.append(row)
                elif doc["split"] == "validation":
                    val_triplets.append(row)
                else:
                    eval_cases.append({
                        "query": query,
                        "positive_id": doc["id"],
                        "negative_id": negative["id"],
                    })

    return docs, train_triplets, val_triplets, eval_cases


def write_jsonl(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--entities", type=int, default=64)
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parents[1] / "training_data")
    parser.add_argument(
        "--seed",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "knowledge" / "demo" / "星桥智能科技.json",
    )
    args = parser.parse_args()
    docs, train_triplets, val_triplets, eval_cases = build_dataset(args.entities, args.seed)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    write_jsonl(args.output_dir / "corpus.jsonl", docs)
    write_jsonl(args.output_dir / "train_triplets.jsonl", train_triplets)
    write_jsonl(args.output_dir / "val_triplets.jsonl", val_triplets)
    write_jsonl(args.output_dir / "test_cases.jsonl", eval_cases)

    stats = {
        "entities": args.entities,
        "documents": len(docs),
        "train_triplets": len(train_triplets),
        "validation_triplets": len(val_triplets),
        "test_cases": len(eval_cases),
        "document_types": dict(Counter(doc["doc_type"] for doc in docs)),
        "splits": dict(Counter(doc["split"] for doc in docs)),
        "synthetic_only": True,
        "split_policy": "entity-isolated train/validation/test",
        "seed_documents": sum(doc["entity_id"] == "project-seed" for doc in docs),
    }
    (args.output_dir / "dataset_stats.json").write_text(
        json.dumps(stats, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
