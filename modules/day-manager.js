/**
 * Today App v2
 * Day Manager
 * Sprint 2.1 — Date Utilities
 *
 * Amaç:
 * - Tarih anahtarlarını tek merkezden üretmek
 * - Tarih anahtarlarını güvenli biçimde okumak
 * - Takvim ve günlük kayıt işlemlerinde ortak tarih standardı kullanmak
 */

(function () {
  "use strict";

  const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  /**
   * Sayıyı iki basamaklı metne dönüştürür.
   * 4 → "04"
   */
  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  /**
   * Bir Date nesnesini yerel YYYY-MM-DD anahtarına dönüştürür.
   *
   * UTC kullanılmaz. Böylece gece saatlerinde günün yanlış
   * tarihe kayması önlenir.
   */
  function toDateKey(date = new Date()) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      throw new Error("Today Day Manager: Geçersiz tarih.");
    }

    return [
      date.getFullYear(),
      pad2(date.getMonth() + 1),
      pad2(date.getDate())
    ].join("-");
  }

  /**
   * Bugünün yerel tarih anahtarını döndürür.
   */
  function todayKey() {
    return toDateKey(new Date());
  }

  /**
   * YYYY-MM-DD anahtarının biçimini ve gerçek tarih
   * olup olmadığını kontrol eder.
   */
  function isValidDateKey(dateKey) {
    if (
      typeof dateKey !== "string" ||
      !DATE_KEY_PATTERN.test(dateKey)
    ) {
      return false;
    }

    const [year, month, day] = dateKey
      .split("-")
      .map(Number);

    const date = new Date(year, month - 1, day);

    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  /**
   * YYYY-MM-DD anahtarını yerel Date nesnesine dönüştürür.
   */
  function parseKey(dateKey) {
    if (!isValidDateKey(dateKey)) {
      throw new Error(
        `Today Day Manager: Geçersiz tarih anahtarı: ${dateKey}`
      );
    }

    const [year, month, day] = dateKey
      .split("-")
      .map(Number);

    return new Date(year, month - 1, day);
  }

  /**
   * Tarihi Türkçe, okunabilir biçimde gösterir.
   */
  function prettyTR(dateKey) {
    return parseKey(dateKey).toLocaleDateString(
      "tr-TR",
      {
        day: "2-digit",
        month: "long",
        year: "numeric"
      }
    );
  }

  /**
   * Date nesnesinden YYYY-MM ay anahtarı üretir.
   */
  function ymKey(date = new Date()) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      throw new Error("Today Day Manager: Geçersiz tarih.");
    }

    return [
      date.getFullYear(),
      pad2(date.getMonth() + 1)
    ].join("-");
  }

  /**
   * İki Date nesnesinin aynı takvim gününde olup
   * olmadığını kontrol eder.
   */
  function isSameDay(dateA, dateB) {
    if (
      !(dateA instanceof Date) ||
      !(dateB instanceof Date) ||
      Number.isNaN(dateA.getTime()) ||
      Number.isNaN(dateB.getTime())
    ) {
      return false;
    }

    return (
      dateA.getFullYear() === dateB.getFullYear() &&
      dateA.getMonth() === dateB.getMonth() &&
      dateA.getDate() === dateB.getDate()
    );
  }

  window.TodayDay = Object.freeze({
    DATE_KEY_PATTERN,
    pad2,
    toDateKey,
    todayKey,
    isValidDateKey,
    parseKey,
    prettyTR,
    ymKey,
    isSameDay
  });

  console.info("Today Day Manager hazır.");
})();