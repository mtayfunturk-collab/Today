'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const entry=fs.readFileSync('modules/core-static-copy-ui.mjs','utf8').replace(/^import .*;\n/gm,'');
const copy=JSON.parse(fs.readFileSync('modules/locales/core-tr.mjs','utf8').split('Object.freeze(')[1].split(');')[0]);
function setup(){const c={window:{},document:{},CORE_TR:copy,applyCoreStaticCopy(){},Date,console:{info(){}}};vm.runInNewContext(entry,c);return c;}
const provider=setup().window.TodayStatisticsCopy;
let pass=0,fail=0;function test(name,fn){try{fn();pass++;console.log('PASS: '+name);}catch(e){fail++;console.log('FAIL: '+name+' '+e.message);}}
test('Summary uses supplied label and integer count without changing singular or plural',()=>{for(const n of [1,2,7])assert.equal(provider.summary('Her şey çok net',n),`Son 7 günde en çok: “Her şey çok net” (${n} kez)`);});
test('Empty summary matches the existing empty branch',()=>assert.equal(provider.empty,'Son 7 günde seçim yok.'));
test('Invalid counts or labels return null rather than inventing a valid result',()=>{for(const n of [-1,0,1.5,NaN,Infinity,'1'])assert.equal(provider.summary('A',n),null);assert.equal(provider.summary(null,1),null);for(const n of [-1,NaN,1.5,'0'])assert.equal(provider.chartSummary('t',n),null);});
test('Chart accessibility preserves zero and positive totals exactly',()=>{for(const n of [0,1,1000])assert.equal(provider.chartSummary('Son 7 gün ivmesi',n),`Son 7 gün ivmesi. Dönem sonundaki birikimli giriş sayısı: ${n}.`);});
test('Provider and four title values are readonly and retain an existing owner',()=>{assert.ok(Object.isFrozen(provider)&&Object.isFrozen(provider.titles));assert.deepEqual(Object.keys(provider.titles),['hour','day','week','month']);const c=setup();assert.equal(Object.getOwnPropertyDescriptor(c.window,'TodayStatisticsCopy').writable,false);const other={window:{TodayStatisticsCopy:provider},document:{},CORE_TR:copy,applyCoreStaticCopy(){},Date};vm.runInNewContext(entry,other);assert.equal(other.window.TodayStatisticsCopy,provider);});
test('Template parameters are literal including markup and placeholder-like text',()=>{assert.equal(provider.summary('<img>{count}$&',1),'Son 7 günde en çok: “<img>{count}$&” (1 kez)');assert.equal(provider.chartSummary('{total}',3),'{total}. Dönem sonundaki birikimli giriş sayısı: 3.');});
const helper=html.slice(html.indexOf('  const statisticsText ='),html.indexOf('  const renderSummary ='));
const labels=html.slice(html.indexOf('  const choiceLabelTR ='),html.indexOf('  const colorLabelTR ='));
const summary=html.match(/  const renderSummary = \(\) => \{[\s\S]*?\n  \};/)[0];
test('Actual seven-day summary retains empty single boundary and tie results with and without copy',()=>{
 const cases=[ [{},'Son 7 günde seçim yok.'],[{'2026-11-12':{choice:'B'}},'Son 7 günde en çok: “Her şey çok net” (1 kez)'],[{'2026-11-06':{choice:'A'},'2026-11-05':{choice:'B'}},'Son 7 günde en çok: “Bir şey oldu ama adı yok” (1 kez)'],[{'2026-11-12':{choice:'B'},'2026-11-11':{choice:'A'},'2026-11-10':{choice:'A'},'2026-11-09':{choice:'B'}},'Son 7 günde en çok: “Her şey çok net” (2 kez)'] ];
 for(const ready of [false,true])for(const[days,expected]of cases){const c=setup();vm.runInNewContext(fs.readFileSync('modules/day-manager.js','utf8'),c);const out={};const state={days};const before=JSON.stringify(state);const ctx={window:{TodayStatisticsCopy:ready?provider:undefined},Date,state,todayKey:()=> '2026-11-12',parseKey:c.window.TodayDay.parseKey,pad2:c.window.TodayDay.pad2,$:()=>out};vm.runInNewContext(helper+labels+summary+'\nrenderSummary();',ctx);assert.equal(out.textContent,expected);assert.equal(JSON.stringify(state),before);}
});
test('Actual chart renderer selects one existing series and displays its unmodified final value',()=>{
 const source=html.match(/  const renderChart = \(mode\) => \{[\s\S]*?\n  \};/)[0];
 for(const ready of [false,true])for(const mode of ['hour','day','week','month']){const nodes={};const get=s=>nodes[s]??=( {textContent:'',setAttribute(){}} );const calls=[];const arr=[0,2,5];let seen;
 const c={window:{TodayStatisticsCopy:ready?provider:undefined},currentMode:'hour',todayKey:()=> '2026-11-12',dayObj:()=>({}),$:get,$$:()=>[],colorHex:()=>'',toPath:a=>{seen=a;return{line:'line',area:'area'};},animatePath(){}};
 for(const [m,name]of Object.entries({hour:'seriesHour',day:'seriesDay',week:'seriesWeek',month:'seriesMonth'}))c[name]=()=>{calls.push(m);return arr;};
 vm.runInNewContext(helper+source+`\nrenderChart('${mode}');`,c);assert.deepEqual(calls,[mode]);assert.equal(seen,arr);assert.deepEqual(arr,[0,2,5]);assert.equal(get('#chartLabel').textContent,copy['statistics.'+mode]);assert.equal(get('#chartSummary').textContent,copy['statistics.'+mode]+'. Dönem sonundaki birikimli giriş sayısı: 5.');}
});
console.log(`Statistics Copy: ${pass}/${pass+fail} başarılı`);if(fail)process.exitCode=1;
