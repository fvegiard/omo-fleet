import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { runtimeConfig } from './runtime-config.mjs';
mkdirSync('/state/data/opencode', { recursive: true, mode: 0o700 });
const target = '/state/data/opencode/auth.json';
// Never overwrite refreshed container credentials on restart.
if (!existsSync(target)) {
  const source = JSON.parse(readFileSync('/run/credentials/codex.json', 'utf8'));
  const t = source.tokens;
  if (!t?.access_token || !t?.refresh_token) throw new Error('Codex OAuth credentials missing');
  const claims = JSON.parse(Buffer.from(t.access_token.split('.')[1], 'base64url'));
  writeFileSync(target, JSON.stringify({ openai: { type: 'oauth', access: t.access_token,
    refresh: t.refresh_token, expires: claims.exp * 1000, accountId: t.account_id } }), { mode: 0o600 });
}
const config = runtimeConfig(JSON.parse(readFileSync(`/run/fleet-config/${process.env.FLEET_ID}.json`,'utf8')));
mkdirSync('/state/config/opencode',{recursive:true});
writeFileSync('/state/config/opencode/opencode.json', JSON.stringify(config));
const child = spawn('opencode', ['serve', '--hostname', '0.0.0.0', '--port', '4096'], { stdio: 'inherit' });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 1));
