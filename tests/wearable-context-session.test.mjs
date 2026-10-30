import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { wearableContextSession as session, replaceWearablePreview as replace, clearWearablePreview as clear } from '../modules/wearable-context-session.mjs';
let count = 0;
const key = d => [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
const today = key(new Date());
const scope = { startDate: today, endDate: today, types: ['steps'] };
const sample = { type: 'steps', localDate: today, value: 1234, unit: 'count', provider: 'health-connect', aggregation: 'daily-deduplicated' };
const input = (samples = [sample]) => ({ samples, capturedAt: new Date().toISOString(), window: scope });
function check(callback) { clear(); callback(); count += 1; }
check(() => {
  assert.equal(session.getSnapshot(scope), null);
  assert.deepEqual(Object.keys(session).sort(), ['getRevision','getSnapshot']);
  assert.equal(Object.isFrozen(session), true);
});
check(() => {
  const original = input([{ ...sample, privateNote: 'secret', sourceId: 'private-device' }]);
  assert.equal(replace(original).ok, true); original.samples[0].value = 9999;
  const result = session.getSnapshot(scope);
  assert.equal(result.samples[0].value, 1234);
  assert.doesNotMatch(JSON.stringify(result), /secret|private-device|sourceId/);
  assert.equal(Object.isFrozen(result.samples[0]), true);
});
check(() => {
  replace(input());
  assert.equal(session.getSnapshot({ ...scope, types: ['sleep'] }), null);
  assert.equal(session.getSnapshot({ ...scope, types: [] }), null);
  assert.equal(session.getSnapshot({ ...scope, types: ['steps','steps'] }), null);
});
check(() => {
  replace(input()); const revision = session.getRevision();
  replace(input([{ ...sample, value: 0 }]));
  assert.equal(session.getRevision() > revision, true);
  assert.equal(session.getSnapshot(scope).samples[0].value, 0);
  replace(input([])); assert.equal(session.getSnapshot(scope), null);
});
check(() => {
  replace(input());
  assert.equal(replace(input([sample, sample])).ok, false);
  assert.equal(session.getSnapshot(scope), null);
});
check(() => {
  for (const patch of [{ value: null }, { value: 1.5 }, { unit: 'bpm' }, { provider: 'private-device' }, { aggregation: 'raw' }, { localDate: 'invalid' }]) {
    replace(input());
    assert.equal(replace(input([{ ...sample, ...patch }])).ok, false);
    assert.equal(session.getSnapshot(scope), null);
  }
});
check(() => {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  const future = key(tomorrow);
  assert.equal(replace({ ...input(), window: { startDate: future, endDate: future }, samples: [{ ...sample, localDate: future }] }).ok, false);
  assert.equal(replace({ ...input(), capturedAt: new Date(Date.now()+86400000).toISOString() }).ok, false);
});
check(() => {
  const earlier = new Date(); earlier.setDate(earlier.getDate()-30);
  assert.equal(replace({ ...input(), window: { startDate: key(earlier), endDate: today } }).ok, false);
  assert.equal(replace(input(Array(91).fill(sample))).ok, false);
});
check(() => {
  const dom = new JSDOM('', { url: 'https://today.test' });
  const prior = globalThis.window; globalThis.window = dom.window;
  const events = []; dom.window.addEventListener('today:wearable-preview-changed', event => events.push(event.detail));
  const before = Object.fromEntries(Object.entries(dom.window.localStorage));
  replace(input()); clear();
  assert.equal(events.length, 2);
  assert.deepEqual(Object.keys(events[0]), ['revision']);
  assert.equal(events[1].revision > events[0].revision, true);
  assert.deepEqual(Object.fromEntries(Object.entries(dom.window.localStorage)), before);
  if (prior === undefined) delete globalThis.window; else globalThis.window = prior;
  dom.window.close();
});
console.log(`NUT-019.2 Wearable Context Session: ${count}/${count} başarılı`);
