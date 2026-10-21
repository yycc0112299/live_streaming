import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { io as connect } from 'socket.io-client';
import { createCourseApp } from '../server.mjs';

async function setup(t) {
  let ready = false;
  let fail = false;
  const upstream = createServer((req, res) => {
    if (req.url === '/v3/paths/get/live') {
      res.writeHead(fail ? 503 : 200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ready }));
    }
    if (req.url === '/live/index.m3u8') return res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl' }).end('#EXTM3U\nsegment.ts\n');
    if (req.url === '/live/part.mp4?_HLS_msn=1') return res.writeHead(200, { 'Content-Type': 'video/mp4' }).end('part');
    if (req.url === '/live/whep' && req.method === 'OPTIONS') return res.writeHead(204, { 'Accept-Patch': 'application/trickle-ice-sdpfrag' }).end();
    if (req.url === '/live/whep' && req.method === 'POST') return res.writeHead(201, { Location: '/live/whep/12345678-1234-1234-1234-123456789abc', 'Content-Type': 'application/sdp' }).end('answer');
    if (req.url === '/live/whep/12345678-1234-1234-1234-123456789abc' && ['PATCH', 'DELETE'].includes(req.method)) return res.writeHead(204).end();
    res.writeHead(404).end();
  });
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  const upstreamUrl = `http://127.0.0.1:${upstream.address().port}`;
  const app = createCourseApp({ apiUrl: upstreamUrl, hlsUrl: upstreamUrl, webrtcUrl: upstreamUrl, pollMs: 60000 });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(async () => { await app.close(); await new Promise((done) => upstream.close(done)); });
  return { app, url: `http://127.0.0.1:${app.server.address().port}`, live: (value) => { ready = value; }, fail: (value) => { fail = value; } };
}
async function client(t, url, options = {}) {
  const socket = connect(url, { transports: ['websocket'], reconnection: false, ...options });
  t.after(() => socket.disconnect());
  await once(socket, 'connect');
  return socket;
}
function emit(socket, type, ...args) { return socket.timeout(2000).emitWithAck(type, ...args); }

test('WHEP negotiation and cleanup work without exposing publishing or arbitrary upstream paths', async (t) => {
  const { url } = await setup(t);
  assert.equal((await fetch(url + '/webrtc/live/whep', { method: 'OPTIONS' })).status, 204);
  const response = await fetch(url + '/webrtc/live/whep', { method: 'POST', body: 'offer' });
  assert.equal(response.status, 201);
  assert.equal(await response.text(), 'answer');
  const session = new URL(response.headers.get('location'), url + '/webrtc/live/whep');
  assert.equal(session.pathname, '/webrtc/live/whep/12345678-1234-1234-1234-123456789abc');
  for (const method of ['PATCH', 'DELETE']) assert.equal((await fetch(session, { method })).status, 204);
  assert.equal((await fetch(url + '/webrtc/live/whep', { method: 'POST', body: 'x'.repeat(65537) })).status, 413);
  assert.equal((await fetch(url + '/webrtc/live/whep', { method: 'POST', headers: { Origin: 'https://foreign.example' } })).status, 403);
  for (const path of ['/webrtc/live/whip', '/webrtc/other/whep', '/webrtc/live/whep/not-a-session']) assert.equal((await fetch(url + path, { method: 'POST' })).status, 404);
});

test('live/offline state comes from MediaMTX and distinguishes service failure', async (t) => {
  const s = await setup(t);
  await s.app.poll();
  let state = await (await fetch(s.url + '/api/status')).json();
  assert.equal(state.live, false);
  assert.equal(state.available, true);
  s.live(true); await s.app.poll();
  state = await (await fetch(s.url + '/api/status')).json();
  assert.equal(state.live, true);
  s.fail(true); await s.app.poll();
  state = await (await fetch(s.url + '/api/status')).json();
  assert.equal(state.live, false);
  assert.equal(state.available, false);
});
test('HLS playlist is proxied but arbitrary files and upstreams are inaccessible', async (t) => {
  const { url } = await setup(t);
  const playlist = await fetch(url + '/hls/live/index.m3u8');
  assert.equal(playlist.status, 200);
  assert.match(await playlist.text(), /#EXTM3U/);
  const part = await fetch(url + '/hls/live/part.mp4?_HLS_msn=1');
  assert.equal(part.status, 200);
  assert.equal(await part.text(), 'part');
  for (const path of ['/server.mjs', '/.env', '/hls/other/index.m3u8', '/hls/live/http:evil', '/%2e%2e/package.json']) assert.equal((await fetch(url + path)).status, 404);
  assert.equal((await fetch(url, { method: 'POST' })).status, 405);
});
test('two viewers choose nicknames and exchange text with bounded validation and spam control', async (t) => {
  const { url } = await setup(t);
  const a = await client(t, url); const b = await client(t, url);
  assert.match((await emit(a, 'chat', 'not yet')).error, /暱稱/);
  for (const name of ['', 'x'.repeat(25), 'bad\u202ename', { name: 'bad' }]) assert.ok((await emit(a, 'nickname', name)).error);
  assert.deepEqual(await emit(a, 'nickname', 'Alice'), { nickname: 'Alice' });
  assert.deepEqual(await emit(b, 'nickname', 'Bob'), { nickname: 'Bob' });
  for (const text of ['', 'x'.repeat(501), '\u0000', { text: 'bad' }]) assert.ok((await emit(a, 'chat', text)).error);
  const received = once(b, 'chat');
  assert.deepEqual(await emit(a, 'chat', '<script>alert(1)</script>'), { ok: true });
  const [message] = await received;
  assert.equal(message.nickname, 'Alice');
  assert.equal(message.text, '<script>alert(1)</script>');
  assert.ok(message.id); assert.ok(Date.parse(message.at));
  assert.match((await emit(a, 'chat', 'too fast')).error, /太快/);
  const response = once(a, 'chat');
  assert.deepEqual(await emit(b, 'chat', 'Hello Alice'), { ok: true });
  assert.equal((await response)[0].nickname, 'Bob');
  const count = await (await fetch(url + '/api/status')).json();
  assert.equal(count.viewers, 2);
  const departed = new Promise((resolve) => a.on('state', (state) => { if (state.viewers === 1) resolve(); }));
  b.disconnect();
  await departed;
  assert.equal((await (await fetch(url + '/api/status')).json()).viewers, 1);
});
test('reconnect provides recent history and requires a fresh nickname; likes are shared and throttled', async (t) => {
  const { url } = await setup(t);
  const a = await client(t, url);
  await emit(a, 'nickname', 'Alice'); await emit(a, 'chat', 'Welcome');
  const b = connect(url, { autoConnect: false, transports: ['websocket'] });
  t.after(() => b.disconnect());
  const history = once(b, 'history'); b.connect();
  assert.equal((await history)[0][0].text, 'Welcome');
  assert.ok((await emit(b, 'chat', 'anonymous')).error);
  const like = once(b, 'like');
  assert.deepEqual(await emit(a, 'like'), { ok: true });
  assert.equal((await like)[0].likes, 1);
  assert.ok((await emit(a, 'like')).error);
});
test('demo points allow only fixed donations and reject overspending', async (t) => {
  const { url } = await setup(t);
  const a = await client(t, url);
  assert.deepEqual(await emit(a, 'donate', 10), { ok: true, points: 90, supportTotal: 10 });
  assert.ok((await emit(a, 'donate', 2)).error);
  assert.ok((await emit(a, 'donate', 100)).error);
});
test('foreign browser origins cannot create a chat connection', async (t) => {
  const { url } = await setup(t);
  const socket = connect(url, { transports: ['websocket'], reconnection: false, extraHeaders: { Origin: 'https://other.example' } });
  t.after(() => socket.disconnect());
  const [error] = await once(socket, 'connect_error');
  assert.ok(error); assert.equal(socket.connected, false);
});
