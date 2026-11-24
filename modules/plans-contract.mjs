// Pure Planlar record contract. No persistence, calendar access, notifications or AI use.
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, allowed) => {
  if (!isRecord(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new TypeError('invalid-plan-shape');
};
const text = (value, max, field, optional = false) => {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/u.test(value)) throw new TypeError(`invalid-${field}`);
  const result = value.trim();
  if ((!optional && !result) || result.length > max) throw new RangeError(`invalid-${field}`);
  return result;
};
const timestamp = (value, field) => {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new TypeError(`invalid-${field}`);
  return value;
};
const day = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d$/u.test(value) ||
      !Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) ||
      new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) throw new TypeError('invalid-day');
  return value;
};

export const PLAN_STATES = Object.freeze(['day', 'next', 'doing', 'done']);

export function validatePlanItem(value) {
  exactKeys(value, ['id', 'title', 'note', 'state', 'dayKey', 'createdAt', 'updatedAt']);
  if (!PLAN_STATES.includes(value.state)) throw new TypeError('invalid-state');
  if (value.state === 'day' && value.dayKey === undefined) throw new TypeError('missing-day');
  if (value.state !== 'day' && value.dayKey !== undefined) throw new TypeError('unexpected-day');
  const createdAt = timestamp(value.createdAt, 'created-at');
  const updatedAt = timestamp(value.updatedAt, 'updated-at');
  if (updatedAt < createdAt) throw new RangeError('invalid-date-order');
  return Object.freeze({
    id: text(value.id, 64, 'id'), title: text(value.title, 120, 'title'),
    note: value.note === undefined ? '' : text(value.note, 1000, 'note', true),
    state: value.state, ...(value.state === 'day' ? { dayKey: day(value.dayKey) } : {}),
    createdAt, updatedAt
  });
}

export function validatePlansSnapshot(value) {
  exactKeys(value, ['version', 'items']);
  if (value.version !== 1 || !Array.isArray(value.items) || value.items.length > 500) throw new TypeError('invalid-snapshot');
  const items = value.items.map(validatePlanItem);
  if (new Set(items.map(item => item.id)).size !== items.length) throw new TypeError('duplicate-id');
  return Object.freeze({ version: 1, items: Object.freeze(items) });
}
