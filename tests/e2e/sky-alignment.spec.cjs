const {test,expect}=require('@playwright/test');const {randomBytes}=require('node:crypto');
async function open(page){await page.goto(`/runs/${randomBytes(12).toString('hex')}/index.html`);await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');await expect.poll(()=>page.evaluate(()=>window.TodaySkyHub?.getState().initialized)).toBe(true);await page.locator('#btnStart').click();await page.locator('#btnHomeFromPick').click();await page.locator('#btnModuleSky').click();}
async function measure(page,name,violations){
 for(const width of [320,393,520])for(const scale of [100,200])for(const theme of ['dark','light','contrast']){
  await page.setViewportSize({width,height:852});await page.evaluate(({scale,theme})=>{document.documentElement.style.fontSize=scale+'%';document.documentElement.dataset.theme=theme;},{scale,theme});
  const m=await page.locator('[data-view="sky"]').evaluate(view=>{const pill=view.querySelector('.topbar .pill'),p=pill.getBoundingClientRect(),bar=view.querySelector('.topbar').getBoundingClientRect();return{offset:Math.abs(p.x+p.width/2-bar.x-bar.width/2),controls:[pill,...view.querySelectorAll('button,input,select,textarea,summary')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return{id:e.id||e.className,tag:e.tagName,left:r.left,right:r.right,height:r.height,scroll:e.scrollWidth,client:e.clientWidth};})};});
  if(m.offset>=1)violations.push({name,width,scale,theme,headerOffset:m.offset});
  for(const c of m.controls)if(c.left<0||c.right>width+1||(c.tag!=='SPAN'&&c.height<44)||c.scroll>c.client+1)violations.push({name,width,scale,theme,...c});
 }
 await page.evaluate(()=>{document.documentElement.style.fontSize='100%';document.documentElement.dataset.theme='dark';});
}
for(const filled of [false,true])test(`Sky ${filled?'saved synthetic':'missing'} profile panels fit narrow and large text layouts`,async({page},info)=>{
 const outbound=[];page.on('request',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')outbound.push(r.url());});
 await open(page);const violations=[];
 if(filled){
  await page.locator('#skyBirthCard').click();await page.locator('#skyBirthDate').fill('1990-06-15');await page.locator('#skyBirthTime').fill('08:30');await page.locator('#skyBirthPlace').fill('İstanbul, Türkiye');await page.locator('#skyBirthSave').click();
  await page.evaluate(()=>TodaySkyHub.openPanel('natal'));await expect(page.locator('#skyNatalPlaceQuery')).toBeVisible();await page.locator('#skyNatalPlaceQuery').fill('İstanbul');await page.locator('#skyNatalPlaceForm button[type="submit"]').click();await page.locator('[data-sky-natal-place-id]').first().click();await expect(page.locator('.skyNatalBigThree')).toBeVisible();
 }
 const profile=await page.evaluate(()=>JSON.stringify(TodaySkyBirthProfile.getProfile()));
 const core=await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('today_store_v2'))?.days));
 for(const panel of ['hub','birth','natal','today','periods','coreLink']){
  await page.evaluate(panel=>panel==='hub'?TodaySkyHub.showHub():TodaySkyHub.openPanel(panel),panel);
  if(filled&&panel==='today'){await page.locator('[data-sky-today-action="use-birth-place"]').click();await expect(page.locator('#skyTodayClockTime')).toBeVisible();}
  await measure(page,panel,violations);await page.screenshot({path:info.outputPath(panel+'.png'),fullPage:true});
 }
 expect(await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('today_store_v2'))?.days))).toBe(core);
 expect(await page.evaluate(()=>JSON.stringify(TodaySkyBirthProfile.getProfile()))).toBe(profile);
 expect(outbound).toEqual([]);
 await info.attach('layout-violations',{body:JSON.stringify(violations,null,2),contentType:'application/json'});expect(violations).toEqual([]);
});
