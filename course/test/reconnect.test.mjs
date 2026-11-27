import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// BrowserBroadcast.jsx is a browser component (JSX), so check its retry policy numbers
// directly from the source instead of importing it into Node.
const source = readFileSync(new URL('../src/BrowserBroadcast.jsx', import.meta.url), 'utf8');
const retryDelay = new Function(`return ${/export const retryDelay = (.*);/.exec(source)[1]}`)();
const maxRetries = Number(/export const MAX_RETRIES = (\d+);/.exec(source)[1]);

test('phone/browser broadcasts reconnect with exponential back-off capped at 15 s', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 12].map(retryDelay), [1000, 2000, 4000, 8000, 15000, 15000, 15000]);
  assert.equal(maxRetries, 12);
  const total = Array.from({ length: maxRetries }, (_, i) => retryDelay(i + 1)).reduce((a, b) => a + b, 0);
  assert.ok(total > 120000 && total < 180000, 'keeps trying for about 2–3 minutes, inside the 3-minute idle release');
  assert.match(source, /addEventListener\('online'/, 'retries at once when the device is back online');
  assert.match(source, /pcState === 'failed'\) scheduleReconnect/);
});
