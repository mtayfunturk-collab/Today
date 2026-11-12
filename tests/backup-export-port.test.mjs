import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import { IDBFactory } from 'fake-indexeddb';
import { LS_KEYS, STORES, captureSnapshot, createBackup, verifyBackupFile, readBackupForPreview } from '../modules/backup-export.mjs';

const context = { window: {} };
vm.runInNewContext(fs.readFileSync('modules/nutrition-contracts.js', 'utf8'), context);
const contracts = context.window.TodayNutritionContracts;
let pass = 0;
async function test(name, fn) { await fn(); pass++; console.log('PASS: ' + name); }
const core = JSON.stringify({schemaVersion:2,days:{'2026-11-12':{choice:'A',color:'pink',note:'Not;\n🙂'}},settings:{theme:'dark'},usage:{},migration:{}});
function fixture(values = {}) {
  const map = new Map(Object.entries(values)); let writes = 0;
  return {map, get writes(){return writes;}, get length(){return map.size;}, key:i=>[...map.keys()][i],
    getItem:k=>map.get(k) ?? null, setItem(){writes++;throw Error('write');}, removeItem(){writes++;throw Error('delete');}};
}
function options(storage, indexedDB) { return {storage,indexedDB,contracts,crypto:webcrypto,source:{appVersion:'2.23.3',origin:'https://synthetic.test',runtime:'web'}}; }
async function seedDB(factory) {
  await new Promise((resolve,reject)=>{const request=factory.open('today_nutrition',1);
    request.onupgradeneeded=()=>{for(const [name,keyPath] of Object.entries(STORES)) request.result.createObjectStore(name,{keyPath});};
    request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction(Object.keys(STORES),'readwrite');
      tx.objectStore('metadata').put({key:'database_state',storageSchemaVersion:1,contractVersion:1,createdAt:'2026-01-01'});
      tx.objectStore('migration_backups').put({id:'old',recordCount:0,records:[],storageSchemaVersion:1,contractVersion:1,status:'failed'});
      tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};});
}
await test('registry matches current 23 keys and three stores',()=>{assert.equal(LS_KEYS.length,23);assert.deepEqual(Object.keys(STORES),['records','metadata','migration_backups']);});
await test('absent Nutrition DB stays absent and Core raw bytes are preserved',async()=>{const store=fixture({today_store_v2:core});const snapshot=await captureSnapshot(options(store,new IDBFactory()));assert.equal(snapshot.localStorageEntries.length,23);assert.equal(snapshot.databases[0].present,false);assert.equal(snapshot.localStorageEntries[0].rawValue,core);assert.equal(store.writes,0);});
await test('populated Nutrition stores are captured without writes',async()=>{const db=new IDBFactory();await seedDB(db);const store=fixture({today_store_v2:core});const snapshot=await captureSnapshot(options(store,db));assert.deepEqual(snapshot.databases[0].stores.map(s=>s.name),Object.keys(STORES));assert.equal(snapshot.databases[0].stores.find(s=>s.name==='metadata').entries.length,1);assert.equal(store.writes,0);});
await test('encrypted file verifies without exposing note and preview does not restore',async()=>{const store=fixture({today_store_v2:core}),db=new IDBFactory(),capture=()=>captureSnapshot(options(store,db));const password='synthetic passphrase 123';const out=await createBackup({userConfirmed:true,password,confirmation:password,barrier:fn=>fn(),capture,crypto:webcrypto});assert(!out.file.includes('Not;'));assert(!out.file.includes('2026-11-12'));assert.deepEqual((await verifyBackupFile(out.file,password,{crypto:webcrypto})).ok,true);const opened=await readBackupForPreview(out.file,password,{crypto:webcrypto,contracts});assert.equal(opened.localStorageEntries[0].rawValue,core);assert.equal(out.restoreValidated,false);assert.equal(store.writes,0);});
await test('unknown Today key fails closed before export or write',async()=>{const store=fixture({today_store_v2:core,'today.new.key':'x'});await assert.rejects(captureSnapshot(options(store,new IDBFactory())),e=>e.code==='unregistered-data');assert.equal(store.writes,0);});
console.log(`Backup Export Port: ${pass}/5 başarılı`);
