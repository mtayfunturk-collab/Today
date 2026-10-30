import assert from 'node:assert/strict';
import { KEY, RETENTION_MS, defaultState, sanitizeObservation, createNotificationStore } from '../modules/notification-store.mjs';

let count = 0;
const NOW = '2030-01-15T12:00:00.000Z';
const copy = value => JSON.parse(JSON.stringify(value));
const report = () => ({
  schemaVersion: 1, window: { startDate: '2030-01-08', endDate: '2030-01-14', days: 7, maxEventsPerSource: 366 },
  observedDays: 1, omittedEvents: 0, status: 'observed',
  observations: [{ metric: 'wearable-steps', kind: 'record-summary', recordedDays: 1, calendarDays: 7,
    unit: 'count', providers: ['health-connect'], values: [{ localDate: '2030-01-14', value: 1234 }], repeatedValues: [],
    evidence: [{ eventId: 'PRIVATE-EVENT-ID', source: 'today-health', localDate: '2030-01-14' }] }],
  uncertainty: ['PRIVATE_NOTE'], boundaries: { persistent: false }, rawContext: { privateNote: 'PRIVATE_RAW' }
});
const insight = () => {
  const sanitized = sanitizeObservation(report()); assert.equal(sanitized.ok, true);
  return { id: 'insight-opaque-1', createdAt: NOW, expiresAt: '2030-01-22T12:00:00.000Z',
    rulesetId: 'today:multi-window-observer:nut-019.3', window: copy(sanitized.report.window), report: copy(sanitized.report) };
};
const state = () => {
  const value = copy(defaultState()); value.preferences.aiEnabled = true; value.preferences.localTime = '22:30';
  value.insights.push(insight());
  value.dispatches.push({ id: 1903000001, kind: 'ai', insightId: value.insights[0].id, version: null,
    localDate: '2030-01-15', zone: 'Europe/Istanbul', scheduledFor: '2030-01-15T19:30:00.000Z', state: 'scheduled' });
  return value;
};
function fixture() {
  const entries = new Map([['today_store_v2', 'UNCHANGED_CORE'], ['unrelated', 'UNCHANGED_OTHER']]);
  const calls = []; let at = new Date(NOW); let failWrite = false;
  const storage = {
    getItem(key) { calls.push(['read', key]); return entries.get(key) ?? null; },
    setItem(key, value) { calls.push(['write', key]); if (failWrite) throw new Error('PRIVATE_QUOTA'); entries.set(key, value); },
    removeItem(key) { calls.push(['remove', key]); entries.delete(key); }
  };
  return { entries, calls, storage, store: createNotificationStore({ storage, now: () => at }),
    setNow(value) { at = new Date(value); }, failWrites() { failWrite = true; } };
}
function check(name, callback) { callback(); count += 1; console.log(`PASS ${name}`); }

check('Opening a missing archive is read-only and returns disabled immutable defaults', () => {
  const f = fixture(); const result = f.store.read();
  assert.equal(result.ok, true); assert.equal(result.exists, false);
  assert.equal(result.state.preferences.aiEnabled, false); assert.equal(Object.isFrozen(result.state.preferences), true);
  assert.deepEqual(f.calls, [['read', KEY]]); assert.equal(f.entries.has(KEY), false);
});
check('Approved state roundtrips without exposing mutable state or unrelated user stores', () => {
  const f = fixture(); const value = state(); assert.equal(f.store.commit(value).ok, true);
  value.insights[0].report.observations[0].values[0].value = 999;
  const stored = f.store.read(); assert.equal(stored.state.insights[0].report.observations[0].values[0].value, 1234);
  assert.equal(f.entries.get('today_store_v2'), 'UNCHANGED_CORE'); assert.equal(f.entries.get('unrelated'), 'UNCHANGED_OTHER');
  assert.equal(f.calls.every(([, key]) => key === KEY), true);
});
check('Observation archive strips raw contexts, event ids, original caveats and evidence', () => {
  const result = sanitizeObservation(report()); assert.equal(result.ok, true);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|eventId|evidence|rawContext|boundaries|maxEventsPerSource/);
  assert.equal(result.report.observations[0].providers[0], 'health-connect');
});
check('Known numeric zero is retained and unknown or malformed metrics are rejected', () => {
  const input = report(); input.observations[0].values[0].value = 0;
  assert.equal(sanitizeObservation(input).report.observations[0].values[0].value, 0);
  for (const patch of [{ metric: 'private-personality' }, { unit: 'bpm' }, { providers: ['private-device'] }]) {
    const invalid = report(); Object.assign(invalid.observations[0], patch); assert.equal(sanitizeObservation(invalid).ok, false);
  }
  input.observations[0].values[0].value = null; assert.equal(sanitizeObservation(input).ok, false);
});
check('No-observation and fabricated day coverage cannot be archived as an insight', () => {
  const input = report(); input.observations = []; input.status = 'insufficient-data';
  assert.equal(sanitizeObservation(input).ok, false);
  const invalid = report(); invalid.observedDays = 2; assert.equal(sanitizeObservation(invalid).ok, false);
});
check('Duplicate metric or duplicated calendar day is rejected', () => {
  const input = report(); input.observations.push(copy(input.observations[0])); assert.equal(sanitizeObservation(input).ok, false);
  const invalid = report(); invalid.observations[0].values.push(copy(invalid.observations[0].values[0]));
  invalid.observations[0].recordedDays = 2; assert.equal(sanitizeObservation(invalid).ok, false);
});
check('Unsanitized private fields are never accepted in already stored DTO state', () => {
  for (const mutate of [
    value => { value.privateNote = 'SECRET'; },
    value => { value.preferences.privateNote = 'SECRET'; },
    value => { value.insights[0].report.observations[0].evidence = ['SECRET']; },
    value => { value.insights[0].report.uncertainty = ['SECRET']; },
    value => { value.dispatches[0].privateNote = 'SECRET'; }
  ]) {
    const f = fixture(); const value = state(); mutate(value);
    assert.equal(f.store.commit(value).ok, false); assert.equal(f.entries.has(KEY), false);
  }
});
check('Expired result and queue ids are returned for cleanup without hidden storage mutation', () => {
  const f = fixture(); f.store.commit(state()); const original = f.entries.get(KEY);
  f.setNow('2030-01-23T12:00:00Z'); const result = f.store.read();
  assert.equal(result.ok, true); assert.deepEqual(result.state.insights, []); assert.deepEqual(result.state.dispatches, []);
  assert.deepEqual(result.expiredIds, [1903000001]); assert.equal(result.originalState.insights.length, 1);
  assert.equal(result.changed, true); assert.equal(f.entries.get(KEY), original);
});
check('Seven day expiry bound rejects a longer retention promise', () => {
  const f = fixture(); const value = state(); value.insights[0].expiresAt = '2030-01-22T12:00:00.001Z';
  assert.equal(RETENTION_MS, 7 * 86400000); assert.equal(f.store.commit(value).ok, false);
});
check('Seven insight maximum is enforced without silently dropping older data', () => {
  const f = fixture(); f.store.commit(state()); const original = f.entries.get(KEY); const value = state();
  value.insights = Array.from({ length: 8 }, (_, i) => ({ ...insight(), id: `insight-opaque-${i}` }));
  assert.equal(f.store.commit(value).ok, false); assert.equal(f.entries.get(KEY), original);
});
check('Dispatch count and numeric id uniqueness protect queue reconciliation', () => {
  const f = fixture(); const value = state(); value.dispatches.push(copy(value.dispatches[0]));
  assert.equal(f.store.commit(value).ok, false);
  value.dispatches = Array.from({ length: 15 }, (_, i) => ({ ...value.dispatches[0], id: 1903000000+i }));
  assert.equal(f.store.commit(value).ok, false);
});
check('Insight ids and timestamps cannot impersonate a raw record or future report', () => {
  for (const mutate of [value => { value.insights[0].id = 'private record id'; }, value => { value.insights[0].createdAt = '2030-01-16T12:00:00Z'; }, value => { value.insights[0].createdAt = '2029-02-30T12:00:00Z'; }]) {
    const f = fixture(); const value = state(); mutate(value); assert.equal(f.store.commit(value).ok, false);
  }
});
check('Quota failure preserves the entire prior valid state', () => {
  const f = fixture(); f.store.commit(state()); const original = f.entries.get(KEY); f.failWrites();
  const next = state(); next.preferences.localTime = '21:00';
  assert.equal(f.store.commit(next).ok, false); assert.equal(f.entries.get(KEY), original);
});
check('Corrupt existing archive blocks overwrite until an explicit reset', () => {
  const f = fixture(); f.entries.set(KEY, '{invalid');
  assert.equal(f.store.read().ok, false); assert.equal(f.store.commit(state()).ok, false);
  assert.equal(f.entries.get(KEY), '{invalid'); assert.equal(f.store.reset().ok, true);
  assert.equal(f.store.commit(state()).ok, true); assert.equal(f.entries.get('today_store_v2'), 'UNCHANGED_CORE');
});
check('Oversized persisted bytes are rejected without parsing, replacement or deletion', () => {
  const f = fixture(); const raw = 'x'.repeat(128*1024+1); f.entries.set(KEY, raw);
  assert.equal(f.store.read().ok, false); assert.equal(f.store.commit(state()).ok, false); assert.equal(f.entries.get(KEY), raw);
});
check('A valid but overly large display series exceeds the per-report 16KiB bound', () => {
  const input = report(); const end = new Date('2030-01-14T00:00:00Z'); const start = new Date(end); start.setUTCDate(start.getUTCDate()-89);
  const dates = Array.from({ length: 90 }, (_, i) => { const date = new Date(start); date.setUTCDate(date.getUTCDate()+i); return date.toISOString().slice(0,10); });
  input.window = { startDate: dates[0], endDate: dates.at(-1), days: 90 }; input.observedDays = 90;
  input.observations = ['sleep','activity','wearable-sleep-calendar-day','wearable-steps','wearable-workout-span'].map(metric => ({
    metric, kind: 'record-summary', recordedDays: 90, calendarDays: 90, values: dates.map(localDate => ({ localDate, value: 123 })), repeatedValues: [],
    ...(metric.startsWith('wearable-') ? { unit: metric === 'wearable-steps' ? 'count' : 'min', providers: ['health-connect'] } : {})
  }));
  assert.equal(sanitizeObservation(input).ok, false);
});
check('Time preferences are explicit, bounded and support overnight quiet hours', () => {
  const f = fixture(); const valid = state(); valid.preferences.quietHours = { start: '22:00', end: '07:00' };
  assert.equal(f.store.commit(valid).ok, true);
  for (const bad of [null, '24:00', '9:00']) { const invalid = state(); invalid.preferences.localTime = bad; assert.equal(f.store.commit(invalid).ok, false); }
  const invalid = state(); invalid.preferences.quietHours = { start: '10:00', end: '10:00' }; assert.equal(f.store.commit(invalid).ok, false);
});
check('Repeating analysis consent is separate, scoped and expires independently', () => {
  const f = fixture(); const value = state();
  value.dailyAnalysisConsent = { enabled: true, purpose: 'Seçili kapsamı incelemek', grantedAt: NOW,
    expiresAt: '2030-01-16T12:00:00Z', windowDays: 7, scope: { core: ['daily-choice'], health: [], sky: [] } };
  assert.equal(f.store.commit(value).ok, true); f.setNow('2030-01-17T12:00:00Z');
  assert.deepEqual(f.store.read().state.dailyAnalysisConsent, defaultState().dailyAnalysisConsent);
  value.dailyAnalysisConsent.scope.health = ['private-field']; assert.equal(f.store.commit(value).ok, false);
});
check('Disabling preferences retains cleanup ledger until OS cancellation succeeds', () => {
  const f = fixture(); const value = state(); value.preferences.aiEnabled = false;
  assert.equal(f.store.commit(value).ok, true); assert.equal(f.entries.has(KEY), true);
  const cleared = copy(value); cleared.insights = []; cleared.dispatches = [];
  assert.equal(f.store.commit(cleared).ok, true); assert.equal(f.entries.has(KEY), false);
});
check('Explicit reset only removes the new archive key', () => {
  const f = fixture(); f.store.commit(state()); f.store.reset();
  assert.equal(f.entries.has(KEY), false); assert.equal(f.entries.size, 2);
  assert.equal(f.calls.filter(([kind]) => kind === 'remove').every(([, key]) => key === KEY), true);
});
check('Invalid storage or invalid clock fails closed without a partial state', () => {
  const invalid = createNotificationStore({ storage: { getItem() { throw new Error('PRIVATE'); } } });
  assert.equal(invalid.read().ok, false); assert.doesNotMatch(JSON.stringify(invalid.read()), /PRIVATE/);
  const f = fixture(); f.setNow('invalid'); assert.equal(f.store.commit(state()).ok, false); assert.equal(f.entries.has(KEY), false);
});
console.log(`NUT-019.3 Notification Store: ${count}/${count} başarılı`);
