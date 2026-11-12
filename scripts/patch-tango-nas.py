#!/usr/bin/env python3
"""把桌面版 tango.js 补丁成飞牛版（页面与桥同源）：
1) BRIDGE_BASE 固定地址 → 统一网关同源 WS（/app/boxadb）
2) wsUrl 拼接（桌面版跨两行写法）→ 模板字符串
3) 顺手剔除 www/assets 里桌面专属的大文件（icns/ico/母图/图标源码）
任一替换失败即报错退出，避免静默产出坏包。
"""
import os
import re
import sys

p = sys.argv[1]
s = open(p, encoding='utf-8').read()

# 1) 固定桥地址 → 同源网关
repl1 = (
    "// 飞牛版：页面与桥同源（统一网关 /app/boxadb），WS 直接用当前域名，无固定地址\n"
    "const GATEWAY_PREFIX = '/app/boxadb';\n"
    "const BRIDGE_WS_BASE = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${GATEWAY_PREFIX}`;"
)
s = re.sub(r"export const BRIDGE_BASE = 'http://127\.0\.0\.1:8765';[^\n]*",
           lambda m: repl1, s)

# 2) wsUrl 拼接（跨两行：+ 后换行再接反引号）
s, n = re.subn(r"BRIDGE_BASE\.replace\(/\^http/,\s*'ws'\)\s*\+\s*\n?\s*`",
               lambda m: "`${BRIDGE_WS_BASE}", s)

if 'BRIDGE_BASE' in s:
    raise SystemExit('补丁失败：tango.js 仍引用 BRIDGE_BASE（规则未命中）\n'
                     + '\n'.join(l for l in s.splitlines() if 'BRIDGE_BASE' in l))
if n == 0:
    raise SystemExit('补丁失败：未找到 wsUrl 拼接点')

open(p, 'w', encoding='utf-8').write(s)
print(f'tango.js 已补丁（同源 WS，wsUrl 替换 {n} 处）')

# 3) 剔除 www/assets 里桌面专属文件
for f in ('AppIcon.icns', 'AppIcon.ico', 'AppIcon.png', 'make_icon.swift'):
    q = os.path.join(os.path.dirname(p), '..', 'assets', f)
    if os.path.exists(q):
        os.remove(q)
        print(f'已剔除 www/assets/{f}')
