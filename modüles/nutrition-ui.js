/**
 * Today App — Nutrition UI
 * NUT-008 / NUT-009 / NUT-010 — Visible dashboard, history and library selection
 *
 * This module binds the existing NUT-006 and NUT-007 service APIs to the
 * Today Health view. It does not own persistence, calculate nutrients or
 * silently turn planned meals into consumption records. NUT-009 day changes
 * are read-only outside today, while corrections are reversible archives.
 * NUT-010 exposes active food, recipe and meal-template records without
 * mutating the library or inventing missing portion/nutrition values.
 */

(function () {
  "use strict";

  const UI_API_VERSION = 3;
  const UI_RULESET_ID =
    "today:nutrition:ui:v3";
  const MAX_VISIBLE_ENTRIES = 20;
  const MAX_VISIBLE_PLANNED_MEALS = 20;
  const MAX_VISIBLE_LIBRARY_RESULTS = 20;
  const MAX_SELECTED_LIBRARY_ITEMS = 20;

  const MEAL_LABELS = Object.freeze({
    breakfast: "Kahvaltı",
    lunch: "Öğle",
    dinner: "Akşam",
    snack: "Ara öğün",
    other: "Diğer"
  });

  const PLAN_STATUS_LABELS = Object.freeze({
    planned: "Planlandı",
    linked: "Kaydedildi",
    skipped: "Atlandı",
    cancelled: "İptal"
  });

  const LIBRARY_TYPE_LABELS = Object.freeze({
    food_version: "Besin",
    recipe_version: "Tarif",
    meal_template: "Öğün şablonu"
  });

  const REQUIRED_IDS = Object.freeze([
    "healthDashboard",
    "healthTodayLabel",
    "healthSummaryText",
    "healthKnowledgeNote",
    "btnHealthRefresh",
    "btnHealthPreviousDay",
    "btnHealthNextDay",
    "btnHealthToday",
    "healthCurrentOnlyNote",
    "healthMealForm",
    "healthMealType",
    "healthMealName",
    "healthLibrarySearch",
    "healthLibraryType",
    "healthLibraryResultCount",
    "healthLibraryResults",
    "healthLibrarySelectedCount",
    "healthLibrarySelected",
    "healthLibraryNote",
    "btnHealthMealSubmit",
    "healthPlannedMeals",
    "healthPlanCount",
    "healthEntryList",
    "healthEntryCount",
    "healthArchivedSection",
    "healthArchivedList",
    "healthArchivedCount",
    "healthStatus"
  ]);

  let root = null;
  let elements = null;
  let initialized = false;
  let opened = false;
  let busy = false;
  let refreshSequence = 0;
  let libraryRefreshSequence = 0;
  let operationSequence = 0;
  let lastErrorCode = null;
  let lastLibraryErrorCode = null;
  let lastSummary = null;
  let selectedDayKey = null;
  let libraryRecords = [];
  let visibleLibraryRecords = [];
  const selectedLibraryRecords = new Map();

  function createError(
    code,
    message,
    detail = null,
    cause = null
  ) {
    const error = new Error(message);
    error.name = "TodayNutritionUIError";
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

  function getDependencies() {
    const entry = window.TodayNutritionEntry;
    const planning =
      window.TodayNutritionPlanning;
    const history =
      window.TodayNutritionHistory;
    const storage =
      window.TodayNutritionStorage;
    const calculations =
      window.TodayNutritionCalculations;
    const library =
      window.TodayNutritionLibrary;
    const missing = [];

    [
      [entry, "logMeal", "TodayNutritionEntry"],
      [entry, "logWater", "TodayNutritionEntry"],
      [planning, "listPlannedMeals", "TodayNutritionPlanning"],
      [planning, "consumePlannedMeal", "TodayNutritionPlanning"],
      [history, "loadDay", "TodayNutritionHistory"],
      [history, "dayKeyFromDate", "TodayNutritionHistory"],
      [history, "isToday", "TodayNutritionHistory"],
      [history, "shiftDay", "TodayNutritionHistory"],
      [history, "archiveEntry", "TodayNutritionHistory"],
      [history, "restoreEntry", "TodayNutritionHistory"],
      [storage, "getRecord", "TodayNutritionStorage"],
      [calculations, "convertMeasurement", "TodayNutritionCalculations"],
      [library, "getSnapshot", "TodayNutritionLibrary"]
    ].forEach(([candidate, methodName, apiName]) => {
      if (
        !candidate ||
        typeof candidate[methodName] !== "function"
      ) {
        missing.push(`${apiName}.${methodName}`);
      }
    });

    if (missing.length > 0) {
      throw createError(
        "TODAY-NUTRITION-UI-001",
        "Health beslenme arayüzü bağımlılıkları hazır değil.",
        { missing }
      );
    }

    return {
      entry,
      planning,
      history,
      storage,
      calculations,
      library
    };
  }

  function collectElements(target) {
    if (
      !target ||
      typeof target.getElementById !== "function"
    ) {
      throw createError(
        "TODAY-NUTRITION-UI-002",
        "Health arayüzü için geçerli bir belge gerekir."
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
        "TODAY-NUTRITION-UI-002",
        "Health beslenme arayüzü eksik öğeler içeriyor.",
        { missing }
      );
    }

    collected.waterButtons = Array.from(
      target.querySelectorAll(
        "[data-health-water-ml]"
      )
    );

    if (collected.waterButtons.length === 0) {
      throw createError(
        "TODAY-NUTRITION-UI-002",
        "Health arayüzünde hızlı su düğmesi bulunamadı."
      );
    }

    return collected;
  }

  function getState() {
    return Object.freeze({
      initialized,
      opened,
      busy,
      lastErrorCode,
      lastLibraryErrorCode,
      selectedDayKey,
      isToday: selectedDayKey
        ? getDependencies().history.isToday(
            selectedDayKey
          )
        : false,
      summary: lastSummary
        ? Object.freeze(clone(lastSummary))
        : null,
      library: Object.freeze({
        query:
          elements?.healthLibrarySearch?.value || "",
        type:
          elements?.healthLibraryType?.value || "all",
        availableCount: libraryRecords.length,
        resultCount: visibleLibraryRecords.length,
        selectedCount:
          selectedLibraryRecords.size,
        selected: Object.freeze(
          clone([
            ...selectedLibraryRecords.values()
          ])
        )
      })
    });
  }

  function makeOperationId(kind) {
    operationSequence += 1;

    return [
      "health-ui",
      kind,
      Date.now().toString(36),
      operationSequence.toString(36)
    ].join("-");
  }

  function todayKey() {
    return getDependencies()
      .history.dayKeyFromDate(new Date());
  }

  function selectedIsToday() {
    return Boolean(
      selectedDayKey &&
      getDependencies().history.isToday(
        selectedDayKey
      )
    );
  }

  function dateFromDayKey(dayKey) {
    const [year, month, day] = dayKey
      .split("-")
      .map(Number);

    return new Date(
      year,
      month - 1,
      day,
      12,
      0,
      0,
      0
    );
  }

  function formatDay(dayKey) {
    const label = new Intl.DateTimeFormat(
      "tr-TR",
      {
        weekday: "long",
        day: "numeric",
        month: "long"
      }
    ).format(dateFromDayKey(dayKey));

    return selectedIsToday()
      ? `Bugün · ${label}`
      : label;
  }

  function formatTime(value) {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return "Saat bilinmiyor";
    }

    return new Intl.DateTimeFormat(
      "tr-TR",
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    ).format(parsed);
  }

  function formatNumber(value) {
    return new Intl.NumberFormat(
      "tr-TR",
      { maximumFractionDigits: 0 }
    ).format(value);
  }

  function mealLabel(mealType) {
    return MEAL_LABELS[mealType] || "Öğün";
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .normalize("NFKC")
      .trim()
      .toLocaleLowerCase("tr-TR")
      .replace(/\s+/g, " ");
  }

  function libraryMeta(record) {
    return record?.extensions?.[
      "today.nutrition.library"
    ] || {};
  }

  function defaultLibraryAmount(record) {
    if (record?.type === "food_version") {
      return clone(record.payload?.servingBasis);
    }

    if (record?.type === "recipe_version") {
      return clone(record.payload?.yield);
    }

    return null;
  }

  function usableLibraryAmount(amount) {
    return Boolean(
      amount &&
      ["known", "estimated"].includes(
        amount.status
      ) &&
      typeof amount.value === "number" &&
      Number.isFinite(amount.value) &&
      amount.value > 0 &&
      typeof amount.unit === "string" &&
      amount.unit.trim()
    );
  }

  function formatMeasurement(amount) {
    if (!usableLibraryAmount(amount)) {
      return "porsiyon bilgisi eksik";
    }

    const unitLabels = {
      portion: "porsiyon",
      serving: "porsiyon",
      piece: "adet"
    };
    const prefix =
      amount.status === "estimated"
        ? "yaklaşık "
        : "";

    return [
      `${prefix}${new Intl.NumberFormat(
        "tr-TR",
        { maximumFractionDigits: 2 }
      ).format(amount.value)}`,
      unitLabels[amount.unit] || amount.unit
    ].join(" ");
  }

  function visibleLibraryRecord(record) {
    return Boolean(
      record &&
      Object.prototype.hasOwnProperty.call(
        LIBRARY_TYPE_LABELS,
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

  function libraryRecordSelectable(record) {
    return record?.type === "meal_template" ||
      usableLibraryAmount(
        defaultLibraryAmount(record)
      );
  }

  function librarySearchValue(record) {
    const meta = libraryMeta(record);
    const values = [
      record.payload?.name,
      LIBRARY_TYPE_LABELS[record.type],
      ...(Array.isArray(meta.tags)
        ? meta.tags
        : []),
      meta.preparation?.method,
      meta.preparation?.details
    ];

    return normalizeSearchText(
      values.filter(Boolean).join(" ")
    );
  }

  function selectedLibraryRecord(record) {
    const amount = defaultLibraryAmount(record);

    return Object.freeze({
      recordId: record.id,
      type: record.type,
      name: record.payload.name.trim(),
      amount,
      knowledgeStatus:
        record.knowledgeStatus || "unknown",
      sourceKind:
        record.source?.kind || "manual"
    });
  }

  function setStatus(message, kind = "neutral") {
    elements.healthStatus.textContent = message || "";
    elements.healthStatus.dataset.kind = kind;
  }

  function setBusy(nextBusy) {
    busy = nextBusy === true;
    elements.healthDashboard.setAttribute(
      "aria-busy",
      String(busy)
    );

    root
      .querySelectorAll("[data-health-action]")
      .forEach(control => {
        control.disabled = busy;
      });

    applyDayMode();
  }

  function applyDayMode() {
    if (!elements || !selectedDayKey) {
      return;
    }

    const current = selectedIsToday();

    root
      .querySelectorAll(
        "[data-health-current-action]"
      )
      .forEach(control => {
        control.disabled =
          busy ||
          !current ||
          control.dataset
            .healthUnavailable === "true";
      });

    elements.btnHealthPreviousDay.disabled =
      busy;
    elements.btnHealthNextDay.disabled =
      busy || current;
    elements.btnHealthToday.disabled =
      busy || current;
    elements.healthCurrentOnlyNote.hidden =
      current;
    elements.healthCurrentOnlyNote.textContent =
      current
        ? ""
        : "Geçmiş gün görüntüleniyor. Yeni kayıt ve plan tüketimi yalnız bugün için yapılabilir.";
  }

  function emptyList(list, message) {
    const item = root.createElement("li");
    item.className = "healthEmptyItem";
    item.textContent = message;
    list.replaceChildren(item);
  }

  function loadingList(list) {
    emptyList(list, "Yükleniyor…");
  }

  function filterLibraryRecords() {
    const query = normalizeSearchText(
      elements.healthLibrarySearch.value
    );
    const type =
      elements.healthLibraryType.value;
    const tokens = query
      ? query.split(" ")
      : [];

    visibleLibraryRecords = libraryRecords
      .filter(record =>
        (type === "all" || record.type === type) &&
        tokens.every(token =>
          librarySearchValue(record)
            .includes(token)
        )
      )
      .sort((left, right) =>
        left.payload.name.localeCompare(
          right.payload.name,
          "tr-TR"
        ) || left.id.localeCompare(right.id)
      )
      .slice(0, MAX_VISIBLE_LIBRARY_RESULTS);

    return visibleLibraryRecords;
  }

  function appendLibraryResult(
    list,
    record
  ) {
    const item = root.createElement("li");
    const content = root.createElement("div");
    const title = root.createElement("strong");
    const meta = root.createElement("span");
    const button = root.createElement("button");
    const amount = defaultLibraryAmount(record);
    const selectable =
      libraryRecordSelectable(record);
    const selected =
      selectedLibraryRecords.has(record.id);
    const detail =
      record.type === "meal_template"
        ? "hazır öğün"
        : formatMeasurement(amount);
    const knowledge =
      record.knowledgeStatus === "known"
        ? ""
        : " · besin değeri eksik olabilir";

    item.className =
      "healthLibraryItem";
    content.className =
      "healthListContent";
    title.className =
      "healthListTitle";
    meta.className =
      "healthListMeta";
    title.textContent =
      record.payload.name;
    meta.textContent = [
      LIBRARY_TYPE_LABELS[record.type],
      detail
    ].join(" · ") + knowledge;
    content.append(title, meta);

    button.type = "button";
    button.className =
      "healthLibraryAction";
    button.dataset.selectNutritionLibrary =
      record.id;
    button.dataset.healthAction = "true";
    button.dataset.healthCurrentAction =
      "true";
    button.dataset.healthUnavailable =
      String(selected || !selectable);
    button.disabled =
      busy ||
      !selectedIsToday() ||
      selected ||
      !selectable;
    button.textContent = selected
      ? "Eklendi"
      : selectable
        ? "Ekle"
        : "Eksik";
    button.setAttribute(
      "aria-label",
      selectable
        ? `${record.payload.name} öğün seçimine ekle`
        : `${record.payload.name} için porsiyon bilgisi eksik`
    );

    item.append(content, button);
    list.append(item);
  }

  function renderLibraryResults() {
    const list =
      elements.healthLibraryResults;
    const records = filterLibraryRecords();

    list.replaceChildren();
    elements.healthLibraryResultCount
      .textContent = String(records.length);

    if (libraryRecords.length === 0) {
      emptyList(
        list,
        "Yerel kütüphanede henüz etkin bir besin, tarif veya öğün şablonu yok."
      );
      elements.healthLibraryNote.textContent =
        "Sade öğün adıyla kayıt yapmaya devam edebilirsin; kütüphane boşken hiçbir değer uydurulmaz.";
      return;
    }

    if (records.length === 0) {
      emptyList(
        list,
        "Aramana uyan etkin kütüphane kaydı bulunamadı."
      );
      elements.healthLibraryNote.textContent =
        "Arama yalnız cihazındaki etkin ve doğrulanmış kayıtları kapsar.";
      return;
    }

    records.forEach(record =>
      appendLibraryResult(list, record)
    );
    elements.healthLibraryNote.textContent =
      "Seçimler, öğünü kaydettiğinde kaynak sürümüyle birlikte değişmez anlık görüntüye dönüşür.";
  }

  function renderSelectedLibrary() {
    const list =
      elements.healthLibrarySelected;
    const selected = [
      ...selectedLibraryRecords.values()
    ];

    list.replaceChildren();
    elements.healthLibrarySelectedCount
      .textContent = String(selected.length);

    if (selected.length === 0) {
      emptyList(
        list,
        "Henüz kütüphaneden bir öğe seçilmedi."
      );
      return;
    }

    selected.forEach(selection => {
      const item = root.createElement("li");
      const content = root.createElement("div");
      const title = root.createElement("strong");
      const meta = root.createElement("span");
      const button = root.createElement("button");
      const detail =
        selection.type === "meal_template"
          ? "hazır öğün"
          : formatMeasurement(selection.amount);

      item.className =
        "healthLibraryItem healthLibrarySelectedItem";
      content.className =
        "healthListContent";
      title.className =
        "healthListTitle";
      meta.className =
        "healthListMeta";
      title.textContent = selection.name;
      meta.textContent = [
        LIBRARY_TYPE_LABELS[selection.type],
        detail
      ].join(" · ");
      content.append(title, meta);

      button.type = "button";
      button.className =
        "healthLibraryAction";
      button.textContent = "Çıkar";
      button.dataset.removeNutritionLibrary =
        selection.recordId;
      button.dataset.healthAction = "true";
      button.dataset.healthCurrentAction =
        "true";
      button.disabled =
        busy || !selectedIsToday();
      button.setAttribute(
        "aria-label",
        `${selection.name} öğün seçiminden çıkar`
      );

      item.append(content, button);
      list.append(item);
    });
  }

  function flattenLibrarySnapshot(snapshot) {
    const records = [
      ...(Array.isArray(snapshot?.foods)
        ? snapshot.foods
        : []),
      ...(Array.isArray(snapshot?.recipes)
        ? snapshot.recipes
        : []),
      ...(Array.isArray(snapshot?.mealTemplates)
        ? snapshot.mealTemplates
        : [])
    ];
    const unique = new Map();

    records.forEach(record => {
      if (visibleLibraryRecord(record)) {
        unique.set(record.id, clone(record));
      }
    });

    return [...unique.values()];
  }

  async function refreshLibrary() {
    if (!initialized) {
      throw createError(
        "TODAY-NUTRITION-UI-003",
        "Health beslenme arayüzü başlatılmadı."
      );
    }

    const sequence =
      ++libraryRefreshSequence;
    loadingList(
      elements.healthLibraryResults
    );
    elements.healthLibraryResultCount
      .textContent = "—";

    try {
      const snapshot =
        await getDependencies()
          .library.getSnapshot();

      if (sequence !== libraryRefreshSequence) {
        return getState();
      }

      libraryRecords =
        flattenLibrarySnapshot(snapshot);
      const activeIds = new Set(
        libraryRecords.map(record => record.id)
      );

      selectedLibraryRecords.forEach(
        (_, recordId) => {
          if (!activeIds.has(recordId)) {
            selectedLibraryRecords.delete(
              recordId
            );
          }
        }
      );

      lastLibraryErrorCode = null;
      renderLibraryResults();
      renderSelectedLibrary();
      applyDayMode();
      return getState();
    } catch (error) {
      if (sequence !== libraryRefreshSequence) {
        return getState();
      }

      lastLibraryErrorCode =
        error.todayCode ||
        "TODAY-NUTRITION-UI-006";
      libraryRecords = [];
      visibleLibraryRecords = [];
      elements.healthLibraryResultCount
        .textContent = "0";
      emptyList(
        elements.healthLibraryResults,
        "Kütüphane şu anda gösterilemiyor. Sade öğün kaydı kullanılabilir."
      );
      elements.healthLibraryNote.textContent =
        "Mevcut kütüphane kayıtların silinmedi.";
      renderSelectedLibrary();
      return getState();
    }
  }

  function knownWaterSummary(
    hydrationEntries,
    calculations
  ) {
    let totalMl = 0;
    let unknownCount = 0;
    let estimatedCount = 0;

    hydrationEntries.forEach(record => {
      const amount = record?.payload?.amount;

      if (
        !amount ||
        amount.status === "unknown" ||
        amount.value === null
      ) {
        unknownCount += 1;
        return;
      }

      try {
        const converted =
          calculations.convertMeasurement(
            amount,
            "ml"
          );

        if (
          converted.status === "unknown" ||
          typeof converted.value !== "number"
        ) {
          unknownCount += 1;
          return;
        }

        totalMl += converted.value;

        if (converted.status === "estimated") {
          estimatedCount += 1;
        }
      } catch (error) {
        unknownCount += 1;
      }
    });

    return {
      totalMl,
      unknownCount,
      estimatedCount
    };
  }

  async function snapshotNames(records, storage) {
    const ids = [];
    const seen = new Set();

    records.forEach(record => {
      const snapshotIds =
        Array.isArray(
          record?.payload?.itemSnapshotIds
        )
          ? record.payload.itemSnapshotIds
          : [];

      snapshotIds.forEach(id => {
        if (!seen.has(id)) {
          seen.add(id);
          ids.push(id);
        }
      });
    });

    const pairs = await Promise.all(
      ids.map(async id => {
        try {
          const snapshot =
            await storage.getRecord(id);
          const name =
            snapshot?.type ===
              "meal_item_snapshot" &&
            typeof snapshot.payload?.name ===
              "string"
              ? snapshot.payload.name.trim()
              : "";

          return [id, name];
        } catch (error) {
          return [id, ""];
        }
      })
    );

    return new Map(pairs);
  }

  function namesForRecord(record, namesById) {
    const ids =
      Array.isArray(
        record?.payload?.itemSnapshotIds
      )
        ? record.payload.itemSnapshotIds
        : [];

    return ids
      .map(id => namesById.get(id))
      .filter(Boolean);
  }

  function appendEntryItem(
    list,
    record,
    namesById,
    calculations,
    options = {}
  ) {
    const item = root.createElement("li");
    const content = root.createElement("div");
    const title = root.createElement("strong");
    const meta = root.createElement("span");

    item.className = "healthListItem";
    content.className = "healthListContent";
    title.className = "healthListTitle";
    meta.className = "healthListMeta";

    if (record.type === "hydration_entry") {
      const beverage =
        record.payload.beverageType === "water"
          ? "Su"
          : "Sıvı";
      let amountText = "miktar bilinmiyor";

      try {
        const amount = record.payload.amount;

        if (
          amount?.status !== "unknown" &&
          amount?.value !== null
        ) {
          const converted =
            calculations.convertMeasurement(
              amount,
              "ml"
            );

          if (
            typeof converted.value === "number"
          ) {
            amountText =
              `${formatNumber(converted.value)} ml`;
          }
        }
      } catch (error) {
        amountText = "miktar bilinmiyor";
      }

      title.textContent =
        `${beverage} · ${amountText}`;
    } else {
      const names = namesForRecord(
        record,
        namesById
      );

      title.textContent = names.length > 0
        ? names.slice(0, 2).join(", ")
        : mealLabel(record.payload.mealType);
    }

    meta.textContent = formatTime(
      record.payload.consumedAt
    );

    if (options.archived === true) {
      meta.textContent += " · Arşivde";
    }

    content.append(title, meta);
    item.append(content);

    const action = root.createElement("button");
    action.type = "button";
    action.className = "healthEntryManage";
    action.dataset.healthAction = "true";

    if (options.archived === true) {
      action.textContent = "Geri al";
      action.dataset.restoreNutritionEntry =
        record.id;
      action.setAttribute(
        "aria-label",
        `${title.textContent} kaydını arşivden geri al`
      );
    } else {
      action.textContent = "Kaldır";
      action.dataset.archiveNutritionEntry =
        record.id;
      action.setAttribute(
        "aria-label",
        `${title.textContent} kaydını günün toplamından kaldır`
      );
    }

    item.append(action);
    list.append(item);
  }

  function renderEntries(
    entries,
    namesById,
    calculations
  ) {
    const list = elements.healthEntryList;

    list.replaceChildren();
    elements.healthEntryCount.textContent =
      String(entries.length);

    if (entries.length === 0) {
      emptyList(
        list,
        selectedIsToday()
          ? "Bugün henüz bir kayıt yok."
          : "Bu gün için kayıt yok."
      );
      return;
    }

    entries
      .slice(0, MAX_VISIBLE_ENTRIES)
      .forEach(record => {
        appendEntryItem(
          list,
          record,
          namesById,
          calculations,
          { archived: false }
        );
      });
  }

  function renderArchivedEntries(
    entries,
    namesById,
    calculations
  ) {
    const list =
      elements.healthArchivedList;

    list.replaceChildren();
    elements.healthArchivedCount.textContent =
      String(entries.length);
    elements.healthArchivedSection.hidden =
      entries.length === 0;

    if (entries.length === 0) {
      emptyList(
        list,
        "Bu gün için arşivlenen kayıt yok."
      );
      return;
    }

    entries
      .slice(0, MAX_VISIBLE_ENTRIES)
      .forEach(record => {
        appendEntryItem(
          list,
          record,
          namesById,
          calculations,
          { archived: true }
        );
      });
  }

  function appendPlannedMeal(
    list,
    record,
    namesById
  ) {
    const item = root.createElement("li");
    const content = root.createElement("div");
    const title = root.createElement("strong");
    const meta = root.createElement("span");
    const names = namesForRecord(
      record,
      namesById
    );
    const status =
      record.payload.status || "planned";

    item.className = "healthListItem";
    item.dataset.planStatus = status;
    content.className = "healthListContent";
    title.className = "healthListTitle";
    meta.className = "healthListMeta";
    title.textContent = names.length > 0
      ? names.slice(0, 2).join(", ")
      : mealLabel(record.payload.mealType);
    meta.textContent = [
      formatTime(record.payload.plannedFor),
      PLAN_STATUS_LABELS[status] || status
    ].join(" · ");
    content.append(title, meta);
    item.append(content);

    if (
      status === "planned" &&
      selectedIsToday()
    ) {
      const button = root.createElement("button");
      button.type = "button";
      button.className =
        "healthPlanConsume";
      button.textContent = "Tükettim";
      button.dataset.consumePlannedMeal =
        record.id;
      button.dataset.healthAction = "true";
      button.dataset.healthCurrentAction =
        "true";
      button.setAttribute(
        "aria-label",
        `${title.textContent} öğününü tüketildi olarak kaydet`
      );
      item.append(button);
    }

    list.append(item);
  }

  function renderPlannedMeals(
    plannedMeals,
    namesById
  ) {
    const list =
      elements.healthPlannedMeals;

    list.replaceChildren();
    elements.healthPlanCount.textContent =
      String(plannedMeals.length);

    if (plannedMeals.length === 0) {
      emptyList(
        list,
        selectedIsToday()
          ? "Bugün için planlanan öğün yok."
          : "Bu gün için planlanan öğün yok."
      );
      return;
    }

    plannedMeals
      .slice(0, MAX_VISIBLE_PLANNED_MEALS)
      .forEach(record => {
        appendPlannedMeal(
          list,
          record,
          namesById
        );
      });
  }

  function renderSummary(
    entries,
    plannedMeals,
    calculations,
    archivedEntries = []
  ) {
    const meals = entries.filter(
      record => record.type === "meal_entry"
    );
    const hydration = entries.filter(
      record =>
        record.type === "hydration_entry"
    );
    const water = knownWaterSummary(
      hydration,
      calculations
    );
    const pendingPlanCount =
      plannedMeals.filter(
        record =>
          record.payload.status === "planned"
      ).length;
    const waterPrefix =
      water.estimatedCount > 0 ? "yaklaşık " : "";

    elements.healthSummaryText.textContent = [
      `${meals.length} öğün`,
      `${waterPrefix}${formatNumber(water.totalMl)} ml sıvı`,
      `${pendingPlanCount} bekleyen plan`
    ].join(" · ");

    if (water.unknownCount > 0) {
      elements.healthKnowledgeNote.hidden = false;
      elements.healthKnowledgeNote.textContent =
        "Miktarı bilinmeyen sıvı kayıtları toplama eklenmedi.";
    } else {
      elements.healthKnowledgeNote.hidden = true;
      elements.healthKnowledgeNote.textContent = "";
    }

    lastSummary = {
      dayKey: selectedDayKey,
      mealCount: meals.length,
      hydrationCount: hydration.length,
      waterMl: water.totalMl,
      unknownHydrationCount:
        water.unknownCount,
      estimatedHydrationCount:
        water.estimatedCount,
      plannedMealCount:
        plannedMeals.length,
      pendingPlanCount,
      archivedEntryCount:
        archivedEntries.length
    };
  }

  async function loadSelectedDay() {
    const dependencies = getDependencies();
    const day = await dependencies.history
      .loadDay(selectedDayKey);
    const namesById = await snapshotNames(
      [
        ...day.entries,
        ...day.archivedEntries,
        ...day.plannedMeals
      ],
      dependencies.storage
    );

    return {
      dependencies,
      ...day,
      namesById
    };
  }

  async function refresh(options = {}) {
    if (!initialized) {
      throw createError(
        "TODAY-NUTRITION-UI-003",
        "Health beslenme arayüzü başlatılmadı."
      );
    }

    const sequence = ++refreshSequence;
    elements.healthTodayLabel.textContent =
      formatDay(selectedDayKey);
    applyDayMode();
    loadingList(elements.healthEntryList);
    loadingList(elements.healthPlannedMeals);
    loadingList(elements.healthArchivedList);
    elements.healthEntryCount.textContent = "—";
    elements.healthPlanCount.textContent = "—";
    elements.healthArchivedCount.textContent = "—";

    try {
      const data = await loadSelectedDay();

      if (sequence !== refreshSequence) {
        return getState();
      }

      renderSummary(
        data.entries,
        data.plannedMeals,
        data.dependencies.calculations,
        data.archivedEntries
      );
      renderEntries(
        data.entries,
        data.namesById,
        data.dependencies.calculations
      );
      renderArchivedEntries(
        data.archivedEntries,
        data.namesById,
        data.dependencies.calculations
      );
      renderPlannedMeals(
        data.plannedMeals,
        data.namesById
      );
      lastErrorCode = null;

      if (options.announce === true) {
        setStatus(
          selectedIsToday()
            ? "Bugünün beslenme kayıtları yenilendi."
            : "Seçili günün beslenme kayıtları yenilendi.",
          "success"
        );
      }

      return getState();
    } catch (error) {
      if (sequence !== refreshSequence) {
        return getState();
      }

      lastErrorCode =
        error.todayCode ||
        "TODAY-NUTRITION-UI-004";
      elements.healthSummaryText.textContent =
        "Kayıtlar şu anda gösterilemiyor.";
      elements.healthKnowledgeNote.hidden = true;
      emptyList(
        elements.healthEntryList,
        "Kayıtları yeniden yüklemeyi dene."
      );
      emptyList(
        elements.healthPlannedMeals,
        "Planlar şu anda gösterilemiyor."
      );
      elements.healthArchivedSection.hidden =
        true;
      emptyList(
        elements.healthArchivedList,
        "Arşivlenen kayıtlar şu anda gösterilemiyor."
      );
      setStatus(
        "Beslenme kayıtları açılamadı. Kayıtların silinmedi.",
        "error"
      );

      return getState();
    }
  }

  async function runAction(
    operation,
    successMessage
  ) {
    if (busy) {
      return getState();
    }

    setBusy(true);
    setStatus("Kaydediliyor…");

    try {
      await operation();
      await refresh();
      setStatus(successMessage, "success");
      lastErrorCode = null;
    } catch (error) {
      lastErrorCode =
        error.todayCode ||
        "TODAY-NUTRITION-UI-005";
      setStatus(
        "Kayıt tamamlanamadı. Mevcut kayıtların korunuyor.",
        "error"
      );
    } finally {
      setBusy(false);
    }

    return getState();
  }

  function onWaterClick(event) {
    if (!selectedIsToday()) {
      return;
    }

    const amount = Number(
      event.currentTarget.dataset
        .healthWaterMl
    );

    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const now = new Date().toISOString();

    void runAction(
      () => getDependencies().entry.logWater(
        {
          status: "known",
          value: amount,
          unit: "ml",
          basis: null
        },
        {
          userInitiated: true,
          userConfirmed: true,
          at: now,
          clientOperationId:
            makeOperationId("water")
        }
      ),
      `${formatNumber(amount)} ml su kaydedildi.`
    );
  }

  function onLibraryFilterChange() {
    if (!initialized) {
      return;
    }

    renderLibraryResults();
    applyDayMode();
  }

  function onLibrarySelectionClick(event) {
    const addButton = event.target.closest(
      "[data-select-nutrition-library]"
    );
    const removeButton = event.target.closest(
      "[data-remove-nutrition-library]"
    );

    if (
      busy ||
      !selectedIsToday() ||
      (!addButton && !removeButton)
    ) {
      return;
    }

    if (removeButton) {
      const recordId =
        removeButton.dataset
          .removeNutritionLibrary;
      const removed =
        selectedLibraryRecords.get(recordId);

      selectedLibraryRecords.delete(recordId);
      renderSelectedLibrary();
      renderLibraryResults();
      applyDayMode();

      if (removed) {
        setStatus(
          `${removed.name} öğün seçiminden çıkarıldı.`
        );
      }
      return;
    }

    const recordId =
      addButton.dataset
        .selectNutritionLibrary;
    const record = libraryRecords.find(
      candidate => candidate.id === recordId
    );

    if (
      !record ||
      !libraryRecordSelectable(record)
    ) {
      setStatus(
        "Bu kayıt porsiyon bilgisi eksik olduğu için seçilemedi.",
        "error"
      );
      return;
    }

    const replacesTemplate =
      record.type === "meal_template" &&
      [...selectedLibraryRecords.values()]
        .some(selection =>
          selection.type ===
            "meal_template" &&
          selection.recordId !== record.id
        );
    const effectiveSelectionCount =
      selectedLibraryRecords.size -
      (replacesTemplate ? 1 : 0);

    if (
      !selectedLibraryRecords.has(recordId) &&
      effectiveSelectionCount >=
        MAX_SELECTED_LIBRARY_ITEMS
    ) {
      setStatus(
        "Bir öğüne en fazla 20 kütüphane öğesi eklenebilir.",
        "error"
      );
      return;
    }

    if (record.type === "meal_template") {
      selectedLibraryRecords.forEach(
        selection => {
          if (
            selection.type === "meal_template" &&
            selection.recordId !== record.id
          ) {
            selectedLibraryRecords.delete(
              selection.recordId
            );
          }
        }
      );
    }

    selectedLibraryRecords.set(
      record.id,
      selectedLibraryRecord(record)
    );
    renderSelectedLibrary();
    renderLibraryResults();
    applyDayMode();
    setStatus(
      `${record.payload.name} seçildi; henüz tüketim kaydı oluşturulmadı.`
    );
  }

  function onMealSubmit(event) {
    event.preventDefault();

    if (!selectedIsToday()) {
      return;
    }

    const mealType =
      elements.healthMealType.value;
    const name =
      elements.healthMealName.value.trim();
    const selections = [
      ...selectedLibraryRecords.values()
    ];
    const template = selections.find(
      selection =>
        selection.type === "meal_template"
    );
    const items = selections
      .filter(selection =>
        [
          "food_version",
          "recipe_version"
        ].includes(selection.type)
      )
      .map(selection => ({
        recordId: selection.recordId,
        amount: clone(selection.amount),
        name: selection.name
      }));
    const input = {
      mealType,
      coverage:
        name || selections.length > 0
        ? "complete"
        : "unspecified"
    };

    if (name) {
      input.customItems = [{ name }];
    }

    if (items.length > 0) {
      input.items = items;
    }

    if (template) {
      input.templateId =
        template.recordId;
      input.templateMultiplier = 1;
    }

    const now = new Date().toISOString();

    void runAction(
      async () => {
        await getDependencies().entry.logMeal(
          input,
          {
            userInitiated: true,
            userConfirmed: true,
            at: now,
            clientOperationId:
              makeOperationId("meal")
          }
        );
        elements.healthMealName.value = "";
        selectedLibraryRecords.clear();
        renderSelectedLibrary();
        renderLibraryResults();
      },
      `${mealLabel(mealType)} kaydedildi.`
    );
  }

  function onPlannedMealClick(event) {
    const button = event.target.closest(
      "[data-consume-planned-meal]"
    );

    if (
      !button ||
      busy ||
      !selectedIsToday()
    ) {
      return;
    }

    const plannedMealId =
      button.dataset.consumePlannedMeal;
    const now = new Date().toISOString();

    void runAction(
      () => getDependencies()
        .planning.consumePlannedMeal(
          plannedMealId,
          { consumedAt: now },
          {
            userInitiated: true,
            userConfirmed: true,
            confirmPlanConsumption: true,
            at: now,
            clientOperationId:
              makeOperationId("planned")
          }
        ),
      "Planlanan öğün tüketim olarak kaydedildi."
    );
  }

  async function changeDay(nextDayKey) {
    if (
      busy ||
      nextDayKey === selectedDayKey
    ) {
      return getState();
    }

    setBusy(true);
    selectedDayKey = nextDayKey;
    setStatus("Seçili gün yükleniyor…");

    try {
      const state = await refresh();

      if (!lastErrorCode) {
        setStatus("");
      }

      return state;
    } finally {
      setBusy(false);
    }
  }

  function onPreviousDayClick() {
    if (busy) {
      return;
    }

    const nextDayKey = getDependencies()
      .history.shiftDay(
        selectedDayKey,
        -1,
        { preventFuture: true }
      );

    void changeDay(nextDayKey);
  }

  function onNextDayClick() {
    if (busy || selectedIsToday()) {
      return;
    }

    const nextDayKey = getDependencies()
      .history.shiftDay(
        selectedDayKey,
        1,
        { preventFuture: true }
      );

    void changeDay(nextDayKey);
  }

  function onTodayClick() {
    if (!busy) {
      void changeDay(todayKey());
    }
  }

  function onEntryManagementClick(event) {
    const archiveButton = event.target.closest(
      "[data-archive-nutrition-entry]"
    );
    const restoreButton = event.target.closest(
      "[data-restore-nutrition-entry]"
    );

    if (busy || (!archiveButton && !restoreButton)) {
      return;
    }

    if (archiveButton) {
      const confirmed = window.confirm(
        "Bu kaydı günün toplamından kaldırmak istiyor musun? Kayıt güvenlik için arşivde korunacak."
      );

      if (!confirmed) {
        return;
      }

      const now = new Date().toISOString();

      void runAction(
        () => getDependencies()
          .history.archiveEntry(
            archiveButton.dataset
              .archiveNutritionEntry,
            {
              userInitiated: true,
              userConfirmed: true,
              confirmEntryArchive: true,
              at: now,
              clientOperationId:
                makeOperationId("archive")
            }
          ),
        "Kayıt günün toplamından çıkarıldı; arşivde korunuyor."
      );
      return;
    }

    const confirmed = window.confirm(
      "Bu kaydı yeniden günün toplamına eklemek istiyor musun?"
    );

    if (!confirmed) {
      return;
    }

    const now = new Date().toISOString();

    void runAction(
      () => getDependencies()
        .history.restoreEntry(
          restoreButton.dataset
            .restoreNutritionEntry,
          {
            userInitiated: true,
            userConfirmed: true,
            confirmEntryRestore: true,
            at: now,
            clientOperationId:
              makeOperationId("restore")
          }
        ),
      "Arşivlenen kayıt yeniden günün toplamına eklendi."
    );
  }

  function bindEvents() {
    elements.waterButtons.forEach(button => {
      button.addEventListener(
        "click",
        onWaterClick
      );
    });
    elements.healthMealForm.addEventListener(
      "submit",
      onMealSubmit
    );
    elements.healthLibrarySearch
      .addEventListener(
        "input",
        onLibraryFilterChange
      );
    elements.healthLibraryType
      .addEventListener(
        "change",
        onLibraryFilterChange
      );
    elements.healthLibraryResults
      .addEventListener(
        "click",
        onLibrarySelectionClick
      );
    elements.healthLibrarySelected
      .addEventListener(
        "click",
        onLibrarySelectionClick
      );
    elements.healthPlannedMeals
      .addEventListener(
        "click",
        onPlannedMealClick
      );
    elements.healthEntryList.addEventListener(
      "click",
      onEntryManagementClick
    );
    elements.healthArchivedList.addEventListener(
      "click",
      onEntryManagementClick
    );
    elements.btnHealthPreviousDay.addEventListener(
      "click",
      onPreviousDayClick
    );
    elements.btnHealthNextDay.addEventListener(
      "click",
      onNextDayClick
    );
    elements.btnHealthToday.addEventListener(
      "click",
      onTodayClick
    );
    elements.btnHealthRefresh.addEventListener(
      "click",
      () => {
        if (!busy) {
          void Promise.all([
            refresh({ announce: true }),
            refreshLibrary()
          ]);
        }
      }
    );
  }

  function init(options = {}) {
    if (initialized) {
      return getState();
    }

    root = options.root || document;
    getDependencies();
    elements = collectElements(root);
    selectedDayKey = todayKey();
    bindEvents();
    elements.healthTodayLabel.textContent =
      formatDay(selectedDayKey);
    elements.healthDashboard.setAttribute(
      "aria-busy",
      "false"
    );
    initialized = true;
    renderSelectedLibrary();
    applyDayMode();

    return getState();
  }

  async function open() {
    if (!initialized) {
      init();
    }

    opened = true;
    selectedDayKey = todayKey();
    applyDayMode();
    setStatus("");
    await Promise.all([
      refresh(),
      refreshLibrary()
    ]);
    return getState();
  }

  window.TodayNutritionUI = Object.freeze({
    UI_API_VERSION,
    UI_RULESET_ID,
    MAX_VISIBLE_ENTRIES,
    MAX_VISIBLE_PLANNED_MEALS,
    MAX_VISIBLE_LIBRARY_RESULTS,
    MAX_SELECTED_LIBRARY_ITEMS,
    MEAL_LABELS,
    PLAN_STATUS_LABELS,
    LIBRARY_TYPE_LABELS,
    REQUIRED_IDS,
    todayKey,
    selectedIsToday,
    init,
    open,
    refresh,
    refreshLibrary,
    getState
  });
})();
