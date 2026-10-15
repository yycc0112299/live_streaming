import { SignJWT } from 'jose';

export async function issueParticipantToken(apiKey: string, apiSecret: string, room: string, role: 'host' | 'viewer', now: number): Promise<string> {
  const identity = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte =>
    byte.toString(16).padStart(2, '0')).join('');
  return new SignJWT({
    video: {
      room,
      roomJoin: true,
      canPublish: role === 'host',
      canSubscribe: true,
      canPublishData: true,
    },
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(apiKey)
    .setSubject(identity)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(new TextEncoder().encode(apiSecret));
}
