// Builds "Group 9.pptx" — the Capstone final report deck (English, ~10 minutes).
// Required topics (TA announcement 2026-11-26): System Architecture, Results and Analysis,
// Work Distribution, What You Learned, Problems Encountered, Final Platform Screenshot.
// Run: node build-deck.js   (needs pptxgenjs, react-icons, react, react-dom, sharp)
const path = require('path');
const pptxgen = require('pptxgenjs');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const sharp = require('sharp');
const fa = require('react-icons/fa6');

const APPLY_THEME = process.env.PPTX_APPLY_THEME || path.join(__dirname, 'apply_theme.js');
const OUT = process.env.DECK_OUT || path.join(__dirname, 'Group 9.pptx');
const IMG = path.join(__dirname, 'img');
// Speaker notes = the English talk script (speech.json, also rendered to SPEECH_SCRIPT.md by gen-speech.js).
const SPEECH = require('./speech.json');
const note = (n) => `${SPEECH[n - 1].speaker} (~${SPEECH[n - 1].seconds} s): ${SPEECH[n - 1].en}`;

const THEME = {
  name: 'Group 9 Cloud Live',
  headFontFace: 'Arial',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: '0B1220', lt1: 'FFFFFF', dk2: '172034', lt2: 'A3AEC2',
    accent1: '2FD5B4', accent2: 'F0525A', accent3: '9A7BFF', accent4: 'F6B93B', accent5: '4CA3FF', accent6: 'E8EDF5',
    hlink: '2FD5B4', folHlink: '9A7BFF',
  },
};
const HEX = THEME.colors;

async function icon(Comp, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: '#' + color, size: String(size) }));
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + png.toString('base64');
}

(async () => {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 in
  pres.title = 'Group 9 Final Report - Cloud-Based Live Streaming Platform';
  pres.author = 'Group 9';
  pres.company = 'NTUST ECE Capstone';
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;

  pres.defineSlideMaster({
    title: 'G9 Title',
    background: { color: C.text1 },
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 1.6, w: 6.3, h: 2.2, fontSize: 44, bold: true, color: C.background1, valign: 'bottom', align: 'left', fontFace: THEME.headFontFace }, text: '' } },
      { placeholder: { options: { name: 'body', type: 'body', x: 0.6, y: 3.95, w: 6.3, h: 0.6, fontSize: 22, color: C.accent1, valign: 'top' }, text: '' } },
    ],
  });
  pres.defineSlideMaster({
    title: 'G9 Content',
    background: { color: C.text1 },
    margin: [0.5, 0.6, 0.6, 0.6],
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.35, w: 12.1, h: 0.85, fontSize: 34, bold: true, color: C.background1, valign: 'middle', align: 'left', fontFace: THEME.headFontFace }, text: '' } },
      { text: { text: 'GROUP 9 · CLOUD-BASED LIVE STREAMING', options: { x: 0.6, y: 7.0, w: 6, h: 0.3, fontSize: 10, color: C.background2, charSpacing: 2 } } },
    ],
    slideNumber: { x: 12.2, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: C.background2, align: 'right' },
  });

  // Reusable visual pieces -------------------------------------------------
  const card = (slide, x, y, w, h, name, fill = C.text2) => slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: fill, width: 0.5 }, objectName: name });
  const dotIcon = async (slide, Comp, x, y, d, color, name) => {
    slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color }, line: { color, width: 0.5 }, objectName: name + ' circle' });
    slide.addImage({ data: await icon(Comp, HEX.dk1), x: x + d * 0.24, y: y + d * 0.24, w: d * 0.52, h: d * 0.52, objectName: name + ' icon', altText: name });
  };
  const text = (slide, t, opts) => slide.addText(t, { isTextBox: true, margin: 0, color: C.background1, fontSize: 14, valign: 'top', ...opts });
  const livePill = (slide, x, y) => {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 0.95, h: 0.36, rectRadius: 0.18, fill: { color: C.accent2 }, line: { color: C.accent2, width: 0.5 }, objectName: 'LIVE pill' });
    text(slide, '● LIVE', { x, y, w: 0.95, h: 0.36, fontSize: 12, bold: true, align: 'center', valign: 'middle' });
  };
  const placeholderFrame = (slide, x, y, w, h, label, hint, name) => {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: C.text2 }, line: { color: C.background2, width: 1.5, dashType: 'dash' }, objectName: name });
    text(slide, [{ text: label, options: { bold: true, fontSize: 18, breakLine: true } }, { text: hint, options: { fontSize: 12, color: C.background2 } }], { x: x + 0.3, y: y + h / 2 - 0.45, w: w - 0.6, h: 0.9, align: 'center', valign: 'middle', objectName: name + ' label' });
  };
  // Lines must have positive w/h; direction is set with flipH / flipV (negative sizes corrupt the file).
  const arrow = (slide, x, y, w, h, color, name, flip = {}) => slide.addShape(pres.shapes.LINE, { x, y, w, h, ...flip, line: { color, width: 2, endArrowType: 'triangle' }, objectName: name });

  // 1 · Title ----------------------------------------------------------------
  pres.addSection({ title: 'Opening' });
  let s = pres.addSlide({ masterName: 'G9 Title', sectionTitle: 'Opening' });
  livePill(s, 0.6, 1.05);
  text(s, 'FINAL REPORT · NTUST ECE CAPSTONE 2026', { x: 1.75, y: 1.05, w: 5.2, h: 0.36, fontSize: 12, bold: true, color: C.background2, valign: 'middle', charSpacing: 2 });
  s.addText('Cloud-Based Live Streaming Platform', { placeholder: 'title' });
  s.addText('Group 9 · OBS + phone → Azure VM → browser', { placeholder: 'body' });
  card(s, 0.6, 5.0, 3.0, 1.2, 'Member card 1');
  text(s, [{ text: '王昱程', options: { bold: true, fontSize: 20, breakLine: true } }, { text: 'B11302005 · Frontend + OBS', options: { fontSize: 13, color: C.background2 } }], { x: 0.85, y: 5.2, w: 2.6, h: 0.8 });
  card(s, 3.85, 5.0, 3.0, 1.2, 'Member card 2');
  text(s, [{ text: '曹少懷', options: { bold: true, fontSize: 20, breakLine: true } }, { text: 'B11302133 · Backend + Cloud', options: { fontSize: 13, color: C.background2 } }], { x: 4.1, y: 5.2, w: 2.6, h: 0.8 });
  card(s, 7.35, 1.4, 5.4, 4.5, 'Screenshot frame');
  text(s, 'Two broadcasters, one page, one chat', { x: 7.6, y: 1.65, w: 4.9, h: 0.5, fontSize: 18, bold: true });
  s.addImage({ path: path.join(IMG, 'dual-live-real.jpg'), x: 7.6, y: 2.45, w: 4.9, h: 2.19, altText: 'Our website with the host PC and the phone live', objectName: 'Dual live screenshot' });
  text(s, 'Slot 1: OBS over RTMPS · Slot 2: phone over WebRTC', { x: 7.6, y: 4.95, w: 4.9, h: 0.8, fontSize: 14, color: C.background2 });
  s.addNotes(note(1));

  // 2 · Architecture diagram ------------------------------------------------
  pres.addSection({ title: 'System Architecture' });
  s = pres.addSlide({ masterName: 'G9 Content', sectionTitle: 'System Architecture' });
  s.addText('System architecture: one Azure VM, three lanes', { placeholder: 'title' });
  const srcs = [
    ['Host PC', 'OBS · H.264 + AAC', fa.FaDesktop, HEX.accent1],
    ['Guest PC', 'OBS · second slot', fa.FaLaptop, HEX.accent3],
    ['Phone', 'Browser camera, no app', fa.FaMobileScreenButton, HEX.accent4],
  ];
  for (let i = 0; i < srcs.length; i++) {
    const y = 1.55 + i * 1.75;
    card(s, 0.6, y, 2.9, 1.35, 'Source ' + srcs[i][0]);
    await dotIcon(s, srcs[i][2], 0.8, y + 0.32, 0.7, srcs[i][3], srcs[i][0]);
    text(s, [{ text: srcs[i][0], options: { bold: true, fontSize: 16, breakLine: true } }, { text: srcs[i][1], options: { fontSize: 12, color: C.background2 } }], { x: 1.65, y: y + 0.3, w: 1.8, h: 0.8 });
  }
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 4.6, y: 1.45, w: 4.6, h: 5.2, rectRadius: 0.15, fill: { color: C.text2 }, line: { color: C.accent5, width: 1.5 }, objectName: 'Azure VM container' });
  text(s, [{ text: 'Azure VM · B11302133', options: { bold: true, fontSize: 16, breakLine: true } }, { text: 'Ubuntu 24.04 ARM64 · Japan East · NSG allow-list', options: { fontSize: 12, color: C.background2 } }], { x: 4.85, y: 1.6, w: 4.1, h: 0.7 });
  const inner = [
    ['MediaMTX', 'RTMPS ingest · WebRTC · LL-HLS', HEX.accent1],
    ['Node.js + Socket.IO', 'REST API · chat · auth proxies', HEX.accent3],
    ['Apache 2.4 (HTTPS 443)', 'TLS · reverse proxy · assets', HEX.accent5],
    ['SQLite', 'Accounts · ledger · chat · audit', HEX.accent4],
  ];
  for (let i = 0; i < inner.length; i++) {
    const y = 2.45 + i * 1.02;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 4.85, y, w: 4.1, h: 0.85, rectRadius: 0.1, fill: { color: C.text1 }, line: { color: inner[i][2], width: 1.25 }, objectName: 'VM part ' + inner[i][0] });
    text(s, [{ text: inner[i][0], options: { bold: true, fontSize: 14, breakLine: true } }, { text: inner[i][1], options: { fontSize: 12, color: C.background2 } }], { x: 5.05, y: y + 0.1, w: 3.8, h: 0.65 });
  }
  card(s, 10.35, 2.3, 2.4, 1.6, 'Viewers card');
  await dotIcon(s, fa.FaUsers, 10.55, 2.5, 0.6, HEX.accent5, 'Viewers');
  text(s, [{ text: 'Viewers', options: { bold: true, fontSize: 16, breakLine: true } }, { text: 'React + hls.js', options: { fontSize: 12, color: C.background2 } }], { x: 10.55, y: 3.15, w: 2.1, h: 0.65 });
  card(s, 10.35, 4.3, 2.4, 1.6, 'Chat card');
  await dotIcon(s, fa.FaComments, 10.55, 4.5, 0.6, HEX.accent3, 'Chat');
  text(s, [{ text: 'Chat + gifts', options: { bold: true, fontSize: 16, breakLine: true } }, { text: 'Socket.IO (WebSocket)', options: { fontSize: 12, color: C.background2 } }], { x: 10.55, y: 5.15, w: 2.1, h: 0.65 });
  arrow(s, 3.5, 2.22, 1.35, 0.5, HEX.accent1, 'Arrow host RTMPS');
  arrow(s, 3.5, 2.82, 1.35, 1.15, HEX.accent3, 'Arrow guest RTMPS', { flipV: true });
  arrow(s, 3.5, 3.9, 1.35, 1.82, HEX.accent4, 'Arrow phone WHIP to Node', { flipV: true });
  text(s, 'RTMPS :1936 TCP', { x: 3.55, y: 1.6, w: 1.0, h: 0.5, fontSize: 10, color: C.accent1, bold: true });
  text(s, 'WebRTC UDP 8189', { x: 3.55, y: 5.85, w: 1.0, h: 0.5, fontSize: 10, color: C.accent4, bold: true });
  arrow(s, 9.2, 3.1, 1.15, 0.01, HEX.accent5, 'Arrow to viewers');
  arrow(s, 9.2, 5.0, 1.15, 0.01, HEX.accent3, 'Arrow chat to users');
  arrow(s, 9.2, 5.25, 1.15, 0.01, HEX.accent3, 'Arrow chat from users', { flipH: true });
  text(s, 'HLS over HTTPS', { x: 9.3, y: 2.55, w: 1.0, h: 0.5, fontSize: 10, color: C.accent5, bold: true });
  text(s, 'WebSocket', { x: 9.3, y: 4.6, w: 1.0, h: 0.3, fontSize: 10, color: C.accent3, bold: true });
  s.addNotes(note(2));

  // 3 · Everything the platform does ------------------------------------------
  s = pres.addSlide({ masterName: 'G9 Content', sectionTitle: 'System Architecture' });
  s.addText('Everything the platform does', { placeholder: 'title' });
  const featureCols = [
    ['Viewers', fa.FaUsers, HEX.accent5, ['Two live slots side by side (≈2–3 s delay)', 'Join by link or QR code, no app', 'Guest login with demo points, accounts', 'Live chat, GIFs and likes', '3D gifts with quiet sounds and ×N combos', 'Live supporters board', 'AI voice messages, 9 neural voices', 'Live captions (CC) and points ledger', 'Chinese / English in one click']],
    ['Broadcasters', fa.FaTowerBroadcast, HEX.accent4, ['OBS over RTMPS, two slots', 'Phone broadcasting from the browser (WebRTC, works on 4G)', 'PC browser: camera / screen + camera / screen', 'Mic on / off in one click', 'Auto-reconnect after a network drop', 'Leave slot 2; idle slot freed after 3 min', 'Stop a voice message for everyone']],
    ['Admins and platform', fa.FaUserShield, HEX.accent3, ['Chat moderation: notice, slow mode, banned words, reports, mutes, audit log', 'Stream health panel for both slots', 'Session statistics and donation switch', 'HTTPS, hashed passwords, keys only on the VM', 'Nightly VM auto-shutdown and budget alert', '44 automated tests']],
  ];
  for (let i = 0; i < featureCols.length; i++) {
    const [t, Ic, hex, items] = featureCols[i];
    const x = 0.6 + i * 4.1;
    card(s, x, 1.4, 3.9, 5.3, 'Feature column ' + t);
    await dotIcon(s, Ic, x + 0.25, 1.6, 0.6, hex, t);
    text(s, t, { x: x + 1.0, y: 1.6, w: 2.75, h: 0.6, fontSize: 18, bold: true, valign: 'middle' });
    text(s, items.map((b, k) => ({ text: b, options: { bullet: true, breakLine: k < items.length - 1 } })), { x: x + 0.25, y: 2.4, w: 3.45, h: 4.15, fontSize: 13.5, color: C.background1, paraSpaceAfter: 9 });
  }
  s.addNotes(note(3));

  // 6 · Results: stat callouts ---------------------------------------------
  pres.addSection({ title: 'Results and Analysis' });
  s = pres.addSlide({ masterName: 'G9 Content', sectionTitle: 'Results and Analysis' });
  s.addText('Results and analysis', { placeholder: 'title' });
  const stats = [
    ['2 / 2', 'live slots on one page', 'OBS and a phone live at the same time', C.accent1],
    ['≈ 2–3 s', 'website latency (HLS)', 'Camera to viewer, smooth playback', C.accent5],
    ['10 / 10', 'viewer tabs joined', 'Concurrent test on the public site', C.accent3],
    ['44 / 44', 'automated tests passed', 'Chat, ledger, phone auth, voice, health', C.accent4],
  ];
  for (let i = 0; i < stats.length; i++) {
    const [big, label, d, col] = stats[i];
    const x = 0.6 + i * 3.08;
    card(s, x, 1.35, 2.85, 2.05, 'Stat ' + label);
    text(s, big, { x: x + 0.25, y: 1.5, w: 2.4, h: 0.8, fontSize: 40, bold: true, color: col, fontFace: THEME.headFontFace });
    text(s, [{ text: label, options: { bold: true, fontSize: 15, breakLine: true } }, { text: d, options: { fontSize: 12, color: C.background2 } }], { x: x + 0.25, y: 2.35, w: 2.45, h: 0.95 });
  }
  card(s, 0.6, 3.6, 6.0, 3.1, 'Latency card');
  text(s, 'Latency: camera to viewer', { x: 0.9, y: 3.75, w: 5.4, h: 0.4, fontSize: 16, bold: true });
  const lat = [
    ['RTMP to HLS, lecture typical', '3–5 s', 4.6, HEX.lt2],
    ['Our low-latency HLS (public site)', '≈ 2–3 s', 2.5, HEX.accent5],
    ['WebRTC path (phone upload, local test)', '0.1–0.3 s', 0.25, HEX.accent1],
  ];
  for (let i = 0; i < lat.length; i++) {
    const y = 4.25 + i * 0.78;
    const bw = Math.max(0.15, (lat[i][2] / 5) * 4.0);
    text(s, lat[i][0], { x: 0.9, y, w: 5.4, h: 0.3, fontSize: 12, color: C.background2 });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.9, y: y + 0.32, w: bw, h: 0.32, rectRadius: 0.06, fill: { color: lat[i][3] }, line: { color: lat[i][3], width: 0.5 }, objectName: 'Latency bar ' + i });
    text(s, lat[i][1], { x: 0.9 + bw + 0.15, y: y + 0.32, w: 1.2, h: 0.32, fontSize: 14, bold: true, valign: 'middle' });
  }
  card(s, 6.9, 3.6, 5.8, 3.1, 'Encoder card');
  text(s, 'Skipped frames on the host PC (720p30)', { x: 7.2, y: 3.75, w: 5.2, h: 0.4, fontSize: 16, bold: true });
  // Drawn with shapes (not a native chart): Google Slides drops the category labels of imported pptx charts.
  const enc = [['x264 (CPU)', 19, HEX.accent2], ['NVENC (GPU)', 0, HEX.accent1]];
  const base = 6.05;
  s.addShape(pres.shapes.LINE, { x: 7.3, y: base, w: 5.0, h: 0, line: { color: HEX.lt2, width: 1 }, objectName: 'Encoder baseline' });
  for (let i = 0; i < enc.length; i++) {
    const [lab, v, col] = enc[i];
    const cx = 8.55 + i * 2.5, bh = Math.max(0.05, (v / 25) * 1.7);
    s.addShape(pres.shapes.RECTANGLE, { x: cx - 0.7, y: base - bh, w: 1.4, h: bh, fill: { color: col }, line: { color: col, width: 0.5 }, objectName: 'Encoder bar ' + lab });
    text(s, v + '%', { x: cx - 0.8, y: base - bh - 0.42, w: 1.6, h: 0.38, fontSize: 18, bold: true, align: 'center', valign: 'bottom' });
    text(s, lab, { x: cx - 1.0, y: base + 0.08, w: 2.0, h: 0.35, fontSize: 13, color: C.background2, align: 'center' });
  }
  s.addNotes(note(4));

  // 8 · Final platform screenshot ------------------------------------------
  pres.addSection({ title: 'Final Platform Screenshot' });
  s = pres.addSlide({ masterName: 'G9 Content', sectionTitle: 'Final Platform Screenshot' });
  s.addText('Final platform screenshot', { placeholder: 'title' });
  card(s, 0.6, 1.5, 8.6, 5.15, 'Screenshot card');
  // Real frame from the demo recording (2026-11-27): slot 1 = host PC via OBS, slot 2 = phone on 4G, live caption under slot 2.
  s.addImage({ path: path.join(IMG, 'dual-live-real.jpg'), x: 0.85, y: 1.75, w: 8.1, h: 3.62, altText: 'Public Group 9 website with the host PC and the phone live, with a live caption', objectName: 'Platform screenshot' });
  text(s, [{ text: 'Slot 1 ', options: { bold: true, color: HEX.accent1 } }, { text: 'host PC via OBS (RTMPS)    ', options: { color: HEX.lt2 } }, { text: 'Slot 2 ', options: { bold: true, color: HEX.accent4 } }, { text: 'phone on 4G via WebRTC, with live captions', options: { color: HEX.lt2 } }], { x: 0.85, y: 5.6, w: 8.1, h: 0.4, fontSize: 15 });
  text(s, 'group9liveb11302133.japaneast.cloudapp.azure.com/group9/', { x: 0.85, y: 6.05, w: 8.1, h: 0.35, fontSize: 13, color: C.accent5 });
  // Phone screenshot from the phone's own screen recording at the same moment (884×1920 portrait).
  card(s, 9.55, 1.5, 3.15, 5.15, 'Phone screenshot card');
  { const ph = 4.45, pw = ph * 884 / 1920; s.addImage({ path: path.join(IMG, 'phone-live.jpg'), x: 9.55 + (3.15 - pw) / 2, y: 1.65, w: pw, h: ph, altText: 'Phone broadcasting to slot 2 over 4G with live captions on', objectName: 'Phone screenshot' }); }
  text(s, 'Phone view: live on 4G, captions on', { x: 9.65, y: 6.15, w: 2.95, h: 0.4, fontSize: 12, color: C.background2, align: 'center' });
  s.addNotes(note(5));

  // 10 · Demo video placeholder ---------------------------------------------
  s = pres.addSlide({ masterName: 'G9 Content', sectionTitle: 'Final Platform Screenshot' });
  s.addText('Demo video', { placeholder: 'title' });
  // 3:39 demo, 1080p, English AI narration + English/Chinese subtitles (built by tools/edit_video.py)
  const VIDEO_FILE = path.join(__dirname, 'video', 'Group9_demo.mp4');
  const poster = 'image/jpeg;base64,' + require('fs').readFileSync(path.join(__dirname, 'video', 'poster.jpg')).toString('base64');
  card(s, 1.85, 1.35, 9.63, 5.5, 'Video card');
  // NO_VIDEO=1 builds the Google Slides copy: a poster image here, the video is inserted from Drive afterwards.
  if (process.env.NO_VIDEO) s.addImage({ data: poster, x: 2.0, y: 1.45, w: 9.33, h: 5.25, objectName: 'Demo video poster', altText: 'Demo video (poster frame)' });
  else s.addMedia({ type: 'video', path: VIDEO_FILE, cover: poster, x: 2.0, y: 1.45, w: 9.33, h: 5.25, objectName: 'Demo video' });
  s.addNotes(note(6));

  // 7 · Features not shown in the demo video (screenshots) -------------------
  const SHOTS = path.join(IMG, 'shots');
  const fitImage = async (slide, file, x, y, w, h, alt) => {
    const meta = await sharp(path.join(SHOTS, file)).metadata();
    const scale = Math.min(w / meta.width, h / meta.height);
    const iw = meta.width * scale, ih = meta.height * scale;
    slide.addImage({ path: path.join(SHOTS, file), x: x + (w - iw) / 2, y: y + (h - ih) / 2, w: iw, h: ih, altText: alt, objectName: alt });
  };
  pres.addSection({ title: 'More Features' });
  s = pres.addSlide({ masterName: 'G9 Content', sectionTitle: 'More Features' });
  s.addText('More features not shown in the video', { placeholder: 'title' });
  const tiles = [
    ['voice-overlay.png', 'AI voice message on the stream, with "Stop reading"'],
    ['layout-panel.png', 'PC browser: one-click layouts and mic button'],
    ['reconnecting.png', 'Network lost → reconnects by itself'],
    ['admin-health.png', 'Admin stream health panel (both slots)'],
  ];
  for (let i = 0; i < tiles.length; i++) {
    const [file, cap] = tiles[i];
    const x = 0.6 + (i % 2) * 6.15, y = 1.3 + Math.floor(i / 2) * 2.65;
    card(s, x, y, 5.95, 2.55, 'Tile ' + (i + 1));
    await fitImage(s, file, x + 0.15, y + 0.12, 5.65, 1.95, cap);
    text(s, cap, { x: x + 0.2, y: y + 2.1, w: 5.55, h: 0.35, fontSize: 13, color: C.background2, align: 'center', valign: 'middle' });
  }
  text(s, 'Also: points ledger · session statistics · Chinese / English interface · donation on / off switch', { x: 0.6, y: 6.55, w: 12.1, h: 0.35, fontSize: 13, color: C.accent1, align: 'center', valign: 'middle' });
  s.addNotes(note(7));

  // 12 · Work distribution ---------------------------------------------------
  pres.addSection({ title: 'Work Distribution' });
  s = pres.addSlide({ masterName: 'G9 Content', sectionTitle: 'Work Distribution' });
  s.addText('Work distribution', { placeholder: 'title' });
  const members = [
    ['王昱程', 'B11302005 · Frontend + OBS', HEX.accent1, fa.FaPalette, ['Website and React player', 'Chat interface and gift UI', 'OBS setup, AEC audio, browser tests', 'Phone broadcast testing']],
    ['曹少懷', 'B11302133 · Backend + Cloud', HEX.accent3, fa.FaServer, ['Azure VM, NSG and HTTPS', 'MediaMTX RTMPS / WebRTC / HLS', 'Node.js, Socket.IO and SQLite', 'Deployment and recovery runbooks']],
  ];
  for (let i = 0; i < members.length; i++) {
    const [name, role, hex, Ic, items] = members[i];
    const x = 0.6 + i * 4.15;
    card(s, x, 1.5, 3.9, 5.15, 'Member ' + name);
    await dotIcon(s, Ic, x + 0.3, 1.8, 0.85, hex, name);
    text(s, [{ text: name, options: { bold: true, fontSize: 24, breakLine: true } }, { text: role, options: { fontSize: 14, color: C.background2 } }], { x: x + 0.3, y: 2.85, w: 3.3, h: 0.9 });
    text(s, items.map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < items.length - 1 } })), { x: x + 0.3, y: 3.9, w: 3.35, h: 2.55, fontSize: 15, paraSpaceAfter: 6 });
  }
  card(s, 8.9, 1.5, 3.8, 5.15, 'Together card');
  await dotIcon(s, fa.FaCodeBranch, 9.2, 1.8, 0.85, HEX.accent4, 'Together');
  text(s, [{ text: 'Together', options: { bold: true, fontSize: 24, breakLine: true } }, { text: 'Shared responsibilities', options: { fontSize: 14, color: C.background2 } }], { x: 9.2, y: 2.85, w: 3.2, h: 0.9 });
  const together = ['GitHub repo, branches and PRs', 'System and live testing', 'Two-broadcaster rehearsals', 'Slides and demo video'];
  text(s, together.map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < together.length - 1 } })), { x: 9.2, y: 3.9, w: 3.25, h: 2.55, fontSize: 15, paraSpaceAfter: 6 });
  s.addNotes(note(8));

  // 13 · What we learned -----------------------------------------------------
  pres.addSection({ title: 'What We Learned' });
  s = pres.addSlide({ masterName: 'G9 Content', sectionTitle: 'What We Learned' });
  s.addText('What we learned, lecture by lecture', { placeholder: 'title' });
  const learned = [
    ['W03 Azure VM', 'IaaS means we manage the OS, ports and cost; deallocate after every session', fa.FaCloud, HEX.accent5],
    ['W05 HTML / CSS / JS', 'A responsive React page that works on a phone and a PC', fa.FaCode, HEX.accent1],
    ['W06 API and DB', 'REST status codes and SQL transactions keep gift points correct', fa.FaDatabase, HEX.accent4],
    ['W09 Socket', 'TCP for chat, UDP for live media: real services mix both', fa.FaNetworkWired, HEX.accent3],
    ['W10 RTMP', 'OBS ingest and HLS segments; latency trades off with buffering', fa.FaVideo, HEX.accent2],
    ['W04 AI agents', 'Commit first, protect secrets, ask for tests and evidence', fa.FaRobot, HEX.accent1],
  ];
  for (let i = 0; i < learned.length; i++) {
    const [t, d, Ic, hex] = learned[i];
    const x = 0.6 + (i % 2) * 6.15; const y = 1.5 + Math.floor(i / 2) * 1.75;
    card(s, x, y, 5.95, 1.55, 'Learned ' + t);
    await dotIcon(s, Ic, x + 0.25, y + 0.38, 0.8, hex, t);
    text(s, [{ text: t, options: { bold: true, fontSize: 17, breakLine: true } }, { text: d, options: { fontSize: 14, color: C.background2 } }], { x: x + 1.3, y: y + 0.22, w: 4.45, h: 1.15 });
  }
  s.addNotes(note(9));

  // 14 · Problems and solutions ---------------------------------------------
  pres.addSection({ title: 'Problems Encountered' });
  s = pres.addSlide({ masterName: 'G9 Content', sectionTitle: 'Problems Encountered' });
  s.addText('Problems encountered and our solutions', { placeholder: 'title' });
  const ph = (t) => ({ text: t, options: { bold: true, color: HEX.dk1, fill: { color: HEX.accent2 } } });
  const pr = (cells) => cells.map((t, k) => ({ text: t, options: { color: k === 0 ? HEX.lt1 : HEX.lt2, bold: k === 0, fill: { color: HEX.dk2 } } }));
  s.addTable([
    [ph('Problem'), ph('Cause'), ph('Solution')],
    pr(['OBS cannot connect', 'Home / phone IP changed; port 1936 is allow-listed', 'Check IP first, add a new /32 rule per broadcaster']),
    pr(['Echo with two hosts', 'Speakers feed the other host back in', 'Open-source AEC in OBS, mute self-monitoring']),
    pr(['Video late vs chat', 'HLS buffers several segments', 'LL-HLS 1 s segments; WebRTC for phone upload']),
    pr(['Phone camera blocked', 'Browsers allow cameras only on HTTPS', 'Let\'s Encrypt certificate + Apache HTTPS proxy']),
    pr(['Frames skipped', 'CPU encoder (x264) overloaded', 'Switch OBS to NVENC: 19% to 0%']),
    pr(['Keys pushed to GitHub', 'Private config files committed by mistake', 'Removed from repo, rotate keys, .gitignore']),
  ], { x: 0.6, y: 1.5, w: 12.1, colW: [2.9, 4.4, 4.8], fontSize: 14, fontFace: THEME.bodyFontFace, border: { type: 'solid', color: HEX.dk1, pt: 2 }, rowH: 0.72, valign: 'middle', margin: [0, 0.12, 0, 0.12] });
  s.addNotes(note(10));

  // 15 · Conclusion -----------------------------------------------------------
  pres.addSection({ title: 'Closing' });
  s = pres.addSlide({ masterName: 'G9 Title', sectionTitle: 'Closing' });
  s.addText('Thank you', { placeholder: 'title' });
  s.addText('Questions and answers', { placeholder: 'body' });
  card(s, 7.35, 1.4, 5.4, 4.3, 'Summary card');
  text(s, 'Summary and next steps', { x: 7.65, y: 1.7, w: 4.8, h: 0.5, fontSize: 20, bold: true });
  const nextItems = ['Delivered: OBS + phone broadcasting, chat, accounts and gifts on Azure', 'Measured: about 2 s latency, 10/10 viewers, 44/44 tests', 'Next: TURN server for strict mobile networks', 'Next: WebRTC playback for sub-second viewing', 'Next: recording and replay'];
  text(s, nextItems.map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < nextItems.length - 1 } })), { x: 7.65, y: 2.35, w: 4.85, h: 3.6, fontSize: 15, paraSpaceAfter: 8 });
  text(s, 'github.com/yycc0112299/live_streaming', { x: 0.6, y: 5.3, w: 6.3, h: 0.4, fontSize: 14, color: C.background2 });
  s.addNotes(note(11));

  await pres.writeFile({ fileName: OUT });
  if (!process.env.SKIP_THEME) { const { applyTheme } = require(APPLY_THEME); await applyTheme(OUT, THEME); }
  console.log('Wrote', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
