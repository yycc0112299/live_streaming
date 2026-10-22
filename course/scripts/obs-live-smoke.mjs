// Actual local OBS source toggle test; restores source states and never stops the stream.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createCourseApp } from '../server.mjs';
import { io } from 'socket.io-client';
const app = createCourseApp({ dbPath: ':memory:', pollMs: 60000 });
app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
const user = app.store.guest(), guest = app.store.guest();
app.store.start(user.id, guest.username);
const token = app.store.newSession(user.id);
const url = `http://127.0.0.1:${app.server.address().port}`;
const browser = io(url, { transports: ['websocket'], extraHeaders: { Cookie: `group9_session=${token}` }, reconnection: false });
await once(browser, 'connect');
const command = async (value) => { const result = await browser.timeout(10000).emitWithAck('obs:control', value); if (result.error) throw Error(result.error); return result; };
const pair = await browser.timeout(5000).emitWithAck('obs:pair');
const agent = spawn(process.execPath, ['scripts/obs-controller.mjs', url, pair.code], { cwd: new URL('../', import.meta.url), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let initial;
try {
  await new Promise((resolve, reject) => { const timer=setTimeout(()=>reject(Error('Controller startup timed out')),10000); agent.stdout.once('data',()=>{clearTimeout(timer);resolve();}); agent.once('exit',()=>{clearTimeout(timer);reject(Error('Controller exited'));}); });
  initial = await command({ action: 'status' });
  assert.equal(typeof initial.microphone, 'boolean'); assert.equal(typeof initial.camera, 'boolean');
  assert.equal((await command({ action: 'microphone', enabled: false })).microphone, false);
  assert.equal((await command({ action: 'camera', enabled: false })).camera, false);
  assert.equal((await command({ action: 'microphone', enabled: initial.microphone })).microphone, initial.microphone);
  assert.equal((await command({ action: 'camera', enabled: initial.camera })).camera, initial.camera);
  assert.equal((await command({ action: 'status' })).streaming, initial.streaming);
  console.log(JSON.stringify({ passed: true, actualOBS: true, microphoneToggle: true, cameraToggle: true, restored: true, streamWasStopped: false }));
} finally {
  try { if (initial) { await command({ action: 'microphone', enabled: initial.microphone }); await command({ action: 'camera', enabled: initial.camera }); } }
  finally { agent.kill(); browser.disconnect(); await app.close(); }
}
