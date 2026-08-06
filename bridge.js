/**
 * Today App v2
 * Legacy Bridge
 * Sprint 1.2 — Dual Write
 *
 * Mevcut v1 veri modelini bozmadan,
 * verileri yeni TodayStorage yapısına da aktarır.
 */

(function () {
  "use strict";

  function isObject(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    );
  }

  function clone(value) {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
  }

  function normalizeChoice(value) {
    if (["A", "B", "C"].includes(value)) {
      return value;
    }

    if (!value) {
      return "";
    }

    const text = String(value).toLocaleLowerCase("tr-TR");

    if (
      text.includes("adı yok") ||
      text.includes("bir şey oldu")
    ) {
      return "A";
    }

    if (
      text.includes("çok net") ||
      text === "net" ||
      text === "netti"
    ) {
      return "B";
    }

    if (
      text.includes("zordu") ||
      text.includes("zor")
    ) {
      return "C";
    }

    return "";
  }

  function normalizeColor(value) {
    if (!value) {
      return "";
    }

    const text = String(value)
      .trim()
      .toLocaleLowerCase("tr-TR");

    const colors = {
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

    return colors[text] || text;
  }

  function normalizeChangeLog(day, legacyLogs) {
    const source =
      day.changeLog ||
      day.changes ||
      day.log ||
      legacyLogs?.changes ||
      [];

    if (!Array.isArray(source)) {
      return [];
    }

    return source.map((entry) => {
      if (typeof entry === "string") {
        return {
          timestamp: new Date().toISOString(),
          type: "legacy",
          description: entry
        };
      }

      return {
        timestamp:
          entry.timestamp ||
          entry.time ||
          entry.t ||
          new Date().toISOString(),

        type:
          entry.type ||
          entry.action ||
          entry.what ||
          entry.a ||
          "legacy",

        description:
          entry.description ||
          entry.message ||
          entry.what ||
          entry.a ||
          ""
      };
    });
  }

  function normalizeDay(dateKey, day, legacyLogs) {
    if (!isObject(day)) {
      return null;
    }

    const now = new Date().toISOString();
    const changeLog = normalizeChangeLog(day, legacyLogs);

    const changeCountValue =
      day.changeCount ??
      day.edits ??
      day.editCount ??
      changeLog.length;

    return {
      choice: normalizeChoice(
        day.choice ??
        day.selection ??
        day.selected ??
        day.sel ??
        day.pick
      ),

      color: normalizeColor(
        day.color ??
        day.colour ??
        day.col
      ),

      note:
        typeof day.note === "string"
          ? day.note
          : typeof day.notes === "string"
            ? day.notes
            : "",

      createdAt:
        day.createdAt ||
        day.created ||
        `${dateKey}T12:00:00.000Z`,

      updatedAt:
        day.updatedAt ||
        day.updated ||
        day.lastUpdated ||
        now,

      changeCount:
        Number.isFinite(Number(changeCountValue))
          ? Math.max(0, Number(changeCountValue))
          : changeLog.length,

      changeLog
    };
  }

  /**
   * Mevcut v1 state nesnesini yeni store içine aktarır.
   *
   * Beklenen eski yapı örnekleri:
   *
   * {
   *   days: {},
   *   logs: {},
   *   theme: "dark"
   * }
   */
  function syncFromLegacy(legacyState) {
    if (
      !window.TodayStorage ||
      typeof window.TodayStorage.loadStore !== "function"
    ) {
      return {
        success: false,
        message: "TodayStorage yüklenmedi."
      };
    }

    if (!isObject(legacyState)) {
      return {
        success: false,
        message: "Eski uygulama verisi geçersiz."
      };
    }

    const store = window.TodayStorage.loadStore();
    const legacyDays = isObject(legacyState.days)
      ? legacyState.days
      : {};

    const legacyLogs = isObject(legacyState.logs)
      ? legacyState.logs
      : {};

    let syncedDayCount = 0;

    Object.entries(legacyDays).forEach(
      ([dateKey, legacyDay]) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
          return;
        }

        const normalizedDay = normalizeDay(
          dateKey,
          legacyDay,
          legacyLogs[dateKey]
        );

        if (!normalizedDay) {
          return;
        }

        const existingDay = store.days[dateKey] || {};

        store.days[dateKey] = {
          ...normalizedDay,
          ...existingDay,

          choice:
            normalizedDay.choice ||
            existingDay.choice ||
            "",

          color:
            normalizedDay.color ||
            existingDay.color ||
            "",

          note:
            normalizedDay.note ||
            existingDay.note ||
            "",

          createdAt:
            existingDay.createdAt ||
            normalizedDay.createdAt,

          updatedAt:
            normalizedDay.updatedAt ||
            existingDay.updatedAt,

          changeCount: Math.max(
            Number(existingDay.changeCount || 0),
            Number(normalizedDay.changeCount || 0)
          ),

          changeLog:
            normalizedDay.changeLog.length > 0
              ? clone(normalizedDay.changeLog)
              : clone(existingDay.changeLog || [])
        };

        syncedDayCount += 1;
      }
    );

    if (legacyState.theme) {
      store.settings = {
        ...(store.settings || {}),
        theme: legacyState.theme
      };
    }

    store.bridge = {
      enabled: true,
      lastSyncedAt: new Date().toISOString(),
      syncedDayCount
    };

    window.TodayStorage.saveStore(store);

    return {
      success: true,
      syncedDayCount,
      message: `${syncedDayCount} günlük kayıt yeni veri yapısına eşitlendi.`
    };
  }

  function getStatus() {
    if (!window.TodayStorage) {
      return {
        available: false
      };
    }

    const store = window.TodayStorage.loadStore();

    return {
      available: true,
      enabled: store.bridge?.enabled === true,
      lastSyncedAt: store.bridge?.lastSyncedAt || null,
      syncedDayCount: store.bridge?.syncedDayCount || 0
    };
  }

  window.TodayBridge = Object.freeze({
    syncFromLegacy,
    normalizeDay,
    getStatus
  });

  console.info("Today Legacy Bridge hazır.");
})();