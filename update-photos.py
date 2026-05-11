#!/usr/bin/env python3
"""
扫描 photos/ 目录下的照片，生成 photos.json 索引文件。
每次添加/删除照片后运行一次即可。

用法：
    python3 update-photos.py

支持的文件格式：jpg, jpeg, png, webp, avif, gif
"""

import json
import os
from pathlib import Path

PHOTOS_DIR = Path(__file__).parent / "photos"
OUTPUT = PHOTOS_DIR / "photos.json"
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"}


def caption_from_filename(stem: str) -> str:
    """文件名转为标题：2026-05-11_公园散步 → 公园散步"""
    # 尝试去掉开头的日期前缀
    name = stem
    # 去掉 YYYY-MM-DD 或 YYYYMMDD 前缀
    parts = name.split("_", 1)
    if len(parts) > 1 and len(parts[0]) >= 8:
        name = parts[1]
    # 替换分隔符
    name = name.replace("-", " ").replace("_", " ")
    # 首字母大写
    return name.strip().capitalize() or stem


def main():
    if not PHOTOS_DIR.exists():
        PHOTOS_DIR.mkdir(parents=True)
        print(f"📁 已创建 {PHOTOS_DIR}，请把照片放进去再运行此脚本")
        return

    files = sorted(
        f for f in os.listdir(PHOTOS_DIR)
        if Path(f).suffix.lower() in EXTENSIONS
    )

    if not files:
        print(f"⚠️  {PHOTOS_DIR} 中没有找到照片文件")
        print(f"   支持的格式：{', '.join(EXTENSIONS)}")
        return

    index = {}
    for f in files:
        stem = Path(f).stem
        index[f] = {
            "caption": caption_from_filename(stem),
        }

    OUTPUT.write_text(
        json.dumps(index, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"✅ 已索引 {len(files)} 张照片 → {OUTPUT}")


if __name__ == "__main__":
    main()
