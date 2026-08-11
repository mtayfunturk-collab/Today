/**
 * Today App — Sky Calculation Core
 * NUT-016.3 — Natal Harita Özeti
 *
 * Amaç:
 * - Güneş–Plüton konumlarını cihaz içinde ve deterministik biçimde hesaplamak
 * - Yerel doğum saatini tarihsel IANA saat dilimiyle UTC'ye çevirmek
 * - ASC, MC, Placidus evler ve temel açıları tek veri sözleşmesinde üretmek
 * - Bilinmeyen veya problemli saatlerde yanlış kesinlik göstermemek
 */
(function () {
  "use strict";

  const API_VERSION = 1;
  const CONTRACT_VERSION = 1;
  const ENGINE_ID = "today-sky-calculation-core";
  const ENGINE_VERSION = "1.0.0";
  const RULESET_ID =
    "today:sky:calculation-core:nut-016.3";
  const ASTRONOMY_ENGINE_VERSION = "2.1.19";
  const MOMENT_VERSION = "2.30.1";
  const MOMENT_TIMEZONE_VERSION = "0.6.3";
  const ZODIAC = "tropical";
  const HOUSE_SYSTEM = "placidus";

  const ZODIAC_SIGNS = deepFreeze([
    { id: "aries", label: "Koç", symbol: "♈" },
    { id: "taurus", label: "Boğa", symbol: "♉" },
    { id: "gemini", label: "İkizler", symbol: "♊" },
    { id: "cancer", label: "Yengeç", symbol: "♋" },
    { id: "leo", label: "Aslan", symbol: "♌" },
    { id: "virgo", label: "Başak", symbol: "♍" },
    { id: "libra", label: "Terazi", symbol: "♎" },
    { id: "scorpio", label: "Akrep", symbol: "♏" },
    { id: "sagittarius", label: "Yay", symbol: "♐" },
    { id: "capricorn", label: "Oğlak", symbol: "♑" },
    { id: "aquarius", label: "Kova", symbol: "♒" },
    { id: "pisces", label: "Balık", symbol: "♓" }
  ]);

  const BODY_DEFINITIONS = deepFreeze([
    { id: "sun", label: "Güneş", symbol: "☉", astronomyBody: "Sun" },
    { id: "moon", label: "Ay", symbol: "☽", astronomyBody: "Moon" },
    { id: "mercury", label: "Merkür", symbol: "☿", astronomyBody: "Mercury" },
    { id: "venus", label: "Venüs", symbol: "♀", astronomyBody: "Venus" },
    { id: "mars", label: "Mars", symbol: "♂", astronomyBody: "Mars" },
    { id: "jupiter", label: "Jüpiter", symbol: "♃", astronomyBody: "Jupiter" },
    { id: "saturn", label: "Satürn", symbol: "♄", astronomyBody: "Saturn" },
    { id: "uranus", label: "Uranüs", symbol: "♅", astronomyBody: "Uranus" },
    { id: "neptune", label: "Neptün", symbol: "♆", astronomyBody: "Neptune" },
    { id: "pluto", label: "Plüton", symbol: "♇", astronomyBody: "Pluto" }
  ]);

  const ASPECT_DEFINITIONS = deepFreeze([
    { id: "conjunction", label: "Kavuşum", angle: 0, orb: 8 },
    { id: "sextile", label: "Sekstil", angle: 60, orb: 4 },
    { id: "square", label: "Kare", angle: 90, orb: 6 },
    { id: "trine", label: "Üçgen", angle: 120, orb: 6 },
    { id: "opposition", label: "Karşıtlık", angle: 180, orb: 8 }
  ]);

  function createError(
    code,
    message,
    details = null,
    cause = null
  ) {
    const error = new Error(message);
    error.name = "TodaySkyCalculationCoreError";
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

  function normalizeDegrees(value) {
    return ((value % 360) + 360) % 360;
  }

  function parseDateParts(dateValue) {
    const match = String(dateValue || "").match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

    if (!match) return null;

    const value = {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3])
    };
    const check = new Date(
      Date.UTC(
        value.year,
        value.month - 1,
        value.day
      )
    );

    return (
      check.getUTCFullYear() === value.year &&
      check.getUTCMonth() === value.month - 1 &&
      check.getUTCDate() === value.day
    )
      ? value
      : null;
  }

  function parseTimeParts(timeValue) {
    const match = String(timeValue || "").match(
      /^(\d{2}):(\d{2})$/
    );

    if (!match) return null;

    const value = {
      hour: Number(match[1]),
      minute: Number(match[2])
    };

    return (
      value.hour >= 0 &&
      value.hour <= 23 &&
      value.minute >= 0 &&
      value.minute <= 59
    )
      ? value
      : null;
  }

  function getMoment() {
    const moment = window.moment;

    if (
      !moment ||
      !moment.tz ||
      typeof moment.tz.zone !== "function"
    ) {
      throw createError(
        "TODAY-SKY-CALC-001",
        "Tarihsel saat dilimi verisi hazır değil."
      );
    }

    return moment;
  }

  function getAstronomy() {
    const astronomy = window.Astronomy;
    const required = [
      "GeoVector",
      "Ecliptic"
    ];
    const missing = required.filter(
      methodName =>
        !astronomy ||
        typeof astronomy[methodName] !==
          "function"
    );

    if (!astronomy?.Body) missing.push("Body");

    if (missing.length > 0) {
      throw createError(
        "TODAY-SKY-CALC-002",
        "Gezegen hesap motoru hazır değil.",
        { missing }
      );
    }

    return astronomy;
  }

  function getHouseCore() {
    const houseCore = window.TodaySkyHouseCore;
    const required = [
      "calculate",
      "findHouse",
      "getMetadata"
    ];
    const missing = required.filter(
      methodName =>
        !houseCore ||
        typeof houseCore[methodName] !==
          "function"
    );

    if (missing.length > 0) {
      throw createError(
        "TODAY-SKY-CALC-003",
        "Ev hesap çekirdeği hazır değil.",
        { missing }
      );
    }

    return houseCore;
  }

  function formatOffsetMinutes(offsetMinutes) {
    const sign = offsetMinutes >= 0 ? "+" : "−";
    const absolute = Math.abs(offsetMinutes);
    const hours = String(
      Math.floor(absolute / 60)
    ).padStart(2, "0");
    const minutes = String(
      absolute % 60
    ).padStart(2, "0");

    return `UTC${sign}${hours}:${minutes}`;
  }

  function localPartsMatch(
    zonedMoment,
    dateParts,
    timeParts
  ) {
    return (
      zonedMoment.year() === dateParts.year &&
      zonedMoment.month() + 1 ===
        dateParts.month &&
      zonedMoment.date() === dateParts.day &&
      zonedMoment.hour() === timeParts.hour &&
      zonedMoment.minute() === timeParts.minute
    );
  }

  function resolveLocalDateTime(
    birthDate,
    birthTime,
    timezoneId
  ) {
    const dateParts = parseDateParts(birthDate);
    const timeParts = parseTimeParts(birthTime);
    const moment = getMoment();
    const zone = moment.tz.zone(timezoneId);

    if (!dateParts || !timeParts) {
      return freezeClone({
        status: "invalid_input",
        candidates: []
      });
    }

    if (!zone) {
      return freezeClone({
        status: "timezone_unavailable",
        candidates: []
      });
    }

    const localTimestamp = Date.UTC(
      dateParts.year,
      dateParts.month - 1,
      dateParts.day,
      timeParts.hour,
      timeParts.minute
    );
    const offsets = [
      ...new Set(zone.offsets)
    ];
    const timestamps = new Set();

    offsets.forEach(zoneOffsetMinutes => {
      const candidateTimestamp =
        localTimestamp +
        zoneOffsetMinutes * 60 * 1000;
      const zoned = moment.tz(
        candidateTimestamp,
        timezoneId
      );

      if (
        localPartsMatch(
          zoned,
          dateParts,
          timeParts
        )
      ) {
        timestamps.add(candidateTimestamp);
      }
    });

    const candidates = [...timestamps]
      .sort((left, right) => left - right)
      .map((timestamp, index, all) => {
        const zoned = moment.tz(
          timestamp,
          timezoneId
        );
        const utcOffsetMinutes =
          zoned.utcOffset();
        const key =
          all.length === 1
            ? "only"
            : index === 0
              ? "earlier"
              : "later";

        return {
          key,
          utc: new Date(timestamp).toISOString(),
          timestamp,
          utcOffsetMinutes,
          offsetLabel: formatOffsetMinutes(
            utcOffsetMinutes
          )
        };
      });

    return freezeClone({
      status:
        candidates.length === 0
          ? "nonexistent"
          : candidates.length > 1
            ? "ambiguous"
            : "unique",
      timezoneId,
      candidates
    });
  }

  function addCalendarDays(dateParts, days) {
    const date = new Date(
      Date.UTC(
        dateParts.year,
        dateParts.month - 1,
        dateParts.day + days
      )
    );

    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate()
    };
  }

  function datePartsToKey(dateParts) {
    return [
      String(dateParts.year).padStart(4, "0"),
      String(dateParts.month).padStart(2, "0"),
      String(dateParts.day).padStart(2, "0")
    ].join("-");
  }

  function findFirstValidLocalMinute(
    dateParts,
    timezoneId
  ) {
    for (
      let minuteOfDay = 0;
      minuteOfDay < 24 * 60;
      minuteOfDay += 1
    ) {
      const hour = Math.floor(
        minuteOfDay / 60
      );
      const minute = minuteOfDay % 60;
      const resolution = resolveLocalDateTime(
        datePartsToKey(dateParts),
        `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
        timezoneId
      );

      if (resolution.candidates.length > 0) {
        return resolution.candidates[0];
      }
    }

    return null;
  }

  function resolveLocalDayBounds(
    birthDate,
    timezoneId
  ) {
    const dateParts = parseDateParts(birthDate);

    if (!dateParts) return null;

    const start = findFirstValidLocalMinute(
      dateParts,
      timezoneId
    );
    const nextDay = findFirstValidLocalMinute(
      addCalendarDays(dateParts, 1),
      timezoneId
    );

    if (!start || !nextDay) return null;

    return freezeClone({
      startUtc: start.utc,
      endUtcExclusive: nextDay.utc,
      startTimestamp: start.timestamp,
      endTimestampExclusive: nextDay.timestamp
    });
  }

  function inspectResolvedPlace(profile) {
    const place = profile?.birthPlace;
    const valid = Boolean(
      place &&
      Number.isFinite(place.latitude) &&
      Number.isFinite(place.longitude) &&
      typeof place.timezoneId === "string" &&
      place.timezoneId.length > 0 &&
      place.latitude >= -90 &&
      place.latitude <= 90 &&
      place.longitude >= -180 &&
      place.longitude <= 180
    );

    return freezeClone({
      valid,
      reason: valid
        ? null
        : "birth_place_unresolved"
    });
  }

  function describeLongitude(longitude) {
    const normalized = normalizeDegrees(longitude);
    const signIndex = Math.floor(
      normalized / 30
    );
    const sign = ZODIAC_SIGNS[signIndex];

    return freezeClone({
      longitude: normalized,
      signIndex,
      signId: sign.id,
      sign: sign.label,
      signSymbol: sign.symbol,
      degreeInSign:
        normalized - signIndex * 30
    });
  }

  function calculateBodyLongitude(
    definition,
    date
  ) {
    const astronomy = getAstronomy();
    const body = astronomy.Body[
      definition.astronomyBody
    ];

    if (!body) {
      throw createError(
        "TODAY-SKY-CALC-004",
        "Gezegen tanımı bulunamadı.",
        { body: definition.id }
      );
    }

    const vector = astronomy.GeoVector(
      body,
      date,
      true
    );

    return normalizeDegrees(
      astronomy.Ecliptic(vector).elon
    );
  }

  function calculatePlanetPlacements(
    date,
    houses = null
  ) {
    const houseCore = getHouseCore();

    return BODY_DEFINITIONS.map(definition => {
      const longitude = calculateBodyLongitude(
        definition,
        date
      );
      const position = describeLongitude(longitude);

      return freezeClone({
        id: definition.id,
        label: definition.label,
        symbol: definition.symbol,
        ...position,
        house:
          houses?.status === "ready"
            ? houseCore.findHouse(
                longitude,
                houses.cusps
              )
            : null
      });
    });
  }

  function angularSeparation(left, right) {
    const difference = Math.abs(
      normalizeDegrees(left - right)
    );

    return difference > 180
      ? 360 - difference
      : difference;
  }

  function calculateAspects(planets) {
    const aspects = [];

    for (
      let leftIndex = 0;
      leftIndex < planets.length - 1;
      leftIndex += 1
    ) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < planets.length;
        rightIndex += 1
      ) {
        const left = planets[leftIndex];
        const right = planets[rightIndex];
        const separation = angularSeparation(
          left.longitude,
          right.longitude
        );

        ASPECT_DEFINITIONS.forEach(definition => {
          const orb = Math.abs(
            separation - definition.angle
          );

          if (orb <= definition.orb) {
            aspects.push({
              id: `${left.id}:${definition.id}:${right.id}`,
              type: definition.id,
              label: definition.label,
              exactAngle: definition.angle,
              separation,
              orb,
              orbLimit: definition.orb,
              left: {
                id: left.id,
                label: left.label,
                symbol: left.symbol
              },
              right: {
                id: right.id,
                label: right.label,
                symbol: right.symbol
              }
            });
          }
        });
      }
    }

    aspects.sort((left, right) =>
      left.orb - right.orb ||
      right.orbLimit - left.orbLimit ||
      left.id.localeCompare(right.id)
    );

    return aspects.slice(0, 5).map(freezeClone);
  }

  function calculateDailyRanges(
    bounds
  ) {
    const startDate = new Date(
      bounds.startTimestamp
    );
    const endDate = new Date(
      bounds.endTimestampExclusive - 1
    );

    return BODY_DEFINITIONS.map(definition => {
      const start = describeLongitude(
        calculateBodyLongitude(
          definition,
          startDate
        )
      );
      const end = describeLongitude(
        calculateBodyLongitude(
          definition,
          endDate
        )
      );

      return freezeClone({
        id: definition.id,
        label: definition.label,
        symbol: definition.symbol,
        kind: "daily_range",
        start,
        end,
        crossesSign:
          start.signIndex !== end.signIndex,
        house: null
      });
    });
  }

  function getMetadata(profile = null) {
    let timezoneDataVersion = null;

    try {
      timezoneDataVersion =
        getMoment().tz.dataVersion || null;
    } catch (error) {
      timezoneDataVersion = null;
    }

    return freezeClone({
      engineId: ENGINE_ID,
      engineVersion: ENGINE_VERSION,
      astronomyEngine: {
        id: "astronomy-engine",
        version: ASTRONOMY_ENGINE_VERSION,
        license: "MIT"
      },
      houseEngine: getHouseCore().getMetadata(),
      timezoneEngine: {
        id: "moment-timezone",
        version: MOMENT_TIMEZONE_VERSION,
        momentVersion: MOMENT_VERSION,
        dataVersion: timezoneDataVersion,
        license: "MIT"
      },
      placeDataVersion:
        profile?.birthPlace?.catalogVersion ||
        null,
      zodiac: ZODIAC,
      houseSystem: HOUSE_SYSTEM
    });
  }

  function buildLocation(profile) {
    const place = profile.birthPlace;

    return freezeClone({
      label: place.label,
      geonameId: place.geonameId || null,
      countryCode: place.countryCode || null,
      latitude: place.latitude,
      longitude: place.longitude,
      timezoneId: place.timezoneId,
      source: place.source,
      catalogVersion: place.catalogVersion || null
    });
  }

  function calculateUnknownTime(profile) {
    const bounds = resolveLocalDayBounds(
      profile.birthDate,
      profile.birthPlace.timezoneId
    );

    if (!bounds) {
      return freezeClone({
        status: "invalid_local_day",
        contractVersion: CONTRACT_VERSION,
        timePrecision: "unknown",
        planets: [],
        houses: null,
        aspects: [],
        metadata: getMetadata(profile)
      });
    }

    return freezeClone({
      status: "ready_date_range",
      contractVersion: CONTRACT_VERSION,
      birthDate: profile.birthDate,
      birthTime: null,
      timePrecision: "unknown",
      utc: null,
      localDayBounds: bounds,
      location: buildLocation(profile),
      zodiac: ZODIAC,
      planets: calculateDailyRanges(bounds),
      angles: {
        ascendant: null,
        midheaven: null
      },
      houses: {
        status: "unavailable",
        reason: "birth_time_unknown",
        houseSystem: HOUSE_SYSTEM,
        cusps: []
      },
      aspects: [],
      metadata: getMetadata(profile)
    });
  }

  function calculateTimedProfile(
    profile,
    options = {}
  ) {
    const resolution = resolveLocalDateTime(
      profile.birthDate,
      profile.birthTime,
      profile.birthPlace.timezoneId
    );

    if (
      [
        "invalid_input",
        "timezone_unavailable",
        "nonexistent"
      ].includes(resolution.status)
    ) {
      return freezeClone({
        status:
          resolution.status === "nonexistent"
            ? "nonexistent_local_time"
            : resolution.status,
        contractVersion: CONTRACT_VERSION,
        resolution,
        planets: [],
        houses: null,
        aspects: [],
        metadata: getMetadata(profile)
      });
    }

    const savedChoice =
      profile.timeDisambiguation || null;
    const requestedChoice =
      options.ambiguityChoice || savedChoice;

    if (
      resolution.status === "ambiguous" &&
      !["earlier", "later"].includes(
        requestedChoice
      )
    ) {
      return freezeClone({
        status: "ambiguous_local_time",
        contractVersion: CONTRACT_VERSION,
        resolution,
        planets: [],
        houses: null,
        aspects: [],
        metadata: getMetadata(profile)
      });
    }

    const selected =
      resolution.status === "ambiguous"
        ? resolution.candidates.find(
            candidate =>
              candidate.key === requestedChoice
          )
        : resolution.candidates[0];

    if (!selected) {
      return freezeClone({
        status: "ambiguous_local_time",
        contractVersion: CONTRACT_VERSION,
        resolution,
        planets: [],
        houses: null,
        aspects: [],
        metadata: getMetadata(profile)
      });
    }

    const date = new Date(selected.timestamp);
    const houseCore = getHouseCore();
    const houses = houseCore.calculate({
      date,
      latitude: profile.birthPlace.latitude,
      longitude: profile.birthPlace.longitude
    });
    const planets = calculatePlanetPlacements(
      date,
      houses
    );
    const ascendant =
      houses.status === "ready"
        ? describeLongitude(houses.ascendant)
        : null;
    const midheaven =
      houses.status === "ready"
        ? describeLongitude(houses.midheaven)
        : null;
    const cuspSummaries =
      houses.status === "ready"
        ? houses.cusps.map(
            (longitude, index) => ({
              house: index + 1,
              ...describeLongitude(longitude)
            })
          )
        : [];

    return freezeClone({
      status: "ready",
      contractVersion: CONTRACT_VERSION,
      birthDate: profile.birthDate,
      birthTime: profile.birthTime,
      timePrecision: profile.timePrecision,
      timeDisambiguation:
        resolution.status === "ambiguous"
          ? selected.key
          : null,
      utc: selected.utc,
      utcOffsetMinutes:
        selected.utcOffsetMinutes,
      location: buildLocation(profile),
      zodiac: ZODIAC,
      planets,
      angles: {
        ascendant,
        midheaven
      },
      houses: {
        ...houses,
        cusps: cuspSummaries
      },
      aspects: calculateAspects(planets),
      metadata: getMetadata(profile)
    });
  }

  function calculate(profile, options = {}) {
    if (!profile || typeof profile !== "object") {
      return freezeClone({
        status: "missing_profile",
        contractVersion: CONTRACT_VERSION,
        planets: [],
        houses: null,
        aspects: [],
        metadata: getMetadata()
      });
    }

    if (!inspectResolvedPlace(profile).valid) {
      return freezeClone({
        status: "unresolved_place",
        contractVersion: CONTRACT_VERSION,
        planets: [],
        houses: null,
        aspects: [],
        metadata: getMetadata(profile)
      });
    }

    return profile.timePrecision === "unknown"
      ? calculateUnknownTime(profile)
      : calculateTimedProfile(profile, options);
  }

  window.TodaySkyCalculationCore = Object.freeze({
    API_VERSION,
    CONTRACT_VERSION,
    ENGINE_ID,
    ENGINE_VERSION,
    RULESET_ID,
    ASTRONOMY_ENGINE_VERSION,
    MOMENT_TIMEZONE_VERSION,
    ZODIAC,
    HOUSE_SYSTEM,
    ZODIAC_SIGNS,
    BODY_DEFINITIONS,
    ASPECT_DEFINITIONS,
    normalizeDegrees,
    describeLongitude,
    formatOffsetMinutes,
    resolveLocalDateTime,
    resolveLocalDayBounds,
    inspectResolvedPlace,
    calculatePlanetPlacements,
    calculateAspects,
    calculate,
    getMetadata
  });
})();
