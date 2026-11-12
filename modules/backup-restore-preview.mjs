/** T90-07 preparation only. No persistence, apply API, startup hook or UI activation. */
import {LS_KEYS, STORES, FORMAT, readBackupForPreview} from './backup-export.mjs';
import {cleanState, defaultState} from './notification-store.mjs';
import {validateHealthEntries} from './backup-health-validation.mjs';
import {validateSkyEntries} from './backup-sky-validation.mjs';
import {validateCoreHistoryEntries} from './backup-core-history.mjs';
import {validateCorePreferenceEntries} from './backup-core-preferences.mjs';
import {validateNutritionMetadata} from './backup-nutrition-metadata.mjs';
import {validateLegacyEntries,validateRecoveryArchives} from './backup-legacy-validation.mjs';

const plans = new WeakMap();
const encoder = new TextEncoder();
const SUPPORTED_APP = '2.23.3';
const EXCLUSIONS = ['cache', 'OS-permissions-and-queue', 'transient-audio-health-AI'];
const PREVIEW_LIFETIME = 5 * 60000;
const reject = code => { const e = new Error(code); e.code = code; throw e; };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) &&
  Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const copy = value => JSON.parse(JSON.stringify(value));
function frozen(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); }
  return value;
}
function cancelled(signal) { if (signal?.aborted) reject('cancelled'); }
function instant(now) {
  const at = now();
  if (!(at instanceof Date) || !Number.isFinite(at.getTime())) reject('invalid-clock');
  return at;
}
function validDay(key) {
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isFinite(Date.parse(key)) &&
    new Date(key).toISOString().slice(0, 10) === key;
}
function daysOf(value) {
  if (!object(value)) reject('invalid-core-days');
  for (const [key, day] of Object.entries(value)) {
    if (!validDay(key) || !object(day)) reject('invalid-core-days');
    for (const field of ['note', 'color', 'choice']) {
      if (Object.hasOwn(day, field) && typeof day[field] !== 'string') reject('invalid-core-day');
    }
  }
}
function validateShape(payload, contracts) {
  if (!exact(payload, ['format','payloadVersion','backupId','createdAt','source',
    'coverageRegistryVersion','localStorageEntries','databases','exclusions','sourceValidation','manifest']) ||
    payload.format !== FORMAT || payload.payloadVersion !== 1 || payload.coverageRegistryVersion !== 1 ||
    !same(payload.exclusions, EXCLUSIONS) || !exact(payload.sourceValidation, ['restoreValidated']) ||
    payload.sourceValidation.restoreValidated !== false) reject('unsupported-payload');
  if (typeof payload.backupId !== 'string' ||
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(payload.backupId) ||
    typeof payload.createdAt !== 'string' || !Number.isFinite(Date.parse(payload.createdAt))) reject('invalid-provenance');
  const source = payload.source;
  if (!object(source) || Object.keys(source).some(k => !['appVersion','origin','runtime','sourceCodeRef'].includes(k)) ||
    source.appVersion !== SUPPORTED_APP || source.runtime !== 'web') reject('unsupported-source-runtime');
  try { if (new URL(source.origin).origin !== source.origin || !/^https?:$/.test(new URL(source.origin).protocol)) reject('unsupported-origin'); }
  catch { reject('unsupported-origin'); }
  if (!Array.isArray(payload.localStorageEntries) || !same(payload.localStorageEntries.map(e => e?.key), LS_KEYS) ||
    !Array.isArray(payload.databases) || payload.databases.length !== 1) reject('incomplete-coverage');
  for (const e of payload.localStorageEntries) {
    if (!exact(e, ['key','present','rawValue']) || typeof e.present !== 'boolean' ||
      (e.present ? typeof e.rawValue !== 'string' : e.rawValue !== null)) reject('invalid-entry');
    if (!e.present) continue;
    let value; try { value = JSON.parse(e.rawValue); } catch { reject('invalid-entry'); }
    if (e.key === 'today_store_v2') {
      if (!object(value) || value.schemaVersion !== 2) reject('unsupported-core');
      daysOf(value.days);
    } else if (e.key === 'today_app_v10') {
      if (!object(value) || value.v !== 10 || !object(value.logs)) reject('unsupported-core');
      daysOf(value.days);
      for (const [key, log] of Object.entries(value.logs)) if (!validDay(key) || !object(log)) reject('invalid-core-logs');
    }
  }
  validateCorePreferenceEntries(payload.localStorageEntries);
  validateCoreHistoryEntries(payload.localStorageEntries);
  validateHealthEntries(payload.localStorageEntries);
  validateSkyEntries(payload.localStorageEntries);
  validateLegacyEntries(payload.localStorageEntries);
  const db = payload.databases[0];
  if (!object(db) || db.name !== 'today_nutrition' || typeof db.present !== 'boolean') reject('invalid-database');
  if (!db.present) {
    if (!exact(db, ['name','present'])) reject('invalid-database');
    return;
  }
  if (!exact(db, ['name','present','version','stores']) || db.version !== 1 || !Array.isArray(db.stores) ||
    !same(db.stores.map(s => s?.name), Object.keys(STORES))) reject('unsupported-database');
  const values = {};
  for (const store of db.stores) {
    if (!exact(store, ['name','keyPath','entries']) || store.keyPath !== STORES[store.name] ||
      !Array.isArray(store.entries) || store.entries.length > 100000) reject('invalid-store');
    const keys = new Set();
    for (const e of store.entries) {
      if (!exact(e, ['key','value']) || typeof e.key !== 'string' || !e.key || !object(e.value) ||
        e.key !== e.value[store.keyPath] || keys.has(e.key)) reject('invalid-record-key');
      keys.add(e.key);
    }
    values[store.name] = store.entries.map(e => e.value);
  }
  const metadata = values.metadata.find(e => e.key === 'database_state');
  if (metadata?.storageSchemaVersion !== 1 || metadata.contractVersion !== 1 ||
    contracts?.CONTRACT_VERSION !== 1 || typeof contracts.validateRecordSet !== 'function') reject('unsupported-contract');
  if (!contracts.validateRecordSet(values.records, {requireReferences:true}).valid) reject('invalid-record-set');
  for (const backup of values.migration_backups) {
    if (!Array.isArray(backup.records) || backup.records.length !== backup.recordCount ||
      ![0,1].includes(backup.storageSchemaVersion) || ![0,1].includes(backup.contractVersion) ||
      (backup.contractVersion === 1 && !contracts.validateRecordSet(backup.records, {requireReferences:true}).valid)) reject('invalid-recovery-archive');
  }
  validateRecoveryArchives(values.migration_backups,contracts);
  validateNutritionMetadata(values.metadata,{backups:values.migration_backups});
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (object(value)) return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
function content(payload) {
  const databases = copy(payload.databases);
  for (const db of databases) if (db.present) for (const store of db.stores) {
    store.entries.sort((a,b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  }
  return {localStorageEntries:payload.localStorageEntries, databases};
}
async function fingerprint(payload, crypto) {
  const raw = encoder.encode(JSON.stringify(canonical(content(payload))));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', raw))].map(n => n.toString(16).padStart(2,'0')).join('');
}
function counts(before, after) {
  const a = new Map(before.map(e => [e.key,e.value])), b = new Map(after.map(e => [e.key,e.value]));
  const result = {added:0, changed:0, removed:0, unchanged:0};
  for (const key of new Set([...a.keys(),...b.keys()])) {
    if (!a.has(key)) result.added++;
    else if (!b.has(key)) result.removed++;
    else if (same(canonical(a.get(key)),canonical(b.get(key)))) result.unchanged++;
    else result.changed++;
  }
  return result;
}
function notificationCandidate(payload, at) {
  const candidate = copy(payload), entry = candidate.localStorageEntries.find(e => e.key === 'today_ai_delivery_v1');
  const effects = {present:entry.present, permissionsReset:false, dispatchesRemoved:0, expiredInsightsRemoved:0};
  if (entry.present) {
    const raw = JSON.parse(entry.rawValue), result = cleanState(raw, at);
    if (!result.ok) reject('invalid-notification-state');
    const state = copy(result.state);
    state.preferences.aiEnabled = false; state.preferences.updateEnabled = false;
    state.dailyAnalysisConsent = copy(defaultState().dailyAnalysisConsent);
    state.dispatches = []; state.lastNotifiedUpdateVersion = null;
    effects.permissionsReset = true;
    effects.dispatchesRemoved = raw.dispatches.length;
    effects.expiredInsightsRemoved = raw.insights.length - state.insights.length;
    entry.rawValue = JSON.stringify(state);
  }
  return {candidate, effects};
}
/** Preview consent allows local reads only. No return value is an apply authorization. */
export async function prepareRestorePreview({userConfirmed=false, file, password, barrier, capture,
  contracts, crypto=globalThis.crypto, now=()=>new Date(), signal}={}) {
  if (userConfirmed !== true) reject('preview-consent-required');
  if (typeof barrier !== 'function' || typeof capture !== 'function') reject('coordination-unavailable');
  cancelled(signal);
  const at = instant(now);
  const source = await readBackupForPreview(file, password, {crypto, signal, contracts});
  validateShape(source, contracts);
  cancelled(signal);
  const target = copy(await barrier(() => capture()));
  cancelled(signal); validateShape(target, contracts);
  if (source.source.origin !== target.source.origin) reject('unsupported-origin-transfer');
  const {candidate, effects} = notificationCandidate(source, at);
  const localStorage = counts(target.localStorageEntries.filter(e=>e.present).map(e=>({key:e.key,value:e.rawValue})),
    candidate.localStorageEntries.filter(e=>e.present).map(e=>({key:e.key,value:e.rawValue})));
  const a = target.databases[0], b = candidate.databases[0];
  const stores = Object.keys(STORES).map(name => ({name, ...counts(
    a.present ? a.stores.find(s=>s.name===name).entries : [],
    b.present ? b.stores.find(s=>s.name===name).entries : [])}));
  const days = new Set();
  for (const e of source.localStorageEntries) if (e.present && ['today_store_v2','today_app_v10'].includes(e.key)) {
    Object.keys(JSON.parse(e.rawValue).days).forEach(day=>days.add(day));
  }
  const orderedDays = [...days].sort();
  const preview = frozen({status:'preview-only', applyAvailable:false, restoreValidated:false,
    createdAt:at.toISOString(), expiresAt:new Date(at.getTime()+PREVIEW_LIFETIME).toISOString(),
    sourceCreatedAt:source.createdAt, sections:24, localStorage, stores,
    coreDays:{count:days.size, earliest:orderedDays[0]??null, latest:orderedDays.at(-1)??null},
    notificationEffects:effects, databaseTransition:a.present===b.present?'none':b.present?'create':'remove',
    targetFingerprint:await fingerprint(target,crypto), candidateFingerprint:await fingerprint(candidate,crypto),
    blockers:['recovery-storage-approval-required','journal-and-startup-guard-not-implemented',
      'full-semantic-and-interruption-acceptance-pending', ...(a.present!==b.present?['database-presence-change-unsupported']:[])]});
  cancelled(signal);
  // Only a hash/context is retained. Neither source nor target records survive here.
  plans.set(preview, {expires:at.getTime()+PREVIEW_LIFETIME, origin:target.source.origin,
    fingerprint:preview.targetFingerprint, barrier, capture, contracts, crypto, now});
  return preview;
}
/** Rechecks staleness only; even unchanged:true is never permission to write. */
export async function revalidateRestorePreview(preview, {signal}={}) {
  const plan = plans.get(preview);
  if (!plan) reject('invalid-preview');
  try {
    cancelled(signal);
    if (instant(plan.now).getTime() >= plan.expires) reject('preview-expired');
    const target = await plan.barrier(() => plan.capture());
    cancelled(signal); validateShape(target, plan.contracts);
    if (target.source.origin !== plan.origin || await fingerprint(target, plan.crypto) !== plan.fingerprint) reject('target-changed');
    return frozen({unchanged:true, applyAvailable:false, restoreValidated:false});
  } catch (error) { plans.delete(preview); throw error; }
}
export function discardRestorePreview(preview) { return plans.delete(preview); }

// Shared pure contracts for the unwired synthetic recovery prototype.
export {validateShape as validateRestoreSnapshot, fingerprint as fingerprintRestoreSnapshot,
  notificationCandidate as proposeNotificationRestore};
