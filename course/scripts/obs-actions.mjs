// Runs one broadcaster action against the local OBS (obs-websocket v5) after checking that this
// OBS really publishes to the broadcaster's own path.
// Layouts: 'camera' = camera only, 'screen' = screen only, 'both' = screen with the camera on top
// (OBS keeps whatever position/size the camera item has in the scene, e.g. a corner).
export const OBS_ACTIONS = ['status', 'microphone', 'camera', 'layout', 'stop'];
export const OBS_LAYOUTS = ['camera', 'both', 'screen'];
export function validOBSAction(value) {
  return Boolean(value) && OBS_ACTIONS.includes(value.action)
    && (!['microphone', 'camera'].includes(value.action) || typeof value.enabled === 'boolean')
    && (value.action !== 'layout' || OBS_LAYOUTS.includes(value.layout));
}

export async function controlOBS(request, path, value, { microphone = process.env.OBS_MIC_INPUT, camera = process.env.OBS_CAMERA_INPUT || 'Group9 Camera', screen = process.env.OBS_SCREEN_INPUT || 'Group9 Screen' } = {}) {
  if (!['live', 'guest'].includes(path) || !validOBSAction(value)) throw Error('無效的 OBS 操作');
  const service = await request('GetStreamServiceSettings');
  const config = service.streamServiceSettings;
  const actualPath = service.streamServiceType === 'rtmp_custom' ? config.key?.split('?')[0] : new URL(config.server).pathname.split('/')[1];
  if (actualPath !== path) throw new Error('OBS 推流路徑與你的主播身份不符，未執行操作。');
  const { inputs } = await request('GetInputList');
  const scene = (await request('GetCurrentProgramScene')).currentProgramSceneName;
  const { sceneItems } = await request('GetSceneItemList', { sceneName: scene });
  microphone ||= sceneItems.some((item) => item.sourceName === 'Group9 AEC Microphone' && item.sceneItemEnabled) ? 'Group9 AEC Microphone' : 'Group9 Microphone';
  const item = sceneItems.find((row) => row.sourceName === camera);
  const screenItem = sceneItems.find((row) => row.sourceName === screen);
  const hasMic = inputs.some((input) => input.inputName === microphone);
  const show = (target, enabled) => request('SetSceneItemEnabled', { sceneName: scene, sceneItemId: target.sceneItemId, sceneItemEnabled: enabled });
  if (value.action === 'microphone') { if (!hasMic) throw Error('找不到指定麥克風來源'); await request('SetInputMute', { inputName: microphone, inputMuted: !value.enabled }); }
  else if (value.action === 'camera') { if (!item) throw Error('目前場景找不到指定鏡頭來源'); await show(item, value.enabled); }
  else if (value.action === 'layout') {
    if (!item) throw Error('目前場景找不到指定鏡頭來源');
    if (!screenItem) throw Error(`目前場景找不到螢幕來源「${screen}」，請在 OBS 新增「顯示器擷取」並命名為 ${screen}。`);
    await show(screenItem, value.layout !== 'camera');
    await show(item, value.layout !== 'screen');
  }
  else if (value.action === 'stop') { if ((await request('GetStreamStatus')).outputActive) await request('StopStream'); }
  if (value.action === 'stop') {
    for (let attempt = 0; attempt < 20 && (await request('GetStreamStatus')).outputActive; attempt++) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const rows = (await request('GetSceneItemList', { sceneName: scene })).sceneItems;
  const enabled = (target) => target ? Boolean(rows.find((row) => row.sceneItemId === target.sceneItemId)?.sceneItemEnabled) : null;
  const state = { streaming: (await request('GetStreamStatus')).outputActive, microphone: hasMic ? !(await request('GetInputMute', { inputName: microphone })).inputMuted : null, camera: enabled(item), screen: enabled(screenItem) };
  state.layout = state.screen ? (state.camera ? 'both' : 'screen') : 'camera';
  if ((value.action === 'stop' && state.streaming) || (['microphone', 'camera'].includes(value.action) && state[value.action] !== value.enabled) || (value.action === 'layout' && state.layout !== value.layout)) throw Error('OBS 狀態尚未符合操作，請重新讀取狀態。');
  return state;
}
