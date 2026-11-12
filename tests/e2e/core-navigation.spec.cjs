const { test, expect } = require('@playwright/test');
const { randomBytes } = require('node:crypto');
async function open(page) {
  await page.goto(`/runs/${randomBytes(12).toString('hex')}/index.html`);
  await expect.poll(() => page.evaluate(() => window.TodayStartup?.getStatus().phase)).toBe('ready');
  await expect.poll(() => page.evaluate(() => window.TodaySkyHub?.getState().initialized)).toBe(true);
}
async function route(page, name) {
  await expect.poll(() => page.evaluate(() => TodayRouter.getState().route)).toBe(name);
  await expect(page.locator(`[data-view="${['settings','statistics'].includes(name)?'calendar':name}"]`)).toHaveAttribute('aria-hidden','false');
}
async function note(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('today_store_v2'))?.days?.[TodayDay.todayKey()]?.note || '');
}
test('Start opens Core and grid preserves real Back Forward and explicit Core return', async ({page}) => {
  await open(page);await route(page,'home');
  await page.locator('#btnStart').click();await route(page,'pick');
  await expect(page.getByRole('button',{name:'Modülleri aç',exact:true})).toBeVisible();
  await expect(page.locator('#coreModulesHint')).toBeVisible();
  await page.locator('#btnHomeFromPick').click();await route(page,'modules');
  await page.locator('#btnCoreFromModules').click();await route(page,'pick');
  await page.goForward();await route(page,'modules');
  await page.locator('#btnModuleCore').click();await route(page,'pick');
  await page.goBack();await route(page,'modules');
  await page.goBack();await route(page,'pick');
  await page.goBack();await route(page,'home');
  await page.goForward();await route(page,'pick');
  await page.locator('#btnCalendar').click();await route(page,'calendar');
  await page.evaluate(()=>TodayRouter.navigate('settings'));await route(page,'settings');
  await page.goBack();await route(page,'calendar');await page.goBack();await route(page,'pick');
});
test('Missing history falls back from modules to Core and from Core to Home', async ({page}) => {
  await open(page);
  await page.evaluate(()=>TodayRouter.navigate('modules',{replace:true}));
  const index=await page.evaluate(()=>TodayRouter.getState().historyIndex);
  await page.locator('#btnCoreFromModules').click();await route(page,'pick');
  expect(await page.evaluate(()=>TodayRouter.getState().historyIndex)).toBe(index);
  await page.evaluate(()=>TodayRouter.back());await route(page,'home');
  await page.evaluate(()=>TodayRouter.navigate('modules',{replace:true}));
  await page.evaluate(()=>TodayRouter.back());await route(page,'pick');
});
test('Saved and pending notes survive leaving Core at 0 100 and 500 ms', async ({page}) => {
  await open(page);await page.locator('#btnStart').click();
  const keys=await page.evaluate(()=>Object.keys(localStorage).sort());
  for(const delay of [0,100,500]) {
    const value=`Sentetik NAV01 ayrılma ${delay}`;
    await page.locator('#note').fill(value);
    await page.evaluate(async delay=>{if(delay)await new Promise(r=>setTimeout(r,delay));document.querySelector('#btnHomeFromPick').click();},delay);
    await route(page,'modules');await expect.poll(()=>note(page)).toBe(value);
    await page.locator('#btnCoreFromModules').click();await route(page,'pick');
    await expect(page.locator('#note')).toHaveValue(value);
  }
  expect(await page.evaluate(()=>Object.keys(localStorage).sort())).toEqual(keys);
  const saved=await note(page);await page.reload();await expect.poll(()=>note(page)).toBe(saved);
});
test('Core note survives immediate module round trip before its save timer fires', async ({page}) => {
  await open(page);await page.locator('#btnStart').click();
  // Hold the existing debounce pending while exercising actual visible controls.
  await page.clock.install({time:new Date('2026-11-10T12:00:00Z')});
  await page.clock.pauseAt(new Date('2026-11-10T12:00:01Z'));
  await page.locator('#note').fill('Sentetik hızlı dönüşte korunacak not');
  await page.locator('#btnHomeFromPick').click();
  await route(page,'modules');
  await page.locator('#btnModuleCore').click();
  await route(page,'pick');
  await page.clock.runFor(500);
  await expect.poll(()=>note(page)).toBe('Sentetik hızlı dönüşte korunacak not');
});
test('Core module hint and return control fit narrow large text layouts', async ({page},info) => {
  await page.setViewportSize({width:320,height:640});await open(page);await page.locator('#btnStart').click();
  await page.evaluate(()=>document.documentElement.style.fontSize='200%');
  const grid=page.getByRole('button',{name:'Modülleri aç',exact:true});await grid.focus();await expect(grid).toBeFocused();
  for(const selector of ['#coreModulesHint','#btnHomeFromPick']) {
    const m=await page.locator(selector).evaluate(e=>({scroll:e.scrollWidth,client:e.clientWidth,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,viewport:innerWidth}));
    expect(m.scroll).toBeLessThanOrEqual(m.client+1);expect(m.left).toBeGreaterThanOrEqual(0);expect(m.right).toBeLessThanOrEqual(m.viewport);
  }
  await page.screenshot({path:info.outputPath('core-grid-large.png'),fullPage:true});
  await grid.click();await route(page,'modules');
  const back=page.getByRole('button',{name:'Core’a dön',exact:true});await expect(back).toBeVisible();
  expect(await back.evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await page.screenshot({path:info.outputPath('modules-core-return.png'),fullPage:true});
  await back.click();await route(page,'pick');
});

async function freezeNotes(page, time='2026-11-10T12:00:00Z') {
  await open(page);await page.locator('#btnStart').click();
  await page.clock.install({time:new Date(time)});
  await page.clock.pauseAt(new Date(new Date(time).getTime()+1000));
}
async function storedNotes(page) {
  return page.evaluate(()=>{
    const v2=JSON.parse(localStorage.getItem('today_store_v2'))?.days||{};
    const legacy=JSON.parse(localStorage.getItem('today_app_v10'))?.days||{};
    return {v2,legacy};
  });
}
test('Pending note stays visible on return and latest edit including intentional empty text wins',async({page})=>{
  await freezeNotes(page);
  await page.locator('#note').fill('İlk sentetik taslak');
  await page.locator('#btnHomeFromPick').click();await route(page,'modules');
  await page.locator('#btnCoreFromModules').click();await route(page,'pick');
  await expect(page.locator('#note')).toHaveValue('İlk sentetik taslak');
  await page.locator('#note').fill('Son sentetik taslak 🌸');await page.clock.runFor(500);
  for(const days of Object.values(await storedNotes(page)))expect(days['2026-11-10'].note).toBe('Son sentetik taslak 🌸');
  await page.locator('#note').fill('');
  await page.locator('#btnHomeFromPick').click();await route(page,'modules');
  await page.locator('#btnModuleCore').click();await route(page,'pick');
  await expect(page.locator('#note')).toHaveValue('');await page.clock.runFor(500);
  for(const days of Object.values(await storedNotes(page)))expect(days['2026-11-10'].note).toBe('');
});
test('Notes pending across local midnight keep their original dates and independent timers',async({page})=>{
  await freezeNotes(page,'2026-11-10T20:59:58Z'); // Istanbul: 23:59:59
  await page.locator('[data-choice="B"]').click();
  await page.locator('#note').fill('Dünün son taslağı');
  await page.clock.setSystemTime(new Date('2026-11-10T21:00:01Z'));
  await page.locator('#btnHomeFromPick').click();await route(page,'modules');
  await page.locator('#btnModuleCore').click();await route(page,'pick');
  await expect(page.locator('#note')).toHaveValue('');
  await page.locator('#note').fill('Yeni günün taslağı');
  await page.clock.runFor(500);
  const records=await storedNotes(page);
  for(const days of Object.values(records)){
    expect(days['2026-11-10']).toMatchObject({note:'Dünün son taslağı',choice:'B'});
    expect(days['2026-11-11'].note).toBe('Yeni günün taslağı');
  }
  await expect(page.locator('#note')).toHaveValue('Yeni günün taslağı');
  await page.reload();await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');
  for(const days of Object.values(await storedNotes(page))){expect(days['2026-11-10'].note).toBe('Dünün son taslağı');expect(days['2026-11-11'].note).toBe('Yeni günün taslağı');}
});
test('Existing reset cancels a pending note without resurrecting it',async({page})=>{
  await freezeNotes(page);await page.locator('#note').fill('Sıfırlanacak yapay taslak');
  // Existing reset is intentionally hidden in the UI; exercise its existing handler.
  await page.evaluate(()=>document.querySelector('#btnResetToday').click());
  await page.clock.runFor(500);
  await expect(page.locator('#note')).toHaveValue('');
  for(const days of Object.values(await storedNotes(page)))expect(days['2026-11-10'].note).toBe('');
});
test('Failed note save keeps its in-memory draft without claiming success or changing persisted notes',async({page})=>{
  await freezeNotes(page);await page.locator('#note').fill('Önceki kalıcı not');await page.clock.runFor(500);
  const persisted=await storedNotes(page);
  await page.evaluate(()=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key==='today_store_v2'||key==='today_app_v10')throw new DOMException('Synthetic quota','QuotaExceededError');
      return original.call(this,key,value);
    };
  });
  await page.locator('#note').fill('Kaydı başarısız olan taslak');await page.clock.runFor(500);
  await expect(page.locator('#statusPick')).toContainText('Not kaydedilemedi.');
  expect(await storedNotes(page)).toEqual(persisted);
  await page.locator('#btnHomeFromPick').click();await route(page,'modules');
  await page.locator('#btnModuleCore').click();await route(page,'pick');
  await expect(page.locator('#note')).toHaveValue('Kaydı başarısız olan taslak');
});

for(const flow of ['choice','color','reset'])for(const fault of ['both','canonical','legacy','throw','success']){
 test(`Core ${flow} reports ${fault} write outcome truthfully`,async({page})=>{
  await freezeNotes(page);await page.locator('#note').fill('Sentetik kalıcı önceki not');await page.clock.runFor(500);
  const before=await page.evaluate(()=>Object.fromEntries(['today_store_v2','today_app_v10'].map(k=>[k,localStorage.getItem(k)])));
  await page.evaluate(fault=>{
   const original=Storage.prototype.setItem;
   if(fault==='throw')window.TodayState={...window.TodayState,save(){throw new DOMException('Synthetic write','QuotaExceededError');}};
   else Storage.prototype.setItem=function(key,value){
    if((fault==='both'&&['today_store_v2','today_app_v10'].includes(key))||(fault==='canonical'&&key==='today_store_v2')||(fault==='legacy'&&key==='today_app_v10'))throw new DOMException('Synthetic quota','QuotaExceededError');
    return original.call(this,key,value);
   };
  },fault);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.evaluate(flow=>{
   const selector=flow==='choice'?'[data-choice="B"]':flow==='color'?'[data-color="mint"]':'#btnResetToday';
   document.querySelector(selector).click();
  },flow);
  await page.clock.runFor(30);
  const ok={choice:'Kaydedildi.',color:'Renk kaydedildi.',reset:'Bugün temizlendi.'};
  await expect(page.locator('#statusPick')).toHaveText(fault==='success'?ok[flow]:'Değişiklik tam kaydedilemedi. Tekrar deneyebilirsin.');
  const after=await page.evaluate(()=>Object.fromEntries(['today_store_v2','today_app_v10'].map(k=>[k,localStorage.getItem(k)])));
  if(['both','legacy','throw'].includes(fault))expect(after).toEqual(before);
  if(fault==='canonical')expect(after.today_store_v2).toBe(before.today_store_v2);
  if(fault==='success'){
   for(const raw of Object.values(after)){
    const d=JSON.parse(raw).days['2026-11-10'];
    if(flow==='choice')expect(d.choice).toBe('B');
    if(flow==='color')expect(d.color).toBe('mint');
    if(flow==='reset')expect(d).toMatchObject({choice:'',color:'',note:''});
   }
  }
  expect(errors).toEqual([]);
 });
}
