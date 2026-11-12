const {test,expect}=require('@playwright/test');
const {randomBytes}=require('node:crypto');
async function open(page){await page.goto(`/runs/${randomBytes(12).toString('hex')}/index.html`);await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');await expect.poll(()=>page.evaluate(()=>window.TodayHealthHub?.getState().initialized)).toBe(true);await page.locator('#btnStart').click();await page.locator('#btnHomeFromPick').click();await page.locator('#btnModuleHealth').click();}
test('Health entry surfaces keep centered header and accessible controls across narrow large text layouts',async({page},info)=>{
 await open(page);
 const views=[[],['[data-health-hub-open="nutrition"]'],['[data-health-hub-open="wellness"]'],['[data-health-hub-open="sport"]'],['[data-health-hub-open="nutrition"]','[data-nutrition-hub-open="water"]'],['[data-health-hub-open="wellness"]','[data-wellness-open="personalData"]']];
 for(let index=0;index<views.length;index++){
  await page.evaluate(()=>TodayHealthHub.showSection('hub'));
  for(const selector of views[index])await page.locator(selector).click();
  for(const width of [320,393,520])for(const scale of [100,200]){
   await page.setViewportSize({width,height:852});await page.evaluate(scale=>document.documentElement.style.fontSize=scale+'%',scale);
   const m=await page.evaluate(()=>{const view=document.querySelector('[data-view="health"]'),bar=view.querySelector('.topbar').getBoundingClientRect(),pill=view.querySelector('.topbar .pill').getBoundingClientRect();return{offset:Math.abs(pill.x+pill.width/2-bar.x-bar.width/2),controls:[...view.querySelectorAll('button,input,select,textarea')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return{id:e.id||e.className,left:r.left,right:r.right,height:r.height,scroll:e.scrollWidth,client:e.clientWidth};})};});
   expect(m.offset,`view ${index}`).toBeLessThan(1);
   for(const c of m.controls){const label=`${index}/${width}/${scale}/${c.id}`;expect(c.left,label).toBeGreaterThanOrEqual(0);expect(c.right,label).toBeLessThanOrEqual(width);expect(c.height,label).toBeGreaterThanOrEqual(44);expect(c.scroll,label).toBeLessThanOrEqual(c.client+1);}
  }
  await page.evaluate(()=>document.documentElement.style.fontSize='100%');await page.screenshot({path:info.outputPath(`health-${index}.png`),fullPage:true});
 }
});
test('Health layout keeps data unchanged while switching themes and returning to Core',async({page})=>{
 await open(page);
 const snapshot=()=>page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])));
 const before=await snapshot();
 for(const theme of ['dark','light','contrast']){await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await page.locator('[data-health-hub-open="wellness"]').click();await page.locator('[data-wellness-open="personalData"]').click();await expect(page.locator('#wellnessPersonalDataPanel')).toBeVisible();await page.evaluate(()=>TodayHealthHub.showSection('hub'));
 await page.locator('[data-health-hub-open="nutrition"]').click();await page.locator('[data-nutrition-hub-open="water"]').click();
 const colors=await page.locator('#todayWaterGlassMl').evaluate(e=>{const s=getComputedStyle(e);return{fg:s.color,bg:s.backgroundColor};});
 const lum=value=>{const rgb=value.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
 const a=lum(colors.fg),b=lum(colors.bg);expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toBeGreaterThanOrEqual(4.5);
 await page.evaluate(()=>TodayHealthHub.showSection('hub'));}
 expect(await snapshot()).toEqual(before);
 await page.locator('#btnModulesFromHealth').click();await page.locator('#btnCoreFromModules').click();await expect(page.locator('#pickTitle')).toBeVisible();
});
