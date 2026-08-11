/**
 * Today App — Sky House Core
 * NUT-016.3 — Natal Harita Özeti
 *
 * Amaç:
 * - ASC, MC ve Placidus ev başlangıçlarını cihaz içinde hesaplamak
 * - Yüksek enlemde hesap yapılamadığında sessizce başka ev sistemine geçmemek
 * - Hesabı değiştirilebilir bir adaptörün arkasında tutmak
 *
 * Placidus ara ev iterasyonu, MIT lisanslı free-human-design projesindeki
 * matematiksel uygulamadan uyarlanmıştır. İlgili bildirim vendor klasöründedir.
 */
(function () {
  "use strict";

  const API_VERSION = 1;
  const ENGINE_VERSION = "1.0.0";
  const ENGINE_ID = "today-sky-house-core";
  const RULESET_ID =
    "today:sky:house-core:nut-016.3";
  const HOUSE_SYSTEM = "placidus";
  const PLACIDUS_LATITUDE_LIMIT = 66.5;
  const MAX_ITERATIONS = 100;
  const ITERATION_EPSILON = 1e-10;

  function createError(
    code,
    message,
    details = null
  ) {
    const error = new Error(message);
    error.name = "TodaySkyHouseCoreError";
    error.todayCode = code;
    error.details = details;
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

  function toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  function toDegrees(radians) {
    return radians * (180 / Math.PI);
  }

  function sinDegrees(value) {
    return Math.sin(toRadians(value));
  }

  function cosDegrees(value) {
    return Math.cos(toRadians(value));
  }

  function tanDegrees(value) {
    return Math.tan(toRadians(value));
  }

  function normalizeDegrees(value) {
    return ((value % 360) + 360) % 360;
  }

  function isFiniteCoordinate(
    value,
    minimum,
    maximum
  ) {
    return (
      Number.isFinite(value) &&
      value >= minimum &&
      value <= maximum
    );
  }

  function getAstronomy() {
    const astronomy = window.Astronomy;
    const required = [
      "MakeTime",
      "SiderealTime",
      "e_tilt"
    ];
    const missing = required.filter(
      methodName =>
        !astronomy ||
        typeof astronomy[methodName] !==
          "function"
    );

    if (missing.length > 0) {
      throw createError(
        "TODAY-SKY-HOUSE-001",
        "Gökyüzü hesap motoru hazır değil.",
        { missing }
      );
    }

    return astronomy;
  }

  function calculateMidheaven(
    armc,
    obliquity
  ) {
    const tangent = tanDegrees(armc);
    const cosine = cosDegrees(obliquity);
    let longitude = toDegrees(
      Math.atan(tangent / cosine)
    );

    if (longitude < 0) longitude += 360;
    if (longitude > armc) longitude -= 180;
    if (longitude < 0) longitude += 180;
    if (longitude < 180 && armc >= 180) {
      longitude += 180;
    }

    return normalizeDegrees(longitude);
  }

  function calculateAscendant(
    armc,
    latitude,
    obliquity
  ) {
    const numerator = -cosDegrees(armc);
    const denominator =
      sinDegrees(obliquity) *
        tanDegrees(latitude) +
      cosDegrees(obliquity) *
        sinDegrees(armc);
    const quotient = numerator / denominator;
    let longitude = toDegrees(
      Math.atan(quotient)
    );

    longitude += denominator < 0 ? 180 : 360;
    longitude =
      longitude >= 180
        ? longitude - 180
        : longitude + 180;

    return normalizeDegrees(longitude);
  }

  function eclipticLongitudeFromRa(
    rightAscension,
    obliquity
  ) {
    const ra = toRadians(rightAscension);
    const epsilon = toRadians(obliquity);

    return normalizeDegrees(
      toDegrees(
        Math.atan2(
          Math.sin(ra),
          Math.cos(ra) * Math.cos(epsilon)
        )
      )
    );
  }

  function declinationOfEclipticPoint(
    longitude,
    obliquity
  ) {
    return toDegrees(
      Math.asin(
        sinDegrees(obliquity) *
          sinDegrees(longitude)
      )
    );
  }

  function placidusTargetRa(
    armc,
    semidiurnalArc,
    houseNumber
  ) {
    const nocturnalArc =
      180 - semidiurnalArc;

    if (houseNumber === 11) {
      return armc + semidiurnalArc / 3;
    }

    if (houseNumber === 12) {
      return armc +
        (2 * semidiurnalArc) / 3;
    }

    if (houseNumber === 2) {
      return armc +
        semidiurnalArc + nocturnalArc / 3;
    }

    if (houseNumber === 3) {
      return armc +
        semidiurnalArc +
        (2 * nocturnalArc) / 3;
    }

    return null;
  }

  function calculateIntermediateCusp(
    armc,
    latitude,
    obliquity,
    houseNumber
  ) {
    const initialOffsets = {
      2: 120,
      3: 150,
      11: 30,
      12: 60
    };
    let rightAscension =
      armc + initialOffsets[houseNumber];

    for (
      let iteration = 0;
      iteration < MAX_ITERATIONS;
      iteration += 1
    ) {
      const longitude =
        eclipticLongitudeFromRa(
          rightAscension,
          obliquity
        );
      const declination =
        declinationOfEclipticPoint(
          longitude,
          obliquity
        );
      const cosineSemidiurnalArc =
        -tanDegrees(latitude) *
        tanDegrees(declination);

      if (
        cosineSemidiurnalArc <= -1 ||
        cosineSemidiurnalArc >= 1
      ) {
        return null;
      }

      const semidiurnalArc = toDegrees(
        Math.acos(cosineSemidiurnalArc)
      );
      const nextRightAscension =
        placidusTargetRa(
          armc,
          semidiurnalArc,
          houseNumber
        );
      const difference = Math.abs(
        normalizeDegrees(
          nextRightAscension -
            rightAscension +
            180
        ) - 180
      );

      if (!Number.isFinite(nextRightAscension)) {
        return null;
      }

      rightAscension = nextRightAscension;

      if (difference <= ITERATION_EPSILON) {
        return eclipticLongitudeFromRa(
          rightAscension,
          obliquity
        );
      }
    }

    return null;
  }

  function calculatePlacidusCusps(
    armc,
    ascendant,
    midheaven,
    latitude,
    obliquity
  ) {
    const intermediate = {};

    for (const houseNumber of [2, 3, 11, 12]) {
      intermediate[houseNumber] =
        calculateIntermediateCusp(
          armc,
          latitude,
          obliquity,
          houseNumber
        );

      if (
        !Number.isFinite(
          intermediate[houseNumber]
        )
      ) {
        return null;
      }
    }

    const cusps = [
      normalizeDegrees(ascendant),
      intermediate[2],
      intermediate[3],
      normalizeDegrees(midheaven + 180),
      normalizeDegrees(intermediate[11] + 180),
      normalizeDegrees(intermediate[12] + 180),
      normalizeDegrees(ascendant + 180),
      normalizeDegrees(intermediate[2] + 180),
      normalizeDegrees(intermediate[3] + 180),
      normalizeDegrees(midheaven),
      intermediate[11],
      intermediate[12]
    ];

    return cusps.every(Number.isFinite)
      ? cusps
      : null;
  }

  function calculate({
    date,
    latitude,
    longitude
  } = {}) {
    const instant =
      date instanceof Date
        ? new Date(date.getTime())
        : new Date(date);
    const numericLatitude = Number(latitude);
    const numericLongitude = Number(longitude);

    if (Number.isNaN(instant.getTime())) {
      throw createError(
        "TODAY-SKY-HOUSE-002",
        "Ev hesabı için geçerli bir zaman gerekli."
      );
    }

    if (
      !isFiniteCoordinate(
        numericLatitude,
        -90,
        90
      ) ||
      !isFiniteCoordinate(
        numericLongitude,
        -180,
        180
      )
    ) {
      throw createError(
        "TODAY-SKY-HOUSE-003",
        "Ev hesabı için geçerli koordinatlar gerekli."
      );
    }

    if (
      Math.abs(numericLatitude) >=
      PLACIDUS_LATITUDE_LIMIT
    ) {
      return freezeClone({
        status: "unavailable",
        reason: "placidus_high_latitude",
        houseSystem: HOUSE_SYSTEM,
        latitude: numericLatitude,
        longitude: numericLongitude,
        ascendant: null,
        midheaven: null,
        armc: null,
        obliquity: null,
        cusps: []
      });
    }

    const astronomy = getAstronomy();
    const astroTime = astronomy.MakeTime(instant);
    const armc = normalizeDegrees(
      astronomy.SiderealTime(instant) * 15 +
        numericLongitude
    );
    const obliquity =
      astronomy.e_tilt(astroTime).tobl;
    const ascendant = calculateAscendant(
      armc,
      numericLatitude,
      obliquity
    );
    const midheaven = calculateMidheaven(
      armc,
      obliquity
    );
    const cusps = calculatePlacidusCusps(
      armc,
      ascendant,
      midheaven,
      numericLatitude,
      obliquity
    );

    if (!cusps) {
      return freezeClone({
        status: "unavailable",
        reason: "placidus_convergence_failed",
        houseSystem: HOUSE_SYSTEM,
        latitude: numericLatitude,
        longitude: numericLongitude,
        ascendant: null,
        midheaven: null,
        armc,
        obliquity,
        cusps: []
      });
    }

    return freezeClone({
      status: "ready",
      reason: null,
      houseSystem: HOUSE_SYSTEM,
      latitude: numericLatitude,
      longitude: numericLongitude,
      ascendant,
      midheaven,
      armc,
      obliquity,
      cusps
    });
  }

  function circularDistance(start, end) {
    return normalizeDegrees(end - start);
  }

  function findHouse(longitude, cusps) {
    if (
      !Number.isFinite(longitude) ||
      !Array.isArray(cusps) ||
      cusps.length !== 12
    ) {
      return null;
    }

    const normalized = normalizeDegrees(longitude);

    for (let index = 0; index < 12; index += 1) {
      const start = cusps[index];
      const end = cusps[(index + 1) % 12];
      const span = circularDistance(start, end);
      const position = circularDistance(
        start,
        normalized
      );

      if (
        position < span ||
        (index === 11 && position === span)
      ) {
        return index + 1;
      }
    }

    return null;
  }

  function getMetadata() {
    return freezeClone({
      engineId: ENGINE_ID,
      engineVersion: ENGINE_VERSION,
      houseSystem: HOUSE_SYSTEM,
      latitudeLimit:
        PLACIDUS_LATITUDE_LIMIT
    });
  }

  window.TodaySkyHouseCore = Object.freeze({
    API_VERSION,
    ENGINE_ID,
    ENGINE_VERSION,
    RULESET_ID,
    HOUSE_SYSTEM,
    PLACIDUS_LATITUDE_LIMIT,
    normalizeDegrees,
    calculateMidheaven,
    calculateAscendant,
    calculatePlacidusCusps,
    calculate,
    findHouse,
    getMetadata
  });
})();
