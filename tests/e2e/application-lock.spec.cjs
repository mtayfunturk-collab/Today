const { randomBytes } = require("node:crypto");
const { test, expect } = require("@playwright/test");

const PIN = "581347";
const PASSWORD = "Kumlu sahil 23";
const rootPath = () => `/runs/${randomBytes(12).toString("hex")}/`;
const authDb = "today-auth01-device";
const openApp = async (page, root) => {
  await page.goto(root + "index.html");
  await expect(page.locator("body")).toHaveAttribute("data-route", "home");
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.evaluate(() => window.TodayRouter.navigate("settings", { moveFocus: false }));
  return page.locator("#todaySecuritySettings");
};

async function prepareCode(form, secret) {
  await form.getByLabel("Yeni PIN veya parola", { exact: true }).fill(secret);
  await form.getByLabel("Yeni PIN veya parolayı yinele").fill(secret);
  await form.getByRole("button", { name: "Kurtarma kodu oluştur" }).click();
  const code = await form.getByLabel("Yeni kurtarma kodu").textContent();
  expect(code).toMatch(/^(?:[0-9A-F]{4}-){7}[0-9A-F]{4}$/);
  await form.getByLabel("Kodu cihaz dışında sakladım").check();
  return code;
}

async function enroll(settings) {
  const code = await prepareCode(settings, PIN);
  await settings.getByRole("button", { name: "Kilidi etkinleştir" }).click();
  await expect(settings.getByText("Uygulama kilidi etkin.")).toBeVisible();
  return code;
}

async function unlock(page, secret) {
  const gate = page.locator("#todayLock");
  await gate.getByLabel("PIN veya parola", { exact: true }).fill(secret);
  await gate.getByRole("button", { name: "Kilidi aç" }).click();
}

test("real app opts in, stays locked offline after reload and atomically replaces a lost PIN", async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const settings = await openApp(page, rootPath());
  expect(await page.evaluate(async db => (await indexedDB.databases()).some(item => item.name === db), authDb)).toBe(false);
  await expect(settings.getByText("Cihazdaki verileri şifrelemez.", { exact: false })).toBeVisible();
  const oldCode = await enroll(settings);
  await expect(settings.getByLabel("Otomatik kilitleme")).toHaveValue("5");
  await expect(settings.getByLabel("Otomatik kilitleme").locator("option"))
    .toHaveText(["Anında", "1 dakika", "5 dakika", "15 dakika", "30 dakika"]);
  await settings.getByLabel("Otomatik kilitleme").selectOption("15");
  await expect(settings.getByText("Otomatik kilitleme güncellendi.")).toBeVisible();
  await page.evaluate(() => localStorage.setItem("__authPersonalSentinel", "koru"));
  const before = await page.evaluate(() => Object.entries(localStorage).sort());
  await settings.getByRole("button", { name: "Şimdi kilitle" }).click();
  await expect(page.getByRole("heading", { name: "Today kilitli" })).toBeVisible();
  await expect(settings).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Today kilitli" })).toBeVisible();
  expect(await page.evaluate(() => window.TodayStartup.getStatus().phase)).not.toBe("ready");
  await unlock(page, "111111");
  await expect(page.getByText(/Yeniden denemek için/)).toBeVisible();
  await page.reload();
  await expect(page.locator("#todayLock")).toBeVisible();
  await expect(page.getByRole("button", { name: "Kilidi aç" })).toBeEnabled();
  await page.getByText("PIN’imi veya parolamı unuttum").click();
  const recovery = page.locator("[data-recover]");
  await recovery.getByLabel("Mevcut kurtarma kodu").fill(oldCode);
  await recovery.getByLabel("Yeni yöntem").selectOption("password");
  const newCode = await prepareCode(recovery, PASSWORD);
  expect(newCode).not.toBe(oldCode);
  await recovery.getByRole("button", { name: "Kurtarma koduyla PIN veya parolayı yenile" }).click();
  await expect(page.getByText("Yeni PIN veya parolanla kilidi aç.")).toBeVisible();
  expect(await page.evaluate(() => Object.entries(localStorage).sort())).toEqual(before);
  await expect(page.locator("#todayPrivate")).toBeHidden();
  await unlock(page, PASSWORD);
  await expect(page.locator("body")).toHaveAttribute("data-route", "home");
  expect(await page.evaluate(() => localStorage.getItem("__authPersonalSentinel"))).toBe("koru");
  await page.evaluate(() => window.TodayRouter.navigate("settings", { moveFocus: false }));
  await expect(settings.getByLabel("Otomatik kilitleme")).toHaveValue("15");
});

test("direct backup is gated and the v5 archive keeps its normal format after unlock", async ({ page }) => {
  const root = rootPath();
  await enroll(await openApp(page, root));
  await page.goto(root + "backup.html");
  await expect(page.getByRole("heading", { name: "Tam yedek" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Today kilitli" })).toBeVisible();
  await unlock(page, PIN);
  await expect(page.getByRole("heading", { name: "Tam yedek" })).toBeVisible();
  await page.locator("#backupConsent").check();
  await page.locator("#backupPassword").fill("synthetic backup password");
  await page.locator("#backupConfirmation").fill("synthetic backup password");
  await page.getByRole("button", { name: "Yedek dosyasını hazırla" }).click();
  await expect(page.locator("#backupDownload")).toBeVisible();
  const archive = await page.locator("#backupDownload").evaluate(async anchor => {
    const { readBackupForPreview } = await import("./modules/backup-export.mjs");
    const text = await (await fetch(anchor.href)).text();
    const payload = await readBackupForPreview(text, "synthetic backup password", {
      contracts: window.TodayNutritionContracts
    });
    return { format: payload.format, count: payload.localStorageEntries.length,
      databases: payload.databases.map(item => item.name) };
  });
  expect(archive).toEqual({ format: "today:full-backup:v5", count: 28, databases: ["today_nutrition"] });
  await page.getByRole("button", { name: "Şimdi kilitle" }).click();
  await expect(page.locator("#backupDownload")).toBeHidden();
  await unlock(page, PIN);
  await expect(page.getByRole("heading", { name: "Tam yedek" })).toBeVisible();
  await expect(page.locator("#backupDownload")).toBeHidden();

  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("#todayPrivate")).toBeHidden();
  await unlock(page, PIN);
  await expect(page.getByRole("heading", { name: "Tam yedek" })).toBeVisible();
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(page.locator("#todayPrivate")).toBeHidden();
});

test("worker rejects enrollment while a second Today page is open", async ({ page, context }) => {
  const root = rootPath();
  const settings = await openApp(page, root);
  const other = await context.newPage();
  await other.goto(root + "index.html");
  await prepareCode(settings, PIN);
  await settings.getByRole("button", { name: "Kilidi etkinleştir" }).click();
  await expect(settings.getByText(/Diğer Today sekmelerini kapat/)).toBeVisible();
  expect(await page.evaluate(async db => (await indexedDB.databases()).some(item => item.name === db), authDb)).toBe(false);
  await other.close();
  await enroll(settings);
});
