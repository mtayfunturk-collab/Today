import assert from 'node:assert/strict';
import { createNotificationService, notificationTime } from '../modules/notification-service.mjs';
import { createNotificationStore, KEY } from '../modules/notification-store.mjs';

const clone=value=>JSON.parse(JSON.stringify(value));
const day=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
let count=0;
async function check(name,callback){await callback();count++;console.log(`PASS ${name}`);}
function fixture({supported=true,permission='granted',allowRequest=true,exclusive=true,appVersion='2.19.0'}={}){
  let instant=new Date(2026,9,30,10,0,0), sequence=0,writes=0,failWrite=0;
  const values=new Map([['today_store_v2','SYNTHETIC_CORE_UNTOUCHED'],['health-existing','SYNTHETIC_HEALTH_UNTOUCHED']]);
  const storage={getItem:key=>values.get(key)??null,setItem(key,value){writes++;if(writes===failWrite)throw Error('quota');values.set(key,value);},removeItem:key=>values.delete(key)};
  const calls={requests:0,checks:0,schedules:[],cancels:[],removes:[],actions:0};
  let pending=[],delivered=[],cancelError=false,scheduleError=false,scheduleHold=null,callback;
  const adapter={supported,
    async checkPermission(){calls.checks++;return{ok:true,granted:permission==='granted'};},
    async requestPermission(){calls.requests++;permission=allowRequest?'granted':'denied';return{ok:true,granted:permission==='granted'};},
    async schedule(value){calls.schedules.push(clone(value));if(scheduleHold)await scheduleHold;if(scheduleError)return{ok:false,error:'failure'};pending.push(clone(value));return{ok:true};},
    async getPending(){return clone(pending);},async getDelivered(){return clone(delivered);},
    async cancel(ids){calls.cancels.push([...ids]);if(cancelError)return{ok:false,error:'failure'};pending=pending.filter(item=>!ids.includes(item.id));return{ok:true};},
    async removeDelivered(ids){calls.removes.push([...ids]);if(cancelError)return{ok:false,error:'failure'};delivered=delivered.filter(item=>!ids.includes(item.id));return{ok:true};},
    async onAction(fn){calls.actions++;callback=fn;return{ok:true,remove(){}};}
  };
  const locks=exclusive?{request:async(name,options,run)=>run({name})}:null;
  const store=createNotificationStore({storage,now:()=>new Date(instant)});
  const build=overrides=>createNotificationService({store,adapter,now:()=>new Date(instant),idFactory:()=>`insight-${String(++sequence).padStart(8,'0')}`,locks,appVersion,...overrides});
  const service=build();
  const report=()=>({schemaVersion:1,window:{startDate:day(instant),endDate:day(instant),days:1,maxEventsPerSource:31},observedDays:1,omittedEvents:0,status:'observed',
    observations:[{metric:'wearable-steps',kind:'daily-observation',recordedDays:1,calendarDays:1,values:[{localDate:day(instant),value:1234}],repeatedValues:[],unit:'count',providers:['health-connect'],evidence:[{eventId:'PRIVATE_SOURCE',source:'today-health',localDate:day(instant)}]}],
    uncertainty:['PRIVATE_UNTRUSTED_TEXT'],privateNote:'PRIVATE_NOTE'});
  const offer=()=>service.offerObservation(report(),{userConfirmed:true,requestedAt:instant.toISOString()});
  const enable=()=>service.enable({kind:'ai',localTime:'18:30',quietHours:null,userConfirmed:true});
  return{service,store,storage,adapter,values,calls,build,report,offer,enable,
    now:()=>new Date(instant),advance:ms=>{instant=new Date(instant.getTime()+ms);},setTime:date=>{instant=new Date(date);},
    writes:()=>writes,failNextWrite:n=>{failWrite=writes+n;},
    setPermission:value=>{permission=value;},setCancelError:value=>{cancelError=value;},setScheduleError:value=>{scheduleError=value;},hold:value=>{scheduleHold=value;},
    pending:()=>clone(pending),setPending:items=>{pending=clone(items);},setDelivered:items=>{delivered=clone(items);},delivered:()=>clone(delivered),action:value=>callback?.(value)};
}

await check('fresh startup has no opt-in storage, OS permission prompt or schedule',async()=>{
  const f=fixture();assert.equal((await f.service.init()).ok,true);
  assert.equal(f.values.has(KEY),false);assert.equal(f.writes(),0);assert.equal(f.calls.requests,0);assert.deepEqual(f.calls.schedules,[]);
});
await check('PWA and missing exclusive scheduler cannot enable native delivery',async()=>{
  for(const options of [{supported:false},{exclusive:false}]){const f=fixture(options);assert.equal((await f.enable()).ok,false);assert.equal(f.calls.requests,0);assert.equal(f.values.has(KEY),false);}
});
await check('explicit enable requires an AI time and separate user confirmation',async()=>{
  const f=fixture();assert.equal((await f.service.enable({kind:'ai',localTime:'18:30'})).ok,false);
  assert.equal((await f.service.enable({kind:'ai',userConfirmed:true})).ok,false);assert.equal(f.calls.requests,0);
});
await check('permission is requested only by explicit enabling and denial writes no preferences',async()=>{
  const f=fixture({permission:'prompt',allowRequest:false});await f.service.init();assert.equal(f.calls.requests,0);
  assert.equal((await f.enable()).error,'permission-denied');assert.equal(f.calls.requests,1);assert.equal(f.values.has(KEY),false);
});
await check('a real observation is saved before scheduling and payload has no health facts',async()=>{
  const f=fixture();await f.enable();const result=await f.offer();assert.equal(result.status,'scheduled');
  const saved=f.store.read().state;assert.equal(saved.insights.length,1);assert.equal(saved.dispatches[0].state,'scheduled');
  assert.equal(saved.insights[0].id,result.insightId);assert.equal(f.calls.schedules[0].insightId,result.insightId);
  assert.doesNotMatch(JSON.stringify(f.calls.schedules),/1234|PRIVATE|wearable|Health/);
  assert.doesNotMatch(f.values.get(KEY),/PRIVATE/);
});
await check('no enabled archive or no fresh approved observation means no schedule',async()=>{
  const f=fixture();assert.equal((await f.offer()).status,'disabled');
  await f.enable();assert.equal((await f.service.offerObservation(f.report(),{requestedAt:f.now().toISOString()})).ok,false);
  assert.equal((await f.service.offerObservation(f.report(),{userConfirmed:true,requestedAt:new Date(f.now()-600000).toISOString()})).ok,false);
  assert.equal((await f.service.offerObservation({...f.report(),status:'insufficient-data'},{userConfirmed:true,requestedAt:f.now().toISOString()})).ok,false);
  assert.equal(f.calls.schedules.length,0);
});
await check('same-day repeated reports stay readable but do not create repeated phone alerts',async()=>{
  const f=fixture();await f.enable();await f.offer();await f.offer();assert.equal(f.calls.schedules.length,1);assert.equal(f.store.read().state.insights.length,2);
});
await check('past daily time archives without moving a new-observation alert to tomorrow',async()=>{
  const f=fixture();await f.service.enable({kind:'ai',localTime:'09:00',userConfirmed:true});
  assert.equal((await f.offer()).status,'archived');assert.equal(f.calls.schedules.length,0);assert.equal(f.store.read().state.insights.length,1);
});
await check('quiet hours postpone within the same day or skip an unavailable day',async()=>{
  const f=fixture();await f.service.enable({kind:'ai',localTime:'18:30',quietHours:{start:'18:00',end:'20:00'},userConfirmed:true});await f.offer();
  assert.equal(new Date(f.pending()[0].scheduledFor).getHours(),20);
  const skipped=notificationTime(new Date(2026,9,30,10), '22:30',{start:'22:00',end:'07:00'});assert.equal(skipped,null);
});
await check('missing permissions after enabling preserve the archive but schedule nothing',async()=>{
  const f=fixture();await f.enable();f.setPermission('denied');assert.equal((await f.offer()).error,'permission-denied');
  assert.equal(f.calls.requests,0);assert.equal(f.calls.schedules.length,0);assert.equal(f.store.read().state.insights.length,1);
});
await check('quota failure before reservation prevents every OS schedule',async()=>{
  const f=fixture();await f.enable();f.failNextWrite(1);assert.equal((await f.offer()).ok,false);assert.equal(f.calls.schedules.length,0);
});
await check('successful OS scheduling followed by ledger write failure cancels the task',async()=>{
  const f=fixture();await f.enable();f.failNextWrite(2);assert.equal((await f.offer()).error,'storage-write-failed');
  assert.equal(f.calls.schedules.length,1);assert.equal(f.pending().length,0);assert.equal(f.calls.cancels.flat().includes(f.calls.schedules[0].id),true);
});
await check('scheduler failure keeps a failed ledger and never claims delivery or retries blindly',async()=>{
  const f=fixture();await f.enable();f.setScheduleError(true);assert.equal((await f.offer()).error,'schedule-failed');
  assert.equal(f.store.read().state.dispatches[0].state,'failed');await f.offer();assert.equal(f.calls.schedules.length,1);
});
await check('startup reconciles a reserved task found in the OS queue without resubmitting',async()=>{
  const f=fixture();await f.enable();await f.offer();const state=clone(f.store.read().state);state.dispatches[0].state='reserved';f.store.commit(state);
  const next=f.build();await next.init();assert.equal(f.store.read().state.dispatches[0].state,'scheduled');assert.equal(f.calls.schedules.length,1);
});
await check('startup marks an absent reserved task failed instead of guessing it was delivered',async()=>{
  const f=fixture();await f.enable();await f.offer();const state=clone(f.store.read().state);state.dispatches[0].state='reserved';f.store.commit(state);f.setPending([]);
  await f.build().init();assert.equal(f.store.read().state.dispatches[0].state,'failed');assert.equal(f.calls.schedules.length,1);
});
await check('expired snapshots are inaccessible and their pending and visible tasks are removed',async()=>{
  const f=fixture();await f.enable();const result=await f.offer();f.setDelivered([{id:result.id,kind:null}]);f.advance(8*86400000);
  assert.equal((await f.service.openInsight(result.insightId)).error,'insight-unavailable');assert.equal(f.pending().length,0);assert.equal(f.delivered().length,0);assert.equal(f.store.read().state.insights.length,0);
});
await check('disabling AI clears health archive before a failing OS cancellation and retains only cleanup metadata',async()=>{
  const f=fixture();await f.enable();await f.offer();f.setCancelError(true);
  assert.equal((await f.service.disable('ai')).ok,false);const state=JSON.parse(f.values.get(KEY));
  assert.equal(state.preferences.aiEnabled,false);assert.deepEqual(state.insights,[]);assert.equal(state.dispatches.length,1);
  assert.equal((await f.offer()).error,'cleanup-failed');assert.equal(f.calls.schedules.length,1);
});
await check('successful AI disable removes the opt-in key while preserving existing Core and Health',async()=>{
  const f=fixture();await f.enable();await f.offer();assert.equal((await f.service.disable('ai')).ok,true);
  assert.equal(f.values.has(KEY),false);assert.equal(f.values.get('today_store_v2'),'SYNTHETIC_CORE_UNTOUCHED');assert.equal(f.values.get('health-existing'),'SYNTHETIC_HEALTH_UNTOUCHED');
});
await check('reset removes health archive even when pending cleanup fails and succeeds on retry',async()=>{
  const f=fixture();await f.enable();await f.offer();f.setCancelError(true);assert.equal((await f.service.reset()).ok,false);
  assert.equal(JSON.parse(f.values.get(KEY)).insights.length,0);f.setCancelError(false);assert.equal((await f.service.reset()).ok,true);assert.equal(f.values.has(KEY),false);
});
await check('corrupt store is never overwritten by enable or offer; explicit reset is scoped',async()=>{
  const f=fixture();f.values.set(KEY,'BROKEN_JSON');assert.equal((await f.enable()).ok,false);assert.equal(f.values.get(KEY),'BROKEN_JSON');
  assert.equal((await f.service.reset()).ok,true);assert.equal(f.values.has(KEY),false);assert.equal(f.values.get('today_store_v2'),'SYNTHETIC_CORE_UNTOUCHED');
});
await check('archive cap preserves the insight linked to the only daily notification',async()=>{
  const f=fixture();await f.enable();const first=await f.offer();for(let i=0;i<9;i++){f.advance(1);await f.offer();}
  assert.equal(f.store.read().state.insights.length,7);assert.equal((await f.service.openInsight(first.insightId)).ok,true);assert.equal(f.calls.schedules.length,1);
});
await check('concurrent calls cannot create overlapping schedules or duplicate reservations',async()=>{
  const f=fixture();await f.enable();let release;f.hold(new Promise(resolve=>{release=resolve;}));
  const one=f.offer();await new Promise(resolve=>setTimeout(resolve,0));const two=await f.offer();assert.equal(two.error,'scheduler-busy');release();await one;assert.equal(f.calls.schedules.length,1);
});
await check('a lock held by another context prevents writes or permission calls',async()=>{
  const f=fixture();const denied=f.build({locks:{request:async(name,options,run)=>run(null)}});
  assert.equal((await denied.enable({kind:'ai',localTime:'18:30',userConfirmed:true})).error,'scheduler-busy');assert.equal(f.values.has(KEY),false);assert.equal(f.calls.requests,0);
});
await check('OS tap events carry only opaque IDs and the stored observation opens after a cold service start',async()=>{
  const f=fixture();await f.enable();const result=await f.offer();const next=f.build();const events=[];next.subscribe(event=>events.push(event));await next.init();f.action({kind:'ai',insightId:result.insightId});
  const event=events.find(item=>item.type==='open');assert.deepEqual(Object.keys(event),['type','insightId']);
  assert.equal((await next.openInsight(event.insightId)).insight.report.observations[0].values[0].value,1234);
});
await check('update activation seeds the installed version without fabricating a new update',async()=>{
  const f=fixture();await f.service.enable({kind:'update',userConfirmed:true});assert.equal(f.store.read().state.lastNotifiedUpdateVersion,'2.19.0');assert.equal(f.calls.schedules.length,0);
});
await check('a higher actual installed bundle notifies once while same version and downgrade do not',async()=>{
  const f=fixture();await f.service.enable({kind:'update',userConfirmed:true});await f.build({appVersion:'2.20.0'}).init();
  assert.equal(f.calls.schedules.length,1);assert.equal(f.calls.schedules[0].kind,'update');assert.equal(f.calls.schedules[0].version,'2.20.0');
  await f.build({appVersion:'2.20.0'}).init();await f.build({appVersion:'2.18.0'}).init();assert.equal(f.calls.schedules.length,1);
});
await check('unknown update readiness is rejected and the two preference channels stay independent',async()=>{
  const f=fixture();await f.enable();await f.service.enable({kind:'update',userConfirmed:true});
  assert.equal((await f.service.offerUpdate({version:'2.20.0',ready:'yes'})).ok,false);
  await f.service.offerUpdate({version:'2.20.0',ready:true});const update=f.pending().find(item=>item.kind==='update');
  f.setDelivered([{id:update.id,kind:null}]);await f.service.disable('ai');assert.equal(f.store.read().state.preferences.updateEnabled,true);assert.equal(f.delivered().some(item=>item.id===update.id),true);
});
await check('timezone change replans a still-pending task without creating an additional daily dispatch',async()=>{
  const f=fixture();await f.enable();await f.offer();const state=clone(f.store.read().state);state.dispatches[0].zone='Pacific/Honolulu';f.store.commit(state);
  await f.service.init();assert.equal(f.calls.schedules.length,2);assert.equal(f.calls.schedules[0].id,f.calls.schedules[1].id);assert.equal(f.store.read().state.dispatches.length,1);
});
await check('a missing tap handler prevents enabling a notification that cannot open its archive',async()=>{
  const f=fixture();f.adapter.onAction=async()=>({ok:false,error:'PRIVATE_SDK_ERROR'});
  assert.equal((await f.enable()).error,'action-handler-unavailable');assert.equal(f.values.has(KEY),false);assert.equal(f.calls.schedules.length,0);
});
await check('an ambiguous failed SDK schedule cancels its reserved ID immediately',async()=>{
  const f=fixture();await f.enable();const original=f.adapter.schedule;
  f.adapter.schedule=async value=>{await original(value);return{ok:false,error:'unknown'};};
  assert.equal((await f.offer()).error,'schedule-failed');assert.equal(f.pending().length,0);assert.equal(f.calls.cancels.flat().includes(f.calls.schedules[0].id),true);
});
await check('withdrawal quota failure resets only the new opt-in store and cancels its tasks',async()=>{
  const f=fixture();await f.enable();await f.offer();f.failNextWrite(1);
  assert.equal((await f.service.disable('ai')).error,'storage-write-failed');assert.equal(f.values.has(KEY),false);assert.equal(f.pending().length,0);
  assert.equal(f.values.get('today_store_v2'),'SYNTHETIC_CORE_UNTOUCHED');assert.equal(f.values.get('health-existing'),'SYNTHETIC_HEALTH_UNTOUCHED');
});
await check('changing a selected daily time replans one pending ID instead of creating another alert',async()=>{
  const f=fixture();await f.enable();await f.offer();
  await f.service.enable({kind:'ai',localTime:'20:15',quietHours:null,userConfirmed:true});
  assert.equal(f.calls.schedules.length,2);assert.equal(f.calls.schedules[0].id,f.calls.schedules[1].id);
  assert.equal(new Date(f.pending()[0].scheduledFor).getHours(),20);assert.equal(f.store.read().state.dispatches.length,1);
});
await check('enabling the update channel does not silently erase selected AI quiet hours',async()=>{
  const f=fixture();await f.service.enable({kind:'ai',localTime:'18:30',quietHours:{start:'22:00',end:'07:00'},userConfirmed:true});
  await f.service.enable({kind:'update',userConfirmed:true});
  assert.deepEqual(f.store.read().state.preferences.quietHours,{start:'22:00',end:'07:00'});
});
await check('DST gaps and repeated hours use one local calendar slot and never a next-day fallback',async()=>{
  const previous=process.env.TZ;process.env.TZ='America/New_York';
  try{
    const spring=notificationTime(new Date(2026,2,8,0,0),'02:30');assert.equal(spring.getHours(),3);assert.equal(spring.getMinutes(),0);
    const autumn=notificationTime(new Date(2026,10,1,0,0),'01:30');assert.equal(autumn.getHours(),1);
    assert.equal(notificationTime(new Date(2026,10,1,1,45),'01:30'),null);
  } finally { if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous; }
});
await check('expired health is purged before failed OS cleanup and IDs survive for retry',async()=>{
  const f=fixture();await f.enable();await f.offer();const id=f.pending()[0].id;
  f.advance(8*86400000);f.setCancelError(true);
  assert.equal((await f.build().init()).ok,false);
  const persisted=JSON.parse(f.values.get(KEY));assert.deepEqual(persisted.insights,[]);
  assert.equal(persisted.dispatches[0].id,id);assert.doesNotMatch(f.values.get(KEY),/1234|wearable-steps/);
  f.setCancelError(false);assert.equal((await f.build().init()).ok,true);assert.deepEqual(f.pending(),[]);
});
await check('expired health is purged even when the native bridge becomes unavailable',async()=>{
  const f=fixture();await f.enable();await f.offer();f.advance(8*86400000);
  assert.equal((await f.build({adapter:{supported:false}}).init()).status,'unsupported');
  const persisted=JSON.parse(f.values.get(KEY));assert.deepEqual(persisted.insights,[]);
  assert.equal(persisted.dispatches.length,1);assert.equal(f.calls.requests,0);
});
console.log(`NUT-019.3 Notification Service: ${count}/${count} başarılı`);
