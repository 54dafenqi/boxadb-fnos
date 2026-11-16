# boxadb-fnos（盒子助手 · 飞牛 fnOS 版）

飞牛 Native 应用：**点飞牛桌面图标 → 打开的就是盒子助手网页**（经统一网关，
与 NAS 登录态同源）


## 在 fnOS 安装
```bash
appcenter-cli install-fpk boxadb.fpk   # 或应用中心 → 手动安装
```

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
