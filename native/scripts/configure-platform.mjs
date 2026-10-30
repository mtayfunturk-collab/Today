import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NATIVE_ROOT } from './build-web.mjs';

export const READ_PERMISSIONS = Object.freeze([
  'android.permission.health.READ_STEPS',
  'android.permission.health.READ_SLEEP',
  'android.permission.health.READ_EXERCISE'
]);
const markerStart = '<!-- TODAY_READ_ONLY_HEALTH_START -->';
const markerEnd = '<!-- TODAY_READ_ONLY_HEALTH_END -->';

export function withAndroidMinimumSdk(gradle) {
  const pattern = /^(\s*minSdkVersion\s*=\s*)(\d+)/gm;
  const declarations = [...gradle.matchAll(pattern)];
  if (declarations.length !== 1) throw new Error('Expected one generated Android minSdkVersion declaration');
  // The pinned health library requires API 26; never lower a stronger target.
  return gradle.replace(pattern, (_, prefix, current) => `${prefix}${Math.max(Number(current), 26)}`);
}

export function withAndroidPrivateBackup(xml) {
  const application = xml.match(/<application\b[^>]*>/);
  if (!application) throw new Error('Android application declaration not found');
  const original = application[0];
  const privateTag = /\bandroid:allowBackup\s*=/.test(original)
    ? original.replace(/\bandroid:allowBackup\s*=\s*["'][^"']*["']/, 'android:allowBackup="false"')
    : original.replace('<application', '<application android:allowBackup="false"');
  return xml.replace(original, privateTag);
}

export function healthPermissions(xml) {
  const permissions = [];
  for (const tag of xml.matchAll(/<uses-permission(?:-sdk-\d+)?\b[^>]*>/g)) {
    const match = tag[0].match(/\bandroid:name\s*=\s*["'](android\.permission\.health\.[^"']+)["']/);
    if (match) permissions.push(match[1]);
  }
  return [...new Set(permissions)].sort();
}

export function narrowAndroidManifest(appXml, pluginXml) {
  if (!/<manifest\b/.test(appXml)) throw new Error('Android app manifest not found');
  const pluginPermissions = healthPermissions(pluginXml);
  for (const required of READ_PERMISSIONS) {
    if (!pluginPermissions.includes(required)) throw new Error(`Health plugin no longer declares ${required}`);
  }
  if (!pluginXml.includes('PermissionsRationaleActivity') || !pluginXml.includes('START_VIEW_PERMISSION_USAGE')) {
    throw new Error('Health Connect privacy rationale activity/alias is missing');
  }
  let xml = appXml.replace(new RegExp(`\\s*${markerStart}[\\s\\S]*?${markerEnd}`), '');
  if (healthPermissions(xml).length) throw new Error('Unexpected unmanaged health permissions in generated app manifest');
  if (!/\bxmlns:tools=/.test(xml)) xml = xml.replace('<manifest', '<manifest xmlns:tools="http://schemas.android.com/tools"');
  const removed = [...new Set([
    ...pluginPermissions.filter(permission => !READ_PERMISSIONS.includes(permission)),
    'android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND',
    'android.permission.health.READ_HEALTH_DATA_HISTORY'
  ])].sort();
  const lines = [
    markerStart,
    ...READ_PERMISSIONS.map(permission => `    <uses-permission android:name="${permission}" />`),
    ...removed.map(permission => `    <uses-permission android:name="${permission}" tools:node="remove" />`),
    markerEnd
  ];
  return xml.replace(/(<manifest\b[^>]*>)/, `$1\n    ${lines.join('\n    ')}`);
}

function xmlText(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function withHealthReadDescription(xml) {
  const key = 'NSHealthShareUsageDescription';
  const value = 'Today, seçtiğin tarih ve veri türleri için uyku, adım ve kayıtlı aktivite özetlerini yalnız cihazında göstermek üzere okur. Sağlık verisi yazmaz.';
  const entry = `<key>${key}</key>\n\t<string>${xmlText(value)}</string>`;
  if (xml.includes(`<key>${key}</key>`)) {
    return xml.replace(new RegExp(`<key>${key}</key>\\s*<string>[\\s\\S]*?</string>`), entry);
  }
  if (!xml.includes('</dict>')) throw new Error('Invalid generated Info.plist');
  return xml.replace('</dict>', `\t${entry}\n</dict>`);
}

export async function configurePlatform(platform) {
  if (platform === 'android') {
    const manifest = path.join(NATIVE_ROOT, 'android/app/src/main/AndroidManifest.xml');
    const variables = path.join(NATIVE_ROOT, 'android/variables.gradle');
    const pluginManifest = path.join(NATIVE_ROOT, 'node_modules/@capgo/capacitor-health/android/src/main/AndroidManifest.xml');
    const preparedManifest = withAndroidPrivateBackup(narrowAndroidManifest(await readFile(manifest, 'utf8'), await readFile(pluginManifest, 'utf8')));
    const preparedVariables = withAndroidMinimumSdk(await readFile(variables, 'utf8'));
    await writeFile(manifest, preparedManifest);
    await writeFile(variables, preparedVariables);
  } else if (platform === 'ios') {
    const plist = path.join(NATIVE_ROOT, 'ios/App/App/Info.plist');
    const project = path.join(NATIVE_ROOT, 'ios/App/App.xcodeproj/project.pbxproj');
    await writeFile(plist, withHealthReadDescription(await readFile(plist, 'utf8')));
    await writeFile(path.join(NATIVE_ROOT, 'ios/App/App/App.entitlements'), `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>com.apple.developer.healthkit</key><true/></dict></plist>\n`);
    let pbx = await readFile(project, 'utf8');
    if (!pbx.includes('CODE_SIGN_ENTITLEMENTS = App/App.entitlements;')) {
      const marker = 'INFOPLIST_FILE = App/Info.plist;';
      if (!pbx.includes(marker)) throw new Error('Expected native App build settings were not found');
      pbx = pbx.replaceAll(marker, `CODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n\t\t\t\t${marker}`);
      await writeFile(project, pbx);
    }
  } else {
    throw new Error('Only android and ios platforms are supported');
  }
}
