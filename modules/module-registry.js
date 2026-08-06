/**
 * Today App v2
 * Module Registry
 * TB-014 — Platform Architecture
 *
 * Amaç:
 * - Görünür Today modüllerini tek bir değişmez kayıtta toplamak
 * - Modül kimliklerini Today Router rotalarıyla doğrulamak
 * - Modül kartları ile alt navigasyonu tek olay kapısından yönetmek
 * - Bilinmeyen veya yinelenen modülleri kontrollü biçimde reddetmek
 */

(function () {
  "use strict";

  const REGISTRY_VERSION = 1;

  const MODULES = Object.freeze([
    Object.freeze({
      id: "core",
      route: "pick",
      view: "pick"
    }),

    Object.freeze({
      id: "health",
      route: "health",
      view: "health"
    }),

    Object.freeze({
      id: "sky",
      route: "sky",
      view: "sky"
    })
  ]);

  const MODULE_IDS = Object.freeze(
    MODULES.map(module => module.id)
  );

  const modulesById = new Map(
    MODULES.map(module => [
      module.id,
      module
    ])
  );

  let initialized = false;
  let routerApi = null;
  let eventRoot = null;
  let clickBound = false;
  let triggerCount = 0;
  let lastErrorCode = null;

  function copyList(values) {
    return Array.isArray(values)
      ? [...values]
      : [];
  }

  function normalizeId(moduleId) {
    return typeof moduleId === "string"
      ? moduleId.trim().toLowerCase()
      : "";
  }

  function list() {
    return Object.freeze([
      ...MODULES
    ]);
  }

  function get(moduleId) {
    return (
      modulesById.get(
        normalizeId(moduleId)
      ) ||
      null
    );
  }

  function has(moduleId) {
    return get(moduleId) !== null;
  }

  function getState() {
    return Object.freeze({
      initialized,
      moduleIds: [
        ...MODULE_IDS
      ],
      moduleCount: MODULES.length,
      triggerCount,
      clickBound,
      errorCode: lastErrorCode
    });
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

  function fail(errorCode, message, detail = {}) {
    lastErrorCode = errorCode;

    const result = Object.freeze({
      success: false,
      errorCode,
      message,
      ...detail
    });

    if (
      window.console &&
      typeof window.console.error === "function"
    ) {
      window.console.error(
        `[${errorCode}] ${message}`,
        detail
      );
    }

    dispatch(
      "today:moduleerror",
      result
    );

    return result;
  }

  function validateDefinitions(
    definitions = MODULES
  ) {
    const errors = [];
    const ids = new Set();
    const routes = new Set();

    if (!Array.isArray(definitions)) {
      return {
        valid: false,
        errors: [
          "definitions:not-array"
        ],
        moduleIds: []
      };
    }

    definitions.forEach(
      (definition, index) => {
        if (
          !definition ||
          typeof definition !== "object"
        ) {
          errors.push(
            `definition:${index}:invalid`
          );
          return;
        }

        const id =
          normalizeId(definition.id);
        const route =
          typeof definition.route === "string"
            ? definition.route.trim()
            : "";
        const view =
          typeof definition.view === "string"
            ? definition.view.trim()
            : "";

        if (!/^[a-z][a-z0-9-]*$/.test(id)) {
          errors.push(
            `definition:${index}:id`
          );
        }

        if (!route) {
          errors.push(
            `definition:${index}:route`
          );
        }

        if (!view) {
          errors.push(
            `definition:${index}:view`
          );
        }

        if (id && ids.has(id)) {
          errors.push(
            `module:${id}:duplicate`
          );
        }

        if (route && routes.has(route)) {
          errors.push(
            `route:${route}:duplicate`
          );
        }

        if (id) {
          ids.add(id);
        }

        if (route) {
          routes.add(route);
        }
      }
    );

    return {
      valid: errors.length === 0,
      errors,
      moduleIds: [
        ...ids
      ]
    };
  }

  function validateRouter(candidate) {
    const missingMethods = [
      "navigate",
      "isValidRoute",
      "getRoute"
    ].filter(
      methodName =>
        !candidate ||
        typeof candidate[methodName] !==
          "function"
    );

    const invalidRoutes = [];
    const viewMismatches = [];

    if (missingMethods.length === 0) {
      MODULES.forEach(module => {
        if (
          !candidate.isValidRoute(
            module.route
          )
        ) {
          invalidRoutes.push(
            module.route
          );
          return;
        }

        const route =
          candidate.getRoute(
            module.route
          );

        if (
          !route ||
          route.view !== module.view
        ) {
          viewMismatches.push(
            `${module.id}:${module.view}`
          );
        }
      });
    }

    return {
      valid:
        missingMethods.length === 0 &&
        invalidRoutes.length === 0 &&
        viewMismatches.length === 0,
      missingMethods,
      invalidRoutes,
      viewMismatches
    };
  }

  function getTriggerModuleId(trigger) {
    if (
      !trigger ||
      typeof trigger.getAttribute !==
        "function"
    ) {
      return "";
    }

    return normalizeId(
      trigger.getAttribute(
        "data-module"
      ) ||
      trigger.getAttribute(
        "data-open-module"
      )
    );
  }

  function validateDom(
    target = document
  ) {
    if (
      !target ||
      typeof target.querySelectorAll !==
        "function"
    ) {
      return {
        valid: false,
        cards: [],
        openTriggers: [],
        missingCards: [
          ...MODULE_IDS
        ],
        duplicateCards: [],
        missingOpenTriggers: [
          ...MODULE_IDS
        ],
        unknownTriggers: [],
        conflictingTriggers: []
      };
    }

    const cards = Array.from(
      target.querySelectorAll(
        "[data-module]"
      )
    );
    const openTriggers = Array.from(
      target.querySelectorAll(
        "[data-open-module]"
      )
    );
    const cardCounts = new Map();
    const openCounts = new Map();
    const unknownTriggers = [];
    const conflictingTriggers = [];

    cards.forEach(card => {
      const moduleId =
        getTriggerModuleId(card);

      if (!has(moduleId)) {
        unknownTriggers.push(
          moduleId || "(empty)"
        );
        return;
      }

      cardCounts.set(
        moduleId,
        (cardCounts.get(moduleId) || 0) + 1
      );
    });

    openTriggers.forEach(trigger => {
      const moduleId =
        getTriggerModuleId(trigger);

      if (!has(moduleId)) {
        unknownTriggers.push(
          moduleId || "(empty)"
        );
        return;
      }

      openCounts.set(
        moduleId,
        (openCounts.get(moduleId) || 0) + 1
      );
    });

    [
      ...new Set([
        ...cards,
        ...openTriggers
      ])
    ].forEach(trigger => {
      const cardId = normalizeId(
        trigger.getAttribute(
          "data-module"
        )
      );
      const openId = normalizeId(
        trigger.getAttribute(
          "data-open-module"
        )
      );

      if (
        cardId &&
        openId &&
        cardId !== openId
      ) {
        conflictingTriggers.push(
          `${cardId}:${openId}`
        );
      }
    });

    const missingCards =
      MODULE_IDS.filter(
        moduleId =>
          !cardCounts.has(moduleId)
      );
    const duplicateCards =
      MODULE_IDS.filter(
        moduleId =>
          (cardCounts.get(moduleId) || 0) > 1
      );
    const missingOpenTriggers =
      MODULE_IDS.filter(
        moduleId =>
          !openCounts.has(moduleId)
      );

    return {
      valid:
        missingCards.length === 0 &&
        duplicateCards.length === 0 &&
        missingOpenTriggers.length === 0 &&
        unknownTriggers.length === 0 &&
        conflictingTriggers.length === 0,
      cards,
      openTriggers,
      missingCards,
      duplicateCards,
      missingOpenTriggers,
      unknownTriggers,
      conflictingTriggers
    };
  }

  function validate({
    router = window.TodayRouter,
    root = document
  } = {}) {
    const definitions =
      validateDefinitions();
    const routerContract =
      validateRouter(router);
    const dom =
      validateDom(root);

    return {
      valid:
        definitions.valid &&
        routerContract.valid &&
        dom.valid,
      definitions,
      router: routerContract,
      dom
    };
  }

  function open(
    moduleId,
    options = {}
  ) {
    if (!initialized || !routerApi) {
      return fail(
        "TODAY-MODULES-004",
        "Today modül kaydı henüz başlatılmadı."
      );
    }

    const module = get(moduleId);

    if (!module) {
      return fail(
        "TODAY-MODULES-005",
        "Bilinmeyen Today modülü reddedildi.",
        {
          moduleId:
            normalizeId(moduleId)
        }
      );
    }

    const routeResult =
      routerApi.navigate(
        module.route,
        {
          replace:
            options.replace === true,
          moveFocus:
            options.moveFocus !== false,
          source:
            typeof options.source ===
              "string"
              ? options.source
              : "module-registry"
        }
      );

    if (
      !routeResult ||
      routeResult.success === false
    ) {
      return fail(
        "TODAY-MODULES-006",
        "Today modül rotası açılamadı.",
        {
          moduleId: module.id,
          route: module.route,
          routeError:
            routeResult &&
            routeResult.errorCode
              ? routeResult.errorCode
              : null
        }
      );
    }

    const result = Object.freeze({
      success: true,
      moduleId: module.id,
      route: module.route,
      changed:
        routeResult.changed !== false,
      routeResult
    });

    dispatch(
      "today:moduleopen",
      result
    );

    return result;
  }

  function findTrigger(target) {
    const element =
      target &&
      typeof target.closest === "function"
        ? target
        : target &&
            target.parentElement &&
            typeof target.parentElement.closest ===
              "function"
          ? target.parentElement
          : null;

    if (!element) {
      return null;
    }

    return element.closest(
      "[data-module], [data-open-module]"
    );
  }

  function handleClick(event) {
    const trigger =
      findTrigger(
        event && event.target
      );

    if (!trigger) {
      return;
    }

    if (
      trigger.disabled === true ||
      trigger.getAttribute(
        "aria-disabled"
      ) === "true"
    ) {
      return;
    }

    if (
      event &&
      typeof event.preventDefault ===
        "function"
    ) {
      event.preventDefault();
    }

    open(
      getTriggerModuleId(trigger),
      {
        source:
          trigger.getAttribute(
            "data-module"
          )
            ? "module-card"
            : "module-navigation"
      }
    );
  }

  function init(options = {}) {
    if (initialized) {
      return Object.freeze({
        success: true,
        changed: false,
        ...getState()
      });
    }

    const candidateRouter =
      options.router ||
      window.TodayRouter;
    const candidateRoot =
      options.root ||
      document;
    const validation = validate({
      router: candidateRouter,
      root: candidateRoot
    });

    if (!validation.definitions.valid) {
      return fail(
        "TODAY-MODULES-001",
        "Today modül tanımları doğrulanamadı.",
        {
          errors: copyList(
            validation.definitions.errors
          )
        }
      );
    }

    if (!validation.router.valid) {
      return fail(
        "TODAY-MODULES-002",
        "Today Router modül sözleşmesini karşılamıyor.",
        {
          missingMethods: copyList(
            validation.router.missingMethods
          ),
          invalidRoutes: copyList(
            validation.router.invalidRoutes
          ),
          viewMismatches: copyList(
            validation.router.viewMismatches
          )
        }
      );
    }

    if (!validation.dom.valid) {
      return fail(
        "TODAY-MODULES-003",
        "Today modül görünümü sözleşmesi doğrulanamadı.",
        {
          missingCards: copyList(
            validation.dom.missingCards
          ),
          duplicateCards: copyList(
            validation.dom.duplicateCards
          ),
          missingOpenTriggers: copyList(
            validation.dom.missingOpenTriggers
          ),
          unknownTriggers: copyList(
            validation.dom.unknownTriggers
          ),
          conflictingTriggers: copyList(
            validation.dom.conflictingTriggers
          )
        }
      );
    }

    routerApi = candidateRouter;
    eventRoot = candidateRoot;
    triggerCount =
      validation.dom.cards.length +
      validation.dom.openTriggers.length;

    if (
      !clickBound &&
      eventRoot &&
      typeof eventRoot.addEventListener ===
        "function"
    ) {
      eventRoot.addEventListener(
        "click",
        handleClick
      );
      clickBound = true;
    }

    if (!clickBound) {
      routerApi = null;
      eventRoot = null;
      triggerCount = 0;

      return fail(
        "TODAY-MODULES-003",
        "Today modül olay kapısı kurulamadı."
      );
    }

    initialized = true;
    lastErrorCode = null;

    const result = Object.freeze({
      success: true,
      changed: true,
      ...getState()
    });

    dispatch(
      "today:modules-ready",
      result
    );

    return result;
  }

  window.TodayModules = Object.freeze({
    REGISTRY_VERSION,
    MODULES,
    MODULE_IDS,
    init,
    open,
    get,
    has,
    list,
    getState,
    validate,
    validateDefinitions,
    validateDom,
    validateRouter
  });
})();
