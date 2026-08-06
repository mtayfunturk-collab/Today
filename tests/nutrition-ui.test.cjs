const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  JSDOM
} = require("jsdom");

const SOURCE = fs.readFileSync(
  "modules/nutrition-ui.js",
  "utf8"
);

const FIXTURE = `<!doctype html>
<html lang="tr"><body>
  <main id="healthDashboard">
    <span id="healthTodayLabel"></span>
    <strong id="healthSummaryText"></strong>
    <small id="healthKnowledgeNote" hidden></small>
    <button id="btnHealthRefresh" data-health-action></button>
    <button id="btnHealthPreviousDay" data-health-action></button>
    <button id="btnHealthNextDay" data-health-action></button>
    <button id="btnHealthToday" data-health-action></button>
    <p id="healthCurrentOnlyNote" hidden></p>
    <button data-health-water-ml="250" data-health-action data-health-current-action>250</button>
    <button data-health-water-ml="500" data-health-action data-health-current-action>500</button>
    <form id="healthMealForm">
      <select id="healthMealType">
        <option value="breakfast">Kahvaltı</option>
        <option value="lunch">Öğle</option>
        <option value="dinner">Akşam</option>
        <option value="snack">Ara öğün</option>
        <option value="other">Diğer</option>
      </select>
      <input id="healthMealName" />
      <input id="healthLibrarySearch" data-health-current-action />
      <select id="healthLibraryType" data-health-current-action>
        <option value="all">Tümü</option>
        <option value="food_version">Besin</option>
        <option value="recipe_version">Tarif</option>
        <option value="meal_template">Öğün şablonu</option>
      </select>
      <span id="healthLibraryResultCount"></span>
      <ol id="healthLibraryResults"></ol>
      <span id="healthLibrarySelectedCount"></span>
      <ol id="healthLibrarySelected"></ol>
      <small id="healthLibraryNote"></small>
      <button id="btnHealthMealSubmit" data-health-action></button>
    </form>
    <span id="healthPlanCount"></span>
    <ol id="healthPlannedMeals"></ol>
    <span id="healthEntryCount"></span>
    <ol id="healthEntryList"></ol>
    <section id="healthArchivedSection" hidden>
      <span id="healthArchivedCount"></span>
      <ol id="healthArchivedList"></ol>
    </section>
    <div id="healthStatus"></div>
  </main>
</body></html>`;

function clone(value) {
  return value === undefined
    ? undefined
    : JSON.parse(JSON.stringify(value));
}

function isoAt(hour, minute = 0) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function mealRecord(
  id,
  options = {}
) {
  const consumedAt =
    options.consumedAt || isoAt(9);

  return {
    id,
    type: "meal_entry",
    eventAt: consumedAt,
    recordStatus:
      options.recordStatus || "active",
    source: options.source || {
      kind: "manual"
    },
    payload: {
      consumedAt,
      mealType:
        options.mealType || "breakfast",
      itemSnapshotIds:
        options.itemSnapshotIds || [],
      coverage:
        options.coverage || "unspecified",
      plannedMealId: null
    }
  };
}

function hydrationRecord(
  id,
  value,
  unit = "ml",
  status = "known"
) {
  const consumedAt = isoAt(10);

  return {
    id,
    type: "hydration_entry",
    eventAt: consumedAt,
    recordStatus: "active",
    source: { kind: "manual" },
    payload: {
      consumedAt,
      beverageType: "water",
      amount: {
        status,
        value:
          status === "unknown"
            ? null
            : value,
        unit:
          status === "unknown"
            ? unit
            : unit,
        basis:
          status === "estimated"
            ? "kullanıcı tahmini"
            : null
      }
    }
  };
}

function plannedRecord(
  id,
  options = {}
) {
  const plannedFor =
    options.plannedFor || isoAt(13);

  return {
    id,
    type: "planned_meal",
    eventAt: plannedFor,
    recordStatus: "active",
    source: { kind: "manual" },
    payload: {
      plannedFor,
      mealType:
        options.mealType || "lunch",
      itemSnapshotIds:
        options.itemSnapshotIds || [],
      status:
        options.status || "planned",
      mealEntryId:
        options.status === "linked"
          ? "meal-linked"
          : null
    }
  };
}

function snapshot(id, name) {
  return {
    id,
    type: "meal_item_snapshot",
    payload: { name }
  };
}

function libraryRecord(
  id,
  type,
  name,
  options = {}
) {
  const payload = {
    name,
    ...(type === "food_version"
      ? {
          servingBasis:
            options.amount || {
              status: "known",
              value: 100,
              unit: "g",
              basis: null
            }
        }
      : {}),
    ...(type === "recipe_version"
      ? {
          yield:
            options.amount || {
              status: "known",
              value: 1,
              unit: "portion",
              basis: null
            }
        }
      : {}),
    ...(type === "meal_template"
      ? {
          mealType:
            options.mealType || "other"
        }
      : {})
  };

  return {
    id,
    type,
    recordStatus:
      options.recordStatus || "active",
    verificationStatus:
      options.verificationStatus ||
      "user_confirmed",
    knowledgeStatus:
      options.knowledgeStatus || "known",
    source:
      options.source || { kind: "manual" },
    payload,
    extensions: {
      "today.nutrition.library": {
        tags: options.tags || [],
        preparation:
          options.preparation || null
      }
    }
  };
}

function createRuntime(options = {}) {
  const dom = new JSDOM(
    options.fixture || FIXTURE,
    {
      url: "https://today.test/",
      runScripts: "outside-only",
      pretendToBeVisual: true
    }
  );
  const { window } = dom;
  const state = {
    entries: clone(options.entries || []),
    plannedMeals:
      clone(options.plannedMeals || []),
    libraryRecords:
      clone(options.libraryRecords || []),
    snapshots: new Map(
      (options.snapshots || []).map(
        record => [record.id, clone(record)]
      )
    )
  };
  const calls = {
    listEntries: [],
    listPlannedMeals: [],
    getRecord: [],
    logWater: [],
    logMeal: [],
    consumePlannedMeal: [],
    loadDay: [],
    archiveEntry: [],
    restoreEntry: [],
    getLibrarySnapshot: []
  };
  let snapshotCounter = 0;

  window.structuredClone =
    globalThis.structuredClone;
  window.confirm = () =>
    options.confirmResult !== false;
  window.TodayNutritionCalculations = {
    convertMeasurement(amount, unit) {
      if (unit !== "ml") {
        throw new Error("unsupported target");
      }

      const factors = {
        ml: 1,
        cl: 10,
        dl: 100,
        l: 1000
      };
      const factor = factors[amount.unit];

      if (!factor) {
        throw new Error("incompatible unit");
      }

      return {
        ...clone(amount),
        value:
          amount.value === null
            ? null
            : amount.value * factor,
        unit: "ml"
      };
    }
  };
  window.TodayNutritionStorage = {
    async getRecord(id) {
      calls.getRecord.push(id);

      if (options.failGetRecord) {
        throw new Error("snapshot read failed");
      }

      return clone(
        state.snapshots.get(id) || null
      );
    }
  };
  window.TodayNutritionEntry = {
    async listEntries(query) {
      calls.listEntries.push(clone(query));

      if (options.failOpen) {
        throw Object.assign(
          new Error("entry read failed"),
          {
            todayCode:
              "TODAY-NUTRITION-TEST-READ"
          }
        );
      }

      return clone(
        state.entries.filter(record =>
          (!query.eventFrom ||
            record.eventAt >= query.eventFrom) &&
          (!query.eventTo ||
            record.eventAt <= query.eventTo)
        )
      );
    },

    async logWater(amount, confirmation) {
      calls.logWater.push({
        amount: clone(amount),
        confirmation: clone(confirmation)
      });

      if (options.waterDeferred) {
        await options.waterDeferred.promise;
      }

      if (options.failWater) {
        throw Object.assign(
          new Error("water write failed"),
          {
            todayCode:
              "TODAY-NUTRITION-TEST-WATER"
          }
        );
      }

      const record = hydrationRecord(
        `water-${calls.logWater.length}`,
        amount.value,
        amount.unit,
        amount.status
      );
      record.payload.consumedAt =
        confirmation.at;
      record.eventAt = confirmation.at;
      state.entries.unshift(record);
      return clone(record);
    },

    async logMeal(input, confirmation) {
      calls.logMeal.push({
        input: clone(input),
        confirmation: clone(confirmation)
      });

      if (options.failMeal) {
        throw Object.assign(
          new Error("meal write failed"),
          {
            todayCode:
              "TODAY-NUTRITION-TEST-MEAL"
          }
        );
      }

      const snapshotIds = [];

      (input.customItems || []).forEach(item => {
        snapshotCounter += 1;
        const id =
          `snapshot-${snapshotCounter}`;
        state.snapshots.set(
          id,
          snapshot(id, item.name)
        );
        snapshotIds.push(id);
      });
      (input.items || []).forEach(item => {
        snapshotCounter += 1;
        const id =
          `snapshot-${snapshotCounter}`;
        const source =
          state.libraryRecords.find(
            record =>
              record.id === item.recordId
          );
        state.snapshots.set(
          id,
          snapshot(
            id,
            item.name ||
              source?.payload?.name ||
              "Kütüphane öğesi"
          )
        );
        snapshotIds.push(id);
      });
      if (input.templateId) {
        snapshotCounter += 1;
        const id =
          `snapshot-${snapshotCounter}`;
        const template =
          state.libraryRecords.find(
            record =>
              record.id === input.templateId
          );
        state.snapshots.set(
          id,
          snapshot(
            id,
            template?.payload?.name ||
              "Öğün şablonu"
          )
        );
        snapshotIds.push(id);
      }
      const record = mealRecord(
        `meal-${calls.logMeal.length}`,
        {
          consumedAt: confirmation.at,
          mealType: input.mealType,
          itemSnapshotIds: snapshotIds,
          coverage: input.coverage
        }
      );
      state.entries.unshift(record);
      return clone(record);
    }
  };
  window.TodayNutritionPlanning = {
    async listPlannedMeals(query) {
      calls.listPlannedMeals.push(
        clone(query)
      );
      return clone(
        state.plannedMeals.filter(record =>
          (!query.from ||
            record.eventAt >= query.from) &&
          (!query.to ||
            record.eventAt <= query.to)
        )
      );
    },

    async consumePlannedMeal(
      id,
      overrides,
      confirmation
    ) {
      calls.consumePlannedMeal.push({
        id,
        overrides: clone(overrides),
        confirmation: clone(confirmation)
      });

      if (options.failConsume) {
        throw Object.assign(
          new Error("consume failed"),
          {
            todayCode:
              "TODAY-NUTRITION-TEST-CONSUME"
          }
        );
      }

      const planned =
        state.plannedMeals.find(
          record => record.id === id
        );

      if (planned) {
        planned.payload.status = "linked";
        planned.payload.mealEntryId =
          `linked-${id}`;
      }

      const record = mealRecord(
        `linked-${id}`,
        {
          consumedAt: confirmation.at,
          mealType:
            planned?.payload?.mealType ||
            "other"
        }
      );
      state.entries.unshift(record);
      return clone(record);
    }
  };
  window.TodayNutritionLibrary = {
    async getSnapshot() {
      calls.getLibrarySnapshot.push({});

      if (options.failLibrary) {
        throw Object.assign(
          new Error("library read failed"),
          {
            todayCode:
              "TODAY-NUTRITION-TEST-LIBRARY"
          }
        );
      }

      return clone({
        foods:
          state.libraryRecords.filter(
            record =>
              record.type === "food_version"
          ),
        recipes:
          state.libraryRecords.filter(
            record =>
              record.type === "recipe_version"
          ),
        mealTemplates:
          state.libraryRecords.filter(
            record =>
              record.type === "meal_template"
          )
      });
    }
  };
  const dayKeyFromDate = value => {
    const date = value instanceof window.Date
      ? value
      : new window.Date(value);
    const pad = number =>
      String(number).padStart(2, "0");

    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join("-");
  };
  const dayRange = dayKey => {
    const [year, month, day] = dayKey
      .split("-")
      .map(Number);
    const start = new window.Date(
      year,
      month - 1,
      day,
      0,
      0,
      0,
      0
    );
    const end = new window.Date(
      year,
      month - 1,
      day,
      23,
      59,
      59,
      999
    );

    return {
      start: start.toISOString(),
      end: end.toISOString()
    };
  };
  window.TodayNutritionHistory = {
    dayKeyFromDate,
    isToday(dayKey) {
      return dayKey ===
        dayKeyFromDate(new window.Date());
    },
    shiftDay(dayKey, offset, shiftOptions = {}) {
      const [year, month, day] = dayKey
        .split("-")
        .map(Number);
      const date = new window.Date(
        year,
        month - 1,
        day,
        12
      );
      date.setDate(date.getDate() + offset);
      const shifted = dayKeyFromDate(date);
      const today = dayKeyFromDate(
        new window.Date()
      );

      return shiftOptions.preventFuture &&
        shifted > today
        ? today
        : shifted;
    },
    async loadDay(dayKey) {
      calls.loadDay.push(dayKey);
      const range = dayRange(dayKey);
      const [allEntries, plannedMeals] =
        await Promise.all([
          window.TodayNutritionEntry
            .listEntries({
              eventFrom: range.start,
              eventTo: range.end,
              sortDirection: "desc",
              limit: 500
            }),
          window.TodayNutritionPlanning
            .listPlannedMeals({
              from: range.start,
              to: range.end,
              sortDirection: "asc"
            })
        ]);

      return clone({
        dayKey,
        todayKey: dayKeyFromDate(
          new window.Date()
        ),
        isToday:
          dayKey === dayKeyFromDate(
            new window.Date()
          ),
        range,
        entries: allEntries.filter(
          record =>
            record.recordStatus === "active"
        ),
        archivedEntries:
          allEntries.filter(
            record =>
              record.recordStatus ===
                "archived"
          ),
        plannedMeals
      });
    },
    async archiveEntry(id, confirmation) {
      calls.archiveEntry.push({
        id,
        confirmation: clone(confirmation)
      });

      if (options.failArchive) {
        throw Object.assign(
          new Error("archive failed"),
          {
            todayCode:
              "TODAY-NUTRITION-TEST-ARCHIVE"
          }
        );
      }

      const record = state.entries.find(
        candidate => candidate.id === id
      );

      if (record) {
        record.recordStatus = "archived";
      }

      return clone(record || null);
    },
    async restoreEntry(id, confirmation) {
      calls.restoreEntry.push({
        id,
        confirmation: clone(confirmation)
      });
      const record = state.entries.find(
        candidate => candidate.id === id
      );

      if (record) {
        record.recordStatus = "active";
      }

      return clone(record || null);
    }
  };

  if (options.missingDependency) {
    delete window[
      options.missingDependency
    ];
  }

  window.eval(
    `${SOURCE}\n//# sourceURL=nutrition-ui.js`
  );

  return {
    dom,
    window,
    document: window.document,
    api: window.TodayNutritionUI,
    calls,
    state,
    close() {
      window.close();
    }
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise(
    (resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    }
  );

  return { promise, resolve, reject };
}

async function settle(rounds = 8) {
  for (
    let index = 0;
    index < rounds;
    index += 1
  ) {
    await Promise.resolve();
    await new Promise(resolve =>
      setTimeout(resolve, 0)
    );
  }
}

const tests = [];

function test(name, callback) {
  tests.push({ name, callback });
}

test(
  "UI API v3 ve değişmez yayımlanıyor",
  () => {
    const runtime = createRuntime();
    assert.equal(runtime.api.UI_API_VERSION, 3);
    assert.ok(Object.isFrozen(runtime.api));
    runtime.close();
  }
);

test(
  "UI kural seti sürümlü kimlik taşıyor",
  () => {
    const runtime = createRuntime();
    assert.equal(
      runtime.api.UI_RULESET_ID,
      "today:nutrition:ui:v3"
    );
    runtime.close();
  }
);

test(
  "Öğün ve plan durum etiketleri değişmez",
  () => {
    const runtime = createRuntime();
    assert.ok(
      Object.isFrozen(runtime.api.MEAL_LABELS)
    );
    assert.ok(
      Object.isFrozen(
        runtime.api.PLAN_STATUS_LABELS
      )
    );
    runtime.close();
  }
);

test(
  "Modül yüklenirken veri okunmuyor veya yazılmıyor",
  () => {
    const runtime = createRuntime();
    assert.deepEqual(
      Object.values(runtime.calls)
        .map(values => values.length),
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    );
    runtime.close();
  }
);

test(
  "UI modülü Core localStorage alanına bağlanmıyor",
  () => {
    assert.equal(SOURCE.includes("localStorage"), false);
    assert.equal(SOURCE.includes("today_store_v2"), false);
  }
);

test(
  "UI modülü ağ veya AI sağlayıcısı çağırmıyor",
  () => {
    [
      "fetch(",
      "XMLHttpRequest",
      "WebSocket",
      "TodayAI",
      "TodayConnect"
    ].forEach(text => {
      assert.equal(SOURCE.includes(text), false, text);
    });
  }
);

test(
  "UI besin değeri veya kalori hesaplamıyor",
  () => {
    [
      "calculateMealNutrients",
      "aggregateNutrients",
      "calorie",
      "macro"
    ].forEach(text => {
      assert.equal(SOURCE.includes(text), false, text);
    });
  }
);

test(
  "Geçersiz belge kontrollü UI hatası veriyor",
  () => {
    const runtime = createRuntime();
    assert.throws(
      () => runtime.api.init({ root: {} }),
      error =>
        error.todayCode ===
          "TODAY-NUTRITION-UI-002"
    );
    runtime.close();
  }
);

test(
  "Eksik zorunlu öğe kontrollü UI hatası veriyor",
  () => {
    const runtime = createRuntime({
      fixture: FIXTURE.replace(
        'id="healthSummaryText"',
        'id="removedSummaryText"'
      )
    });
    assert.throws(
      () => runtime.api.init({
        root: runtime.document
      }),
      error =>
        error.todayCode ===
          "TODAY-NUTRITION-UI-002" &&
        error.detail.missing.includes(
          "healthSummaryText"
        )
    );
    runtime.close();
  }
);

test(
  "Hızlı su düğmesi olmayan görünüm reddediliyor",
  () => {
    const runtime = createRuntime({
      fixture: FIXTURE.replaceAll(
        "data-health-water-ml",
        "data-removed-water-ml"
      )
    });
    assert.throws(
      () => runtime.api.init({
        root: runtime.document
      }),
      error =>
        error.todayCode ===
          "TODAY-NUTRITION-UI-002"
    );
    runtime.close();
  }
);

test(
  "Eksik servis bağımlılığı açık hata koduyla duruyor",
  () => {
    const runtime = createRuntime({
      missingDependency:
        "TodayNutritionPlanning"
    });
    assert.throws(
      () => runtime.api.init({
        root: runtime.document
      }),
      error =>
        error.todayCode ===
          "TODAY-NUTRITION-UI-001" &&
        error.detail.missing.some(
          name => name.includes(
            "TodayNutritionPlanning"
          )
        )
    );
    runtime.close();
  }
);

test(
  "Init arayüzü hazır duruma getiriyor",
  () => {
    const runtime = createRuntime();
    const state = runtime.api.init({
      root: runtime.document
    });
    assert.equal(state.initialized, true);
    assert.equal(state.opened, false);
    runtime.close();
  }
);

test(
  "Init kalıcı beslenme deposunu okumuyor",
  () => {
    const runtime = createRuntime();
    runtime.api.init({
      root: runtime.document
    });
    assert.equal(runtime.calls.listEntries.length, 0);
    assert.equal(
      runtime.calls.listPlannedMeals.length,
      0
    );
    runtime.close();
  }
);

test(
  "Init yinelendiğinde aynı olay bağını çoğaltmıyor",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    runtime.api.init({ root: runtime.document });
    runtime.document
      .querySelector('[data-health-water-ml="250"]')
      .click();
    await settle();
    assert.equal(runtime.calls.logWater.length, 1);
    runtime.close();
  }
);

test(
  "Init gün etiketini Türkçe hazırlar",
  () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    assert.notEqual(
      runtime.document
        .getElementById("healthTodayLabel")
        .textContent,
      ""
    );
    runtime.close();
  }
);

test(
  "Init dashboard aria-busy değerini false yapar",
  () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    assert.equal(
      runtime.document
        .getElementById("healthDashboard")
        .getAttribute("aria-busy"),
      "false"
    );
    runtime.close();
  }
);

test(
  "Open görünümü açılmış işaretler ve iki sorguyu çalıştırır",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    const state = await runtime.api.open();
    assert.equal(state.opened, true);
    assert.equal(runtime.calls.listEntries.length, 1);
    assert.equal(
      runtime.calls.listPlannedMeals.length,
      1
    );
    runtime.close();
  }
);

test(
  "Bugün sorgusu yerel günün iki ISO sınırını kullanır",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    const query = runtime.calls.listEntries[0];
    assert.ok(Date.parse(query.eventFrom));
    assert.ok(Date.parse(query.eventTo));
    assert.ok(query.eventFrom < query.eventTo);
    runtime.close();
  }
);

test(
  "Tüketim sorgusu AI taslağını açan seçenek göndermiyor",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    assert.equal(
      runtime.calls.listEntries[0]
        .includeDrafts,
      undefined
    );
    runtime.close();
  }
);

test(
  "Plan sorgusu takvim sırasını artan ister",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    assert.equal(
      runtime.calls.listPlannedMeals[0]
        .sortDirection,
      "asc"
    );
    runtime.close();
  }
);

test(
  "Boş gün özeti sıfırları açık gösterir",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    const text = runtime.document
      .getElementById("healthSummaryText")
      .textContent;
    assert.match(text, /0 öğün/);
    assert.match(text, /0 ml sıvı/);
    assert.match(text, /0 bekleyen plan/);
    runtime.close();
  }
);

test(
  "Boş tüketim listesi veri uydurmayan mesaj gösterir",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    assert.match(
      runtime.document
        .getElementById("healthEntryList")
        .textContent,
      /henüz bir kayıt yok/
    );
    runtime.close();
  }
);

test(
  "Boş plan listesi açık boş durum gösterir",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    assert.match(
      runtime.document
        .getElementById("healthPlannedMeals")
        .textContent,
      /planlanan öğün yok/
    );
    runtime.close();
  }
);

test(
  "Boş listelerin sayaçları sıfır olur",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    assert.equal(
      runtime.document
        .getElementById("healthEntryCount")
        .textContent,
      "0"
    );
    assert.equal(
      runtime.document
        .getElementById("healthPlanCount")
        .textContent,
      "0"
    );
    runtime.close();
  }
);

test(
  "Özet durumu dışarıdan değiştirilemiyor",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    const state = await runtime.api.open();
    assert.ok(Object.isFrozen(state.summary));
    runtime.close();
  }
);

test(
  "Bilinen mililitre kayıtları gün toplamına eklenir",
  async () => {
    const runtime = createRuntime({
      entries: [
        hydrationRecord("w1", 250),
        hydrationRecord("w2", 500)
      ]
    });
    runtime.api.init({ root: runtime.document });
    const state = await runtime.api.open();
    assert.equal(state.summary.waterMl, 750);
    runtime.close();
  }
);

test(
  "Litre kaydı mililitre toplamına güvenli çevrilir",
  async () => {
    const runtime = createRuntime({
      entries: [
        hydrationRecord("w1", 1.5, "l")
      ]
    });
    runtime.api.init({ root: runtime.document });
    const state = await runtime.api.open();
    assert.equal(state.summary.waterMl, 1500);
    runtime.close();
  }
);

test(
  "Tahmini sıvı toplamı yaklaşık olarak etiketlenir",
  async () => {
    const runtime = createRuntime({
      entries: [
        hydrationRecord(
          "w1",
          300,
          "ml",
          "estimated"
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    assert.match(
      runtime.document
        .getElementById("healthSummaryText")
        .textContent,
      /yaklaşık 300 ml/
    );
    runtime.close();
  }
);

test(
  "Bilinmeyen sıvı miktarı sıfır katkı sayılmaz",
  async () => {
    const runtime = createRuntime({
      entries: [
        hydrationRecord(
          "w1",
          null,
          "ml",
          "unknown"
        ),
        hydrationRecord("w2", 250)
      ]
    });
    runtime.api.init({ root: runtime.document });
    const state = await runtime.api.open();
    assert.equal(state.summary.waterMl, 250);
    assert.equal(
      state.summary.unknownHydrationCount,
      1
    );
    runtime.close();
  }
);

test(
  "Bilinmeyen sıvı toplam dışında tutulduğunu açıklar",
  async () => {
    const runtime = createRuntime({
      entries: [
        hydrationRecord(
          "w1",
          null,
          "ml",
          "unknown"
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    const note = runtime.document
      .getElementById("healthKnowledgeNote");
    assert.equal(note.hidden, false);
    assert.match(note.textContent, /toplama eklenmedi/);
    runtime.close();
  }
);

test(
  "Öğün sayısı sıvı kayıtlarından ayrı tutulur",
  async () => {
    const runtime = createRuntime({
      entries: [
        mealRecord("m1"),
        hydrationRecord("w1", 250)
      ]
    });
    runtime.api.init({ root: runtime.document });
    const state = await runtime.api.open();
    assert.equal(state.summary.mealCount, 1);
    assert.equal(state.summary.hydrationCount, 1);
    runtime.close();
  }
);

test(
  "Bugünkü kayıt sayacı öğün ve sıvıyı birlikte sayar",
  async () => {
    const runtime = createRuntime({
      entries: [
        mealRecord("m1"),
        hydrationRecord("w1", 250)
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    assert.equal(
      runtime.document
        .getElementById("healthEntryCount")
        .textContent,
      "2"
    );
    runtime.close();
  }
);

test(
  "Snapshotı olmayan öğün kendi tür etiketiyle gösterilir",
  async () => {
    const runtime = createRuntime({
      entries: [
        mealRecord("m1", {
          mealType: "dinner"
        })
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    assert.match(
      runtime.document
        .getElementById("healthEntryList")
        .textContent,
      /Akşam/
    );
    runtime.close();
  }
);

test(
  "Özel öğe adı snapshot üzerinden görünür",
  async () => {
    const runtime = createRuntime({
      entries: [
        mealRecord("m1", {
          itemSnapshotIds: ["s1"]
        })
      ],
      snapshots: [
        snapshot("s1", "Mercimek çorbası")
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    assert.match(
      runtime.document
        .getElementById("healthEntryList")
        .textContent,
      /Mercimek çorbası/
    );
    assert.deepEqual(runtime.calls.getRecord, ["s1"]);
    runtime.close();
  }
);

test(
  "Sıvı kaydı miktarıyla ayrı listelenir",
  async () => {
    const runtime = createRuntime({
      entries: [
        hydrationRecord("w1", 250)
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    assert.match(
      runtime.document
        .getElementById("healthEntryList")
        .textContent,
      /Su · 250 ml/
    );
    runtime.close();
  }
);

test(
  "Plan sayacı bütün bugünkü durumları gösterir",
  async () => {
    const runtime = createRuntime({
      plannedMeals: [
        plannedRecord("p1"),
        plannedRecord("p2", {
          status: "skipped"
        })
      ]
    });
    runtime.api.init({ root: runtime.document });
    const state = await runtime.api.open();
    assert.equal(state.summary.plannedMealCount, 2);
    assert.equal(state.summary.pendingPlanCount, 1);
    runtime.close();
  }
);

test(
  "Planlanan öğün türü ve durumu birlikte görünür",
  async () => {
    const runtime = createRuntime({
      plannedMeals: [
        plannedRecord("p1", {
          mealType: "lunch"
        })
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    const text = runtime.document
      .getElementById("healthPlannedMeals")
      .textContent;
    assert.match(text, /Öğle/);
    assert.match(text, /Planlandı/);
    runtime.close();
  }
);

test(
  "Plan snapshot adı tür etiketinin önüne geçer",
  async () => {
    const runtime = createRuntime({
      plannedMeals: [
        plannedRecord("p1", {
          itemSnapshotIds: ["s1"]
        })
      ],
      snapshots: [
        snapshot("s1", "Sebzeli makarna")
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    assert.match(
      runtime.document
        .getElementById("healthPlannedMeals")
        .textContent,
      /Sebzeli makarna/
    );
    runtime.close();
  }
);

test(
  "Yalnız bekleyen plan Tükettim düğmesi taşır",
  async () => {
    const runtime = createRuntime({
      plannedMeals: [
        plannedRecord("p1"),
        plannedRecord("p2", {
          status: "linked"
        }),
        plannedRecord("p3", {
          status: "cancelled"
        })
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    assert.equal(
      runtime.document.querySelectorAll(
        "[data-consume-planned-meal]"
      ).length,
      1
    );
    runtime.close();
  }
);

test(
  "+250 ml düğmesi doğru bilinen ölçümü gönderir",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    runtime.document
      .querySelector('[data-health-water-ml="250"]')
      .click();
    await settle();
    assert.deepEqual(
      runtime.calls.logWater[0].amount,
      {
        status: "known",
        value: 250,
        unit: "ml",
        basis: null
      }
    );
    runtime.close();
  }
);

test(
  "Su kaydı açık kullanıcı işlemi ve onayı taşır",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    runtime.document
      .querySelector('[data-health-water-ml="500"]')
      .click();
    await settle();
    const confirmation =
      runtime.calls.logWater[0].confirmation;
    assert.equal(confirmation.userInitiated, true);
    assert.equal(confirmation.userConfirmed, true);
    assert.match(
      confirmation.clientOperationId,
      /^health-ui-water-/
    );
    runtime.close();
  }
);

test(
  "Su kaydı sonrası özet ve başarı mesajı yenilenir",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    runtime.document
      .querySelector('[data-health-water-ml="250"]')
      .click();
    await settle();
    assert.match(
      runtime.document
        .getElementById("healthSummaryText")
        .textContent,
      /250 ml sıvı/
    );
    assert.match(
      runtime.document
        .getElementById("healthStatus")
        .textContent,
      /250 ml su kaydedildi/
    );
    runtime.close();
  }
);

test(
  "Yazma tamamlanınca Health düğmeleri yeniden etkinleşir",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    runtime.document
      .querySelector('[data-health-water-ml="250"]')
      .click();
    await settle();
    assert.equal(
      runtime.document.querySelector(
        '[data-health-water-ml="250"]'
      ).disabled,
      false
    );
    assert.equal(runtime.api.getState().busy, false);
    runtime.close();
  }
);

test(
  "Çift su dokunuşu devam eden işlemi çoğaltmıyor",
  async () => {
    const gate = deferred();
    const runtime = createRuntime({
      waterDeferred: gate
    });
    runtime.api.init({ root: runtime.document });
    const button = runtime.document
      .querySelector('[data-health-water-ml="250"]');
    button.click();
    button.click();
    await Promise.resolve();
    assert.equal(runtime.calls.logWater.length, 1);
    gate.resolve();
    await settle();
    runtime.close();
  }
);

test(
  "Adlı öğün sade özel öğe olarak gönderilir",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    runtime.document
      .getElementById("healthMealName")
      .value = "  Mercimek çorbası  ";
    runtime.document
      .getElementById("healthMealType")
      .value = "lunch";
    runtime.document
      .getElementById("healthMealForm")
      .requestSubmit();
    await settle();
    const input = runtime.calls.logMeal[0].input;
    assert.equal(input.mealType, "lunch");
    assert.equal(input.coverage, "complete");
    assert.deepEqual(
      input.customItems,
      [{ name: "Mercimek çorbası" }]
    );
    runtime.close();
  }
);

test(
  "Öğün kaydı açık kullanıcı onayı ve tekil işlem kimliği taşır",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    runtime.document
      .getElementById("healthMealForm")
      .requestSubmit();
    await settle();
    const confirmation =
      runtime.calls.logMeal[0].confirmation;
    assert.equal(confirmation.userInitiated, true);
    assert.equal(confirmation.userConfirmed, true);
    assert.match(
      confirmation.clientOperationId,
      /^health-ui-meal-/
    );
    runtime.close();
  }
);

test(
  "Boş öğün adı ayrıntısız ve unspecified kayda dönüşür",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    runtime.document
      .getElementById("healthMealForm")
      .requestSubmit();
    await settle();
    const input = runtime.calls.logMeal[0].input;
    assert.equal(input.coverage, "unspecified");
    assert.equal(input.customItems, undefined);
    runtime.close();
  }
);

test(
  "Başarılı öğün kaydı metin alanını temizler",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    const input = runtime.document
      .getElementById("healthMealName");
    input.value = "Yoğurt";
    runtime.document
      .getElementById("healthMealForm")
      .requestSubmit();
    await settle();
    assert.equal(input.value, "");
    assert.match(
      runtime.document
        .getElementById("healthEntryList")
        .textContent,
      /Yoğurt/
    );
    runtime.close();
  }
);

test(
  "Tükettim düğmesi yalnız seçilen plan kimliğini devreder",
  async () => {
    const runtime = createRuntime({
      plannedMeals: [plannedRecord("plan-meal-1")]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .querySelector(
        '[data-consume-planned-meal="plan-meal-1"]'
      )
      .click();
    await settle();
    assert.equal(
      runtime.calls.consumePlannedMeal[0].id,
      "plan-meal-1"
    );
    runtime.close();
  }
);

test(
  "Plan tüketimi ikinci açık onay bayrağını taşır",
  async () => {
    const runtime = createRuntime({
      plannedMeals: [plannedRecord("plan-meal-1")]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .querySelector(
        '[data-consume-planned-meal="plan-meal-1"]'
      )
      .click();
    await settle();
    const confirmation =
      runtime.calls.consumePlannedMeal[0]
        .confirmation;
    assert.equal(confirmation.userInitiated, true);
    assert.equal(confirmation.userConfirmed, true);
    assert.equal(
      confirmation.confirmPlanConsumption,
      true
    );
    assert.match(
      confirmation.clientOperationId,
      /^health-ui-planned-/
    );
    runtime.close();
  }
);

test(
  "Plan tüketimi sonrası plan durumu ve gün özeti yenilenir",
  async () => {
    const runtime = createRuntime({
      plannedMeals: [plannedRecord("plan-meal-1")]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .querySelector(
        '[data-consume-planned-meal="plan-meal-1"]'
      )
      .click();
    await settle();
    const text = runtime.document
      .getElementById("healthPlannedMeals")
      .textContent;
    assert.match(text, /Kaydedildi/);
    assert.equal(
      runtime.api.getState().summary.mealCount,
      1
    );
    assert.match(
      runtime.document
        .getElementById("healthStatus")
        .textContent,
      /tüketim olarak kaydedildi/
    );
    runtime.close();
  }
);

test(
  "Yenile düğmesi yeni iki okuma yapar",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .getElementById("btnHealthRefresh")
      .click();
    await settle();
    assert.equal(runtime.calls.listEntries.length, 2);
    assert.equal(
      runtime.calls.listPlannedMeals.length,
      2
    );
    assert.match(
      runtime.document
        .getElementById("healthStatus")
        .textContent,
      /yenilendi/
    );
    runtime.close();
  }
);

test(
  "Açılış okuma hatası kayıtların silinmediğini açıklar",
  async () => {
    const runtime = createRuntime({
      failOpen: true
    });
    runtime.api.init({ root: runtime.document });
    const state = await runtime.api.open();
    assert.equal(
      state.lastErrorCode,
      "TODAY-NUTRITION-TEST-READ"
    );
    assert.match(
      runtime.document
        .getElementById("healthStatus")
        .textContent,
      /Kayıtların silinmedi/
    );
    runtime.close();
  }
);

test(
  "Su yazma hatası mevcut görünümü kullanılabilir bırakır",
  async () => {
    const runtime = createRuntime({
      failWater: true
    });
    runtime.api.init({ root: runtime.document });
    runtime.document
      .querySelector('[data-health-water-ml="250"]')
      .click();
    await settle();
    assert.equal(
      runtime.api.getState().lastErrorCode,
      "TODAY-NUTRITION-TEST-WATER"
    );
    assert.equal(runtime.api.getState().busy, false);
    assert.match(
      runtime.document
        .getElementById("healthStatus")
        .textContent,
      /Mevcut kayıtların korunuyor/
    );
    runtime.close();
  }
);

test(
  "Öğün yazma hatası kullanıcı metnini sessizce silmez",
  async () => {
    const runtime = createRuntime({
      failMeal: true
    });
    runtime.api.init({ root: runtime.document });
    const input = runtime.document
      .getElementById("healthMealName");
    input.value = "Korunacak öğün";
    runtime.document
      .getElementById("healthMealForm")
      .requestSubmit();
    await settle();
    assert.equal(input.value, "Korunacak öğün");
    assert.equal(runtime.api.getState().busy, false);
    runtime.close();
  }
);

test(
  "Plan tüketim hatası planı ekranda bekleyen bırakır",
  async () => {
    const runtime = createRuntime({
      plannedMeals: [plannedRecord("p1")],
      failConsume: true
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .querySelector(
        '[data-consume-planned-meal="p1"]'
      )
      .click();
    await settle();
    assert.ok(
      runtime.document.querySelector(
        '[data-consume-planned-meal="p1"]'
      )
    );
    assert.equal(
      runtime.api.getState().lastErrorCode,
      "TODAY-NUTRITION-TEST-CONSUME"
    );
    runtime.close();
  }
);

test(
  "Snapshot okuma hatası öğün kaydını gizlemez",
  async () => {
    const runtime = createRuntime({
      entries: [
        mealRecord("m1", {
          mealType: "breakfast",
          itemSnapshotIds: ["s1"]
        })
      ],
      snapshots: [snapshot("s1", "Yumurta")],
      failGetRecord: true
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    assert.match(
      runtime.document
        .getElementById("healthEntryList")
        .textContent,
      /Kahvaltı/
    );
    assert.equal(runtime.api.getState().lastErrorCode, null);
    runtime.close();
  }
);

test(
  "NUT-009 gün ve arşiv öğeleri zorunlu UI sözleşmesine dahil",
  () => {
    const runtime = createRuntime();
    [
      "btnHealthPreviousDay",
      "btnHealthNextDay",
      "btnHealthToday",
      "healthCurrentOnlyNote",
      "healthArchivedSection",
      "healthArchivedList",
      "healthArchivedCount"
    ].forEach(id => {
      assert.ok(
        runtime.api.REQUIRED_IDS.includes(id),
        id
      );
    });
    runtime.close();
  }
);

test(
  "Eksik geçmiş servisi Health başlangıcını açık hata koduyla durduruyor",
  () => {
    const runtime = createRuntime({
      missingDependency:
        "TodayNutritionHistory"
    });
    assert.throws(
      () => runtime.api.init({
        root: runtime.document
      }),
      error =>
        error.todayCode ===
          "TODAY-NUTRITION-UI-001" &&
        error.detail.missing.some(
          value => value.includes(
            "TodayNutritionHistory"
          )
        )
    );
    runtime.close();
  }
);

test(
  "Health başlangıcı seçili günü bugün olarak saklıyor",
  () => {
    const runtime = createRuntime();
    const state = runtime.api.init({
      root: runtime.document
    });
    assert.equal(
      state.selectedDayKey,
      runtime.window.TodayNutritionHistory
        .dayKeyFromDate(
          new runtime.window.Date()
        )
    );
    assert.equal(state.isToday, true);
    runtime.close();
  }
);

test(
  "Bugünde sonraki gün ve Bugün düğmeleri devre dışı",
  () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    assert.equal(
      runtime.document
        .getElementById("btnHealthNextDay")
        .disabled,
      true
    );
    assert.equal(
      runtime.document
        .getElementById("btnHealthToday")
        .disabled,
      true
    );
    runtime.close();
  }
);

test(
  "Önceki gün düğmesi seçili günü bir gün geriye alıyor",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    const today =
      runtime.api.getState().selectedDayKey;
    runtime.document
      .getElementById("btnHealthPreviousDay")
      .click();
    await settle();
    assert.equal(
      runtime.api.getState().selectedDayKey,
      runtime.window.TodayNutritionHistory
        .shiftDay(today, -1)
    );
    assert.equal(
      runtime.api.getState().isToday,
      false
    );
    runtime.close();
  }
);

test(
  "Geçmiş günde salt okunur açıklaması görünür",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .getElementById("btnHealthPreviousDay")
      .click();
    await settle();
    const note = runtime.document
      .getElementById("healthCurrentOnlyNote");
    assert.equal(note.hidden, false);
    assert.match(
      note.textContent,
      /yalnız bugün/
    );
    runtime.close();
  }
);

test(
  "Geçmiş günde su ve öğün giriş kontrolleri kapalı",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .getElementById("btnHealthPreviousDay")
      .click();
    await settle();
    runtime.document
      .querySelectorAll(
        "[data-health-current-action]"
      )
      .forEach(control => {
        assert.equal(control.disabled, true);
      });
    runtime.close();
  }
);

test(
  "Geçmiş gün planı Tükettim işlemi yayımlamıyor",
  async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(13, 0, 0, 0);
    const runtime = createRuntime({
      plannedMeals: [
        plannedRecord("past-plan", {
          plannedFor: yesterday.toISOString()
        })
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .getElementById("btnHealthPreviousDay")
      .click();
    await settle();
    assert.match(
      runtime.document
        .getElementById("healthPlannedMeals")
        .textContent,
      /Planlandı/
    );
    assert.equal(
      runtime.document.querySelector(
        '[data-consume-planned-meal="past-plan"]'
      ),
      null
    );
    runtime.close();
  }
);

test(
  "Geçmiş günden sonraki gün düğmesi bugüne dönebiliyor",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .getElementById("btnHealthPreviousDay")
      .click();
    await settle();
    runtime.document
      .getElementById("btnHealthNextDay")
      .click();
    await settle();
    assert.equal(runtime.api.getState().isToday, true);
    runtime.close();
  }
);

test(
  "Bugün düğmesi daha eski günden doğrudan bugüne dönüyor",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .getElementById("btnHealthPreviousDay")
      .click();
    await settle();
    runtime.document
      .getElementById("btnHealthPreviousDay")
      .click();
    await settle();
    runtime.document
      .getElementById("btnHealthToday")
      .click();
    await settle();
    assert.equal(runtime.api.getState().isToday, true);
    assert.match(
      runtime.document
        .getElementById("healthTodayLabel")
        .textContent,
      /^Bugün/
    );
    runtime.close();
  }
);

test(
  "Etkin tüketim kaydı Kaldır işlemiyle gösteriliyor",
  async () => {
    const runtime = createRuntime({
      entries: [mealRecord("m1")]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    const button = runtime.document
      .querySelector(
        '[data-archive-nutrition-entry="m1"]'
      );
    assert.ok(button);
    assert.equal(button.textContent, "Kaldır");
    runtime.close();
  }
);

test(
  "Kaldır onayı reddedilirse arşiv servisi çağrılmıyor",
  async () => {
    const runtime = createRuntime({
      entries: [mealRecord("m1")],
      confirmResult: false
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .querySelector(
        '[data-archive-nutrition-entry="m1"]'
      )
      .click();
    await settle();
    assert.equal(
      runtime.calls.archiveEntry.length,
      0
    );
    runtime.close();
  }
);

test(
  "Kaldır işlemi açık arşivleme onayını ve tekil işlem kimliğini taşıyor",
  async () => {
    const runtime = createRuntime({
      entries: [mealRecord("m1")]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .querySelector(
        '[data-archive-nutrition-entry="m1"]'
      )
      .click();
    await settle();
    const call = runtime.calls.archiveEntry[0];
    assert.equal(call.id, "m1");
    assert.equal(
      call.confirmation.userInitiated,
      true
    );
    assert.equal(
      call.confirmation.userConfirmed,
      true
    );
    assert.equal(
      call.confirmation.confirmEntryArchive,
      true
    );
    assert.match(
      call.confirmation.clientOperationId,
      /^health-ui-archive-/
    );
    runtime.close();
  }
);

test(
  "Arşivlenen kayıt gün toplamından çıkıp arşiv kartına taşınıyor",
  async () => {
    const runtime = createRuntime({
      entries: [mealRecord("m1")]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .querySelector(
        '[data-archive-nutrition-entry="m1"]'
      )
      .click();
    await settle();
    assert.equal(
      runtime.api.getState().summary.mealCount,
      0
    );
    assert.equal(
      runtime.api.getState().summary
        .archivedEntryCount,
      1
    );
    assert.equal(
      runtime.document
        .getElementById("healthArchivedSection")
        .hidden,
      false
    );
    runtime.close();
  }
);

test(
  "Arşiv kartındaki kayıt Geri al işlemiyle gösteriliyor",
  async () => {
    const archived = mealRecord("m1", {
      recordStatus: "archived"
    });
    const runtime = createRuntime({
      entries: [archived]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    const button = runtime.document
      .querySelector(
        '[data-restore-nutrition-entry="m1"]'
      );
    assert.ok(button);
    assert.equal(button.textContent, "Geri al");
    runtime.close();
  }
);

test(
  "Geri al işlemi açık geri yükleme onayı taşıyor",
  async () => {
    const runtime = createRuntime({
      entries: [
        mealRecord("m1", {
          recordStatus: "archived"
        })
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .querySelector(
        '[data-restore-nutrition-entry="m1"]'
      )
      .click();
    await settle();
    const call = runtime.calls.restoreEntry[0];
    assert.equal(call.id, "m1");
    assert.equal(
      call.confirmation.confirmEntryRestore,
      true
    );
    assert.match(
      call.confirmation.clientOperationId,
      /^health-ui-restore-/
    );
    runtime.close();
  }
);

test(
  "Geri alınan kayıt yeniden gün toplamına giriyor",
  async () => {
    const runtime = createRuntime({
      entries: [
        mealRecord("m1", {
          recordStatus: "archived"
        })
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .querySelector(
        '[data-restore-nutrition-entry="m1"]'
      )
      .click();
    await settle();
    assert.equal(
      runtime.api.getState().summary.mealCount,
      1
    );
    assert.equal(
      runtime.api.getState().summary
        .archivedEntryCount,
      0
    );
    assert.equal(
      runtime.document
        .getElementById("healthArchivedSection")
        .hidden,
      true
    );
    runtime.close();
  }
);

test(
  "Arşivleme hatası etkin kaydı ve görünür özeti koruyor",
  async () => {
    const runtime = createRuntime({
      entries: [mealRecord("m1")],
      failArchive: true
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .querySelector(
        '[data-archive-nutrition-entry="m1"]'
      )
      .click();
    await settle();
    assert.equal(
      runtime.api.getState().summary.mealCount,
      1
    );
    assert.equal(
      runtime.api.getState().lastErrorCode,
      "TODAY-NUTRITION-TEST-ARCHIVE"
    );
    assert.ok(
      runtime.document.querySelector(
        '[data-archive-nutrition-entry="m1"]'
      )
    );
    runtime.close();
  }
);

test(
  "Arşivleme başarı mesajı verinin arşivde korunduğunu açıklıyor",
  async () => {
    const runtime = createRuntime({
      entries: [mealRecord("m1")]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .querySelector(
        '[data-archive-nutrition-entry="m1"]'
      )
      .click();
    await settle();
    assert.match(
      runtime.document
        .getElementById("healthStatus")
        .textContent,
      /arşivde korunuyor/
    );
    runtime.close();
  }
);

test(
  "NUT-010 kütüphane tür etiketlerini değişmez yayımlıyor",
  () => {
    const runtime = createRuntime();
    assert.deepEqual(
      { ...runtime.api.LIBRARY_TYPE_LABELS },
      {
        food_version: "Besin",
        recipe_version: "Tarif",
        meal_template: "Öğün şablonu"
      }
    );
    assert.equal(
      Object.isFrozen(
        runtime.api.LIBRARY_TYPE_LABELS
      ),
      true
    );
    runtime.close();
  }
);

test(
  "NUT-010 kütüphane öğeleri zorunlu UI sözleşmesine dahil",
  () => {
    const runtime = createRuntime();
    [
      "healthLibrarySearch",
      "healthLibraryType",
      "healthLibraryResultCount",
      "healthLibraryResults",
      "healthLibrarySelectedCount",
      "healthLibrarySelected",
      "healthLibraryNote"
    ].forEach(id => {
      assert.ok(
        runtime.api.REQUIRED_IDS.includes(id),
        id
      );
    });
    runtime.close();
  }
);

test(
  "Init yerel kütüphaneyi okumuyor",
  () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    assert.equal(
      runtime.calls.getLibrarySnapshot.length,
      0
    );
    runtime.close();
  }
);

test(
  "Eksik kütüphane servisi Health başlangıcını açık hata koduyla durduruyor",
  () => {
    const runtime = createRuntime({
      missingDependency:
        "TodayNutritionLibrary"
    });
    assert.throws(
      () => runtime.api.init({
        root: runtime.document
      }),
      error =>
        error.todayCode ===
          "TODAY-NUTRITION-UI-001" &&
        error.detail.missing.some(
          name => name.includes(
            "TodayNutritionLibrary"
          )
        )
    );
    runtime.close();
  }
);

test(
  "Health açılışı yerel kütüphaneyi bir kez okuyor",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    assert.equal(
      runtime.calls.getLibrarySnapshot.length,
      1
    );
    runtime.close();
  }
);

test(
  "Boş kütüphane değer uydurmayan açık durum gösteriyor",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    const state = await runtime.api.open();
    assert.equal(
      state.library.availableCount,
      0
    );
    assert.equal(
      state.library.resultCount,
      0
    );
    assert.match(
      runtime.document
        .getElementById(
          "healthLibraryResults"
        ).textContent,
      /henüz etkin/
    );
    assert.match(
      runtime.document
        .getElementById(
          "healthLibraryNote"
        ).textContent,
      /hiçbir değer uydurulmaz/
    );
    runtime.close();
  }
);

test(
  "Etkin besin, tarif ve öğün şablonu birlikte listeleniyor",
  async () => {
    const runtime = createRuntime({
      libraryRecords: [
        libraryRecord(
          "food-1",
          "food_version",
          "Yoğurt"
        ),
        libraryRecord(
          "recipe-1",
          "recipe_version",
          "Yulaf Kasesi"
        ),
        libraryRecord(
          "template-1",
          "meal_template",
          "Hızlı Kahvaltı"
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    const state = await runtime.api.open();
    const text = runtime.document
      .getElementById(
        "healthLibraryResults"
      ).textContent;
    assert.equal(state.library.resultCount, 3);
    assert.match(text, /Yoğurt/);
    assert.match(text, /Yulaf Kasesi/);
    assert.match(text, /Hızlı Kahvaltı/);
    runtime.close();
  }
);

test(
  "Arama Türkçe büyük-küçük harf farkı olmadan adı filtreliyor",
  async () => {
    const runtime = createRuntime({
      libraryRecords: [
        libraryRecord(
          "food-1",
          "food_version",
          "Yoğurt"
        ),
        libraryRecord(
          "food-2",
          "food_version",
          "Elma"
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    const search = runtime.document
      .getElementById(
        "healthLibrarySearch"
      );
    search.value = "YOĞURT";
    search.dispatchEvent(
      new runtime.window.Event(
        "input",
        { bubbles: true }
      )
    );
    assert.equal(
      runtime.api.getState().library
        .resultCount,
      1
    );
    assert.match(
      runtime.document
        .getElementById(
          "healthLibraryResults"
        ).textContent,
      /Yoğurt/
    );
    assert.doesNotMatch(
      runtime.document
        .getElementById(
          "healthLibraryResults"
        ).textContent,
      /Elma/
    );
    runtime.close();
  }
);

test(
  "Arama kütüphane etiketi ve hazırlama bilgisini de kapsıyor",
  async () => {
    const runtime = createRuntime({
      libraryRecords: [
        libraryRecord(
          "food-1",
          "food_version",
          "Yulaf",
          {
            tags: ["tahıl"],
            preparation: {
              method: "çiğ",
              details: "ıslatılmış"
            }
          }
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    const search = runtime.document
      .getElementById(
        "healthLibrarySearch"
      );
    search.value = "ıslatılmış";
    search.dispatchEvent(
      new runtime.window.Event(
        "input",
        { bubbles: true }
      )
    );
    assert.equal(
      runtime.api.getState().library
        .resultCount,
      1
    );
    runtime.close();
  }
);

test(
  "Tür filtresi yalnız seçilen kayıt türünü gösteriyor",
  async () => {
    const runtime = createRuntime({
      libraryRecords: [
        libraryRecord(
          "food-1",
          "food_version",
          "Yoğurt"
        ),
        libraryRecord(
          "recipe-1",
          "recipe_version",
          "Yoğurt Kasesi"
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    const filter = runtime.document
      .getElementById(
        "healthLibraryType"
      );
    filter.value = "recipe_version";
    filter.dispatchEvent(
      new runtime.window.Event(
        "change",
        { bubbles: true }
      )
    );
    const text = runtime.document
      .getElementById(
        "healthLibraryResults"
      ).textContent;
    assert.equal(
      runtime.api.getState().library
        .resultCount,
      1
    );
    assert.match(text, /Yoğurt Kasesi/);
    assert.doesNotMatch(text, /^YoğurtEkle/);
    runtime.close();
  }
);

test(
  "Arama sonucu görünür sınırı yirmi kayıtla korunuyor",
  async () => {
    const records = Array.from(
      { length: 25 },
      (_, index) =>
        libraryRecord(
          `food-${index}`,
          "food_version",
          `Besin ${String(index).padStart(2, "0")}`
        )
    );
    const runtime = createRuntime({
      libraryRecords: records
    });
    runtime.api.init({ root: runtime.document });
    const state = await runtime.api.open();
    assert.equal(
      state.library.availableCount,
      25
    );
    assert.equal(
      state.library.resultCount,
      20
    );
    runtime.close();
  }
);

test(
  "AI taslağı, arşivli ve doğrulanmamış kayıt arama sonucuna girmiyor",
  async () => {
    const runtime = createRuntime({
      libraryRecords: [
        libraryRecord(
          "food-active",
          "food_version",
          "Etkin Besin"
        ),
        libraryRecord(
          "food-ai",
          "food_version",
          "AI Taslağı",
          {
            source: { kind: "ai_draft" },
            verificationStatus: "unverified"
          }
        ),
        libraryRecord(
          "food-archived",
          "food_version",
          "Arşivli Besin",
          { recordStatus: "archived" }
        ),
        libraryRecord(
          "food-unverified",
          "food_version",
          "Doğrulanmamış Besin",
          { verificationStatus: "unverified" }
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    const state = await runtime.api.open();
    const text = runtime.document
      .getElementById(
        "healthLibraryResults"
      ).textContent;
    assert.equal(state.library.availableCount, 1);
    assert.match(text, /Etkin Besin/);
    assert.doesNotMatch(text, /AI Taslağı/);
    assert.doesNotMatch(text, /Arşivli Besin/);
    assert.doesNotMatch(text, /Doğrulanmamış/);
    runtime.close();
  }
);

test(
  "Doğrulanmış veri paketi kaydı seçilebilir kalıyor",
  async () => {
    const runtime = createRuntime({
      libraryRecords: [
        libraryRecord(
          "food-verified",
          "food_version",
          "Doğrulanmış Besin",
          {
            source: {
              kind: "data_package"
            },
            verificationStatus:
              "source_verified"
          }
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    const button = runtime.document
      .querySelector(
        '[data-select-nutrition-library="food-verified"]'
      );
    assert.ok(button);
    assert.equal(button.disabled, false);
    runtime.close();
  }
);

test(
  "Bilinen besin porsiyonu sonuçta açık gösteriliyor",
  async () => {
    const runtime = createRuntime({
      libraryRecords: [
        libraryRecord(
          "food-1",
          "food_version",
          "Yoğurt"
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    assert.match(
      runtime.document
        .getElementById(
          "healthLibraryResults"
        ).textContent,
      /100 g/
    );
    runtime.close();
  }
);

test(
  "Tahmini tarif porsiyonu yaklaşık olarak etiketleniyor",
  async () => {
    const runtime = createRuntime({
      libraryRecords: [
        libraryRecord(
          "recipe-1",
          "recipe_version",
          "Çorba",
          {
            amount: {
              status: "estimated",
              value: 1,
              unit: "portion",
              basis: "kullanıcı tahmini"
            }
          }
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    assert.match(
      runtime.document
        .getElementById(
          "healthLibraryResults"
        ).textContent,
      /yaklaşık 1 porsiyon/
    );
    runtime.close();
  }
);

test(
  "Porsiyonu bilinmeyen besin sıfır kabul edilmeden seçime kapanıyor",
  async () => {
    const runtime = createRuntime({
      libraryRecords: [
        libraryRecord(
          "food-unknown",
          "food_version",
          "Belirsiz Besin",
          {
            amount: {
              status: "unknown",
              value: null,
              unit: "g",
              basis: null
            }
          }
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    const button = runtime.document
      .querySelector(
        '[data-select-nutrition-library="food-unknown"]'
      );
    assert.equal(button.disabled, true);
    assert.equal(button.textContent, "Eksik");
    assert.match(
      runtime.document
        .getElementById(
          "healthLibraryResults"
        ).textContent,
      /porsiyon bilgisi eksik/
    );
    runtime.close();
  }
);

test(
  "Besin değeri eksik ama porsiyonu bilinen öğe açıklamayla seçilebilir",
  async () => {
    const runtime = createRuntime({
      libraryRecords: [
        libraryRecord(
          "food-unknown-nutrients",
          "food_version",
          "Ev Yemeği",
          { knowledgeStatus: "unknown" }
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    const button = runtime.document
      .querySelector(
        '[data-select-nutrition-library="food-unknown-nutrients"]'
      );
    assert.equal(button.disabled, false);
    assert.match(
      runtime.document
        .getElementById(
          "healthLibraryResults"
        ).textContent,
      /besin değeri eksik olabilir/
    );
    runtime.close();
  }
);

test(
  "Kütüphane seçimi tek başına tüketim kaydı oluşturmuyor",
  async () => {
    const runtime = createRuntime({
      libraryRecords: [
        libraryRecord(
          "food-1",
          "food_version",
          "Yoğurt"
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .querySelector(
        '[data-select-nutrition-library="food-1"]'
      )
      .click();
    assert.equal(runtime.calls.logMeal.length, 0);
    assert.equal(
      runtime.api.getState().library
        .selectedCount,
      1
    );
    assert.match(
      runtime.document
        .getElementById(
          "healthStatus"
        ).textContent,
      /henüz tüketim kaydı oluşturulmadı/
    );
    runtime.close();
  }
);

test(
  "Seçilen kütüphane öğesi listeden çıkarılabiliyor",
  async () => {
    const runtime = createRuntime({
      libraryRecords: [
        libraryRecord(
          "food-1",
          "food_version",
          "Yoğurt"
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .querySelector(
        '[data-select-nutrition-library="food-1"]'
      )
      .click();
    runtime.document
      .querySelector(
        '[data-remove-nutrition-library="food-1"]'
      )
      .click();
    assert.equal(
      runtime.api.getState().library
        .selectedCount,
      0
    );
    assert.equal(runtime.calls.logMeal.length, 0);
    runtime.close();
  }
);

test(
  "İkinci öğün şablonu ilk şablonun yerini alıyor",
  async () => {
    const runtime = createRuntime({
      libraryRecords: [
        libraryRecord(
          "template-1",
          "meal_template",
          "Kahvaltı Şablonu"
        ),
        libraryRecord(
          "template-2",
          "meal_template",
          "Akşam Şablonu"
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .querySelector(
        '[data-select-nutrition-library="template-1"]'
      )
      .click();
    runtime.document
      .querySelector(
        '[data-select-nutrition-library="template-2"]'
      )
      .click();
    const selected =
      runtime.api.getState().library.selected;
    assert.equal(selected.length, 1);
    assert.equal(
      selected[0].recordId,
      "template-2"
    );
    runtime.close();
  }
);

test(
  "Seçilen besin varsayılan porsiyonuyla NUT-006 öğün girişine devrediliyor",
  async () => {
    const runtime = createRuntime({
      libraryRecords: [
        libraryRecord(
          "food-1",
          "food_version",
          "Yoğurt"
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .querySelector(
        '[data-select-nutrition-library="food-1"]'
      )
      .click();
    runtime.document
      .getElementById("healthMealForm")
      .requestSubmit();
    await settle();
    assert.deepEqual(
      runtime.calls.logMeal[0].input.items,
      [
        {
          recordId: "food-1",
          amount: {
            status: "known",
            value: 100,
            unit: "g",
            basis: null
          },
          name: "Yoğurt"
        }
      ]
    );
    assert.equal(
      runtime.calls.logMeal[0].input.coverage,
      "complete"
    );
    runtime.close();
  }
);

test(
  "Seçilen tarif kendi yield porsiyonuyla öğün girişine devrediliyor",
  async () => {
    const runtime = createRuntime({
      libraryRecords: [
        libraryRecord(
          "recipe-1",
          "recipe_version",
          "Çorba"
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .querySelector(
        '[data-select-nutrition-library="recipe-1"]'
      )
      .click();
    runtime.document
      .getElementById("healthMealForm")
      .requestSubmit();
    await settle();
    assert.deepEqual(
      runtime.calls.logMeal[0].input
        .items[0].amount,
      {
        status: "known",
        value: 1,
        unit: "portion",
        basis: null
      }
    );
    runtime.close();
  }
);

test(
  "Seçilen öğün şablonu tek çarpanla NUT-006 girişine devrediliyor",
  async () => {
    const runtime = createRuntime({
      libraryRecords: [
        libraryRecord(
          "template-1",
          "meal_template",
          "Hızlı Kahvaltı"
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .querySelector(
        '[data-select-nutrition-library="template-1"]'
      )
      .click();
    runtime.document
      .getElementById("healthMealForm")
      .requestSubmit();
    await settle();
    const input =
      runtime.calls.logMeal[0].input;
    assert.equal(
      input.templateId,
      "template-1"
    );
    assert.equal(input.templateMultiplier, 1);
    assert.equal(input.items, undefined);
    runtime.close();
  }
);

test(
  "Sade ad, besin ve şablon aynı açık öğün kaydında birlikte korunuyor",
  async () => {
    const runtime = createRuntime({
      libraryRecords: [
        libraryRecord(
          "food-1",
          "food_version",
          "Yoğurt"
        ),
        libraryRecord(
          "template-1",
          "meal_template",
          "Hızlı Kahvaltı"
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .querySelector(
        '[data-select-nutrition-library="food-1"]'
      )
      .click();
    runtime.document
      .querySelector(
        '[data-select-nutrition-library="template-1"]'
      )
      .click();
    runtime.document
      .getElementById("healthMealName")
      .value = "Bir dilim ekmek";
    runtime.document
      .getElementById("healthMealForm")
      .requestSubmit();
    await settle();
    const input =
      runtime.calls.logMeal[0].input;
    assert.equal(input.items.length, 1);
    assert.equal(
      input.templateId,
      "template-1"
    );
    assert.deepEqual(
      input.customItems,
      [{ name: "Bir dilim ekmek" }]
    );
    runtime.close();
  }
);

test(
  "Başarılı kütüphane öğünü seçimi temizleyip yeni tüketimi gösteriyor",
  async () => {
    const runtime = createRuntime({
      libraryRecords: [
        libraryRecord(
          "food-1",
          "food_version",
          "Yoğurt"
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .querySelector(
        '[data-select-nutrition-library="food-1"]'
      )
      .click();
    runtime.document
      .getElementById("healthMealForm")
      .requestSubmit();
    await settle();
    assert.equal(
      runtime.api.getState().library
        .selectedCount,
      0
    );
    assert.equal(
      runtime.api.getState().summary.mealCount,
      1
    );
    assert.match(
      runtime.document
        .getElementById("healthEntryList")
        .textContent,
      /Yoğurt/
    );
    runtime.close();
  }
);

test(
  "Öğün yazma hatası kütüphane seçimini sessizce silmiyor",
  async () => {
    const runtime = createRuntime({
      failMeal: true,
      libraryRecords: [
        libraryRecord(
          "food-1",
          "food_version",
          "Yoğurt"
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .querySelector(
        '[data-select-nutrition-library="food-1"]'
      )
      .click();
    runtime.document
      .getElementById("healthMealForm")
      .requestSubmit();
    await settle();
    assert.equal(
      runtime.api.getState().library
        .selectedCount,
      1
    );
    runtime.close();
  }
);

test(
  "Kütüphane okuma hatası sade öğün akışını kapatmıyor",
  async () => {
    const runtime = createRuntime({
      failLibrary: true
    });
    runtime.api.init({ root: runtime.document });
    const state = await runtime.api.open();
    assert.equal(
      state.lastLibraryErrorCode,
      "TODAY-NUTRITION-TEST-LIBRARY"
    );
    assert.match(
      runtime.document
        .getElementById(
          "healthLibraryResults"
        ).textContent,
      /Sade öğün kaydı kullanılabilir/
    );
    runtime.document
      .getElementById("healthMealName")
      .value = "Sade öğün";
    runtime.document
      .getElementById("healthMealForm")
      .requestSubmit();
    await settle();
    assert.equal(runtime.calls.logMeal.length, 1);
    runtime.close();
  }
);

test(
  "Geçmiş günde kütüphane araması ve seçimleri salt okunur kalıyor",
  async () => {
    const runtime = createRuntime({
      libraryRecords: [
        libraryRecord(
          "food-1",
          "food_version",
          "Yoğurt"
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .getElementById(
        "btnHealthPreviousDay"
      )
      .click();
    await settle();
    assert.equal(
      runtime.document
        .getElementById(
          "healthLibrarySearch"
        ).disabled,
      true
    );
    assert.equal(
      runtime.document
        .querySelector(
          '[data-select-nutrition-library="food-1"]'
        ).disabled,
      true
    );
    runtime.close();
  }
);

test(
  "Kütüphane yenilemesi artık etkin olmayan seçimi güvenle düşürüyor",
  async () => {
    const runtime = createRuntime({
      libraryRecords: [
        libraryRecord(
          "food-1",
          "food_version",
          "Yoğurt"
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .querySelector(
        '[data-select-nutrition-library="food-1"]'
      )
      .click();
    runtime.state.libraryRecords.length = 0;
    await runtime.api.refreshLibrary();
    assert.equal(
      runtime.api.getState().library
        .selectedCount,
      0
    );
    runtime.close();
  }
);

test(
  "Dışarı verilen kütüphane seçim durumu çalışma durumunu değiştiremiyor",
  async () => {
    const runtime = createRuntime({
      libraryRecords: [
        libraryRecord(
          "food-1",
          "food_version",
          "Yoğurt"
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document
      .querySelector(
        '[data-select-nutrition-library="food-1"]'
      )
      .click();
    const selected =
      runtime.api.getState().library.selected;
    assert.throws(() => {
      selected.push({ recordId: "fake" });
    });
    assert.equal(
      runtime.api.getState().library
        .selectedCount,
      1
    );
    runtime.close();
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

  const failed = results.filter(
    result => !result.success
  );

  results.forEach(result => {
    console.log(
      `${result.success ? "PASS" : "FAIL"}: ${result.name}` +
      (result.error
        ? ` — ${result.error}`
        : "")
    );
  });

  console.log(
    `Nutrition UI: ${
      results.length - failed.length
    }/${results.length} başarılı`
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
})();
