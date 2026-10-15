import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeJwt, jwtVerify } from 'jose';
import { createBroadcast, joinBroadcast } from '../lib/room-api.ts';

const config = {
  livekitUrl: 'wss://example.livekit.cloud',
  apiKey: 'test-only-api-key',
  apiSecret: 'test-only-api-secret-for-room-api',
  creatorKey: 'test-only-creator-key',
  inviteSecret: 'test-only-invite-signing-secret',
};
const now = 1000;
const request = (endpoint, body, headers = {}) => new Request(`https://broadcast.example/api/${endpoint}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});
const create = () => createBroadcast(request('create', { creatorKey: config.creatorKey }), config, now);
const inviteFrom = data => decodeURIComponent(new URL(data.inviteUrl).hash.slice('#invite='.length));

// Catches unauthorized host grants, malformed room IDs, foreign viewer URLs, and leaked signing keys.
test('owner receives a same-origin fragment invite and a signed host token', async () => {
  const response = await create();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Content-Type'), 'application/json');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  const data = await response.json();
  assert.deepEqual(Object.keys(data).sort(), ['expiresAt', 'inviteUrl', 'livekitUrl', 'room', 'token']);
  assert.match(data.room, /^[0-9a-f]{32}$/);
  const url = new URL(data.inviteUrl);
  assert.equal(url.origin, 'https://broadcast.example');
  assert.equal(url.pathname, '/');
  assert.equal(url.search, '');
  assert.match(url.hash, /^#invite=/);
  assert.equal(data.expiresAt, 44200);
  assert.equal(data.livekitUrl, 'wss://example.livekit.cloud');
  const { payload } = await jwtVerify(data.token, new TextEncoder().encode(config.apiSecret), { currentDate: new Date(now * 1000) });
  assert.equal(payload.video.room, data.room);
  assert.equal(payload.video.canPublish, true);
  assert.equal(payload.iss, config.apiKey);
  for (const secret of [config.apiKey, config.apiSecret, config.creatorKey, config.inviteSecret]) assert.ok(!JSON.stringify(data).includes(secret));
});

test('wrong or missing owner key cannot create a broadcast', async () => {
  for (const body of [{ creatorKey: 'wrong' }, {}, { creatorKey: '' }]) {
    const response = await createBroadcast(request('create', body), config, now);
    assert.equal(response.status, 403);
    assert.ok(!('token' in await response.json()));
  }
});

test('viewer invite grants only subscribe permission in its original room', async () => {
  const created = await (await create()).json();
  const response = await joinBroadcast(request('join', { invite: inviteFrom(created) }), config, now + 1);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(Object.keys(data).sort(), ['livekitUrl', 'room', 'token']);
  assert.equal(data.room, created.room);
  const { payload } = await jwtVerify(data.token, new TextEncoder().encode(config.apiSecret), { currentDate: new Date(now * 1000) });
  assert.equal(payload.video.room, created.room);
  assert.equal(payload.video.canPublish, false);
  assert.equal(payload.video.canSubscribe, true);
  assert.notEqual(payload.sub, decodeJwt(created.token).sub);
  for (const secret of [config.apiKey, config.apiSecret, config.creatorKey, config.inviteSecret]) assert.ok(!JSON.stringify(data).includes(secret));
});

test('expired and altered invites cannot obtain tokens', async () => {
  const invite = inviteFrom(await (await create()).json());
  const parts = invite.split('.');
  parts[2] = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1);
  for (const [value, time] of [[invite, 44200], [parts.join('.'), now], ['invalid', now], ['', now]]) {
    assert.equal((await joinBroadcast(request('join', { invite: value }), config, time)).status, 403);
  }
  assert.equal((await joinBroadcast(request('join', {}), config, now)).status, 403);
});

for (const [endpoint, handler, field] of [['create', createBroadcast, 'creatorKey'], ['join', joinBroadcast, 'invite']]) {
  test(`${endpoint} rejects non-JSON, malformed, non-object and unexpected body fields`, async () => {
    for (const raw of ['', '{', 'null', '[]', 'true', '{"unexpected":"value"}', JSON.stringify({ [field]: 5 }), JSON.stringify({ [field]: 'value', extra: true })]) {
      const response = await handler(new Request(`https://broadcast.example/api/${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw,
      }), config, now);
      assert.ok(response.status >= 400 && response.status < 500, `${raw}: ${response.status}`);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
      assert.ok(!('token' in await response.json()));
    }
    const nonJson = new Request(`https://broadcast.example/api/${endpoint}`, { method: 'POST', body: '{}' });
    assert.equal((await handler(nonJson, config, now)).status, 415);
  });

  test(`${endpoint} caps actual UTF-8 body size even without trustworthy Content-Length`, async () => {
    for (const value of ['a'.repeat(4097), '界'.repeat(1400)]) {
      const response = await handler(request(endpoint, { [field]: value }, { 'Content-Length': '1' }), config, now);
      assert.equal(response.status, 413);
    }
  });

  test(`${endpoint} rejects foreign and null origins while accepting its own origin`, async () => {
    for (const origin of ['https://attacker.example', 'null', 'https://broadcast.example.attacker.example']) {
      assert.equal((await handler(request(endpoint, { [field]: 'value' }, { Origin: origin }), config, now)).status, 403);
    }
    const response = await handler(request(endpoint, { [field]: endpoint === 'create' ? config.creatorKey : 'invalid' }, { Origin: 'https://broadcast.example' }), config, now);
    assert.equal(response.status, endpoint === 'create' ? 200 : 403);
  });

  test(`${endpoint} allows only POST`, async () => {
    const response = await handler(new Request(`https://broadcast.example/api/${endpoint}`), config, now);
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'POST');
  });

  test(`${endpoint} fails closed for each missing configuration value`, async () => {
    for (const key of Object.keys(config)) {
      const response = await handler(request(endpoint, { [field]: 'value' }), { ...config, [key]: '' }, now);
      assert.equal(response.status, 503, key);
      const text = await response.text();
      for (const value of Object.values(config)) assert.ok(!text.includes(value));
    }
  });
}
