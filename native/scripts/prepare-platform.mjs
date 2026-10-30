import { access } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildWeb, NATIVE_ROOT } from './build-web.mjs';
import { configurePlatform } from './configure-platform.mjs';

const platform = process.argv[2];
if (!['android', 'ios'].includes(platform)) throw new Error('Choose android or ios explicitly');

function capacitor(...args) {
  const command = path.join(NATIVE_ROOT, 'node_modules/@capacitor/cli/bin/capacitor');
  const result = spawnSync(process.execPath, [command, ...args], { cwd: NATIVE_ROOT, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Capacitor ${args.join(' ')} failed (${result.status})`);
}

await buildWeb();
let platformExists = true;
try { await access(path.join(NATIVE_ROOT, platform)); } catch { platformExists = false; }
if (!platformExists) capacitor('add', platform);
await configurePlatform(platform);
capacitor('sync', platform);
console.log(`Prepared ${platform} preview; native compile and device acceptance still required.`);
