import assert from 'node:assert/strict';
import {createPlacesStore,PLACES_KEY} from '../modules/places-store.mjs';

let passed=0;
async function check(name,fn){await fn();passed++;console.log(`PASS ${name}`);}
const at='2026-11-24T12:00:00.000Z';
function fixture(seed={}){
  const map=new Map(Object.entries(seed));let writes=0,blocked=false,n=0;
  const storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>{if(blocked)throw Error('quota');writes++;map.set(key,value);}};
  const store=createPlacesStore({storage,crypto:{randomUUID:()=>`place-${++n}`},now:()=>new Date(at)});
  return {map,store,writes:()=>writes,block:()=>{blocked=true;}};
}
await check('absent Yerler data reads empty without creating a key',()=>{
  const f=fixture({'today_store_v2':'PRIVATE'});assert.deepEqual(f.store.read(),{version:1,items:[]});assert.equal(f.writes(),0);
});
await check('manual place creation, editing and visited state preserve other Today data',()=>{
  const f=fixture({'today_store_v2':'PRIVATE'});f.store.create({name:' Müze ',city:'İstanbul'});
  const item=f.store.read().items[0];assert.equal(item.name,'Müze');
  f.store.update(item.id,{state:'visited',note:'Güzeldi',url:'https://example.test/place'});
  const updated=f.store.read().items[0];assert.equal(updated.state,'visited');assert.equal(updated.createdAt,item.createdAt);
  assert.equal(f.map.get('today_store_v2'),'PRIVATE');assert.equal(f.writes(),2);
});
await check('explicit deletion retains other places',()=>{
  const f=fixture();f.store.create({name:'A',city:'X'});f.store.create({name:'B',city:'Y'});
  f.store.remove(f.store.read().items[0].id);assert.deepEqual(f.store.read().items.map(item=>item.name),['B']);
});
await check('invalid URL or unknown change cannot be stored',()=>{
  const f=fixture();assert.throws(()=>f.store.create({name:'A',city:'X',url:'javascript:alert(1)'}));assert.equal(f.writes(),0);
  f.store.create({name:'A',city:'X'});assert.throws(()=>f.store.update(f.store.read().items[0].id,{gps:true}),e=>e.code==='invalid-change');assert.equal(f.writes(),1);
});
await check('malformed or duplicate JSON blocks writes and preserves exact bytes',()=>{
  for(const raw of ['{"version":1,"items":[{"private":"OLD"}]}','{"version":1,"items":[{"private":"OLD"}],"items":[]}']){
    const f=fixture({[PLACES_KEY]:raw});assert.throws(()=>f.store.create({name:'Yeni',city:'X'}),e=>e.code==='invalid-places-data');
    assert.equal(f.map.get(PLACES_KEY),raw);assert.equal(f.writes(),0);
  }
});
await check('quota refusal retains prior snapshot',()=>{
  const f=fixture();f.store.create({name:'Eski',city:'X'});const before=f.map.get(PLACES_KEY);f.block();
  assert.throws(()=>f.store.create({name:'Yeni',city:'Y'}),e=>e.code==='storage-write-failed');assert.equal(f.map.get(PLACES_KEY),before);
});
console.log(`Places Store: ${passed}/6 başarılı`);
