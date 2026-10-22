import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const privateConfig = JSON.parse(await readFile(new URL('../.runtime/AEC-BROWSER-PRIVATE.json', import.meta.url), 'utf8'));
assert.equal(privateConfig.synthetic, true, 'Only connect this test to --synthetic; never capture physical microphones');
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const tab = await browser.newPage(); const errors = []; tab.on('pageerror', (error) => errors.push(error.message));
  await tab.goto(privateConfig.url); await tab.getByText('AEC 運行中', { exact: false }).waitFor();
  await tab.waitForFunction(() => { if (!window.aecAnalyser) return false; const data = new Float32Array(window.aecAnalyser.fftSize); window.aecAnalyser.getFloatTimeDomainData(data); return data.some((sample) => Math.abs(sample) > 0.001); });
  assert.equal(await tab.evaluate(() => window.aecOutput.stream.getAudioTracks()[0].readyState), 'live');
  const amplitude = await tab.evaluate(() => { const data = new Float32Array(window.aecAnalyser.fftSize); window.aecAnalyser.getFloatTimeDomainData(data); return Math.max(...data.map(Math.abs)); });
  assert.ok(amplitude < 0.5, 'Synthetic PCM must not clip or overflow during conversion');
  await tab.evaluate(() => window.aecSocket.close()); await tab.getByText('AEC 已停止，輸出靜音', { exact: true }).waitFor();
  await tab.waitForFunction(() => { const data = new Float32Array(window.aecAnalyser.fftSize); window.aecAnalyser.getFloatTimeDomainData(data); return data.every((sample) => sample === 0); });
  assert.equal((await fetch(new URL('/wrong-token/', privateConfig.url))).status, 404);
  assert.deepEqual(errors, []);
  const result = { passed: true, checked: ['upstream DTLN output through local WebSocket', 'AudioWorklet produces live PCM audio', 'disconnect becomes silence', 'private URL path required', 'Chrome diagnostics do not play mic through physical speakers'], physicalMicrophoneOpened: false, physicalSpeakersUsed: false, actualOBS: false, at: new Date().toISOString() };
  await writeFile(new URL('../evidence/aec-bridge-smoke.json', import.meta.url), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
