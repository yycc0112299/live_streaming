// Renders speech.json (the English talk script, also used as speaker notes) to SPEECH_SCRIPT.md.
// Run: node gen-speech.js
const fs = require('fs');
const path = require('path');
const S = require('./speech.json');
const VIDEO = 219; // demo video 3:39, plays on the "Demo video" slide
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`;
const words = (t) => t.replace(/\[[^\]]*\]/g, '').split(/\s+/).filter(Boolean).length;
let clock = 0;
const talk = S.reduce((a, s) => a + s.seconds, 0);
const out = [
  '# Group 9 — English talk script (final report)',
  '',
  `總長約 ${mmss(talk + VIDEO)}：講話 ${mmss(talk)} + 影片 3:39。講者：Yu-Cheng = 王昱程，Shao-Huai = 曹少懷。`,
  '每頁的英文就是簡報的講者備註（PowerPoint 簡報者檢視看得到）。語速約每分鐘 130 字；慢慢講、句子短，比背得一字不差重要。',
  '',
  '| # | 投影片 | 講者 | 開始 | 長度 |',
  '|---|---|---|---|---|',
];
S.forEach((s, i) => {
  out.push(`| ${i + 1} | ${s.title} | ${s.speaker} | ${mmss(clock)} | ${s.seconds} s${s.title === 'Demo video' ? ' + 影片 3:39' : ''} |`);
  clock += s.seconds + (s.title === 'Demo video' ? VIDEO : 0);
});
out.push('', '---', '');
S.forEach((s, i) => {
  out.push(`## ${i + 1}. ${s.title} — ${s.speaker}（約 ${s.seconds} 秒，${words(s.en)} 字）`, '', `> 重點：${s.zh}`, '', s.en, '');
});
fs.writeFileSync(path.join(__dirname, 'SPEECH_SCRIPT.md'), out.join('\n'));
console.log('Wrote SPEECH_SCRIPT.md · talk', mmss(talk), '· total', mmss(talk + VIDEO));
