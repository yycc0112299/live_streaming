import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { addSecondOBS } from './media-config.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = process.argv.includes('--docker') ? resolve(root, 'deploy/mediamtx.private.yml') : resolve(root, '.runtime/mediamtx.yml');
await mkdir(resolve(root, '.runtime'), { recursive: true });
try { await access(target); console.log('Existing private configuration preserved.'); }
catch {
  const secret = randomBytes(32).toString('hex');
  let config = await readFile(resolve(root, 'deploy/mediamtx.yml'), 'utf8');
  config = config.replace('REPLACE_WITH_RANDOM_SECRET', secret);
  if (!process.argv.includes('--docker')) config = config.replace('rtmpAddress: :1935', 'rtmpAddress: 127.0.0.1:1935').replace('hlsAddress: :8888', 'hlsAddress: 127.0.0.1:8888').replace('apiAddress: :9997', 'apiAddress: 127.0.0.1:9997');
  await writeFile(target, config, { flag: 'wx', mode: 0o600 });
  await writeFile(resolve(root, process.argv.includes('--docker') ? '.runtime/OBS-DOCKER-PRIVATE.txt' : '.runtime/OBS-PRIVATE.txt'), `OBS Settings > Stream\nService: Custom\nServer: rtmp://127.0.0.1:1935\nStream key: live?user=broadcaster&pass=${secret}\nVideo: H.264, 1280x720, 60 FPS, keyframe interval 1 s, CBR 700 Kbps\nAudio: AAC, 48 kHz, 128 Kbps\nKeep this file private. Do not commit, share, or screenshot the stream key.\n`, { mode: 0o600 });
  console.log('Private media configuration and .runtime/OBS-PRIVATE.txt created; no secrets printed.');
}

let activeTarget = target;
if (process.argv.includes('--duo')) {
  activeTarget = process.argv.includes('--docker') ? resolve(root, 'deploy/mediamtx.duo.private.yml') : resolve(root, '.runtime/mediamtx.duo.yml');
  try { await access(activeTarget); console.log('Existing dual OBS configuration preserved.'); }
  catch {
    const guestFile = resolve(root, process.argv.includes('--docker') ? '.runtime/OBS-GUEST-DOCKER-PRIVATE.txt' : '.runtime/OBS-GUEST-PRIVATE.txt');
    const hasGuestFile = await access(guestFile).then(() => true, (error) => { if (error.code === 'ENOENT') return false; throw error; });
    if (hasGuestFile) throw new Error('Second OBS credential file exists without its configuration; restore the matching config before retrying.');
    const secret = randomBytes(32).toString('hex');
    const config = addSecondOBS(await readFile(target, 'utf8'), secret);
    await writeFile(activeTarget, config, { flag: 'wx', mode: 0o600 });
    await writeFile(guestFile, `Second OBS computer only\nRTMP server: rtmp://127.0.0.1:1935\nStream key: guest?user=guest_broadcaster&pass=${secret}\nWHIP server: http://127.0.0.1:8889/guest/whip\nWHIP Bearer Token: guest_broadcaster:${secret}\nUse an SSH tunnel to the same server. WHIP: H.264 + Opus. RTMP: H.264 + AAC.\nDo not share or commit this file. The first computer keeps its existing live credentials.\n`, { flag: 'wx', mode: 0o600 });
    console.log('Second OBS credentials created privately; original live configuration preserved.');
  }
}
if (process.argv.includes('--webrtc')) {
  if (process.argv.includes('--docker')) throw new Error('WebRTC local trial does not support --docker');
  const config = (await readFile(activeTarget, 'utf8')).replace(/^webrtc: false$/m,
    'webrtc: true\nwebrtcAddress: 127.0.0.1:8889\nwebrtcLocalUDPAddress: 127.0.0.1:8189\nwebrtcIPsFromInterfaces: false\nwebrtcAdditionalHosts: [127.0.0.1]');
  if (!config.includes('webrtcAddress: 127.0.0.1:8889')) throw new Error('Expected the original local HLS configuration');
  await writeFile(resolve(root, process.argv.includes('--duo') ? '.runtime/mediamtx.duo.webrtc.yml' : '.runtime/mediamtx.webrtc.yml'), config, { mode: 0o600 });
  console.log('Local WebRTC trial configuration created; original HLS configuration preserved.');
}
