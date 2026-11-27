import OBSControls from './OBSControls.jsx';
import BrowserBroadcast from './BrowserBroadcast.jsx';
import { enqueueGift, GIFTS, VOICE_MESSAGE_POINTS } from '../gifts.mjs';
import GiftOverlay from './GiftOverlay.jsx';
import { giftSoundEnabled, setGiftSoundEnabled } from './giftSound.js';
import { speak } from './speech.js';
import { VOICES, DEFAULT_VOICE } from '../voices.mjs';
import SessionStats from './SessionStats.jsx';
import HealthPanel from './HealthPanel.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Hls from 'hls.js';
import MediaMTXWebRTCReader from './vendor/mediamtx-reader.js';
import { io } from 'socket.io-client';
import QRCode from 'qrcode';
import './style.css';
import Account from './Account.jsx';
import Moderation from './Moderation.jsx';
import { preferredLanguage, translate } from './i18n.mjs';

const base = import.meta.env.BASE_URL;
const useWebRTC = import.meta.env.VITE_WEBRTC === 'true';
const socket = io({ autoConnect: false, path: `${base}socket.io` });

function Player({ live, path = 'live', name, silent = false, t }) {
  const video = useRef(null);
  const [muted, setMuted] = useState(true);
  const [error, setError] = useState('');
  const [attempt, retry] = useState(0);
  useEffect(() => {
    setError('');
    if (!live) return;
    const element = video.current;
    const preventSelfMonitor = () => {
      element.muted = silent || muted;
      element.volume = element.muted ? 0 : 1;
    };
    preventSelfMonitor();
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
  }, [live, attempt, path, silent, muted]);
  return <div className="player">
    <video ref={video} controls={false} autoPlay muted={silent || muted} playsInline aria-label={`${name}${t('的 OBS 直播')}`} hidden={!live}/>
    <span className="source-name">{name} · {live ? 'LIVE' : 'OFFLINE'}{silent && ` · ${t('自己返聽已關閉')}`}</span>
    {live && !silent && <button type="button" className={`audio-toggle ${muted ? '' : 'on'}`} aria-label={`${muted ? t('播放聲音') : t('關閉聲音')} · ${name}`} onClick={() => setMuted((value) => !value)}>{muted ? `🔈 ${t('播放聲音')}` : `🔊 ${t('關閉聲音')}`}</button>}
    {!live && <div className="offline"><span className="signal">◉</span><h2>{name}{t('尚未推流')}</h2><p>{t('連線恢復後會自動播放。')}</p></div>}
    {error && <div role="status" className="video-error">{t(error)}<button onClick={() => retry((n) => n + 1)}>{t('重試播放')}</button></div>}
  </div>;
}

function App() {
  const [language, setLanguage] = useState(() => preferredLanguage(window.localStorage));
  const t = React.useCallback((key) => translate(language, key), [language]);
  useEffect(() => { document.documentElement.lang = language === 'en' ? 'en' : 'zh-Hant'; try { window.localStorage.setItem('group9-language', language); } catch {} }, [language]);
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState({ live: false, available: false, viewers: 0, likes: 0 });
  const [user, setUser] = useState(null);
  const [accountsAvailable, setAccountsAvailable] = useState(false);
  const [room, setRoom] = useState({ host: null, guest: null, broadcastId: null });
  const [roomRequests, setRoomRequests] = useState([]);
  const [chatSettings, setChatSettings] = useState({ announcement: '', slowSeconds: 5, voiceCooldownSeconds: 60 });
  const [pendingDonation, setPendingDonation] = useState(null);
  const [speechText, setSpeechText] = useState('');
  const [voiceCooldownUntil, setVoiceCooldownUntil] = useState(0);
  const [voiceCooldownRemaining, setVoiceCooldownRemaining] = useState(0);
  const [donating, setDonating] = useState(false);
  const [roomBusy, setRoomBusy] = useState(false);
  const [gifts, setGifts] = useState([]);
  const giftIds = useRef(new Set());
  const [overlay, setOverlay] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const gifInput = useRef(null);
  const [heart, setHeart] = useState(0);
  const [notice, setNotice] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [giftSound, setGiftSound] = useState(giftSoundEnabled);
  const [myRank, setMyRank] = useState(null);
  const [voiceChoice, setVoiceChoice] = useState(() => { try { const saved = localStorage.getItem('g9-voice'); return VOICES.some((v) => v.id === saved) ? saved : DEFAULT_VOICE; } catch { return DEFAULT_VOICE; } });
  const previewAudio = useRef(null);
  const voiceAudio = useRef(null); // the voice message being read aloud (so it can be skipped)
  function chooseVoice(id) { setVoiceChoice(id); try { localStorage.setItem('g9-voice', id); } catch {} }
  function previewVoice() {
    previewAudio.current?.pause();
    const audio = new Audio(`${base}api/voice/preview/${voiceChoice}.mp3`); audio.volume = 0.9; previewAudio.current = audio;
    audio.play().catch(() => setError(t('試聽暫時無法播放。')));
  }
  const [qrCode, setQrCode] = useState('');
  const chat = useRef(null);
  const management = ['host', 'admin'].includes(user?.role);
  const canSkipVoice = Boolean(user && (user.role === 'admin' || room.host?.userId === user.id || room.guest?.userId === user.id));
  const liveNow = connected && Boolean(state.sources?.live?.live || state.sources?.guest?.live || room.donationsEnabled);
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
        if (gift.audio) {
          // Natural neural voice synthesized once on the server; browser voice only as a fallback.
          const voice = new Audio(`${base}api/voice/${gift.id}.mp3`);
          voice.volume = 0.9; voiceAudio.current?.pause(); voiceAudio.current = voice;
          let fellBack = false; const fallback = () => { if (!fellBack) { fellBack = true; speak(gift.message); } };
          voice.addEventListener('error', fallback, { once: true });
          voice.play().catch((error) => { if (error?.name !== 'NotAllowedError') fallback(); });
        } else speak(gift.message);
      } else setGifts((items) => enqueueGift(items, gift));
    };
    const onVoiceSkip = () => { voiceAudio.current?.pause(); voiceAudio.current = null; window.speechSynthesis?.cancel(); setOverlay((value) => value?.type === 'speech' ? null : value); };
    const onLike = ({ likes }) => { setState((value) => ({ ...value, likes })); setHeart((n) => n + 1); };
    const onDeleted = (id) => { setMessages((items) => items.filter((message) => message.id !== id)); setOverlay((value) => value?.id === id ? null : value); };
    const onState = (value) => { setState(value); setRoom(value.room || { host: null, guest: null, broadcastId: null }); };
    socket.on('connect', onConnect).on('disconnect', onDisconnect).on('state', onState).on('account', setUser).on('room:state', setRoom).on('room:requests', setRoomRequests).on('chat:settings', setChatSettings).on('chat:deleted', onDeleted).on('history', setMessages).on('chat', onMessage).on('donation', onDonation).on('like', onLike).on('rank', setMyRank).on('voice:skip', onVoiceSkip);
    socket.on('connect_error', onDisconnect);
    reloadAccount().catch(onError);
    return () => { socket.removeAllListeners(); socket.disconnect(); window.speechSynthesis?.cancel(); window.clearTimeout(window.__group9OverlayTimer); };
  }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 3000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    const update = () => setVoiceCooldownRemaining(Math.max(0, Math.ceil((voiceCooldownUntil - Date.now()) / 1000)));
    update();
    if (!voiceCooldownUntil) return undefined;
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [voiceCooldownUntil]);
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
  async function sendGif(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !connected || !user || sending) return;
    if (file.type !== 'image/gif') return setError('僅支援 GIF 圖片。');
    if (file.size > 512 * 1024) return setError('GIF 不得超過 512 KB。');
    setSending(true); setError('');
    try {
      const response = await fetch(`${base}api/chat/gif`, { method: 'POST', headers: { 'Content-Type': 'image/gif' }, body: file });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'GIF 上傳失敗。');
    } catch (error) { onError(error); }
    finally { setSending(false); }
  }
  async function donate(amount, message = '') {
    const request = pendingDonation || { amount, requestId: crypto.randomUUID(), broadcastId: room.broadcastId, senderId: user?.id, message, ...(message ? { voice: voiceChoice } : {}) };
    setPendingDonation(request); setDonating(true); setError('');
    try { await command('donate', request); setPendingDonation(null); if (request.message) { setSpeechText(''); setVoiceCooldownUntil(Date.now() + chatSettings.voiceCooldownSeconds * 1000); } }
    catch (error) { onError(error); }
    finally { setDonating(false); }
  }
  const shareUrl = new URL(base, location.origin).href;
  async function copyShareUrl() {
    try { await navigator.clipboard.writeText(shareUrl); setNotice(t('觀看連結已複製')); }
    catch { setNotice(`${t('無法自動複製，請手動複製：')}${shareUrl}`); }
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
    <header className="topbar"><a href={base} className="brand"><span className="brand-icon">◉</span> CLOUD<span>LIVE</span><small>GROUP 09</small></a><span className="course-tag">{t('電子工程總整課程 · NTUST')}</span><div className="topbar-tools"><button type="button" className="language-toggle" onClick={() => setLanguage((value) => value === 'zh' ? 'en' : 'zh')} aria-label={language === 'zh' ? 'Switch to English' : '切換成中文'}>{language === 'zh' ? 'English' : '中文'}</button><span className={`connection ${connected ? 'online' : ''}`}>{t(connected ? '已連線' : '重新連線中…')}</span></div></header>
    <main>
      <div className="eyebrow">ONE ROOM. SHARED MOMENTS.</div>
      <div className="heading"><div><h1>{t('讓每個瞬間，')}<em>{t('即時相聚。')}</em></h1><p>{t('一場直播，一個聊天室。打開瀏覽器，就在現場。')}</p></div><button className="share" onClick={() => setShareOpen(true)}>↗ {t('分享直播間')}</button></div>
      {shareOpen && <dialog className="share-dialog" open aria-labelledby="share-title"><div className="share-dialog-heading"><h2 id="share-title">{t('分享直播間')}</h2><button aria-label={t('關閉分享視窗')} onClick={() => { setShareOpen(false); setQrCode(''); }}>×</button></div><p>{t('分享這個固定網址，朋友打開連結或掃描 QR Code 就能進入直播間。')}</p><div className="share-options"><button onClick={copyShareUrl}>{t('複製網址')}</button><button onClick={showQrCode}>{t('顯示 QR Code')}</button></div><label>{t('直播網址')}<input readOnly value={shareUrl} onFocus={(event) => event.target.select()}/></label>{qrCode && <div className="qr-code" role="status"><img src={qrCode} alt={t('直播網站 QR Code')}/><span>{t('使用手機相機掃描即可進入')}</span></div>}</dialog>}
      <div className="room-grid"><section className="broadcast" aria-label={t('直播間')}>
        <div className="video-wrap"><div className="duo-section"><h2>{t('雙 OBS 同台直播')}</h2><div className="duo-grid">{[{ path: 'live', name: room.host?.nickname || t('第一台 OBS'), userId: room.host?.userId }, { path: 'guest', name: room.guest?.nickname || t('第二台 OBS'), userId: room.guest?.userId }].map((source) => <Player key={source.path} path={source.path} name={source.name} silent={Boolean(user && source.userId === user.id)} live={connected && Boolean(state.sources?.[source.path]?.live)} t={t}/>)}</div></div><GiftOverlay gifts={gifts} onDone={() => setGifts((items) => items.slice(1))} t={t}/>{overlay && <div className={`stream-overlay ${overlay.type}`} role="status">{overlay.type === 'donation' ? <><strong>🎁 {overlay.nickname} {t('應援')} {overlay.amount} {t('點')}</strong><span>{t('謝謝支持！')}</span></> : <><strong>{overlay.nickname}</strong><span>{overlay.text}</span>{canSkipVoice && <button type="button" className="skip-voice" onClick={() => command('voice:skip', overlay.id).catch(onError)}>⏹ {t('停止朗讀')}</button>}</>}</div>}<span className={`live-badge ${(state.live || state.sources?.guest?.live) && connected ? 'is-live' : ''}`}>{!connected ? t('連線中') : state.live || state.sources?.guest?.live ? '● LIVE' : state.available ? '● OFFLINE' : t('服務連線中')}</span>{heart > 0 && <span key={heart} className="floating-heart" aria-hidden="true">♥</span>}</div>
        <div className="stream-info"><div className="avatar">09</div><div><h2>Group 9 · Cloud-Based Live Streaming</h2><p>王昱程 × 曹少懷 <span>·</span> {t('直播 / 交流 / 一起探索')}</p></div></div>
        <div className="stream-actions"><span><b>{connected ? state.viewers : '—'}</b> {t('個連線分頁')}</span><button disabled={!connected} aria-label={t('為直播按讚')} onClick={() => socket.timeout(5000).emit('like', (timeout, result) => { if (timeout || result.error) setError(result?.error || '按讚連線逾時。'); })}>♡ <b>{state.likes}</b> {t('喜歡')}</button><span className="quality">{useWebRTC ? 'WebRTC' : 'HLS'} · {t('雙 OBS 同台直播')}</span></div>
        <section className="gift-shop" aria-label={t('直播禮物')}><div className="gift-shop-heading"><strong>{t('送禮物')}</strong><button type="button" className={`gift-sound-toggle ${giftSound ? 'on' : ''}`} aria-pressed={giftSound} onClick={() => { setGiftSoundEnabled(!giftSound); setGiftSound(!giftSound); }}>{giftSound ? '🔔' : '🔕'} {t(giftSound ? '禮物音效：開（小聲）' : '禮物音效：關')}</button><span>{t('我的點數')} <b>{user?.points || 0}</b> · {t('本場應援')} <b>{state.supportTotal || 0}</b></span></div><div className="gift-options">{GIFTS.map(({ amount, name, icon, kind }) => <button className={`gift-option gift-option-${kind}`} title={`${t(name)} ${amount} ${t('點')}`} key={amount} disabled={!liveNow || !user || !room.host || room.host.userId === user.id || user.points < amount || donating || Boolean(pendingDonation)} onClick={() => donate(amount)}><span className="gift-option-icon" aria-hidden="true">{icon}</span><span>{t(name)}</span><b>{amount} {t('點')}</b></button>)}</div>{pendingDonation && <div className="pending-donation"><button disabled={donating} onClick={() => donate(pendingDonation.amount)}>{t('重試同一筆禮物')}</button><button disabled={donating} onClick={() => setPendingDonation(null)}>{t('關閉待確認')}</button></div>}</section>
        <section className="leaderboard" aria-label={t('本場應援榜')}><div className="leaderboard-heading"><strong>🏆 {t('本場應援榜')}</strong><span>TOP {Math.max(state.leaderboard?.length || 0, 1)}</span></div>{state.leaderboard?.length ? <ol>{state.leaderboard.map((row, i) => <li key={`${row.nickname}-${row.total}`} className={`rank-${i + 1}`}><span className="rank">{['🥇', '🥈', '🥉'][i] || i + 1}</span><span className="who">{row.nickname}</span><span className="points">{row.total} {t('點')} · {row.gifts} {t('次')}</span></li>)}</ol> : <p className="muted">{t('還沒有人送禮物，成為第一位支持者吧！')}</p>}{user && myRank && myRank.broadcastId === room.broadcastId && <p className="my-rank" role="status">{myRank.rank ? <>{t('你目前第')} <b key={myRank.total}>{myRank.rank}</b> {t('名')} · <b>{myRank.total}</b> {t('點')}</> : t('你這一場還沒送禮物。')}</p>}<p className="muted leaderboard-note">{t('依本場累計送出的點數排名，送禮後立即更新；同分時先達到的人排前面。')}</p></section>
        <form className="speech-redeem" onSubmit={(event) => { event.preventDefault(); if (speechText.trim() && !voiceCooldownRemaining) donate(VOICE_MESSAGE_POINTS, speechText.trim()); }}><label>{t('點數語音留言')}（{VOICE_MESSAGE_POINTS} {t('點')}，{t('最多 120 字')}）<input maxLength="120" disabled={donating || Boolean(pendingDonation) || Boolean(voiceCooldownRemaining)} value={speechText} onChange={(event) => setSpeechText(event.target.value)} placeholder={t('想讓直播唸出的內容')} required/></label>{state.neuralVoices && <div className="voice-picker"><label>{t('朗讀聲音')}<select value={voiceChoice} onChange={(event) => chooseVoice(event.target.value)}>{VOICES.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label><button type="button" className="voice-preview" onClick={previewVoice}>▶ {t('試聽')}</button></div>}<button disabled={!liveNow || !user || !room.host || room.host.userId === user.id || user.points < VOICE_MESSAGE_POINTS || donating || Boolean(pendingDonation) || Boolean(voiceCooldownRemaining) || !speechText.trim()}>{t('花')} {VOICE_MESSAGE_POINTS} {t('點')} {t('送出語音留言')}</button><p className="muted">{t('任一路直播畫面正在播放時即可送出；語音留言每次 25 點')}{voiceCooldownRemaining ? `，${t('目前還剩')} ${voiceCooldownRemaining} ${t('秒。')}` : chatSettings.voiceCooldownSeconds ? `，${t('送出後等待')} ${chatSettings.voiceCooldownSeconds} ${t('秒。')}` : `，${t('目前不設間隔。')}`}</p></form>
        <div className="play-hint">{t('觀眾可分別開啟兩路音量。登入的上鏡者已自動關閉自己的返聽；免耳機模式請先啟動本機 AEC，OBS 使用 AEC Browser Source，並停用原始麥克風與桌面音訊。')}{!useWebRTC && t('HLS 影音會比聊天稍晚。')}</div>
        {user && room.guest?.userId === user.id && state.guestIdleLeft != null && <p className="guest-idle-notice" role="status">⏳ {t('第二路尚未推流，')}{state.guestIdleLeft} {t('秒後會自動讓出位置給其他人。')}</p>}
        {user && room.guest?.userId === user.id && <div className="duo-controls leave-slot"><button type="button" disabled={roomBusy} onClick={() => { if (window.confirm(t('確定離開第二路？你的直播會停止，位置讓給其他人。'))) void roomAction('room:leave'); }}>🚪 {t('離開第二路')}</button></div>}
        {user && (room.host?.userId === user.id || room.guest?.userId === user.id) && <BrowserBroadcast path={room.host?.userId === user.id ? 'live' : 'guest'} onError={onError} t={t}/>}
        {user && (room.host?.userId === user.id || room.guest?.userId === user.id) && <OBSControls command={command} onError={onError} t={t}/>}
        {user && room.host && !room.guest && room.host.userId !== user.id && !management && <section className="management" aria-label={t('加入第二路直播')}><h2>{t('加入直播')}</h2><p>{t('任何已登入的主播都可以直接占用第二路，不需要第一位主播同意。')}{t('加入後 3 分鐘內沒有開始推流，會自動讓出第二路。')}</p><button disabled={roomBusy} onClick={() => roomAction('room:join')}>{t(roomBusy ? '加入中…' : '直接加入第二路')}</button></section>}
        {room.host?.userId === user?.id && roomRequests.length > 0 && <section className="management" aria-label={t('第二位主播申請')}><h2>{t('第二位主播申請')}</h2>{roomRequests.map((request) => <div key={request.userId}><span>{request.nickname}</span> <button disabled={roomBusy} onClick={() => roomAction('room:approve', request.userId)}>{t('同意加入')}</button></div>)}</section>}
        {management && !liveNow && <section className="management" aria-label={t('直播未開始')}><h2>{t('等待直播畫面')}</h2><p>{t('任一路 OBS 出現直播畫面後，觀眾即可送禮物與點數語音留言。')}</p></section>}
        {management && room.host && !room.guest && room.host.userId !== user.id && <section className="management" aria-label={t('第二位主播加入')}><h2>{t('第二位主播加入')}</h2><p>{t('在第二台電腦完成 OBS 與 AEC 設定後，按一下即可占用第二路；第一位主播不用操作。')}</p><button disabled={roomBusy} onClick={() => roomAction('room:join')}>{t('以第二位主播加入')}</button></section>}
        {management && <HealthPanel command={command} t={t}/>}
        {user && room.host && (room.host.userId === user.id || user.role === 'admin') && <SessionStats command={command} onError={onError} t={t} broadcastId={room.broadcastId}/>}
        {management && <section className="management" aria-label={t('抖內控制')}><h2>{t('抖內控制')}</h2><p>{room.host ? `${t('本場主持人：')}${room.host.nickname} · ${t('第二位：')}${room.guest?.nickname || t('等待自行加入')}` : t('目前沒有直播主加入直播間。')}</p><button disabled={roomBusy || user.role !== 'admin'} onClick={() => roomAction('room:donations', !room.donationsEnabled)}>{t(room.donationsEnabled ? '關閉抖內' : '重新開啟抖內')}</button><p className="muted">{t('管理員可隨時開關；主播建立直播間時會自動開啟。')}</p></section>}
      </section>
      <aside className="chat-panel" aria-label={t('即時聊天室')}><div className="chat-heading"><h2>{t('即時聊天室')} <span>LIVE CHAT</span></h2><span className="chat-dot"/></div>
        {chatSettings.announcement && <div className="announcement" role="status">📌 {chatSettings.announcement}</div>}
        <div className="chat-welcome"><strong>{t('歡迎來到 Group 9 👋')}</strong><p>{t('選個暱稱，和正在觀看的朋友聊聊。請友善交流，勿分享私人資訊。')}</p></div>
        <div className="messages" ref={chat} role="log" aria-live="polite" aria-relevant="additions" aria-label={t('聊天訊息')}>
          {messages.length === 0 && <div className="empty-chat">{t('美好的對話，從一句哈囉開始。')}</div>}
          {messages.map((message) => <div className="message" key={message.id}><div className="message-line"><strong>{message.nickname}</strong>{message.gifId ? <img className="chat-gif" src={`${base}api/chat/gif/${message.gifId}`} alt={t('GIF 貼圖')} loading="lazy"/> : <p>{message.text}</p>}<time dateTime={message.at}>{new Date(message.at).toLocaleTimeString(language === 'en' ? 'en-US' : 'zh-TW', { hour: '2-digit', minute: '2-digit' })}</time></div>{user && <div className="message-tools">{!management && <button onClick={() => { const reason = window.prompt(t('檢舉原因（最多 200 字）')); if (reason) command('chat:report', { messageId: message.id, reason }).then(() => setNotice(t('檢舉已送出'))).catch(onError); }}>{t('檢舉')}</button>}{management && <><button onClick={() => command('chat:manage', { action: 'delete', messageId: message.id }).catch(onError)}>{t('刪除')}</button><button onClick={() => command('chat:manage', { action: 'mute', userId: message.userId, minutes: 10 }).catch(onError)}>{t('禁言')}</button><button onClick={() => command('chat:manage', { action: 'mute', userId: message.userId, minutes: 0 }).catch(onError)}>{t('解除禁言')}</button></>}</div>}</div>)}
        </div>
        <div className="composer">{user ? <><div className="identity">{t('以')} <b>{user.nickname}</b> {t('發言 · 間隔')} {chatSettings.slowSeconds} {t('秒。')}</div><form onSubmit={send}><label className="sr-only" htmlFor="message">{t('聊天訊息')}</label><div className="chat-input-row"><input id="message" maxLength="500" enterKeyHint="send" autoComplete="off" placeholder={t('傳送聊天訊息…')} value={text} onChange={(e) => setText(e.target.value)} disabled={!connected}/><button className="primary" disabled={!connected || sending || !text.trim()}>{t(sending ? '傳送中…' : '傳送')}</button></div><div className="compose-footer"><span>{t('Enter 直接傳送 · 一般聊天不會朗讀')}</span><span>{text.length}/500</span></div></form><div className="gif-composer"><input ref={gifInput} type="file" accept="image/gif,.gif" className="sr-only" aria-label={t('選擇 GIF')} onChange={sendGif}/><button type="button" disabled={!connected || sending} onClick={() => gifInput.current?.click()}>GIF · {t('傳送 GIF')}</button><span>{t('GIF 不得超過 512 KB，尺寸不得超過 512 × 512。')}</span></div></> : <p>{t('正在建立訪客身份，連線完成後即可聊天。')}</p>}
          {error && <p className="error" role="alert">{t(error)}</p>}
        </div>
      </aside></div>
      <Account socket={socket} key={user?.id || 'guest'} user={user} available={accountsAvailable} onChange={reloadAccount} command={command} onError={onError} t={t} language={language}/>
      {management && <Moderation command={command} onError={onError} t={t} language={language}/>}
      {error && <p className="error" role="alert">{t(error)}</p>}
      {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label={t('關閉分享提示')} onClick={() => setNotice('')}>×</button></div>}
      <footer><span>GROUP 09 / CLOUD-BASED LIVE STREAMING PLATFORM</span><span>{t('連線數依分頁計算 · 聊天顯示最近 100 則 · 帳號與交易持久保存')}</span></footer>
    </main>
  </>;
}

createRoot(document.getElementById('root')).render(<App/>);
