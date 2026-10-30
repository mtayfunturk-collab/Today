import { defaultState, sanitizeObservation } from './notification-store.mjs';

const LOCK = 'today:ai-delivery-v1';
const MIN_ID = 1903000000;
const MAX_ID = 1903999999;
const WEEK = 7 * 86400000;
const clone = value => JSON.parse(JSON.stringify(value));
const ownId = id => Number.isInteger(id) && id >= MIN_ID && id <= MAX_ID;
const time = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const version = value => typeof value === 'string' && /^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(value);
const localDay = date => [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const minutes = value => Number(value.slice(0,2))*60+Number(value.slice(3));
const quietValid = value => value === null || (value && Object.keys(value).length === 2 && time(value.start) && time(value.end) && value.start !== value.end);
const compareVersions = (a,b) => {
  const left = a.split('.').map(Number), right = b.split('.').map(Number);
  for (let i=0;i<3;i++) if (left[i] !== right[i]) return Math.sign(left[i]-right[i]);
  return 0;
};
function quietAt(date, quiet) {
  if (!quiet) return false;
  const value = date.getHours()*60+date.getMinutes(), start = minutes(quiet.start), end = minutes(quiet.end);
  return start < end ? value >= start && value < end : value >= start || value < end;
}

// Search actual instants in this local calendar day: DST gaps advance to the
// first valid minute; a repeated wall time does not create a second daily slot.
export function notificationTime(now, localTime, quietHours = null, immediate = false) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()) || !quietValid(quietHours) || (!immediate && !time(localTime))) return null;
  const start = new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const end = new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
  if (immediate && !quietAt(now,quietHours)) {
    const candidate = new Date(now.getTime()+1500);
    return candidate < end ? candidate : null;
  }
  const target = immediate ? now.getHours()*60+now.getMinutes() : minutes(localTime);
  let first = null;
  for (let instant = start.getTime(); instant < end.getTime(); instant += 60000) {
    const candidate = new Date(instant);
    if (candidate.getHours()*60+candidate.getMinutes() < target) continue;
    if (!quietAt(candidate,quietHours)) { first = candidate; break; }
  }
  return first && first > now ? first : null;
}

export function createNotificationService({ store, adapter, now = () => new Date(),
  idFactory = () => globalThis.crypto?.randomUUID?.(), locks = globalThis.navigator?.locks,
  appVersion = globalThis.TodayVersion?.APP_VERSION } = {}) {
  let state = defaultState();
  let initialized = false;
  let busy = false;
  let errorCode = null;
  let actionBound = false;
  const suppressed = new Set();
  const listeners = new Set();
  const supported = adapter?.supported === true;
  const exclusive = typeof locks?.request === 'function';
  const getState = () => Object.freeze({ initialized, supported, exclusive, busy, errorCode,
    preferences: Object.freeze({ ...state.preferences, quietHours: state.preferences.quietHours && Object.freeze({...state.preferences.quietHours}),
      aiEnabled: state.preferences.aiEnabled && !suppressed.has('ai'), updateEnabled: state.preferences.updateEnabled && !suppressed.has('update') }),
    insightCount: state.insights.length });
  const emit = event => { for (const listener of listeners) { try { listener(event); } catch {} } };
  const changed = () => emit(Object.freeze({ type: 'change', state: getState() }));
  const fail = error => { errorCode = error; return { ok: false, error }; };
  function read() {
    const result = store?.read?.();
    if (!result?.ok) throw new Error('storage-unavailable');
    state = clone(result.state);
    return result;
  }
  function commit(next) {
    const result = store?.commit?.(next);
    if (!result?.ok) throw new Error('storage-write-failed');
    state = clone(result.state || next);
  }
  async function locked(task) {
    if (busy) return fail('scheduler-busy');
    if (!exclusive) return fail('exclusive-unavailable');
    busy = true; errorCode = null; changed();
    try {
      return await locks.request(LOCK, { mode: 'exclusive', ifAvailable: true }, async lock => {
        if (!lock) return fail('scheduler-busy');
        const result = await task();
        if(result?.ok === true)errorCode=null;
        return result;
      });
    } catch (error) {
      const known = ['storage-unavailable','storage-write-failed','cleanup-failed','permission-denied','schedule-failed'];
      return fail(known.includes(error?.message) ? error.message : 'notification-operation-failed');
    } finally { busy = false; changed(); }
  }
  async function call(name, ...args) {
    const result = await adapter[name](...args);
    if (result?.ok === false || result === false) throw new Error(name === 'schedule' ? 'schedule-failed' : 'cleanup-failed');
    return result;
  }
  async function lists() {
    const pending = await call('getPending'), delivered = await call('getDelivered');
    if (!Array.isArray(pending) || !Array.isArray(delivered)) throw new Error('cleanup-failed');
    return { pending: pending.filter(item => ownId(item.id)), delivered: delivered.filter(item => ownId(item.id)) };
  }
  async function remove(ids, deliveredIds = ids) {
    const unique = [...new Set(ids.filter(ownId))];
    const visible = [...new Set(deliveredIds.filter(ownId))];
    if (unique.length) await call('cancel',unique);
    if (visible.length) await call('removeDelivered',visible);
  }
  function dispatchId(next) {
    const bytes = new Uint32Array(1);
    if (!globalThis.crypto?.getRandomValues) throw new Error('notification-operation-failed');
    for (let count=0;count<20;count++) {
      globalThis.crypto.getRandomValues(bytes);
      const id = MIN_ID+bytes[0]%(MAX_ID-MIN_ID+1);
      if (!next.dispatches.some(item=>item.id===id)) return id;
    }
    throw new Error('notification-operation-failed');
  }
  async function permission() {
    const result = await adapter.checkPermission();
    return result?.ok !== false && result?.granted === true;
  }
  async function bindActions() {
    if(actionBound)return true;
    if(typeof adapter?.onAction!=='function')return false;
    try {
      const result=await adapter.onAction(action=>{
        if(action?.kind==='ai'&&typeof action.insightId==='string')emit(Object.freeze({type:'open',insightId:action.insightId}));
        else if(action?.kind==='update'&&version(action.version))emit(Object.freeze({type:'update-open',version:action.version}));
      });
      actionBound=result?.ok===true;
      return actionBound;
    } catch { return false; }
  }
  async function schedule(next, entry) {
    if(!await bindActions())return fail('action-handler-unavailable');
    commit(next); // A reservation and its readable snapshot precede every OS call.
    try {
      if (!await permission()) throw new Error('permission-denied');
      await call('schedule', { id: entry.id, kind: entry.kind, scheduledFor: entry.scheduledFor,
        ...(entry.kind==='ai' ? { insightId: entry.insightId } : { version: entry.version }) });
      const finished = clone(next);
      finished.dispatches.find(item=>item.id===entry.id).state = 'scheduled';
      if (entry.kind==='update') finished.lastNotifiedUpdateVersion = entry.version;
      try { commit(finished); }
      catch {
        await remove([entry.id]);
        throw new Error('storage-write-failed');
      }
      return { ok: true, status: 'scheduled', id: entry.id };
    } catch (error) {
      // A rejected bridge call may still have reached the OS. Cancel this exact
      // reserved ID before reporting failure, without touching another channel.
      try { await remove([entry.id]); } catch {}
      // Retain the reservation when storage is unavailable; startup reconciliation
      // checks the OS queue rather than blindly submitting the same task again.
      const failed = clone(next);
      failed.dispatches.find(item=>item.id===entry.id).state = 'failed';
      try { commit(failed); } catch {}
      return fail(error?.message === 'permission-denied' ? 'permission-denied' : error?.message === 'storage-write-failed' ? 'storage-write-failed' : 'schedule-failed');
    }
  }
  function entryFor(next, kind, candidate, insightId = null, updateVersion = null) {
    return { id: dispatchId(next), kind, insightId, version: updateVersion,
      localDate: localDay(now()), zone: zone(), scheduledFor: candidate.toISOString(), state: 'reserved' };
  }
  async function reconcile(result, forceReschedule = false) {
    // Purge expired derived health first. Keep non-sensitive dispatch IDs until
    // OS cleanup succeeds, so a bridge failure cannot prolong archive retention.
    if (result.originalState && JSON.stringify(result.originalState.insights) !== JSON.stringify(result.state.insights)) {
      commit({ ...clone(result.originalState), insights: clone(result.state.insights) });
    }
    if (!supported) { state=clone(result.state); return; }
    const next = clone(result.state), current = now(), day = localDay(current);
    const queued = await lists();
    const valid = entry => entry.kind==='ai'
      ? next.preferences.aiEnabled && !suppressed.has('ai') && next.insights.some(item=>item.id===entry.insightId)
      : next.preferences.updateEnabled && !suppressed.has('update');
    const eligible = new Map(next.dispatches.filter(valid).map(entry=>[entry.id,entry]));
    const stalePending = queued.pending.filter(item=>!eligible.has(item.id) || eligible.get(item.id).state==='failed' || eligible.get(item.id).localDate!==day);
    const staleVisible = queued.delivered.filter(item=>!eligible.has(item.id));
    await remove(stalePending.map(item=>item.id),staleVisible.map(item=>item.id));
    const pendingIds = new Set(queued.pending.filter(item=>!stalePending.includes(item)).map(item=>item.id));
    const deliveredIds = new Set(queued.delivered.map(item=>item.id));
    let dirty = result.changed === true;
    for (const entry of next.dispatches) {
      if (!valid(entry)) continue;
      if (entry.state==='reserved') {
        entry.state = pendingIds.has(entry.id) || deliveredIds.has(entry.id) ? 'scheduled' : 'failed';
        if (entry.kind==='update' && entry.state==='scheduled') next.lastNotifiedUpdateVersion=entry.version;
        dirty=true;
      }
    }
    // A previously selected clock time follows the device zone. Replan only a
    // still-pending task on the same local day; never turn an old insight into a
    // new next-day alert or repeat a notification which may already be visible.
    for (const entry of next.dispatches) {
      if (entry.kind!=='ai' || (!forceReschedule && entry.zone===zone()) || !pendingIds.has(entry.id) || entry.localDate!==day || !valid(entry)) continue;
      await remove([entry.id],[]);
      const candidate = notificationTime(current,next.preferences.localTime,next.preferences.quietHours);
      if (!candidate) { entry.state='failed'; dirty=true; continue; }
      entry.zone=zone(); entry.scheduledFor=candidate.toISOString(); entry.state='reserved';
      const outcome = await schedule(next,entry);
      if (!outcome.ok) throw new Error(outcome.error);
      next.dispatches.find(item=>item.id===entry.id).state='scheduled'; dirty=true;
    }
    if (!next.preferences.aiEnabled && (next.insights.length || next.dispatches.some(entry=>entry.kind==='ai'))) {
      next.insights=[]; next.dispatches=next.dispatches.filter(entry=>entry.kind!=='ai'); dirty=true;
    }
    if (!next.preferences.updateEnabled && next.dispatches.some(entry=>entry.kind==='update')) {
      next.dispatches=next.dispatches.filter(entry=>entry.kind!=='update'); dirty=true;
    }
    if (dirty) commit(next);
    else state=next;
  }
  async function offerUpdateInside({ version: updateVersion, ready }) {
    if (ready !== true || !version(updateVersion)) return fail('invalid-update');
    const result=read(); await reconcile(result);
    const next=clone(state);
    if (!next.preferences.updateEnabled || suppressed.has('update')) return {ok:true,status:'disabled'};
    if ((version(next.lastNotifiedUpdateVersion) && compareVersions(updateVersion,next.lastNotifiedUpdateVersion)<=0) || next.dispatches.some(item=>item.kind==='update'&&item.version===updateVersion)) return {ok:true,status:'already-recorded'};
    if (!await permission()) return fail('permission-denied');
    const candidate=notificationTime(now(),null,next.preferences.quietHours,true);
    if (!candidate) return {ok:true,status:'outside-window'};
    if (next.dispatches.length>=14) return fail('dispatch-limit');
    const entry=entryFor(next,'update',candidate,null,updateVersion); next.dispatches.push(entry);
    return schedule(next,entry);
  }
  const api = {
    getState,
    subscribe(listener) { listeners.add(listener); return ()=>listeners.delete(listener); },
    async init() {
      if(supported&&!await bindActions())return fail('action-handler-unavailable');
      if (!exclusive) {
        try { read(); initialized=true; changed(); return {ok:true,status:!supported?'unsupported':'exclusive-unavailable'}; }
        catch { return fail('storage-unavailable'); }
      }
      const outcome=await locked(async()=>{
        const result=read();
        // Queue enumeration/cleanup does not request permission or schedule.
        // Even after the archive was manually removed, stale Today tasks are cancelled.
        await reconcile(result); initialized=true;
        if (!supported) return {ok:true,status:"unsupported"};
        if (state.preferences.updateEnabled && version(appVersion) && version(state.lastNotifiedUpdateVersion) && compareVersions(appVersion,state.lastNotifiedUpdateVersion)>0) {
          return offerUpdateInside({version:appVersion,ready:true});
        }
        return {ok:true,status:'ready'};
      });
      return outcome;
    },
    enable({kind,localTime=null,quietHours,userConfirmed=false}={}) {
      if (!supported) return Promise.resolve(fail('native-unavailable'));
      if (!userConfirmed || !['ai','update'].includes(kind) || (quietHours!==undefined&&!quietValid(quietHours)) || (kind==='ai'&&!time(localTime))) return Promise.resolve(fail('explicit-preferences-required'));
      return locked(async()=>{
        const result=read(); await reconcile(result);
        if(!await bindActions())return fail('action-handler-unavailable');
        if (!await permission()) {
          const granted=await adapter.requestPermission();
          if (granted?.ok===false||granted?.granted!==true) return fail('permission-denied');
        }
        const next=clone(state); next.preferences[`${kind}Enabled`]=true;
        if(kind==='ai')next.preferences.localTime=localTime;
        if(quietHours!==undefined)next.preferences.quietHours=quietHours;
        if(kind==='update'&&!version(next.lastNotifiedUpdateVersion)&&version(appVersion))next.lastNotifiedUpdateVersion=appVersion;
        commit(next); suppressed.delete(kind);
        if(kind==='ai')await reconcile(read(),true);
        return {ok:true,status:'enabled'};
      });
    },
    disable(kind) {
      if(!['ai','update'].includes(kind))return Promise.resolve(fail('invalid-kind'));
      suppressed.add(kind);
      return locked(async()=>{
        read(); const next=clone(state); next.preferences[`${kind}Enabled`]=false;
        if(kind==='ai')next.insights=[];
        try { commit(next); } // Persist withdrawal and remove derived health before OS cleanup.
        catch {
          // A full opt-in-store reset is the privacy fallback when a quota/write
          // failure prevents removing only the AI archive. Core/Health are untouched.
          suppressed.add('ai'); suppressed.add('update');
          const reset=store.reset(); if(reset?.ok!==false)state=defaultState();
          if(supported){try{const queued=await lists();await remove(queued.pending.map(item=>item.id),queued.delivered.map(item=>item.id));}catch{}}
          return fail('storage-write-failed');
        }
        if(!supported && next.dispatches.some(entry=>entry.kind===kind))return fail('cleanup-failed');
        const queued=supported?await lists():{pending:[],delivered:[]};
        const belongs = entry => entry.kind===kind || (entry.kind===null &&
          (!next.dispatches.some(item=>item.id===entry.id) || next.dispatches.find(item=>item.id===entry.id)?.kind===kind));
        await remove([...next.dispatches.filter(entry=>entry.kind===kind).map(entry=>entry.id),...queued.pending.filter(belongs).map(entry=>entry.id)],
          queued.delivered.filter(belongs).map(entry=>entry.id));
        if(kind==='ai')next.insights=[];
        next.dispatches=next.dispatches.filter(entry=>entry.kind!==kind);
        commit(next); return {ok:true,status:'disabled'};
      });
    },
    reset() {
      suppressed.add('ai'); suppressed.add('update');
      return locked(async()=>{
        const loaded=store.read();
        if(loaded?.ok){
          const stopped=clone(loaded.originalState||loaded.state);stopped.preferences.aiEnabled=false;stopped.preferences.updateEnabled=false;stopped.insights=[];
          try{commit(stopped);}catch{const reset=store.reset();if(reset?.ok!==false)state=defaultState();}
        } else { const reset=store.reset();if(reset?.ok===false)return fail('storage-write-failed');state=defaultState(); }
        if(supported){const queued=await lists();await remove(queued.pending.map(item=>item.id),queued.delivered.map(item=>item.id));}
        else if(loaded?.ok&&loaded.originalState?.dispatches.length)return fail('cleanup-failed');
        const result=store.reset();if(result?.ok===false)throw new Error('storage-write-failed');
        state=defaultState();return{ok:true,status:'reset'};
      });
    },
    offerObservation(report,{userConfirmed=false,requestedAt}={}) {
      if(!userConfirmed||typeof requestedAt!=='string'||!Number.isFinite(Date.parse(requestedAt))||Date.parse(requestedAt)>now().getTime()||now().getTime()-Date.parse(requestedAt)>300000)return Promise.resolve(fail('fresh-observation-required'));
      const sanitized=sanitizeObservation(report);if(!sanitized?.ok||sanitized.report.window.endDate>localDay(now()))return Promise.resolve(fail('invalid-observation'));
      return locked(async()=>{
        const result=read();await reconcile(result);
        const next=clone(state);
        if(!next.preferences.aiEnabled||suppressed.has('ai'))return{ok:true,status:'disabled'};
        const id=idFactory();if(typeof id!=='string'||!/^[a-z0-9_-]{8,100}$/i.test(id)||next.insights.some(item=>item.id===id))return fail('invalid-insight-id');
        const current=now();const insight={id,createdAt:current.toISOString(),expiresAt:new Date(current.getTime()+WEEK).toISOString(),
          rulesetId:'today:multi-window-observer:nut-019.3',window:clone(sanitized.report.window),report:clone(sanitized.report)};
        const pinned = next.insights.filter(item=>next.dispatches.some(entry=>entry.kind==='ai'&&entry.insightId===item.id));
        if(pinned.length>=7)return fail('archive-limit');
        const optional = [...next.insights.filter(item=>!pinned.some(saved=>saved.id===item.id)),insight]
          .sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).slice(-(7-pinned.length));
        const kept=[...pinned,...optional].sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
        const removed=next.insights.filter(item=>!kept.some(retained=>retained.id===item.id));
        if(removed.length){const ids=next.dispatches.filter(entry=>removed.some(item=>item.id===entry.insightId)).map(entry=>entry.id);await remove(ids);}
        next.insights=kept;
        if(next.dispatches.some(entry=>entry.kind==='ai'&&entry.localDate===localDay(current))){commit(next);return{ok:true,status:'archived',insightId:id};}
        const candidate=notificationTime(current,next.preferences.localTime,next.preferences.quietHours);
        if(!candidate||candidate.getTime()>=Date.parse(insight.expiresAt)){commit(next);return{ok:true,status:'archived',insightId:id};}
        if(!await permission()){commit(next);return fail('permission-denied');}
        if(next.dispatches.length>=14){commit(next);return fail('dispatch-limit');}
        const entry=entryFor(next,'ai',candidate,id);next.dispatches.push(entry);
        const outcome=await schedule(next,entry);return{...outcome,insightId:id};
      });
    },
    offerUpdate(value){if(!supported)return Promise.resolve(fail('native-unavailable'));return locked(()=>offerUpdateInside(value||{}));},
    listInsights(){return locked(async()=>{const result=read();await reconcile(result);return{ok:true,insights:clone(state.insights).reverse()};});},
    openInsight(id){return locked(async()=>{const result=read();await reconcile(result);const insight=state.insights.find(item=>item.id===id);return insight?{ok:true,insight:clone(insight)}:fail('insight-unavailable');});}
  };
  return Object.freeze(api);
}
