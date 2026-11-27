import React, { useEffect, useRef, useState } from 'react';

// Live captions for the broadcaster. The browser's speech recognition (Web Speech API:
// Chrome / Edge / Safari) turns the broadcaster's voice into text; the text goes to the server
// over the existing Socket.IO connection and appears under this broadcaster's picture for every
// viewer. Works next to OBS too: open the site on the OBS computer and switch captions on.
const Recognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

export default function CaptionPanel({ command, t, onError }) {
  const [on, setOn] = useState(false);
  const [lang, setLang] = useState('zh-TW');
  const [last, setLast] = useState('');
  const recognizer = useRef(null);
  const wanted = useRef(false);

  function stop() {
    wanted.current = false;
    try { recognizer.current?.stop(); } catch {}
    recognizer.current = null; setOn(false);
  }
  function start() {
    if (!Recognition) return;
    const rec = new Recognition();
    rec.lang = lang; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      let interim = ''; let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += text; else interim += text;
      }
      const text = (final || interim).trim();
      if (!text) return;
      setLast(text);
      command('caption', { text, final: Boolean(final) }).catch(() => {});
    };
    rec.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') { onError(new Error(t('請允許網站使用麥克風才能產生字幕。'))); stop(); }
    };
    // Recognition ends after silence or about a minute: restart while captions are on.
    rec.onend = () => { if (wanted.current && recognizer.current === rec) { try { rec.start(); } catch { setTimeout(() => { if (wanted.current) start(); }, 500); } } };
    recognizer.current = rec; wanted.current = true;
    try { rec.start(); setOn(true); } catch (error) { onError(error); }
  }
  useEffect(() => () => stop(), []);
  useEffect(() => { if (on) { stop(); start(); } }, [lang]);

  return <section className="management caption-panel" aria-label={t('即時字幕')}>
    <h2>📝 {t('即時字幕')}</h2>
    <p>{t('開啟後，你說的話會即時轉成文字，顯示在你的直播畫面下方給所有觀眾看。用 OBS 直播也可以在這裡開。')}</p>
    {!Recognition && <p role="alert">{t('這個瀏覽器不支援語音辨識，請用 Chrome、Edge 或 Safari。')}</p>}
    <div className="duo-controls">
      <label>{t('辨識語言')} <select value={lang} onChange={(event) => setLang(event.target.value)}><option value="zh-TW">{t('中文（台灣）')}</option><option value="en-US">English</option></select></label>
      <button type="button" disabled={!Recognition} className={on ? 'mic-toggle' : ''} onClick={() => (on ? stop() : start())}>{on ? `⏹ ${t('停止字幕')}` : `▶ ${t('開始字幕')}`}</button>
    </div>
    {on && <p role="status" className="muted">{t('辨識中：')}{last || '…'}</p>}
    <p className="muted">{t('語音辨識由瀏覽器提供（Chrome 會使用 Google 的辨識服務）。')}</p>
  </section>;
}
