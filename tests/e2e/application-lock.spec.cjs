const { randomBytes } = require("node:crypto");
const { test, expect } = require("@playwright/test");

const PIN = "581347";
const PASSWORD = "Kumlu sahil 23";

async function openFixture(page, surface = "Core") {
  const scope = randomBytes(12).toString("hex");
  const url = `/runs/${scope}/${surface === "Tam yedek" ? "backup" : "index"}.html`;
  await page.route(`**${url}`, route => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><html lang="tr"><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>body{margin:16px;background:#0b1220;color:#eef2ff;font:16px system-ui}</style>
      <main id="private" hidden inert><h1>${surface}</h1><p>Sentetik kişisel içerik</p>
        <section id="settings"></section></main>
      <section id="lock" hidden></section>
      <script type="module">
        import {createApplicationLock} from "./modules/application-lock.mjs";
        import {mountApplicationLock} from "./modules/application-lock-ui.mjs";
        mountApplicationLock({session:createApplicationLock(),privateContent:document.querySelector("#private"),
          settings:document.querySelector("#settings"),lockScreen:document.querySelector("#lock")});
      </script>`
  }));
  await page.goto(url);
  await expect(page.getByRole("heading", { name: surface })).toBeVisible();
}

async function enable(page) {
  await page.getByLabel("Yeni PIN veya parola", { exact: true }).fill(PIN);
  await page.getByLabel("Yeni PIN veya parolayı yinele").fill(PIN);
  await page.getByRole("button", { name: "Kilidi etkinleştir" }).click();
  await expect(page.getByText("Oturum kilidi etkin.")).toBeVisible();
}

async function unlock(page, value) {
  await page.getByLabel("PIN veya parola", { exact: true }).fill(value);
  await page.getByRole("button", { name: "Kilidi aç" }).click();
}

test("opt-in, manual lock, cooldown and credential change work offline in a narrow layout", async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openFixture(page);
  await context.setOffline(true);
  await enable(page);
  await expect(page.getByLabel("Otomatik kilitleme").locator("option"))
    .toHaveText(["Anında", "1 dakika", "5 dakika", "15 dakika", "30 dakika"]);
  await page.getByLabel("Otomatik kilitleme").selectOption("5");
  await page.getByRole("button", { name: "Şimdi kilitle" }).click();
  await expect(page.getByRole("heading", { name: "Today kilitli" })).toBeVisible();
  await expect(page.getByText("Sentetik kişisel içerik")).toBeHidden();
  await expect(page.getByLabel("PIN veya parola", { exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await unlock(page, "000000");
  await expect(page.getByText("Yeniden denemek için 1 saniye bekle.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Kilidi aç" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Kilidi aç" })).toBeEnabled();
  await unlock(page, PIN);

  await page.getByLabel("Yöntem").selectOption("password");
  await page.getByLabel("Mevcut PIN veya parola").fill(PIN);
  await page.getByLabel("Yeni PIN veya parola", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Yeni PIN veya parolayı yinele").fill(PASSWORD);
  await page.getByRole("button", { name: "PIN veya parolayı değiştir" }).click();
  await expect(page.getByText("Yeni giriş bilgisi hazır.")).toBeVisible();
  await page.getByRole("button", { name: "Şimdi kilitle" }).click();
  await unlock(page, PASSWORD);
  await expect(page.getByRole("heading", { name: "Core" })).toBeVisible();
  const stored = await page.evaluate(async () => ({
    local: localStorage.length, session: sessionStorage.length,
    databases: (await indexedDB.databases()).length
  }));
  expect(stored).toEqual({ local: 0, session: 0, databases: 0 });
});

test("hidden document and restored page keep a protected backup fixture locked", async ({ page }) => {
  await openFixture(page, "Tam yedek");
  await enable(page);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByRole("heading", { name: "Tam yedek" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Today kilitli" })).toBeVisible();
  await page.getByText("PIN’imi veya parolamı unuttum").click();
  await expect(page.getByText(/Kurtarma bu denemede/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tam yedek" })).toHaveCount(0);

  await unlock(page, PIN);
  await expect(page.getByRole("heading", { name: "Tam yedek" })).toBeVisible();
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(page.getByRole("heading", { name: "Tam yedek" })).toHaveCount(0);
});
