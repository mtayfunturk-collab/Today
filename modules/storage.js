/**
 * Today App v2
 * Storage Manager
 * Sprint 1.1 — Foundation
 *
 * Amaç:
 * - Veriyi tek merkezden okumak ve yazmak
 * - Her kayıttan önce otomatik yedek almak
 * - Bozuk ana kayıtta yedeğe dönebilmek
 * - Gelecekte LocalStorage yerine IndexedDB kullanılabilmesini kolaylaştırmak
 */

(function () {
  "use strict";

  const STORAGE_KEY = "today_store_v2";
  const BACKUP_KEY = "today_store_v2_backup";

  const SCHEMA_VERSION = 2;
  const APP_VERSION = "2.0.0";

  /**
   * Yeni ve boş Today veri modeli.
   */
  function createEmptyStore() {
    const now = new Date().toISOString();

    return {
      schemaVersion: SCHEMA_VERSION,
      appVersion: APP_VERSION,
      createdAt: now,
      updatedAt: now,

      metadata: {
        language: navigator.language || "tr-TR",
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Istanbul",
        platform: detectPlatform()
      },

      settings: {
        theme: "system"
      },

      days: {},
      usage: {},
      migration: {
        completed: false,
        sourceKeys: [],
        migratedAt: null
      }
    };
  }

  /**
   * Kullanıcının işletim sistemi hakkında genel teknik bilgi verir.
   * Kişisel cihaz kimliği oluşturmaz.
   */
  function detectPlatform() {
    const userAgent = navigator.userAgent || "";

    if (/iPhone|iPad|iPod/i.test(userAgent)) {
      return "ios";
    }

    if (/Android/i.test(userAgent)) {
      return "android";
    }

    return "web";
  }

  /**
   * JSON metnini güvenli şekilde ayrıştırır.
   */
  function safeParse(value) {
    if (!value || typeof value !== "string") {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn("Today Storage: JSON okunamadı.", error);
      return null;
    }
  }

  /**
   * Verinin temel yapısının geçerli olup olmadığını kontrol eder.
   */
  function isValidStore(store) {
    return Boolean(
      store &&
        typeof store === "object" &&
        typeof store.days === "object" &&
        store.days !== null
    );
  }

  /**
   * Nesnenin bağımsız kopyasını oluşturur.
   */
  function clone(value) {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
  }

  /**
   * Ana veriyi değiştirmeden önce yedekler.
   */
  function createBackup() {
    const currentRaw = localStorage.getItem(STORAGE_KEY);

    if (currentRaw) {
      localStorage.setItem(BACKUP_KEY, currentRaw);
      return true;
    }

    return false;
  }

  /**
   * Bütün veri deposunu kaydeder.
   */
  function saveStore(store, options = {}) {
    if (!isValidStore(store)) {
      throw new Error("Today Storage: Kaydedilecek veri yapısı geçersiz.");
    }

    const shouldBackup = options.backup !== false;

    if (shouldBackup) {
      createBackup();
    }

    const normalizedStore = {
      ...clone(store),
      schemaVersion: SCHEMA_VERSION,
      appVersion: APP_VERSION,
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedStore));

    return clone(normalizedStore);
  }

  /**
   * Ana veriyi okur.
   *
   * Ana veri bozuksa:
   * 1. Yedeği kontrol eder.
   * 2. Yedek geçerliyse ana veriyi yedekten geri yükler.
   * 3. Hiçbiri yoksa boş veri modeli oluşturur.
   */
  function loadStore() {
    const mainStore = safeParse(localStorage.getItem(STORAGE_KEY));

    if (isValidStore(mainStore)) {
      return clone(mainStore);
    }

    const backupStore = safeParse(localStorage.getItem(BACKUP_KEY));

    if (isValidStore(backupStore)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(backupStore));
      return clone(backupStore);
    }

    const emptyStore = createEmptyStore();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(emptyStore));

    return clone(emptyStore);
  }

  /**
   * Belirli bir günün kaydını döndürür.
   */
  function getDay(dateKey) {
    const store = loadStore();

    return store.days[dateKey] ? clone(store.days[dateKey]) : null;
  }

  /**
   * Belirli bir günün verisini ekler veya günceller.
   */
  function saveDay(dateKey, dayData) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      throw new Error(
        "Today Storage: Tarih YYYY-MM-DD formatında olmalıdır."
      );
    }

    const store = loadStore();
    const existingDay = store.days[dateKey] || {};
    const now = new Date().toISOString();

    store.days[dateKey] = {
      ...existingDay,
      ...clone(dayData),
      createdAt: existingDay.createdAt || now,
      updatedAt: now
    };

    saveStore(store);

    return clone(store.days[dateKey]);
  }

  /**
   * Yalnızca belirtilen günün kaydını siler.
   */
  function deleteDay(dateKey) {
    const store = loadStore();

    if (!store.days[dateKey]) {
      return false;
    }

    delete store.days[dateKey];
    saveStore(store);

    return true;
  }

  /**
   * Kayıtlı bütün günleri tarihe göre sıralı döndürür.
   */
  function getAllDays() {
    const store = loadStore();

    return Object.entries(store.days)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, value]) => ({
        date,
        ...clone(value)
      }));
  }

  /**
   * Uygulama ayarlarını günceller.
   */
  function updateSettings(partialSettings) {
    const store = loadStore();

    store.settings = {
      ...(store.settings || {}),
      ...clone(partialSettings)
    };

    saveStore(store);

    return clone(store.settings);
  }

  /**
   * Yedek veriyi ana veriye geri yükler.
   */
  function restoreBackup() {
    const backupStore = safeParse(localStorage.getItem(BACKUP_KEY));

    if (!isValidStore(backupStore)) {
      return {
        success: false,
        message: "Geçerli bir yedek bulunamadı."
      };
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(backupStore));

    return {
      success: true,
      message: "Yedek başarıyla geri yüklendi.",
      store: clone(backupStore)
    };
  }

  /**
   * Storage Manager'ın durumunu kontrol etmek için kullanılır.
   */
  function getStatus() {
    const store = loadStore();

    return {
      storageKey: STORAGE_KEY,
      backupKey: BACKUP_KEY,
      schemaVersion: store.schemaVersion,
      appVersion: store.appVersion,
      savedDayCount: Object.keys(store.days || {}).length,
      backupAvailable: Boolean(localStorage.getItem(BACKUP_KEY))
    };
  }

  /**
   * Bu API, index.html ve diğer modüller tarafından kullanılacak.
   */
  window.TodayStorage = Object.freeze({
    STORAGE_KEY,
    BACKUP_KEY,
    SCHEMA_VERSION,
    APP_VERSION,

    createEmptyStore,
    loadStore,
    saveStore,
    getDay,
    saveDay,
    deleteDay,
    getAllDays,
    updateSettings,
    createBackup,
    restoreBackup,
    getStatus
  });

  console.info("Today Storage Manager hazır:", {
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION
  });
})();