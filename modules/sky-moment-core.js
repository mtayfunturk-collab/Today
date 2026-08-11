/**
 * Today App — Sky Moment Core
 * NUT-016.4 — Bugünün Gökyüzü
 *
 * Seçili takip konumu ve kesin UTC anından deterministik canlı gökyüzü
 * verisi üretir. Yorum veya nedensellik iddiası üretmez.
 */
(function () {
  "use strict";

  const API_VERSION = 1;
  const CONTRACT_VERSION = 1;
  const RULESET_ID = "today:sky:moment-core:nut-016.4";
  const DIAL_CONTRACT_VERSION = 1;
  const PRIMARY_BODY_IDS = Object.freeze([
    "sun",
    "moon",
    "mercury",
    "venus",
    "mars"
  ]);

  function clone(value) {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) {
      return value;
    }
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  function freezeClone(value) {
    return deepFreeze(clone(value));
  }

  function getDependencies() {
    const momentApi = window.moment;
    const calculation = window.TodaySkyCalculationCore;
    const houses = window.TodaySkyHouseCore;
    if (
      typeof momentApi?.tz !== "function" ||
      typeof calculation?.calculatePlanetPlacements !== "function" ||
      typeof calculation?.calculateAspects !== "function" ||
      typeof calculation?.describeLongitude !== "function" ||
      typeof houses?.calculate !== "function"
    ) {
      throw new Error("Sky hesaplama çekirdeği henüz hazır değil.");
    }
    return { momentApi, calculation, houses };
  }

  function inspectPlace(place) {
    const latitude = Number(place?.latitude);
    const longitude = Number(place?.longitude);
    return freezeClone({
      valid: Boolean(
        place &&
        typeof place.label === "string" &&
        Number.isFinite(latitude) &&
        latitude >= -90 && latitude <= 90 &&
        Number.isFinite(longitude) &&
        longitude >= -180 && longitude <= 180 &&
        typeof place.timezoneId === "string" &&
        place.timezoneId
      ),
      latitude,
      longitude
    });
  }

  function formatDegree(value) {
    const degrees = Math.floor(value);
    const minutes = Math.round((value - degrees) * 60);
    if (minutes === 60) return `${degrees + 1}° 00′`;
    return `${degrees}° ${String(minutes).padStart(2, "0")}′`;
  }

  function angularSeparation(left, right) {
    const raw = Math.abs(((left - right) % 360 + 360) % 360);
    return raw > 180 ? 360 - raw : raw;
  }

  function calculateTransitAspects(
    currentPlanets,
    natalPlanets,
    aspectDefinitions
  ) {
    const matches = [];
    currentPlanets.forEach(current => {
      natalPlanets.forEach(natal => {
        if (
          !Number.isFinite(current?.longitude) ||
          !Number.isFinite(natal?.longitude)
        ) {
          return;
        }
        const separation = angularSeparation(
          current.longitude,
          natal.longitude
        );
        aspectDefinitions.forEach(definition => {
          const orb = Math.abs(separation - definition.angle);
          if (orb > definition.orb) return;
          matches.push({
            id: `${current.id}:${definition.id}:natal-${natal.id}`,
            type: definition.id,
            label: definition.label,
            exactAngle: definition.angle,
            separation,
            orb,
            orbLimit: definition.orb,
            current: {
              id: current.id,
              label: current.label,
              symbol: current.symbol
            },
            natal: {
              id: natal.id,
              label: natal.label,
              symbol: natal.symbol
            }
          });
        });
      });
    });
    return matches
      .sort((left, right) =>
        left.orb - right.orb ||
        left.id.localeCompare(right.id)
      )
      .slice(0, 5);
  }

  function calculate(place, options = {}) {
    const placeState = inspectPlace(place);
    if (!placeState.valid) {
      return freezeClone({
        status: "missing_place",
        contractVersion: CONTRACT_VERSION,
        planets: [],
        primaryPlacements: [],
        houses: null,
        aspects: []
      });
    }

    const date = options.at ? new Date(options.at) : new Date();
    if (Number.isNaN(date.getTime())) {
      return freezeClone({
        status: "invalid_time",
        contractVersion: CONTRACT_VERSION,
        planets: [],
        primaryPlacements: [],
        houses: null,
        aspects: []
      });
    }

    const { momentApi, calculation, houses } = getDependencies();
    const zoned = momentApi(date).tz(place.timezoneId);
    if (!zoned.isValid()) {
      return freezeClone({
        status: "timezone_unavailable",
        contractVersion: CONTRACT_VERSION,
        planets: [],
        primaryPlacements: [],
        houses: null,
        aspects: []
      });
    }

    const houseResult = houses.calculate({
      date,
      latitude: placeState.latitude,
      longitude: placeState.longitude
    });
    const planets = calculation.calculatePlanetPlacements(
      date,
      houseResult
    );
    const ascendant = houseResult.status === "ready"
      ? calculation.describeLongitude(houseResult.ascendant)
      : null;
    const midheaven = houseResult.status === "ready"
      ? calculation.describeLongitude(houseResult.midheaven)
      : null;
    const primaryPlacements = planets.filter(planet =>
      PRIMARY_BODY_IDS.includes(planet.id)
    );
    const natalResult = options.natalProfile
      ? calculation.calculate(options.natalProfile)
      : null;
    const natalStatus = !options.natalProfile
      ? "missing_profile"
      : natalResult?.status === "ready"
        ? "ready"
        : "unavailable";
    const natalTransits = natalStatus === "ready"
      ? calculateTransitAspects(
          planets,
          natalResult.planets,
          calculation.ASPECT_DEFINITIONS
        )
      : [];

    return freezeClone({
      status: "ready",
      contractVersion: CONTRACT_VERSION,
      instant: date.toISOString(),
      location: {
        label: place.label,
        latitude: placeState.latitude,
        longitude: placeState.longitude,
        timezoneId: place.timezoneId
      },
      clock: {
        time: zoned.format("HH:mm:ss"),
        minuteKey: zoned.format("YYYY-MM-DDTHH:mm"),
        date: zoned.format("DD.MM.YYYY"),
        dateLabel: zoned.locale("tr").format("D MMMM YYYY, dddd"),
        utcOffset: zoned.format("Z"),
        timezoneId: place.timezoneId
      },
      planets,
      primaryPlacements,
      angles: { ascendant, midheaven },
      houses: houseResult,
      aspects: calculation.calculateAspects(planets),
      natal: {
        status: natalStatus,
        transits: natalTransits
      },
      dial: {
        contractVersion: DIAL_CONTRACT_VERSION,
        clockMode: "local-digital",
        zodiacOrientation: "aries-zero-clockwise",
        primaryBodyIds: PRIMARY_BODY_IDS,
        markers: [
          ...(ascendant
            ? [{ id: "ascendant", label: "Yükselen", symbol: "ASC", ...ascendant }]
            : []),
          ...primaryPlacements
        ]
      },
      metadata: {
        engineId: calculation.ENGINE_ID,
        engineVersion: calculation.ENGINE_VERSION,
        houseSystem: houses.HOUSE_SYSTEM,
        zodiac: calculation.ZODIAC,
        rulesetId: RULESET_ID
      }
    });
  }

  window.TodaySkyMomentCore = Object.freeze({
    API_VERSION,
    CONTRACT_VERSION,
    RULESET_ID,
    DIAL_CONTRACT_VERSION,
    PRIMARY_BODY_IDS,
    inspectPlace,
    formatDegree,
    calculateTransitAspects,
    calculate
  });
})();
