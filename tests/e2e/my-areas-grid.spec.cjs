const {test,expect}=require('@playwright/test');
const {randomBytes}=require('node:crypto');

test('Alanlarım keeps five modules, Core note and a usable grid at mobile and large text sizes',async({page},testInfo)=>{
  const scope=randomBytes(12).toString('hex');
  await page.setViewportSize({width:393,height:700});
  await page.goto(`/runs/${scope}/index.html`);
  await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');
  await page.locator('#btnStart').click();
  await expect.poll(()=>page.evaluate(()=>TodayRouter.getState().route)).toBe('pick');
  const note='Sentetik Alanlarım dönüş notu';
  await page.locator('#note').fill(note);
  await page.locator('#btnHomeFromPick').click();
  await expect(page.locator('#modulesTitle')).toHaveText('Alanlarım');
  await expect(page.locator('.moduleCards')).toHaveAttribute('aria-label','Alanlarım');
  await expect(page.locator('.moduleCards > .moduleCard, .moduleCards > .radioModule')).toHaveCount(5);
  await expect(page.locator('.radioSharedHost .radioMini')).toHaveCount(1);

  const measure=()=>page.evaluate(()=>{
    const grid=document.querySelector('.moduleCards');
    const cards=[...grid.children];
    const boxes=cards.map(card=>card.getBoundingClientRect());
    return {columns:new Set(boxes.map(box=>Math.round(box.left))).size,
      overflow:document.documentElement.scrollWidth>innerWidth,
      cardWidths:boxes.map(box=>box.width),
      cardHeights:cards.map(card=>(card.matches('.moduleCard')?card:card.querySelector('.moduleCard')).getBoundingClientRect().height),
      scrollHeight:document.documentElement.scrollHeight,viewportHeight:innerHeight};
  });
  const normal=await measure();
  expect(normal.columns).toBe(2);
  expect(normal.overflow).toBe(false);
  expect(normal.cardHeights.every(height=>height>=44)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('my-areas-mobile.png'),fullPage:true});

  await page.setViewportSize({width:320,height:640});
  const narrow=await measure();
  expect(narrow.columns).toBe(1);
  expect(narrow.overflow).toBe(false);

  await page.setViewportSize({width:393,height:700});
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
  const large=await measure();
  expect(large.columns).toBe(1);
  expect(large.overflow).toBe(false);
  expect(large.scrollHeight).toBeGreaterThan(large.viewportHeight);
  await page.screenshot({path:testInfo.outputPath('my-areas-large-text.png'),fullPage:true});

  await page.locator('#btnCoreFromModules').click();
  await expect.poll(()=>page.evaluate(()=>TodayRouter.getState().route)).toBe('pick');
  await expect(page.locator('#note')).toHaveValue(note);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('today_store_v2'))
    ?.days?.[TodayDay.todayKey()]?.note)).toBe(note);
});
