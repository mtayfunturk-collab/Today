const {test,expect}=require('@playwright/test');const {randomBytes}=require('node:crypto');
async function open(page){await page.goto(`/runs/${randomBytes(12).toString('hex')}/index.html`);await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');await expect.poll(()=>page.evaluate(()=>window.TodaySkyHub?.getState().initialized)).toBe(true);await page.locator('#btnStart').click();await page.locator('[data-choice="C"]').click();await page.locator('#note').fill('Sentetik UX05 notu');await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('today_store_v2'))?.days?.[TodayDay.todayKey()]?.note)).toBe('Sentetik UX05 notu');}
async function measure(page,selector,name,issues){
 for(const width of [320,393,520])for(const scale of [100,200])for(const theme of ['dark','light','contrast']){
  await page.setViewportSize({width,height:852});await page.evaluate(({scale,theme})=>{document.documentElement.style.fontSize=scale+'%';document.documentElement.dataset.theme=theme;},{scale,theme});
  const controls=await page.locator(selector).evaluate(root=>[...root.querySelectorAll('button,input:not([type="checkbox"]),select,textarea,summary,label:has(input[type="checkbox"])')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return{id:e.id||e.className,tag:e.tagName,left:r.left,right:r.right,height:r.height,scroll:e.scrollWidth,client:e.clientWidth};}));
  for(const c of controls)if(c.left<0||c.right>width+1||c.height<44||c.scroll>c.client+1)issues.push({name,width,scale,theme,...c});
 }
 await page.evaluate(()=>{document.documentElement.style.fontSize='100%';document.documentElement.dataset.theme='dark';});
}
async function core(page){return page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('today_store_v2')).days));}
test.describe('Isolated Radio layout',()=>{
 test.use({serviceWorkers:'block'});
 test('Radio catalog playback and shared mini-player remain usable with narrow large text layouts',async({page,context},info)=>{
 const audio=require('./radio-audio-fixture.cjs'),requests=[],issues=[];
 await page.addInitScript(()=>{window.__ux05Audio=[];window.Audio=new Proxy(window.Audio,{construct(target,args){const a=Reflect.construct(target,args);window.__ux05Audio.push(a);return a;}});});
 const row={stationuuid:'00000000-0000-4000-8000-000000000001',name:'Sentetik uzun radyo istasyonu — İstanbul dünya müziği',url_resolved:'https://stream.example/ux05.mp3',countrycode:'TR',language:'turkish,english',tags:'classical,jazz',codec:'MP3',hls:0,lastcheckok:1};
 await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1'){await route.continue();return;}requests.push(u.href);if(u.hostname==='stream.example'){await route.fulfill({status:200,contentType:'audio/mpeg',headers:{'Access-Control-Allow-Origin':'*'},body:audio});return;}if(u.hostname.endsWith('.api.radio-browser.info')){await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(u.pathname==='/json/servers'?[{name:'de1.api.radio-browser.info'}]:u.searchParams.get('name')==='empty'?[]:[row])});return;}await route.abort();});
 await open(page);await expect(page.locator('#todayErrorNotice')).toBeVisible();await page.locator('#todayErrorDismiss').click();const before=await core(page);await page.evaluate(()=>TodayRouter.navigate('radio'));
 expect(requests).toEqual([]);await measure(page,'[data-view="radio"]','radio-empty',issues);
 await page.locator('#radioDirectoryConsent').check();await page.locator('#btnRadioSearch').click();await expect(page.locator('[data-radio-play]')).toHaveCount(1);await expect(page.locator('#radioResults h2')).toHaveText(row.name);await measure(page,'[data-view="radio"]','radio-result',issues);
 await page.locator('[data-radio-play]').click();await expect(page.locator('#radioPlayerStatus')).toContainText('izni');expect(requests.some(u=>u.includes('stream.example'))).toBe(false);
 await page.locator('#radioStreamConsent').check();await page.locator('[data-radio-play]').click();await expect(page.locator('#radioPlayerStatus')).toContainText('Çalıyor');await measure(page,'[data-view="radio"]','radio-playing',issues);
 await page.evaluate(()=>TodayRouter.navigate('modules'));await expect(page.locator('.radioMini')).toBeVisible();await measure(page,'.radioMini','mini-playing',issues);await page.screenshot({path:info.outputPath('radio-mini.png'),fullPage:true});
 await page.locator('.radioMiniActions button').click();await expect(page.locator('.radioMiniStatus')).toContainText('Durduruldu');await page.locator('.radioMiniActions button').click();await expect(page.locator('.radioMiniStatus')).toContainText('Çalıyor');expect(await page.evaluate(()=>window.__ux05Audio.length)).toBe(1);await page.locator('.radioMiniActions button').click();
 await page.locator('#btnModuleRadio').click();await expect(page.locator('#radioDirectoryConsent')).not.toBeChecked();await page.locator('#radioDirectoryConsent').check();await page.locator('#radioQuery').fill('empty');await page.locator('#btnRadioSearch').click();await expect(page.locator('#radioStatus')).toContainText('bulunamadı');await measure(page,'[data-view="radio"]','radio-no-results',issues);await page.screenshot({path:info.outputPath('radio.png'),fullPage:true});
 expect(await core(page)).toBe(before);await info.attach('layout-issues',{body:JSON.stringify(issues,null,2),contentType:'application/json'});expect(issues).toEqual([]);
});
});
test('AI consent preview real explanation and edit controls fit narrow large text layouts',async({page},info)=>{
 const issues=[],outbound=[];page.on('request',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')outbound.push(r.url());});
 await open(page);await page.evaluate(()=>{TodayRouter.navigate('health');TodayHealthHub.showSection('wellness');TodayHealthHub.showWellnessSection('energy');});
 await page.getByRole('button',{name:'Düşük',exact:true}).click();await page.getByRole('button',{name:'Fazla',exact:true}).click();await page.getByRole('button',{name:'Normal',exact:true}).click();await page.locator('.energySave').click();
 const before=await core(page);await page.evaluate(()=>TodayRouter.navigate('settings'));await expect(page.locator('#aiContextPanel')).toBeVisible();await expect(page.locator('#aiConsentConfirm')).not.toBeChecked();await measure(page,'#aiContextPanel','ai-consent',issues);
 await page.locator('#aiConsentConfirm').check();await page.locator('#btnAiContextPreview').click();await expect(page.locator('#aiContextPreview')).toBeVisible();await measure(page,'#aiContextPanel','ai-preview',issues);
 await page.locator('#btnAiAnalysis').click();await expect(page.locator('#aiAnalysisOutput')).toBeVisible();await measure(page,'#aiContextPanel','ai-explanation',issues);await page.locator('#btnAiEdit').click();await expect(page.locator('#aiEditPanel')).toBeVisible();await measure(page,'#aiContextPanel','ai-edit',issues);await page.locator('#btnAiEditCancel').click();
 await page.locator('#aiWindowDays').selectOption('1');await page.locator('#aiConsentConfirm').check();await page.locator('#btnAiWindowObserve').click();await expect(page.locator('#aiWindowOutput')).not.toHaveText('');await measure(page,'#aiContextPanel','ai-daily',issues);await page.screenshot({path:info.outputPath('ai.png'),fullPage:true});
 await page.locator('#btnAiContextClear').click();await expect(page.locator('#aiContextPreview')).toBeHidden();await expect(page.locator('#aiConsentConfirm')).not.toBeChecked();expect(await core(page)).toBe(before);expect(outbound).toEqual([]);await info.attach('layout-issues',{body:JSON.stringify(issues,null,2),contentType:'application/json'});expect(issues).toEqual([]);
});
