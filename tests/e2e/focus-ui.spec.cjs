const { test, expect } = require('@playwright/test');
const { randomBytes } = require('node:crypto');

test('Odak başlatma, duraklatma ve geri dönüşte oturumu korur', async ({ page }) => {
  const scope = randomBytes(12).toString('hex');
  await page.goto(`/runs/${scope}/index.html`);
  await expect.poll(() => page.evaluate(() => TodayStartup.getStatus().phase)).toBe('ready');
  await page.locator('#btnStart').click();
  await page.locator('#btnHomeFromPick').click();
  await page.locator('#btnModuleFocus').click();
  await expect(page.locator('#focusTitle')).toBeVisible();
  await page.locator('#focusMinutes').fill('1');
  await page.locator('#focusTopic').fill('Okuma');
  await page.locator('#focusStart').click();
  await expect(page.locator('#focusStatus')).toHaveText('Odak sürüyor');
  await page.locator('#focusPause').click();
  await expect(page.locator('#focusStatus')).toHaveText('Duraklatıldı');
  await page.locator('#btnFocusBack').click();
  await page.locator('#btnModuleFocus').click();
  await expect(page.locator('#focusStatus')).toHaveText('Duraklatıldı');
  await page.locator('#focusResume').click();
  await expect(page.locator('#focusStatus')).toHaveText('Odak sürüyor');
  await page.locator('#focusFinish').click();
  await expect(page.locator('#focusStatus')).toHaveText('Oturum bitti');
});
