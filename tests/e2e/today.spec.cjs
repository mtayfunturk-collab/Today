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
  await installSyntheticHealth(page);
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

async function installSyntheticHealth(page) {
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
}

test("Consented wearable AI uses temporary steps and clears results when Health preview is revoked", async ({ page }, testInfo) => {
  testInfo.annotations.push({ type: "provider", description: "synthetic Android bridge; memory-only Health-to-AI flow" });
  await installSyntheticHealth(page); await open(page); await openModule(page, "Health");
  await page.locator('[data-health-hub-open="wellness"]').click();
  await page.locator('[data-wellness-open="personalData"]').click();
  await expect(page.locator('#wearableAvailability')).toContainText('erişim yolu hazır');
  await page.locator('[data-wearable-type="steps"]').check();
  await page.locator('#wearableReadDays').selectOption('1');
  await page.locator('#wearableReadConsent').check(); await page.locator('#btnWearableRead').click();
  await expect(page.locator('#wearableReadResults')).toContainText('1234 adım');
  const before = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])));
  await page.evaluate(() => window.TodayRouter.navigate('settings', { moveFocus: false }));
  const scope = page.locator('[data-ai-context-class="wearable-steps"]');
  await expect(scope).not.toBeChecked(); await scope.check();
  await page.locator('#aiWindowDays').selectOption('1');
  await page.locator('#btnAiWindowObserve').click();
  await expect(page.locator('#aiWindowOutput')).toContainText('Önce bilgi seçimini onayla');
  await page.locator('#aiConsentConfirm').check(); await page.locator('#btnAiWindowObserve').click();
  await expect(page.locator('#aiWindowOutput')).toContainText('Saat: adım');
  await expect(page.locator('#aiWindowOutput')).toContainText('1234 adım');
  expect((await page.evaluate(() => window.__syntheticHealthCalls)).queries).toHaveLength(1);
  await page.evaluate(() => { window.TodayRouter.navigate('health', { moveFocus: false }); window.TodayHealthHub.showSection('wellness', { focus: false }); window.TodayHealthHub.showWellnessSection('personalData', { focus: false }); });
  await page.locator('#btnWearableClear').click();
  await page.evaluate(() => window.TodayRouter.navigate('settings', { moveFocus: false }));
  await expect(page.locator('#aiWindowOutput')).toBeEmpty();
  await expect(page.locator('#aiConsentConfirm')).not.toBeChecked();
  expect(await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])))).toEqual(before);
});

test('PWA notification preferences default off without creating an archive', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.TodayRouter.navigate('settings', { moveFocus: false }));
  await expect(page.locator('#notificationAvailability')).toContainText('telefon bildirimi planlanamıyor');
  await expect(page.locator('#notificationAiEnabled')).not.toBeChecked();
  await expect(page.locator('#notificationAiEnabled')).toBeDisabled();
  await expect(page.locator('#notificationUpdateEnabled')).not.toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem('today_ai_delivery_v1'))).toBeNull();
});

test('Synthetic notification bridge archives a consented observation, opens after reload and resets only its own data', async ({ page }, testInfo) => {
  testInfo.annotations.push({ type: 'provider', description: 'synthetic local-notification bridge; no physical OS delivery' });
  await page.clock.setFixedTime(new Date('2026-10-30T09:00:00Z'));
  await page.addInitScript(() => {
    const read = () => JSON.parse(sessionStorage.getItem('__syntheticNotificationQueue') || '[]');
    const write = rows => sessionStorage.setItem('__syntheticNotificationQueue', JSON.stringify(rows));
    window.__permissionRequests = 0;
    const permission = () => sessionStorage.getItem('__syntheticNotificationPermission') || 'prompt';
    window.TodayNativeNotifications = { isNative: true, platform: 'android', pluginAvailable: true, singleContext: true,
      notifications: {
        checkPermissions: async () => ({ display: permission() }),
        requestPermissions: async () => { window.__permissionRequests++; sessionStorage.setItem('__syntheticNotificationPermission','granted'); return { display: 'granted' }; },
        createChannel: async () => {},
        schedule: async ({ notifications }) => { write([...read(), ...notifications]); return { notifications: notifications.map(({ id }) => ({ id })) }; },
        getPending: async () => ({ notifications: read() }),
        cancel: async ({ notifications }) => { write(read().filter(row => !notifications.some(item => item.id === row.id))); },
        getDeliveredNotifications: async () => ({ notifications: [] }),
        removeDeliveredNotifications: async () => {},
        addListener: async (name, callback) => { window.__notificationAction = callback; return { remove() {} }; }
      }
    };
  });
  await open(page); await saveCore(page); const before = await coreDay(page);
  await page.evaluate(() => { localStorage.setItem('__unrelatedSentinel','keep'); window.TodayRouter.navigate('settings', { moveFocus: false }); });
  await expect(page.locator('#notificationAvailability')).toContainText('kullanılabilir');
  expect(await page.evaluate(() => localStorage.getItem('today_ai_delivery_v1'))).toBeNull();
  expect(await page.evaluate(() => window.__permissionRequests)).toBe(0);
  await page.locator('#notificationAiEnabled').check();
  await page.locator('#notificationTime').fill('12:05');
  await page.locator('#notificationArchiveConsent').check();
  await page.locator('#btnNotificationApply').click();
  await expect(page.locator('#notificationStatus')).toContainText('Tercihler kaydedildi');
  expect(await page.evaluate(() => window.__permissionRequests)).toBe(1);
  await page.locator('#aiWindowDays').selectOption('1');
  await page.locator('#aiConsentConfirm').check();
  await page.locator('#btnAiWindowObserve').click();
  await expect(page.locator('#notificationStatus')).toContainText('bildirim planlandı');
  const queue = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__syntheticNotificationQueue')));
  expect(queue).toHaveLength(1);
  expect(queue[0]).toMatchObject({ title: 'Today', body: 'Today, yeni bir gözlemin var. Uygulamayı açıp inceleyebilirsin.', isExactNotification: false, isExactMandatory: false });
  expect(Object.keys(queue[0].extra).sort()).toEqual(['insightId','kind']);
  expect(JSON.stringify(queue)).not.toContain('Sentetik');
  expect(await page.evaluate(() => localStorage.getItem('today_ai_delivery_v1'))).not.toContain('Sentetik');
  await page.reload(); await ready(page);
  await expect.poll(() => page.evaluate(() => typeof window.__notificationAction)).toBe('function');
  await expect(page.locator('#notificationAiEnabled')).toBeChecked();
  await page.evaluate(notification => window.__notificationAction({ notification }), queue[0]);
  await expect(page.locator('#notificationInsight')).toContainText('Kaydedilmiş gözlemin');
  await expect(page.locator('#notificationInsight')).toContainText('Her şey çok net');
  await expect(page.locator('#notificationInsight')).not.toContainText('Sentetik');
  await page.locator('#btnNotificationReset').click();
  await expect(page.locator('#notificationStatus')).toContainText('Core ve Health kayıtların korundu');
  expect(await page.evaluate(() => localStorage.getItem('today_ai_delivery_v1'))).toBeNull();
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('__syntheticNotificationQueue')))).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('__unrelatedSentinel'))).toBe('keep');
  expect(await coreDay(page)).toEqual(before);
});

test('Mobile layout fits the viewport and module swipes leave vertical scroll and inputs alone', async ({ page }) => {
  await page.setViewportSize({width:393,height:852});
  await open(page); await saveCore(page);
  const before=await coreDay(page);
  const gesture=async(dx,dy=0,target='.screen')=>page.evaluate(({dx,dy,target})=>{
    const el=document.querySelector(target), x=dx<0?290:100;
    // Synthetic handler contract: WebKit does not expose a constructible Touch.
    // Physical finger scrolling remains a separate device acceptance check.
    const send=(type,end)=>{
      const t={identifier:1,target:el,clientX:x+(end?dx:0),clientY:250+(end?dy:0)};
      const event=new Event(type,{bubbles:true});
      Object.defineProperties(event,{touches:{value:type==='touchend'?[]:[t]},changedTouches:{value:[t]}});
      el.dispatchEvent(event);
    };
    send('touchstart',false);send('touchmove',true);send('touchend',true);
  },{dx,dy,target});
  await page.locator('#note').blur();
  await gesture(150);
  expect(await page.evaluate(()=>TodayRouter.getState().route)).toBe('pick');
  await gesture(-150,70);
  expect(await page.evaluate(()=>TodayRouter.getState().route)).toBe('pick');
  await gesture(-150,0,'#note');
  expect(await page.evaluate(()=>TodayRouter.getState().route)).toBe('pick');
  await page.locator('#note').blur();
  await gesture(-150);
  await expect.poll(()=>page.evaluate(()=>TodayRouter.getState().route)).toBe('health');
  await gesture(-150);
  await expect.poll(()=>page.evaluate(()=>TodayRouter.getState().route)).toBe('sky');
  await gesture(-150);
  expect(await page.evaluate(()=>TodayRouter.getState().route)).toBe('sky');
  await gesture(150);
  await expect.poll(()=>page.evaluate(()=>TodayRouter.getState().route)).toBe('health');
  await page.evaluate(()=>TodayHealthHub.showSection('wellness',{focus:false}));
  await gesture(-150);
  expect(await page.evaluate(()=>TodayRouter.getState().route)).toBe('health');
  for(const route of ['home','modules','pick','health','sky','settings']){
    await page.evaluate(route=>TodayRouter.navigate(route,{moveFocus:false}),route);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const box=await page.locator('.screen:not(.hidden)').first().boundingBox().catch(()=>null);
    if(box){expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(394);}
  }
  expect(await coreDay(page)).toEqual(before);
});

test.describe('Radio catalog with isolated network fixtures',()=>{
  test.use({serviceWorkers:'block'});
test('Radio catalog requests require consent and preserve Core without contacting a stream',async({page,context},testInfo)=>{
  await page.setViewportSize({width:393,height:852});const external=[],requests=[];
  const rows=[
    {stationuuid:'00000000-0000-4000-8000-000000000001',name:'Test Klasik',url_resolved:'https://stream.example/classical',countrycode:'TR',language:'turkish',tags:'classical',codec:'MP3',hls:0,lastcheckok:1},
    {stationuuid:'00000000-0000-4000-8000-000000000002',name:'Test Jazz',url_resolved:'https://stream.example/jazz',countrycode:'US',language:'english',tags:'jazz',codec:'AAC',hls:0,lastcheckok:1},
    {stationuuid:'00000000-0000-4000-8000-000000000003',name:'Test Haber',url_resolved:'https://stream.example/news',countrycode:'TR',language:'turkish',tags:'news',codec:'AAC',hls:1,lastcheckok:1}
  ];
  await context.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.hostname==='127.0.0.1'){await route.continue();return;}
    if(!u.hostname.endsWith('.api.radio-browser.info')){await route.abort();return;}
    requests.push(u);
    const p=u.searchParams;const data=u.pathname==='/json/servers'?[{name:'de1.api.radio-browser.info'}]:rows.filter(r=>(!p.get('countrycode')||r.countrycode===p.get('countrycode'))&&(!p.get('tag')||r.tags===p.get('tag'))&&(!p.get('name')||r.name.includes(p.get('name'))));
    await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(data)});
  });
  context.on('request',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')external.push(r.url());});
  await open(page);await saveCore(page);const before=await coreDay(page);
  await page.evaluate(()=>TodayRouter.navigate('modules',{moveFocus:false}));await page.locator('#btnModuleRadio').click();
  await expect(page.locator('#radioTitle')).toBeVisible();const card=await page.locator('.screen').boundingBox();expect(card.y).toBeLessThan(30);
  await expect(page.locator('#radioStatus')).toContainText('Henüz arama yapılmadı');expect(requests).toHaveLength(0);
  await page.locator('#btnRadioSearch').click();await expect(page.locator('#radioStatus')).toContainText('izin');expect(requests).toHaveLength(0);
  await page.locator('#radioDirectoryConsent').check();await page.locator('#btnRadioSearch').click();await expect(page.locator('#radioResults li')).toHaveCount(3);
  await expect(page.locator('#radioResults')).toContainText('Canlı yayın doğrulanmadı');
  await page.locator('#radioCountry').selectOption('TR');await page.locator('#radioGenre').selectOption('news');await page.locator('#btnRadioSearch').click();
  await expect(page.locator('#radioResults li')).toHaveCount(1);await expect(page.locator('#radioResults')).toContainText('Test Haber');
  await page.locator('#radioQuery').fill('olmayan');await page.locator('#btnRadioSearch').click();await expect(page.locator('#radioStatus')).toContainText('bulunamadı');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath('radio-catalog.png'),fullPage:true});
  await page.locator('#btnRadioBack').click();await expect(page.locator('#modulesTitle')).toBeVisible();await page.locator('#btnModuleRadio').click();await expect(page.locator('#radioDirectoryConsent')).not.toBeChecked();
  expect(await coreDay(page)).toEqual(before);expect(requests.filter(u=>u.pathname.includes('/stations/'))).toHaveLength(3);
  expect(external.every(u=>new URL(u).hostname.endsWith('.api.radio-browser.info'))).toBe(true);expect(requests.every(u=>!u.href.includes('Sentetik'))).toBe(true);
});
});
