// Voice messages are read aloud with the browser's Web Speech API. Browsers ship several voices;
// the default on Windows Chrome is the old robotic "Microsoft Hanhan". We pick the most natural
// Mandarin voice this browser offers: Edge's neural "Online (Natural)" voices, Chrome's cloud
// "Google 國語（臺灣）", Apple's "Meijia", and only then the local desktop voices.
let voices = [];
function load() { try { voices = window.speechSynthesis?.getVoices() || []; } catch { voices = []; } }
try { load(); window.speechSynthesis?.addEventListener?.('voiceschanged', load); } catch {}

export function scoreVoice(v) {
  const name = v.name || ''; const lang = (v.lang || '').toLowerCase().replace('_', '-');
  const tw = lang === 'zh-tw' || /taiwan|臺灣|台灣/i.test(name);
  const zh = lang.startsWith('zh') || lang.startsWith('cmn');
  if (!zh) return 0;
  let s = tw ? 40 : lang === 'zh-cn' ? 20 : 5;
  if (/natural|neural/i.test(name)) s += 60;                 // Edge: Microsoft HsiaoChen Online (Natural)
  else if (/^google/i.test(name)) s += 45;                   // Chrome: Google 國語（臺灣）
  else if (/meijia|tingting|enhanced|premium/i.test(name)) s += 40; // Apple voices
  else if (!v.localService) s += 20;                          // other cloud voices
  if (/hsiaochen|hsiaoyu|xiaoxiao/i.test(name)) s += 5;      // lively female voices
  return s;
}
export function bestVoice(list = voices) {
  let best = null; let top = 0;
  for (const v of list) { const s = scoreVoice(v); if (s > top) { top = s; best = v; } }
  return best;
}
// Cloud voices (Google) can cut off long utterances, so speak sentence by sentence.
export function splitSentences(text) {
  return String(text).split(/(?<=[。！？!?；;，,…\n])/).map((part) => part.trim()).filter(Boolean)
    .reduce((out, part) => { const last = out[out.length - 1]; if (last && last.length + part.length < 40) out[out.length - 1] = last + part; else out.push(part); return out; }, []);
}
export function speak(text, { volume = 0.9 } = {}) {
  const synth = window.speechSynthesis; if (!synth) return;
  if (!voices.length) load();
  const voice = bestVoice();
  for (const sentence of splitSentences(text)) {
    const u = new SpeechSynthesisUtterance(sentence);
    if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'zh-TW';
    u.rate = 1.0; u.pitch = 1.08; u.volume = volume; // a touch brighter than default sounds livelier
    synth.speak(u);
  }
}
