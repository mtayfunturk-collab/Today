const { test, expect } = require('@playwright/test');
const { randomBytes } = require('node:crypto');

async function open(page) {
  await page.goto(`/runs/${randomBytes(12).toString('hex')}/index.html`);
  await expect.poll(() => page.evaluate(() => window.TodayStartup?.getStatus().phase)).toBe('ready');
}

test('Real module bootstrap reads the dictionary without rebuilding controls', async ({ page, context }) => {
  await context.addInitScript(() => Object.defineProperty(navigator, 'serviceWorker', { value: undefined }));
  await context.route('**/modules/locales/core-tr.mjs', async route => {
    const response = await route.fetch();
    const source = (await response.text()).replace('Bugün sende ne oldu?', 'Sentetik sözlük sorusu');
    await route.fulfill({ response, body: source });
  });
  await open(page);
  await page.locator('#btnStart').click();
  await expect(page.locator('#pickTitle')).toHaveText('Sentetik sözlük sorusu');
  await expect(page.locator('#btnHomeFromPick svg')).toHaveCount(1);
  await expect(page.locator('#btnCalendar span')).toHaveCount(1);
  await page.locator('#note').fill('Sentetik bağlama taslağı 🌸');
  const preserved = await page.evaluate(async () => {
    const note = document.querySelector('#note');
    note.focus(); note.setSelectionRange(2, 6);
    const { applyCoreStaticCopy } = await import('./modules/core-static-copy.mjs');
    applyCoreStaticCopy(document); applyCoreStaticCopy(document);
    return { same: note === document.querySelector('#note'), value: note.value,
      focused: document.activeElement === note, selection: [note.selectionStart, note.selectionEnd] };
  });
  expect(preserved).toEqual({ same: true, value: 'Sentetik bağlama taslağı 🌸', focused: true, selection: [2, 6] });
  await page.locator('#btnHomeFromPick').click();
  await page.locator('#btnCoreFromModules').click();
  await expect(page.locator('#note')).toHaveValue('Sentetik bağlama taslağı 🌸');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('today_store_v2')).days[TodayDay.todayKey()]?.note)).toBe('Sentetik bağlama taslağı 🌸');
});

test('Dictionary load failure preserves Turkish fallback and working Core actions', async ({ page, context, browserName }) => {
  await context.addInitScript(() => Object.defineProperty(navigator, 'serviceWorker', { value: undefined }));
  await context.route('**/modules/locales/core-tr.mjs', route => route.abort('failed'));
  await open(page);
  const notice = page.locator('#todayErrorNotice');
  // WebKit reports a dependency failure on the entry script to the existing
  // central resource-error surface. Acknowledge it through the real user action.
  if (browserName === 'webkit' || await notice.isVisible()) {
    await expect(notice).toBeVisible();
    await expect(page.locator('#todayErrorNoticeCode')).toHaveText('Hata kodu: TODAY-RUNTIME-003');
    await notice.getByRole('button', { name: 'Kapat', exact: true }).click();
    await expect(notice).toHaveAttribute('aria-hidden', 'true');
  }
  await page.locator('#btnStart').click();
  await expect(page.locator('#pickTitle')).toHaveText('Bugün sende ne oldu?');
  await expect(page.locator('#btnHomeFromPick')).toHaveAttribute('aria-label', 'Modülleri aç');
  await page.locator('[data-choice="B"]').click();
  await page.locator('[data-color="mint"]').click();
  await page.locator('#note').fill('Sentetik yükleme hatasında kayıt');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('today_store_v2')).days[TodayDay.todayKey()])).toMatchObject({
    choice: 'B', color: 'mint', note: 'Sentetik yükleme hatasında kayıt'
  });
  await page.locator('#btnHomeFromPick').click();
  await page.locator('#btnCoreFromModules').click();
  await expect(page.locator('#note')).toHaveValue('Sentetik yükleme hatasında kayıt');
  await page.locator('#btnHomeFromPick').click();
  await expect(page.locator('#moduleHealthDesc')).toHaveText('Beslenme, spor ve yaşam');
  await page.locator('#btnCoreFromModules').click();
  await page.locator('#btnCalendar').click(); await page.locator('#btnOpenSettings').click();
  await expect(page.locator('label[for="themeSelect"]')).toHaveText('Tema');
  await page.locator('#themeSelect').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('Offline reload runs the cached binding dependency chain and preserves saved notes', async ({ page, context }) => {
  await open(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const cached = await page.evaluate(async () => {
    const cache = await caches.open('today-cache-today-v2-foundation-101');
    return Promise.all(['core-static-copy-ui.mjs', 'core-static-copy.mjs', 'date-presentation.mjs', 'locales/core-tr.mjs']
      .map(async name => Boolean(await cache.match(new URL('./modules/' + name, location.href)))));
  });
  expect(cached).toEqual([true, true, true, true]);
  await page.locator('#btnStart').click();
  await page.locator('#note').fill('Sentetik çevrimdışı not');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('today_store_v2')).days[TodayDay.todayKey()]?.note)).toBe('Sentetik çevrimdışı not');
  // Alter fallback during parsing: only the actual deferred binder repairs it.
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      const title = document.querySelector('#pickTitle');
      if (!title) return;
      observer.disconnect(); title.textContent = 'Sentetik eski fallback'; window.__fallbackAltered = true;
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  await context.setOffline(true);
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.TodayStartup?.getStatus().phase)).toBe('ready');
  expect(await page.evaluate(() => window.__fallbackAltered)).toBe(true);
  await expect(page.locator('#pickTitle')).toHaveText('Bugün sende ne oldu?');
  await page.locator('#btnStart').click();
  await expect(page.locator('#note')).toHaveValue('Sentetik çevrimdışı not');
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('tr');
});
