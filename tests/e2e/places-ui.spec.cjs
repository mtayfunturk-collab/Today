const {test,expect}=require('@playwright/test');
const {randomBytes}=require('node:crypto');

async function open(page,scope){
  await page.goto(`/runs/${scope}/index.html`);
  await expect.poll(()=>page.evaluate(()=>TodayStartup.getStatus().phase)).toBe('ready');
  await page.locator('#btnStart').click();await page.locator('#btnHomeFromPick').click();await page.locator('#btnModulePlaces').click();
}
test('Yerler saves, edits, moves and deletes a manual place without requesting location',async({page})=>{
  const scope=randomBytes(12).toString('hex');await page.setViewportSize({width:320,height:640});
  await page.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{get(){window.__geoReads=(window.__geoReads||0)+1;throw Error('unexpected geolocation');}});});
  await open(page,scope);
  await page.locator('#placeName').fill('Müze');await page.locator('#placeCity').fill('İstanbul');await page.locator('#placeSave').click();
  await expect(page.locator('#placesWant .placeItem')).toContainText('Müze');
  await page.locator('#placesWant .placeItem button').filter({hasText:'Düzenle'}).click();
  await page.locator('#placeNote').fill('Cumartesi');await page.locator('#placeUrl').fill('https://example.test/place');await page.locator('#placeSave').click();
  await expect(page.locator('#placesWant .placeItem a')).toHaveAttribute('href','https://example.test/place');
  await page.locator('#placesWant .placeItem select').selectOption('visited');
  await expect(page.locator('#placesVisited .placeItem')).toContainText('Cumartesi');
  await page.reload();await expect.poll(()=>page.evaluate(()=>TodayStartup.getStatus().phase)).toBe('ready');
  await page.locator('#btnStart').click();await page.locator('#btnHomeFromPick').click();await page.locator('#btnModulePlaces').click();
  await expect(page.locator('#placesVisited .placeItem')).toContainText('Müze');
  expect(await page.evaluate(()=>window.__geoReads||0)).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  page.once('dialog',dialog=>dialog.accept());await page.locator('#placesVisited .placeItem button').filter({hasText:'Sil'}).click();
  await expect(page.locator('#placesVisited .placeItem')).toHaveCount(0);
  expect(JSON.parse(await page.evaluate(()=>localStorage.getItem('today.places.v1'))).items).toHaveLength(0);
});
test('invalid existing Yerler record is never overwritten',async({page})=>{
  const scope=randomBytes(12).toString('hex');await page.goto(`/runs/${scope}/index.html`);
  await page.evaluate(()=>localStorage.setItem('today.places.v1','{"version":1,"items":[{"private":"OLD"}]}'));
  await page.reload();await expect.poll(()=>page.evaluate(()=>TodayStartup.getStatus().phase)).toBe('ready');
  await page.locator('#btnStart').click();await page.locator('#btnHomeFromPick').click();await page.locator('#btnModulePlaces').click();
  await expect(page.locator('#placesStatus')).toContainText('Önceki veriler korunuyor');
  await page.locator('#placeName').fill('Yeni');await page.locator('#placeCity').fill('X');await page.locator('#placeSave').click();
  expect(await page.evaluate(()=>localStorage.getItem('today.places.v1'))).toBe('{"version":1,"items":[{"private":"OLD"}]}');
});
