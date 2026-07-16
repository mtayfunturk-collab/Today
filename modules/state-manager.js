/**
 * Today App v2
 * State Manager
 * Sprint 2.2 — Application State
 *
 * Amaç:
 * - Uygulama state yapısını tek merkezden yönetmek
 * - TodayStorage verisini ekranın kullandığı state biçimine çevirmek
 * - Eski today_app_v10 kaydını güvenlik kopyası olarak korumak
 */

(function () {
  "use strict";

  const APP_KEY = "today_app_v10";
  const LEGACY_VERSION = 10;
  const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  /**
   * Uygulamanın beklediği boş state yapısını oluşturur.
   */
  function createEmptyState() {
    return {
      v: LEGACY_VERSION,
      theme: "system",
      days: {},
      logs: {}
    };
  }

  /**
   * JSON metnini güvenli biçimde ayrıştırır.
   */
  function safeParse(value) {
    if (!value || typeof value !== "string") {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn(
        "Today State: JSON verisi okunamadı.",
        error
      );

      return null;
    }
  }

  /**
   * Bir nesnenin tarih anahtarlı günlük kayıtlar
   * içerip içermediğini kontrol eder.
   */
  function looksLikeDays(value) {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return false;
    }

    return Object.keys(value).some((key) =>
      DATE_KEY_PATTERN.test(key)
    );
  }

  /**
   * localStorage içindeki eski günlük kayıtları tarar.
   *
   * Eski verileri silmez.
   */
  function migrateOldDays() {
    const merged = {};

    for (
      let index = 0;
      index < localStorage.length;
      index += 1
    ) {
      const key = localStorage.key(index);

      if (!key) {
        continue;
      }

      // Ana v10 kaydı bu taramaya tekrar dahil edilmez.
      if (key === APP_KEY) {
        continue;
      }

      if (
        window.TodayStorage &&
        [
          window.TodayStorage.STORAGE_KEY,
          window.TodayStorage.BACKUP_KEY
        ].includes(key)
      ) {
        continue;
      }

      const raw = localStorage.getItem(key);
      const parsed = safeParse(raw);

      if (!parsed) {
        continue;
      }

      const nestedDays = parsed.days;
      const directDays = parsed;

      if (looksLikeDays(nestedDays)) {
        Object.assign(merged, nestedDays);
      } else if (looksLikeDays(directDays)) {
        Object.assign(merged, directDays);
      }
    }

    return merged;
  }

  /**
   * State yapısının temel alanlarını garanti eder.
   */
  function normalizeState(value) {
    const state =
      value && typeof value === "object"
        ? value
        : createEmptyState();

    return {
      ...state,

      v: LEGACY_VERSION,

      theme:
        typeof state.theme === "string"
          ? state.theme
          : "system",

      days:
        state.days &&
        typeof state.days === "object" &&
        !Array.isArray(state.days)
          ? state.days
          : {},

      logs:
        state.logs &&
        typeof state.logs === "object" &&
        !Array.isArray(state.logs)
          ? state.logs
          : {}
    };
  }

  /**
   * TodayStorage içindeki v2 kayıtlarını uygulamanın
   * kullandığı state biçimiyle birleştirir.
   *
   * Günlük seçim, renk ve not için v2 kayıtları önceliklidir.
   * Eski logs alanı korunur.
   */
  function mergeStorageIntoState(legacyState) {
    const normalizedLegacy =
      normalizeState(legacyState);

    if (
      !window.TodayStorage ||
      typeof window.TodayStorage.loadStore !== "function"
    ) {
      return normalizedLegacy;
    }

    try {
      const store = window.TodayStorage.loadStore();

      if (
        !store ||
        typeof store !== "object" ||
        !store.days ||
        typeof store.days !== "object"
      ) {
        return normalizedLegacy;
      }

      const mergedState = {
        ...normalizedLegacy,

        theme:
          store.settings?.theme ||
          normalizedLegacy.theme ||
          "system",

        days: {
          ...normalizedLegacy.days
        },

        logs: {
          ...normalizedLegacy.logs
        }
      };

      Object.entries(store.days).forEach(
        ([dateKey, storedDay]) => {
          if (
            !DATE_KEY_PATTERN.test(dateKey) ||
            !storedDay ||
            typeof storedDay !== "object"
          ) {
            return;
          }

          const legacyDay =
            mergedState.days[dateKey] || {};

          mergedState.days[dateKey] = {
            ...legacyDay,

            choice:
              storedDay.choice ??
              legacyDay.choice ??
              "",

            color:
              storedDay.color ??
              legacyDay.color ??
              "",

            note:
              storedDay.note ??
              legacyDay.note ??
              ""
          };
        }
      );

      return normalizeState(mergedState);
    } catch (error) {
      console.warn(
        "Today State: TodayStorage okunamadı; eski kayıt kullanılacak.",
        error
      );

      return normalizedLegacy;
    }
  }

  /**
   * Eski formatta bulunan günlük kayıtları yeni state
   * nesnesine dönüştürür.
   */
  function importLegacyDays(state, legacyDays) {
    const targetState = normalizeState(state);

    Object.keys(legacyDays || {}).forEach(
      (dateKey) => {
        const value = legacyDays[dateKey];

        if (
          !DATE_KEY_PATTERN.test(dateKey) ||
          !value ||
          typeof value !== "object"
        ) {
          return;
        }

        targetState.days[dateKey] = {
          choice:
            value.choice ||
            value.sel ||
            value.pick ||
            "",

          color:
            value.color ||
            value.col ||
            "",

          note:
            value.note ||
            value.n ||
            ""
        };
      }
    );

    return targetState;
  }

  /**
   * Uygulama state'ini yükler.
   *
   * Sıra:
   * 1. today_app_v10
   * 2. Bulunabilen eski kayıtlar
   * 3. TodayStorage v2 kayıtları
   */
  function load() {
    const legacyState = safeParse(
      localStorage.getItem(APP_KEY)
    );

    if (
      legacyState &&
      legacyState.v === LEGACY_VERSION
    ) {
      return mergeStorageIntoState(legacyState);
    }

    const emptyState = createEmptyState();
    const oldDays = migrateOldDays();

    const importedState = importLegacyDays(
      emptyState,
      oldDays
    );

    const finalState =
      mergeStorageIntoState(importedState);

    // Eski güvenlik kopyasını oluştur veya güncelle.
    localStorage.setItem(
      APP_KEY,
      JSON.stringify(finalState)
    );

    return finalState;
  }

  /**
   * State'i eski güvenlik kopyasına ve TodayStorage'a yazar.
   */
  function save(state) {
    const normalizedState =
      normalizeState(state);

    // Eski v10 kaydı güvenlik kopyası olarak korunur.
    localStorage.setItem(
      APP_KEY,
      JSON.stringify(normalizedState)
    );

    if (
      !window.TodayStorage ||
      typeof window.TodayStorage.saveDay !== "function"
    ) {
      console.warn(
        "Today State: TodayStorage kullanılamıyor; yalnızca eski güvenlik kopyası güncellendi."
      );

      return {
        success: true,
        storageSaved: false,
        legacyBackupSaved: true,
        savedDayCount: 0
      };
    }

    let savedDayCount = 0;

    try {
      Object.entries(
        normalizedState.days
      ).forEach(([dateKey, day]) => {
        if (
          !DATE_KEY_PATTERN.test(dateKey) ||
          !day ||
          typeof day !== "object"
        ) {
          return;
        }

        const dayLogs =
          normalizedState.logs?.[dateKey] || {};

        const changes =
          Array.isArray(dayLogs.changes)
            ? dayLogs.changes
            : [];

        window.TodayStorage.saveDay(dateKey, {
          choice: day.choice || "",
          color: day.color || "",
          note: day.note || "",

          changeCount: changes.length,

          changeLog: changes.map((entry) => ({
            timestamp:
              entry.t ||
              entry.timestamp ||
              new Date().toISOString(),

            type:
              entry.type ||
              entry.what ||
              "change",

            description:
              entry.description ||
              entry.what ||
              ""
          }))
        });

        savedDayCount += 1;
      });

      const store =
        window.TodayStorage.loadStore();

      store.settings = {
        ...(store.settings || {}),
        theme: normalizedState.theme
      };

      window.TodayStorage.saveStore(store);

      return {
        success: true,
        storageSaved: true,
        legacyBackupSaved: true,
        savedDayCount
      };
    } catch (error) {
      console.warn(
        "Today State: TodayStorage kaydı başarısız oldu; eski güvenlik kopyası korundu.",
        error
      );

      return {
        success: false,
        storageSaved: false,
        legacyBackupSaved: true,
        savedDayCount,
        error
      };
    }
  }

  window.TodayState = Object.freeze({
    APP_KEY,
    LEGACY_VERSION,

    createEmptyState,
    safeParse,
    looksLikeDays,
    migrateOldDays,
    normalizeState,
    mergeStorageIntoState,
    importLegacyDays,
    load,
    save
  });

  console.info("Today State Manager hazır.");
})();