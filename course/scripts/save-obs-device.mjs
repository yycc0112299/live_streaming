import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const [site, token] = process.argv.slice(2);
const url = new URL(site);
if (url.protocol !== 'https:' || !/^[a-f0-9]{64}$/.test(token || '')) throw Error('需要 HTTPS 直播網址与 64 字元固定電腦憑證。');
const directory = resolve('.runtime');
await mkdir(directory, { recursive: true, mode: 0o700 });
await writeFile(resolve(directory, 'OBS-AUTO-DEVICE-PRIVATE.json'), JSON.stringify({ site: url.href, token }) + '\n', { mode: 0o600 });
console.log('固定電腦憑證已保存；請勿上傳或分享 .runtime 內容。');
