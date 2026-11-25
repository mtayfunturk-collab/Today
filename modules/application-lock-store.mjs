export const AUTH_DATABASE = "today-auth01-device";
export const AUTH_STORE = "lock";
const AUTH_KEY = "device";
export const AUTH_KDF_ITERATIONS = 600_000;
export const AUTH_TIMEOUTS = Object.freeze([0, 1, 5, 15, 30]);
const hex = (value, size) => typeof value === "string" && value.length === size * 2 && /^[a-f0-9]+$/.test(value);

function shape(value, keys) {
  return value && typeof value === "object" &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

function validate(record) {
  if (!shape(record, ["version", "revision", "credential", "timeoutMinutes", "attempts", "recovery"]) ||
      record.version !== 1 || !Number.isSafeInteger(record.revision) || record.revision < 1 ||
      !AUTH_TIMEOUTS.includes(record.timeoutMinutes)) throw Error("invalid-auth-record");
  const { credential, attempts, recovery } = record;
  if (!shape(credential, ["type", "kdf", "iterations", "salt", "digest"]) ||
      !["pin", "password"].includes(credential.type) || credential.kdf !== "PBKDF2-SHA-256" ||
      credential.iterations !== AUTH_KDF_ITERATIONS || !hex(credential.salt, 16) || !hex(credential.digest, 32) ||
      !shape(recovery, ["salt", "digest"]) || !hex(recovery.salt, 16) || !hex(recovery.digest, 32) ||
      !shape(attempts, ["count", "retryAt"]) ||
      !Number.isInteger(attempts.count) || attempts.count < 0 || attempts.count > 7 ||
      !Number.isSafeInteger(attempts.retryAt) || attempts.retryAt < 0 ||
      (attempts.count === 0) !== (attempts.retryAt === 0)) throw Error("invalid-auth-record");
  return record;
}

export function createApplicationLockStore(indexedDB) {
  function access(next, expected) {
    return new Promise((resolve, reject) => {
      const create = next && expected === null;
      const request = indexedDB.open(AUTH_DATABASE);
      let absent = false, settled = false;
      const timer = setTimeout(() => {
        if (!settled) { settled = true; reject(Error("auth-storage-timeout")); }
      }, 2500);
      request.onupgradeneeded = () => {
        absent = true;
        if (!create || settled) request.transaction.abort();
        else request.result.createObjectStore(AUTH_STORE).add(validate(next), AUTH_KEY);
      };
      request.onblocked = () => {
        settled = true;
        clearTimeout(timer);
        reject(Error("auth-storage-blocked"));
      };
      request.onerror = () => {
        settled = true;
        clearTimeout(timer);
        if (absent && !create && request.error?.name === "AbortError") resolve(null);
        else reject(request.error);
      };
      request.onsuccess = () => {
        const db = request.result;
        clearTimeout(timer);
        if (settled) { db.close(); return; }
        settled = true;
        if (db.version !== 1 || db.objectStoreNames.length !== 1 || !db.objectStoreNames.contains(AUTH_STORE)) {
          db.close();
          reject(Error("invalid-auth-database"));
          return;
        }
        if (absent) {
          db.close();
          resolve(next);
          return;
        }
        const tx = db.transaction(AUTH_STORE, next ? "readwrite" : "readonly");
        const store = tx.objectStore(AUTH_STORE);
        const get = store.get(AUTH_KEY);
        let result, error;
        tx.oncomplete = () => { db.close(); resolve(result); };
        tx.onabort = () => { db.close(); reject(error || tx.error || Error("auth-storage-aborted")); };
        get.onsuccess = () => {
          try {
            const current = validate(get.result);
            if (!next) result = current;
            else if (current.revision !== expected) result = null;
            else {
              store.put(validate(next), AUTH_KEY);
              result = next;
            }
          } catch (cause) {
            error = cause;
            tx.abort();
          }
        };
      };
    });
  }

  return {
    read: () => access(),
    commit(expected, next) {
      validate(next);
      if (next.revision !== (expected ?? 0) + 1) throw Error("invalid-auth-revision");
      return access(next, expected);
    }
  };
}
