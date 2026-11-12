const {test,expect}=require('@playwright/test');
const {randomBytes}=require('node:crypto');

async function openCore(page){
  const scope=randomBytes(12).toString('hex');
  await page.goto(`/runs/${scope}/index.html`);
  await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');
  await expect.poll(()=>page.evaluate(()=>window.TodaySkyHub?.getState().initialized)).toBe(true);
  await page.locator('#btnStart').click();
}
async function retained(page){return page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('today_store_v2'))?.days?.[TodayDay.todayKey()];return d?{choice:d.choice,color:d.color,note:d.note}:null;});}

test('Core controls wrap and date stays centered across widths themes and large text',async({page},info)=>{
  await openCore(page);
  await page.setViewportSize({width:393,height:852});
  const original=await retained(page);
  await page.screenshot({path:info.outputPath('core-normal.png'),fullPage:true});
  await page.evaluate(()=>{
    document.querySelector('#pillDate').textContent='10 Kasım 2026 · Çok uzun yapay tarih açıklaması';
    document.querySelector('#statusPick').textContent='UzunSentetikDurum'.repeat(10);
    document.querySelector('#choiceADesc').textContent='UzunYapaySeçenek'.repeat(10);
  });
  for(const width of [320,393,430,1024])for(const theme of ['dark','light','contrast'])for(const scale of [100,200]){
    await page.setViewportSize({width,height:852});
    await page.evaluate(({theme,scale})=>{document.documentElement.dataset.theme=theme;document.documentElement.style.fontSize=scale+'%';},{theme,scale});
    const m=await page.evaluate(()=>{
      const core=document.querySelector('[data-view="pick"]'),card=document.querySelector('.screen').getBoundingClientRect(),bar=core.querySelector('.topbar').getBoundingClientRect(),date=document.querySelector('#pillDate').getBoundingClientRect();
      return {documentWidth:document.documentElement.scrollWidth,viewport:innerWidth,card:{left:card.left,right:card.right},offset:Math.abs(date.left+date.width/2-bar.left-bar.width/2),items:[...core.querySelectorAll('button,textarea,[role=radio],#pillDate,#statusPick,.ctitle,.cdesc')].filter(el=>el.getClientRects().length).map(el=>{const b=el.getBoundingClientRect();return{id:el.id||el.className,left:b.left,right:b.right,height:b.height,scroll:el.scrollWidth,client:el.clientWidth,control:el.matches('button,textarea,[role=radio]')};})};
    });
    const label=`${width}/${theme}/${scale}`;
    expect(m.documentWidth,label).toBeLessThanOrEqual(m.viewport);expect(m.offset,label).toBeLessThan(1);
    for(const item of m.items){expect(item.left,label+' '+item.id).toBeGreaterThanOrEqual(m.card.left+1);expect(item.right,label+' '+item.id).toBeLessThanOrEqual(m.card.right-1);expect(item.scroll,label+' '+item.id).toBeLessThanOrEqual(item.client+1);if(item.control)expect(item.height,label+' '+item.id).toBeGreaterThanOrEqual(44);}
  }
  expect(await retained(page)).toEqual(original);
  await page.setViewportSize({width:393,height:852});await page.evaluate(()=>{document.documentElement.dataset.theme='dark';document.documentElement.style.fontSize='100%';});
  await page.screenshot({path:info.outputPath('core-long-content.png'),fullPage:true});
});

test('Core keyboard focus note color and calendar return preserve the saved day',async({page},info)=>{
  await page.setViewportSize({width:320,height:640});await openCore(page);
  await page.locator('[data-choice="A"]').focus();await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-choice="B"]')).toHaveAttribute('aria-checked','true');
  await page.locator('[data-color="blue"]').click();
  const note='Yapay uzun not. 🌸 '.repeat(45);await page.locator('#note').fill(note);
  await expect.poll(()=>retained(page)).toMatchObject({choice:'B',color:'blue',note});
  await page.evaluate(()=>document.documentElement.style.fontSize='200%');await page.locator('#note').focus();await expect(page.locator('#note')).toBeFocused();
  const focus=await page.locator('#note').evaluate(el=>({outline:getComputedStyle(el).outlineStyle,width:getComputedStyle(el).outlineWidth}));expect(focus.outline).toBe('solid');expect(parseFloat(focus.width)).toBeGreaterThanOrEqual(3);
  await expect(page.locator('#btnResetToday')).toBeHidden();const health=page.locator('[data-view="pick"] [data-open-module="health"]');await health.scrollIntoViewIfNeeded();await expect(health).toBeInViewport();
  await page.locator('#btnCalendar').click();await expect.poll(()=>page.evaluate(()=>TodayRouter.getState().route)).toBe('calendar');
  await page.evaluate(()=>TodayRouter.backTo('pick'));await expect(page.locator('#note')).toHaveValue(note);
  await page.evaluate(()=>document.documentElement.style.fontSize='100%');await page.screenshot({path:info.outputPath('core-saved-note.png'),fullPage:true});
  await page.reload();await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');expect(await retained(page)).toMatchObject({choice:'B',color:'blue',note});
});

test('Core CSS leaves other route shells unchanged and keeps the original palette IDs and approved additions',async({page})=>{
  await openCore(page);
  expect(await page.locator('[data-view="pick"] [data-color]').evaluateAll(els=>els.map(e=>e.dataset.color))).toEqual(['navy','orange','red','blue','yellow','green','deep','pink','purple','teal','mint','gray']);
  for(const route of ['home','modules','health','sky','radio','calendar','settings']){
    await page.evaluate(route=>TodayRouter.navigate(route,{moveFocus:false}),route);
    const same=await page.evaluate(()=>{
      const style=document.querySelector('style'),original=style.textContent;
      const measure=()=>[...document.querySelectorAll('.screen,.wrap,[data-view].show,[data-view].show button')].map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return [r.x,r.y,r.width,r.height,s.padding,s.gap,s.fontSize,s.display];});
      const after=measure();style.textContent=original.replace(/\/\* PO1-UX02:[\s\S]*?\/\* End PO1-UX02 \*\//,'');const before=measure();style.textContent=original;return JSON.stringify(after)===JSON.stringify(before);
    });expect(same,route).toBe(true);
  }
});
