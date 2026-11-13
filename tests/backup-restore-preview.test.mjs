import assert from 'node:assert/strict';
import {skyFixture} from './support/sky-restore-fixtures.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto as crypto} from 'node:crypto';
import {IDBFactory} from 'fake-indexeddb';
import {LS_KEYS, STORES, captureSnapshot, createBackup} from '../modules/backup-export.mjs';
import {prepareRestorePreview, revalidateRestorePreview, discardRestorePreview} from '../modules/backup-restore-preview.mjs';
import {previewFailureMessage} from '../modules/backup-restore-ui.mjs';
import {defaultState, sanitizeObservation} from '../modules/notification-store.mjs';

let passed = 0;
async function check(name, test) { await test(); passed++; console.log('PASS '+name); }
await check('preview errors show only bounded diagnostic codes, never raw data',()=>{
  const detail={code:'source-validation-failed',message:'PRIVATE_NOTE'};
  const result=previewFailureMessage(detail);
  assert.match(result,/Tanı kodu: source-validation-failed/);
  assert(!result.includes('PRIVATE_NOTE'));
  assert.match(previewFailureMessage({code:'other-client'}),/başka bir Today penceresi/);
  assert(!previewFailureMessage({code:'PRIVATE_NOTE'}).includes('PRIVATE_NOTE'));
});
const sandbox = {window:{}};
vm.runInNewContext(fs.readFileSync('modules/nutrition-contracts.js','utf8'),sandbox);
const contracts = sandbox.window.TodayNutritionContracts;
const pass = 'synthetic test password 123';
const AT = '2026-11-02T12:00:00.000Z';
const clone = value => JSON.parse(JSON.stringify(value));
const source = {appVersion:'2.23.3',origin:'https://today.test',runtime:'web'};
const core = note => JSON.stringify({schemaVersion:2, days:{'2026-07-01':{
  choice:'A', color:'legacy-pink-id',note,changeLog:[{timestamp:'2026-07-01T12:00:00.000Z',type:'note',description:'previous',oldNote:'previous'}],coreSkyLink:skyFixture().coreSkyLink}},
  sky:skyFixture().sky,settings:{theme:'dark'}});
function profile(id='profile-one') {
  return {id,type:'nutrition_profile',schemaVersion:1,createdAt:'2026-07-01T00:00:00.000Z',
    updatedAt:'2026-07-01T00:00:00.000Z',eventAt:null,source:{kind:'manual',referenceId:null,version:null},
    knowledgeStatus:'known',recordStatus:'archived',verificationStatus:'user_confirmed',
    calculationVersion:null,userEdited:false,payload:{trackingMode:'simple',dietaryConstraintIds:[],primaryGoalVersionId:null},extensions:{}};
}
function fixture(seed={}) {
  const map = new Map(Object.entries(seed)), indexedDB = new IDBFactory();
  let reads=0;
  const storage = {get length(){return map.size;},key:i=>[...map.keys()][i],
    getItem:key=>{ reads++; return map.get(key)??null; },
    setItem(){throw Error('unexpected write');},removeItem(){throw Error('unexpected removal');}};
  return {map,indexedDB,storage,reads:()=>reads,
    capture:()=>captureSnapshot({storage,indexedDB,crypto,contracts,source})};
}
async function seedDatabase(f,records=[]) {
  await new Promise((resolve,reject)=>{
    const req=f.indexedDB.open('today_nutrition',1);
    req.onupgradeneeded=()=>{for(const [name,keyPath]of Object.entries(STORES))req.result.createObjectStore(name,{keyPath});};
    req.onerror=()=>reject(req.error);
    req.onsuccess=()=>{
      const db=req.result,tx=db.transaction(Object.keys(STORES),'readwrite');
      tx.objectStore('metadata').put({key:'database_state',storageSchemaVersion:1,contractVersion:1,createdAt:'2026-07-01T12:00:00.000Z',updatedAt:'2026-07-01T12:00:00.000Z',lastMigration:null});
      tx.objectStore('migration_backups').put({id:'historical',storageSchemaVersion:0,contractVersion:0,recordCount:0,records:[]});
      for(const record of records)tx.objectStore('records').put(record);
      tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);
    };
  });
}
const b64 = bytes=>Buffer.from(bytes).toString('base64');
// Independent producer: authenticate malformed but self-consistent data. Integrity is not semantics.
async function seal(payload) {
  const p=clone(payload),encode=value=>new TextEncoder().encode(JSON.stringify(value));
  p.manifest=await Promise.all([...p.localStorageEntries.map(e=>['ls:'+e.key,e]),...p.databases.map(d=>['db:'+d.name,d])].map(async([name,v])=>({
    name,byteLength:encode(v).length,count:Array.isArray(v.stores)?v.stores.reduce((n,s)=>n+s.entries.length,0):v.present?1:0,
    sha256:Buffer.from(await crypto.subtle.digest('SHA-256',encode(v))).toString('hex')})));
  const c={kdf:'PBKDF2-SHA256',iterations:600000,salt:b64(crypto.getRandomValues(new Uint8Array(16))),
    cipher:'AES-GCM-256',iv:b64(crypto.getRandomValues(new Uint8Array(12))),tagLength:128};
  const header={format:p.format,envelopeVersion:1,crypto:c};
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:Buffer.from(c.salt,'base64'),iterations:600000},material,{name:'AES-GCM',length:256},false,['encrypt']);
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv:Buffer.from(c.iv,'base64'),additionalData:encode(header),tagLength:128},key,encode(p));
  return JSON.stringify({...header,ciphertext:b64(ciphertext)});
}
const original=fixture({today_store_v2:core('SOURCE_PRIVATE\n🙂'),today_data:'{}'});
await seedDatabase(original,[profile()]);
const snapshot=await original.capture();
const saved=await createBackup({userConfirmed:true,password:pass,confirmation:pass,crypto,
  barrier:fn=>fn(),capture:()=>original.capture()});
function args(f=fixture(),extra={}) {return {userConfirmed:true,file:saved.file,password:pass,crypto,contracts,
  barrier:fn=>fn(),capture:f.capture,now:()=>new Date(AT),...extra};}
async function rejectedMutation(mutate, code) {
  const p=clone(snapshot);mutate(p);
  const f=fixture();
  await assert.rejects(prepareRestorePreview(args(f,{file:await seal(p)})),e=>e.code===code);
  assert.equal(f.reads(),0,'invalid source must not read target');
}
await check('preview consent is separate from file selection; no target read without consent',async()=>{
  const f=fixture();await assert.rejects(prepareRestorePreview(args(f,{userConfirmed:false})),e=>e.code==='preview-consent-required');assert.equal(f.reads(),0);
});
await check('no unlocked target snapshot fallback',async()=>{
  const f=fixture();await assert.rejects(prepareRestorePreview(args(f,{barrier:null})),e=>e.code==='coordination-unavailable');assert.equal(f.reads(),0);
});
await check('wrong password reveals neither source detail nor target records',async()=>{
  const f=fixture();await assert.rejects(prepareRestorePreview(args(f,{password:'wrong'})),e=>e.code==='file-verification-failed'&&!e.message.includes('SOURCE_PRIVATE'));assert.equal(f.reads(),0);
});
await check('damaged authenticated file is rejected before target access',async()=>{
  const file=JSON.parse(saved.file);file.ciphertext='AAAA'+file.ciphertext.slice(4);const f=fixture();
  await assert.rejects(prepareRestorePreview(args(f,{file:JSON.stringify(file)})),e=>e.code==='file-verification-failed');assert.equal(f.reads(),0);
});
await check('extra payload fields cannot become executable restore instructions',()=>rejectedMutation(p=>p.instructions={upload:'https://invalid.test'},'unsupported-payload'));
await check('unsupported coverage registry cannot be previewed as complete',()=>rejectedMutation(p=>p.coverageRegistryVersion=2,'file-verification-failed'));
await check('unknown localStorage key is never accepted from a valid encrypted file',()=>rejectedMutation(p=>p.localStorageEntries[0].key='other_app_secret','file-verification-failed'));
await check('native source is blocked rather than implying OS permission portability',()=>rejectedMutation(p=>p.source.runtime='native','unsupported-source-runtime'));
await check('future source version is not silently migrated',()=>rejectedMutation(p=>p.source.appVersion='99.0.0','unsupported-source-runtime'));
await check('extra fields in absent database cannot smuggle a hidden store',()=>rejectedMutation(p=>p.databases[0]={name:'today_nutrition',present:false,hidden:[]},'invalid-database'));
await check('key/value ID mismatch is rejected even with authentic manifests',()=>rejectedMutation(p=>p.databases[0].stores[0].entries[0].key='different-id','invalid-record-key'));
await check('duplicate metadata keys are rejected instead of last-write-wins',()=>rejectedMutation(p=>p.databases[0].stores[1].entries.push(clone(p.databases[0].stores[1].entries[0])),'invalid-record-key'));
await check('unknown record type is not restored from an authenticated file',()=>rejectedMutation(p=>p.databases[0].stores[0].entries[0].value.type='untrusted','source-validation-failed'));
await check('dangling nutrition reference is rejected',()=>rejectedMutation(p=>p.databases[0].stores[0].entries[0].value.payload.dietaryConstraintIds=['missing-constraint'],'source-validation-failed'));
await check('unsupported DB keyPath cannot redirect record application',()=>rejectedMutation(p=>p.databases[0].stores[0].keyPath='payload','invalid-store'));
await check('invalid calendar dates cannot be normalized into a different day',()=>rejectedMutation(p=>{
  const e=p.localStorageEntries[0],v=JSON.parse(e.rawValue);v.days['2026-02-30']=v.days['2026-07-01'];e.rawValue=JSON.stringify(v);
},'invalid-core-days'));
await check('nontext Core note is rejected rather than stringified',()=>rejectedMutation(p=>{
  const e=p.localStorageEntries[0],v=JSON.parse(e.rawValue);v.days['2026-07-01'].note={html:'PRIVATE'};e.rawValue=JSON.stringify(v);
},'invalid-core-day'));
await check('duplicate raw JSON note properties cannot bypass semantic checks',()=>rejectedMutation(p=>{
  p.localStorageEntries[0].rawValue='{"schemaVersion":2,"days":{},"days":{"2026-01-01":{"note":"SECRET"}}}';
},'source-validation-failed'));
await check('raw adds, replacements, removals and date range are previewed without exposing notes',async()=>{
  const f=fixture({today_store_v2:core('TARGET_PRIVATE'),today_data_v1:'{}',unrelated:'FOREIGN_PRIVATE'});
  await seedDatabase(f,[profile('target-profile')]);const before=await f.capture(),preview=await prepareRestorePreview(args(f));
  assert.deepEqual(preview.localStorage,{added:1,changed:1,removed:1,unchanged:0});
  assert.deepEqual(preview.stores[0],{name:'records',added:1,changed:0,removed:1,unchanged:0});
  assert.deepEqual(preview.coreDays,{count:1,earliest:'2026-07-01',latest:'2026-07-01'});
  assert(!/SOURCE_PRIVATE|TARGET_PRIVATE|FOREIGN_PRIVATE|legacy-pink-id|birthDate|profile-one/.test(JSON.stringify(preview)));
  const after=await f.capture();assert.deepEqual(after.localStorageEntries,before.localStorageEntries);assert.deepEqual(after.databases,before.databases);
});
await check('byte-level note whitespace and Unicode differences are counted without modifying source',async()=>{
  const f=fixture({today_store_v2:core('SOURCE_PRIVATE\n🙂 '),today_data:'{}'});await seedDatabase(f,[profile()]);
  const raw=f.map.get('today_store_v2');const p=await prepareRestorePreview(args(f));assert.equal(p.localStorage.changed,1);assert.equal(f.map.get('today_store_v2'),raw);
});
await check('no missing Nutrition or recovery database is initialized by preview',async()=>{
  const f=fixture(),p=await prepareRestorePreview(args(f));assert.equal(p.databaseTransition,'create');
  assert(p.blockers.includes('database-presence-change-unsupported'));assert.deepEqual(await f.indexedDB.databases(),[]);
});
await check('source-absent DB reports deletion as blocked, never deletes target',async()=>{
  const sourcePayload=await fixture().capture(),f=fixture();await seedDatabase(f,[profile()]);
  const p=await prepareRestorePreview(args(f,{file:await seal(sourcePayload)}));assert.equal(p.databaseTransition,'remove');
  assert.equal((await f.indexedDB.databases())[0].name,'today_nutrition');assert.equal((await f.capture()).databases[0].stores[0].entries.length,1);
});
await check('same-origin is required before any prospective transfer',async()=>{
  const p=clone(snapshot);p.source.origin='https://another.test';
  await assert.rejects(prepareRestorePreview(args(fixture(),{file:await seal(p)})),e=>e.code==='unsupported-origin-transfer');
});
function notification() {
  const v=clone(defaultState());v.preferences.updateEnabled=true;v.preferences.aiEnabled=true;v.preferences.localTime='20:00';
  v.dailyAnalysisConsent={enabled:true,purpose:'daily',grantedAt:'2026-10-20T12:00:00Z',expiresAt:'2026-10-27T12:00:00Z',windowDays:7,scope:{core:['daily-choice'],health:[],sky:[]}};
  const report=sanitizeObservation({schemaVersion:1,window:{startDate:'2026-10-20',endDate:'2026-10-20',days:1},observedDays:1,omittedEvents:0,status:'observed',
    observations:[{metric:'core',kind:'daily-observation',recordedDays:1,calendarDays:1,values:[{localDate:'2026-10-20',value:'A'}],repeatedValues:[]}]}).report;
  v.insights=[{id:'insight-opaque-one',createdAt:'2026-10-20T12:00:00.000Z',expiresAt:'2026-10-27T12:00:00.000Z',rulesetId:'test:rules',window:report.window,report}];
  v.dispatches=[{id:123,kind:'ai',insightId:'insight-opaque-one',version:null,localDate:'2026-10-20',zone:'UTC',scheduledFor:'2026-10-20T20:00:00Z',state:'scheduled'}];
  v.lastNotifiedUpdateVersion='2.23.3';return v;
}
await check('notification permissions, dispatch reset and expired archive are explicit memory-only effects',async()=>{
  const raw=JSON.stringify(notification()),f=fixture({today_ai_delivery_v1:raw}),p=await f.capture();
  const preview=await prepareRestorePreview(args(f,{file:await seal(p)}));
  assert.deepEqual(preview.notificationEffects,{present:true,permissionsReset:true,dispatchesRemoved:1,expiredInsightsRemoved:1});
  assert.equal(f.map.get('today_ai_delivery_v1'),raw);assert.equal(preview.localStorage.changed,1);
});
await check('unexpired observations retain their original TTL in the proposed policy',async()=>{
  const f=fixture({today_ai_delivery_v1:JSON.stringify(notification())}),p=await f.capture();
  const preview=await prepareRestorePreview(args(f,{file:await seal(p),now:()=>new Date('2026-10-22T12:00:00Z')}));
  assert.equal(preview.notificationEffects.expiredInsightsRemoved,0);assert.equal(JSON.parse(f.map.get('today_ai_delivery_v1')).insights[0].expiresAt,'2026-10-27T12:00:00.000Z');
});
await check('no live permission state is invented when archive is absent',async()=>{
  const f=fixture(),p=await prepareRestorePreview(args(f));assert.equal(p.notificationEffects.present,false);assert.equal(f.map.has('today_ai_delivery_v1'),false);
});
await check('preview is deeply immutable and cannot be mistaken for apply approval',async()=>{
  const p=await prepareRestorePreview(args());assert.equal(p.applyAvailable,false);assert.equal(p.restoreValidated,false);
  assert(Object.isFrozen(p.stores[0]));assert.throws(()=>{p.applyAvailable=true;},TypeError);
  assert(p.blockers.includes('journal-and-startup-guard-not-implemented'));
});
await check('fresh unchanged target check still grants no write permission',async()=>{
  const p=await prepareRestorePreview(args());assert.deepEqual(await revalidateRestorePreview(p),{unchanged:true,applyAvailable:false,restoreValidated:false});
});
await check('modified target invalidates the preview; old object cannot be retried',async()=>{
  const f=fixture(),p=await prepareRestorePreview(args(f));f.map.set('today_data','{"2026-07-01":{"note":"changed"}}');
  await assert.rejects(revalidateRestorePreview(p),e=>e.code==='target-changed');
  await assert.rejects(revalidateRestorePreview(p),e=>e.code==='invalid-preview');
});
await check('metadata and recovery history changes also invalidate preview',async()=>{
  const f=fixture();await seedDatabase(f,[profile()]);const p=await prepareRestorePreview(args(f));
  await new Promise((resolve,reject)=>{const r=f.indexedDB.open('today_nutrition');r.onsuccess=()=>{
    const db=r.result,tx=db.transaction('metadata','readwrite'),store=tx.objectStore('metadata'),q=store.get('database_state');q.onsuccess=()=>store.put({...q.result,extraReviewMarker:1});
    tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);
  };});
  await assert.rejects(revalidateRestorePreview(p),e=>e.code==='target-changed');
});
await check('different snapshot IDs and capture times alone do not mark unchanged data stale',async()=>{
  const f=fixture(),p=await prepareRestorePreview(args(f));assert.equal((await revalidateRestorePreview(p)).unchanged,true);
});
await check('five minute expiry forces a new preview instead of retaining a stale decision',async()=>{
  let now=new Date(AT);const p=await prepareRestorePreview(args(fixture(),{now:()=>now}));now=new Date(now.getTime()+5*60000);
  await assert.rejects(revalidateRestorePreview(p),e=>e.code==='preview-expired');
});
await check('serialized or cloned previews are not live decisions',async()=>{
  const p=await prepareRestorePreview(args());await assert.rejects(revalidateRestorePreview(clone(p)),e=>e.code==='invalid-preview');
});
await check('discarded preview has no remaining usable target decision',async()=>{
  const p=await prepareRestorePreview(args());assert.equal(discardRestorePreview(p),true);assert.equal(discardRestorePreview(p),false);
  await assert.rejects(revalidateRestorePreview(p),e=>e.code==='invalid-preview');
});
await check('cancel before or during coordinated read never creates a writable result',async()=>{
  const f=fixture(),ac=new AbortController();ac.abort();await assert.rejects(prepareRestorePreview(args(f,{signal:ac.signal})),e=>e.code==='cancelled');assert.equal(f.reads(),0);
  const bc=new AbortController();await assert.rejects(prepareRestorePreview(args(f,{signal:bc.signal,barrier:async fn=>{const p=await fn();bc.abort();return p;}})),e=>e.code==='cancelled');
});
await check('invalid clock is rejected before reading any target',async()=>{
  const f=fixture();await assert.rejects(prepareRestorePreview(args(f,{now:()=>new Date(NaN)})),e=>e.code==='invalid-clock');assert.equal(f.reads(),0);
});
await check('coordination refusal does not read a target or return a partial preview',async()=>{
  const f=fixture();await assert.rejects(prepareRestorePreview(args(f,{barrier:()=>{const e=new Error('other-context');e.code='other-context';throw e;}})),e=>e.code==='other-context');assert.equal(f.reads(),0);
});
await check('cancelling a recheck invalidates its decision',async()=>{
  const p=await prepareRestorePreview(args()),ac=new AbortController();ac.abort();
  await assert.rejects(revalidateRestorePreview(p,{signal:ac.signal}),e=>e.code==='cancelled');
  await assert.rejects(revalidateRestorePreview(p),e=>e.code==='invalid-preview');
});
await check('a changed historical recovery record invalidates the whole target fingerprint',async()=>{
  const f=fixture();await seedDatabase(f);const p=await prepareRestorePreview(args(f));
  await new Promise((resolve,reject)=>{const r=f.indexedDB.open('today_nutrition');r.onsuccess=()=>{
    const db=r.result,tx=db.transaction('migration_backups','readwrite');
    tx.objectStore('migration_backups').put({id:'historical',storageSchemaVersion:0,contractVersion:0,recordCount:0,records:[],status:'applied'});
    tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);
  };});
  await assert.rejects(revalidateRestorePreview(p),e=>e.code==='target-changed');
});
await check('candidate fingerprint covers the disabled permission state, not the imported grants',async()=>{
  const f=fixture({today_ai_delivery_v1:JSON.stringify(notification())}),p=await f.capture();
  const preview=await prepareRestorePreview(args(f,{file:await seal(p)}));
  const expected=clone(p),v=JSON.parse(expected.localStorageEntries.find(e=>e.key==='today_ai_delivery_v1').rawValue);
  v.preferences.aiEnabled=false;v.preferences.updateEnabled=false;v.dailyAnalysisConsent=clone(defaultState().dailyAnalysisConsent);
  v.insights=[];v.dispatches=[];v.lastNotifiedUpdateVersion=null;
  expected.localStorageEntries.find(e=>e.key==='today_ai_delivery_v1').rawValue=JSON.stringify(v);
  const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  const hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical({localStorageEntries:expected.localStorageEntries,databases:expected.databases}))))).toString('hex');
  assert.equal(preview.candidateFingerprint,hash);assert.notEqual(preview.candidateFingerprint,preview.targetFingerprint);
});
await check('current Health exercise IDs and aliases match the preview validator catalog',async()=>{
  const current=fs.readFileSync('modules/health-hub.js','utf8');
  const catalog=(await import('../modules/sport-catalog.js')).default;
  const library=current.split('const SPORT_EXERCISE_LIBRARY = [')[1].split('];')[0];
  const ids=[...library.matchAll(/\bid:"([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(ids.sort(),catalog.library.map(item=>item.id).sort());
  const aliasBlock=current.split('const SPORT_EXERCISE_ALIASES = Object.freeze({')[1].split('});')[0];
  const aliases=Object.fromEntries([...aliasBlock.matchAll(/"([^"]+)":"([^"]+)"/g)].map(m=>[m[1],m[2]]));
  assert.deepEqual(aliases,catalog.aliases);
});
console.log(`Backup Restore Preview: ${passed}/${passed} successful`);
