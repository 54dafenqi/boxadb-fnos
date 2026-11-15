// 飞牛版专属：安装区新增「从 NAS 选择」按钮 —— 点开小菜单：选择文件 / 选择文件夹。
// 用 fnOS 官方 JS SDK 的 pickUserFile 弹原生文件管理选择器 → 拿到已授权路径
// → 通过同源 /app/boxadb/nasfile 让后端(校验用户 ACL 后)读回字节 → 造 File → 复用现有安装队列。
// 本文件只在飞牛网关环境被动态加载（桌面/GitHub Pages 不会 import 它）。
import { TrimApp } from './trim-web-app.js';

const PREFIX = new URL('../', import.meta.url).href;   // → /app/boxadb/
const ACCEPT = ['.apk', '.xapk', '.apkm'];

const api = () => window.__boxadb || null;
const basename = (p) => { const i = p.lastIndexOf('/'); return i >= 0 ? p.slice(i + 1) : p; };

let sdkRef = null;
function sdk() { if (!sdkRef) sdkRef = new TrimApp(); return sdkRef; }

// ─── 通道断开检测 + 自动刷新重试 ───
let reloading = false;
function handleStale(err) {
  if (reloading) return;
  reloading = true;
  const A = api();
  const msg = (err && err.message) || String(err || '');
  // 如果是很明确的业务拒绝(权限不足等)，不刷新
  if (/403|denied|not authorized/i.test(msg) && !/timeout|network|Failed to fetch|abort/i.test(msg)) {
    if (A) A.toast('操作被拒绝：' + msg, 'err', 4200);
    reloading = false;
    return;
  }
  // 超时/网络/通道断 → 提示并自动刷新
  if (A) A.toast('与飞牛的通道可能已断开，页面即将自动刷新重试…', 'warn', 2000);
  setTimeout(() => location.reload(), 1800);
}

// 判断是否为网络/连接层错误（fetch 在 DNS/断连/通道不可用时抛 TypeError）
function isNetworkError(e) {
  if (!e) return false;
  if (e instanceof TypeError) return true; // Failed to fetch
  const m = (e.message || '').toLowerCase();
  return /network|timeout|abort|failed to fetch|connection/i.test(m);
}

// 把一组 NAS 路径逐个取回字节、造 File、加入安装队列
async function enqueuePaths(paths, btn) {
  const A = api();
  if (!paths || !paths.length) return;
  if (btn) { btn.disabled = true; }
  let lastLabel = btn && btn.dataset.label;
  const files = [];
  for (let i = 0; i < paths.length; i++) {
    if (btn) btn.textContent = `读取中 ${i + 1}/${paths.length}…`;
    try {
      const r = await fetch(PREFIX + 'nasfile?path=' + encodeURIComponent(paths[i]));
      if (!r.ok) { A.toast('读取失败：' + basename(paths[i]) + '（HTTP ' + r.status + '）', 'err', 4200); continue; }
      const blob = await r.blob();
      files.push(new File([blob], basename(paths[i]), { type: 'application/vnd.android.package-archive' }));
    } catch (e) {
      // 单个文件 fetch 网络层挂掉 → 整个通道大概率断了，交给 handleStale
      if (isNetworkError(e)) { if (btn) { btn.disabled = false; if (lastLabel) btn.textContent = lastLabel; } handleStale(e); return; }
      A.toast('读取失败：' + basename(paths[i]) + '（' + ((e && e.message) || e) + '）', 'err', 4200);
    }
  }
  if (btn) { btn.disabled = false; if (lastLabel) btn.textContent = lastLabel; }
  if (files.length) { A.addFiles(files); A.toast('已加入 ' + files.length + ' 个安装包'); }
}

async function pickFiles(btn) {
  const A = api();
  const s = sdk();
  if (s.isStandaloneWeb) { A.toast('请在飞牛桌面里打开「盒子助手」后再从 NAS 选择', 'warn', 5000); return; }
  let res;
  try {
    res = await s.pickUserFile({ directory: false, multiple: true, accept: ACCEPT, title: '选择安装包', sidebarGroup: ['myFiles', 'otherShare', 'favorites'] });
  } catch (e) { handleStale(e); return; }
  await enqueuePaths((res && res.data) || [], btn);
}

async function pickFolder(btn) {
  const A = api();
  const s = sdk();
  if (s.isStandaloneWeb) { A.toast('请在飞牛桌面里打开「盒子助手」后再从 NAS 选择', 'warn', 5000); return; }
  let res;
  try {
    res = await s.pickUserFile({ directory: true, title: '选择安装包所在文件夹', sidebarGroup: ['myFiles', 'otherShare', 'favorites'] });
  } catch (e) { handleStale(e); return; }
  const dirs = (res && res.data) || [];
  if (!dirs.length) return;
  if (btn) btn.disabled = true;
  const all = [];
  for (const dir of dirs) {
    try {
      const r = await fetch(PREFIX + 'naslist?path=' + encodeURIComponent(dir));
      if (!r.ok) { A.toast('列目录失败：' + basename(dir) + '（HTTP ' + r.status + '）', 'err', 4200); continue; }
      const j = await r.json();
      for (const f of (j.files || [])) all.push(f.path);
    } catch (e) {
      if (isNetworkError(e)) { if (btn) btn.disabled = false; handleStale(e); return; }
      A.toast('列目录失败：' + ((e && e.message) || e), 'err', 4200);
    }
  }
  if (btn) btn.disabled = false;
  if (!all.length) { A.toast('该文件夹里没有 apk/xapk/apkm', 'warn'); return; }
  await enqueuePaths(all, btn);
}

// 小菜单
function openMenu(anchor, items) {
  closeMenu();
  const menu = document.createElement('div');
  menu.className = 'nas-menu';
  menu.style.cssText = 'position:absolute;z-index:60;background:#11161c;border:1px solid #263140;border-radius:10px;padding:6px;min-width:150px;box-shadow:0 8px 24px rgba(0,0,0,.45)';
  const rect = anchor.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.left = rect.left + 'px';
  menu.style.top = (rect.bottom + 6) + 'px';
  items.forEach((it) => {
    const b = document.createElement('button');
    b.textContent = it.label;
    b.style.cssText = 'display:block;width:100%;text-align:left;padding:8px 12px;border:0;background:none;color:#c9f7d8;font-size:14px;border-radius:8px;cursor:pointer';
    b.onmouseenter = () => { b.style.background = '#1b2531'; };
    b.onmouseleave = () => { b.style.background = 'none'; };
    b.onclick = (e) => { e.stopPropagation(); closeMenu(); it.onClick(); };
    menu.appendChild(b);
  });
  document.body.appendChild(menu);
  const onDoc = (e) => { if (!menu.contains(e.target)) closeMenu(); };
  setTimeout(() => document.addEventListener('click', onDoc), 0);
  menu._onDoc = onDoc;
}
function closeMenu() {
  const m = document.querySelector('.nas-menu');
  if (m) { if (m._onDoc) document.removeEventListener('click', m._onDoc); m.remove(); }
}

function init() {
  const dz = document.getElementById('dropzone');
  if (!dz) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn nas-pick-btn';
  btn.style.marginLeft = '8px';
  btn.dataset.label = '从 NAS 选择';
  btn.textContent = '从 NAS 选择';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (btn.disabled) return;
    openMenu(btn, [
      { label: '📄 选择文件', onClick: () => pickFiles(btn).catch(handleStale) },
      { label: '📁 选择文件夹', onClick: () => pickFolder(btn).catch(handleStale) },
    ]);
  });
  const anchor = document.getElementById('pick-files') || dz;
  anchor.insertAdjacentElement('afterend', btn);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
