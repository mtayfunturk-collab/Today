const { test, expect } = require('@playwright/test');
const { randomBytes } = require('node:crypto');

async function openStatistics(page) {
  await page.goto(`/runs/${randomBytes(12).toString('hex')}/index.html`);
  await expect.poll(() => page.evaluate(() => window.TodayStartup?.getStatus().phase)).toBe('ready');
  await page.locator('#btnStart').click();
  await page.locator('[data-choice="B"]').click();
  await page.locator('#note').fill('Sentetik istatistik notu');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('today_store_v2')).days[TodayDay.todayKey()]?.note)).toBe('Sentetik istatistik notu');
  await page.locator('#btnCalendar').click();
  await page.locator('#btnStats').click();
  await expect(page.locator('#accStatsBody')).toBeVisible();
}

test('Statistics bootstrap uses dictionary labels while all four modes keep real chart rendering', async ({ page, context }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await context.addInitScript(() => Object.defineProperty(navigator, 'serviceWorker', { value: undefined }));
  await context.route('**/modules/locales/core-tr.mjs', async route => {
    const response = await route.fetch();
    const source = (await response.text())
      .replace('Soldan sağa: gün akışı. Aşağıdan yukarı: biriken ivme.', 'Sentetik grafik açıklaması')
      .replace('"statistics.mode.day.title": "Gün"', '"statistics.mode.day.title": "Sentetik gün modu"')
      .replace('"statistics.summary": "Özet"', '"statistics.summary": "Sentetik özet"')
      .replace('Not: “değişim logları” sadece bugün görünür, yarına kalmaz (ama veri saklanır).', 'Sentetik log açıklaması');
    await route.fulfill({ response, body: source });
  });
  await openStatistics(page);
  await expect(page.locator('#chartMini')).toHaveText('Sentetik grafik açıklaması');
  await expect(page.locator('[data-mode="day"]')).toHaveAttribute('title', 'Sentetik gün modu');
  await expect(page.locator('#accStatsBody > .mini')).toHaveText('Sentetik log açıklaması');
  const modes = {
    hour: 'Gün içi giriş ritmi (00:00 → 23:59)', day: 'Son 7 gün ivmesi',
    week: 'Son 4 hafta ivmesi', month: 'Son 12 ay ivmesi'
  };
  for (const [mode, title] of Object.entries(modes)) {
    await page.locator(`#accStatsBody [data-mode="${mode}"]`).click();
    await expect(page.locator('#chartLabel')).toHaveText(title);
    await expect(page.locator('#chartSummary')).toContainText(title);
    await expect(page.locator(`#accStatsBody [data-mode="${mode}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#accStatsBody [data-mode][aria-pressed="true"]')).toHaveCount(1);
  }
  await expect(page.locator('#accSummaryHead > span:not(.mini)')).toHaveText('Sentetik özet');
  await page.locator('#accSummaryHead').click();
  await expect(page.locator('#accSummaryBody')).toBeVisible();
  await expect(page.locator('#accSummaryHead .mini')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('Rebinding statistics preserves real graphs notes storage and does not invoke export or clear', async ({ page }) => {
  const downloads = []; page.on('download', download => downloads.push(download));
  await openStatistics(page);
  await page.locator('[data-mode="week"]').click();
  const state = await page.evaluate(async () => {
    const { applyCoreStaticCopy } = await import('./modules/core-static-copy.mjs');
    const selectors = ['#chart', '#chartLabel', '#chartSummary', '#summaryText', '#calGrid', '#aiContextPanel'];
    const nodes = selectors.map(selector => document.querySelector(selector));
    const before = nodes.map(node => node.outerHTML);
    const storage = Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]));
    const arrow = document.querySelector('#accSummaryHead .mini');
    const mode = document.querySelector('[data-mode="week"]'); mode.focus();
    const route = TodayRouter.getState().route;
    let actions = 0;
    for (const selector of ['#btnExport', '#btnClearTodayLogs']) document.querySelector(selector).addEventListener('click', () => { actions += 1; }, { once: true });
    const copy = { 'statistics.summary': 'Sentetik yeni özet', 'statistics.export': 'Sentetik indirme etiketi', 'statistics.clearTodayLogs': 'Sentetik temizleme etiketi', 'statistics.mode.week.title': 'Sentetik hafta modu' };
    applyCoreStaticCopy(document, copy); applyCoreStaticCopy(document, copy);
    return {
      sameNodes: selectors.every((selector, index) => document.querySelector(selector) === nodes[index]),
      sameContent: JSON.stringify(nodes.map(node => node.outerHTML)) === JSON.stringify(before),
      sameStorage: JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]))) === JSON.stringify(storage),
      sameArrow: document.querySelector('#accSummaryHead .mini') === arrow,
      sameMode: document.activeElement === mode && mode.dataset.mode === 'week' && mode.getAttribute('aria-pressed') === 'true',
      sameRoute: TodayRouter.getState().route === route, actions
    };
  });
  expect(state).toEqual({ sameNodes: true, sameContent: true, sameStorage: true, sameArrow: true, sameMode: true, sameRoute: true, actions: 0 });
  await expect(page.locator('#btnExport')).toHaveText('Sentetik indirme etiketi');
  expect(downloads).toEqual([]);
  await page.locator('#btnBackToPick').click();
  await expect(page.locator('#note')).toHaveValue('Sentetik istatistik notu');
});
