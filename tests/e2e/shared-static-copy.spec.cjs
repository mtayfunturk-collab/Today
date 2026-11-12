const { test, expect } = require('@playwright/test');
const { randomBytes } = require('node:crypto');

async function open(page) {
  await page.goto(`/runs/${randomBytes(12).toString('hex')}/index.html`);
  await expect.poll(() => page.evaluate(() => window.TodayStartup?.getStatus().phase)).toBe('ready');
  await expect.poll(() => page.evaluate(() => window.TodaySkyHub?.getState().initialized)).toBe(true);
}

test('Shared dictionary bootstrap preserves actual module navigation and theme saving', async ({ page, context }) => {
  await context.addInitScript(() => Object.defineProperty(navigator, 'serviceWorker', { value: undefined }));
  await context.route('**/modules/locales/core-tr.mjs', async route => {
    const response = await route.fetch();
    const source = (await response.text())
      .replace('Günlük, notlar ve ajanda', 'Sentetik ortak açıklama')
      .replace('Sadece bu ay görünür.', 'Sentetik takvim yönergesi')
      .replace('"settings.theme": "Tema"', '"settings.theme": "Sentetik tema"');
    await route.fulfill({ response, body: source });
  });
  await open(page);
  await page.locator('#btnStart').click();
  await page.locator('#btnHomeFromPick').click();
  await expect(page.locator('#moduleCoreDesc')).toHaveText('Sentetik ortak açıklama');
  await expect(page.locator('#moduleHealthDesc')).toHaveText('Beslenme, spor ve yaşam');
  await page.locator('#btnModuleHealth').click();
  await expect(page.locator('[data-view="health"]')).toHaveAttribute('aria-hidden', 'false');
  await page.locator('#btnModulesFromHealth').click();
  await page.locator('#btnCoreFromModules').click();
  await page.locator('#btnCalendar').click();
  await expect(page.locator('#calHint')).toHaveText('Sentetik takvim yönergesi');
  await page.locator('#btnOpenSettings').click();
  await expect(page.locator('label[for="themeSelect"]')).toHaveText('Sentetik tema');
  await page.locator('#themeSelect').selectOption('contrast');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'contrast');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('today_store_v2')).settings.theme)).toBe('contrast');
  const preserved = await page.evaluate(async () => {
    const select = document.querySelector('#themeSelect'); select.focus();
    const before = Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]));
    const { applyCoreStaticCopy } = await import('./modules/core-static-copy.mjs');
    applyCoreStaticCopy(document); applyCoreStaticCopy(document);
    return { same: select === document.querySelector('#themeSelect'), value: select.value,
      focused: document.activeElement === select, before,
      after: Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])) };
  });
  expect(preserved.same).toBe(true); expect(preserved.focused).toBe(true);
  expect(preserved.value).toBe('contrast'); expect(preserved.after).toEqual(preserved.before);
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'contrast');
});

test('Updating shared labels preserves rendered chart calendar AI and stored Core data', async ({ page }) => {
  await open(page); await page.locator('#btnStart').click();
  await page.locator('[data-choice="B"]').click(); await page.locator('[data-color="mint"]').click();
  await page.locator('#note').fill('Sentetik ortak ekran notu');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('today_store_v2')).days[TodayDay.todayKey()]?.note)).toBe('Sentetik ortak ekran notu');
  await page.locator('#btnCalendar').click(); await page.locator('#btnStats').click();
  await expect(page.locator('#chartSummary')).not.toHaveText('Grafik verisi hazırlanıyor.');
  const preserved = await page.evaluate(async () => {
    const selectors = ['#calPill', '#monthTitle', '#calGrid', '#chart', '#chartLabel', '#chartSummary', '#summaryText', '#aiContextPanel'];
    const nodes = selectors.map(selector => document.querySelector(selector));
    const before = nodes.map(node => node.outerHTML);
    const store = Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]));
    const route = TodayRouter.getState().route;
    const accordion = document.querySelector('#accStatsHead').getAttribute('aria-expanded');
    const { applyCoreStaticCopy } = await import('./modules/core-static-copy.mjs');
    applyCoreStaticCopy(document, { 'modules.radio.title': 'Sentetik Radyo', 'calendar.currentMonth': 'Sentetik ortak yönerge', 'statistics.title': 'Sentetik İstatistik' });
    return { sameNodes: selectors.every((selector, index) => document.querySelector(selector) === nodes[index]),
      sameContent: JSON.stringify(nodes.map(node => node.outerHTML)) === JSON.stringify(before),
      sameStore: JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]))) === JSON.stringify(store),
      sameRoute: TodayRouter.getState().route === route,
      sameAccordion: document.querySelector('#accStatsHead').getAttribute('aria-expanded') === accordion };
  });
  expect(preserved).toEqual({ sameNodes: true, sameContent: true, sameStore: true, sameRoute: true, sameAccordion: true });
  await expect(page.locator('#calHint')).toHaveText('Sentetik ortak yönerge');
  await page.locator('#btnBackToPick').click();
  await expect(page.locator('#note')).toHaveValue('Sentetik ortak ekran notu');
});
