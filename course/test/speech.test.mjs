import test from 'node:test';
import assert from 'node:assert/strict';
import { bestVoice, splitSentences } from '../src/speech.js';

const v = (name, lang, localService = true) => ({ name, lang, localService });

test('voice messages use the most natural Mandarin voice the browser offers', () => {
  const chromeWindows = [v('Microsoft Hanhan - Chinese (Traditional, Taiwan)', 'zh-TW'), v('Microsoft Zhiwei - Chinese (Traditional, Taiwan)', 'zh-TW'), v('Google 普通话（中国大陆）', 'zh-CN', false), v('Google 國語（臺灣）', 'zh-TW', false), v('Google US English', 'en-US', false)];
  assert.equal(bestVoice(chromeWindows).name, 'Google 國語（臺灣）');
  const edge = [...chromeWindows, v('Microsoft HsiaoChen Online (Natural) - Chinese (Taiwan)', 'zh-TW', false), v('Microsoft YunJhe Online (Natural) - Chinese (Taiwan)', 'zh-TW', false)];
  assert.equal(bestVoice(edge).name, 'Microsoft HsiaoChen Online (Natural) - Chinese (Taiwan)');
  assert.equal(bestVoice([v('Meijia', 'zh-TW'), v('Tingting', 'zh-CN')]).name, 'Meijia');
  assert.equal(bestVoice([v('Samantha', 'en-US')]), null, 'no Mandarin voice: let the browser choose by lang');
});

test('long messages are spoken sentence by sentence so cloud voices do not cut off', () => {
  assert.deepEqual(splitSentences('哈囉！'), ['哈囉！']);
  const parts = splitSentences('主播你好，今天的直播超好看！我從台南來看的，請問明天幾點開播？還有那台跑車好帥，可以再放一次嗎？謝謝你們。');
  assert.ok(parts.length >= 2);
  assert.equal(parts.join(''), '主播你好，今天的直播超好看！我從台南來看的，請問明天幾點開播？還有那台跑車好帥，可以再放一次嗎？謝謝你們。');
  for (const p of parts) assert.ok(p.length <= 45, p);
});
