import { DatabaseSync } from 'node:sqlite';
import { GIFTS } from '../gifts.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../store.mjs';

test('SQLite reopen retains accounts, sessions, balanced ledger, chat deletion, mutes and moderation audit', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'group9-store-'));
  const path = join(dir, 'live.sqlite'); let store = openStore(path);
  try {
    const host = await store.register({ username: 'host', nickname: 'Host', password: 'a-long-test-password' });
    const viewer = await store.register({ username: 'viewer', nickname: 'Viewer', password: 'a-long-test-password' });
    store.db.prepare("UPDATE users SET role='host' WHERE id=?").run(host.id); host.role = 'host';
    const token = store.newSession(viewer.id); const broadcastId = store.start(host.id, 'viewer');
    const value = { amount: 10, requestId: crypto.randomUUID(), broadcastId };
    store.donate(viewer, value, broadcastId);
    const message = store.sendChat(viewer, 'persistent message');
    store.moderate(host, { action: 'delete', messageId: message.id });
    store.moderate(host, { action: 'mute', userId: viewer.id, minutes: 10 });
    store.moderate(host, { action: 'settings', announcement: 'persist this', slowSeconds: 5, words: ['testword'] });
    // A failing transaction must leave both balance and ledger unchanged.
    store.db.exec("CREATE TRIGGER fail_donation BEFORE INSERT ON donations BEGIN SELECT RAISE(ABORT,'forced failure'); END;");
    assert.throws(() => store.donate(viewer, { ...value, requestId: crypto.randomUUID() }, broadcastId), /forced failure/);
    store.db.exec('DROP TRIGGER fail_donation');
    store.close(); store = openStore(path);
    assert.equal(store.session(token).id, viewer.id);
    assert.equal(store.room().broadcastId, broadcastId); assert.equal(store.room().guest.userId, viewer.id);
    assert.equal((await store.login({ username: 'VIEWER', password: 'a-long-test-password' })).points, 990);
    assert.equal(store.ledger(host).received, 10); assert.equal(store.ledger(viewer).sent, 10);
    assert.equal(store.user(host.id).points + store.user(viewer.id).points + store.ledger(host).received, 2000);
    store.db.prepare("UPDATE users SET role='admin' WHERE id=?").run(host.id);
    const adminLedger = store.ledger(store.user(host.id));
    assert.equal(adminLedger.scope, 'all'); assert.equal(adminLedger.transactions.length, 1); assert.equal(adminLedger.reconciliation.balanced, true);
    assert.equal(store.history().length, 0); assert.equal(store.audit().length, 3);
    assert.equal(store.settings().announcement, 'persist this');
    assert.throws(() => store.sendChat(viewer, 'try after restart'), /禁言/);
    assert.equal(store.donate(viewer, value, broadcastId).duplicate, true);
    const row = store.db.prepare('SELECT password,salt FROM users WHERE id=?').get(viewer.id);
    assert.notEqual(row.password, 'a-long-test-password'); assert.equal(row.salt.length, 32);
    assert.notEqual(store.db.prepare('SELECT token FROM sessions').get().token, token);
    store.end(broadcastId);
    assert.throws(() => store.donate(viewer, { ...value, requestId: crypto.randomUUID() }, broadcastId), /結束/);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('ledger pages preserve privacy and do not skip old rows after a new donation', async () => {
  const store = openStore(':memory:');
  try {
    const make = (username) => store.register({ username, nickname: username, password: 'a-long-test-password' });
    const host = await make('host'); const sender = await make('sender'); const other = await make('other');
    store.db.prepare("UPDATE users SET role='host' WHERE id=?").run(host.id);
    const broadcastId = store.start(host.id, 'sender');
    const donate = (user) => store.donate(user, { amount: 1, requestId: crypto.randomUUID(), broadcastId }, broadcastId);
    for (let i = 0; i < 100; i++) donate(sender);
    for (let i = 0; i < 5; i++) donate(other);
    const first = store.ledger(host);
    assert.equal(first.transactions.length, 100); assert.ok(first.nextCursor);
    donate(other);
    const second = store.ledger(host, first.nextCursor);
    assert.equal(second.transactions.length, 5); assert.equal(second.nextCursor, null);
    assert.equal(new Set([...first.transactions, ...second.transactions].map((row) => row.id)).size, 105);
    assert.equal(second.received, 106);
    assert.equal(store.ledger(sender).transactions.length, 100);
    assert.equal(store.ledger(sender).nextCursor, null);
    assert.ok(store.ledger(other).transactions.every((row) => row.sender === 'other'));
    assert.equal(store.ledger(other, first.nextCursor).transactions.length, 0);
    for (const cursor of ['1', -1, 0, {}, 1.5]) assert.throws(() => store.ledger(sender, cursor));
    store.db.prepare("UPDATE users SET role='admin' WHERE id=?").run(other.id);
    assert.equal(store.ledger(store.user(other.id)).scope, 'all');
    assert.equal(store.ledger(store.user(other.id)).reconciliation.balanced, true);
  } finally { store.close(); }
});


test('legacy donation ledger migrates without losing receipts and accepts all six gift tiers', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'gift-migrate-')); const path = join(dir, 'live.sqlite');
  let store = openStore(path);
  try {
    const host = await store.register({ username: 'host', nickname: 'Host', password: 'a-long-test-password' });
    const viewer = store.guest(); const bid = store.start(host.id, viewer.username);
    const receipt = store.donate(viewer, { amount: 1, requestId: crypto.randomUUID(), broadcastId: bid }, bid);
    store.close();
    const db = new DatabaseSync(path);
    const schema = db.prepare("SELECT sql FROM sqlite_master WHERE name='donations'").get().sql;
    db.exec('ALTER TABLE donations RENAME TO old_donations');
    db.exec(schema.replace('1,5,10,25,50,100', '1,5,10'));
    db.exec('INSERT INTO donations SELECT * FROM old_donations; DROP TABLE old_donations'); db.close();
    store = openStore(path);
    assert.equal(store.ledger(host).transactions[0].id, receipt.id);
    for (const gift of GIFTS) {
      const sender = store.guest(); const value = { amount: gift.amount, requestId: crypto.randomUUID(), broadcastId: bid };
      assert.equal(store.donate(sender, value, bid).amount, gift.amount);
      assert.equal(store.donate(sender, value, bid).duplicate, true);
      assert.equal(store.user(sender.id).points, 1000 - gift.amount);
    }
    assert.equal(store.ledger(host).received, 192);
    assert.throws(() => store.donate(store.guest(), { amount: 101, requestId: crypto.randomUUID(), broadcastId: bid }, bid));
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('paid voice messages charge once, persist and enforce mute, words and text limits before debit', async () => {
  const store = openStore(':memory:');
  try {
    const host = store.guest(), sender = store.guest();
    store.db.prepare("UPDATE users SET role='host' WHERE id=?").run(host.id); host.role = 'host';
    const bid = store.start(host.id, sender.username);
    const value = { amount: 25, requestId: crypto.randomUUID(), broadcastId: bid, message: '想說的話' };
    const receipt = store.donate(sender, value, bid); assert.equal(receipt.message, value.message);
    assert.equal(store.user(sender.id).points, 975); assert.equal(store.donate(sender, value, bid).duplicate, true);
    assert.equal(store.ledger(sender).transactions[0].message, value.message);
    assert.throws(() => store.donate(sender, { ...value, requestId: crypto.randomUUID(), message: '再一句話' }, bid), /60 秒/);
    assert.throws(() => store.donate(sender, { ...value, message: '另一句話' }, bid), /請求 ID/);
    const invalid = (change) => ({ ...value, requestId: crypto.randomUUID(), ...change });
    assert.throws(() => store.donate(sender, invalid({ amount: 1 }), bid));
    assert.throws(() => store.donate(sender, invalid({ message: 'x'.repeat(121) }), bid));
    assert.throws(() => store.donate(sender, invalid({ message: {} }), bid));
    store.moderate(host, { action: 'settings', announcement: '', slowSeconds: 5, words: ['blocked'] });
    assert.throws(() => store.donate(sender, invalid({ message: 'BLOCKED' }), bid), /限制詞/);
    store.moderate(host, { action: 'mute', userId: sender.id, minutes: 10 });
    assert.throws(() => store.donate(sender, invalid({}), bid), /禁言/);
    assert.equal(store.user(sender.id).points, 975); assert.equal(store.ledger(host).received, 25);
  } finally { store.close(); }
});

