export async function controlOBS(request, path, value, { microphone = process.env.OBS_MIC_INPUT, camera = process.env.OBS_CAMERA_INPUT || 'Group9 Camera' } = {}) {
  if (!['live', 'guest'].includes(path) || !value || !['status', 'microphone', 'camera', 'stop'].includes(value.action) || (['microphone', 'camera'].includes(value.action) && typeof value.enabled !== 'boolean')) throw Error('無效的 OBS 操作');
  const service = await request('GetStreamServiceSettings');
  const config = service.streamServiceSettings;
  const actualPath = service.streamServiceType === 'rtmp_custom' ? config.key?.split('?')[0] : new URL(config.server).pathname.split('/')[1];
  if (actualPath !== path) throw new Error('OBS 推流路徑與你的主播身份不符，未執行操作。');
  const { inputs } = await request('GetInputList');
  const scene = (await request('GetCurrentProgramScene')).currentProgramSceneName;
  const { sceneItems } = await request('GetSceneItemList', { sceneName: scene });
  microphone ||= sceneItems.some((item) => item.sourceName === 'Group9 AEC Microphone' && item.sceneItemEnabled) ? 'Group9 AEC Microphone' : 'Group9 Microphone';
  const item = sceneItems.find((item) => item.sourceName === camera);
  const hasMic = inputs.some((input) => input.inputName === microphone);
  if (value.action === 'microphone') { if (!hasMic) throw Error('找不到指定麥克風來源'); await request('SetInputMute', { inputName: microphone, inputMuted: !value.enabled }); }
  else if (value.action === 'camera') { if (!item) throw Error('目前場景找不到指定鏡頭來源'); await request('SetSceneItemEnabled', { sceneName: scene, sceneItemId: item.sceneItemId, sceneItemEnabled: value.enabled }); }
  else if (value.action === 'stop') { if ((await request('GetStreamStatus')).outputActive) await request('StopStream'); }
  else if (value.action !== 'status') throw Error('無效的 OBS 操作');
  if (value.action === 'stop') {
    for (let attempt = 0; attempt < 20 && (await request('GetStreamStatus')).outputActive; attempt++) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const state = { streaming: (await request('GetStreamStatus')).outputActive, microphone: hasMic ? !(await request('GetInputMute', { inputName: microphone })).inputMuted : null, camera: item ? (await request('GetSceneItemList', { sceneName: scene })).sceneItems.find((row) => row.sceneItemId === item.sceneItemId)?.sceneItemEnabled : null };
  if ((value.action === 'stop' && state.streaming) || (['microphone', 'camera'].includes(value.action) && state[value.action] !== value.enabled)) throw Error('OBS 狀態尚未符合操作，請重新讀取狀態。');
  return state;
}
