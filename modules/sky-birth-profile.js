/**
 * Today App — Sky Birth Profile
 * NUT-016.3 — Natal Harita Özeti
 *
 * Amaç:
 * - Doğum tarihi, saat doğruluğu ve doğum yerini doğrulamak
 * - Profili yalnız TodayStorage sınırı üzerinden cihaz içinde saklamak
 * - Yanlış kesinlik üretmeden bilinmeyen doğum saatini desteklemek
 * - Kullanıcının seçtiği çevrimdışı şehir eşleşmesini koordinat ve saat dilimiyle saklamak
 * - Belirsiz tarihsel yerel saatlerde kullanıcının açık seçimini korumak
 */
(function () {
  "use strict";

  const API_VERSION = 2;
  const CONTRACT_VERSION = 1;
  const RULESET_ID =
    "today:sky:birth-profile:nut-016.3";
  const PLACE_MAX_LENGTH = 120;
  const TIME_PRECISIONS = deepFreeze([
    "exact",
    "approximate",
    "unknown"
  ]);
  const TIME_DISAMBIGUATIONS = deepFreeze([
    "earlier",
    "later"
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

  function inspectPlaceResolution(
    profileOrPlace
  ) {
    const place = profileOrPlace?.birthPlace ||
      profileOrPlace;
    const hasAnyResolutionValue = Boolean(
      place &&
      [
        place.latitude,
        place.longitude,
        place.timezoneId,
        place.geonameId
      ].some(
        value =>
          value !== null &&
          value !== undefined &&
          value !== ""
      )
    );
    const valid = Boolean(
      place &&
      Number.isInteger(place.geonameId) &&
      Number.isFinite(place.latitude) &&
      place.latitude >= -90 &&
      place.latitude <= 90 &&
      Number.isFinite(place.longitude) &&
      place.longitude >= -180 &&
      place.longitude <= 180 &&
      typeof place.timezoneId === "string" &&
      place.timezoneId.length > 0 &&
      place.source === "geonames" &&
      typeof place.catalogVersion === "string" &&
      place.catalogVersion.length > 0
    );

    return freezeClone({
      status: valid
        ? "resolved"
        : hasAnyResolutionValue
          ? "invalid"
          : "unresolved",
      valid,
      reason: valid
        ? null
        : hasAnyResolutionValue
          ? "place_resolution_invalid"
          : "place_not_resolved"
    });
  }

  function validatePlaceCandidate(candidate) {
    const label = normalizeWhitespace(
      candidate?.label || candidate?.name
    );
    const value = {
      geonameId: Number(candidate?.geonameId),
      label,
      name: normalizeWhitespace(candidate?.name),
      countryCode: normalizeWhitespace(
        candidate?.countryCode
      ).toUpperCase(),
      admin1Code:
        normalizeWhitespace(
          candidate?.admin1Code
        ) || null,
      latitude: Number(candidate?.latitude),
      longitude: Number(candidate?.longitude),
      population:
        Number(candidate?.population) || 0,
      timezoneId: normalizeWhitespace(
        candidate?.timezoneId
      ),
      catalogVersion: normalizeWhitespace(
        candidate?.catalogVersion
      )
    };
    const errors = {};

    if (
      !Number.isInteger(value.geonameId) ||
      value.geonameId <= 0
    ) {
      errors.geonameId =
        "Şehir kaydı doğrulanamadı.";
    }

    if (!value.label || !value.name) {
      errors.label =
        "Şehir adı doğrulanamadı.";
    }

    if (!/^[A-Z]{2}$/.test(value.countryCode)) {
      errors.countryCode =
        "Ülke kodu doğrulanamadı.";
    }

    if (
      !Number.isFinite(value.latitude) ||
      value.latitude < -90 ||
      value.latitude > 90
    ) {
      errors.latitude =
        "Enlem doğrulanamadı.";
    }

    if (
      !Number.isFinite(value.longitude) ||
      value.longitude < -180 ||
      value.longitude > 180
    ) {
      errors.longitude =
        "Boylam doğrulanamadı.";
    }

    if (!value.timezoneId) {
      errors.timezoneId =
        "Saat dilimi doğrulanamadı.";
    }

    if (!value.catalogVersion) {
      errors.catalogVersion =
        "Şehir veri sürümü doğrulanamadı.";
    }

    return freezeClone({
      valid: Object.keys(errors).length === 0,
      value,
      errors
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
        geonameId: null,
        name: null,
        countryCode: null,
        admin1Code: null,
        latitude: null,
        longitude: null,
        population: null,
        timezoneId: null,
        catalogVersion: null,
        resolvedAt: null
      },
      timeDisambiguation: null,
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

  function resolveBirthPlace(
    candidate,
    options = {}
  ) {
    assertUserAction(options);

    const validation = validatePlaceCandidate(
      candidate
    );

    if (!validation.valid) {
      throw createError(
        "TODAY-SKY-BIRTH-005",
        "Doğum yeri eşleşmesi doğrulanamadı.",
        { errors: validation.errors }
      );
    }

    const storage = getStorage();
    const store = storage.loadStore();
    const storedProfile = store.sky?.birthProfile;

    if (!inspectStoredProfile(storedProfile).valid) {
      throw createError(
        "TODAY-SKY-BIRTH-006",
        "Şehir eşleşmesi için önce doğum bilgilerini kaydet."
      );
    }

    const now = normalizeTimestamp(options.at);
    const value = validation.value;
    const profile = {
      ...clone(storedProfile),
      birthPlace: {
        label: value.label,
        source: "geonames",
        geonameId: value.geonameId,
        name: value.name,
        countryCode: value.countryCode,
        admin1Code: value.admin1Code,
        latitude: value.latitude,
        longitude: value.longitude,
        population: value.population,
        timezoneId: value.timezoneId,
        catalogVersion: value.catalogVersion,
        resolvedAt: now
      },
      timeDisambiguation: null,
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

  function setTimeDisambiguation(
    choice,
    options = {}
  ) {
    assertUserAction(options);

    if (!TIME_DISAMBIGUATIONS.includes(choice)) {
      throw createError(
        "TODAY-SKY-BIRTH-007",
        "Yerel saat karşılığını seç."
      );
    }

    const storage = getStorage();
    const store = storage.loadStore();
    const storedProfile = store.sky?.birthProfile;

    if (
      !inspectStoredProfile(storedProfile).valid ||
      !inspectPlaceResolution(storedProfile).valid ||
      storedProfile.timePrecision === "unknown"
    ) {
      throw createError(
        "TODAY-SKY-BIRTH-008",
        "Saat karşılığı bu doğum profili için kaydedilemez."
      );
    }

    const now = normalizeTimestamp(options.at);
    const profile = {
      ...clone(storedProfile),
      timeDisambiguation: choice,
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
    const placeResolution = profile
      ? inspectPlaceResolution(profile)
      : null;

    return freezeClone({
      status: profile ? "ready" : "missing",
      placeStatus:
        placeResolution?.status || "missing",
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
    TIME_DISAMBIGUATIONS,
    getTodayDateKey,
    normalizeDraft,
    validateDraft,
    inspectStoredProfile,
    inspectPlaceResolution,
    validatePlaceCandidate,
    profileToDraft,
    getProfile,
    saveProfile,
    resolveBirthPlace,
    setTimeDisambiguation,
    deleteProfile,
    getStatus
  });
})();
