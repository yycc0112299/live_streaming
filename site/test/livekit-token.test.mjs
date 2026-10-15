import assert from 'node:assert/strict';
import test from 'node:test';
import { jwtVerify } from 'jose';
import { issueParticipantToken } from '../lib/livekit-token.ts';

test('participant JWTs sign anonymous, room-scoped host and viewer grants', async () => {
  const subjects = new Set();
  for (const role of ['host', 'viewer', 'viewer']) {
    const token = await issueParticipantToken('test-api-key', 'test-only-api-secret', '0123456789abcdef0123456789abcdef', role, 1000);
    const { payload, protectedHeader } = await jwtVerify(token, new TextEncoder().encode('test-only-api-secret'), {
      algorithms: ['HS256'], issuer: 'test-api-key', currentDate: new Date(1001 * 1000),
    });
    assert.equal(protectedHeader.alg, 'HS256');
    assert.equal(payload.iss, 'test-api-key');
    assert.equal(payload.iat, 1000);
    assert.equal(payload.exp, 4600);
    assert.deepEqual(payload.video, {
      room: '0123456789abcdef0123456789abcdef', roomJoin: true,
      canPublish: role === 'host', canSubscribe: true, canPublishData: true,
    });
    assert.match(payload.sub, /^[0-9a-f]{32}$/);
    assert.equal(payload.name, undefined);
    subjects.add(payload.sub);
  }
  assert.equal(subjects.size, 3);
});
