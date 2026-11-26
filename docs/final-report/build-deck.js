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
    [fa.FaGift, HEX.accent2, 'Gifts and voice messages', 'Demo points ledger, no double charge'],
    [fa.FaLanguage, HEX.accent1, 'Bilingual and shareable', 'Chinese / English, share link and QR code'],
  ];
  for (let i = 0; i < feats.length; i++) {
    const [Ic, hex, t, d] = feats[i];
    const x = 0.6 + (i % 3) * 4.15; const y = 1.55 + Math.floor(i / 3) * 2.65;
    card(s, x, y, 3.8, 2.35, 'Feature ' + t);
    await dotIcon(s, Ic, x + 0.3, y + 0.3, 0.75, hex, t);
    text(s, [{ text: t, options: { bold: true, fontSize: 19, breakLine: true } }, { text: d, options: { fontSize: 14, color: C.background2 } }], { x: x + 0.3, y: y + 1.2, w: 3.2, h: 0.95 });
  }
  s.addNotes('Beyond the core video and chat, we added the features planned in our first presentation: viewer count, likes and gifts, plus moderation and accounts. The teacher asked that a phone can join the live stream, so a phone can now take slot two directly from the browser.');

  // 6 · Results: stat callouts ---------------------------------------------
  pres.addSection({ title: 'Results and Analysis' });
  s = pres.addSlide({ masterName: 'G9 Content', sectionTitle: 'Results and Analysis' });
  s.addText('Results: the platform works live on Azure', { placeholder: 'title' });
  const stats = [
    ['2 / 2', 'live slots on one page', 'Host OBS and a WebRTC source at the same time', C.accent1],
    ['≈ 2 s', 'website latency (HLS)', 'Camera to viewer screen on the public site', C.accent5],
    ['10 / 10', 'viewer tabs joined', 'Concurrent join test on the public site', C.accent3],
    ['31 / 31', 'automated tests passed', 'Chat, accounts, ledger, WHIP authorization', C.accent4],
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
  s.addNotes('These numbers come from the real Azure site. Both slots were live at the same time. Viewers see the stream about two seconds after the camera. Ten browser tabs joined at once without failure, and all thirty-one automated tests pass. Following the W10 advice, we only claim what we verified: for example, ten viewers is our tested capacity, not a guess.');

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
  placeholderFrame(s, 2.0, 1.45, 9.33, 5.25, 'Insert demo video here (16:9)', 'PowerPoint: Insert > Video > This Device, then resize to fill this frame', 'Demo video placeholder');
  s.addImage({ data: await icon(fa.FaCirclePlay, HEX.accent2), x: 6.17, y: 2.35, w: 1.0, h: 1.0, objectName: 'Play icon', altText: 'Video placeholder' });
  s.addNotes('Play the recorded demo: host OBS goes live, the phone joins slot two, viewers chat and send a gift. Keep it under two minutes.');

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
  const nextItems = ['Delivered: OBS + phone broadcasting, chat, accounts and gifts on Azure', 'Measured: about 2 s latency, 10/10 viewers, 31/31 tests', 'Next: TURN server for strict mobile networks', 'Next: WebRTC playback for sub-second viewing', 'Next: recording and replay'];
  text(s, nextItems.map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < nextItems.length - 1 } })), { x: 7.65, y: 2.35, w: 4.85, h: 3.6, fontSize: 15, paraSpaceAfter: 8 });
  text(s, 'github.com/yycc0112299/live_streaming', { x: 0.6, y: 5.3, w: 6.3, h: 0.4, fontSize: 14, color: C.background2 });
  s.addNotes('To summarize: we delivered a working cloud platform where OBS and phones can broadcast, with chat, accounts and gifts, all on Azure. Next we would add a TURN server for strict mobile networks, WebRTC playback for sub-second viewing, and recording. Thank you, we are happy to take questions.');

  await pres.writeFile({ fileName: OUT });
  if (!process.env.SKIP_THEME) { const { applyTheme } = require(APPLY_THEME); await applyTheme(OUT, THEME); }
  console.log('Wrote', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
