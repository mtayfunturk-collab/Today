const { randomBytes } = require("node:crypto");
const { test, expect } = require("@playwright/test");

// Playwright supplies a new browser context for every test: no real user profile.
test.beforeEach(async ({ page }, testInfo) => {
  testInfo.annotations.push({ type: "data", description: "synthetic isolated browser context" });
  page.testScope = randomBytes(12).toString("hex");
});

async function ready(page) {
  await expect.poll(() => page.evaluate(() =>
    window.TodayStartup?.getStatus().phase
  )).toBe("ready");
  await expect.poll(() => page.evaluate(() =>
    window.TodaySkyHub?.getState().initialized
  )).toBe(true);
}

async function open(page) {
  await page.goto(`/runs/${page.testScope}/index.html`);
  await ready(page);
}

async function openModule(page, name) {
  await page.locator("#btnStart").click();
  await page.locator(`#btnModule${name}`).click();
}

async function coreDay(page) {
  return page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem("today_store_v2"));
    const day = store?.days[window.TodayDay.todayKey()];
    // Opening the app updates bookkeeping timestamps; compare retained user data.
    return day ? { choice: day.choice, color: day.color, note: day.note } : null;
  });
}

async function saveCore(page) {
  await openModule(page, "Core");
  await page.locator('[data-choice="B"]').click();
  await page.locator('[data-color="blue"]').click();
  await page.locator("#note").fill("Sentetik tarayıcı doğrulama notu");
  await expect.poll(() => coreDay(page)).toMatchObject({
    choice: "B", color: "blue", note: "Sentetik tarayıcı doğrulama notu"
  });
}

async function coreSnapshot(page) {
  return page.evaluate(() => Object.fromEntries(
    ["today_app_v10", "today_store_v2"].map(key => [key, localStorage.getItem(key)])
  ));
}

async function openWater(page) {
  await openModule(page, "Health");
  await page.locator('[data-health-hub-open="nutrition"]').click();
  await page.locator('[data-nutrition-hub-open="water"]').click();
  await expect(page.locator("#todayWaterVisual")).toBeVisible();
}

async function addWater(page) {
  await page.locator("#todayWaterGlassMl").selectOption("250");
  await page.getByRole("button", { name: "Bir bardak su ekle", exact: true }).click();
  await expect(page.locator("#todayWaterMl")).toHaveText("250 ml");
  await expect.poll(() => page.evaluate(() =>
    window.TodayNutritionUI.getState().summary.waterMl
  )).toBe(250);
}

async function controlled(page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() =>
    Boolean(navigator.serviceWorker.controller)
  )).toBe(true);
}

async function offerUpdate(page, request) {
  await controlled(page);
  const response = await request.post(`/__test/revision/${page.testScope}`);
  expect(response.status()).toBe(204);
  expect(await page.evaluate(async () =>
    (await window.TodayServiceWorker.checkForUpdate()).success
  )).toBe(true);
  await expect(page.locator("#todayUpdateNotice")).toBeVisible();
  await expect.poll(() => page.evaluate(async () =>
    Boolean((await navigator.serviceWorker.getRegistration()).waiting)
  )).toBe(true);
}

test("Core choice, color and note survive a real browser reload", async ({ page, context }) => {
  const errors = [];
  const outbound = [];
  page.on("pageerror", error => errors.push(error.message));
  context.on("request", request => {
    if (new URL(request.url()).hostname !== "127.0.0.1") outbound.push(request.url());
  });
  await open(page);
  await saveCore(page);
  const before = await coreDay(page);
  await page.reload();
  await ready(page);
  expect(await coreDay(page)).toEqual(before);
  await openModule(page, "Core");
  await expect(page.locator('[data-choice="B"]')).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("#note")).toHaveValue(before.note);
  expect(errors).toEqual([]);
  expect(outbound).toEqual([]);
});

test("Health water persists in real IndexedDB and leaves Core records unchanged", async ({ page }) => {
  await open(page);
  await openWater(page);
  const before = await coreSnapshot(page);
  await addWater(page);
  expect(await coreSnapshot(page)).toEqual(before);
  const persisted = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("today_nutrition", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction("records").objectStore("records").getAll();
      read.onerror = () => { db.close(); reject(read.error); };
      read.onsuccess = () => { db.close(); resolve(read.result); };
    };
  }));
  expect(persisted.filter(record => record.type === "hydration_entry")).toHaveLength(1);
  await page.reload();
  await ready(page);
  await openWater(page);
  await expect(page.locator("#todayWaterMl")).toHaveText("250 ml");
});

test("AI observation windows use explicit consent and show sparse daily coverage", async ({ page }) => {
  await open(page); await saveCore(page);
  await page.evaluate(() => window.TodayRouter.navigate("settings", { moveFocus: false }));
  await expect(page.locator("#aiWindowDays")).toBeVisible();
  for (const days of [1, 7, 30, 90]) {
    await page.locator("#aiWindowDays").selectOption(String(days));
    await expect(page.locator("#aiConsentConfirm")).not.toBeChecked();
    await page.locator("#aiConsentConfirm").check();
    await page.locator("#btnAiWindowObserve").click();
    await expect(page.locator("#aiWindowOutput")).toContainText(`${days} günün 1 gününde uygun kayıt var`);
    await expect(page.locator("#aiWindowOutput")).toContainText("Günlük seçim");
    await expect(page.locator("#aiWindowOutput")).toContainText("Tek günlük kayıt tekrar örüntüsü değildir");
  }
  await page.locator("#btnAiContextClear").click();
  await expect(page.locator("#aiWindowOutput")).toHaveText("");
});

test("A missing critical module preserves every existing localStorage value", async ({ page }) => {
  await page.addInitScript(() => {
    const legacy = { theme: "light", days: { "2026-07-30": { choice: "C", note: "Sentetik korunan not" } }, logs: {} };
    localStorage.setItem("today_app_v10", JSON.stringify(legacy));
    localStorage.setItem("unrelated-synthetic-key", "untouched");
    window.__initialStorage = Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]));
  });
  await page.route("**/modules/adapter-interfaces.js", route => route.abort("failed"));
  await page.goto(`/runs/${page.testScope}/index.html`);
  await expect(page.locator("#todayStartupError")).toBeVisible();
  await expect(page.locator("#todayStartupError")).toContainText("Kayıtların silinmedi");
  const state = await page.evaluate(() => ({
    phase: window.TodayStartup.getStatus().phase,
    sky: window.TodaySkyHub.getState().initialized,
    current: Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])),
    before: window.__initialStorage
  }));
  expect(state.phase).toBe("failed");
  expect(state.sky).toBe(false);
  expect(state.current).toEqual(state.before);
});

test("The installed offline shell reopens Core data without network access", async ({ page, context }) => {
  await open(page);
  await saveCore(page);
  const before = await coreDay(page);
  await controlled(page);
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready(page);
  await openModule(page, "Core");
  await expect(page.locator("#note")).toHaveValue(before.note);
  expect(await coreDay(page)).toEqual(before);
  await expect.poll(() => page.evaluate(() =>
    window.TodayAIContextUI?.API_VERSION
  )).toBe(1);
});

test("Deferring a real waiting worker keeps the active session and Core data", async ({ page, request }) => {
  await open(page);
  await saveCore(page);
  const before = await coreDay(page);
  await page.evaluate(() => { window.__sessionMarker = "kept"; });
  await offerUpdate(page, request);
  await page.locator("#todayUpdateLater").click();
  await expect(page.locator("#todayUpdateNotice")).toBeHidden();
  const state = await page.evaluate(async () => ({
    marker: window.__sessionMarker,
    waiting: (await navigator.serviceWorker.getRegistration()).waiting?.state,
    accepted: window.TodayServiceWorker.getState().userAccepted
  }));
  expect(state).toEqual({ marker: "kept", waiting: "installed", accepted: false });
  expect(await coreDay(page)).toEqual(before);
});

test("An update activates only after the user confirms and preserves Core data", async ({ page, request }) => {
  await open(page);
  await saveCore(page);
  const before = await coreDay(page);
  await page.evaluate(() => { window.__sessionMarker = "old-session"; });
  await offerUpdate(page, request);
  await Promise.all([
    page.waitForEvent("load"),
    page.locator("#todayUpdateApply").click()
  ]);
  await ready(page);
  expect(await page.evaluate(() => window.__sessionMarker)).toBeUndefined();
  expect(await coreDay(page)).toEqual(before);
  await expect.poll(() => page.evaluate(async () =>
    (await navigator.serviceWorker.getRegistration()).waiting === null
  )).toBe(true);
});

test("Wearable PWA preview explains unavailable access and preserves Core and Health data", async ({ page }) => {
  await open(page);
  await saveCore(page);
  await page.locator("#btnHomeFromPick").click();
  await page.locator("#btnModuleHealth").click();
  await page.locator('[data-health-hub-open="nutrition"]').click();
  await page.locator('[data-nutrition-hub-open="water"]').click();
  await addWater(page);
  const healthRecords = () => page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("today_nutrition", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("records", "readonly");
      const read = transaction.objectStore("records").getAll();
      read.onerror = () => { db.close(); reject(read.error); };
      read.onsuccess = () => { db.close(); resolve(read.result); };
    };
  }));
  const storageSnapshot = () => page.evaluate(() => Object.fromEntries(
    Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])
  ));
  const before = { storage: await storageSnapshot(), health: await healthRecords() };
  await page.locator("#btnModulesFromHealth").click();
  await page.locator("#btnModulesFromHealth").click();
  await page.locator('[data-health-hub-open="wellness"]').click();
  await page.locator('[data-wellness-open="personalData"]').click();
  await expect(page.locator("#wellnessPersonalDataPanel")).toBeVisible();
  await expect(page.locator("#wearableAvailability")).toContainText("Bu sürümde saat verisine erişim yok");
  await expect(page.locator("#btnWearableRead")).toBeDisabled();
  await expect(page.locator("#wearableReadConsent")).not.toBeChecked();
  await expect(page.locator("#wearableReadConsent")).toBeDisabled();
  await expect(page.locator("#wearableReadResults")).toBeEmpty();
  await page.locator("#btnWearableClear").click();
  await expect(page.locator("#wearableReadResults")).toBeEmpty();
  expect(await storageSnapshot()).toEqual(before.storage);
  expect(await healthRecords()).toEqual(before.health);
  await page.locator("#btnModulesFromHealth").click();
  await expect(page.locator("#wellnessHub")).toBeVisible();
});

test("Synthetic native health bridge reads only explicitly selected steps after consent", async ({ page }, testInfo) => {
  testInfo.annotations.push({ type: "provider", description: "synthetic Android bridge; no real OS permission or watch" });
  await page.addInitScript(() => {
    const observed = { permissions: [], checks: [], queries: [] };
    window.__syntheticHealthCalls = observed;
    window.TodayNativeHealth = Object.freeze({
      isNative: true, platform: "android", pluginAvailable: true,
      health: {
        isAvailable: async () => ({ available: true }),
        requestAuthorization: async scope => {
          observed.permissions.push(scope);
          return { readAuthorized: scope.read, readDenied: [] };
        },
        checkAuthorization: async scope => {
          observed.checks.push(scope);
          return { readAuthorized: scope.read, readDenied: [] };
        },
        queryAggregated: async options => {
          observed.queries.push(options);
          return { samples: [{ startDate: options.startDate, endDate: options.endDate,
            value: 1234, values: { sum: 1234 }, unit: "count" }] };
        },
        readSamples: async () => { throw Error("Unexpected sleep read"); },
        queryWorkouts: async () => { throw Error("Unexpected workout read"); }
      }
    });
  });
  await open(page);
  await openModule(page, "Health");
  await page.locator('[data-health-hub-open="wellness"]').click();
  await page.locator('[data-wellness-open="personalData"]').click();
  await expect(page.locator("#wearableAvailability")).toContainText("erişim yolu hazır");
  const storageSnapshot = () => page.evaluate(() => Object.fromEntries(
    Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])
  ));
  const before = await storageSnapshot();
  expect(await page.evaluate(() => window.__syntheticHealthCalls)).toEqual({ permissions: [], checks: [], queries: [] });
  await page.locator('[data-wearable-type="steps"]').check();
  await page.locator("#wearableReadDays").selectOption("1");
  await expect(page.locator("#btnWearableRead")).toBeDisabled();
  await page.locator("#wearableReadConsent").check();
  await page.locator("#btnWearableRead").click();
  await expect(page.locator("#wearableReadResults")).toContainText("1234 adım");
  await expect(page.locator("#wearableReadConsent")).not.toBeChecked();
  const calls = await page.evaluate(() => window.__syntheticHealthCalls);
  expect(calls.permissions).toEqual([{ read: ["steps"], write: [] }]);
  expect(calls.checks).toEqual([{ read: ["steps"], write: [] }]);
  expect(calls.queries).toHaveLength(1);
  expect(calls.queries[0]).toMatchObject({ dataType: "steps", bucket: "day", aggregation: "sum" });
  expect(await storageSnapshot()).toEqual(before);
  await page.locator("#btnWearableClear").click();
  await expect(page.locator("#wearableReadResults")).toBeEmpty();
});
