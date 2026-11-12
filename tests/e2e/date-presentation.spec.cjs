const {test,expect}=require('@playwright/test');
const {randomBytes}=require('node:crypto');
const fs=require('node:fs');
async function open(page,context,missing){
 await context.addInitScript(()=>Object.defineProperty(navigator,'serviceWorker',{value:undefined}));
 if(missing)await context.route('**/modules/date-presentation.mjs',route=>route.abort('failed'));
 else await context.route('**/modules/date-presentation.mjs',async route=>{const response=await route.fetch();const body=(await response.text()).replace('return Date.prototype.toLocaleDateString.call', () => 'return "Fixture " + kind + " <i>{date}$& " + Date.prototype.toLocaleDateString.call');await route.fulfill({response,body});});
 await page.goto(`/runs/${randomBytes(12).toString('hex')}/index.html`);await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');
 if(!missing)await expect.poll(()=>page.evaluate(()=>Boolean(window.TodayCalendarCopy))).toBe(true);
 const notice=page.locator('#todayErrorNotice');if(await notice.isVisible()){await expect(page.locator('#todayErrorNoticeCode')).toHaveText('Hata kodu: TODAY-RUNTIME-003');await notice.getByRole('button',{name:'Kapat',exact:true}).click();}
 await page.locator('#btnStart').click();await page.locator('[data-choice="B"]').click();await page.locator('[data-color="mint"]').click();await page.locator('#note').fill('PRIVATE-DATE-PRESENTATION-NOTE');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('today_store_v2')).days[TodayDay.todayKey()]?.note)).toBe('PRIVATE-DATE-PRESENTATION-NOTE');
}
async function verify(page,fixture){
 const snapshot=await page.evaluate(()=>({key:TodayDay.todayKey(),record:JSON.parse(localStorage.getItem('today_store_v2')).days[TodayDay.todayKey()],core:TodayDay.prettyTR(TodayDay.todayKey()),month:new Date().toLocaleDateString('tr-TR',{month:'long',year:'numeric'}),day:TodayDay.parseKey(TodayDay.todayKey()).toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}));
 const prefix=kind=>fixture?'Fixture '+kind+' <i>{date}$& ':'';
 await expect(page.locator('#pillDate')).toHaveText(prefix('core')+snapshot.core);await expect(page.locator('#pillDate i')).toHaveCount(0);
 await page.locator('#btnCalendar').click();await expect(page.locator('#monthTitle')).toHaveText(prefix('month')+snapshot.month);const today=page.locator('#calGrid [aria-current="date"]');
 const aria=await today.getAttribute('aria-label');expect(aria).toBe(prefix('day')+snapshot.day+', bugün, Her şey çok net, renk Nane, not var. Düzenlemek için Enter veya Boşluk tuşuna basın');expect(aria).not.toContain('PRIVATE-DATE-PRESENTATION-NOTE');
 await expect(today).toHaveAttribute('aria-disabled','false');await expect(page.locator('#calGrid [aria-disabled="false"]')).toHaveCount(1);await expect(page.locator('#monthTitle i')).toHaveCount(0);
 await page.locator('#btnStats').click();const event=page.waitForEvent('download');await page.evaluate(()=>document.querySelector('#btnExport').click());const file=await event;expect(file.suggestedFilename()).toBe('today-rapor-'+snapshot.key+'.csv');expect(fs.readFileSync(await file.path(),'utf8')).toBe('Tarih;Seçim;Renk;Not\n'+snapshot.key+';Her şey çok net;Nane;PRIVATE-DATE-PRESENTATION-NOTE');
 const after=await page.evaluate(()=>({key:TodayDay.todayKey(),record:JSON.parse(localStorage.getItem('today_store_v2')).days[TodayDay.todayKey()],lang:document.documentElement.lang}));expect(after).toEqual({key:snapshot.key,record:snapshot.record,lang:'tr'});
 await page.locator('#btnBackToPick').click();await expect(page.locator('#note')).toHaveValue('PRIVATE-DATE-PRESENTATION-NOTE');
}
test('Real formatter dependency supplies core/month/day presentation with unchanged keys, records and CSV',async({page,context})=>{await open(page,context,false);await verify(page,true);});
test('Missing formatter dependency keeps original TR dates, editable today, saved note and CSV',async({page,context})=>{await open(page,context,true);await verify(page,false);expect(await page.evaluate(()=>typeof window.TodayCalendarCopy)).toBe('undefined');});
