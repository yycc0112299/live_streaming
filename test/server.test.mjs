import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createApp } from '../src/server.mjs';

async function setup(t) {
  const app = createApp();
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(async () => {
    for (const client of app.wss.clients) client.terminate();
    await new Promise((resolve) => app.server.close(resolve));
  });
  return { app, port: app.server.address().port };
}

async function connect(port, t) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  ws.inbox = [];
  ws.waiters = [];
  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    const waiter = ws.waiters.shift();
    if (waiter) waiter(message);
    else ws.inbox.push(message);
  });
  await once(ws, 'open');
  t.after(() => ws.terminate());
  return ws;
}

function next(ws) {
  if (ws.inbox.length) return Promise.resolve(ws.inbox.shift());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket response timed out')), 1500);
    ws.waiters.push((message) => {
      clearTimeout(timer);
      resolve(message);
    });
  });
}

test('serves a health endpoint and does not expose files outside public', async (t) => {
  const { port } = await setup(t);
  const health = await fetch(`http://127.0.0.1:${port}/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, 'ok');
  const forbidden = await fetch(`http://127.0.0.1:${port}/../package.json`);
  assert.notEqual(forbidden.status, 200);
});

test('creates a room, joins a viewer, relays signals and chat, then closes it', async (t) => {
  const { port } = await setup(t);
  const host = await connect(port, t);
  const hostId = (await next(host)).id;
  const viewer = await connect(port, t);
  const viewerId = (await next(viewer)).id;

  host.send(JSON.stringify({ type: 'create_room', title: 'Demo room' }));
  const created = await next(host);
  assert.equal(created.type, 'room_created');
  assert.equal(created.title, 'Demo room');

  viewer.send(JSON.stringify({ type: 'join_room', roomId: created.roomId }));
  assert.deepEqual((await next(viewer)).hostId, hostId);
  assert.deepEqual((await next(host)).viewerId, viewerId);

  host.send(JSON.stringify({ type: 'signal', targetId: viewerId, data: { description: { type: 'offer', sdp: 'test' } } }));
  assert.deepEqual(await next(viewer), { type: 'signal', fromId: hostId, data: { description: { type: 'offer', sdp: 'test' } } });

  viewer.send(JSON.stringify({ type: 'chat', text: 'Hello everyone!' }));
  const chat = await next(host);
  assert.equal(chat.type, 'chat');
  assert.equal(chat.text, 'Hello everyone!');
  assert.equal(chat.fromId, viewerId);
  assert.equal((await next(viewer)).type, 'chat');

  host.send(JSON.stringify({ type: 'leave_room' }));
  assert.equal((await next(viewer)).type, 'room_closed');
});

test('rejects joining a missing room and ignores malformed input', async (t) => {
  const { port } = await setup(t);
  const viewer = await connect(port, t);
  await next(viewer);
  viewer.send('{broken json');
  assert.equal((await next(viewer)).type, 'error');
  viewer.send(JSON.stringify({ type: 'join_room', roomId: 'missing' }));
  assert.equal((await next(viewer)).code, 'room_not_found');
});
