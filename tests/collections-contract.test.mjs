import assert from 'node:assert/strict';
import { validateCollectionBoard, validateCollectionItem, validateCollectionsSnapshot } from '../modules/collections-contract.mjs';

const time = '2026-11-23T10:00:00.000Z';
const board = { id: 'board-1', title: 'Okuma', createdAt: time, updatedAt: time };
const item = { id: 'item-1', boardId: 'board-1', title: 'Kitap', kind: 'note', createdAt: time, updatedAt: time };
let passed = 0;
function check(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }

check('valid board and item are immutable normalized copies', () => {
  const b = validateCollectionBoard({ ...board, title: ' Okuma ' });
  const i = validateCollectionItem(item);
  assert.equal(b.title, 'Okuma');
  assert.equal(i.note, '');
  assert.equal(i.url, '');
  assert.ok(Object.isFrozen(b) && Object.isFrozen(i));
  assert.notEqual(i, item);
});
check('valid snapshot keeps boards and items without changing source', () => {
  const input = { version: 1, boards: [board], items: [item] };
  const result = validateCollectionsSnapshot(input);
  assert.deepEqual(result.boards.map(x => x.id), ['board-1']);
  assert.ok(Object.isFrozen(result.boards) && Object.isFrozen(result.items));
  assert.equal(input.items[0].note, undefined);
});
check('empty snapshot is valid for a new local profile', () => {
  assert.deepEqual(validateCollectionsSnapshot({ version: 1, boards: [], items: [] }), { version: 1, boards: [], items: [] });
});
check('invalid shapes and unknown fields fail closed', () => {
  for (const value of [null, [], {}, { ...board, owner: 'x' }]) assert.throws(() => validateCollectionBoard(value));
  assert.throws(() => validateCollectionItem({ ...item, remoteSync: true }));
  assert.throws(() => validateCollectionsSnapshot({ version: 2, boards: [], items: [] }));
});
check('titles and identifiers reject empty, oversized and control text', () => {
  for (const title of ['', ' '.repeat(3), 'x'.repeat(81), 'bad\nline']) assert.throws(() => validateCollectionBoard({ ...board, title }));
  assert.throws(() => validateCollectionItem({ ...item, id: 'x'.repeat(65) }));
  assert.throws(() => validateCollectionItem({ ...item, title: 'x'.repeat(121) }));
});
check('notes and kinds have explicit limits', () => {
  assert.throws(() => validateCollectionItem({ ...item, note: 'x'.repeat(2001) }));
  assert.throws(() => validateCollectionItem({ ...item, kind: 'unknown' }));
  assert.equal(validateCollectionItem({ ...item, kind: 'idea' }).kind, 'idea');
});
check('saved web links accept HTTPS and HTTP without fetching', () => {
  assert.equal(validateCollectionItem({ ...item, url: 'https://example.org/article' }).url, 'https://example.org/article');
  assert.equal(validateCollectionItem({ ...item, url: 'http://example.org/' }).url, 'http://example.org/');
});
check('script, file, data and credential URLs are rejected', () => {
  for (const url of ['javascript:alert(1)', 'file:///tmp/a', 'data:text/html,x', 'https://a:b@example.org/', 'not a url']) {
    assert.throws(() => validateCollectionItem({ ...item, url }), /invalid-url/);
  }
});
check('timestamps must be real canonical UTC milliseconds and ordered', () => {
  for (const createdAt of ['2026-02-30T10:00:00.000Z', '2026-11-23', '2026-11-23T10:00:00+00:00']) {
    assert.throws(() => validateCollectionBoard({ ...board, createdAt }));
  }
  assert.throws(() => validateCollectionBoard({ ...board, updatedAt: '2026-11-22T10:00:00.000Z' }));
});
check('duplicate IDs and orphan items are rejected', () => {
  assert.throws(() => validateCollectionsSnapshot({ version: 1, boards: [board, { ...board }], items: [] }), /invalid-references/);
  assert.throws(() => validateCollectionsSnapshot({ version: 1, boards: [board], items: [item, { ...item }] }), /invalid-references/);
  assert.throws(() => validateCollectionsSnapshot({ version: 1, boards: [], items: [item] }), /invalid-references/);
});
check('bounded snapshot rejects excessive records', () => {
  assert.throws(() => validateCollectionsSnapshot({ version: 1, boards: Array(101).fill(board), items: [] }), /invalid-snapshot/);
  assert.throws(() => validateCollectionsSnapshot({ version: 1, boards: [], items: Array(2001).fill(item) }), /invalid-snapshot/);
});
check('a rejected snapshot leaves all caller data untouched', () => {
  const input = { version: 1, boards: [board], items: [{ ...item, boardId: 'missing' }] };
  const before = structuredClone(input);
  assert.throws(() => validateCollectionsSnapshot(input), /invalid-references/);
  assert.deepEqual(input, before);
});

console.log(`Collections Contract: ${passed}/${passed} başarılı`);
