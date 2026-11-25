// Session-only AUTH01 controller. A page must explicitly supply a client UI.
export const AUTO_LOCK_MINUTES = Object.freeze([0, 1, 5, 15, 30]);

const PIN = /^[0-9]{6,12}$/;
const KDF_ITERATIONS = 600_000;
const defaultClock = {
  now: () => performance.now(),
  schedule: (fn, ms) => setTimeout(fn, ms),
  cancel: timer => clearTimeout(timer)
};

function acceptable(type, value) {
  return typeof value === "string" && (type === "pin" ? PIN.test(value) :
    type === "password" && value.length <= 256 && Array.from(value).length >= 12);
}

async function derive(crypto, value, salt) {
  const input = new TextEncoder().encode(value);
  try {
    const key = await crypto.subtle.importKey("raw", input, "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({
      name: "PBKDF2", hash: "SHA-256", salt, iterations: KDF_ITERATIONS
    }, key, 256);
    return new Uint8Array(bits);
  } finally {
    input.fill(0);
  }
}

function equalBytes(left, right) {
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}

export function createApplicationLock({ crypto = globalThis.crypto, clock = defaultClock } = {}) {
  let verifier;
  let locked = false;
  let busy = false;
  let generation = 0;
  let failures = 0;
  let retryAt = 0;
  let minutes = 0;
  let timer;
  let deadline = 0;
  const observers = new Set();

  function snapshot() {
    return {
      mode: !verifier ? "disabled" : locked ? "locked" : "unlocked",
      type: verifier?.type,
      minutes,
      busy,
      waitSeconds: Math.max(0, Math.ceil((retryAt - clock.now()) / 1000))
    };
  }

  function publish() {
    for (const observer of observers) observer(snapshot());
  }

  function lock() {
    clock.cancel(timer);
    timer = undefined;
    deadline = 0;
    generation++;
    if (!verifier || locked) return;
    locked = true;
    publish();
  }

  function activity() {
    if (!verifier || locked || minutes === 0) return;
    if (deadline && clock.now() >= deadline) {
      lock();
      return;
    }
    clock.cancel(timer);
    deadline = clock.now() + minutes * 60_000;
    timer = clock.schedule(lock, minutes * 60_000);
  }

  async function perform(operation) {
    if (busy) return "busy";
    if (clock.now() < retryAt) return "wait";
    const started = generation;
    busy = true;
    publish();
    try {
      return await operation(() => generation === started);
    } catch {
      return "unavailable";
    } finally {
      busy = false;
      publish();
    }
  }

  async function verify(value, stillCurrent) {
    if (!acceptable(verifier.type, value)) return reject(stillCurrent);
    const candidate = await derive(crypto, value, verifier.salt);
    const matches = equalBytes(candidate, verifier.bytes);
    candidate.fill(0);
    if (!stillCurrent()) return "interrupted";
    if (!matches) return reject(stillCurrent);
    failures = 0;
    retryAt = 0;
    return "ok";
  }

  function reject(stillCurrent) {
    if (!stillCurrent()) return "interrupted";
    failures = Math.min(failures + 1, 7);
    retryAt = clock.now() + Math.min(60_000, 2 ** (failures - 1) * 1000);
    return "incorrect";
  }

  async function replace(type, value, stillCurrent) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const bytes = await derive(crypto, value, salt);
    if (!stillCurrent()) {
      bytes.fill(0);
      return "interrupted";
    }
    verifier?.bytes.fill(0);
    verifier = { type, salt, bytes };
    return "ok";
  }

  return {
    snapshot,
    subscribe(observer) {
      observers.add(observer);
      observer(snapshot());
      return () => observers.delete(observer);
    },
    enable({ type, value, confirmation, autoLock = 0 }) {
      if (verifier) return "invalid-state";
      if (!acceptable(type, value) || value !== confirmation ||
          !AUTO_LOCK_MINUTES.includes(autoLock)) return "invalid-secret";
      return perform(async stillCurrent => {
        const result = await replace(type, value, stillCurrent);
        if (result === "ok") {
          minutes = autoLock;
          activity();
        }
        return result;
      });
    },
    unlock(value) {
      if (!locked) return "invalid-state";
      return perform(async stillCurrent => {
        const result = await verify(value, stillCurrent);
        if (result === "ok") {
          locked = false;
          activity();
        }
        return result;
      });
    },
    change({ current, type, value, confirmation }) {
      if (!verifier || locked) return "invalid-state";
      if (!acceptable(type, value) || value !== confirmation) return "invalid-secret";
      return perform(async stillCurrent => {
        const result = await verify(current, stillCurrent);
        return result === "ok" ? replace(type, value, stillCurrent) : result;
      });
    },
    setAutoLock(value) {
      if (!verifier || locked || !AUTO_LOCK_MINUTES.includes(value)) return false;
      clock.cancel(timer);
      timer = undefined;
      deadline = 0;
      minutes = value;
      activity();
      publish();
      return true;
    },
    activity,
    lock
  };
}
