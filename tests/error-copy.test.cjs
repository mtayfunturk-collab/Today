'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const source = fs.readFileSync('modules/error-manager.js', 'utf8');
const entry = fs.readFileSync('modules/core-static-copy-ui.mjs', 'utf8').replace(/^import .*;\n/gm, '');
const copy = JSON.parse(fs.readFileSync('modules/locales/core-tr.mjs', 'utf8').split('Object.freeze(')[1].split(');')[0]);
function provider(dictionary = copy, window = {}) {
  vm.runInNewContext(entry, { window, document: {}, CORE_TR: dictionary, applyCoreStaticCopy() {} });
  return window.TodayErrorCopy;
}
function setup(supplied) {
  const dom = new JSDOM('<body></body>');
  const events = [], logs = [], routes = [];
  let reloads = 0;
  const console = { info() {}, warn(...a) { logs.push(a); }, error(...a) { logs.push(a); } };
  const window = { document: dom.window.document, console, location: { reload() { reloads++; } },
    CustomEvent: dom.window.CustomEvent, addEventListener: dom.window.addEventListener.bind(dom.window),
    dispatchEvent: dom.window.dispatchEvent.bind(dom.window),
    TodayRouter: { getState: () => ({ initialized: true }), navigate(...a) { routes.push(a); return { success: true }; } } };
  Object.defineProperty(window, 'TodayErrorCopy', { get() { if (supplied instanceof Error) throw supplied; return supplied; } });
  for (const name of ['localStorage', 'indexedDB', 'fetch', 'Audio']) Object.defineProperty(window, name, { get() { throw Error('Unexpected access: ' + name); } });
  dom.window.addEventListener('today:error', e => events.push(e.detail));
  vm.runInNewContext(source, { window, document: window.document, console });
  return { window, api: window.TodayErrors, get: id => window.document.getElementById(id), events, logs, routes, reloads: () => reloads,
    setCopy(value) { supplied = value; }, event(type, detail = {}) { window.dispatchEvent(new window.CustomEvent(type, { detail })); } };
}
let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('PASS: ' + name); } catch (e) { fail++; console.log('FAIL: ' + name + ' — ' + e.stack); } }
test('Provider and its labels/message maps are readonly and preserve an existing owner', () => {
  const p = provider(); assert.ok(Object.isFrozen(p) && Object.isFrozen(p.labels) && Object.isFrozen(p.messages));
  assert.equal(Object.keys(p.messages).length, 13);
  const window = { TodayErrorCopy: p }; assert.equal(provider(copy, window), p);
  const w = {}; provider(copy, w); assert.equal(Object.getOwnPropertyDescriptor(w, 'TodayErrorCopy').writable, false);
});
test('All 13 exact known message sources map to independently changed dictionary values', () => {
  const dictionary = { ...copy }; for (const k of Object.keys(dictionary).filter(k => k.startsWith('error.message.'))) dictionary[k] = 'Fixture ' + k;
  const p = provider(dictionary), r = setup(p);
  for (const k of Object.keys(dictionary).filter(k => k.startsWith('error.message.'))) {
    const record = r.api.capture({ userMessage: copy[k], code: 'TODAY-FIXTURE-001' });
    assert.equal(r.get('todayErrorNoticeText').textContent, dictionary[k]);
    assert.equal(record.userMessage, copy[k]); assert.equal(r.api.getLog().at(-1), record); assert.equal(r.events.at(-1), record);
  }
});
test('Absent provider preserves exact Turkish copy and recovery labels for all actions', () => {
  const r = setup();
  for (const recovery of ['home', 'reload', 'dismiss']) {
    r.api.capture({ code: 'TODAY-FIXTURE-001', recovery, userMessage: 'Fixture body' });
    assert.equal(r.get('todayErrorNoticeText').textContent, 'Fixture body');
    assert.equal(r.get('todayErrorNoticeCode').textContent, 'Hata kodu: TODAY-FIXTURE-001');
    assert.equal(r.get('todayErrorRecover').textContent, { home: 'Ana ekrana dön', reload: 'Yeniden dene', dismiss: 'Tamam' }[recovery]);
    assert.equal(r.get('todayErrorRecover').hidden, recovery === 'dismiss');
    assert.equal(r.get('todayErrorDismiss').textContent, recovery === 'dismiss' ? 'Tamam' : 'Kapat');
  }
});
test('Translated presentation does not mutate frozen record, diagnostics, console or event payload', () => {
  const d = { ...copy, 'error.message.route': 'Fixture translated route' }, r = setup(provider(d));
  r.event('today:routeerror', { errorCode: 'TODAY-ROUTER-015', route: 'fixture', note: 'Private fixture should be excluded' });
  const record = r.api.getLog()[0]; assert.ok(Object.isFrozen(record) && Object.isFrozen(record.details));
  assert.equal(record.code, 'TODAY-ROUTER-015'); assert.equal(record.userMessage, copy['error.message.route']);
  assert.equal(r.get('todayErrorNoticeText').textContent, 'Fixture translated route');
  assert.equal(record.details.note, undefined); assert.equal(record.details.route, 'fixture');
  assert.equal(r.events[0], record); assert.equal(r.logs[0][0], '[TODAY-ROUTER-015] Today Router bir rota hatası bildirdi.');
});
test('Custom unknown and prototype-like messages remain literal and never become HTML', () => {
  const r = setup(provider());
  for (const text of ['Custom {code} $& <img src=x>', '__proto__', 'constructor']) {
    const record = r.api.capture({ userMessage: text }); assert.equal(record.userMessage, text);
    assert.equal(r.get('todayErrorNoticeText').textContent, text); assert.equal(r.get('todayErrorNoticeText').querySelector('img'), null);
  }
});
test('Empty wrong-type and throwing copy values preserve all fallback strings', () => {
  for (const p of [null, {}, new Error('Fixture getter'), { labels: { 'error.code': false, 'error.home': ' ', 'error.close': 7 }, messages: { [copy['error.message.route']]: null } }]) {
    const r = setup(p); r.event('today:routeerror', { errorCode: 'TODAY-ROUTER-015' });
    assert.equal(r.get('todayErrorNoticeText').textContent, copy['error.message.route']);
    assert.equal(r.get('todayErrorNoticeCode').textContent, 'Hata kodu: TODAY-ROUTER-015');
    assert.equal(r.get('todayErrorRecover').textContent, 'Ana ekrana dön'); assert.equal(r.get('todayErrorDismiss').textContent, 'Kapat');
  }
});
test('Code template retains normalized diagnostics and falls back if its token is missing', () => {
  for (const template of ['Fixture {code} / {code}', 'Broken template without parameter']) {
    const r = setup(provider({ ...copy, 'error.code': template })); r.api.capture({ code: 'today-fixture-001' });
    assert.equal(r.get('todayErrorNoticeCode').textContent, template.includes('{code}') ? 'Fixture TODAY-FIXTURE-001 / TODAY-FIXTURE-001' : 'Hata kodu: TODAY-FIXTURE-001');
  }
});
test('Home recovery invokes the same router contract and dismisses only the notice', () => {
  const r = setup(provider({ ...copy, 'error.home': 'Fixture home' })); r.api.capture({ recovery: 'home' });
  assert.equal(r.get('todayErrorRecover').textContent, 'Fixture home'); r.get('todayErrorRecover').click();
  assert.equal(r.routes.length, 1); assert.equal(r.routes[0][0], 'home');
  assert.equal(r.routes[0][1].replace, true); assert.equal(r.routes[0][1].source, 'error-recovery');
  assert.equal(r.get('todayErrorNotice').hidden, true); assert.equal(r.api.getLog().length, 1); assert.equal(r.reloads(), 0);
});
test('Reload label performs reload and dismiss label does not reload or navigate', () => {
  const r = setup(provider({ ...copy, 'common.retry': 'Fixture retry', 'error.ok': 'Fixture okay' }));
  r.api.capture({ recovery: 'reload' }); assert.equal(r.get('todayErrorRecover').textContent, 'Fixture retry'); r.get('todayErrorRecover').click(); assert.equal(r.reloads(), 1);
  r.api.capture({ recovery: 'dismiss' }); assert.equal(r.get('todayErrorDismiss').textContent, 'Fixture okay'); assert.equal(r.get('todayErrorRecover').hidden, true);
  r.get('todayErrorDismiss').click(); assert.equal(r.get('todayErrorNotice').getAttribute('aria-hidden'), 'true'); assert.equal(r.reloads(), 1); assert.equal(r.routes.length, 0);
});
test('Warning/error semantics and nonvisible records remain independent of translated text', () => {
  const r = setup(provider());
  r.api.capture({ severity: 'warning' }); assert.equal(r.get('todayErrorNotice').getAttribute('role'), 'status'); assert.equal(r.get('todayErrorNotice').getAttribute('aria-live'), 'polite');
  r.api.capture({ severity: 'fatal' }); assert.equal(r.get('todayErrorNotice').getAttribute('role'), 'alert'); assert.equal(r.get('todayErrorNotice').getAttribute('aria-live'), 'assertive');
  const before = r.get('todayErrorNotice').textContent; r.api.capture({ userVisible: false, userMessage: 'Hidden fixture' }); assert.equal(r.get('todayErrorNotice').textContent, before); assert.equal(r.api.getLog().length, 3);
});
test('Late provider never replays old errors and applies only on the next display', () => {
  const r = setup(); r.event('today:routeerror'); const count = r.api.getLog().length;
  r.setCopy(provider({ ...copy, 'error.message.route': 'Fixture late' }));
  assert.equal(r.get('todayErrorNoticeText').textContent, copy['error.message.route']); assert.equal(r.api.getLog().length, count);
  r.event('today:routeerror'); assert.equal(r.get('todayErrorNoticeText').textContent, 'Fixture late'); assert.equal(r.api.getLog().length, count + 1);
});
test('Repeated errors keep one surface and a bounded unchanged record log', () => {
  const r = setup(provider()); for (let i = 0; i < 30; i++) r.api.capture({ code: 'TODAY-FIXTURE-' + i });
  assert.equal(r.window.document.querySelectorAll('#todayErrorNotice').length, 1); assert.equal(r.api.getLog().length, 25); assert.equal(r.api.getLog()[0].code, 'TODAY-FIXTURE-5');
});
console.log(`Error Copy: ${pass}/${pass + fail} başarılı`); if (fail) process.exitCode = 1;
