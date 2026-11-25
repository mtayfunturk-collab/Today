const {test,expect}=require('@playwright/test');
const {randomBytes}=require('node:crypto');

async function open(page,scope){
  await page.goto(`/runs/${scope}/index.html`);
  await expect.poll(()=>page.evaluate(()=>TodayStartup.getStatus().phase)).toBe('ready');
  await page.locator('#btnStart').click();await page.locator('#btnHomeFromPick').click();await page.locator('#btnModulePlans').click();
}
test('Planlar adds, edits, moves and retains a local item without touching Core',async({page})=>{
  const scope=randomBytes(12).toString('hex');await page.setViewportSize({width:320,height:640});await open(page,scope);
  await page.locator('#btnPlansBack').click();await page.locator('#btnCoreFromModules').click();
  await page.locator('#note').fill('Korunan sentetik Core notu');
  await page.locator('#btnHomeFromPick').click();await page.locator('#btnModulePlans').click();
  const coreBefore=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('today_store_v2')).days)[0]?.note);
  await page.locator('#planTitle').fill('Kitap oku');await page.locator('#planSave').click();
  await expect(page.locator('#plansNext .planItem')).toHaveCount(1);
  await page.locator('#plansNext .planItem button').filter({hasText:'Düzenle'}).click();
  await page.locator('#planNote').fill('20 dakika');await page.locator('#planState').selectOption('day');
  await page.locator('#planDay').fill('2026-11-25');await page.locator('#planSave').click();
  await expect(page.locator('#plansDay .planItem')).toContainText('20 dakika');
  await page.locator('#plansDay .planItem select').selectOption('doing');
  await expect(page.locator('#plansDoing .planItem')).toHaveCount(1);
  await page.reload();await expect.poll(()=>page.evaluate(()=>TodayStartup.getStatus().phase)).toBe('ready');
  await page.locator('#btnStart').click();await page.locator('#btnHomeFromPick').click();await page.locator('#btnModulePlans').click();
  await expect(page.locator('#plansDoing .planItem')).toContainText('Kitap oku');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const raw=await page.evaluate(()=>localStorage.getItem('today.plans.v1'));
  expect(JSON.parse(raw).items[0]).not.toHaveProperty('dayKey');
  expect(await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('today_store_v2')).days)[0]?.note)).toBe(coreBefore);
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#plansDoing .planItem button').filter({hasText:'Sil'}).click();
  await expect(page.locator('#plansDoing .planItem')).toHaveCount(0);
  expect(JSON.parse(await page.evaluate(()=>localStorage.getItem('today.plans.v1'))).items).toHaveLength(0);
});
test('malformed Planlar storage is shown but never overwritten',async({page})=>{
  const scope=randomBytes(12).toString('hex');await page.goto(`/runs/${scope}/index.html`);
  await page.evaluate(()=>localStorage.setItem('today.plans.v1','{"version":1,"items":[{"private":"OLD"}]}'));
  await page.reload();await expect.poll(()=>page.evaluate(()=>TodayStartup.getStatus().phase)).toBe('ready');
  await page.locator('#btnStart').click();await page.locator('#btnHomeFromPick').click();await page.locator('#btnModulePlans').click();
  await expect(page.locator('#plansStatus')).toContainText('Önceki veriler korunuyor');
  await page.locator('#planTitle').fill('Yeni');await page.locator('#planSave').click();
  expect(await page.evaluate(()=>localStorage.getItem('today.plans.v1'))).toBe('{"version":1,"items":[{"private":"OLD"}]}');
});
