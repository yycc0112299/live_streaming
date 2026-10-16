import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import WebSocket, { WebSocketServer } from 'ws';
import { RoomRegistry } from './rooms.mjs';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
]);

export function createApp() {
  const rooms = new RoomRegistry();
  const connections = new Map();
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (request.method !== 'GET') {
      response.writeHead(405).end('Method not allowed');
      return;
    }
    if (pathname === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ status: 'ok' }));
      return;
    }
    const file = files.get(pathname);
    if (!file) {
      response.writeHead(404).end('Not found');
      return;
    }
    try {
      const body = await readFile(join(publicDir, file[0]));
      response.writeHead(200, { 'Content-Type': file[1] }).end(body);
    } catch {
      response.writeHead(500).end('Unable to load page');
    }
  });
  const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });

  function send(ws, message) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  }

  function leave(ws, acknowledge = false) {
    const departure = rooms.leave(ws);
    if (!departure) return;
    if (departure.role === 'host') {
      for (const viewer of departure.viewers) send(viewer, { type: 'room_closed' });
    } else {
      send(departure.room.host, { type: 'viewer_left', viewerId: ws.peerId });
    }
    if (acknowledge) send(ws, { type: 'left_room' });
  }

  wss.on('connection', (ws) => {
    ws.peerId = randomUUID();
    connections.set(ws.peerId, ws);
    send(ws, { type: 'welcome', id: ws.peerId });

    ws.on('message', (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
        if (!message || typeof message !== 'object' || Array.isArray(message)) throw new Error('Invalid message');
      } catch {
        send(ws, { type: 'error', code: 'bad_message', message: 'Invalid JSON message' });
        return;
      }

      const member = rooms.membership(ws);
      switch (message.type) {
        case 'create_room': {
          if (member) return send(ws, { type: 'error', code: 'already_in_room' });
          const title = String(message.title ?? '').trim().slice(0, 80) || 'Untitled live room';
          const room = rooms.create(ws, title);
          send(ws, { type: 'room_created', roomId: room.id, title });
          break;
        }
        case 'join_room': {
          if (member) return send(ws, { type: 'error', code: 'already_in_room' });
          const roomId = String(message.roomId ?? '').toLowerCase();
          const room = rooms.join(roomId, ws);
          if (!room) return send(ws, { type: 'error', code: 'room_not_found', message: 'Room not found or ended' });
          send(ws, { type: 'room_joined', roomId, title: room.title, hostId: room.host.peerId });
          send(room.host, { type: 'viewer_joined', viewerId: ws.peerId, viewerCount: room.viewers.size });
          break;
        }
        case 'signal': {
          if (!member || typeof message.targetId !== 'string' || !message.data || typeof message.data !== 'object') break;
          const target = connections.get(message.targetId);
          const targetMember = target && rooms.membership(target);
          if (!targetMember || targetMember.roomId !== member.roomId || targetMember.role === member.role) break;
          send(target, { type: 'signal', fromId: ws.peerId, data: message.data });
          break;
        }
        case 'chat': {
          if (!member || typeof message.text !== 'string') break;
          const text = message.text.trim().slice(0, 500);
          if (!text) break;
          const room = rooms.get(member.roomId);
          for (const connection of [room.host, ...room.viewers]) {
            send(connection, { type: 'chat', fromId: ws.peerId, role: member.role, text });
          }
          break;
        }
        case 'leave_room':
          leave(ws, true);
          break;
        default:
          send(ws, { type: 'error', code: 'unknown_type', message: 'Unknown message type' });
      }
    });

    ws.on('close', () => {
      leave(ws);
      connections.delete(ws.peerId);
    });
  });

  return { server, wss, rooms };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT) || 4173;
  const app = createApp();
  app.server.listen(port, '127.0.0.1', () => {
    console.log(`Live Streaming Platform ready at http://127.0.0.1:${port}`);
  });
}
