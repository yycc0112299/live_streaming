import React, { useEffect, useRef, useState } from 'react';
import { createCompositor, needsCamera, needsScreen } from './compositor.js';
import { LAYOUTS } from './OBSControls.jsx';

// Publishes this device's camera (phone or PC) or screen to the broadcaster's own
// MediaMTX path with WebRTC WHIP. The server checks the login and adds the publish
// password, so the browser never sees a stream key. MediaMTX then serves the same
// path to viewers as HLS / WHEP, exactly like an OBS RTMP source.
// On a PC the picture comes from a canvas compositor, so the broadcaster can switch
// between camera, screen + camera and screen with one click while live.
const base = import.meta.env.BASE_URL;
const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));

function preferH264(transceiver) {
  // HLS needs H.264, so ask the browser for it first (VP8 stays as a fallback).
  const caps = window.RTCRtpSender?.getCapabilities?.('video');
  if (!caps || !transceiver.setCodecPreferences) return;
  const h264 = caps.codecs.filter((codec) => /h264/i.test(codec.mimeType));
  if (h264.length) transceiver.setCodecPreferences([...h264, ...caps.codecs.filter((codec) => !/h264/i.test(codec.mimeType))]);
}

function waitForIce(pc, ms = 2500) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((done) => {
    const timer = setTimeout(done, ms);
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(timer); done(); } });
  });
}

export async function publishWHIP(path, stream) {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  for (const track of stream.getTracks()) {
    const transceiver = pc.addTransceiver(track, { direction: 'sendonly', streams: [stream] });
    if (track.kind === 'video') preferH264(transceiver);
  }
  await pc.setLocalDescription(await pc.createOffer());
  await waitForIce(pc);
  const response = await fetch(`${base}webrtc/${path}/whip`, { method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body: pc.localDescription.sdp, credentials: 'same-origin' });
  if (response.status !== 201) {
    pc.close();
    let message = `直播伺服器拒絕連線（${response.status}）。`;
    try { message = (await response.json()).error || message; } catch {}
    if (response.status === 400 || response.status === 409) message = '這一路已經有 OBS 或其他裝置在推流，請先停止另一個來源。';
    throw new Error(message);
  }
  const session = new URL(response.headers.get('location'), new URL(`${base}webrtc/${path}/whip`, location.href)).href;
  await pc.setRemoteDescription({ type: 'answer', sdp: await response.text() });
  return { pc, close: async () => { pc.close(); await fetch(session, { method: 'DELETE', credentials: 'same-origin' }).catch(() => {}); } };
}

export const MAX_RETRIES = 12;
export const retryDelay = (attempt) => Math.min(15000, 1000 * 2 ** Math.max(0, attempt - 1));
const stopMedia = (media) => media?.getTracks().forEach((track) => track.stop());

export default function BrowserBroadcast({ path, t, onError }) {
  const preview = useRef(null);
  const live = useRef(null); // { session, stream, comp, cam, screen, mic }
  const mobile = isMobile();
  const [source, setSource] = useState('user');
  const [layout, setLayout] = useState('camera');
  const [micOn, setMicOn] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [status, setStatus] = useState('idle');
  const [stats, setStats] = useState(null);
  const [retry, setRetry] = useState(0);
  const canShare = Boolean(navigator.mediaDevices?.getDisplayMedia) && !mobile;
  const supported = Boolean(navigator.mediaDevices?.getUserMedia && window.RTCPeerConnection);
  const micOnRef = useRef(true);

  // Publishes state.publishStream; on network loss (Wi-Fi <-> 4G, tunnel, weak signal) it
  // reconnects by itself with back-off, reusing the same camera/mic tracks.
  async function connect(state) {
    const session = await publishWHIP(path, state.publishStream);
    if (live.current !== state) { await session.close(); return; }
    state.session = session;
    session.pc.addEventListener('connectionstatechange', () => {
      if (live.current !== state || state.session !== session) return;
      const pcState = session.pc.connectionState;
      if (pcState === 'connected') { state.attempt = 0; setRetry(0); setStatus('live'); }
      if (pcState === 'failed') scheduleReconnect(state);
      if (pcState === 'disconnected') {
        clearTimeout(state.disconnectTimer);
        state.disconnectTimer = setTimeout(() => { if (state.session === session && session.pc.connectionState === 'disconnected') scheduleReconnect(state); }, 4000);
      }
    });
    setStatus(session.pc.connectionState === 'connected' ? 'live' : 'connecting');
  }
  function scheduleReconnect(state) {
    if (live.current !== state || state.retryTimer) return;
    const old = state.session; state.session = null; void old?.close();
    state.attempt = (state.attempt || 0) + 1; setRetry(state.attempt);
    if (state.attempt > MAX_RETRIES) { setStatus('failed'); onError(new Error(t('手機／瀏覽器直播連線中斷，請重新開始。'))); return; }
    setStatus('reconnecting');
    state.retryTimer = setTimeout(() => runRetry(state), retryDelay(state.attempt));
  }
  function runRetry(state) {
    clearTimeout(state.retryTimer); state.retryTimer = null;
    if (live.current !== state) return;
    connect(state).catch(() => scheduleReconnect(state));
  }
  // Back online: retry now instead of waiting for the back-off timer.
  useEffect(() => {
    const online = () => { const state = live.current; if (state?.retryTimer) runRetry(state); };
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, []);

  async function stop() {
    const current = live.current; live.current = null;
    if (current) { clearTimeout(current.retryTimer); clearTimeout(current.disconnectTimer); }
    setRetry(0);
    if (current) { for (const media of [current.stream, current.cam, current.screen, current.mic]) stopMedia(media); current.comp?.stop(); }
    await current?.session?.close();
    if (preview.current) preview.current.srcObject = null;
    setStatus('idle'); setStats(null);
  }

  // PC: make sure the camera/screen needed by `next` are open, and close the ones it does not use.
  async function acquire(state, next) {
    if (needsScreen(next) && !state.screen) {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
      state.screen = screen; state.comp.setScreen(screen);
      screen.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (live.current !== state || state.screen !== screen) return;
        state.screen = null; state.comp.setScreen(null);
        if (needsScreen(state.comp.layout)) void switchLayout('camera'); // the browser's "Stop sharing" button
      });
    }
    if (needsCamera(next) && !state.cam) {
      try {
        state.cam = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } });
        state.comp.setCamera(state.cam);
      } catch (error) { if (next === 'camera') throw error; onError(new Error(t('找不到可用的鏡頭，先只推螢幕畫面。'))); }
    }
    state.comp.setLayout(next);
    if (!needsScreen(next) && state.screen) { stopMedia(state.screen); state.screen = null; state.comp.setScreen(null); }
    if (!needsCamera(next) && state.cam) { stopMedia(state.cam); state.cam = null; state.comp.setCamera(null); }
  }

  async function switchLayout(next) {
    if (!live.current?.comp) { setLayout(next); return; }
    if (live.current.comp.layout === next) { setLayout(next); return; }
    setSwitching(true);
    try { await acquire(live.current, next); setLayout(next); }
    catch (error) { onError(error.name === 'NotAllowedError' ? new Error(t('已取消分享螢幕，畫面維持不變。')) : error); }
    finally { setSwitching(false); }
  }

  function toggleMic() {
    const next = !micOnRef.current; micOnRef.current = next; setMicOn(next);
    const current = live.current;
    for (const media of [current?.mic, current?.stream]) media?.getAudioTracks().forEach((track) => { track.enabled = next; });
  }

  async function start() {
    setStatus('starting');
    const state = {};
    live.current = state;
    try {
      let stream;
      if (mobile || !canShare) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: source, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        state.stream = stream;
      } else {
        state.comp = createCompositor({ placeholder: t('畫面準備中…') });
        state.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).catch(() => null);
        if (!state.mic) onError(new Error(t('沒有取得麥克風，這次直播不會有聲音。')));
        await acquire(state, layout);
        stream = new MediaStream([state.comp.track, ...(state.mic?.getAudioTracks() || [])]);
      }
      stream.getAudioTracks().forEach((track) => { track.enabled = micOnRef.current; });
      if (live.current !== state) throw new DOMException('stopped', 'AbortError');
      preview.current.srcObject = state.comp ? state.comp.stream : stream;
      state.publishStream = stream;
      await connect(state);
      if (state.stream) state.stream.getVideoTracks()[0]?.addEventListener('ended', () => { void stop(); });
    } catch (error) {
      if (live.current === state) { live.current = null; for (const media of [state.stream, state.cam, state.screen, state.mic]) stopMedia(media); state.comp?.stop(); }
      if (preview.current) preview.current.srcObject = null;
      setStatus('idle');
      if (error.name !== 'AbortError') onError(error.name === 'NotAllowedError' ? new Error(t('請允許網站使用相機、麥克風或螢幕分享。')) : error);
    }
  }

  useEffect(() => {
    if (status !== 'live' && status !== 'connecting') return undefined;
    let last;
    const timer = setInterval(async () => {
      const pc = live.current?.session?.pc; if (!pc) return;
      let bytes = 0;
      (await pc.getStats()).forEach((report) => { if (report.type === 'outbound-rtp') bytes += report.bytesSent || 0; });
      const kbps = last ? Math.round(((bytes - last.bytes) * 8) / (Date.now() - last.at)) : 0;
      last = { bytes, at: Date.now() };
      setStats({ megabytes: (bytes / 1048576).toFixed(1), kbps });
    }, 2000);
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => () => { void stop(); }, []);

  const busy = status === 'starting' || status === 'connecting';
  const label = { idle: t('未開播'), starting: t('開啟相機中…'), connecting: t('連線中…'), live: 'LIVE', failed: t('連線失敗'), reconnecting: `${t('網路中斷，自動重新連線中')}（${retry}/${MAX_RETRIES}）` }[status];
  return <section className="management browser-broadcast" aria-label={t('手機／瀏覽器直播')}>
    <h2>{t('手機／瀏覽器直播')} · {path === 'live' ? t('第一格') : t('第二格')}</h2>
    <p>{t('不用安裝 OBS：手機或電腦直接用相機推流到你的直播格（WebRTC WHIP）。同一格同時只能有一個來源，若 OBS 正在推流請先停止。')}</p>
    {!supported && <p role="alert">{t('這個瀏覽器不支援相機直播，請使用新版 Chrome 或 Safari，並透過 HTTPS 開啟網站。')}</p>}
    {/* Mirror only a phone's front camera (a selfie view); screen and PC compositions stay readable. */}
    <video ref={preview} className={`broadcast-preview ${!canShare && source === 'user' ? 'mirror' : ''}`} autoPlay muted playsInline hidden={status === 'idle'}/>
    {canShare
      ? <div className="layout-switch" role="group" aria-label={t('直播畫面')}>{LAYOUTS.map(([id, icon, name]) => <button key={id} type="button" disabled={switching || status === 'starting'} aria-pressed={layout === id} className={layout === id ? 'on' : ''} onClick={() => { void switchLayout(id); }}>{icon} {t(name)}</button>)}</div>
      : <div className="duo-controls"><label>{t('來源')} <select value={source} disabled={status !== 'idle'} onChange={(event) => setSource(event.target.value)}>
          <option value="user">{t('前鏡頭／電腦鏡頭')}</option>
          <option value="environment">{t('後鏡頭')}</option>
        </select></label></div>}
    <div className="duo-controls">
      <button type="button" className={`mic-toggle ${micOn ? '' : 'muted'}`} aria-pressed={!micOn} onClick={toggleMic}>{micOn ? `🎤 ${t('關閉麥克風')}` : `🔇 ${t('開啟麥克風')}`}</button>
      {status === 'idle' || status === 'failed'
        ? <button disabled={!supported} onClick={() => { if (status === 'failed') void stop().then(start); else void start(); }}>{t(canShare ? '開始瀏覽器直播' : '開始手機直播')}</button>
        : <button onClick={() => { void stop(); }}>{t(canShare ? '停止瀏覽器直播' : '停止手機直播')}</button>}
    </div>
    <p role="status">{t('狀態：')}{label}{!micOn && ` · 🔇 ${t('麥克風已關閉')}`}{stats && ` · ${t('已傳送')} ${stats.megabytes} MB · ${stats.kbps} kbps`}{(busy || switching) && ' …'}</p>
  </section>;
}
