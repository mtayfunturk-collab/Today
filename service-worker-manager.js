/**
 * Today App v2
 * Service Worker Update Manager
 * TB-017 — Platform Architecture
 *
 * Amaç:
 * - Service Worker kaydını tek bir çalışma zamanı kapısından yönetmek
 * - Yeni worker hazır olduğunda kullanıcıya erişilebilir bir bildirim göstermek
 * - Güncellemeyi yalnız açık kullanıcı onayından sonra etkinleştirmek
 * - İlk kurulumda veya denetleyici değişiminde habersiz yeniden yüklemeyi önlemek
 */

(function () {
  "use strict";

  const MANAGER_VERSION = 1;
  const ACTIVATE_MESSAGE =
    "TODAY_ACTIVATE_UPDATE";

  let initialized = false;
  let listenersBound = false;
  let targetWindow = window;
  let targetDocument = document;
  let targetNavigator = window.navigator;
  let registration = null;
  let registrationPromise = null;
  let discoveryPromise = null;
  let waitingWorker = null;
  let announcedWorker = null;
  let observedRegistration = null;
  const observedWorkers = new WeakSet();

  let status = {
    phase: "idle",
    supported: null,
    registered: false,
    updateAvailable: false,
    deferred: false,
    userAccepted: false,
    reloadTriggered: false,
    workerState: null,
    errorCode: null
  };

  function setStatus(patch = {}) {
    status = {
      ...status,
      ...patch
    };
  }

  function getState() {
    return Object.freeze({
      initialized,
      listenersBound,
      phase: status.phase,
      supported: status.supported,
      registered: status.registered,
      updateAvailable:
        status.updateAvailable,
      deferred: status.deferred,
      userAccepted:
        status.userAccepted,
      reloadTriggered:
        status.reloadTriggered,
      workerState: status.workerState,
      errorCode: status.errorCode
    });
  }

  function dispatch(name, detail = {}) {
    if (
      !targetWindow ||
      typeof targetWindow.dispatchEvent !==
        "function" ||
      typeof targetWindow.CustomEvent !==
        "function"
    ) {
      return false;
    }

    targetWindow.dispatchEvent(
      new targetWindow.CustomEvent(name, {
        detail
      })
    );

    return true;
  }

  function errorName(error) {
    return error &&
      typeof error.name === "string"
      ? error.name.slice(0, 80)
      : "Error";
  }

  function reportUpdateError(
    errorCode,
    stage,
    error
  ) {
    setStatus({
      errorCode
    });

    dispatch(
      "today:service-worker-update-error",
      {
        errorCode,
        stage,
        workerState:
          waitingWorker &&
          typeof waitingWorker.state ===
            "string"
            ? waitingWorker.state
            : status.workerState,
        errorName: errorName(error)
      }
    );
  }

  function getNoticeSurface() {
    return targetDocument &&
      typeof targetDocument.getElementById ===
        "function"
      ? targetDocument.getElementById(
          "todayUpdateNotice"
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
    surface.id = "todayUpdateNotice";
    surface.hidden = true;
    surface.setAttribute(
      "role",
      "status"
    );
    surface.setAttribute(
      "aria-live",
      "polite"
    );
    surface.setAttribute(
      "aria-atomic",
      "true"
    );
    surface.setAttribute(
      "aria-hidden",
      "true"
    );
    surface.setAttribute(
      "aria-labelledby",
      "todayUpdateTitle"
    );
    surface.setAttribute(
      "aria-describedby",
      "todayUpdateText"
    );
    surface.style.cssText = [
      "position:fixed",
      "left:16px",
      "right:16px",
      "bottom:max(16px,env(safe-area-inset-bottom))",
      "z-index:2147483645",
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

    const title =
      targetDocument.createElement("h2");
    title.id = "todayUpdateTitle";
    title.textContent =
      "Yeni sürüm hazır";
    title.style.cssText = [
      "margin:0",
      "font-size:18px",
      "line-height:1.35"
    ].join(";");

    const text =
      targetDocument.createElement("p");
    text.id = "todayUpdateText";
    text.textContent =
      "Today’in yeni sürümü indirildi. " +
      "Güncelleme, sen onayladığında uygulanacak.";
    text.style.cssText = [
      "margin:8px 0 0",
      "color:#cbd3df",
      "font-size:15px",
      "line-height:1.5"
    ].join(";");

    const actions =
      targetDocument.createElement("div");
    actions.style.cssText = [
      "display:flex",
      "flex-wrap:wrap",
      "gap:10px",
      "margin-top:14px"
    ].join(";");

    const applyButton =
      targetDocument.createElement("button");
    applyButton.id = "todayUpdateApply";
    applyButton.type = "button";
    applyButton.textContent =
      "Şimdi güncelle";
    applyButton.style.cssText = [
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
    applyButton.addEventListener(
      "click",
      () => activateUpdate()
    );

    const laterButton =
      targetDocument.createElement("button");
    laterButton.id = "todayUpdateLater";
    laterButton.type = "button";
    laterButton.textContent =
      "Daha sonra";
    laterButton.style.cssText = [
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
    laterButton.addEventListener(
      "click",
      () => deferUpdate()
    );

    actions.append(
      applyButton,
      laterButton
    );
    surface.append(
      title,
      text,
      actions
    );
    mountTarget.appendChild(surface);

    return surface;
  }

  function showUpdateNotice() {
    const surface =
      ensureNoticeSurface();

    if (!surface) {
      reportUpdateError(
        "TODAY-SW-UPDATE-004",
        "notice",
        new Error(
          "Update notice could not be created."
        )
      );
      return false;
    }

    const title =
      targetDocument.getElementById(
        "todayUpdateTitle"
      );
    const text =
      targetDocument.getElementById(
        "todayUpdateText"
      );
    const applyButton =
      targetDocument.getElementById(
        "todayUpdateApply"
      );
    const laterButton =
      targetDocument.getElementById(
        "todayUpdateLater"
      );

    if (
      !title ||
      !text ||
      !applyButton ||
      !laterButton
    ) {
      return false;
    }

    title.textContent =
      "Yeni sürüm hazır";
    text.textContent =
      "Today’in yeni sürümü indirildi. " +
      "Güncelleme, sen onayladığında uygulanacak.";
    applyButton.textContent =
      "Şimdi güncelle";
    applyButton.disabled = false;
    laterButton.disabled = false;
    surface.hidden = false;
    surface.setAttribute(
      "aria-hidden",
      "false"
    );

    return true;
  }

  function showApplyingState() {
    const surface =
      getNoticeSurface();

    if (!surface) {
      return false;
    }

    const text =
      targetDocument.getElementById(
        "todayUpdateText"
      );
    const applyButton =
      targetDocument.getElementById(
        "todayUpdateApply"
      );
    const laterButton =
      targetDocument.getElementById(
        "todayUpdateLater"
      );

    if (
      !text ||
      !applyButton ||
      !laterButton
    ) {
      return false;
    }

    text.textContent =
      "Today güncelleniyor…";
    applyButton.textContent =
      "Güncelleniyor…";
    applyButton.disabled = true;
    laterButton.disabled = true;

    return true;
  }

  function hideUpdateNotice() {
    const surface =
      getNoticeSurface();

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

  function hasController() {
    return Boolean(
      targetNavigator &&
      targetNavigator.serviceWorker &&
      targetNavigator.serviceWorker.controller
    );
  }

  function markUpdateReady(worker) {
    if (
      !worker ||
      typeof worker.postMessage !==
        "function" ||
      !hasController()
    ) {
      return false;
    }

    waitingWorker = worker;

    if (
      announcedWorker === worker &&
      status.updateAvailable
    ) {
      return false;
    }

    announcedWorker = worker;
    setStatus({
      phase: "update-ready",
      registered: true,
      updateAvailable: true,
      deferred: false,
      userAccepted: false,
      workerState:
        typeof worker.state === "string"
          ? worker.state
          : "installed",
      errorCode: null
    });

    showUpdateNotice();

    dispatch(
      "today:service-worker-update-ready",
      {
        phase: status.phase,
        workerState: status.workerState
      }
    );

    return true;
  }

  function evaluateWorker(worker) {
    const workerState =
      worker &&
      typeof worker.state === "string"
        ? worker.state
        : null;

    setStatus({
      workerState
    });

    if (workerState === "installed") {
      if (hasController()) {
        markUpdateReady(
          registration &&
          registration.waiting
            ? registration.waiting
            : worker
        );
      } else {
        setStatus({
          phase: "registered",
          registered: true,
          updateAvailable: false,
          deferred: false,
          userAccepted: false,
          errorCode: null
        });
      }

      return;
    }

    if (workerState === "redundant") {
      waitingWorker = null;
      setStatus({
        phase: "registered",
        updateAvailable: false,
        deferred: false,
        userAccepted: false
      });

      reportUpdateError(
        "TODAY-SW-UPDATE-003",
        "install",
        new Error(
          "The installing worker became redundant."
        )
      );
      return;
    }

    if (
      workerState === "installing" ||
      workerState === "installed"
    ) {
      setStatus({
        phase:
          workerState === "installing"
            ? "installing"
            : status.phase
      });
    }
  }

  function observeWorker(worker) {
    if (
      !worker ||
      typeof worker.addEventListener !==
        "function"
    ) {
      return false;
    }

    if (!observedWorkers.has(worker)) {
      observedWorkers.add(worker);
      worker.addEventListener(
        "statechange",
        () => evaluateWorker(worker)
      );
    }

    evaluateWorker(worker);
    return true;
  }

  function handleUpdateFound() {
    const worker =
      registration &&
      registration.installing;

    if (!observeWorker(worker)) {
      reportUpdateError(
        "TODAY-SW-UPDATE-002",
        "updatefound",
        new Error(
          "Installing worker could not be observed."
        )
      );
    }
  }

  function monitorRegistration(
    candidateRegistration
  ) {
    if (
      !candidateRegistration ||
      typeof candidateRegistration !==
        "object"
    ) {
      throw new TypeError(
        "Service Worker registration is invalid."
      );
    }

    registration =
      candidateRegistration;

    if (
      observedRegistration !==
        registration &&
      typeof registration.addEventListener ===
        "function"
    ) {
      registration.addEventListener(
        "updatefound",
        handleUpdateFound
      );
      observedRegistration =
        registration;
    }

    setStatus({
      phase: "registered",
      registered: true,
      errorCode: null
    });

    if (
      registration.waiting &&
      hasController()
    ) {
      markUpdateReady(
        registration.waiting
      );
    } else if (registration.installing) {
      observeWorker(
        registration.installing
      );
    }

    return registration;
  }

  function discoverRegistration(
    stage = "discover",
    reportFailure = false
  ) {
    const serviceWorker =
      targetNavigator &&
      targetNavigator.serviceWorker;

    if (registration) {
      try {
        monitorRegistration(
          registration
        );
      } catch (error) {
        if (reportFailure) {
          reportUpdateError(
            "TODAY-SW-UPDATE-011",
            stage,
            error
          );
        }
      }

      return Promise.resolve(
        registration
      );
    }

    if (
      !serviceWorker ||
      typeof serviceWorker
        .getRegistration !== "function"
    ) {
      return Promise.resolve(null);
    }

    if (discoveryPromise) {
      return discoveryPromise;
    }

    discoveryPromise =
      Promise.resolve()
        .then(() =>
          serviceWorker.getRegistration()
        )
        .then(
          candidateRegistration => {
            discoveryPromise = null;

            if (candidateRegistration) {
              monitorRegistration(
                candidateRegistration
              );
            }

            return (
              candidateRegistration ||
              null
            );
          }
        )
        .catch(error => {
          discoveryPromise = null;

          if (reportFailure) {
            reportUpdateError(
              "TODAY-SW-UPDATE-011",
              stage,
              error
            );
          }

          return null;
        });

    return discoveryPromise;
  }

  function handleRegistrationReady(event) {
    const candidateRegistration =
      event &&
      event.detail &&
      event.detail.registration;

    if (
      candidateRegistration &&
      typeof candidateRegistration ===
        "object"
    ) {
      try {
        monitorRegistration(
          candidateRegistration
        );
      } catch (error) {
        reportUpdateError(
          "TODAY-SW-UPDATE-011",
          "ready-event",
          error
        );
      }

      return;
    }

    discoverRegistration(
      "ready-event",
      true
    );
  }

  function handleControllerChange() {
    waitingWorker = null;
    announcedWorker = null;
    hideUpdateNotice();

    if (
      status.userAccepted &&
      !status.reloadTriggered
    ) {
      setStatus({
        phase: "reloading",
        updateAvailable: false,
        deferred: false,
        reloadTriggered: true,
        workerState: "activated",
        errorCode: null
      });

      dispatch(
        "today:service-worker-update-activated",
        {
          phase: status.phase,
          userAccepted: true
        }
      );

      if (
        targetWindow.location &&
        typeof targetWindow.location.reload ===
          "function"
      ) {
        targetWindow.location.reload();
      }

      return;
    }

    setStatus({
      phase: "registered",
      updateAvailable: false,
      deferred: false,
      userAccepted: false,
      workerState: "activated",
      errorCode: null
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
      options.window || window;
    const candidateDocument =
      options.document || document;
    const candidateNavigator =
      options.navigator ||
      candidateWindow.navigator;

    if (
      !candidateWindow ||
      typeof candidateWindow.addEventListener !==
        "function" ||
      !candidateDocument ||
      typeof candidateDocument.createElement !==
        "function" ||
      !candidateNavigator
    ) {
      return Object.freeze({
        success: false,
        changed: false,
        ...getState(),
        errorCode:
          "TODAY-SW-UPDATE-001"
      });
    }

    targetWindow = candidateWindow;
    targetDocument = candidateDocument;
    targetNavigator = candidateNavigator;

    const supported = Boolean(
      targetNavigator.serviceWorker &&
      typeof targetNavigator.serviceWorker
        .register === "function"
    );

    targetWindow.addEventListener(
      "today:service-worker-ready",
      handleRegistrationReady
    );
    listenersBound = true;

    if (
      supported &&
      typeof targetNavigator.serviceWorker
        .addEventListener === "function"
    ) {
      targetNavigator.serviceWorker
        .addEventListener(
          "controllerchange",
          handleControllerChange
        );
    }

    initialized = true;
    setStatus({
      phase:
        supported
          ? "idle"
          : "unsupported",
      supported
    });

    dispatch(
      "today:service-worker-manager-ready",
      {
        version: MANAGER_VERSION,
        supported
      }
    );

    if (supported) {
      discoverRegistration(
        "init",
        false
      );
    }

    return Object.freeze({
      success: true,
      changed: true,
      ...getState()
    });
  }

  function start(options = {}) {
    if (!initialized) {
      const initResult = init();

      if (!initResult.success) {
        return Promise.reject(
          new Error(
            initResult.errorCode
          )
        );
      }
    }

    if (!status.supported) {
      return Promise.resolve(
        Object.freeze({
          success: true,
          supported: false,
          registration: null,
          ...getState()
        })
      );
    }

    if (registrationPromise) {
      return registrationPromise;
    }

    const scriptUrl =
      typeof options.scriptUrl ===
        "string" &&
      options.scriptUrl.trim()
        ? options.scriptUrl.trim()
        : "./sw.js";

    setStatus({
      phase: "registering",
      errorCode: null
    });

    registrationPromise =
      Promise.resolve()
        .then(() =>
          targetNavigator.serviceWorker
            .register(scriptUrl)
        )
        .then(
          candidateRegistration => {
            monitorRegistration(
              candidateRegistration
            );

            return Object.freeze({
              success: true,
              supported: true,
              registration:
                candidateRegistration,
              ...getState()
            });
          }
        )
        .catch(error => {
          registrationPromise = null;
          setStatus({
            phase: "failed",
            registered: false,
            errorCode:
              "TODAY-SW-REGISTER-001"
          });

          throw error;
        });

    return registrationPromise;
  }

  async function checkForUpdate() {
    if (
      !registration ||
      typeof registration.update !==
        "function"
    ) {
      return Object.freeze({
        success: false,
        ...getState(),
        errorCode:
          "TODAY-SW-UPDATE-005"
      });
    }

    setStatus({
      phase: "checking",
      errorCode: null
    });

    try {
      const updatedRegistration =
        await registration.update();

      monitorRegistration(
        updatedRegistration ||
        registration
      );

      return Object.freeze({
        success: true,
        ...getState()
      });
    } catch (error) {
      setStatus({
        phase: "registered"
      });
      reportUpdateError(
        "TODAY-SW-UPDATE-006",
        "check",
        error
      );

      return Object.freeze({
        success: false,
        ...getState(),
        errorCode:
          "TODAY-SW-UPDATE-006"
      });
    }
  }

  function deferUpdate() {
    if (!status.updateAvailable) {
      return Object.freeze({
        success: false,
        ...getState(),
        errorCode:
          "TODAY-SW-UPDATE-007"
      });
    }

    setStatus({
      phase: "deferred",
      deferred: true,
      userAccepted: false
    });
    hideUpdateNotice();

    dispatch(
      "today:service-worker-update-deferred",
      {
        phase: status.phase
      }
    );

    return Object.freeze({
      success: true,
      action: "defer",
      ...getState()
    });
  }

  function activateUpdate() {
    const worker =
      waitingWorker ||
      (
        registration &&
        registration.waiting
      );

    if (
      !worker ||
      typeof worker.postMessage !==
        "function"
    ) {
      const error =
        new Error(
          "Waiting Service Worker is unavailable."
        );

      reportUpdateError(
        "TODAY-SW-UPDATE-008",
        "activate",
        error
      );

      return Object.freeze({
        success: false,
        ...getState(),
        errorCode:
          "TODAY-SW-UPDATE-008"
      });
    }

    waitingWorker = worker;
    setStatus({
      phase: "activating",
      updateAvailable: true,
      deferred: false,
      userAccepted: true,
      errorCode: null
    });
    showApplyingState();

    try {
      worker.postMessage({
        type: ACTIVATE_MESSAGE
      });
    } catch (error) {
      setStatus({
        phase: "update-ready",
        userAccepted: false
      });
      showUpdateNotice();
      reportUpdateError(
        "TODAY-SW-UPDATE-009",
        "activate",
        error
      );

      return Object.freeze({
        success: false,
        ...getState(),
        errorCode:
          "TODAY-SW-UPDATE-009"
      });
    }

    dispatch(
      "today:service-worker-update-activating",
      {
        phase: status.phase,
        userAccepted: true
      }
    );

    return Object.freeze({
      success: true,
      action: "activate",
      ...getState()
    });
  }

  window.TodayServiceWorker =
    Object.freeze({
      MANAGER_VERSION,
      ACTIVATE_MESSAGE,
      init,
      start,
      checkForUpdate,
      activateUpdate,
      deferUpdate,
      getState
    });

  init();

  console.info(
    "Today Service Worker Update Manager hazır."
  );
})();
