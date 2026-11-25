import { AUTH_KDF_ITERATIONS, AUTH_TIMEOUTS } from "./application-lock-store.mjs";

export const AUTO_LOCK_MINUTES = AUTH_TIMEOUTS;
export const DEFAULT_AUTO_LOCK_MINUTES = 5;
const PIN = /^[0-9]{6,12}$/;
const emptyAttempts = { count: 0, retryAt: 0 };
const defaultClock = {
  now: () => performance.now(),
  wall: () => Date.now(),
  schedule: (fn, ms) => setTimeout(fn, ms),
  cancel: timer => clearTimeout(timer)
};
const toHex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
const fromHex = value => Uint8Array.from(value.match(/../g), item => Number.parseInt(item, 16));
const normalizeCode = code => typeof code === "string" && /^[a-f0-9\s-]{32,48}$/i.test(code)
  ? code.toLowerCase().replace(/[\s-]/g, "") : "";

function acceptable(type, value) {
  return typeof value === "string" && (type === "pin" ? PIN.test(value) :
    type === "password" && value.length <= 256 && Array.from(value).length >= 12);
}

async function derive(crypto, value, salt) {
  const input = new TextEncoder().encode(value);
  try {
    const key = await crypto.subtle.importKey("raw", input, "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({
      name: "PBKDF2", hash: "SHA-256", salt: fromHex(salt), iterations: AUTH_KDF_ITERATIONS
    }, key, 256);
    return toHex(new Uint8Array(bits));
  } finally {
    input.fill(0);
  }
}

async function recoveryDigest(crypto, code, salt) {
  const input = new TextEncoder().encode(`today-auth01-recovery-v1:${salt}:${code}`);
  try {
    return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", input)));
  } finally {
    input.fill(0);
  }
}

function equalDigest(left, right) {
  let difference = 0;
  for (let i = 0; i < right.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return left.length === right.length && difference === 0;
}

export function createApplicationLock({ store, crypto = globalThis.crypto, clock = defaultClock }) {
  let record;
  let mode = "loading", busy = false, generation = 0, timer, deadline = 0;
  let retryDeadline = 0, retryKey;
  let pendingCode;
  const observers = new Set();
  const random = () => toHex(crypto.getRandomValues(new Uint8Array(16)));
  const remaining = () => Math.max(0, retryDeadline - clock.now());

  function updateRecord(value) {
    record = value;
    const { count, retryAt } = value?.attempts ?? emptyAttempts;
    const key = count + ":" + retryAt;
    if (key !== retryKey) {
      retryKey = key;
      retryDeadline = clock.now() + Math.min(60_000, Math.max(0, retryAt - clock.wall()));
    }
  }

  function snapshot() {
    return {
      mode, busy, waitSeconds: Math.ceil(remaining() / 1000),
      type: record?.credential.type, minutes: record?.timeoutMinutes ?? DEFAULT_AUTO_LOCK_MINUTES
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
    pendingCode = undefined;
    if (mode === "unlocked") {
      mode = "locked";
      publish();
    }
  }

  function activity() {
    if (mode !== "unlocked" || !record.timeoutMinutes) return;
    if (deadline && clock.now() >= deadline) {
      lock();
      return;
    }
    clock.cancel(timer);
    const interval = record.timeoutMinutes * 60_000;
    deadline = clock.now() + interval;
    timer = clock.schedule(lock, interval);
  }

  function sync(value) {
    if (!value && record) throw Error("auth-record-disappeared");
    const changed = value?.revision !== record?.revision;
    if (changed && mode === "unlocked") lock();
    updateRecord(value);
    if (!value) mode = "disabled";
    else if (mode !== "unlocked") mode = "locked";
  }

  function failed() {
    lock();
    mode = "blocked";
  }

  async function refresh() {
    if (busy) return;
    busy = true;
    publish();
    try {
      sync(await store.read());
    } catch {
      failed();
    } finally {
      busy = false;
      publish();
    }
  }

  async function perform(operation) {
    if (busy) return "busy";
    const started = generation;
    const startedMode = mode;
    const current = () => generation === started && mode === startedMode;
    busy = true;
    publish();
    try {
      sync(await store.read());
      if (!current()) return "interrupted";
      if (remaining()) return "wait";
      return await operation(current);
    } catch {
      failed();
      return "unavailable";
    } finally {
      busy = false;
      publish();
    }
  }

  async function commit(changes, current) {
    if (!current()) return "interrupted";
    const expected = record?.revision ?? null;
    const applied = await store.commit(expected, {
      ...record, ...changes, version: 1, revision: (expected ?? 0) + 1
    });
    if (!applied) {
      sync(await store.read());
      return "interrupted";
    }
    updateRecord(applied);
    if (!current()) {
      mode = "locked";
      return "committed-locked";
    }
    return "ok";
  }

  function reject(current) {
    const count = Math.min(record.attempts.count + 1, 7);
    const retryAt = clock.wall() + Math.min(60_000, 2 ** (count - 1) * 1000);
    return commit({ attempts: { count, retryAt } }, current)
      .then(result => result === "ok" ? "incorrect" : result === "committed-locked" ? "interrupted" : result);
  }

  async function matches(value) {
    const { type, salt, digest } = record.credential;
    return acceptable(type, value) && equalDigest(await derive(crypto, value, salt), digest);
  }

  async function credential(type, value) {
    const salt = random();
    return { type, kdf: "PBKDF2-SHA-256", iterations: AUTH_KDF_ITERATIONS, salt, digest: await derive(crypto, value, salt) };
  }

  async function issueCredential({ type, value, code }, current, previousCode) {
    const salt = random();
    const changes = {
      credential: await credential(type, value),
      recovery: { salt, digest: await recoveryDigest(crypto, code, salt) },
      attempts: emptyAttempts, timeoutMinutes: record?.timeoutMinutes ?? DEFAULT_AUTO_LOCK_MINUTES
    };
    if (previousCode && code === previousCode) return "invalid-secret";
    return commit(changes, current);
  }

  function validEntry({ type, value, confirmation }) {
    return acceptable(type, value) && value === confirmation;
  }

  function enrollment(data, recovering) {
    if (mode !== (recovering ? "locked" : "disabled")) return "invalid-state";
    if (data.stored !== "on" || !validEntry(data) || !pendingCode || normalizeCode(data.code) !== pendingCode) return "invalid-secret";
    const code = pendingCode;
    pendingCode = undefined;
    return perform(async current => {
      let previousCode;
      if (recovering) {
        previousCode = normalizeCode(data.previousCode);
        const { salt, digest } = record.recovery;
        if (previousCode.length !== 32 ||
            !equalDigest(await recoveryDigest(crypto, previousCode, salt), digest)) return reject(current);
      }
      const result = await issueCredential({ ...data, code }, current, previousCode);
      if (result === "ok") {
        mode = recovering ? "locked" : "unlocked";
        activity();
      }
      return result;
    });
  }

  return {
    snapshot, refresh, lock, activity,
    subscribe(observer) {
      observers.add(observer);
      observer(snapshot());
      return () => observers.delete(observer);
    },
    newRecoveryCode() {
      if (busy || !["locked", "disabled"].includes(mode)) return "";
      pendingCode = random();
      return pendingCode.toUpperCase().match(/.{4}/g).join("-");
    },
    discardRecoveryCode() { pendingCode = undefined; },
    enable(data) { return enrollment(data, false); },
    recover(data) { return enrollment(data, true); },
    unlock(value) {
      if (mode !== "locked") return "invalid-state";
      return perform(async current => {
        if (!await matches(value)) return reject(current);
        const result = await commit({ attempts: emptyAttempts }, current);
        if (result === "ok") {
          mode = "unlocked";
          activity();
        }
        return result === "committed-locked" ? "interrupted" : result;
      });
    },
    change(data) {
      if (mode !== "unlocked") return "invalid-state";
      if (!validEntry(data)) return "invalid-secret";
      return perform(async current => {
        if (!await matches(data.current)) return reject(current);
        return commit({ credential: await credential(data.type, data.value), attempts: emptyAttempts }, current);
      });
    },
    setAutoLock(value) {
      if (mode !== "unlocked" || !AUTH_TIMEOUTS.includes(value)) return "invalid-state";
      return perform(async current => {
        const result = await commit({ timeoutMinutes: value }, current);
        if (result === "ok") {
          clock.cancel(timer);
          timer = undefined;
          deadline = 0;
          activity();
        }
        return result;
      });
    }
  };
}
