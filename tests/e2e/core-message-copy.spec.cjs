const {test,expect}=require('@playwright/test');const{randomBytes}=require('node:crypto');
test('Dynamic Core producers use readonly dictionary messages without changing save guards',async({page,context})=>{
 await context.addInitScript(()=>Object.defineProperty(navigator,'serviceWorker',{value:undefined}));
 await context.route('**/modules/locales/core-tr.mjs',async route=>{
  const response=await route.fetch();let text=await response.text();
  for(const [key,value]of Object.entries({'core.saved':'Sentetik seçim','core.colorSaved':'Sentetik renk','core.noteSaved':'Sentetik not','core.noteFailed':'Sentetik not hatası','core.todayCleared':'Sentetik reset','core.changeFailed':'Sentetik hata'}))text=text.replace(new RegExp('"'+key.replaceAll('.','\\.')+'": "[^"]+"'),'"'+key+'": "'+value+'"');
  await route.fulfill({response,body:text});
 });
 await page.goto(`/runs/${randomBytes(12).toString('hex')}/index.html`);
 await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');
 expect(await page.evaluate(()=>({frozen:Object.isFrozen(TodayCoreMessages),keys:Object.keys(TodayCoreMessages).length,writable:Object.getOwnPropertyDescriptor(window,'TodayCoreMessages').writable}))).toEqual({frozen:true,keys:7,writable:false});
 await page.locator('#btnStart').click();await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
 for(const [selector,text]of [['[data-choice="B"]','Sentetik seçim'],['[data-color="mint"]','Sentetik renk']]){await page.locator(selector).click();await page.clock.runFor(30);await expect(page.locator('#statusPick')).toHaveText(text);}
 await page.locator('#note').fill('Sentetik kalıcı not');await page.clock.runFor(500);await expect(page.locator('#statusPick')).toHaveText('Sentetik not');
 await page.evaluate(()=>document.querySelector('#btnResetToday').click());await page.clock.runFor(30);await expect(page.locator('#statusPick')).toHaveText('Sentetik reset');
 await page.evaluate(()=>{window.TodayState={...TodayState,save(){return{success:false};}};});
 await page.locator('[data-choice="A"]').click();await page.clock.runFor(30);await expect(page.locator('#statusPick')).toHaveText('Sentetik hata');
 await page.locator('#note').fill('Sentetik korunacak taslak');await page.clock.runFor(500);await expect(page.locator('#statusPick')).toHaveText('Sentetik not hatası');await expect(page.locator('#note')).toHaveValue('Sentetik korunacak taslak');
});
