/**
 * Today App v2
 * Version Manager
 * Sprint 1.1 — Foundation
 *
 * Amaç:
 * - Uygulama ve veri şeması sürümlerini tek merkezden yönetmek
 * - Eski/yeni veri yapısını karşılaştırmak
 * - Migration gerekip gerekmediğini belirlemek
 * - Gelecekteki sürüm geçişlerini kontrollü hâle getirmek
 */

(function () {
  "use strict";

  const APP_VERSION = "2.0.0";
  const SCHEMA_VERSION = 2;

  /**
   * Semantic Versioning biçimindeki sürümü parçalara ayırır.
   *
   * Örnek:
   * "2.1.3" → { major: 2, minor: 1, patch: 3 }
   */
  function parseVersion(version) {
    if (typeof version !== "string") {
      return {
        major: 0,
        minor: 0,
        patch: 0
      };
    }

    const cleanVersion = version.trim().replace(/^v/i, "");
    const parts = cleanVersion.split(".").map((part) => {
      const number = Number.parseInt(part, 10);
      return Number.isFinite(number) ? number : 0;
    });

    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0
    };
  }

  /**
   * İki uygulama sürümünü karşılaştırır.
   *
   * Sonuç:
   * -1 → versionA daha eski
   *  0 → sürümler eşit
   *  1 → versionA daha yeni
   */
  function compareVersions(versionA, versionB) {
    const a = parseVersion(versionA);
    const b = parseVersion(versionB);

    if (a.major !== b.major) {
      return a.major > b.major ? 1 : -1;
    }

    if (a.minor !== b.minor) {
      return a.minor > b.minor ? 1 : -1;
    }

    if (a.patch !== b.patch) {
      return a.patch > b.patch ? 1 : -1;
    }

    return 0;
  }

  /**
   * Storage Manager içindeki veri deposunun sürüm durumunu inceler.
   */
  function inspectStore(store) {
    if (!store || typeof store !== "object") {
      return {
        valid: false,
        migrationRequired: true,
        reason: "Veri deposu bulunamadı veya geçersiz."
      };
    }

    const currentSchema = Number(store.schemaVersion || 0);
    const currentAppVersion =
      typeof store.appVersion === "string"
        ? store.appVersion
        : "0.0.0";

    const schemaComparison =
      currentSchema === SCHEMA_VERSION
        ? 0
        : currentSchema < SCHEMA_VERSION
          ? -1
          : 1;

    const appComparison = compareVersions(
      currentAppVersion,
      APP_VERSION
    );

    return {
      valid: true,

      currentSchemaVersion: currentSchema,
      targetSchemaVersion: SCHEMA_VERSION,

      currentAppVersion,
      targetAppVersion: APP_VERSION,

      schemaComparison,
      appComparison,

      migrationRequired: schemaComparison === -1,
      schemaIsNewerThanApp: schemaComparison === 1,
      appDataIsOlder: appComparison === -1,
      appDataIsNewer: appComparison === 1
    };
  }

  /**
   * Migration gerekip gerekmediğini kısa biçimde döndürür.
   */
  function requiresMigration(store) {
    const inspection = inspectStore(store);
    return inspection.migrationRequired === true;
  }

  /**
   * Veri deposunun sürüm bilgilerini günceller.
   *
   * Bu fonksiyon veri içeriğini dönüştürmez.
   * Yalnızca migration tamamlandıktan sonra sürüm damgası koymak için kullanılır.
   */
  function stampStore(store) {
    if (!store || typeof store !== "object") {
      throw new Error(
        "Today Version: Sürüm bilgisi eklenecek veri deposu geçersiz."
      );
    }

    return {
      ...store,
      schemaVersion: SCHEMA_VERSION,
      appVersion: APP_VERSION,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Uygulamanın mevcut sürüm bilgilerini döndürür.
   */
  function getCurrentVersion() {
    return {
      appVersion: APP_VERSION,
      schemaVersion: SCHEMA_VERSION
    };
  }

  /**
   * Storage Manager yüklüyse mevcut veri deposunu kontrol eder.
   */
  function inspectCurrentStore() {
    if (
      !window.TodayStorage ||
      typeof window.TodayStorage.loadStore !== "function"
    ) {
      return {
        valid: false,
        migrationRequired: false,
        reason: "TodayStorage henüz yüklenmedi."
      };
    }

    const store = window.TodayStorage.loadStore();
    return inspectStore(store);
  }

  /**
   * Diğer dosyaların kullanacağı genel API.
   */
  window.TodayVersion = Object.freeze({
    APP_VERSION,
    SCHEMA_VERSION,

    parseVersion,
    compareVersions,
    inspectStore,
    inspectCurrentStore,
    requiresMigration,
    stampStore,
    getCurrentVersion
  });

  console.info("Today Version Manager hazır:", {
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION
  });
})();