/**
 * Today App — Sky Observation Context
 * NUT-016.4 — Bugünün Gökyüzü
 *
 * Canlı gökyüzünün hangi kullanıcı-onaylı şehir için hesaplanacağını,
 * yalnız TodayStorage sınırı üzerinden cihaz içinde saklar.
 */
(function () {
  "use strict";

  const API_VERSION = 1;
  const CONTRACT_VERSION = 1;
  const RULESET_ID =
    "today:sky:observation-context:nut-016.4";

  function clone(value) {
    if (value === null || value === undefined) return value;
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function freezeClone(value) {
    const copy = clone(value);
    const freeze = current => {
      if (
        !current ||
        typeof current !== "object" ||
        Object.isFrozen(current)
      ) {
        return current;
      }
      Object.values(current).forEach(freeze);
      return Object.freeze(current);
    };
    return freeze(copy);
  }

  function getStorage() {
    const storage = window.TodayStorage;
    if (
      !storage ||
      typeof storage.loadStore !== "function" ||
      typeof storage.saveStore !== "function"
    ) {
      throw new Error("Today Storage henüz hazır değil.");
    }
    return storage;
  }

  function normalizeTimestamp(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) {
      throw new Error("Geçersiz kayıt zamanı.");
    }
    return date.toISOString();
  }

  function validatePlace(place) {
    const latitude = Number(place?.latitude);
    const longitude = Number(place?.longitude);
    const valid = Boolean(
      place &&
      Number.isInteger(Number(place.geonameId)) &&
      typeof place.label === "string" &&
      place.label.trim() &&
      Number.isFinite(latitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      Number.isFinite(longitude) &&
      longitude >= -180 &&
      longitude <= 180 &&
      typeof place.timezoneId === "string" &&
      place.timezoneId.includes("/") &&
      typeof place.catalogVersion === "string" &&
      place.catalogVersion
    );

    return freezeClone({
      valid,
      value: valid
        ? {
            label: place.label.trim(),
            source: "geonames",
            geonameId: Number(place.geonameId),
            name: String(place.name || place.label).trim(),
            countryCode: String(place.countryCode || "").trim(),
            admin1Code: String(place.admin1Code || "").trim(),
            latitude,
            longitude,
            population: Number(place.population) || 0,
            timezoneId: place.timezoneId,
            catalogVersion: place.catalogVersion
          }
        : null
    });
  }

  function inspectStoredContext(context) {
    const placeValidation = validatePlace(context?.place);
    return freezeClone({
      valid: Boolean(
        context &&
        context.contractVersion === CONTRACT_VERSION &&
        placeValidation.valid
      ),
      placeValid: placeValidation.valid
    });
  }

  function getContext() {
    const context =
      getStorage().loadStore().sky?.observationContext;
    return inspectStoredContext(context).valid
      ? freezeClone(context)
      : null;
  }

  function dispatchChange(status, at) {
    window.dispatchEvent(
      new window.CustomEvent(
        "today:sky-observation-change",
        {
          detail: Object.freeze({ status, at })
        }
      )
    );
  }

  function assertUserAction(options) {
    if (options.userInitiated !== true) {
      throw new Error("Takip konumu yalnız açık kullanıcı işlemiyle değiştirilebilir.");
    }
  }

  function savePlace(place, options = {}) {
    assertUserAction(options);
    const validation = validatePlace(place);
    if (!validation.valid) {
      throw new Error("Geçerli bir takip konumu seç.");
    }

    const storage = getStorage();
    const store = storage.loadStore();
    const now = normalizeTimestamp(options.at);
    const context = {
      contractVersion: CONTRACT_VERSION,
      place: validation.value,
      selectedBy: options.selectedBy === "birth_place"
        ? "birth_place"
        : "city_search",
      createdAt:
        store.sky?.observationContext?.createdAt || now,
      updatedAt: now
    };

    store.sky = {
      ...(store.sky && typeof store.sky === "object"
        ? store.sky
        : {}),
      observationContextContractVersion:
        CONTRACT_VERSION,
      observationContext: context,
      updatedAt: now
    };
    storage.saveStore(store);
    dispatchChange("ready", now);
    return freezeClone(context);
  }

  function useBirthPlace(profile, options = {}) {
    const place = profile?.birthPlace;
    return savePlace(place, {
      ...options,
      selectedBy: "birth_place"
    });
  }

  function clear(options = {}) {
    assertUserAction(options);
    const storage = getStorage();
    const store = storage.loadStore();
    if (!store.sky?.observationContext) return false;
    const now = normalizeTimestamp(options.at);
    store.sky = {
      ...store.sky,
      observationContextContractVersion:
        CONTRACT_VERSION,
      observationContext: null,
      updatedAt: now
    };
    storage.saveStore(store);
    dispatchChange("missing", now);
    return true;
  }

  function getStatus() {
    const context = getContext();
    return freezeClone({
      status: context ? "ready" : "missing",
      contractVersion: CONTRACT_VERSION,
      updatedAt: context?.updatedAt || null
    });
  }

  window.TodaySkyObservationContext = Object.freeze({
    API_VERSION,
    CONTRACT_VERSION,
    RULESET_ID,
    validatePlace,
    inspectStoredContext,
    getContext,
    savePlace,
    useBirthPlace,
    clear,
    getStatus
  });
})();
