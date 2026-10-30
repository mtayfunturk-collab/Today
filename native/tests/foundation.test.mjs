import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { isPackagedPath, parseAppShell, NATIVE_ROOT } from '../scripts/build-web.mjs';
import { narrowAndroidManifest, READ_PERMISSIONS, withAndroidMinimumSdk, withAndroidPrivateBackup, withHealthReadDescription } from '../scripts/configure-platform.mjs';
import { verifyHealthPermissions, verifyNativePrivacy } from '../scripts/verify-android-permissions.mjs';

const manifestWith = permissions => `<manifest xmlns:android="http://schemas.android.com/apk/res/android">${permissions.map(name => `<uses-permission android:name="${name}" />`).join('')}<application /></manifest>`;

test('Native asset allowlist excludes repository, tests and user-file paths', () => {
  for (const name of ['index.html', 'modules/health-wearable-ui.mjs', 'Today-AI-Engine/src/context-builder.mjs', 'data/sky-cities-15000.json', 'assets/sport/cycling.jpg']) assert.equal(isPackagedPath(name), true, name);
  for (const name of ['AGENTS.md', '.env', '.git/config', 'docs/02_ROADMAP.md', 'tests/private.json', 'data/private-health.json', 'node_modules/secret.js', '../index.html', '/index.html', 'modules/../index.html', 'modules\\storage.js']) assert.equal(isPackagedPath(name), false, name);
});

test('Asset inventory is parsed as data rather than evaluating Service Worker code', () => {
  assert.deepEqual(parseAppShell('const APP_SHELL = ["./", "./index.html", "./modules/storage.js"]; throw new Error("not executed")'), ['index.html', 'modules/storage.js']);
  assert.throws(() => parseAppShell('const APP_SHELL = arbitraryCode();'), /inventory/);
});

test('Merged Android manifest accepts only the three intended read permissions', () => {
  assert.deepEqual(verifyHealthPermissions(manifestWith(READ_PERMISSIONS)), [...READ_PERMISSIONS].sort());
});

test('Merged Android manifest rejects health writes', () => {
  assert.throws(() => verifyHealthPermissions(manifestWith([...READ_PERMISSIONS, 'android.permission.health.WRITE_STEPS'])), /unexpected=.*WRITE_STEPS/);
});

test('Merged Android manifest rejects extra read, history and background scope', () => {
  for (const extra of ['READ_HEART_RATE', 'READ_HEALTH_DATA_HISTORY', 'READ_HEALTH_DATA_IN_BACKGROUND']) {
    assert.throws(() => verifyHealthPermissions(manifestWith([...READ_PERMISSIONS, `android.permission.health.${extra}`])), /unexpected=/);
  }
});

test('Merged Android manifest rejects missing required read capability', () => {
  assert.throws(() => verifyHealthPermissions(manifestWith(READ_PERMISSIONS.slice(1))), /missing=.*READ_STEPS/);
});

const pluginXml = await readFile(path.join(NATIVE_ROOT, 'node_modules/@capgo/capacitor-health/android/src/main/AndroidManifest.xml'), 'utf8');
test('Installed plugin broad declarations are explicitly removed without replacing its privacy activity', () => {
  const source = '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><uses-permission android:name="android.permission.INTERNET" /><application android:label="Today" /></manifest>';
  const prepared = narrowAndroidManifest(source, pluginXml);
  assert.match(prepared, /android.permission.INTERNET/);
  assert.match(prepared, /android:label="Today"/);
  assert.match(prepared, /android.permission.health.WRITE_STEPS" tools:node="remove"/);
  assert.match(prepared, /android.permission.health.READ_HEART_RATE" tools:node="remove"/);
  assert.doesNotMatch(prepared, /<activity/);
  assert.match(pluginXml, /START_VIEW_PERMISSION_USAGE/);
});

test('Android preparation is repeatable and fails on unmanaged app health permissions', () => {
  const source = '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application /></manifest>';
  const once = narrowAndroidManifest(source, pluginXml);
  assert.equal(narrowAndroidManifest(once, pluginXml), once);
  assert.throws(() => narrowAndroidManifest(manifestWith(['android.permission.health.READ_HEART_RATE']), pluginXml), /unmanaged/);
});

test('Android minimum SDK satisfies the pinned health library without lowering a stronger target', () => {
  assert.equal(withAndroidMinimumSdk('ext {\n    minSdkVersion = 24\n    targetSdkVersion = 36\n}'), 'ext {\n    minSdkVersion = 26\n    targetSdkVersion = 36\n}');
  for (const version of [26, 28]) {
    const source = `ext {\n    minSdkVersion = ${version}\n}`;
    assert.equal(withAndroidMinimumSdk(source), source);
  }
  assert.throws(() => withAndroidMinimumSdk('ext { targetSdkVersion = 36 }'), /minSdkVersion/);
});

test('Android preview disables backup repeatably while preserving other app attributes', () => {
  const source = '<manifest><application android:allowBackup="true" android:label="Today" android:theme="@style/AppTheme"><activity /></application></manifest>';
  const prepared = withAndroidPrivateBackup(source);
  assert.match(prepared, /android:allowBackup="false"/);
  assert.match(prepared, /android:label="Today" android:theme="@style\/AppTheme"/);
  assert.equal(withAndroidPrivateBackup(prepared), prepared);
  assert.equal(verifyNativePrivacy(withAndroidPrivateBackup('<manifest><application /></manifest>')), true);
});

test('Merged Android backup privacy rejects missing or enabled Auto Backup', () => {
  assert.equal(verifyNativePrivacy('<manifest><application android:allowBackup="false" /></manifest>'), true);
  for (const source of ['<manifest />', '<manifest><application /></manifest>', '<manifest><application android:allowBackup="true" /></manifest>']) {
    assert.throws(() => verifyNativePrivacy(source), /disable Auto Backup/);
  }
});

test('iOS permission rationale is read-only, idempotent and preserves existing plist content', () => {
  const source = '<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleName</key><string>Today</string></dict></plist>';
  const prepared = withHealthReadDescription(source);
  assert.match(prepared, /NSHealthShareUsageDescription/);
  assert.match(prepared, /<key>CFBundleName<\/key><string>Today<\/string>/);
  assert.doesNotMatch(prepared, /NSHealthUpdateUsageDescription/);
  assert.equal(withHealthReadDescription(prepared), prepared);
});

test('Native preview loads bundled web assets without a remote server URL', async () => {
  const config = JSON.parse(await readFile(path.join(NATIVE_ROOT, 'capacitor.config.json'), 'utf8'));
  assert.equal(config.appId, 'app.today.preview');
  assert.equal(config.webDir, 'www');
  assert.equal(config.server, undefined);
});
