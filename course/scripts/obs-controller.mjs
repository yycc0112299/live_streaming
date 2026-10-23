// Run on each publisher computer. OBS credentials remain on that computer.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { io } from 'socket.io-client';
import { controlOBS } from './obs-actions.mjs';
const [site, code] = process.argv.slice(2);
const url = new URL(site);
if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) || !/^[a-f0-9]{48}$/.test(code || '')) throw Error('Use HTTPS (or localhost), plus the one-time pairing code from your broadcaster page.');
const config = JSON.parse(await readFile(join(process.env.APPDATA, 'obs-studio/plugin_config/obs-websocket/config.json'), 'utf8'));
const ws = new WebSocket(`ws://127.0.0.1:${config.server_port}`);
const pending = new Map(); let sequence = 0;
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(Error('OBS connection timed out')), 5000);
  ws.addEventListener('error', () => { clearTimeout(timer); reject(Error('Enable OBS local WebSocket server first')); });
  ws.addEventListener('message', ({ data }) => {
    const { op, d } = JSON.parse(data);
    if (op === 0) {
      const hello = { rpcVersion: 1 };
      if (d.authentication) { const secret = createHash('sha256').update(config.server_password + d.authentication.salt).digest('base64'); hello.authentication = createHash('sha256').update(secret + d.authentication.challenge).digest('base64'); }
      ws.send(JSON.stringify({ op: 1, d: hello }));
    } else if (op === 2) { clearTimeout(timer); resolve(); }
    else if (op === 7) { const request = pending.get(d.requestId); if (!request) return; pending.delete(d.requestId); clearTimeout(request.timer); if (d.requestStatus.result) request.resolve(d.responseData || {}); else request.reject(Error(d.requestStatus.comment || 'OBS rejected command')); }
  });
});
function request(requestType, requestData = {}) {
  return new Promise((resolve, reject) => {
    const requestId = String(++sequence); const timer = setTimeout(() => { pending.delete(requestId); reject(Error('OBS request timed out')); }, 5000);
    pending.set(requestId, { resolve, reject, timer }); ws.send(JSON.stringify({ op: 6, d: { requestId, requestType, requestData } }));
  });
}
const socket = io(url.origin, { path: `${url.pathname.replace(/\/$/, '')}/socket.io`, transports: ['websocket'], auth: { obsPair: code }, reconnection: false });
let path;
socket.on('obs:bound', (value) => { path = value.path; console.log(`Local OBS controls connected for ${path}. Keep this terminal running.`); });
socket.on('obs:execute', async (value, ack) => {
  try { if (!path) throw Error('Controller not paired'); ack(await controlOBS(request, path, value)); }
  catch (error) { ack({ error: error.message }); }
});
socket.on('obs:error', (message) => console.error(message));
socket.on('connect_error', () => { console.error('Cannot reach course website'); ws.close(); });
socket.on('disconnect', () => { ws.close(); });
ws.addEventListener('close', () => { socket.disconnect(); for (const request of pending.values()) { clearTimeout(request.timer); request.reject(Error('OBS disconnected')); } pending.clear(); });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { socket.disconnect(); ws.close(); });
