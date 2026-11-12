const { test, expect } = require('@playwright/test');
const { randomBytes } = require('node:crypto');
async function seed(context, copy) {
  await context.addInitScript(({ copy }) => {
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined });
    if (copy) window.TodayStartupCopy = Object.freeze(copy);
    localStorage.setItem('today_app_v10', JSON.stringify({ theme: 'light', days: { '2026-07-30': { choice: 'C', note: 'Sentetik korunan başlangıç notu' } }, logs: {} }));
    localStorage.setItem('unrelated-synthetic-key', 'untouched');
    window.__initialStorage = Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]));
  }, { copy });
}
async function unchanged(page) {
  const values = await page.evaluate(() => ({ before: window.__initialStorage, after: Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])) }));
  expect(values.after).toEqual(values.before);
}
const url = () => `/runs/${randomBytes(12).toString('hex')}/index.html`;
test('Missing startup manager and dictionary preserve Turkish fallback, records and real retry', async ({ page, context }) => {
  await seed(context);
  const fail = route => route.abort('failed');
  await context.route('**/modules/startup-manager.js', fail);
  await context.route('**/modules/locales/core-tr.mjs', fail);
  await page.goto(url());
  const surface = page.locator('#todayStartupError');
  await expect(surface).toBeVisible();
  await expect(surface.locator('h1')).toHaveText('Today başlatılamadı');
  await expect(surface.locator('p')).toHaveText('Başlangıç yöneticisi yüklenemedi. Kayıtların silinmedi. İnternet bağlantını kontrol edip yeniden dene.');
  await expect(surface).toBeFocused();
  await unchanged(page);
  await context.unroute('**/modules/startup-manager.js', fail);
  await context.unroute('**/modules/locales/core-tr.mjs', fail);
  await surface.getByRole('button', { name: 'Yeniden dene', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.TodayStartup?.getStatus().phase)).toBe('ready');
  await expect(surface).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('today_store_v2')).days['2026-07-30'].note)).toBe('Sentetik korunan başlangıç notu');
  expect(await page.evaluate(() => localStorage.getItem('unrelated-synthetic-key'))).toBe('untouched');
});
test('Manager failure uses ready presentation without changing code, accessibility or records', async ({ page, context }) => {
  await seed(context, { 'startup.failed': 'Synthetic title', 'startup.moduleFailed': '<b>Synthetic body</b>', 'startup.code': 'Synthetic code: {code}', 'common.retry': 'Synthetic retry' });
  await context.route('**/modules/adapter-interfaces.js', route => route.abort('failed'));
  await page.goto(url());
  const surface = page.locator('#todayStartupError');
  await expect(surface.locator('h1')).toHaveText('Synthetic title');
  await expect(page.locator('#todayStartupErrorText')).toHaveText('<b>Synthetic body</b>');
  await expect(surface.locator('b')).toHaveCount(0);
  await expect(surface).toHaveAttribute('aria-labelledby', 'todayStartupErrorTitle');
  await expect(surface).toHaveAttribute('aria-describedby', 'todayStartupErrorText');
  await expect(surface).toBeFocused();
  const status = await page.evaluate(() => window.TodayStartup.getStatus());
  expect(status.phase).toBe('failed');
  expect(status.errorCode).toBe('TODAY-STARTUP-001');
  expect(status.missingDependencies).toEqual(['TodayAI', 'TodayConnect']);
  await expect(surface.locator('p').last()).toHaveText('Synthetic code: TODAY-STARTUP-001 — Error: TodayAI, TodayConnect');
  await expect(surface.getByRole('button', { name: 'Synthetic retry', exact: true })).toBeVisible();
  await unchanged(page);
});
test('Inline manager-load failure uses optional ready copy and keeps one surface', async ({ page, context }) => {
  await seed(context, { 'startup.failed': 'Synthetic inline title', 'startup.managerFailed': 'Synthetic inline body', 'common.retry': 'Synthetic retry' });
  await context.route('**/modules/startup-manager.js', route => route.abort('failed'));
  await page.goto(url());
  const surface = page.locator('#todayStartupError');
  await expect(surface).toHaveCount(1);
  await expect(surface.locator('h1')).toHaveText('Synthetic inline title');
  await expect(surface.locator('p')).toHaveText('Synthetic inline body');
  await expect(surface.getByRole('button', { name: 'Synthetic retry', exact: true })).toBeVisible();
  await unchanged(page);
});
