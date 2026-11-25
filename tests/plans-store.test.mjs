import assert from 'node:assert/strict';
import {createPlansStore,PLANS_KEY} from '../modules/plans-store.mjs';

let passed=0;
async function check(name,fn){await fn();passed++;console.log(`PASS ${name}`);}
const clock='2026-11-24T12:00:00.000Z';
function fixture(seed={}){
  const map=new Map(Object.entries(seed));let writes=0,blocked=false,n=0;
  const storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>{if(blocked)throw Error('quota');writes++;map.set(key,value);}};
  const store=createPlansStore({storage,crypto:{randomUUID:()=>`plan-${++n}`},now:()=>new Date(clock)});
  return {map,store,writes:()=>writes,block:()=>{blocked=true;}};
}
await check('reading an absent Planlar store does not create any key',()=>{
  const f=fixture({'today_store_v2':'PRIVATE'});
  assert.deepEqual(f.store.read(),{version:1,items:[]});assert.equal(f.writes(),0);assert.equal(f.map.size,1);
});
await check('creating, editing and moving a plan preserve identity and other Today data',()=>{
  const f=fixture({'today_store_v2':'PRIVATE'});
  f.store.create({title:' Oku ',state:'next'});
  const first=f.store.read().items[0];assert.equal(first.title,'Oku');assert.equal(first.state,'next');
  f.store.update(first.id,{title:'Kitap oku',state:'day',dayKey:'2026-11-25'});
  assert.equal(f.store.read().items[0].dayKey,'2026-11-25');
  f.store.update(first.id,{state:'doing'});
  const moved=f.store.read().items[0];assert.equal(moved.dayKey,undefined);assert.equal(moved.createdAt,first.createdAt);
  assert.equal(f.map.get('today_store_v2'),'PRIVATE');assert.equal(f.writes(),3);
});
await check('deletion is explicit and leaves unrelated records untouched',()=>{
  const f=fixture();f.store.create({title:'Bir'});f.store.create({title:'İki'});
  f.store.remove(f.store.read().items[0].id);
  assert.deepEqual(f.store.read().items.map(item=>item.title),['İki']);
});
await check('malformed existing data blocks all writes without replacement',()=>{
  const raw='{"version":1,"items":[{"private":"OLD"}]}',f=fixture({[PLANS_KEY]:raw});
  assert.throws(()=>f.store.read(),e=>e.code==='invalid-plans-data');
  assert.throws(()=>f.store.create({title:'Yeni'}),e=>e.code==='invalid-plans-data');
  assert.equal(f.map.get(PLANS_KEY),raw);assert.equal(f.writes(),0);
});
await check('duplicate JSON fields cannot be normalized over earlier records',()=>{
  const raw='{"version":1,"items":[{"private":"OLD"}],"items":[]}',f=fixture({[PLANS_KEY]:raw});
  assert.throws(()=>f.store.create({title:'Yeni'}),e=>e.code==='invalid-plans-data');
  assert.equal(f.map.get(PLANS_KEY),raw);assert.equal(f.writes(),0);
});
await check('invalid date and unknown fields never reach storage',()=>{
  const f=fixture();assert.throws(()=>f.store.create({title:'X',state:'day',dayKey:'2026-02-30'}));
  assert.equal(f.writes(),0);f.store.create({title:'Geçerli'});
  const id=f.store.read().items[0].id;assert.throws(()=>f.store.update(id,{calendarId:'external'}),e=>e.code==='invalid-change');
  assert.equal(f.writes(),1);
});
await check('quota failure retains the previous serialized snapshot',()=>{
  const f=fixture();f.store.create({title:'Eski'});const before=f.map.get(PLANS_KEY);f.block();
  assert.throws(()=>f.store.create({title:'Yeni'}),e=>e.code==='storage-write-failed');
  assert.equal(f.map.get(PLANS_KEY),before);assert.deepEqual(f.store.read().items.map(item=>item.title),['Eski']);
});
console.log(`Plans Store: ${passed}/7 başarılı`);
