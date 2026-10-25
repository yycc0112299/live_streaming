import { GIFTS, VOICE_MESSAGE_POINTS } from './gifts.mjs';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID, randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const passwordOptions = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
export const INITIAL_POINTS = 1000;
export function checkText(value, max, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\p{Cc}\p{Cf}]/u.test(value)) throw new Error(`${label}需為 1–${max} 個字，不能包含控制字元。`);
  return value.trim();
}

export function openStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ':memory:') chmodSync(path, 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, nickname TEXT NOT NULL, password TEXT NOT NULL, salt TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('viewer','host','admin')), points INTEGER NOT NULL DEFAULT 1000 CHECK(points>=0), created_at TEXT NOT NULL, trusted_second INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS broadcasts(id TEXT PRIMARY KEY, host_id TEXT NOT NULL REFERENCES users(id), guest_id TEXT REFERENCES users(id), started_at TEXT NOT NULL, ended_at TEXT);
    CREATE TABLE IF NOT EXISTS donations(id TEXT PRIMARY KEY, sender_id TEXT NOT NULL REFERENCES users(id), recipient_id TEXT NOT NULL REFERENCES users(id), broadcast_id TEXT NOT NULL REFERENCES broadcasts(id), amount INTEGER NOT NULL CHECK(amount IN (1,5,10,25,50,100)), request_id TEXT NOT NULL, created_at TEXT NOT NULL, message TEXT NOT NULL DEFAULT '', UNIQUE(sender_id,request_id), CHECK(sender_id<>recipient_id));
    CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), nickname TEXT NOT NULL, text TEXT NOT NULL, at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1), announcement TEXT NOT NULL DEFAULT '', slow_seconds INTEGER NOT NULL DEFAULT 1, voice_cooldown_seconds INTEGER NOT NULL DEFAULT 60, words TEXT NOT NULL DEFAULT '[]', donations_enabled INTEGER NOT NULL DEFAULT 1);
    INSERT OR IGNORE INTO settings(id) VALUES(1);
    CREATE TABLE IF NOT EXISTS mutes(user_id TEXT PRIMARY KEY REFERENCES users(id), until_ms INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY, message_id TEXT NOT NULL REFERENCES messages(id), reporter_id TEXT NOT NULL REFERENCES users(id), reason TEXT NOT NULL, created_at TEXT NOT NULL, resolved INTEGER NOT NULL DEFAULT 0, UNIQUE(message_id,reporter_id));
    CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, details TEXT NOT NULL, at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS obs_devices(token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS app_migrations(name TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS messages_time ON messages(at);
    CREATE INDEX IF NOT EXISTS messages_user ON messages(user_id);
    CREATE INDEX IF NOT EXISTS donations_recipient ON donations(recipient_id,created_at);
    CREATE INDEX IF NOT EXISTS donations_broadcast ON donations(broadcast_id);`);
  if (!db.prepare("SELECT 1 FROM app_migrations WHERE name='test-points-1000'").get()) {
    db.exec(`BEGIN IMMEDIATE; UPDATE users SET points=points+900; INSERT INTO app_migrations VALUES('test-points-1000',datetime('now')); COMMIT`);
  }
  const donationSchema = db.prepare("SELECT sql FROM sqlite_master WHERE name='donations'").get().sql;
  if (donationSchema.includes('CHECK(amount IN (1,5,10))')) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec('ALTER TABLE donations RENAME TO donations_legacy');
      db.exec(donationSchema.replace('CHECK(amount IN (1,5,10))', 'CHECK(amount IN (1,5,10,25,50,100))'));
      db.exec('INSERT INTO donations SELECT * FROM donations_legacy; DROP TABLE donations_legacy; CREATE INDEX donations_recipient ON donations(recipient_id,created_at); CREATE INDEX donations_broadcast ON donations(broadcast_id); COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  if (!db.prepare('PRAGMA table_info(donations)').all().some((column) => column.name === 'message')) db.exec("ALTER TABLE donations ADD COLUMN message TEXT NOT NULL DEFAULT ''");
  if (!db.prepare('PRAGMA table_info(broadcasts)').all().some((column) => column.name === 'guest_id')) db.exec('ALTER TABLE broadcasts ADD COLUMN guest_id TEXT REFERENCES users(id)');
  if (!db.prepare('PRAGMA table_info(users)').all().some((column) => column.name === 'trusted_second')) db.exec('ALTER TABLE users ADD COLUMN trusted_second INTEGER NOT NULL DEFAULT 0');
  if (!db.prepare('PRAGMA table_info(settings)').all().some((column) => column.name === 'voice_cooldown_seconds')) db.exec('ALTER TABLE settings ADD COLUMN voice_cooldown_seconds INTEGER NOT NULL DEFAULT 60');
  if (!db.prepare('PRAGMA table_info(settings)').all().some((column) => column.name === 'donations_enabled')) db.exec('ALTER TABLE settings ADD COLUMN donations_enabled INTEGER NOT NULL DEFAULT 1');
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const transaction = (fn) => {
    db.exec('BEGIN IMMEDIATE');
    try { const value = fn(); db.exec('COMMIT'); return value; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  function user(id) { return get("SELECT id,username,nickname,role,points,(password='') AS isGuest,trusted_second AS trustedSecond FROM users WHERE id=?", id); }
  function session(token) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
    const row = get('SELECT user_id FROM sessions WHERE token=? AND expires>?', hash(token), Date.now());
    return row ? user(row.user_id) : null;
  }
  function guest() {
    const id = randomUUID();
    run('INSERT INTO users(id,username,nickname,password,salt,points,created_at) VALUES(?,?,?,?,?,?,?)', id, `visitor-${randomBytes(8).toString('hex')}`, `訪客${id.slice(0, 6)}`, '', '', INITIAL_POINTS, new Date().toISOString());
    return user(id);
  }
  async function register({ username, password, nickname } = {}) {
    if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,24}$/.test(username)) throw new Error('帳號需為 3–24 個英文字母、數字或底線。');
    if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw new Error('密碼需為 12–128 個字。');
    const clean = checkText(nickname, 24, '暱稱');
    const salt = randomBytes(16).toString('hex');
    const key = await derive(password, salt, 64, passwordOptions);
    const id = randomUUID();
    try { run('INSERT INTO users(id,username,nickname,password,salt,points,created_at) VALUES(?,?,?,?,?,?,?)', id, username.toLowerCase(), clean, key.toString('hex'), salt, INITIAL_POINTS, new Date().toISOString()); }
    catch (error) { if (error.message.includes('UNIQUE')) throw new Error('帳號已存在。'); throw error; }
    return user(id);
  }
  async function login({ username, password } = {}) {
    if (typeof username !== 'string' || typeof password !== 'string' || password.length > 128) throw new Error('帳號或密碼錯誤。');
    const row = get("SELECT * FROM users WHERE username=? AND password<>''", username.toLowerCase());
    const key = await derive(password, row?.salt || 'missing-user-salt', 64, passwordOptions);
    if (!row || !timingSafeEqual(key, Buffer.from(row.password, 'hex'))) throw new Error('帳號或密碼錯誤。');
    return user(row.id);
  }
  function newSession(id) {
    run('DELETE FROM sessions WHERE expires<=?', Date.now());
    const token = randomBytes(32).toString('hex');
    run('INSERT INTO sessions VALUES(?,?,?)', hash(token), id, Date.now() + 7 * 86400000);
    return token;
  }
  function newOBSDevice(id) {
    const token = randomBytes(32).toString('hex');
    run('DELETE FROM obs_devices WHERE user_id=?', id);
    run('INSERT INTO obs_devices VALUES(?,?,?)', hash(token), id, new Date().toISOString());
    return token;
  }
  function obsDevice(token) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
    const row = get('SELECT user_id FROM obs_devices WHERE token=?', hash(token));
    return row ? user(row.user_id) : null;
  }
  function settings() { const row = get('SELECT * FROM settings WHERE id=1'); return { announcement: row.announcement, slowSeconds: Math.max(5, row.slow_seconds), voiceCooldownSeconds: Math.max(0, Math.min(3600, row.voice_cooldown_seconds)), donationsEnabled: Boolean(row.donations_enabled), words: JSON.parse(row.words) }; }
  function history() { return all('SELECT id,user_id AS userId,nickname,text,at FROM (SELECT rowid AS sequence,* FROM messages WHERE deleted=0 ORDER BY rowid DESC LIMIT 100) ORDER BY sequence'); }
  function audit(actor, action, details) { run('INSERT INTO audit VALUES(?,?,?,?,?)', randomUUID(), actor, action, JSON.stringify(details), new Date().toISOString()); }
  function sendChat(account, text) {
    const clean = checkText(text, 500, '訊息');
    const config = settings();
    if ((get('SELECT until_ms FROM mutes WHERE user_id=?', account.id)?.until_ms || 0) > Date.now()) throw new Error('目前已被禁言。');
    if (config.words.some((word) => clean.toLocaleLowerCase().includes(word.toLocaleLowerCase()))) throw new Error('訊息包含聊天室限制詞。');
    const previous = get('SELECT at FROM messages WHERE user_id=? ORDER BY rowid DESC LIMIT 1', account.id);
    if (previous && Date.now() - Date.parse(previous.at) < config.slowSeconds * 1000) throw new Error(`訊息傳送太快，請稍候 ${config.slowSeconds} 秒。`);
    const message = { id: randomUUID(), userId: account.id, nickname: account.nickname, text: clean, at: new Date().toISOString() };
    run('INSERT INTO messages(id,user_id,nickname,text,at) VALUES(?,?,?,?,?)', message.id, message.userId, message.nickname, message.text, message.at);
    return message;
  }
  function moderate(actor, value) {
    if (!['host', 'admin'].includes(actor.role)) throw new Error('需要聊天室管理權限。');
    return transaction(() => {
      const { action } = value || {};
      if (action === 'settings') {
        const { announcement, slowSeconds, voiceCooldownSeconds, words } = value;
        if (typeof announcement !== 'string' || announcement.length > 300 || /[\p{Cc}\p{Cf}]/u.test(announcement) || !Number.isInteger(slowSeconds) || slowSeconds < 5 || slowSeconds > 120 || !Number.isInteger(voiceCooldownSeconds) || voiceCooldownSeconds < 0 || voiceCooldownSeconds > 3600 || !Array.isArray(words) || words.length > 50) throw new Error('公告、聊天室間隔、語音留言間隔或限制詞格式錯誤。');
        const cleanWords = words.map((word) => checkText(word, 40, '限制詞'));
        run('UPDATE settings SET announcement=?,slow_seconds=?,voice_cooldown_seconds=?,words=? WHERE id=1', announcement, slowSeconds, voiceCooldownSeconds, JSON.stringify(cleanWords));
      } else if (action === 'delete') {
        if (typeof value.messageId !== 'string' || !run('UPDATE messages SET deleted=1 WHERE id=? AND deleted=0', value.messageId).changes) throw new Error('找不到訊息。');
      } else if (action === 'mute') {
        const target = typeof value.userId === 'string' && user(value.userId);
        if (!target || target.role !== 'viewer' || !Number.isInteger(value.minutes) || value.minutes < 0 || value.minutes > 1440) throw new Error('禁言對象或時間無效。');
        run('INSERT INTO mutes VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET until_ms=excluded.until_ms', target.id, Date.now() + value.minutes * 60000);
      } else if (action === 'resolve') {
        if (typeof value.reportId !== 'string' || !run('UPDATE reports SET resolved=1 WHERE id=?', value.reportId).changes) throw new Error('找不到檢舉。');
      } else throw new Error('未知管理操作。');
      audit(actor.id, action, value);
      return settings();
    });
  }
  function report(actor, { messageId, reason } = {}) {
    if (typeof messageId !== 'string' || !get('SELECT id FROM messages WHERE id=?', messageId)) throw new Error('找不到訊息。');
    const text = checkText(reason, 200, '檢舉原因');
    const count = get('SELECT count(*) AS n FROM reports WHERE reporter_id=? AND created_at>?', actor.id, new Date(Date.now() - 3600000).toISOString()).n;
    if (count >= 10) throw new Error('每小時最多檢舉 10 次。');
    run('INSERT OR IGNORE INTO reports(id,message_id,reporter_id,reason,created_at) VALUES(?,?,?,?,?)', randomUUID(), messageId, actor.id, text, new Date().toISOString());
  }
  function donate(sender, { amount, requestId, broadcastId, message = '' } = {}, activeBroadcast) {
    if (!GIFTS.some((gift) => gift.amount === amount) || typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(requestId) || typeof broadcastId !== 'string') throw new Error('應援金額或請求 ID 無效。');
    if (typeof message !== 'string') throw new Error('語音留言格式錯誤。');
    const speech = message ? checkText(message, 120, '語音留言') : '';
    if (speech && amount !== VOICE_MESSAGE_POINTS) throw new Error(`語音留言需花費 ${VOICE_MESSAGE_POINTS} 示範點數。`);
    return transaction(() => {
      const old = get('SELECT * FROM donations WHERE sender_id=? AND request_id=?', sender.id, requestId);
      if (old) {
        if (old.amount !== amount || old.broadcast_id !== broadcastId || old.message !== speech) throw new Error('請求 ID 已被其他交易使用。');
        return { ...old, duplicate: true };
      }
      if (speech) {
        if (get('SELECT until_ms FROM mutes WHERE user_id=?', sender.id)?.until_ms > Date.now()) throw new Error('禁言期間不能使用語音留言。');
        if (settings().words.some((word) => speech.toLowerCase().includes(word.toLowerCase()))) throw new Error('語音留言含有聊天室限制詞。');
        const previousSpeech = get("SELECT created_at FROM donations WHERE sender_id=? AND message<>'' ORDER BY rowid DESC LIMIT 1", sender.id);
        const cooldown = settings().voiceCooldownSeconds;
        if (previousSpeech && Date.now() - Date.parse(previousSpeech.created_at) < cooldown * 1000) throw new Error(`語音留言傳送太快，請稍候 ${cooldown} 秒。`);
      }
      const room = get('SELECT * FROM broadcasts WHERE id=? AND ended_at IS NULL', broadcastId);
      if (!room || broadcastId !== activeBroadcast) throw new Error('本場直播已結束，請重新確認。');
      if (room.host_id === sender.id) throw new Error('不能應援自己。');
      if (!run('UPDATE users SET points=points-? WHERE id=? AND points>=?', amount, sender.id, amount).changes) throw new Error('應援點數不足。');
      const id = randomUUID();
      run('INSERT INTO donations(id,sender_id,recipient_id,broadcast_id,amount,request_id,created_at,message) VALUES(?,?,?,?,?,?,?,?)', id, sender.id, room.host_id, broadcastId, amount, requestId, new Date().toISOString(), speech);
      return get('SELECT * FROM donations WHERE id=?', id);
    });
  }
  function ledger(actor, before = null) {
    if (before !== null && (!Number.isSafeInteger(before) || before < 1)) throw new Error('無效的帳本分頁');
    const select = 'SELECT d.rowid AS cursor,d.id,d.amount,d.request_id AS requestId,d.broadcast_id AS broadcastId,d.created_at AS at,d.message,s.username AS sender,r.username AS recipient FROM donations d JOIN users s ON s.id=d.sender_id JOIN users r ON r.id=d.recipient_id';
    const rows = actor.role === 'admin' ? all(`${select} WHERE d.rowid<? ORDER BY d.rowid DESC LIMIT 101`, before ?? Number.MAX_SAFE_INTEGER) : all(`${select} WHERE (d.sender_id=? OR d.recipient_id=?) AND d.rowid<? ORDER BY d.rowid DESC LIMIT 101`, actor.id, actor.id, before ?? Number.MAX_SAFE_INTEGER);
    const nextCursor = rows.length > 100 ? rows[99].cursor : null;
    rows.splice(100);
    const totals = get('SELECT COALESCE(SUM(CASE WHEN sender_id=? THEN amount ELSE 0 END),0) AS sent,COALESCE(SUM(CASE WHEN recipient_id=? THEN amount ELSE 0 END),0) AS received FROM donations', actor.id, actor.id);
    const reconciliation = actor.role === 'admin' ? get(`SELECT (SELECT COUNT(*)*${INITIAL_POINTS} FROM users) AS granted,(SELECT COALESCE(SUM(points),0) FROM users) AS wallets,(SELECT COALESCE(SUM(amount),0) FROM donations) AS income`) : undefined;
    return { transactions: rows, nextCursor, scope: actor.role === 'admin' ? 'all' : 'own', ...totals, points: user(actor.id).points, ...(reconciliation ? { reconciliation: { ...reconciliation, balanced: reconciliation.granted === reconciliation.wallets + reconciliation.income } } : {}) };
  }
  function room() {
    const row = get('SELECT * FROM broadcasts WHERE ended_at IS NULL ORDER BY rowid DESC LIMIT 1');
    return { donationsEnabled: Boolean(settings().donationsEnabled), ...(row ? { broadcastId: row.id, host: { userId: row.host_id, nickname: user(row.host_id).nickname, path: 'live' }, guest: row.guest_id ? { userId: row.guest_id, nickname: user(row.guest_id).nickname, path: 'guest' } : null } : { broadcastId: null, host: null, guest: null }) };
  }
  return { db, user, guest, register, login, session, newSession, newOBSDevice, obsDevice, settings, history, sendChat, moderate, report, donate, ledger, room,
    authorizeHost: (id) => { if (!run("UPDATE users SET role='host',trusted_second=1 WHERE id=? AND role IN ('viewer','host')", id).changes) throw new Error('找不到可授權的第二位主播。'); return user(id); },
    logout: (token) => run('DELETE FROM sessions WHERE token=?', hash(token || '')),
    rename: (id, name) => { const nickname = checkText(name, 24, '暱稱'); run('UPDATE users SET nickname=? WHERE id=?', nickname, id); return nickname; },
    start: (id, guestUsername) => transaction(() => {
      const active = room();
      const guest = guestUsername ? get('SELECT id FROM users WHERE username=?', guestUsername.toLowerCase()) : null;
      if (guestUsername && (!guest || guest.id === id)) throw new Error('第二位參與者帳號無效。');
      if (active.host) {
        if (active.host.userId !== id || active.guest || !guest) throw new Error('直播間已開啟，請先結束上一場。');
        run('UPDATE broadcasts SET guest_id=? WHERE id=?', guest.id, active.broadcastId); return active.broadcastId;
      }
      const bid = randomUUID(); run('INSERT INTO broadcasts(id,host_id,guest_id,started_at) VALUES(?,?,?,?)', bid, id, guest?.id || null, new Date().toISOString()); run('UPDATE settings SET donations_enabled=1 WHERE id=1'); return bid;
    }),
    join: (id) => transaction(() => {
      const active = room();
      if (!active.host) throw new Error('第一位主播尚未登入直播網站。');
      if (active.host.userId === id) throw new Error('第一位主播不能加入第二路。');
      if (active.guest && active.guest.userId !== id) throw new Error('第二位主播位置已有人使用。');
      run('UPDATE broadcasts SET guest_id=? WHERE id=? AND guest_id IS NULL', id, active.broadcastId);
      return active.broadcastId;
    }),
    end: (id) => run('UPDATE broadcasts SET ended_at=? WHERE id=? AND ended_at IS NULL', new Date().toISOString(), id),
    setDonationsEnabled: (enabled) => { run('UPDATE settings SET donations_enabled=? WHERE id=1', enabled ? 1 : 0); return Boolean(enabled); },
    supportTotal: (id) => id ? get('SELECT COALESCE(SUM(amount),0) AS n FROM donations WHERE broadcast_id=?', id).n : 0,
    reports: () => all('SELECT r.id,r.reason,r.created_at AS at,m.id AS messageId,m.text,m.nickname,m.user_id AS userId FROM reports r JOIN messages m ON m.id=r.message_id WHERE r.resolved=0 ORDER BY r.rowid DESC LIMIT 100'),
    mutes: () => all('SELECT m.user_id AS userId,u.nickname,m.until_ms AS untilMs FROM mutes m JOIN users u ON u.id=m.user_id WHERE m.until_ms>? ORDER BY m.until_ms DESC', Date.now()),
    audit: () => all('SELECT actor_id AS actorId,action,details,at FROM audit ORDER BY rowid DESC LIMIT 100'),
    close: () => db.close(),
  };
}
