// Build with VITE_WEBRTC=true first. Uses two synthetic WHIP senders in place of the two OBS PCs.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { createSocket } from 'node:dgram';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCourseApp } from '../server.mjs';
import { addSecondOBS } from './media-config.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir = await mkdtemp(join(tmpdir(), 'group9-obs-'));
async function port(udp = false) {
  const socket = udp ? createSocket('udp4') : createServer();
  if (udp) socket.bind(0, '127.0.0.1'); else socket.listen(0, '127.0.0.1');
  await once(socket, udp ? 'listening' : 'listening'); const result = socket.address().port;
  await new Promise((done) => socket.close(done)); return result;
}
const apiPort = await port(); const webrtcPort = await port(); const udpPort = await port(true);
const secret = randomBytes(32).toString('hex'); const guestSecret = randomBytes(32).toString('hex');
const template = await readFile(new URL('../deploy/mediamtx.yml', import.meta.url), 'utf8');
const config = addSecondOBS(template.replace('REPLACE_WITH_RANDOM_SECRET', secret), guestSecret)
  .replace(/^rtmp: true$/m, 'rtmp: false').replace(/^hls: true$/m, 'hls: false')
  .replace('apiAddress: :9997', `apiAddress: 127.0.0.1:${apiPort}`)
  .replace(/^webrtc: false$/m, `webrtc: true\nwebrtcAddress: 127.0.0.1:${webrtcPort}\nwebrtcLocalUDPAddress: 127.0.0.1:${udpPort}\nwebrtcIPsFromInterfaces: false\nwebrtcAdditionalHosts: [127.0.0.1]`);
const configPath = join(dir, 'media.yml'); await writeFile(configPath, config, { mode: 0o600 });
const mediaExe = process.env.MEDIAMTX || fileURLToPath(new URL('../.runtime/mediamtx/mediamtx.exe', import.meta.url));
const media = spawn(mediaExe, [configPath], { windowsHide: true, stdio: 'ignore' });
const mediaDone = new Promise((resolve) => { media.on('close', resolve); media.on('error', resolve); });
const app = createCourseApp({ dbPath: join(dir, 'live.sqlite'), apiUrl: `http://127.0.0.1:${apiPort}`, webrtcUrl: `http://127.0.0.1:${webrtcPort}`, pollMs: 100, publicOrigin: '' });
const contexts = []; const errors = []; const publishers = [];
let browser;
async function waitUntil(fn, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { try { if (await fn()) return; } catch {} await new Promise((done) => setTimeout(done, 100)); }
  throw new Error('Timed out waiting for media service/state');
}
try {
  await waitUntil(async () => (await fetch(`http://127.0.0.1:${apiPort}/v3/paths/list`)).ok);
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  const url = `http://127.0.0.1:${app.server.address().port}/`;
  async function publish(path, password, color, frequency) {
    const context = await browser.newContext(); contexts.push(context); const tab = await context.newPage();
    await tab.goto(url);
    const offer = await tab.evaluate(async ({ color, frequency }) => {
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
      const ctx = canvas.getContext('2d');
      const timer = setInterval(() => { ctx.fillStyle = color; ctx.fillRect(0, 0, 640, 360); ctx.fillStyle = 'white'; ctx.font = '30px sans-serif'; ctx.fillText(`${color} ${Date.now()}`, 20, 180); }, 33);
      const stream = canvas.captureStream(30);
      const audio = new AudioContext(); await audio.resume(); const tone = audio.createOscillator(); tone.frequency.value = frequency;
      const gain = audio.createGain(); gain.gain.value = 0.05;
      const destination = audio.createMediaStreamDestination(); tone.connect(gain).connect(destination); tone.start(); stream.addTrack(destination.stream.getAudioTracks()[0]);
      const pc = new RTCPeerConnection();
      for (const track of stream.getTracks()) pc.addTrack(track, stream);
      const video = pc.getTransceivers().find((t) => t.sender.track.kind === 'video');
      video.setCodecPreferences(RTCRtpSender.getCapabilities('video').codecs.filter((codec) => codec.mimeType.toLowerCase() === 'video/h264'));
      await pc.setLocalDescription(await pc.createOffer());
      if (pc.iceGatheringState !== 'complete') await new Promise((resolve) => { pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === 'complete') resolve(); }; });
      window.syntheticOBS = { pc, stream, audio, timer };
      return pc.localDescription.sdp;
    }, { color, frequency });
    const endpoint = `http://127.0.0.1:${webrtcPort}/${path}/whip`;
    const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${path === 'live' ? 'broadcaster' : 'guest_broadcaster'}:${password}`).toString('base64')}`, 'Content-Type': 'application/sdp' }, body: offer });
    assert.equal(response.status, 201, 'WHIP publish must authenticate and accept H.264/Opus');
    const session = new URL(response.headers.get('location'), endpoint).href;
    await tab.evaluate(async (sdp) => window.syntheticOBS.pc.setRemoteDescription({ type: 'answer', sdp }), await response.text());
    const publisher = { tab, stop: async () => { await fetch(session, { method: 'DELETE' }); await tab.evaluate(() => { const s = window.syntheticOBS; s.pc.close(); s.stream.getTracks().forEach((t) => t.stop()); clearInterval(s.timer); s.audio.close(); }); } };
    publishers.push(publisher); return publisher;
  }
  async function page(username, role) {
    const context = await browser.newContext(); contexts.push(context);
    await context.addInitScript(() => { const Native = RTCPeerConnection; window.smokePeers = []; window.RTCPeerConnection = class extends Native { constructor(config) { super(config); window.smokePeers.push(this); } }; });
    if (username !== 'SmokeViewer') {
      const response = await context.request.post(url + 'api/account/register', { data: { username, nickname: username, password: 'smoke-password-12345' } }); assert.equal(response.status(), 200);
    }
    if (role) app.store.db.prepare('UPDATE users SET role=? WHERE username=?').run(role, username.toLowerCase());
    const tab = await context.newPage(); tab.on('pageerror', (error) => errors.push(error.message)); await tab.goto(url);
    if (username === 'SmokeViewer') {
      await tab.getByRole('button', { name: '註冊新帳號', exact: true }).click();
      await tab.getByRole('textbox', { name: '帳號', exact: true }).fill(username);
      await tab.getByRole('textbox', { name: '暱稱', exact: true }).fill(username);
      await tab.getByLabel('密碼', { exact: true }).fill('smoke-password-12345');
      await tab.getByRole('button', { name: '建立帳號', exact: true }).click();
    }
    await tab.getByText(`以 ${username}`, { exact: false }).first().waitFor(); return tab;
  }
  const host = await page('SmokeHost', 'host'); const guest = await page('SmokeGuest'); const viewer = await page('SmokeViewer');
  await host.getByLabel('第二台參與者帳號', { exact: true }).fill('SmokeGuest');
  await host.getByRole('checkbox').check(); await host.getByRole('button', { name: '開啟雙 OBS 直播間', exact: true }).click();
  const first = await publish('live', secret, 'navy', 440); let second = await publish('guest', guestSecret, 'darkgreen', 660);
  const playing = (tab, count = 2) => tab.waitForFunction((n) => [...document.querySelectorAll('.duo-grid video')].filter((v) => v.readyState >= 2 && v.videoWidth === 640 && v.currentTime > 0 && v.srcObject?.getAudioTracks().some((t) => t.readyState === 'live')).length === n, count);
  await playing(viewer); await playing(host); await playing(guest);
  const times = await viewer.locator('.duo-grid video').evaluateAll((videos) => videos.map((v) => v.currentTime));
  await viewer.waitForFunction((before) => [...document.querySelectorAll('.duo-grid video')].every((v, i) => v.currentTime > before[i] + 0.5), times);
  assert.equal(await host.locator('.duo-grid video').first().evaluate((v) => v.muted && v.srcObject.getAudioTracks().every((track) => !track.enabled)), true);
  assert.equal(await guest.locator('.duo-grid video').nth(1).evaluate((v) => v.muted && v.srcObject.getAudioTracks().every((track) => !track.enabled)), true);
  console.log('Two authenticated WHIP sources → MediaMTX → two WHEP players: audio/video playing');
  const stats = await viewer.evaluate(async () => {
    const rows = []; for (const pc of window.smokePeers) if (pc.connectionState === 'connected') for (const r of (await pc.getStats()).values()) if (r.type === 'inbound-rtp') rows.push({ kind: r.kind, bytesReceived: r.bytesReceived, ...(r.framesDecoded !== undefined ? { framesDecoded: r.framesDecoded } : {}) }); return rows;
  });
  assert.equal(stats.filter((r) => r.kind === 'audio' && r.bytesReceived > 0).length, 2); assert.equal(stats.filter((r) => r.kind === 'video' && r.framesDecoded >= 5).length, 2);
  await guest.getByRole('textbox', { name: '聊天訊息', exact: true }).fill('雙 OBS 同台測試訊息'); await guest.getByRole('button', { name: '傳送 ↗', exact: true }).click();
  await viewer.locator('.message').filter({ hasText: '雙 OBS 同台測試訊息' }).waitFor();
  await viewer.getByRole('button', { name: '應援 10', exact: true }).click(); await viewer.getByText('示範點數：90', { exact: false }).waitFor();
  await viewer.reload(); await viewer.getByText('示範點數：90', { exact: false }).waitFor(); await playing(viewer);
  await host.reload(); await playing(host); await host.getByText('本場主持人：SmokeHost', { exact: false }).waitFor();
  await host.getByRole('button', { name: '載入／更新管理面板', exact: true }).click(); await host.getByLabel('置頂公告', { exact: true }).fill('同台管理測試公告'); await host.getByRole('button', { name: '儲存聊天室規則', exact: true }).click();
  await viewer.getByText('📌 同台管理測試公告', { exact: true }).waitFor();
  const message = host.locator('.message').filter({ hasText: '雙 OBS 同台測試訊息' }); await message.getByRole('button', { name: '禁言', exact: true }).click();
  await guest.getByRole('textbox', { name: '聊天訊息', exact: true }).fill('不應出現'); await guest.getByRole('button', { name: '傳送 ↗', exact: true }).click(); await guest.getByRole('alert').filter({ hasText: '禁言' }).first().waitFor();
  await message.getByRole('button', { name: '刪除', exact: true }).click(); await viewer.locator('.message').filter({ hasText: '雙 OBS 同台測試訊息' }).waitFor({ state: 'detached' });
  await host.getByRole('button', { name: '查看／更新應援帳本', exact: true }).click(); await host.getByText('主播累計收到 10 點', { exact: false }).waitFor();
  await viewer.getByRole('button', { name: '應援 1', exact: true }).click();
  await host.getByText('主播累計收到 11 點', { exact: false }).waitFor();
  await viewer.setViewportSize({ width: 390, height: 844 }); await mkdir(new URL('../evidence/', import.meta.url), { recursive: true });
  await viewer.screenshot({ path: fileURLToPath(new URL('../evidence/duo-mobile.png', import.meta.url)), fullPage: true }); assert.equal(await viewer.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await second.stop(); await waitUntil(async () => !(await (await fetch(url + 'api/status')).json()).sources.guest.live);
  await playing(viewer, 1); second = await publish('guest', guestSecret, 'darkgreen', 660); await playing(viewer);
  await host.getByRole('button', { name: '結束本場應援記帳', exact: true }).click(); await first.stop(); await second.stop();
  await viewer.waitForFunction(() => [...document.querySelectorAll('.duo-grid video')].every((v) => v.hidden));
  await viewer.getByRole('button', { name: '登出', exact: true }).click(); await viewer.getByRole('textbox', { name: '帳號', exact: true }).fill('SmokeViewer'); await viewer.getByLabel('密碼', { exact: true }).fill('smoke-password-12345'); await viewer.getByRole('button', { name: '登入', exact: true }).click(); await viewer.getByText('示範點數：89', { exact: false }).waitFor();
  assert.deepEqual(errors, []);
  const result = { passed: true, media: 'Two independent synthetic H.264+Opus WHIP publishers → real MediaMTX → two WHEP players in one room', inboundRtp: stats, checked: ['path-specific OBS credentials', 'two video and audio decoders', 'source stop/restart recovery', 'host page reload keeps room and streams', 'UI registration/login/logout', 'persistent balance', 'donation and live host ledger refresh', 'announcement', 'mute', 'delete', '390px layout'], physicalOBS: false, acousticEchoCancellation: false, crossNetwork: false, at: new Date().toISOString() };
  await writeFile(new URL('../evidence/duo-smoke.json', import.meta.url), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result, null, 2));
} finally {
  for (const context of contexts) await context.close(); await browser?.close(); await app.close();
  media.kill(); await mediaDone; await rm(dir, { recursive: true, force: true });
}
