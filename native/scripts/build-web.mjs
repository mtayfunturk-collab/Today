import { copyFile, lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const NATIVE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const APP_ROOT = path.resolve(NATIVE_ROOT, '..');

// This is an application-asset allowlist, never a recursive repository copy.
export function isPackagedPath(name) {
  if (typeof name !== 'string' || name.includes('\\') || name.split('/').some(part => part === '..' || part.startsWith('.'))) return false;
  if (['index.html', 'manifest.json', 'nutrition-unit-rules.json'].includes(name)) return true;
  if (/^(?:today-icon-v9-(?:192|512)|apple-touch-icon-v9)\.png$/.test(name)) return true;
  return /^(?:modules\/[\w/-]+\.(?:m?js)|Today-AI-Engine\/src\/[\w/-]+\.mjs|vendor\/[\w/.-]+\.js|assets\/[\w/-]+\.(?:jpg|png|svg|webp)|data\/sky-cities-15000\.json)$/.test(name);
}

export function parseAppShell(source) {
  const match = source.match(/const APP_SHELL\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) throw new Error('Service Worker APP_SHELL inventory not found');
  const values = JSON.parse(match[1]);
  if (!Array.isArray(values) || values.some(value => typeof value !== 'string')) throw new Error('Invalid APP_SHELL inventory');
  return values.filter(value => value !== './').map(value => value.replace(/^\.\//, ''));
}

export async function collectAssets(root = APP_ROOT) {
  const rootReal = await realpath(root);
  const pending = [...parseAppShell(await readFile(path.join(root, 'sw.js'), 'utf8'))];
  const index = await readFile(path.join(root, 'index.html'), 'utf8');
  for (const match of index.matchAll(/\b(?:src|href)=["'](\.\/[^"'#?]+)["']/g)) pending.push(match[1].slice(2));
  const selected = new Set();
  while (pending.length) {
    const name = pending.shift();
    if (selected.has(name)) continue;
    if (!isPackagedPath(name)) throw new Error(`Asset is outside the native allowlist: ${name}`);
    const filename = path.join(root, name);
    if (!(await lstat(filename)).isFile()) throw new Error(`Native asset is not a regular file: ${name}`);
    const fileReal = await realpath(filename);
    if (!fileReal.startsWith(rootReal + path.sep)) throw new Error(`Native asset escapes the application directory: ${name}`);
    selected.add(name);
    if (/\.m?js$/.test(name)) {
      const source = await readFile(filename, 'utf8');
      for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["'](\.{1,2}\/[^"'#?]+)["']/g)) {
        pending.push(path.posix.normalize(path.posix.join(path.posix.dirname(name), match[1])));
      }
    }
  }
  return [...selected].sort();
}

export async function buildWeb() {
  const assets = await collectAssets();
  const staging = await mkdtemp(path.join(NATIVE_ROOT, '.www-build-'));
  try {
    for (const name of assets) {
      const destination = path.join(staging, name);
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(path.join(APP_ROOT, name), destination);
    }
    const indexPath = path.join(staging, 'index.html');
    const index = await readFile(indexPath, 'utf8');
    if (!index.includes('<head>')) throw new Error('Expected a head element in Today index');
    // A blocking bootstrap precedes every existing application script and module.
    await writeFile(indexPath, index.replace('<head>', '<head>\n  <script src="./native-bootstrap.js"></script>'));
    const { build } = await import('esbuild');
    await build({
      entryPoints: [path.join(NATIVE_ROOT, 'src/bootstrap.mjs')],
      outfile: path.join(staging, 'native-bootstrap.js'),
      bundle: true,
      format: 'iife',
      platform: 'browser',
      target: ['es2022'],
      sourcemap: false,
      legalComments: 'linked'
    });
    await copyFile(path.join(NATIVE_ROOT, 'public/privacypolicy.html'), path.join(staging, 'privacypolicy.html'));
    await copyFile(path.join(NATIVE_ROOT, 'node_modules/@capgo/capacitor-health/LICENSE'), path.join(staging, 'health-plugin-LICENSE.txt'));
    const output = path.join(NATIVE_ROOT, 'www');
    await rm(output, { recursive: true, force: true });
    await rename(staging, output);
    console.log(`Native web assets: ${assets.length} allowlisted application files + bootstrap/privacy/license; no repository or user-data copy.`);
    return { assets, output };
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await buildWeb();
}
