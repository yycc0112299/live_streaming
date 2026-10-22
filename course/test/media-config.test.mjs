import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { addSecondOBS } from '../scripts/media-config.mjs';

test('second OBS gets a separate publishing identity and path without replacing the first', () => {
  const original = readFileSync(new URL('../deploy/mediamtx.yml', import.meta.url), 'utf8');
  const secret = 'a'.repeat(64); const config = addSecondOBS(original, secret);
  assert.match(config, /user: broadcaster\s+pass: REPLACE_WITH_RANDOM_SECRET/);
  assert.match(config, /user: guest_broadcaster\s+pass: a{64}\s+permissions:\s+- action: publish\s+path: guest/);
  assert.equal((config.match(/overridePublisher: false/g) || []).length, 2);
  assert.match(config, /- action: read\s+path: guest/);
  assert.throws(() => addSecondOBS(config, secret), /already exists/);
  assert.throws(() => addSecondOBS(original, 'bad'), /Invalid/);
});

test('configuration CLI preserves keys on rerun and isolates local/Docker credentials', () => {
  const root = mkdtempSync(join(tmpdir(), 'group9-media-'));
  try {
    mkdirSync(join(root, 'scripts')); mkdirSync(join(root, 'deploy'));
    for (const path of ['scripts/configure.mjs', 'scripts/media-config.mjs', 'deploy/mediamtx.yml']) copyFileSync(new URL('../' + path, import.meta.url), join(root, path));
    const run = (...args) => spawnSync(process.execPath, [join(root, 'scripts/configure.mjs'), ...args], { encoding: 'utf8' });
    assert.equal(run('--duo').status, 0);
    const primary = readFileSync(join(root, '.runtime/OBS-PRIVATE.txt'), 'utf8');
    const guest = readFileSync(join(root, '.runtime/OBS-GUEST-PRIVATE.txt'), 'utf8');
    const original = readFileSync(join(root, '.runtime/mediamtx.yml'), 'utf8');
    assert.equal(run('--duo', '--webrtc').status, 0);
    assert.equal(readFileSync(join(root, '.runtime/OBS-PRIVATE.txt'), 'utf8'), primary);
    assert.equal(readFileSync(join(root, '.runtime/OBS-GUEST-PRIVATE.txt'), 'utf8'), guest);
    assert.equal(readFileSync(join(root, '.runtime/mediamtx.yml'), 'utf8'), original);
    assert.equal(run('--docker', '--duo').status, 0);
    assert.equal(readFileSync(join(root, '.runtime/OBS-PRIVATE.txt'), 'utf8'), primary);
    assert.equal(readFileSync(join(root, '.runtime/OBS-GUEST-PRIVATE.txt'), 'utf8'), guest);
    assert.notEqual(readFileSync(join(root, '.runtime/OBS-GUEST-DOCKER-PRIVATE.txt'), 'utf8'), guest);
    renameSync(join(root, '.runtime/mediamtx.duo.yml'), join(root, '.runtime/saved-duo.yml'));
    assert.notEqual(run('--duo').status, 0, 'Never create a new key over an existing orphan credential file');
    assert.equal(readFileSync(join(root, '.runtime/OBS-GUEST-PRIVATE.txt'), 'utf8'), guest);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
