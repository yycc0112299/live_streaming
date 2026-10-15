export interface LocalTrackLike { stop(): void }
export interface LiveKitRoomLike {
  connect(url: string, token: string): Promise<unknown>;
  disconnect(): Promise<unknown>;
  localParticipant: { publishTrack(track: LocalTrackLike): Promise<unknown> };
}
export type TrackFactory = () => Promise<LocalTrackLike[]>;
type Session = { stopped: boolean; tracks: LocalTrackLike[] };
const sessions = new WeakMap<LiveKitRoomLike, Session>();

function checkActive(session: Session) {
  if (session.stopped) throw new Error('Session stopped');
}

export async function startHostSession(room: LiveKitRoomLike, url: string, token: string, createLocalTracks: TrackFactory): Promise<void> {
  const session: Session = { stopped: false, tracks: [] };
  sessions.set(room, session);
  try {
    await room.connect(url, token);
    if (session.stopped) await room.disconnect();
    checkActive(session);
    const tracks = await createLocalTracks();
    if (session.stopped) {
      for (const track of tracks) track.stop();
      checkActive(session);
    }
    session.tracks = tracks;
    for (const track of tracks) {
      checkActive(session);
      await room.localParticipant.publishTrack(track);
    }
    checkActive(session);
  } catch (error) {
    await stopSession(room);
    throw error;
  }
}

export async function joinViewerSession(room: LiveKitRoomLike, url: string, token: string): Promise<void> {
  const session: Session = { stopped: false, tracks: [] };
  sessions.set(room, session);
  try {
    await room.connect(url, token);
    if (session.stopped) await room.disconnect();
    checkActive(session);
  } catch (error) {
    await stopSession(room);
    throw error;
  }
}

export async function stopSession(room: LiveKitRoomLike): Promise<void> {
  const session = sessions.get(room);
  if (session?.stopped) return;
  if (session) {
    session.stopped = true;
    for (const track of session.tracks) track.stop();
    session.tracks = [];
  } else {
    sessions.set(room, { stopped: true, tracks: [] });
  }
  await room.disconnect();
}

export async function leaveSession<T extends LiveKitRoomLike>(refs: {
  operation: { current: number };
  request: { current: AbortController | null };
  room: { current: T | null };
}, resetView: () => void): Promise<void> {
  // Invalidate callbacks and unlock the restored page before disconnect can await.
  refs.operation.current += 1;
  const request = refs.request.current;
  refs.request.current = null;
  const room = refs.room.current;
  refs.room.current = null;
  request?.abort();
  resetView();
  if (room) await stopSession(room);
}

export const MAX_CHAT_BYTES = 500;
export function decodeChatPayload(bytes: Uint8Array): string | null {
  if (!bytes.byteLength || bytes.byteLength > MAX_CHAT_BYTES) return null;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (!text.trim() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) return null;
    return text;
  } catch { return null; }
}

export function inviteFromInput(value: string): string {
  const input = value.trim();
  const hash = input.startsWith('#') ? input : input.includes('://') ? input.slice(input.indexOf('#') < 0 ? input.length : input.indexOf('#')) : null;
  if (hash === null) return input;
  if (!hash.startsWith('#invite=')) return '';
  try { return decodeURIComponent(hash.slice('#invite='.length)); } catch { return ''; }
}
