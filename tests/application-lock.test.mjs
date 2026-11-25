import assert from "node:assert/strict";
import { AUTO_LOCK_MINUTES, createApplicationLock } from "../modules/application-lock.mjs";

const pin = { type: "pin", value: "581347", confirmation: "581347" };
const password = { type: "password", value: "Kumlu sahil 23", confirmation: "Kumlu sahil 23" };
let passed = 0;

async function check(name, run) {
  await run();
  passed++;
  console.log(`PASS ${name}`);
}

function fixture() {
  let now = 0;
  const jobs = new Map();
  const clock = {
    now: () => now,
    schedule(fn, ms) {
      const id = Symbol();
      jobs.set(id, { fn, deadline: now + ms });
      return id;
    },
    cancel: id => jobs.delete(id)
  };
  return {
    session: createApplicationLock({ clock }),
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

await check("disabled until opt-in and validation leaves invalid enrollment disabled", async () => {
  const { session } = fixture();
  assert.equal(session.snapshot().mode, "disabled");
  session.lock();
  assert.equal(await session.enable({ ...pin, value: "12345" }), "invalid-secret");
  assert.equal(await session.enable({ ...password, confirmation: "wrong" }), "invalid-secret");
  assert.equal(await session.enable({ ...pin, autoLock: 2 }), "invalid-secret");
  assert.equal(session.snapshot().mode, "disabled");
});

await check("manual lock requires the PIN and a new session has no saved verifier", async () => {
  const { session } = fixture();
  assert.equal(await session.enable(pin), "ok");
  session.lock();
  assert.equal(session.snapshot().mode, "locked");
  assert.equal(await session.enable(password), "invalid-state");
  assert.equal(await session.unlock(pin.value), "ok");
  assert.equal(session.snapshot().mode, "unlocked");
  assert.equal(fixture().session.snapshot().mode, "disabled");
  assert.equal(Object.values(session.snapshot()).includes(pin.value), false);
});

await check("cooldown grows, cannot be skipped by locking again, and resets after success", async () => {
  const { session, advance } = fixture();
  await session.enable(pin);
  session.lock();
  assert.equal(await session.unlock("000000"), "incorrect");
  assert.equal(session.snapshot().waitSeconds, 1);
  session.lock();
  assert.equal(await session.unlock(pin.value), "wait");
  advance(1000);
  assert.equal(await session.unlock("000000"), "incorrect");
  assert.equal(session.snapshot().waitSeconds, 2);
  advance(2000);
  assert.equal(await session.unlock(pin.value), "ok");
  session.lock();
  assert.equal(await session.unlock("000000"), "incorrect");
  assert.equal(session.snapshot().waitSeconds, 1);
});

await check("all supported timeouts, last activity and immediate mode have defined behavior", async () => {
  const { session, advance } = fixture();
  assert.deepEqual(AUTO_LOCK_MINUTES, [0, 1, 5, 15, 30]);
  await session.enable(pin);
  advance(60 * 60_000);
  assert.equal(session.snapshot().mode, "unlocked");
  for (const minutes of AUTO_LOCK_MINUTES.slice(1)) {
    assert.equal(session.setAutoLock(minutes), true);
    advance(1000);
    session.activity();
    advance(minutes * 60_000 - 1);
    assert.equal(session.snapshot().mode, "unlocked");
    advance(1);
    assert.equal(session.snapshot().mode, "locked");
    await session.unlock(pin.value);
  }
});

await check("late activity cannot extend an expired timer", async () => {
  const { session, advance } = fixture();
  await session.enable({ ...pin, autoLock: 1 });
  advance(60_000, false);
  session.activity();
  assert.equal(session.snapshot().mode, "locked");
});

await check("changing PIN to password requires fresh proof and retires the previous PIN", async () => {
  const { session, advance } = fixture();
  await session.enable(pin);
  assert.equal(await session.change({ ...password, current: "000000" }), "incorrect");
  assert.equal(await session.change({ ...password, current: pin.value }), "wait");
  advance(1000);
  assert.equal(await session.change({ ...password, current: pin.value }), "ok");
  session.lock();
  assert.equal(await session.unlock(pin.value), "incorrect");
  advance(1000);
  assert.equal(await session.unlock(password.value), "ok");
});

await check("locking cancels pending enroll, unlock and credential replacement", async () => {
  const { session } = fixture();
  const enrollment = session.enable(pin);
  session.lock();
  assert.equal(await enrollment, "interrupted");
  assert.equal(session.snapshot().mode, "disabled");
  await session.enable(pin);
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

console.log(`Application lock: ${passed}/7 başarılı`);
