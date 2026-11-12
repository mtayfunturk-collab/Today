/** Pure restore checks. Never calls Day/State/Storage normalization or a clock. */
import {parseBackupJSON} from './backup-export.mjs';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const owns=(v,k)=>Object.hasOwn(v,k);
const TIME_FIELDS=['t','timestamp','time','createdAt'];
const TEXT_FIELDS=['type','action','a','what','description','message'];
const LIST_FIELDS=['changeLog','changes','log','history'];
const COUNT_FIELDS=['changeCount','edits','editCount'];
function need(ok,reason){if(!ok){const e=new Error('invalid-core-history');e.code='invalid-core-history';e.reason=reason;throw e;}}
function dayKey(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;}
function instant(value){
  if(typeof value==='number'){need(Number.isFinite(value)&&Math.abs(value)<=8640000000000000,'invalid-timestamp');return new Date(value).getTime();}
  need(typeof value==='string'&&(dayKey(value)||(/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)&&dayKey(value.slice(0,10)))),'invalid-timestamp');
  const at=Date.parse(value);need(Number.isFinite(at),'invalid-timestamp');return at;
}
function record(value,{archive=false}={}){
  if(archive&&typeof value==='string')return; // recognized historical text, kept raw
  need(object(value),'invalid-change-record');
  const times=TIME_FIELDS.filter(k=>owns(value,k)).map(k=>instant(value[k]));
  need(archive||times.length>0,'missing-change-timestamp');
  need(times.every(at=>at===times[0]),'conflicting-timestamp-aliases');
  const texts=TEXT_FIELDS.filter(k=>owns(value,k));
  need(archive||texts.length>0,'missing-change-description');
  need(texts.every(k=>typeof value[k]==='string'),'invalid-change-text');
}
function list(value,options){
  need(Array.isArray(value)&&value.length<=100000,'invalid-change-list');
  for(const item of value)record(item,options);
}
export function validateCoreDayHistory(value,{archive=false}={}){
  need(object(value),'invalid-history-day');
  for(const field of LIST_FIELDS)if(owns(value,field))list(value[field],{archive:archive||field!=='changeLog'});
  for(const field of COUNT_FIELDS)if(owns(value,field)){
    const raw=value[field],legacy=archive||field!=='changeCount';
    need(typeof raw==='number'||(legacy&&typeof raw==='string'&&raw.trim()!==''),'invalid-change-count');
    const count=Number(raw);need(Number.isFinite(count)&&count>=0,'invalid-change-count');
    // A larger count can describe retained/truncated history. Do not force equality.
    if(!archive&&field==='changeCount'&&owns(value,'changeLog'))need(count>=value.changeLog.length,'inconsistent-change-count');
  }
}
export function validateCoreLogMap(value,{archive=false}={}){
  need(object(value),'invalid-log-map');
  for(const [key,day]of Object.entries(value)){
    need(dayKey(key),'invalid-log-day');
    if(archive&&Array.isArray(day)){list(day,{archive:true});continue;}
    need(object(day),'invalid-log-day');
    if(owns(day,'entries')){
      need(Array.isArray(day.entries)&&day.entries.length<=100000,'invalid-entry-list');
      for(const at of day.entries)instant(at);
    }
    if(owns(day,'changes'))list(day.changes,{archive});
    // Preserve optional recognized history aliases, validating any supplied shape.
    validateCoreDayHistory(day,{archive});
  }
}
export function validateCoreHistoryEntries(entries){
  for(const entry of entries){
    if(!entry.present||!['today_store_v2','today_store_v2_backup','today_app_v10'].includes(entry.key))continue;
    const value=parseBackupJSON(entry.rawValue);
    need(object(value),'invalid-history-store');
    const archive=entry.key==='today_app_v10'||(entry.key==='today_store_v2_backup'&&(value.schemaVersion??0)<2);
    if(object(value.days))for(const day of Object.values(value.days)){
      // Historical schema0/1 date maps can hold a bare selection string.
      if(archive&&typeof day==='string')continue;
      validateCoreDayHistory(day,{archive});
    }
    if(owns(value,'logs'))validateCoreLogMap(value.logs,{archive:entry.key==='today_app_v10'?false:archive});
  }
}
