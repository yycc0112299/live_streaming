import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomRegistry } from '../src/rooms.mjs';

test('creates a room and lets viewers join and leave', () => {
  const rooms = new RoomRegistry();
  const host = { id: 'host' };
  const viewer = { id: 'viewer' };
  const room = rooms.create(host, 'A live room');
  assert.match(room.id, /^[a-z0-9]{6}$/);
  assert.equal(room.title, 'A live room');
  assert.equal(rooms.join(room.id, viewer).host, host);
  assert.deepEqual(rooms.viewers(room.id), [viewer]);
  assert.equal(rooms.leave(viewer)?.role, 'viewer');
  assert.deepEqual(rooms.viewers(room.id), []);
});

test('rejects unknown rooms and closes a room when its host leaves', () => {
  const rooms = new RoomRegistry();
  const host = { id: 'host' };
  const viewer = { id: 'viewer' };
  assert.equal(rooms.join('missing', viewer), null);
  const room = rooms.create(host, 'Test');
  rooms.join(room.id, viewer);
  assert.equal(rooms.leave(host)?.role, 'host');
  assert.equal(rooms.get(room.id), null);
  assert.equal(rooms.membership(viewer), null);
});

test('a connection can belong to only one room', () => {
  const rooms = new RoomRegistry();
  const host = { id: 'host' };
  rooms.create(host, 'First');
  assert.throws(() => rooms.create(host, 'Second'), /already in a room/);
});
