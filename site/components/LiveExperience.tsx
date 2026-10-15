'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Room, RoomEvent, Track, createLocalTracks, type RemoteTrack } from 'livekit-client';
import { Camera, Radio, ArrowUpRight, Eye, Link2, Mic, MicOff, VideoOff, Send, Square, Volume2 } from 'lucide-react';
import { decodeChatPayload, inviteFromInput, joinViewerSession, leaveSession, MAX_CHAT_BYTES, startHostSession, stopSession } from '../lib/live-session';

type Mode = 'host' | 'viewer';
type Status = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline';
type Grant = { room: string; livekitUrl: string; token: string; inviteUrl?: string; expiresAt?: number };
type Message = { id: number; sender: string; text: string };

function errorText(error: unknown): string {
  if (error instanceof Error && ['NotAllowedError', 'PermissionDeniedError'].includes(error.name)) return '相機或麥克風權限遭拒。請在瀏覽器設定允許存取，再重新開始直播。';
  if (error instanceof Error && ['NotFoundError', 'DevicesNotFoundError'].includes(error.name)) return '找不到相機或麥克風。請確認裝置已連接，再重新開始。';
  return error instanceof Error ? error.message : '連線失敗，請稍後重試。';
}

export default function LiveExperience() {
  const [mode, setMode] = useState<Mode>('host');
  const [creatorKey, setCreatorKey] = useState('');
  const [invite, setInvite] = useState('');
  const [grant, setGrant] = useState<Grant | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [viewers, setViewers] = useState(0);
  const [hasVideo, setHasVideo] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [needsAudio, setNeedsAudio] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const attached = useRef(new Map<Track, HTMLMediaElement>());
  const operation = useRef(0);
  const requestRef = useRef<AbortController | null>(null);
  const messageId = useRef(0);
  const messageEnd = useRef<HTMLDivElement>(null);

  function clearMedia() {
    for (const [track, element] of attached.current) { track.detach(element); element.remove(); }
    attached.current.clear(); setHasVideo(false);
  }

  useEffect(() => {
    const readInvite = () => {
      const fromHash = inviteFromInput(window.location.hash);
      if (fromHash && !roomRef.current && !requestRef.current) { setInvite(fromHash); setMode('viewer'); }
    };
    const offline = () => { if (roomRef.current) setNotice('目前裝置離線，等待網路恢復。'); };
    const online = () => { if (roomRef.current) setNotice('網路已恢復；若連線未恢復，請重新加入。'); };
    readInvite();
    window.addEventListener('hashchange', readInvite);
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    const onPageHide = () => { void leave(); };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('hashchange', readInvite);
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
      window.removeEventListener('pagehide', onPageHide);
      operation.current += 1; requestRef.current?.abort();
      if (roomRef.current) void stopSession(roomRef.current).catch(() => {});
      for (const [track, element] of attached.current) { track.detach(element); element.remove(); }
      attached.current.clear();
    };
  }, []);

  useEffect(() => {
    const log = messageEnd.current?.parentElement;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages]);

  function addMessage(sender: string, text: string) {
    setMessages(previous => [...previous.slice(-99), { id: ++messageId.current, sender, text }]);
  }

  async function begin(event: FormEvent) {
    event.preventDefault();
    const attempt = ++operation.current;
    const selectedMode = mode;
    setBusy(true); setError(''); setNotice(''); setMessages([]); setGrant(null);
    setMicOn(true); setCameraOn(true); setNeedsAudio(false); setStatus('connecting');
    const controller = new AbortController(); requestRef.current = controller;
    const body = selectedMode === 'host' ? { creatorKey } : { invite: inviteFromInput(invite) };
    setCreatorKey('');
    let room: Room | null = null;
    try {
      const response = await fetch(`/api/${selectedMode === 'host' ? 'create' : 'join'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), cache: 'no-store', signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(response.status === 503 ? '直播服務尚未設定完成，請稍後再試。'
          : response.status === 403 ? selectedMode === 'host' ? '開播金鑰不正確。請重新輸入。' : '邀請連結無效或已到期，請向直播主索取新連結。'
          : '無法加入直播，請檢查連結後重試。');
      }
      const data: Grant = await response.json();
      if (attempt !== operation.current) return;
      setGrant(data);
      room = new Room({ adaptiveStream: true, dynacast: true }); roomRef.current = room;
      const currentRoom = room;
      const active = () => operation.current === attempt && roomRef.current === currentRoom;
      const count = () => { if (active()) setViewers(currentRoom.remoteParticipants.size); };
      const refreshVideo = () => { if (active()) setHasVideo([...attached.current].some(([track]) => track.kind === Track.Kind.Video && !track.isMuted)); };
      const attach = (track: Track) => {
        if (!active() || attached.current.has(track)) return;
        // Local audio must never play back into the host microphone.
        if (selectedMode === 'host' && track.kind !== Track.Kind.Video) return;
        const element = track.attach(); element.autoplay = true;
        if (element instanceof HTMLVideoElement) { element.playsInline = true; element.muted = selectedMode === 'host'; }
        element.setAttribute('aria-label', selectedMode === 'host' ? '本機相機預覽' : track.kind === Track.Kind.Video ? '直播畫面' : '直播音訊');
        attached.current.set(track, element); mediaRef.current?.appendChild(element); refreshVideo();
      };
      const detach = (track: RemoteTrack) => {
        const element = attached.current.get(track);
        if (element) { track.detach(element); element.remove(); attached.current.delete(track); }
        refreshVideo();
      };
      currentRoom.on(RoomEvent.TrackSubscribed, attach)
        .on(RoomEvent.TrackUnsubscribed, detach)
        .on(RoomEvent.TrackMuted, refreshVideo).on(RoomEvent.TrackUnmuted, refreshVideo)
        .on(RoomEvent.ParticipantConnected, count).on(RoomEvent.ParticipantDisconnected, count)
        .on(RoomEvent.Reconnecting, () => { if (active()) setStatus('reconnecting'); })
        .on(RoomEvent.Reconnected, () => { if (active()) { setStatus('connected'); setNotice(''); count(); } })
        .on(RoomEvent.Disconnected, () => {
          if (active()) {
            setStatus('offline'); setViewers(0); setNeedsAudio(false); clearMedia();
            setNotice('連線已中斷。請重新加入；直播主可能已結束直播。'); roomRef.current = null;
            void stopSession(currentRoom).catch(() => {});
          }
        })
        .on(RoomEvent.MediaDevicesError, cause => { if (active()) setError(errorText(cause)); })
        .on(RoomEvent.AudioPlaybackStatusChanged, () => { if (active()) setNeedsAudio(!currentRoom.canPlaybackAudio); })
        .on(RoomEvent.DataReceived, (bytes, participant, _kind, topic) => {
          if (!active() || topic !== 'chat') return;
          const text = decodeChatPayload(bytes);
          if (text !== null) addMessage(participant?.permissions?.canPublish ? '直播主' : '觀眾', text);
        });
      if (selectedMode === 'host') {
        await startHostSession(currentRoom, data.livekitUrl, data.token, async () => {
          const tracks = await createLocalTracks({ audio: true, video: { facingMode: 'user', resolution: { width: 1280, height: 720 } } });
          if (active()) tracks.forEach(attach);
          return tracks;
        });
      } else {
        await joinViewerSession(currentRoom, data.livekitUrl, data.token);
        // Existing subscriptions can predate the join completion.
        for (const participant of currentRoom.remoteParticipants.values()) {
          for (const publication of participant.trackPublications.values()) if (publication.track) attach(publication.track);
        }
      }
      if (active()) { setStatus('connected'); setNeedsAudio(!currentRoom.canPlaybackAudio); count(); }
    } catch (cause) {
      if (room) { await stopSession(room).catch(() => {}); room.removeAllListeners(); }
      if (attempt === operation.current) { roomRef.current = null; clearMedia(); setStatus('offline'); setError(errorText(cause)); }
    } finally { if (attempt === operation.current) { requestRef.current = null; setBusy(false); } }
  }

  async function leave() {
    const room = roomRef.current;
    await leaveSession({ operation, request: requestRef, room: roomRef }, () => {
      setBusy(false); setStatus('idle'); setViewers(0); setNeedsAudio(false); setNotice('已離開直播。'); clearMedia();
    }).catch(() => setError('離線清理未完成，請關閉此分頁。'));
    room?.removeAllListeners();
  }

  async function toggle(kind: 'camera' | 'mic') {
    const room = roomRef.current; if (!room) return;
    try {
      if (kind === 'mic') { await room.localParticipant.setMicrophoneEnabled(!micOn); setMicOn(!micOn); }
      else { await room.localParticipant.setCameraEnabled(!cameraOn); setCameraOn(!cameraOn); }
    } catch (cause) { setError(errorText(cause)); }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const bytes = new TextEncoder().encode(draft); const text = decodeChatPayload(bytes);
    if (text === null || !roomRef.current || status !== 'connected') return;
    const room = roomRef.current; setSending(true);
    try {
      await room.localParticipant.publishData(bytes, { reliable: true, topic: 'chat' });
      if (roomRef.current === room) { addMessage('你', text); setDraft(''); }
    } catch { setError('訊息未送出，請確認連線後重試。'); }
    finally { setSending(false); }
  }

  async function copyInvite() {
    if (!grant?.inviteUrl) return;
    try { await navigator.clipboard.writeText(grant.inviteUrl); setNotice('邀請連結已複製。'); }
    catch { setNotice('請長按下方連結，手動複製分享。'); }
  }

  const connected = status === 'connected';
  const inSession = !!roomRef.current || busy;
  const byteCount = new TextEncoder().encode(draft).byteLength;
  const statusLabel = { idle: '準備就緒', connecting: '連線中', connected: mode === 'host' ? '直播中' : '已連線', reconnecting: '重新連線中', offline: '已離線' }[status];

  return <main className="live-app">
    <header className="site-header"><a className="brand" href="/" aria-label="此刻直播首頁"><span className="brand-icon"><Radio size={22} /></span>此刻<span className="brand-en">LIVE</span></a><span className="header-note"><span className="tiny-dot" />把此刻，分享給朋友</span></header>
    <section className="intro"><p className="eyebrow">A LITTLE CLOSER, LIVE</p><h1>你的日常，<br className="mobile-break" /> 現在上線。</h1><p>一支手機，一個連結。和朋友一起在場。</p></section>
    <div className="experience-grid"><section className="broadcast-panel" aria-label="直播控制台">
      <div className="mode-switch" aria-label="選擇使用方式"><button type="button" aria-pressed={mode === 'host'} disabled={inSession} onClick={() => { setMode('host'); setError(''); setGrant(null); setNotice(''); }}><Radio size={18} />開始直播</button><button type="button" aria-pressed={mode === 'viewer'} disabled={inSession} onClick={() => { setMode('viewer'); setError(''); setGrant(null); setNotice(''); }}><Eye size={18} />觀看直播</button></div>
      <div className="screen-shell"><div className="screen-top"><span className={`status-pill ${connected ? 'is-live' : ''}`} role="status"><span className="tiny-dot" />{statusLabel}</span><span className="viewer-count"><Eye size={14} />{viewers} {mode === 'host' ? '位觀眾' : '位其他參與者'}</span></div><div ref={mediaRef} className={`media-stage ${mode === 'host' ? 'local-preview' : ''}`} />
        {(!hasVideo || (mode === 'host' && !cameraOn)) && <div className="screen-empty"><span className="empty-camera">{mode === 'host' ? <Camera size={30} strokeWidth={1.5} /> : <Radio size={30} strokeWidth={1.5} />}</span><h2>{status === 'reconnecting' ? '正在找回連線…' : status === 'connecting' ? '準備連接此刻…' : mode === 'host' ? connected ? '相機已關閉' : '讓朋友看見你的此刻' : connected ? '等待直播主上線' : '好風景，一起看'}</h2><p>{mode === 'host' ? connected ? '你可以隨時控制相機與麥克風。' : '按下開始直播，才會啟用相機與麥克風。' : connected ? '直播主開始分享後，畫面會自動出現。' : '使用朋友分享的邀請連結加入，不需要相機或麥克風。'}</p></div>}
        <span className="screen-caption">{mode === 'host' ? 'YOUR MOMENT, SHARED.' : 'YOU’RE HERE, TOGETHER.'}</span></div>
      {needsAudio && mode === 'viewer' && <button className="audio-unlock" onClick={async () => { try { await roomRef.current?.startAudio(); setNeedsAudio(false); } catch { setError('無法播放音訊，請再點一次以開啟聲音。'); } }}><Volume2 size={18} />點一下開啟直播聲音</button>}
      {connected && mode === 'host' && <div className="media-controls"><button aria-pressed={!micOn} onClick={() => void toggle('mic')}>{micOn ? <Mic size={18} /> : <MicOff size={18} />}{micOn ? '麥克風開啟' : '已靜音'}</button><button aria-pressed={!cameraOn} onClick={() => void toggle('camera')}>{cameraOn ? <Camera size={18} /> : <VideoOff size={18} />}{cameraOn ? '相機開啟' : '相機關閉'}</button></div>}
      {!inSession && <form className="join-form" onSubmit={begin}><label htmlFor="access-credential">{mode === 'host' ? '開播金鑰' : '邀請連結'}</label><input id="access-credential" type={mode === 'host' ? 'password' : 'text'} autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={mode === 'host' ? 512 : 2048} value={mode === 'host' ? creatorKey : invite} onChange={event => mode === 'host' ? setCreatorKey(event.target.value) : setInvite(event.target.value)} placeholder={mode === 'host' ? '輸入你的專屬開播金鑰' : '貼上朋友分享的邀請連結'} aria-describedby="credential-hint" /><p id="credential-hint" className="field-hint">{mode === 'host' ? '金鑰僅供直播主使用，請勿分享給觀眾。' : '觀眾只會接收直播，不會啟用相機或麥克風。'}</p><button className="primary-button" type="submit">{mode === 'host' ? <Radio size={18} /> : <Eye size={18} />}{mode === 'host' ? '開始直播' : '加入觀看'}<ArrowUpRight size={18} /></button></form>}
      {inSession && <button className="stop-button" type="button" onClick={() => void leave()}><Square size={15} />{mode === 'host' ? '停止直播' : '離開觀看'}</button>}
      {error && <p className="feedback error-feedback" role="alert">{error}</p>}{notice && <p className="feedback" role="status">{notice}</p>}
      {mode === 'host' && grant?.inviteUrl && <div className="share-card"><div className="share-heading"><span><Link2 size={17} />邀請朋友一起看</span><button type="button" onClick={() => void copyInvite()}>複製連結</button></div><input aria-label="觀眾邀請連結" readOnly value={grant.inviteUrl} onFocus={event => event.target.select()} /><p>持有連結即可觀看，請只分享給信任的朋友。<br />有效期限：{grant.expiresAt ? new Date(grant.expiresAt * 1000).toLocaleString('zh-TW') : '—'}。停止直播會關閉本機媒體；邀請連結於到期後失效。</p></div>}
    </section>
    <aside className="chat-panel" aria-label="聊天室"><div className="chat-heading"><div><span className="eyebrow">SAY HELLO</span><h2>在場的聲音<span className="chat-bubble-dot" /></h2></div><span className="chat-count">{messages.length}</span></div><div className="chat-messages" role="log" aria-live="polite" aria-label="直播聊天訊息">{messages.length === 0 ? <div className="chat-empty"><span>✳</span><p>一句嗨，就近了一點。</p><small>加入直播後，和在場的人聊聊天。</small></div> : messages.map(message => <div className="chat-message" key={message.id}><span>{message.sender}</span><p>{message.text}</p></div>)}<div ref={messageEnd} /></div><form className="chat-form" onSubmit={send}><label className="sr-only" htmlFor="chat-draft">聊天訊息</label><div className="chat-input-row"><input id="chat-draft" placeholder={connected ? '說點什麼…' : '加入直播後開始聊天'} value={draft} onChange={event => setDraft(event.target.value)} maxLength={MAX_CHAT_BYTES} disabled={!connected || sending} aria-describedby="chat-limit" /><button type="submit" aria-label="送出訊息" disabled={!connected || sending || decodeChatPayload(new TextEncoder().encode(draft)) === null}><Send size={18} /></button></div><p id="chat-limit" className={byteCount > MAX_CHAT_BYTES ? 'over-limit' : ''}>{byteCount}/{MAX_CHAT_BYTES} bytes · 訊息不會保留</p></form></aside></div>
    <footer className="site-footer"><span>此刻 LIVE</span><p>小小的日常，也值得一起。</p><span>LIVE IN THE MOMENT ↗</span></footer>
  </main>;
}
