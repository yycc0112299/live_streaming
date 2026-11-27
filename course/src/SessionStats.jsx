import React, { useEffect, useState } from 'react';

// Host / admin panel: live statistics of the current session, and one click to end it and
// start a fresh one (leaderboard, likes and totals restart from zero; the summary of the
// session that just ended stays on screen — handy for the final report's results page).
export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function Grid({ stats, t }) {
  const rows = [
    ['⏱️', '直播時長', formatDuration(stats.durationSeconds)],
    ['👀', '最高同時連線', stats.peakViewers],
    ['♡', '按讚', stats.likes],
    ['💬', '聊天訊息', stats.chatMessages],
    ['🎁', '送禮次數', stats.gifts],
    ['💰', '總應援點數', stats.giftPoints],
    ['🙋', '送禮人數', stats.donors],
    ['🗣️', '語音留言', stats.voiceMessages],
  ];
  return <><div className="stats-grid">{rows.map(([icon, label, value]) => <div key={label}><span>{icon} {t(label)}</span><b>{value}</b></div>)}</div>
    <p className="muted">{t('第一名支持者：')}{stats.topSupporter ? `${stats.topSupporter.nickname} · ${stats.topSupporter.total} ${t('點')}` : t('無')} · {t('開始時間：')}{new Date(stats.startedAt).toLocaleString()}{stats.endedAt && ` · ${t('結束時間：')}${new Date(stats.endedAt).toLocaleString()}`}</p></>;
}

export default function SessionStats({ command, onError, t, broadcastId }) {
  const [current, setCurrent] = useState(null); const [previous, setPrevious] = useState(null); const [busy, setBusy] = useState(false);
  async function load() {
    try { const result = await command('room:stats'); setCurrent(result.current); if (result.previous) setPrevious(result.previous); }
    catch (error) { onError(error); }
  }
  useEffect(() => { void load(); const timer = setInterval(load, 15000); return () => clearInterval(timer); }, [broadcastId]);
  async function restart() {
    if (!window.confirm(t('確定結束本場並開新一場？應援榜、按讚與本場點數會從 0 開始，第二路主播也會被移出。'))) return;
    setBusy(true);
    try { const result = await command('room:restart'); setPrevious(result.previous); setCurrent(result.current); }
    catch (error) { onError(error); }
    finally { setBusy(false); }
  }
  return <section className="management session-stats" aria-label={t('本場統計')}>
    <h2>📊 {t('本場統計')}</h2>
    {current ? <Grid stats={current} t={t}/> : <p className="muted">{t('讀取中…')}</p>}
    <div className="duo-controls"><button type="button" disabled={busy} onClick={() => { void load(); }}>{t('更新統計')}</button><button type="button" className="danger" disabled={busy} onClick={() => { void restart(); }}>{t('結束本場並開新一場')}</button></div>
    {previous && <details open><summary>{t('上一場統計')}</summary><Grid stats={previous} t={t}/></details>}
  </section>;
}
