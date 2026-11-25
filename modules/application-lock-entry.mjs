import { createApplicationLock } from "./application-lock.mjs";
import { createApplicationLockStore } from "./application-lock-store.mjs";
import { createApplicationLockDevice } from "./application-lock-device.mjs";
import { mountApplicationLock } from "./application-lock-ui.mjs";

async function canEnroll(view) {
  const worker = view.navigator.serviceWorker?.controller;
  if (!worker || !view.MessageChannel) return false;
  const registration = await view.navigator.serviceWorker.getRegistration();
  if (!registration || registration.waiting || registration.installing) return false;
  return new Promise(resolve => {
    const channel = new view.MessageChannel();
    const finish = allowed => {
      view.clearTimeout(timer);
      channel.port1.close();
      resolve(allowed);
    };
    const timer = view.setTimeout(() => finish(false), 1500);
    channel.port1.onmessage = event => finish(event.data?.protocol === 1 && event.data.onlyClient === true && event.data.navigationLock === true &&
      event.data.scope === new URL("./", view.location.href).href &&
      worker === view.navigator.serviceWorker.controller && !registration.waiting && !registration.installing);
    try {
      worker.postMessage({ type: "TODAY_AUTH_ENROLL_CHECK" }, [channel.port2]);
    } catch { finish(false); }
  });
}

async function enroll(view, operation) {
  if (typeof view.BroadcastChannel !== "function") return "enrollment-unavailable";
  if (view.Capacitor?.isNativePlatform?.()) return operation();
  const locks = view.navigator.locks;
  if (!locks?.request) return "enrollment-unavailable";
  const scopePath = new URL("./", view.location.href).pathname;
  // The worker takes a shared lock for navigation. Hold exclusive access through registration.
  return locks.request("today:backup:v1:" + scopePath, { mode: "exclusive", ifAvailable: true }, async lock =>
    lock && await canEnroll(view) ? operation() : "enrollment-unavailable");
}

if (window === window.top) {
  mountApplicationLock({
    session: createApplicationLock({ store: createApplicationLockStore(window.indexedDB), device: createApplicationLockDevice(window) }),
    privateContent: document.querySelector("#todayPrivate"),
    settings: document.querySelector("#todaySecuritySettings"),
    lockScreen: document.querySelector("#todayLock"),
    authorize: () => document.dispatchEvent(new Event("today:app-authorized")),
    enroll: operation => enroll(window, operation)
  });
}
