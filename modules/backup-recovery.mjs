/** T90-07 unwired prototype. Only isolated synthetic use is authorized.
 * syntheticProfile is an explicit caller assertion, not a security boundary.
 * No import-time access, production startup hook, UI or native support.
 */
import {STORES, readBackupForPreview, createBackup} from './backup-export.mjs';
import {validateRestoreSnapshot, fingerprintRestoreSnapshot, proposeNotificationRestore} from './backup-restore-preview.mjs';

export const RECOVERY_DB = 'today_recovery_v1';
const PHASES = ['PREPARED','APPLYING','VERIFYING','COMMITTED','ROLLING_BACK','ROLLED_BACK','RECOVERY_REQUIRED'];
const copy = value => JSON.parse(JSON.stringify(value));
const bytes = value => new TextEncoder().encode(JSON.stringify(value));
const fail = code => { const error = new Error(code); error.code = code; throw error; };
const aborted = signal => { if (signal?.aborted) fail('cancelled'); };
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const MAX_SNAPSHOT = 32*1024*1024;

/** Testable storage protocol; does not establish that a real application is quiescent. */
export function createSyntheticRecovery({syntheticProfile=false, indexedDB, storage, capture, barrier,
  contracts, crypto=globalThis.crypto, now=()=>new Date(), estimate, timeoutMs=5000}={}) {
  if (syntheticProfile !== true) fail('synthetic-profile-required');
  if (!indexedDB?.open || !storage?.setItem || !storage?.removeItem || typeof capture !== 'function' ||
    typeof barrier !== 'function' || !crypto?.subtle || !crypto?.randomUUID) fail('recovery-capability-unavailable');
  const previews = new WeakMap();
  function clock() { const at=now(); if (!(at instanceof Date) || !Number.isFinite(at.getTime())) fail('invalid-clock'); return at; }
  function validate(snapshot) {
    if (bytes(snapshot).length>MAX_SNAPSHOT) fail('snapshot-limit');
    validateRestoreSnapshot(snapshot,contracts);
  }
  const fingerprint = snapshot => fingerprintRestoreSnapshot(snapshot,crypto);
  async function checksum(row) {
    const {integrity, ...body}=row;
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(body)))].map(n=>n.toString(16).padStart(2,'0')).join('');
  }
  function open(create) {
    return new Promise((resolve,reject)=>{
      let settled=false,absent=false,request;
      const finish=(error,db)=>{if(settled){db?.close();return;}settled=true;clearTimeout(timer);error?reject(error):resolve(db);};
      const timer=setTimeout(()=>finish(new Error('journal-timeout')),timeoutMs);
      try { request=indexedDB.open(RECOVERY_DB); } catch { finish(new Error('journal-unavailable')); return; }
      request.onupgradeneeded=()=>{
        if (settled) {request.transaction.abort();return;}
        if (!create) { absent=true;request.transaction.abort();return; }
        try { request.result.createObjectStore('attempts',{keyPath:'id'}); }
        catch { request.transaction.abort(); }
      };
      request.onblocked=()=>finish(new Error('journal-blocked'));
      request.onerror=()=>absent?finish(null,null):finish(new Error('journal-open-failed'));
      request.onsuccess=()=>{
        const db=request.result;
        if (db.version!==1 || [...db.objectStoreNames].join('|')!=='attempts') {db.close();finish(new Error('unsupported-journal'));return;}
        db.onversionchange=()=>db.close();finish(null,db);
      };
    });
  }
  async function transact(create,mode,operation) {
    const db=await open(create);if (!db) return null;
    try {
      return await new Promise((resolve,reject)=>{
        let tx,result,reason;
        const timer=setTimeout(()=>{reason=new Error('journal-timeout');try{tx?.abort();}catch{}},timeoutMs);
        try {
          tx=db.transaction('attempts',mode);
          tx.oncomplete=()=>{clearTimeout(timer);resolve(result);};
          tx.onabort=()=>{clearTimeout(timer);reject(reason??new Error('journal-transaction-failed'));};
          tx.onerror=()=>{};
          const store=tx.objectStore('attempts');
          if (store.keyPath!=='id' || store.autoIncrement) throw new Error('unsupported-journal');
          operation(store,value=>{result=value;},error=>{reason=error;try{tx.abort();}catch{}});
        } catch(error) {clearTimeout(timer);try{tx?.abort();}catch{}reject(error);}
      });
    } finally {db.close();}
  }
  async function inspect() {
    const rows=await transact(false,'readonly',(store,set)=>{
      const req=store.getAll(undefined,2);req.onsuccess=()=>set(req.result);
    });
    if (!rows?.length) return null;
    if (rows.length!==1) fail('invalid-journal');
    const row=rows[0];
    if (!exact(row,['id','formatVersion','revision','phase','createdAt','updatedAt','before','candidate','beforeFingerprint','candidateFingerprint','integrity']) ||
      row.formatVersion!==1 || !PHASES.includes(row.phase) || typeof row.id!=='string' || !Number.isSafeInteger(row.revision) || row.revision<0 ||
      !Number.isFinite(Date.parse(row.createdAt)) || !Number.isFinite(Date.parse(row.updatedAt))) fail('invalid-journal');
    validate(row.before);validate(row.candidate);
    if (row.before.source.origin!==row.candidate.source.origin || row.before.databases[0].present!==row.candidate.databases[0].present ||
      await checksum(row)!==row.integrity || await fingerprint(row.before)!==row.beforeFingerprint ||
      await fingerprint(row.candidate)!==row.candidateFingerprint) fail('invalid-journal');
    return row;
  }
  async function persist(row,previous=null) {
    row=copy(row);row.integrity=await checksum(row);
    await transact(previous===null,'readwrite',(store,set,stop)=>{
      const req=store.getAll(undefined,2);
      req.onsuccess=()=>{
        const rows=req.result;
        if (previous===null ? rows.length!==0 : rows.length!==1 || rows[0].id!==previous.id || rows[0].integrity!==previous.integrity || rows[0].revision!==previous.revision) {
          stop(new Error('journal-conflict'));return;
        }
        store.put(row);set(row.id);
      };
    });
    const readback=await inspect();
    if (!readback || readback.integrity!==row.integrity) fail('journal-readback-failed');
    return readback;
  }
  async function phase(row,next) {
    return persist({...row,phase:next,revision:row.revision+1,updatedAt:clock().toISOString()},row);
  }
  async function replace(snapshot,signal) {
    aborted(signal);
    const target=snapshot.databases[0];
    if (target.present) {
      // Never initialize, upgrade or delete the existing Nutrition DB.
      await new Promise((resolve,reject)=>{
        let db,tx,settled=false;
        const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);db?.close();error?reject(error):resolve();};
        const timer=setTimeout(()=>{try{tx?.abort();}catch{}finish(new Error('nutrition-timeout'));},timeoutMs);
        let req;
        try {req=indexedDB.open('today_nutrition');}catch{finish(new Error('nutrition-unavailable'));return;}
        req.onupgradeneeded=()=>req.transaction.abort();
        req.onblocked=()=>finish(new Error('nutrition-blocked'));
        req.onerror=()=>finish(new Error('nutrition-open-failed'));
        req.onsuccess=()=>{
          db=req.result;if(settled){db.close();return;}
          try {
            if(db.version!==1 || [...db.objectStoreNames].sort().join('|')!==Object.keys(STORES).sort().join('|'))throw new Error('unsupported-nutrition');
            aborted(signal);tx=db.transaction(Object.keys(STORES),'readwrite');
            db.onversionchange=()=>{try{tx.abort();}catch{}finish(new Error('nutrition-changed'));};
            tx.onabort=()=>finish(new Error('nutrition-transaction-failed'));tx.onerror=()=>{};tx.oncomplete=()=>finish();
            for (const section of target.stores) {
              const store=tx.objectStore(section.name);
              if (store.keyPath!==section.keyPath || store.autoIncrement) throw new Error('unsupported-nutrition');
              store.clear();for(const entry of section.entries)store.put(copy(entry.value));
            }
          }catch(error){try{tx?.abort();}catch{}finish(error);}
        };
      });
    }
    for (const entry of snapshot.localStorageEntries) {
      aborted(signal);
      if (entry.present) storage.setItem(entry.key,entry.rawValue);
      else storage.removeItem(entry.key);
    }
  }
  async function matches(snapshot,expected) {
    const current=await capture();validate(current);
    return current.source.origin===snapshot.source.origin && await fingerprint(current)===expected;
  }
  async function rollback(row) {
    try {
      row=await phase(row,'ROLLING_BACK');
      await replace(row.before);
      if (!await matches(row.before,row.beforeFingerprint)) fail('rollback-readback-failed');
      row=await phase(row,'ROLLED_BACK');
      return {status:row.phase,syntheticOnly:true,restoreValidated:false};
    } catch {
      try {const latest=await inspect();if(latest?.id===row.id)await phase(latest,'RECOVERY_REQUIRED');}catch{}
      return {status:'RECOVERY_REQUIRED',syntheticOnly:true,restoreValidated:false};
    }
  }
  async function prepare({file,password,userConfirmed=false,signal}={}) {
    if(userConfirmed!==true)fail('preview-consent-required');aborted(signal);
    const source=await readBackupForPreview(file,password,{crypto,contracts,signal});validate(source);
    const at=clock(),{candidate,effects}=proposeNotificationRestore(source,at);validate(candidate);
    return barrier(async()=>{
      if(await inspect())fail('recovery-pending');aborted(signal);
      const before=copy(await capture());validate(before);
      if(before.source.origin!==candidate.source.origin)fail('unsupported-origin-transfer');
      if(before.databases[0].present!==candidate.databases[0].present)fail('database-presence-change-unsupported');
      const preview=Object.freeze({status:'synthetic-preview',applyAvailable:false,restoreValidated:false,
        expiresAt:new Date(at.getTime()+300000).toISOString(),notificationEffects:Object.freeze(effects),
        targetFingerprint:await fingerprint(before),candidateFingerprint:await fingerprint(candidate)});
      previews.set(preview,{before,candidate,expires:at.getTime()+300000});return preview;
    });
  }
  async function apply(preview,{replaceConfirmed=false,signal}={}) {
    if(replaceConfirmed!==true)fail('replace-consent-required');
    const plan=previews.get(preview);if(!plan)fail('invalid-preview');
    previews.delete(preview);aborted(signal);
    return barrier(async()=>{
      const at=clock();if(at.getTime()>=plan.expires)fail('preview-expired');
      if(await inspect())fail('recovery-pending');
      if(!await matches(plan.before,preview.targetFingerprint))fail('target-changed');
      const updated=proposeNotificationRestore(plan.candidate,at).candidate;
      if(await fingerprint(updated)!==preview.candidateFingerprint)fail('candidate-expired');
      aborted(signal);
      const body={id:crypto.randomUUID(),formatVersion:1,revision:0,phase:'PREPARED',createdAt:at.toISOString(),updatedAt:at.toISOString(),
        before:plan.before,candidate:plan.candidate,beforeFingerprint:preview.targetFingerprint,candidateFingerprint:preview.candidateFingerprint};
      if(estimate){const capacity=await estimate();if(capacity&&Number.isFinite(capacity.quota)&&Number.isFinite(capacity.usage)&&capacity.quota-capacity.usage<bytes(body).length*2)fail('insufficient-capacity');}
      aborted(signal);
      // No target write before durable, validated journal readback.
      let row=await persist(body);
      try {
        aborted(signal);row=await phase(row,'APPLYING');
        await replace(row.candidate,signal);row=await phase(row,'VERIFYING');
        if(!await matches(row.candidate,row.candidateFingerprint))fail('target-readback-failed');
        row=await phase(row,'COMMITTED');
        return {status:row.phase,syntheticOnly:true,restoreValidated:false};
      }catch{
        let latest;try{latest=await inspect();}catch{}
        return rollback(latest??row);
      }
    });
  }
  async function guardStartup() {
    try {
      return await barrier(async()=>{
        let row=await inspect(),recovered=false;if(!row)return {canStart:true,status:'NO_ATTEMPT',syntheticOnly:true};
        if(!['COMMITTED','ROLLED_BACK'].includes(row.phase)) {
          const result=await rollback(row);
          if(result.status!=='ROLLED_BACK')return {...result,canStart:false};
          row=await inspect();if(row?.phase!=='ROLLED_BACK')fail('rollback-journal-missing');
          recovered=true;
        }
        const snapshot=row.phase==='COMMITTED'?row.candidate:row.before;
        const expected=row.phase==='COMMITTED'?row.candidateFingerprint:row.beforeFingerprint;
        if(!await matches(snapshot,expected))return {canStart:false,status:'RECOVERY_REQUIRED',syntheticOnly:true};
        await transact(false,'readwrite',(store,set,stop)=>{
          const req=store.get(row.id);req.onsuccess=()=>{
            if(req.result?.integrity!==row.integrity){stop(new Error('journal-conflict'));return;}
            store.delete(row.id);set(true);
          };
        });
        if(await inspect())fail('cleanup-readback-failed');
        return {canStart:true,status:recovered?'ROLLED_BACK_AND_CLEANED':'VERIFIED_AND_CLEANED',syntheticOnly:true};
      });
    }catch{return {canStart:false,status:'RECOVERY_REQUIRED',syntheticOnly:true};}
  }
  async function exportRecovery({userConfirmed=false,password,confirmation,signal}={}) {
    if(userConfirmed!==true)fail('export-consent-required');
    return barrier(async()=>{
      const row=await inspect();if(!row)fail('no-recovery-copy');
      return createBackup({userConfirmed,password,confirmation,crypto,signal,barrier:fn=>fn(),capture:()=>copy(row.before)});
    });
  }
  return Object.freeze({prepare,apply,guardStartup,exportRecovery});
}
