const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const vm = require("node:vm");

const UPDATED_INDEX = "index.html";

const updatedHtml = fs.readFileSync(
  UPDATED_INDEX,
  "utf8"
);

const expectedProductionHashes = {
  "index.html":
    "4d5857d3bb820381b797cc1323ec5d05ca865a4b632c2503ccbc88d5184a711b",
  "sw.js":
    "221a0bba91695f3eae1d0fbfc9e630466588a80301ea6a2e4dcfc8138ff0397d",
  "modules/adapter-interfaces.js":
    "af8ff0d53ef71fcc321f13bd30aecd4cb9f654789e6a1dd06e540bb676bdabe5",
  "modules/error-manager.js":
    "705a8d5302c92810ca22de9b3ee5235e70348cee37780a77d46cf5a7a1a7b23f",
  "modules/startup-manager.js":
    "13a2a46a92d6e917a507f33855593c0989d60496b9053200dedc4061f175d587",
  "modules/nutrition-contracts.js":
    "41fbd1b7dd61181b5c1ed997e109700562fdc55b03789709bbb06f5fce89f1a6",
  "modules/nutrition-calculations.js":
    "a0856ebfbc427d1b03ffb15511342dd826aeda2c05d8d9c519aa066f26ce2b52",
  "modules/nutrition-storage.js":
    "890aa886c634cb4f1f11a1dd7da3fdc4cff1442e4cfb25fd4fd29dfe2522dace",
  "modules/nutrition-migrations.js":
    "d43a0a7308d39edf0c1e9eb7767997144fbfa1aa6cbe1fee0e74cfed49e13f66",
  "modules/nutrition-profile.js":
    "7efb3344d961dd464cfec404934e2088e4dd56d4ea85ef552b962bc59f81f03c",
  "modules/nutrition-library.js":
    "a0904a2508ed28d3300144647ba53ef800f53860a92570d77e7b143d95c50d23",
  "modules/nutrition-library-ui.js":
    "d1211b95cc3cffc0871034f41f4b9a6257ddeff9548c750d5031d8875e2c818f",
  "modules/nutrition-entry.js":
    "5c4c0dd77c9053e1de12dafa5c60deea2da871a82ee4187eb2ed1825e81eec48",
  "modules/nutrition-planning.js":
    "2461fab9360d3d27d506a322215117dc55e4c973a22fcaebd3fa8b11b1551222",
  "modules/nutrition-history.js":
    "d08fdb158778fe543b98d4aad7c91bb65d1ccd66fbe4d3dddea8bf813ab3c025",
  "modules/nutrition-ui.js":
    "66d5811449440e94ba18c24d6e93ebe6cb20d16e40b718fbb9f673dc66a7324e",
  "storage.js":
    "10898fab6a110aaab284814cdb37fe0e5bce11d88e771c5b8d3f734675651017",
  "version.js":
    "0d671f208e53c0e665980157a6f4ab749ae1c86e0ebd43effa15d3b1a02342fe",
  "migration.js":
    "8862194d0b240944cc0cab9149fb923416e76498eedd33245b28f0d3ef8dba3d",
  "day-manager.js":
    "7d30f8086be316deee4f2cebb8c04d09d3165ff7af3e43aba6bf680d375dff9f",
  "state-manager.js":
    "b87694d5bf516d9b0024c8607608fe1d8616061e9a05b741449e38773f195e78",
  "router.js":
    "4afc06c5cd7d4af4cdf9fdb25a75cbf9f90161e6808e2a8c3a6279bb031a9c68",
  "module-registry.js":
    "9678b6a3f73789f50e961257a0fa2115006b60ae521a6867340ea11975be8356",
  "service-worker-manager.js":
    "e84346622aed07bf988981e2fb616ebb2b0bcd31cee297ce862257d914db239c"
};

const expectedHtmlIds = [
  "accSettings",
  "accSettingsBody",
  "accSettingsHead",
  "accStats",
  "accStatsArrow",
  "accStatsBody",
  "accStatsHead",
  "accSummary",
  "accSummaryBody",
  "accSummaryHead",
  "appContent",
  "area",
  "btnBackToPick",
  "btnCalendar",
  "btnClearTodayLogs",
  "btnExport",
  "btnHealthLibraryCancel",
  "btnHealthLibrarySave",
  "btnHealthMealSubmit",
  "btnHealthNewFood",
  "btnHealthNewRecipe",
  "btnHealthNextDay",
  "btnHealthPreviousDay",
  "btnHealthRefresh",
  "btnHealthToday",
  "btnHomeFromPick",
  "btnModuleCore",
  "btnModuleHealth",
  "btnModuleSky",
  "btnModulesFromHealth",
  "btnModulesFromSky",
  "btnOpenSettings",
  "btnOpenStats",
  "btnResetToday",
  "btnStart",
  "btnStats",
  "buildTag",
  "calGrid",
  "calHint",
  "calPill",
  "chart",
  "chartLabel",
  "chartMini",
  "chartSummary",
  "choiceADesc",
  "choiceATitle",
  "choiceBDesc",
  "choiceBTitle",
  "choiceCDesc",
  "choiceCTitle",
  "choices",
  "fillGrad",
  "healthArchivedCount",
  "healthArchivedList",
  "healthArchivedSection",
  "healthArchivedTitle",
  "healthCurrentOnlyNote",
  "healthDashboard",
  "healthEntriesTitle",
  "healthEntryCount",
  "healthEntryList",
  "healthKnowledgeNote",
  "healthLibraryArchivedCount",
  "healthLibraryArchivedList",
  "healthLibraryArchivedSection",
  "healthLibraryCarbohydrate",
  "healthLibraryEditor",
  "healthLibraryEditorAmount",
  "healthLibraryEditorKind",
  "healthLibraryEditorName",
  "healthLibraryEditorNote",
  "healthLibraryEditorTitle",
  "healthLibraryEditorUnit",
  "healthLibraryEnergy",
  "healthLibraryFat",
  "healthLibraryFoodFields",
  "healthLibraryManageList",
  "healthLibraryManager",
  "healthLibraryManagerCount",
  "healthLibraryManagerStatus",
  "healthLibraryManagerTitle",
  "healthLibraryNote",
  "healthLibraryPreparation",
  "healthLibraryProtein",
  "healthLibraryRecipeFields",
  "healthLibraryResultCount",
  "healthLibraryResults",
  "healthLibrarySearch",
  "healthLibrarySelected",
  "healthLibrarySelectedCount",
  "healthLibraryTags",
  "healthLibraryType",
  "healthMealForm",
  "healthMealName",
  "healthMealTitle",
  "healthMealType",
  "healthPlanCount",
  "healthPlanTitle",
  "healthPlannedMeals",
  "healthRecipeIngredientCount",
  "healthRecipeIngredientResultCount",
  "healthRecipeIngredientResults",
  "healthRecipeIngredientSearch",
  "healthRecipeIngredientSelected",
  "healthStatus",
  "healthSummaryText",
  "healthTitle",
  "healthTodayLabel",
  "healthWaterTitle",
  "homeTitle",
  "line",
  "moduleCoreDesc",
  "moduleCoreTitle",
  "moduleHealthDesc",
  "moduleHealthTitle",
  "moduleSkyDesc",
  "moduleSkyTitle",
  "modulesTitle",
  "monthTitle",
  "note",
  "pickTitle",
  "pillDate",
  "skipToContent",
  "skyTitle",
  "statusHome",
  "statusModules",
  "statusPick",
  "summaryText",
  "themeSelect"
];

function sha256(path) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(path))
    .digest("hex");
}

function matches(source, pattern) {
  return [
    ...source.matchAll(pattern)
  ].map((match) => match[1]);
}

function sorted(values) {
  return [...values].sort();
}

const results = [];

function test(name, callback) {
  try {
    callback();
    results.push({
      name,
      success: true
    });
  } catch (error) {
    results.push({
      name,
      success: false,
      error: error.message
    });
  }
}

test(
  "Üretim index'i NUT-011 foundation-023, kütüphane yönetimi ve iOS genişlik sınırını koruyor",
  () => {
    assert.equal(
      sha256(UPDATED_INDEX),
      expectedProductionHashes[
        "index.html"
      ]
    );

    const constrainedSingleColumns = [
      ...updatedHtml.matchAll(
        /grid-template-columns:\s*minmax\(0,\s*1fr\);/g
      )
    ];

    assert.equal(
      constrainedSingleColumns.length,
      4
    );
    assert.match(
      updatedHtml,
      /\.healthDashboard\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;/s
    );
    assert.match(
      updatedHtml,
      /\.healthCard\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;[^}]*max-width:\s*100%;/s
    );
    assert.match(
      updatedHtml,
      /\.healthLibraryControls\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.25fr\)\s+minmax\(112px,\s*\.75fr\);[^}]*min-width:\s*0;/s
    );
    assert.match(
      updatedHtml,
      /\.healthLibraryEditorGrid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.2fr\)\s+minmax\(0,\s*\.55fr\)\s+minmax\(92px,\s*\.65fr\);[^}]*min-width:\s*0;/s
    );
  }
);

test(
  "Yirmi dört üretim dosyası NUT-011 parmak izleriyle aynı",
  () => {
    Object.entries(
      expectedProductionHashes
    ).forEach(([relativePath, expectedHash]) => {
      const targetPath =
        relativePath.includes("/")
          ? relativePath
          : (
              relativePath.endsWith(".js") &&
              relativePath !== "sw.js"
                ? `modules/${relativePath}`
                : relativePath
            );

      assert.equal(
        sha256(targetPath),
        expectedHash,
        relativePath
      );
    });
  }
);

test(
  "NUT-011 ile genişleyen 129 HTML kimliği benzersiz",
  () => {
    const updatedIds = matches(
      updatedHtml,
      /\bid="([^"]+)"/g
    );

    assert.equal(updatedIds.length, 129);
    assert.equal(
      new Set(updatedIds).size,
      updatedIds.length
    );
    assert.deepEqual(
      sorted(updatedIds),
      expectedHtmlIds
    );
  }
);

test(
  "Altı görünüm ve görünüm adları değişmedi",
  () => {
    const updatedViews = matches(
      updatedHtml,
      /\bdata-view="([^"]+)"/g
    );

    const physicalUpdatedViews =
      updatedViews.filter(
        view => !view.includes("$")
      );

    assert.deepEqual(
      sorted(
        new Set(
          physicalUpdatedViews
        )
      ),
      [
        "calendar",
        "health",
        "home",
        "modules",
        "pick",
        "sky"
      ]
    );
  }
);

test(
  "AI, Connect ve beslenme veri katmanları Router öncesinde doğru sırada yükleniyor",
  () => {
    const scripts = matches(
      updatedHtml,
      /<script\s+src="([^"]+)"\s*><\/script>/g
    );

    assert.deepEqual(scripts, [
      "./modules/error-manager.js",
      "./modules/service-worker-manager.js",
      "./modules/storage.js",
      "./modules/version.js",
      "./modules/migration.js",
      "./modules/day-manager.js",
      "./modules/state-manager.js",
      "./modules/adapter-interfaces.js",
      "./modules/nutrition-contracts.js",
      "./modules/nutrition-calculations.js",
      "./modules/nutrition-storage.js",
      "./modules/nutrition-migrations.js",
      "./modules/nutrition-profile.js",
      "./modules/nutrition-library.js",
      "./modules/nutrition-entry.js",
      "./modules/nutrition-planning.js",
      "./modules/nutrition-history.js",
      "./modules/nutrition-ui.js",
      "./modules/nutrition-library-ui.js",
      "./modules/router.js",
      "./modules/module-registry.js",
      "./modules/startup-manager.js"
    ]);
  }
);

test(
  "Adaptör arayüzü bağlantısı index içinde yalnız bir kez bulunuyor",
  () => {
    const scriptLine =
      '<script src="./modules/adapter-interfaces.js"></script>\n';

    assert.equal(
      updatedHtml
        .split(scriptLine)
        .length,
      2
    );
  }
);

test(
  "Migration doğru sırada çalışma zamanına alındı ve eski Bridge pasif kaldı",
  () => {
    assert.ok(
      updatedHtml.includes(
        "./modules/migration.js"
      )
    );
    assert.equal(
      updatedHtml.includes(
        "./modules/bridge.js"
      ),
      false
    );
  }
);

test(
  "Migration state yüklenmeden önce Startup Manager kapısında çalışıyor",
  () => {
    const migrationPosition =
      updatedHtml.indexOf(
        "window.TodayMigration.run()"
      );
    const statePosition =
      updatedHtml.indexOf(
        "window.TodayState.load()"
      );

    assert.ok(
      migrationPosition > -1
    );
    assert.ok(
      statePosition > -1
    );
    assert.ok(
      migrationPosition <
        statePosition
    );
    assert.ok(
      updatedHtml.includes(
        "TODAY-MIGRATION-UNKNOWN"
      )
    );
  }
);

test(
  "Today Core soru ve kalıcı seçim kodları korunuyor",
  () => {
    [
      "Bugün sende ne oldu?",
      'data-choice="A"',
      'data-choice="B"',
      'data-choice="C"',
      "Bir şey oldu ama adı yok",
      "Her şey çok net",
      "Zordu bugün"
    ].forEach((text) => {
      assert.ok(
        updatedHtml.includes(text),
        text
      );
    });
  }
);

test(
  "Inline uygulama Startup Manager kapısından başlıyor",
  () => {
    assert.ok(
      updatedHtml.includes(
        "window.TodayStartup.start({"
      )
    );
    assert.ok(
      updatedHtml.includes(
        'serviceWorkerUrl: "./sw.js"'
      )
    );
    assert.equal(
      updatedHtml.includes(
        "if (!window.TodayDay)"
      ),
      false
    );
    assert.equal(
      updatedHtml.includes(
        "if (!window.TodayState)"
      ),
      false
    );
  }
);

test(
  "Startup Manager Service Worker kaydını güncelleme yöneticisine devrediyor",
  () => {
    const startup = fs.readFileSync(
      "modules/startup-manager.js",
      "utf8"
    );

    assert.ok(
      startup.includes(
        "window.TodayServiceWorker"
      )
    );
    assert.ok(
      startup.includes(
        "updateManager.start({"
      )
    );
    assert.ok(
      startup.includes(
        "managerAvailable"
      )
    );
    assert.ok(
      startup.includes(
        '"today:service-worker-update-error"'
      )
    );
  }
);

test(
  "Inline uygulama merkezi hata yöneticisi sözleşmesini doğruluyor",
  () => {
    assert.ok(
      updatedHtml.includes(
        "const errorManager ="
      )
    );
    assert.ok(
      updatedHtml.includes(
        "window.TodayErrors;"
      )
    );
    assert.ok(
      updatedHtml.includes(
        "errorManager?.getState?.().initialized"
      )
    );
    assert.ok(
      updatedHtml.includes(
        "TODAY-STARTUP-004"
      )
    );
    assert.ok(
      updatedHtml.includes(
        "TODAY-STARTUP-005"
      )
    );
  }
);

test(
  "Service Worker ve state hataları sessizce yutulmuyor",
  () => {
    assert.equal(
      updatedHtml.includes(
        ".catch(() => {})"
      ),
      false
    );
    assert.ok(
      updatedHtml.includes(
        '"today:service-worker-error"'
      )
    );
    assert.ok(
      updatedHtml.includes(
        'errorCode: "TODAY-STATE-001"'
      )
    );
    assert.ok(
      updatedHtml.includes(
        '"today:stateerror"'
      )
    );
    assert.ok(
      updatedHtml.includes(
        "reportError("
      )
    );
  }
);

test(
  "Görünüm geçişleri yalnızca Today Router üzerinden yapılıyor",
  () => {
    assert.ok(
      updatedHtml.includes(
        "const router = window.TodayRouter;"
      )
    );
    assert.ok(
      updatedHtml.includes(
        'router.init({'
      )
    );
    assert.ok(
      updatedHtml.includes(
        'router.navigate("statistics")'
      )
    );
    assert.ok(
      updatedHtml.includes(
        'router.navigate("settings")'
      )
    );
    assert.ok(
      updatedHtml.includes(
        'router.backTo("modules")'
      )
    );
    assert.ok(
      updatedHtml.includes(
        'router.backTo("pick")'
      )
    );
    assert.equal(
      /\bshowView\s*\(/.test(updatedHtml),
      false
    );
  }
);

test(
  "Modül açma akışı yalnızca Today Modules üzerinden yönetiliyor",
  () => {
    assert.ok(
      updatedHtml.includes(
        "const moduleRegistry ="
      )
    );
    assert.ok(
      updatedHtml.includes(
        "window.TodayModules;"
      )
    );
    assert.ok(
      updatedHtml.includes(
        "moduleRegistry.init({"
      )
    );
    assert.equal(
      updatedHtml.includes(
        "openTodayCore"
      ),
      false
    );
    assert.equal(
      updatedHtml.includes(
        "openTodayHealth"
      ),
      false
    );
    assert.equal(
      updatedHtml.includes(
        "openTodaySky"
      ),
      false
    );
    assert.equal(
      updatedHtml.includes(
        'moduleName === "core"'
      ),
      false
    );
    assert.equal(
      updatedHtml.includes(
        'moduleName === "health"'
      ),
      false
    );
    assert.equal(
      updatedHtml.includes(
        'moduleName === "sky"'
      ),
      false
    );
  }
);

test(
  "Üç modül kartı ve dokuz alt navigasyon tetikleyicisi korunuyor",
  () => {
    assert.deepEqual(
      matches(
        updatedHtml,
        /\bdata-module="([^"]+)"/g
      ),
      [
        "core",
        "health",
        "sky"
      ]
    );
    assert.deepEqual(
      matches(
        updatedHtml,
        /\bdata-open-module="([^"]+)"/g
      ),
      [
        "core",
        "health",
        "sky",
        "core",
        "health",
        "sky",
        "core",
        "health",
        "sky"
      ]
    );
  }
);

test(
  "Inline JavaScript sözdizimi geçerli",
  () => {
    const inlineScripts = [
      ...updatedHtml.matchAll(
        /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi
      )
    ]
      .map((match) => match[1])
      .filter((script) => script.trim());

    assert.equal(inlineScripts.length, 1);

    new vm.Script(inlineScripts[0], {
      filename: "index.inline.js"
    });
  }
);

test(
  "Router JavaScript sözdizimi geçerli",
  () => {
    const router = fs.readFileSync(
      "modules/router.js",
      "utf8"
    );

    new vm.Script(router, {
      filename: "router.js"
    });
  }
);

test(
  "Module Registry JavaScript sözdizimi geçerli",
  () => {
    const registry = fs.readFileSync(
      "modules/module-registry.js",
      "utf8"
    );

    new vm.Script(registry, {
      filename: "module-registry.js"
    });
  }
);

test(
  "Central Error Manager JavaScript sözdizimi geçerli",
  () => {
    const errorManager =
      fs.readFileSync(
        "modules/error-manager.js",
        "utf8"
      );

    new vm.Script(errorManager, {
      filename: "error-manager.js"
    });
  }
);

test(
  "Schema & Migration Orchestrator JavaScript sözdizimi geçerli",
  () => {
    const migration =
      fs.readFileSync(
        "modules/migration.js",
        "utf8"
      );

    new vm.Script(migration, {
      filename: "migration.js"
    });

    assert.equal(
      migration.includes(
        "localStorage.removeItem"
      ),
      false
    );
  }
);

test(
  "Service Worker Update Manager JavaScript sözdizimi geçerli",
  () => {
    const manager = fs.readFileSync(
      "modules/service-worker-manager.js",
      "utf8"
    );

    new vm.Script(manager, {
      filename:
        "service-worker-manager.js"
    });

    assert.equal(
      manager.includes(
        "localStorage"
      ),
      false
    );
    assert.equal(
      manager.includes(
        "sessionStorage"
      ),
      false
    );
  }
);

test(
  "AI, Connect ve beslenmenin servis ile görünür UI katmanları JavaScript sözdizimi geçerli",
  () => {
    const adapters =
      fs.readFileSync(
        "modules/adapter-interfaces.js",
        "utf8"
      );

    new vm.Script(adapters, {
      filename:
        "adapter-interfaces.js"
    });

    const profile =
      fs.readFileSync(
        "modules/nutrition-profile.js",
        "utf8"
      );

    new vm.Script(profile, {
      filename:
        "nutrition-profile.js"
    });

    const library =
      fs.readFileSync(
        "modules/nutrition-library.js",
        "utf8"
      );

    new vm.Script(library, {
      filename:
        "nutrition-library.js"
    });

    const entry =
      fs.readFileSync(
        "modules/nutrition-entry.js",
        "utf8"
      );

    new vm.Script(entry, {
      filename:
        "nutrition-entry.js"
    });

    const planning =
      fs.readFileSync(
        "modules/nutrition-planning.js",
        "utf8"
      );

    new vm.Script(planning, {
      filename:
        "nutrition-planning.js"
    });

    const history =
      fs.readFileSync(
        "modules/nutrition-history.js",
        "utf8"
      );

    new vm.Script(history, {
      filename:
        "nutrition-history.js"
    });

    const nutritionUI =
      fs.readFileSync(
        "modules/nutrition-ui.js",
        "utf8"
      );

    new vm.Script(nutritionUI, {
      filename:
        "nutrition-ui.js"
    });

    const nutritionLibraryUI =
      fs.readFileSync(
        "modules/nutrition-library-ui.js",
        "utf8"
      );

    new vm.Script(nutritionLibraryUI, {
      filename:
        "nutrition-library-ui.js"
    });

    [
      "window.TodayAI",
      "window.TodayConnect",
      "requestProposal",
      "prepareAction",
      "approveAction",
      "requiresApproval"
    ].forEach(text => {
      assert.ok(
        adapters.includes(text),
        text
      );
    });

    [
      "window.TodayNutritionProfile",
      "createGoalVersion",
      "acceptGoalDraft",
      "userConfirmed"
    ].forEach(text => {
      assert.ok(
        profile.includes(text),
        text
      );
    });

    [
      "window.TodayNutritionLibrary",
      "createFood",
      "createRecipe",
      "restoreItem",
      "acceptDraft",
      "getConstraintWarnings"
    ].forEach(text => {
      assert.ok(
        library.includes(text),
        text
      );
    });

    [
      "window.TodayNutritionPlanning",
      "createPlan",
      "reschedulePlannedMeal",
      "acceptPlanDraft",
      "consumePlannedMeal"
    ].forEach(text => {
      assert.ok(
        planning.includes(text),
        text
      );
    });

    [
      "window.TodayNutritionEntry",
      "logMeal",
      "logHydration",
      "logPlannedMeal",
      "acceptDraft"
    ].forEach(text => {
      assert.ok(
        entry.includes(text),
        text
      );
    });

    [
      "window.TodayNutritionHistory",
      "loadDay",
      "archiveEntry",
      "restoreEntry",
      "confirmEntryArchive"
    ].forEach(text => {
      assert.ok(
        history.includes(text),
        text
      );
    });

    [
      "window.TodayNutritionUI",
      "TodayNutritionEntry",
      "TodayNutritionPlanning",
      "confirmPlanConsumption",
      "data-health-water-ml"
    ].forEach(text => {
      assert.ok(
        nutritionUI.includes(text),
        text
      );
    });

    [
      "window.TodayNutritionLibraryUI",
      "createFood",
      "updateFood",
      "createRecipe",
      "updateRecipe",
      "archiveItem",
      "restoreItem",
      "data-health-library-management-action"
    ].forEach(text => {
      assert.ok(
        nutritionLibraryUI.includes(text),
        text
      );
    });
  }
);

test(
  "Adaptör sınırı UI, kalıcı veri anahtarı ve gerçek ağ sağlayıcısına doğrudan bağlanmıyor",
  () => {
    const adapters =
      fs.readFileSync(
        "modules/adapter-interfaces.js",
        "utf8"
      );

    [
      "localStorage",
      "sessionStorage",
      "today_app_v10",
      "today_store_v2",
      "today_store_v2_backup",
      "querySelector",
      "getElementById",
      "createElement",
      "fetch(",
      "XMLHttpRequest",
      "WebSocket",
      "navigator."
    ].forEach(text => {
      assert.equal(
        adapters.includes(text),
        false,
        text
      );
    });
  }
);

test(
  "Startup Manager AI ve Connect sözleşmelerini uygulama başlamadan doğruluyor",
  () => {
    const startup =
      fs.readFileSync(
        "modules/startup-manager.js",
        "utf8"
      );

    [
      '"TodayAI"',
      '"TodayConnect"',
      '"requestProposal"',
      '"prepareAction"',
      '"approveAction"',
      "ADAPTER_INTERFACE_VERSION",
      "MAX_PENDING_ACTIONS"
    ].forEach(text => {
      assert.ok(
        startup.includes(text),
        text
      );
    });
  }
);

test(
  "Normal ürün akışı gerçek AI veya Connect sağlayıcısı kaydetmiyor",
  () => {
    const inlineScript =
      [
        ...updatedHtml.matchAll(
          /<script>([\s\S]*?)<\/script>/gi
        )
      ]
        .map(match => match[1])
        .join("\n");

    [
      "TodayAI.registerAdapter",
      "TodayConnect.registerAdapter",
      "requestProposal(",
      "prepareAction(",
      "approveAction("
    ].forEach(text => {
      assert.equal(
        inlineScript.includes(text),
        false,
        text
      );
    });
  }
);

test(
  "foundation-010 geçişi eski hazır olayı ve registration keşfiyle korunuyor",
  () => {
    const manager = fs.readFileSync(
      "modules/service-worker-manager.js",
      "utf8"
    );
    const startup = fs.readFileSync(
      "modules/startup-manager.js",
      "utf8"
    );

    assert.ok(
      manager.includes(
        '"today:service-worker-ready"'
      )
    );
    assert.ok(
      manager.includes(
        ".getRegistration()"
      )
    );
    assert.ok(
      manager.includes(
        "event.detail.registration"
      )
    );
    assert.ok(
      startup.includes(
        "registration:"
      )
    );
  }
);

test(
  "Service Worker foundation-023 ve 28 dosyalık kabuk kullanıyor",
  () => {
    const sw = fs.readFileSync(
      "sw.js",
      "utf8"
    );
    const shellMatch = sw.match(
      /const APP_SHELL = \[([\s\S]*?)\];/
    );

    assert.ok(
      sw.includes(
        'const VERSION = "today-v2-foundation-023"'
      )
    );
    assert.ok(shellMatch);

    const shellEntries = matches(
      shellMatch[1],
      /"([^"]+)"/g
    );

    assert.equal(shellEntries.length, 28);
    assert.equal(
      shellEntries.filter(
        (entry) =>
          entry ===
          "./modules/error-manager.js"
      ).length,
      1
    );
    assert.equal(
      shellEntries.filter(
        (entry) =>
          entry ===
          "./modules/service-worker-manager.js"
      ).length,
      1
    );
    assert.equal(
      shellEntries.filter(
        (entry) =>
          entry ===
          "./modules/migration.js"
      ).length,
      1
    );
    assert.equal(
      shellEntries.filter(
        (entry) =>
          entry ===
          "./modules/adapter-interfaces.js"
      ).length,
      1
    );
    assert.equal(
      shellEntries.filter(
        (entry) =>
          entry ===
            "./modules/nutrition-contracts.js"
      ).length,
      1
    );
    assert.equal(
      shellEntries.filter(
        (entry) =>
          entry ===
            "./modules/nutrition-calculations.js"
      ).length,
      1
    );
    assert.equal(
      shellEntries.filter(
        (entry) =>
          entry ===
          "./modules/nutrition-storage.js"
      ).length,
      1
    );
    assert.equal(
      shellEntries.filter(
        (entry) =>
          entry ===
          "./modules/nutrition-migrations.js"
      ).length,
      1
    );
    assert.equal(
      shellEntries.filter(
        (entry) =>
          entry ===
          "./modules/nutrition-profile.js"
      ).length,
      1
    );
    assert.equal(
      shellEntries.filter(
        (entry) =>
          entry ===
          "./modules/nutrition-library.js"
      ).length,
      1
    );
    assert.equal(
      shellEntries.filter(
        (entry) =>
          entry ===
          "./modules/nutrition-entry.js"
      ).length,
      1
    );
    assert.equal(
      shellEntries.filter(
        (entry) =>
          entry ===
          "./modules/nutrition-planning.js"
      ).length,
      1
    );
    assert.equal(
      shellEntries.filter(
        (entry) =>
          entry ===
          "./modules/nutrition-history.js"
      ).length,
      1
    );
    assert.equal(
      shellEntries.filter(
        (entry) =>
          entry ===
          "./modules/nutrition-ui.js"
      ).length,
      1
    );
    assert.equal(
      shellEntries.filter(
        (entry) =>
          entry ===
          "./modules/nutrition-library-ui.js"
      ).length,
      1
    );
    assert.equal(
      shellEntries.filter(
        (entry) =>
          entry ===
          "./modules/router.js"
      ).length,
      1
    );
    assert.equal(
      shellEntries.filter(
        (entry) =>
          entry ===
          "./modules/module-registry.js"
      ).length,
      1
    );
    assert.equal(
      shellEntries.filter(
        (entry) =>
          entry ===
          "./modules/startup-manager.js"
      ).length,
      1
    );
  }
);

test(
  "Service Worker 005 güvenlik düzeltmelerini koruyor",
  () => {
    const sw = fs.readFileSync(
      "sw.js",
      "utf8"
    );

    [
      'new Request(url, { cache: "reload" })',
      "cacheName !== CACHE_NAME",
      'cache.put("./index.html", response.clone())'
    ].forEach((text) => {
      assert.ok(sw.includes(text), text);
    });

    assert.equal(
      sw.includes("caches.match("),
      false
    );
  }
);

test(
  "Service Worker bekleme ve açık onay sözleşmesini kullanıyor",
  () => {
    const sw = fs.readFileSync(
      "sw.js",
      "utf8"
    );
    const installBlock =
      sw.match(
        /self\.addEventListener\("install"[\s\S]*?\n\}\);/
      )?.[0] || "";

    assert.ok(
      sw.includes(
        '"TODAY_ACTIVATE_UPDATE"'
      )
    );
    assert.ok(
      sw.includes(
        'self.addEventListener("message"'
      )
    );
    assert.ok(
      sw.includes(
        "event.data.type !== ACTIVATE_MESSAGE"
      )
    );
    assert.ok(
      sw.includes(
        "self.skipWaiting()"
      )
    );
    assert.equal(
      installBlock.includes(
        "skipWaiting"
      ),
      false
    );
  }
);

const failed = results.filter(
  (result) => !result.success
);

results.forEach((result) => {
  const prefix = result.success
    ? "PASS"
    : "FAIL";
  const suffix = result.error
    ? ` — ${result.error}`
    : "";

  console.log(
    `${prefix}: ${result.name}${suffix}`
  );
});

console.log(
  `Static Regression: ${
    results.length - failed.length
  }/${results.length} başarılı`
);

if (failed.length > 0) {
  process.exitCode = 1;
}
