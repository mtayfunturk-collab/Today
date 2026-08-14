const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  JSDOM,
  VirtualConsole
} = require("jsdom");
const {
  IDBFactory,
  IDBKeyRange
} = require("fake-indexeddb");

const ROOT = path.resolve(__dirname, "..");
const INDEX_PATH = path.join(ROOT, "index.html");
const INDEX_HTML = fs.readFileSync(
  INDEX_PATH,
  "utf8"
);

function clone(value) {
  return value === undefined
    ? undefined
    : JSON.parse(JSON.stringify(value));
}

function wait(milliseconds = 0) {
  return new Promise(resolve =>
    setTimeout(resolve, milliseconds)
  );
}

async function flushMicrotasks(rounds = 4) {
  for (
    let index = 0;
    index < rounds;
    index += 1
  ) {
    await Promise.resolve();
    await wait(0);
  }
}

function storageSnapshot(storage) {
  return Object.fromEntries(
    Array.from(
      {
        length: storage.length
      },
      (_, index) => storage.key(index)
    )
      .filter(Boolean)
      .sort()
      .map(key => [
        key,
        storage.getItem(key)
      ])
  );
}

function parseStorage(
  window,
  key
) {
  const raw =
    window.localStorage.getItem(key);

  return raw
    ? JSON.parse(raw)
    : null;
}

function createEventTarget(base = {}) {
  const listeners = new Map();

  return {
    ...base,

    addEventListener(type, handler) {
      if (!listeners.has(type)) {
        listeners.set(type, []);
      }

      listeners
        .get(type)
        .push(handler);
    },

    emit(type, event = {}) {
      (
        listeners.get(type) || []
      ).forEach(handler =>
        handler({
          type,
          target: this,
          ...event
        })
      );
    },

    listenerCount(type) {
      return (
        listeners.get(type) || []
      ).length;
    }
  };
}

function createServiceWorkerMock({
  waiting = false
} = {}) {
  const messages = [];
  const worker = createEventTarget({
    state: "installed",
    postMessage(message) {
      messages.push(clone(message));
    }
  });
  const registration =
    createEventTarget({
      waiting: waiting
        ? worker
        : null,
      installing: null,
      active: {},
      updateCalls: 0,
      async update() {
        this.updateCalls += 1;
      }
    });
  const serviceWorker =
    createEventTarget({
      controller: {},
      registerCalls: [],
      async register(scriptUrl) {
        this.registerCalls.push(
          scriptUrl
        );
        return registration;
      },
      async getRegistration() {
        return registration;
      }
    });

  return {
    serviceWorker,
    registration,
    worker,
    messages
  };
}

async function createRuntime({
  storage = {},
  skipScripts = [],
  serviceWorker = null
} = {}) {
  const jsdomErrors = [];
  const consoleErrors = [];
  const consoleWarnings = [];
  const downloads = [];
  const objectUrls = new Map();
  let nextObjectUrl = 1;

  const virtualConsole =
    new VirtualConsole();

  virtualConsole.on(
    "jsdomError",
    error => {
      jsdomErrors.push(
        error?.message ||
        String(error)
      );
    }
  );

  const dom = new JSDOM(
    INDEX_HTML,
    {
      url: "https://today.test/",
      runScripts: "outside-only",
      pretendToBeVisual: true,
      virtualConsole
    }
  );
  const { window } = dom;
  const skipped =
    new Set(skipScripts);

  window.console = {
    info() {},
    log() {},
    warn(...args) {
      consoleWarnings.push(
        args.map(String).join(" ")
      );
    },
    error(...args) {
      consoleErrors.push(
        args.map(String).join(" ")
      );
    }
  };
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {}
  });
  window.requestAnimationFrame =
    callback => {
      callback(Date.now());
      return 1;
    };
  window.cancelAnimationFrame =
    () => {};
  window.scrollTo = () => {};
  window.confirm = () => true;
  window.structuredClone =
    globalThis.structuredClone;
  Object.defineProperty(
    window,
    "indexedDB",
    {
      value: new IDBFactory(),
      configurable: true
    }
  );
  Object.defineProperty(
    window,
    "IDBKeyRange",
    {
      value: IDBKeyRange,
      configurable: true
    }
  );

  Object.defineProperty(
    window.navigator,
    "language",
    {
      value: "tr-TR",
      configurable: true
    }
  );

  if (serviceWorker) {
    Object.defineProperty(
      window.navigator,
      "serviceWorker",
      {
        value:
          serviceWorker
            .serviceWorker,
        configurable: true
      }
    );
  }

  Object.entries(storage).forEach(
    ([key, value]) => {
      window.localStorage.setItem(
        key,
        typeof value === "string"
          ? value
          : JSON.stringify(value)
      );
    }
  );

  class CapturedBlob {
    constructor(parts, options = {}) {
      this.parts = parts.map(part =>
        typeof part === "string"
          ? part
          : String(part)
      );
      this.type =
        options.type || "";
      this.size =
        this.parts.join("")
          .length;
    }

    async text() {
      return this.parts.join("");
    }
  }

  window.Blob = CapturedBlob;
  window.URL.createObjectURL =
    blob => {
      const url =
        `blob:today-test/${nextObjectUrl}`;
      nextObjectUrl += 1;
      objectUrls.set(url, blob);
      return url;
    };
  window.URL.revokeObjectURL =
    url => {
      objectUrls.delete(url);
    };
  window.HTMLAnchorElement
    .prototype.click = function click() {
      downloads.push({
        filename: this.download,
        url: this.href,
        blob:
          objectUrls.get(this.href)
      });
    };

  const scriptElements = [
    ...window.document
      .querySelectorAll("script")
  ];

  scriptElements.forEach(
    scriptElement => {
      // JSDOM koşucusu klasik betikleri window.eval ile çalıştırır.
      // Gerçek tarayıcıda ayrı ESM yükleme hattına sahip module betikleri
      // burada eval etmek, geçerli import sözdizimini hatalı gösterir.
      if (scriptElement.type === "module") {
        return;
      }

      const source =
        scriptElement.getAttribute(
          "src"
        );

      if (
        source &&
        skipped.has(source)
      ) {
        return;
      }

      const code = source
        ? fs.readFileSync(
            path.resolve(ROOT, source),
            "utf8"
          )
        : scriptElement.textContent;

      window.eval(
        `${code}\n//# sourceURL=${
          source || "index.inline.js"
        }`
      );
    }
  );

  window.dispatchEvent(
    new window.Event("load")
  );
  await flushMicrotasks();

  return {
    dom,
    window,
    downloads,
    jsdomErrors,
    consoleErrors,
    consoleWarnings,
    close() {
      window.close();
    }
  };
}

function click(window, selector) {
  const element =
    window.document.querySelector(
      selector
    );

  assert.ok(
    element,
    `Öğe bulunamadı: ${selector}`
  );
  element.click();
  return element;
}

function visibleViews(window) {
  return [
    ...window.document
      .querySelectorAll("[data-view]")
  ]
    .filter(view =>
      view.classList.contains("show")
    )
    .map(view =>
      view.getAttribute("data-view")
    );
}

const tests = [];

function test(name, callback) {
  tests.push({
    name,
    callback
  });
}

let normal;
let reloaded;
let legacy;
let broken;
let updateLater;
let updateNow;
let historyRuntime;
let libraryRuntime;
let libraryManagerRuntime;

test(
  "Soğuk açılış tüm çalışma zamanı modüllerini hatasız başlatıyor",
  async () => {
    normal =
      await createRuntime();

    const status =
      normal.window
        .TodayStartup
        .getStatus();

    assert.equal(
      status.phase,
      "ready"
    );
    assert.deepEqual(
      Array.from(
        status.validatedModules
      ),
      [
        "TodayStorage",
        "TodayVersion",
        "TodayMigration",
        "TodayDay",
        "TodayState",
        "TodayAI",
        "TodayConnect"
      ]
    );
    assert.equal(
      status.errorCode,
      null
    );
    assert.ok(
      normal.window
        .TodayNutritionContracts
    );
    assert.ok(
      normal.window
        .TodayNutritionCalculations
    );
    assert.equal(
      normal.window
        .TodayNutritionCalculations
        .CALCULATION_VERSION,
      "nutrition-calc-v1"
    );
    assert.ok(
      normal.window
        .TodayNutritionStorage
    );
    assert.ok(
      normal.window
        .TodayNutritionProfile
    );
    assert.equal(
      normal.window
        .TodayNutritionProfile
        .PROFILE_API_VERSION,
      1
    );
    assert.ok(
      normal.window
        .TodayNutritionLibrary
    );
    assert.equal(
      normal.window
        .TodayNutritionLibrary
        .LIBRARY_API_VERSION,
      2
    );
    assert.ok(
      normal.window
        .TodayNutritionEntry
    );
    assert.equal(
      normal.window
        .TodayNutritionEntry
        .ENTRY_API_VERSION,
      1
    );
    assert.ok(
      normal.window
        .TodayNutritionPlanning
    );
    assert.equal(
      normal.window
        .TodayNutritionPlanning
        .PLANNING_API_VERSION,
      1
    );
    assert.ok(
      normal.window.TodayNutritionHistory
    );
    assert.equal(
      normal.window.TodayNutritionHistory
        .HISTORY_API_VERSION,
      1
    );
    assert.ok(
      normal.window.TodayNutritionUI
    );
    assert.equal(
      normal.window.TodayNutritionUI
        .UI_API_VERSION,
      3
    );
    assert.equal(
      normal.window.TodayNutritionUI
        .getState().initialized,
      true
    );
    assert.ok(
      normal.window
        .TodayNutritionLibraryUI
    );
    assert.equal(
      normal.window
        .TodayNutritionLibraryUI
        .MANAGER_API_VERSION,
      1
    );
    assert.equal(
      normal.window
        .TodayNutritionLibraryUI
        .getState().initialized,
      true
    );
    assert.equal(
      normal.window
        .TodayNutritionMigration
        .getStatus()
        .phase,
      "idle"
    );
  }
);

test(
  "Soğuk açılış yalnız Home görünümünü erişilebilir biçimde gösteriyor",
  () => {
    assert.deepEqual(
      visibleViews(normal.window),
      ["home"]
    );
    assert.equal(
      normal.window.document.body
        .dataset.route,
      "home"
    );
    assert.equal(
      normal.window.document
        .querySelector(
          '[data-view="home"]'
        )
        .getAttribute("aria-hidden"),
      "false"
    );
  }
);

test(
  "Sağlayıcısız AI ve Connect katmanları görünür akışa müdahale etmiyor",
  () => {
    assert.equal(
      normal.window.TodayAI
        .getStatus()
        .available,
      false
    );
    assert.equal(
      normal.window.TodayConnect
        .getStatus()
        .available,
      false
    );
    assert.equal(
      normal.window.document
        .querySelectorAll(
          "[data-module]"
        ).length,
      3
    );
  }
);

test(
  "Başla düğmesi Modül Merkezi rotasını açıyor",
  () => {
    click(
      normal.window,
      "#btnStart"
    );

    assert.equal(
      normal.window.TodayRouter
        .getState().route,
      "modules"
    );
    assert.deepEqual(
      visibleViews(normal.window),
      ["modules"]
    );
  }
);

test(
  "Üç modül kartı Registry üzerinden doğru rotaları açıyor",
  () => {
    const cases = [
      ["core", "pick"],
      ["health", "health"],
      ["sky", "sky"]
    ];

    cases.forEach(
      ([moduleId, route]) => {
        normal.window.TodayRouter
          .navigate(
            "modules",
            {
              moveFocus: false
            }
          );

        click(
          normal.window,
          `[data-module="${moduleId}"]`
        );

        assert.equal(
          normal.window.TodayRouter
            .getState().route,
          route
        );
      }
    );
  }
);

test(
  "Dokuz ortak alt navigasyon tetikleyicisi doğru modülleri açıyor",
  () => {
    const expectedRoutes = {
      core: "pick",
      health: "health",
      sky: "sky"
    };
    const triggers = [
      ...normal.window.document
        .querySelectorAll(
          "[data-open-module]"
        )
    ];

    assert.equal(
      triggers.length,
      9
    );

    triggers.forEach(trigger => {
      normal.window.TodayRouter
        .navigate(
          "modules",
          {
            moveFocus: false
          }
        );
      trigger.click();

      assert.equal(
        normal.window.TodayRouter
          .getState().route,
        expectedRoutes[
          trigger.dataset
            .openModule
        ]
      );
    });
  }
);

test(
  "Health rotası Yakında yer tutucusu yerine canlı beslenme panelini açıyor",
  async () => {
    normal.window.TodayRouter
      .navigate(
        "health",
        {
          moveFocus: false
        }
      );
    await flushMicrotasks(12);

    const healthView =
      normal.window.document
        .querySelector(
          '[data-view="health"]'
        );

    assert.deepEqual(
      visibleViews(normal.window),
      ["health"]
    );
    assert.equal(
      normal.window.TodayNutritionUI
        .getState().opened,
      true
    );
    assert.equal(
      normal.window.TodayNutritionUI
        .getState().lastErrorCode,
      null
    );
    assert.match(
      healthView.textContent,
      /Bugün bedeninde ne var/
    );
    assert.equal(
      healthView.textContent.includes(
        "Yakında"
      ),
      false
    );
    assert.match(
      normal.window.document
        .getElementById(
          "healthSummaryText"
        ).textContent,
      /0 öğün · 0 ml sıvı/
    );
  }
);

test(
  "Health hızlı su düğmesi gerçek IndexedDB kaydı ve görünür özet oluşturuyor",
  async () => {
    click(
      normal.window,
      '[data-health-water-ml="250"]'
    );
    await flushMicrotasks(16);

    const records =
      await normal.window
        .TodayNutritionEntry
        .listEntries({
          types: ["hydration_entry"]
        });

    assert.equal(records.length, 1);
    assert.equal(
      records[0].payload.amount.value,
      250
    );
    assert.equal(
      records[0].payload.amount.unit,
      "ml"
    );
    assert.equal(
      normal.window.TodayNutritionUI
        .getState().summary.waterMl,
      250
    );
    assert.match(
      normal.window.document
        .getElementById(
          "healthEntryList"
        ).textContent,
      /Su · 250 ml/
    );
  }
);

test(
  "Health sade öğün formu adı kalorileştirmeden gerçek kayda bağlıyor",
  async () => {
    const type =
      normal.window.document
        .getElementById(
          "healthMealType"
        );
    const name =
      normal.window.document
        .getElementById(
          "healthMealName"
        );

    type.value = "lunch";
    name.value = "Mercimek çorbası";
    normal.window.document
      .getElementById(
        "healthMealForm"
      )
      .requestSubmit();
    await flushMicrotasks(18);

    const records =
      await normal.window
        .TodayNutritionEntry
        .listEntries({
          types: ["meal_entry"]
        });

    assert.equal(records.length, 1);
    assert.equal(
      records[0].payload.mealType,
      "lunch"
    );
    assert.equal(
      records[0].knowledgeStatus,
      "unknown"
    );
    assert.equal(
      normal.window.TodayNutritionUI
        .getState().summary.mealCount,
      1
    );
    assert.match(
      normal.window.document
        .getElementById(
          "healthEntryList"
        ).textContent,
      /Mercimek çorbası/
    );
  }
);

test(
  "Health gerçek yerel besin, tarif ve öğün şablonunu arama sonuçlarında gösteriyor",
  async () => {
    libraryRuntime =
      await createRuntime();
    libraryRuntime.window.TodayRouter
      .navigate(
        "health",
        { moveFocus: false }
      );
    await flushMicrotasks(12);

    const known = (value, unit) => ({
      status: "known",
      value,
      unit,
      basis: null
    });
    const baseTime = Date.now();
    const at = offset =>
      new Date(
        baseTime + offset
      ).toISOString();
    const confirmed = offset => ({
      userInitiated: true,
      userConfirmed: true,
      at: at(offset)
    });

    const food =
      await libraryRuntime.window
        .TodayNutritionLibrary
        .createFood(
          {
            foodId: "food:browser-yogurt",
            name: "Yoğurt",
            servingBasis: known(100, "g"),
            nutrients: {
              energy: known(60, "kcal"),
              protein: known(4, "g"),
              carbohydrate: known(5, "g"),
              fat: known(3, "g")
            },
            preparation: "plain",
            tags: ["süt ürünü"],
            constraintTags: [],
            referenceSourceIds: [
              "source:user-entry"
            ],
            nutritionVersion: "browser-v1"
          },
          confirmed(0)
        );
    const recipe =
      await libraryRuntime.window
        .TodayNutritionLibrary
        .createRecipe(
          {
            recipeId:
              "recipe:browser-yogurt-bowl",
            name: "Yoğurt Kasesi",
            yield: known(1, "portion"),
            ingredients: [
              {
                recordId: food.id,
                amount: known(100, "g")
              }
            ],
            preparation: "mixed",
            tags: ["kahvaltı"],
            constraintTags: []
          },
          confirmed(1000)
        );
    const template =
      await libraryRuntime.window
        .TodayNutritionLibrary
        .createMealTemplate(
          {
            templateId:
              "meal-template:browser-morning",
            name: "Sabah Şablonu",
            mealType: "breakfast",
            items: [
              {
                recordId: recipe.id,
                amount: known(1, "portion")
              }
            ],
            tags: ["sabah"],
            constraintTags: []
          },
          confirmed(2000)
        );

    libraryRuntime.libraryFixtures = {
      food,
      recipe,
      template
    };

    const state =
      await libraryRuntime.window
        .TodayNutritionUI
        .refreshLibrary();
    const text =
      libraryRuntime.window.document
        .getElementById(
          "healthLibraryResults"
        ).textContent;

    assert.equal(
      state.library.availableCount,
      3
    );
    assert.match(text, /Yoğurt/);
    assert.match(text, /Yoğurt Kasesi/);
    assert.match(text, /Sabah Şablonu/);
  }
);

test(
  "Health tarif seçimini yalnız Öğünü kaydet onayıyla değişmez kaynak snapshotına dönüştürüyor",
  async () => {
    const search =
      libraryRuntime.window.document
        .getElementById(
          "healthLibrarySearch"
        );
    search.value = "kasesi";
    search.dispatchEvent(
      new libraryRuntime.window.Event(
        "input",
        { bubbles: true }
      )
    );
    const recipe =
      libraryRuntime.libraryFixtures.recipe;
    const button =
      libraryRuntime.window.document
        .querySelector(
          `[data-select-nutrition-library="${recipe.id}"]`
        );

    assert.ok(button);
    button.click();
    assert.equal(
      (
        await libraryRuntime.window
          .TodayNutritionEntry
          .listEntries({
            types: ["meal_entry"]
          })
      ).length,
      0
    );

    libraryRuntime.window.document
      .getElementById(
        "healthMealForm"
      )
      .requestSubmit();
    await flushMicrotasks(20);

    const entries =
      await libraryRuntime.window
        .TodayNutritionEntry
        .listEntries({
          types: ["meal_entry"]
        });
    const entry = entries[0];
    const snapshot =
      await libraryRuntime.window
        .TodayNutritionStorage
        .getRecord(
          entry.payload.itemSnapshotIds[0]
        );
    const trace =
      snapshot.extensions[
        "today.nutrition.entry-snapshot"
      ];

    assert.equal(entries.length, 1);
    assert.equal(
      trace.sourceLibraryRecordId,
      recipe.id
    );
    assert.equal(
      trace.sourceVersion,
      "1.0.0"
    );
    assert.equal(
      snapshot.payload.amount.value,
      1
    );
    assert.equal(
      libraryRuntime.window
        .TodayNutritionUI
        .getState().library.selectedCount,
      0
    );
  }
);

test(
  "Health öğün şablonunu tek çarpanla kaynak izini koruyarak kaydediyor",
  async () => {
    const search =
      libraryRuntime.window.document
        .getElementById(
          "healthLibrarySearch"
        );
    const filter =
      libraryRuntime.window.document
        .getElementById(
          "healthLibraryType"
        );
    search.value = "";
    search.dispatchEvent(
      new libraryRuntime.window.Event(
        "input",
        { bubbles: true }
      )
    );
    filter.value = "meal_template";
    filter.dispatchEvent(
      new libraryRuntime.window.Event(
        "change",
        { bubbles: true }
      )
    );
    const template =
      libraryRuntime.libraryFixtures.template;
    libraryRuntime.window.document
      .querySelector(
        `[data-select-nutrition-library="${template.id}"]`
      )
      .click();
    libraryRuntime.window.document
      .getElementById(
        "healthMealForm"
      )
      .requestSubmit();
    await flushMicrotasks(20);

    const entries =
      await libraryRuntime.window
        .TodayNutritionEntry
        .listEntries({
          types: ["meal_entry"]
        });
    const templateEntry = entries.find(
      record =>
        record.extensions[
          "today.nutrition.entry"
        ].sourceTemplateId === template.id
    );

    assert.ok(templateEntry);
    assert.equal(
      templateEntry.extensions[
        "today.nutrition.entry"
      ].captureMode,
      "template"
    );
    assert.equal(
      templateEntry.payload.itemSnapshotIds
        .length,
      1
    );
  }
);

test(
  "Health Kütüphanem formu eksik makroları uydurmadan gerçek besin oluşturuyor",
  async () => {
    libraryManagerRuntime =
      await createRuntime();
    libraryManagerRuntime.window
      .TodayRouter.navigate(
        "health",
        { moveFocus: false }
      );
    await flushMicrotasks(14);

    click(
      libraryManagerRuntime.window,
      "#btnHealthNewFood"
    );
    libraryManagerRuntime.window.document
      .getElementById(
        "healthLibraryEditorName"
      ).value = "Ev yoğurdu";
    libraryManagerRuntime.window.document
      .getElementById(
        "healthLibraryEditorAmount"
      ).value = "100";
    libraryManagerRuntime.window.document
      .getElementById(
        "healthLibraryEditorUnit"
      ).value = "g";
    libraryManagerRuntime.window.document
      .getElementById(
        "healthLibraryEnergy"
      ).value = "61";
    libraryManagerRuntime.window.document
      .getElementById(
        "healthLibraryEditor"
      ).requestSubmit();
    await flushMicrotasks(24);

    const snapshot =
      await libraryManagerRuntime.window
        .TodayNutritionLibrary
        .getSnapshot();
    const food = snapshot.foods[0];

    libraryManagerRuntime.managerFixtures = {
      food
    };
    assert.equal(
      snapshot.counts.activeFoods,
      1
    );
    assert.equal(
      food.payload.nutrients.energy.value,
      61
    );
    assert.equal(
      food.payload.nutrients.protein.status,
      "unknown"
    );
    assert.equal(
      food.payload.nutrients.protein.value,
      null
    );
    assert.match(
      libraryManagerRuntime.window.document
        .getElementById(
          "healthLibraryManageList"
        ).textContent,
      /Ev yoğurdu/
    );
  }
);

test(
  "Health besin düzenlemesi geçmiş sürümü silmeden yeni sürüm oluşturuyor",
  async () => {
    const food =
      libraryManagerRuntime
        .managerFixtures.food;
    click(
      libraryManagerRuntime.window,
      `[data-edit-nutrition-library="${food.id}"]`
    );
    await flushMicrotasks(8);
    libraryManagerRuntime.window.document
      .getElementById(
        "healthLibraryEditorName"
      ).value = "Ev yoğurdu güncel";
    libraryManagerRuntime.window.document
      .getElementById(
        "healthLibraryEditor"
      ).requestSubmit();
    await flushMicrotasks(24);

    const snapshot =
      await libraryManagerRuntime.window
        .TodayNutritionLibrary
        .getSnapshot();
    const current = snapshot.foods[0];
    const history =
      await libraryManagerRuntime.window
        .TodayNutritionLibrary
        .getVersionHistory(current.id);

    libraryManagerRuntime.managerFixtures.food =
      current;
    assert.equal(
      current.payload.version,
      "1.0.1"
    );
    assert.equal(history.length, 2);
    assert.equal(
      history[1].recordStatus,
      "superseded"
    );
  }
);

test(
  "Health tarif formu güncel besin sürümünden değişmez bileşen snapshotı üretiyor",
  async () => {
    const food =
      libraryManagerRuntime
        .managerFixtures.food;
    click(
      libraryManagerRuntime.window,
      "#btnHealthNewRecipe"
    );
    libraryManagerRuntime.window.document
      .getElementById(
        "healthLibraryEditorName"
      ).value = "Yoğurt kasesi";
    click(
      libraryManagerRuntime.window,
      `[data-add-recipe-ingredient="${food.id}"]`
    );
    libraryManagerRuntime.window.document
      .querySelector(
        `[data-recipe-ingredient-amount="${food.id}"]`
      ).value = "150";
    libraryManagerRuntime.window.document
      .getElementById(
        "healthLibraryEditor"
      ).requestSubmit();
    await flushMicrotasks(26);

    const snapshot =
      await libraryManagerRuntime.window
        .TodayNutritionLibrary
        .getSnapshot();
    const recipe = snapshot.recipes[0];
    const item =
      await libraryManagerRuntime.window
        .TodayNutritionStorage.getRecord(
          recipe.payload
            .ingredientSnapshotIds[0]
        );

    libraryManagerRuntime.managerFixtures.recipe =
      recipe;
    libraryManagerRuntime.managerFixtures
      .ingredientSnapshot = clone(item);
    assert.equal(
      item.payload.referenceId,
      food.id
    );
    assert.equal(
      item.payload.sourceVersion,
      "1.0.1"
    );
    assert.equal(
      item.payload.amount.value,
      150
    );
  }
);

test(
  "Health tarif arşivleme ve geri alma akışı bileşen snapshotını değiştirmiyor",
  async () => {
    const recipe =
      libraryManagerRuntime
        .managerFixtures.recipe;
    click(
      libraryManagerRuntime.window,
      `[data-archive-nutrition-library="${recipe.id}"]`
    );
    await flushMicrotasks(22);
    let snapshot =
      await libraryManagerRuntime.window
        .TodayNutritionLibrary
        .getSnapshot();

    assert.equal(
      snapshot.counts.activeRecipes,
      0
    );
    click(
      libraryManagerRuntime.window,
      `[data-restore-nutrition-library="${recipe.id}"]`
    );
    await flushMicrotasks(22);
    snapshot =
      await libraryManagerRuntime.window
        .TodayNutritionLibrary
        .getSnapshot();
    const item =
      await libraryManagerRuntime.window
        .TodayNutritionStorage.getRecord(
          recipe.payload
            .ingredientSnapshotIds[0]
        );

    assert.equal(
      snapshot.counts.activeRecipes,
      1
    );
    assert.deepEqual(
      clone(item),
      libraryManagerRuntime
        .managerFixtures
        .ingredientSnapshot
    );
  }
);

test(
  "Health bugünün planını gösterip yalnız Tükettim onayıyla tüketim kaydına çeviriyor",
  async () => {
    const at = new Date().toISOString();
    const date = at.slice(0, 10);
    const graph =
      await normal.window
        .TodayNutritionPlanning
        .createPlan(
          {
            startDate: date,
            endDate: date,
            title: "Bugünün planı",
            timeZone:
              "Europe/Istanbul",
            meals: [
              {
                plannedFor: at,
                mealType: "dinner",
                customItems: [
                  {
                    name: "Sebzeli makarna"
                  }
                ]
              }
            ]
          },
          {
            userInitiated: true,
            userConfirmed: true,
            at,
            clientOperationId:
              "browser-health-plan-1"
          }
        );

    await normal.window
      .TodayNutritionUI.refresh();

    const plannedMealId =
      graph.plannedMeals[0].id;
    const button =
      normal.window.document
        .querySelector(
          `[data-consume-planned-meal="${plannedMealId}"]`
        );

    assert.ok(button);
    assert.match(
      normal.window.document
        .getElementById(
          "healthPlannedMeals"
        ).textContent,
      /Sebzeli makarna/
    );

    button.click();
    await flushMicrotasks(20);

    const linked =
      await normal.window
        .TodayNutritionPlanning
        .listPlannedMeals({
          statuses: ["linked"]
        });

    assert.equal(linked.length, 1);
    assert.equal(
      normal.window.TodayNutritionUI
        .getState().summary
        .pendingPlanCount,
      0
    );
    assert.equal(
      normal.window.TodayNutritionUI
        .getState().summary.mealCount,
      2
    );
  }
);

test(
  "Health beslenme yazmaları Core localStorage verisini değiştirmiyor",
  async () => {
    const before = storageSnapshot(
      normal.window.localStorage
    );

    click(
      normal.window,
      '[data-health-water-ml="500"]'
    );
    await flushMicrotasks(16);

    assert.deepEqual(
      storageSnapshot(
        normal.window.localStorage
      ),
      before
    );
    assert.equal(
      normal.window.TodayNutritionUI
        .getState().summary.waterMl,
      750
    );
  }
);

test(
  "Health geçmiş gün gezinmesi gerçek IndexedDB kaydını salt okunur gösteriyor",
  async () => {
    historyRuntime = await createRuntime();
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(14, 15, 0, 0);

    await historyRuntime.window
      .TodayNutritionEntry
      .logHydration(
        {
          beverageType: "water",
          amount: {
            status: "known",
            value: 250,
            unit: "ml",
            basis: null
          },
          consumedAt:
            yesterday.toISOString()
        },
        {
          userInitiated: true,
          userConfirmed: true,
          at: now.toISOString(),
          clientOperationId:
            "browser-history-water-1"
        }
      );

    historyRuntime.window.TodayRouter
      .navigate("health", {
        moveFocus: false
      });
    await flushMicrotasks(14);
    click(
      historyRuntime.window,
      "#btnHealthPreviousDay"
    );
    await flushMicrotasks(18);

    const state = historyRuntime.window
      .TodayNutritionUI.getState();
    assert.equal(state.isToday, false);
    assert.equal(state.summary.waterMl, 250);
    assert.equal(
      historyRuntime.window.document
        .querySelector(
          '[data-health-water-ml="250"]'
        ).disabled,
      true
    );
    assert.match(
      historyRuntime.window.document
        .getElementById(
          "healthCurrentOnlyNote"
        ).textContent,
      /yalnız bugün/
    );
  }
);

test(
  "Health Kaldır işlemi gerçek tüketimi silmeden arşivliyor",
  async () => {
    const archiveButton =
      historyRuntime.window.document
        .querySelector(
          "[data-archive-nutrition-entry]"
        );
    assert.ok(archiveButton);
    const entryId = archiveButton.dataset
      .archiveNutritionEntry;

    archiveButton.click();
    await flushMicrotasks(22);

    const stored = await historyRuntime.window
      .TodayNutritionStorage
      .getRecord(entryId);
    const history = stored.extensions[
      "today.nutrition.history"
    ];

    assert.equal(
      stored.recordStatus,
      "archived"
    );
    assert.equal(
      history.events.at(-1).action,
      "archive"
    );
    assert.equal(
      historyRuntime.window
        .TodayNutritionUI.getState()
        .summary.waterMl,
      0
    );
    assert.equal(
      historyRuntime.window.document
        .getElementById(
          "healthArchivedSection"
        ).hidden,
      false
    );
  }
);

test(
  "Health Geri al işlemi arşivlenmiş tüketimi yeniden etkinleştiriyor",
  async () => {
    const restoreButton =
      historyRuntime.window.document
        .querySelector(
          "[data-restore-nutrition-entry]"
        );
    assert.ok(restoreButton);
    const entryId = restoreButton.dataset
      .restoreNutritionEntry;

    restoreButton.click();
    await flushMicrotasks(22);

    const stored = await historyRuntime.window
      .TodayNutritionStorage
      .getRecord(entryId);
    const events = stored.extensions[
      "today.nutrition.history"
    ].events;

    assert.equal(stored.recordStatus, "active");
    assert.deepEqual(
      Array.from(
        events.map(event => event.action)
      ),
      ["archive", "restore"]
    );
    assert.equal(
      historyRuntime.window
        .TodayNutritionUI.getState()
        .summary.waterMl,
      250
    );
  }
);

test(
  "Health Bugün düğmesi geçmişten bugüne dönüp gelecek günü kapatıyor",
  async () => {
    click(
      historyRuntime.window,
      "#btnHealthToday"
    );
    await flushMicrotasks(16);

    assert.equal(
      historyRuntime.window
        .TodayNutritionUI.getState().isToday,
      true
    );
    assert.equal(
      historyRuntime.window.document
        .getElementById(
          "btnHealthNextDay"
        ).disabled,
      true
    );
    assert.equal(
      historyRuntime.window.document
        .getElementById(
          "healthCurrentOnlyNote"
        ).hidden,
      true
    );
  }
);

test(
  "Core seçimi hem erişilebilir kontrolde hem iki veri katmanında kaydediliyor",
  () => {
    normal.window.TodayRouter
      .navigate(
        "pick",
        {
          moveFocus: false
        }
      );
    const choice = click(
      normal.window,
      '[data-choice="B"]'
    );
    const today =
      normal.window.TodayDay
        .todayKey();
    const legacyStore =
      parseStorage(
        normal.window,
        "today_app_v10"
      );
    const v2Store =
      parseStorage(
        normal.window,
        "today_store_v2"
      );

    assert.equal(
      choice.getAttribute(
        "aria-checked"
      ),
      "true"
    );
    assert.equal(
      legacyStore.days[today]
        .choice,
      "B"
    );
    assert.equal(
      v2Store.days[today]
        .choice,
      "B"
    );
  }
);

test(
  "Core rengi iki veri katmanında ve vurgu renginde korunuyor",
  () => {
    const color = click(
      normal.window,
      '[data-color="blue"]'
    );
    const today =
      normal.window.TodayDay
        .todayKey();
    const legacyStore =
      parseStorage(
        normal.window,
        "today_app_v10"
      );
    const v2Store =
      parseStorage(
        normal.window,
        "today_store_v2"
      );

    assert.equal(
      color.getAttribute(
        "aria-pressed"
      ),
      "true"
    );
    assert.equal(
      legacyStore.days[today]
        .color,
      "blue"
    );
    assert.equal(
      v2Store.days[today]
        .color,
      "blue"
    );
  }
);

test(
  "Core notu gecikmeli kayıt sonrasında veri kaybı olmadan saklanıyor",
  async () => {
    const note =
      normal.window.document
        .getElementById("note");

    note.value =
      "Bugün; net\nikinci satır";
    note.dispatchEvent(
      new normal.window.Event(
        "input",
        {
          bubbles: true
        }
      )
    );
    await wait(520);

    const today =
      normal.window.TodayDay
        .todayKey();
    const legacyStore =
      parseStorage(
        normal.window,
        "today_app_v10"
      );
    const v2Store =
      parseStorage(
        normal.window,
        "today_store_v2"
      );

    assert.equal(
      legacyStore.days[today]
        .note,
      note.value
    );
    assert.equal(
      v2Store.days[today]
        .note,
      note.value
    );
  }
);

test(
  "Takvim rotası bugünün kaydını açıklayıcı etiketle gösteriyor",
  () => {
    click(
      normal.window,
      "#btnCalendar"
    );
    const todayCell =
      normal.window.document
        .querySelector(
          '[aria-current="date"]'
        );

    assert.equal(
      normal.window.TodayRouter
        .getState().route,
      "calendar"
    );
    assert.ok(todayCell);
    assert.match(
      todayCell.getAttribute(
        "aria-label"
      ),
      /Her şey çok net/
    );
    assert.match(
      todayCell.getAttribute(
        "aria-label"
      ),
      /renk Mavi/
    );
    assert.match(
      todayCell.getAttribute(
        "aria-label"
      ),
      /not var/
    );
  }
);

test(
  "Takvimde yalnız bugün düzenlenebilir kalıyor",
  () => {
    const cells = [
      ...normal.window.document
        .querySelectorAll(
          '#calGrid [role="gridcell"]'
        )
    ].filter(
      cell =>
        cell.getAttribute(
          "aria-hidden"
        ) !== "true"
    );
    const editable =
      cells.filter(
        cell =>
          cell.getAttribute(
            "aria-disabled"
          ) === "false"
      );

    assert.equal(
      editable.length,
      1
    );
    assert.equal(
      editable[0].getAttribute(
        "aria-current"
      ),
      "date"
    );
    assert.ok(
      cells
        .filter(
          cell =>
            cell !==
            editable[0]
        )
        .every(
          cell =>
            cell.getAttribute(
              "aria-disabled"
            ) === "true"
        )
    );
  }
);

test(
  "Takvimde bugüne basmak Core düzenleme görünümüne döndürüyor",
  async () => {
    click(
      normal.window,
      '[aria-current="date"]'
    );
    await wait(20);

    assert.equal(
      normal.window.TodayRouter
        .getState().route,
      "pick"
    );
  }
);

test(
  "İstatistik rotası mevcut Takvim görünümündeki paneli açıyor",
  () => {
    click(
      normal.window,
      "#btnStats"
    );

    assert.equal(
      normal.window.TodayRouter
        .getState().route,
      "statistics"
    );
    assert.equal(
      normal.window.document
        .getElementById(
          "accStats"
        )
        .classList
        .contains("open"),
      true
    );
    assert.equal(
      normal.window.document
        .getElementById(
          "accStatsBody"
        ).hidden,
      false
    );
  }
);

test(
  "İstatistik grafiği özet metni ve tek aktif mod üretir",
  () => {
    const summary =
      normal.window.document
        .getElementById(
          "chartSummary"
        ).textContent;
    const activeModes = [
      ...normal.window.document
        .querySelectorAll(
          ".mode"
        )
    ].filter(
      button =>
        button.getAttribute(
          "aria-pressed"
        ) === "true"
    );

    assert.match(
      summary,
      /birikimli giriş sayısı/
    );
    assert.equal(
      activeModes.length,
      1
    );
    assert.equal(
      activeModes[0].dataset.mode,
      "hour"
    );
  }
);

test(
  "İstatistik zaman modu erişilebilir seçimi güncelliyor",
  () => {
    const dayMode = click(
      normal.window,
      '[data-mode="day"]'
    );

    assert.equal(
      dayMode.getAttribute(
        "aria-pressed"
      ),
      "true"
    );
    assert.match(
      normal.window.document
        .getElementById(
          "chartLabel"
        ).textContent,
      /Son 7 gün/
    );
  }
);

test(
  "Ayarlar rotası aynı fiziksel görünümde doğru paneli açıyor",
  () => {
    click(
      normal.window,
      "#btnOpenSettings"
    );

    assert.equal(
      normal.window.TodayRouter
        .getState().route,
      "settings"
    );
    assert.equal(
      normal.window.document
        .getElementById(
          "accSettings"
        )
        .classList
        .contains("open"),
      true
    );
    assert.equal(
      normal.window.document
        .getElementById(
          "accStatsBody"
        ).hidden,
      true
    );
  }
);

test(
  "Tema değişikliği DOM, legacy state ve v2 store içinde birlikte korunuyor",
  () => {
    const select =
      normal.window.document
        .getElementById(
          "themeSelect"
        );

    select.value = "dark";
    select.dispatchEvent(
      new normal.window.Event(
        "change",
        {
          bubbles: true
        }
      )
    );

    assert.equal(
      normal.window.document
        .documentElement
        .getAttribute(
          "data-theme"
        ),
      "dark"
    );
    assert.equal(
      parseStorage(
        normal.window,
        "today_app_v10"
      ).theme,
      "dark"
    );
    assert.equal(
      parseStorage(
        normal.window,
        "today_store_v2"
      ).settings.theme,
      "dark"
    );
  }
);

test(
  "CSV dışa aktarma Türkçe başlıkları ve güvenli not metnini üretir",
  async () => {
    click(
      normal.window,
      "#btnExport"
    );

    assert.equal(
      normal.downloads.length,
      1
    );

    const download =
      normal.downloads[0];
    const csv =
      await download.blob.text();
    const today =
      normal.window.TodayDay
        .todayKey();

    assert.equal(
      download.filename,
      `today-rapor-${today}.csv`
    );
    assert.equal(
      csv.split("\n")[0],
      "Tarih;Seçim;Renk;Not"
    );
    assert.ok(
      csv.includes(
        `${today};Her şey çok net;Mavi;Bugün  net ikinci satır`
      )
    );
  }
);

test(
  "CSV dışa aktarma kullanıcı verisini değiştirmiyor",
  () => {
    const before =
      storageSnapshot(
        normal.window
          .localStorage
      );

    click(
      normal.window,
      "#btnExport"
    );

    assert.deepEqual(
      storageSnapshot(
        normal.window
          .localStorage
      ),
      before
    );
  }
);

test(
  "Yeniden açılış Core seçimi, renk, not ve temayı koruyor",
  async () => {
    const seed =
      storageSnapshot(
        normal.window
          .localStorage
      );

    reloaded =
      await createRuntime({
        storage: seed
      });
    reloaded.window.TodayRouter
      .navigate(
        "pick",
        {
          moveFocus: false
        }
      );

    const today =
      reloaded.window.TodayDay
        .todayKey();
    const state =
      parseStorage(
        reloaded.window,
        "today_app_v10"
      );

    assert.equal(
      state.days[today].choice,
      "B"
    );
    assert.equal(
      state.days[today].color,
      "blue"
    );
    assert.equal(
      state.days[today].note,
      "Bugün; net\nikinci satır"
    );
    assert.equal(
      state.theme,
      "dark"
    );
    assert.equal(
      reloaded.window.document
        .getElementById(
          "themeSelect"
        ).value,
      "dark"
    );
  }
);

test(
  "İkinci açılışta Migration güncel store'u yeniden migrate etmiyor",
  () => {
    const result =
      reloaded.window
        .TodayMigration
        .getStatus()
        .lastResult;

    assert.equal(
      result.success,
      true
    );
    assert.equal(
      result.migrated,
      false
    );
    assert.equal(
      result.skipped,
      true
    );
    assert.equal(
      result.currentSchemaVersion,
      2
    );
  }
);

test(
  "Legacy soğuk açılış seçim, renk, not, tema ve kaynak anahtarı koruyor",
  async () => {
    const today = (() => {
      const date = new Date();
      const pad = value =>
        String(value).padStart(
          2,
          "0"
        );

      return (
        `${date.getFullYear()}-` +
        `${pad(date.getMonth() + 1)}-` +
        pad(date.getDate())
      );
    })();
    const legacySeed = {
      v: 10,
      theme: "contrast",
      days: {
        [today]: {
          choice: "C",
          color: "red",
          note:
            "Legacy kayıt"
        }
      },
      logs: {}
    };

    legacy =
      await createRuntime({
        storage: {
          today_app_v10:
            legacySeed
        }
      });

    const legacyAfter =
      parseStorage(
        legacy.window,
        "today_app_v10"
      );
    const v2After =
      parseStorage(
        legacy.window,
        "today_store_v2"
      );

    assert.ok(
      legacy.window.localStorage
        .getItem(
          "today_app_v10"
        )
    );
    assert.equal(
      legacyAfter.days[today]
        .choice,
      "C"
    );
    assert.equal(
      v2After.days[today]
        .choice,
      "C"
    );
    assert.equal(
      v2After.days[today]
        .color,
      "red"
    );
    assert.equal(
      v2After.days[today]
        .note,
      "Legacy kayıt"
    );
    assert.equal(
      v2After.settings.theme,
      "contrast"
    );
  }
);

test(
  "Legacy geçişi tek güvenlik yedeği ve tamamlanmış migration metadata'sı üretir",
  () => {
    const store =
      parseStorage(
        legacy.window,
        "today_store_v2"
      );

    assert.ok(
      legacy.window.localStorage
        .getItem(
          "today_store_v2_backup"
        )
    );
    assert.equal(
      store.schemaVersion,
      2
    );
    assert.equal(
      store.migration.completed,
      true
    );
    assert.ok(
      store.migration.sourceKeys
        .includes(
          "today_app_v10"
        )
    );
  }
);

test(
  "Eksik kritik modül başlangıcı boş ekran yerine tek erişilebilir hata yüzeyi gösteriyor",
  async () => {
    const protectedSeed = {
      v: 10,
      theme: "dark",
      days: {
        "2026-07-30": {
          choice: "A",
          color: "navy",
          note:
            "KORUNMASI-GEREKEN-NOT"
        }
      },
      logs: {}
    };

    broken =
      await createRuntime({
        storage: {
          today_app_v10:
            protectedSeed
        },
        skipScripts: [
          "./modules/adapter-interfaces.js"
        ]
      });

    const surfaces =
      broken.window.document
        .querySelectorAll(
          "#todayStartupError"
        );

    assert.equal(
      broken.window.TodayStartup
        .getStatus().phase,
      "failed"
    );
    assert.equal(
      surfaces.length,
      1
    );
    assert.equal(
      surfaces[0].getAttribute(
        "role"
      ),
      "alert"
    );
    assert.equal(
      surfaces[0].getAttribute(
        "aria-live"
      ),
      "assertive"
    );
    assert.match(
      surfaces[0].textContent,
      /Kayıtların silinmedi/
    );
  }
);

test(
  "Başlangıç hatası mevcut kullanıcı kaydını değiştirmiyor",
  () => {
    const stored =
      parseStorage(
        broken.window,
        "today_app_v10"
      );

    assert.equal(
      stored.days[
        "2026-07-30"
      ].note,
      "KORUNMASI-GEREKEN-NOT"
    );
    assert.equal(
      broken.window.localStorage
        .getItem(
          "today_store_v2"
        ),
      null
    );
  }
);

test(
  "Merkezi başlangıç hata kaydı kullanıcı notunu taşımıyor",
  () => {
    const errorLog =
      JSON.stringify(
        broken.window.TodayErrors
          .getLog()
      );

    assert.equal(
      errorLog.includes(
        "KORUNMASI-GEREKEN-NOT"
      ),
      false
    );
    assert.ok(
      broken.window.TodayErrors
        .getLog()
        .some(
          entry =>
            entry.code ===
            "TODAY-STARTUP-001"
        )
    );
  }
);

test(
  "Service Worker desteği olmadığında uygulama çevrimiçi akışını hazır tutuyor",
  () => {
    assert.equal(
      normal.window.TodayStartup
        .getStatus()
        .serviceWorker,
      "unsupported"
    );
    assert.equal(
      normal.window.TodayStartup
        .getStatus().phase,
      "ready"
    );
  }
);

test(
  "Bekleyen Service Worker sürümü erişilebilir güncelleme bildirimi gösteriyor",
  async () => {
    const mock =
      createServiceWorkerMock({
        waiting: true
      });

    updateLater =
      await createRuntime({
        serviceWorker: mock
      });
    await flushMicrotasks();

    const notice =
      updateLater.window.document
        .getElementById(
          "todayUpdateNotice"
        );

    assert.ok(notice);
    assert.equal(
      notice.hidden,
      false
    );
    assert.equal(
      notice.getAttribute(
        "role"
      ),
      "status"
    );
    assert.equal(
      notice.getAttribute(
        "aria-live"
      ),
      "polite"
    );
    assert.equal(
      mock.serviceWorker
        .registerCalls.length,
      1
    );
  }
);

test(
  "Daha sonra seçimi worker'a mesaj göndermeden mevcut oturumu sürdürüyor",
  () => {
    const beforeRoute =
      updateLater.window.TodayRouter
        .getState().route;
    const mock =
      updateLater.window.navigator
        .serviceWorker;
    const notice =
      updateLater.window.document
        .getElementById(
          "todayUpdateNotice"
        );

    click(
      updateLater.window,
      "#todayUpdateLater"
    );

    assert.equal(
      notice.hidden,
      true
    );
    assert.equal(
      mock.registerCalls.length,
      1
    );
    assert.equal(
      updateLater.window.TodayRouter
        .getState().route,
      beforeRoute
    );
  }
);

test(
  "Şimdi güncelle seçimi bekleyen worker'a tek etkinleştirme mesajı gönderiyor",
  async () => {
    const mock =
      createServiceWorkerMock({
        waiting: true
      });

    updateNow =
      await createRuntime({
        serviceWorker: mock
      });
    await flushMicrotasks();
    click(
      updateNow.window,
      "#todayUpdateApply"
    );

    assert.deepEqual(
      mock.messages,
      [
        {
          type:
            "TODAY_ACTIVATE_UPDATE"
        }
      ]
    );
    assert.equal(
      updateNow.window.document
        .getElementById(
          "todayUpdateApply"
        ).disabled,
      true
    );
    assert.equal(
      updateNow.window.document
        .getElementById(
          "todayUpdateLater"
        ).disabled,
      true
    );
  }
);

test(
  "Normal tam akış Today kaynaklı beklenmeyen çalışma zamanı hatası üretmiyor",
  () => {
    assert.equal(
      normal.window.TodayErrors
        .getLog().length,
      0
    );
    assert.deepEqual(
      normal.consoleErrors,
      []
    );
    assert.deepEqual(
      normal.jsdomErrors,
      []
    );
  }
);

test(
  "Yeniden açılış sonrasında ana rota zinciri çalışmaya devam ediyor",
  () => {
    reloaded.window.TodayRouter
      .navigate(
        "calendar",
        {
          moveFocus: false
        }
      );
    reloaded.window.TodayRouter
      .navigate(
        "statistics",
        {
          moveFocus: false
        }
      );
    reloaded.window.TodayRouter
      .navigate(
        "settings",
        {
          moveFocus: false
        }
      );

    assert.equal(
      reloaded.window.TodayRouter
        .backTo(
          "statistics",
          {
            moveFocus: false
          }
        ).route,
      "statistics"
    );
    assert.equal(
      reloaded.window.TodayRouter
        .backTo(
          "calendar",
          {
            moveFocus: false
          }
        ).route,
      "calendar"
    );
    assert.equal(
      reloaded.window.TodayRouter
        .backTo(
          "pick",
          {
            moveFocus: false
          }
        ).route,
      "pick"
    );
  }
);

(async () => {
  const results = [];

  for (const current of tests) {
    try {
      await current.callback();
      results.push({
        name: current.name,
        success: true
      });
    } catch (error) {
      results.push({
        name: current.name,
        success: false,
        error:
          error?.stack ||
          error?.message ||
          String(error)
      });
    }
  }

  [
    normal,
    reloaded,
    legacy,
    broken,
    updateLater,
    updateNow,
    historyRuntime,
    libraryRuntime,
    libraryManagerRuntime
  ]
    .filter(Boolean)
    .forEach(runtime =>
      runtime.close()
    );

  results.forEach(result => {
    const prefix =
      result.success
        ? "PASS"
        : "FAIL";
    const suffix =
      result.error
        ? ` — ${result.error}`
        : "";

    console.log(
      `${prefix}: ${result.name}${suffix}`
    );
  });

  const failed =
    results.filter(
      result =>
        !result.success
    );

  console.log(
    `Platform Browser Regression: ${
      results.length -
      failed.length
    }/${results.length} başarılı`
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
})();
