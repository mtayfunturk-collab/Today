const{test,expect}=require('@playwright/test');const{randomBytes}=require('node:crypto');
async function open(page,context,missing){
 await context.addInitScript(()=>Object.defineProperty(navigator,'serviceWorker',{value:undefined}));
 if(missing)await context.route('**/modules/locales/core-tr.mjs',r=>r.abort('failed'));
 else await context.route('**/modules/locales/core-tr.mjs',async route=>{const response=await route.fetch();let body=await response.text();for(const[k,v]of Object.entries({'statistics.chart.loading':'Fixture <b>loading</b>','common.build':'Fixture <i>{version}</i> $&'})){body=body.replace(new RegExp('("'+k.replaceAll('.','\\.')+'": )"[^"]+"'),(_,prefix)=>prefix+JSON.stringify(v));}await route.fulfill({response,body});});
 await page.goto(`/runs/${randomBytes(12).toString('hex')}/index.html`);await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');
 const notice=page.locator('#todayErrorNotice');if(await notice.isVisible()){await expect(page.locator('#todayErrorNoticeCode')).toHaveText('Hata kodu: TODAY-RUNTIME-003');await notice.getByRole('button',{name:'Kapat',exact:true}).click();}
}
test('Dictionary fallback labels preserve version identity and never replace the live chart summary on late bootstrap',async({page,context})=>{
 await open(page,context,false);const version=await page.evaluate(()=>TodayVersion.getCurrentVersion());
 await expect(page.locator('#buildTag')).toHaveText('Fixture <i>'+version.appVersion+'</i> $&');await expect(page.locator('#buildTag i')).toHaveCount(0);
 await expect(page.locator('#chartSummary')).toHaveText('Fixture <b>loading</b>');await expect(page.locator('#chartSummary b')).toHaveCount(0);
 await page.locator('#btnStart').click();await page.locator('#note').fill('SYNTHETIC-FALLBACK-NOTE');await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('today_store_v2')).days[TodayDay.todayKey()]?.note)).toBe('SYNTHETIC-FALLBACK-NOTE');
 const record=await page.evaluate(()=>JSON.parse(localStorage.getItem('today_store_v2')).days[TodayDay.todayKey()]);
 await page.locator('#btnCalendar').click();const summary=await page.locator('#chartSummary').textContent();expect(summary).toContain('Dönem sonundaki birikimli giriş sayısı:');expect(summary).not.toContain('Fixture');
 await page.evaluate(()=>import('./modules/core-static-copy-ui.mjs?late-synthetic-bootstrap'));
 await expect(page.locator('#chartSummary')).toHaveText(summary);expect(await page.evaluate(()=>TodayVersion.getCurrentVersion())).toEqual(version);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('today_store_v2')).days[TodayDay.todayKey()])).toEqual(record);
 await page.locator('#btnBackToPick').click();await expect(page.locator('#note')).toHaveValue('SYNTHETIC-FALLBACK-NOTE');
});
test('Dictionary load failure leaves original build metadata and graph loading fallback intact',async({page,context})=>{
 await open(page,context,true);const version=await page.evaluate(()=>TodayVersion.getCurrentVersion());await expect(page.locator('#buildTag')).toHaveText('build: '+version.appVersion);await expect(page.locator('#chartSummary')).toHaveText('Grafik verisi hazırlanıyor.');
 await page.locator('#btnStart').click();await page.locator('#note').fill('SYNTHETIC-MISSING-FALLBACK');await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('today_store_v2')).days[TodayDay.todayKey()]?.note)).toBe('SYNTHETIC-MISSING-FALLBACK');
 await page.locator('#btnCalendar').click();await expect(page.locator('#chartSummary')).toContainText('Dönem sonundaki birikimli giriş sayısı:');expect(await page.evaluate(()=>TodayVersion.getCurrentVersion())).toEqual(version);
});
