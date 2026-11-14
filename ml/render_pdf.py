"""Render PDF pages locally for the Windows OCR fallback."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import pypdfium2 as pdfium


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--dpi", type=int, default=220)
    parser.add_argument("--max-pages", type=int, default=20)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    document = pdfium.PdfDocument(str(args.input))
    page_count = len(document)
    render_count = min(page_count, max(1, args.max_pages))
    pages = []
    try:
        for index in range(render_count):
            page = document[index]
            try:
                bitmap = page.render(scale=max(1.0, args.dpi / 72))
                try:
                    image = bitmap.to_pil()
                    output_path = args.output_dir / f"page-{index + 1:03d}.png"
                    image.save(output_path, format="PNG")
                    pages.append({
                        "page": index + 1,
                        "path": str(output_path),
                        "width": image.width,
                        "height": image.height,
                    })
                finally:
                    bitmap.close()
            finally:
                page.close()
    finally:
        document.close()

    print(json.dumps({
        "pageCount": page_count,
        "renderedPages": len(pages),
        "truncated": page_count > render_count,
        "dpi": args.dpi,
        "pages": pages,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
