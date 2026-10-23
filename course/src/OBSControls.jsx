import React, { useState } from 'react';
export default function OBSControls({ command, onError }) {
  const [status, setStatus] = useState(null); const [pair, setPair] = useState(null); const [busy, setBusy] = useState(false);
  async function control(action, enabled) {
    if (action === 'stop' && !window.confirm('確定停止你這台 OBS 的直播？另一位主播會繼續直播。')) return;
    setBusy(true);
    try { setStatus(await command('obs:control', { action, enabled })); }
    catch (error) { setStatus(null); onError(error); }
    finally { setBusy(false); }
  }
  return <section className="management" aria-label="我的 OBS 控制"><h2>我的麥克風、鏡頭與直播</h2><p>只控制你配對的這台 OBS，不會關閉另一位主播。</p>
    <div className="duo-controls"><button disabled={busy} onClick={() => command('obs:pair').then(setPair).catch(onError)}>產生本機 OBS 配對碼</button><button disabled={busy} onClick={() => control('status')}>讀取 OBS 狀態</button></div>
    {pair && <div><p>在你自己的電腦 course 目錄執行（配對碼 5 分鐘內有效、只能使用一次，請勿分享）：</p><code style={{ overflowWrap: 'anywhere' }}>node scripts/obs-controller.mjs {location.origin + import.meta.env.BASE_URL} {pair.code}</code></div>}
    {status && <><p role="status">OBS：{status.streaming ? '直播中' : '已停止'} · 麥克風：{status.microphone === null ? '未設定' : status.microphone ? '開啟' : '關閉'} · 鏡頭：{status.camera === null ? '未設定' : status.camera ? '開啟' : '關閉'}</p><div className="duo-controls"><button disabled={busy || status.microphone === null} onClick={() => control('microphone', !status.microphone)}>{status.microphone ? '關閉麥克風' : '開啟麥克風'}</button><button disabled={busy || status.camera === null} onClick={() => control('camera', !status.camera)}>{status.camera ? '關閉鏡頭' : '開啟鏡頭'}</button><button disabled={busy || !status.streaming} onClick={() => control('stop')}>結束我的直播</button></div></>}
  </section>;
}
