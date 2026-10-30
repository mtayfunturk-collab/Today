import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { NATIVE_ROOT } from './build-web.mjs';
import { healthPermissions, READ_PERMISSIONS } from './configure-platform.mjs';

export function verifyHealthPermissions(xml) {
  const actual = healthPermissions(xml);
  const unexpected = actual.filter(permission => !READ_PERMISSIONS.includes(permission));
  const missing = READ_PERMISSIONS.filter(permission => !actual.includes(permission));
  if (unexpected.length || missing.length) throw new Error(`Merged health permission mismatch: unexpected=${unexpected.join(',') || 'none'}; missing=${missing.join(',') || 'none'}`);
  return actual;
}

export function verifyNativePrivacy(xml) {
  const application = xml.match(/<application\b[^>]*>/)?.[0];
  if (!application || !/\bandroid:allowBackup\s*=\s*["']false["']/.test(application)) {
    throw new Error('Merged Android application must disable Auto Backup explicitly');
  }
  return true;
}

export function verifyNotificationPermissions(xml) {
  const permissions = [...xml.matchAll(/<uses-permission(?:-sdk-\d+)?\b[^>]*>/g)]
    .map(match => match[0].match(/\bandroid:name\s*=\s*["']([^"']+)["']/)?.[1]).filter(Boolean);
  for (const required of ['POST_NOTIFICATIONS', 'RECEIVE_BOOT_COMPLETED', 'WAKE_LOCK']) {
    if (!permissions.includes(`android.permission.${required}`)) throw new Error(`Merged notification permission is missing: ${required}`);
  }
  if (permissions.some(name => ['android.permission.SCHEDULE_EXACT_ALARM', 'android.permission.USE_EXACT_ALARM'].includes(name))) {
    throw new Error('Merged Android preview must not request exact alarms');
  }
  if (!xml.includes('LocalNotificationRestoreReceiver') || !xml.includes('android.intent.action.BOOT_COMPLETED')) {
    throw new Error('Merged local notification restore receiver is missing');
  }
  return true;
}

async function mergedManifests(directory) {
  const selected = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) selected.push(...await mergedManifests(filename));
    else if (entry.isFile() && entry.name === 'AndroidManifest.xml' && /[/\\]merged_manifests?[/\\]/.test(filename)) selected.push(filename);
  }
  return selected;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const filenames = process.argv[2]
    ? [path.resolve(process.argv[2])]
    : await mergedManifests(path.join(NATIVE_ROOT, 'android/app/build/intermediates'));
  if (!filenames.length) throw new Error('No merged Android manifest found; run :app:processDebugMainManifest first');
  for (const filename of filenames) {
    const xml = await readFile(filename, 'utf8');
    verifyHealthPermissions(xml);
    verifyNativePrivacy(xml);
    verifyNotificationPermissions(xml);
    console.log(`PASS merged health/notification permissions and backup privacy: ${path.relative(NATIVE_ROOT, filename)} (READ_STEPS, READ_SLEEP, READ_EXERCISE only; Auto Backup disabled; no exact alarm)`);
  }
}
