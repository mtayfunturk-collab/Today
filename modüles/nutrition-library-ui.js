/**
 * Today App — Nutrition Library UI
 * NUT-011 — Visible food and recipe library management
 *
 * This module exposes user-created foods and recipes without owning storage or
 * calculation rules. Every write is delegated to the versioned NUT-005
 * library. Existing meal snapshots are never rewritten.
 */

(function () {
  "use strict";

  const MANAGER_API_VERSION = 1;
  const MANAGER_RULESET_ID =
    "today:nutrition:library-ui:v1";
  const LIBRARY_EXTENSION_KEY =
    "today.nutrition.library";
  const SNAPSHOT_EXTENSION_KEY =
    "today.nutrition.library-snapshot";
  const MAX_VISIBLE_MANAGED_ITEMS = 30;
  const MAX_VISIBLE_INGREDIENT_RESULTS = 20;
  const MAX_RECIPE_INGREDIENTS = 30;

  const MANAGED_TYPES = Object.freeze({
    food_version: "Besin",
    recipe_version: "Tarif"
  });
  const NUTRIENT_FIELDS = Object.freeze({
    energy: Object.freeze({
      elementId: "healthLibraryEnergy",
      label: "Kalori",
      unit: "kcal"
    }),
    protein: Object.freeze({
      elementId: "healthLibraryProtein",
      label: "Protein",
      unit: "g"
    }),
    carbohydrate: Object.freeze({
      elementId: "healthLibraryCarbohydrate",
      label: "Karbonhidrat",
      unit: "g"
    }),
    fat: Object.freeze({
      elementId: "healthLibraryFat",
      label: "Yağ",
      unit: "g"
    })
  });
  const UNIT_LABELS = Object.freeze({
    mcg: "mcg",
    mg: "mg",
    g: "g",
    kg: "kg",
    ml: "ml",
    cl: "cl",
    dl: "dl",
    l: "L",
    count: "adet",
    piece: "adet",
    portion: "porsiyon",
    serving: "porsiyon",
    slice: "dilim"
  });
  const REQUIRED_IDS = Object.freeze([
    "healthLibraryManager",
    "healthLibraryManagerCount",
    "btnHealthNewFood",
    "btnHealthNewRecipe",
    "healthLibraryEditor",
    "healthLibraryEditorTitle",
    "healthLibraryEditorKind",
    "healthLibraryEditorName",
    "healthLibraryEditorAmount",
    "healthLibraryEditorUnit",
    "healthLibraryFoodFields",
    "healthLibraryEnergy",
    "healthLibraryProtein",
    "healthLibraryCarbohydrate",
    "healthLibraryFat",
    "healthLibraryRecipeFields",
    "healthRecipeIngredientSearch",
    "healthRecipeIngredientResultCount",
    "healthRecipeIngredientResults",
    "healthRecipeIngredientCount",
    "healthRecipeIngredientSelected",
    "healthLibraryTags",
    "healthLibraryPreparation",
    "healthLibraryEditorNote",
    "btnHealthLibrarySave",
    "btnHealthLibraryCancel",
    "healthLibraryManageList",
    "healthLibraryArchivedSection",
    "healthLibraryArchivedCount",
    "healthLibraryArchivedList",
    "healthLibraryManagerStatus"
  ]);

  let root = null;
  let elements = null;
  let initialized = false;
  let opened = false;
  let busy = false;
  let refreshSequence = 0;
  let operationSequence = 0;
  let lastErrorCode = null;
  let allActiveRecords = [];
  let managedActiveRecords = [];
  let managedArchivedRecords = [];
  let editor = {
    open: false,
    kind: null,
    recordId: null
  };
  const recipeIngredients = new Map();

  function createError(
    code,
    message,
    detail = null,
    cause = null
  ) {
    const error = new Error(message);
    error.name =
      "TodayNutritionLibraryUIError";
    error.todayCode = code;
    error.detail = detail;

    if (cause) {
      error.cause = cause;
    }

    return error;
  }

  function clone(value) {
    if (value === undefined) {
      return undefined;
    }

    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
  }

  function deepFreeze(value) {
    if (
      !value ||
      typeof value !== "object" ||
      Object.isFrozen(value)
    ) {
      return value;
    }

    Object.keys(value).forEach(key =>
      deepFreeze(value[key])
    );
    return Object.freeze(value);
  }

  function frozenClone(value) {
    return deepFreeze(clone(value));
  }

  function getDependencies() {
    const library =
      window.TodayNutritionLibrary;
    const storage =
      window.TodayNutritionStorage;
    const calculations =
      window.TodayNutritionCalculations;
    const missing = [];

    [
      "getSnapshot",
      "createFood",
      "updateFood",
      "createRecipe",
      "updateRecipe",
      "archiveItem",
      "restoreItem"
    ].forEach(methodName => {
      if (
        !library ||
        typeof library[methodName] !== "function"
      ) {
        missing.push(
          `TodayNutritionLibrary.${methodName}`
        );
      }
    });

    if (
      !storage ||
      typeof storage.getRecord !== "function"
    ) {
      missing.push(
        "TodayNutritionStorage.getRecord"
      );
    }

    [
      "listUnits",
      "canConvert"
    ].forEach(methodName => {
      if (
        !calculations ||
        typeof calculations[methodName] !==
          "function"
      ) {
        missing.push(
          `TodayNutritionCalculations.${methodName}`
        );
      }
    });

    if (missing.length > 0) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-UI-001",
        "Beslenme kütüphanesi yönetim bağımlılıkları hazır değil.",
        { missing }
      );
    }

    return {
      library,
      storage,
      calculations
    };
  }

  function collectElements(target) {
    if (
      !target ||
      typeof target.getElementById !== "function"
    ) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-UI-002",
        "Kütüphane yönetimi için geçerli bir belge gerekir."
      );
    }

    const collected = {};
    const missing = [];

    REQUIRED_IDS.forEach(id => {
      const element = target.getElementById(id);

      if (!element) {
        missing.push(id);
        return;
      }

      collected[id] = element;
    });

    if (missing.length > 0) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-UI-002",
        "Kütüphane yönetim arayüzünde eksik öğeler var.",
        { missing }
      );
    }

    return collected;
  }

  function getState() {
    return frozenClone({
      initialized,
      opened,
      busy,
      lastErrorCode,
      activeCount:
        managedActiveRecords.length,
      archivedCount:
        managedArchivedRecords.length,
      editor: {
        open: editor.open,
        kind: editor.kind,
        recordId: editor.recordId,
        ingredientCount:
          recipeIngredients.size,
        ingredients: [
          ...recipeIngredients.values()
        ]
      }
    });
  }

  function makeOperationId(kind) {
    operationSequence += 1;

    return [
      "health-library-ui",
      kind,
      Date.now().toString(36),
      operationSequence.toString(36)
    ].join("-");
  }

  function confirmation(kind) {
    return {
      userInitiated: true,
      userConfirmed: true,
      at: new Date().toISOString(),
      clientOperationId:
        makeOperationId(kind)
    };
  }

  function libraryMeta(record) {
    return record?.extensions?.[
      LIBRARY_EXTENSION_KEY
    ] || {};
  }

  function defaultAmount(record) {
    if (record?.type === "food_version") {
      return clone(
        record.payload?.servingBasis
      );
    }

    if (record?.type === "recipe_version") {
      return clone(record.payload?.yield);
    }

    return null;
  }

  function usableAmount(amount) {
    return Boolean(
      amount &&
      ["known", "estimated"].includes(
        amount.status
      ) &&
      typeof amount.value === "number" &&
      Number.isFinite(amount.value) &&
      amount.value > 0 &&
      typeof amount.unit === "string" &&
      amount.unit
    );
  }

  function formatNumber(value) {
    return new Intl.NumberFormat(
      "tr-TR",
      { maximumFractionDigits: 2 }
    ).format(value);
  }

  function formatAmount(amount) {
    if (!usableAmount(amount)) {
      return "miktar eksik";
    }

    const prefix =
      amount.status === "estimated"
        ? "yaklaşık "
        : "";

    return `${prefix}${formatNumber(
      amount.value
    )} ${
      UNIT_LABELS[amount.unit] ||
      amount.unit
    }`;
  }

  function isVisibleSource(record) {
    return Boolean(
      record &&
      Object.prototype.hasOwnProperty.call(
        MANAGED_TYPES,
        record.type
      ) &&
      record.recordStatus === "active" &&
      record.source?.kind !== "ai_draft" &&
      [
        "user_confirmed",
        "source_verified"
      ].includes(record.verificationStatus) &&
      typeof record.payload?.name === "string" &&
      record.payload.name.trim()
    );
  }

  function isUserManaged(record, status) {
    return Boolean(
      record &&
      Object.prototype.hasOwnProperty.call(
        MANAGED_TYPES,
        record.type
      ) &&
      record.recordStatus === status &&
      record.source?.kind === "manual" &&
      record.verificationStatus ===
        "user_confirmed"
    );
  }

  function compareRecords(left, right) {
    return left.payload.name.localeCompare(
      right.payload.name,
      "tr-TR"
    ) || left.id.localeCompare(right.id);
  }

  function setStatus(
    message,
    kind = "neutral"
  ) {
    elements.healthLibraryManagerStatus
      .textContent = message || "";
    elements.healthLibraryManagerStatus
      .dataset.kind = kind;
  }

  function syncDisabledState() {
    root
      .querySelectorAll(
        "[data-health-library-management-action]"
      )
      .forEach(control => {
        control.disabled =
          busy ||
          control.dataset
            .healthLibraryUnavailable ===
            "true";
      });
  }

  function setBusy(nextBusy) {
    busy = nextBusy === true;
    elements.healthLibraryManager
      .setAttribute(
        "aria-busy",
        String(busy)
      );
    syncDisabledState();
  }

  function emptyList(list, message) {
    const item = root.createElement("li");
    item.className = "healthEmptyItem";
    item.textContent = message;
    list.replaceChildren(item);
  }

  function recordVersion(record) {
    return libraryMeta(record).version || "—";
  }

  function renderManagedItem(
    list,
    record,
    archived = false
  ) {
    const item = root.createElement("li");
    const content = root.createElement("div");
    const title = root.createElement("strong");
    const meta = root.createElement("span");
    const actions = root.createElement("div");

    item.className =
      "healthLibraryItem healthLibraryManagedItem";
    content.className =
      "healthListContent";
    title.className =
      "healthListTitle";
    meta.className =
      "healthListMeta";
    actions.className =
      "healthLibraryManagedActions";
    title.textContent = record.payload.name;
    meta.textContent = [
      MANAGED_TYPES[record.type],
      formatAmount(defaultAmount(record)),
      `v${recordVersion(record)}`
    ].join(" · ");
    content.append(title, meta);

    if (archived) {
      const restoreButton =
        root.createElement("button");
      restoreButton.type = "button";
      restoreButton.className =
        "healthLibraryAction";
      restoreButton.textContent = "Geri al";
      restoreButton.dataset
        .restoreNutritionLibrary =
          record.id;
      restoreButton.dataset
        .healthLibraryManagementAction =
          "true";
      restoreButton.setAttribute(
        "aria-label",
        `${record.payload.name} kaydını kütüphaneye geri al`
      );
      actions.append(restoreButton);
    } else {
      const editButton =
        root.createElement("button");
      const archiveButton =
        root.createElement("button");

      editButton.type = "button";
      editButton.className =
        "healthLibraryAction";
      editButton.textContent = "Düzenle";
      editButton.dataset
        .editNutritionLibrary =
          record.id;
      editButton.dataset
        .healthLibraryManagementAction =
          "true";
      editButton.setAttribute(
        "aria-label",
        `${record.payload.name} kaydını yeni sürüm olarak düzenle`
      );

      archiveButton.type = "button";
      archiveButton.className =
        "healthLibraryAction";
      archiveButton.textContent = "Arşivle";
      archiveButton.dataset
        .archiveNutritionLibrary =
          record.id;
      archiveButton.dataset
        .healthLibraryManagementAction =
          "true";
      archiveButton.setAttribute(
        "aria-label",
        `${record.payload.name} kaydını arşivle`
      );
      actions.append(
        editButton,
        archiveButton
      );
    }

    item.append(content, actions);
    list.append(item);
  }

  function renderManagerLists() {
    const activeList =
      elements.healthLibraryManageList;
    const archivedList =
      elements.healthLibraryArchivedList;
    const active = managedActiveRecords
      .slice(0, MAX_VISIBLE_MANAGED_ITEMS);
    const archived = managedArchivedRecords
      .slice(0, MAX_VISIBLE_MANAGED_ITEMS);

    elements.healthLibraryManagerCount
      .textContent = String(
        managedActiveRecords.length
      );
    activeList.replaceChildren();

    if (active.length === 0) {
      emptyList(
        activeList,
        "Henüz kendi besin veya tarif kaydın yok."
      );
    } else {
      active.forEach(record =>
        renderManagedItem(
          activeList,
          record
        )
      );
    }

    elements.healthLibraryArchivedCount
      .textContent = String(
        managedArchivedRecords.length
      );
    elements.healthLibraryArchivedSection
      .hidden = archived.length === 0;
    archivedList.replaceChildren();

    if (archived.length === 0) {
      emptyList(
        archivedList,
        "Arşivlenmiş kütüphane kaydı yok."
      );
    } else {
      archived.forEach(record =>
        renderManagedItem(
          archivedList,
          record,
          true
        )
      );
    }

    syncDisabledState();
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .trim()
      .toLocaleLowerCase("tr-TR")
      .replace(/\s+/g, " ");
  }

  function currentEditorLogicalId() {
    const current = allActiveRecords.find(
      record => record.id === editor.recordId
    );

    return current
      ? libraryMeta(current).logicalId
      : null;
  }

  function ingredientCandidates() {
    const query = normalizeSearchText(
      elements.healthRecipeIngredientSearch
        .value
    );
    const logicalId =
      currentEditorLogicalId();

    return allActiveRecords
      .filter(record =>
        usableAmount(defaultAmount(record)) &&
        libraryMeta(record).logicalId !==
          logicalId &&
        normalizeSearchText(
          record.payload.name
        ).includes(query)
      )
      .sort(compareRecords)
      .slice(
        0,
        MAX_VISIBLE_INGREDIENT_RESULTS
      );
  }

  function renderIngredientResults() {
    const list =
      elements.healthRecipeIngredientResults;
    const records = ingredientCandidates();

    elements.healthRecipeIngredientResultCount
      .textContent = String(records.length);
    list.replaceChildren();

    if (records.length === 0) {
      emptyList(
        list,
        allActiveRecords.length === 0
          ? "Tarif oluşturmak için önce en az bir besin ekle."
          : "Aramana uyan, miktarı kullanılabilir bir besin veya tarif yok."
      );
      return;
    }

    records.forEach(record => {
      const item = root.createElement("li");
      const content = root.createElement("div");
      const title = root.createElement("strong");
      const meta = root.createElement("span");
      const button = root.createElement("button");
      const selected =
        recipeIngredients.has(record.id);

      item.className =
        "healthLibraryItem";
      content.className =
        "healthListContent";
      title.className =
        "healthListTitle";
      meta.className =
        "healthListMeta";
      title.textContent = record.payload.name;
      meta.textContent = [
        MANAGED_TYPES[record.type],
        formatAmount(defaultAmount(record))
      ].join(" · ");
      content.append(title, meta);

      button.type = "button";
      button.className =
        "healthLibraryAction";
      button.textContent = selected
        ? "Eklendi"
        : "Ekle";
      button.dataset
        .addRecipeIngredient = record.id;
      button.dataset
        .healthLibraryManagementAction =
          "true";
      button.dataset
        .healthLibraryUnavailable =
          String(selected);
      button.disabled = busy || selected;
      button.setAttribute(
        "aria-label",
        `${record.payload.name} tarif bileşenlerine ekle`
      );
      item.append(content, button);
      list.append(item);
    });
  }

  function compatibleUnits(record) {
    const amount = defaultAmount(record);

    if (!usableAmount(amount)) {
      return [];
    }

    return getDependencies()
      .calculations.listUnits()
      .filter(unit =>
        getDependencies()
          .calculations.canConvert(
            amount.unit,
            unit
          )
      )
      .sort((left, right) => {
        if (left === amount.unit) {
          return -1;
        }

        if (right === amount.unit) {
          return 1;
        }

        return left.localeCompare(right);
      });
  }

  function renderIngredientSelected() {
    const list =
      elements.healthRecipeIngredientSelected;
    const selected = [
      ...recipeIngredients.values()
    ];

    elements.healthRecipeIngredientCount
      .textContent = String(selected.length);
    list.replaceChildren();

    if (selected.length === 0) {
      emptyList(
        list,
        "Tarife henüz bir bileşen eklenmedi."
      );
      return;
    }

    selected.forEach(selection => {
      const source = allActiveRecords.find(
        record =>
          record.id === selection.recordId
      );

      if (!source) {
        return;
      }

      const item = root.createElement("li");
      const content = root.createElement("div");
      const title = root.createElement("strong");
      const controls = root.createElement("div");
      const amountInput = root.createElement("input");
      const unitSelect = root.createElement("select");
      const removeButton = root.createElement("button");

      item.className =
        "healthLibraryItem healthRecipeIngredientItem";
      content.className =
        "healthListContent";
      title.className =
        "healthListTitle";
      controls.className =
        "healthRecipeIngredientControls";
      title.textContent = selection.name;
      content.append(title);

      amountInput.className =
        "healthInput healthRecipeAmount";
      amountInput.type = "number";
      amountInput.min = "0.01";
      amountInput.step = "any";
      amountInput.inputMode = "decimal";
      amountInput.value =
        selection.amount?.value ?? "";
      amountInput.dataset
        .recipeIngredientAmount =
          selection.recordId;
      amountInput.dataset
        .healthLibraryManagementAction =
          "true";
      amountInput.setAttribute(
        "aria-label",
        `${selection.name} miktarı`
      );

      unitSelect.className =
        "healthSelect healthRecipeUnit";
      unitSelect.dataset
        .recipeIngredientUnit =
          selection.recordId;
      unitSelect.dataset
        .healthLibraryManagementAction =
          "true";
      unitSelect.setAttribute(
        "aria-label",
        `${selection.name} miktar birimi`
      );
      compatibleUnits(source).forEach(unit => {
        const option =
          root.createElement("option");
        option.value = unit;
        option.textContent =
          UNIT_LABELS[unit] || unit;
        option.selected =
          unit === selection.amount?.unit;
        unitSelect.append(option);
      });

      removeButton.type = "button";
      removeButton.className =
        "healthLibraryAction";
      removeButton.textContent = "Çıkar";
      removeButton.dataset
        .removeRecipeIngredient =
          selection.recordId;
      removeButton.dataset
        .healthLibraryManagementAction =
          "true";
      removeButton.setAttribute(
        "aria-label",
        `${selection.name} tarif bileşenlerinden çıkar`
      );

      controls.append(
        amountInput,
        unitSelect,
        removeButton
      );
      item.append(content, controls);
      list.append(item);
    });

    syncDisabledState();
  }

  function setEditorKind(kind) {
    const food = kind === "food";

    editor.kind = kind;
    elements.healthLibraryEditorKind
      .textContent = food
        ? "Besin"
        : "Tarif";
    elements.healthLibraryFoodFields
      .hidden = !food;
    elements.healthLibraryRecipeFields
      .hidden = food;
    elements.healthLibraryEditorAmount
      .value = food ? "100" : "1";
    elements.healthLibraryEditorUnit
      .value = food ? "g" : "portion";
    elements.healthLibraryEditorNote
      .textContent = food
        ? "Boş bıraktığın besin değerleri bilinmiyor olarak kalır; 0 kabul edilmez."
        : "Tarif değerleri seçtiğin bileşenlerden sürümlü olarak hesaplanır.";
  }

  function resetEditorFields(kind) {
    elements.healthLibraryEditorName.value =
      "";
    elements.healthLibraryTags.value = "";
    elements.healthLibraryPreparation.value =
      "";
    Object.values(NUTRIENT_FIELDS)
      .forEach(definition => {
        elements[definition.elementId].value =
          "";
      });
    elements.healthRecipeIngredientSearch
      .value = "";
    recipeIngredients.clear();
    setEditorKind(kind);
    renderIngredientResults();
    renderIngredientSelected();
  }

  function openCreate(kind) {
    editor = {
      open: true,
      kind,
      recordId: null
    };
    resetEditorFields(kind);
    elements.healthLibraryEditor.hidden =
      false;
    elements.healthLibraryEditorTitle
      .textContent = kind === "food"
        ? "Yeni besin"
        : "Yeni tarif";
    elements.btnHealthLibrarySave
      .textContent = kind === "food"
        ? "Besini kaydet"
        : "Tarifi kaydet";
    elements.healthLibraryEditorName.focus();
    setStatus("");
    syncDisabledState();
  }

  function closeEditor() {
    editor = {
      open: false,
      kind: null,
      recordId: null
    };
    recipeIngredients.clear();
    elements.healthLibraryEditor.hidden =
      true;
    renderIngredientSelected();
    renderIngredientResults();
  }

  function tagsFromRecord(record) {
    return (libraryMeta(record).tags || [])
      .join(", ");
  }

  function preparationFromRecord(record) {
    const preparation =
      libraryMeta(record).preparation;

    if (
      !preparation ||
      preparation.method === "unspecified"
    ) {
      return "";
    }

    return preparation.details
      ? `${preparation.method} — ${preparation.details}`
      : preparation.method;
  }

  function fillCommonEditor(record) {
    const amount = defaultAmount(record);

    elements.healthLibraryEditorName.value =
      record.payload.name;
    elements.healthLibraryEditorAmount.value =
      usableAmount(amount)
        ? String(amount.value)
        : "";
    elements.healthLibraryEditorUnit.value =
      usableAmount(amount)
        ? amount.unit
        : (
            record.type === "food_version"
              ? "g"
              : "portion"
          );
    elements.healthLibraryTags.value =
      tagsFromRecord(record);
    elements.healthLibraryPreparation.value =
      preparationFromRecord(record);
  }

  function fillFoodEditor(record) {
    const nutrients =
      record.payload.nutrients || {};

    Object.entries(NUTRIENT_FIELDS)
      .forEach(([key, definition]) => {
        const measurement = nutrients[key];
        elements[definition.elementId].value =
          measurement &&
          ["known", "estimated"].includes(
            measurement.status
          )
            ? String(measurement.value)
            : "";
      });
  }

  function sourceForSnapshot(snapshot) {
    const referenceId =
      snapshot?.payload?.referenceId;
    const meta = snapshot?.extensions?.[
      SNAPSHOT_EXTENSION_KEY
    ];
    const exact = allActiveRecords.find(
      record => record.id === referenceId
    );

    if (exact) {
      return exact;
    }

    return allActiveRecords.find(record =>
      libraryMeta(record).logicalId ===
        meta?.sourceLogicalId
    ) || null;
  }

  async function fillRecipeEditor(record) {
    let skipped = 0;

    recipeIngredients.clear();

    for (
      const snapshotId of
        record.payload.ingredientSnapshotIds || []
    ) {
      const snapshot =
        await getDependencies()
          .storage.getRecord(snapshotId);
      const source =
        sourceForSnapshot(snapshot);
      const amount = clone(
        snapshot?.payload?.amount
      );

      if (
        !source ||
        !usableAmount(amount) ||
        !usableAmount(defaultAmount(source)) ||
        !getDependencies()
          .calculations.canConvert(
            defaultAmount(source).unit,
            amount.unit
          )
      ) {
        skipped += 1;
        continue;
      }

      recipeIngredients.set(
        source.id,
        {
          recordId: source.id,
          name: source.payload.name,
          type: source.type,
          amount
        }
      );
    }

    renderIngredientResults();
    renderIngredientSelected();

    if (skipped > 0) {
      elements.healthLibraryEditorNote
        .textContent =
          `${skipped} eski bileşen artık etkin olmadığı için seçime alınmadı. Kaydetmeden önce bileşenleri gözden geçir.`;
    }
  }

  async function openEdit(recordId) {
    const record = managedActiveRecords.find(
      item => item.id === recordId
    );

    if (!record) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-UI-004",
        "Düzenlenecek etkin kullanıcı kaydı bulunamadı."
      );
    }

    const kind =
      record.type === "food_version"
        ? "food"
        : "recipe";

    editor = {
      open: true,
      kind,
      recordId: record.id
    };
    resetEditorFields(kind);
    fillCommonEditor(record);

    if (kind === "food") {
      fillFoodEditor(record);
    } else {
      await fillRecipeEditor(record);
    }

    elements.healthLibraryEditor.hidden =
      false;
    elements.healthLibraryEditorTitle
      .textContent =
        `${record.payload.name} kaydını düzenle`;
    elements.btnHealthLibrarySave
      .textContent =
        "Yeni sürümü kaydet";
    elements.healthLibraryEditorName.focus();
    syncDisabledState();
  }

  function parsePositiveNumber(
    element,
    fieldName
  ) {
    const value = Number(element.value);

    if (!Number.isFinite(value) || value <= 0) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-UI-003",
        `${fieldName} sıfırdan büyük olmalıdır.`
      );
    }

    return value;
  }

  function knownMeasurement(value, unit) {
    return {
      status: "known",
      value,
      unit,
      basis: null
    };
  }

  function unknownMeasurement(unit) {
    return {
      status: "unknown",
      value: null,
      unit,
      basis: null
    };
  }

  function parseTags(value) {
    const seen = new Set();
    const result = [];

    String(value || "")
      .split(/[,;]/)
      .map(item => item.trim())
      .filter(Boolean)
      .forEach(item => {
        const key =
          item.toLocaleLowerCase("tr-TR");

        if (!seen.has(key)) {
          seen.add(key);
          result.push(item);
        }
      });

    if (result.length > 20) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-UI-003",
        "En fazla 20 etiket eklenebilir."
      );
    }

    return result;
  }

  function preparationInput() {
    const value =
      elements.healthLibraryPreparation
        .value.trim();

    return {
      method: value || "unspecified",
      details: null
    };
  }

  function commonInput() {
    const name =
      elements.healthLibraryEditorName
        .value.trim();

    if (!name) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-UI-003",
        "Kütüphane kaydının adı boş olamaz."
      );
    }

    return {
      name,
      tags: parseTags(
        elements.healthLibraryTags.value
      ),
      constraintTags: [],
      preparation: preparationInput()
    };
  }

  function foodInput() {
    const common = commonInput();
    const servingBasis = knownMeasurement(
      parsePositiveNumber(
        elements.healthLibraryEditorAmount,
        "Varsayılan miktar"
      ),
      elements.healthLibraryEditorUnit.value
    );
    const nutrients = {};

    Object.entries(NUTRIENT_FIELDS)
      .forEach(([key, definition]) => {
        const raw = elements[
          definition.elementId
        ].value.trim();

        if (!raw) {
          nutrients[key] =
            unknownMeasurement(
              definition.unit
            );
          return;
        }

        const value = Number(raw);

        if (!Number.isFinite(value) || value < 0) {
          throw createError(
            "TODAY-NUTRITION-LIBRARY-UI-003",
            `${definition.label} negatif olamaz.`
          );
        }

        nutrients[key] = knownMeasurement(
          value,
          definition.unit
        );
      });

    return {
      ...common,
      servingBasis,
      nutrients
    };
  }

  function recipeIngredientInput() {
    if (recipeIngredients.size === 0) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-UI-003",
        "Tarif için en az bir bileşen seçmelisin."
      );
    }

    return [
      ...recipeIngredients.values()
    ].map(selection => {
      const source = allActiveRecords.find(
        record =>
          record.id === selection.recordId
      );
      const amountInput = root.querySelector(
        `[data-recipe-ingredient-amount="${selection.recordId}"]`
      );
      const unitInput = root.querySelector(
        `[data-recipe-ingredient-unit="${selection.recordId}"]`
      );

      if (!source || !amountInput || !unitInput) {
        throw createError(
          "TODAY-NUTRITION-LIBRARY-UI-004",
          "Tarif bileşeni artık etkin değil."
        );
      }

      const value = parsePositiveNumber(
        amountInput,
        `${selection.name} miktarı`
      );
      const sourceUnit =
        defaultAmount(source).unit;
      const unit = unitInput.value;

      if (
        !getDependencies()
          .calculations.canConvert(
            sourceUnit,
            unit
          )
      ) {
        throw createError(
          "TODAY-NUTRITION-LIBRARY-UI-003",
          `${selection.name} için uyumsuz birim seçildi.`
        );
      }

      return {
        recordId: selection.recordId,
        amount: knownMeasurement(
          value,
          unit
        ),
        name: selection.name
      };
    });
  }

  function recipeInput() {
    const common = commonInput();

    return {
      ...common,
      yield: knownMeasurement(
        parsePositiveNumber(
          elements.healthLibraryEditorAmount,
          "Tarif miktarı"
        ),
        elements.healthLibraryEditorUnit
          .value
      ),
      ingredients: recipeIngredientInput()
    };
  }

  async function refreshMealLibrary() {
    const nutritionUI =
      window.TodayNutritionUI;

    if (
      nutritionUI &&
      typeof nutritionUI.refreshLibrary ===
        "function"
    ) {
      try {
        await nutritionUI.refreshLibrary();
      } catch (_) {
        // The manager write already succeeded. Daily selection reports its
        // own read error and can be refreshed independently.
      }
    }
  }

  async function runAction(
    action,
    successMessage
  ) {
    if (busy) {
      return null;
    }

    setBusy(true);
    setStatus("");

    try {
      const result = await action();
      lastErrorCode = null;
      await refresh({ preserveStatus: true });
      await refreshMealLibrary();
      setStatus(
        typeof successMessage === "function"
          ? successMessage(result)
          : successMessage,
        "success"
      );
      return result;
    } catch (error) {
      lastErrorCode =
        error.todayCode ||
        "TODAY-NUTRITION-LIBRARY-UI-005";
      setStatus(
        error.message ||
          "Kütüphane işlemi tamamlanamadı. Kayıtların silinmedi.",
        "error"
      );
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function onEditorSubmit(event) {
    event.preventDefault();

    if (busy || !editor.open) {
      return;
    }

    const currentEditor = { ...editor };
    let input;

    try {
      input = currentEditor.kind === "food"
        ? foodInput()
        : recipeInput();
    } catch (error) {
      lastErrorCode = error.todayCode;
      setStatus(error.message, "error");
      return;
    }

    const editing =
      Boolean(currentEditor.recordId);

    await runAction(
      async () => {
        const library =
          getDependencies().library;
        const result = currentEditor.kind ===
          "food"
          ? (
              editing
                ? await library.updateFood(
                    currentEditor.recordId,
                    input,
                    confirmation("update-food")
                  )
                : await library.createFood(
                    input,
                    confirmation("create-food")
                  )
            )
          : (
              editing
                ? await library.updateRecipe(
                    currentEditor.recordId,
                    input,
                    confirmation("update-recipe")
                  )
                : await library.createRecipe(
                    input,
                    confirmation("create-recipe")
                  )
            );

        closeEditor();
        return result;
      },
      result => {
        if (
          editing &&
          result.id === currentEditor.recordId
        ) {
          return "Değişiklik bulunmadı; mevcut sürüm korundu.";
        }

        return editing
          ? "Kütüphane kaydının yeni sürümü oluşturuldu; geçmiş öğünler değişmedi."
          : "Kütüphane kaydı oluşturuldu.";
      }
    );
  }

  function onIngredientResultClick(event) {
    const button = event.target.closest(
      "[data-add-recipe-ingredient]"
    );

    if (!button || busy) {
      return;
    }

    if (
      recipeIngredients.size >=
      MAX_RECIPE_INGREDIENTS
    ) {
      setStatus(
        `Bir tarifte en fazla ${MAX_RECIPE_INGREDIENTS} bileşen olabilir.`,
        "error"
      );
      return;
    }

    const record = allActiveRecords.find(
      item =>
        item.id ===
          button.dataset.addRecipeIngredient
    );

    if (!record) {
      setStatus(
        "Seçilen bileşen artık etkin değil.",
        "error"
      );
      return;
    }

    recipeIngredients.set(
      record.id,
      {
        recordId: record.id,
        name: record.payload.name,
        type: record.type,
        amount: defaultAmount(record)
      }
    );
    renderIngredientResults();
    renderIngredientSelected();
  }

  function onIngredientSelectedClick(event) {
    const button = event.target.closest(
      "[data-remove-recipe-ingredient]"
    );

    if (!button || busy) {
      return;
    }

    recipeIngredients.delete(
      button.dataset.removeRecipeIngredient
    );
    renderIngredientResults();
    renderIngredientSelected();
  }

  function onIngredientValueChange(event) {
    const recordId =
      event.target.dataset
        .recipeIngredientAmount ||
      event.target.dataset
        .recipeIngredientUnit;

    if (!recordId || !recipeIngredients.has(recordId)) {
      return;
    }

    const current =
      recipeIngredients.get(recordId);
    const amountInput = root.querySelector(
      `[data-recipe-ingredient-amount="${recordId}"]`
    );
    const unitInput = root.querySelector(
      `[data-recipe-ingredient-unit="${recordId}"]`
    );
    const parsed = Number(amountInput?.value);

    current.amount = {
      status: "known",
      value:
        Number.isFinite(parsed)
          ? parsed
          : null,
      unit: unitInput?.value || null,
      basis: null
    };
    recipeIngredients.set(
      recordId,
      current
    );
  }

  async function onManagerListClick(event) {
    const editButton = event.target.closest(
      "[data-edit-nutrition-library]"
    );
    const archiveButton = event.target.closest(
      "[data-archive-nutrition-library]"
    );
    const restoreButton = event.target.closest(
      "[data-restore-nutrition-library]"
    );

    if (busy) {
      return;
    }

    if (editButton) {
      setBusy(true);
      setStatus("");

      try {
        await openEdit(
          editButton.dataset
            .editNutritionLibrary
        );
        lastErrorCode = null;
      } catch (error) {
        lastErrorCode =
          error.todayCode ||
          "TODAY-NUTRITION-LIBRARY-UI-005";
        closeEditor();
        setStatus(error.message, "error");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (archiveButton) {
      const recordId =
        archiveButton.dataset
          .archiveNutritionLibrary;
      const record = managedActiveRecords.find(
        item => item.id === recordId
      );
      const approved = window.confirm(
        "Bu kaydı arşivlemek istiyor musun? Geçmiş öğün anlık görüntüleri değişmeyecek."
      );

      if (!approved) {
        return;
      }

      await runAction(
        async () => {
          const result =
            await getDependencies()
              .library.archiveItem(
                recordId,
                confirmation("archive")
              );

          if (editor.recordId === recordId) {
            closeEditor();
          }

          return result;
        },
        `${record?.payload?.name || "Kayıt"} arşivlendi; geçmiş öğünler korunuyor.`
      );
      return;
    }

    if (restoreButton) {
      const recordId =
        restoreButton.dataset
          .restoreNutritionLibrary;
      const record =
        managedArchivedRecords.find(
          item => item.id === recordId
        );
      const approved = window.confirm(
        "Bu kaydı yeniden etkin kütüphaneye almak istiyor musun?"
      );

      if (!approved) {
        return;
      }

      await runAction(
        () => getDependencies()
          .library.restoreItem(
            recordId,
            confirmation("restore")
          ),
        `${record?.payload?.name || "Kayıt"} yeniden etkinleştirildi.`
      );
    }
  }

  function bindEvents() {
    elements.btnHealthNewFood
      .addEventListener(
        "click",
        () => openCreate("food")
      );
    elements.btnHealthNewRecipe
      .addEventListener(
        "click",
        () => openCreate("recipe")
      );
    elements.btnHealthLibraryCancel
      .addEventListener(
        "click",
        () => {
          closeEditor();
          setStatus(
            "Kaydedilmemiş değişiklikler kapatıldı."
          );
        }
      );
    elements.healthLibraryEditor
      .addEventListener(
        "submit",
        event => {
          void onEditorSubmit(event);
        }
      );
    elements.healthLibraryManageList
      .addEventListener(
        "click",
        event => {
          void onManagerListClick(event);
        }
      );
    elements.healthLibraryArchivedList
      .addEventListener(
        "click",
        event => {
          void onManagerListClick(event);
        }
      );
    elements.healthRecipeIngredientSearch
      .addEventListener(
        "input",
        renderIngredientResults
      );
    elements.healthRecipeIngredientResults
      .addEventListener(
        "click",
        onIngredientResultClick
      );
    elements.healthRecipeIngredientSelected
      .addEventListener(
        "click",
        onIngredientSelectedClick
      );
    elements.healthRecipeIngredientSelected
      .addEventListener(
        "input",
        onIngredientValueChange
      );
    elements.healthRecipeIngredientSelected
      .addEventListener(
        "change",
        onIngredientValueChange
      );
  }

  function flattenActive(snapshot) {
    const records = [
      ...(Array.isArray(snapshot?.foods)
        ? snapshot.foods
        : []),
      ...(Array.isArray(snapshot?.recipes)
        ? snapshot.recipes
        : [])
    ];
    const unique = new Map();

    records.forEach(record => {
      if (isVisibleSource(record)) {
        unique.set(record.id, clone(record));
      }
    });

    return [...unique.values()]
      .sort(compareRecords);
  }

  async function refresh(options = {}) {
    if (!initialized) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-UI-004",
        "Kütüphane yönetim arayüzü başlatılmadı."
      );
    }

    const sequence = ++refreshSequence;
    elements.healthLibraryManagerCount
      .textContent = "—";
    emptyList(
      elements.healthLibraryManageList,
      "Kütüphane yükleniyor…"
    );

    try {
      const snapshot =
        await getDependencies()
          .library.getSnapshot();

      if (sequence !== refreshSequence) {
        return getState();
      }

      allActiveRecords =
        flattenActive(snapshot);
      managedActiveRecords =
        allActiveRecords
          .filter(record =>
            isUserManaged(record, "active")
          )
          .sort(compareRecords);
      managedArchivedRecords =
        (Array.isArray(snapshot?.history)
          ? snapshot.history
          : [])
          .filter(record =>
            isUserManaged(
              record,
              "archived"
            )
          )
          .sort(compareRecords);

      const activeIds = new Set(
        allActiveRecords.map(record =>
          record.id
        )
      );

      recipeIngredients.forEach(
        (_, recordId) => {
          if (!activeIds.has(recordId)) {
            recipeIngredients.delete(recordId);
          }
        }
      );

      if (
        editor.recordId &&
        !managedActiveRecords.some(
          record =>
            record.id === editor.recordId
        )
      ) {
        closeEditor();
      }

      lastErrorCode = null;
      renderManagerLists();
      renderIngredientResults();
      renderIngredientSelected();

      if (options.preserveStatus !== true) {
        setStatus("");
      }

      return getState();
    } catch (error) {
      if (sequence !== refreshSequence) {
        return getState();
      }

      lastErrorCode =
        error.todayCode ||
        "TODAY-NUTRITION-LIBRARY-UI-005";
      allActiveRecords = [];
      managedActiveRecords = [];
      managedArchivedRecords = [];
      elements.healthLibraryManagerCount
        .textContent = "0";
      emptyList(
        elements.healthLibraryManageList,
        "Kütüphane şu anda gösterilemiyor. Mevcut kayıtların silinmedi."
      );
      elements.healthLibraryArchivedSection
        .hidden = true;
      renderIngredientResults();
      renderIngredientSelected();
      setStatus(
        "Kütüphane okunamadı; mevcut kayıtların silinmedi.",
        "error"
      );
      return getState();
    }
  }

  function init(options = {}) {
    if (initialized) {
      return getState();
    }

    root = options.root || document;
    getDependencies();
    elements = collectElements(root);
    bindEvents();
    elements.healthLibraryManager
      .setAttribute(
        "aria-busy",
        "false"
      );
    elements.healthLibraryEditor.hidden =
      true;
    elements.healthLibraryArchivedSection
      .hidden = true;
    initialized = true;
    renderManagerLists();
    renderIngredientResults();
    renderIngredientSelected();
    syncDisabledState();

    return getState();
  }

  async function open() {
    if (!initialized) {
      init();
    }

    opened = true;
    await refresh();
    return getState();
  }

  window.TodayNutritionLibraryUI =
    Object.freeze({
      MANAGER_API_VERSION,
      MANAGER_RULESET_ID,
      MAX_VISIBLE_MANAGED_ITEMS,
      MAX_VISIBLE_INGREDIENT_RESULTS,
      MAX_RECIPE_INGREDIENTS,
      MANAGED_TYPES,
      NUTRIENT_FIELDS,
      UNIT_LABELS,
      REQUIRED_IDS,
      init,
      open,
      refresh,
      getState
    });
})();
