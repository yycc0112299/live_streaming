import test from 'node:test';
import assert from 'node:assert/strict';
import { controlOBS } from '../scripts/obs-actions.mjs';
test('OBS controls change actual source states, stop only the paired stream and reject the wrong path', async () => {
  let microphone = true, camera = true, streaming = true; const calls = [];
  async function request(type, data = {}) {
    calls.push(type);
    if (type === 'GetStreamServiceSettings') return { streamServiceType: 'rtmp_custom', streamServiceSettings: { key: 'live?user=private' } };
    if (type === 'GetInputList') return { inputs: [{ inputName: 'Group9 Microphone' }] };
    if (type === 'GetCurrentProgramScene') return { currentProgramSceneName: 'scene' };
    if (type === 'GetSceneItemList') return { sceneItems: [{ sourceName: 'Group9 Camera', sceneItemId: 7, sceneItemEnabled: camera }] };
    if (type === 'GetInputMute') return { inputMuted: !microphone };
    if (type === 'GetStreamStatus') return { outputActive: streaming };
    if (type === 'SetInputMute') microphone = !data.inputMuted;
    else if (type === 'SetSceneItemEnabled') { assert.equal(data.sceneItemId, 7); camera = data.sceneItemEnabled; }
    else if (type === 'StopStream') streaming = false;
    else throw Error(type);
    return {};
  }
  assert.equal((await controlOBS(request, 'live', { action: 'microphone', enabled: false })).microphone, false);
  assert.equal((await controlOBS(request, 'live', { action: 'camera', enabled: false })).camera, false);
  assert.equal((await controlOBS(request, 'live', { action: 'microphone', enabled: true })).microphone, true);
  assert.equal((await controlOBS(request, 'live', { action: 'camera', enabled: true })).camera, true);
  assert.equal((await controlOBS(request, 'live', { action: 'stop' })).streaming, false);
  calls.length = 0;
  await assert.rejects(controlOBS(request, 'guest', { action: 'stop' }), /路徑/);
  assert.deepEqual(calls, ['GetStreamServiceSettings']);
  calls.length = 0;
  await assert.rejects(controlOBS(request, 'live', { action: 'microphone', enabled: 'false' }));
  assert.deepEqual(calls, []);
});
