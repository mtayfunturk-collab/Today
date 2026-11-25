import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { createApplicationLockDevice } from "../modules/application-lock-device.mjs";
import { createApplicationLock } from "../modules/application-lock.mjs";
import { createApplicationLockStore } from "../modules/application-lock-store.mjs";

const b64 = data => Buffer.from(data).toString("base64url");
const text = data => new TextEncoder().encode(data);
const origin = "https://staging.example";
const rpId = "staging.example";
const crypto = globalThis.crypto;
const signal = () => new AbortController().signal;
let passed = 0;
async function check(name, test) {
  await test();
  passed++;
  console.log("PASS " + name);
}

function der(raw) {
  const signature = new Uint8Array(raw);
  const integers = [signature.slice(0, 32), signature.slice(32)].flatMap(part => {
    const clean = Array.from(part);
    while (clean.length > 1 && clean[0] === 0) clean.shift();
    if (clean[0] & 128) clean.unshift(0);
    return [2, clean.length, ...clean];
  });
  return Uint8Array.of(0x30, integers.length, ...integers);
}

async function windowsFixture() {
  let flags = 5, count = 0, clientOrigin = origin, changedChallenge = false, badSignature = false;
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const id = Uint8Array.of(90, 91, 92);
  const spki = await crypto.subtle.exportKey("spki", keys.publicKey);
  async function data(type, options) {
    const raw = text(JSON.stringify({ type, origin: clientOrigin,
      challenge: changedChallenge ? "wrong" : b64(options.challenge), crossOrigin: false }));
    const auth = new Uint8Array(37);
    auth.set(new Uint8Array(await crypto.subtle.digest("SHA-256", text(rpId))));
    auth[32] = flags;
    new DataView(auth.buffer).setUint32(33, count);
    return { raw, auth };
  }
  const view = {
    crypto, isSecureContext: true, location: { origin, hostname: rpId },
    PublicKeyCredential: { isUserVerifyingPlatformAuthenticatorAvailable: async () => true },
    AuthenticatorAttestationResponse: { prototype: { getPublicKey() {}, getAuthenticatorData() {} } },
    navigator: { platform: "Win32", credentials: {
      async create({ publicKey }) {
        assert.equal(publicKey.authenticatorSelection.authenticatorAttachment, "platform");
        assert.equal(publicKey.authenticatorSelection.userVerification, "required");
        const { raw, auth } = await data("webauthn.create", publicKey);
        return { type: "public-key", authenticatorAttachment: "platform", rawId: id, response: {
          clientDataJSON: raw, getPublicKeyAlgorithm: () => -7, getPublicKey: () => spki,
          getAuthenticatorData: () => auth
        } };
      },
      async get({ publicKey }) {
        assert.equal(publicKey.rpId, rpId);
        assert.equal(publicKey.userVerification, "required");
        const { raw, auth } = await data("webauthn.get", publicKey);
        const signed = Uint8Array.from([...auth, ...new Uint8Array(await crypto.subtle.digest("SHA-256", raw))]);
        const signature = der(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, signed));
        if (badSignature) signature[signature.length - 1] ^= 1;
        return { type: "public-key", authenticatorAttachment: "platform", rawId: id,
          response: { clientDataJSON: raw, authenticatorData: auth, signature } };
      }
    } }
  };
  return {
    view, device: createApplicationLockDevice(view),
    flags: value => { flags = value; }, count: value => { count = value; },
    origin: value => { clientOrigin = value; },
    badChallenge: () => { changedChallenge = true; },
    badSignature: () => { badSignature = true; }
  };
}

await check("unsupported platforms and nonsecure contexts expose no device option", async () => {
  const { view } = await windowsFixture();
  for (const platform of ["iPhone", "MacIntel", "Linux armv8l", "Android"]) {
    assert.equal(createApplicationLockDevice({ ...view, navigator: { ...view.navigator, platform } }), null);
  }
  assert.equal(createApplicationLockDevice({ ...view, isSecureContext: false }), null);
  assert.equal(createApplicationLockDevice({ ...view, TodayNativeBiometrics: {
    isNative: true, available: false, platform: "ios"
  } }), null);
});

await check("Windows platform key validates ES256 signatures and an increasing counter", async () => {
  const f = await windowsFixture();
  const enrolled = await f.device.enroll(signal());
  assert.equal(enrolled.kind, "webauthn");
  f.count(1);
  assert.equal((await f.device.verify(enrolled, signal())).count, 1);
  await assert.rejects(f.device.verify({ ...enrolled, count: 1 }, signal()));
  f.badSignature();
  await assert.rejects(f.device.verify(enrolled, signal()));
});

await check("WebAuthn requires expected origin and challenge, UV and a non-backup key", async () => {
  const f = await windowsFixture();
  for (const flag of [1, 13, 21]) {
    f.flags(flag);
    await assert.rejects(f.device.enroll(signal()));
  }
  f.flags(5);
  const enrolled = await f.device.enroll(signal());
  f.origin("https://unrelated.example");
  await assert.rejects(f.device.verify(enrolled, signal()));
  f.origin(origin);
  f.flags(13);
  await assert.rejects(f.device.verify(enrolled, signal()));
  f.flags(5);
  f.badChallenge();
  await assert.rejects(f.device.verify(enrolled, signal()));
});

await check("native bridge disables OS fallback and uses protected unpredictable credentials", async () => {
  let item, available = true;
  const removed = [];
  const plugin = {
    isAvailable: async options => {
      assert.equal(options.useFallback, false);
      return { isAvailable: available, strongBiometryIsAvailable: available, biometryType: 2 };
    },
    verifyIdentity: async options => assert.equal(options.useFallback, false),
    setCredentials: async options => {
      assert.equal(options.accessControl, 1);
      assert.equal(options.authValidityDuration, 0);
      item = options;
    },
    getSecureCredentials: async options => {
      assert.equal(options.server, item.server);
      return item;
    },
    deleteCredentials: async options => removed.push(options.server)
  };
  const device = createApplicationLockDevice({ crypto, TodayNativeBiometrics: {
    isNative: true, available: true, platform: "ios", plugin, type: { FACE_ID: 2, TOUCH_ID: 1 }, protection: 1
  } });
  assert.equal(await device.available(), true);
  const saved = await device.enroll(signal());
  assert.equal(saved.proof.length, 43);
  assert.notEqual(saved.proof, item.password);
  assert.equal(await device.verify(saved, signal()), saved);
  item.password = "different";
  await assert.rejects(device.verify(saved, signal()));
  await device.discard(saved);
  assert.deepEqual(removed, [saved.alias]);
  available = false;
  assert.equal(await device.available(), false);
});

async function sessionFixture(adapt) {
  const { device } = await windowsFixture();
  const store = createApplicationLockStore(new IDBFactory());
  let now = 0;
  let scheduled;
  const clock = {
    now: () => now, wall: () => 1_790_000_000_000 + now,
    schedule: callback => { scheduled = callback; return callback; },
    cancel: () => { scheduled = undefined; }
  };
  const expire = () => { now += 300_000; scheduled?.(); };
  const session = createApplicationLock({ store, device: adapt?.(device) ?? device, clock });
  await session.refresh();
  const secret = { type: "pin", value: "581347", confirmation: "581347" };
  const recovery = session.newRecoveryCode();
  assert.equal(await session.enable({ ...secret, code: recovery, stored: "on" }), "ok");
  return { session, store, secret, recovery, expire };
}

await check("fresh PIN authorizes device enrollment; recovery retires the old device without changing PIN fallback", async () => {
  const { session, store, secret, recovery, expire } = await sessionFixture();
  assert.equal(await session.enrollDevice(), "invalid-state");
  assert.equal(await session.prepareDevice(secret.value), "ok");
  assert.equal(await session.enrollDevice(), "ok");
  assert.equal((await store.readWithDevice()).device.kind, "webauthn");
  session.lock();
  assert.equal(await session.unlockDevice(), "ok");
  expire();
  assert.equal(session.snapshot().mode, "locked");
  const code = session.newRecoveryCode();
  const next = { type: "pin", value: "904317", confirmation: "904317" };
  assert.equal(await session.recover({ ...next, code, previousCode: recovery, stored: "on" }), "ok");
  assert.equal((await store.readWithDevice()).device, null);
  assert.equal(await session.unlockDevice(), "invalid-state");
  assert.equal(await session.unlock(next.value), "ok");
});

await check("lifecycle lock invalidates an outstanding device assertion without invalidating PIN", async () => {
  let resolve, observed;
  const { session, secret } = await sessionFixture(device => ({
    ...device, verify: (saved, incoming) => {
      observed = incoming;
      return new Promise(done => { resolve = () => done(saved); });
    }
  }));
  await session.prepareDevice(secret.value);
  await session.enrollDevice();
  session.lock();
  const pending = session.unlockDevice();
  session.lock();
  assert.equal(observed.aborted, true);
  resolve();
  assert.equal(await pending, "interrupted");
  assert.equal(session.snapshot().mode, "locked");
  assert.equal(await session.unlock(secret.value), "ok");
});

console.log(`Application lock device: ${passed}/6 başarılı`);
