import {validatePlacesSnapshot,validatePlace} from './places-contract.mjs';
import {parseBackupJSON} from './backup-export.mjs';

export const PLACES_KEY='today.places.v1';
const MAX_BYTES=512*1024;
const fail=code=>{const error=new Error(code);error.code=code;throw error;};
export function createPlacesStore({storage,crypto,now=()=>new Date()}={}){
  if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')fail('storage-unavailable');
  const read=()=>{
    let raw;try{raw=storage.getItem(PLACES_KEY);}catch{fail('storage-unavailable');}
    if(raw===null)return {version:1,items:[]};
    if(typeof raw!=='string'||new TextEncoder().encode(raw).length>MAX_BYTES)fail('invalid-places-data');
    try{return validatePlacesSnapshot(parseBackupJSON(raw));}catch{fail('invalid-places-data');}
  };
  const instant=()=>{const value=now();if(!(value instanceof Date)||!Number.isFinite(value.getTime()))fail('invalid-clock');return value.toISOString();};
  const commit=items=>{
    const snapshot=validatePlacesSnapshot({version:1,items}),raw=JSON.stringify(snapshot);
    if(new TextEncoder().encode(raw).length>MAX_BYTES)fail('places-limit');
    try{storage.setItem(PLACES_KEY,raw);}catch{fail('storage-write-failed');}
    return snapshot;
  };
  const create=({name,city,note='',address='',url='',state='want'}={})=>{
    const before=read(),at=instant();if(before.items.length>=500)fail('places-limit');
    const id=crypto?.randomUUID?.();if(!id||typeof id!=='string')fail('id-unavailable');
    const item=validatePlace({id,name,city,note,address,url,state,createdAt:at,updatedAt:at});
    if(before.items.some(existing=>existing.id===id))fail('duplicate-id');
    return commit([...before.items,item]);
  };
  const update=(id,changes={})=>{
    const before=read(),index=before.items.findIndex(item=>item.id===id);if(index<0)fail('place-not-found');
    if(!changes||Object.keys(changes).some(key=>!['name','city','note','address','url','state'].includes(key)))fail('invalid-change');
    const current=before.items[index],at=instant();
    const next=validatePlace({...current,...changes,updatedAt:at});
    return commit(before.items.map((item,i)=>i===index?next:item));
  };
  const remove=id=>{const before=read();if(!before.items.some(item=>item.id===id))fail('place-not-found');return commit(before.items.filter(item=>item.id!==id));};
  return Object.freeze({read,create,update,remove});
}
