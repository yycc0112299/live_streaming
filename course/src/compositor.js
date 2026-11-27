// Draws the PC broadcaster's picture onto one fixed 1280x720 canvas: camera only, screen only,
// or screen with the camera as a picture-in-picture. Viewers always receive the same canvas
// track, so switching layout mid-stream needs no reconnection and never changes resolution.
// A Web Worker drives the redraw because rAF/timers pause when the streamer switches to the
// window they are sharing.
export const PC_LAYOUTS = ['camera', 'both', 'screen'];
export const needsCamera = (layout) => layout !== 'screen';
export const needsScreen = (layout) => layout !== 'camera';

// Where the picture-in-picture camera sits in 'both' (bottom-right, 26 % of the width).
export function pipRect(width, height, aspect = 16 / 9) {
  const w = Math.round(width * 0.26); const h = Math.round(w / aspect); const margin = Math.round(width * 0.02);
  return { x: width - w - margin, y: height - h - margin, w, h };
}
// Scale a source into a box: contain (letterbox, for screens) or cover (crop, for cameras).
export function fitRect(srcW, srcH, box, cover) {
  const scale = cover ? Math.max(box.w / srcW, box.h / srcH) : Math.min(box.w / srcW, box.h / srcH);
  const w = srcW * scale; const h = srcH * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

export function createCompositor({ width = 1280, height = 720, fps = 30, placeholder = '' } = {}) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const g = canvas.getContext('2d');
  const video = () => { const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.autoplay = true; return v; };
  const cam = video(); const scr = video();
  let layout = 'camera';
  const ready = (v) => v.srcObject && v.videoWidth > 0 && v.readyState >= 2;
  function draw(v, box, cover) {
    const r = fitRect(v.videoWidth, v.videoHeight, box, cover);
    g.save(); g.beginPath(); g.rect(box.x, box.y, box.w, box.h); g.clip(); g.drawImage(v, r.x, r.y, r.w, r.h); g.restore();
  }
  function frame() {
    g.fillStyle = '#05080f'; g.fillRect(0, 0, width, height);
    const full = { x: 0, y: 0, w: width, h: height };
    const showScreen = needsScreen(layout) && ready(scr); const showCam = needsCamera(layout) && ready(cam);
    if (layout === 'camera' && showCam) draw(cam, full, true);
    else if (layout === 'screen' && showScreen) draw(scr, full, false);
    else if (layout === 'both' && (showScreen || showCam)) {
      if (showScreen) draw(scr, full, false);
      if (showCam) {
        const p = showScreen ? pipRect(width, height) : full;
        if (showScreen) { g.fillStyle = '#9ff3d4'; g.fillRect(p.x - 3, p.y - 3, p.w + 6, p.h + 6); }
        draw(cam, p, true);
      }
    } else if (placeholder) {
      g.fillStyle = '#9fb0c8'; g.font = '32px sans-serif'; g.textAlign = 'center'; g.fillText(placeholder, width / 2, height / 2);
    }
  }
  const worker = new Worker(URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${Math.round(1000 / fps)});`], { type: 'text/javascript' })));
  worker.onmessage = frame;
  frame();
  const stream = canvas.captureStream(fps);
  const attach = (v, media) => { v.srcObject = media || null; if (media) v.play().catch(() => {}); };
  return {
    stream, track: stream.getVideoTracks()[0],
    setCamera: (media) => attach(cam, media),
    setScreen: (media) => attach(scr, media),
    setLayout: (next) => { if (PC_LAYOUTS.includes(next)) layout = next; },
    get layout() { return layout; },
    stop() { worker.terminate(); stream.getTracks().forEach((track) => track.stop()); attach(cam, null); attach(scr, null); },
  };
}
