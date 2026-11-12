const {test,expect}=require('@playwright/test');
const {randomBytes}=require('node:crypto');
const fs=require('node:fs');
async function open(page,context,missing=false){
 await context.addInitScript(()=>Object.defineProperty(navigator,'serviceWorker',{value:undefined}));
 if(missing)await context.route('**/modules/locales/core-tr.mjs',r=>r.abort('failed'));
 else await context.route('**/modules/locales/core-tr.mjs',async route=>{const response=await route.fetch();let body=await response.text();for(const [key,value]of Object.entries({'core.choice.b.title':'Fixture <b>choice</b> {count}$&','color.mint':'Fixture <i>mint</i> {color}$&'})){const re=new RegExp('("'+key.replaceAll('.','\\.')+'": )"[^"]+"');body=body.replace(re,(_,prefix)=>prefix+JSON.stringify(value));}await route.fulfill({response,body});});
 await page.goto(`/runs/${randomBytes(12).toString('hex')}/index.html`);
 await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');
 if(!missing)await expect.poll(()=>page.evaluate(()=>Boolean(window.TodayCoreLabels))).toBe(true);
 const notice=page.locator('#todayErrorNotice');if(await notice.isVisible()){await expect(page.locator('#todayErrorNoticeCode')).toHaveText('Hata kodu: TODAY-RUNTIME-003');await notice.getByRole('button',{name:'Kapat',exact:true}).click();}
 await page.locator('#btnStart').click();await page.locator('[data-choice="B"]').click();await page.locator('[data-color="mint"]').click();await page.locator('#note').fill('PRIVATE-SYNTHETIC-CORE-LABEL-NOTE');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('today_store_v2')).days[TodayDay.todayKey()]?.note)).toBe('PRIVATE-SYNTHETIC-CORE-LABEL-NOTE');
}
async function record(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('today_store_v2')).days[TodayDay.todayKey()]);}
async function verify(page,choice,color){
 const before=await record(page);const key=await page.evaluate(()=>TodayDay.todayKey());
 await page.locator('#btnCalendar').click();const today=page.locator('#calGrid [aria-current="date"]');
 const aria=await today.getAttribute('aria-label');expect(aria).toContain(choice);expect(aria).toContain('renk '+color);expect(aria).toContain('not var');expect(aria).not.toContain('PRIVATE-SYNTHETIC-CORE-LABEL-NOTE');
 await expect(today).toHaveAttribute('aria-disabled','false');await expect(page.locator('#calGrid [aria-disabled="false"]')).toHaveCount(1);
 await page.locator('#btnStats').click();await expect(page.locator('#summaryText')).toHaveText('Son 7 günde en çok: “'+choice+'” (1 kez)');await expect(page.locator('#summaryText b')).toHaveCount(0);
 const event=page.waitForEvent('download');await page.evaluate(()=>document.querySelector('#btnExport').click());const download=await event;expect(download.suggestedFilename()).toBe('today-rapor-'+key+'.csv');
 const csv=fs.readFileSync(await download.path(),'utf8');expect(csv).toBe('Tarih;Seçim;Renk;Not\n'+key+';Her şey çok net;Nane;PRIVATE-SYNTHETIC-CORE-LABEL-NOTE');expect(await record(page)).toEqual(before);
 await page.locator('#btnBackToPick').click();await expect(page.locator('#note')).toHaveValue('PRIVATE-SYNTHETIC-CORE-LABEL-NOTE');await expect(page.locator('[data-choice="B"]')).toHaveAttribute('aria-checked','true');await expect(page.locator('[data-color="mint"]')).toHaveAttribute('aria-pressed','true');
}
test('Real dictionary labels change calendar and summary only; literal text, IDs, notes and real CSV are preserved',async({page,context})=>{
 await open(page,context);await verify(page,'Fixture <b>choice</b> {count}$&','Fixture <i>mint</i> {color}$&');
 expect(await page.evaluate(()=>Object.isFrozen(TodayCoreLabels)&&Object.isFrozen(TodayCoreLabels.choices)&&Object.isFrozen(TodayCoreLabels.colors))).toBe(true);
});
test('Missing dictionary preserves TR calendar/summary labels, Core actions and the same CSV contract',async({page,context})=>{
 await open(page,context,true);await verify(page,'Her şey çok net','Nane');
 expect(await page.evaluate(()=>typeof window.TodayCoreLabels)).toBe('undefined');
});
