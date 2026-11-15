#!/usr/bin/env python3
# 飞牛构建期补丁：给同步进来的 www/js/app.js 注入「从 NAS 选择」钩子。
# 目的：飞牛专属代码不进 boxadb 桌面仓，只在飞牛包的 www 副本里生效。幂等 + 失败即报错。
import sys, io, re

path = sys.argv[1]
src = io.open(path, encoding='utf-8').read()

if 'fnos/nas-pick.js' in src:
    print('app.js 已含飞牛钩子，跳过')
    sys.exit(0)

# 锚点：boot() 里的 renderStatus();\n  if (location.search.includes('demo=1')) seedDemo();
anchor = "  renderStatus();\n  if (location.search.includes('demo=1')) seedDemo();"
inject = (
    "  renderStatus();\n"
    "  // ── 飞牛版钩子（由 patch-app-fnos.py 在构建期注入，桌面源码不含此段）──\n"
    "  window.__boxadb = { addFiles, toast };\n"
    "  import('../fnos/nas-pick.js').catch(() => {});\n"
    "  if (location.search.includes('demo=1')) seedDemo();"
)
if anchor not in src:
    sys.stderr.write('ERROR: app.js boot 锚点未找到，注入失败\n')
    sys.exit(2)

out = src.replace(anchor, inject, 1)
if 'fnos/nas-pick.js' not in out:
    sys.stderr.write('ERROR: 注入后校验失败\n')
    sys.exit(3)
io.open(path, 'w', encoding='utf-8').write(out)
print('app.js 已注入飞牛钩子')
