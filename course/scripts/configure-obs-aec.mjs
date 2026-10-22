// OBS WebSocket v5, using Node's built-in WebSocket; credentials stay in OBS's local config.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const name = 'Group9 AEC Microphone';
const backupPath = new URL('../.runtime/obs-aec-backup.json', import.meta.url);
const config = JSON.parse(await readFile(join(process.env.APPDATA, 'obs-studio/plugin_config/obs-websocket/config.json'), 'utf8'));
const ws = new WebSocket(`ws://127.0.0.1:${config.server_port}`);
const pending = new Map(); let sequence = 0; let peak = 0; let levels = [];
const ready = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('OBS connection timed out')), 5000);
  ws.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Open OBS and enable its local WebSocket server first.')); });
  ws.addEventListener('message', ({ data }) => {
    const { op, d } = JSON.parse(data);
    if (op === 0) {
      const hello = { rpcVersion: 1, eventSubscriptions: 65536 };
      if (d.authentication) {
        const secret = createHash('sha256').update(config.server_password + d.authentication.salt).digest('base64');
        hello.authentication = createHash('sha256').update(secret + d.authentication.challenge).digest('base64');
      }
      ws.send(JSON.stringify({ op: 1, d: hello }));
    } else if (op === 2) { clearTimeout(timeout); resolve(); }
    else if (op === 7) {
      const request = pending.get(d.requestId); if (!request) return;
      clearTimeout(request.timer); pending.delete(d.requestId);
      if (d.requestStatus.result) request.resolve(d.responseData || {});
      else request.reject(new Error(`OBS ${d.requestType}: ${d.requestStatus.comment || d.requestStatus.code}`));
    } else if (op === 5 && d.eventType === 'InputVolumeMeters') {
      for (const input of d.eventData.inputs) if (input.inputName === name) { levels = input.inputLevelsMul; for (const level of levels) peak = Math.max(peak, level[0], level[1]); }
    }
  });
});
function request(requestType, requestData = {}) {
  return new Promise((resolve, reject) => {
    const requestId = String(++sequence);
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`OBS ${requestType} timed out`)); }, 5000);
    pending.set(requestId, { resolve, reject, timer });
    ws.send(JSON.stringify({ op: 6, d: { requestId, requestType, requestData } }));
  });
}
async function restore(backup) {
  for (const input of backup.mutes) await request('SetInputMute', { inputName: input.name, inputMuted: input.muted });
  if (backup.previous) await request('SetInputSettings', { inputName: name, inputSettings: backup.previous, overlay: false });
  else if ((await request('GetInputList')).inputs.some((input) => input.inputName === name)) await request('RemoveInput', { inputName: name });
}
try {
  await ready;
  for (const type of ['GetStreamStatus', 'GetRecordStatus']) if ((await request(type)).outputActive) throw new Error('Stop streaming and recording before changing OBS audio.');
  let backup = await readFile(backupPath, 'utf8').then(JSON.parse).catch((error) => { if (error.code !== 'ENOENT') throw error; return null; });
  if (process.argv.includes('--restore')) {
    if (!backup || backup.restored) throw new Error('No active OBS AEC backup.');
    await restore(backup); backup.restored = true; await writeFile(backupPath, JSON.stringify(backup), { mode: 0o600 });
    console.log('Original OBS input mutes and AEC source restored.');
  } else {
    const privateConfig = JSON.parse(await readFile(new URL('../.runtime/AEC-BROWSER-PRIVATE.json', import.meta.url), 'utf8'));
    if (process.argv.includes('--test') && !privateConfig.synthetic) throw new Error('--test requires a synthetic bridge; no physical microphones will be opened');
    const url = new URL(privateConfig.url);
    if (url.origin !== 'http://127.0.0.1:47660' || !/^\/[a-f0-9]{48}\/$/.test(url.pathname) || !(await fetch(url)).ok) throw new Error('Start the local AEC bridge first.');
    const scene = (await request('GetCurrentProgramScene')).currentProgramSceneName;
    const inputs = (await request('GetInputList')).inputs;
    const scoped = new Set(Object.values(await request('GetSpecialInputs')).filter(Boolean));
    async function visit(sceneName, group = false) {
      const { sceneItems } = await request(group ? 'GetGroupSceneItemList' : 'GetSceneItemList', { sceneName });
      for (const item of sceneItems) { scoped.add(item.sourceName); if (item.isGroup) await visit(item.sourceName, true); }
    }
    await visit(scene);
    const raw = inputs.filter((input) => scoped.has(input.inputName) && ['wasapi_input_capture', 'wasapi_output_capture', 'wasapi_process_output_capture'].includes(input.inputKind));
    if (!backup || backup.restored) {
      backup = { scene, mutes: [], previous: inputs.some((input) => input.inputName === name) ? (await request('GetInputSettings', { inputName: name })).inputSettings : null };
      for (const input of raw) backup.mutes.push({ name: input.inputName, muted: (await request('GetInputMute', { inputName: input.inputName })).inputMuted });
      await writeFile(backupPath, JSON.stringify(backup), { mode: 0o600 });
    }
    try {
      const settings = { url: privateConfig.url, width: 1, height: 1, reroute_audio: true, shutdown: false, restart_when_active: false, css: 'body{background:transparent;color:transparent}button{display:none}' };
      if (!inputs.some((input) => input.inputName === name)) await request('CreateInput', { sceneName: scene, inputName: name, inputKind: 'browser_source', inputSettings: settings, sceneItemEnabled: true });
      else await request('SetInputSettings', { inputName: name, inputSettings: settings, overlay: true });
      await request('SetInputAudioMonitorType', { inputName: name, monitorType: 'OBS_MONITORING_TYPE_NONE' });
      await request('SetInputMute', { inputName: name, inputMuted: false });
      for (const input of raw) await request('SetInputMute', { inputName: input.inputName, inputMuted: true });
      const readback = await request('GetInputSettings', { inputName: name });
      if (!readback.inputSettings.reroute_audio) throw new Error('OBS did not enable routed browser audio');
      const readyBy = Date.now() + 10000; let running;
      do {
        running = await (await fetch(new URL('./status', url))).json();
        if (running.running && running.frames > 10) break;
        await new Promise((done) => setTimeout(done, 100));
      } while (Date.now() < readyBy);
      if (!running.running || running.frames <= 10) throw new Error('OBS source did not start the local AEC capture pipeline');
      if (process.argv.includes('--test')) {
        await new Promise((done) => setTimeout(done, 2000)); peak = 0;
        await new Promise((done) => setTimeout(done, 500));
        const end = Date.now() + 10000;
        while (Date.now() < end && peak < 0.001) await new Promise((done) => setTimeout(done, 100));
        if (peak < 0.001) throw new Error('OBS did not receive the synthetic AEC audio');
        if (peak > 0.5) throw new Error(`Synthetic AEC level is unexpectedly high: ${JSON.stringify({ peak, levels, volume: await request('GetInputVolume', { inputName: name }) })}`);
        const result = { passed: true, actualOBSBrowserSource: true, rerouteAudio: true, monitorType: 'NONE', peak, levels, rawMicrophonesAndDesktopInputsMuted: raw.length, source: 'synthetic AEC; no hardware microphone capture', at: new Date().toISOString() };
        await mkdir(new URL('../evidence/', import.meta.url), { recursive: true });
        await writeFile(new URL('../evidence/aec-obs-smoke.json', import.meta.url), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result, null, 2));
      } else console.log('OBS now uses Group9 AEC Microphone; original mic/desktop inputs are muted. Backup is private; --restore reverses these changes.');
    } catch (error) { await restore(backup); backup.restored = true; await writeFile(backupPath, JSON.stringify(backup), { mode: 0o600 }); throw error; }
  }
} finally {
  for (const request of pending.values()) clearTimeout(request.timer);
  ws.close();
}
