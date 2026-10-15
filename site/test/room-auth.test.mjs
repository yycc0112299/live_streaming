import assert from 'node:assert/strict';
import test from 'node:test';
import { SignJWT, decodeJwt } from 'jose';
import { newRoomId, issueViewerInvite, verifyViewerInvite, creatorKeyMatches } from '../lib/room-auth.ts';

const secret = 'test-only-invite-signing-key-32-bytes';

test('room identifiers are distinct random 128-bit lowercase hex values', () => {
  const first = newRoomId();
  const second = newRoomId();
  assert.match(first, /^[0-9a-f]{32}$/);
  assert.match(second, /^[0-9a-f]{32}$/);
  assert.notEqual(first, second);
});

test('signed viewer invites authorize their room for twelve hours', async () => {
  const room = '0123456789abcdef0123456789abcdef';
  const { invite, expiresAt } = await issueViewerInvite(secret, room, 1000);
  assert.equal(expiresAt, 44200);
  assert.equal(await verifyViewerInvite(secret, invite, 1001), room);
  assert.equal(await verifyViewerInvite(secret, invite, 44200), null);
  assert.equal(await verifyViewerInvite(secret, invite, 44201), null);
  const payload = decodeJwt(invite);
  assert.equal(payload.scope, 'viewer');
  assert.equal(payload.iat, 1000);
  assert.equal(payload.exp, 44200);
  assert.match(payload.nonce, /^[0-9a-f]{32}$/);
  const next = await issueViewerInvite(secret, room, 1000);
  assert.notEqual(decodeJwt(next.invite).nonce, payload.nonce);
});

test('tampered, wrong-key and malformed invites never authorize a room', async () => {
  const { invite } = await issueViewerInvite(secret, '0123456789abcdef0123456789abcdef', 1000);
  const parts = invite.split('.');
  parts[2] = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1);
  for (const invalid of [parts.join('.'), '', 'not-a-jwt', 'a.b.c']) {
    assert.equal(await verifyViewerInvite(secret, invalid, 1001), null);
  }
  assert.equal(await verifyViewerInvite('wrong-secret', invite, 1001), null);
});

test('signed claims must have viewer scope, valid room and expiry', async () => {
  for (const claims of [
    { room: '0123456789abcdef0123456789abcdef', scope: 'host', exp: 44200 },
    { room: '../other-room', scope: 'viewer', exp: 44200 },
    { room: '0123456789abcdef0123456789abcdef', scope: 'viewer' },
  ]) {
    const invite = await new SignJWT({ nonce: 'abcdef0123456789abcdef0123456789', ...claims }).setProtectedHeader({ alg: 'HS256' })
      .sign(new TextEncoder().encode(secret));
    assert.equal(await verifyViewerInvite(secret, invite, 1001), null);
  }
});

test('creator key comparison rejects empty and incorrect credentials', async () => {
  assert.equal(await creatorKeyMatches('correct-test-key', 'correct-test-key'), true);
  for (const [provided, expected] of [['', 'key'], ['key', ''], ['', ''], ['wrong', 'key'], ['abc', 'abd']]) {
    assert.equal(await creatorKeyMatches(provided, expected), false);
  }
});
