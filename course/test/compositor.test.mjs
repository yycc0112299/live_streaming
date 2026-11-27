import test from 'node:test';
import assert from 'node:assert/strict';
import { fitRect, pipRect, needsCamera, needsScreen, PC_LAYOUTS } from '../src/compositor.js';

test('PC broadcast layouts open only the sources they show', () => {
  assert.deepEqual(PC_LAYOUTS.map((l) => [l, needsCamera(l), needsScreen(l)]), [['camera', true, false], ['both', true, true], ['screen', false, true]]);
});

test('screens are letterboxed, cameras are cropped, and the picture-in-picture stays inside the frame', () => {
  const full = { x: 0, y: 0, w: 1280, h: 720 };
  const ultrawide = fitRect(3440, 1440, full, false); // contain
  assert.equal(Math.round(ultrawide.w), 1280); assert.ok(ultrawide.h < 720 && ultrawide.y > 0);
  const phoneCam = fitRect(720, 1280, full, true); // cover
  assert.equal(Math.round(phoneCam.w), 1280); assert.ok(phoneCam.h > 720 && phoneCam.y < 0);
  const p = pipRect(1280, 720);
  assert.ok(p.x > 640 && p.y > 360, 'bottom-right');
  assert.ok(p.x + p.w <= 1280 && p.y + p.h <= 720);
  assert.equal(Math.round(p.w / p.h * 9), 16);
});
