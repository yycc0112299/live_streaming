import { creatorKeyMatches, issueViewerInvite, newRoomId, verifyViewerInvite } from './room-auth.ts';
import { issueParticipantToken } from './livekit-token.ts';

export interface RoomConfig {
  livekitUrl: string;
  apiKey: string;
  apiSecret: string;
  creatorKey: string;
  inviteSecret: string;
}

function json(body: object, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

function checkBoundary(request: Request, config: RoomConfig): Response | null {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
  const origin = request.headers.get('Origin');
  if (origin !== null && origin !== new URL(request.url).origin) return json({ error: 'Forbidden' }, 403);
  if (![config.livekitUrl, config.apiKey, config.apiSecret, config.creatorKey, config.inviteSecret]
    .every(value => typeof value === 'string' && value.trim().length > 0)) {
    return json({ error: 'Service unavailable' }, 503);
  }
  return null;
}

async function credentialBody(request: Request, field: string): Promise<string | Response> {
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return json({ error: 'JSON required' }, 415);
  }
  if (!request.body) return json({ error: 'Invalid request' }, 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 4096) {
        await reader.cancel();
        return json({ error: 'Request too large' }, 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const body: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request' }, 400);
    const values = body as Record<string, unknown>;
    if (Object.keys(values).some(key => key !== field)) return json({ error: 'Invalid request' }, 400);
    if (!(field in values)) return json({ error: 'Forbidden' }, 403);
    if (typeof values[field] !== 'string') return json({ error: 'Invalid request' }, 400);
    return values[field];
  } catch {
    return json({ error: 'Invalid request' }, 400);
  } finally {
    reader.releaseLock();
  }
}

export async function createBroadcast(request: Request, config: RoomConfig, now: number): Promise<Response> {
  const boundary = checkBoundary(request, config);
  if (boundary) return boundary;
  const key = await credentialBody(request, 'creatorKey');
  if (key instanceof Response) return key;
  try {
    if (!await creatorKeyMatches(key, config.creatorKey)) return json({ error: 'Forbidden' }, 403);
    const room = newRoomId();
    const { invite, expiresAt } = await issueViewerInvite(config.inviteSecret, room, now);
    const inviteUrl = new URL('/', new URL(request.url).origin);
    inviteUrl.hash = `invite=${encodeURIComponent(invite)}`;
    const token = await issueParticipantToken(config.apiKey, config.apiSecret, room, 'host', now);
    return json({ room, inviteUrl: inviteUrl.href, expiresAt, livekitUrl: config.livekitUrl, token });
  } catch {
    return json({ error: 'Service unavailable' }, 503);
  }
}

export async function joinBroadcast(request: Request, config: RoomConfig, now: number): Promise<Response> {
  const boundary = checkBoundary(request, config);
  if (boundary) return boundary;
  const invite = await credentialBody(request, 'invite');
  if (invite instanceof Response) return invite;
  try {
    const room = await verifyViewerInvite(config.inviteSecret, invite, now);
    if (!room) return json({ error: 'Forbidden' }, 403);
    const token = await issueParticipantToken(config.apiKey, config.apiSecret, room, 'viewer', now);
    return json({ room, livekitUrl: config.livekitUrl, token });
  } catch {
    return json({ error: 'Service unavailable' }, 503);
  }
}
