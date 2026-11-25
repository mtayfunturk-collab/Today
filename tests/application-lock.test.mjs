import assert from "node:assert/strict";
import { pbkdf2Sync } from "node:crypto";
import { IDBFactory } from "fake-indexeddb";
import { AUTO_LOCK_MINUTES, createApplicationLock } from "../modules/application-lock.mjs";
import { AUTH_DATABASE, AUTH_STORE, createApplicationLockStore } from "../modules/application-lock-store.mjs";

const pin = { type: "pin", value: "581347", confirmation: "581347" };
const password = { type: "password", value: "Kumlu sahil 23", confirmation: "Kumlu sahil 23" };
let passed = 0;
async function check(name, run) {
  await run();
  passed++;
  console.log(`PASS ${name}`);
}

async function fixture(options = {}) {
  let now = 0, wallShift = 0;
  const jobs = new Map();
  const clock = {
    now: () => now, wall: () => 1_790_000_000_000 + now + wallShift,
    schedule(fn, ms) {
      const id = Symbol();
      jobs.set(id, { fn, deadline: now + ms });
      return id;
    },
    cancel: id => jobs.delete(id)
  };
  const idb = options.idb ?? new IDBFactory();
  const store = createApplicationLockStore(idb);
  const session = createApplicationLock({ store, clock });
  await session.refresh();
  return {
    idb, store, session,
    shiftWall(ms) { wallShift += ms; },
    advance(ms, runTimers = true) {
      now += ms;
      if (!runTimers) return;
      for (const [id, job] of jobs) {
        if (job.deadline <= now) {
          jobs.delete(id);
          job.fn();
        }
      }
    }
  };
}

const enrollment = (session, secret = pin) => ({ ...secret, code: session.newRecoveryCode(), stored: "on" });

await check("disabled first read does not create a database; acknowledgement and valid input are required", async () => {
  const { session, idb } = await fixture();
  assert.deepEqual(await idb.databases(), []);
  assert.equal(session.snapshot().mode, "disabled");
  const data = enrollment(session);
  assert.equal(await session.enable({ ...data, stored: undefined }), "invalid-secret");
  assert.equal(await session.enable({ ...data, value: "12345" }), "invalid-secret");
  assert.equal(session.snapshot().mode, "disabled");
  assert.deepEqual(await idb.databases(), []);
});

await check("enrollment defaults to five minutes and reopening requires the same PIN", async () => {
  const { session, idb } = await fixture();
  assert.equal(await session.enable(enrollment(session)), "ok");
  assert.equal(session.snapshot().minutes, 5);
  const reopened = (await fixture({ idb })).session;
  assert.equal(reopened.snapshot().mode, "locked");
  assert.equal(await reopened.enable(enrollment(reopened, password)), "invalid-state");
  assert.equal(await reopened.unlock(pin.value), "ok");
});

await check("cooldown grows, survives reload, uses monotonic time in the session and resets after success", async () => {
  const f = await fixture();
  await f.session.enable(enrollment(f.session));
  f.session.lock();
  assert.equal(await f.session.unlock("000000"), "incorrect");
  const other = await fixture({ idb: f.idb });
  assert.equal(await other.session.unlock(pin.value), "wait");
  other.shiftWall(60_000);
  assert.equal(await other.session.unlock(pin.value), "wait");
  other.shiftWall(-60_000);
  other.advance(1000);
  assert.equal(await other.session.unlock("000000"), "incorrect");
  assert.equal(other.session.snapshot().waitSeconds, 2);
  other.advance(2000);
  assert.equal(await other.session.unlock(pin.value), "ok");
  other.session.lock();
  assert.equal(await other.session.unlock("000000"), "incorrect");
  assert.equal(other.session.snapshot().waitSeconds, 1);
});

await check("all supported timeouts and current activity have defined behavior", async () => {
  const { session, advance } = await fixture();
  assert.deepEqual(AUTO_LOCK_MINUTES, [0, 1, 5, 15, 30]);
  await session.enable(enrollment(session));
  assert.equal(await session.setAutoLock(0), "ok");
  advance(60 * 60_000);
  assert.equal(session.snapshot().mode, "unlocked");
  for (const minutes of AUTO_LOCK_MINUTES.slice(1)) {
    assert.equal(await session.setAutoLock(minutes), "ok");
    advance(1000);
    session.activity();
    advance(minutes * 60_000 - 1);
    assert.equal(session.snapshot().mode, "unlocked");
    advance(1);
    assert.equal(session.snapshot().mode, "locked");
    assert.equal(await session.unlock(pin.value), "ok");
  }
});

await check("late activity cannot extend an expired timer", async () => {
  const { session, advance } = await fixture();
  await session.enable(enrollment(session));
  await session.setAutoLock(1);
  advance(60_000, false);
  session.activity();
  assert.equal(session.snapshot().mode, "locked");
});

await check("credential change requires the old secret and persists the new secret", async () => {
  const { session, advance, idb } = await fixture();
  await session.enable(enrollment(session));
  assert.equal(await session.change({ ...password, current: "000000" }), "incorrect");
  assert.equal(await session.change({ ...password, current: pin.value }), "wait");
  advance(1000);
  assert.equal(await session.change({ ...password, current: pin.value }), "ok");
  const other = await fixture({ idb });
  assert.equal(await other.session.unlock(pin.value), "incorrect");
  other.advance(1000);
  assert.equal(await other.session.unlock(password.value), "ok");
});

await check("locking invalidates pending enrollment, unlock and credential replacement", async () => {
  const { session } = await fixture();
  const first = session.enable(enrollment(session));
  session.lock();
  assert.equal(await first, "interrupted");
  assert.equal(session.snapshot().mode, "disabled");
  await session.enable(enrollment(session));
  const change = session.change({ ...password, current: pin.value });
  session.lock();
  assert.equal(await change, "interrupted");
  const pending = session.unlock(pin.value);
  assert.equal(await session.unlock(pin.value), "busy");
  session.lock();
  assert.equal(await pending, "interrupted");
  assert.equal(session.snapshot().mode, "locked");
  assert.equal(await session.unlock(pin.value), "ok");
});

await check("versioned verifier matches PBKDF2-SHA-256 600000 and stores neither secret nor recovery code", async () => {
  const { store, session } = await fixture();
  const data = enrollment(session);
  await session.enable(data);
  const record = await store.read();
  assert.equal(record.version, 1);
  assert.equal(record.credential.iterations, 600_000);
  assert.notEqual(record.credential.salt, record.recovery.salt);
  const expected = pbkdf2Sync(pin.value, Buffer.from(record.credential.salt, "hex"), 600_000, 32, "sha256");
  assert.equal(record.credential.digest, expected.toString("hex"));
  assert.equal(JSON.stringify(record).includes(pin.value), false);
  assert.equal(JSON.stringify(record).includes(data.code.replace(/-/g, "").toLowerCase()), false);
});

await check("concurrent recovery consumes a code once, and only a fresh credential can open the lock", async () => {
  const first = await fixture();
  const data = enrollment(first.session);
  await first.session.enable(data);
  first.session.lock();
  const second = await fixture({ idb: first.idb });
  const result = await Promise.all([first, second].map(({ session }) =>
    session.recover({ ...enrollment(session, password), previousCode: data.code })));
  assert.equal(result.filter(value => value === "ok").length, 1);
  const third = await fixture({ idb: first.idb });
  assert.equal(await third.session.recover({ ...enrollment(third.session), previousCode: data.code }), "incorrect");
  third.advance(1000);
  assert.equal(await third.session.unlock(password.value), "ok");
});

await check("malformed stored data fails closed without replacement or exposure", async () => {
  const f = await fixture();
  await f.session.enable(enrollment(f.session));
  const db = await new Promise((resolve, reject) => {
    const req = f.idb.open(AUTH_DATABASE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction(AUTH_STORE, "readwrite");
    tx.objectStore(AUTH_STORE).put({ version: 99 }, "device");
    tx.oncomplete = resolve;
    tx.onabort = reject;
  });
  db.close();
  const other = await fixture({ idb: f.idb });
  assert.equal(other.session.snapshot().mode, "blocked");
  assert.equal(await other.session.unlock(pin.value), "invalid-state");
  assert.equal(await other.session.enable(pin), "invalid-state");
  await assert.rejects(other.store.read(), /invalid-auth-record/);
});

await check("concurrent enrollment cannot overwrite a record", async () => {
  const a = await fixture();
  const b = await fixture({ idb: a.idb });
  const result = await Promise.all([a.session.enable(enrollment(a.session)), b.session.enable(enrollment(b.session))]);
  assert.equal(result.filter(value => value === "ok").length, 1);
  assert.equal((await a.store.read()).revision, 1);
});

await check("a recovery committed as the page suspends keeps the lock and reports the stored credential", async () => {
  const f = await fixture();
  const data = enrollment(f.session);
  await f.session.enable(data);
  f.session.lock();
  let session;
  session = createApplicationLock({ store: {
    read: f.store.read,
    async commit(expected, next) {
      const result = await f.store.commit(expected, next);
      session.lock();
      return result;
    }
  } });
  await session.refresh();
  assert.equal(await session.recover({ ...enrollment(session, password), previousCode: data.code }), "committed-locked");
  assert.equal(session.snapshot().mode, "locked");
  const after = await fixture({ idb: f.idb });
  assert.equal(await after.session.unlock(password.value), "ok");
});

console.log(`Application lock: ${passed}/12 başarılı`);
