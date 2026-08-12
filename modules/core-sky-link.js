/**
 * Today App — Core–Sky Link
 * NUT-016.6 — Core kaydı ile deterministik Sky anlık görüntüsü
 *
 * Bağlantı yalnız açık kullanıcı işlemiyle kurulur. Astrolojik yorum,
 * duygu çıkarımı, nedensellik iddiası veya AI işlemi üretmez.
 */
(function () {
  "use strict";

  const API_VERSION = 1;
  const CONTRACT_VERSION = 1;
  const RULESET_ID =
    "today:core-sky-link:nut-016.6";
  const STORAGE_FIELD = "coreSkyLink";
  const PRIMARY_BODY_IDS = Object.freeze([
    "sun",
    "moon",
    "mercury",
    "venus",
    "mars"
  ]);

  function clone(value) {
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function deepFreeze(value) {
    if (
      !value ||
      typeof value !== "object" ||
      Object.isFrozen(value)
    ) {
      return value;
    }
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  function freezeClone(value) {
    return deepFreeze(clone(value));
  }

  function getDependencies() {
    const storage = window.TodayStorage;
    const day = window.TodayDay;
    const observation =
      window.TodaySkyObservationContext;
    const momentCore = window.TodaySkyMomentCore;

    const ready = Boolean(
      storage &&
      typeof storage.loadStore === "function" &&
      typeof storage.saveStore === "function" &&
      day &&
      typeof day.todayKey === "function" &&
      typeof day.isValidDateKey === "function" &&
      observation &&
      typeof observation.getContext === "function" &&
      momentCore &&
      typeof momentCore.calculate === "function"
    );

    if (!ready) {
      throw new Error(
        "Core–Sky bağlantı bağımlılıkları henüz hazır değil."
      );
    }

    return {
      storage,
      day,
      observation,
      momentCore
    };
  }

  function normalizeTimestamp(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) {
      throw new Error("Geçersiz Core–Sky bağlantı zamanı.");
    }
    return date.toISOString();
  }

  function normalizeDateKey(dateKey) {
    const { day } = getDependencies();
    const key = dateKey || day.todayKey();
    if (!day.isValidDateKey(key)) {
      throw new Error("Geçersiz Core tarih anahtarı.");
    }
    return key;
  }

  function assertToday(dateKey) {
    const { day } = getDependencies();
    if (dateKey !== day.todayKey()) {
      throw new Error(
        "Core–Sky bağlantısı yalnız bugünün kaydında değiştirilebilir."
      );
    }
  }

  function assertUserAction(options) {
    if (options?.userInitiated !== true) {
      throw new Error(
        "Core–Sky bağlantısı yalnız açık kullanıcı işlemiyle değiştirilebilir."
      );
    }
  }

  function hasCoreRecord(dayRecord) {
    return Boolean(
      dayRecord &&
      typeof dayRecord === "object" &&
      (
        String(dayRecord.choice || "").trim() ||
        String(dayRecord.color || "").trim() ||
        String(dayRecord.note || "").trim()
      )
    );
  }

  function sanitizePlacement(placement) {
    if (
      !placement ||
      typeof placement.id !== "string" ||
      !Number.isFinite(Number(placement.longitude))
    ) {
      return null;
    }

    return {
      id: placement.id,
      label: String(placement.label || ""),
      symbol: String(placement.symbol || ""),
      longitude: Number(placement.longitude),
      signIndex: Number(placement.signIndex),
      signId: String(placement.signId || ""),
      sign: String(placement.sign || ""),
      signSymbol: String(placement.signSymbol || ""),
      degreeInSign: Number(placement.degreeInSign),
      house:
        Number.isInteger(Number(placement.house))
          ? Number(placement.house)
          : null
    };
  }

  function sanitizeAngle(angle) {
    if (
      !angle ||
      !Number.isFinite(Number(angle.longitude))
    ) {
      return null;
    }

    return {
      longitude: Number(angle.longitude),
      signIndex: Number(angle.signIndex),
      signId: String(angle.signId || ""),
      sign: String(angle.sign || ""),
      signSymbol: String(angle.signSymbol || ""),
      degreeInSign: Number(angle.degreeInSign)
    };
  }

  function sanitizeAspect(aspect) {
    if (
      !aspect ||
      typeof aspect.type !== "string" ||
      !Number.isFinite(Number(aspect.orb))
    ) {
      return null;
    }

    return {
      id: String(aspect.id || ""),
      type: aspect.type,
      label: String(aspect.label || ""),
      exactAngle: Number(aspect.exactAngle),
      separation: Number(aspect.separation),
      orb: Number(aspect.orb),
      orbLimit: Number(aspect.orbLimit),
      left: clone(aspect.left || null),
      right: clone(aspect.right || null)
    };
  }

  function createSnapshot(
    dateKey,
    context,
    calculation,
    linkedAt
  ) {
    const planets = calculation.planets
      .map(sanitizePlacement)
      .filter(Boolean);
    const aspects = calculation.aspects
      .map(sanitizeAspect)
      .filter(Boolean);
    const place = context.place;

    return freezeClone({
      contractVersion: CONTRACT_VERSION,
      dateKey,
      linkedAt,
      linkMode: "user_initiated_snapshot",
      place: {
        source: "geonames",
        geonameId: Number(place.geonameId),
        label: place.label,
        latitude: Number(place.latitude),
        longitude: Number(place.longitude),
        timezoneId: place.timezoneId,
        catalogVersion: place.catalogVersion
      },
      sky: {
        instant: calculation.instant,
        clock: {
          localDateKey:
            calculation.clock.minuteKey.slice(0, 10),
          localTime: calculation.clock.time,
          utcOffset: calculation.clock.utcOffset,
          timezoneId: calculation.clock.timezoneId
        },
        angles: {
          ascendant: sanitizeAngle(
            calculation.angles.ascendant
          ),
          midheaven: sanitizeAngle(
            calculation.angles.midheaven
          )
        },
        planets,
        primaryBodyIds: [...PRIMARY_BODY_IDS],
        aspects
      },
      metadata: {
        rulesetId: RULESET_ID,
        sourceRulesetId:
          calculation.metadata.rulesetId,
        engineId: calculation.metadata.engineId,
        engineVersion:
          calculation.metadata.engineVersion,
        houseSystem:
          calculation.metadata.houseSystem,
        zodiac: calculation.metadata.zodiac,
        interpretation: "none",
        causalityClaim: false,
        aiProcessed: false
      }
    });
  }

  function inspectLink(value, expectedDateKey = null) {
    const planetIds = Array.isArray(
      value?.sky?.planets
    )
      ? value.sky.planets.map(planet => planet?.id)
      : [];
    const valid = Boolean(
      value &&
      value.contractVersion === CONTRACT_VERSION &&
      typeof value.dateKey === "string" &&
      (!expectedDateKey || value.dateKey === expectedDateKey) &&
      !Number.isNaN(Date.parse(value.linkedAt)) &&
      !Number.isNaN(Date.parse(value.sky?.instant)) &&
      typeof value.place?.label === "string" &&
      typeof value.place?.timezoneId === "string" &&
      Array.isArray(value.sky?.planets) &&
      value.sky.planets.length === 10 &&
      PRIMARY_BODY_IDS.every(id => planetIds.includes(id)) &&
      value.metadata?.interpretation === "none" &&
      value.metadata?.causalityClaim === false &&
      value.metadata?.aiProcessed === false
    );

    return freezeClone({
      valid,
      contractVersion:
        Number(value?.contractVersion) || null,
      planetCount:
        Array.isArray(value?.sky?.planets)
          ? value.sky.planets.length
          : 0
    });
  }

  function getLink(dateKey) {
    const key = normalizeDateKey(dateKey);
    const { storage } = getDependencies();
    const value = storage.loadStore().days?.[key]?.[
      STORAGE_FIELD
    ];

    return inspectLink(value, key).valid
      ? freezeClone(value)
      : null;
  }

  function getStatus(dateKey) {
    const key = normalizeDateKey(dateKey);
    const {
      storage,
      observation
    } = getDependencies();
    const store = storage.loadStore();
    const dayRecord = store.days?.[key] || null;
    const storedLink = dayRecord?.[STORAGE_FIELD];
    const linkInspection = inspectLink(storedLink, key);
    const coreRecordReady = hasCoreRecord(dayRecord);
    const observationContext = observation.getContext();
    const status = linkInspection.valid
      ? "linked"
      : storedLink
        ? "invalid_link"
        : !coreRecordReady
          ? "missing_core_record"
          : !observationContext
            ? "missing_place"
            : "ready_to_link";

    return freezeClone({
      status,
      dateKey: key,
      coreRecordReady,
      placeReady: Boolean(observationContext),
      link: linkInspection.valid
        ? storedLink
        : null
    });
  }

  function dispatchChange(status, dateKey, at, reason) {
    window.dispatchEvent(
      new window.CustomEvent(
        "today:core-sky-link-change",
        {
          detail: Object.freeze({
            status,
            dateKey,
            at,
            reason
          })
        }
      )
    );
  }

  function link(dateKey, options = {}) {
    assertUserAction(options);
    const key = normalizeDateKey(dateKey);
    assertToday(key);
    const {
      storage,
      observation,
      momentCore
    } = getDependencies();
    const store = storage.loadStore();
    const dayRecord = store.days?.[key] || null;

    if (!hasCoreRecord(dayRecord)) {
      return freezeClone({
        success: false,
        status: "missing_core_record",
        dateKey: key
      });
    }

    const context = observation.getContext();
    if (!context) {
      return freezeClone({
        success: false,
        status: "missing_place",
        dateKey: key
      });
    }

    const linkedAt = normalizeTimestamp(options.at);
    const calculation = momentCore.calculate(
      context.place,
      { at: linkedAt }
    );

    if (calculation.status !== "ready") {
      return freezeClone({
        success: false,
        status: "calculation_unavailable",
        reason: calculation.status,
        dateKey: key
      });
    }

    const snapshot = createSnapshot(
      key,
      context,
      calculation,
      linkedAt
    );
    store.days[key] = {
      ...dayRecord,
      [STORAGE_FIELD]: snapshot
    };
    storage.saveStore(store);
    dispatchChange(
      "linked",
      key,
      linkedAt,
      "user_link"
    );

    return freezeClone({
      success: true,
      status: "linked",
      dateKey: key,
      link: snapshot
    });
  }

  function unlink(dateKey, options = {}) {
    assertUserAction(options);
    const key = normalizeDateKey(dateKey);
    assertToday(key);
    const { storage } = getDependencies();
    const store = storage.loadStore();
    const dayRecord = store.days?.[key];

    if (
      !dayRecord ||
      !Object.prototype.hasOwnProperty.call(
        dayRecord,
        STORAGE_FIELD
      )
    ) {
      return freezeClone({
        success: true,
        changed: false,
        status: "unlinked",
        dateKey: key
      });
    }

    const nextDay = { ...dayRecord };
    delete nextDay[STORAGE_FIELD];
    store.days[key] = nextDay;
    storage.saveStore(store);
    const at = normalizeTimestamp(options.at);
    dispatchChange(
      "unlinked",
      key,
      at,
      options.reason === "core_reset"
        ? "core_reset"
        : "user_unlink"
    );

    return freezeClone({
      success: true,
      changed: true,
      status: "unlinked",
      dateKey: key
    });
  }

  function listLinks(options = {}) {
    const { storage } = getDependencies();
    const limit = Math.min(
      31,
      Math.max(1, Number(options.limit) || 7)
    );

    return freezeClone(
      Object.entries(storage.loadStore().days || {})
        .filter(([dateKey, dayRecord]) =>
          inspectLink(
            dayRecord?.[STORAGE_FIELD],
            dateKey
          ).valid
        )
        .sort(([left], [right]) =>
          right.localeCompare(left)
        )
        .slice(0, limit)
        .map(([dateKey, dayRecord]) => ({
          dateKey,
          core: {
            choice: String(dayRecord.choice || ""),
            color: String(dayRecord.color || ""),
            notePresent: Boolean(
              String(dayRecord.note || "").trim()
            )
          },
          link: dayRecord[STORAGE_FIELD]
        }))
    );
  }

  window.TodayCoreSkyLink = Object.freeze({
    API_VERSION,
    CONTRACT_VERSION,
    RULESET_ID,
    STORAGE_FIELD,
    PRIMARY_BODY_IDS,
    hasCoreRecord,
    inspectLink,
    getLink,
    getStatus,
    link,
    unlink,
    listLinks
  });
})();
