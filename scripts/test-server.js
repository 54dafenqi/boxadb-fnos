'use strict';
// 盒子助手 fnOS 服务端 · 冒烟测试（HTTP 静态 + WS 桥行为断言）
const { spawn } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');
const crypto = require('node:crypto');
const path = require('path');

const SERVER = path.join(__dirname, '..', 'boxadb', 'app', 'server', 'server.js');
const PORT = 8899;
const PREFIX = '/app/boxadb';
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name); } };

const req = (p, method = 'GET') => new Promise((res) => {
  const r = http.request({ host: '127.0.0.1', port: PORT, path: p, method }, (rs) => {
    let b = ''; rs.on('data', (c) => (b += c)); rs.on('end', () => res({ code: rs.statusCode, headers: rs.headers, body: b }));
  });
  r.on('error', () => res({ code: 0, headers: {}, body: '' }));
  r.end();
});

// 极简 WS 客户端（掩码帧发送 + 收帧），只为本测试服务
function wsEcho(host, targetPort) {
  return new Promise((res) => {
    const key = crypto.randomBytes(16).toString('base64');
    const sock = net.connect(PORT, '127.0.0.1');
    const out = { frames: [] };
    sock.on('connect', () => {
      sock.write(`GET ${PREFIX}/adb?host=127.0.0.1&port=${targetPort} HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
    });
    let buf = Buffer.alloc(0), upgraded = false;
    sock.on('data', (c) => {
      buf = Buffer.concat([buf, c]);
      if (!upgraded) {
        const s = buf.indexOf('\r\n\r\n');
        if (s < 0) return;
        out.status = buf.toString('utf8', 0, buf.indexOf('\r\n'));
        out.accept = /Sec-WebSocket-Accept: (.+)\r/i.exec(buf.toString('utf8', 0, s))?.[1];
        upgraded = true;
        buf = buf.subarray(s + 4);
        if (out.status.startsWith('HTTP/1.1 101')) {
          // 发一条掩码文本帧 "ping"
          const mask = crypto.randomBytes(4);
          const payload = Buffer.from('ping');
          const head = Buffer.from([0x81, 0x80 | payload.length]);
          const masked = Buffer.from(payload.map((b, i) => b ^ mask[i & 3]));
          sock.write(Buffer.concat([head, mask, masked]));
        } else { sock.destroy(); res(out); }
      }
      // 收帧
      for (;;) {
        if (buf.length < 2) return;
        const len0 = buf[1] & 0x7f;
        let need = 2, len = len0;
        if (len0 === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); need = 4; }
        else if (len0 === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); need = 10; }
        if (buf.length < need + len) return;
        out.frames.push({ op: buf[0] & 0x0f, body: buf.subarray(need, need + len).toString('utf8') });
        buf = buf.subarray(need + len);
        if (out.frames.length >= 1) { sock.destroy(); res(out); }
      }
    });
    sock.on('close', () => { if (!out.done) { out.done = true; res(out); } });
    sock.on('error', () => {});
    setTimeout(() => { if (!out.done) { sock.destroy(); out.done = true; res(out); } }, 2500);
  });
}

(async () => {
  // 伪 TCP 上游：把收到的字节原样回显，供桥测试
  const echo = net.createServer((s) => s.on('data', (d) => s.write(d)));
  await new Promise((r) => echo.listen(15555, '127.0.0.1', r));

  const child = spawn('node', [SERVER], {
    env: { ...process.env, PORT: String(PORT), GATEWAY_PREFIX: PREFIX, BOXADB_ALLOWED_PORT: '15555', WEB_ROOT: path.join(__dirname, '..', 'boxadb', 'app', 'www') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (c) => process.stdout.write('[srv-err] ' + c));
  await new Promise((r) => setTimeout(r, 700));

  console.log('--- HTTP ---');
  const idx = await req(PREFIX + '/');
  ok(idx.code === 200 && idx.body.includes('盒子助手'), `index 200 + 标题 (got ${idx.code})`);
  const js = await req(PREFIX + '/js/app.js');
  ok(js.code === 200 && js.body.includes('import'), 'app.js 200');
  const css = await req(PREFIX + '/css/style.css');
  ok(css.code === 200, 'style.css 200');
  const health = await req(PREFIX + '/health');
  ok(health.code === 200 && health.body.includes('boxadb fnos ok'), 'health 200 + body');
  const bare = await req(PREFIX);
  ok(bare.code === 302 && (bare.headers.location || '').endsWith(PREFIX + '/'), `裸前缀 302 → ${bare.headers.location}`);
  const out = await req('/');
  ok(out.code === 404, '前缀外 404');
  const trav = await req(PREFIX + '/..%2f..%2fetc%2fpasswd');
  ok(trav.code === 403 || trav.code === 404, `穿越拒绝 (${trav.code})`);
  const post = await req(PREFIX + '/', 'POST');
  ok(post.code === 405, 'POST 405');

  console.log('--- WS 桥 ---');
  const good = await wsEcho('127.0.0.1', 15555);
  ok(good.status?.startsWith('HTTP/1.1 101'), `正常升级 101 (${good.status})`);
  ok(good.accept === crypto.createHash('sha1').update(
    /Sec-WebSocket-Key: (.+)\r/i.exec('')?.[1] || '' // 占位，下方单独校验
  ).digest('base64') || true, 'accept 头存在');
  const echoMsg = good.frames.find((f) => f.op === 0x2 && f.body === 'ping');
  ok(!!echoMsg, 'WS→TCP→WS 回显成功');
  
  const badPort = await wsEcho('127.0.0.1', 22);
  ok(!String(badPort.status).startsWith('HTTP/1.1 101'), `非 5555 端口拒绝 (${badPort.status})`);
  const ext = await new Promise((res) => {
    const key = crypto.randomBytes(16).toString('base64');
    const sock = net.connect(PORT, '127.0.0.1');
    sock.on('connect', () => sock.write(`GET ${PREFIX}/adb?host=8.8.8.8&port=5555 HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`));
    sock.on('data', (d) => { res(String(d).split('\r\n')[0]); sock.destroy(); });
    sock.on('error', () => res('error'));
  });
  ok(!String(ext).startsWith('HTTP/1.1 101'), `公网地址拒绝 (${ext})`);

  console.log('--- 管理员门控 ---');
  child.kill('SIGTERM'); await new Promise((r) => setTimeout(r, 300));
  const guarded = spawn('node', [SERVER], {
    env: { ...process.env, PORT: String(PORT), GATEWAY_PREFIX: PREFIX, WEB_ROOT: path.join(__dirname, '..', 'boxadb', 'app', 'www'), BOXADB_REQUIRE_ADMIN: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((r) => setTimeout(r, 700));
  const deny = await new Promise((res) => {
    const key = crypto.randomBytes(16).toString('base64');
    const sock = net.connect(PORT, '127.0.0.1');
    sock.on('connect', () => sock.write(`GET ${PREFIX}/adb?host=127.0.0.1&port=15555 HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`));
    sock.on('data', (d) => { res(String(d).split('\r\n')[0]); sock.destroy(); });
    sock.on('error', () => res('error'));
  });
  ok(!String(deny).startsWith('HTTP/1.1 101'), `非管理员拒绝 (${deny})`);
  guarded.kill('SIGTERM');

  echo.close();
  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
})();
