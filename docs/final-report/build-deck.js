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
  s.addImage({ path: path.join(IMG, 'dual-live.jpg'), x: 7.6, y: 2.45, w: 4.9, h: 2.19, altText: 'Our website with both broadcaster slots live', objectName: 'Dual live screenshot' });
  text(s, 'Slot 1: OBS over RTMPS · Slot 2: browser over WebRTC', { x: 7.6, y: 4.95, w: 4.9, h: 0.8, fontSize: 14, color: C.background2 });
  s.addNotes('Good morning. We are Group 9. Our project is a cloud-based live streaming platform: broadcasters stream from OBS or directly from a phone browser, an Azure virtual machine relays the video, and viewers watch and chat in the browser. In the next ten minutes we cover the six required parts: architecture, results and analysis, the platform screenshot, work distribution, what we learned, and the problems we solved.');

  // 2 · Agenda ----------------------------------------------------------------
  s = pres.addSlide({ masterName: 'G9 Content', sectionTitle: 'Opening' });
  s.addText('What we will cover', { placeholder: 'title' });
  const agenda = [
    ['01', 'System Architecture', 'Three lanes on one Azure VM', fa.FaSitemap, HEX.accent1],
    ['02', 'Results and Analysis', 'Live tests, latency, encoder data', fa.FaChartColumn, HEX.accent5],
    ['03', 'Final Platform Screenshot', 'Website, phone view and demo video', fa.FaDisplay, HEX.accent3],
    ['04', 'Work Distribution', 'Who built which part', fa.FaPeopleGroup, HEX.accent4],
    ['05', 'What We Learned', 'Linked to each lecture', fa.FaLightbulb, HEX.accent1],
    ['06', 'Problems Encountered', 'Causes and our solutions', fa.FaScrewdriverWrench, HEX.accent2],
  ];
  for (let i = 0; i < agenda.length; i++) {
    const [n, t, d, Ic, hex] = agenda[i];
    const x = 0.6 + (i % 3) * 4.15; const y = 1.55 + Math.floor(i / 3) * 2.65;
    card(s, x, y, 3.8, 2.35, 'Agenda card ' + n);
    await dotIcon(s, Ic, x + 0.3, y + 0.3, 0.7, hex, 'Agenda ' + t);
    text(s, n, { x: x + 2.7, y: y + 0.3, w: 0.8, h: 0.5, fontSize: 24, bold: true, color: C.background2, align: 'right' });
    text(s, [{ text: t, options: { bold: true, fontSize: 20, breakLine: true } }, { text: d, options: { fontSize: 14, color: C.background2 } }], { x: x + 0.3, y: y + 1.2, w: 3.2, h: 0.95 });
  }
  s.addNotes('These six topics are exactly the items required in the TA announcement. The screenshot part also includes our demo video and photos of the real setup.');

  // 3 · Architecture diagram ------------------------------------------------
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
  s.addNotes('Everything runs on one Azure VM. Video comes in on the left: both PCs use OBS and push RTMPS over TCP port 1936, and only each broadcaster\'s current IP is allowed. A phone needs no app: its browser sends the camera with WebRTC, and the media travels over UDP port 8189. Inside the VM, MediaMTX receives the streams and turns them into low-latency HLS. The Node.js server serves the React website, the REST API and Socket.IO chat, and it proxies video to viewers. Apache provides HTTPS, and SQLite keeps accounts, the gift ledger and chat history.');

  // 4 · Lanes and protocols ---------------------------------------------------
  s = pres.addSlide({ masterName: 'G9 Content', sectionTitle: 'System Architecture' });
  s.addText('Why each lane uses its protocol', { placeholder: 'title' });
  const hdr = (t) => ({ text: t, options: { bold: true, color: HEX.dk1, fill: { color: HEX.accent1 } } });
  const row = (cells) => cells.map((t) => ({ text: t, options: { color: HEX.lt1, fill: { color: HEX.dk2 } } }));
  s.addTable([
    [hdr('Lane'), hdr('Protocol'), hdr('Transport'), hdr('Why (lecture)')],
    row(['PC video in', 'RTMPS (OBS)', 'TCP 1936 + TLS', 'W10: standard OBS ingest; IP allow-list']),
    row(['Phone video in', 'WebRTC WHIP', 'UDP 8189 (TCP fallback)', 'W09: live media prefers UDP; no app needed']),
    row(['Video out', 'Low-latency HLS', 'HTTPS (TCP)', 'W10: small HTTP segments play anywhere']),
    row(['Chat and gifts', 'Socket.IO', 'WebSocket (TCP)', 'W09: every message must arrive in order']),
    row(['Data', 'REST API + SQL', 'HTTPS / SQLite', 'W06: accounts, gift ledger, no double charge']),
  ], { x: 0.6, y: 1.5, w: 12.1, colW: [2.2, 2.4, 2.9, 4.6], fontSize: 15, fontFace: THEME.bodyFontFace, border: { type: 'solid', color: HEX.dk1, pt: 2 }, rowH: 0.62, valign: 'middle', margin: [0, 0.12, 0, 0.12] });
  card(s, 0.6, 5.55, 12.1, 1.1, 'Takeaway card');
  await dotIcon(s, fa.FaArrowRightArrowLeft, 0.85, 5.75, 0.7, HEX.accent4, 'Takeaway');
  text(s, [{ text: 'Real services mix TCP and UDP. ', options: { bold: true } }, { text: 'Chat must be reliable, so it uses TCP. Live media prefers speed, so the phone uses UDP. Playback uses HLS over HTTPS so every browser can watch.', options: { color: HEX.lt2 } }], { x: 1.8, y: 5.75, w: 10.7, h: 0.75, fontSize: 15, valign: 'middle' });
  s.addNotes('This table answers the W09 exit question: which parts use TCP and which use UDP. Chat uses TCP through WebSocket because every message must arrive in order. Phone video uses WebRTC over UDP because a late frame is useless. Playback uses HLS over HTTPS, which is TCP but works in every browser, the same idea as YouTube Live.');

  // 5 · Features --------------------------------------------------------------
  s = pres.addSlide({ masterName: 'G9 Content', sectionTitle: 'System Architecture' });
  s.addText('What the platform can do', { placeholder: 'title' });
  const feats = [
    [fa.FaTowerBroadcast, HEX.accent1, 'Dual broadcasters', 'Two live slots on one page, each with its own key'],
    [fa.FaMobileScreenButton, HEX.accent4, 'Phone broadcasting', 'Join slot 2 from a phone browser with WebRTC'],
    [fa.FaComments, HEX.accent3, 'Real-time chat', 'Announcements, reports, mute, slow mode, GIFs'],
    [fa.FaUserShield, HEX.accent5, 'Accounts and roles', 'Viewer, host and admin roles stored in SQLite'],
    [fa.FaGift, HEX.accent2, '3D gifts and top fans', 'WebGL gift effects, supporter ranking, no double charge'],
    [fa.FaLanguage, HEX.accent1, 'Bilingual and shareable', 'Chinese / English, share link and QR code'],
  ];
  for (let i = 0; i < feats.length; i++) {
    const [Ic, hex, t, d] = feats[i];
    const x = 0.6 + (i % 3) * 4.15; const y = 1.55 + Math.floor(i / 3) * 2.65;
    card(s, x, y, 3.8, 2.35, 'Feature ' + t);
    await dotIcon(s, Ic, x + 0.3, y + 0.3, 0.75, hex, t);
    text(s, [{ text: t, options: { bold: true, fontSize: 19, breakLine: true } }, { text: d, options: { fontSize: 14, color: C.background2 } }], { x: x + 0.3, y: y + 1.2, w: 3.2, h: 0.95 });
  }
  s.addNotes('Beyond the core video and chat, we added the features planned in our first presentation: viewer count, likes and gifts, plus moderation and accounts. Gifts now play as real-time 3D models rendered with WebGL, and a top-supporters board ranks fans for the current broadcast. The teacher asked that a phone can join the live stream, so a phone can now take slot two directly from the browser.');

  // 5a–5b · Complete feature list (where each feature is shown) ---------------
  // Slide numbers after these two slides are inserted: demo video = 12, screenshot slides = 13–18.
  const VIDEO = 'Demo video (slide 12)';
  const featureTable = (title, groups, notes) => {
    const sl = pres.addSlide({ masterName: 'G9 Content', sectionTitle: 'System Architecture' });
    sl.addText(title, { placeholder: 'title' });
    const head = (t) => ({ text: t, options: { bold: true, color: HEX.dk1, fill: { color: HEX.accent1 } } });
    const rows = [[head('Feature'), head('What it does'), head('Shown in')]];
    for (const [group, color, items] of groups) {
      rows.push([{ text: group, options: { bold: true, color: HEX.dk1, fill: { color }, colspan: 3 } }]);
      for (const [f, d, where] of items) rows.push([f, d, where].map((t, i) => ({ text: t, options: { color: i === 2 ? (t.startsWith('Demo') ? HEX.accent1 : HEX.accent4) : HEX.lt1, bold: i === 0, fill: { color: HEX.dk2 } } })));
    }
    sl.addTable(rows, { x: 0.6, y: 1.35, w: 12.1, colW: [2.85, 6.65, 2.6], fontSize: 11.5, fontFace: THEME.bodyFontFace, border: { type: 'solid', color: HEX.dk1, pt: 1.5 }, rowH: 0.3, valign: 'middle', margin: [0, 0.1, 0, 0.1] });
    sl.addNotes(notes);
  };
  featureTable('Every feature, and where we show it (1/2)', [
    ['VIEWERS', HEX.accent5, [
      ['Two live slots', 'Watch two broadcasters side by side; low-latency HLS (~2–3 s); per-slot sound button', VIDEO],
      ['Join by link / QR code', 'Share dialog with copy link and QR code; works in any phone browser, no app', VIDEO],
      ['Guest account + points', 'Automatic guest login with 1,000 demo points; change nickname; create account', VIDEO + ' · slide 17'],
      ['Live chat', 'Socket.IO real-time chat, GIF stickers, likes with floating hearts, 5-second slow mode', VIDEO],
      ['3D gifts with sound', 'Six WebGL gifts, quiet synthesized sounds, ×N combos, one-click sound switch', VIDEO],
      ['Supporters board', 'Top 5 of this session, updated instantly; each viewer sees their own rank', VIDEO],
      ['AI voice messages', '25 points; 9 Azure neural voices with preview; read aloud for everyone', VIDEO + ' · slide 13'],
      ['Live captions (CC)', 'Broadcaster speech shown as text under their slot; viewers can hide it', VIDEO],
      ['Points ledger', 'Own transactions with IDs; retried requests are never charged twice', 'Screenshot slide 17'],
      ['Chinese / English', 'Whole interface switches language with one click', 'Screenshot slide 18'],
    ]],
  ], 'This table lists every viewer feature and where the audience can see it: either in the demo video on slide twelve or on a screenshot slide. Viewers watch two slots, join by QR code with a guest account and demo points, chat, send 3D gifts, climb the supporters board, send AI voice messages, read live captions, check their ledger and switch to English.');
  featureTable('Every feature, and where we show it (2/2)', [
    ['BROADCASTERS', HEX.accent4, [
      ['OBS broadcasting', 'RTMPS over TCP 1936 with TLS and a per-IP allow-list; two slots', VIDEO],
      ['Phone broadcasting', 'Teacher requirement: browser camera over WebRTC (4G works); server adds the key', VIDEO],
      ['PC browser layouts', 'Camera / screen + camera / screen in one click while live; mic on/off', 'Screenshot slide 14 · 18'],
      ['Reliability', 'Auto-reconnect with back-off; leave slot 2; idle slot released after 3 min', 'Screenshot slide 15'],
      ['Stop a voice message', 'Broadcaster stops the reading for every viewer', 'Screenshot slide 13'],
    ]],
    ['ADMINS', HEX.accent2, [
      ['Chat moderation', 'Pinned notice, slow mode, banned words, reports, mute, delete, audit log', VIDEO + ' · slide 16'],
      ['Stream health panel', 'Bitrate, data, tracks and uptime per slot; plain warnings; VM load', 'Screenshot slide 16'],
      ['Sessions and donations', 'Session statistics, end & start a new session, donations on/off switch', 'Screenshot slide 17 · 18'],
    ]],
    ['PLATFORM AND SECURITY', HEX.accent3, [
      ['Security', 'HTTPS everywhere, scrypt passwords, publish keys and Azure key only on the VM', 'Slides 3–4'],
      ['Cost control', 'VM auto-shutdown at 03:00 every day and a monthly budget alert', 'Azure settings (no slide)'],
      ['Testing', '44 automated tests; every change deployed and checked on the public site', 'Slide 8'],
    ]],
  ], 'The second table covers broadcasters, admins and the platform. Broadcasters can use OBS or just a browser, including the phone streaming the teacher asked for; a PC browser can switch layouts live, reconnects by itself and can free the second slot. Admins moderate chat, watch stream health and manage sessions and donations. Underneath, everything runs over HTTPS, secrets stay on the server, the VM shuts down automatically every night to save credit, and 44 automated tests guard each change.');

  // 6 · Results: stat callouts ---------------------------------------------
  pres.addSection({ title: 'Results and Analysis' });
  s = pres.addSlide({ masterName: 'G9 Content', sectionTitle: 'Results and Analysis' });
  s.addText('Results: the platform works live on Azure', { placeholder: 'title' });
  const stats = [
    ['2 / 2', 'live slots on one page', 'Host OBS and a WebRTC source at the same time', C.accent1],
    ['≈ 2–3 s', 'website latency (HLS)', 'Camera to viewer; 2.5 s buffer keeps it smooth', C.accent5],
    ['10 / 10', 'viewer tabs joined', 'Concurrent join test on the public site', C.accent3],
    ['44 / 44', 'automated tests passed', 'Chat, ledger, WHIP auth, TTS, captions, health', C.accent4],
  ];
  for (let i = 0; i < stats.length; i++) {
    const [big, label, d, col] = stats[i];
    const x = 0.6 + i * 3.08;
    card(s, x, 1.55, 2.85, 3.05, 'Stat ' + label);
    text(s, big, { x: x + 0.25, y: 1.85, w: 2.4, h: 1.1, fontSize: 48, bold: true, color: col, fontFace: THEME.headFontFace });
    text(s, [{ text: label, options: { bold: true, fontSize: 16, breakLine: true } }, { text: d, options: { fontSize: 13, color: C.background2 } }], { x: x + 0.25, y: 3.05, w: 2.4, h: 1.6 });
  }
  card(s, 0.6, 4.95, 12.1, 1.7, 'Method card');
  await dotIcon(s, fa.FaClipboardCheck, 0.85, 5.42, 0.75, HEX.accent1, 'Method');
  text(s, [{ text: 'How we checked: ', options: { bold: true } }, { text: 'OBS output bytes kept growing with no reconnects, MediaMTX reported each path ready, the public page played 1280×720 video, and the phone path arrived as H.264 + Opus. Results come from the live Azure site, not only local tests.', options: { color: HEX.lt2 } }], { x: 1.85, y: 5.15, w: 10.65, h: 1.3, fontSize: 15, valign: 'middle' });
  s.addNotes('These numbers come from the real Azure site. Both slots were live at the same time. Viewers see the stream about two seconds after the camera. Ten browser tabs joined at once without failure, and all forty-four automated tests pass. After a stutter test on a jittery network we raised the player buffer to about 2.5 seconds, so latency is now two to three seconds but playback no longer stalls. Following the W10 advice, we only claim what we verified: for example, ten viewers is our tested capacity, not a guess.');

  // 7 · Analysis: latency + encoder ----------------------------------------
  s = pres.addSlide({ masterName: 'G9 Content', sectionTitle: 'Results and Analysis' });
  s.addText('Analysis: latency and encoder choice', { placeholder: 'title' });
  card(s, 0.6, 1.5, 6.0, 5.15, 'Latency card');
  text(s, 'Latency: camera to viewer', { x: 0.9, y: 1.75, w: 5.4, h: 0.45, fontSize: 18, bold: true });
  const lat = [
    ['RTMP to HLS, lecture typical', '3–5 s', 4.6, HEX.lt2],
    ['Our low-latency HLS (public site)', '≈ 2 s', 2.0, HEX.accent5],
    ['WebRTC path (local test)', '0.1–0.3 s', 0.25, HEX.accent1],
  ];
  for (let i = 0; i < lat.length; i++) {
    const y = 2.45 + i * 1.2;
    const bw = Math.max(0.15, (lat[i][2] / 5) * 4.0);
    text(s, lat[i][0], { x: 0.9, y, w: 5.4, h: 0.35, fontSize: 14, color: C.background2 });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.9, y: y + 0.42, w: bw, h: 0.42, rectRadius: 0.08, fill: { color: lat[i][3] }, line: { color: lat[i][3], width: 0.5 }, objectName: 'Latency bar ' + i });
    text(s, lat[i][1], { x: 0.9 + bw + 0.15, y: y + 0.42, w: 1.2, h: 0.42, fontSize: 16, bold: true, valign: 'middle' });
  }
  text(s, '1 s segments, 200 ms parts and hls.js low-latency mode bring playback near 2 s', { x: 0.9, y: 5.85, w: 5.4, h: 0.6, fontSize: 12, color: C.background2 });
  card(s, 6.9, 1.5, 5.8, 5.15, 'Encoder card');
  text(s, 'Skipped frames on the host PC', { x: 7.2, y: 1.75, w: 5.2, h: 0.45, fontSize: 18, bold: true });
  s.addChart(pres.charts.BAR, [{ name: 'Skipped frames (%)', labels: ['x264 (CPU)', 'NVENC (GPU)'], values: [19, 0] }], {
    x: 7.1, y: 2.3, w: 5.4, h: 3.4, barDir: 'col', chartColors: [HEX.accent2, HEX.accent1],
    showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0"%"', dataLabelColor: HEX.lt1, dataLabelFontSize: 14, dataLabelFontFace: '+mn-lt',
    catAxisLabelColor: HEX.lt2, catAxisLabelFontSize: 14, catAxisLabelFontFace: '+mn-lt', valAxisHidden: true, valAxisMaxVal: 25, valAxisMinVal: 0,
    valGridLine: { style: 'none' }, catGridLine: { style: 'none' }, showLegend: false, barGapWidthPct: 80, objectName: 'Encoder chart',
  });
  text(s, 'Same camera, 1280×720 30 fps, 1.5 Mbps CBR', { x: 7.2, y: 5.85, w: 5.2, h: 0.6, fontSize: 12, color: C.background2 });
  s.addNotes('Left: the lecture says RTMP to HLS usually adds three to five seconds. With one-second segments and 200-millisecond parts we reach about two seconds on the public site. WebRTC is much faster in our local test, which is why the phone upload uses WebRTC. Right: with the CPU encoder x264 our host PC skipped about nineteen percent of frames. Switching OBS to the NVIDIA hardware encoder brought skipped frames to zero at the same quality.');

  // 8 · Final platform screenshot ------------------------------------------
  pres.addSection({ title: 'Final Platform Screenshot' });
  s = pres.addSlide({ masterName: 'G9 Content', sectionTitle: 'Final Platform Screenshot' });
  s.addText('Final platform screenshot', { placeholder: 'title' });
  card(s, 0.6, 1.5, 8.6, 5.15, 'Screenshot card');
  s.addImage({ path: path.join(IMG, 'dual-live.jpg'), x: 0.85, y: 1.75, w: 8.1, h: 3.62, altText: 'Public Group 9 website with both slots live', objectName: 'Platform screenshot' });
  text(s, [{ text: 'Slot 1 ', options: { bold: true, color: HEX.accent1 } }, { text: 'host PC via OBS (RTMPS)    ', options: { color: HEX.lt2 } }, { text: 'Slot 2 ', options: { bold: true, color: HEX.accent4 } }, { text: 'browser via WebRTC (WHIP)', options: { color: HEX.lt2 } }], { x: 0.85, y: 5.6, w: 8.1, h: 0.4, fontSize: 15 });
  text(s, 'group9liveb11302133.japaneast.cloudapp.azure.com/group9/', { x: 0.85, y: 6.05, w: 8.1, h: 0.35, fontSize: 13, color: C.accent5 });
  placeholderFrame(s, 9.55, 1.5, 3.15, 5.15, 'Phone screenshot', 'Paste the phone view here (slot 2 live)', 'Phone screenshot placeholder');
  s.addNotes('This is our public website with both slots live: on the left the host PC streams through OBS, on the right a browser source streams through WebRTC. On the right we will add a screenshot from the phone. The chat panel, gifts and account area are below and beside the players.');

  // 9 · Phone broadcasting --------------------------------------------------
  s = pres.addSlide({ masterName: 'G9 Content', sectionTitle: 'Final Platform Screenshot' });
  s.addText('Teacher requirement: join the stream from a phone', { placeholder: 'title' });
  const steps = [
    ['1', 'Open the site', 'Phone browser, HTTPS link or QR code', fa.FaQrcode],
    ['2', 'Log in and join', 'Press "Join the second stream"', fa.FaRightToBracket],
    ['3', 'Start broadcast', 'Pick front or rear camera, allow access', fa.FaVideo],
    ['4', 'Slot 2 is LIVE', 'Everyone sees the phone next to OBS', fa.FaTowerBroadcast],
  ];
  for (let i = 0; i < steps.length; i++) {
    const x = 0.6 + i * 3.1;
    card(s, x, 1.55, 2.75, 2.6, 'Step ' + steps[i][0]);
    await dotIcon(s, steps[i][3], x + 0.25, 1.8, 0.7, i === 3 ? HEX.accent2 : HEX.accent4, 'Step ' + steps[i][0]);
    text(s, steps[i][0], { x: x + 1.9, y: 1.8, w: 0.6, h: 0.6, fontSize: 26, bold: true, color: C.background2, align: 'right' });
    text(s, [{ text: steps[i][1], options: { bold: true, fontSize: 18, breakLine: true } }, { text: steps[i][2], options: { fontSize: 14, color: C.background2 } }], { x: x + 0.25, y: 2.7, w: 2.3, h: 1.3 });
    if (i < 3) arrow(s, x + 2.78, 2.85, 0.29, 0.01, HEX.lt2, 'Step arrow ' + (i + 1));
  }
  card(s, 0.6, 4.5, 12.1, 2.15, 'How it works card');
  await dotIcon(s, fa.FaShieldHalved, 0.85, 4.75, 0.75, HEX.accent1, 'Security');
  text(s, [
    { text: 'How it works', options: { bold: true, fontSize: 16, breakLine: true } },
    { text: 'The phone sends H.264 video and Opus audio with WebRTC (WHIP). The server checks that this user owns the slot, then adds the publish key itself, so the phone never sees a stream key.', options: { fontSize: 14, color: HEX.lt2, breakLine: true } },
    { text: 'MediaMTX turns the phone stream into HLS, so viewers watch it like an OBS stream. One source per slot: OBS and a phone cannot fight over slot 2.', options: { fontSize: 14, color: HEX.lt2 } },
  ], { x: 1.85, y: 4.7, w: 10.65, h: 1.8, paraSpaceAfter: 4 });
  s.addNotes('The teacher asked that a phone can join the live stream. Our solution needs no app. The phone opens the site, logs in, joins the second slot and presses start. The browser sends the camera with WebRTC. The server checks the login and adds the secret publish key on the server side, so the key never reaches the phone. We will show this in the demo video.');

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
  s.addNotes('Play the demo video (3 minutes 39 seconds; slow parts are sped up and marked with a speed tag). It shows: the site overview, joining by QR code, live chat between the phone and the computer, the six 3D gifts with sound and combos, the supporters board, AI voice messages with nine voices, the phone joining slot two over 4G with live captions, and the admin tools. Narration is English, subtitles are English and Chinese, and the original sound is never covered.');

  // 10a–10e · Features not shown in the demo video (screenshots) ---------------
  const SHOTS = path.join(IMG, 'shots');
  const fitImage = async (slide, file, x, y, w, h, alt) => {
    const meta = await sharp(path.join(SHOTS, file)).metadata();
    const scale = Math.min(w / meta.width, h / meta.height);
    const iw = meta.width * scale, ih = meta.height * scale;
    slide.addImage({ path: path.join(SHOTS, file), x: x + (w - iw) / 2, y: y + (h - ih) / 2, w: iw, h: ih, altText: alt, objectName: alt });
  };
  const notInVideo = (slide) => {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 10.05, y: 0.52, w: 2.65, h: 0.42, rectRadius: 0.21, fill: { color: C.text2 }, line: { color: C.accent4, width: 1 }, objectName: 'Screenshot tag' });
    text(slide, 'SCREENSHOT · NOT IN VIDEO', { x: 10.05, y: 0.52, w: 2.65, h: 0.42, fontSize: 10, bold: true, color: C.accent4, align: 'center', valign: 'middle', charSpacing: 1 });
  };
  // Two screenshots side by side, each with a caption, and a bullet strip underneath.
  const shotSlide = async (title, left, right, bullets, notes) => {
    const sl = pres.addSlide({ masterName: 'G9 Content', sectionTitle: 'More Features' });
    sl.addText(title, { placeholder: 'title' });
    notInVideo(sl);
    for (const [i, shot] of [left, right].entries()) {
      const x = 0.6 + i * 6.15, w = shot.w || 5.95;
      card(sl, x, 1.4, w, 3.95, 'Shot card ' + (i + 1));
      await fitImage(sl, shot.file, x + 0.15, 1.55, w - 0.3, 3.2, shot.alt);
      text(sl, shot.caption, { x: x + 0.2, y: 4.85, w: w - 0.4, h: 0.4, fontSize: 13, color: C.background2, align: 'center' });
    }
    card(sl, 0.6, 5.55, 12.1, 1.3, 'Explanation card');
    text(sl, bullets.map((b, i) => ({ text: b, options: { bullet: true, breakLine: i < bullets.length - 1 } })), { x: 0.85, y: 5.65, w: 11.6, h: 1.1, fontSize: 13, color: C.background1, paraSpaceAfter: 3, valign: 'middle' });
    sl.addNotes(notes);
    return sl;
  };
  pres.addSection({ title: 'More Features' });
  await shotSlide('Voice messages read by AI voices',
    { file: 'voice-form.png', alt: 'Voice message form with the voice picker', caption: 'Viewer picks 1 of 9 Azure neural voices and can preview it' },
    { file: 'voice-overlay.png', alt: 'Voice message on screen with the stop button', caption: 'Message card on the stream · broadcaster can press "Stop reading"' },
    ['For 25 points a viewer sends a message (max 120 characters) that is read aloud on the stream; normal chat is never read aloud.',
      'The server synthesizes the MP3 once with Azure AI Speech (free F0 tier, SSML styles such as excited or sports commentary); every viewer hears the same audio and the key never leaves the VM.',
      'Broadcasters and admins can stop a message for everyone at once.'],
    'This feature was not in the video, so here are screenshots. Viewers can spend twenty-five points on a voice message. They choose one of nine Azure neural voices and can preview it. The server creates the audio once, so everybody hears the same natural voice, and the Azure key stays on our server. If a message is unwanted, the broadcaster presses Stop reading and it stops for every viewer.');
  await shotSlide('Browser broadcasting: one-click layouts',
    { file: 'layout-panel.png', alt: 'Broadcaster panel with camera, screen plus camera and screen buttons', caption: 'Broadcaster panel: Camera · Screen + camera · Screen, and a mic button' },
    { file: 'layout-both-viewer.png', alt: 'Viewer sees the screen with the camera in the corner', caption: 'What viewers see in slot 2 (test pictures: blue = screen, red = camera)' },
    ['A PC broadcaster can stream from the web page without OBS and switch between camera only, screen + camera (picture-in-picture) and screen only while live.',
      'The browser composes a fixed 1280×720 picture, so switching never reconnects or changes the resolution; only the sources in use are opened.',
      'The microphone can be muted and unmuted in one click; phones get the same mic button.'],
    'Also not in the video: broadcasting from a computer browser. The broadcaster switches between camera, screen plus camera, and screen with one click. The browser draws everything into one 1280 by 720 picture before sending it with WebRTC, so the stream does not reconnect when the layout changes. The right picture is what viewers see; the blue and red frames are test pictures standing in for slides and a webcam.');
  await shotSlide('Reliability: leave slot, auto-reconnect',
    { file: 'slot2-joined.png', alt: 'Second slot countdown and leave button', caption: 'Idle countdown and the "Leave the second slot" button' },
    { file: 'reconnecting.png', alt: 'Broadcast panel reconnecting automatically', caption: 'Network lost → reconnecting automatically (1/12)' },
    ['Whoever takes slot 2 can leave at once; if nobody streams for 3 minutes, the server frees the slot automatically (never during a media-server outage).',
      'If the phone or PC loses its connection (Wi-Fi ↔ 4G, weak signal), the page republishes the same camera and mic by itself, waiting 1, 2, 4, 8 then 15 s, up to 12 times.',
      'When the device is back online it retries immediately, so the broadcaster does not have to press Start again.'],
    'Two reliability features that are hard to show in a short video. First, the second slot cannot be blocked: the broadcaster can leave with one click, and an idle slot is released after three minutes. Second, when a phone switches between Wi-Fi and 4G, the broadcast reconnects by itself with back-off, and immediately when the network returns.');
  await shotSlide('Admin tools: moderation and health',
    { file: 'admin-moderation.png', alt: 'Chat moderation panel', caption: 'Pinned notice, slow mode, banned words, mutes and reports' },
    { file: 'admin-health.png', alt: 'Stream health panel', caption: 'Live health of both slots, refreshed every 3 seconds' },
    ['Admins set the pinned announcement, slow mode, voice-message interval and banned words; they handle reports, delete messages and mute users, and every action is written to an audit log.',
      'The health panel shows each slot\'s source (OBS RTMPS or browser WebRTC), upload bitrate, data received, tracks, readers and uptime, plus VM memory and CPU load.',
      'It warns in plain words: picture may be frozen, low bitrate, or no audio track. (Screenshots from our local test copy with demo data.)'],
    'These are the admin tools. On the left, chat moderation: announcement, slow mode, banned words, reports, mutes and deletions, all audited. On the right, the stream health panel, which we added after a real problem: when the picture stuttered, we wanted to see the bitrate of each slot immediately. It refreshes every three seconds and warns in plain language. These two screenshots come from our local test copy with demo data.');
  await shotSlide('Session stats, ledger and English UI',
    { file: 'admin-restart.png', alt: 'Session statistics with the previous session', caption: 'Session stats · "End session & start a new one" keeps the previous summary' },
    { file: 'ledger.png', alt: 'Points ledger of a viewer', caption: 'Each viewer\'s points ledger with transaction IDs' },
    ['Hosts see duration, peak connections, likes, chat messages, gifts, points, supporters and voice messages; ending a session resets the leaderboard and keeps the previous summary.',
      'Every gift is a SQLite transaction with a unique request ID, so a retried request is never charged twice; viewers see their own ledger, admins see everything.',
      'The whole interface switches between Chinese and English with one click (top bar).'],
    'Finally, session statistics and the ledger. The host sees the numbers of the current show and can end it and start a new one; the previous summary stays on screen, which gave us the figures for our results. Every gift is a database transaction with a unique request ID, so nobody is charged twice. And the whole interface can switch to English.');

  // 10f · English UI, mic mute, donation switch -------------------------------
  {
    const sl = pres.addSlide({ masterName: 'G9 Content', sectionTitle: 'More Features' });
    sl.addText('English UI, mic button, donation switch', { placeholder: 'title' });
    notInVideo(sl);
    card(sl, 0.6, 1.4, 7.35, 5.45, 'English UI card');
    await fitImage(sl, 'site-en.png', 0.75, 1.55, 7.05, 4.55, 'Whole site in English');
    text(sl, 'One click on 中文 / English switches every label, button and message', { x: 0.8, y: 6.2, w: 6.95, h: 0.5, fontSize: 13, color: C.background2, align: 'center' });
    card(sl, 8.2, 1.4, 4.5, 2.95, 'Mic card');
    await fitImage(sl, 'mic-muted.png', 8.3, 1.5, 4.3, 2.25, 'Broadcast panel with the microphone muted');
    text(sl, 'Mic muted in one click (the stream keeps going)', { x: 8.3, y: 3.8, w: 4.3, h: 0.45, fontSize: 12, color: C.background2, align: 'center' });
    card(sl, 8.2, 4.55, 4.5, 2.3, 'Donation switch card');
    await fitImage(sl, 'admin-donations.png', 8.3, 4.65, 4.3, 1.55, 'Admin donation switch');
    text(sl, 'Admins can turn gifts and voice messages off or on', { x: 8.3, y: 6.3, w: 4.3, h: 0.45, fontSize: 12, color: C.background2, align: 'center' });
    sl.addNotes('Three small features that do not appear in the video. The whole interface switches between Chinese and English with one click. A broadcaster can mute and unmute the microphone without stopping the stream. And an admin can turn donations off, for example during an exam demo, and on again.');
  }

  // 11 · Photos placeholder --------------------------------------------------
  s = pres.addSlide({ masterName: 'G9 Content', sectionTitle: 'Final Platform Screenshot' });
  s.addText('Our real setup', { placeholder: 'title' });
  placeholderFrame(s, 0.6, 1.5, 5.9, 5.15, 'Photo 1', 'Team photo or the two broadcasters', 'Photo placeholder 1');
  placeholderFrame(s, 6.8, 1.5, 5.9, 2.42, 'Photo 2', 'Host PC with OBS', 'Photo placeholder 2');
  placeholderFrame(s, 6.8, 4.23, 5.9, 2.42, 'Photo 3', 'Phone broadcasting to slot 2', 'Photo placeholder 3');
  s.addNotes('Photos of our real setup: the team, the host PC running OBS, and the phone broadcasting into slot two.');

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
  s.addNotes('We kept the split from our first presentation. Wang Yu-Cheng led the frontend and OBS side, Tsao Shao-Huai led the backend and cloud side, and we did GitHub integration, testing and rehearsals together. Please adjust the bullet points if the final split changed.');

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
  s.addNotes('Each lecture became part of the system. Azure taught us that with IaaS we own the ports and the bill. HTML, CSS and JavaScript became the React site. The API and database lecture became our accounts and the gift ledger. The socket lecture explains our TCP and UDP choices, and the RTMP lecture is our OBS ingest and HLS playback. From the AI agent lecture we learned to commit often, keep secrets out of the repo, and ask for evidence.');

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
  s.addNotes('Here are the main problems. When a broadcaster changed network, OBS could not connect because port 1936 only allows known IPs, so we check the IP first and add a rule. Two hosts with speakers caused echo, which we solved with an open-source echo canceller. HLS made the video later than the chat, so we tuned low-latency HLS. Phones only allow the camera on HTTPS. The CPU encoder skipped frames until we switched to the GPU encoder. And we learned the hard way to keep private keys out of GitHub.');

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
  s.addNotes('To summarize: we delivered a working cloud platform where OBS and phones can broadcast, with chat, accounts and gifts, all on Azure. Next we would add a TURN server for strict mobile networks, WebRTC playback for sub-second viewing, and recording. Thank you, we are happy to take questions.');

  await pres.writeFile({ fileName: OUT });
  if (!process.env.SKIP_THEME) { const { applyTheme } = require(APPLY_THEME); await applyTheme(OUT, THEME); }
  console.log('Wrote', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
