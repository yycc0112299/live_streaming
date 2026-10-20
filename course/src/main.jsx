import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Hls from 'hls.js';
import { io } from 'socket.io-client';
import './style.css';

const base = import.meta.env.BASE_URL;
const socket = io({ autoConnect: false, path: `${base}socket.io` });

function Player({ live }) {
  const video = useRef(null);
  const [error, setError] = useState('');
  const [attempt, retry] = useState(0);
  useEffect(() => {
    setError('');
    if (!live) return;
    const element = video.current;
    const source = `${base}hls/live/index.m3u8`;
    let hls;
    let retryTimer;
    const failed = () => {
      setError('影片連線中斷，正在重試。');
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => retry((n) => n + 1), 5000);
    };
    element.addEventListener('error', failed);
    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(source);
      hls.attachMedia(element);
      hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) failed(); });
    } else if (element.canPlayType('application/vnd.apple.mpegurl')) element.src = source;
    else setError('這個瀏覽器不支援 HLS，請使用新版 Chrome、Edge 或 Safari。');
    return () => {
      clearTimeout(retryTimer);
      element.removeEventListener('error', failed);
      hls?.destroy();
      element.removeAttribute('src');
      element.load();
    };
  }, [live, attempt]);
  return <div className="player">
    <video ref={video} controls autoPlay muted playsInline aria-label="Group 9 直播影片" hidden={!live}/>
    {!live && <div className="offline"><span className="signal">◉</span><h2>下一場精彩，即將開始</h2><p>主播尚未開播。先加入聊天室，和大家打個招呼。</p><span className="waiting">WAITING FOR THE BROADCAST</span></div>}
    {error && <div role="status" className="video-error">{error}<button onClick={() => retry((n) => n + 1)}>重試播放</button></div>}
  </div>;
}

function App() {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState({ live: false, available: false, viewers: 0, likes: 0 });
  const [messages, setMessages] = useState([]);
  const [draftName, setDraftName] = useState(() => { try { return localStorage.getItem('group9-nickname') || ''; } catch { return ''; } });
  const [nickname, setNickname] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [heart, setHeart] = useState(0);
  const [notice, setNotice] = useState('');
  const chat = useRef(null);
  useEffect(() => {
    const onConnect = () => { setConnected(true); setNickname(''); setError(''); };
    const onDisconnect = () => { setConnected(false); setNickname(''); };
    const onMessage = (message) => setMessages((items) => [...items, message].slice(-100));
    const onLike = ({ likes }) => { setState((value) => ({ ...value, likes })); setHeart((n) => n + 1); };
    socket.on('connect', onConnect).on('disconnect', onDisconnect).on('state', setState).on('history', setMessages).on('chat', onMessage).on('like', onLike);
    socket.on('connect_error', onDisconnect);
    socket.connect();
    return () => { socket.removeAllListeners(); socket.disconnect(); };
  }, []);
  useEffect(() => { if (chat.current) chat.current.scrollTop = chat.current.scrollHeight; }, [messages]);
  function nameSubmit(event) {
    event.preventDefault(); setError('');
    socket.timeout(5000).emit('nickname', draftName, (timeout, result) => {
      if (timeout || result.error) return setError(result?.error || '連線逾時，請重試。');
      setNickname(result.nickname);
      try { localStorage.setItem('group9-nickname', result.nickname); } catch { /* Storage is optional. */ }
    });
  }
  function send(event) {
    event.preventDefault(); setError(''); setSending(true);
    socket.timeout(5000).emit('chat', text, (timeout, result) => {
      setSending(false);
      if (timeout || result.error) return setError(result?.error || '訊息未確認送達，請先查看聊天室再重試。');
      setText('');
    });
  }
  async function share() {
    try { await navigator.clipboard.writeText(location.href); setNotice('觀看連結已複製'); }
    catch { setNotice(`無法自動複製，請手動複製：${location.href}`); }
  }
  return <>
    <header className="topbar"><a href={base} className="brand"><span className="brand-icon">◉</span> CLOUD<span>LIVE</span><small>GROUP 09</small></a><span className="course-tag">電子工程總整課程 · NTUST</span><span className={`connection ${connected ? 'online' : ''}`}>{connected ? '已連線' : '重新連線中…'}</span></header>
    <main>
      <div className="eyebrow">ONE ROOM. SHARED MOMENTS.</div>
      <div className="heading"><div><h1>讓每個瞬間，<em>即時相聚。</em></h1><p>一場直播，一個聊天室。打開瀏覽器，就在現場。</p></div><button className="share" onClick={share}>↗ 分享直播間</button></div>
      <div className="room-grid"><section className="broadcast" aria-label="直播間">
        <div className="video-wrap"><Player live={connected && state.live}/><span className={`live-badge ${state.live && connected ? 'is-live' : ''}`}>{!connected ? '連線中' : state.live ? '● LIVE' : state.available ? '● OFFLINE' : '服務連線中'}</span>{heart > 0 && <span key={heart} className="floating-heart" aria-hidden="true">♥</span>}</div>
        <div className="stream-info"><div className="avatar">09</div><div><h2>Group 9 · Cloud-Based Live Streaming</h2><p>王昱程 × 曹少懷 <span>·</span> 直播 / 交流 / 一起探索</p></div></div>
        <div className="stream-actions"><span><b>{connected ? state.viewers : '—'}</b> 個連線分頁</span><button disabled={!connected} aria-label="為直播按讚" onClick={() => socket.timeout(5000).emit('like', (timeout, result) => { if (timeout || result.error) setError(result?.error || '按讚連線逾時。'); })}>♡ <b>{state.likes}</b> 喜歡</button><span className="quality">HLS · 影音直播</span></div>
        <div className="play-hint">播放預設靜音，點播放器音量鍵即可開啟聲音。HLS 影音會比即時聊天稍晚。</div>
      </section>
      <aside className="chat-panel" aria-label="即時聊天室"><div className="chat-heading"><h2>即時聊天室 <span>LIVE CHAT</span></h2><span className="chat-dot"/></div>
        <div className="chat-welcome"><strong>歡迎來到 Group 9 👋</strong><p>選個暱稱，和正在觀看的朋友聊聊。請友善交流，勿分享私人資訊。</p></div>
        <div className="messages" ref={chat} role="log" aria-live="polite" aria-relevant="additions" aria-label="聊天訊息">
          {messages.length === 0 && <div className="empty-chat">美好的對話，從一句哈囉開始。</div>}
          {messages.map((message) => <div className="message" key={message.id}><div className="message-meta"><strong>{message.nickname}</strong><time dateTime={message.at}>{new Date(message.at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</time></div><p>{message.text}</p></div>)}
        </div>
        <div className="composer">{nickname ? <><div className="identity">以 <b>{nickname}</b> 發言 <button onClick={() => setNickname('')}>更換暱稱</button></div><form onSubmit={send}><label className="sr-only" htmlFor="message">聊天訊息</label><textarea id="message" rows="2" maxLength="500" placeholder="說點什麼吧…" value={text} onChange={(e) => setText(e.target.value)} disabled={!connected}/><div className="compose-footer"><span>{text.length}/500</span><button className="primary" disabled={!connected || sending || !text.trim()}>{sending ? '傳送中…' : '傳送 ↗'}</button></div></form></> : <form onSubmit={nameSubmit}><label htmlFor="nickname">你的聊天暱稱</label><input id="nickname" autoComplete="nickname" maxLength="24" placeholder="輸入暱稱，加入對話" value={draftName} onChange={(e) => setDraftName(e.target.value)} disabled={!connected}/><button className="primary join" disabled={!connected || !draftName.trim()}>加入聊天室 →</button></form>}
          {error && <p className="error" role="alert">{error}</p>}
        </div>
      </aside></div>
      {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="關閉分享提示" onClick={() => setNotice('')}>×</button></div>}
      <footer><span>GROUP 09 / CLOUD-BASED LIVE STREAMING PLATFORM</span><span>連線數依分頁計算 · 聊天僅暫存最近 100 則 · 重啟後清除</span></footer>
    </main>
  </>;
}

createRoot(document.getElementById('root')).render(<App/>);
