import React, { useEffect, useState } from 'react';
import { formatDuration } from './SessionStats.jsx';

// Live stream health for broadcasters and admins: per-slot bitrate, data received, tracks,
// viewers pulling from the media server, uptime and plain-language warnings, plus VM load.
export default function HealthPanel({ command, t }) {
  const [health, setHealth] = useState(null); const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    const load = () => command('health').then((value) => { if (alive) { setHealth(value); setError(''); } }).catch((reason) => { if (alive) setError(reason.message); });
    load(); const timer = setInterval(load, 3000);
    return () => { alive = false; clearInterval(timer); };
  }, [open]);
  const sourceName = (type) => ({ rtmpsConn: 'OBS（RTMPS）', rtmpConn: 'OBS（RTMP）', webRTCSession: t('瀏覽器／手機（WebRTC）') })[type] || type || '—';
  return <section className="management health-panel" aria-label={t('直播健康面板')}>
    <h2>🩺 {t('直播健康面板')}</h2>
    <button type="button" onClick={() => setOpen(!open)}>{open ? t('收起') : t('打開即時監控（每 3 秒更新）')}</button>
    {open && error && <p role="alert">{error}</p>}
    {open && health && <>
      <div className="health-slots">{health.slots.map((slot) => <div key={slot.path} className={`health-slot ${slot.live ? (slot.warnings.length ? 'warn' : 'ok') : 'off'}`}>
        <strong>{slot.path === 'live' ? t('第一格') : t('第二格')} · {slot.broadcaster || t('無人')} · {slot.live ? '● LIVE' : 'OFFLINE'}</strong>
        <dl>
          <dt>{t('來源')}</dt><dd>{sourceName(slot.source)}</dd>
          <dt>{t('上傳碼率')}</dt><dd>{slot.live ? `${slot.kbps} kbps` : '—'}</dd>
          <dt>{t('已接收')}</dt><dd>{slot.megabytes} MB</dd>
          <dt>{t('影音軌')}</dt><dd>{slot.tracks.join(' + ') || '—'}</dd>
          <dt>{t('媒體端讀取數')}</dt><dd>{slot.readers}</dd>
          <dt>{t('已連續直播')}</dt><dd>{slot.live ? formatDuration(slot.uptimeSeconds) : '—'}</dd>
        </dl>
        {slot.warnings.map((warning) => <p key={warning} className="health-warning">⚠️ {t(warning)}</p>)}
        {slot.live && !slot.warnings.length && <p className="health-good">✅ {t('狀態正常')}</p>}
      </div>)}</div>
      <p className="muted">{t('網站連線分頁')} {health.viewers} · {t('伺服器已運作')} {formatDuration(health.server.uptimeSeconds)} · {t('記憶體')} {health.server.memoryMB} MB · {t('CPU 負載')} {health.server.load[0]} / {health.server.cpus} {t('核')} · {t('AI 語音')} {health.server.tts ? t('已啟用') : t('未啟用')}</p>
    </>}
  </section>;
}
