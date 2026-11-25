import {validatePlansSnapshot, validatePlanItem} from './plans-contract.mjs';
import {parseBackupJSON} from './backup-export.mjs';

export const PLANS_KEY = 'today.plans.v1';
const MAX_BYTES = 512 * 1024;
const empty = () => ({version:1,items:[]});
const fail = code => {const error = new Error(code);error.code=code;throw error;};

export function createPlansStore({storage,crypto,now=()=>new Date()}={}) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') fail('storage-unavailable');
  const read = () => {
    let raw;
    try {raw=storage.getItem(PLANS_KEY);} catch {fail('storage-unavailable');}
    if (raw===null) return empty();
    if (typeof raw!=='string' || new TextEncoder().encode(raw).length>MAX_BYTES) fail('invalid-plans-data');
    try {return validatePlansSnapshot(parseBackupJSON(raw));} catch {fail('invalid-plans-data');}
  };
  const instant = () => {
    const value=now();
    if (!(value instanceof Date) || !Number.isFinite(value.getTime())) fail('invalid-clock');
    return value.toISOString();
  };
  const commit = items => {
    const snapshot=validatePlansSnapshot({version:1,items});
    const raw=JSON.stringify(snapshot);
    if (new TextEncoder().encode(raw).length>MAX_BYTES) fail('plans-limit');
    try {storage.setItem(PLANS_KEY,raw);} catch {fail('storage-write-failed');}
    return snapshot;
  };
  const create = ({title,note='',state='next',dayKey}={}) => {
    const before=read(),at=instant();
    if (before.items.length>=500) fail('plans-limit');
    const id=crypto?.randomUUID?.();
    if (!id || typeof id!=='string') fail('id-unavailable');
    const item=validatePlanItem({id,title,note,state,...(state==='day'?{dayKey}:{}),createdAt:at,updatedAt:at});
    if (before.items.some(existing=>existing.id===id)) fail('duplicate-id');
    return commit([...before.items,item]);
  };
  const update = (id,changes={}) => {
    const before=read(),index=before.items.findIndex(item=>item.id===id);
    if (index<0) fail('plan-not-found');
    if (!changes || Object.keys(changes).some(key=>!['title','note','state','dayKey'].includes(key))) fail('invalid-change');
    const current=before.items[index],state=changes.state??current.state,at=instant();
    const next=validatePlanItem({id:current.id,title:changes.title??current.title,note:changes.note??current.note,
      state,...(state==='day'?{dayKey:changes.dayKey??current.dayKey}:{}),createdAt:current.createdAt,updatedAt:at});
    return commit(before.items.map((item,i)=>i===index?next:item));
  };
  const remove = id => {
    const before=read();
    if (!before.items.some(item=>item.id===id)) fail('plan-not-found');
    return commit(before.items.filter(item=>item.id!==id));
  };
  return Object.freeze({read,create,update,remove});
}
