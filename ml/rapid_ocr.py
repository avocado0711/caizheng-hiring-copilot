"""Run local RapidOCR inference and return line text with coordinates."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from rapidocr_onnxruntime import RapidOCR


def box_bounds(box: list[list[float]]) -> tuple[float, float, float, float]:
    xs = [float(point[0]) for point in box]
    ys = [float(point[1]) for point in box]
    return min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)


def recognize(engine: RapidOCR, image) -> list[dict]:
    result, _ = engine(image)
    lines = []
    for item in result or []:
        if len(item) < 3:
            continue
        box, text, confidence = item[0], str(item[1]).strip(), float(item[2])
        if not text:
            continue
        x, y, width, height = box_bounds(box)
        lines.append({
            "text": text,
            "x": round(x, 1),
            "y": round(y, 1),
            "width": round(width, 1),
            "height": round(height, 1),
            "confidence": round(confidence, 4),
        })
    return lines


def line_key(text: str) -> str:
    return re.sub(r"[^0-9a-z\u3400-\u9fff]+", "", text.lower())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("image", type=Path)
    args = parser.parse_args()

    engine = RapidOCR()
    lines = recognize(engine, str(args.image))
    passes = ["full"]

    lines.sort(key=lambda line: (round(line["y"] / 12), line["x"]))
    unique_lines = []
    seen = set()
    for line in lines:
        key = line_key(line["text"])
        if not key or key in seen:
            continue
        seen.add(key)
        unique_lines.append(line)
    confidences = [line["confidence"] for line in unique_lines]
    print(json.dumps({
        "engine": "rapidocr",
        "language": "zh-Hans",
        "text": "\n".join(line["text"] for line in unique_lines),
        "lineCount": len(unique_lines),
        "meanConfidence": round(sum(confidences) / len(confidences), 4) if confidences else 0,
        "passes": passes,
        "lines": unique_lines,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
