import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

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
  await writeFile(resolve(root, '.runtime/OBS-PRIVATE.txt'), `OBS Settings > Stream\nService: Custom\nServer: rtmp://127.0.0.1:1935\nStream key: live?user=broadcaster&pass=${secret}\nVideo: H.264, 1280x720, 30 FPS, keyframe interval 1 s, CBR 2500 Kbps\nAudio: AAC, 48 kHz, 128 Kbps\nKeep this file private. Do not commit, share, or screenshot the stream key.\n`, { mode: 0o600 });
  console.log('Private media configuration and .runtime/OBS-PRIVATE.txt created; no secrets printed.');
}
