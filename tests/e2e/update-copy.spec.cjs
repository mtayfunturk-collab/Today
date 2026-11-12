const { test, expect } = require('@playwright/test');
const { randomBytes } = require('node:crypto');
async function open(page, context) {
  const scope = randomBytes(12).toString('hex');
  await context.route('**/modules/locales/core-tr.mjs', async route => {
    const response = await route.fetch(); let body = await response.text();
    for (const [source, fixture] of Object.entries({
      'Today Yenilik': 'Fixture update title',
      'Today’in yeni sürümü indirildi. Güncelleme, sen onayladığında uygulanacak.': 'Fixture approval message',
      'Şimdi güncelle': 'Fixture apply', 'Daha sonra': 'Fixture later',
      'Today güncelleniyor…': 'Fixture applying', 'Güncelleniyor…': 'Fixture applying button'
    })) body = body.replace(JSON.stringify(source), JSON.stringify(fixture));
    await route.fulfill({ response, body });
  });
  await page.goto(`/runs/${scope}/index.html`);
  await expect.poll(() => page.evaluate(() => window.TodayStartup?.getStatus().phase)).toBe('ready');
  await expect.poll(() => page.evaluate(() => window.TodayUpdateCopy?.['update.title'])).toBe('Fixture update title');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.locator('#btnStart').click(); await page.locator('#note').fill('Sentetik güncelleme notu');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('today_store_v2')).days[TodayDay.todayKey()]?.note)).toBe('Sentetik güncelleme notu');
  await page.evaluate(() => { window.__updateSession = 'kept'; });
  return scope;
}
async function offer(page, request, scope) {
  expect((await request.post(`/__test/revision/${scope}`)).status()).toBe(204);
  expect(await page.evaluate(async () => (await TodayServiceWorker.checkForUpdate()).success)).toBe(true);
  const notice = page.locator('#todayUpdateNotice'); await expect(notice).toBeVisible();
  await expect(page.locator('#todayUpdateTitle')).toHaveText('Fixture update title');
  await expect(page.locator('#todayUpdateText')).toHaveText('Fixture approval message');
  await expect(page.locator('#todayUpdateApply')).toHaveText('Fixture apply'); await expect(page.locator('#todayUpdateLater')).toHaveText('Fixture later');
  await expect(notice).toHaveAttribute('role', 'status'); await expect(notice).toHaveAttribute('aria-live', 'polite');
  await expect(notice).toHaveCount(1);
  expect(await page.evaluate(() => TodayServiceWorker.getState().userAccepted)).toBe(false);
}
test('Real update with dictionary copy waits for approval; defer retains session, worker and note', async ({ page, context, request }) => {
  const scope = await open(page, context); await offer(page, request, scope);
  await page.locator('#todayUpdateLater').click(); await expect(page.locator('#todayUpdateNotice')).toBeHidden();
  const status = await page.evaluate(async () => ({ marker: window.__updateSession, waiting: (await navigator.serviceWorker.getRegistration()).waiting?.state, accepted: TodayServiceWorker.getState().userAccepted, phase: TodayServiceWorker.getState().phase }));
  expect(status).toEqual({ marker: 'kept', waiting: 'installed', accepted: false, phase: 'deferred' });
  await expect(page.locator('#note')).toHaveValue('Sentetik güncelleme notu');
});
test('Translated apply performs a real worker update only after click and preserves Core note', async ({ page, context, request }) => {
  const scope = await open(page, context); await offer(page, request, scope);
  await Promise.all([page.waitForEvent('load'), page.locator('#todayUpdateApply').click()]);
  await expect.poll(() => page.evaluate(() => window.TodayStartup?.getStatus().phase)).toBe('ready');
  expect(await page.evaluate(() => window.__updateSession)).toBeUndefined();
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).waiting === null)).toBe(true);
  await page.locator('#btnStart').click(); await expect(page.locator('#note')).toHaveValue('Sentetik güncelleme notu');
});
