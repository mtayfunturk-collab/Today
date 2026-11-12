/** Restore-only inspection of archives. Never calls migration or mutates raw data. */
import {parseBackupJSON} from './backup-export.mjs';
import {validateCoreDayHistory,validateCoreLogMap} from './backup-core-history.mjs';
import {validateCorePreferences} from './backup-core-preferences.mjs';
export const LEGACY_KEYS=Object.freeze(['today_data_v10','today_data_v2','today_data_v1','today_data','today_store','today_store_v1','todaySelections','today_entries','todayAppData','today_app_data']);
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
function need(ok){if(!ok){const e=new Error('invalid-legacy-archive');e.code='invalid-legacy-archive';throw e;}}
function item(v){
  need(typeof v==='string'||obj(v));if(typeof v==='string')return;
  for(const k of ['choice','selection','selected','sel','pick','value','color','colour','col','colorCode','note','notes','text','comment'])if(Object.hasOwn(v,k))need(typeof v[k]==='string');
  validateCoreDayHistory(v,{archive:true});
}
function dateMap(v){need(obj(v));for(const [key,value]of Object.entries(v)){need(day(key));item(value);}}
function logs(v){validateCoreLogMap(v,{archive:true});}
function payload(v){
  if(Array.isArray(v)){
    const seen=new Set();for(const row of v){need(obj(row));const aliases=['date','dateKey','day','createdDate'].filter(k=>Object.hasOwn(row,k));need(aliases.length>0);
      const key=row[aliases[0]];need(day(key)&&!seen.has(key)&&aliases.every(k=>row[k]===key));seen.add(key);item(row);
    }return;
  }
  need(obj(v));
  validateCorePreferences(v,{archive:true,topTheme:true});
  if(Object.hasOwn(v,'schemaVersion'))need(Number.isInteger(v.schemaVersion)&&v.schemaVersion>=0&&v.schemaVersion<=2);
  if(Object.hasOwn(v,'v'))need(v.v===10);
  const wrappers=['days','entries','selections'].filter(k=>Object.hasOwn(v,k));need(wrappers.length<=1);
  if(wrappers.length)dateMap(v[wrappers[0]]);
  else if(Object.keys(v).length)dateMap(v);
  if(Object.hasOwn(v,'logs'))logs(v.logs);
}
export function validateLegacyEntries(entries){
  let archives=0;
  for(const e of entries){
    if(!e.present)continue;
    if(LEGACY_KEYS.includes(e.key)){payload(parseBackupJSON(e.rawValue));archives++;}
    else if(e.key==='today_store_v2_backup'){
      const v=parseBackupJSON(e.rawValue);need(obj(v)&&Number.isInteger(v.schemaVersion??0)&&(v.schemaVersion??0)>=0&&(v.schemaVersion??0)<=2);dateMap(v.days);if(v.logs!==undefined)logs(v.logs);archives++;
    }
  }
  return Object.freeze({archives,converted:false});
}
export function validateRecoveryArchives(backups,contracts){
  need(Array.isArray(backups)&&typeof contracts?.validateRecordSet==='function');
  for(const b of backups){
    need(obj(b)&&typeof b.id==='string'&&b.id.length>0&&[0,1].includes(b.storageSchemaVersion)&&[0,1].includes(b.contractVersion)&&Array.isArray(b.records)&&b.recordCount===b.records.length);
    if(b.status!==undefined)need(['available','applied','failed'].includes(b.status));
    // Existing 0→1 migration admits only already-valid v1 records. No v0 payload reinterpretation.
    need(contracts.validateRecordSet(b.records,{requireReferences:true}).valid);
  }
  return Object.freeze({archives:backups.length,converted:false});
}
