import assert from 'node:assert/strict';
import test from 'node:test';
import * as session from '../lib/live-session.ts';

function roomFixture() {
  const calls = [];
  return { calls, room: {
    async connect(url, token) { calls.push(['connect', url, token]); },
    async disconnect() { calls.push(['disconnect']); },
    localParticipant: { async publishTrack(track) { calls.push(['publish', track]); } },
  } };
}
function trackFixture() {
  return { stopped: false, stop() { this.stopped = true; } };
}

// Catches accidental permission requests in the subscribe-only flow.
test('viewer connects without requesting or publishing local media', async () => {
  const { room, calls } = roomFixture();
  await session.joinViewerSession(room, 'wss://media.example', 'viewer-token');
  assert.deepEqual(calls, [['connect', 'wss://media.example', 'viewer-token']]);
});

// Catches a host being left connected after permission refusal.
test('host permission refusal disconnects the room', async () => {
  const { room, calls } = roomFixture();
  await assert.rejects(session.startHostSession(room, 'url', 'token', async () => {
    throw new DOMException('Camera permission denied', 'NotAllowedError');
  }), { name: 'NotAllowedError' });
  assert.deepEqual(calls, [['connect', 'url', 'token'], ['disconnect']]);
});

// Catches leaks when microphone publish fails after acquiring camera and microphone.
test('host publish failure stops every acquired track and disconnects', async () => {
  const { room, calls } = roomFixture();
  const camera = trackFixture();
  const microphone = trackFixture();
  room.localParticipant.publishTrack = async () => { throw new Error('publish failed'); };
  await assert.rejects(session.startHostSession(room, 'url', 'token', async () => [camera, microphone]), /publish failed/);
  assert.equal(camera.stopped, true);
  assert.equal(microphone.stopped, true);
  assert.deepEqual(calls.at(-1), ['disconnect']);
});

// Catches missing publication, leaked media, and duplicate cleanup side effects.
test('host publishes acquired tracks and stop releases them once', async () => {
  const { room, calls } = roomFixture();
  const tracks = [trackFixture(), trackFixture()];
  await session.startHostSession(room, 'url', 'token', async () => tracks);
  assert.deepEqual(calls, [['connect', 'url', 'token'], ['publish', tracks[0]], ['publish', tracks[1]]]);
  await session.stopSession(room);
  await session.stopSession(room);
  assert.ok(tracks.every(track => track.stopped));
  assert.equal(calls.filter(([name]) => name === 'disconnect').length, 1);
});

// Catches camera tracks that resolve after the owner has already left.
test('stopping during a pending camera request prevents later publication', { timeout: 1000 }, async () => {
  const { room, calls } = roomFixture();
  let resolveTracks;
  let signalRequested;
  const requested = new Promise(resolve => { signalRequested = resolve; });
  const camera = trackFixture();
  const starting = session.startHostSession(room, 'url', 'token', () => {
    signalRequested();
    return new Promise(resolve => { resolveTracks = resolve; });
  });
  await requested;
  await session.stopSession(room);
  resolveTracks([camera]);
  await assert.rejects(starting, /stopped/i);
  assert.equal(camera.stopped, true);
  assert.equal(calls.filter(([name]) => name === 'publish').length, 0);
});

// Catches a connection completing after cancellation and leaving a room joined.
test('a late connection is disconnected again after cancellation', async () => {
  const { room, calls } = roomFixture();
  let resolveConnect;
  room.connect = () => new Promise(resolve => { resolveConnect = resolve; });
  const joining = session.joinViewerSession(room, 'url', 'token');
  await session.stopSession(room);
  resolveConnect();
  await assert.rejects(joining, /stopped/i);
  assert.equal(calls.filter(([name]) => name === 'disconnect').length, 2);
});

// Catches oversized UTF-8, invalid encodings, and HTML interpretation/rewriting.
test('chat accepts bounded plain text and drops malformed or oversized payloads', () => {
  const encode = value => new TextEncoder().encode(value);
  for (const [input, expected] of [
    ['hello', 'hello'], ['<img src=x onerror=alert(1)>', '<img src=x onerror=alert(1)>'],
    ['界'.repeat(166), '界'.repeat(166)], ['a'.repeat(500), 'a'.repeat(500)],
    ['', null], ['   ', null], ['a'.repeat(501), null], ['界'.repeat(167), null], ['hello\u0000', null],
  ]) assert.equal(session.decodeChatPayload(encode(input)), expected);
  assert.equal(session.decodeChatPayload(new Uint8Array([0xc3, 0x28])), null);
});

// Catches invite URLs being posted whole and malformed fragments throwing during hydration.
test('invite parsing selects only fragment credentials without reading query values', () => {
  assert.equal(session.inviteFromInput('https://watch.example/#invite=header.body.signature'), 'header.body.signature');
  assert.equal(session.inviteFromInput('#invite=abc%2Bdef'), 'abc+def');
  assert.equal(session.inviteFromInput('header.body.signature'), 'header.body.signature');
  assert.equal(session.inviteFromInput('https://watch.example/?invite=secret'), '');
  assert.equal(session.inviteFromInput('#invite=%E0%A4%A'), '');
});
