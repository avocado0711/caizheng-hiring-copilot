"""Expand synthetic knowledge into diverse single- and multi-positive queries."""

from __future__ import annotations

import argparse
import json
import random
import re
from collections import defaultdict
from pathlib import Path


TYPE_NAMES = {
    "company": "公司简介",
    "product": "产品能力",
    "organization": "团队职责",
    "project": "项目案例",
    "annual-report": "年度业务",
    "role-standard": "岗位标准",
    "paper": "论文资料",
    "patent": "专利资料",
    "technology": "技术架构",
    "hiring-policy": "招聘规范",
    "privacy-policy": "数据安全规范",
    "interview-rubric": "面试评价表",
    "incident-report": "故障复盘",
    "education": "教育项目",
}


def read_jsonl(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def write_jsonl(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def key_terms(text: str, entity_name: str) -> list[str]:
    terms = re.findall(r"[A-Za-z][A-Za-z0-9.+#_-]{1,30}|[\u3400-\u9fff]{2,8}", text)
    blocked = {"公司", "资料", "相关", "哪些", "可以", "如何", "要求", "团队", "项目", "介绍"}
    return [
        term for term in terms
        if term not in blocked
        and term not in entity_name
        and entity_name not in term
    ][:8]


def build_queries(document: dict, rng: random.Random) -> list[str]:
    entity = document["entity_name"]
    doc_type = document["doc_type"]
    type_name = TYPE_NAMES.get(doc_type, doc_type)
    title = document["title"]
    area = title.replace(entity, "").strip(" ·-_") or type_name
    terms = key_terms(document["text"], entity)
    first = terms[0] if terms else type_name
    second = terms[1] if len(terms) > 1 else "生产和评测"
    queries = [
        f"{entity}的{area}说明了什么？",
        f"如何核验{entity}在{area}方面的公开证据？",
        f"哪份资料描述了{first}与{second}？",
        f"该组织在{area}上承担哪些职责或风险？",
        f"公开资料如何说明{first}和{second}的关系？",
        f"请找出包含{area}、上线和评测信息的资料。",
        f"{type_name}中有哪些可追溯的团队、指标或风险信息？",
        f"哪些知识片段可以用于核对{first}相关经历？",
    ]
    variants = [
        f"{entity}{type_name}里最值得核验的证据是什么？",
        f"关于{area}，简历证据和公开资料应如何交叉核对？",
        f"哪些企业资料同时提到{first}和{second}？",
        f"{entity}公开资料对{area}给出了哪些可核验结论？",
        f"针对{area}，需要核对哪些团队职责、指标和风险？",
        f"检索资料中与{first}有关的个人职责边界是什么？",
        f"{first}相关经历在公开信息里有哪些支持项和限制？",
        f"如何判断{second}是团队成果还是个人成果？",
        f"哪些证据可以证明{area}确实进入生产环境？",
        f"这份{type_name}中哪些指标、风险或责任可以追溯？",
    ]
    queries.extend(rng.sample(variants, k=5))
    for left, right in list(zip(terms[:5], terms[1:6]))[:5]:
        queries.extend([
            f"哪些资料同时包含{left}与{right}的可核验信息？",
            f"如何用公开证据交叉核对{left}和{right}？",
        ])
    queries.extend([
        f"请找出包含{area}、生产上线和故障风险的资料。",
        f"{first}相关项目需要哪些评测和观测证据？",
        f"候选人的{second}经历应如何追问职责边界？",
        f"哪些公开片段可以对照简历中的{first}描述？",
        f"如果简历只写了{first}，还需要补问哪些{second}信息？",
        f"这份{type_name}资料是否提到了量化结果和失败回放？",
        f"检索与{first}和{second}有关的团队、专利或论文。",
        f"哪些资料能说明{area}的业务影响和适用边界？",
    ])
    return list(dict.fromkeys(queries))


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=root / "training_data")
    args = parser.parse_args()
    corpus = read_jsonl(args.data_dir / "corpus.jsonl")
    rng = random.Random(20261115)
    rows = []
    seen = set()
    for document in corpus:
        for query in build_queries(document, rng):
            key = (query, document["id"])
            if key in seen:
                continue
            seen.add(key)
            rows.append({
                "query": query,
                "positive_id": document["id"],
                "positive_ids": [document["id"]],
                "split": document["split"],
                "entity_id": document["entity_id"],
                "doc_type": document["doc_type"],
                "contains_entity_name": document["entity_name"] in query,
            })

    train_rows = [row for row in rows if row["split"] == "train"]
    val_rows = [row for row in rows if row["split"] == "validation"]
    test_rows = [row for row in rows if row["split"] == "test"]
    write_jsonl(args.data_dir / "query_positive.jsonl", rows)
    write_jsonl(args.data_dir / "train_query_positive.jsonl", train_rows)
    write_jsonl(args.data_dir / "val_query_positive.jsonl", val_rows)
    write_jsonl(args.data_dir / "test_query_positive.jsonl", test_rows)

    group_rows = []
    topic_groups = [
        ("哪些公开资料同时涉及 RAG、Agent 和混合检索？", ["RAG", "Agent"]),
        ("哪些资料描述多租户权限隔离和引用溯源？", ["权限", "租户", "溯源"]),
        ("哪些案例包含生产上线、延迟或业务指标？", ["上线", "延迟", "指标"]),
        ("哪些资料包含论文或专利等研究成果？", ["论文", "专利"]),
        ("哪些岗位标准强调评测、可观测性和失败回放？", ["评测", "可观测", "回放"]),
        ("哪些资料可用于核验候选人真实项目职责？", ["职责", "项目", "上线"]),
        ("哪些技术资料描述向量召回、重排和混合检索？", ["向量", "重排", "混合检索"]),
        ("哪些资料说明模型灰度发布、量化和推理调度？", ["灰度", "量化", "推理"]),
        ("哪些资料包含生产故障、回滚和版本校验？", ["故障", "回滚", "版本"]),
        ("哪些评价表要求追问个人贡献和团队边界？", ["个人", "团队", "边界"]),
        ("哪些规范禁止使用年龄、性别、婚育等保护信息？", ["年龄", "性别", "婚育"]),
        ("哪些资料解释论文和专利在招聘中的使用边界？", ["论文", "专利", "辅助"]),
        ("哪些项目涉及合同归档、字段提取和人工复核？", ["合同", "OCR", "复核"]),
        ("哪些岗位需要 Python、API 和分布式服务基础？", ["Python", "API", "分布式"]),
        ("哪些资料强调可观测性、引用追溯和权限过滤？", ["可观测", "追溯", "权限"]),
        ("哪些案例包含企业客户、数据隔离和租户配额？", ["客户", "隔离", "租户"]),
        ("哪些资料说明知识索引更新后要同步删除旧向量？", ["索引", "删除", "向量"]),
    ]
    train_docs = [doc for doc in corpus if doc["split"] == "train"]
    for query, terms in topic_groups:
        ids = [
            doc["id"] for doc in train_docs
            if any(term in f"{doc['title']} {doc['text']}" for term in terms)
        ][:40]
        if len(ids) >= 2:
            group_rows.append({"query": query, "positive_ids": ids, "split": "train"})
    grouped = defaultdict(list)
    for document in train_docs:
        grouped[document["doc_type"]].append(document["id"])
    for doc_type, ids in grouped.items():
        type_name = TYPE_NAMES.get(doc_type, doc_type)
        group_rows.append({
            "query": f"请检索所有与{type_name}相关的企业公开资料。",
            "positive_ids": ids[:40],
            "split": "train",
        })
    write_jsonl(args.data_dir / "multi_positive_groups.jsonl", group_rows)

    stats = {
        "documents": len(corpus),
        "queries_total": len(rows),
        "train_queries": len(train_rows),
        "validation_queries": len(val_rows),
        "test_queries": len(test_rows),
        "entity_name_queries": sum(row["contains_entity_name"] for row in rows),
        "entity_name_ratio": sum(row["contains_entity_name"] for row in rows) / len(rows),
        "multi_positive_groups": len(group_rows),
    }
    (args.data_dir / "expanded_query_stats.json").write_text(
        json.dumps(stats, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
