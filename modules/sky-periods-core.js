/**
 * Today App — Sky Periods Core
 * NUT-016.5 — Önemli Dönemler
 *
 * Jüpiter–Plüton ile natal kişisel noktalar arasındaki temel açı
 * pencerelerini cihaz içinde hesaplar. Yorum, olay tahmini veya
 * nedensellik iddiası üretmez.
 */
(function () {
  "use strict";

  const API_VERSION = 1;
  const CONTRACT_VERSION = 1;
  const RULESET_ID =
    "today:sky:periods-core:nut-016.5";
  const FORECAST_MONTHS = 12;
  const SEARCH_YEARS = 8;
  const SAMPLE_DAYS = 14;
  const SAMPLE_INTERVAL_MS =
    SAMPLE_DAYS * 24 * 60 * 60 * 1000;
  const EXACT_TOLERANCE_DEGREES = 0.01;
  const TRANSIT_BODY_IDS = Object.freeze([
    "jupiter",
    "saturn",
    "uranus",
    "neptune",
    "pluto"
  ]);
  const NATAL_BODY_IDS = Object.freeze([
    "sun",
    "moon",
    "mercury",
    "venus",
    "mars"
  ]);
  const NATAL_ANGLE_IDS = Object.freeze([
    "ascendant",
    "midheaven"
  ]);

  function clone(value) {
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

  function normalizeDegrees(value) {
    return ((value % 360) + 360) % 360;
  }

  function angularSeparation(left, right) {
    const raw = Math.abs(
      normalizeDegrees(left - right)
    );

    return raw > 180 ? 360 - raw : raw;
  }

  function measureAspect(
    transitLongitude,
    natalLongitude,
    exactAngle
  ) {
    const separation = angularSeparation(
      transitLongitude,
      natalLongitude
    );

    return freezeClone({
      separation,
      orb: Math.abs(separation - exactAngle)
    });
  }

  function getDependencies() {
    const astronomy = window.Astronomy;
    const calculation =
      window.TodaySkyCalculationCore;
    const requiredAstronomy = [
      "GeoVector",
      "Ecliptic"
    ];
    const missingAstronomy =
      requiredAstronomy.filter(
        name =>
          typeof astronomy?.[name] !== "function"
      );

    if (!astronomy?.Body) {
      missingAstronomy.push("Body");
    }

    const calculationReady = Boolean(
      typeof calculation?.calculate === "function" &&
      Array.isArray(calculation?.BODY_DEFINITIONS) &&
      Array.isArray(calculation?.ASPECT_DEFINITIONS)
    );

    if (
      missingAstronomy.length > 0 ||
      !calculationReady
    ) {
      throw new Error(
        "Sky dönem hesaplama çekirdeği henüz hazır değil."
      );
    }

    const bodiesById = new Map(
      calculation.BODY_DEFINITIONS.map(
        definition => [definition.id, definition]
      )
    );

    return {
      astronomy,
      calculation,
      bodiesById
    };
  }

  function calculateBodyLongitude(
    bodyId,
    timestamp,
    dependencies
  ) {
    const definition =
      dependencies.bodiesById.get(bodyId);
    const body = definition
      ? dependencies.astronomy.Body[
          definition.astronomyBody
        ]
      : null;

    if (!definition || !body) {
      throw new Error(
        `Sky dönem gezegeni bulunamadı: ${bodyId}`
      );
    }

    const vector =
      dependencies.astronomy.GeoVector(
        body,
        new Date(timestamp),
        true
      );

    return normalizeDegrees(
      dependencies.astronomy.Ecliptic(vector).elon
    );
  }

  function shiftUtcYear(timestamp, amount) {
    const date = new Date(timestamp);
    const originalMonth = date.getUTCMonth();

    date.setUTCFullYear(
      date.getUTCFullYear() + amount
    );

    if (date.getUTCMonth() !== originalMonth) {
      date.setUTCDate(0);
    }

    return date.getTime();
  }

  function shiftUtcMonth(timestamp, amount) {
    const source = new Date(timestamp);
    const day = source.getUTCDate();
    const shifted = new Date(timestamp);

    shifted.setUTCDate(1);
    shifted.setUTCMonth(
      shifted.getUTCMonth() + amount
    );

    const lastDay = new Date(
      Date.UTC(
        shifted.getUTCFullYear(),
        shifted.getUTCMonth() + 1,
        0
      )
    ).getUTCDate();

    shifted.setUTCDate(Math.min(day, lastDay));
    return shifted.getTime();
  }

  function buildSampleTimes(
    startTimestamp,
    endTimestamp,
    extraTimestamps = []
  ) {
    const timestamps = new Set([
      startTimestamp,
      endTimestamp,
      ...extraTimestamps
    ]);

    for (
      let timestamp = startTimestamp;
      timestamp <= endTimestamp;
      timestamp += SAMPLE_INTERVAL_MS
    ) {
      timestamps.add(timestamp);
    }

    return [...timestamps]
      .filter(
        timestamp =>
          timestamp >= startTimestamp &&
          timestamp <= endTimestamp
      )
      .sort((left, right) => left - right);
  }

  function buildSamples(
    timestamps,
    dependencies
  ) {
    return timestamps.map(timestamp => {
      const longitudes = {};

      TRANSIT_BODY_IDS.forEach(bodyId => {
        longitudes[bodyId] =
          calculateBodyLongitude(
            bodyId,
            timestamp,
            dependencies
          );
      });

      return {
        timestamp,
        longitudes
      };
    });
  }

  function buildNatalTargets(natalResult) {
    const bodies = natalResult.planets
      .filter(planet =>
        NATAL_BODY_IDS.includes(planet.id) &&
        Number.isFinite(planet.longitude)
      )
      .map(planet => ({
        id: planet.id,
        label: planet.label,
        symbol: planet.symbol,
        kind: "planet",
        longitude: planet.longitude
      }));
    const angleDefinitions = [
      {
        id: "ascendant",
        label: "Yükselen",
        symbol: "ASC"
      },
      {
        id: "midheaven",
        label: "MC",
        symbol: "MC"
      }
    ];
    const angles = angleDefinitions
      .filter(definition =>
        NATAL_ANGLE_IDS.includes(definition.id) &&
        Number.isFinite(
          natalResult.angles?.[
            definition.id
          ]?.longitude
        )
      )
      .map(definition => ({
        ...definition,
        kind: "angle",
        longitude:
          natalResult.angles[
            definition.id
          ].longitude
      }));

    return [...bodies, ...angles];
  }

  function findSegments(values, orbLimit) {
    const segments = [];
    let active = null;

    values.forEach((value, index) => {
      const inside = value.orb <= orbLimit;

      if (inside && !active) {
        active = {
          firstInIndex: index,
          lastInIndex: index,
          startBracket:
            index > 0
              ? [index - 1, index]
              : null,
          endBracket: null
        };
      } else if (inside && active) {
        active.lastInIndex = index;
      } else if (!inside && active) {
        active.endBracket = [index - 1, index];
        segments.push(active);
        active = null;
      }
    });

    if (active) segments.push(active);
    return segments;
  }

  function refineBoundary(
    leftTimestamp,
    rightTimestamp,
    isStart,
    measureAt
  ) {
    let left = leftTimestamp;
    let right = rightTimestamp;

    for (let iteration = 0; iteration < 18; iteration += 1) {
      const middle = left + (right - left) / 2;
      const inside = measureAt(middle).inside;

      if (isStart) {
        if (inside) right = middle;
        else left = middle;
      } else if (inside) {
        left = middle;
      } else {
        right = middle;
      }
    }

    return isStart ? right : left;
  }

  function refineMinimum(
    leftTimestamp,
    rightTimestamp,
    measureAt
  ) {
    const ratio =
      (Math.sqrt(5) - 1) / 2;
    let left = leftTimestamp;
    let right = rightTimestamp;
    let innerLeft =
      right - ratio * (right - left);
    let innerRight =
      left + ratio * (right - left);
    let leftValue = measureAt(innerLeft).orb;
    let rightValue = measureAt(innerRight).orb;

    for (let iteration = 0; iteration < 28; iteration += 1) {
      if (leftValue <= rightValue) {
        right = innerRight;
        innerRight = innerLeft;
        rightValue = leftValue;
        innerLeft =
          right - ratio * (right - left);
        leftValue = measureAt(innerLeft).orb;
      } else {
        left = innerLeft;
        innerLeft = innerRight;
        leftValue = rightValue;
        innerRight =
          left + ratio * (right - left);
        rightValue = measureAt(innerRight).orb;
      }
    }

    const timestamp =
      leftValue <= rightValue
        ? innerLeft
        : innerRight;
    const measured = measureAt(timestamp);

    return {
      timestamp,
      orb: measured.orb,
      separation: measured.separation
    };
  }

  function findExactHits(
    segment,
    values,
    measureAt
  ) {
    const candidates = [];

    for (
      let index = segment.firstInIndex;
      index <= segment.lastInIndex;
      index += 1
    ) {
      const current = values[index].orb;
      const previous =
        values[index - 1]?.orb ?? Infinity;
      const next =
        values[index + 1]?.orb ?? Infinity;

      if (current <= previous && current <= next) {
        candidates.push(index);
      }
    }

    if (candidates.length === 0) {
      let minimumIndex = segment.firstInIndex;

      for (
        let index = segment.firstInIndex + 1;
        index <= segment.lastInIndex;
        index += 1
      ) {
        if (
          values[index].orb <
          values[minimumIndex].orb
        ) {
          minimumIndex = index;
        }
      }

      candidates.push(minimumIndex);
    }

    const refined = candidates
      .map(index => {
        const leftIndex = Math.max(0, index - 1);
        const rightIndex = Math.min(
          values.length - 1,
          index + 1
        );

        return refineMinimum(
          values[leftIndex].timestamp,
          values[rightIndex].timestamp,
          measureAt
        );
      })
      .filter(
        hit =>
          hit.orb <= EXACT_TOLERANCE_DEGREES
      )
      .sort(
        (left, right) =>
          left.timestamp - right.timestamp
      );
    const deduplicated = [];

    refined.forEach(hit => {
      const previous = deduplicated.at(-1);
      const threeDays =
        3 * 24 * 60 * 60 * 1000;

      if (
        previous &&
        hit.timestamp - previous.timestamp <
          threeDays
      ) {
        if (hit.orb < previous.orb) {
          deduplicated[deduplicated.length - 1] = hit;
        }
        return;
      }

      deduplicated.push(hit);
    });

    return deduplicated;
  }

  function buildPeriod({
    segment,
    values,
    transit,
    target,
    aspect,
    samples,
    nowTimestamp,
    horizonEndTimestamp,
    dependencies
  }) {
    const measureAt = timestamp => {
      const longitude = calculateBodyLongitude(
        transit.id,
        timestamp,
        dependencies
      );
      const measurement = measureAspect(
        longitude,
        target.longitude,
        aspect.angle
      );

      return {
        ...measurement,
        inside: measurement.orb <= aspect.orb
      };
    };
    const startTimestamp = segment.startBracket
      ? refineBoundary(
          samples[segment.startBracket[0]].timestamp,
          samples[segment.startBracket[1]].timestamp,
          true,
          measureAt
        )
      : null;
    const endTimestamp = segment.endBracket
      ? refineBoundary(
          samples[segment.endBracket[0]].timestamp,
          samples[segment.endBracket[1]].timestamp,
          false,
          measureAt
        )
      : null;
    const ongoing =
      (startTimestamp === null ||
        startTimestamp <= nowTimestamp) &&
      (endTimestamp === null ||
        endTimestamp >= nowTimestamp);
    const upcoming =
      startTimestamp !== null &&
      startTimestamp > nowTimestamp &&
      startTimestamp <= horizonEndTimestamp;

    if (!ongoing && !upcoming) return null;

    const exactHits = findExactHits(
      segment,
      values,
      measureAt
    );
    const current = ongoing
      ? measureAt(nowTimestamp)
      : null;
    const nextExact = exactHits.find(
      hit => hit.timestamp >= nowTimestamp
    );
    const focusTimestamp =
      nextExact?.timestamp ??
      exactHits.at(-1)?.timestamp ??
      startTimestamp ??
      nowTimestamp;
    const periodStartKey = startTimestamp === null
      ? "open"
      : new Date(startTimestamp)
          .toISOString()
          .slice(0, 10);

    return freezeClone({
      id:
        `${transit.id}:${aspect.id}:` +
        `natal-${target.id}:${periodStartKey}`,
      status: ongoing ? "ongoing" : "upcoming",
      transit: {
        id: transit.id,
        label: transit.label,
        symbol: transit.symbol
      },
      natal: {
        id: target.id,
        label: target.label,
        symbol: target.symbol,
        kind: target.kind,
        longitude: target.longitude
      },
      aspect: {
        id: aspect.id,
        label: aspect.label,
        angle: aspect.angle,
        orbLimit: aspect.orb
      },
      start:
        startTimestamp === null
          ? null
          : new Date(startTimestamp).toISOString(),
      exactHits: exactHits.map(hit => ({
        at: new Date(hit.timestamp).toISOString(),
        orb: hit.orb
      })),
      end:
        endTimestamp === null
          ? null
          : new Date(endTimestamp).toISOString(),
      currentOrb: current?.orb ?? null,
      focusAt: new Date(focusTimestamp).toISOString(),
      boundariesComplete:
        startTimestamp !== null &&
        endTimestamp !== null
    });
  }

  function calculate(profile, options = {}) {
    const now = options.at
      ? new Date(options.at)
      : new Date();

    if (Number.isNaN(now.getTime())) {
      return freezeClone({
        status: "invalid_time",
        contractVersion: CONTRACT_VERSION,
        periods: []
      });
    }

    const dependencies = getDependencies();
    const natalResult =
      dependencies.calculation.calculate(profile);

    if (natalResult.status !== "ready") {
      const reason =
        natalResult.status === "missing_profile"
          ? "missing_profile"
          : natalResult.status === "ready_date_range"
            ? "birth_time_unknown"
            : natalResult.status;

      return freezeClone({
        status: "profile_unavailable",
        reason,
        contractVersion: CONTRACT_VERSION,
        periods: [],
        metadata: {
          rulesetId: RULESET_ID
        }
      });
    }

    const nowTimestamp = now.getTime();
    const horizonEndTimestamp = shiftUtcMonth(
      nowTimestamp,
      FORECAST_MONTHS
    );
    const searchStartTimestamp = shiftUtcYear(
      nowTimestamp,
      -SEARCH_YEARS
    );
    const searchEndTimestamp = shiftUtcYear(
      nowTimestamp,
      SEARCH_YEARS
    );
    const sampleTimes = buildSampleTimes(
      searchStartTimestamp,
      searchEndTimestamp,
      [nowTimestamp, horizonEndTimestamp]
    );
    const samples = buildSamples(
      sampleTimes,
      dependencies
    );
    const targets = buildNatalTargets(natalResult);
    const transitDefinitions =
      dependencies.calculation.BODY_DEFINITIONS
        .filter(definition =>
          TRANSIT_BODY_IDS.includes(definition.id)
        );
    const periods = [];

    transitDefinitions.forEach(transit => {
      targets.forEach(target => {
        dependencies.calculation.ASPECT_DEFINITIONS
          .forEach(aspect => {
            const values = samples.map(sample => ({
              timestamp: sample.timestamp,
              ...measureAspect(
                sample.longitudes[transit.id],
                target.longitude,
                aspect.angle
              )
            }));
            const segments = findSegments(
              values,
              aspect.orb
            );

            segments.forEach(segment => {
              const coarseStart =
                segment.startBracket
                  ? samples[
                      segment.startBracket[1]
                    ].timestamp
                  : searchStartTimestamp;
              const coarseEnd =
                segment.endBracket
                  ? samples[
                      segment.endBracket[0]
                    ].timestamp
                  : searchEndTimestamp;

              if (
                coarseEnd < nowTimestamp ||
                coarseStart > horizonEndTimestamp
              ) {
                return;
              }

              const period = buildPeriod({
                segment,
                values,
                transit,
                target,
                aspect,
                samples,
                nowTimestamp,
                horizonEndTimestamp,
                dependencies
              });

              if (period) periods.push(period);
            });
          });
      });
    });

    periods.sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === "ongoing" ? -1 : 1;
      }

      return (
        new Date(left.focusAt).getTime() -
          new Date(right.focusAt).getTime() ||
        left.id.localeCompare(right.id)
      );
    });

    return freezeClone({
      status: "ready",
      contractVersion: CONTRACT_VERSION,
      generatedAt: now.toISOString(),
      precision:
        profile.timePrecision === "approximate"
          ? "approximate"
          : "exact",
      location: {
        label: natalResult.location.label,
        timezoneId:
          natalResult.location.timezoneId
      },
      horizon: {
        months: FORECAST_MONTHS,
        start: now.toISOString(),
        end: new Date(
          horizonEndTimestamp
        ).toISOString()
      },
      scope: {
        transitBodyIds: TRANSIT_BODY_IDS,
        natalTargetIds: targets.map(
          target => target.id
        ),
        aspectIds:
          dependencies.calculation
            .ASPECT_DEFINITIONS.map(
              aspect => aspect.id
            )
      },
      periods,
      metadata: {
        rulesetId: RULESET_ID,
        engineId:
          dependencies.calculation.ENGINE_ID,
        engineVersion:
          dependencies.calculation.ENGINE_VERSION,
        searchYears: SEARCH_YEARS,
        sampleDays: SAMPLE_DAYS,
        exactToleranceDegrees:
          EXACT_TOLERANCE_DEGREES,
        symbolicOnly: true
      }
    });
  }

  window.TodaySkyPeriodsCore = Object.freeze({
    API_VERSION,
    CONTRACT_VERSION,
    RULESET_ID,
    FORECAST_MONTHS,
    SEARCH_YEARS,
    SAMPLE_DAYS,
    EXACT_TOLERANCE_DEGREES,
    TRANSIT_BODY_IDS,
    NATAL_BODY_IDS,
    NATAL_ANGLE_IDS,
    normalizeDegrees,
    angularSeparation,
    measureAspect,
    calculate
  });
})();
