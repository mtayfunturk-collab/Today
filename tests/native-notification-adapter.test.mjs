import assert from 'node:assert/strict';
import { createNativeNotificationAdapter, NOTIFICATION_ID_MIN as ID } from '../modules/native-notification-adapter.mjs';
import { NOTIFICATION_TEMPLATES } from '../modules/wearable-read-adapter.mjs';

const NOW = new Date('2030-01-01T12:00:00.000Z');
const candidate = { id: ID, kind: 'ai', insightId: 'insight:synthetic-1', scheduledFor: '2030-01-01T13:00:00.000Z' };
let count = 0;
async function check(callback) { await callback(); count += 1; }
async function fixture(platform = 'android') {
  const calls = []; let status = 'granted'; let pending = []; let delivered = []; let action;
  const plugin = {
    async checkPermissions() { calls.push(['check']); return { display: status }; },
    async requestPermissions() { calls.push(['request']); return { display: status }; },
    async createChannel(options) { calls.push(['channel', options]); },
    async schedule(options) { calls.push(['schedule', options]); return { notifications: options.notifications.map(({ id }) => ({ id })) }; },
    async getPending() { calls.push(['pending']); return { notifications: pending }; },
    async cancel(options) { calls.push(['cancel', options]); },
    async getDeliveredNotifications() { calls.push(['delivered']); return { notifications: delivered }; },
    async removeDeliveredNotifications(options) { calls.push(['remove', options]); },
    async addListener(name, listener) { calls.push(['listener', name]); action = listener; return { remove: async () => { calls.push(['unsubscribe']); } }; }
  };
  const bridge = { platform, isNative: true, pluginAvailable: true, notifications: plugin };
  const adapter = await createNativeNotificationAdapter(bridge, { now: () => new Date(NOW) });
  return { adapter, bridge, plugin, calls, status: value => { status = value; }, pending: value => { pending = value; },
    delivered: value => { delivered = value; }, emit: value => action(value) };
}

await check(async () => {
  const adapter = await createNativeNotificationAdapter();
  assert.equal(adapter.supported, false);
  assert.equal((await adapter.checkPermission()).granted, false);
  assert.equal((await adapter.schedule(candidate)).ok, false);
  await assert.rejects(() => adapter.getPending(), /unavailable/);
});
await check(async () => {
  const f = await fixture(); assert.equal(f.adapter.supported, true); assert.deepEqual(f.calls, []);
  assert.equal((await createNativeNotificationAdapter({ ...f.bridge, pluginAvailable: false })).supported, false);
  assert.equal((await createNativeNotificationAdapter({ ...f.bridge, isNative: false })).supported, false);
  assert.deepEqual(f.calls, []);
});
await check(async () => {
  const f = await fixture(); f.status('prompt');
  assert.equal((await f.adapter.checkPermission()).granted, false);
  assert.equal(f.calls.filter(([kind]) => kind === 'request').length, 0);
  f.status('granted'); assert.equal((await f.adapter.requestPermission()).granted, true);
  assert.equal(f.calls.filter(([kind]) => kind === 'request').length, 1);
});
await check(async () => {
  const f = await fixture(); f.status('denied');
  assert.equal((await f.adapter.schedule(candidate)).error, 'notification-permission-required');
  assert.deepEqual(f.calls.map(([kind]) => kind), ['check']);
});
await check(async () => {
  const f = await fixture(); const result = await f.adapter.schedule(candidate); assert.equal(result.ok, true);
  const payload = f.calls.find(([kind]) => kind === 'schedule')[1].notifications[0];
  assert.equal(payload.title, NOTIFICATION_TEMPLATES.aiObservation.title);
  assert.equal(payload.body, 'Today, yeni bir gözlemin var. Uygulamayı açıp inceleyebilirsin.');
  assert.deepEqual(payload.extra, { kind: 'ai', insightId: candidate.insightId });
  assert.equal(payload.isExactNotification, false); assert.equal(payload.isExactMandatory, false);
  assert.equal(payload.schedule.allowWhileIdle, false);
  assert.equal(Object.hasOwn(payload.schedule, 'isExactNotification'), false);
  assert.equal(Object.hasOwn(payload.schedule, 'repeats'), false);
  assert.equal(payload.schedule.at.toISOString(), candidate.scheduledFor);
  assert.equal(f.calls.some(([kind]) => kind === 'request'), false);
  assert.doesNotMatch(JSON.stringify(payload), /uyku|nabız|yorgun|private|largeBody|attachment/i);
});
await check(async () => {
  const f = await fixture('ios');
  assert.equal((await f.adapter.schedule({ id: ID+1, kind: 'update', version: '2.20.0', scheduledFor: candidate.scheduledFor })).ok, true);
  const payload = f.calls.find(([kind]) => kind === 'schedule')[1].notifications[0];
  assert.equal(payload.title, 'Today Yenilik'); assert.deepEqual(payload.extra, { kind: 'update', version: '2.20.0' });
  assert.equal(f.calls.some(([kind]) => kind === 'channel'), false);
});
await check(async () => {
  const f = await fixture();
  for (const patch of [{ id: 4 }, { id: ID + 0.5 }, { scheduledFor: NOW.toISOString() }, { scheduledFor: '2031-01-01T00:00:00Z' },
    { body: 'private health summary' }, { extra: { private: true } }, { insightId: '<script>' }, { kind: 'unknown' }, { version: '2.20.0' }]) {
    assert.equal((await f.adapter.schedule({ ...candidate, ...patch })).ok, false);
  }
  assert.deepEqual(f.calls, []);
});
await check(async () => {
  const f = await fixture();
  f.plugin.createChannel = async () => { f.status('denied'); };
  assert.equal((await f.adapter.schedule(candidate)).error, 'notification-permission-required');
  assert.equal(f.calls.some(([kind]) => kind === 'schedule' || kind === 'request'), false);
});
await check(async () => {
  const f = await fixture(); f.plugin.schedule = async () => ({ notifications: [] });
  assert.equal((await f.adapter.schedule(candidate)).ok, false);
  assert.deepEqual(f.calls.find(([kind]) => kind === 'cancel')[1], { notifications: [{ id: ID }] });
});
await check(async () => {
  const f = await fixture();
  f.pending([{ id: 1, extra: { kind: 'ai', insightId: 'other' } },
    { id: ID, extra: { kind: 'ai', insightId: candidate.insightId, privateNote: 'secret' }, title: 'private title' },
    { id: ID+1, extra: { kind: 'ai', insightId: '<bad>' } }]);
  assert.deepEqual(await f.adapter.getPending(), [{ id: ID, kind: 'ai', insightId: candidate.insightId }, { id: ID+1, kind: null }]);
  assert.doesNotMatch(JSON.stringify(await f.adapter.getPending()), /secret|private title/);
});
await check(async () => {
  const f = await fixture();
  f.delivered([{ id: ID, data: { 'android.title': 'private title' } }, { id: 1 }]);
  // Android exposes no reliable custom extra for delivered notifications.
  assert.deepEqual(await f.adapter.getDelivered(), [{ id: ID, kind: null }]);
  await f.adapter.removeDelivered([ID]);
  assert.deepEqual(f.calls.find(([kind]) => kind === 'remove')[1], { notifications: [{ id: ID }] });
});
await check(async () => {
  const f = await fixture();
  assert.equal((await f.adapter.cancel([1])).ok, false);
  assert.equal((await f.adapter.removeDelivered([ID, 1])).ok, false);
  assert.deepEqual(f.calls, []);
  await f.adapter.cancel([ID, ID]);
  assert.deepEqual(f.calls[0][1], { notifications: [{ id: ID }] });
});
await check(async () => {
  const f = await fixture(); const observed = [];
  const handle = await f.adapter.onAction(action => observed.push(action));
  f.emit({ notification: { id: 1, extra: { kind: 'ai', insightId: 'foreign' } } });
  f.emit({ notification: { id: ID, extra: { kind: 'ai', insightId: '<bad>' } } });
  f.emit({ notification: { id: ID, body: 'private body', extra: { kind: 'ai', insightId: candidate.insightId, privateNote: 'secret' } } });
  assert.deepEqual(observed, [{ id: ID, kind: 'ai', insightId: candidate.insightId }]);
  await handle.remove(); assert.equal(f.calls.at(-1)[0], 'unsubscribe');
});
await check(async () => {
  const f = await fixture();
  f.plugin.getPending = async () => { throw Error('private health detail'); };
  await assert.rejects(() => f.adapter.getPending(), error => error.message === 'native-notification-queue-unavailable');
  f.plugin.schedule = async () => { throw Error('private health detail'); };
  assert.deepEqual(await f.adapter.schedule(candidate), { ok: false, error: 'notification-schedule-failed' });
});
await check(async () => {
  const f = await fixture(); f.plugin.checkPermissions = async () => ({ display: 'invalid-native-value' });
  assert.equal((await f.adapter.checkPermission()).ok, false);
  assert.equal((await f.adapter.schedule(candidate)).ok, false);
  assert.equal(f.calls.some(([kind]) => kind === 'request' || kind === 'schedule'), false);
});

console.log(`NUT-019.3 Native Notification Adapter: ${count}/${count} başarılı`);
