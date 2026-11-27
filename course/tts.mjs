// Voice messages read by an Azure AI Speech neural voice (free F0 tier: 0.5 M characters/month).
// The server synthesizes each message once and every viewer plays the same MP3, so the voice
// sounds the same and natural on every device. The donor picks the voice (see voices.mjs).
// The key lives only in the VM's environment. Without a key (or if Azure fails) clients fall
// back to the browser's own speech synthesis.
import { findVoice, PREVIEW_TEXT, VOICES } from './voices.mjs';

const escapeXml = (text) => String(text).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);

export function buildSSML(text, { voice, style, rate = '+5%' }) {
  const lang = voice.split('-').slice(0, 2).join('-');
  const body = style ? `<mstts:express-as style="${escapeXml(style)}">${escapeXml(text)}</mstts:express-as>` : escapeXml(text);
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${lang}"><voice name="${escapeXml(voice)}"><prosody rate="${rate}">${body}</prosody></voice></speak>`;
}

export function createTTS({
  key = process.env.AZURE_SPEECH_KEY || '',
  region = process.env.AZURE_SPEECH_REGION || 'japaneast',
  fetchImpl = fetch,
  maxCached = 50,
} = {}) {
  const cache = new Map(); // donation id -> Promise<Buffer|null>
  const previews = new Map(); // voice id -> Promise<Buffer|null> (fixed sentence, kept)
  async function synthesize(text, option) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetchImpl(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
          method: 'POST', signal: AbortSignal.timeout(10000),
          headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3', 'User-Agent': 'group9-live' },
          body: buildSSML(text, option),
        });
        if (response.ok) { const audio = Buffer.from(await response.arrayBuffer()); if (audio.length > 0) return audio; }
      } catch {}
    }
    return null;
  }
  return {
    enabled: Boolean(key),
    // Starts synthesis right away; returns whether clients should try the server audio.
    prepare(id, text, voiceId) {
      if (!key || !text) return false;
      cache.set(id, synthesize(text, findVoice(voiceId)));
      while (cache.size > maxCached) cache.delete(cache.keys().next().value);
      return true;
    },
    audio: (id) => cache.get(id) || Promise.resolve(null),
    preview(voiceId) {
      if (!key || !VOICES.some((v) => v.id === voiceId)) return Promise.resolve(null);
      if (!previews.has(voiceId)) previews.set(voiceId, synthesize(PREVIEW_TEXT, findVoice(voiceId)).then((audio) => { if (!audio) previews.delete(voiceId); return audio; }));
      return previews.get(voiceId);
    },
  };
}
