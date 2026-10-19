import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Synthetic test pattern and sine wave verify transport/decoding, not a real OBS camera/microphone.
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:4180';
const privateConfig = await readFile(new URL('../.runtime/mediamtx.yml', import.meta.url), 'utf8');
const password = privateConfig.match(/pass: ([a-f0-9]{64})/)?.[1];
assert.ok(password, 'Run node scripts/configure.mjs first');
function run(args) {
  const process = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', ...args], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '';
  process.stdout.on('data', (data) => { output += data; });
  // Do not print FFmpeg stderr: upstream errors can include the private RTMP URL.
  process.stderr.resume();
  process.done = new Promise((resolve, reject) => { process.on('error', reject); process.on('close', (code) => resolve({ code, output })); });
  return process;
}
async function waitFor(predicate, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error('Timed out waiting for stream state');
}
const state = async () => (await fetch(origin + '/api/status')).json();
assert.equal((await state()).live, false, 'Stop the existing broadcast before running this check');
const publisher = run(['-re', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-g', '30', '-b:v', '2500k', '-c:a', 'aac', '-b:a', '128k', '-f', 'flv', `rtmp://127.0.0.1:1935/live?user=broadcaster&pass=${password}`]);
const readers = [];
try {
  await waitFor(async () => (await state()).live);
  await waitFor(async () => {
    const r = await fetch(origin + '/hls/live/index.m3u8');
    return r.ok && (await r.text()).includes('#EXTM3U');
  });
  console.log('RTMP publisher live; HLS playlist available. Decoding with two independent viewers.');
  for (let i = 0; i < 2; i++) readers.push(run(['-i', origin + '/hls/live/index.m3u8', '-t', '3', '-map', '0:v:0', '-map', '0:a:0', '-progress', 'pipe:1', '-f', 'null', '-']));
  const results = await Promise.race([
    Promise.all(readers.map((r) => r.done)),
    new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Media decode timed out')), 45000); timer.unref(); }),
  ]);
  const frames = results.map((result) => {
    assert.equal(result.code, 0, 'Both audio/video tracks must decode');
    const count = Math.max(...[...result.output.matchAll(/frame=(\d+)/g)].map((m) => Number(m[1])));
    assert.ok(count >= 60, 'Expected at least 60 decoded video frames');
    return count;
  });
  console.log(`Two audio/video decode checks passed: ${frames.join(', ')} frames.`);
  const hold = Math.min(300, Math.max(0, Number(process.env.TEST_HOLD_SECONDS || 0)));
  if (hold) { console.log(`Holding the synthetic stream for ${hold}s of browser QA.`); await new Promise((done) => setTimeout(done, hold * 1000)); }
  publisher.stdin.write('q');
  await publisher.done;
  await waitFor(async () => !(await state()).live);
  const report = { at: new Date().toISOString(), source: 'synthetic 720p30 H.264 + 48kHz AAC', liveStatus: true, hlsPlaylist: true, independentAudioVideoDecoders: 2, frames, offlineAfterStop: true, realOBS: false, azure: false };
  await writeFile(new URL('../.runtime/media-smoke.json', import.meta.url), JSON.stringify(report, null, 2));
  console.log('MEDIA_SMOKE_PASS: live, HLS, two A/V decoders, offline after stop. Evidence: .runtime/media-smoke.json');
} finally {
  if (publisher.exitCode === null) publisher.kill();
  for (const reader of readers) if (reader.exitCode === null) reader.kill();
}
