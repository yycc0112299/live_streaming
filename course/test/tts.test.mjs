import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSSML, createTTS } from '../tts.mjs';
import { VOICES } from '../voices.mjs';

test('voice-message SSML escapes user text and applies the configured neural voice and style', () => {
  const ssml = buildSSML('主播<好>&"棒"', { voice: 'zh-CN-XiaoxiaoMultilingualNeural', style: 'excited' });
  assert.match(ssml, /xml:lang="zh-CN"/);
  assert.match(ssml, /<voice name="zh-CN-XiaoxiaoMultilingualNeural">/);
  assert.match(ssml, /<mstts:express-as style="excited">主播&lt;好&gt;&amp;&quot;棒&quot;<\/mstts:express-as>/);
  assert.doesNotMatch(buildSSML('嗨', { voice: 'zh-TW-HsiaoChenNeural', style: '' }), /express-as/);
});

test('each voice message is synthesized once, retried once, cached, and disabled without a key', async () => {
  const calls = [];
  let fail = 1;
  const fetchImpl = async (url, options) => {
    calls.push([url, options.headers['Ocp-Apim-Subscription-Key'], options.body]);
    if (fail-- > 0) return new Response('busy', { status: 429 });
    return new Response(new Uint8Array([0x49, 0x44, 0x33, 1, 2, 3]), { status: 200 });
  };
  const tts = createTTS({ key: 'test-key', region: 'japaneast', fetchImpl, maxCached: 2 });
  const id = '12345678-1234-1234-1234-123456789abc';
  assert.equal(tts.prepare(id, '謝謝主播', 'hsiaochen'), true);
  const audio = await tts.audio(id);
  assert.deepEqual([...audio], [0x49, 0x44, 0x33, 1, 2, 3]);
  assert.equal(calls.length, 2, 'one retry after a failed request');
  assert.equal(calls[0][0], 'https://japaneast.tts.speech.microsoft.com/cognitiveservices/v1');
  assert.equal(calls[0][1], 'test-key');
  assert.match(calls[0][2], /zh-TW-HsiaoChenNeural/, 'donor-chosen voice');
  await tts.audio(id); assert.equal(calls.length, 2, 'served from cache');
  tts.prepare('a', 'x'); tts.prepare('b', 'y');
  assert.equal(await tts.audio(id), null, 'oldest entry evicted');
  calls.length = 0;
  tts.prepare('c', '嗨', 'not-a-voice'); await tts.audio('c');
  assert.match(calls[0][2], /zh-CN-XiaoxiaoMultilingualNeural/); assert.match(calls[0][2], /style="excited"/, 'unknown voice falls back to the default');
  calls.length = 0;
  await tts.preview('yunjian'); await tts.preview('yunjian');
  assert.equal(calls.length, 1, 'previews are synthesized once and cached'); assert.match(calls[0][2], /sports-commentary-excited/);
  assert.equal(await tts.preview('../etc'), null);
  for (const v of VOICES) assert.match(v.voice, /^zh-(TW|CN)-\w+Neural$/);
  const off = createTTS({ key: '', fetchImpl });
  assert.equal(off.enabled, false); assert.equal(off.prepare(id, '嗨'), false);
});
