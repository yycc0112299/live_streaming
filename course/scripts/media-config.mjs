export function addSecondOBS(config, secret) {
  if (!/^[a-f0-9]{64}$/.test(secret)) throw new Error('Invalid second OBS secret');
  if (/^  guest:$/m.test(config)) throw new Error('A guest path already exists; review it instead of overwriting.');
  if (!config.includes('  - user: any') || !config.includes('      - action: api') || !/^  live:$/m.test(config)) throw new Error('Expected the existing course MediaMTX template.');
  return config.replace('  - user: any', `  - user: guest_broadcaster\n    pass: ${secret}\n    permissions:\n      - action: publish\n        path: guest\n  - user: any`)
    .replace('      - action: api', '      - action: read\n        path: guest\n      - action: api')
    .trimEnd() + '\n  guest:\n    source: publisher\n    overridePublisher: false\n';
}
