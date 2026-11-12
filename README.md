boxadb-fnos（盒子助手 · 飞牛 fnOS 版）

飞牛 Native 应用：**点飞牛桌面图标 → 打开的就是盒子助手网页**（经统一网关 `/app/boxadb`，
与 NAS 登录态同源），关掉网页即断开到盒子的连接（每条 WS = 一条到盒子的 TCP，会话级）。

## 目录
- `boxadb/` 飞牛应用包目录（在 fnOS 上 `fnpack build --directory boxadb` 生成 `boxadb.fpk`）
  - `manifest`：`install_dep_apps=nodejs_v24`（应用中心会引导安装 Node 运行时）、`ctl_stop=true`
  - `config/privilege`：`run-as=package`（专用应用用户，非 root）
  - `cmd/main`：start/stop/status（Node 路径自适应 nodejs_v24/v22）
  - `app/server/server.js`：服务端（Unix socket + 静态页 + WS↔TCP 桥 + 管理员限定 + SSRF 白名单）
  - `app/ui/config`：桌面入口（gatewayPrefix=/app/boxadb, gatewaySocket=app.sock, iframe）
  - `app/www/`：盒子助手前端（`scripts/sync-ui.sh` 从桌面版 boxadb 同步，并打同源 WS 补丁）
- `scripts/sync-ui.sh`：同步前端 + 同源补丁

## 在 fnOS 上构建 / 安装
```bash
fnpack build --directory boxadb        # 生成 boxadb.fpk
appcenter-cli install-fpk boxadb.fpk   # 或应用中心 → 手动安装
```
说明：
- 桥目标限「私网 IPv4 + 端口 5555」且仅管理员可用（网关 `X-Trim-Isadmin`）。
- 桥随网页会话存在：页面全关 → 到盒子的 TCP 立即断；`ctl_stop=true` 可在应用中心停止整个应用。
- 前端改动后：在桌面版 boxadb 改 → 跑 `scripts/sync-ui.sh` → NAS 上重新 `fnpack build`。
