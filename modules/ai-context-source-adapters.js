/**
 * Today App — AI Context Source Adapters
 * NUT-017.3.2
 *
 * App'in public Core, Health, Nutrition ve Core–Sky API'lerinden salt okunur
 * kayıt alır ve Today AI Engine input-event v1 zarflarına dönüştürür.
 * Bu katman DOM, depolama anahtarı, ağ veya AI önerisi bilmez.
 */
(function () {
  "use strict";

  const API_VERSION = 1;
  const CONTRACT_VERSION = 1;
  const RULESET_ID =
    "today:ai-context-source-adapters:nut-017.3.2";
  const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  function deepFreeze(value, seen = new Set()) {
    if (!value || typeof value !== "object" || seen.has(value)) {
      return value;
    }

    seen.add(value);
    Object.values(value).forEach(entry => deepFreeze(entry, seen));
    return Object.freeze(value);
  }

  function clone(value) {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function isDateKey(value) {
    if (typeof value !== "string" || !DATE_KEY_PATTERN.test(value)) {
      return false;
    }

    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value;
  }

  function normalizeDateTime(value, fallbackDate, requestedAt) {
    if (
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T/.test(value) &&
      !Number.isNaN(Date.parse(value))
    ) {
      return new Date(value).toISOString();
    }

    const fallback = isDateKey(fallbackDate)
      ? `${fallbackDate}T00:00:00.000Z`
      : requestedAt;
    return new Date(fallback).toISOString();
  }

  function localDateFrom(value) {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) return null;
    const local = new Date(
      date.getTime() - date.getTimezoneOffset() * 60000
    );
    return local.toISOString().slice(0, 10);
  }

  function safeId(value, fallback) {
    const normalized = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._:-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120);
    return normalized || fallback;
  }

  function permission(consent, source) {
    return consent?.permissions?.[source] || null;
  }

  function classAllowed(consent, source, dataClass) {
    const sourcePermission = permission(consent, source);
    return Boolean(
      sourcePermission?.allowed === true &&
      Array.isArray(sourcePermission.dataClasses) &&
      sourcePermission.dataClasses.includes(dataClass)
    );
  }

  function freeTextAllowed(consent, source) {
    return permission(consent, source)?.includeFreeText === true;
  }

  function inWindow(dateKey, window) {
    return isDateKey(dateKey) &&
      dateKey >= window.startDate &&
      dateKey <= window.endDate;
  }

  function eventEnvelope({
    eventId,
    source,
    eventType,
    createdAt,
    localDate,
    payload,
    requestedAt
  }) {
    return {
      schemaVersion: 1,
      eventId,
      source,
      eventType,
      createdAt: normalizeDateTime(createdAt, localDate, requestedAt),
      localDate,
      payload
    };
  }

  function collectCoreEvents(consent, window, requestedAt, warnings) {
    if (permission(consent, "core")?.allowed !== true) return [];

    const storage = globalThis.TodayStorage;
    if (!storage || typeof storage.getAllDays !== "function") {
      warnings.push({ source: "today-core", reason: "source-api-unavailable" });
      return [];
    }

    const includeChoice = classAllowed(
      consent,
      "core",
      "daily-choice"
    );
    const includeColor = classAllowed(consent, "core", "color");
    const includeNote = classAllowed(consent, "core", "note") &&
      freeTextAllowed(consent, "core");

    return storage.getAllDays()
      .filter(day => inWindow(day.date, window))
      .map(day => {
        const payload = {};
        if (includeChoice && day.choice !== undefined) {
          payload.choice = clone(day.choice);
        }
        if (includeColor && typeof day.color === "string") {
          payload.color = day.color;
        }
        if (includeNote && typeof day.note === "string" && day.note.trim()) {
          payload.note = day.note;
        }

        return Object.keys(payload).length === 0
          ? null
          : eventEnvelope({
              eventId: `core:${day.date}`,
              source: "today-core",
              eventType: "daily-checkin",
              createdAt: day.updatedAt || day.createdAt,
              localDate: day.date,
              payload,
              requestedAt
            });
      })
      .filter(Boolean);
  }

  function wellnessEvent(
    record,
    eventType,
    prefix,
    requestedAt,
    includeFreeText
  ) {
    const localDate = isDateKey(record?.dayKey)
      ? record.dayKey
      : localDateFrom(record?.date);
    if (!localDate) return null;

    const payload = clone(record);
    if (!includeFreeText) {
      delete payload.note;
      delete payload.customSymptom;
    }

    return eventEnvelope({
      eventId: `health:${prefix}:${safeId(record?.id, localDate)}`,
      source: "today-health",
      eventType,
      createdAt: record?.date,
      localDate,
      payload,
      requestedAt
    });
  }

  function workoutEvent(record, requestedAt) {
    const localDate = isDateKey(record?.dayKey)
      ? record.dayKey
      : localDateFrom(record?.date);
    if (!localDate) return null;

    return eventEnvelope({
      eventId: `health:workout:${safeId(record?.id, localDate)}`,
      source: "today-health",
      eventType: "workout-record",
      createdAt: record?.date,
      localDate,
      payload: clone(record),
      requestedAt
    });
  }

  async function collectHealthEvents(
    consent,
    window,
    requestedAt,
    warnings
  ) {
    if (permission(consent, "health")?.allowed !== true) return [];

    const events = [];
    const health = globalThis.TodayHealthHub;
    const needsWellness = ["sleep", "energy", "symptoms", "activity"]
      .some(dataClass => classAllowed(consent, "health", dataClass));

    if (needsWellness) {
      if (!health || typeof health.listContextRecords !== "function") {
        warnings.push({ source: "today-health", reason: "health-api-unavailable" });
      } else {
        const records = health.listContextRecords({
          startDate: window.startDate,
          endDate: window.endDate,
          limitPerType: window.maxEventsPerSource
        });
        const includeFreeText = freeTextAllowed(consent, "health");

        if (classAllowed(consent, "health", "sleep")) {
          events.push(...records.sleep.map(record =>
            wellnessEvent(
              record,
              "sleep-record",
              "sleep",
              requestedAt,
              includeFreeText
            )
          ).filter(Boolean));
        }
        if (classAllowed(consent, "health", "energy")) {
          events.push(...records.energy.map(record =>
            wellnessEvent(
              record,
              "energy-record",
              "energy",
              requestedAt,
              includeFreeText
            )
          ).filter(Boolean));
        }
        if (classAllowed(consent, "health", "symptoms")) {
          events.push(...records.symptoms.map(record =>
            wellnessEvent(
              record,
              "symptom-record",
              "symptoms",
              requestedAt,
              includeFreeText
            )
          ).filter(Boolean));
        }
        if (classAllowed(consent, "health", "activity")) {
          events.push(...records.workouts.map(record =>
            workoutEvent(record, requestedAt)
          ).filter(Boolean));
        }
      }
    }

    const nutritionTypes = [];
    if (classAllowed(consent, "health", "hydration")) {
      nutritionTypes.push("hydration_entry");
    }
    if (classAllowed(consent, "health", "nutrition")) {
      nutritionTypes.push("meal_entry", "nutrition_summary");
    }
    if (classAllowed(consent, "health", "weight")) {
      nutritionTypes.push("weight_reference");
    }
    if (classAllowed(consent, "health", "activity")) {
      nutritionTypes.push("activity_reference");
    }
    const needsNutrition = nutritionTypes.length > 0;
    const nutrition = globalThis.TodayNutritionStorage;

    if (needsNutrition) {
      if (!nutrition || typeof nutrition.queryRecords !== "function") {
        warnings.push({ source: "today-health", reason: "nutrition-api-unavailable" });
      } else {
        const records = await nutrition.queryRecords({
          types: nutritionTypes,
          recordStatuses: ["active"],
          includeAiDrafts: false,
          eventFrom: `${window.startDate}T00:00:00.000Z`,
          eventTo: `${window.endDate}T23:59:59.999Z`,
          sortDirection: "asc",
          limit: window.maxEventsPerSource
        });

        records.forEach(record => {
          const localDate = localDateFrom(
            record.eventAt || record.updatedAt || record.createdAt
          );
          if (!inWindow(localDate, window)) return;

          events.push(eventEnvelope({
            eventId: `health:nutrition:${safeId(record.id, localDate)}`,
            source: "today-health",
            eventType: "nutrition-record",
            createdAt: record.updatedAt || record.createdAt || record.eventAt,
            localDate,
            payload: clone(record),
            requestedAt
          }));
        });
      }
    }

    return events;
  }

  function collectSkyEvents(consent, window, requestedAt, warnings) {
    if (
      permission(consent, "sky")?.allowed !== true ||
      !classAllowed(consent, "sky", "core-sky-snapshot")
    ) {
      return [];
    }

    const links = globalThis.TodayCoreSkyLink;
    if (!links || typeof links.listLinks !== "function") {
      warnings.push({ source: "today-sky", reason: "source-api-unavailable" });
      return [];
    }

    return links.listLinks({ limit: window.maxEventsPerSource })
      .filter(entry => inWindow(entry.dateKey, window))
      .map(entry => eventEnvelope({
        eventId: `sky:core-link:${entry.dateKey}`,
        source: "today-sky",
        eventType: "core-sky-symbolic-snapshot",
        createdAt: entry.link.linkedAt,
        localDate: entry.dateKey,
        payload: clone(entry.link),
        requestedAt
      }));
  }

  function compareEvents(left, right) {
    const compareText = (leftValue, rightValue) =>
      leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;

    return compareText(left.localDate, right.localDate) ||
      compareText(left.createdAt, right.createdAt) ||
      compareText(left.eventId, right.eventId);
  }

  function selectLatestEvents(events, limit) {
    return events
      .sort(compareEvents)
      .slice(-limit);
  }

  async function collectEvents(options = {}) {
    const consent = options.consent;
    const window = options.window;
    const requestedAt = options.requestedAt;

    if (
      !consent ||
      !window ||
      !isDateKey(window.startDate) ||
      !isDateKey(window.endDate) ||
      window.startDate > window.endDate ||
      !Number.isInteger(window.maxEventsPerSource) ||
      Number.isNaN(Date.parse(requestedAt))
    ) {
      throw new TypeError("Geçersiz AI bağlam kaynak isteği.");
    }

    const warnings = [];
    const core = selectLatestEvents(
      collectCoreEvents(consent, window, requestedAt, warnings),
      window.maxEventsPerSource
    );
    const health = selectLatestEvents(
      await collectHealthEvents(consent, window, requestedAt, warnings),
      window.maxEventsPerSource
    );
    const sky = selectLatestEvents(
      collectSkyEvents(consent, window, requestedAt, warnings),
      window.maxEventsPerSource
    );
    const events = [...core, ...health, ...sky].sort(compareEvents);

    return deepFreeze({
      contractVersion: CONTRACT_VERSION,
      rulesetId: RULESET_ID,
      events,
      warnings,
      counts: {
        core: core.length,
        health: health.length,
        sky: sky.length,
        total: events.length
      }
    });
  }

  globalThis.TodayAIContextSources = Object.freeze({
    API_VERSION,
    CONTRACT_VERSION,
    RULESET_ID,
    collectEvents
  });
})();
