/**
 * Today App — Sky Birth Profile
 * NUT-016.2 — Doğum Bilgileri
 *
 * Amaç:
 * - Doğum tarihi, saat doğruluğu ve doğum yerini doğrulamak
 * - Profili yalnız TodayStorage sınırı üzerinden cihaz içinde saklamak
 * - Yanlış kesinlik üretmeden bilinmeyen doğum saatini desteklemek
 * - Harita hesabı, konum izni, ağ çağrısı ve astrolojik yorum eklememek
 */
(function () {
  "use strict";

  const API_VERSION = 1;
  const CONTRACT_VERSION = 1;
  const RULESET_ID =
    "today:sky:birth-profile:nut-016.2";
  const PLACE_MAX_LENGTH = 120;
  const TIME_PRECISIONS = deepFreeze([
    "exact",
    "approximate",
    "unknown"
  ]);

  function createError(
    code,
    message,
    details = null,
    cause = null
  ) {
    const error = new Error(message);
    error.name = "TodaySkyBirthProfileError";
    error.todayCode = code;
    error.details = details;

    if (cause) error.cause = cause;
    return error;
  }

  function clone(value) {
    if (
      value === null ||
      value === undefined ||
      typeof value !== "object"
    ) {
      return value;
    }

    if (typeof window.structuredClone === "function") {
      return window.structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
  }

  function deepFreeze(value) {
    if (
      value === null ||
      typeof value !== "object" ||
      Object.isFrozen(value)
    ) {
      return value;
    }

    Object.keys(value).forEach(key => {
      deepFreeze(value[key]);
    });

    return Object.freeze(value);
  }

  function freezeClone(value) {
    return deepFreeze(clone(value));
  }

  function isPlainObject(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    );
  }

  function getStorage() {
    const storage = window.TodayStorage;
    const requiredMethods = [
      "loadStore",
      "saveStore"
    ];
    const missing = requiredMethods.filter(
      methodName =>
        !storage ||
        typeof storage[methodName] !== "function"
    );

    if (missing.length > 0) {
      throw createError(
        "TODAY-SKY-BIRTH-001",
        "Doğum bilgileri depolama alanı hazır değil.",
        { missing }
      );
    }

    return storage;
  }

  function normalizeWhitespace(value) {
    return typeof value === "string"
      ? value.trim().replace(/\s+/g, " ")
      : "";
  }

  function getTodayDateKey(now = new Date()) {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1)
      .padStart(2, "0");
    const day = String(now.getDate())
      .padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function isCalendarDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const [year, month, day] = value
      .split("-")
      .map(Number);
    const date = new Date(
      Date.UTC(year, month - 1, day)
    );

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }

  function isClockTime(value) {
    if (!/^\d{2}:\d{2}$/.test(value)) {
      return false;
    }

    const [hour, minute] = value
      .split(":")
      .map(Number);

    return (
      hour >= 0 &&
      hour <= 23 &&
      minute >= 0 &&
      minute <= 59
    );
  }

  function normalizeDraft(draft = {}) {
    const timePrecision =
      TIME_PRECISIONS.includes(
        draft.timePrecision
      )
        ? draft.timePrecision
        : "exact";

    return {
      birthDate: normalizeWhitespace(
        draft.birthDate
      ),
      birthTime:
        timePrecision === "unknown"
          ? null
          : normalizeWhitespace(
              draft.birthTime
            ),
      timePrecision,
      birthPlace: normalizeWhitespace(
        draft.birthPlace
      )
    };
  }

  function validateDraft(draft, options = {}) {
    const value = normalizeDraft(draft);
    const errors = {};
    const today =
      options.today || getTodayDateKey();

    if (!value.birthDate) {
      errors.birthDate =
        "Doğum tarihini seç.";
    } else if (!isCalendarDate(value.birthDate)) {
      errors.birthDate =
        "Geçerli bir doğum tarihi gir.";
    } else if (value.birthDate > today) {
      errors.birthDate =
        "Doğum tarihi gelecekte olamaz.";
    }

    if (!TIME_PRECISIONS.includes(
      value.timePrecision
    )) {
      errors.timePrecision =
        "Saat bilgisinin doğruluğunu seç.";
    }

    if (
      value.timePrecision !== "unknown" &&
      !value.birthTime
    ) {
      errors.birthTime =
        "Doğum saatini gir veya bilinmiyor seç.";
    } else if (
      value.timePrecision !== "unknown" &&
      !isClockTime(value.birthTime)
    ) {
      errors.birthTime =
        "Geçerli bir doğum saati gir.";
    }

    if (!value.birthPlace) {
      errors.birthPlace =
        "Doğum yerini gir.";
    } else if (
      value.birthPlace.length > PLACE_MAX_LENGTH
    ) {
      errors.birthPlace =
        `Doğum yeri en fazla ${PLACE_MAX_LENGTH} karakter olabilir.`;
    }

    return freezeClone({
      valid: Object.keys(errors).length === 0,
      value,
      errors
    });
  }

  function normalizeTimestamp(
    candidate,
    fallback = new Date().toISOString()
  ) {
    const parsed = Date.parse(candidate || "");

    return Number.isNaN(parsed)
      ? fallback
      : new Date(parsed).toISOString();
  }

  function profileToDraft(profile) {
    if (!profile) {
      return freezeClone({
        birthDate: "",
        birthTime: "",
        timePrecision: "exact",
        birthPlace: ""
      });
    }

    return freezeClone({
      birthDate: profile.birthDate || "",
      birthTime: profile.birthTime || "",
      timePrecision:
        TIME_PRECISIONS.includes(
          profile.timePrecision
        )
          ? profile.timePrecision
          : "exact",
      birthPlace:
        profile.birthPlace?.label || ""
    });
  }

  function inspectStoredProfile(profile) {
    if (
      !isPlainObject(profile) ||
      profile.contractVersion !==
        CONTRACT_VERSION ||
      !isPlainObject(profile.birthPlace)
    ) {
      return freezeClone({
        valid: false,
        reason: "profile_shape_invalid"
      });
    }

    const validation = validateDraft({
      birthDate: profile.birthDate,
      birthTime: profile.birthTime,
      timePrecision: profile.timePrecision,
      birthPlace: profile.birthPlace.label
    });

    return freezeClone({
      valid: validation.valid,
      reason: validation.valid
        ? null
        : "profile_values_invalid",
      errors: validation.errors
    });
  }

  function getProfile() {
    const store = getStorage().loadStore();
    const profile = store.sky?.birthProfile;

    if (!inspectStoredProfile(profile).valid) {
      return null;
    }

    return freezeClone(profile);
  }

  function assertUserAction(options) {
    if (options?.userInitiated !== true) {
      throw createError(
        "TODAY-SKY-BIRTH-003",
        "Doğum bilgisi değişikliği açık kullanıcı işlemi gerektirir."
      );
    }
  }

  function dispatchProfileChange(
    status,
    updatedAt
  ) {
    window.dispatchEvent(
      new window.CustomEvent(
        "today:sky-profile-change",
        {
          detail: Object.freeze({
            status,
            updatedAt
          })
        }
      )
    );
  }

  function saveProfile(draft, options = {}) {
    assertUserAction(options);

    const validation = validateDraft(draft, {
      today: options.today
    });

    if (!validation.valid) {
      throw createError(
        "TODAY-SKY-BIRTH-002",
        "Doğum bilgileri doğrulanamadı.",
        { errors: validation.errors }
      );
    }

    const storage = getStorage();
    const store = storage.loadStore();
    const storedProfile = store.sky?.birthProfile;
    const existing = inspectStoredProfile(
      storedProfile
    ).valid
      ? storedProfile
      : null;
    const now = normalizeTimestamp(options.at);
    const value = validation.value;
    const profile = {
      contractVersion: CONTRACT_VERSION,
      birthDate: value.birthDate,
      birthTime: value.birthTime,
      timePrecision: value.timePrecision,
      birthPlace: {
        label: value.birthPlace,
        source: "manual",
        latitude: null,
        longitude: null,
        timezoneId: null
      },
      createdAt:
        existing?.createdAt || now,
      updatedAt: now
    };

    store.sky = {
      ...(isPlainObject(store.sky)
        ? store.sky
        : {}),
      profileContractVersion:
        CONTRACT_VERSION,
      birthProfile: profile,
      updatedAt: now
    };

    storage.saveStore(store);
    dispatchProfileChange("ready", now);

    return freezeClone(profile);
  }

  function deleteProfile(options = {}) {
    assertUserAction(options);

    if (options.userConfirmed !== true) {
      throw createError(
        "TODAY-SKY-BIRTH-004",
        "Doğum bilgilerini silmek için açık onay gereklidir."
      );
    }

    const storage = getStorage();
    const store = storage.loadStore();

    if (!store.sky?.birthProfile) {
      return false;
    }

    const now = normalizeTimestamp(options.at);
    store.sky = {
      ...(isPlainObject(store.sky)
        ? store.sky
        : {}),
      profileContractVersion:
        CONTRACT_VERSION,
      birthProfile: null,
      updatedAt: now
    };

    storage.saveStore(store);
    dispatchProfileChange("missing", now);

    return true;
  }

  function getStatus() {
    const profile = getProfile();

    return freezeClone({
      status: profile ? "ready" : "missing",
      contractVersion: CONTRACT_VERSION,
      updatedAt: profile?.updatedAt || null
    });
  }

  window.TodaySkyBirthProfile = Object.freeze({
    API_VERSION,
    CONTRACT_VERSION,
    RULESET_ID,
    PLACE_MAX_LENGTH,
    TIME_PRECISIONS,
    getTodayDateKey,
    normalizeDraft,
    validateDraft,
    inspectStoredProfile,
    profileToDraft,
    getProfile,
    saveProfile,
    deleteProfile,
    getStatus
  });
})();
