import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
const root = new URL('./', import.meta.url);
mkdirSync(new URL('runtime/', root), { recursive: true });
if (!existsSync(new URL('.env', root))) writeFileSync(new URL('.env', root),
  `OPENCODE_SERVER_PASSWORD=${randomBytes(32).toString('hex')}\n`, { mode: 0o600 });
console.log('Local ignored server password ready; no credentials printed.');
