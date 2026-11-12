/** Restore-only shape/integrity checks. Never calculates or resolves a location. */
import {parseBackupJSON} from './backup-export.mjs';
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const str=v=>typeof v==='string';
const nonempty=v=>str(v)&&v.trim().length>0;
const num=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const day=v=>str(v)&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const time=v=>str(v)&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v);
const stamp=v=>str(v)&&/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(v)&&day(v.slice(0,10))&&Number.isFinite(Date.parse(v));
function need(ok){if(!ok){const e=new Error('invalid-sky-data');e.code='invalid-sky-data';throw e;}}
function zone(v){try{return nonempty(v)&&Boolean(new Intl.DateTimeFormat('en',{timeZone:v}));}catch{return false;}}
function place(v,{manual=false}={}){
  need(obj(v)&&nonempty(v.label));
  if(manual&&v.source==='manual'){
    for(const k of ['geonameId','name','countryCode','admin1Code','latitude','longitude','population','timezoneId','catalogVersion','resolvedAt'])need(v[k]===null);
    return false;
  }
  need(v.source==='geonames'&&Number.isInteger(v.geonameId)&&v.geonameId>0&&num(v.latitude,-90,90)&&num(v.longitude,-180,180)&&zone(v.timezoneId)&&nonempty(v.catalogVersion));
  return true;
}
function profile(v){
  need(obj(v)&&v.contractVersion===1&&day(v.birthDate)&&['exact','approximate','unknown'].includes(v.timePrecision));
  need(v.timePrecision==='unknown'?v.birthTime===null:time(v.birthTime));
  const resolved=place(v.birthPlace,{manual:true});
  need(stamp(v.createdAt)&&stamp(v.updatedAt));
  need(v.timeDisambiguation===null||(resolved&&v.timePrecision!=='unknown'&&['earlier','later'].includes(v.timeDisambiguation)));
}
const BODY_IDS=['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'];
// Supported stored contract (App 2.20.2 / Core-Sky v1), not an ephemeris.
// Tests check these enum/rule constraints against the existing calculation API.
const SIGN_IDS=['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];
const ASPECT_RULES={conjunction:[0,8],sextile:[60,4],square:[90,6],trine:[120,6],opposition:[180,8]};
// Absolute degrees; serialization must not turn rounding noise into a repair.
const near=(a,b)=>Math.abs(a-b)<=1e-9;
function position(v){
  need(obj(v)&&num(v.longitude,0,360)&&v.longitude<360&&Number.isInteger(v.signIndex)&&num(v.signIndex,0,11)&&num(v.degreeInSign,0,30)&&v.degreeInSign<30&&['signId','sign','signSymbol'].every(k=>str(v[k])));
  need(v.signIndex===Math.floor(v.longitude/30)&&v.signId===SIGN_IDS[v.signIndex]&&near(v.degreeInSign,v.longitude-v.signIndex*30));
}
function aspects(values,planets){
  need(Array.isArray(values)&&values.length<=5);
  const bodies=new Map(planets.map(p=>[p.id,p])),seen=new Set();
  for(const a of values){
    need(obj(a)&&str(a.type)&&Object.hasOwn(ASPECT_RULES,a.type)&&str(a.id)&&str(a.label)&&num(a.exactAngle,0,180)&&num(a.separation,0,180)&&num(a.orb,0,180)&&num(a.orbLimit,0,180));
    need(obj(a.left)&&obj(a.right));
    const left=bodies.get(a.left.id),right=bodies.get(a.right.id);
    need(left&&right&&left.id!==right.id&&a.left.label===left.label&&a.left.symbol===left.symbol&&a.right.label===right.label&&a.right.symbol===right.symbol);
    need(a.id===`${left.id}:${a.type}:${right.id}`);
    const pair=[left.id,right.id].sort().join(':')+':'+a.type;
    need(!seen.has(pair));seen.add(pair);
    const [angle,limit]=ASPECT_RULES[a.type],difference=Math.abs(left.longitude-right.longitude),separation=Math.min(difference,360-difference);
    need(a.exactAngle===angle&&a.orbLimit===limit&&near(a.separation,separation)&&near(a.orb,Math.abs(a.separation-angle))&&a.orb<=limit);
  }
}
function link(v,key){
  need(obj(v)&&v.contractVersion===1&&v.dateKey===key&&day(key)&&stamp(v.linkedAt)&&v.linkMode==='user_initiated_snapshot');place(v.place);
  const s=v.sky;need(obj(s)&&stamp(s.instant)&&obj(s.clock)&&day(s.clock.localDateKey)&&str(s.clock.localTime)&&/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(s.clock.localTime)&&zone(s.clock.timezoneId));
  need(obj(s.angles));for(const a of ['ascendant','midheaven'])if(s.angles[a]!==null)position(s.angles[a]);
  const noAngles=s.angles.ascendant===null&&s.angles.midheaven===null;
  need(noAngles||(s.angles.ascendant!==null&&s.angles.midheaven!==null));
  need(Array.isArray(s.planets)&&s.planets.length===10&&new Set(s.planets.map(p=>p?.id)).size===10&&BODY_IDS.every(id=>s.planets.some(p=>p?.id===id)));
  // The current writer serializes an unavailable house as Number(null) = 0.
  // Preserve that existing sentinel; never invent houses or fallback systems.
  for(const p of s.planets){position(p);need(str(p.label)&&str(p.symbol)&&(noAngles?(p.house===null||p.house===0):(p.house===null||(Number.isInteger(p.house)&&num(p.house,1,12)))));}
  need(Array.isArray(s.primaryBodyIds)&&s.primaryBodyIds.join('|')==='sun|moon|mercury|venus|mars');
  aspects(s.aspects,s.planets);
  need(obj(v.metadata)&&v.metadata.interpretation==='none'&&v.metadata.causalityClaim===false&&v.metadata.aiProcessed===false);
  for(const k of ['rulesetId','sourceRulesetId','engineId','engineVersion','houseSystem','zodiac'])need(nonempty(v.metadata[k]));
}
export function validateSkyStore(store){
  need(obj(store));let profiles=0,contexts=0,links=0;
  if(Object.hasOwn(store,'sky')){
    need(obj(store.sky));const s=store.sky;
    if(Object.hasOwn(s,'profileContractVersion'))need(s.profileContractVersion===1);
    if(Object.hasOwn(s,'observationContextContractVersion'))need(s.observationContextContractVersion===1);
    if(s.birthProfile!==undefined&&s.birthProfile!==null){profile(s.birthProfile);profiles++;}
    if(s.observationContext!==undefined&&s.observationContext!==null){
      const c=s.observationContext;need(obj(c)&&c.contractVersion===1&&['city_search','birth_place'].includes(c.selectedBy)&&stamp(c.createdAt)&&stamp(c.updatedAt));place(c.place);contexts++;
    }
    if(Object.hasOwn(s,'updatedAt'))need(stamp(s.updatedAt));
  }
  if(obj(store.days))for(const [key,value]of Object.entries(store.days))if(obj(value)&&value.coreSkyLink!==undefined&&value.coreSkyLink!==null){link(value.coreSkyLink,key);links++;}
  return Object.freeze({profiles,contexts,links,astronomicalRecalculation:false});
}
export function validateSkyEntries(entries){
  for(const entry of entries)if(['today_store_v2','today_store_v2_backup','today_app_v10'].includes(entry.key)&&entry.present){
    let value;try{value=parseBackupJSON(entry.rawValue);}catch{need(false);}
    // Historical Core recovery schemas remain raw; their active conversion is a separate gate.
    if(entry.key==='today_store_v2_backup'&&(value.schemaVersion??0)<2)continue;
    validateSkyStore(value);
  }
}
