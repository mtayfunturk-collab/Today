import assert from 'node:assert/strict';
import {skyFixture} from './support/sky-restore-fixtures.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto as crypto} from 'node:crypto';
import {IDBFactory, IDBDatabase, IDBObjectStore} from 'fake-indexeddb';
import {createSyntheticRecovery, RECOVERY_DB} from '../modules/backup-recovery.mjs';
import {LS_KEYS,STORES,captureSnapshot,createBackup,readBackupForPreview,verifyBackupFile} from '../modules/backup-export.mjs';
import {defaultState} from '../modules/notification-store.mjs';
import {fingerprintRestoreSnapshot} from '../modules/backup-restore-preview.mjs';
import {healthSeed} from './support/health-restore-fixtures.mjs';

let passed=0;
async function check(name,fn){await fn();passed++;console.log('PASS '+name);}
const context={window:{}};vm.runInNewContext(fs.readFileSync('modules/nutrition-contracts.js','utf8'),context);
const contracts=context.window.TodayNutritionContracts, password='synthetic recovery password 123';
const origin={appVersion:'2.23.3',origin:'https://today.test',runtime:'web'};
const copy=v=>JSON.parse(JSON.stringify(v));
const core=label=>JSON.stringify({schemaVersion:2,days:{'2026-07-01':{choice:'B',color:'old-pink-id',note:label+';\n🙂',changeLog:[{timestamp:'2026-07-01T12:00:00.000Z',type:'note',description:'original',note:'original'}]}},
  sky:skyFixture().sky,settings:{theme:'dark'},migration:{sourceKeys:['today_data']}});
function profile(label){return{id:'profile-'+label,type:'nutrition_profile',schemaVersion:1,createdAt:'2026-07-01T00:00:00.000Z',updatedAt:'2026-07-01T00:00:00.000Z',eventAt:null,
  source:{kind:'manual',referenceId:null,version:null},knowledgeStatus:'known',recordStatus:'archived',verificationStatus:'user_confirmed',calculationVersion:null,userEdited:false,
  payload:{trackingMode:'simple',dietaryConstraintIds:[],primaryGoalVersionId:null},extensions:{}};}
async function seedDB(f,label){
  await new Promise((resolve,reject)=>{const r=f.indexedDB.open('today_nutrition',1);
    r.onupgradeneeded=()=>{for(const [name,keyPath]of Object.entries(STORES))r.result.createObjectStore(name,{keyPath});};
    r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction(Object.keys(STORES),'readwrite');
      tx.objectStore('metadata').put({key:'database_state',storageSchemaVersion:1,contractVersion:1,createdAt:'2026-07-01T12:00:00.000Z',updatedAt:'2026-07-01T12:00:00.000Z',lastMigration:null,sourceLabel:label});
      tx.objectStore('records').put(profile(label));
      tx.objectStore('migration_backups').put({id:'historical-'+label,records:[],recordCount:0,contractVersion:0,storageSchemaVersion:0,status:'failed'});
      tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);
    };});
}
async function fixture(label='target',{db=true,all=false}={}){
  const indexedDB=new IDBFactory(), map=new Map(), writes=[];
  if(all)for(const key of LS_KEYS){
    let value='{}';
    if(key.startsWith('today.health.water.'))value='350';
    if(key.startsWith('today.health.wellness.')||key==='today.health.sport.workouts.v1')value='[{"dayKey":"2026-07-01","note":"health '+label+'"}]';
    map.set(key,value);
  }
  if(all)for(const [key,value]of Object.entries(healthSeed(label)))map.set(key,value);
  map.set('today_store_v2',core(label));map.set('today_store_v2_backup',core(label+'-backup'));
  map.set('today_app_v10',JSON.stringify({v:10,days:{},logs:{'2026-07-01':{entries:[1782907200000],changes:[],retainedLabel:label}}}));
  const notification=copy(defaultState());notification.preferences.updateEnabled=true;notification.lastNotifiedUpdateVersion='2.20.1';
  map.set('today_ai_delivery_v1',JSON.stringify(notification));map.set('unrelated-secret','FOREIGN '+label);
  let failure=null,locked=false,at=new Date('2026-11-02T12:00:00Z');
  const write=(op,key,value)=>{writes.push({op,key});if(failure?.({op,key,value,index:writes.length}))throw Error('PRIVATE_QUOTA');
    if(op==='set')map.set(key,value);else map.delete(key);};
  const storage={get length(){return map.size;},key:i=>[...map.keys()][i],getItem:k=>map.get(k)??null,
    setItem:(k,v)=>write('set',k,v),removeItem:k=>write('remove',k)};
  const f={indexedDB,map,storage,writes,setFailure:fn=>{failure=fn;},advance:ms=>{at=new Date(at.getTime()+ms);}};
  f.capture=()=>captureSnapshot({storage,indexedDB,contracts,crypto,source:origin});
  f.options={syntheticProfile:true,indexedDB,storage,contracts,crypto,capture:()=>{assert.equal(locked,true);return f.capture();},
    barrier:async fn=>{if(locked)throw Error('other-context');locked=true;try{return await fn();}finally{locked=false;}},now:()=>at};
  f.controller=(extra={})=>createSyntheticRecovery({...f.options,...extra});
  if(db)await seedDB(f,label);return f;
}
async function exported(f){return createBackup({userConfirmed:true,password,confirmation:password,crypto,barrier:fn=>fn(),capture:f.capture});}
const source=await fixture('source',{all:true}), saved=await exported(source);
const args={userConfirmed:true,file:saved.file,password};
async function journal(f){return new Promise((resolve,reject)=>{
  const r=f.indexedDB.open(RECOVERY_DB);let absent=false;r.onupgradeneeded=()=>{absent=true;r.transaction.abort();};
  r.onerror=()=>absent?resolve([]):reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('attempts','readonly'),q=tx.objectStore('attempts').getAll();
    tx.oncomplete=()=>{db.close();resolve(q.result);};tx.onabort=()=>{db.close();reject(tx.error);};};
});}
async function mutateJournal(f,fn){
  await new Promise((resolve,reject)=>{const r=f.indexedDB.open(RECOVERY_DB);r.onsuccess=()=>{const db=r.result,tx=db.transaction('attempts','readwrite'),store=tx.objectStore('attempts'),q=store.getAll();
    q.onsuccess=()=>{const row=q.result[0];fn(row,store);};tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>{db.close();reject(tx.error);};};});
}
async function resign(row){const {integrity,...body}=row;row.integrity=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(body)))).toString('hex');return row;}
async function replaceJournal(f,row){await mutateJournal(f,(_,store)=>store.put(row));}
async function digest(f){return fingerprintRestoreSnapshot(await f.capture(),crypto);}
await check('prototype requires an explicit synthetic-profile assertion',()=>assert.throws(()=>createSyntheticRecovery(),e=>e.code==='synthetic-profile-required'));
await check('construction and no-attempt startup guard do not initialize recovery storage',async()=>{
  const f=await fixture(),c=f.controller(),before=await f.indexedDB.databases();assert.equal((await c.guardStartup()).canStart,true);
  assert.deepEqual(await f.indexedDB.databases(),before);assert.equal(f.writes.length,0);
});
await check('preview reads but neither journals nor overwrites source or target',async()=>{
  const f=await fixture(),c=f.controller(),before=await digest(f);const p=await c.prepare(args);
  assert.equal(p.applyAvailable,false);assert.equal(p.restoreValidated,false);assert.equal(await digest(f),before);
  assert.deepEqual(await journal(f),[]);assert.equal(f.writes.length,0);assert(!JSON.stringify(p).includes('source;'));
});
await check('preview consent is separate from selecting the file',async()=>{
  const f=await fixture();await assert.rejects(f.controller().prepare({...args,userConfirmed:false}),e=>e.code==='preview-consent-required');assert.equal(f.writes.length,0);
});
await check('replace requires a separate final confirmation',async()=>{
  const f=await fixture(),c=f.controller(),p=await c.prepare(args);await assert.rejects(c.apply(p),e=>e.code==='replace-consent-required');assert.deepEqual(await journal(f),[]);
});
await check('cloned preview and another coordinator cannot authorize a replace',async()=>{
  const f=await fixture(),c=f.controller(),p=await c.prepare(args);
  await assert.rejects(c.apply(copy(p),{replaceConfirmed:true}),e=>e.code==='invalid-preview');
  await assert.rejects(f.controller().apply(p,{replaceConfirmed:true}),e=>e.code==='invalid-preview');
});
await check('wrong password fails before creating a recovery journal',async()=>{
  const f=await fixture();await assert.rejects(f.controller().prepare({...args,password:'wrong'}),e=>e.code==='file-verification-failed');assert.deepEqual(await journal(f),[]);
});
await check('target fingerprint is rechecked under the same exclusive apply barrier',async()=>{
  const f=await fixture(),c=f.controller(),p=await c.prepare(args);f.map.set('today_data','{"2026-07-01":{"note":"changed"}}');
  await assert.rejects(c.apply(p,{replaceConfirmed:true}),e=>e.code==='target-changed');assert.deepEqual(await journal(f),[]);assert.equal(f.writes.length,0);
});
await check('expired preview is not automatically reapproved',async()=>{
  const f=await fixture(),c=f.controller(),p=await c.prepare(args);f.advance(300000);
  await assert.rejects(c.apply(p,{replaceConfirmed:true}),e=>e.code==='preview-expired');assert.deepEqual(await journal(f),[]);
});
await check('estimated insufficient journal capacity does not touch target data',async()=>{
  const f=await fixture(),before=await digest(f),c=f.controller({estimate:async()=>({quota:100,usage:99})}),p=await c.prepare(args);
  await assert.rejects(c.apply(p,{replaceConfirmed:true}),e=>e.code==='insufficient-capacity');assert.equal(await digest(f),before);assert.deepEqual(await journal(f),[]);
});
await check('real journal write failure leaves all target stores unchanged',async()=>{
  const f=await fixture(),before=await digest(f),c=f.controller(),p=await c.prepare(args),original=IDBDatabase.prototype.transaction;
  try{IDBDatabase.prototype.transaction=function(names,mode,...rest){if(this.name===RECOVERY_DB&&mode==='readwrite')throw Error('PRIVATE_QUOTA');return original.call(this,names,mode,...rest);};
    await assert.rejects(c.apply(p,{replaceConfirmed:true}));
  }finally{IDBDatabase.prototype.transaction=original;}
  assert.equal(await digest(f),before);assert.equal(f.writes.length,0);
});
await check('happy replace preserves all 23 raw keys, three stores, histories and foreign values',async()=>{
  const f=await fixture(),c=f.controller(),p=await c.prepare(args),result=await c.apply(p,{replaceConfirmed:true});
  assert.equal(result.status,'COMMITTED');assert.equal(result.syntheticOnly,true);assert.equal(result.restoreValidated,false);
  for(const key of LS_KEYS)if(key!=='today_ai_delivery_v1')assert.equal(f.map.get(key),source.map.get(key),key);
  assert.deepEqual((await f.capture()).databases,(await source.capture()).databases);assert.equal(f.map.get('unrelated-secret'),'FOREIGN target');
  const rows=await journal(f);assert.equal(rows.length,1);assert.equal(rows[0].phase,'COMMITTED');assert.equal(rows[0].before.localStorageEntries[0].rawValue,core('target'));
  assert(!JSON.stringify(rows).includes(password));
});
await check('imported notification and analysis permissions stay disabled without OS actions',async()=>{
  const f=await fixture(),c=f.controller(),p=await c.prepare(args);await c.apply(p,{replaceConfirmed:true});
  const v=JSON.parse(f.map.get('today_ai_delivery_v1'));assert.equal(v.preferences.updateEnabled,false);assert.equal(v.preferences.aiEnabled,false);
  assert.equal(v.dailyAnalysisConsent.enabled,false);assert.deepEqual(v.dispatches,[]);assert.equal(v.lastNotifiedUpdateVersion,null);
});
await check('one preview cannot apply twice',async()=>{
  const f=await fixture(),c=f.controller(),p=await c.prepare(args);await c.apply(p,{replaceConfirmed:true});await assert.rejects(c.apply(p,{replaceConfirmed:true}),e=>e.code==='invalid-preview');
});
await check('a retained terminal journal blocks a new restore until the next safe startup',async()=>{
  const f=await fixture(),c=f.controller(),p=await c.prepare(args);await c.apply(p,{replaceConfirmed:true});await assert.rejects(c.prepare(args),e=>e.code==='recovery-pending');
});
await check('next startup verifies committed data before deleting the sensitive journal copy',async()=>{
  const f=await fixture(),c=f.controller(),p=await c.prepare(args);await c.apply(p,{replaceConfirmed:true});const before=await digest(f);
  const guard=await f.controller().guardStartup();assert.equal(guard.status,'VERIFIED_AND_CLEANED');assert.equal(guard.canStart,true);
  assert.deepEqual(await journal(f),[]);assert.equal(await digest(f),before);
});
await check('a mismatched committed target blocks startup and retains the before-image',async()=>{
  const f=await fixture(),c=f.controller(),p=await c.prepare(args);await c.apply(p,{replaceConfirmed:true});f.map.set('today_data','{"unexpected":true}');
  assert.equal((await f.controller().guardStartup()).canStart,false);assert.equal((await journal(f))[0].phase,'COMMITTED');
});
await check('source-absent known keys are removed without clearing foreign storage',async()=>{
  const src=await fixture('sparse'),file=await exported(src),f=await fixture('target',{all:true}),c=f.controller(),p=await c.prepare({...args,file:file.file});
  await c.apply(p,{replaceConfirmed:true});assert.equal(f.map.has('today_data'),false);assert.equal(f.map.get('unrelated-secret'),'FOREIGN target');
  assert(f.writes.every(w=>LS_KEYS.includes(w.key)));
});
await check('absent to absent succeeds without initializing a Nutrition DB',async()=>{
  const src=await fixture('source',{db:false}),file=await exported(src),f=await fixture('target',{db:false}),c=f.controller(),p=await c.prepare({...args,file:file.file});
  assert.equal((await c.apply(p,{replaceConfirmed:true})).status,'COMMITTED');assert.deepEqual((await f.indexedDB.databases()).map(d=>d.name),[RECOVERY_DB]);
});
await check('unsupported Nutrition presence change is rejected before any recovery DB creation',async()=>{
  const f=await fixture('target',{db:false});await assert.rejects(f.controller().prepare(args),e=>e.code==='database-presence-change-unsupported');assert.deepEqual(await f.indexedDB.databases(),[]);
});
await check('transient localStorage failure rolls back already-applied DB and raw keys',async()=>{
  const f=await fixture(),before=await digest(f),c=f.controller(),p=await c.prepare(args);let hit=false;
  f.setFailure(({key})=>{if(key==='today_app_v10'&&!hit){hit=true;return true;}return false;});
  assert.equal((await c.apply(p,{replaceConfirmed:true})).status,'ROLLED_BACK');assert.equal(await digest(f),before);
  assert.equal((await journal(f))[0].phase,'ROLLED_BACK');
});
await check('persistent rollback failure retains full before-image and blocks startup',async()=>{
  const f=await fixture(),c=f.controller(),p=await c.prepare(args);f.setFailure(({key})=>key==='today_app_v10');
  assert.equal((await c.apply(p,{replaceConfirmed:true})).status,'RECOVERY_REQUIRED');
  assert.equal((await journal(f))[0].before.localStorageEntries[0].rawValue,core('target'));
  assert.equal((await f.controller().guardStartup()).canStart,false);
});
await check('fresh coordinator recovers the previous state once the storage failure clears',async()=>{
  const f=await fixture(),before=await digest(f),c=f.controller(),p=await c.prepare(args);f.setFailure(({key})=>key==='today_app_v10');await c.apply(p,{replaceConfirmed:true});
  f.setFailure(null);const guard=await f.controller().guardStartup();assert.equal(guard.canStart,true);assert.equal(guard.status,'ROLLED_BACK_AND_CLEANED');assert.equal(await digest(f),before);
  assert.deepEqual(await journal(f),[]);assert.equal((await f.controller().guardStartup()).status,'NO_ATTEMPT');
});
await check('an interrupted APPLYING journal defaults to before-image, never resumes candidate',async()=>{
  const f=await fixture(),before=await digest(f),c=f.controller(),p=await c.prepare(args);await c.apply(p,{replaceConfirmed:true});
  const row=(await journal(f))[0];row.phase='APPLYING';row.revision++;await replaceJournal(f,await resign(row));
  const result=await f.controller().guardStartup();assert.equal(result.status,'ROLLED_BACK_AND_CLEANED');assert.equal(await digest(f),before);
});
await check('journal tampering prevents startup without silently deleting the only recovery copy',async()=>{
  const f=await fixture(),c=f.controller(),p=await c.prepare(args);await c.apply(p,{replaceConfirmed:true});
  await mutateJournal(f,(row,store)=>{row.before.localStorageEntries[0].rawValue=core('tampered');store.put(row);});
  assert.equal((await f.controller().guardStartup()).canStart,false);assert.equal((await journal(f)).length,1);
});
await check('journal cleanup failure keeps startup blocked and the journal present',async()=>{
  const f=await fixture(),c=f.controller(),p=await c.prepare(args);await c.apply(p,{replaceConfirmed:true});const original=IDBDatabase.prototype.transaction;
  try{IDBDatabase.prototype.transaction=function(names,mode,...rest){if(this.name===RECOVERY_DB&&mode==='readwrite')throw Error('cleanup-failed');return original.call(this,names,mode,...rest);};
    assert.equal((await f.controller().guardStartup()).canStart,false);
  }finally{IDBDatabase.prototype.transaction=original;}
  assert.equal((await journal(f)).length,1);
});
await check('before-image can be exported encrypted even when live data cannot be read',async()=>{
  const f=await fixture(),before=await f.capture(),c=f.controller(),p=await c.prepare(args);f.setFailure(({key})=>key==='today_app_v10');await c.apply(p,{replaceConfirmed:true});
  f.map.set('today_store_v2','malformed live data');
  const file=await c.exportRecovery({userConfirmed:true,password,confirmation:password});assert((await verifyBackupFile(file.file,password)).ok);
  const opened=await readBackupForPreview(file.file,password,{contracts,crypto});assert.deepEqual(opened.localStorageEntries,before.localStorageEntries);assert.deepEqual(opened.databases,before.databases);
  assert.equal((await journal(f)).length,1);
});
await check('recovery export requires its own consent and password confirmation',async()=>{
  const f=await fixture(),c=f.controller();await assert.rejects(c.exportRecovery({password,confirmation:password}),e=>e.code==='export-consent-required');assert.deepEqual(await journal(f),[]);
});
await check('cancel before apply creates no recovery journal',async()=>{
  const f=await fixture(),c=f.controller(),p=await c.prepare(args),ac=new AbortController();ac.abort();
  await assert.rejects(c.apply(p,{replaceConfirmed:true,signal:ac.signal}),e=>e.code==='cancelled');assert.deepEqual(await journal(f),[]);
});
await check('cancellation during key replacement rolls back without reusing the aborted signal',async()=>{
  const f=await fixture(),before=await digest(f),c=f.controller(),p=await c.prepare(args),ac=new AbortController();
  f.setFailure(({key})=>{if(key==='today_store_v2')ac.abort();return false;});
  assert.equal((await c.apply(p,{replaceConfirmed:true,signal:ac.signal})).status,'ROLLED_BACK');assert.equal(await digest(f),before);
});
await check('failed journal readback never reaches the target write phase',async()=>{
  const f=await fixture(),before=await digest(f),c=f.controller(),p=await c.prepare(args),original=IDBDatabase.prototype.transaction;
  let wrote=false,blocked=false;
  try{IDBDatabase.prototype.transaction=function(names,mode,...rest){
    if(this.name===RECOVERY_DB){if(mode==='readwrite')wrote=true;else if(wrote&&!blocked){blocked=true;throw Error('readback-failed');}}
    return original.call(this,names,mode,...rest);
  };await assert.rejects(c.apply(p,{replaceConfirmed:true}));}finally{IDBDatabase.prototype.transaction=original;}
  assert.equal(f.writes.length,0);assert.equal(await digest(f),before);assert.equal((await journal(f))[0].phase,'PREPARED');
  assert.equal((await f.controller().guardStartup()).status,'ROLLED_BACK_AND_CLEANED');
});
await check('aborted Nutrition transaction restores all three stores together',async()=>{
  const f=await fixture(),before=await f.capture(),c=f.controller(),p=await c.prepare(args),original=IDBObjectStore.prototype.put;
  let failed=false;
  try{IDBObjectStore.prototype.put=function(...values){
    if(this.transaction.db.name==='today_nutrition'&&this.name==='metadata'&&!failed){failed=true;throw Error('synthetic-transaction-failure');}
    return original.apply(this,values);
  };assert.equal((await c.apply(p,{replaceConfirmed:true})).status,'ROLLED_BACK');}finally{IDBObjectStore.prototype.put=original;}
  assert.equal(failed,true);assert.deepEqual((await f.capture()).databases,before.databases);
});
await check('unknown journal database version is blocked without migration',async()=>{
  const f=await fixture();await new Promise((resolve,reject)=>{const r=f.indexedDB.open(RECOVERY_DB,2);r.onupgradeneeded=()=>r.result.createObjectStore('attempts',{keyPath:'id'});
    r.onsuccess=()=>{r.result.close();resolve();};r.onerror=()=>reject(r.error);});
  assert.equal((await f.controller().guardStartup()).canStart,false);
  assert.equal((await f.indexedDB.databases()).find(d=>d.name===RECOVERY_DB).version,2);assert.equal(f.writes.length,0);
});
await check('multiple attempts are not silently selected or cleaned',async()=>{
  const f=await fixture(),c=f.controller(),p=await c.prepare(args);await c.apply(p,{replaceConfirmed:true});
  await mutateJournal(f,(row,store)=>{row.id='unexpected-second-attempt';store.put(row);});
  assert.equal((await f.controller().guardStartup()).canStart,false);assert.equal((await journal(f)).length,2);
});
await check('cancellation while estimating capacity never writes the prepared journal',async()=>{
  const f=await fixture(),ac=new AbortController(),c=f.controller({estimate:async()=>{ac.abort();return {quota:10000000,usage:0};}}),p=await c.prepare(args);
  await assert.rejects(c.apply(p,{replaceConfirmed:true,signal:ac.signal}),e=>e.code==='cancelled');assert.deepEqual(await journal(f),[]);assert.equal(f.writes.length,0);
});
await check('after startup recovery new normal records do not collide with a stale terminal attempt',async()=>{
  const f=await fixture(),c=f.controller(),p=await c.prepare(args);f.setFailure(({key})=>key==='today_app_v10');await c.apply(p,{replaceConfirmed:true});
  f.setFailure(null);assert.equal((await f.controller().guardStartup()).status,'ROLLED_BACK_AND_CLEANED');
  f.map.set('today_data','{"newAfterSafeStartup":true}');assert.equal((await f.controller().guardStartup()).canStart,true);
  assert.equal(f.map.get('today_data'),'{"newAfterSafeStartup":true}');assert.deepEqual(await journal(f),[]);
});
console.log(`Backup Recovery: ${passed}/${passed} successful`);
