#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/../boxadb"
PKG="$ROOT/boxadb"
DST="$PKG/app/www"
mkdir -p "$DST"

# 同步前端（rsync --delete：以桌面版为准；剔除 NAS 包不需要的桌面专属/开发文件）
rsync -a --delete --delete-excluded \
  --exclude 'AppIcon.icns' --exclude 'AppIcon.ico' \
  --exclude 'AppIcon.png'  --exclude '*.swift' \
  "$SRC/index.html" "$SRC/css" "$SRC/js" "$SRC/assets" "$DST/"

# 给 tango.js 打同源补丁（独立 python 脚本：跨行匹配 + 失败即报错）
python3 "$ROOT/scripts/patch-tango-nas.py" "$DST/js/tango.js"

# 给 app.js 注入飞牛专属钩子（桌面源码保持干净，只在 www 副本里加）
python3 "$ROOT/scripts/patch-app-fnos.py" "$DST/js/app.js"

# 应用飞牛专属 overlay（fnos 选择器模块 + 官方 SDK）。放在 www/fnos，rsync 只同步 index/css/js/assets，不碰此目录。
if [ -d "$ROOT/fnos-overlay/fnos" ]; then
  rm -rf "$DST/fnos"
  cp -R "$ROOT/fnos-overlay/fnos" "$DST/fnos"
fi

echo "UI 同步完成 → $DST"
