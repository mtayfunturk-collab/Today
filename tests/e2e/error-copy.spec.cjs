const { test, expect } = require('@playwright/test');
const { randomBytes } = require('node:crypto');
async function open(page, context, translations) {
  await context.addInitScript(() => Object.defineProperty(navigator, 'serviceWorker', { value: undefined }));
  await context.route('**/modules/locales/core-tr.mjs', async route => {
    const response = await route.fetch(); let source = await response.text();
    for (const [original, fixture] of Object.entries(translations)) source = source.replace(JSON.stringify(original), JSON.stringify(fixture));
    await route.fulfill({ response, body: source });
  });
  await page.goto(`/runs/${randomBytes(12).toString('hex')}/index.html`);
  await expect.poll(() => page.evaluate(() => window.TodayStartup?.getStatus().phase)).toBe('ready');
  await expect.poll(() => page.evaluate(() => Boolean(window.TodayErrorCopy))).toBe(true);
}
async function savedNote(page) {
  await page.locator('#btnStart').click();
  await page.locator('#note').fill('Sentetik hata sunumu notu');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('today_store_v2')).days[TodayDay.todayKey()]?.note)).toBe('Sentetik hata sunumu notu');
}
test('Real dictionary translates route notice only, preserving diagnostics, Core note and home recovery', async ({ page, context }) => {
  const original = 'Bu ekran şu anda açılamadı. Kayıtların silinmedi.';
  await open(page, context, { [original]: '<b>Fixture route notice</b>', 'Ana ekrana dön': 'Fixture home', 'Kapat': 'Fixture close', 'Hata kodu: {code}': 'Fixture code: {code}' });
  await savedNote(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('today:routeerror', { detail: { errorCode: 'TODAY-ROUTER-015', route: 'fixture' } })));
  const notice = page.locator('#todayErrorNotice');
  await expect(notice).toBeVisible(); await expect(notice).toHaveAttribute('role', 'alert');
  await expect(page.locator('#todayErrorNoticeText')).toHaveText('<b>Fixture route notice</b>');
  await expect(notice.locator('b')).toHaveCount(0);
  await expect(page.locator('#todayErrorNoticeCode')).toHaveText('Fixture code: TODAY-ROUTER-015');
  const record = await page.evaluate(() => window.TodayErrors.getLog().at(-1));
  expect(record.userMessage).toBe(original); expect(record.code).toBe('TODAY-ROUTER-015'); expect(record.details.route).toBe('fixture');
  await expect(notice.getByRole('button', { name: 'Fixture close', exact: true })).toBeVisible();
  await notice.getByRole('button', { name: 'Fixture home', exact: true }).click();
  await expect(notice).toBeHidden(); await expect(page.locator('#btnStart')).toBeVisible();
  await page.locator('#btnStart').click(); await expect(page.locator('#note')).toHaveValue('Sentetik hata sunumu notu');
});
test('Translated warning keeps polite semantics and dismiss action; custom body remains literal', async ({ page, context }) => {
  const original = 'Çevrimdışı kullanım hazırlanamadı. Uygulamayı çevrimiçi kullanmaya devam edebilirsin.';
  await open(page, context, { [original]: 'Fixture offline warning', 'Tamam': 'Fixture okay' });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('today:service-worker-error', { detail: { scriptUrl: './sw.js' } })));
  const notice = page.locator('#todayErrorNotice');
  await expect(notice).toHaveAttribute('role', 'status'); await expect(notice).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('#todayErrorNoticeText')).toHaveText('Fixture offline warning');
  await expect(page.locator('#todayErrorNoticeCode')).toHaveText('Hata kodu: TODAY-SW-001');
  await expect(page.locator('#todayErrorRecover')).toBeHidden();
  await notice.getByRole('button', { name: 'Fixture okay', exact: true }).click(); await expect(notice).toBeHidden();
  expect(await page.evaluate(() => window.TodayErrors.getLog().at(-1).userMessage)).toBe(original);
  await page.evaluate(() => window.TodayErrors.capture({ code: 'TODAY-FIXTURE-001', recovery: 'dismiss', userMessage: 'Custom {code} $& <img src=x>' }));
  await expect(page.locator('#todayErrorNoticeText')).toHaveText('Custom {code} $& <img src=x>'); await expect(notice.locator('img')).toHaveCount(0); await expect(notice).toHaveCount(1);
  await notice.getByRole('button', { name: 'Fixture okay', exact: true }).click();
});
test('Translated retry triggers real reload and retains the saved Core note', async ({ page, context }) => {
  await open(page, context, { 'Yeniden dene': 'Fixture retry', 'Beklenmeyen bir sorun oluştu. Kayıtların silinmedi.': 'Fixture runtime issue' });
  await savedNote(page);
  await page.evaluate(() => { window.__fixtureSession = true; window.TodayErrors.capture({ code: 'TODAY-RUNTIME-001', recovery: 'reload' }); });
  await expect(page.locator('#todayErrorNoticeText')).toHaveText('Fixture runtime issue');
  await Promise.all([page.waitForEvent('load'), page.locator('#todayErrorRecover').click()]);
  await expect.poll(() => page.evaluate(() => window.TodayStartup?.getStatus().phase)).toBe('ready');
  expect(await page.evaluate(() => window.__fixtureSession)).toBeUndefined();
  await page.locator('#btnStart').click(); await expect(page.locator('#note')).toHaveValue('Sentetik hata sunumu notu');
});
