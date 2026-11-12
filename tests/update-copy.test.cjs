'use strict';
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const source = fs.readFileSync('modules/service-worker-manager.js', 'utf8');
const entry = fs.readFileSync('modules/core-static-copy-ui.mjs', 'utf8').replace(/^import .*;\n/gm, '');
const dictionary = JSON.parse(fs.readFileSync('modules/locales/core-tr.mjs', 'utf8').split('Object.freeze(')[1].split(');')[0]);
function provider(copy = dictionary, window = {}) {
  vm.runInNewContext(entry, { window, document: {}, CORE_TR: copy, applyCoreStaticCopy() {} });
  return window.TodayUpdateCopy;
}
function setup(copy) {
  const document = new JSDOM('<body></body>').window.document;
  let apply = 0, later = 0;
  const targetWindow = {};
  Object.defineProperty(targetWindow, 'TodayUpdateCopy', { get() { if (copy instanceof Error) throw copy; return copy; } });
  for (const key of ['localStorage', 'indexedDB', 'fetch', 'Audio']) Object.defineProperty(targetWindow, key, { get() { throw Error('Unexpected access: ' + key); } });
  const context = { targetWindow, targetDocument: document, activateUpdate() { apply++; }, deferUpdate() { later++; }, reportUpdateError() { throw Error('Unexpected rendering error'); } };
  vm.runInNewContext(source.slice(source.indexOf('  function getNoticeSurface()'), source.indexOf('  function hasController()')), context);
  return { context, get: id => document.getElementById(id), document, calls: () => [apply, later], setCopy(value) { copy = value; } };
}
let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('PASS: ' + name); } catch(e) { fail++; console.log('FAIL: ' + name + ' — ' + e.stack); } }
test('Provider has six frozen labels, readonly registration and preserves existing ownership', () => {
  const w = {}, p = provider(dictionary, w); assert.ok(Object.isFrozen(p)); assert.equal(Object.keys(p).length, 6);
  assert.equal(Object.getOwnPropertyDescriptor(w, 'TodayUpdateCopy').writable, false); assert.equal(provider(dictionary, w), p);
});
test('Absent provider preserves exact ready and applying Turkish labels', () => {
  const r = setup(); assert.equal(r.context.showUpdateNotice(), true);
  for (const [id, key] of Object.entries({ todayUpdateTitle:'update.title', todayUpdateText:'update.ready', todayUpdateApply:'update.apply', todayUpdateLater:'update.later' })) assert.equal(r.get(id).textContent, dictionary[key]);
  assert.equal(r.context.showApplyingState(), true); assert.equal(r.get('todayUpdateText').textContent, dictionary['update.applying']); assert.equal(r.get('todayUpdateApply').textContent, dictionary['update.applyingButton']);
});
test('Independent dictionary fixture supplies all six labels across the lifecycle', () => {
  const copy = { ...dictionary }; for (const key of Object.keys(copy).filter(k => k.startsWith('update.'))) copy[key] = 'Fixture ' + key;
  const r = setup(provider(copy)); r.context.showUpdateNotice();
  assert.equal(r.get('todayUpdateTitle').textContent, 'Fixture update.title'); assert.equal(r.get('todayUpdateText').textContent, 'Fixture update.ready');
  assert.equal(r.get('todayUpdateApply').textContent, 'Fixture update.apply'); assert.equal(r.get('todayUpdateLater').textContent, 'Fixture update.later');
  r.context.showApplyingState(); assert.equal(r.get('todayUpdateText').textContent, 'Fixture update.applying'); assert.equal(r.get('todayUpdateApply').textContent, 'Fixture update.applyingButton');
});
test('Empty nonstring and throwing optional provider preserve safe fallback', () => {
  for (const p of [null, {}, new Error('Fixture getter'), { 'update.title': ' ', 'update.ready': false, 'update.apply': 5, 'update.later': {}, 'update.applying': null }]) {
    const r = setup(p); r.context.showUpdateNotice(); assert.equal(r.get('todayUpdateTitle').textContent, 'Today Yenilik'); assert.equal(r.get('todayUpdateText').textContent, dictionary['update.ready']);
    assert.equal(r.get('todayUpdateApply').textContent, dictionary['update.apply']); assert.equal(r.get('todayUpdateLater').textContent, dictionary['update.later']);
    r.context.showApplyingState(); assert.equal(r.get('todayUpdateText').textContent, dictionary['update.applying']);
  }
});
test('Late provider does not replay or activate, and next display refreshes both button labels', () => {
  const r = setup(); r.context.showUpdateNotice(); r.setCopy(provider({ ...dictionary, 'update.apply':'Fixture apply', 'update.later':'Fixture later' }));
  assert.equal(r.get('todayUpdateApply').textContent, 'Şimdi güncelle'); assert.equal(r.get('todayUpdateLater').textContent, 'Daha sonra'); assert.deepEqual(r.calls(), [0,0]);
  r.context.showUpdateNotice(); assert.equal(r.get('todayUpdateApply').textContent, 'Fixture apply'); assert.equal(r.get('todayUpdateLater').textContent, 'Fixture later');
});
test('Literal markup stays text and repeated renders preserve one surface/control/listener', () => {
  const r = setup(provider({ ...dictionary, 'update.title':'<img src=x>{code}$&' })); r.context.showUpdateNotice();
  const button = r.get('todayUpdateApply'); for (let i=0;i<3;i++) r.context.showUpdateNotice();
  assert.equal(r.document.querySelectorAll('#todayUpdateNotice').length, 1); assert.equal(r.get('todayUpdateApply'), button); assert.equal(r.get('todayUpdateTitle').textContent, '<img src=x>{code}$&'); assert.equal(r.document.querySelector('img'), null);
  button.click(); r.get('todayUpdateLater').click(); assert.deepEqual(r.calls(), [1,1]);
});
test('Applying disables controls, retry display restores them, visibility and live semantics remain', () => {
  const r = setup(provider()); r.context.showUpdateNotice(); const n = r.get('todayUpdateNotice');
  assert.equal(n.getAttribute('role'), 'status'); assert.equal(n.getAttribute('aria-live'), 'polite'); assert.equal(n.getAttribute('aria-labelledby'), 'todayUpdateTitle'); assert.equal(n.getAttribute('aria-describedby'), 'todayUpdateText');
  r.context.showApplyingState(); assert.ok(r.get('todayUpdateApply').disabled && r.get('todayUpdateLater').disabled); r.get('todayUpdateApply').click(); assert.deepEqual(r.calls(), [0,0]);
  r.context.showUpdateNotice(); assert.equal(r.get('todayUpdateApply').disabled, false); assert.equal(r.get('todayUpdateLater').disabled, false);
  r.context.hideUpdateNotice(); assert.equal(n.hidden, true); assert.equal(n.getAttribute('aria-hidden'), 'true');
});
test('Applying before notice exists remains a no-op without creating controls', () => {
  const r = setup(provider()); assert.equal(r.context.showApplyingState(), false); assert.equal(r.get('todayUpdateNotice'), null); assert.deepEqual(r.calls(), [0,0]);
});
console.log(`Update Copy: ${pass}/${pass + fail} başarılı`); if(fail) process.exitCode = 1;
