/**
 * Today App v2
 * Startup Manager
 * TB-012 / TB-016 / TB-017 / TB-018 — Platform Architecture
 *
 * Amaç:
 * - Uygulamanın kritik modül sözleşmelerini tek noktada doğrulamak
 * - Inline uygulamayı yalnızca bağımlılıklar hazırsa başlatmak
 * - Başlangıç hatasında boş ekran yerine erişilebilir bir hata yüzeyi göstermek
 * - Service Worker kaydını güncelleme yöneticisi üzerinden güvenli biçimde tetiklemek
 */

(function () {
  "use strict";

  const MODULE_ORDER = Object.freeze([
    "TodayStorage",
    "TodayVersion",
    "TodayMigration",
    "TodayDay",
    "TodayState",
    "TodayAI",
    "TodayConnect"
  ]);

  const MODULE_REQUIREMENTS = Object.freeze({
    TodayStorage: Object.freeze({
      methods: Object.freeze([
        "loadStore",
        "saveStore",
        "saveDay"
      ]),
      values: Object.freeze({
        STORAGE_KEY: "string",
        BACKUP_KEY: "string"
      })
    }),

    TodayVersion: Object.freeze({
      methods: Object.freeze([
        "getCurrentVersion"
      ]),
      values: Object.freeze({
        APP_VERSION: "string",
        SCHEMA_VERSION: "number"
      })
    }),

    TodayMigration: Object.freeze({
      methods: Object.freeze([
        "validateDependencies",
        "inspect",
        "run",
        "getStatus"
      ]),
      values: Object.freeze({
        ORCHESTRATOR_VERSION:
          "number"
      })
    }),

    TodayDay: Object.freeze({
      methods: Object.freeze([
        "pad2",
        "todayKey",
        "parseKey",
        "prettyTR",
        "ymKey",
        "isSameDay",
        "getOrCreateDay",
        "getOrCreateLog"
      ]),
      values: Object.freeze({})
    }),

    TodayState: Object.freeze({
      methods: Object.freeze([
        "load",
        "save"
      ]),
      values: Object.freeze({
        APP_KEY: "string"
      })
    }),

    TodayAI: Object.freeze({
      methods: Object.freeze([
        "registerAdapter",
        "unregisterAdapter",
        "getStatus",
        "getCapabilities",
        "requestProposal"
      ]),
      values: Object.freeze({
        ADAPTER_INTERFACE_VERSION:
          "number"
      })
    }),

    TodayConnect: Object.freeze({
      methods: Object.freeze([
        "registerAdapter",
        "unregisterAdapter",
        "getStatus",
        "getCapabilities",
        "prepareAction",
        "approveAction",
        "cancelAction",
        "getPendingActions"
      ]),
      values: Object.freeze({
        ADAPTER_INTERFACE_VERSION:
          "number",
        MAX_PENDING_ACTIONS:
          "number"
      })
    })
  });

  let hasStarted = false;
  let serviceWorkerScheduled = false;

  let status = {
    phase: "idle",
    validatedModules: [],
    missingDependencies: [],
    errorCode: null,
    serviceWorker: "idle"
  };

  function getStatus() {
    return {
      phase: status.phase,
      validatedModules: [
        ...status.validatedModules
      ],
      missingDependencies: [
        ...status.missingDependencies
      ],
      errorCode: status.errorCode,
      serviceWorker: status.serviceWorker
    };
  }

  function validateDependencies(target = window) {
    const validatedModules = [];
    const missingDependencies = [];

    MODULE_ORDER.forEach((moduleName) => {
      const moduleApi = target[moduleName];
      const requirement =
        MODULE_REQUIREMENTS[moduleName];

      if (
        !moduleApi ||
        (
          typeof moduleApi !== "object" &&
          typeof moduleApi !== "function"
        )
      ) {
        missingDependencies.push(moduleName);
        return;
      }

      requirement.methods.forEach((methodName) => {
        if (typeof moduleApi[methodName] !== "function") {
          missingDependencies.push(
            `${moduleName}.${methodName}`
          );
        }
      });

      Object.entries(requirement.values).forEach(
        ([propertyName, expectedType]) => {
          if (
            typeof moduleApi[propertyName] !==
            expectedType
          ) {
            missingDependencies.push(
              `${moduleName}.${propertyName}`
            );
          }
        }
      );

      if (
        !missingDependencies.some((dependency) =>
          dependency === moduleName ||
          dependency.startsWith(`${moduleName}.`)
        )
      ) {
        validatedModules.push(moduleName);
      }
    });

    return {
      valid: missingDependencies.length === 0,
      validatedModules,
      missingDependencies
    };
  }

  function dispatch(name, detail) {
    if (
      typeof window.dispatchEvent !== "function" ||
      typeof window.CustomEvent !== "function"
    ) {
      return;
    }

    window.dispatchEvent(
      new window.CustomEvent(name, {
        detail
      })
    );
  }

  function removeFailureSurface() {
    const currentSurface =
      document.getElementById("todayStartupError");

    if (currentSurface) {
      currentSurface.remove();
    }
  }

  function showFailureSurface(errorCode) {
    removeFailureSurface();

    const mountTarget =
      document.body ||
      document.documentElement;

    if (!mountTarget) {
      return false;
    }

    const surface = document.createElement("main");
    surface.id = "todayStartupError";
    surface.setAttribute("role", "alert");
    surface.setAttribute("aria-live", "assertive");
    surface.setAttribute(
      "aria-labelledby",
      "todayStartupErrorTitle"
    );
    surface.setAttribute(
      "aria-describedby",
      "todayStartupErrorText"
    );
    surface.tabIndex = -1;
    surface.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483647",
      "display:grid",
      "place-items:center",
      "padding:24px",
      "background:#0b0f17",
      "color:#f5f7fb",
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    ].join(";");

    const card = document.createElement("section");
    card.style.cssText = [
      "width:min(100%,440px)",
      "padding:24px",
      "border:1px solid rgba(255,255,255,.16)",
      "border-radius:20px",
      "background:#151b27",
      "box-shadow:0 18px 60px rgba(0,0,0,.38)"
    ].join(";");

    const title = document.createElement("h1");
    title.id = "todayStartupErrorTitle";
    title.textContent = "Today başlatılamadı";
    title.style.cssText = [
      "margin:0 0 12px",
      "font-size:24px",
      "line-height:1.25"
    ].join(";");

    const text = document.createElement("p");
    text.id = "todayStartupErrorText";
    text.textContent =
      typeof errorCode === "string" &&
      errorCode.startsWith(
        "TODAY-MIGRATION-"
      )
        ? (
            "Veriler güvenli biçimde hazırlanamadı. " +
            "Mevcut kayıtların ve güvenlik kopyan korundu. " +
            "Yeniden dene."
          )
        : (
            "Uygulama dosyalarından biri yüklenemedi. " +
            "Kayıtların silinmedi. İnternet bağlantını " +
            "kontrol edip yeniden dene."
          );
    text.style.cssText = [
      "margin:0 0 20px",
      "color:#cbd3df",
      "font-size:16px",
      "line-height:1.55"
    ].join(";");

    const retryButton =
      document.createElement("button");
    retryButton.type = "button";
    retryButton.textContent = "Yeniden dene";
    retryButton.style.cssText = [
      "width:100%",
      "min-height:48px",
      "border:0",
      "border-radius:14px",
      "padding:12px 18px",
      "background:#eef3ff",
      "color:#111827",
      "font:inherit",
      "font-weight:700",
      "cursor:pointer"
    ].join(";");
    retryButton.addEventListener(
      "click",
      () => window.location.reload(),
      { once: true }
    );

    const code = document.createElement("p");
    code.textContent = `Başlangıç kodu: ${errorCode}`;
    code.style.cssText = [
      "margin:14px 0 0",
      "color:#8994a6",
      "font-size:12px",
      "line-height:1.4"
    ].join(";");

    card.append(title, text, retryButton, code);
    surface.appendChild(card);
    mountTarget.appendChild(surface);

    const moveFocus = () => {
      try {
        surface.focus({
          preventScroll: true
        });
      } catch (error) {
        surface.focus();
      }
    };

    if (
      typeof window.requestAnimationFrame ===
      "function"
    ) {
      window.requestAnimationFrame(moveFocus);
    } else {
      moveFocus();
    }

    return true;
  }

  function fail(errorCode, message, details = {}) {
    status = {
      ...status,
      phase: "failed",
      validatedModules:
        details.validatedModules || [],
      missingDependencies:
        details.missingDependencies || [],
      errorCode
    };

    console.error(
      `Today Startup: ${message}`,
      details.error || details
    );

    showFailureSurface(
  `${errorCode} — ${
    details.error?.name || "Error"
  }: ${
    details.error?.message ||
    details.missingDependencies?.join(", ") ||
    message
  }`
);

    dispatch("today:startup-error", {
      errorCode,
      missingDependencies: [
        ...status.missingDependencies
      ]
    });

    return {
      success: false,
      status: getStatus()
    };
  }

  function scheduleServiceWorkerRegistration(
    serviceWorkerUrl
  ) {
    if (serviceWorkerScheduled) {
      return;
    }

    serviceWorkerScheduled = true;

    if (
      !window.navigator ||
      !("serviceWorker" in window.navigator)
    ) {
      status = {
        ...status,
        serviceWorker: "unsupported"
      };
      return;
    }

    status = {
      ...status,
      serviceWorker: "scheduled"
    };

    const register = () => {
      status = {
        ...status,
        serviceWorker: "registering"
      };

      const updateManager =
        window.TodayServiceWorker;
      const managerAvailable = Boolean(
        updateManager &&
        typeof updateManager.start ===
          "function"
      );
      const registrationTask =
        Promise.resolve().then(
          () =>
            managerAvailable
              ? updateManager.start({
                  scriptUrl:
                    serviceWorkerUrl
                })
              : window.navigator.serviceWorker
                  .register(
                    serviceWorkerUrl
                  )
        );

      Promise.resolve(
        registrationTask
      )
        .then((result) => {
          if (
            result &&
            result.success === false
          ) {
            throw new Error(
              result.errorCode ||
              "TODAY-SW-REGISTER-001"
            );
          }

          status = {
            ...status,
            serviceWorker: "registered"
          };

          dispatch(
            "today:service-worker-ready",
            {
              scriptUrl:
                serviceWorkerUrl,
              managed:
                managerAvailable,
              registration:
                result &&
                result.registration
                  ? result.registration
                  : (
                      managerAvailable
                        ? null
                        : result
                    )
            }
          );

          if (!managerAvailable) {
            dispatch(
              "today:service-worker-update-error",
              {
                errorCode:
                  "TODAY-SW-UPDATE-010",
                stage: "manager"
              }
            );
          }
        })
        .catch((error) => {
          status = {
            ...status,
            serviceWorker: "failed"
          };

          console.warn(
            "Today Startup: Service Worker kaydedilemedi.",
            error
          );

          dispatch(
            "today:service-worker-error",
            {
              scriptUrl: serviceWorkerUrl
            }
          );
        });
    };

    if (document.readyState === "complete") {
      Promise.resolve().then(register);
      return;
    }

    window.addEventListener(
      "load",
      register,
      { once: true }
    );
  }

  function start(options = {}) {
    if (hasStarted) {
      return {
        success: status.phase === "ready",
        alreadyStarted: true,
        status: getStatus()
      };
    }

    hasStarted = true;

    const objectOptions =
      options &&
      typeof options === "object"
        ? options
        : {};

    const initialize =
      typeof options === "function"
        ? options
        : objectOptions.initialize;

    const serviceWorkerUrl =
      typeof objectOptions.serviceWorkerUrl ===
      "string"
        ? objectOptions.serviceWorkerUrl
        : "./sw.js";

    status = {
      ...status,
      phase: "validating",
      errorCode: null
    };

    scheduleServiceWorkerRegistration(
      serviceWorkerUrl
    );

    const validation = validateDependencies();

    if (!validation.valid) {
      return fail(
        "TODAY-STARTUP-001",
        "Kritik modül sözleşmesi eksik.",
        validation
      );
    }

    if (typeof initialize !== "function") {
      return fail(
        "TODAY-STARTUP-002",
        "Uygulama başlatıcısı bulunamadı.",
        validation
      );
    }

    status = {
      ...status,
      phase: "initializing",
      validatedModules:
        validation.validatedModules,
      missingDependencies: []
    };

    try {
      const value = initialize({
        moduleOrder: [
          ...MODULE_ORDER
        ]
      });

      status = {
        ...status,
        phase: "ready"
      };

      removeFailureSurface();

      dispatch("today:startup-ready", {
        moduleOrder: [
          ...MODULE_ORDER
        ]
      });

      return {
        success: true,
        value,
        status: getStatus()
      };
    } catch (error) {
      const errorCode =
        typeof error?.todayCode ===
          "string" &&
        error.todayCode.startsWith(
          "TODAY-MIGRATION-"
        )
          ? error.todayCode
          : "TODAY-STARTUP-003";

      return fail(
        errorCode,
        errorCode.startsWith(
          "TODAY-MIGRATION-"
        )
          ? "Veri şeması hazırlanırken hata oluştu."
          : "Uygulama başlatılırken hata oluştu.",
        {
          ...validation,
          error
        }
      );
    }
  }

  window.TodayStartup = Object.freeze({
    MODULE_ORDER,
    validateDependencies,
    getStatus,
    start
  });

  console.info("Today Startup Manager hazır.");
})();
