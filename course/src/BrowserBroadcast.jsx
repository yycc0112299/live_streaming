import React, { useEffect, useRef, useState } from 'react';

// Publishes this device's camera (phone or PC) or screen to the broadcaster's own
// MediaMTX path with WebRTC WHIP. The server checks the login and adds the publish
// password, so the browser never sees a stream key. MediaMTX then serves the same
// path to viewers as HLS / WHEP, exactly like an OBS RTMP source.
const base = import.meta.env.BASE_URL;

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

export default function BrowserBroadcast({ path, t, onError }) {
  const preview = useRef(null);
  const live = useRef(null);
  const [source, setSource] = useState('user');
  const [status, setStatus] = useState('idle');
  const [stats, setStats] = useState(null);
  const canShare = Boolean(navigator.mediaDevices?.getDisplayMedia) && !/Android|iPhone|iPad/i.test(navigator.userAgent);
  const supported = Boolean(navigator.mediaDevices?.getUserMedia && window.RTCPeerConnection);

  async function stop() {
    const current = live.current; live.current = null;
    current?.stream.getTracks().forEach((track) => track.stop());
    await current?.session?.close();
    if (preview.current) preview.current.srcObject = null;
    setStatus('idle'); setStats(null);
  }

  async function start() {
    setStatus('starting');
    let stream;
    try {
      if (source === 'screen') {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
        const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).catch(() => null);
        if (!stream.getAudioTracks().length && mic) mic.getAudioTracks().forEach((track) => stream.addTrack(track));
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: source, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      }
      preview.current.srcObject = stream;
      live.current = { stream };
      const session = await publishWHIP(path, stream);
      if (!live.current) { await session.close(); return; }
      live.current.session = session;
      session.pc.addEventListener('connectionstatechange', () => {
        const state = session.pc.connectionState;
        if (state === 'connected') setStatus('live');
        if (state === 'failed' || state === 'disconnected') { setStatus('failed'); onError(new Error(t('手機／瀏覽器直播連線中斷，請重新開始。'))); }
      });
      stream.getVideoTracks()[0]?.addEventListener('ended', () => { void stop(); });
      setStatus(session.pc.connectionState === 'connected' ? 'live' : 'connecting');
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      live.current = null;
      if (preview.current) preview.current.srcObject = null;
      setStatus('idle');
      onError(error.name === 'NotAllowedError' ? new Error(t('請允許網站使用相機與麥克風。')) : error);
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
  const label = { idle: t('未開播'), starting: t('開啟相機中…'), connecting: t('連線中…'), live: 'LIVE', failed: t('連線失敗') }[status];
  return <section className="management browser-broadcast" aria-label={t('手機／瀏覽器直播')}>
    <h2>{t('手機／瀏覽器直播')} · {path === 'live' ? t('第一格') : t('第二格')}</h2>
    <p>{t('不用安裝 OBS：手機或電腦直接用相機推流到你的直播格（WebRTC WHIP）。同一格同時只能有一個來源，若 OBS 正在推流請先停止。')}</p>
    {!supported && <p role="alert">{t('這個瀏覽器不支援相機直播，請使用新版 Chrome 或 Safari，並透過 HTTPS 開啟網站。')}</p>}
    <video ref={preview} className="broadcast-preview" autoPlay muted playsInline hidden={status === 'idle'}/>
    <div className="duo-controls">
      <label>{t('來源')} <select value={source} disabled={status !== 'idle'} onChange={(event) => setSource(event.target.value)}>
        <option value="user">{t('前鏡頭／電腦鏡頭')}</option>
        <option value="environment">{t('後鏡頭')}</option>
        {canShare && <option value="screen">{t('分享螢幕')}</option>}
      </select></label>
      {status === 'idle' || status === 'failed'
        ? <button disabled={!supported} onClick={() => { if (status === 'failed') void stop().then(start); else void start(); }}>{t('開始手機直播')}</button>
        : <button onClick={() => { void stop(); }}>{t('停止手機直播')}</button>}
    </div>
    <p role="status">{t('狀態：')}{label}{stats && ` · ${t('已傳送')} ${stats.megabytes} MB · ${stats.kbps} kbps`}{busy && ' …'}</p>
  </section>;
}
