/**
 * Today App v2
 * Central Error Manager
 * TB-015 / TB-016 / TB-017 / TB-018 — Platform Architecture
 *
 * Amaç:
 * - Platform katmanlarından gelen kontrollü hataları tek biçimde toplamak
 * - Beklenmeyen çalışma zamanı hatalarını güvenli biçimde yakalamak
 * - Kişisel günlük verilerini hata kaydına almadan sınırlı bir oturum günlüğü tutmak
 * - Kullanıcıyı boş ekranda bırakmadan erişilebilir geri kazanım bildirimi göstermek
 */

(function () {
  "use strict";

  const ERROR_MANAGER_VERSION = 1;
  const MAX_RECORDS = 25;

  const SEVERITIES = Object.freeze([
    "warning",
    "error",
    "fatal"
  ]);

  const RECOVERY_TYPES = Object.freeze([
    "dismiss",
    "home",
    "reload"
  ]);

  const EVENT_RULES = Object.freeze({
    "today:startup-error": Object.freeze({
      code: "TODAY-STARTUP-UNKNOWN",
      source: "startup",
      severity: "fatal",
      recoverable: true,
      recovery: "reload",
      userVisible: false,
      message: "Today başlangıç hatası bildirdi.",
      userMessage:
        "Today başlatılamadı. Kayıtların silinmedi."
    }),

    "today:routeerror": Object.freeze({
      code: "TODAY-ROUTER-UNKNOWN",
      source: "router",
      severity: "error",
      recoverable: true,
      recovery: "home",
      userVisible: true,
      message: "Today Router bir rota hatası bildirdi.",
      userMessage:
        "Bu ekran şu anda açılamadı. Kayıtların silinmedi."
    }),

    "today:routehistoryerror": Object.freeze({
      code: "TODAY-ROUTER-HISTORY",
      source: "router-history",
      severity: "warning",
      recoverable: true,
      recovery: "dismiss",
      userVisible: true,
      message: "Tarayıcı geri hareketi kullanılamadı.",
      userMessage:
        "Tarayıcı geri hareketi kullanılamadı. Uygulama içindeki geri düğmelerini kullanabilirsin."
    }),

    "today:moduleerror": Object.freeze({
      code: "TODAY-MODULES-UNKNOWN",
      source: "module-registry",
      severity: "error",
      recoverable: true,
      recovery: "home",
      userVisible: true,
      message: "Today Modules bir modül hatası bildirdi.",
      userMessage:
        "Bu modül şu anda açılamadı. Kayıtların silinmedi."
    }),

    "today:stateerror": Object.freeze({
      code: "TODAY-STATE-UNKNOWN",
      source: "state",
      severity: "error",
      recoverable: true,
      recovery: "dismiss",
      userVisible: true,
      message: "Today State bir kayıt hatası bildirdi.",
      userMessage:
        "Değişiklik cihazına tam kaydedilemedi. Mevcut güvenlik kopyası korundu."
    }),

    "today:migrationerror": Object.freeze({
      code: "TODAY-MIGRATION-UNKNOWN",
      source: "migration",
      severity: "fatal",
      recoverable: true,
      recovery: "reload",
      userVisible: false,
      message: "Today Migration bir şema geçişi hatası bildirdi.",
      userMessage:
        "Today verileri güvenli biçimde hazırlanamadı. Mevcut kayıtların ve güvenlik kopyan korundu."
    }),

    "today:service-worker-error": Object.freeze({
      code: "TODAY-SW-001",
      source: "service-worker",
      severity: "warning",
      recoverable: true,
      recovery: "dismiss",
      userVisible: true,
      message: "Service Worker kaydedilemedi.",
      userMessage:
        "Çevrimdışı kullanım hazırlanamadı. Uygulamayı çevrimiçi kullanmaya devam edebilirsin."
    }),

    "today:service-worker-update-error": Object.freeze({
      code: "TODAY-SW-UPDATE-001",
      source: "service-worker-update",
      severity: "warning",
      recoverable: true,
      recovery: "dismiss",
      userVisible: true,
      message: "Service Worker güncellemesi uygulanamadı.",
      userMessage:
        "Yeni sürüm şu anda uygulanamadı. Mevcut sürümü kullanmaya devam edebilirsin."
    }),

    "today:ai-adapter-error": Object.freeze({
      code: "TODAY-AI-ADAPTER-UNKNOWN",
      source: "ai-adapter",
      severity: "warning",
      recoverable: true,
      recovery: "dismiss",
      userVisible: true,
      message: "Today AI adaptörü bir sözleşme hatası bildirdi.",
      userMessage:
        "Yapay zekâ desteği şu anda kullanılamıyor. Today’i kullanmaya devam edebilirsin."
    }),

    "today:connect-adapter-error": Object.freeze({
      code: "TODAY-CONNECT-ADAPTER-UNKNOWN",
      source: "connect-adapter",
      severity: "warning",
      recoverable: true,
      recovery: "dismiss",
      userVisible: true,
      message: "Today Connect adaptörü bir sözleşme hatası bildirdi.",
      userMessage:
        "Bağlantılı işlem şu anda tamamlanamadı. Today’i kullanmaya devam edebilirsin."
    })
  });

  const LISTENED_EVENTS = Object.freeze(
    Object.keys(EVENT_RULES)
  );

  const SAFE_DETAIL_KEYS = Object.freeze([
    "route",
    "view",
    "moduleId",
    "scriptUrl",
    "mode",
    "sourceEvent",
    "filename",
    "line",
    "column",
    "errorName",
    "missingDependencies",
    "missingViews",
    "duplicateViews",
    "missingMethods",
    "invalidRoutes",
    "viewMismatches",
    "storageSaved",
    "legacyBackupSaved",
    "savedDayCount",
    "phase",
    "currentSchemaVersion",
    "targetSchemaVersion",
    "rolledBack",
    "appliedSteps",
    "stage",
    "workerState",
    "adapterId",
    "capability",
    "operation",
    "actionId"
  ]);

  let initialized = false;
  let listenersBound = false;
  let targetWindow = window;
  let targetDocument = document;
  let records = [];
  let sequence = 0;
  let currentNoticeId = null;

  function cleanText(value, fallback, maxLength = 180) {
    const text =
      typeof value === "string"
        ? value.trim()
        : "";

    return (
      text ||
      fallback
    ).slice(0, maxLength);
  }

  function normalizeCode(value, fallback) {
    const code = cleanText(
      value,
      fallback,
      80
    ).toUpperCase();

    return /^[A-Z0-9][A-Z0-9-]*$/.test(code)
      ? code
      : fallback;
  }

  function normalizeSeverity(value) {
    return SEVERITIES.includes(value)
      ? value
      : "error";
  }

  function normalizeRecovery(value) {
    return RECOVERY_TYPES.includes(value)
      ? value
      : "dismiss";
  }

  function safeDetailValue(value) {
    if (
      value === null ||
      typeof value === "boolean" ||
      typeof value === "number"
    ) {
      return value;
    }

    if (typeof value === "string") {
      return value.slice(0, 160);
    }

    if (Array.isArray(value)) {
      return value
        .slice(0, 12)
        .filter(
          item =>
            typeof item === "string" ||
            typeof item === "number" ||
            typeof item === "boolean"
        )
        .map(item =>
          typeof item === "string"
            ? item.slice(0, 120)
            : item
        );
    }

    return undefined;
  }

  function selectSafeDetails(...sources) {
    const details = {};

    sources.forEach(source => {
      if (
        !source ||
        typeof source !== "object"
      ) {
        return;
      }

      SAFE_DETAIL_KEYS.forEach(key => {
        if (
          !Object.prototype.hasOwnProperty.call(
            source,
            key
          )
        ) {
          return;
        }

        const value =
          safeDetailValue(source[key]);

        if (value !== undefined) {
          details[key] = value;
        }
      });
    });

    return Object.freeze(details);
  }

  function createRecord(input = {}, defaults = {}) {
    const sourceInput =
      input &&
      typeof input === "object"
        ? input
        : {};
    const sourceDefaults =
      defaults &&
      typeof defaults === "object"
        ? defaults
        : {};
    const code = normalizeCode(
      sourceInput.errorCode ||
        sourceInput.code,
      sourceDefaults.code ||
        "TODAY-ERROR-UNKNOWN"
    );
    const severity =
      normalizeSeverity(
        sourceInput.severity ||
        sourceDefaults.severity
      );
    const recoverable =
      sourceInput.recoverable !== undefined
        ? sourceInput.recoverable === true
        : sourceDefaults.recoverable !== false;
    const recovery =
      normalizeRecovery(
        sourceInput.recovery ||
        sourceDefaults.recovery
      );
    const userVisible =
      sourceInput.userVisible !== undefined
        ? sourceInput.userVisible === true
        : sourceDefaults.userVisible !== false;

    sequence += 1;

    return Object.freeze({
      id: `today-error-${sequence}`,
      code,
      source: cleanText(
        sourceInput.source,
        sourceDefaults.source ||
          "application",
        60
      ),
      severity,
      recoverable,
      recovery:
        recoverable
          ? recovery
          : "dismiss",
      userVisible,
      message: cleanText(
        sourceInput.message,
        sourceDefaults.message ||
          "Today bir uygulama hatası bildirdi."
      ),
      userMessage: cleanText(
        sourceInput.userMessage,
        sourceDefaults.userMessage ||
          "Beklenmeyen bir sorun oluştu. Kayıtların silinmedi.",
        220
      ),
      timestamp: new Date().toISOString(),
      details: selectSafeDetails(
        sourceDefaults.details,
        sourceInput.details,
        sourceDefaults,
        sourceInput
      )
    });
  }

  function dispatch(name, detail) {
    if (
      !targetWindow ||
      typeof targetWindow.dispatchEvent !==
        "function" ||
      typeof targetWindow.CustomEvent !==
        "function"
    ) {
      return;
    }

    targetWindow.dispatchEvent(
      new targetWindow.CustomEvent(name, {
        detail
      })
    );
  }

  function getNoticeSurface() {
    return targetDocument &&
      typeof targetDocument.getElementById ===
        "function"
      ? targetDocument.getElementById(
          "todayErrorNotice"
        )
      : null;
  }

  function ensureNoticeSurface() {
    const existing = getNoticeSurface();

    if (existing) {
      return existing;
    }

    if (
      !targetDocument ||
      typeof targetDocument.createElement !==
        "function"
    ) {
      return null;
    }

    const mountTarget =
      targetDocument.body ||
      targetDocument.documentElement;

    if (
      !mountTarget ||
      typeof mountTarget.appendChild !==
        "function"
    ) {
      return null;
    }

    const surface =
      targetDocument.createElement("aside");
    surface.id = "todayErrorNotice";
    surface.hidden = true;
    surface.setAttribute(
      "aria-hidden",
      "true"
    );
    surface.setAttribute(
      "aria-atomic",
      "true"
    );
    surface.style.cssText = [
      "position:fixed",
      "left:16px",
      "right:16px",
      "bottom:max(16px,env(safe-area-inset-bottom))",
      "z-index:2147483646",
      "width:min(calc(100% - 32px),480px)",
      "margin:0 auto",
      "padding:16px",
      "border:1px solid rgba(255,255,255,.18)",
      "border-radius:18px",
      "background:#151b27",
      "color:#f5f7fb",
      "box-shadow:0 18px 60px rgba(0,0,0,.38)",
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    ].join(";");

    const text =
      targetDocument.createElement("p");
    text.id = "todayErrorNoticeText";
    text.style.cssText = [
      "margin:0",
      "font-size:15px",
      "line-height:1.5"
    ].join(";");

    const code =
      targetDocument.createElement("p");
    code.id = "todayErrorNoticeCode";
    code.style.cssText = [
      "margin:8px 0 0",
      "color:#aab4c3",
      "font-size:12px",
      "line-height:1.4"
    ].join(";");

    const actions =
      targetDocument.createElement("div");
    actions.style.cssText = [
      "display:flex",
      "flex-wrap:wrap",
      "gap:10px",
      "margin-top:14px"
    ].join(";");

    const recoverButton =
      targetDocument.createElement("button");
    recoverButton.id =
      "todayErrorRecover";
    recoverButton.type = "button";
    recoverButton.style.cssText = [
      "min-height:44px",
      "border:0",
      "border-radius:12px",
      "padding:10px 14px",
      "background:#eef3ff",
      "color:#111827",
      "font:inherit",
      "font-weight:700",
      "cursor:pointer"
    ].join(";");
    recoverButton.addEventListener(
      "click",
      () => recover()
    );

    const dismissButton =
      targetDocument.createElement("button");
    dismissButton.id =
      "todayErrorDismiss";
    dismissButton.type = "button";
    dismissButton.textContent = "Kapat";
    dismissButton.style.cssText = [
      "min-height:44px",
      "border:1px solid rgba(255,255,255,.22)",
      "border-radius:12px",
      "padding:10px 14px",
      "background:transparent",
      "color:#f5f7fb",
      "font:inherit",
      "font-weight:700",
      "cursor:pointer"
    ].join(";");
    dismissButton.addEventListener(
      "click",
      () => dismiss()
    );

    actions.append(
      recoverButton,
      dismissButton
    );
    surface.append(
      text,
      code,
      actions
    );
    mountTarget.appendChild(surface);

    return surface;
  }

  function findRecord(recordId) {
    if (!recordId) {
      return records.find(
        record =>
          record.id === currentNoticeId
      ) || null;
    }

    return records.find(
      record => record.id === recordId
    ) || null;
  }

  function showNotice(record) {
    if (!record.userVisible) {
      return false;
    }

    const surface =
      ensureNoticeSurface();

    if (!surface) {
      return false;
    }

    const text =
      targetDocument.getElementById(
        "todayErrorNoticeText"
      );
    const code =
      targetDocument.getElementById(
        "todayErrorNoticeCode"
      );
    const recoverButton =
      targetDocument.getElementById(
        "todayErrorRecover"
      );
    const dismissButton =
      targetDocument.getElementById(
        "todayErrorDismiss"
      );

    if (
      !text ||
      !code ||
      !recoverButton ||
      !dismissButton
    ) {
      return false;
    }

    currentNoticeId = record.id;
    text.textContent = record.userMessage;
    code.textContent =
      `Hata kodu: ${record.code}`;
    recoverButton.textContent =
      record.recovery === "home"
        ? "Ana ekrana dön"
        : record.recovery === "reload"
          ? "Yeniden dene"
          : "Tamam";
    recoverButton.hidden =
      record.recovery === "dismiss";
    dismissButton.textContent =
      record.recovery === "dismiss"
        ? "Tamam"
        : "Kapat";
    surface.setAttribute(
      "role",
      record.severity === "warning"
        ? "status"
        : "alert"
    );
    surface.setAttribute(
      "aria-live",
      record.severity === "warning"
        ? "polite"
        : "assertive"
    );
    surface.setAttribute(
      "aria-hidden",
      "false"
    );
    surface.hidden = false;

    return true;
  }

  function dismiss() {
    const surface = getNoticeSurface();

    currentNoticeId = null;

    if (!surface) {
      return false;
    }

    surface.hidden = true;
    surface.setAttribute(
      "aria-hidden",
      "true"
    );

    return true;
  }

  function reloadPage() {
    if (
      targetWindow.location &&
      typeof targetWindow.location.reload ===
        "function"
    ) {
      targetWindow.location.reload();
      return true;
    }

    return false;
  }

  function recover(recordId) {
    const record =
      findRecord(recordId);

    if (!record) {
      dismiss();

      return Object.freeze({
        success: false,
        errorCode:
          "TODAY-ERRORS-RECOVERY-001"
      });
    }

    if (record.recovery === "dismiss") {
      dismiss();

      return Object.freeze({
        success: true,
        action: "dismiss"
      });
    }

    if (record.recovery === "home") {
      const router =
        targetWindow.TodayRouter;

      try {
        if (
          router &&
          typeof router.navigate ===
            "function" &&
          (
            typeof router.getState !==
              "function" ||
            router.getState().initialized ===
              true
          )
        ) {
          const result =
            router.navigate(
              "home",
              {
                replace: true,
                source:
                  "error-recovery"
              }
            );

          if (
            result &&
            result.success !== false
          ) {
            dismiss();

            return Object.freeze({
              success: true,
              action: "home"
            });
          }
        }
      } catch (error) {
        // Güvenli geri kazanım aşağıdaki yenilemeye düşer.
      }
    }

    const reloaded = reloadPage();

    if (reloaded) {
      dismiss();
    }

    return Object.freeze({
      success: reloaded,
      action: "reload"
    });
  }

  function writeConsole(record) {
    const consoleApi =
      targetWindow.console;

    if (!consoleApi) {
      return;
    }

    const method =
      record.severity === "warning"
        ? "warn"
        : "error";

    if (
      typeof consoleApi[method] ===
        "function"
    ) {
      consoleApi[method](
        `[${record.code}] ${record.message}`,
        record.details
      );
    }
  }

  function capture(input = {}, defaults = {}) {
    const record =
      createRecord(input, defaults);

    records.push(record);

    if (records.length > MAX_RECORDS) {
      records = records.slice(
        -MAX_RECORDS
      );
    }

    writeConsole(record);
    showNotice(record);
    dispatch("today:error", record);

    return record;
  }

  function handleKnownEvent(event) {
    const eventName =
      event && event.type;
    const rule =
      EVENT_RULES[eventName];

    if (!rule) {
      return null;
    }

    const detail =
      event &&
      event.detail &&
      typeof event.detail === "object"
        ? event.detail
        : {};

    return capture(
      {
        errorCode:
          detail.errorCode ||
          detail.code,
        message:
          detail.message ||
          rule.message,
        details: {
          ...detail,
          sourceEvent: eventName
        }
      },
      rule
    );
  }

  function handleWindowError(event) {
    const resourceTarget =
      event &&
      event.target &&
      event.target !== targetWindow
        ? event.target
        : null;
    const resourceUrl =
      resourceTarget &&
      (
        resourceTarget.src ||
        resourceTarget.href
      );
    const resourceError =
      typeof resourceUrl === "string" &&
      resourceUrl.length > 0;

    return capture({
      code:
        resourceError
          ? "TODAY-RUNTIME-003"
          : "TODAY-RUNTIME-001",
      source:
        resourceError
          ? "resource"
          : "runtime",
      severity: "error",
      recoverable: true,
      recovery: "reload",
      userVisible: true,
      message:
        resourceError
          ? "Bir uygulama dosyası yüklenemedi."
          : "Beklenmeyen çalışma zamanı hatası yakalandı.",
      userMessage:
        resourceError
          ? "Uygulama dosyalarından biri yüklenemedi. Kayıtların silinmedi."
          : "Beklenmeyen bir sorun oluştu. Kayıtların silinmedi.",
      details: {
        filename:
          resourceError
            ? resourceUrl
            : event && event.filename,
        line:
          event && event.lineno,
        column:
          event && event.colno,
        errorName:
          event &&
          event.error &&
          event.error.name
      }
    });
  }

  function handleUnhandledRejection(event) {
    const reason =
      event && event.reason;

    return capture({
      code: "TODAY-RUNTIME-002",
      source: "promise",
      severity: "error",
      recoverable: true,
      recovery: "reload",
      userVisible: true,
      message:
        "Yakalanmamış Promise reddi güvenli biçimde işlendi.",
      userMessage:
        "Beklenmeyen bir işlem hatası oluştu. Kayıtların silinmedi.",
      details: {
        errorName:
          reason &&
          typeof reason === "object"
            ? reason.name
            : typeof reason
      }
    });
  }

  function getLog() {
    return Object.freeze([
      ...records
    ]);
  }

  function clearLog() {
    records = [];
    currentNoticeId = null;
    dismiss();

    return true;
  }

  function getState() {
    return Object.freeze({
      initialized,
      listenersBound,
      recordCount: records.length,
      maxRecords: MAX_RECORDS,
      currentNoticeId
    });
  }

  function init(options = {}) {
    if (initialized) {
      return Object.freeze({
        success: true,
        changed: false,
        ...getState()
      });
    }

    const candidateWindow =
      options.window ||
      window;
    const candidateDocument =
      options.document ||
      document;

    if (
      !candidateWindow ||
      typeof candidateWindow.addEventListener !==
        "function" ||
      !candidateDocument ||
      typeof candidateDocument.createElement !==
        "function"
    ) {
      return Object.freeze({
        success: false,
        changed: false,
        errorCode:
          "TODAY-ERRORS-001",
        initialized: false,
        listenersBound: false,
        recordCount: 0,
        maxRecords: MAX_RECORDS,
        currentNoticeId: null
      });
    }

    targetWindow = candidateWindow;
    targetDocument = candidateDocument;

    LISTENED_EVENTS.forEach(
      eventName => {
        targetWindow.addEventListener(
          eventName,
          handleKnownEvent
        );
      }
    );
    targetWindow.addEventListener(
      "error",
      handleWindowError,
      true
    );
    targetWindow.addEventListener(
      "unhandledrejection",
      handleUnhandledRejection
    );

    listenersBound = true;
    initialized = true;

    dispatch(
      "today:errors-ready",
      {
        version:
          ERROR_MANAGER_VERSION,
        listenedEvents: [
          ...LISTENED_EVENTS
        ]
      }
    );

    return Object.freeze({
      success: true,
      changed: true,
      ...getState()
    });
  }

  window.TodayErrors = Object.freeze({
    ERROR_MANAGER_VERSION,
    MAX_RECORDS,
    LISTENED_EVENTS,
    init,
    capture,
    getState,
    getLog,
    clearLog,
    dismiss,
    recover
  });

  init();

  console.info(
    "Today Central Error Manager hazır."
  );
})();
