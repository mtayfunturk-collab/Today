/**
 * Today App — Nutrition History
 * NUT-009 — Day history and reversible nutrition record management
 *
 * This module keeps historical day reads and user corrections local-first.
 * A correction archives or restores an entry; it never physically deletes
 * the consumption event or its immutable item snapshots.
 */

(function () {
  "use strict";

  const HISTORY_API_VERSION = 1;
  const HISTORY_RULESET_ID =
    "today:nutrition:history:v1";
  const HISTORY_EXTENSION_KEY =
    "today.nutrition.history";
  const MAX_DAY_ENTRIES = 500;
  const MAX_HISTORY_EVENTS = 100;

  const ENTRY_TYPES = Object.freeze([
    "meal_entry",
    "hydration_entry"
  ]);

  const DAY_KEY_PATTERN =
    /^(\d{4})-(\d{2})-(\d{2})$/;
  const IDENTIFIER_PATTERN =
    /^[a-z0-9](?:[a-z0-9._:-]{0,78}[a-z0-9])?$/;

  let writeTail = Promise.resolve();

  function createError(
    code,
    message,
    detail = null,
    cause = null
  ) {
    const error = new Error(message);
    error.name = "TodayNutritionHistoryError";
    error.todayCode = code;
    error.detail = detail;

    if (cause) {
      error.cause = cause;
    }

    return error;
  }

  function clone(value) {
    if (value === undefined) {
      return undefined;
    }

    if (typeof structuredClone === "function") {
      return structuredClone(value);
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

    Object.keys(value).forEach(key =>
      deepFreeze(value[key])
    );

    return Object.freeze(value);
  }

  function freezeClone(value) {
    return deepFreeze(clone(value));
  }

  function serializeWrite(operation) {
    const run = writeTail.then(
      operation,
      operation
    );

    writeTail = run.catch(() => undefined);
    return run;
  }

  function getDependencies() {
    const entry = window.TodayNutritionEntry;
    const planning =
      window.TodayNutritionPlanning;
    const storage =
      window.TodayNutritionStorage;
    const missing = [];

    [
      [entry, "listEntries", "TodayNutritionEntry"],
      [
        planning,
        "listPlannedMeals",
        "TodayNutritionPlanning"
      ],
      [storage, "getRecord", "TodayNutritionStorage"],
      [storage, "saveRecord", "TodayNutritionStorage"]
    ].forEach(([candidate, methodName, apiName]) => {
      if (
        !candidate ||
        typeof candidate[methodName] !== "function"
      ) {
        missing.push(`${apiName}.${methodName}`);
      }
    });

    if (missing.length > 0) {
      throw createError(
        "TODAY-NUTRITION-HISTORY-001",
        "Beslenme geçmişi bağımlılıkları hazır değil.",
        { missing }
      );
    }

    return { entry, planning, storage };
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function dayKeyFromDate(value = new Date()) {
    const date = value instanceof Date
      ? value
      : new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw createError(
        "TODAY-NUTRITION-HISTORY-002",
        "Gün anahtarı için geçerli bir tarih gerekir."
      );
    }

    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join("-");
  }

  function parseDayKey(value) {
    const normalized =
      typeof value === "string"
        ? value.trim()
        : "";
    const match = normalized.match(
      DAY_KEY_PATTERN
    );

    if (!match) {
      throw createError(
        "TODAY-NUTRITION-HISTORY-002",
        "Beslenme günü YYYY-AA-GG biçiminde olmalıdır.",
        { dayKey: normalized || null }
      );
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(
      year,
      month - 1,
      day,
      12,
      0,
      0,
      0
    );

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      throw createError(
        "TODAY-NUTRITION-HISTORY-002",
        "Beslenme günü takvimde geçerli olmalıdır.",
        { dayKey: normalized }
      );
    }

    return {
      dayKey: normalized,
      year,
      month,
      day,
      date
    };
  }

  function normalizeDayKey(value) {
    return parseDayKey(value).dayKey;
  }

  function dayRange(value) {
    const parsed = parseDayKey(value);
    const start = new Date(
      parsed.year,
      parsed.month - 1,
      parsed.day,
      0,
      0,
      0,
      0
    );
    const end = new Date(
      parsed.year,
      parsed.month - 1,
      parsed.day,
      23,
      59,
      59,
      999
    );

    return Object.freeze({
      start: start.toISOString(),
      end: end.toISOString()
    });
  }

  function isToday(
    value,
    now = new Date()
  ) {
    return normalizeDayKey(value) ===
      dayKeyFromDate(now);
  }

  function shiftDay(
    value,
    offset,
    options = {}
  ) {
    const parsed = parseDayKey(value);
    const amount = Number(offset);

    if (
      !Number.isInteger(amount) ||
      Math.abs(amount) > 3660
    ) {
      throw createError(
        "TODAY-NUTRITION-HISTORY-002",
        "Gün kaydırma miktarı geçersiz.",
        { offset }
      );
    }

    const shifted = new Date(parsed.date);
    shifted.setDate(
      shifted.getDate() + amount
    );
    const shiftedKey =
      dayKeyFromDate(shifted);
    const todayKey = dayKeyFromDate(
      options.now || new Date()
    );

    if (
      options.preventFuture === true &&
      shiftedKey > todayKey
    ) {
      return todayKey;
    }

    return shiftedKey;
  }

  function assertReadableDay(
    dayKey,
    options
  ) {
    const normalized =
      normalizeDayKey(dayKey);
    const todayKey = dayKeyFromDate(
      options.now || new Date()
    );

    if (
      normalized > todayKey &&
      options.allowFuture !== true
    ) {
      throw createError(
        "TODAY-NUTRITION-HISTORY-003",
        "Gelecek gün tüketim geçmişi olarak açılamaz.",
        { dayKey: normalized, todayKey }
      );
    }

    return { normalized, todayKey };
  }

  async function loadDay(
    dayKey,
    options = {}
  ) {
    const { normalized, todayKey } =
      assertReadableDay(dayKey, options);
    const range = dayRange(normalized);
    const { entry, planning } =
      getDependencies();
    const [allEntries, plannedMeals] =
      await Promise.all([
        entry.listEntries({
          eventFrom: range.start,
          eventTo: range.end,
          sortDirection: "desc",
          limit: MAX_DAY_ENTRIES
        }),
        planning.listPlannedMeals({
          from: range.start,
          to: range.end,
          sortDirection: "asc"
        })
      ]);
    const entries = allEntries.filter(
      record =>
        ENTRY_TYPES.includes(record?.type) &&
        record.recordStatus === "active" &&
        record.source?.kind !== "ai_draft"
    );
    const archivedEntries = allEntries.filter(
      record =>
        ENTRY_TYPES.includes(record?.type) &&
        record.recordStatus === "archived" &&
        record.source?.kind !== "ai_draft"
    );

    return freezeClone({
      dayKey: normalized,
      todayKey,
      isToday: normalized === todayKey,
      range,
      entries,
      archivedEntries,
      plannedMeals
    });
  }

  function normalizeIdentifier(
    value,
    fieldName
  ) {
    const normalized =
      typeof value === "string"
        ? value.trim()
        : "";

    if (!IDENTIFIER_PATTERN.test(normalized)) {
      throw createError(
        "TODAY-NUTRITION-HISTORY-004",
        `${fieldName} geçersiz.`,
        { fieldName }
      );
    }

    return normalized;
  }

  function resolveTimestamp(options) {
    const candidate =
      options?.at ||
      new Date().toISOString();
    const timestamp = Date.parse(candidate);

    if (Number.isNaN(timestamp)) {
      throw createError(
        "TODAY-NUTRITION-HISTORY-004",
        "Kayıt yönetimi zamanı geçerli bir tarih-saat olmalıdır."
      );
    }

    return new Date(timestamp).toISOString();
  }

  function assertConfirmation(
    options,
    confirmationKey,
    actionName
  ) {
    if (
      options?.userInitiated !== true ||
      options?.userConfirmed !== true ||
      options?.[confirmationKey] !== true
    ) {
      throw createError(
        "TODAY-NUTRITION-HISTORY-005",
        `${actionName} açık kullanıcı işlemi ve onayı gerektirir.`
      );
    }
  }

  function assertManageableEntry(record) {
    if (
      !record ||
      !ENTRY_TYPES.includes(record.type) ||
      record.source?.kind === "ai_draft"
    ) {
      throw createError(
        "TODAY-NUTRITION-HISTORY-006",
        "Yönetilecek gerçek tüketim kaydı bulunamadı.",
        { recordId: record?.id || null }
      );
    }

    return record;
  }

  function historyEvents(record) {
    const existing =
      record.extensions?.[
        HISTORY_EXTENSION_KEY
      ]?.events;

    if (!Array.isArray(existing)) {
      return [];
    }

    return clone(existing)
      .slice(-MAX_HISTORY_EVENTS);
  }

  function appendHistoryEvent(
    record,
    event
  ) {
    const events = [
      ...historyEvents(record),
      event
    ].slice(-MAX_HISTORY_EVENTS);

    return {
      ...clone(record.extensions || {}),
      [HISTORY_EXTENSION_KEY]: {
        rulesetId: HISTORY_RULESET_ID,
        events
      }
    };
  }

  function lastHistoryEvent(record) {
    const events = historyEvents(record);
    return events[events.length - 1] || null;
  }

  function assertOperationOrder(
    record,
    timestamp
  ) {
    if (
      Date.parse(timestamp) <
      Date.parse(record.updatedAt)
    ) {
      throw createError(
        "TODAY-NUTRITION-HISTORY-007",
        "Eski zamanlı bir işlem daha yeni tüketim kaydını değiştiremez.",
        {
          recordId: record.id,
          updatedAt: record.updatedAt,
          operationAt: timestamp
        }
      );
    }
  }

  function operationId(options) {
    if (
      options?.clientOperationId === undefined ||
      options.clientOperationId === null ||
      options.clientOperationId === ""
    ) {
      return null;
    }

    return normalizeIdentifier(
      options.clientOperationId,
      "İstemci işlem kimliği"
    );
  }

  async function saveManagedRecord(
    storage,
    current,
    candidate
  ) {
    try {
      return await storage.saveRecord(
        candidate,
        {
          mode: "upsert",
          expectedUpdatedAtById: {
            [current.id]: current.updatedAt
          }
        }
      );
    } catch (error) {
      if (error?.todayCode) {
        throw error;
      }

      throw createError(
        "TODAY-NUTRITION-HISTORY-008",
        "Beslenme kaydı güvenli biçimde güncellenemedi.",
        { recordId: current.id },
        error
      );
    }
  }

  function archiveEntry(
    recordId,
    confirmation
  ) {
    assertConfirmation(
      confirmation,
      "confirmEntryArchive",
      "Tüketim kaydını arşivleme"
    );

    return serializeWrite(async () => {
      const id = normalizeIdentifier(
        recordId,
        "Tüketim kayıt kimliği"
      );
      const timestamp =
        resolveTimestamp(confirmation);
      const clientOperationId =
        operationId(confirmation);
      const { storage } = getDependencies();
      const current = assertManageableEntry(
        await storage.getRecord(id, {
          includeAiDraft: true
        })
      );
      const lastEvent =
        lastHistoryEvent(current);

      if (
        current.recordStatus === "archived" &&
        lastEvent?.action === "archive" &&
        lastEvent.clientOperationId ===
          clientOperationId
      ) {
        return freezeClone(current);
      }

      if (current.recordStatus !== "active") {
        throw createError(
          "TODAY-NUTRITION-HISTORY-009",
          "Yalnız etkin tüketim kaydı arşivlenebilir.",
          {
            recordId: current.id,
            recordStatus:
              current.recordStatus
          }
        );
      }

      assertOperationOrder(current, timestamp);

      const candidate = {
        ...clone(current),
        recordStatus: "archived",
        updatedAt: timestamp,
        extensions: appendHistoryEvent(
          current,
          {
            action: "archive",
            at: timestamp,
            actor: "user",
            reason: "user_correction",
            clientOperationId
          }
        )
      };
      const saved = await saveManagedRecord(
        storage,
        current,
        candidate
      );

      return freezeClone(saved);
    });
  }

  function restoreEntry(
    recordId,
    confirmation
  ) {
    assertConfirmation(
      confirmation,
      "confirmEntryRestore",
      "Arşivlenmiş tüketim kaydını geri alma"
    );

    return serializeWrite(async () => {
      const id = normalizeIdentifier(
        recordId,
        "Tüketim kayıt kimliği"
      );
      const timestamp =
        resolveTimestamp(confirmation);
      const clientOperationId =
        operationId(confirmation);
      const { storage } = getDependencies();
      const current = assertManageableEntry(
        await storage.getRecord(id, {
          includeAiDraft: true
        })
      );
      const lastEvent =
        lastHistoryEvent(current);

      if (
        current.recordStatus === "active" &&
        lastEvent?.action === "restore" &&
        lastEvent.clientOperationId ===
          clientOperationId
      ) {
        return freezeClone(current);
      }

      if (
        current.recordStatus !== "archived" ||
        lastEvent?.action !== "archive"
      ) {
        throw createError(
          "TODAY-NUTRITION-HISTORY-010",
          "Yalnız bu akışta arşivlenen tüketim kaydı geri alınabilir.",
          {
            recordId: current.id,
            recordStatus:
              current.recordStatus
          }
        );
      }

      assertOperationOrder(current, timestamp);

      const candidate = {
        ...clone(current),
        recordStatus: "active",
        updatedAt: timestamp,
        extensions: appendHistoryEvent(
          current,
          {
            action: "restore",
            at: timestamp,
            actor: "user",
            reason: "user_correction_undo",
            clientOperationId
          }
        )
      };
      const saved = await saveManagedRecord(
        storage,
        current,
        candidate
      );

      return freezeClone(saved);
    });
  }

  window.TodayNutritionHistory =
    Object.freeze({
      HISTORY_API_VERSION,
      HISTORY_RULESET_ID,
      HISTORY_EXTENSION_KEY,
      MAX_DAY_ENTRIES,
      ENTRY_TYPES,
      dayKeyFromDate,
      normalizeDayKey,
      dayRange,
      isToday,
      shiftDay,
      loadDay,
      archiveEntry,
      restoreEntry
    });
})();
