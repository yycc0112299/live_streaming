// Gift sound effects, synthesized with the Web Audio API (no audio files to download).
// Kept deliberately quiet: a low master gain plus a compressor so a gift never drowns out the
// broadcaster's voice. Viewers can switch the effects off; the choice is remembered per browser.
const KEY = 'g9-gift-sound';
const MASTER = 0.07; // peak level, far below the stream audio (which plays at full volume)

export function giftSoundEnabled() {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}
export function setGiftSoundEnabled(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch {}
}

let ctx = null; let out = null;
function audio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -28; comp.ratio.value = 8;
  out = ctx.createGain(); out.gain.value = MASTER;
  out.connect(comp).connect(ctx.destination);
  return ctx;
}
// Browsers only allow audio after a user gesture; unlock on the first tap/click/key.
export function unlockGiftSound() {
  const unlock = () => { const c = audio(); c?.resume?.(); };
  for (const type of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(type, unlock, { once: true, passive: true });
}

function tone(t0, freq, dur, { type = 'sine', gain = 0.6, to = null, attack = 0.01 } = {}) {
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(out); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(t0, dur, { gain = 0.4, freq = 1200, q = 1, to = null } = {}) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buffer;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q; f.frequency.setValueAtTime(freq, t0);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(out); src.start(t0);
}
const chime = (t0, notes, step, opts) => notes.forEach((f, i) => { tone(t0 + i * step, f, 0.6, { type: 'triangle', gain: 0.5, ...opts }); tone(t0 + i * step, f * 2, 0.35, { gain: 0.12 }); });
const pop = (t0) => { noise(t0, 0.35, { gain: 0.7, freq: 900, q: 0.7, to: 200 }); chime(t0 + 0.05, [2093, 2637], 0.06, { gain: 0.18 }); };

export const SOUNDS = {
  heart: (t) => chime(t, [880, 1319], 0.12),
  rose: (t) => chime(t, [1047, 1319, 1568, 2093], 0.11),
  rocket: (t) => { noise(t, 1.6, { gain: 0.5, freq: 300, q: 0.8, to: 3000 }); tone(t, 180, 1.5, { type: 'sine', gain: 0.25, to: 1400, attack: 0.3 }); chime(t + 1.4, [1568, 2093], 0.08, { gain: 0.3 }); },
  car: (t) => { tone(t, 55, 2.2, { type: 'sawtooth', gain: 0.25, to: 150, attack: 0.25 }); tone(t, 110, 2.2, { type: 'square', gain: 0.06, to: 300, attack: 0.25 }); noise(t + 1.6, 0.9, { gain: 0.25, freq: 600, to: 2500 }); [0, 0.22].forEach((d) => tone(t + 2.4 + d, 440, 0.16, { type: 'square', gain: 0.12 })); },
  party: (t) => { chime(t, [523, 659, 784, 1047], 0.13); [0.7, 1.1, 1.5, 1.8].forEach((d) => pop(t + d)); },
  carnival: (t) => { chime(t, [784, 988, 1175, 1568, 1175, 1319, 1568, 2093], 0.2, { gain: 0.4 }); [1.0, 1.5, 1.9, 2.3, 2.6].forEach((d) => pop(t + d)); },
};

export function playGiftSound(kind) {
  if (!giftSoundEnabled()) return;
  try {
    const c = audio(); if (!c || c.state === 'closed') return;
    if (c.state === 'suspended') c.resume?.();
    (SOUNDS[kind] || SOUNDS.heart)(c.currentTime + 0.05);
  } catch {}
}
