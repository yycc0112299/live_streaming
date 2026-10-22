import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Hls from 'hls.js';
import MediaMTXWebRTCReader from './vendor/mediamtx-reader.js';
import { io } from 'socket.io-client';
import './style.css';
import Account from './Account.jsx';
import Moderation from './Moderation.jsx';

const base = import.meta.env.BASE_URL;
const useWebRTC = import.meta.env.VITE_WEBRTC === 'true';
const socket = io({ autoConnect: false, path: `${base}socket.io` });

function Player({ live, path = 'live', name = '主播', silent = false }) {
  const video = useRef(null);
  const [error, setError] = useState('');
  const [attempt, retry] = useState(0);
  useEffect(() => {
    setError('');
    if (!live) return;
    const element = video.current;
    const preventSelfMonitor = () => { if (silent && !element.muted) element.muted = true; };
    element.addEventListener('volumechange', preventSelfMonitor);
    const source = `${base}hls/${path}/index.m3u8`;
    let hls;
    let retryTimer;
    const failed = () => {
      setError('影片連線中斷，正在重試。');
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => retry((n) => n + 1), 5000);
    };
    element.addEventListener('error', failed);
    if (useWebRTC) {
      // Official MediaMTX v1.21.2 WHEP reader owns negotiation and reconnects.
      const reader = new MediaMTXWebRTCReader({
        url: new URL(`${base}webrtc/${path}/whep`, location.href).href,
        onError: () => setError('影片連線中斷，正在重試。'),
        onTrack: (event) => { setError(''); if (silent) event.streams[0].getAudioTracks().forEach((track) => { track.enabled = false; }); element.srcObject = event.streams[0]; },
      });
      return () => { reader.close(); element.removeEventListener('error', failed); element.removeEventListener('volumechange', preventSelfMonitor); clearTimeout(retryTimer); element.srcObject = null; };
    } else if (Hls.isSupported()) {
      hls = new Hls({
        lowLatencyMode: true,
        liveSyncDuration: 0.8,
        liveMaxLatencyDuration: 1.5,
        maxLiveSyncPlaybackRate: 1.5,
      });
      hls.loadSource(source);
      hls.attachMedia(element);
      hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) failed(); });
    } else if (element.canPlayType('application/vnd.apple.mpegurl')) element.src = source;
    else setError('這個瀏覽器不支援 HLS，請使用新版 Chrome、Edge 或 Safari。');
    return () => {
      clearTimeout(retryTimer);
      element.removeEventListener('error', failed);
      element.removeEventListener('volumechange', preventSelfMonitor);
      hls?.destroy();
      element.removeAttribute('src');
      element.load();
    };
  }, [live, attempt, path, silent]);
  return <div className="player">
    <video ref={video} controls autoPlay muted playsInline aria-label={`${name} 的 OBS 直播`} hidden={!live}/>
    <span className="source-name">{name} · {live ? 'LIVE' : 'OFFLINE'}{silent && ' · 自己返聽已關閉'}</span>
    {!live && <div className="offline"><span className="signal">◉</span><h2>{name} 尚未推流</h2><p>連線恢復後會自動播放。</p></div>}
    {error && <div role="status" className="video-error">{error}<button onClick={() => retry((n) => n + 1)}>重試播放</button></div>}
  </div>;
}

function App() {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState({ live: false, available: false, viewers: 0, likes: 0 });
  const [user, setUser] = useState(null);
  const [accountsAvailable, setAccountsAvailable] = useState(false);
  const [room, setRoom] = useState({ host: null, guest: null, broadcastId: null });
  const [chatSettings, setChatSettings] = useState({ announcement: '', slowSeconds: 1 });
  const [pendingDonation, setPendingDonation] = useState(null);
  const [donating, setDonating] = useState(false);
  const [guestUsername, setGuestUsername] = useState('');
  const [audioChecklist, setAudioChecklist] = useState(false);
  const [roomBusy, setRoomBusy] = useState(false);
  const [overlay, setOverlay] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [heart, setHeart] = useState(0);
  const [notice, setNotice] = useState('');
  const chat = useRef(null);
  const management = ['host', 'admin'].includes(user?.role);
  function command(event, value) {
    return value === undefined ? socket.timeout(10000).emitWithAck(event).then(check) : socket.timeout(10000).emitWithAck(event, value).then(check);
  }
  function check(result) { if (result.error) throw new Error(result.error); return result; }
  const onError = (error) => setError(error.message || '操作失敗，請重試。');
  async function reloadAccount() {
    const response = await fetch(`${base}api/account/me`);
    if (!response.ok) throw new Error('無法讀取登入狀態。');
    const result = await response.json(); setUser(result.user); setAccountsAvailable(result.accountsAvailable);
    socket.disconnect(); socket.connect();
  }
  useEffect(() => {
    const onConnect = () => { setConnected(true); setError(''); };
    const onDisconnect = () => { setConnected(false); setUser(null); setRoom({ host: null, guest: null }); };
    const onMessage = (message) => {
      setMessages((items) => [...items, message].slice(-100));
      setOverlay({ type: 'chat', ...message });
      window.clearTimeout(window.__group9OverlayTimer);
      window.__group9OverlayTimer = window.setTimeout(() => setOverlay(null), 6000);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const speech = new SpeechSynthesisUtterance(message.text.slice(0, 120));
        speech.lang = 'zh-TW'; speech.rate = 1.05; speech.volume = 0.9;
        window.speechSynthesis.speak(speech);
      }
    };
    const onDonation = ({ amount, nickname }) => {
      setOverlay({ type: 'donation', amount, nickname });
      window.clearTimeout(window.__group9OverlayTimer);
      window.__group9OverlayTimer = window.setTimeout(() => setOverlay(null), 5000);
    };
    const onLike = ({ likes }) => { setState((value) => ({ ...value, likes })); setHeart((n) => n + 1); };
    const onDeleted = (id) => { setMessages((items) => items.filter((message) => message.id !== id)); setOverlay((value) => value?.id === id ? null : value); };
    const onState = (value) => { setState(value); setRoom(value.room || { host: null, guest: null, broadcastId: null }); };
    socket.on('connect', onConnect).on('disconnect', onDisconnect).on('state', onState).on('account', setUser).on('room:state', setRoom).on('chat:settings', setChatSettings).on('chat:deleted', onDeleted).on('history', setMessages).on('chat', onMessage).on('donation', onDonation).on('like', onLike);
    socket.on('connect_error', onDisconnect);
    reloadAccount().catch(onError);
    return () => { socket.removeAllListeners(); socket.disconnect(); window.speechSynthesis?.cancel(); window.clearTimeout(window.__group9OverlayTimer); };
  }, []);
  useEffect(() => { if (chat.current) chat.current.scrollTop = chat.current.scrollHeight; }, [messages]);
  useEffect(() => { if (user && pendingDonation && pendingDonation.senderId !== user.id) setPendingDonation(null); }, [user?.id, pendingDonation]);
  function send(event) {
    event.preventDefault(); setError(''); setSending(true);
    socket.timeout(5000).emit('chat', text, (timeout, result) => {
      setSending(false);
      if (timeout || result.error) return setError(result?.error || '訊息未確認送達，請先查看聊天室再重試。');
      setText('');
    });
  }
  async function donate(amount) {
    const request = pendingDonation || { amount, requestId: crypto.randomUUID(), broadcastId: room.broadcastId, senderId: user?.id };
    setPendingDonation(request); setDonating(true); setError('');
    try { await command('donate', request); setPendingDonation(null); }
    catch (error) { onError(error); }
    finally { setDonating(false); }
  }
  async function share() {
    try { await navigator.clipboard.writeText(location.href); setNotice('觀看連結已複製'); }
    catch { setNotice(`無法自動複製，請手動複製：${location.href}`); }
  }
  async function roomAction(event) {
    setRoomBusy(true);
    try { await command(event, event === 'room:start' ? { guestUsername, audioChecklist } : undefined); }
    catch (error) { onError(error); }
    finally { setRoomBusy(false); }
  }
  return <>
    <header className="topbar"><a href={base} className="brand"><span className="brand-icon">◉</span> CLOUD<span>LIVE</span><small>GROUP 09</small></a><span className="course-tag">電子工程總整課程 · NTUST</span><span className={`connection ${connected ? 'online' : ''}`}>{connected ? '已連線' : '重新連線中…'}</span></header>
    <main>
      <div className="eyebrow">ONE ROOM. SHARED MOMENTS.</div>
      <div className="heading"><div><h1>讓每個瞬間，<em>即時相聚。</em></h1><p>一場直播，一個聊天室。打開瀏覽器，就在現場。</p></div><button className="share" onClick={share}>↗ 分享直播間</button></div>
      <div className="room-grid"><section className="broadcast" aria-label="直播間">
        <div className="video-wrap"><div className="duo-section"><h2>雙 OBS 同台直播</h2><div className="duo-grid">{[{ path: 'live', name: room.host?.nickname || '第一台 OBS', userId: room.host?.userId }, { path: 'guest', name: room.guest?.nickname || '第二台 OBS', userId: room.guest?.userId }].map((source) => <Player key={source.path} path={source.path} name={source.name} silent={Boolean(user && source.userId === user.id)} live={connected && Boolean(state.sources?.[source.path]?.live)}/>)}</div></div>{overlay && <div className={`stream-overlay ${overlay.type}`} role="status">{overlay.type === 'donation' ? <><strong>🎁 {overlay.nickname} 應援 {overlay.amount} 點</strong><span>謝謝支持！</span></> : <><strong>{overlay.nickname}</strong><span>{overlay.text}</span></>}</div>}<span className={`live-badge ${(state.live || state.sources?.guest?.live) && connected ? 'is-live' : ''}`}>{!connected ? '連線中' : state.live || state.sources?.guest?.live ? '● LIVE' : state.available ? '● OFFLINE' : '服務連線中'}</span>{heart > 0 && <span key={heart} className="floating-heart" aria-hidden="true">♥</span>}</div>
        <div className="stream-info"><div className="avatar">09</div><div><h2>Group 9 · Cloud-Based Live Streaming</h2><p>王昱程 × 曹少懷 <span>·</span> 直播 / 交流 / 一起探索</p></div></div>
        <div className="stream-actions"><span><b>{connected ? state.viewers : '—'}</b> 個連線分頁</span><button disabled={!connected} aria-label="為直播按讚" onClick={() => socket.timeout(5000).emit('like', (timeout, result) => { if (timeout || result.error) setError(result?.error || '按讚連線逾時。'); })}>♡ <b>{state.likes}</b> 喜歡</button><span className="quality">{useWebRTC ? 'WebRTC' : 'HLS'} · 雙 OBS</span></div>
        <div className="support-bar" aria-label="示範應援"><span>示範點數：<b>{user?.points || 0}</b> · 本場應援：<b>{state.supportTotal || 0}</b></span>{[1, 5, 10].map((amount) => <button key={amount} disabled={!connected || !user || !room.host || room.host.userId === user.id || user.points < amount || donating || Boolean(pendingDonation)} onClick={() => donate(amount)}>應援 {amount}</button>)}{pendingDonation && <><button disabled={donating} onClick={() => donate(pendingDonation.amount)}>重查／重試同一筆應援</button><button disabled={donating} onClick={() => setPendingDonation(null)}>關閉待確認（請先查帳本）</button></>}</div>
        <div className="play-hint">觀眾可分別開啟兩路音量。登入的上鏡者已自動關閉自己的返聽；免耳機模式請先啟動本機 AEC，OBS 使用 AEC Browser Source，並停用原始麥克風與桌面音訊。{!useWebRTC && 'HLS 影音會比聊天稍晚。'}</div>
        {management && <section className="management" aria-label="OBS 直播間控制"><h2>OBS 直播間控制</h2>{room.host ? <><p>本場主持人：{room.host.nickname} · 第二位：{room.guest?.nickname}</p><button disabled={roomBusy || (room.host.userId !== user.id && user.role !== 'admin')} onClick={() => roomAction('room:end')}>結束本場應援記帳</button><p className="muted">結束記帳不會遙控 OBS；兩台電腦仍需各自按「停止串流」。</p></> : <form className="account-form" onSubmit={(event) => { event.preventDefault(); roomAction('room:start'); }}><label>第二台參與者帳號<input required maxLength="24" value={guestUsername} onChange={(e) => setGuestUsername(e.target.value)}/></label><label className="checklist"><input type="checkbox" checked={audioChecklist} onChange={(e) => setAudioChecklist(e.target.checked)}/>兩台均已啟動 AEC Browser Source、停用原始麥克風與桌面音訊</label><button disabled={!audioChecklist || roomBusy}>開啟雙 OBS 直播間</button></form>}</section>}
      </section>
      <aside className="chat-panel" aria-label="即時聊天室"><div className="chat-heading"><h2>即時聊天室 <span>LIVE CHAT</span></h2><span className="chat-dot"/></div>
        {chatSettings.announcement && <div className="announcement" role="status">📌 {chatSettings.announcement}</div>}
        <div className="chat-welcome"><strong>歡迎來到 Group 9 👋</strong><p>選個暱稱，和正在觀看的朋友聊聊。請友善交流，勿分享私人資訊。</p></div>
        <div className="messages" ref={chat} role="log" aria-live="polite" aria-relevant="additions" aria-label="聊天訊息">
          {messages.length === 0 && <div className="empty-chat">美好的對話，從一句哈囉開始。</div>}
          {messages.map((message) => <div className="message" key={message.id}><div className="message-meta"><strong>{message.nickname}</strong><time dateTime={message.at}>{new Date(message.at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</time></div><p>{message.text}</p>{user && <div className="message-tools"><button onClick={() => { const reason = window.prompt('檢舉原因（最多 200 字）'); if (reason) command('chat:report', { messageId: message.id, reason }).then(() => setNotice('檢舉已送出')).catch(onError); }}>檢舉</button>{management && <><button onClick={() => command('chat:manage', { action: 'delete', messageId: message.id }).catch(onError)}>刪除</button><button onClick={() => command('chat:manage', { action: 'mute', userId: message.userId, minutes: 10 }).catch(onError)}>禁言</button><button onClick={() => command('chat:manage', { action: 'mute', userId: message.userId, minutes: 0 }).catch(onError)}>解除禁言</button></>}</div>}</div>)}
        </div>
        <div className="composer">{user ? <><div className="identity">以 <b>{user.nickname}</b> 發言 · 間隔 {chatSettings.slowSeconds} 秒</div><form onSubmit={send}><label className="sr-only" htmlFor="message">聊天訊息</label><textarea id="message" rows="2" maxLength="500" placeholder="說點什麼吧…" value={text} onChange={(e) => setText(e.target.value)} disabled={!connected}/><div className="compose-footer"><span>{text.length}/500</span><button className="primary" disabled={!connected || sending || !text.trim()}>{sending ? '傳送中…' : '傳送 ↗'}</button></div></form></> : <p>請在下方登入或註冊後加入對話。</p>}
          {error && <p className="error" role="alert">{error}</p>}
        </div>
      </aside></div>
      <Account key={user?.id || 'guest'} user={user} available={accountsAvailable} onChange={reloadAccount} command={command} onError={onError}/>
      {management && <Moderation command={command} onError={onError}/>}
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="關閉分享提示" onClick={() => setNotice('')}>×</button></div>}
      <footer><span>GROUP 09 / CLOUD-BASED LIVE STREAMING PLATFORM</span><span>連線數依分頁計算 · 聊天顯示最近 100 則 · 帳號與交易持久保存</span></footer>
    </main>
  </>;
}

createRoot(document.getElementById('root')).render(<App/>);
