import React, { useState } from 'react';
export const LAYOUTS = [['camera', '📷', '只有鏡頭'], ['both', '🖥️📷', '螢幕＋鏡頭'], ['screen', '🖥️', '只有螢幕']];
export default function OBSControls({ command, onError, t }) {
  const [status, setStatus] = useState(null); const [pair, setPair] = useState(null); const [device, setDevice] = useState(null); const [busy, setBusy] = useState(false);
  async function control(action, enabled, layout) {
    if (action === 'stop' && !window.confirm(t('確定停止你這台 OBS 的直播？另一位主播會繼續直播。'))) return;
    setBusy(true);
    try { const next = await command('obs:control', { action, enabled, layout }); setStatus(next); return next; }
    catch (error) { setStatus(null); onError(error); }
    finally { setBusy(false); }
  }
  async function toggle(action) {
    setBusy(true);
    try { const current = status || await command('obs:control', { action: 'status' }); setStatus(await command('obs:control', { action, enabled: !current[action] })); }
    catch (error) { setStatus(null); onError(error); }
    finally { setBusy(false); }
  }
  return <section className="management" aria-label={t('我的 OBS 控制')}><h2>{t('我的 OBS 直播')}</h2><p>{t('只控制你配對的這台 OBS，不會關閉另一位主播。')}</p>
    <div className="duo-controls"><button disabled={busy} onClick={() => command('obs:pair').then(setPair).catch(onError)}>{t('產生本機 OBS 配對碼')}</button><button disabled={busy} onClick={() => command('obs:device').then(setDevice).catch(onError)}>{t('建立固定電腦自動加入')}</button><button disabled={busy} onClick={() => control('status')}>{t('讀取 OBS 狀態')}</button></div>
    {pair && <div><p>{t('在你自己的電腦 course 目錄執行（配對碼 5 分鐘內有效、只能使用一次，請勿分享）：')}</p><code style={{ overflowWrap: 'anywhere' }}>node scripts/obs-controller.mjs {location.origin + import.meta.env.BASE_URL} {pair.code}</code></div>}
    {device && <div><p>{t('固定電腦只需依序執行一次下列命令，之後登入 Windows 會自動開啟 OBS、加入並推流：')}</p><code style={{ overflowWrap: 'anywhere' }}>node scripts/save-obs-device.mjs {location.origin + import.meta.env.BASE_URL} {device.token}<br/>powershell -File scripts/install-auto-broadcast.ps1</code></div>}
    {status && <p role="status">OBS: {t(status.streaming ? '直播中' : '已停止')} · {t('麥克風：')}{t(status.microphone === null ? '未設定' : status.microphone ? '開啟' : '關閉')} · {t('鏡頭：')}{t(status.camera === null ? '未設定' : status.camera ? '開啟' : '關閉')}</p>}
    <div className="layout-switch" role="group" aria-label={t('OBS 畫面')}>{LAYOUTS.map(([id, icon, name]) => <button key={id} type="button" disabled={busy} aria-pressed={status?.layout === id} className={status?.layout === id ? 'on' : ''} onClick={() => control('layout', undefined, id)}>{icon} {t(name)}</button>)}</div>
    <div className="duo-controls"><button type="button" disabled={busy} className={`mic-toggle ${status?.microphone === false ? 'muted' : ''}`} onClick={() => toggle('microphone')}>{status?.microphone === false ? `🔇 ${t('開啟麥克風')}` : `🎤 ${t('關閉麥克風')}`}</button></div>
    <div className="duo-controls"><button disabled={busy || !status?.streaming} onClick={() => control('stop')}>{t('結束我的直播')}</button></div>
  </section>;
}
