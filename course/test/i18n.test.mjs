import assert from 'node:assert/strict';
import test from 'node:test';
import { preferredLanguage, translate } from '../src/i18n.mjs';

test('language preference is safe and common chat feedback changes with the selected language', () => {
  assert.equal(preferredLanguage({ getItem: () => 'en' }), 'en');
  assert.equal(preferredLanguage({ getItem: () => 'unknown' }), 'zh');
  assert.equal(preferredLanguage({ getItem: () => { throw new Error('storage disabled'); } }), 'zh');
  assert.equal(translate('zh', '即時聊天室'), '即時聊天室');
  assert.equal(translate('en', '即時聊天室'), 'Live chat');
  assert.equal(translate('en', '訊息傳送太快，請稍候 5 秒。'), 'Message sent too soon. Please wait 5 seconds.');
  assert.equal(translate('en', '訊息包含聊天室限制詞。'), 'Message contains a blocked word.');
});
