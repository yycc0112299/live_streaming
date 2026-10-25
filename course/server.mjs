import { createOBSControls } from './obs-controls.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Server } from 'socket.io';
import { openStore } from './store.mjs';
import { createOBSRoom } from './room.mjs';

const dist = fileURLToPath(new URL('./dist/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

export function createCourseApp({ apiUrl = process.env.MEDIAMTX_API_URL || 'http://127.0.0.1:9997', hlsUrl = process.env.MEDIAMTX_HLS_URL || 'http://127.0.0.1:8888', webrtcUrl = process.env.MEDIAMTX_WEBRTC_URL || 'http://127.0.0.1:8889', pollMs = 2000, dbPath = process.env.DB_PATH || fileURLToPath(new URL('./.runtime/live.sqlite', import.meta.url)), publicOrigin = process.env.PUBLIC_ORIGIN || '' } = {}) {
  const store = openStore(dbPath);
  let likes = 0;
  let status = { live: false, available: false, sources: { live: { live: false, available: false }, guest: { live: false, available: false } } };
  let polling;
  let authActive = 0;
  const authAttempts = new Map();
  const cookieToken = (req) => /(?:^|;\s*)group9_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
  const expectedOrigin = (req) => publicOrigin ? new URL(publicOrigin).origin : `http://${req.headers.host}`;
  const sameOrigin = (req) => { try { return !req.headers.origin || req.headers.origin === expectedOrigin(req); } catch { return false; } };
  const secureTransport = (req) => publicOrigin ? new URL(publicOrigin).protocol === 'https:' : /^localhost(?::\d+)?$|^127\.0\.0\.1(?::\d+)?$|^\[::1\](?::\d+)?$/.test(req.headers.host || '');
  const json = (res, code, value) => res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(value));
  const setCookie = (res, token) => res.setHeader('Set-Cookie', `group9_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token ? 604800 : 0}${publicOrigin.startsWith('https:') ? '; Secure' : ''}`);
  async function readJson(req) {
    let size = 0; const chunks = [];
    for await (const chunk of req) { size += chunk.length; if (size > 8192) throw new Error('請求內容過大。'); chunks.push(chunk); }
    try { const value = JSON.parse(Buffer.concat(chunks).toString()); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; }
    catch { throw new Error('JSON 格式錯誤。'); }
  }
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' ws: wss:; media-src 'self' blob:; worker-src 'self' blob:; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'");
    res.setHeader('Cache-Control', 'no-store');
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/account/')) {
        if (!sameOrigin(req) || req.headers['sec-fetch-site'] === 'cross-site') return json(res, 403, { error: '拒絕跨網站帳號操作。' });
        const action = url.pathname.slice('/api/account/'.length);
        if (req.method === 'GET' && action === 'me') return json(res, 200, { user: secureTransport(req) ? store.session(cookieToken(req)) || null : null, accountsAvailable: secureTransport(req) });
        if (req.method !== 'POST' || !['register', 'login', 'logout', 'guest'].includes(action)) return json(res, 405, { error: '不支援此操作。' });
        if (!secureTransport(req)) return json(res, 403, { error: '帳號登入需要 HTTPS；本機 localhost 可用 HTTP 測試。' });
        const token = cookieToken(req);
        if (action === 'logout') {
          store.logout(token); setCookie(res, '');
          for (const socket of io.sockets.sockets.values()) if (socket.data.token === token) socket.disconnect(true);
          return json(res, 200, { ok: true });
        }
        // Bound scrypt concurrency and attempts; forwarded IP headers are never trusted.
        const address = req.socket.remoteAddress;
        const now = Date.now();
        for (const [key, row] of authAttempts) if (row.until < now) authAttempts.delete(key);
        const attempt = authAttempts.get(address) || { n: 0, until: now + 600000 };
        attempt.n++; authAttempts.set(address, attempt);
        if (attempt.n > 120 || authActive >= 2) return json(res, 429, { error: '登入／註冊過於頻繁，請稍後再試。' });
        authActive++;
        try {
          const payload = await readJson(req);
          const existing = action === 'guest' ? store.session(token) : null;
          if (existing) return json(res, 200, { user: existing });
          const user = action === 'guest' ? store.guest() : await store[action](payload);
          store.logout(token);
          for (const socket of io.sockets.sockets.values()) if (token && socket.data.token === token) socket.disconnect(true);
          setCookie(res, store.newSession(user.id));
          return json(res, 200, { user });
        } catch (error) { return json(res, 400, { error: error.message }); }
        finally { authActive--; }
      }
      if (url.pathname.startsWith('/webrtc/')) {
        // Only viewer WHEP endpoints; never proxy WHIP publishing or arbitrary paths.
        if (!/^\/webrtc\/(?:live|guest)\/whep(?:\/[a-f0-9-]{36})?$/.test(url.pathname)) return res.writeHead(404).end();
        if (!['OPTIONS', 'POST', 'PATCH', 'DELETE'].includes(req.method)) return res.writeHead(405).end();
        if (!sameOrigin(req)) return res.writeHead(403).end();
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 65536) return res.writeHead(413).end();
          chunks.push(chunk);
        }
        const upstream = await fetch(`${webrtcUrl}${url.pathname.slice(7)}`, {
          method: req.method,
          headers: { 'Content-Type': req.headers['content-type'] || 'application/sdp', ...(req.headers['if-match'] ? { 'If-Match': req.headers['if-match'] } : {}) },
          body: size ? Buffer.concat(chunks) : undefined,
          signal: AbortSignal.timeout(15000),
          redirect: 'error',
        });
        const headers = {};
        for (const name of ['content-type', 'etag', 'accept-patch', 'link']) if (upstream.headers.has(name)) headers[name] = upstream.headers.get(name);
        const session = upstream.headers.get('location');
        if (session) {
          const path = new URL(session, `${webrtcUrl}${url.pathname.slice(7)}`).pathname;
          if (!new RegExp(`^/${url.pathname.split('/')[2]}/whep/[a-f0-9-]{36}$`).test(path)) throw new Error('Invalid WHEP session');
          headers.location = `./whep/${path.split('/').pop()}`;
        }
        res.writeHead(upstream.status, headers).end(Buffer.from(await upstream.arrayBuffer()));
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return res.writeHead(405).end();
      if (url.pathname === '/api/status' || url.pathname === '/health') {
        return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ...snapshot(), status: 'ok' }));
      }
      if (url.pathname.startsWith('/hls/')) {
        // Only the one course room is proxied; never accept a client-supplied upstream URL.
        if (!/^\/hls\/(?:live|guest)\/[a-zA-Z0-9_.-]+$/.test(url.pathname)) return res.writeHead(404).end();
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
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', ...(url.pathname.startsWith('/assets/') ? { 'Cache-Control': 'public, max-age=31536000, immutable' } : {}) });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      if (!res.headersSent) res.writeHead(502).end('Streaming service unavailable');
      else res.destroy();
    }
  });
  const io = new Server(server, {
    maxHttpBufferSize: 8192,
    allowRequest(req, done) {
      done(null, sameOrigin(req) && io.engine.clientsCount < 100);
    },
  });
  const room = createOBSRoom(io, store);
  const obsControls = createOBSControls(io, store, secureTransport);
  function snapshot() { if (store.settings().donationsEnabled) store.ensureDonationRoom(); const currentRoom = room.state(); return { ...status, viewers: [...io.of('/').sockets.values()].filter((socket) => !socket.data.obsController).length, likes, supportTotal: store.supportTotal(currentRoom.broadcastId), room: currentRoom }; }
  function broadcast() { io.emit('state', snapshot()); }
  function poll() {
    if (polling) return polling;
    polling = (async () => {
    for (const socket of io.sockets.sockets.values()) if (!socket.data.authorized()) socket.disconnect(true);
    try {
      const paths = await Promise.all(['live', 'guest'].map(async (name) => {
        try {
          const response = await fetch(`${apiUrl}/v3/paths/get/${name}`, { signal: AbortSignal.timeout(3000) });
          if (response.status === 404) return [name, { live: false, available: true }];
          if (!response.ok) throw new Error('Media API unavailable');
          return [name, { live: (await response.json()).ready === true, available: true }];
        } catch { return [name, { live: false, available: false }]; }
      }));
      const sources = Object.fromEntries(paths);
      status = { ...sources.live, sources };
    } catch { status = { live: false, available: false }; }
    finally { polling = undefined; broadcast(); }
    })();
    return polling;
  }
  const timer = setInterval(poll, pollMs);
  timer.unref();
  void poll();
  io.on('connection', (socket) => {
    if (socket.handshake.auth?.obsPair || socket.handshake.auth?.obsDevice) { obsControls.attach(socket); return; }
    socket.data.token = cookieToken(socket.request);
    socket.data.user = secureTransport(socket.request) ? store.session(socket.data.token) : null;
    socket.data.authorized = () => !socket.data.user || Boolean(store.session(socket.data.token));
    let likeAt = 0;
    const account = () => {
      const user = store.session(socket.data.token);
      if (!user || !secureTransport(socket.request)) throw new Error('請先登入。');
      socket.data.user = user; return user;
    };
    obsControls.attach(socket, account);
    function handle(event, fn) {
      socket.on(event, (...args) => {
        const ack = args.pop();
        if (typeof ack !== 'function') return;
        try { ack(fn(...args) || { ok: true }); }
        catch (error) { ack({ error: error.message }); }
      });
    }
    socket.emit('account', socket.data.user || null);
    socket.emit('history', store.history());
    const { words, ...publicSettings } = store.settings();
    socket.emit('chat:settings', publicSettings);
    room.attach(socket);
    broadcast();
    handle('nickname', (value) => {
      const user = account(); const nickname = store.rename(user.id, value);
      for (const peer of io.sockets.sockets.values()) if (peer.data.user?.id === user.id) peer.emit('account', store.user(user.id));
      return { nickname };
    });
    handle('chat', (value) => {
      const message = store.sendChat(account(), value);
      io.emit('chat', message);
    });
    handle('like', () => {
      if (Date.now() - likeAt < 500) throw new Error('請稍候再按讚。');
      likeAt = Date.now();
      likes++;
      io.emit('like', { likes });
    });
    handle('donate', (value) => {
      const user = account();
      if (store.settings().donationsEnabled) store.ensureDonationRoom();
      const active = (status.sources.live.live || status.sources.guest.live) || room.state().donationsEnabled;
      const transaction = store.donate(user, value, active ? room.state().broadcastId : null);
      for (const peer of io.sockets.sockets.values()) if (peer.data.user?.id === user.id || peer.data.user?.id === transaction.recipient_id) { peer.emit('account', store.user(peer.data.user.id)); peer.emit('ledger:changed'); }
      for (const peer of io.sockets.sockets.values()) if (peer.data.user?.role === 'admin' && peer.data.user.id !== user.id && peer.data.user.id !== transaction.recipient_id) peer.emit('ledger:changed');
      if (!transaction.duplicate) io.emit('donation', { id: transaction.id, amount: transaction.amount, nickname: user.nickname, message: transaction.message });
      broadcast();
      return { ok: true, id: transaction.id, duplicate: Boolean(transaction.duplicate), points: store.user(user.id).points, supportTotal: store.supportTotal(room.state().broadcastId) };
    });
    handle('ledger', (before = null) => store.ledger(account(), before));
    handle('ledger:delete', (id) => {
      const donation = store.deleteDonation(account(), id);
      for (const peer of io.sockets.sockets.values()) if (peer.data.user?.role === 'admin' || peer.data.user?.id === donation.sender_id) peer.emit('account', store.user(peer.data.user.id));
      io.emit('ledger:changed');
      return { ok: true };
    });
    handle('chat:report', (value) => { store.report(account(), value); });
    handle('chat:manage', (value) => {
      store.moderate(account(), value);
      const { words, ...settings } = store.settings();
      io.emit('chat:settings', settings);
      if (value.action === 'delete') io.emit('chat:deleted', value.messageId);
    });
    handle('chat:review', () => {
      if (!['host', 'admin'].includes(account().role)) throw new Error('需要聊天室管理權限。');
      return { reports: store.reports(), mutes: store.mutes(), audit: store.audit(), settings: store.settings() };
    });
    socket.on('disconnect', broadcast);
  });
  return { server, io, store, poll, close: async () => { clearInterval(timer); await new Promise((done) => io.close(done)); if (polling) await polling; store.close(); } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createCourseApp();
  const port = Number(process.env.PORT || 4180);
  app.server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Group 9 Cloud Live: http://127.0.0.1:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void app.close(); });
}
