/**
 * Today App v2
 * Migration Manager
 * Sprint 1.1 — Foundation
 *
 * Amaç:
 * - Önceki Today sürümlerindeki kayıtları bulmak
 * - Farklı veri formatlarını tanımak
 * - Kayıtları yeni TodayStorage veri modeline dönüştürmek
 * - Mevcut v2 kayıtlarını ezmeden geçmiş verilerle birleştirmek
 * - Eski localStorage kayıtlarını güvenlik amacıyla silmemek
 */

(function () {
  "use strict";

  const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  /**
   * Önceki geliştirmelerde kullanılmış olabilecek anahtarlar.
   * Bu liste ileride eski index.html sürümlerinden kesin anahtarlar
   * tespit edildikçe genişletilebilir.
   */
  const KNOWN_LEGACY_KEYS = [
    "today_app_v10",
    "today_data_v10",
    "today_data_v2",
    "today_data_v1",
    "today_data",
    "today_store",
    "today_store_v1",
    "todaySelections",
    "today_entries",
    "todayAppData",
    "today_app_data"
  ];

  /**
   * JSON değerini güvenli biçimde okur.
   */
  function safeParse(value) {
    if (!value || typeof value !== "string") {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  /**
   * Girilen değerin geçerli bir tarih anahtarı olup olmadığını kontrol eder.
   */
  function isDateKey(value) {
    return typeof value === "string" && DATE_KEY_PATTERN.test(value);
  }

  /**
   * Bir nesnenin doğrudan tarih anahtarları taşıyıp taşımadığını kontrol eder.
   */
  function isDateMap(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    return Object.keys(value).some(isDateKey);
  }

  /**
   * Eski seçim değerlerini yeni A/B/C standardına dönüştürür.
   */
  function normalizeChoice(value) {
    if (value === null || value === undefined) {
      return "";
    }

    const text = String(value).trim();

    if (["A", "B", "C"].includes(text)) {
      return text;
    }

    const normalized = text.toLocaleLowerCase("tr-TR");

    if (
      normalized.includes("adı yok") ||
      normalized.includes("bir şey oldu")
    ) {
      return "A";
    }

    if (
      normalized.includes("çok net") ||
      normalized === "net" ||
      normalized === "netti"
    ) {
      return "B";
    }

    if (
      normalized.includes("zordu") ||
      normalized.includes("zor")
    ) {
      return "C";
    }

    return "";
  }

  /**
   * Eski renk kodlarını ortak formata dönüştürür.
   */
  function normalizeColor(value) {
    if (value === null || value === undefined) {
      return "";
    }

    const text = String(value).trim().toLocaleLowerCase("tr-TR");

    const colorMap = {
      k: "deep",
      black: "deep",
      siyah: "deep",
      deep: "deep",
      derin: "deep",

      b: "blue",
      blue: "blue",
      mavi: "blue",

      r: "red",
      red: "red",
      kırmızı: "red",
      kirmizi: "red",

      g: "green",
      green: "green",
      yeşil: "green",
      yesil: "green",

      y: "yellow",
      yellow: "yellow",
      sarı: "yellow",
      sari: "yellow",

      navy: "navy",
      lacivert: "navy",

      orange: "orange",
      turuncu: "orange"
    };

    return colorMap[text] || "";
  }

  /**
   * Zaman değerini mümkün olduğunca ISO biçimine dönüştürür.
   */
  function normalizeTimestamp(value, fallback) {
    if (!value) {
      return fallback;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return fallback;
    }

    return date.toISOString();
  }

  /**
   * Eski değişiklik kayıtlarını ortak yapıya dönüştürür.
   */
  function normalizeChangeLog(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) => {
        if (!entry) {
          return null;
        }

        if (typeof entry === "string") {
          return {
            timestamp: new Date().toISOString(),
            type: "legacy",
            description: entry
          };
        }

        if (typeof entry === "object") {
          return {
            timestamp: normalizeTimestamp(
              entry.timestamp ||
                entry.time ||
                entry.t ||
                entry.createdAt,
              new Date().toISOString()
            ),
            type:
              entry.type ||
              entry.action ||
              entry.a ||
              entry.what ||
              "legacy",
            description:
              entry.description ||
              entry.message ||
              entry.what ||
              entry.a ||
              ""
          };
        }

        return null;
      })
      .filter(Boolean);
  }

  /**
   * Tek bir eski gün kaydını v2 gün modeline dönüştürür.
   */
  function normalizeDay(dateKey, legacyValue) {
    const now = new Date().toISOString();

    if (typeof legacyValue === "string") {
      return {
        choice: normalizeChoice(legacyValue),
        color: "",
        note: "",
        createdAt: now,
        updatedAt: now,
        changeCount: 0,
        changeLog: []
      };
    }

    if (!legacyValue || typeof legacyValue !== "object") {
      return null;
    }

    const rawChoice =
      legacyValue.choice ??
      legacyValue.selection ??
      legacyValue.selected ??
      legacyValue.sel ??
      legacyValue.pick ??
      legacyValue.value ??
      "";

    const rawColor =
      legacyValue.color ??
      legacyValue.colour ??
      legacyValue.col ??
      legacyValue.colorCode ??
      "";

    const rawNote =
      legacyValue.note ??
      legacyValue.notes ??
      legacyValue.text ??
      legacyValue.comment ??
      "";

    const createdAt = normalizeTimestamp(
      legacyValue.createdAt ||
        legacyValue.created ||
        legacyValue.firstCreatedAt,
      `${dateKey}T12:00:00.000Z`
    );

    const updatedAt = normalizeTimestamp(
      legacyValue.updatedAt ||
        legacyValue.updated ||
        legacyValue.lastUpdated ||
        legacyValue.timestamp,
      createdAt
    );

    const rawLog =
      legacyValue.changeLog ||
      legacyValue.changes ||
      legacyValue.log ||
      legacyValue.history ||
      [];

    const changeLog = normalizeChangeLog(rawLog);

    const rawCount =
      legacyValue.changeCount ??
      legacyValue.edits ??
      legacyValue.editCount ??
      changeLog.length;

    const changeCount = Number.isFinite(Number(rawCount))
      ? Math.max(0, Number(rawCount))
      : changeLog.length;

    return {
      choice: normalizeChoice(rawChoice),
      color: normalizeColor(rawColor),
      note: typeof rawNote === "string" ? rawNote : String(rawNote || ""),
      createdAt,
      updatedAt,
      changeCount,
      changeLog
    };
  }

  /**
   * Olası eski veri yapısından gün haritasını çıkarır.
   */
  function extractDayMap(value) {
    if (!value) {
      return null;
    }

    if (isDateMap(value)) {
      return value;
    }

    if (
      value.days &&
      typeof value.days === "object" &&
      isDateMap(value.days)
    ) {
      return value.days;
    }

    if (
      value.entries &&
      typeof value.entries === "object" &&
      isDateMap(value.entries)
    ) {
      return value.entries;
    }

    if (
      value.selections &&
      typeof value.selections === "object" &&
      isDateMap(value.selections)
    ) {
      return value.selections;
    }

    if (Array.isArray(value)) {
      const result = {};

      value.forEach((entry) => {
        if (!entry || typeof entry !== "object") {
          return;
        }

        const date =
          entry.date ||
          entry.dateKey ||
          entry.day ||
          entry.createdDate;

        if (isDateKey(date)) {
          result[date] = entry;
        }
      });

      return Object.keys(result).length ? result : null;
    }

    return null;
  }

  /**
   * localStorage içinde olası eski Today verilerini tarar.
   */
  function scanLegacySources() {
    const sources = [];
    const visitedKeys = new Set();

    function inspectKey(key) {
      if (!key || visitedKeys.has(key)) {
        return;
      }

      visitedKeys.add(key);

      if (
        window.TodayStorage &&
        [
          window.TodayStorage.STORAGE_KEY,
          window.TodayStorage.BACKUP_KEY
        ].includes(key)
      ) {
        return;
      }

      const raw = localStorage.getItem(key);
      const parsed = safeParse(raw);
      const dayMap = extractDayMap(parsed);

      if (!dayMap) {
        return;
      }

      sources.push({
        key,
        dayMap,
        dayCount: Object.keys(dayMap).filter(isDateKey).length
      });
    }

    KNOWN_LEGACY_KEYS.forEach(inspectKey);

    for (let index = 0; index < localStorage.length; index += 1) {
      inspectKey(localStorage.key(index));
    }

    return sources;
  }

  /**
   * İki gün kaydını veri kaybetmeden birleştirir.
   *
   * Mevcut v2 kaydındaki dolu alanlar önceliklidir.
   * Eski kayıt yalnızca eksik alanları tamamlar.
   */
  function mergeDayRecords(currentDay, migratedDay) {
    if (!currentDay) {
      return migratedDay;
    }

    if (!migratedDay) {
      return currentDay;
    }

    const currentLog = Array.isArray(currentDay.changeLog)
      ? currentDay.changeLog
      : [];

    const migratedLog = Array.isArray(migratedDay.changeLog)
      ? migratedDay.changeLog
      : [];

    const mergedLog = [...migratedLog, ...currentLog]
      .filter((entry, index, array) => {
        const signature = JSON.stringify(entry);

        return (
          array.findIndex(
            (candidate) => JSON.stringify(candidate) === signature
          ) === index
        );
      })
      .sort((a, b) =>
        String(a.timestamp || "").localeCompare(
          String(b.timestamp || "")
        )
      );

    return {
      ...migratedDay,
      ...currentDay,

      choice: currentDay.choice || migratedDay.choice || "",
      color: currentDay.color || migratedDay.color || "",
      note: currentDay.note || migratedDay.note || "",

      createdAt:
        currentDay.createdAt ||
        migratedDay.createdAt ||
        new Date().toISOString(),

      updatedAt:
        currentDay.updatedAt ||
        migratedDay.updatedAt ||
        new Date().toISOString(),

      changeCount: Math.max(
        Number(currentDay.changeCount || 0),
        Number(migratedDay.changeCount || 0),
        mergedLog.length
      ),

      changeLog: mergedLog
    };
  }

  /**
   * Bulunan eski verileri v2 store içine taşır.
   *
   * Eski localStorage anahtarları kesinlikle silinmez.
   */
  function migrate(options = {}) {
    if (
      !window.TodayStorage ||
      typeof window.TodayStorage.loadStore !== "function"
    ) {
      return {
        success: false,
        migrated: false,
        message: "TodayStorage yüklenmedi."
      };
    }

    const force = options.force === true;
    const store = window.TodayStorage.loadStore();

    if (
      store.migration &&
      store.migration.completed === true &&
      !force
    ) {
      return {
        success: true,
        migrated: false,
        skipped: true,
        message: "Migration daha önce tamamlandı.",
        migratedDayCount: 0,
        sourceKeys: store.migration.sourceKeys || []
      };
    }

    const sources = scanLegacySources();

    let migratedDayCount = 0;
    const importedDates = new Set();
    const sourceKeys = [];

    sources.forEach((source) => {
      sourceKeys.push(source.key);

      Object.entries(source.dayMap).forEach(
        ([dateKey, legacyValue]) => {
          if (!isDateKey(dateKey)) {
            return;
          }

          const migratedDay = normalizeDay(
            dateKey,
            legacyValue
          );

          if (!migratedDay) {
            return;
          }

          const existingDay = store.days[dateKey] || null;
          const mergedDay = mergeDayRecords(
            existingDay,
            migratedDay
          );

          const before = JSON.stringify(existingDay);
          const after = JSON.stringify(mergedDay);

          store.days[dateKey] = mergedDay;

          if (before !== after) {
            importedDates.add(dateKey);
          }
        }
      );
    });

    migratedDayCount = importedDates.size;

    store.migration = {
      completed: true,
      sourceKeys: [...new Set(sourceKeys)],
      migratedAt: new Date().toISOString(),
      migratedDayCount
    };

    let stampedStore = store;

    if (
      window.TodayVersion &&
      typeof window.TodayVersion.stampStore === "function"
    ) {
      stampedStore = window.TodayVersion.stampStore(store);
    }

    window.TodayStorage.saveStore(stampedStore);

    return {
      success: true,
      migrated: migratedDayCount > 0,
      skipped: false,
      message:
        migratedDayCount > 0
          ? `${migratedDayCount} geçmiş gün kaydı taşındı.`
          : "Taşınabilecek eski kayıt bulunamadı.",
      migratedDayCount,
      sourceKeys: [...new Set(sourceKeys)]
    };
  }

  /**
   * Migration tamamlanma bilgisini sıfırlar.
   * Yalnızca test veya zorunlu yeniden tarama için kullanılmalıdır.
   */
  function resetMigrationFlag() {
    if (!window.TodayStorage) {
      return false;
    }

    const store = window.TodayStorage.loadStore();

    store.migration = {
      completed: false,
      sourceKeys: [],
      migratedAt: null,
      migratedDayCount: 0
    };

    window.TodayStorage.saveStore(store);

    return true;
  }

  /**
   * Migration durumunu döndürür.
   */
  function getStatus() {
    if (!window.TodayStorage) {
      return {
        available: false,
        completed: false
      };
    }

    const store = window.TodayStorage.loadStore();

    return {
      available: true,
      completed: store.migration?.completed === true,
      sourceKeys: store.migration?.sourceKeys || [],
      migratedAt: store.migration?.migratedAt || null,
      migratedDayCount:
        store.migration?.migratedDayCount || 0
    };
  }

  window.TodayMigration = Object.freeze({
    KNOWN_LEGACY_KEYS,

    scanLegacySources,
    normalizeChoice,
    normalizeColor,
    normalizeDay,
    migrate,
    resetMigrationFlag,
    getStatus
  });

  console.info("Today Migration Manager hazır.");
})();