/** Restore-only, pure checks of the nine current Health side stores. No normalization. */
import {parseBackupJSON} from './backup-export.mjs';
import * as sportCatalogModule from './sport-catalog.js';
// CommonJS namespace in Node; pure classic-script namespace in the browser.
const sportCatalog=sportCatalogModule.default??globalThis.TodaySportCatalog;

export const HEALTH_KEYS=Object.freeze([
  'today.health.water.glassMl','today.health.water.targetMl',
  'today.health.wellness.sleep.v1','today.health.wellness.energy.v1','today.health.wellness.symptoms.v1',
  'today.health.sport.program.v1','today.health.sport.workouts.v1','today.health.sport.customDays.v1','today.health.sport.daySettings.v1'
]);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const text=v=>typeof v==='string';
const token=v=>text(v)&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(v);
const number=(v,min=0)=>typeof v==='number'&&Number.isFinite(v)&&v>=min;
const positiveInteger=v=>Number.isSafeInteger(v)&&v>0;
const dayIndex=v=>Number.isInteger(v)&&v>=0&&v<=4;
const dayKey=v=>text(v)&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const time=v=>text(v)&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v);
const timestamp=v=>text(v)&&/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(v)&&dayKey(v.slice(0,10))&&Number.isFinite(Date.parse(v));
const member=(v,allowed)=>allowed.includes(v);
const unique=list=>new Set(list).size===list.length;
function invalid(section,reason){const e=new Error('invalid-health-data');e.code='invalid-health-data';e.section=HEALTH_KEYS.includes(section)?section:'health';e.reason=reason;throw e;}
function requireValue(ok,section,reason){if(!ok)invalid(section,reason);}
function current(value,section){
  requireValue(object(value),section,'object-required');
  requireValue(!['schemaVersion','contractVersion','version'].some(k=>Object.hasOwn(value,k)),section,'unsupported-version');
}
function activeExercises(ids,section,{uniqueResolved=false}={}){
  const resolved=ids.map(id=>sportCatalog.find(id)?.id);
  requireValue(resolved.every(Boolean),section,'unknown-active-exercise');
  if(uniqueResolved)requireValue(unique(resolved),section,'duplicate-resolved-exercise');
}
function records(value,section,{wellness=false}={}){
  requireValue(Array.isArray(value)&&value.length<=100000,section,'array-required');
  const ids=new Set(),days=new Set();
  for(const record of value){
    current(record,section);
    requireValue(text(record.id)&&record.id.length>0&&!ids.has(record.id),section,'invalid-or-duplicate-id');ids.add(record.id);
    requireValue(timestamp(record.date),section,'invalid-timestamp');
    if(wellness){
      requireValue(dayKey(record.dayKey)&&!days.has(record.dayKey),section,'invalid-or-duplicate-day');days.add(record.dayKey);
      requireValue(text(record.note),section,'note-required');
    }
  }
}
function validateValue(key,v){
  if(key==='today.health.water.glassMl')return requireValue(member(v,[250,300,350,500]),key,'unsupported-glass-ml');
  if(key==='today.health.water.targetMl')return requireValue(member(v,[2000,2500,2800,3000,3500]),key,'unsupported-target-ml');
  if(key.startsWith('today.health.wellness.')){
    records(v,key,{wellness:true});
    for(const r of v){
      if(key.endsWith('.sleep.v1')){
        requireValue(time(r.bedtime)&&time(r.wakeTime),key,'invalid-sleep-time');
        const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
        const difference=minutes(r.wakeTime)-minutes(r.bedtime),duration=difference<=0?difference+1440:difference;
        requireValue(r.durationMinutes===duration,key,'inconsistent-sleep-duration');
        requireValue(member(r.quality,['bad','okay','good'])&&member(r.recovery,['low','okay','good']),key,'invalid-sleep-selection');
      }else if(key.endsWith('.energy.v1')){
        requireValue(member(r.energy,['low','balanced','high'])&&member(r.fatigue,['high','some','none'])&&member(r.body,['tense','neutral','relaxed']),key,'invalid-energy-selection');
      }else{
        requireValue(Array.isArray(r.symptoms)&&r.symptoms.length>0&&unique(r.symptoms)&&r.symptoms.every(s=>member(s,['none','headache','muscleJoint','stomach','fatigue','throat','cramp','other'])),key,'invalid-symptoms');
        const none=r.symptoms.includes('none'),other=r.symptoms.includes('other');
        requireValue(!none||r.symptoms.length===1,key,'contradictory-symptoms');
        requireValue(none?r.severity===null:Number.isInteger(r.severity)&&r.severity>=1&&r.severity<=5,key,'invalid-severity');
        requireValue(text(r.bodyArea)&&(!none||r.bodyArea===''),key,'invalid-body-area');
        requireValue(text(r.customSymptom)&&(other?r.customSymptom.trim().length>0:r.customSymptom===''),key,'invalid-custom-symptom');
      }
    }
  }else if(key==='today.health.sport.program.v1'){
    current(v,key);
    requireValue(member(v.goal,['muscle','strength','condition','general'])&&member(v.level,['beginner','intermediate','advanced'])&&member(v.days,[2,3,4,5])&&member(v.duration,[30,45,60,75])&&member(v.location,['gym','home','mixed'])&&timestamp(v.createdAt),key,'invalid-program');
    requireValue(Array.isArray(v.equipment)&&unique(v.equipment)&&v.equipment.every(e=>member(e,['machines','dumbbell','barbell','cable','cardio']))&&(v.location!=='home'||v.equipment.length===0),key,'invalid-equipment');
  }else if(key==='today.health.sport.workouts.v1'){
    records(v,key);
    for(const r of v){
      requireValue(dayIndex(r.dayIndex)&&text(r.dayTitle)&&positiveInteger(r.durationMinutes)&&Array.isArray(r.exercises),key,'invalid-workout');
      const ids=[];
      for(const exercise of r.exercises){
        current(exercise,key);
        requireValue(token(exercise.exerciseId)&&text(exercise.name)&&exercise.name.length>0&&text(exercise.muscle)&&number(exercise.sets)&&number(exercise.reps)&&number(exercise.kg)&&typeof exercise.completed==='boolean',key,'invalid-exercise');
        requireValue(exercise.image===null||(text(exercise.image)&&/^\.\/assets\/sport\/[a-z0-9-]+\.jpg$/.test(exercise.image)),key,'unsupported-exercise-image');
        ids.push(exercise.exerciseId);
      }
      requireValue(unique(ids),key,'duplicate-exercise');
    }
  }else{
    current(v,key);
    for(const [index,value]of Object.entries(v)){
      requireValue(/^[0-4]$/.test(index),key,'invalid-program-day');
      if(key==='today.health.sport.customDays.v1'){
        requireValue(Array.isArray(value)&&value.every(token)&&unique(value),key,'invalid-exercise-list');
        activeExercises(value,key,{uniqueResolved:true});
      }
      else{
        current(value,key);
        requireValue(!Object.hasOwn(value,'title')||text(value.title),key,'invalid-day-title');
        if(Object.hasOwn(value,'exercises')){
          requireValue(object(value.exercises),key,'invalid-exercise-defaults');
          for(const [id,defaults]of Object.entries(value.exercises)){
            current(defaults,key);requireValue(token(id),key,'invalid-exercise-id');
            for(const field of ['sets','reps'])requireValue(!Object.hasOwn(defaults,field)||number(defaults[field],1),key,'invalid-exercise-defaults');
          }
          // Defaults remain keyed by the original ID; the UI gives an exact raw
          // key precedence over the canonical fallback, without merging values.
          activeExercises(Object.keys(value.exercises),key);
        }
      }
    }
  }
}
export function validateHealthEntries(entries){
  if(!Array.isArray(entries))invalid('health','incomplete-coverage');
  const seen=new Set();let present=0,catalogReferences=false;
  for(const entry of entries){
    const key=entry?.key;
    if(typeof key!=='string'||!key.startsWith('today.health.'))continue;
    requireValue(HEALTH_KEYS.includes(key)&&!seen.has(key),key,'unknown-or-duplicate-key');seen.add(key);
    requireValue(Object.keys(entry).sort().join('|')==='key|present|rawValue'&&typeof entry.present==='boolean'&&(entry.present?text(entry.rawValue):entry.rawValue===null),key,'invalid-entry');
    if(!entry.present)continue;
    let value;try{value=parseBackupJSON(entry.rawValue);}catch{invalid(key,'invalid-json');}
    validateValue(key,value);present++;
    if(key.endsWith('.customDays.v1')&&Object.values(value).some(ids=>ids.length))catalogReferences=true;
    if(key.endsWith('.daySettings.v1')&&Object.values(value).some(day=>Object.keys(day.exercises??{}).length))catalogReferences=true;
  }
  requireValue(seen.size===HEALTH_KEYS.length,'health','incomplete-coverage');
  return Object.freeze({keys:seen.size,present,catalogResolution:catalogReferences?'verified':'not-needed'});
}
