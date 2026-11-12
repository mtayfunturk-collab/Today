'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');
function between(start, end) { const a=html.indexOf(start); const b=html.indexOf(end,a); assert.ok(a>=0&&b>a); return html.slice(a,b); }
const helper = html.includes('  const trySaveCoreChange =') ? between('  const trySaveCoreChange =','  // seçim\n') : '';
const blocks = {
 choice:between('  // seçim\n','  // seçimler: Enter/Boşluk'),
 color:between('  // renk (opsiyonel)\n','  // Capture the input text'),
 reset:between('  // bugünü sıfırla (sadece bugün)','  /* =========================\n     10) Calendar screen')
};
const success = {choice:'Kaydedildi.',color:'Renk kaydedildi.',reset:'Bugün temizlendi.'};
const failure = 'Değişiklik tam kaydedilemedi. Tekrar deneyebilirsin.';
let passed=0, failed=0;
for (const ready of [false,true]) for (const [flow,source] of Object.entries(blocks)) for (const outcome of ['success','false','partial','throw']) {
 try {
  const handlers={}, messages=[], reports=[]; let saves=0;
  const control={dataset:{choice:'B',color:'mint'},addEventListener(name,callback){handlers[name]=callback;}};
  const state={days:{'2026-11-11':{choice:'A',color:'blue',note:'Sentetik eski not'}}};
  const noop=()=>{};
  const messagesCopy={'core.saved':'Sentetik seçim','core.colorSaved':'Sentetik renk','core.todayCleared':'Sentetik reset','core.changeFailed':'Sentetik hata'};
  const context={window:ready?{TodayCoreMessages:Object.freeze(messagesCopy)}:{},state,pendingNotes:new Map(),currentMode:'hour',$:()=>control,$$:()=>[control],todayKey:()=> '2026-11-11',canEditDate:()=>true,dayObj:key=>state.days[key],
   save(){saves++;if(outcome==='throw')throw new Error('Synthetic write exception');return {success:outcome==='success',storageSaved:outcome==='partial',legacyBackupSaved:false};},
   reportError:(...args)=>reports.push(args),flash:(el,message)=>messages.push(message),clearTimeout:noop,logChange:noop,applyAccentFor:noop,syncChoiceControls:noop,syncColorControls:noop,renderCalendar:noop,renderSummary:noop,renderChart:noop,loadPickUI:noop};
  vm.runInNewContext('"use strict";\n'+helper+source,context);handlers.click();
  assert.equal(saves,1);assert.deepEqual(messages,[ready ? (outcome==='success'?messagesCopy[{choice:'core.saved',color:'core.colorSaved',reset:'core.todayCleared'}[flow]]:messagesCopy['core.changeFailed']) : (outcome==='success'?success[flow]:failure)]);
  assert.equal(reports.length,outcome==='throw'?1:0);
  if(outcome==='throw')assert.equal(reports[0][1].errorCode,'TODAY-STATE-001');
  passed++;console.log(`PASS: ${ready?"ready":"fallback"}/${flow}/${outcome}`);
 }catch(error){failed++;console.log(`FAIL: ${ready?"ready":"fallback"}/${flow}/${outcome}: ${error.message}`);}
}
console.log(`Core Save Status: ${passed}/${passed+failed} başarılı`);
if(failed)process.exitCode=1;
