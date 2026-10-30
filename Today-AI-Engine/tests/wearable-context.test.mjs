import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildTodayContext } from '../src/context-builder.mjs';
import { DATA_CLASSES, evaluateDataUsageConsent } from '../src/data-usage-consent.mjs';
import { observeMultiWindow } from '../src/multi-window-observer.mjs';
import { analyzeTodayContext, CAPABILITY as DAILY_CAPABILITY } from '../src/daily-support-analyzer.mjs';
import { observeTodayPattern, CAPABILITY as PATTERN_CAPABILITY } from '../src/pattern-observer.mjs';

const CLASSES = ['wearable-sleep-calendar-day', 'wearable-steps', 'wearable-workout-span'];
const TYPES = ['wearable-sleep-summary', 'wearable-steps-summary', 'wearable-workout-summary'];
const DATE = '2040-01-15';
const AT = '2040-01-16T12:00:00.000Z';

export async function runWearableContextTests() {
  const template = JSON.parse(await readFile(new URL('../fixtures/synthetic/nut-017.1-context-request.json', import.meta.url), 'utf8'));
  const consentSchema = JSON.parse(await readFile(new URL('../contracts/data-usage-consent.schema.json', import.meta.url), 'utf8'));
  let checks = 0;
  const check = callback => { callback(); checks += 1; };
  const event = (type, payload, date = DATE, suffix = '') => ({
    schemaVersion: 1, eventId: `${type}:${date}${suffix}`, source: 'today-health', eventType: type,
    createdAt: `${date}T12:00:00.000Z`, localDate: date, payload
  });
  const wearable = (index = 0, value = index === 1 ? 1234 : 240, date = DATE, suffix = '') =>
    event(TYPES[index], { value, unit: index === 1 ? 'count' : 'min', provider: 'health-connect', aggregation: 'daily-deduplicated' }, date, suffix);
  const core = (date = DATE) => ({ ...event('daily-checkin', { choice: 'C' }, date), source: 'today-core' });
  const manualSleep = (minutes = 420, date = DATE) => event('sleep-record', { durationMinutes: minutes }, date);
  const request = (events = [], days = 7, edit = () => {}) => {
    const value = structuredClone(template);
    const start = new Date(`${DATE}T00:00:00Z`); start.setUTCDate(start.getUTCDate() - days + 1);
    value.window = { startDate: start.toISOString().slice(0, 10), endDate: DATE, maxEventsPerSource: 366 };
    value.consent.grantedAt = '2039-01-01T00:00:00.000Z';
    value.consent.permissions.health.dataClasses.push(...CLASSES);
    value.events = events; edit(value);
    return value;
  };
  const build = (events, days, edit) => {
    const result = buildTodayContext(request(events, days, edit));
    assert.equal(result.ok, true, JSON.stringify(result.error));
    return result.context;
  };
  const observe = context => {
    const result = observeMultiWindow({ context, requestedAt: AT });
    assert.equal(result.ok, true, JSON.stringify(result.error));
    return result.report;
  };
  const daily = context => analyzeTodayContext({ schemaVersion: 1, analysisId: 'analysis:wearable-test', capability: DAILY_CAPABILITY, requestedAt: AT, context });
  const pattern = context => observeTodayPattern({ schemaVersion: 1, observationId: 'observation:wearable-test', capability: PATTERN_CAPABILITY, requestedAt: AT, context });

  check(() => {
    const schemaClasses = consentSchema.$defs.healthPermission.allOf[1].properties.dataClasses.items.enum;
    assert.deepEqual(schemaClasses, DATA_CLASSES.health);
    assert.equal(evaluateDataUsageConsent(request().consent, { purpose: template.purpose, at: AT }).ok, true);
  });
  check(() => {
    const context = build(TYPES.map((_, index) => wearable(index)));
    assert.equal(context.schemaVersion, 1);
    assert.deepEqual(context.sections.health.map(item => item.eventType), TYPES.slice().sort());
    for (const item of context.sections.health) {
      assert.deepEqual(Object.keys(item.facts), ['value', 'unit', 'provider', 'aggregation']);
      assert.equal(item.dataClasses.length, 1);
      assert.equal(item.facts.provider, 'health-connect');
      assert.equal(context.provenance.some(row => row.eventId === item.eventId && row.source === 'today-health'), true);
    }
    assert.equal(context.boundaries.storageAccessed, false);
    assert.equal(context.boundaries.externalTransfer, false);
  });
  check(() => {
    const context = build(TYPES.map((_, index) => wearable(index)), 7, value => {
      value.consent.permissions.health.dataClasses = ['sleep', 'activity'];
    });
    assert.deepEqual(context.sections.health, []);
    assert.equal(context.omissions.length, 3);
    assert.equal(context.omissions.every(item => item.reason === 'data-class-not-consented'), true);
  });
  for (let index = 0; index < TYPES.length; index += 1) check(() => {
    const context = build(TYPES.map((_, selected) => wearable(selected)), 7, value => {
      value.consent.permissions.health.dataClasses = [CLASSES[index]];
    });
    assert.deepEqual(context.sections.health.map(item => item.eventType), [TYPES[index]]);
  });
  check(() => {
    const context = build([manualSleep(), event('workout-record', { durationMinutes: 30 }), wearable()], 7, value => {
      value.consent.permissions.health.dataClasses = [...CLASSES];
    });
    assert.deepEqual(context.sections.health.map(item => item.eventType), ['wearable-sleep-summary']);
    assert.equal(context.omissions.length, 2);
  });
  check(() => {
    const context = build([core(), wearable()], 7, value => {
      value.consent.permissions.health = { allowed: false, dataClasses: [], includeFreeText: false };
    });
    assert.equal(context.sections.core.length, 1);
    assert.equal(context.sections.health.length, 0);
    assert.equal(context.omissions[0].reason, 'source-not-consented');
  });
  check(() => {
    const context = build([wearable(0, 0), wearable(1, 0), wearable(2, 0)]);
    assert.equal(context.sections.health.length, 3);
    assert.equal(observe(context).observations.every(item => item.values[0].value === 0), true);
  });
  for (const patch of [
    { value: null }, { value: '20' }, { value: -1 }, { value: Infinity }, { value: 1441 },
    { unit: 'count' }, { provider: 'unknown-device' }, { aggregation: 'raw-samples' }
  ]) check(() => {
    const value = wearable(); Object.assign(value.payload, patch);
    const context = build([value]);
    assert.equal(context.sections.health.length, 0);
    assert.equal(context.omissions[0].reason, 'invalid-wearable-summary');
    assert.equal(observe(context).status, 'insufficient-data');
  });
  check(() => {
    for (const value of [1.5, 1000001]) {
      const context = build([wearable(1, value)]);
      assert.equal(context.sections.health.length, 0);
      assert.equal(context.omissions[0].reason, 'invalid-wearable-summary');
    }
  });
  check(() => {
    const value = wearable(); Object.assign(value.payload, { note: 'private sleep note', sourceId: 'private-watch-id', clinicalData: { secret: true } });
    const context = build([value], 7, value => { value.consent.permissions.health.includeFreeText = true; });
    assert.deepEqual(Object.keys(context.sections.health[0].facts), ['value', 'unit', 'provider', 'aggregation']);
    assert.equal(context.boundaries.freeTextIncluded, false);
    assert.equal(context.redactions.length, 3);
    assert.doesNotMatch(JSON.stringify(context), /private sleep note|private-watch-id|"secret"/);
  });
  for (const days of [1, 7, 30, 90]) check(() => {
    const report = observe(build([wearable(1)], days));
    assert.equal(report.window.days, days);
    assert.equal(report.observedDays, 1);
    assert.equal(report.observations[0].calendarDays, days);
    assert.equal(report.observations[0].recordedDays, 1);
    assert.equal(report.observations[0].metric, 'wearable-steps');
    assert.equal(report.observations[0].unit, 'count');
    assert.deepEqual(report.observations[0].providers, ['health-connect']);
  });
  check(() => {
    const context = build([manualSleep(420), event('workout-record', { durationMinutes: 30 }), wearable(0, 120), wearable(1, 1234), wearable(2, 90)]);
    const report = observe(context);
    assert.deepEqual(report.observations.map(item => [item.metric, item.values[0].value]), [
      ['sleep', 420], ['activity', 30], ['wearable-sleep-calendar-day', 120], ['wearable-steps', 1234], ['wearable-workout-span', 90]
    ]);
    assert.equal(report.observations.every(item => item.recordedDays === 1), true);
  });
  check(() => {
    const context = build([core(), core('2040-01-14'), wearable(0, 120), wearable(0, 120, '2040-01-14')]);
    assert.equal(observe(context).observations.some(item => item.metric === 'core-short-sleep'), false);
    assert.equal(daily(context).ok, false);
    assert.equal(daily(context).error.code, 'no-matching-rule');
    const result = pattern(context);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'insufficient-paired-days');
    assert.equal(result.error.patternEvaluation.counts.eligibleDays, 0);
  });
  check(() => {
    const context = build([core(), manualSleep(420), wearable(0, 120)]);
    assert.equal(daily(context).ok, false);
    assert.equal(daily(context).error.code, 'no-matching-rule');
  });
  check(() => {
    const context = build([core(), manualSleep(330), wearable(0, 800)]);
    const result = daily(context);
    assert.equal(result.ok, true, JSON.stringify(result.error));
    assert.deepEqual(result.analysis, daily(build([core(), manualSleep(330)])).analysis);
    assert.equal(result.analysis.evidence.some(item => item.eventId.startsWith('wearable-')), false);
  });
  check(() => {
    const context = build([wearable(1)]);
    const report = observe(context);
    assert.equal(report.observations[0].values.length, 1);
    assert.deepEqual(report.observations[0].repeatedValues, []);
    assert.equal(report.observedDays, 1);
    assert.equal(Object.isFrozen(report.observations[0].providers), true);
  });
  check(() => {
    const earlier = wearable(1, 500, DATE, ':older');
    const later = wearable(1, 800, DATE, ':newer'); later.createdAt = `${DATE}T13:00:00Z`; later.payload.provider = 'apple-health';
    const report = observe(build([later, earlier]));
    assert.deepEqual(report.observations[0].values, [{ localDate: DATE, value: 800 }]);
    assert.deepEqual(report.observations[0].providers, ['apple-health']);
    assert.equal(report.observations[0].evidence[0].eventId, later.eventId);
  });
  check(() => {
    const context = build([wearable(), wearable(1), wearable(2)], 7, value => { value.window.maxEventsPerSource = 2; });
    assert.equal(context.sections.health.length, 2);
    assert.equal(context.omissions.some(item => item.reason === 'source-event-limit'), true);
    assert.equal(observe(context).omittedEvents, 1);
  });
  check(() => {
    const old = wearable(1, 20, '2040-01-08');
    const future = wearable(1); future.createdAt = '2040-01-17T00:00:00.000Z';
    const context = build([old, future]);
    assert.deepEqual(context.sections.health, []);
    assert.deepEqual(context.omissions.map(item => item.reason), ['outside-request-window', 'event-created-after-request']);
  });
  for (const edit of [
    item => { item.facts.value = null; },
    item => { item.facts.unit = 'bpm'; },
    item => { item.facts.provider = 'unknown'; },
    item => { item.facts.aggregation = 'raw'; },
    item => { item.facts.privateNote = 'must-not-return'; },
    item => { item.dataClasses = ['sleep']; },
    item => { item.dataClasses.push('sleep'); }
  ]) check(() => {
    const context = structuredClone(build([wearable()])); edit(context.sections.health[0]);
    assert.equal(observeMultiWindow({ context, requestedAt: AT }).ok, false);
  });
  check(() => {
    const rows = [wearable(), wearable(1), wearable(2), manualSleep(), core()];
    assert.deepEqual(observe(build(rows)), observe(build([...rows].reverse())));
  });
  return checks;
}
