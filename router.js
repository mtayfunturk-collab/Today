/**
 * Today App v2
 * View and Routing Layer
 * TB-013 — Platform Architecture
 *
 * Amaç:
 * - Uygulamadaki görünüm geçişlerini tek sözleşmede toplamak
 * - Altı fiziksel görünümü sekiz mantıksal rota olarak yönetmek
 * - Tarayıcı/PWA geri hareketini görünüm durumuyla eşlemek
 * - Odak ve aria-hidden davranışlarını merkezi olarak korumak
 */

(function () {
  "use strict";

  const ROUTER_VERSION = 1;
  const ROUTER_MARKER = "today-router-v1";

  const ROUTES = Object.freeze({
    home: Object.freeze({
      name: "home",
      view: "home",
      parent: null,
      panel: null,
      focusSelector: null
    }),

    modules: Object.freeze({
      name: "modules",
      view: "modules",
      parent: "home",
      panel: null,
      focusSelector: null
    }),

    pick: Object.freeze({
      name: "pick",
      view: "pick",
      parent: "modules",
      panel: null,
      focusSelector: null
    }),

    health: Object.freeze({
      name: "health",
      view: "health",
      parent: "modules",
      panel: null,
      focusSelector: null
    }),

    sky: Object.freeze({
      name: "sky",
      view: "sky",
      parent: "modules",
      panel: null,
      focusSelector: null
    }),

    calendar: Object.freeze({
      name: "calendar",
      view: "calendar",
      parent: "pick",
      panel: null,
      focusSelector: null
    }),

    statistics: Object.freeze({
      name: "statistics",
      view: "calendar",
      parent: "calendar",
      panel: "statistics",
      focusSelector: "#accStatsHead"
    }),

    settings: Object.freeze({
      name: "settings",
      view: "calendar",
      parent: "calendar",
      panel: "settings",
      focusSelector: "#accSettingsHead"
    })
  });

  const ROUTE_NAMES = Object.freeze(
    Object.keys(ROUTES)
  );

  let initialized = false;
  let currentRoute = null;
  let currentIndex = 0;
  let routeHistory = [];
  let historyEnabled = false;
  let popstateBound = false;
  let onRouteChange = null;
  let viewsByName = new Map();
  let lastErrorCode = null;

  function isValidRoute(routeName) {
    return (
      typeof routeName === "string" &&
      Object.prototype.hasOwnProperty.call(
        ROUTES,
        routeName
      )
    );
  }

  function getRoute(routeName) {
    return isValidRoute(routeName)
      ? ROUTES[routeName]
      : null;
  }

  function getState() {
    const route = getRoute(currentRoute);

    return Object.freeze({
      initialized,
      route: currentRoute,
      view: route ? route.view : null,
      parent: route ? route.parent : null,
      panel: route ? route.panel : null,
      historyIndex: currentIndex,
      historyDepth: routeHistory.length,
      historyEnabled,
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

    dispatch("today:routeerror", result);

    return result;
  }

  function validateViews(target = document) {
    if (
      !target ||
      typeof target.querySelectorAll !== "function"
    ) {
      return {
        valid: false,
        views: new Map(),
        missingViews: [
          ...new Set(
            ROUTE_NAMES.map(
              routeName => ROUTES[routeName].view
            )
          )
        ],
        duplicateViews: []
      };
    }

    const views = new Map();
    const duplicateViews = [];

    Array.from(
      target.querySelectorAll("[data-view]")
    ).forEach((view) => {
      const viewName =
        view.getAttribute("data-view");

      if (!viewName) {
        return;
      }

      if (views.has(viewName)) {
        duplicateViews.push(viewName);
        return;
      }

      views.set(viewName, view);
    });

    const requiredViews = [
      ...new Set(
        ROUTE_NAMES.map(
          routeName => ROUTES[routeName].view
        )
      )
    ];

    const missingViews = requiredViews.filter(
      viewName => !views.has(viewName)
    );

    return {
      valid:
        missingViews.length === 0 &&
        duplicateViews.length === 0,
      views,
      missingViews,
      duplicateViews
    };
  }

  function focusElement(element) {
    if (
      !element ||
      typeof element.focus !== "function"
    ) {
      return false;
    }

    try {
      element.focus({
        preventScroll: true
      });
    } catch (error) {
      element.focus();
    }

    return true;
  }

  function getFocusTarget(routeName) {
    const route = getRoute(routeName);

    if (!route) {
      return null;
    }

    const activeView =
      viewsByName.get(route.view);

    if (!activeView) {
      return null;
    }

    if (
      route.focusSelector &&
      typeof document.querySelector === "function"
    ) {
      const routeTarget =
        document.querySelector(
          route.focusSelector
        );

      if (routeTarget) {
        return routeTarget;
      }
    }

    if (
      typeof activeView.querySelector === "function"
    ) {
      return (
        activeView.querySelector(
          "[data-view-title]"
        ) ||
        activeView
      );
    }

    return activeView;
  }

  function focusCurrent() {
    return focusElement(
      getFocusTarget(currentRoute)
    );
  }

  function scheduleFocus(routeName) {
    const run = () => {
      if (currentRoute !== routeName) {
        return;
      }

      focusElement(
        getFocusTarget(routeName)
      );
    };

    if (
      typeof window.requestAnimationFrame ===
      "function"
    ) {
      window.requestAnimationFrame(run);
      return;
    }

    run();
  }

  function setBodyRoute(routeName) {
    if (!document.body) {
      return;
    }

    if (document.body.dataset) {
      document.body.dataset.route = routeName;
      return;
    }

    document.body.setAttribute(
      "data-route",
      routeName
    );
  }

  function createHistoryState(routeName, index) {
    const existingState =
      window.history &&
      window.history.state &&
      typeof window.history.state === "object"
        ? window.history.state
        : {};

    return {
      ...existingState,
      todayRouter: ROUTER_MARKER,
      todayRoute: routeName,
      todayRouteIndex: index
    };
  }

  function writeHistory(routeName, index, mode) {
    if (!historyEnabled || mode === "none") {
      return true;
    }

    try {
      const state =
        createHistoryState(routeName, index);

      if (mode === "replace") {
        window.history.replaceState(
          state,
          document.title
        );
      } else {
        window.history.pushState(
          state,
          document.title
        );
      }

      return true;
    } catch (error) {
      historyEnabled = false;

      dispatch("today:routehistoryerror", {
        route: routeName,
        mode,
        message:
          error && error.message
            ? error.message
            : String(error)
      });

      return false;
    }
  }

  function notifyRouteChange(detail) {
    if (typeof onRouteChange === "function") {
      try {
        onRouteChange(detail);
      } catch (error) {
        fail(
          "TODAY-ROUTER-004",
          "Rota değişikliği işleyicisi tamamlanamadı.",
          {
            route: detail.to,
            cause:
              error && error.message
                ? error.message
                : String(error)
          }
        );
      }
    }

    dispatch("today:routechange", detail);
  }

  function activateRoute(
    routeName,
    {
      moveFocus = true,
      source = "app"
    } = {}
  ) {
    const route = getRoute(routeName);

    if (!route) {
      return fail(
        "TODAY-ROUTER-001",
        `Bilinmeyen rota: ${String(routeName)}`,
        {
          route: routeName
        }
      );
    }

    const activeView =
      viewsByName.get(route.view);

    if (!activeView) {
      return fail(
        "TODAY-ROUTER-002",
        `Rota görünümü bulunamadı: ${route.view}`,
        {
          route: routeName,
          view: route.view
        }
      );
    }

    const previousRoute = currentRoute;

    viewsByName.forEach((view) => {
      const isActive =
        view === activeView;

      view.classList.toggle(
        "show",
        isActive
      );
      view.setAttribute(
        "aria-hidden",
        String(!isActive)
      );
    });

    currentRoute = routeName;
    lastErrorCode = null;
    setBodyRoute(routeName);

    const detail = Object.freeze({
      from: previousRoute,
      to: routeName,
      view: route.view,
      panel: route.panel,
      parent: route.parent,
      source,
      historyIndex: currentIndex
    });

    notifyRouteChange(detail);

    if (moveFocus) {
      scheduleFocus(routeName);
    }

    return Object.freeze({
      success: true,
      changed: previousRoute !== routeName,
      ...getState()
    });
  }

  function navigate(
    routeName,
    {
      replace = false,
      moveFocus = true,
      source = "app"
    } = {}
  ) {
    if (!initialized) {
      return fail(
        "TODAY-ROUTER-003",
        "Today Router henüz başlatılmadı.",
        {
          route: routeName
        }
      );
    }

    if (!isValidRoute(routeName)) {
      return fail(
        "TODAY-ROUTER-001",
        `Bilinmeyen rota: ${String(routeName)}`,
        {
          route: routeName
        }
      );
    }

    if (routeName === currentRoute) {
      if (moveFocus) {
        scheduleFocus(routeName);
      }

      return Object.freeze({
        success: true,
        changed: false,
        ...getState()
      });
    }

    if (replace) {
      routeHistory[currentIndex] =
        routeName;
      writeHistory(
        routeName,
        currentIndex,
        "replace"
      );
    } else {
      routeHistory = routeHistory.slice(
        0,
        currentIndex + 1
      );
      currentIndex += 1;
      routeHistory[currentIndex] =
        routeName;
      writeHistory(
        routeName,
        currentIndex,
        "push"
      );
    }

    return activateRoute(routeName, {
      moveFocus,
      source
    });
  }

  function findPreviousRouteIndex(routeName) {
    for (
      let index = currentIndex - 1;
      index >= 0;
      index -= 1
    ) {
      if (routeHistory[index] === routeName) {
        return index;
      }
    }

    return -1;
  }

  function backTo(
    routeName,
    {
      moveFocus = true,
      source = "app-back"
    } = {}
  ) {
    if (!initialized) {
      return fail(
        "TODAY-ROUTER-003",
        "Today Router henüz başlatılmadı.",
        {
          route: routeName
        }
      );
    }

    if (!isValidRoute(routeName)) {
      return fail(
        "TODAY-ROUTER-001",
        `Bilinmeyen geri dönüş rotası: ${String(routeName)}`,
        {
          route: routeName
        }
      );
    }

    if (routeName === currentRoute) {
      return Object.freeze({
        success: true,
        changed: false,
        ...getState()
      });
    }

    const targetIndex =
      findPreviousRouteIndex(routeName);

    if (
      historyEnabled &&
      targetIndex >= 0 &&
      typeof window.history.go === "function"
    ) {
      window.history.go(
        targetIndex - currentIndex
      );

      return Object.freeze({
        success: true,
        changed: true,
        pending: true,
        route: routeName,
        historyIndex: targetIndex
      });
    }

    return navigate(routeName, {
      replace: true,
      moveFocus,
      source
    });
  }

  function back({
    fallbackRoute,
    moveFocus = true
  } = {}) {
    if (!initialized) {
      return fail(
        "TODAY-ROUTER-003",
        "Today Router henüz başlatılmadı."
      );
    }

    if (
      historyEnabled &&
      currentIndex > 0 &&
      typeof window.history.back ===
      "function"
    ) {
      window.history.back();

      return Object.freeze({
        success: true,
        changed: true,
        pending: true,
        historyIndex: currentIndex - 1
      });
    }

    const route = getRoute(currentRoute);
    const targetRoute =
      fallbackRoute ||
      (route && route.parent) ||
      "home";

    return navigate(targetRoute, {
      replace: true,
      moveFocus,
      source: "app-back"
    });
  }

  function handlePopState(event) {
    const eventState =
      event && event.state;

    if (
      !eventState ||
      eventState.todayRouter !==
        ROUTER_MARKER ||
      !isValidRoute(eventState.todayRoute)
    ) {
      return;
    }

    const nextIndex =
      Number.isInteger(
        eventState.todayRouteIndex
      ) &&
      eventState.todayRouteIndex >= 0
        ? eventState.todayRouteIndex
        : 0;

    currentIndex = nextIndex;
    routeHistory[nextIndex] =
      eventState.todayRoute;

    activateRoute(
      eventState.todayRoute,
      {
        moveFocus: true,
        source: "popstate"
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

    const initialRoute =
      isValidRoute(options.initialRoute)
        ? options.initialRoute
        : "home";

    const validation =
      validateViews(document);

    if (!validation.valid) {
      return fail(
        "TODAY-ROUTER-002",
        "Today görünüm sözleşmesi doğrulanamadı.",
        {
          missingViews:
            validation.missingViews,
          duplicateViews:
            validation.duplicateViews
        }
      );
    }

    viewsByName = validation.views;
    onRouteChange =
      typeof options.onRouteChange ===
      "function"
        ? options.onRouteChange
        : null;

    historyEnabled =
      options.history !== false &&
      Boolean(
        window.history &&
        typeof window.history.pushState ===
          "function" &&
        typeof window.history.replaceState ===
          "function"
      );

    currentIndex = 0;
    routeHistory = [initialRoute];
    initialized = true;

    if (
      !popstateBound &&
      typeof window.addEventListener ===
        "function"
    ) {
      window.addEventListener(
        "popstate",
        handlePopState
      );
      popstateBound = true;
    }

    writeHistory(
      initialRoute,
      currentIndex,
      "replace"
    );

    return activateRoute(initialRoute, {
      moveFocus:
        options.moveFocus !== false,
      source: "init"
    });
  }

  window.TodayRouter = Object.freeze({
    ROUTER_VERSION,
    ROUTES,
    ROUTE_NAMES,
    init,
    navigate,
    back,
    backTo,
    focusCurrent,
    getRoute,
    getState,
    isValidRoute,
    validateViews
  });
})();
