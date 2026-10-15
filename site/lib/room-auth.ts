import { SignJWT, jwtVerify } from 'jose';

const encoder = new TextEncoder();
const roomPattern = /^[0-9a-f]{32}$/;

export function newRoomId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte =>
    byte.toString(16).padStart(2, '0')).join('');
}

export async function issueViewerInvite(secret: string, room: string, now: number): Promise<{ invite: string; expiresAt: number }> {
  if (!secret || !roomPattern.test(room)) throw new Error('Invalid invite configuration');
  const expiresAt = now + 43200;
  const invite = await new SignJWT({ room, scope: 'viewer', nonce: newRoomId() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(encoder.encode(secret));
  return { invite, expiresAt };
}

export async function verifyViewerInvite(secret: string, invite: string, now: number): Promise<string | null> {
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(invite, encoder.encode(secret), {
      algorithms: ['HS256'],
      currentDate: new Date(now * 1000),
      requiredClaims: ['exp', 'room', 'scope', 'nonce'],
    });
    if (payload.scope !== 'viewer' || typeof payload.room !== 'string' ||
        !roomPattern.test(payload.room) || typeof payload.nonce !== 'string' ||
        !roomPattern.test(payload.nonce)) return null;
    return payload.room;
  } catch {
    return null;
  }
}

export async function creatorKeyMatches(provided: string, expected: string): Promise<boolean> {
  // Digest first so comparison always visits exactly 32 bytes, even for unequal lengths.
  const [providedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const left = new Uint8Array(providedDigest);
  const right = new Uint8Array(expectedDigest);
  let difference = 0;
  for (let index = 0; index < 32; index++) difference |= left[index] ^ right[index];
  return difference === 0 && provided.length > 0 && expected.length > 0;
}
