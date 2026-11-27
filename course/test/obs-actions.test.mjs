import test from 'node:test';
import assert from 'node:assert/strict';
import { controlOBS } from '../scripts/obs-actions.mjs';
test('OBS controls change actual source states, stop only the paired stream and reject the wrong path', async () => {
  let microphone = true, camera = true, screen = false, streaming = true; const calls = [];
  async function request(type, data = {}) {
    calls.push(type);
    if (type === 'GetStreamServiceSettings') return { streamServiceType: 'rtmp_custom', streamServiceSettings: { key: 'live?user=private' } };
    if (type === 'GetInputList') return { inputs: [{ inputName: 'Group9 Microphone' }] };
    if (type === 'GetCurrentProgramScene') return { currentProgramSceneName: 'scene' };
    if (type === 'GetSceneItemList') return { sceneItems: [{ sourceName: 'Group9 Camera', sceneItemId: 7, sceneItemEnabled: camera }, { sourceName: 'Group9 Screen', sceneItemId: 9, sceneItemEnabled: screen }] };
    if (type === 'GetInputMute') return { inputMuted: !microphone };
    if (type === 'GetStreamStatus') return { outputActive: streaming };
    if (type === 'SetInputMute') microphone = !data.inputMuted;
    else if (type === 'SetSceneItemEnabled') { assert.ok([7, 9].includes(data.sceneItemId)); if (data.sceneItemId === 7) camera = data.sceneItemEnabled; else screen = data.sceneItemEnabled; }
    else if (type === 'StopStream') streaming = false;
    else throw Error(type);
    return {};
  }
  assert.equal((await controlOBS(request, 'live', { action: 'microphone', enabled: false })).microphone, false);
  assert.equal((await controlOBS(request, 'live', { action: 'camera', enabled: false })).camera, false);
  assert.equal((await controlOBS(request, 'live', { action: 'microphone', enabled: true })).microphone, true);
  assert.equal((await controlOBS(request, 'live', { action: 'camera', enabled: true })).camera, true);
  assert.equal((await controlOBS(request, 'live', { action: 'status' })).layout, 'camera');
  let s = await controlOBS(request, 'live', { action: 'layout', layout: 'both' }); assert.deepEqual([s.camera, s.screen, s.layout], [true, true, 'both']);
  s = await controlOBS(request, 'live', { action: 'layout', layout: 'screen' }); assert.deepEqual([s.camera, s.screen, s.layout], [false, true, 'screen']);
  s = await controlOBS(request, 'live', { action: 'layout', layout: 'camera' }); assert.deepEqual([s.camera, s.screen, s.layout], [true, false, 'camera']);
  await assert.rejects(controlOBS(request, 'live', { action: 'layout', layout: 'pip' }));
  await assert.rejects(controlOBS(request, 'live', { action: 'layout', layout: 'both' }, { screen: 'Missing Screen' }), /顯示器擷取/);
  assert.equal((await controlOBS(request, 'live', { action: 'stop' })).streaming, false);
  calls.length = 0;
  await assert.rejects(controlOBS(request, 'guest', { action: 'stop' }), /路徑/);
  assert.deepEqual(calls, ['GetStreamServiceSettings']);
  calls.length = 0;
  await assert.rejects(controlOBS(request, 'live', { action: 'microphone', enabled: 'false' }));
  assert.deepEqual(calls, []);
});
