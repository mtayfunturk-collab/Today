// Directory metadata only: no audio, persistence, analytics or startup requests.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function text(value,max){return typeof value==='string' && value.length<=max && !/[\u0000-\u001f\u007f]/.test(value)?value.trim():null;}
export function safeStreamUrl(value){
  if(typeof value!=='string'||value.length>2048||value!==value.trim()||/[\u0000-\u0020\u007f\\]/.test(value))return null;
  try{
    const u=new URL(value),h=u.hostname.toLowerCase();
    // All literal IPs are excluded; this does not prove DNS/redirect safety.
    if(u.protocol!=='https:'||u.username||u.password||u.hash||h.includes(':')||/^\d+(\.\d+)*$/.test(h)||!/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(h)||/\.(local|localhost|internal|lan|home|arpa|onion)$/.test(h))return null;
    return u.href;
  }catch{return null;}
}
export function normalizeStation(row){
  if(!row||typeof row!=='object'||Array.isArray(row)||!UUID.test(row.stationuuid))return null;
  const name=text(row.name,160),url=safeStreamUrl(row.url_resolved),country=text(row.countrycode,2),language=text(row.language??'',160),tags=text(row.tags??'',256),codec=text(row.codec??'UNKNOWN',24);
  if(!name||!url||!country||! /^[A-Z]{2}$/.test(country)||language===null||tags===null||!codec||![0,1].includes(row.hls)||![0,1].includes(row.lastcheckok))return null;
  const split=(value,max)=>Object.freeze([...new Set(value.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean))].slice(0,max));
  return Object.freeze({id:row.stationuuid.toLowerCase(),name,streamUrl:url,countryCode:country,languages:split(language,8),genres:split(tags,16),codec:codec.toUpperCase(),hls:row.hls===1,lastCheckOk:row.lastcheckok===1,source:'radio-browser'});
}
function serverUrl(value){
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&u.pathname==='/'&&!u.search&&!u.hash&&/^[a-z0-9-]+\.api\.radio-browser\.info$/.test(u.hostname)?u.origin:null;}catch{return null;}
}
export function createRadioDirectory({fetcher=globalThis.fetch,servers=[],timeoutMs=8000}={}){
  const mirrors=[...new Set(servers.map(serverUrl))];
  if(!mirrors.length||mirrors.includes(null)||mirrors.length>3||typeof fetcher!=='function'||!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw new TypeError('invalid-directory-configuration');
  let active=null,epoch=0;
  function cancel(){epoch++;active?.abort();active=null;}
  async function search({userConfirmed=false,query='',countryCode='',language='',genre='',offset=0,limit=30}={}){
    cancel();const revision=epoch;
    if(userConfirmed!==true)return {ok:false,error:'directory-consent-required'};
    const q=text(query,80),lang=text(language,40),tag=text(genre,40);
    if(q===null||lang===null||tag===null||typeof countryCode!=='string'||(countryCode!==''&&!/^[A-Z]{2}$/.test(countryCode))||!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0||offset>10000)return {ok:false,error:'invalid-search'};
    const controller=new AbortController();active=controller;let timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
    const params=new URLSearchParams({hidebroken:'true',limit:String(limit),offset:String(offset)});
    for(const [key,value]of Object.entries({name:q,countrycode:countryCode,language:lang,tag}))if(value)params.set(key,value);
    // Race the entire body operation as well, even if a mock/server ignores abort.
    let onAbort;
    const aborted=new Promise((_,reject)=>{onAbort=()=>reject(new Error('aborted'));controller.signal.addEventListener('abort',onAbort,{once:true});});
    try{
      for(const mirror of mirrors){
        try{
          const operation=(async()=>{
            const response=await fetcher(`${mirror}/json/stations/search?${params}`,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',redirect:'error',headers:{Accept:'application/json'}});
            if(!response.ok)throw new Error('http');
            const mime=response.headers.get('content-type')||'';
            if(!/^application\/json\b/i.test(mime))throw new Error('payload');
            // Bound streamed responses before JSON parsing (Content-Length is optional).
            const reader=response.body?.getReader();if(!reader)throw new Error('payload');
            const chunks=[];let size=0;
            try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>524288)throw new Error('payload');chunks.push(value);}}
            catch(error){await reader.cancel().catch(()=>{});throw error;}
            const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.byteLength;}
            const rows=JSON.parse(new TextDecoder().decode(bytes));if(!Array.isArray(rows)||rows.length>limit)throw new Error('payload');
            return rows;
          })();
          const rows=await Promise.race([operation,aborted]);
          if(revision!==epoch||controller.signal.aborted)return {ok:false,error:timedOut?'directory-timeout':'cancelled'};
          const stations=[],ids=new Set();let rejected=0;
          for(const row of rows){const station=normalizeStation(row);if(!station||ids.has(station.id)){rejected++;continue;}ids.add(station.id);stations.push(station);}
          return {ok:true,stations:Object.freeze(stations),rejected,received:rows.length,hasMore:rows.length===limit};
        }catch{if(controller.signal.aborted)return {ok:false,error:timedOut?'directory-timeout':'cancelled'};}
      }
      return {ok:false,error:'directory-unavailable'};
    }finally{clearTimeout(timer);controller.signal.removeEventListener('abort',onAbort);if(active===controller)active=null;}
  }
  return Object.freeze({search,cancel});
}
