'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
const manager = fs.readFileSync('modules/startup-manager.js', 'utf8');
const entry = fs.readFileSync('modules/core-static-copy-ui.mjs', 'utf8').replace(/^import .*;\n/gm, '');
const copy = JSON.parse(fs.readFileSync('modules/locales/core-tr.mjs', 'utf8').split('Object.freeze(')[1].split(');')[0]);
const c = { window: {}, document: {}, CORE_TR: copy, applyCoreStaticCopy() {} };
vm.runInNewContext(entry, c);
const provider = c.window.TodayStartupCopy;
function runtime(kind, supplied) {
  const dom = new JSDOM('<body></body>');
  let reloads = 0;
  const window = { location: { reload() { reloads++; } } };
  Object.defineProperty(window, 'TodayStartupCopy', { get() { if (supplied instanceof Error) throw supplied; return supplied; } });
  const context = { window, document: dom.window.document };
  const source = kind === 'inline'
    ? html.slice(html.indexOf('  const showStartupManagerFailure ='), html.indexOf('\n  if (\n    !errorManagerReady')) + '\nthis.show = showStartupManagerFailure;'
    : manager.slice(manager.indexOf('  function removeFailureSurface'), manager.indexOf('  function fail(')) + '\nthis.show = showFailureSurface;';
  // Rendering must not acquire storage, network or audio dependencies.
  for (const name of ['localStorage', 'indexedDB', 'fetch', 'Audio']) {
    Object.defineProperty(context, name, { get() { throw new Error('Unexpected access: ' + name); } });
    Object.defineProperty(window, name, { get() { throw new Error('Unexpected window access: ' + name); } });
  }
  vm.runInNewContext(source, context);
  return { show: context.show, document: dom.window.document, reloads: () => reloads, setCopy(value) { supplied = value; } };
}
let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('PASS: ' + name); } catch (e) { fail++; console.log('FAIL: ' + name + ' — ' + e.stack); } }
test('Optional startup provider is frozen, readonly and leaves an existing owner untouched', () => {
  assert.ok(Object.isFrozen(provider));
  assert.equal(Object.getOwnPropertyDescriptor(c.window, 'TodayStartupCopy').writable, false);
  assert.deepEqual(Object.keys(provider), ['startup.failed', 'common.retry', 'startup.managerFailed', 'startup.moduleFailed', 'startup.migrationFailed', 'startup.code']);
  vm.runInNewContext(entry, { ...c }); assert.equal(c.window.TodayStartupCopy, provider);
});
test('Missing provider preserves both Turkish failure surfaces, focus and reload-once action', () => {
  for (const kind of ['inline', 'manager']) {
    const r = runtime(kind); r.show('TODAY-STARTUP-004');
    const surface = r.document.querySelector('#todayStartupError');
    assert.equal(surface.querySelector('h1').textContent, copy['startup.failed']);
    assert.equal(surface.querySelector('p').textContent, copy[kind === 'inline' ? 'startup.managerFailed' : 'startup.moduleFailed']);
    assert.equal(surface.getAttribute('role'), 'alert');
    assert.equal(r.document.activeElement, surface);
    const b = surface.querySelector('button'); assert.equal(b.textContent, copy['common.retry']); b.click(); b.click(); assert.equal(r.reloads(), 1);
  }
});
test('Ready provider supplies title body and retry without interpreting markup', () => {
  for (const kind of ['inline', 'manager']) {
    const supplied = { ...provider, 'startup.failed': '<b>fixture</b>', 'common.retry': 'Fixture retry', 'startup.moduleFailed': 'Fixture body', 'startup.managerFailed': 'Fixture body' };
    const r = runtime(kind, supplied); r.show('TODAY-STARTUP-004');
    assert.equal(r.document.querySelector('h1').textContent, '<b>fixture</b>'); assert.equal(r.document.querySelector('h1 b'), null);
    assert.equal(r.document.querySelector('p').textContent, 'Fixture body'); assert.equal(r.document.querySelector('button').textContent, 'Fixture retry');
  }
});
test('Migration failure is distinct from resource failure with and without a provider', () => {
  for (const p of [undefined, provider]) {
    const r = runtime('manager', p); r.show('TODAY-MIGRATION-009');
    assert.equal(r.document.querySelector('p').textContent, copy['startup.migrationFailed']);
    assert.match(r.document.querySelector('main').textContent, /Başlangıç kodu: TODAY-MIGRATION-009/);
    assert.equal(r.document.querySelector('main').getAttribute('aria-describedby'), 'todayStartupErrorText');
  }
});
test('Invalid empty and throwing optional providers cannot prevent failure rendering', () => {
  for (const kind of ['inline', 'manager']) for (const supplied of [null, {}, { 'startup.failed': false, 'common.retry': ' ', 'startup.moduleFailed': 3, 'startup.managerFailed': {} }, new Error('synthetic getter')]) {
    const r = runtime(kind, supplied); r.show('TODAY-STARTUP-004');
    assert.equal(r.document.querySelector('h1').textContent, copy['startup.failed']); assert.equal(r.document.querySelector('button').textContent, copy['common.retry']);
    assert.equal(r.document.querySelector('p').textContent, copy[kind === 'inline' ? 'startup.managerFailed' : 'startup.moduleFailed']);
  }
});
test('Error code replacement is literal, single-pass and retains unknown codes', () => {
  const r = runtime('manager', { ...provider, 'startup.code': 'Code {code}, {code}' }); r.show('TODAY-$&-{code}-<img>');
  assert.equal(r.document.querySelector('p:last-child').textContent, 'Code TODAY-$&-{code}-<img>, TODAY-$&-{code}-<img>');
  assert.equal(r.document.querySelector('img'), null);
});
test('Duplicate inline failure preserves the original surface; manager replaces one surface', () => {
  for (const kind of ['inline', 'manager']) {
    const r = runtime(kind, provider); r.show('TODAY-STARTUP-004'); const first = r.document.querySelector('main'); r.show('TODAY-STARTUP-005');
    assert.equal(r.document.querySelectorAll('main').length, 1); assert.equal(r.document.querySelector('main') === first, kind === 'inline');
  }
});
test('Late provider does not create asynchronous replay, listeners or new failure dependencies', () => {
  const r = runtime('inline'); r.show();
  r.setCopy({ ...provider, 'startup.failed': 'Late synthetic title' });
  assert.equal(r.document.querySelector('h1').textContent, copy['startup.failed']);
  r.show(); assert.equal(r.document.querySelector('h1').textContent, copy['startup.failed']);
  assert.equal(r.document.querySelectorAll('script').length, 0);
  assert.equal(r.document.querySelectorAll('main').length, 1);
  assert.equal(manager.includes("import "), false);
});
console.log(`Startup Copy: ${pass}/${pass + fail} başarılı`); if (fail) process.exitCode = 1;
