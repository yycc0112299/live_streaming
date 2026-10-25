import React, { useState } from 'react';

export default function Moderation({ command, onError }) {
  const [review, setReview] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const [slowSeconds, setSlow] = useState(1);
  const [voiceCooldownSeconds, setVoiceCooldown] = useState(60);
  const [words, setWords] = useState('');
  async function refresh() {
    try {
      const result = await command('chat:review'); setReview(result);
      setAnnouncement(result.settings.announcement); setSlow(result.settings.slowSeconds); setVoiceCooldown(result.settings.voiceCooldownSeconds); setWords(result.settings.words.join(','));
    } catch (error) { onError(error); }
  }
  async function manage(value) { try { await command('chat:manage', value); await refresh(); } catch (error) { onError(error); } }
  return <section className="management" aria-label="聊天室管理"><h2>聊天室管理</h2><button onClick={refresh}>載入／更新管理面板</button>{review && <>
    <form className="account-form" onSubmit={(event) => { event.preventDefault(); manage({ action: 'settings', announcement, slowSeconds: Number(slowSeconds), voiceCooldownSeconds: Number(voiceCooldownSeconds), words: words.split(',').map((word) => word.trim()).filter(Boolean) }); }}><label>置頂公告<input maxLength="300" value={announcement} onChange={(e) => setAnnouncement(e.target.value)}/></label><label>每帳號發言間隔（秒）<input type="number" min="5" max="120" value={slowSeconds} onChange={(e) => setSlow(e.target.value)} required/></label><label>語音留言間隔（秒，0 = 不限）<input type="number" min="0" max="3600" value={voiceCooldownSeconds} onChange={(e) => setVoiceCooldown(e.target.value)} required/></label><label>限制詞（以半形逗號分隔）<input maxLength="2000" value={words} onChange={(e) => setWords(e.target.value)}/></label><button>儲存聊天室規則</button></form>
    <h3>目前禁言</h3>{review.mutes.length === 0 && <p>目前沒有被禁言的觀眾。</p>}{review.mutes.map((mute) => <article key={mute.userId}><p>{mute.nickname} · 到 {new Date(mute.untilMs).toLocaleString('zh-TW')} 結束</p><div className="duo-controls"><button onClick={() => manage({ action: 'mute', userId: mute.userId, minutes: 0 })}>解除禁言</button></div></article>)}
    <h3>待處理檢舉</h3>{review.reports.length === 0 && <p>目前沒有待處理檢舉。</p>}{review.reports.map((report) => <article key={report.id}><p>{report.nickname}：{report.text}</p><p>原因：{report.reason}</p><div className="duo-controls"><button onClick={() => manage({ action: 'delete', messageId: report.messageId })}>刪除訊息</button><button onClick={() => manage({ action: 'mute', userId: report.userId, minutes: 10 })}>禁言 10 分鐘</button><button onClick={() => manage({ action: 'mute', userId: report.userId, minutes: 0 })}>解除禁言</button><button onClick={() => manage({ action: 'resolve', reportId: report.id })}>標記已處理</button></div></article>)}
    <details><summary>最近 100 筆管理操作紀錄</summary><ul>{review.audit.map((row, index) => <li key={index}>{row.at} · {row.action} · {row.details}</li>)}</ul></details>
  </>}</section>;
}
