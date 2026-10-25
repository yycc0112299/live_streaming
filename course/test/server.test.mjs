import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { io as connect } from 'socket.io-client';
import { createCourseApp } from '../server.mjs';

async function setup(t) {
  let ready = false;
  let guestReady = false;
  let fail = false;
  const upstream = createServer((req, res) => {
    if (req.url === '/v3/paths/get/live') {
      res.writeHead(fail ? 503 : 200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ready }));
    }
    if (req.url === '/v3/paths/get/guest') return res.writeHead(fail ? 503 : 200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ready: guestReady }));
    if (req.url === '/guest/index.m3u8') return res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl' }).end('#EXTM3U\nguest.ts\n');
    if (req.url === '/guest/whep' && req.method === 'POST') return res.writeHead(201, { Location: '/guest/whep/12345678-1234-1234-1234-123456789abc', 'Content-Type': 'application/sdp' }).end('guest-answer');
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
  const app = createCourseApp({ apiUrl: upstreamUrl, hlsUrl: upstreamUrl, webrtcUrl: upstreamUrl, pollMs: 60000, dbPath: ':memory:', publicOrigin: '' });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(async () => { await app.close(); await new Promise((done) => upstream.close(done)); });
  return { app, url: `http://127.0.0.1:${app.server.address().port}`, live: (value) => { ready = value; }, guestLive: (value) => { guestReady = value; }, fail: (value) => { fail = value; } };
}
async function client(t, url, options = {}) {
  const socket = connect(url, { transports: ['websocket'], reconnection: false, ...options });
  t.after(() => socket.disconnect());
  await once(socket, 'connect');
  return socket;
}
function emit(socket, type, ...args) { return socket.timeout(2000).emitWithAck(type, ...args); }
async function member(t, s, username, role = 'viewer') {
  const user = await s.app.store.register({ username, password: 'A-test-password-123', nickname: username });
  s.app.store.db.prepare('UPDATE users SET role=? WHERE id=?').run(role, user.id);
  const token = s.app.store.newSession(user.id);
  const socket = await client(t, s.url, { extraHeaders: { Cookie: `group9_session=${token}` } });
  return { socket, user, token };
}

test('WHEP negotiation and cleanup work without exposing publishing or arbitrary upstream paths', async (t) => {
  const { url } = await setup(t);
  assert.equal((await fetch(url + '/webrtc/live/whep', { method: 'OPTIONS' })).status, 204);
  const response = await fetch(url + '/webrtc/live/whep', { method: 'POST', body: 'offer' });
  assert.equal(response.status, 201);
  assert.equal(await response.text(), 'answer');
  const guest = await fetch(url + '/webrtc/guest/whep', { method: 'POST', body: 'guest-offer' });
  assert.equal(guest.status, 201); assert.equal(await guest.text(), 'guest-answer');
  assert.match(new URL(guest.headers.get('location'), url + '/webrtc/guest/whep').pathname, /^\/webrtc\/guest\/whep\//);
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
  s.guestLive(true); await s.app.poll();
  state = await (await fetch(s.url + '/api/status')).json(); assert.equal(state.sources.guest.live, true);
  s.live(false); await s.app.poll();
  state = await (await fetch(s.url + '/api/status')).json(); assert.equal(state.sources.live.live, false); assert.equal(state.sources.guest.live, true);
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
  assert.match(await (await fetch(url + '/hls/guest/index.m3u8')).text(), /guest.ts/);
  const part = await fetch(url + '/hls/live/part.mp4?_HLS_msn=1');
  assert.equal(part.status, 200);
  assert.equal(await part.text(), 'part');
  for (const path of ['/server.mjs', '/.env', '/hls/other/index.m3u8', '/hls/live/http:evil', '/%2e%2e/package.json']) assert.equal((await fetch(url + path)).status, 404);
  assert.equal((await fetch(url, { method: 'POST' })).status, 405);
});
test('signed-in viewers choose nicknames and exchange text with per-account spam control', async (t) => {
  const s = await setup(t); const { url } = s;
  const anonymous = await client(t, url);
  assert.match((await emit(anonymous, 'chat', 'not yet')).error, /登入/);
  anonymous.disconnect();
  const { socket: a } = await member(t, s, 'Alice'); const { socket: b } = await member(t, s, 'Bob');
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
test('reconnect provides persistent history; guest likes are shared and throttled', async (t) => {
  const s = await setup(t); const { url } = s;
  const { socket: a } = await member(t, s, 'Alice');
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
test('points are account scoped, atomic, idempotent and cannot be self-donated', async (t) => {
  const s = await setup(t);
  const { socket: host } = await member(t, s, 'Host', 'host');
  const { socket: a, user, token } = await member(t, s, 'Alice');
  const { broadcastId } = await emit(host, 'room:start', { guestUsername: 'Alice', audioChecklist: true });
  s.live(true); await s.app.poll();
  const value = { amount: 10, requestId: crypto.randomUUID(), broadcastId };
  const first = await emit(a, 'donate', value);
  assert.equal(first.points, 990); assert.equal(first.supportTotal, 10);
  assert.equal((await emit(a, 'donate', value)).duplicate, true);
  assert.equal(s.app.store.user(user.id).points, 990);
  assert.ok((await emit(a, 'donate', { ...value, amount: 5 })).error);
  assert.ok((await emit(host, 'donate', { ...value, requestId: crypto.randomUUID() })).error);
  for (const amount of [2, 101, -5, '10', null]) assert.ok((await emit(a, 'donate', { ...value, amount, requestId: crypto.randomUUID() })).error);
  const reconnect = await client(t, s.url, { extraHeaders: { Cookie: `group9_session=${token}` } });
  assert.equal((await emit(reconnect, 'ledger')).points, 990);
  const results = await Promise.all(Array.from({ length: 10 }, () => emit(a, 'donate', { amount: 100, requestId: crypto.randomUUID(), broadcastId })));
  assert.equal(results.filter((r) => r.ok).length, 9);
  assert.equal(s.app.store.user(user.id).points, 90);
  assert.equal((await emit(host, 'ledger')).received, 910);
  await emit(host, 'room:end');
  assert.ok((await emit(a, 'donate', { amount: 1, requestId: crypto.randomUUID(), broadcastId })).error);
});
test('donations broadcast the sender nickname and amount', async (t) => {
  const s = await setup(t);
  const { socket: a } = await member(t, s, 'Alice');
  const { socket: b } = await member(t, s, 'Host', 'host');
  const { broadcastId } = await emit(b, 'room:start', { guestUsername: 'Alice', audioChecklist: true });
  s.live(true); await s.app.poll();
  await emit(a, 'nickname', 'Alice');
  const received = once(b, 'donation');
  await emit(a, 'donate', { amount: 10, broadcastId, requestId: crypto.randomUUID() });
  const [donation] = await received;
  assert.equal(donation.amount, 10); assert.equal(donation.nickname, 'Alice'); assert.ok(donation.id);
});

test('moderation requires a role; deletion, mute, reports, slow mode and words are enforced', async (t) => {
  const s = await setup(t);
  const { socket: host } = await member(t, s, 'Host', 'host');
  const { socket: a, user, token } = await member(t, s, 'Alice');
  assert.ok((await emit(a, 'chat:manage', { action: 'settings' })).error);
  assert.ok((await emit(a, 'chat:review')).error);
  const received = once(host, 'chat'); await emit(a, 'chat', 'report me'); const [message] = await received;
  await emit(a, 'chat:report', { messageId: message.id, reason: 'test report' });
  assert.equal((await emit(host, 'chat:review')).reports.length, 1);
  const deleted = once(a, 'chat:deleted');
  assert.equal((await emit(host, 'chat:manage', { action: 'delete', messageId: message.id })).ok, true);
  assert.equal((await deleted)[0], message.id); assert.equal(s.app.store.history().length, 0);
  assert.equal((await emit(host, 'chat:manage', { action: 'mute', userId: user.id, minutes: 10 })).ok, true);
  const reconnected = await client(t, s.url, { extraHeaders: { Cookie: `group9_session=${token}` } });
  assert.match((await emit(reconnected, 'chat', 'bypass mute')).error, /禁言/);
  await emit(host, 'chat:manage', { action: 'mute', userId: user.id, minutes: 0 });
  await emit(host, 'chat:manage', { action: 'settings', announcement: 'Welcome', slowSeconds: 30, voiceCooldownSeconds: 0, words: ['blocked'] });
  assert.match((await emit(a, 'chat', 'BLOCKED')).error, /限制詞/);
  assert.match((await emit(reconnected, 'chat', 'too soon')).error, /太快.*30 秒/);
  const review = await emit(host, 'chat:review');
  assert.equal(review.settings.announcement, 'Welcome'); assert.equal(review.audit.length, 4);
  await emit(host, 'chat:manage', { action: 'resolve', reportId: review.reports[0].id });
  assert.equal((await emit(host, 'chat:review')).reports.length, 0);
});

test('fixed OBS room binds two accounts, rejects unauthorized control, and survives page disconnect', async (t) => {
  const s = await setup(t);
  const { socket: host } = await member(t, s, 'Host', 'host');
  const { socket: guest, user: guestUser } = await member(t, s, 'Guest');
  const { socket: otherHost } = await member(t, s, 'OtherHost', 'host');
  assert.ok((await emit(guest, 'room:start', { guestUsername: 'Host', audioChecklist: true })).error);
  assert.ok((await emit(host, 'room:start', { guestUsername: 'Guest', audioChecklist: false })).error);
  assert.ok((await emit(host, 'room:start', { guestUsername: 'missing', audioChecklist: true })).error);
  const result = await emit(host, 'room:start', { guestUsername: 'Guest', audioChecklist: true });
  assert.ok(result.broadcastId); assert.equal(result.guest.userId, guestUser.id);
  assert.equal(result.host.path, 'live'); assert.equal(result.guest.path, 'guest');
  assert.ok((await emit(otherHost, 'room:start', { guestUsername: 'Guest', audioChecklist: true })).error);
  assert.ok((await emit(otherHost, 'room:end')).error);
  assert.ok((await emit(guest, 'room:end')).error);
  host.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal((await (await fetch(s.url + '/api/status')).json()).room.broadcastId, result.broadcastId);
});
test('first host opens a waiting room automatically and any logged-in account can join the second slot', async (t) => {
  const s = await setup(t);
  const { socket: first, user: firstUser } = await member(t, s, 'FirstHost', 'host');
  const { socket: second, user: secondUser } = await member(t, s, 'SecondHost', 'host');
  const { socket: viewer, user: viewerUser } = await member(t, s, 'Viewer');
  const viewerJoined = await emit(viewer, 'room:join');
  assert.equal(viewerJoined.guest.userId, viewerUser.id);
  const joined = await emit(second, 'room:join');
  assert.ok(joined.error);
  assert.equal(s.app.store.room().host.userId, firstUser.id);
  first.disconnect();
});
test('admin can toggle donations before a host joins and a host auto-opens them', async (t) => {
  const s = await setup(t);
  const { socket: admin } = await member(t, s, 'ToggleAdmin', 'admin');
  const { socket: viewer } = await member(t, s, 'ToggleViewer');
  assert.ok((await emit(viewer, 'room:donations', false)).error);
  const closed = await emit(admin, 'room:donations', false);
  assert.equal(closed.donationsEnabled, false);
  const { socket: host } = await member(t, s, 'ToggleHost', 'host');
  await emit(host, 'room:start', { audioChecklist: true });
  assert.equal(s.app.store.room().donationsEnabled, true);
  const closedAgain = await emit(admin, 'room:donations', false);
  assert.equal(closedAgain.donationsEnabled, false);
  assert.equal((await emit(admin, 'room:donations', true)).donationsEnabled, true);
});
test('viewer requests the second slot and the current host approves it for this room', async (t) => {
  const s = await setup(t);
  const { socket: host } = await member(t, s, 'RequestHost', 'host');
  const { socket: viewer, user } = await member(t, s, 'RequestViewer');
  const received = once(host, 'room:requests');
  assert.deepEqual(await emit(viewer, 'room:request'), { ok: true });
  assert.equal((await received)[0][0].userId, user.id);
  assert.ok((await emit(viewer, 'room:approve', user.id)).error);
  const approved = await emit(host, 'room:approve', user.id);
  assert.equal(approved.guest.userId, user.id);
  assert.equal(s.app.store.user(user.id).role, 'host');
  assert.equal(s.app.store.user(user.id).trustedSecond, 1);
  const device = await emit(viewer, 'obs:device'); assert.match(device.token, /^[a-f0-9]{64}$/);
  assert.ok((await emit(host, 'room:approve', user.id)).error);
  await emit(host, 'room:end'); await emit(host, 'room:start', { audioChecklist: true });
  const controller = await client(t, s.url, { auth: { obsDevice: device.token } });
  assert.equal(controller.connected, true);
  assert.equal(s.app.store.room().guest.userId, user.id);
});
test('HTTP accounts rotate sessions, reject cross-origin, and revoke active sockets on logout', async (t) => {
  const s = await setup(t);
  const post = (action, payload, cookie, origin = s.url) => fetch(`${s.url}/api/account/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(payload) });
  assert.equal((await post('register', {}, '', 'https://foreign.example')).status, 403);
  assert.equal((await post('register', {})).status, 400);
  assert.equal((await post('register', { username: 'bad', nickname: 'Bad', password: 'short' })).status, 400);
  const payload = { username: 'HTTPUser', nickname: 'HTTP', password: 'test-password-long-123' };
  const registration = await post('register', payload); assert.equal(registration.status, 200, await registration.clone().text());
  const cookie = registration.headers.get('set-cookie').split(';')[0];
  assert.match(registration.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  assert.equal((await post('register', payload)).status, 400);
  assert.equal((await post('login', { ...payload, password: 'wrong-password' })).status, 400);
  const login = await post('login', payload, cookie); assert.equal(login.status, 200);
  const nextCookie = login.headers.get('set-cookie').split(';')[0]; assert.notEqual(nextCookie, cookie);
  assert.equal((await (await fetch(s.url + '/api/account/me', { headers: { Cookie: cookie } })).json()).user, null);
  const socket = await client(t, s.url, { extraHeaders: { Cookie: nextCookie } });
  assert.equal((await emit(socket, 'ledger')).points, 1000);
  const disconnected = once(socket, 'disconnect');
  assert.equal((await post('logout', {}, nextCookie)).status, 200); await disconnected;
  assert.equal((await (await fetch(s.url + '/api/account/me', { headers: { Cookie: nextCookie } })).json()).user, null);
});
test('foreign browser origins cannot create a chat connection', async (t) => {
  const { url } = await setup(t);
  const socket = connect(url, { transports: ['websocket'], reconnection: false, extraHeaders: { Origin: 'https://other.example' } });
  t.after(() => socket.disconnect());
  const [error] = await once(socket, 'connect_error');
  assert.ok(error); assert.equal(socket.connected, false);
});

test('visitors get 1000 points without registration and cannot refill an existing session', async (t) => {
  const s = await setup(t);
  const enter = (cookie = '') => fetch(s.url + '/api/account/guest', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '{}' });
  const first = await enter(); assert.equal(first.status, 200);
  const cookie = first.headers.get('set-cookie').split(';')[0];
  const { user } = await first.json(); assert.equal(user.points, 1000); assert.equal(user.isGuest, 1); assert.equal(user.role, 'viewer');
  const { socket: host } = await member(t, s, 'Host', 'host');
  const { broadcastId } = await emit(host, 'room:start', { guestUsername: user.username, audioChecklist: true });
  s.live(true); await s.app.poll();
  const visitor = await client(t, s.url, { extraHeaders: { Cookie: cookie } });
  assert.equal((await emit(visitor, 'donate', { amount: 10, broadcastId, requestId: crypto.randomUUID() })).points, 990);
  const again = await enter(cookie); assert.equal((await again.json()).user.points, 990); assert.equal(again.headers.get('set-cookie'), null);
  const me = await fetch(s.url + '/api/account/me', { headers: { Cookie: cookie } }); assert.equal((await me.json()).user.id, user.id);
  const other = await enter(); assert.notEqual((await other.json()).user.id, user.id);
  assert.ok((await emit(visitor, 'chat:review')).error);
  await assert.rejects(s.app.store.login({ username: user.username, password: 'anything' }), /帳號或密碼錯誤/);
  const foreign = await fetch(s.url + '/api/account/guest', { method: 'POST', headers: { Origin: 'https://foreign.example', 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(foreign.status, 403);
});

test('OBS controllers are paired once to each broadcaster and cannot control the other broadcaster', async (t) => {
  const s = await setup(t);
  const { socket: host } = await member(t, s, 'Host', 'host');
  const { socket: guest } = await member(t, s, 'Guest');
  const { socket: viewer } = await member(t, s, 'Viewer');
  await emit(host, 'room:start', { guestUsername: 'Guest', audioChecklist: true });
  assert.ok((await emit(viewer, 'obs:pair')).error);
  const hostPair = await emit(host, 'obs:pair'); const guestPair = await emit(guest, 'obs:pair');
  const hostAgent = await client(t, s.url, { auth: { obsPair: hostPair.code } });
  const guestAgent = await client(t, s.url, { auth: { obsPair: guestPair.code } });
  await s.app.poll();
  assert.equal(hostAgent.connected, true); assert.equal(guestAgent.connected, true);
  const commands = [];
  hostAgent.on('obs:execute', (value, ack) => { commands.push('host:' + value.action); ack({ streaming: true, microphone: false, camera: true }); });
  guestAgent.on('obs:execute', (value, ack) => { commands.push('guest:' + value.action); ack({ streaming: false, microphone: true, camera: false }); });
  assert.equal((await emit(host, 'obs:control', { action: 'microphone', enabled: false })).microphone, false);
  assert.equal((await emit(guest, 'obs:control', { action: 'stop', userId: 'Host' })).streaming, false);
  assert.deepEqual(commands, ['host:microphone', 'guest:stop']);
  assert.ok((await emit(viewer, 'obs:control', { action: 'stop' })).error);
  assert.ok((await emit(host, 'obs:control', { action: 'microphone', enabled: 'false' })).error);
  const replay = connect(s.url, { transports: ['websocket'], reconnection: false, auth: { obsPair: hostPair.code } });
  t.after(() => replay.disconnect());
  const [error] = await once(replay, 'obs:error'); assert.match(error, /配對碼/);
});
