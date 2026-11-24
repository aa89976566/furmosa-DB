#!/usr/bin/env python3
"""將核准的 Rich Menu 示意圖輸出成 LINE 規格 2500×1686。"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SRC = ROOT / "public/line/rich-menu-shop-refill-source.png"
OUT_JPG = ROOT / "public/line/rich-menu-shop-refill.jpg"
OUT_PNG = ROOT / "public/line/rich-menu-shop-refill.png"
OUT_META = ROOT / "public/line/rich-menu-shop-refill.meta.json"
CANVAS = (2500, 1686)
MAX_JPG_BYTES = 950_000


def prepare(source: Path) -> dict:
    if not source.exists():
        raise SystemExit(f"找不到來源圖：{source}")
    image = Image.open(source).convert("RGB")
    scale = max(CANVAS[0] / image.width, CANVAS[1] / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - CANVAS[0]) // 2
    top = (resized.height - CANVAS[1]) // 2
    canvas = resized.crop((left, top, left + CANVAS[0], top + CANVAS[1]))

    OUT_JPG.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT_PNG, optimize=True)
    quality = 90
    for candidate in (90, 85, 80, 75, 70, 65):
        canvas.save(OUT_JPG, "JPEG", quality=candidate, optimize=True, progressive=True)
        quality = candidate
        if OUT_JPG.stat().st_size <= MAX_JPG_BYTES:
            break

    meta = {
        "source": str(source.relative_to(ROOT)) if source.is_relative_to(ROOT) else str(source),
        "canvas": {"width": CANVAS[0], "height": CANVAS[1]},
        "method": "cover-center-crop",
        "jpegQuality": quality,
        "jpegBytes": OUT_JPG.stat().st_size,
    }
    OUT_META.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n")
    return meta


if __name__ == "__main__":
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    print(json.dumps(prepare(source), ensure_ascii=False, indent=2))
