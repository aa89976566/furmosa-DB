#!/usr/bin/env python3
"""把 2×2 漫畫原圖等比縮放進 LINE Rich Menu 尺寸，不裁切內容。

- 來源：public/line/comic-menu-2x2-source.png（或參數指定）
- 輸出：public/line/rich-menu-comic-2x2.jpg（2500×1686）
- 方法：contain + 白邊 letterbox（不改動畫作像素內容）
- 同步寫入 .meta.json，供 deploy 腳本對齊熱區
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SRC = ROOT / "public/line/comic-menu-2x2-source.png"
OUT_JPG = ROOT / "public/line/rich-menu-comic-2x2.jpg"
OUT_PNG = ROOT / "public/line/rich-menu-comic-2x2.png"
OUT_META = ROOT / "public/line/rich-menu-comic-2x2.meta.json"

CANVAS_W, CANVAS_H = 2500, 1686
MAX_JPG_BYTES = 950_000


def prepare(src: Path) -> dict:
    if not src.exists():
        raise SystemExit(f"找不到來源圖：{src}")

    original = Image.open(src).convert("RGB")
    sw, sh = original.size
    scale = min(CANVAS_W / sw, CANVAS_H / sh)
    nw = int(round(sw * scale))
    nh = int(round(sh * scale))
    resized = original.resize((nw, nh), Image.Resampling.LANCZOS)

    canvas = Image.new("RGB", (CANVAS_W, CANVAS_H), (255, 255, 255))
    ox = (CANVAS_W - nw) // 2
    oy = (CANVAS_H - nh) // 2
    canvas.paste(resized, (ox, oy))

    OUT_JPG.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT_PNG)
    quality_used = 90
    for q in (90, 85, 80, 75, 70):
        canvas.save(OUT_JPG, "JPEG", quality=q, optimize=True)
        quality_used = q
        if OUT_JPG.stat().st_size <= MAX_JPG_BYTES:
            break

    meta = {
        "source": str(src.relative_to(ROOT)) if src.is_relative_to(ROOT) else str(src),
        "canvas": {"width": CANVAS_W, "height": CANVAS_H},
        "content": {"x": ox, "y": oy, "width": nw, "height": nh},
        "method": "contain-letterbox-white",
        "jpegQuality": quality_used,
        "jpegBytes": OUT_JPG.stat().st_size,
        "note": "Artwork unchanged; only scaled and padded. Tap areas use content box (+ side gutters).",
    }
    OUT_META.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n")
    return meta


if __name__ == "__main__":
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    meta = prepare(src)
    print(json.dumps(meta, ensure_ascii=False, indent=2))
    print(f"wrote {OUT_JPG}")
