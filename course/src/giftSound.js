// Gift sound effects, synthesized with the Web Audio API (no audio files to download).
// Kept deliberately quiet: a low master gain plus a compressor so a gift never drowns out the
// broadcaster's voice. Viewers can switch the effects off; the choice is remembered per browser.
const KEY = 'g9-gift-sound';
const MASTER = 0.07; // peak level, far below the stream audio (which plays at full volume)

export function giftSoundEnabled() {
  if (enabledNow !== null) return enabledNow;
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}
let ctx = null; let out = null;
const playing = new Set(); // every scheduled source, so switching off can silence them at once
let enabledNow = null;
function stopAll() {
  for (const node of playing) { try { node.stop(); } catch {} try { node.disconnect(); } catch {} }
  playing.clear();
}
export function setGiftSoundEnabled(on) {
  enabledNow = Boolean(on);
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch {}
  if (!on) stopAll();
  if (out && ctx) { out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setValueAtTime(on ? MASTER : 0, ctx.currentTime); }
}
// Keep other tabs of the same browser in sync with the switch.
try { window.addEventListener('storage', (event) => { if (event.key === KEY) setGiftSoundEnabled(event.newValue !== 'off'); }); } catch {}
const track = (node, end) => { playing.add(node); node.onended = () => playing.delete(node); node.stop(end); };
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
  o.connect(g).connect(out); o.start(t0); track(o, t0 + dur + 0.05);
}
function noise(t0, dur, { gain = 0.4, freq = 1200, q = 1, to = null } = {}) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buffer;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q; f.frequency.setValueAtTime(freq, t0);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(out); src.start(t0); track(src, t0 + dur + 0.05);
}
// Supercar engine: a V8's firing frequency is rpm/60 × 4 (= rpm/15). Sawtooth + half-order
// "burble" + 2nd order, soft-clipped for grit, through a low-pass that opens as revs rise.
function engine(t0, curve, level = 1) {
  const end = t0 + curve[curve.length - 1][0];
  const shaper = ctx.createWaveShaper();
  const k = 2.5; const n = 1024; const shape = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; shape[i] = Math.tanh(k * x) / Math.tanh(k); }
  shaper.curve = shape;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0);
  shaper.connect(lp).connect(g).connect(out);
  const layers = [['sawtooth', 1, 0.55, 0], ['square', 0.5, 0.35, -6], ['sawtooth', 2, 0.22, 7]];
  for (const [type, order, amp, detune] of layers) {
    const o = ctx.createOscillator(); o.type = type; o.detune.value = detune;
    const og = ctx.createGain(); og.gain.value = amp; o.connect(og).connect(shaper);
    for (const [dt, rpm] of curve) o.frequency[dt === 0 ? 'setValueAtTime' : 'exponentialRampToValueAtTime'](Math.max(20, (rpm / 15) * order), t0 + dt);
    o.start(t0); track(o, end + 0.05);
  }
  for (const [dt, rpm, throttle = 1] of curve) {
    const at = t0 + dt; const cutoff = 300 + (rpm / 15) * 5 * (0.5 + throttle / 2);
    lp.frequency[dt === 0 ? 'setValueAtTime' : 'linearRampToValueAtTime'](cutoff, at);
    g.gain[dt === 0 ? 'setValueAtTime' : 'linearRampToValueAtTime'](Math.max(0.0001, level * (0.25 + 0.55 * throttle) * Math.min(1, rpm / 4000 + 0.3)), at);
  }
  g.gain.linearRampToValueAtTime(0.0001, end + 0.04);
}
// Exhaust crackle / backfire: sharp filtered noise snaps with a low thump.
function crackle(t0, count, spread = 0.09, level = 1) {
  let t = t0;
  for (let i = 0; i < count; i++) {
    noise(t, 0.035 + Math.random() * 0.03, { gain: level * (0.6 + Math.random() * 0.5), freq: 1800 + Math.random() * 1500, q: 0.9 });
    tone(t, 90 + Math.random() * 40, 0.06, { gain: level * 0.5, to: 45 });
    t += spread * (0.5 + Math.random());
  }
}
const chime = (t0, notes, step, opts) => notes.forEach((f, i) => { tone(t0 + i * step, f, 0.6, { type: 'triangle', gain: 0.5, ...opts }); tone(t0 + i * step, f * 2, 0.35, { gain: 0.12 }); });
const pop = (t0) => { noise(t0, 0.35, { gain: 0.7, freq: 900, q: 0.7, to: 200 }); chime(t0 + 0.05, [2093, 2637], 0.06, { gain: 0.18 }); };

export const SOUNDS = {
  heart: (t) => chime(t, [880, 1319], 0.12),
  rose: (t) => chime(t, [1047, 1319, 1568, 2093], 0.11),
  rocket: (t) => { noise(t, 1.6, { gain: 0.5, freq: 300, q: 0.8, to: 3000 }); tone(t, 180, 1.5, { type: 'sine', gain: 0.25, to: 1400, attack: 0.3 }); chime(t + 1.4, [1568, 2093], 0.08, { gain: 0.3 }); },
  // Matches the 3D car: drive in (0–1.4 s), 360° spin with revving (1.4–2.8 s), drive off.
  car: (t) => {
    engine(t, [[0, 950, 0.3], [0.25, 1100, 0.4], [0.3, 2200, 1], [1.15, 7600, 1], [1.22, 5200, 0.6], [1.3, 5400, 1], [2.25, 8600, 1], [2.35, 6000, 0], [2.75, 3200, 0], [2.85, 3600, 1], [3.6, 8200, 1], [3.85, 7000, 0.2]], 0.42);
    noise(t + 0.3, 3.4, { gain: 0.08, freq: 900, q: 0.6, to: 2600 }); // intake / tyre roar
    crackle(t + 1.17, 3, 0.05, 0.4);  // upshift pop
    crackle(t + 2.36, 7, 0.07, 0.5);  // lift-off backfire
  },
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
