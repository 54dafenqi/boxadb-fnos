#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/../boxadb"
PKG="$ROOT/boxadb"
DST="$PKG/app/www"
mkdir -p "$DST"

# 同步前端（rsync --delete：以桌面版为准；剔除 NAS 包不需要的桌面专属文件）
rsync -a --delete \
  --exclude 'AppIcon.icns' --exclude 'AppIcon.ico' \
  --exclude 'AppIcon.png'  --exclude 'make_icon.swift' \
  "$SRC/index.html" "$SRC/css" "$SRC/js" "$SRC/assets" "$DST/"

# 给 tango.js 打同源补丁（独立 python 脚本：跨行匹配 + 失败即报错）
python3 "$ROOT/scripts/patch-tango-nas.py" "$DST/js/tango.js"

echo "UI 同步完成 → $DST"
