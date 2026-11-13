import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import {IDBFactory} from 'fake-indexeddb';
import {JSDOM} from 'jsdom';
import {LS_KEYS,STORES,captureSnapshot,readNutrition,createBackup,verifyBackupFile,browserBarrier} from '../modules/backup-export.mjs';
import {mountBackupExport,mountBackupLaunch} from '../modules/backup-export-ui.mjs';
import {defaultState} from '../modules/notification-store.mjs';
let passed=0;async function check(name,fn){await fn();passed++;console.log('PASS '+name);}
const c={window:{}};vm.runInNewContext(fs.readFileSync('modules/nutrition-contracts.js','utf8'),c);
const contracts=c.window.TodayNutritionContracts, crypto=webcrypto;
function storage(seed={}){const map=new Map(Object.entries(seed)),reads=[];return{map,reads,get length(){return map.size;},key:i=>[...map.keys()][i],getItem:k=>{reads.push(k);return map.get(k)??null;},setItem(){throw Error('unexpected persistent write');},removeItem(){throw Error('unexpected delete');}};}
const core=JSON.stringify({schemaVersion:2,days:{'2026-07-01':{choice:'A',color:'pink-legacy-id',note:'Not;\n🙂',coreSkyLink:{id:'snapshot'}}},settings:{theme:'dark'},sky:{birthProfile:{birthDate:'1990-01-01'}},usage:{x:1},migration:{sourceKeys:['today_data']}});
function setup(seed={}){return{storage:storage(seed),indexedDB:new IDBFactory(),crypto,contracts,source:{appVersion:'2.20.2',origin:'https://today.test',runtime:'web'}};}
const tick=()=>new Promise(r=>setTimeout(r,0));
async function seedDB(factory,{version=1,extra=false,value,backupVersion=1}={}){
 return new Promise((resolve,reject)=>{const r=factory.open('today_nutrition',version);r.onupgradeneeded=()=>{for(const [n,keyPath]of Object.entries(STORES))r.result.createObjectStore(n,{keyPath});if(extra)r.result.createObjectStore('unknown');};r.onerror=()=>reject(r.error);r.onsuccess=()=>{
  const db=r.result,tx=db.transaction(Object.keys(STORES),'readwrite');tx.objectStore('metadata').put({key:'database_state',storageSchemaVersion:1,contractVersion:1,createdAt:'2026-01-01'});
  if(value)tx.objectStore('records').put(value);
  tx.objectStore('migration_backups').put({id:'backup-old',recordCount:0,records:[],storageSchemaVersion:1,contractVersion:backupVersion,status:'failed'});
  tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);
 };});
}
await check('registry exactly covers the 23 named keys and 3 stores',()=>{assert.equal(new Set(LS_KEYS).size,23);assert.deepEqual(Object.keys(STORES),['records','metadata','migration_backups']);});
await check('capture does not initialize an absent database or write any LS value',async()=>{const f=setup();const p=await captureSnapshot(f);assert.equal(p.localStorageEntries.length,23);assert.equal(p.databases[0].present,false);assert.deepEqual(await f.indexedDB.databases(),[]);assert.equal(f.storage.map.size,0);});
await check('raw Unicode, old color IDs, logs, Sky, metadata and backup values are unchanged',async()=>{
 const legacy=JSON.stringify({v:10,days:{},logs:{'2026-07-01':{entries:['time'],changes:['note']}}});const f=setup({today_store_v2:core,today_store_v2_backup:core,today_app_v10:legacy});const p=await captureSnapshot(f);
 for(const [key,value]of f.storage.map)assert.equal(p.localStorageEntries.find(e=>e.key===key).rawValue,value);assert.equal(f.storage.map.get('today_store_v2'),core);assert.equal(p.manifest.length,24);
});
await check('all Health and named legacy values remain raw with absent distinct from empty JSON',async()=>{
 const f=setup();for(const key of LS_KEYS.filter(k=>k.startsWith('today.health.')))f.storage.map.set(key,key.includes('water.')?'350':JSON.stringify(key.includes('wellness.')||key.includes('workouts')?[]:{}));
 f.storage.map.set('today_data','{}');const p=await captureSnapshot(f);assert(p.localStorageEntries.filter(e=>e.present).length===10);assert.equal(p.localStorageEntries.find(e=>e.key==='today_store_v2').rawValue,null);
});
await check('foreign same-origin values are never read or exported',async()=>{const f=setup({other_app_secret:'DO-NOT-READ'});const p=await captureSnapshot(f);assert(!f.storage.reads.includes('other_app_secret'));assert(!JSON.stringify(p).includes('DO-NOT-READ'));});
await check('unknown Today-owned key blocks a falsely complete backup without reading its value',async()=>{const f=setup({today_future:'secret'});await assert.rejects(captureSnapshot(f),e=>e.code==='unregistered-data');assert.equal(f.storage.reads.length,0);});
await check('malformed JSON is not silently replaced by empty data',async()=>{await assert.rejects(captureSnapshot(setup({today_store_v2:'{bad'})),e=>e.code==='invalid-source');});
await check('future core schema blocks export',async()=>{await assert.rejects(captureSnapshot(setup({today_store_v2:JSON.stringify({schemaVersion:99,days:{}})})),e=>e.code==='unsupported-source-version');});
await check('pre-migration Core recovery snapshots keep their older schema untouched',async()=>{for(const version of [0,1]){const v=JSON.parse(core);v.schemaVersion=version;const raw=JSON.stringify(v),f=setup({today_store_v2:core,today_store_v2_backup:raw}),p=await captureSnapshot(f);assert.equal(p.localStorageEntries.find(e=>e.key==='today_store_v2_backup').rawValue,raw);assert.equal(f.storage.map.get('today_store_v2_backup'),raw);}});
await check('notification archive is read without activation or normalization and malformed state is rejected',async()=>{
 const v=JSON.parse(JSON.stringify(defaultState()));v.preferences.updateEnabled=true;v.lastNotifiedUpdateVersion='2.20.1';const raw=JSON.stringify(v),f=setup({today_ai_delivery_v1:raw});
 const p=await captureSnapshot(f);assert.equal(p.localStorageEntries.find(e=>e.key==='today_ai_delivery_v1').rawValue,raw);assert.equal(f.storage.map.get('today_ai_delivery_v1'),raw);
 v.dispatches=Array(15).fill({});await assert.rejects(captureSnapshot(setup({today_ai_delivery_v1:JSON.stringify(v)})),e=>e.code==='invalid-source');
});
await check('source storage read denial is not a successful backup',async()=>{const f=setup();f.storage.getItem=()=>{throw Error('private details');};await assert.rejects(captureSnapshot(f));});
await check('changed raw source during capture is rejected',async()=>{const f=setup({today_data:'{}'});let n=0;f.storage.getItem=key=>{n++;return key==='today_data'?(n<=23?'{}':'{"changed":true}'):null;};await assert.rejects(captureSnapshot(f),e=>e.code==='source-changed');});
await check('all DB stores including metadata and recovery history are captured readonly',async()=>{const f=setup();await seedDB(f.indexedDB);const p=await captureSnapshot(f);const stores=p.databases[0].stores;assert.equal(stores[1].entries[0].value.contractVersion,1);assert.equal(stores[2].entries[0].value.status,'failed');assert.equal(stores[2].entries[0].key,'backup-old');assert.deepEqual(await readNutrition(f.indexedDB),p.databases[0]);});
await check('historical v0 migration backups are not discarded or mistaken for active v1 data',async()=>{const f=setup();await seedDB(f.indexedDB,{backupVersion:0});const p=await captureSnapshot(f);assert.equal(p.databases[0].stores[2].entries[0].value.contractVersion,0);assert.equal(p.sourceValidation.restoreValidated,false);});
await check('nonempty archived records preserve their payload and source IDs',async()=>{
 const value={id:'profile-synthetic',type:'nutrition_profile',schemaVersion:1,createdAt:'2026-07-01T00:00:00.000Z',updatedAt:'2026-07-01T00:00:00.000Z',eventAt:null,source:{kind:'manual',referenceId:null,version:null},knowledgeStatus:'known',recordStatus:'archived',verificationStatus:'user_confirmed',calculationVersion:null,userEdited:false,payload:{trackingMode:'simple',dietaryConstraintIds:[],primaryGoalVersionId:null},extensions:{}};
 const f=setup();await seedDB(f.indexedDB,{value});const p=await captureSnapshot(f);assert.deepEqual(p.databases[0].stores[0].entries[0],{key:value.id,value});
});
await check('unsupported database version is not upgraded or cleared',async()=>{const f=setup();await seedDB(f.indexedDB,{version:2});await assert.rejects(captureSnapshot(f),e=>e.code==='unsupported-database');assert.equal((await f.indexedDB.databases())[0].version,2);});
await check('unknown DB store prevents incomplete export',async()=>{const f=setup();await seedDB(f.indexedDB,{extra:true});await assert.rejects(captureSnapshot(f),e=>e.code==='unsupported-database');});
await check('invalid record or lossy JSON values are rejected rather than silently normalized',async()=>{
 const f=setup();await seedDB(f.indexedDB,{value:{id:'bad',type:'unknown'}});await assert.rejects(captureSnapshot(f),e=>e.code==='invalid-source');
 const a=Array(1);a.extra='lost';
 for(const extra of [-0,a]){const f=setup();await seedDB(f.indexedDB,{value:{id:'bad',type:'unknown',extra}});await assert.rejects(captureSnapshot(f),e=>e.code==='unsupported-value');}
});
await check('a cancelled read creates no new DB',async()=>{const f=setup(),ac=new AbortController();ac.abort();await assert.rejects(captureSnapshot({...f,signal:ac.signal}),e=>e.code==='cancelled');assert.deepEqual(await f.indexedDB.databases(),[]);});
await check('blocked opening times out rather than returning an empty successful DB',async()=>{await assert.rejects(readNutrition({open:()=>({})},{timeoutMs:5}),e=>e.code==='database-timeout');});
await check('no consent, mismatch or unsupported crypto reaches capture',async()=>{let calls=0;const args={capture:()=>{calls++;},barrier:f=>f(),password:'twelve-char-password',confirmation:'twelve-char-password',crypto};await assert.rejects(createBackup(args),e=>e.code==='consent-required');await assert.rejects(createBackup({...args,userConfirmed:true,confirmation:'wrong'}),e=>e.code==='password-invalid');await assert.rejects(createBackup({...args,userConfirmed:true,crypto:{}}),e=>e.code==='crypto-unavailable');assert.equal(calls,0);});
await check('missing isolation does not fall back to an unlocked copy',async()=>{let calls=0;await assert.rejects(createBackup({userConfirmed:true,password:'test password 123',confirmation:'test password 123',capture:()=>{calls++;}}),e=>e.code==='coordination-unavailable');assert.equal(calls,0);});
let saved;
const pass='test passphrase 12345';
const exportArgs=()=>({userConfirmed:true,password:pass,confirmation:pass,crypto,barrier:fn=>fn(),capture:()=>captureSnapshot(setup({today_store_v2:core}))});
await check('real 600000 PBKDF2/AES-GCM export is encrypted and self verified',async()=>{
 saved=await createBackup(exportArgs());const e=JSON.parse(saved.file);assert.equal(e.crypto.iterations,600000);assert.equal(e.crypto.cipher,'AES-GCM-256');assert(!saved.file.includes('birthDate'));assert(!saved.file.includes('pink-legacy-id'));
 const result=await verifyBackupFile(saved.file,pass);assert(result.ok);assert.equal(result.sections,24);assert.equal(result.restoreValidated,false);assert(Number.isFinite(Date.parse(result.createdAt)));
});
await check('each file gets fresh salt and IV',async()=>{const second=await createBackup(exportArgs());const a=JSON.parse(saved.file),b=JSON.parse(second.file);assert.notEqual(a.crypto.salt,b.crypto.salt);assert.notEqual(a.crypto.iv,b.crypto.iv);assert.notEqual(a.ciphertext,b.ciphertext);});
await check('a 1 MiB note encrypts and verifies without large-base64 parser failure',async()=>{
 const v=JSON.parse(core);v.days['2026-07-01'].note='x'.repeat(1024*1024);const raw=JSON.stringify(v),f=setup({today_store_v2:raw});
 const result=await createBackup({...exportArgs(),capture:()=>captureSnapshot(f)});assert(result.file.length>1024*1024);assert((await verifyBackupFile(result.file,pass)).ok);assert.equal(f.storage.map.get('today_store_v2'),raw);
});
await check('wrong password and damaged ciphertext never report valid',async()=>{assert.equal((await verifyBackupFile(saved.file,'wrong password')).ok,false);const e=JSON.parse(saved.file);e.ciphertext=(e.ciphertext[0]==='A'?'B':'A')+e.ciphertext.slice(1);assert.equal((await verifyBackupFile(JSON.stringify(e),pass)).ok,false);});
await check('changed authenticated header and oversized KDF parameter are rejected',async()=>{for(const change of [e=>e.crypto.iterations++,e=>e.crypto.iv='AAAAAAAAAAAAAAAA',e=>e.envelopeVersion=2]){const e=JSON.parse(saved.file);change(e);assert.equal((await verifyBackupFile(JSON.stringify(e),pass)).ok,false);}});
await check('duplicate JSON keys and prototype fields are rejected',async()=>{assert.equal((await verifyBackupFile(saved.file.replace('{','{"format":"duplicate",'),pass)).ok,false);assert.equal((await verifyBackupFile(saved.file.replace('{','{"__proto__":{},'),pass)).ok,false);});
await check('cancellation after snapshot never returns a file',async()=>{const ac=new AbortController();await assert.rejects(createBackup({...exportArgs(),signal:ac.signal,barrier:async fn=>{const p=await fn();ac.abort();return p;}}),e=>e.code==='cancelled');});
function browserFixture({only=true,navigationLock=true,controllerChanged=false,denyReason}={}){
 let captures=0;const scope='https://today.test/Today/',worker={postMessage(_,ports){ports[0].postMessage({protocol:1,scope,navigationLock,onlyClient:only,denyReason});ports[0].close();}};
 const sw={controller:worker};
 const view={isSecureContext:true,MessageChannel,navigator:{serviceWorker:sw,locks:{async request(name,options,fn){assert.equal(name,'today:backup:v1:/Today/');assert.equal(options.mode,'exclusive');return fn({name});}}},location:{href:scope+'backup.html'}};
 return{view,run:()=>browserBarrier(view)(async()=>{captures++;if(controllerChanged)sw.controller={};return 'snapshot';}),captures:()=>captures};
}
await check('isolated browser barrier checks both ends of capture',async()=>{const f=browserFixture();assert.equal(await f.run(),'snapshot');assert.equal(f.captures(),1);});
await check('other clients or missing SW navigation locks prevent capture',async()=>{for(const options of [{only:false},{only:false,denyReason:'other-client'},{only:false,denyReason:'client-mismatch'},{navigationLock:false}]){const f=browserFixture(options);const code=options.navigationLock===false?'coordination-unavailable':options.denyReason||'other-context-or-version';await assert.rejects(f.run(),e=>e.code===code);assert.equal(f.captures(),0);}});
await check('controller change invalidates the captured snapshot',async()=>{const f=browserFixture({controllerChanged:true});await assert.rejects(f.run(),e=>e.code==='worker-changed');});
await check('unsupported browser and exclusive lock denial fail closed',async()=>{await assert.rejects(browserBarrier({navigator:{}})(()=>{}),e=>e.code==='coordination-unavailable');const f=browserFixture();f.view.navigator.locks.request=(_,__,fn)=>fn(null);await assert.rejects(f.run(),e=>e.code==='backup-lock-busy');assert.equal(f.captures(),0);});
function uiFixture(create){
 const dom=new JSDOM(fs.readFileSync('backup.html','utf8'),{url:'https://today.test/Today/backup.html'}),doc=dom.window.document;let urls=0,revokes=0;
 dom.window.URL.createObjectURL=()=>{urls++;return'blob:test';};dom.window.URL.revokeObjectURL=()=>{revokes++;};
 mountBackupExport({root:doc,create});return{dom,doc,urls:()=>urls,revokes:()=>revokes,submit:()=>doc.querySelector('#backupForm').dispatchEvent(new dom.window.Event('submit',{cancelable:true,bubbles:true}))};
}
await check('export UI starts unchecked, empty and without a downloadable file',()=>{let calls=0;const f=uiFixture(()=>{calls++;});assert(!f.doc.querySelector('#backupConsent').checked);assert.equal(f.doc.querySelector('#backupPassword').value,'');assert(f.doc.querySelector('#backupDownload').hidden);assert.equal(calls,0);assert.equal(f.dom.window.localStorage.length,0);});
await check('UI reports denial without creating a Blob or storing a password',async()=>{for(const [code,word] of [['consent-required','onay'],['other-client','başka bir pencere'],['client-mismatch','doğrulanamadı'],['backup-lock-busy','kilidi meşgul']]){const f=uiFixture(async options=>{assert.equal(options.userConfirmed,false);throw Object.assign(Error(),{code});});f.submit();await tick();assert.equal(f.urls(),0);assert.match(f.doc.querySelector('#backupStatus').textContent,new RegExp(word));assert.equal(f.dom.window.localStorage.length,0);f.dom.window.close();}});
await check('ready file is a user-save link with honest status and cleared password fields',async()=>{const f=uiFixture(async()=>({file:'encrypted',filename:'today.test.json'}));f.doc.querySelector('#backupPassword').value='secret';f.doc.querySelector('#backupConfirmation').value='secret';f.submit();await tick();assert.equal(f.urls(),1);assert(!f.doc.querySelector('#backupDownload').hidden);assert.match(f.doc.querySelector('#backupStatus').textContent,/kalıcı kaydedildiğini.*doğrulayamaz/);assert.equal(f.doc.querySelector('#backupPassword').value,'');assert.equal(f.doc.querySelector('#backupConfirmation').value,'');});
await check('editing invalidates the old download link and revokes its URL',async()=>{const f=uiFixture(async()=>({file:'encrypted',filename:'today.test.json'}));f.submit();await tick();f.doc.querySelector('#backupConsent').dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));assert(f.doc.querySelector('#backupDownload').hidden);assert.equal(f.revokes(),1);});
await check('UI suppresses duplicate submissions and cancels without offering a file',async()=>{let release,calls=0;const f=uiFixture(options=>{calls++;return new Promise((resolve,reject)=>{release=()=>options.signal.aborted?reject(Object.assign(Error(),{code:'cancelled'})):resolve({file:'x'});});});f.submit();f.submit();assert.equal(calls,1);f.doc.querySelector('#backupCancel').click();release();await tick();assert.equal(f.urls(),0);assert.match(f.doc.querySelector('#backupStatus').textContent,/iptal/);assert(!f.doc.querySelector('#backupFields').disabled);});
for(const protocol of [0,1])await check('launcher '+(protocol?'opens only a capable worker':'does not navigate through an old worker'),async()=>{
 const dom=new JSDOM('<button type="button" data-backup-launch>Yedek</button>',{url:'https://today.test/Today/index.html'}),view=dom.window;let navigations=0;
 Object.defineProperty(view,'isSecureContext',{value:true});Object.defineProperty(view.navigator,'locks',{value:{request(){}}});view.MessageChannel=MessageChannel;
 Object.defineProperty(view.navigator,'serviceWorker',{value:{controller:{postMessage(_,ports){ports[0].postMessage({protocol,scope:'https://today.test/Today/',navigationLock:true});ports[0].close();}}}});
 mountBackupLaunch({root:view.document,navigate:()=>{navigations++;}});mountBackupLaunch({root:view.document,navigate:()=>{navigations++;}});
 view.document.querySelector('button').click();for(let i=0;i<20&&view.document.querySelector('button').disabled;i++)await tick();
 assert.equal(navigations,protocol);assert.equal(view.document.querySelectorAll('[role=status]').length,1);if(!protocol)assert.match(view.document.querySelector('[role=status]').textContent,/güncellemesini/);assert.equal(view.localStorage.length,0);
});
console.log(`Backup Export: ${passed}/${passed} successful`);
