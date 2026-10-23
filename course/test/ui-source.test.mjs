import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');

test('viewer UI keeps normal chat silent, Enter-native, and exposes all gift and broadcaster controls', () => {
  assert.match(source, /<input id="message"/);
  assert.doesNotMatch(source, /setOverlay\(\{ type: 'chat'/);
  assert.match(source, /一般聊天不會朗讀/);
  assert.match(source, /GIFTS\.map/);
  assert.match(source, /<OBSControls/);
});
