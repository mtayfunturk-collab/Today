// T90-261101-06: read-only, local export. No restore or persistent writes.
import {cleanState} from './notification-store.mjs';
// Pure bounded parser shared by restore-only validators. Export behavior is unchanged.
export {parse as parseBackupJSON};
export const LS_KEYS = Object.freeze([
  'today_store_v2','today_store_v2_backup','today_app_v10',
  'today.health.water.glassMl','today.health.water.targetMl',
  'today.health.wellness.sleep.v1','today.health.wellness.energy.v1','today.health.wellness.symptoms.v1',
  'today.health.sport.program.v1','today.health.sport.workouts.v1','today.health.sport.customDays.v1','today.health.sport.daySettings.v1',
  'today_ai_delivery_v1','today_data_v10','today_data_v2','today_data_v1','today_data','today_store','today_store_v1',
  'todaySelections','today_entries','todayAppData','today_app_data'
]);
export const STORES = Object.freeze({records:'id',metadata:'key',migration_backups:'id'});
export const FORMAT = 'today:full-backup:v1';
const PAYLOAD_MAX = 32*1024*1024, FILE_MAX = 50*1024*1024, ENTRY_MAX = 100000;
const iterations = 600000, encoder = new TextEncoder();
const bad = code => { const error = new Error(code); error.code = code; return error; };
function abort(signal){ if(signal?.aborted)throw bad('cancelled'); }
function bytes(value){return encoder.encode(value);}
function json(value){return JSON.stringify(value);}
function plain(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function exact(value, names){return plain(value)&&Object.keys(value).sort().join('|')===[...names].sort().join('|');}
function same(a,b){return json(a)===json(b);}
function safeValue(value, state={nodes:0}, depth=0){
  if(++state.nodes>1000000||depth>64)throw bad('data-limit');
  if(value===null||typeof value==='string'||typeof value==='boolean')return;
  if(typeof value==='number'&&Number.isFinite(value)&&!Object.is(value,-0))return;
  if(typeof value!=='object'||Object.prototype.toString.call(value)!==(Array.isArray(value)?'[object Array]':'[object Object]'))throw bad('unsupported-value');
  if(Array.isArray(value)&&(Object.keys(value).length!==value.length||Object.keys(value).some((k,i)=>k!==String(i))))throw bad('unsupported-value');
  for(const k of Object.keys(value)){
    if(['__proto__','prototype','constructor'].includes(k))throw bad('unsafe-field');
    safeValue(value[k],state,depth+1);
  }
}
function parse(text){
  // JSON.parse alone loses duplicate fields. Scan object keys without evaluating code.
  const parsed=JSON.parse(text); const stack=[];
  for(const m of text.matchAll(/"(?:[^"\\]|\\.)*"|[{}\[\],:]|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g)){
    const token=m[0], top=stack.at(-1);
    if(token==='{')stack.push({kind:'object',key:true,seen:new Set()});
    else if(token==='[')stack.push({kind:'array'});
    else if(token==='}'||token===']')stack.pop();
    else if(token===','&&top?.kind==='object')top.key=true;
    else if(token.startsWith('"')&&top?.kind==='object'&&top.key){
      const key=JSON.parse(token);if(top.seen.has(key))throw bad('duplicate-field');top.seen.add(key);top.key=false;
    }
  }
  safeValue(parsed);return parsed;
}
function rawEntries(storage){
  if(!Number.isInteger(storage.length)||storage.length>10000)throw bad('data-limit');
  for(let i=0;i<storage.length;i++){const name=storage.key(i);if(typeof name!=='string')throw bad('storage-read-failed');if(/^today[._A-Z]/.test(name)&&!LS_KEYS.includes(name))throw bad('unregistered-data');}
  return LS_KEYS.map(key=>{const rawValue=storage.getItem(key);if(rawValue!==null&&typeof rawValue!=='string')throw bad('storage-read-failed');return{key,present:rawValue!==null,rawValue};});
}
function request(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(bad('database-read-failed'));});}
export function readNutrition(indexedDB,{signal,timeoutMs=5000}={}){
  return new Promise((resolve,reject)=>{
    if(!indexedDB?.open){reject(bad('database-unavailable'));return;}
    let db,tx,settled=false,absent=false;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);db?.close();error?reject(error):resolve(value);};
    const cancel=()=>{try{tx?.abort();}catch{}finish(bad('cancelled'));};
    const timer=setTimeout(()=>{try{tx?.abort();}catch{}finish(bad('database-timeout'));},timeoutMs);
    signal?.addEventListener('abort',cancel,{once:true});
    if(signal?.aborted){cancel();return;}
    let open;
    try{open=indexedDB.open('today_nutrition');}catch{finish(bad('database-unavailable'));return;}
    // An absent DB must stay absent. Never initialize it just to back it up.
    open.onupgradeneeded=()=>{absent=true;open.transaction.abort();};
    open.onblocked=()=>finish(bad('database-blocked'));
    open.onerror=()=>absent&&!settled?finish(null,{name:'today_nutrition',present:false}):finish(bad('database-open-failed'));
    open.onsuccess=()=>{
      db=open.result;if(settled){db.close();return;}
      db.onversionchange=()=>{try{tx?.abort();}catch{}finish(bad('database-changed'));};
      if(db.version!==1||!same([...db.objectStoreNames].sort(),Object.keys(STORES).sort())){finish(bad('unsupported-database'));return;}
      try{
        tx=db.transaction(Object.keys(STORES),'readonly');
        tx.onabort=()=>finish(bad('database-read-failed'));tx.onerror=()=>{};
        let values;
        tx.oncomplete=()=>values?finish(null,{name:'today_nutrition',present:true,version:db.version,stores:values}):finish(bad('database-read-failed'));
        let usedBytes=0;
        Promise.all(Object.entries(STORES).map(([name,keyPath])=>new Promise((done,failStore)=>{
          const store=tx.objectStore(name),entries=[];
          if(store.keyPath!==keyPath||store.autoIncrement){failStore(bad('unsupported-database'));return;}
          const cursor=store.openCursor();cursor.onerror=()=>failStore(bad('database-read-failed'));
          cursor.onsuccess=()=>{
            const item=cursor.result;
            if(!item){done({name,keyPath,entries});return;}
            try{
              const value=item.value,key=item.primaryKey;
              if(key!==value?.[keyPath])throw bad('invalid-record-key');
              safeValue(value);usedBytes+=bytes(json(value)).length;
              if(entries.length>=ENTRY_MAX||usedBytes>PAYLOAD_MAX)throw bad('data-limit');
              entries.push({key,value});item.continue();
            }catch(error){failStore(error?.code?error:bad('database-read-failed'));}
          };
        }))).then(result=>{values=result;},error=>{try{tx.abort();}catch{}finish(error?.code?error:bad('database-read-failed'));});
      }catch{try{tx?.abort();}catch{}finish(bad('database-read-failed'));}
    };
  });
}
function validateSource(entries, databases, contracts){
  if(contracts?.CONTRACT_VERSION!==1||typeof contracts.validateRecordSet!=='function')throw bad('contracts-unavailable');
  for(const e of entries){
    if(!e.present)continue;
    let v;try{v=parse(e.rawValue);}catch{throw bad('invalid-source');}
    if(e.key.startsWith('today.health.water.')){if(!Number.isFinite(Number(e.rawValue))||Number(e.rawValue)<=0)throw bad('invalid-source');}
    else if(e.key.startsWith('today.health.wellness.')||e.key==='today.health.sport.workouts.v1'){if(!Array.isArray(v))throw bad('invalid-source');}
    else if(!plain(v)&&!(LS_KEYS.slice(13).includes(e.key)&&Array.isArray(v)))throw bad('invalid-source');
    if(e.key==='today_store_v2'&&(v.schemaVersion!==2||!plain(v.days)))throw bad('unsupported-source-version');
    if(e.key==='today_store_v2_backup'&&(!plain(v.days)||!Number.isInteger(v.schemaVersion??0)||(v.schemaVersion??0)<0||(v.schemaVersion??0)>2))throw bad('unsupported-source-version');
    if(e.key==='today_app_v10'&&(v.v!==10||!plain(v.days)||!plain(v.logs)))throw bad('unsupported-source-version');
    if(e.key==='today_ai_delivery_v1'){
      if(v.schemaVersion!==1)throw bad('unsupported-source-version');
      // Validate without committing cleanState's TTL cleanup; keep the raw archive.
      if(!cleanState(v).ok)throw bad('invalid-source');
    }
  }
  const db=databases[0];if(!db.present)return;
  const stores=Object.fromEntries(db.stores.map(s=>[s.name,s.entries.map(e=>e.value)]));
  const meta=stores.metadata.find(m=>m.key==='database_state');
  if(meta?.storageSchemaVersion!==1||meta?.contractVersion!==1)throw bad('unsupported-source-version');
  if(!contracts.validateRecordSet(stores.records,{requireReferences:true}).valid)throw bad('invalid-source');
  for(const b of stores.migration_backups){
    if(!Array.isArray(b.records)||b.recordCount!==b.records.length||![0,1].includes(b.storageSchemaVersion)||![0,1].includes(b.contractVersion))throw bad('invalid-source');
    // Historical v0 snapshots are archived raw, never migrated or restored here.
    if(b.contractVersion===1&&!contracts.validateRecordSet(b.records,{requireReferences:true}).valid)throw bad('invalid-source');
  }
}
async function digest(value,crypto){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(json(value))))].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function manifestFor(payload,crypto){
  const sections=[...payload.localStorageEntries.map(e=>['ls:'+e.key,e]),...payload.databases.map(d=>['db:'+d.name,d])];
  return Promise.all(sections.map(async([name,value])=>({name,byteLength:bytes(json(value)).length,count:Array.isArray(value.stores)?value.stores.reduce((n,s)=>n+s.entries.length,0):(value.present?1:0),sha256:await digest(value,crypto)})));
}
function supported(crypto){if(!crypto?.subtle||typeof crypto.getRandomValues!=='function')throw bad('crypto-unavailable');}
export async function captureSnapshot({storage,indexedDB,contracts,crypto=globalThis.crypto,source,signal}={}){
  abort(signal);supported(crypto);
  const before=rawEntries(storage),database=await readNutrition(indexedDB,{signal});abort(signal);
  if(!same(before,rawEntries(storage)))throw bad('source-changed');
  validateSource(before,[database],contracts);
  const payload={format:FORMAT,payloadVersion:1,backupId:crypto.randomUUID(),createdAt:new Date().toISOString(),source,
    coverageRegistryVersion:1,localStorageEntries:before,databases:[database],
    exclusions:['cache','OS-permissions-and-queue','transient-audio-health-AI'],sourceValidation:{restoreValidated:false},manifest:[]};
  safeValue(payload);if(bytes(json(payload)).length>PAYLOAD_MAX)throw bad('data-limit');
  payload.manifest=await manifestFor(payload,crypto);abort(signal);return payload;
}
function b64(value){let s='';for(const n of new Uint8Array(value))s+=String.fromCharCode(n);return btoa(s);}
function un64(value,expected){
  // Linear character validation avoids recursive regex backtracking on large files.
  if(typeof value!=='string'||value.length>FILE_MAX||value.length%4||/[^A-Za-z0-9+/=]/.test(value))throw bad('invalid-file');
  const data=Uint8Array.from(atob(value),c=>c.charCodeAt(0));
  if((expected&&data.length!==expected)||b64(data)!==value)throw bad('invalid-file');return data;
}
async function keyFor(password,header,crypto){
  const raw=await crypto.subtle.importKey('raw',bytes(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:un64(header.salt,16),iterations},raw,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
function headerFor(c){return{kdf:'PBKDF2-SHA256',iterations,salt:c.salt,cipher:'AES-GCM-256',iv:c.iv,tagLength:128};}
function aad(c){return bytes(json({format:FORMAT,envelopeVersion:1,crypto:headerFor(c)}));}
async function openFile(text,password,crypto){
  if(typeof text!=='string'||bytes(text).length>FILE_MAX)throw bad('data-limit');
  const file=parse(text),c=file?.crypto;
  if(!exact(file,['format','envelopeVersion','crypto','ciphertext'])||file.format!==FORMAT||file.envelopeVersion!==1||!exact(c,['kdf','iterations','salt','cipher','iv','tagLength'])||!same(c,headerFor(c)))throw bad('invalid-file');
  const iv=un64(c.iv,12);un64(c.salt,16);const ciphertext=un64(file.ciphertext);
  if(ciphertext.length>PAYLOAD_MAX+16)throw bad('data-limit');
  const key=await keyFor(password,c,crypto);
  const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad(c),tagLength:128},key,ciphertext);
  if(raw.byteLength>PAYLOAD_MAX)throw bad('data-limit');
  const payload=parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
  if(payload.format!==FORMAT||payload.payloadVersion!==1||payload.coverageRegistryVersion!==1||!Array.isArray(payload.localStorageEntries)||!Array.isArray(payload.databases))throw bad('invalid-file');
  if(!same(payload.localStorageEntries.map(e=>e.key),LS_KEYS)||payload.databases.length!==1||payload.databases[0].name!=='today_nutrition')throw bad('incomplete-file');
  for(const e of payload.localStorageEntries)if(!exact(e,['key','present','rawValue'])||typeof e.present!=='boolean'||(e.present?typeof e.rawValue!=='string':e.rawValue!==null))throw bad('invalid-file');
  const db=payload.databases[0];
  if(typeof db.present!=='boolean'||(db.present&&(db.version!==1||!same(db.stores?.map(s=>s.name),Object.keys(STORES)))))throw bad('invalid-file');
  if(!same(payload.manifest,await manifestFor(payload,crypto)))throw bad('invalid-file');return payload;
}
export async function verifyBackupFile(text,password,{crypto=globalThis.crypto}={}){
  try{supported(crypto);if(typeof password!=='string'||password.length>1024)throw bad('password-invalid');const p=await openFile(text,password,crypto);return{ok:true,createdAt:p.createdAt,sections:p.manifest.length,restoreValidated:false};}catch{return{ok:false,error:'file-verification-failed'};}
}
// T90-07: decrypted data stays in memory; this does not authorize or apply restore.
export async function readBackupForPreview(text,password,{crypto=globalThis.crypto,signal,contracts}={}){
  abort(signal);supported(crypto);
  if(typeof password!=='string'||password.length>1024)throw bad('password-invalid');
  let payload;
  try{payload=await openFile(text,password,crypto);}catch{throw bad('file-verification-failed');}
  abort(signal);
  // Reuse source checks, including duplicate fields inside raw JSON strings.
  try{validateSource(payload.localStorageEntries,payload.databases,contracts);}catch{throw bad('source-validation-failed');}
  return payload;
}
export async function createBackup({userConfirmed=false,password,confirmation,barrier,capture,crypto=globalThis.crypto,signal}={}){
  if(userConfirmed!==true)throw bad('consent-required');supported(crypto);
  if(typeof password!=='string'||password.length<12||password.length>1024||password!==confirmation)throw bad('password-invalid');
  if(typeof barrier!=='function'||typeof capture!=='function')throw bad('coordination-unavailable');abort(signal);
  const payload=await barrier(()=>capture());abort(signal);
  const salt=b64(crypto.getRandomValues(new Uint8Array(16))),iv=b64(crypto.getRandomValues(new Uint8Array(12))),c=headerFor({salt,iv});
  const text=json(payload);if(bytes(text).length>PAYLOAD_MAX)throw bad('data-limit');
  const key=await keyFor(password,c,crypto);abort(signal);
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv:un64(iv,12),additionalData:aad(c),tagLength:128},key,bytes(text));abort(signal);
  const file=json({format:FORMAT,envelopeVersion:1,crypto:c,ciphertext:b64(encrypted)});
  if(bytes(file).length>FILE_MAX)throw bad('data-limit');
  const readback=await openFile(file,password,crypto);abort(signal);
  if(!same(payload,readback))throw bad('self-check-failed');
  return{file,filename:'today-'+payload.createdAt.slice(0,10)+'.today-backup.json',sections:payload.manifest.length,restoreValidated:false};
}
export function browserBarrier(view){
  return async capture=>{
    const sw=view.navigator.serviceWorker,worker=sw?.controller,locks=view.navigator.locks;
    if(!view.isSecureContext||!worker||!locks?.request)throw bad('coordination-unavailable');
    const scope=new URL('./',view.location.href).href;
    const check=()=>new Promise((resolve,reject)=>{
      const channel=new view.MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(bad('coordination-unavailable'));},2000);
      channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();const d=event.data;
        if(d?.protocol!==1||d.scope!==scope||d.navigationLock!==true)reject(bad('coordination-unavailable'));
        else d.onlyClient===true?resolve():reject(bad('other-context-or-version'));};
      try{worker.postMessage({type:'TODAY_BACKUP_CHECK'},[channel.port2]);}
      catch{clearTimeout(timer);channel.port1.close();reject(bad('coordination-unavailable'));}
    });
    return locks.request('today:backup:v1:'+new URL(scope).pathname,{mode:'exclusive',ifAvailable:true},async lock=>{
      if(!lock)throw bad('other-context-or-version');await check();
      const payload=await capture();await check();if(sw.controller!==worker)throw bad('worker-changed');return payload;
    });
  };
}
