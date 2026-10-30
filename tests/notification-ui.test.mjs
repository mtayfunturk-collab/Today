import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountNotificationUI, nativeContextLocks } from '../modules/notification-ui.mjs';

let count = 0;
const pause = () => new Promise(resolve => setTimeout(resolve, 0));
const report = { observations: [{ metric: 'wearable-steps', recordedDays: 1, unit: 'count', values: [{ localDate: '2026-10-30', value: 1234 }] }] };
const insight = { id: 'insight:test', window: { startDate: '2026-10-30', endDate: '2026-10-30' }, report };
async function check(name, callback) { await callback(); count += 1; console.log(`PASS ${name}`); }
async function fixture({ supported = true, exclusive = true, fail = false, cold = false } = {}) {
  const dom = new JSDOM('<section id="aiContextPanel"></section>', { url: 'https://today.test' });
  const calls = [], state = { supported, exclusive, preferences: { aiEnabled: false, updateEnabled: false, localTime: null, quietHours: null } };
  let subscriber, entries = [], initCount = 0;
  const service = {
    getState: () => structuredClone(state), subscribe: fn => { subscriber = fn; },
    init: async () => { initCount++; if (cold) { entries = [insight]; subscriber({ type: 'open', insightId: insight.id }); } return { ok: true }; },
    enable: async options => { calls.push(['enable', options]); if (fail) return { ok: false }; state.preferences[`${options.kind}Enabled`] = true; state.preferences.localTime = options.localTime; return { ok: true }; },
    disable: async kind => { calls.push(['disable',kind]); state.preferences[`${kind}Enabled`] = false; if (kind === 'ai') entries = []; return { ok: true }; },
    reset: async () => { calls.push(['reset']); entries = []; state.preferences.aiEnabled = false; state.preferences.updateEnabled = false; return { ok: !fail }; },
    offerObservation: async (value, options) => { calls.push(['offer', value, options]); entries = [insight]; return { ok: true, status: 'scheduled' }; },
    listInsights: async () => ({ ok: true, insights: entries }),
    openInsight: async id => entries.some(row => row.id === id) ? { ok: true, insight: entries.find(row => row.id === id) } : { ok: false }
  };
  const api = await mountNotificationUI({ root: dom.window.document, serviceFactory: () => service });
  const $ = id => dom.window.document.getElementById(id);
  const submit = () => $('notificationPreferences').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  const ready = () => { $('notificationAiEnabled').checked = true; $('notificationTime').value = '20:00'; $('notificationArchiveConsent').checked = true; };
  return { dom, service, state, calls, api, $, submit, ready, initCount: () => initCount, close: () => dom.window.close() };
}
await check('mount is idempotent, defaults off and does not enable or create storage', async () => {
  const f = await fixture();
  try {
    assert.equal(f.$('notificationAiEnabled').checked, false); assert.equal(f.$('notificationUpdateEnabled').checked, false);
    assert.equal(f.$('notificationTime').value, ''); assert.equal(f.calls.length, 0); assert.equal(f.dom.window.localStorage.length, 0);
    await mountNotificationUI({ root: f.dom.window.document, serviceFactory: () => { throw Error('duplicate'); } });
    assert.equal(f.initCount(), 1); assert.equal(f.dom.window.document.querySelectorAll('#notificationPanel').length, 1);
  } finally { f.close(); }
});
await check('unsupported device and missing exclusivity disable activation', async () => {
  for (const options of [{ supported: false }, { exclusive: false }]) {
    const f = await fixture(options);
    try { assert.equal(f.$('btnNotificationApply').disabled, true); assert.equal(f.calls.length, 0); }
    finally { f.close(); }
  }
});
await check('activation requires fresh archive consent and an explicit local time', async () => {
  const f = await fixture();
  try {
    f.$('notificationAiEnabled').checked = true; f.submit(); await pause(); assert.equal(f.calls.length, 0);
    f.$('notificationArchiveConsent').checked = true; f.submit(); await pause(); assert.equal(f.calls.length, 0);
    f.ready(); f.submit(); await pause();
    assert.deepEqual(f.calls[0], ['enable', { kind: 'ai', localTime: '20:00', quietHours: null, userConfirmed: true }]);
    assert.equal(f.$('notificationArchiveConsent').checked, false);
  } finally { f.close(); }
});
await check('incomplete or equal quiet times never reach the service', async () => {
  const f = await fixture();
  try {
    f.ready(); f.$('notificationQuietStart').value = '23:00'; f.submit(); await pause();
    assert.equal(f.calls.length, 0);
    f.$('notificationQuietEnd').value = '23:00'; f.submit(); await pause(); assert.equal(f.calls.length, 0);
  } finally { f.close(); }
});
await check('permission failure remains truthful and restores saved preferences', async () => {
  const f = await fixture({ fail: true });
  try { f.ready(); f.submit(); await pause(); assert.match(f.$('notificationStatus').textContent, /tamamlanamadı/); assert.equal(f.$('notificationAiEnabled').checked, false); }
  finally { f.close(); }
});
await check('actual consented AI event archives only while AI notifications are enabled', async () => {
  const f = await fixture();
  try {
    const emit = userConfirmed => f.dom.window.dispatchEvent(new f.dom.window.CustomEvent('today:ai-observation-ready', { detail: { report, requestedAt: '2026-10-30T12:00:00Z', userConfirmed } }));
    emit(true); await pause(); assert.equal(f.calls.length, 0);
    f.state.preferences.aiEnabled = true; emit(false); await pause(); assert.equal(f.calls.length, 0);
    emit(true); await pause(); await pause(); assert.equal(f.calls[0][0], 'offer');
    assert.match(f.$('notificationStatus').textContent, /bildirim planlandı/);
    assert.equal(f.$('notificationArchive').querySelectorAll('button').length, 1);
    await f.api.openInsight(insight.id); assert.match(f.$('notificationInsight').textContent, /1234 adım/);
  } finally { f.close(); }
});
await check('cold notification action waits for initialization and opens its archived report', async () => {
  const f = await fixture({ cold: true });
  try { assert.match(f.$('notificationInsight').textContent, /1234 adım/); }
  finally { f.close(); }
});
await check('missing or expired insight displays an honest explanation', async () => {
  const f = await fixture();
  try { await f.api.openInsight('missing'); assert.match(f.$('notificationInsight').textContent, /artık kullanılamıyor/); }
  finally { f.close(); }
});
await check('reset affects only notification UI and clears sensitive view even on failure', async () => {
  const f = await fixture({ fail: true, cold: true });
  try {
    f.dom.window.localStorage.setItem('today_store_v2', 'SENTINEL');
    f.$('btnNotificationReset').click(); await pause();
    assert.equal(f.$('notificationInsight').textContent, '');
    assert.equal(f.dom.window.localStorage.getItem('today_store_v2'), 'SENTINEL');
    assert.match(f.$('notificationStatus').textContent, /tamamlanamadı/);
  } finally { f.close(); }
});
await check('single native context lock never admits overlapping archive writers', async () => {
  assert.equal(nativeContextLocks({ isNative: false, singleContext: true, platform: 'ios' }), null);
  assert.equal(nativeContextLocks({ isNative: true, platform: 'ios' }), null);
  const a = nativeContextLocks({ isNative: true, singleContext: true, platform: 'ios' });
  const b = nativeContextLocks({ isNative: true, singleContext: true, platform: 'ios' });
  let release; const pending = a.request('archive', { mode: 'exclusive', ifAvailable: true }, async lock => { assert.ok(lock); await new Promise(resolve => { release = resolve; }); });
  assert.equal(await b.request('archive', { mode: 'exclusive', ifAvailable: true }, lock => lock), null);
  release(); await pending;
  assert.ok(await b.request('archive', { mode: 'exclusive', ifAvailable: true }, lock => lock));
});
await check('missing Settings panel does not initialize notification services', async () => {
  const dom = new JSDOM('<p>Other view</p>');
  assert.equal(await mountNotificationUI({ root: dom.window.document, serviceFactory: () => { throw Error('must not run'); } }), null);
  dom.window.close();
});
console.log(`NUT-019.3 Notification UI: ${count}/${count} başarılı`);
