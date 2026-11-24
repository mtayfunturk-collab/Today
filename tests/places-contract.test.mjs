import assert from 'node:assert/strict';
import { PLACE_STATES, validatePlace, validatePlacesSnapshot } from '../modules/places-contract.mjs';

const at = '2026-11-23T10:00:00.000Z';
const place = { id: 'place-1', name: 'Müze', city: 'İstanbul', state: 'want', createdAt: at, updatedAt: at };
let passed = 0;
function check(name, callback) { callback(); passed++; console.log(`PASS ${name}`); }

check('two states have stable identifiers', () => { assert.deepEqual(PLACE_STATES, ['want', 'visited']); assert.ok(Object.isFrozen(PLACE_STATES)); });
check('manual place normalizes into an immutable copy', () => {
  const result = validatePlace({ ...place, name: ' Müze ' });
  assert.equal(result.name, 'Müze'); assert.equal(result.note, ''); assert.equal(result.address, '');
  assert.ok(Object.isFrozen(result)); assert.equal(place.note, undefined);
});
check('visited state requires no GPS, route or external service', () => {
  assert.equal(validatePlace({ ...place, state: 'visited' }).state, 'visited');
});
check('optional HTTP links are retained without fetching', () => {
  assert.equal(validatePlace({ ...place, url: 'https://example.test/place' }).url, 'https://example.test/place');
});
check('unsafe and credential URLs are rejected', () => {
  for (const url of ['javascript:alert(1)', 'file:///tmp/x', 'data:text/plain,x', 'https://user:pass@example.test/', 'not a url'])
    assert.throws(() => validatePlace({ ...place, url }));
});
check('unknown fields and unsupported states fail closed', () => {
  for (const value of [null, [], {}, { ...place, state: 'route' }, { ...place, latitude: 41 }, { ...place, autoOpenMap: true }])
    assert.throws(() => validatePlace(value));
});
check('manual text is required, bounded and free of controls', () => {
  for (const value of [{ ...place, name: '' }, { ...place, city: ' ' }, { ...place, name: 'x'.repeat(121) }, { ...place, note: 'bad\nline' }, { ...place, address: 'x'.repeat(301) }])
    assert.throws(() => validatePlace(value));
});
check('timestamps are real, canonical and ordered', () => {
  for (const value of [{ ...place, createdAt: '2026-02-30T10:00:00.000Z' }, { ...place, updatedAt: '2026-11-22T10:00:00.000Z' }, { ...place, updatedAt: '2026-11-23T10:00:00Z' }])
    assert.throws(() => validatePlace(value));
});
check('empty and populated snapshots preserve source', () => {
  assert.deepEqual(validatePlacesSnapshot({ version: 1, items: [] }), { version: 1, items: [] });
  const input = { version: 1, items: [place] }, result = validatePlacesSnapshot(input);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.items)); assert.equal(input.items[0].note, undefined);
});
check('duplicate IDs, unknown fields and oversized snapshots are rejected', () => {
  for (const value of [{ version: 1, items: [place, { ...place }] }, { version: 2, items: [] }, { version: 1, items: [], remoteSync: true }, { version: 1, items: Array.from({ length: 501 }, (_, i) => ({ ...place, id: `place-${i}` })) }])
    assert.throws(() => validatePlacesSnapshot(value));
});

console.log(`Places Contract: ${passed}/10 başarılı`);
