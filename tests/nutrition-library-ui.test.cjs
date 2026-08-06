const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  JSDOM
} = require("jsdom");

const SOURCE = fs.readFileSync(
  "modules/nutrition-library-ui.js",
  "utf8"
);

const FIXTURE = `<!doctype html>
<html lang="tr"><body>
  <section id="healthLibraryManager">
    <span id="healthLibraryManagerCount"></span>
    <button id="btnHealthNewFood" data-health-library-management-action></button>
    <button id="btnHealthNewRecipe" data-health-library-management-action></button>
    <form id="healthLibraryEditor" hidden>
      <strong id="healthLibraryEditorTitle"></strong>
      <span id="healthLibraryEditorKind"></span>
      <input id="healthLibraryEditorName" />
      <input id="healthLibraryEditorAmount" />
      <select id="healthLibraryEditorUnit">
        <option value="g">g</option>
        <option value="kg">kg</option>
        <option value="ml">ml</option>
        <option value="l">l</option>
        <option value="piece">piece</option>
        <option value="portion">portion</option>
        <option value="serving">serving</option>
        <option value="slice">slice</option>
      </select>
      <fieldset id="healthLibraryFoodFields">
        <input id="healthLibraryEnergy" />
        <input id="healthLibraryProtein" />
        <input id="healthLibraryCarbohydrate" />
        <input id="healthLibraryFat" />
      </fieldset>
      <fieldset id="healthLibraryRecipeFields" hidden>
        <input id="healthRecipeIngredientSearch" />
        <span id="healthRecipeIngredientResultCount"></span>
        <ol id="healthRecipeIngredientResults"></ol>
        <span id="healthRecipeIngredientCount"></span>
        <ol id="healthRecipeIngredientSelected"></ol>
      </fieldset>
      <input id="healthLibraryTags" />
      <input id="healthLibraryPreparation" />
      <small id="healthLibraryEditorNote"></small>
      <button id="btnHealthLibrarySave" type="submit" data-health-library-management-action></button>
      <button id="btnHealthLibraryCancel" type="button" data-health-library-management-action></button>
    </form>
    <ol id="healthLibraryManageList"></ol>
    <section id="healthLibraryArchivedSection" hidden>
      <span id="healthLibraryArchivedCount"></span>
      <ol id="healthLibraryArchivedList"></ol>
    </section>
    <div id="healthLibraryManagerStatus"></div>
  </section>
</body></html>`;

function clone(value) {
  return value === undefined
    ? undefined
    : JSON.parse(JSON.stringify(value));
}

function known(value, unit) {
  return {
    status: "known",
    value,
    unit,
    basis: null
  };
}

function unknown(unit) {
  return {
    status: "unknown",
    value: null,
    unit,
    basis: null
  };
}

function nutrients(overrides = {}) {
  return {
    energy: unknown("kcal"),
    protein: unknown("g"),
    carbohydrate: unknown("g"),
    fat: unknown("g"),
    ...clone(overrides)
  };
}

function record(
  id,
  type,
  name,
  options = {}
) {
  const logicalId =
    options.logicalId ||
    `${type === "food_version" ? "food" : "recipe"}:${id}`;
  const amount = clone(
    options.amount ||
    (
      type === "food_version"
        ? known(100, "g")
        : known(1, "portion")
    )
  );

  return {
    id,
    type,
    createdAt:
      options.createdAt ||
      "2026-08-06T09:00:00.000Z",
    updatedAt:
      options.updatedAt ||
      "2026-08-06T09:00:00.000Z",
    recordStatus:
      options.recordStatus || "active",
    verificationStatus:
      options.verificationStatus ||
      "user_confirmed",
    knowledgeStatus:
      options.knowledgeStatus || "unknown",
    source:
      options.source || {
        kind: "manual",
        referenceId: null,
        version: null
      },
    payload: {
      name,
      ...(type === "food_version"
        ? {
            foodId: logicalId,
            version:
              options.version || "1.0.0",
            servingBasis: amount,
            nutrients:
              nutrients(options.nutrients)
          }
        : {
            recipeId: logicalId,
            version:
              options.version || "1.0.0",
            yield: amount,
            ingredientSnapshotIds:
              options.ingredientSnapshotIds || []
          })
    },
    extensions: {
      "today.nutrition.library": {
        logicalId,
        version:
          options.version || "1.0.0",
        tags: options.tags || [],
        preparation:
          options.preparation || {
            method: "unspecified",
            details: null
          },
        sourceClass:
          options.sourceClass ||
          (
            options.source?.kind ===
              "data_package"
              ? "verified_data_package"
              : "user_custom"
          )
      }
    }
  };
}

function snapshot(
  id,
  sourceRecord,
  amount = null
) {
  return {
    id,
    type: "meal_item_snapshot",
    payload: {
      referenceId: sourceRecord.id,
      name: sourceRecord.payload.name,
      amount:
        amount ||
        sourceRecord.payload.servingBasis ||
        sourceRecord.payload.yield
    },
    extensions: {
      "today.nutrition.library-snapshot": {
        sourceLogicalId:
          sourceRecord.extensions[
            "today.nutrition.library"
          ].logicalId
      }
    }
  };
}

function patchVersion(value) {
  const parts = value.split(".").map(Number);
  parts[2] += 1;
  return parts.join(".");
}

async function flush(rounds = 3) {
  for (let index = 0; index < rounds; index += 1) {
    await Promise.resolve();
    await new Promise(resolve =>
      setTimeout(resolve, 0)
    );
  }
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
    active: clone(options.active || []),
    history: clone(options.history || []),
    snapshots: new Map(
      (options.snapshots || []).map(item =>
        [item.id, clone(item)]
      )
    )
  };
  const calls = {
    getSnapshot: 0,
    getRecord: [],
    createFood: [],
    updateFood: [],
    createRecipe: [],
    updateRecipe: [],
    archiveItem: [],
    restoreItem: [],
    refreshMealLibrary: 0
  };
  let idCounter = 0;

  function currentSnapshot() {
    return {
      foods: state.active.filter(item =>
        item.type === "food_version"
      ),
      recipes: state.active.filter(item =>
        item.type === "recipe_version"
      ),
      mealTemplates: [],
      drafts: [],
      history: state.history,
      counts: {
        activeFoods: state.active.filter(item =>
          item.type === "food_version"
        ).length,
        activeRecipes: state.active.filter(item =>
          item.type === "recipe_version"
        ).length,
        activeMealTemplates: 0,
        drafts: 0,
        historicalVersions:
          state.history.length
      }
    };
  }

  function createFromInput(type, input) {
    idCounter += 1;
    return record(
      `${type === "food_version" ? "food" : "recipe"}-new-${idCounter}`,
      type,
      input.name,
      {
        amount:
          type === "food_version"
            ? input.servingBasis
            : input.yield,
        nutrients: input.nutrients,
        tags: input.tags,
        preparation: input.preparation,
        ingredientSnapshotIds:
          type === "recipe_version"
            ? input.ingredients.map(
                (_, index) =>
                  `created-snapshot-${idCounter}-${index}`
              )
            : []
      }
    );
  }

  async function createItem(
    type,
    input,
    confirmation,
    callKey
  ) {
    calls[callKey].push({
      input: clone(input),
      confirmation: clone(confirmation)
    });

    if (options.failWrite) {
      throw Object.assign(
        new Error("write failed"),
        {
          todayCode:
            "TODAY-NUTRITION-TEST-WRITE"
        }
      );
    }

    const created =
      createFromInput(type, input);
    state.active.push(created);
    return clone(created);
  }

  async function updateItem(
    type,
    recordId,
    input,
    confirmation,
    callKey
  ) {
    calls[callKey].push({
      recordId,
      input: clone(input),
      confirmation: clone(confirmation)
    });

    if (options.failWrite) {
      throw Object.assign(
        new Error("write failed"),
        {
          todayCode:
            "TODAY-NUTRITION-TEST-WRITE"
        }
      );
    }

    const index = state.active.findIndex(
      item => item.id === recordId
    );
    const current = state.active[index];

    if (options.sameUpdate === true) {
      return clone(current);
    }

    const old = clone(current);
    old.recordStatus = "superseded";
    state.history.push(old);
    const created =
      createFromInput(type, input);
    const meta = current.extensions[
      "today.nutrition.library"
    ];
    const version = patchVersion(meta.version);
    created.extensions[
      "today.nutrition.library"
    ].logicalId = meta.logicalId;
    created.extensions[
      "today.nutrition.library"
    ].version = version;
    created.payload[
      type === "food_version"
        ? "foodId"
        : "recipeId"
    ] = meta.logicalId;
    created.payload.version = version;
    state.active.splice(index, 1, created);
    return clone(created);
  }

  window.structuredClone =
    globalThis.structuredClone;
  window.confirm = () =>
    options.confirmResult !== false;
  window.TodayNutritionCalculations = {
    listUnits() {
      return [
        "g",
        "kg",
        "ml",
        "l",
        "piece",
        "portion",
        "serving",
        "slice"
      ];
    },
    canConvert(fromUnit, toUnit) {
      const dimensions = {
        g: "mass",
        kg: "mass",
        ml: "volume",
        l: "volume",
        piece: "piece",
        portion: "portion",
        serving: "serving",
        slice: "slice"
      };
      return Boolean(
        dimensions[fromUnit] &&
        dimensions[fromUnit] ===
          dimensions[toUnit]
      );
    }
  };
  window.TodayNutritionStorage = {
    async getRecord(id) {
      calls.getRecord.push(id);
      return clone(
        state.snapshots.get(id) || null
      );
    }
  };
  window.TodayNutritionLibrary = {
    async getSnapshot() {
      calls.getSnapshot += 1;

      if (options.failRead) {
        throw Object.assign(
          new Error("read failed"),
          {
            todayCode:
              "TODAY-NUTRITION-TEST-READ"
          }
        );
      }

      return clone(currentSnapshot());
    },
    createFood(input, confirmation) {
      return createItem(
        "food_version",
        input,
        confirmation,
        "createFood"
      );
    },
    updateFood(
      recordId,
      input,
      confirmation
    ) {
      return updateItem(
        "food_version",
        recordId,
        input,
        confirmation,
        "updateFood"
      );
    },
    createRecipe(input, confirmation) {
      return createItem(
        "recipe_version",
        input,
        confirmation,
        "createRecipe"
      );
    },
    updateRecipe(
      recordId,
      input,
      confirmation
    ) {
      return updateItem(
        "recipe_version",
        recordId,
        input,
        confirmation,
        "updateRecipe"
      );
    },
    async archiveItem(
      recordId,
      confirmation
    ) {
      calls.archiveItem.push({
        recordId,
        confirmation: clone(confirmation)
      });
      const index = state.active.findIndex(
        item => item.id === recordId
      );
      const archived = state.active.splice(
        index,
        1
      )[0];
      archived.recordStatus = "archived";
      state.history.push(archived);
      return clone(archived);
    },
    async restoreItem(
      recordId,
      confirmation
    ) {
      calls.restoreItem.push({
        recordId,
        confirmation: clone(confirmation)
      });
      const index = state.history.findIndex(
        item => item.id === recordId
      );
      const restored = state.history.splice(
        index,
        1
      )[0];
      restored.recordStatus = "active";
      state.active.push(restored);
      return clone(restored);
    }
  };
  window.TodayNutritionUI = {
    async refreshLibrary() {
      calls.refreshMealLibrary += 1;
    }
  };

  window.eval(
    `${SOURCE}\n//# sourceURL=nutrition-library-ui.js`
  );

  return {
    window,
    document: window.document,
    api:
      window.TodayNutritionLibraryUI,
    state,
    calls,
    close() {
      window.close();
    }
  };
}

const tests = [];

function test(name, callback) {
  tests.push({ name, callback });
}

function openFoodEditor(runtime) {
  runtime.document
    .getElementById("btnHealthNewFood")
    .click();
}

function openRecipeEditor(runtime) {
  runtime.document
    .getElementById("btnHealthNewRecipe")
    .click();
}

function fillFood(runtime, options = {}) {
  runtime.document
    .getElementById("healthLibraryEditorName")
    .value = options.name || "Ev yoğurdu";
  runtime.document
    .getElementById("healthLibraryEditorAmount")
    .value = options.amount ?? "100";
  runtime.document
    .getElementById("healthLibraryEditorUnit")
    .value = options.unit || "g";
  runtime.document
    .getElementById("healthLibraryEnergy")
    .value = options.energy ?? "";
  runtime.document
    .getElementById("healthLibraryProtein")
    .value = options.protein ?? "";
}

function submitEditor(runtime) {
  runtime.document
    .getElementById("healthLibraryEditor")
    .dispatchEvent(
      new runtime.window.Event(
        "submit",
        {
          bubbles: true,
          cancelable: true
        }
      )
    );
}

test(
  "Kütüphane yönetim API'si v1 ve değişmez",
  () => {
    const runtime = createRuntime();
    assert.equal(
      runtime.api.MANAGER_API_VERSION,
      1
    );
    assert.equal(
      runtime.api.MANAGER_RULESET_ID,
      "today:nutrition:library-ui:v1"
    );
    assert.equal(
      Object.isFrozen(runtime.api),
      true
    );
    runtime.close();
  }
);

test(
  "Yönetim sınırları sürümlü sabitlerle yayımlanıyor",
  () => {
    const runtime = createRuntime();
    assert.equal(
      runtime.api.MAX_VISIBLE_MANAGED_ITEMS,
      30
    );
    assert.equal(
      runtime.api.MAX_RECIPE_INGREDIENTS,
      30
    );
    assert.equal(
      runtime.api.MANAGED_TYPES.food_version,
      "Besin"
    );
    runtime.close();
  }
);

test(
  "Init yalnız olayları bağlıyor ve IndexedDB kütüphanesini okumuyor",
  () => {
    const runtime = createRuntime();
    const state = runtime.api.init({
      root: runtime.document
    });
    assert.equal(state.initialized, true);
    assert.equal(state.opened, false);
    assert.equal(
      runtime.calls.getSnapshot,
      0
    );
    runtime.close();
  }
);

test(
  "Init ikinci çağrıda olayları çoğaltmadan aynı durumu veriyor",
  () => {
    const runtime = createRuntime();
    runtime.api.init({
      root: runtime.document
    });
    const second = runtime.api.init({
      root: runtime.document
    });
    assert.equal(second.initialized, true);
    assert.equal(
      runtime.calls.getSnapshot,
      0
    );
    runtime.close();
  }
);

test(
  "Open yerel kütüphaneyi bir kez okuyup görünür durumu açıyor",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({
      root: runtime.document
    });
    const state = await runtime.api.open();
    assert.equal(state.opened, true);
    assert.equal(
      runtime.calls.getSnapshot,
      1
    );
    runtime.close();
  }
);

test(
  "GetState dışarıya değişmez kopya veriyor",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({
      root: runtime.document
    });
    await runtime.api.open();
    const state = runtime.api.getState();
    assert.equal(Object.isFrozen(state), true);
    assert.equal(
      Object.isFrozen(state.editor),
      true
    );
    runtime.close();
  }
);

test(
  "Eksik belge öğesi açık hata üretiyor",
  () => {
    const runtime = createRuntime({
      fixture:
        "<!doctype html><html><body></body></html>"
    });
    assert.throws(
      () => runtime.api.init({
        root: runtime.document
      }),
      error =>
        error.todayCode ===
          "TODAY-NUTRITION-LIBRARY-UI-002"
    );
    runtime.close();
  }
);

test(
  "Eksik kütüphane bağımlılığı başlangıcı durduruyor",
  () => {
    const runtime = createRuntime();
    delete runtime.window
      .TodayNutritionLibrary.restoreItem;
    assert.throws(
      () => runtime.api.init({
        root: runtime.document
      }),
      error =>
        error.todayCode ===
          "TODAY-NUTRITION-LIBRARY-UI-001"
    );
    runtime.close();
  }
);

test(
  "Kullanıcının etkin besini yönetim listesinde görünüyor",
  async () => {
    const runtime = createRuntime({
      active: [
        record(
          "food-1",
          "food_version",
          "Yoğurt"
        )
      ]
    });
    runtime.api.init({
      root: runtime.document
    });
    await runtime.api.open();
    assert.match(
      runtime.document
        .getElementById(
          "healthLibraryManageList"
        ).textContent,
      /Yoğurt/
    );
    assert.equal(
      runtime.api.getState().activeCount,
      1
    );
    runtime.close();
  }
);

test(
  "Kullanıcının etkin tarifi türü ve sürümüyle görünüyor",
  async () => {
    const runtime = createRuntime({
      active: [
        record(
          "recipe-1",
          "recipe_version",
          "Kase",
          { version: "1.2.3" }
        )
      ]
    });
    runtime.api.init({
      root: runtime.document
    });
    await runtime.api.open();
    const text = runtime.document
      .getElementById(
        "healthLibraryManageList"
      ).textContent;
    assert.match(text, /Tarif/);
    assert.match(text, /v1\.2\.3/);
    runtime.close();
  }
);

test(
  "Doğrulanmış veri paketi öğün seçiminde kullanılabilirken yönetim listesine girmiyor",
  async () => {
    const verified = record(
      "verified-1",
      "food_version",
      "Doğrulanmış besin",
      {
        source: {
          kind: "data_package",
          referenceId: "package",
          version: "1"
        },
        verificationStatus:
          "source_verified"
      }
    );
    const runtime = createRuntime({
      active: [verified]
    });
    runtime.api.init({
      root: runtime.document
    });
    await runtime.api.open();
    assert.equal(
      runtime.api.getState().activeCount,
      0
    );
    openRecipeEditor(runtime);
    assert.match(
      runtime.document
        .getElementById(
          "healthRecipeIngredientResults"
        ).textContent,
      /Doğrulanmış besin/
    );
    runtime.close();
  }
);

test(
  "AI taslağı yönetim ve tarif bileşeni listelerine girmiyor",
  async () => {
    const draft = record(
      "draft-1",
      "food_version",
      "AI taslağı",
      {
        recordStatus: "draft",
        source: {
          kind: "ai_draft",
          referenceId: "ai",
          version: "1"
        },
        verificationStatus: "unverified"
      }
    );
    const runtime = createRuntime({
      active: [draft]
    });
    runtime.api.init({
      root: runtime.document
    });
    await runtime.api.open();
    openRecipeEditor(runtime);
    assert.equal(
      runtime.api.getState().activeCount,
      0
    );
    assert.doesNotMatch(
      runtime.document.body.textContent,
      /AI taslağı/
    );
    runtime.close();
  }
);

test(
  "Arşivlenen kullanıcı kaydı ayrı alanda görünüyor",
  async () => {
    const archived = record(
      "food-archived",
      "food_version",
      "Eski besin",
      { recordStatus: "archived" }
    );
    const runtime = createRuntime({
      history: [archived]
    });
    runtime.api.init({
      root: runtime.document
    });
    await runtime.api.open();
    assert.equal(
      runtime.api.getState().archivedCount,
      1
    );
    assert.equal(
      runtime.document
        .getElementById(
          "healthLibraryArchivedSection"
        ).hidden,
      false
    );
    assert.match(
      runtime.document
        .getElementById(
          "healthLibraryArchivedList"
        ).textContent,
      /Eski besin/
    );
    runtime.close();
  }
);

test(
  "Superseded geçmiş sürüm arşiv yönetimine karışmıyor",
  async () => {
    const runtime = createRuntime({
      history: [
        record(
          "old-1",
          "food_version",
          "Eski sürüm",
          { recordStatus: "superseded" }
        )
      ]
    });
    runtime.api.init({
      root: runtime.document
    });
    await runtime.api.open();
    assert.equal(
      runtime.api.getState().archivedCount,
      0
    );
    runtime.close();
  }
);

test(
  "Yönetim listesi Türkçe ada göre sıralanıyor",
  async () => {
    const runtime = createRuntime({
      active: [
        record("z", "food_version", "Zeytin"),
        record("e", "food_version", "Elma")
      ]
    });
    runtime.api.init({
      root: runtime.document
    });
    await runtime.api.open();
    const titles = [
      ...runtime.document.querySelectorAll(
        "#healthLibraryManageList .healthListTitle"
      )
    ].map(item => item.textContent);
    assert.deepEqual(titles, [
      "Elma",
      "Zeytin"
    ]);
    runtime.close();
  }
);

test(
  "Boş kütüphane kullanıcıya yeni kayıt yolunu açık bırakıyor",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({
      root: runtime.document
    });
    await runtime.api.open();
    assert.match(
      runtime.document
        .getElementById(
          "healthLibraryManageList"
        ).textContent,
      /Henüz kendi besin/
    );
    assert.equal(
      runtime.document
        .getElementById(
          "btnHealthNewFood"
        ).disabled,
      false
    );
    runtime.close();
  }
);

test(
  "Kütüphane okuma hatası kayıtların silinmediğini açıklıyor",
  async () => {
    const runtime = createRuntime({
      failRead: true
    });
    runtime.api.init({
      root: runtime.document
    });
    const state = await runtime.api.open();
    assert.equal(
      state.lastErrorCode,
      "TODAY-NUTRITION-TEST-READ"
    );
    assert.match(
      runtime.document
        .getElementById(
          "healthLibraryManagerStatus"
        ).textContent,
      /silinmedi/
    );
    runtime.close();
  }
);

test(
  "Besin ekle düğmesi açık besin editörü gösteriyor",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({
      root: runtime.document
    });
    await runtime.api.open();
    openFoodEditor(runtime);
    const state = runtime.api.getState();
    assert.equal(state.editor.open, true);
    assert.equal(state.editor.kind, "food");
    assert.equal(
      runtime.document
        .getElementById(
          "healthLibraryEditor"
        ).hidden,
      false
    );
    runtime.close();
  }
);

test(
  "Yeni besin 100 gram varsayılanıyla açılıyor",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({
      root: runtime.document
    });
    await runtime.api.open();
    openFoodEditor(runtime);
    assert.equal(
      runtime.document
        .getElementById(
          "healthLibraryEditorAmount"
        ).value,
      "100"
    );
    assert.equal(
      runtime.document
        .getElementById(
          "healthLibraryEditorUnit"
        ).value,
      "g"
    );
    runtime.close();
  }
);

test(
  "Boş besin adı kalıcı kayıt oluşturmuyor",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    openFoodEditor(runtime);
    fillFood(runtime, { name: " " });
    submitEditor(runtime);
    await flush();
    assert.equal(
      runtime.calls.createFood.length,
      0
    );
    assert.match(
      runtime.document
        .getElementById(
          "healthLibraryManagerStatus"
        ).textContent,
      /adı boş olamaz/
    );
    runtime.close();
  }
);

[
  "0",
  "-1",
  "abc"
].forEach(value => {
  test(
    `Geçersiz varsayılan miktar ${value} besin kaydı oluşturmuyor`,
    async () => {
      const runtime = createRuntime();
      runtime.api.init({ root: runtime.document });
      await runtime.api.open();
      openFoodEditor(runtime);
      fillFood(runtime, { amount: value });
      submitEditor(runtime);
      await flush();
      assert.equal(
        runtime.calls.createFood.length,
        0
      );
      runtime.close();
    }
  );
});

test(
  "Boş besin değerleri 0 yerine unknown ölçüm olarak gönderiliyor",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    openFoodEditor(runtime);
    fillFood(runtime);
    submitEditor(runtime);
    await flush();
    const input =
      runtime.calls.createFood[0].input;
    Object.values(input.nutrients)
      .forEach(item => {
        assert.equal(item.status, "unknown");
        assert.equal(item.value, null);
      });
    runtime.close();
  }
);

test(
  "Girilen kalori ve protein bilinen değer olarak gönderiliyor",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    openFoodEditor(runtime);
    fillFood(runtime, {
      energy: "61",
      protein: "4.2"
    });
    submitEditor(runtime);
    await flush();
    const input =
      runtime.calls.createFood[0].input;
    assert.deepEqual(
      input.nutrients.energy,
      known(61, "kcal")
    );
    assert.deepEqual(
      input.nutrients.protein,
      known(4.2, "g")
    );
    runtime.close();
  }
);

test(
  "Negatif besin değeri kayıt kapısından geçmiyor",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    openFoodEditor(runtime);
    fillFood(runtime, { energy: "-1" });
    submitEditor(runtime);
    await flush();
    assert.equal(
      runtime.calls.createFood.length,
      0
    );
    runtime.close();
  }
);

test(
  "Etiketler kırpılıp Türkçe büyük-küçük harf tekrarından arındırılıyor",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    openFoodEditor(runtime);
    fillFood(runtime);
    runtime.document
      .getElementById("healthLibraryTags")
      .value = "Kahvaltı, kahvaltı; Ev yapımı";
    submitEditor(runtime);
    await flush();
    assert.deepEqual(
      runtime.calls.createFood[0]
        .input.tags,
      ["Kahvaltı", "Ev yapımı"]
    );
    runtime.close();
  }
);

test(
  "Boş hazırlama biçimi unspecified olarak korunuyor",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    openFoodEditor(runtime);
    fillFood(runtime);
    submitEditor(runtime);
    await flush();
    assert.equal(
      runtime.calls.createFood[0]
        .input.preparation.method,
      "unspecified"
    );
    runtime.close();
  }
);

test(
  "Besin kaydı açık kullanıcı onayı ve işlem kimliği taşıyor",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    openFoodEditor(runtime);
    fillFood(runtime);
    submitEditor(runtime);
    await flush();
    const confirmation =
      runtime.calls.createFood[0]
        .confirmation;
    assert.equal(
      confirmation.userInitiated,
      true
    );
    assert.equal(
      confirmation.userConfirmed,
      true
    );
    assert.match(
      confirmation.clientOperationId,
      /^health-library-ui-create-food-/
    );
    runtime.close();
  }
);

test(
  "Başarılı besin kaydı öğün seçim kütüphanesini yeniliyor",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    openFoodEditor(runtime);
    fillFood(runtime);
    submitEditor(runtime);
    await flush();
    assert.equal(
      runtime.calls.refreshMealLibrary,
      1
    );
    assert.equal(
      runtime.api.getState().activeCount,
      1
    );
    runtime.close();
  }
);

test(
  "Başarısız besin yazımı formu ve kullanıcı girdisini koruyor",
  async () => {
    const runtime = createRuntime({
      failWrite: true
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    openFoodEditor(runtime);
    fillFood(runtime, { name: "Korunan ad" });
    submitEditor(runtime);
    await flush();
    assert.equal(
      runtime.api.getState().editor.open,
      true
    );
    assert.equal(
      runtime.document
        .getElementById(
          "healthLibraryEditorName"
        ).value,
      "Korunan ad"
    );
    assert.equal(
      runtime.calls.refreshMealLibrary,
      0
    );
    runtime.close();
  }
);

test(
  "Vazgeç işlemi kalıcı kayıt oluşturmadan editörü kapatıyor",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    openFoodEditor(runtime);
    runtime.document
      .getElementById(
        "btnHealthLibraryCancel"
      ).click();
    assert.equal(
      runtime.api.getState().editor.open,
      false
    );
    assert.equal(
      runtime.calls.createFood.length,
      0
    );
    runtime.close();
  }
);

test(
  "Besin düzenleme formu mevcut porsiyon ve değerleri dolduruyor",
  async () => {
    const food = record(
      "food-edit",
      "food_version",
      "Süt",
      {
        amount: known(250, "ml"),
        nutrients: {
          energy: known(120, "kcal")
        }
      }
    );
    const runtime = createRuntime({
      active: [food]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document.querySelector(
      '[data-edit-nutrition-library="food-edit"]'
    ).click();
    await flush();
    assert.equal(
      runtime.document
        .getElementById(
          "healthLibraryEditorName"
        ).value,
      "Süt"
    );
    assert.equal(
      runtime.document
        .getElementById(
          "healthLibraryEditorAmount"
        ).value,
      "250"
    );
    assert.equal(
      runtime.document
        .getElementById(
          "healthLibraryEnergy"
        ).value,
      "120"
    );
    runtime.close();
  }
);

test(
  "Besin düzenleme eski kimliği updateFood kapısına veriyor",
  async () => {
    const runtime = createRuntime({
      active: [
        record(
          "food-edit",
          "food_version",
          "Süt"
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document.querySelector(
      '[data-edit-nutrition-library="food-edit"]'
    ).click();
    await flush();
    runtime.document
      .getElementById(
        "healthLibraryEditorName"
      ).value = "Güncel süt";
    submitEditor(runtime);
    await flush();
    assert.equal(
      runtime.calls.updateFood[0].recordId,
      "food-edit"
    );
    assert.equal(
      runtime.api.getState().activeCount,
      1
    );
    assert.match(
      runtime.document
        .getElementById(
          "healthLibraryManageList"
        ).textContent,
      /v1\.0\.1/
    );
    runtime.close();
  }
);

test(
  "Değişmeyen besin düzenlemesi mevcut sürümü koruduğunu bildiriyor",
  async () => {
    const runtime = createRuntime({
      active: [
        record(
          "food-edit",
          "food_version",
          "Süt"
        )
      ],
      sameUpdate: true
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document.querySelector(
      '[data-edit-nutrition-library="food-edit"]'
    ).click();
    await flush();
    submitEditor(runtime);
    await flush();
    assert.match(
      runtime.document
        .getElementById(
          "healthLibraryManagerStatus"
        ).textContent,
      /mevcut sürüm korundu/
    );
    runtime.close();
  }
);

test(
  "Tarif ekle düğmesi tarif alanını ve bir porsiyon varsayılanını açıyor",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    openRecipeEditor(runtime);
    assert.equal(
      runtime.api.getState().editor.kind,
      "recipe"
    );
    assert.equal(
      runtime.document
        .getElementById(
          "healthLibraryRecipeFields"
        ).hidden,
      false
    );
    assert.equal(
      runtime.document
        .getElementById(
          "healthLibraryEditorUnit"
        ).value,
      "portion"
    );
    runtime.close();
  }
);

test(
  "Bileşensiz tarif kalıcı kayıt oluşturmuyor",
  async () => {
    const runtime = createRuntime();
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    openRecipeEditor(runtime);
    runtime.document
      .getElementById(
        "healthLibraryEditorName"
      ).value = "Boş tarif";
    submitEditor(runtime);
    await flush();
    assert.equal(
      runtime.calls.createRecipe.length,
      0
    );
    assert.match(
      runtime.document
        .getElementById(
          "healthLibraryManagerStatus"
        ).textContent,
      /en az bir bileşen/
    );
    runtime.close();
  }
);

test(
  "Miktarı bilinmeyen besin tarif bileşeni olarak sunulmuyor",
  async () => {
    const runtime = createRuntime({
      active: [
        record(
          "unknown-food",
          "food_version",
          "Eksik besin",
          { amount: unknown("g") }
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    openRecipeEditor(runtime);
    assert.doesNotMatch(
      runtime.document
        .getElementById(
          "healthRecipeIngredientResults"
        ).textContent,
      /Eksik besin/
    );
    runtime.close();
  }
);

test(
  "Tarif bileşeni ekleme yalnız geçici editör durumunu değiştiriyor",
  async () => {
    const runtime = createRuntime({
      active: [
        record(
          "food-1",
          "food_version",
          "Yulaf"
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    openRecipeEditor(runtime);
    runtime.document.querySelector(
      '[data-add-recipe-ingredient="food-1"]'
    ).click();
    assert.equal(
      runtime.api.getState().editor
        .ingredientCount,
      1
    );
    assert.equal(
      runtime.calls.createRecipe.length,
      0
    );
    runtime.close();
  }
);

test(
  "Tarif bileşeni seçimi miktar ve uyumlu birim alanı gösteriyor",
  async () => {
    const runtime = createRuntime({
      active: [
        record(
          "food-1",
          "food_version",
          "Yulaf"
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    openRecipeEditor(runtime);
    runtime.document.querySelector(
      '[data-add-recipe-ingredient="food-1"]'
    ).click();
    const amount = runtime.document
      .querySelector(
        '[data-recipe-ingredient-amount="food-1"]'
      );
    const units = [
      ...runtime.document.querySelectorAll(
        '[data-recipe-ingredient-unit="food-1"] option'
      )
    ].map(option => option.value);
    assert.equal(amount.value, "100");
    assert.deepEqual(units, ["g", "kg"]);
    runtime.close();
  }
);

test(
  "Tarif bileşeni çıkarma geçici seçimi geri alıyor",
  async () => {
    const runtime = createRuntime({
      active: [
        record(
          "food-1",
          "food_version",
          "Yulaf"
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    openRecipeEditor(runtime);
    runtime.document.querySelector(
      '[data-add-recipe-ingredient="food-1"]'
    ).click();
    runtime.document.querySelector(
      '[data-remove-recipe-ingredient="food-1"]'
    ).click();
    assert.equal(
      runtime.api.getState().editor
        .ingredientCount,
      0
    );
    runtime.close();
  }
);

test(
  "Tarif araması sonucu cihaz içindeki ada göre daraltıyor",
  async () => {
    const runtime = createRuntime({
      active: [
        record("oat", "food_version", "Yulaf"),
        record("milk", "food_version", "Süt")
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    openRecipeEditor(runtime);
    const search = runtime.document
      .getElementById(
        "healthRecipeIngredientSearch"
      );
    search.value = "süt";
    search.dispatchEvent(
      new runtime.window.Event("input", {
        bubbles: true
      })
    );
    const text = runtime.document
      .getElementById(
        "healthRecipeIngredientResults"
      ).textContent;
    assert.match(text, /Süt/);
    assert.doesNotMatch(text, /Yulaf/);
    runtime.close();
  }
);

test(
  "Tarif kaydı seçilen güncel kaynak kimliği ve miktarını taşıyor",
  async () => {
    const runtime = createRuntime({
      active: [
        record(
          "food-1",
          "food_version",
          "Yulaf"
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    openRecipeEditor(runtime);
    runtime.document
      .getElementById(
        "healthLibraryEditorName"
      ).value = "Yulaf kasesi";
    runtime.document.querySelector(
      '[data-add-recipe-ingredient="food-1"]'
    ).click();
    runtime.document.querySelector(
      '[data-recipe-ingredient-amount="food-1"]'
    ).value = "150";
    submitEditor(runtime);
    await flush();
    const ingredient =
      runtime.calls.createRecipe[0]
        .input.ingredients[0];
    assert.equal(
      ingredient.recordId,
      "food-1"
    );
    assert.deepEqual(
      ingredient.amount,
      known(150, "g")
    );
    runtime.close();
  }
);

test(
  "Tarif bileşeninde uyumsuz birim manipülasyonu kaydı durduruyor",
  async () => {
    const runtime = createRuntime({
      active: [
        record(
          "food-1",
          "food_version",
          "Yulaf"
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    openRecipeEditor(runtime);
    runtime.document
      .getElementById(
        "healthLibraryEditorName"
      ).value = "Yulaf kasesi";
    runtime.document.querySelector(
      '[data-add-recipe-ingredient="food-1"]'
    ).click();
    const select = runtime.document.querySelector(
      '[data-recipe-ingredient-unit="food-1"]'
    );
    const option = runtime.document
      .createElement("option");
    option.value = "ml";
    select.append(option);
    select.value = "ml";
    submitEditor(runtime);
    await flush();
    assert.equal(
      runtime.calls.createRecipe.length,
      0
    );
    assert.match(
      runtime.document
        .getElementById(
          "healthLibraryManagerStatus"
        ).textContent,
      /uyumsuz birim/
    );
    runtime.close();
  }
);

test(
  "Tarif düzenleme eski snapshot miktarını etkin kaynakla dolduruyor",
  async () => {
    const food = record(
      "food-current",
      "food_version",
      "Yulaf",
      { logicalId: "food:oats" }
    );
    const recipe = record(
      "recipe-edit",
      "recipe_version",
      "Kase",
      {
        ingredientSnapshotIds: [
          "snapshot-1"
        ]
      }
    );
    const item = snapshot(
      "snapshot-1",
      food,
      known(80, "g")
    );
    const runtime = createRuntime({
      active: [food, recipe],
      snapshots: [item]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document.querySelector(
      '[data-edit-nutrition-library="recipe-edit"]'
    ).click();
    await flush();
    assert.equal(
      runtime.document.querySelector(
        '[data-recipe-ingredient-amount="food-current"]'
      ).value,
      "80"
    );
    assert.deepEqual(
      runtime.calls.getRecord,
      ["snapshot-1"]
    );
    runtime.close();
  }
);

test(
  "Tarif düzenleme superseded kaynak snapshotını güncel mantıksal sürüme eşliyor",
  async () => {
    const currentFood = record(
      "food-v2",
      "food_version",
      "Yulaf",
      {
        logicalId: "food:oats",
        version: "1.0.1"
      }
    );
    const oldFood = record(
      "food-v1",
      "food_version",
      "Yulaf",
      { logicalId: "food:oats" }
    );
    const recipe = record(
      "recipe-edit",
      "recipe_version",
      "Kase",
      {
        ingredientSnapshotIds: [
          "snapshot-old"
        ]
      }
    );
    const oldSnapshot = snapshot(
      "snapshot-old",
      oldFood,
      known(90, "g")
    );
    const runtime = createRuntime({
      active: [currentFood, recipe],
      snapshots: [oldSnapshot]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document.querySelector(
      '[data-edit-nutrition-library="recipe-edit"]'
    ).click();
    await flush();
    assert.ok(
      runtime.document.querySelector(
        '[data-recipe-ingredient-amount="food-v2"]'
      )
    );
    runtime.close();
  }
);

test(
  "Tarif kendisini bileşen adayı olarak göstermiyor",
  async () => {
    const recipe = record(
      "recipe-edit",
      "recipe_version",
      "Kase"
    );
    const runtime = createRuntime({
      active: [recipe]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document.querySelector(
      '[data-edit-nutrition-library="recipe-edit"]'
    ).click();
    await flush();
    assert.doesNotMatch(
      runtime.document
        .getElementById(
          "healthRecipeIngredientResults"
        ).textContent,
      /Kase/
    );
    runtime.close();
  }
);

test(
  "Arşiv iptali kütüphane servisine yazmıyor",
  async () => {
    const runtime = createRuntime({
      active: [
        record(
          "food-1",
          "food_version",
          "Yoğurt"
        )
      ],
      confirmResult: false
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document.querySelector(
      '[data-archive-nutrition-library="food-1"]'
    ).click();
    await flush();
    assert.equal(
      runtime.calls.archiveItem.length,
      0
    );
    runtime.close();
  }
);

test(
  "Arşiv onayı etkin kaydı geçmiş öğünlere dokunmadan ayırıyor",
  async () => {
    const runtime = createRuntime({
      active: [
        record(
          "food-1",
          "food_version",
          "Yoğurt"
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document.querySelector(
      '[data-archive-nutrition-library="food-1"]'
    ).click();
    await flush();
    assert.equal(
      runtime.calls.archiveItem.length,
      1
    );
    assert.equal(
      runtime.api.getState().activeCount,
      0
    );
    assert.equal(
      runtime.api.getState().archivedCount,
      1
    );
    assert.match(
      runtime.document
        .getElementById(
          "healthLibraryManagerStatus"
        ).textContent,
      /geçmiş öğünler korunuyor/
    );
    runtime.close();
  }
);

test(
  "Arşiv geri alma aynı kaydı etkin yönetim listesine döndürüyor",
  async () => {
    const archived = record(
      "food-1",
      "food_version",
      "Yoğurt",
      { recordStatus: "archived" }
    );
    const runtime = createRuntime({
      history: [archived]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    runtime.document.querySelector(
      '[data-restore-nutrition-library="food-1"]'
    ).click();
    await flush();
    assert.equal(
      runtime.calls.restoreItem.length,
      1
    );
    assert.equal(
      runtime.api.getState().activeCount,
      1
    );
    assert.equal(
      runtime.api.getState().archivedCount,
      0
    );
    runtime.close();
  }
);

test(
  "Yazma sırasında yönetim kontrolleri devre dışı kalıyor",
  async () => {
    let release;
    const runtime = createRuntime();
    const original = runtime.window
      .TodayNutritionLibrary.createFood;
    runtime.window
      .TodayNutritionLibrary.createFood =
        async (...args) => {
          await new Promise(resolve => {
            release = resolve;
          });
          return original(...args);
        };
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    openFoodEditor(runtime);
    fillFood(runtime);
    submitEditor(runtime);
    await flush(1);
    assert.equal(
      runtime.document
        .getElementById(
          "btnHealthNewFood"
        ).disabled,
      true
    );
    release();
    await flush();
    runtime.close();
  }
);

test(
  "Dışarı verilen tarif bileşeni durumu çalışma haritasını değiştiremiyor",
  async () => {
    const runtime = createRuntime({
      active: [
        record(
          "food-1",
          "food_version",
          "Yulaf"
        )
      ]
    });
    runtime.api.init({ root: runtime.document });
    await runtime.api.open();
    openRecipeEditor(runtime);
    runtime.document.querySelector(
      '[data-add-recipe-ingredient="food-1"]'
    ).click();
    const state = runtime.api.getState();
    assert.throws(() => {
      state.editor.ingredients.push({
        recordId: "fake"
      });
    });
    assert.equal(
      runtime.api.getState().editor
        .ingredientCount,
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
    `Nutrition Library UI: ${
      results.length - failed.length
    }/${results.length} başarılı`
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
})();
