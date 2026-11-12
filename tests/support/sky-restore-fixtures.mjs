export function skyFixture(){
  const at='2026-07-01T12:00:00.000Z';
  const place={label:'İstanbul, TR',source:'geonames',geonameId:745044,name:'Istanbul',countryCode:'TR',admin1Code:'34',latitude:41,longitude:29,population:10000000,timezoneId:'Europe/Istanbul',catalogVersion:'fixture-v1'};
  const birthProfile={contractVersion:1,birthDate:'1990-01-01',birthTime:'12:00',timePrecision:'exact',birthPlace:{...place,resolvedAt:at},timeDisambiguation:null,createdAt:at,updatedAt:at};
  const observationContext={contractVersion:1,place:{...place},selectedBy:'city_search',createdAt:at,updatedAt:at};
  const position={longitude:15,signIndex:0,signId:'aries',sign:'Koç',signSymbol:'♈',degreeInSign:15};
  const planets=['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'].map(id=>({...position,id,label:id,symbol:'x',house:null}));
  const coreSkyLink={contractVersion:1,dateKey:'2026-07-01',linkedAt:at,linkMode:'user_initiated_snapshot',place:{...place},sky:{instant:at,clock:{localDateKey:'2026-07-01',localTime:'15:00:00',utcOffset:'+03:00',timezoneId:'Europe/Istanbul'},angles:{ascendant:null,midheaven:null},planets,primaryBodyIds:['sun','moon','mercury','venus','mars'],aspects:[]},metadata:{rulesetId:'test',sourceRulesetId:'test',engineId:'test',engineVersion:'1',houseSystem:'whole-sign',zodiac:'tropical',interpretation:'none',causalityClaim:false,aiProcessed:false}};
  return {sky:{profileContractVersion:1,observationContextContractVersion:1,birthProfile,observationContext,updatedAt:at},coreSkyLink};
}
