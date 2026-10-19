import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Server } from 'socket.io';

const dist = fileURLToPath(new URL('./dist/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

export function createCourseApp({ apiUrl = process.env.MEDIAMTX_API_URL || 'http://127.0.0.1:9997', hlsUrl = process.env.MEDIAMTX_HLS_URL || 'http://127.0.0.1:8888', pollMs = 2000 } = {}) {
  // shortcut: room state lives in one process; use shared storage before running multiple replicas.
  const history = [];
  let likes = 0;
  let status = { live: false, available: false };
  let polling;
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' ws: wss:; media-src 'self' blob:; worker-src 'self' blob:; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'");
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET' && req.method !== 'HEAD') return res.writeHead(405).end();
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/status' || url.pathname === '/health') {
        return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ...snapshot(), status: 'ok' }));
      }
      if (url.pathname.startsWith('/hls/')) {
        // Only the one course room is proxied; never accept a client-supplied upstream URL.
        if (!/^\/hls\/live\/[a-zA-Z0-9_.-]+$/.test(url.pathname)) return res.writeHead(404).end();
        const controller = new AbortController();
        const abort = () => controller.abort();
        res.on('close', abort);
        try {
          const upstream = await fetch(`${hlsUrl}/${url.pathname.slice(5)}${url.search}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) });
          res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream' });
          if (req.method === 'HEAD' || !upstream.body) res.end();
          else await pipeline(Readable.fromWeb(upstream.body), res);
        } finally { res.off('close', abort); }
        return;
      }
      const file = resolve(dist, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (!file.startsWith(resolve(dist) + sep)) return res.writeHead(404).end();
      let body;
      try { body = await readFile(file); }
      catch { return res.writeHead(404).end('Not found. Run npm run build first.'); }
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      if (!res.headersSent) res.writeHead(502).end('Streaming service unavailable');
      else res.destroy();
    }
  });
  const io = new Server(server, {
    maxHttpBufferSize: 4096,
    allowRequest(req, done) {
      let allowed = !req.headers.origin;
      try { allowed ||= new URL(req.headers.origin).host === req.headers.host; } catch { /* Missing or invalid origin stays rejected. */ }
      done(null, allowed && io.engine.clientsCount < 100);
    },
  });
  function snapshot() { return { ...status, viewers: io.of('/').sockets.size, likes }; }
  function broadcast() { io.emit('state', snapshot()); }
  function poll() {
    if (polling) return polling;
    polling = (async () => {
    try {
      const response = await fetch(`${apiUrl}/v3/paths/get/live`, { signal: AbortSignal.timeout(3000) });
      if (response.status === 404) status = { live: false, available: true };
      else {
        if (!response.ok) throw new Error('Media API unavailable');
        const path = await response.json();
        status = { live: path.ready === true, available: true };
      }
    } catch { status = { live: false, available: false }; }
    finally { polling = undefined; broadcast(); }
    })();
    return polling;
  }
  const timer = setInterval(poll, pollMs);
  timer.unref();
  void poll();
  io.on('connection', (socket) => {
    let nickname = '';
    let messageAt = 0;
    let likeAt = 0;
    const acknowledge = (ack, value) => { if (typeof ack === 'function') ack(value); };
    socket.emit('history', history);
    broadcast();
    socket.on('nickname', (value, ack) => {
      const clean = typeof value === 'string' ? value.trim() : '';
      if (!clean || clean.length > 24 || /[\p{Cc}\p{Cf}]/u.test(clean)) return acknowledge(ack, { error: '暱稱需為 1–24 個字，不能包含控制字元。' });
      nickname = clean;
      acknowledge(ack, { nickname });
    });
    socket.on('chat', (value, ack) => {
      if (!nickname) return acknowledge(ack, { error: '請先設定暱稱。' });
      if (typeof value !== 'string' || !value.trim() || value.length > 500 || /[\p{Cc}\p{Cf}]/u.test(value)) return acknowledge(ack, { error: '訊息需為 1–500 個字，不能包含控制字元。' });
      if (Date.now() - messageAt < 1000) return acknowledge(ack, { error: '訊息傳送太快，請稍候一秒。' });
      messageAt = Date.now();
      const message = { id: randomUUID(), nickname, text: value.trim(), at: new Date().toISOString() };
      history.push(message);
      if (history.length > 100) history.shift();
      io.emit('chat', message);
      acknowledge(ack, { ok: true });
    });
    socket.on('like', (ack) => {
      if (Date.now() - likeAt < 500) return acknowledge(ack, { error: '請稍候再按讚。' });
      likeAt = Date.now();
      likes++;
      io.emit('like', { likes });
      acknowledge(ack, { ok: true });
    });
    socket.on('disconnect', broadcast);
  });
  return { server, io, poll, close: async () => { clearInterval(timer); await new Promise((done) => io.close(done)); } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createCourseApp();
  const port = Number(process.env.PORT || 4180);
  app.server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Group 9 Cloud Live: http://127.0.0.1:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void app.close(); });
}
