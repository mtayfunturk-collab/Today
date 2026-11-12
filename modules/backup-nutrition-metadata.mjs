/** Restore-only metadata contract. No DB open, normalization, migration or clock. */
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const text=v=>typeof v==='string'&&v.trim().length>0;
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const stamp=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(v)&&day(v.slice(0,10))&&Number.isFinite(Date.parse(v));
function need(ok,reason){if(!ok){const e=new Error('invalid-nutrition-metadata');e.code='invalid-nutrition-metadata';e.reason=reason;throw e;}}
export function validateNutritionMetadata(values,{backups=[]}={}){
  need(Array.isArray(values)&&values.length===1&&object(values[0])&&values[0].key==='database_state','unsupported-metadata-key');
  const state=values[0];
  need(state.storageSchemaVersion===1&&state.contractVersion===1,'unsupported-version');
  need(stamp(state.createdAt)&&stamp(state.updatedAt),'invalid-state-time');
  need(Object.hasOwn(state,'lastMigration'),'missing-migration-state');
  const m=state.lastMigration;
  if(m===null)return Object.freeze({states:1,migration:false});
  need(object(m),'invalid-last-migration');
  need(text(m.id)&&text(m.backupId),'invalid-migration-id');
  need(m.fromVersion===0&&m.toVersion===1&&m.toVersion===state.contractVersion,'unsupported-migration-version');
  need(stamp(m.appliedAt),'invalid-migration-time');
  need(Array.isArray(m.appliedSteps)&&m.appliedSteps.length===1&&m.appliedSteps.every(text),'invalid-migration-steps');
  need(Number.isSafeInteger(m.recordCount)&&m.recordCount>=0,'invalid-migration-count');
  need(Array.isArray(backups),'missing-migration-backup');
  const matches=backups.filter(b=>b?.id===m.backupId);
  need(matches.length===1,'missing-migration-backup');
  const b=matches[0];
  need(b.status==='applied'&&b.contractVersion===m.fromVersion&&b.storageSchemaVersion===state.storageSchemaVersion&&b.recordCount===m.recordCount,'inconsistent-migration-backup');
  // The migration count is historical: later saves/deletes may change live count.
  // A wall-clock correction can also make updatedAt earlier than createdAt.
  return Object.freeze({states:1,migration:true});
}
