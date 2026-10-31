import { normalizeStation } from './radio-directory.mjs';
const MIME={MP3:'audio/mpeg',AAC:'audio/aac','AAC+':'audio/aac'};
function stationDto(value){
 if(!value||typeof value.hls!=='boolean'||!Array.isArray(value.languages)||!Array.isArray(value.genres)||!value.languages.every(x=>typeof x==='string')||!value.genres.every(x=>typeof x==='string'))return null;
 return normalizeStation({stationuuid:value.id,name:value.name,url_resolved:value.streamUrl,countrycode:value.countryCode,language:value.languages.join(','),tags:value.genres.join(','),codec:value.codec,hls:Number(value.hls),lastcheckok:Number(value.lastCheckOk===true)});
}
// One owner/active session. Replacing a source first unloads the old element;
// per-session elements make delayed old media events harmless.
export function createRadioPlayer({audioFactory=()=>new globalThis.Audio(),setTimer=globalThis.setTimeout,clearTimer=globalThis.clearTimeout,timeoutMs=20000}={}){
 if(typeof audioFactory!=='function'||!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw new TypeError('invalid-player-configuration');
 let current=null,state=Object.freeze({status:'idle',station:null,error:null});const listeners=new Set();
 function emit(status,error=null,station=state.station){state=Object.freeze({status,error,station});for(const fn of listeners){try{fn(state);}catch{}}}
 function unload(){const previous=current;current=null;if(!previous)return;clearTimer(previous.timer);for(const [name,fn]of previous.events)previous.audio.removeEventListener(name,fn);try{previous.audio.pause();previous.audio.removeAttribute('src');previous.audio.load();}catch{}}
 function fail(session,error){if(current!==session)return;unload();emit('error',error);}
 function arm(session){clearTimer(session.timer);session.timer=setTimer(()=>fail(session,'connection-timeout'),timeoutMs);}
 function stop(){unload();emit(state.station?'stopped':'idle');return{ok:true,status:state.status};}
 function pause(){
  if(!current)return stop();const session=current;session.attempt++;clearTimer(session.timer);emit('paused');
  try{session.audio.pause();return{ok:true,status:'paused'};}catch{fail(session,'playback-error');return{ok:false,error:'playback-error'};}
 }
 function attemptPlay(session){
  const attempt=++session.attempt;
  const result=session.audio.play();
  Promise.resolve(result).catch(error=>{if(current===session&&attempt===session.attempt)fail(session,error?.name==='NotAllowedError'?'play-blocked':'playback-error');});
 }
 function resume({userConfirmed=false}={}){
  if(userConfirmed!==true)return{ok:false,error:'play-consent-required'};
  if(!current||state.status!=='paused')return{ok:false,error:'no-paused-session'};
  const session=current;emit('loading');arm(session);
  try{attemptPlay(session);return{ok:true,status:'loading'};}catch{fail(session,'playback-error');return{ok:false,error:'playback-error'};}
 }
 function play(input,{userConfirmed=false}={}){
  if(userConfirmed!==true)return{ok:false,error:'play-consent-required'};
  const station=stationDto(input);if(!station)return{ok:false,error:'invalid-station'};
  if(current&&current.station.id===station.id&&current.station.streamUrl===station.streamUrl)return state.status==='paused'?resume({userConfirmed:true}):{ok:true,status:'already-active'};
  unload();const visible=Object.freeze({id:station.id,name:station.name,codec:station.codec,hls:station.hls});
  let audio;
  try{audio=audioFactory();}catch{emit('error','audio-unavailable',visible);return{ok:false,error:'audio-unavailable'};}
  const session={audio,station,events:[],timer:null,attempt:0};current=session;
  const on=(name,fn)=>{const guarded=()=>{if(current===session)fn();};session.events.push([name,guarded]);audio.addEventListener(name,guarded);};
  try{
   const hls=station.hls||new URL(station.streamUrl).pathname.toLowerCase().endsWith('.m3u8');
   const mime=hls?'application/vnd.apple.mpegurl':MIME[station.codec];
   if(!mime||!audio.canPlayType(mime)){unload();emit('error','unsupported-format',visible);return{ok:false,error:'unsupported-format'};}
   audio.preload='none';audio.autoplay=false;audio.loop=false;
   // The first slice requires CORS-enabled streams rather than sending ambient
   // cross-origin credentials. No proxy, recording or Web Audio workaround.
   audio.crossOrigin='anonymous';
   on('playing',()=>{if(state.status==='paused')return;clearTimer(session.timer);emit('playing');});
   for(const name of ['waiting','stalled'])on(name,()=>{if(state.status!=='paused'&&state.status!=='buffering'){emit('buffering');arm(session);}});
   on('pause',()=>{if(state.status==='paused'||audio.paused===false)return;unload();emit('stopped');});
   on('ended',()=>{unload();emit('ended');});
   on('error',()=>fail(session,({1:'interrupted',2:'network-error',3:'decode-error',4:'source-unavailable'})[audio.error?.code]||'playback-error'));
   emit('loading',null,visible);arm(session);audio.src=station.streamUrl;audio.load();
   if(current!==session)return{ok:false,error:state.error||'interrupted'};
   attemptPlay(session);
   return{ok:true,status:'loading'};
  }catch{fail(session,'playback-error');return{ok:false,error:'playback-error'};}
 }
 return Object.freeze({play,pause,resume,stop,getState:()=>state,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}});
}
let shared;
export function getRadioPlayer(){return shared??=createRadioPlayer();}
