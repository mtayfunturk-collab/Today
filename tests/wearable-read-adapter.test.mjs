import assert from 'node:assert/strict';
import { createWearableReader, NOTIFICATION_PREVIEW, NOTIFICATION_TEMPLATES } from '../modules/wearable-read-adapter.mjs';
let count = 0;
async function check(callback) { await callback(); count += 1; }
const options = { userConfirmed: true, purpose: 'Today gözlemleri', types: ['steps'], startDate: '2026-10-01', endDate: '2026-10-29' };
const sample = { type: 'steps', localDate: '2026-10-29', value: 3210, unit: 'count', sourceId: 'synthetic-native-aggregate', aggregation: 'daily-deduplicated' };
const provider = (samples = [sample]) => ({ kind: 'apple-health', requestReadPermission: async () => true, readDailySummaries: async () => samples });
await check(async () => {
  const reader = createWearableReader();
  assert.equal(reader.getAvailability().supported, false);
  assert.equal((await reader.read(options)).error.code, 'native-provider-unavailable');
});
await check(async () => {
  let requests = 0; const p = provider(); p.requestReadPermission = async () => { requests += 1; return true; };
  const reader = createWearableReader(p); assert.equal(requests, 0);
  assert.equal((await reader.read({ ...options, userConfirmed: false })).ok, false); assert.equal(requests, 0);
});
await check(async () => {
  const result = await createWearableReader(provider([{ ...sample, privateNote: 'must-not-return' }])).read(options);
  assert.equal(result.ok, true); assert.equal(result.samples[0].value, 3210);
  assert.equal(JSON.stringify(result).includes('must-not-return'), false); assert.equal(Object.isFrozen(result.samples), true);
});
await check(async () => {
  const result = await createWearableReader(provider([])).read(options);
  assert.equal(result.status, 'no-readable-data'); assert.equal(result.permissionState, 'not-inferred');
  assert.deepEqual(result.samples, []);
});
await check(async () => {
  for (const patch of [{ unit: 'bpm' }, { value: -1 }, { value: null }, { type: 'heart-rate' }, { aggregation: 'raw' }, { localDate: '2026-11-01' }]) {
    assert.equal((await createWearableReader(provider([{ ...sample, ...patch }])).read(options)).ok, false);
  }
  assert.equal((await createWearableReader(provider([sample, sample])).read(options)).ok, false);
});
await check(async () => {
  let scope; const p = provider(); p.kind = 'health-connect'; p.requestReadPermission = async value => { scope = value; return true; };
  const result = await createWearableReader(p).read(options);
  assert.equal(scope.readOnly, true); assert.deepEqual(scope.types, ['steps']);
  assert.equal(result.samples[0].provider, 'health-connect');
});
await check(async () => {
  const p = provider(); p.readDailySummaries = async () => { throw new Error('private health details'); };
  const result = await createWearableReader(p).read(options);
  assert.equal(result.error.code, 'provider-read-failed'); assert.equal(JSON.stringify(result).includes('private health'), false);
});
await check(() => {
  assert.equal(NOTIFICATION_PREVIEW, NOTIFICATION_TEMPLATES.aiObservation);
  assert.equal(NOTIFICATION_PREVIEW.title, 'Today');
  assert.equal(NOTIFICATION_PREVIEW.body, 'Today, yeni bir gözlemin var. Uygulamayı açıp inceleyebilirsin.');
});
await check(() => {
  assert.deepEqual(NOTIFICATION_TEMPLATES.appUpdate, {
    title: 'Today Yenilik',
    body: 'Today’in yeni sürümü hazır. Yenilikleri görmek için uygulamayı aç.'
  });
  assert.notEqual(NOTIFICATION_TEMPLATES.appUpdate, NOTIFICATION_TEMPLATES.aiObservation);
  assert.doesNotMatch(NOTIFICATION_TEMPLATES.appUpdate.body, /gözlem/i);
});
await check(() => {
  assert.equal(Object.isFrozen(NOTIFICATION_TEMPLATES), true);
  for (const template of Object.values(NOTIFICATION_TEMPLATES)) {
    assert.equal(Object.isFrozen(template), true);
    assert.doesNotMatch(`${template.title} ${template.body}`, /uyku|adım|nabız|yorgun|teşhis/i);
    assert.throws(() => { template.body = 'private health details'; }, TypeError);
  }
});
console.log(`NUT-019.1 Wearable Read Contract: ${count}/${count} başarılı`);
