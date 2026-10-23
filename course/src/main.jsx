import OBSControls from './OBSControls.jsx';
import { enqueueGift, GIFTS, VOICE_MESSAGE_POINTS } from '../gifts.mjs';
import GiftOverlay from './GiftOverlay.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Hls from 'hls.js';
import MediaMTXWebRTCReader from './vendor/mediamtx-reader.js';
import { io } from 'socket.io-client';
import QRCode from 'qrcode';
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
  const [roomRequests, setRoomRequests] = useState([]);
  const [chatSettings, setChatSettings] = useState({ announcement: '', slowSeconds: 1 });
  const [pendingDonation, setPendingDonation] = useState(null);
  const [speechText, setSpeechText] = useState('');
  const [donating, setDonating] = useState(false);
  const [roomBusy, setRoomBusy] = useState(false);
  const [gifts, setGifts] = useState([]);
  const giftIds = useRef(new Set());
  const [overlay, setOverlay] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [heart, setHeart] = useState(0);
  const [notice, setNotice] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [qrCode, setQrCode] = useState('');
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
    const result = await response.json();
    if (!result.user && result.accountsAvailable) {
      const guest = await fetch(`${base}api/account/guest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const value = await guest.json(); if (!guest.ok) throw new Error(value.error);
      result.user = value.user;
    }
    setUser(result.user); setAccountsAvailable(result.accountsAvailable);
    socket.disconnect(); socket.connect();
  }
  useEffect(() => {
    const onConnect = () => { setConnected(true); setError(''); };
    const onDisconnect = () => { setConnected(false); setUser(null); setRoom({ host: null, guest: null }); };
    const onMessage = (message) => setMessages((items) => [...items, message].slice(-100));
    const onDonation = (gift) => {
      if (giftIds.current.has(gift.id)) return;
      giftIds.current.add(gift.id);
      if (giftIds.current.size > 1000) giftIds.current.delete(giftIds.current.values().next().value);
      if (gift.message && 'speechSynthesis' in window) {
        setOverlay({ ...gift, type: 'speech', text: gift.message });
        window.clearTimeout(window.__group9OverlayTimer);
        window.__group9OverlayTimer = window.setTimeout(() => setOverlay(null), 5000);
        const speech = new SpeechSynthesisUtterance(gift.message);
        speech.lang = 'zh-TW'; speech.rate = 1.05; speech.volume = 0.9;
        window.speechSynthesis.speak(speech);
      } else setGifts((items) => enqueueGift(items, gift));
    };
    const onLike = ({ likes }) => { setState((value) => ({ ...value, likes })); setHeart((n) => n + 1); };
    const onDeleted = (id) => { setMessages((items) => items.filter((message) => message.id !== id)); setOverlay((value) => value?.id === id ? null : value); };
    const onState = (value) => { setState(value); setRoom(value.room || { host: null, guest: null, broadcastId: null }); };
    socket.on('connect', onConnect).on('disconnect', onDisconnect).on('state', onState).on('account', setUser).on('room:state', setRoom).on('room:requests', setRoomRequests).on('chat:settings', setChatSettings).on('chat:deleted', onDeleted).on('history', setMessages).on('chat', onMessage).on('donation', onDonation).on('like', onLike);
    socket.on('connect_error', onDisconnect);
    reloadAccount().catch(onError);
    return () => { socket.removeAllListeners(); socket.disconnect(); window.speechSynthesis?.cancel(); window.clearTimeout(window.__group9OverlayTimer); };
  }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 3000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { if (chat.current) chat.current.scrollTop = chat.current.scrollHeight; }, [messages]);
  useEffect(() => { if (user && pendingDonation && pendingDonation.senderId !== user.id) setPendingDonation(null); }, [user?.id, pendingDonation]);
  function send(event) {
    event.preventDefault();
    if (!connected || sending || !text.trim()) return;
    setError(''); setSending(true);
    socket.timeout(5000).emit('chat', text, (timeout, result) => {
      setSending(false);
      if (timeout || result.error) return setError(result?.error || '訊息未確認送達，請先查看聊天室再重試。');
      setText('');
    });
  }
  async function donate(amount, message = '') {
    const request = pendingDonation || { amount, requestId: crypto.randomUUID(), broadcastId: room.broadcastId, senderId: user?.id, message };
    setPendingDonation(request); setDonating(true); setError('');
    try { await command('donate', request); setPendingDonation(null); if (request.message) setSpeechText(''); }
    catch (error) { onError(error); }
    finally { setDonating(false); }
  }
  const shareUrl = new URL(base, location.origin).href;
  async function copyShareUrl() {
    try { await navigator.clipboard.writeText(shareUrl); setNotice('觀看連結已複製'); }
    catch { setNotice(`無法自動複製，請手動複製：${shareUrl}`); }
  }
  async function showQrCode() {
    try { setQrCode(await QRCode.toDataURL(shareUrl, { width: 280, margin: 2, errorCorrectionLevel: 'M' })); }
    catch { setNotice('QR Code 產生失敗，請改用複製網址。'); }
  }
  async function roomAction(event, value) {
    setRoomBusy(true);
    try { await command(event, value); }
    catch (error) { onError(error); }
    finally { setRoomBusy(false); }
  }
  return <>
    <header className="topbar"><a href={base} className="brand"><span className="brand-icon">◉</span> CLOUD<span>LIVE</span><small>GROUP 09</small></a><span className="course-tag">電子工程總整課程 · NTUST</span><span className={`connection ${connected ? 'online' : ''}`}>{connected ? '已連線' : '重新連線中…'}</span></header>
    <main>
      <div className="eyebrow">ONE ROOM. SHARED MOMENTS.</div>
      <div className="heading"><div><h1>讓每個瞬間，<em>即時相聚。</em></h1><p>一場直播，一個聊天室。打開瀏覽器，就在現場。</p></div><button className="share" onClick={() => setShareOpen(true)}>↗ 分享直播間</button></div>
      {shareOpen && <dialog className="share-dialog" open aria-labelledby="share-title"><div className="share-dialog-heading"><h2 id="share-title">分享直播間</h2><button aria-label="關閉分享視窗" onClick={() => { setShareOpen(false); setQrCode(''); }}>×</button></div><p>分享這個固定網址，朋友打開連結或掃描 QR Code 就能進入直播間。</p><div className="share-options"><button onClick={copyShareUrl}>複製網址</button><button onClick={showQrCode}>顯示 QR Code</button></div><label>直播網址<input readOnly value={shareUrl} onFocus={(event) => event.target.select()}/></label>{qrCode && <div className="qr-code" role="status"><img src={qrCode} alt="直播網站 QR Code"/><span>使用手機相機掃描即可進入</span></div>}</dialog>}
      <div className="room-grid"><section className="broadcast" aria-label="直播間">
        <div className="video-wrap"><div className="duo-section"><h2>雙 OBS 同台直播</h2><div className="duo-grid">{[{ path: 'live', name: room.host?.nickname || '第一台 OBS', userId: room.host?.userId }, { path: 'guest', name: room.guest?.nickname || '第二台 OBS', userId: room.guest?.userId }].map((source) => <Player key={source.path} path={source.path} name={source.name} silent={Boolean(user && source.userId === user.id)} live={connected && Boolean(state.sources?.[source.path]?.live)}/>)}</div></div><GiftOverlay gifts={gifts} onDone={() => setGifts((items) => items.slice(1))}/>{overlay && <div className={`stream-overlay ${overlay.type}`} role="status">{overlay.type === 'donation' ? <><strong>🎁 {overlay.nickname} 應援 {overlay.amount} 點</strong><span>謝謝支持！</span></> : <><strong>{overlay.nickname}</strong><span>{overlay.text}</span></>}</div>}<span className={`live-badge ${(state.live || state.sources?.guest?.live) && connected ? 'is-live' : ''}`}>{!connected ? '連線中' : state.live || state.sources?.guest?.live ? '● LIVE' : state.available ? '● OFFLINE' : '服務連線中'}</span>{heart > 0 && <span key={heart} className="floating-heart" aria-hidden="true">♥</span>}</div>
        <div className="stream-info"><div className="avatar">09</div><div><h2>Group 9 · Cloud-Based Live Streaming</h2><p>王昱程 × 曹少懷 <span>·</span> 直播 / 交流 / 一起探索</p></div></div>
        <div className="stream-actions"><span><b>{connected ? state.viewers : '—'}</b> 個連線分頁</span><button disabled={!connected} aria-label="為直播按讚" onClick={() => socket.timeout(5000).emit('like', (timeout, result) => { if (timeout || result.error) setError(result?.error || '按讚連線逾時。'); })}>♡ <b>{state.likes}</b> 喜歡</button><span className="quality">{useWebRTC ? 'WebRTC' : 'HLS'} · 雙 OBS</span></div>
        <section className="gift-shop" aria-label="直播禮物"><div className="gift-shop-heading"><strong>送禮物</strong><span>我的點數 <b>{user?.points || 0}</b> · 本場應援 <b>{state.supportTotal || 0}</b></span></div><div className="gift-options">{GIFTS.map(({ amount, name, icon, kind }) => <button className={`gift-option gift-option-${kind}`} title={`${name} ${amount} 點`} key={amount} disabled={!connected || !user || !room.host || room.host.userId === user.id || user.points < amount || donating || Boolean(pendingDonation)} onClick={() => donate(amount)}><span className="gift-option-icon" aria-hidden="true">{icon}</span><span>{name}</span><b>{amount} 點</b></button>)}</div>{pendingDonation && <div className="pending-donation"><button disabled={donating} onClick={() => donate(pendingDonation.amount)}>重試同一筆禮物</button><button disabled={donating} onClick={() => setPendingDonation(null)}>關閉待確認</button></div>}</section>
        <form className="speech-redeem" onSubmit={(event) => { event.preventDefault(); if (speechText.trim()) donate(VOICE_MESSAGE_POINTS, speechText.trim()); }}><label>點數語音留言（{VOICE_MESSAGE_POINTS} 點，最多 120 字）<input maxLength="120" disabled={donating || Boolean(pendingDonation)} value={speechText} onChange={(event) => setSpeechText(event.target.value)} placeholder="想讓直播唸出的內容" required/></label><button disabled={!connected || !user || !room.host || room.host.userId === user.id || user.points < VOICE_MESSAGE_POINTS || donating || Boolean(pendingDonation) || !speechText.trim()}>花 {VOICE_MESSAGE_POINTS} 點送出語音留言</button><p className="muted">語音留言是獨立項目，不會顯示成火箭。測試版為 {VOICE_MESSAGE_POINTS} 點，正式版預定提高為 50 點。</p></form>
        <div className="play-hint">觀眾可分別開啟兩路音量。登入的上鏡者已自動關閉自己的返聽；免耳機模式請先啟動本機 AEC，OBS 使用 AEC Browser Source，並停用原始麥克風與桌面音訊。{!useWebRTC && 'HLS 影音會比聊天稍晚。'}</div>
        {user && (room.host?.userId === user.id || room.guest?.userId === user.id) && <OBSControls command={command} onError={onError}/>}
        {user && room.host && !room.guest && room.host.userId !== user.id && !management && <section className="management" aria-label="申請第二位主播"><h2>加入直播</h2><p>送出申請後，第一位主播按同意即可讓你使用第二路。</p><button disabled={roomBusy} onClick={() => roomAction('room:request')}>{roomBusy ? '申請中…' : '申請成為第二位主播'}</button></section>}
        {room.host?.userId === user?.id && roomRequests.length > 0 && <section className="management" aria-label="第二位主播申請"><h2>第二位主播申請</h2>{roomRequests.map((request) => <div key={request.userId}><span>{request.nickname}</span> <button disabled={roomBusy} onClick={() => roomAction('room:approve', request.userId)}>同意加入</button></div>)}</section>}
        {management && !room.host && <section className="management" aria-label="重新開啟點數應援"><h2>點數應援已結束</h2><p>重新開啟後，觀眾即可再次送禮物與點數語音留言。</p><button disabled={roomBusy} onClick={() => roomAction('room:start', { audioChecklist: true })}>{roomBusy ? '開啟中…' : '重新開啟點數應援'}</button></section>}
        {management && room.host && !room.guest && room.host.userId !== user.id && <section className="management" aria-label="第二位主播加入"><h2>第二位主播加入</h2><p>在第二台電腦完成 OBS 與 AEC 設定後，按一下即可占用第二路；第一位主播不用操作。</p><button disabled={roomBusy} onClick={() => roomAction('room:join')}>以第二位主播加入</button></section>}
        {management && room.host && <section className="management" aria-label="OBS 直播間控制"><h2>OBS 直播間控制</h2><p>本場主持人：{room.host.nickname} · 第二位：{room.guest?.nickname || '等待自行加入'}</p><button disabled={roomBusy || (room.host.userId !== user.id && user.role !== 'admin')} onClick={() => roomAction('room:end')}>結束本場應援記帳</button><p className="muted">主持人登入後會自動建立直播間；第二位自行加入。結束記帳不會遙控 OBS。</p></section>}
      </section>
      <aside className="chat-panel" aria-label="即時聊天室"><div className="chat-heading"><h2>即時聊天室 <span>LIVE CHAT</span></h2><span className="chat-dot"/></div>
        {chatSettings.announcement && <div className="announcement" role="status">📌 {chatSettings.announcement}</div>}
        <div className="chat-welcome"><strong>歡迎來到 Group 9 👋</strong><p>選個暱稱，和正在觀看的朋友聊聊。請友善交流，勿分享私人資訊。</p></div>
        <div className="messages" ref={chat} role="log" aria-live="polite" aria-relevant="additions" aria-label="聊天訊息">
          {messages.length === 0 && <div className="empty-chat">美好的對話，從一句哈囉開始。</div>}
          {messages.map((message) => <div className="message" key={message.id}><div className="message-line"><strong>{message.nickname}</strong><p>{message.text}</p><time dateTime={message.at}>{new Date(message.at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</time></div>{user && <div className="message-tools"><button onClick={() => { const reason = window.prompt('檢舉原因（最多 200 字）'); if (reason) command('chat:report', { messageId: message.id, reason }).then(() => setNotice('檢舉已送出')).catch(onError); }}>檢舉</button>{management && <><button onClick={() => command('chat:manage', { action: 'delete', messageId: message.id }).catch(onError)}>刪除</button><button onClick={() => command('chat:manage', { action: 'mute', userId: message.userId, minutes: 10 }).catch(onError)}>禁言</button><button onClick={() => command('chat:manage', { action: 'mute', userId: message.userId, minutes: 0 }).catch(onError)}>解除禁言</button></>}</div>}</div>)}
        </div>
        <div className="composer">{user ? <><div className="identity">以 <b>{user.nickname}</b> 發言 · 間隔 {chatSettings.slowSeconds} 秒</div><form onSubmit={send}><label className="sr-only" htmlFor="message">聊天訊息</label><div className="chat-input-row"><input id="message" maxLength="500" enterKeyHint="send" autoComplete="off" placeholder="傳送聊天訊息…" value={text} onChange={(e) => setText(e.target.value)} disabled={!connected}/><button className="primary" disabled={!connected || sending || !text.trim()}>{sending ? '傳送中…' : '傳送'}</button></div><div className="compose-footer"><span>Enter 直接傳送 · 一般聊天不會朗讀</span><span>{text.length}/500</span></div></form></> : <p>正在建立訪客身份，連線完成後即可聊天。</p>}
          {error && <p className="error" role="alert">{error}</p>}
        </div>
      </aside></div>
      <Account socket={socket} key={user?.id || 'guest'} user={user} available={accountsAvailable} onChange={reloadAccount} command={command} onError={onError}/>
      {management && <Moderation command={command} onError={onError}/>}
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="關閉分享提示" onClick={() => setNotice('')}>×</button></div>}
      <footer><span>GROUP 09 / CLOUD-BASED LIVE STREAMING PLATFORM</span><span>連線數依分頁計算 · 聊天顯示最近 100 則 · 帳號與交易持久保存</span></footer>
    </main>
  </>;
}

createRoot(document.getElementById('root')).render(<App/>);
