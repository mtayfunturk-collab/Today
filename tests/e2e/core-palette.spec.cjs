const {test,expect}=require('@playwright/test');
const {randomBytes}=require('node:crypto');
const palette=[['navy','Lacivert','#1b2a52'],['orange','Turuncu','#ff7a00'],['red','Kırmızı','#ff3b30'],['blue','Mavi','#2f6bff'],['yellow','Sarı','#ffcc00'],['green','Yeşil','#34c759'],['deep','Derin','#0b0f18'],['pink','Pembe','#ed64a6'],['purple','Mor','#a78bfa'],['teal','Turkuaz','#14b8a6'],['mint','Nane','#a3e4b8'],['gray','Gri','#94a3b8']];
async function ready(page){await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');await expect.poll(()=>page.evaluate(()=>window.TodaySkyHub?.getState().initialized)).toBe(true);}
async function open(page){await page.goto(`/runs/${randomBytes(12).toString('hex')}/index.html`);await ready(page);await page.locator('#btnStart').click();}
test('All original and new colors preserve their IDs accents and selection after reload',async({page},info)=>{
  await open(page);await page.locator('#note').fill('Palet testi sentetik not');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('today_store_v2'))?.days?.[TodayDay.todayKey()]?.note)).toBe('Palet testi sentetik not');
  const keys=await page.evaluate(()=>Object.keys(localStorage).sort());
  for(const [id,label,hex] of palette){
    const control=page.getByRole('button',{name:label,exact:true});await control.click();
    await expect(control).toHaveAttribute('aria-pressed','true');
    await page.reload();await ready(page);await page.locator('#btnStart').click();
    await expect(page.getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-pressed','true');
    const saved=await page.evaluate(()=>({accent:document.documentElement.style.getPropertyValue('--accent'),days:['today_app_v10','today_store_v2'].map(k=>JSON.parse(localStorage.getItem(k)).days[TodayDay.todayKey()])}));
    expect(saved.accent).toBe(hex);for(const d of saved.days)expect(d).toMatchObject({color:id,note:'Palet testi sentetik not'});
    expect(await page.locator('.cbtn[aria-pressed="true"]').count()).toBe(1);
  }
  expect(await page.evaluate(()=>Object.keys(localStorage).sort())).toEqual(keys);
  await page.locator('[data-color="pink"]').click();await page.screenshot({path:info.outputPath('core-pink.png'),fullPage:true});
});
test('Expanded palette wraps into three rows and stays keyboard accessible in every theme',async({page},info)=>{
  await page.setViewportSize({width:320,height:640});await open(page);
  for(const theme of ['dark','light','contrast']){
    await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;document.documentElement.style.fontSize='200%';},theme);
    const metrics=await page.locator('.cbtn').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,right:r.right,y:r.y,width:r.width,height:r.height,bg:getComputedStyle(e).backgroundColor};}));
    expect(new Set(metrics.map(m=>m.y)).size).toBe(3);
    for(const m of metrics){expect(m.width).toBeGreaterThanOrEqual(44);expect(m.height).toBeGreaterThanOrEqual(44);expect(m.x).toBeGreaterThanOrEqual(0);expect(m.right).toBeLessThanOrEqual(320);expect(m.bg).not.toBe('rgba(0, 0, 0, 0)');}
    const pink=page.getByRole('button',{name:'Pembe',exact:true});await pink.focus();await page.keyboard.press('Space');await expect(pink).toHaveAttribute('aria-pressed','true');await expect(pink).toBeFocused();
    await page.screenshot({path:info.outputPath(`palette-${theme}.png`),fullPage:true});
  }
});
