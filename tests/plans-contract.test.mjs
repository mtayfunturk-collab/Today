import assert from 'node:assert/strict';
import { PLAN_STATES, validatePlanItem, validatePlansSnapshot } from '../modules/plans-contract.mjs';

const time = '2026-11-23T10:00:00.000Z';
const item = { id: 'plan-1', title: 'Oku', state: 'next', createdAt: time, updatedAt: time };
let passed = 0;
function check(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }

check('four explicit states have stable identifiers', () => {
  assert.deepEqual(PLAN_STATES, ['day', 'next', 'doing', 'done']);
  assert.ok(Object.isFrozen(PLAN_STATES));
});
check('valid item is a normalized immutable copy', () => {
  const result = validatePlanItem({ ...item, title: ' Oku ' });
  assert.equal(result.title, 'Oku'); assert.equal(result.note, ''); assert.equal(result.dayKey, null);
  assert.ok(Object.isFrozen(result)); assert.equal(item.note, undefined);
});
check('one-day state requires a real calendar day', () => {
  assert.equal(validatePlanItem({ ...item, state: 'day', dayKey: '2026-11-23' }).dayKey, '2026-11-23');
  for (const dayKey of [undefined, '2026-02-30', '2026-11-23T10:00:00Z'])
    assert.throws(() => validatePlanItem({ ...item, state: 'day', dayKey }));
});
check('non-day states cannot retain stale day keys', () => {
  for (const state of ['next', 'doing', 'done']) assert.throws(() => validatePlanItem({ ...item, state, dayKey: '2026-11-23' }));
});
check('unknown states, unknown fields and external action fields fail closed', () => {
  for (const value of [null, [], {}, { ...item, state: 'archived' }, { ...item, externalCalendarId: 'x' }, { ...item, notify: true }])
    assert.throws(() => validatePlanItem(value));
});
check('identifier, title and note have bounded plain text', () => {
  for (const value of [{ ...item, id: '' }, { ...item, title: 'x'.repeat(121) }, { ...item, title: 'bad\nline' }, { ...item, note: 'x'.repeat(1001) }])
    assert.throws(() => validatePlanItem(value));
});
check('timestamps are canonical, real and ordered', () => {
  for (const value of [{ ...item, createdAt: '2026-02-30T10:00:00.000Z' }, { ...item, updatedAt: '2026-11-22T10:00:00.000Z' }, { ...item, updatedAt: '2026-11-23T11:00:00Z' }])
    assert.throws(() => validatePlanItem(value));
});
check('empty and bounded snapshots preserve input', () => {
  assert.deepEqual(validatePlansSnapshot({ version: 1, items: [] }), { version: 1, items: [] });
  const input = { version: 1, items: [item] }, result = validatePlansSnapshot(input);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.items));
  assert.equal(result.items[0].id, item.id); assert.equal(input.items[0].note, undefined);
});
check('duplicate ids, unknown shape and excessive entries fail closed', () => {
  for (const value of [{ version: 1, items: [item, { ...item }] }, { version: 2, items: [] }, { version: 1, items: [], remoteSync: true }, { version: 1, items: Array.from({ length: 501 }, (_, i) => ({ ...item, id: `id-${i}` })) }])
    assert.throws(() => validatePlansSnapshot(value));
});

console.log(`Plans Contract: ${passed}/9 başarılı`);
