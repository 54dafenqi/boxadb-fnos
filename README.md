# 盒子助手 · 飞牛 fnOS 版 [![bilibili](https://img.shields.io/badge/_B站_·_反馈-A0AABC?style=flat&logo=bilibili&logoColor=fff&labelColor=FB7299&color=3a3a44)](https://www.bilibili.com/video/BV1e4sp6nETW/)

飞牛 Native 应用：**点飞牛桌面图标 → 打开的就是盒子助手网页**（经统一网关，
与 NAS 登录态同源）


## 在 fnOS 安装
```bash
appcenter-cli install-fpk boxadb.fpk   # 或应用中心 → 手动安装
```

## 自动准备 5555（可选增强）

Android 11+ 的「无线调试」使用**随机端口**，电视重启后 adbd 不再监听 5555；
而浏览器端 ADB 引擎（ya-webadb 的 `AdbDaemonTransport`）没有 pairing 客户端，
无法走无线调试的 TLS 配对，只能使用 5555 传统模式（电视上弹窗允许密钥）。

**连接流程（对能正常连上的电视零影响）**：

1. 先按原方式连接 `ip:5555`，成功即结束（**不发起任何额外请求**）；
2. **只有连接失败时**，才调用 `GET /app/boxadb/discover?host=<盒子IP>`：
   - `5555` 已在监听 → 直接返回；
   - 否则用 mDNS（`_adb-tls-connect._tcp`）读出盒子**当前**的无线调试端口，
     调用系统 `adb connect` + `adb tcpip 5555` 切回 5555；
3. 修复成功后**自动重连一次**；失败则提示原因并保留原始错误。

**可选依赖**（缺失时只有自动修复不可用，其余行为完全不变）：

- `avahi-browse`（`apt install avahi-utils`）—— mDNS 查询
- `adb`（Debian：`apt install -t bookworm-backports adb`）—— 切换端口

**安全**：该接口要求管理员头 `x-trim-isadmin: true`，目标必须是**私网 IPv4**，
只允许操作 `5555`（与桥接端口一致）；`execFile` 固定参数，不经过 shell。

## 相关项目

本项目的界面，就是下面这个桌面 / 网页版「盒子助手」的同一套前端，为飞牛 fnOS 做的原生移植——功能一致，按场景二选一：

- **[boxadb（桌面 / 网页版）](https://github.com/wukongdaily/boxadb)** —— 电脑开本地桥，浏览器直接访问 <https://wukongdaily.github.io/boxadb/>，支持 WebUSB 数据线直连。
- **boxadb-fnos（本项目 · 飞牛版）** —— 盒子助手常驻 NAS、经统一网关同源，手机在客厅也能开网页连盒子，不必在每台电脑另开桥。

## 第三方组件致谢（均为 MIT）

- **[@yume-chan/ya-webadb (Tango)](https://github.com/yume-chan/ya-webadb)** —— ADB 协议引擎（Simon Chan）
- **[xterm.js](https://xtermjs.org/)** —— 浏览器终端
- **[fflate](https://github.com/101arrowz/fflate)** —— APK/XAPK 解包

版权声明与许可全文见 [`boxadb/app/www/js/vendor/THIRD-PARTY-LICENSES.md`](boxadb/app/www/js/vendor/THIRD-PARTY-LICENSES.md)。

## 许可

[MIT](LICENSE)
