import { fileURLToPath } from 'node:url';
import { openStore } from '../store.mjs';

const [username, role] = process.argv.slice(2);
if (!username || !['viewer', 'host', 'admin'].includes(role)) {
  console.error('Usage: node scripts/account-role.mjs <existing-username> viewer|host|admin');
  process.exit(1);
}
const store = openStore(process.env.DB_PATH || fileURLToPath(new URL('../.runtime/live.sqlite', import.meta.url)));
try {
  const result = store.db.prepare('UPDATE users SET role=? WHERE username=?').run(role, username.toLowerCase());
  if (!result.changes) throw new Error('Account does not exist; register it in the app first.');
  store.db.prepare('DELETE FROM sessions WHERE user_id=(SELECT id FROM users WHERE username=?)').run(username.toLowerCase());
  console.log(`Updated ${username} to ${role}. Log out and back in before broadcasting.`);
} finally { store.close(); }
