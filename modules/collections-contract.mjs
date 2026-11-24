// Pure data contract. Storage, URL opening, network access and AI use are separate decisions.
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clean = (value, max, field, { optional = false } = {}) => {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/u.test(value)) throw new TypeError(`invalid-${field}`);
  const result = value.trim();
  if ((!optional && !result) || result.length > max) throw new RangeError(`invalid-${field}`);
  return result;
};
const timestamp = (value, field) => {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new TypeError(`invalid-${field}`);
  }
  return value;
};
const keys = (value, allowed, field) => {
  if (!isRecord(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new TypeError(`invalid-${field}`);
};
const id = (value, field) => clean(value, 64, field);
const dates = value => {
  const createdAt = timestamp(value.createdAt, 'created-at');
  const updatedAt = timestamp(value.updatedAt, 'updated-at');
  if (updatedAt < createdAt) throw new RangeError('invalid-date-order');
  return { createdAt, updatedAt };
};

export function validateCollectionBoard(value) {
  keys(value, ['id', 'title', 'createdAt', 'updatedAt'], 'board');
  return Object.freeze({
    id: id(value.id, 'board-id'),
    title: clean(value.title, 80, 'board-title'),
    ...dates(value)
  });
}

export function validateCollectionItem(value) {
  keys(value, ['id', 'boardId', 'title', 'note', 'kind', 'url', 'createdAt', 'updatedAt'], 'item');
  const kind = clean(value.kind, 20, 'kind');
  if (!['note', 'link', 'idea', 'reference'].includes(kind)) throw new TypeError('invalid-kind');
  const url = value.url === undefined ? '' : clean(value.url, 2048, 'url', { optional: true });
  if (url) {
    let parsed;
    try { parsed = new URL(url); } catch { throw new TypeError('invalid-url'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || !parsed.hostname) {
      throw new TypeError('invalid-url');
    }
  }
  return Object.freeze({
    id: id(value.id, 'item-id'),
    boardId: id(value.boardId, 'board-id'),
    title: clean(value.title, 120, 'item-title'),
    note: value.note === undefined ? '' : clean(value.note, 2000, 'note', { optional: true }),
    kind,
    url,
    ...dates(value)
  });
}

export function validateCollectionsSnapshot(value) {
  keys(value, ['version', 'boards', 'items'], 'snapshot');
  if (value.version !== 1 || !Array.isArray(value.boards) || !Array.isArray(value.items) ||
      value.boards.length > 100 || value.items.length > 2000) throw new TypeError('invalid-snapshot');
  const boards = value.boards.map(validateCollectionBoard);
  const items = value.items.map(validateCollectionItem);
  const boardIds = new Set(boards.map(board => board.id));
  const itemIds = new Set(items.map(item => item.id));
  if (boardIds.size !== boards.length || itemIds.size !== items.length ||
      items.some(item => !boardIds.has(item.boardId))) throw new TypeError('invalid-references');
  return Object.freeze({ version: 1, boards: Object.freeze(boards), items: Object.freeze(items) });
}
