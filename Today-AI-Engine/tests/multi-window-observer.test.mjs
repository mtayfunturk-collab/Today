import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildTodayContext } from '../src/context-builder.mjs';
import { observeMultiWindow } from '../src/multi-window-observer.mjs';

export async function runMultiWindowTests() {
  const template = JSON.parse(await readFile(new URL('../fixtures/synthetic/nut-017.1-context-request.json', import.meta.url), 'utf8'));
  let checks = 0;
  const check = callback => { callback(); checks += 1; };
  const date = ago => new Date(Date.UTC(2040, 0, 15 - ago)).toISOString().slice(0, 10);
  const event = (source, type, payload, ago = 0, suffix = '') => ({
    schemaVersion: 1, eventId: `${source}:${type}:${ago}${suffix}`, source, eventType: type,
    createdAt: `${date(ago)}T12:00:00Z`, localDate: date(ago), payload
  });
  const core = (ago = 0, choice = 'C', suffix = '') => event('today-core', 'daily-checkin', { choice }, ago, suffix);
  const sleep = (ago = 0, durationMinutes = 330, suffix = '') => event('today-health', 'sleep-record', { durationMinutes }, ago, suffix);
  const build = (days, events, edit = () => {}) => {
    const request = structuredClone(template);
    request.consent.grantedAt = '2039-01-01T00:00:00Z';
    request.window = { startDate: date(days - 1), endDate: date(0), maxEventsPerSource: 366 };
    request.events = events; edit(request);
    const built = buildTodayContext(request);
    assert.equal(built.ok, true, JSON.stringify(built.error));
    return built.context;
  };
  const run = context => observeMultiWindow({ context, requestedAt: template.requestedAt });
  for (const days of [1, 7, 30, 90]) check(() => {
    const result = run(build(days, [core(), sleep()]));
    assert.equal(result.ok, true); assert.equal(result.report.window.days, days);
    assert.equal(result.report.observedDays, 1);
    assert.equal(result.report.observations.some(item => item.kind === 'preliminary-recurrence'), false);
  });
  check(() => {
    const result = run(build(1, [core()]));
    assert.equal(result.report.observations[0].kind, 'daily-observation');
    assert.equal(result.report.observations[0].values[0].value, 'C');
  });
  check(() => {
    const report = run(build(30, [core(), core(8), sleep(), sleep(8)])).report;
    const recurrence = report.observations.find(item => item.kind === 'preliminary-recurrence');
    assert.equal(recurrence.matchingDays, 2); assert.equal(recurrence.recordedDays, 2);
    assert.equal(recurrence.calendarDays, 30); assert.equal(report.observedDays, 2);
  });
  check(() => {
    const report = run(build(7, [core(), core(1, 'B'), sleep(), sleep(1, 500)])).report;
    assert.equal(report.observations.some(item => item.kind === 'preliminary-recurrence'), false);
  });
  check(() => {
    const context = build(7, [core(), core(1)]);
    const repeats = run(context).report.observations[0].repeatedValues;
    assert.deepEqual(repeats, [{ value: 'C', recordedDays: 2 }]);
  });
  check(() => {
    const later = sleep(0, 450, ':later'); later.createdAt = `${date(0)}T13:00:00Z`;
    const report = run(build(7, [sleep(), later])).report;
    assert.equal(report.observations[0].recordedDays, 1);
    assert.equal(report.observations[0].values[0].value, 450);
  });
  check(() => {
    const a = sleep(0, 450, ':a'); a.createdAt = `${date(0)}T13:00:00+01:00`;
    const b = sleep(0, 400, ':b'); b.createdAt = `${date(0)}T12:30:00Z`;
    assert.equal(run(build(7, [a, b])).report.observations[0].values[0].value, 400);
  });
  check(() => {
    const rows = [core(), sleep(), core(2), sleep(2)];
    assert.deepEqual(run(build(7, rows)), run(build(7, [...rows].reverse())));
  });
  check(() => {
    const result = run(build(90, []));
    assert.equal(result.report.status, 'insufficient-data'); assert.equal(result.report.observedDays, 0);
    assert.deepEqual(result.report.observations, []);
  });
  check(() => {
    const result = run(build(1, [sleep(0, 0)]));
    assert.equal(result.report.observations[0].values[0].value, 0);
    assert.equal(run(build(1, [sleep(0, null)])).report.observations.length, 0);
  });
  check(() => {
    const report = run(build(1, [event('today-health', 'energy-record', { energy: 'high', fatigue: 'none' }),
      event('today-health', 'workout-record', { durationMinutes: 20 })])).report;
    assert.deepEqual(report.observations.map(item => item.metric), ['energy', 'fatigue', 'activity']);
  });
  check(() => {
    const context = build(7, [core(), sleep()], request => {
      request.consent.permissions.health.allowed = false;
      request.consent.permissions.health.dataClasses = [];
    });
    assert.deepEqual(run(context).report.observations.map(item => item.metric), ['core']);
  });
  check(() => {
    const report = run(build(7, [core()], request => { request.consent.permissions.core.dataClasses = ['color']; })).report;
    assert.equal(report.observations.length, 0);
  });
  for (const edit of [
    c => { c.processing.externalRecipient = 'third-party'; },
    c => { c.consentReceipt.granted = false; },
    c => { c.consentReceipt.purpose = 'other'; },
    c => { c.boundaries.skyCausalityAllowed = true; },
    c => { c.provenance = []; },
    c => { c.sections.core.push(structuredClone(c.sections.core[0])); },
    c => { c.sections.core[0].localDate = '2040-02-30'; },
    c => { c.sections.core[0].createdAt = '2041-01-01T00:00:00Z'; },
    c => { c.window.startDate = date(3); },
    c => { c.sections.core[0].source = 'today-sky'; }
  ]) check(() => {
    const context = structuredClone(build(7, [core()])); edit(context);
    assert.equal(run(context).ok, false);
  });
  check(() => {
    const result = run(build(30, [core(), sleep()]));
    assert.equal(Object.isFrozen(result.report.observations[0].values), true);
    assert.equal(Object.values(result.report.boundaries).filter(Boolean).length, 1);
    assert.equal(JSON.stringify(result).includes('payload'), false);
  });
  check(() => {
    const context = build(7, [core(), sleep()]);
    const withSky = structuredClone(context);
    withSky.sections.symbolicContext.items.push({ facts: { privateBirthData: 'not-for-health' } });
    assert.deepEqual(run(context), run(withSky));
    assert.equal(JSON.stringify(run(withSky)).includes('privateBirthData'), false);
  });
  check(() => { assert.equal(observeMultiWindow(null).ok, false); assert.equal(observeMultiWindow().ok, false); });
  return checks;
}
