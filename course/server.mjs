import { createOBSControls } from './obs-controls.mjs';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep, dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Server } from 'socket.io';
import { openStore } from './store.mjs';
import { createOBSRoom } from './room.mjs';
import { publishCredentials } from './scripts/media-config.mjs';
import { createTTS } from './tts.mjs';
import os from 'node:os';

const dist = fileURLToPath(new URL('./dist/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

export function createCourseApp({ apiUrl = process.env.MEDIAMTX_API_URL || 'http://127.0.0.1:9997', hlsUrl = process.env.MEDIAMTX_HLS_URL || 'http://127.0.0.1:8888', webrtcUrl = process.env.MEDIAMTX_WEBRTC_URL || 'http://127.0.0.1:8889', pollMs = 2000, dbPath = process.env.DB_PATH || fileURLToPath(new URL('./.runtime/live.sqlite', import.meta.url)), gifDir = process.env.GIF_DIR || join(dirname(dbPath === ':memory:' ? fileURLToPath(new URL('./.runtime/live.sqlite', import.meta.url)) : dbPath), 'chat-gifs'), publicOrigin = process.env.PUBLIC_ORIGIN || '', mediaConfigPaths = process.env.MEDIAMTX_CONFIG ? [process.env.MEDIAMTX_CONFIG] : ['mediamtx.duo.yml', 'mediamtx.yml'].map((name) => fileURLToPath(new URL(`./.runtime/${name}`, import.meta.url))), publishAuth = null, guestIdleMs = Number(process.env.GUEST_IDLE_MS) || 180000, now = Date.now, tts = createTTS() } = {}) {
  const store = openStore(dbPath);
  // Browser (phone or PC) publishing: the server, not the browser, holds the MediaMTX publish password.
  async function publisherAuth(path) {
    if (publishAuth) return publishAuth[path] || '';
    for (const file of mediaConfigPaths) {
      try { const found = publishCredentials(await readFile(file, 'utf8'))[path]; if (found) return found; } catch {}
    }
    return '';
  }
  let status = { live: false, available: false, sources: { live: { live: false, available: false }, guest: { live: false, available: false } } };
  let polling;
  let looseLikes = 0; // likes while no session is open
  // Stream health for the admin panel, sampled on every MediaMTX poll.
  const media = { live: null, guest: null };
  function noteMedia(name, info) {
    const at = now(); const bytes = Number(info.bytesReceived ?? info.inboundBytes ?? 0); const prev = media[name];
    const kbps = prev && info.ready && prev.ready && at > prev.at && bytes >= prev.bytes ? Math.round(((bytes - prev.bytes) * 8) / (at - prev.at)) : 0;
    const stalled = Boolean(info.ready && prev?.ready && bytes === prev.bytes);
    media[name] = { at, bytes, kbps, stalled, ready: info.ready === true, source: info.source?.type || null, tracks: info.tracks || [], readers: (info.readers || []).length, readySince: info.readyTime || null };
  }
  function health() {
    const viewers = [...io.of('/').sockets.values()].filter((socket) => !socket.data.obsController).length;
    const current = room.state();
    const slots = ['live', 'guest'].map((path) => {
      const m = media[path]; const owner = path === 'live' ? current.host : current.guest;
      const warnings = [];
      if (!m) warnings.push('媒體伺服器沒有回應');
      else if (m.ready && m.stalled) warnings.push('收不到新資料，畫面可能凍結');
      else if (m.ready && m.kbps > 0 && m.kbps < 300) warnings.push('上傳碼率偏低，畫面可能模糊或卡頓');
      if (m && m.ready && !m.tracks.some((track) => /audio|aac|opus|mpeg-4 audio/i.test(String(track)))) warnings.push('這一路沒有聲音軌');
      return { path, broadcaster: owner?.nickname || null, live: Boolean(m?.ready), source: m?.source || null, tracks: m?.tracks || [], kbps: m?.kbps || 0, megabytes: m ? +(m.bytes / 1048576).toFixed(1) : 0, readers: m?.readers || 0, uptimeSeconds: m?.readySince ? Math.max(0, Math.round((now() - Date.parse(m.readySince)) / 1000)) : 0, warnings };
    });
    const memory = process.memoryUsage();
    return { at: new Date(now()).toISOString(), viewers, slots, server: { uptimeSeconds: Math.round(process.uptime()), memoryMB: Math.round(memory.rss / 1048576), load: os.loadavg().map((value) => +value.toFixed(2)), cpus: os.cpus().length, tts: tts.enabled } };
  }
  // Second slot: a joined guest who has not published for guestIdleMs is released so others can join.
  let guestIdle = null;
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
      if (url.pathname === '/api/chat/gif' && req.method === 'POST') {
        if (!sameOrigin(req) || req.headers['sec-fetch-site'] === 'cross-site') return json(res, 403, { error: '拒絕跨網站上傳。' });
        if (!secureTransport(req)) return json(res, 403, { error: '上傳需要 HTTPS。' });
        const account = store.session(cookieToken(req));
        if (!account) return json(res, 401, { error: '請先登入。' });
        if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'image/gif') return json(res, 415, { error: '僅支援 GIF 圖片。' });
        const chunks = []; let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 512 * 1024) return json(res, 413, { error: 'GIF 不得超過 512 KB。' });
          chunks.push(chunk);
        }
        const bytes = Buffer.concat(chunks);
        const width = bytes.length >= 10 ? bytes.readUInt16LE(6) : 0;
        const height = bytes.length >= 10 ? bytes.readUInt16LE(8) : 0;
        if (bytes.length < 20 || !/^GIF8[79]a$/.test(bytes.toString('ascii', 0, 6)) || bytes.at(-1) !== 0x3b || !width || !height || width > 512 || height > 512) return json(res, 415, { error: 'GIF 檔案或尺寸無效（最大 512 × 512）。' });
        const id = randomUUID();
        await mkdir(gifDir, { recursive: true, mode: 0o700 });
        await writeFile(join(gifDir, id + '.gif'), bytes, { flag: 'wx', mode: 0o600 });
        try {
          const message = store.sendChat(account, '', id);
          io.emit('chat', message);
          return json(res, 201, { message });
        } catch (error) {
          await unlink(join(gifDir, id + '.gif')).catch(() => {});
          return json(res, 400, { error: error.message });
        }
      }
      const gifMatch = /^\/api\/chat\/gif\/([a-f0-9-]{36})$/.exec(url.pathname);
      if (gifMatch && (req.method === 'GET' || req.method === 'HEAD')) {
        if (!store.gifVisible(gifMatch[1])) return res.writeHead(404).end();
        try {
          const bytes = await readFile(join(gifDir, gifMatch[1] + '.gif'));
          return res.writeHead(200, { 'Content-Type': 'image/gif', 'Content-Length': bytes.length }).end(req.method === 'HEAD' ? undefined : bytes);
        } catch { return res.writeHead(404).end(); }
      }
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
        // Viewer WHEP is public; WHIP publishing only for the logged-in broadcaster who owns that path.
        const webrtcMatch = /^\/webrtc\/(live|guest)\/(whep|whip)(?:\/[a-f0-9-]{36})?$/.exec(url.pathname);
        if (!webrtcMatch) return res.writeHead(404).end();
        if (!['OPTIONS', 'POST', 'PATCH', 'DELETE'].includes(req.method)) return res.writeHead(405).end();
        if (!sameOrigin(req)) return res.writeHead(403).end();
        let authorization;
        if (webrtcMatch[2] === 'whip') {
          if (!secureTransport(req)) return json(res, 403, { error: '瀏覽器直播需要 HTTPS。' });
          const account = store.session(cookieToken(req));
          if (!account) return json(res, 401, { error: '請先登入。' });
          const current = room.state();
          const owned = current.host?.userId === account.id ? 'live' : current.guest?.userId === account.id ? 'guest' : null;
          if (owned !== webrtcMatch[1]) return json(res, 403, { error: '你不是這一路的上鏡主播。' });
          const credential = await publisherAuth(owned);
          if (!credential) return json(res, 503, { error: '伺服器尚未設定這一路的發布權限。' });
          authorization = `Basic ${Buffer.from(credential).toString('base64')}`;
        }
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 65536) return res.writeHead(413).end();
          chunks.push(chunk);
        }
        const upstream = await fetch(`${webrtcUrl}${url.pathname.slice(7)}`, {
          method: req.method,
          headers: { 'Content-Type': req.headers['content-type'] || 'application/sdp', ...(req.headers['if-match'] ? { 'If-Match': req.headers['if-match'] } : {}), ...(authorization ? { Authorization: authorization } : {}) },
          body: size ? Buffer.concat(chunks) : undefined,
          signal: AbortSignal.timeout(15000),
          redirect: 'error',
        });
        const headers = {};
        for (const name of ['content-type', 'etag', 'accept-patch', 'link']) if (upstream.headers.has(name)) headers[name] = upstream.headers.get(name);
        const session = upstream.headers.get('location');
        if (session) {
          const path = new URL(session, `${webrtcUrl}${url.pathname.slice(7)}`).pathname;
          if (!new RegExp(`^/${webrtcMatch[1]}/${webrtcMatch[2]}/[a-f0-9-]{36}$`).test(path)) throw new Error('Invalid WebRTC session');
          headers.location = `./${webrtcMatch[2]}/${path.split('/').pop()}`;
        }
        res.writeHead(upstream.status, headers).end(Buffer.from(await upstream.arrayBuffer()));
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return res.writeHead(405).end();
      if (url.pathname === '/api/status' || url.pathname === '/health') {
        return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ...snapshot(), status: 'ok' }));
      }
      const voiceMatch = /^\/api\/voice\/(?:([a-f0-9-]{36})|preview\/([a-z-]{2,30}))\.mp3$/.exec(url.pathname);
      if (voiceMatch) {
        const audio = await (voiceMatch[1] ? tts.audio(voiceMatch[1]) : tts.preview(voiceMatch[2]));
        if (!audio) return res.writeHead(404, { 'Cache-Control': 'no-store' }).end();
        return res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': audio.length, 'Cache-Control': 'private, max-age=600' }).end(req.method === 'HEAD' ? undefined : audio);
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
  const room = createOBSRoom(io, store, () => { broadcast(); sendRanks(); });
  const obsControls = createOBSControls(io, store, secureTransport);
  function snapshot() { if (store.settings().donationsEnabled) store.ensureDonationRoom(); const currentRoom = room.state(); return { ...status, viewers: [...io.of('/').sockets.values()].filter((socket) => !socket.data.obsController).length, likes: currentRoom.broadcastId ? store.likes(currentRoom.broadcastId) : looseLikes, supportTotal: store.supportTotal(currentRoom.broadcastId), leaderboard: store.leaderboard(currentRoom.broadcastId), neuralVoices: tts.enabled, guestIdleLeft: guestIdle && currentRoom.guest?.userId === guestIdle.userId ? Math.max(0, Math.ceil((guestIdle.since + guestIdleMs - now()) / 1000)) : null, room: currentRoom }; }
  function broadcast() { io.emit('state', snapshot()); }
  function sendRanks(only) {
    const id = room.state().broadcastId;
    for (const peer of only ? [only] : io.sockets.sockets.values()) if (peer.data.user) peer.emit('rank', store.rank(id, peer.data.user.id));
  }
  function releaseIdleGuest() {
    const current = room.state(); const guest = current.guest; const source = status.sources?.guest;
    if (!guest || source?.live) { guestIdle = null; return; }
    if (!source?.available) return; // media server unknown: never kick on a monitoring blip
    if (guestIdle?.userId !== guest.userId || guestIdle.broadcastId !== current.broadcastId) { guestIdle = { userId: guest.userId, broadcastId: current.broadcastId, since: now() }; return; }
    if (now() - guestIdle.since < guestIdleMs) return;
    store.releaseGuest(current.broadcastId, guest.userId); guestIdle = null; room.notify();
  }
  function poll() {
    if (polling) return polling;
    polling = (async () => {
    for (const socket of io.sockets.sockets.values()) if (!socket.data.authorized()) socket.disconnect(true);
    try {
      const paths = await Promise.all(['live', 'guest'].map(async (name) => {
        try {
          const response = await fetch(`${apiUrl}/v3/paths/get/${name}`, { signal: AbortSignal.timeout(3000) });
          if (response.status === 404) { noteMedia(name, { ready: false }); return [name, { live: false, available: true }]; }
          if (!response.ok) throw new Error('Media API unavailable');
          const info = await response.json();
          noteMedia(name, info);
          return [name, { live: info.ready === true, available: true }];
        } catch { media[name] = null; return [name, { live: false, available: false }]; }
      }));
      const sources = Object.fromEntries(paths);
      status = { ...sources.live, sources };
    } catch { status = { live: false, available: false }; }
    finally {
      try { releaseIdleGuest(); } catch {}
      try { store.notePeak(room.state().broadcastId, [...io.of('/').sockets.values()].filter((socket) => !socket.data.obsController).length); } catch {}
      polling = undefined; broadcast();
    }
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
    sendRanks(socket);
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
      const id = room.state().broadcastId;
      const likes = id ? store.addLike(id) : ++looseLikes; // likes belong to the current session
      io.emit('like', { likes });
    });
    handle('donate', (value) => {
      const user = account();
      if (store.settings().donationsEnabled) store.ensureDonationRoom();
      const active = (status.sources.live.live || status.sources.guest.live) || room.state().donationsEnabled;
      const transaction = store.donate(user, value, active ? room.state().broadcastId : null);
      for (const peer of io.sockets.sockets.values()) if (peer.data.user?.id === user.id || peer.data.user?.id === transaction.recipient_id) { peer.emit('account', store.user(peer.data.user.id)); peer.emit('ledger:changed'); }
      for (const peer of io.sockets.sockets.values()) if (peer.data.user?.role === 'admin' && peer.data.user.id !== user.id && peer.data.user.id !== transaction.recipient_id) peer.emit('ledger:changed');
      if (!transaction.duplicate) io.emit('donation', { id: transaction.id, amount: transaction.amount, nickname: user.nickname, message: transaction.message, audio: transaction.message ? tts.prepare(transaction.id, transaction.message, typeof value?.voice === 'string' ? value.voice : '') : false });
      broadcast(); sendRanks();
      return { ok: true, id: transaction.id, duplicate: Boolean(transaction.duplicate), points: store.user(user.id).points, supportTotal: store.supportTotal(room.state().broadcastId) };
    });
    handle('health', () => {
      const user = account();
      if (!['admin', 'host'].includes(user.role)) throw new Error('只有主播或管理員可以查看直播健康狀態。');
      return { ok: true, ...health() };
    });
    // A broadcaster or admin stops the voice message being read aloud, for every viewer at once.
    handle('voice:skip', (id) => {
      const user = account(); const current = room.state();
      if (user.role !== 'admin' && current.host?.userId !== user.id && current.guest?.userId !== user.id) throw new Error('只有主播或管理員可以停止朗讀。');
      io.emit('voice:skip', { id: typeof id === 'string' ? id.slice(0, 64) : null });
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
      const deletedGif = value?.action === 'delete' ? store.gifForMessage(value.messageId) : '';
      store.moderate(account(), value);
      const { words, ...settings } = store.settings();
      io.emit('chat:settings', settings);
      if (value.action === 'delete') io.emit('chat:deleted', value.messageId);
      if (deletedGif) void unlink(join(gifDir, deletedGif + '.gif')).catch(() => {});
    });
    handle('chat:review', () => {
      if (!['host', 'admin'].includes(account().role)) throw new Error('需要聊天室管理權限。');
      return { reports: store.reports(), mutes: store.mutes(), audit: store.audit(), settings: store.settings() };
    });
    socket.on('disconnect', broadcast);
  });
  return { server, io, store, poll, setClock: (fn) => { now = fn; }, close: async () => { clearInterval(timer); await new Promise((done) => io.close(done)); if (polling) await polling; store.close(); } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createCourseApp();
  const port = Number(process.env.PORT || 4180);
  app.server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Group 9 Cloud Live: http://127.0.0.1:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void app.close(); });
}
