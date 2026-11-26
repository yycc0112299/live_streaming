// Reads the MediaMTX internal users that may publish each course path.
// Returns { live: 'user:pass', guest: 'user:pass' } for paths that have one.
export function publishCredentials(config) {
  const result = {};
  const blocks = String(config).split(/^\s*- user: /m).slice(1);
  for (const block of blocks) {
    const user = /^(\S+)/.exec(block)?.[1];
    const pass = /^\s*pass: (\S+)\s*$/m.exec(block)?.[1];
    if (!user || !pass || user === 'any') continue;
    for (const match of block.matchAll(/- action: publish\s*\n\s*path: (live|guest)\b/g)) result[match[1]] ??= `${user}:${pass}`;
  }
  return result;
}

export function addSecondOBS(config, secret) {
  if (!/^[a-f0-9]{64}$/.test(secret)) throw new Error('Invalid second OBS secret');
  if (/^  guest:$/m.test(config)) throw new Error('A guest path already exists; review it instead of overwriting.');
  if (!config.includes('  - user: any') || !config.includes('      - action: api') || !/^  live:$/m.test(config)) throw new Error('Expected the existing course MediaMTX template.');
  return config.replace('  - user: any', `  - user: guest_broadcaster\n    pass: ${secret}\n    permissions:\n      - action: publish\n        path: guest\n  - user: any`)
    .replace('      - action: api', '      - action: read\n        path: guest\n      - action: api')
    .trimEnd() + '\n  guest:\n    source: publisher\n    overridePublisher: false\n';
}
