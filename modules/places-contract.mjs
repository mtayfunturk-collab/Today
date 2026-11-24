// Pure Yerler data contract. No GPS, map request, storage or AI access.
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fields = (value, allowed) => {
  if (!record(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new TypeError('invalid-place-shape');
};
const text = (value, max, field, optional = false) => {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/u.test(value)) throw new TypeError(`invalid-${field}`);
  const result = value.trim();
  if ((!optional && !result) || result.length > max) throw new RangeError(`invalid-${field}`);
  return result;
};
const time = (value, field) => {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new TypeError(`invalid-${field}`);
  return value;
};

export const PLACE_STATES = Object.freeze(['want', 'visited']);

export function validatePlace(value) {
  fields(value, ['id', 'name', 'city', 'note', 'address', 'url', 'state', 'createdAt', 'updatedAt']);
  if (!PLACE_STATES.includes(value.state)) throw new TypeError('invalid-state');
  const url = value.url === undefined ? '' : text(value.url, 2048, 'url', true);
  if (url) {
    let parsed;
    try { parsed = new URL(url); } catch { throw new TypeError('invalid-url'); }
    if (!['https:', 'http:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password)
      throw new TypeError('invalid-url');
  }
  const createdAt = time(value.createdAt, 'created-at');
  const updatedAt = time(value.updatedAt, 'updated-at');
  if (updatedAt < createdAt) throw new RangeError('invalid-date-order');
  return Object.freeze({
    id: text(value.id, 64, 'id'), name: text(value.name, 120, 'name'),
    city: text(value.city, 120, 'city'),
    note: value.note === undefined ? '' : text(value.note, 2000, 'note', true),
    address: value.address === undefined ? '' : text(value.address, 300, 'address', true),
    url, state: value.state, createdAt, updatedAt
  });
}

export function validatePlacesSnapshot(value) {
  fields(value, ['version', 'items']);
  if (value.version !== 1 || !Array.isArray(value.items) || value.items.length > 500) throw new TypeError('invalid-snapshot');
  const items = value.items.map(validatePlace);
  if (new Set(items.map(item => item.id)).size !== items.length) throw new TypeError('duplicate-id');
  return Object.freeze({ version: 1, items: Object.freeze(items) });
}
