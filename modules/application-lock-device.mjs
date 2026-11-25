const encode = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const decode = value => Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0));
const bytes = text => new TextEncoder().encode(text);
const random = (crypto, size) => crypto.getRandomValues(new Uint8Array(size));
const hash = async (crypto, text) => encode(await crypto.subtle.digest("SHA-256", bytes(text)));
const fail = () => { throw Error("device-verification-unavailable"); };
const bounded = (value, max) => typeof value === "string" && value.length > 0 &&
  value.length <= max && /^[A-Za-z0-9_-]+$/.test(value);

export function validDeviceEnrollment(value) {
  if (value?.kind === "native") return Object.keys(value).length === 3 &&
    /^today-auth01-[A-Za-z0-9_-]{22}$/.test(value.alias) &&
    bounded(value.proof, 43) && value.proof.length === 43;
  return value?.kind === "webauthn" && Object.keys(value).length === 4 && bounded(value.id, 1400) && bounded(value.key, 400) &&
    Number.isSafeInteger(value.count) && value.count >= 0 && value.count <= 0xffffffff;
}

// WebAuthn returns an ASN.1 ECDSA signature; Web Crypto verifies fixed-width r || s.
function rawSignature(signature) {
  const der = new Uint8Array(signature);
  if (der.length < 8 || der.length > 72 || der[0] !== 0x30 || der[1] !== der.length - 2) fail();
  const out = new Uint8Array(64);
  let p = 2;
  for (const offset of [0, 32]) {
    if (der[p++] !== 2) fail();
    const n = der[p++];
    if (!(n >= 1 && n <= 33) || p + n > der.length || der[p] & 0x80 ||
        (n > 1 && der[p] === 0 && !(der[p + 1] & 0x80))) fail();
    const number = der.subarray(p + (n === 33 ? 1 : 0), p + n);
    if (n === 33 && der[p] !== 0) fail();
    out.set(number, offset + 32 - number.length);
    p += n;
  }
  if (p !== der.length) fail();
  return out;
}

async function verifyData(crypto, response, type, challenge, origin, rpId, authData) {
  const raw = new Uint8Array(response.clientDataJSON);
  const auth = new Uint8Array(authData);
  if (!raw.length || raw.length > 8192 || auth.length < 37 || auth.length > 4096) fail();
  const client = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  if (client.type !== type || client.challenge !== encode(challenge) || client.origin !== origin ||
      client.crossOrigin === true || (client.topOrigin && client.topOrigin !== origin)) fail();
  const expected = await hash(crypto, rpId);
  // Require user presence and verification, and a device-bound credential (BE=0, BS=0).
  if (encode(auth.slice(0, 32)) !== expected || (auth[32] & 0x05) !== 0x05 || auth[32] & 0x18) fail();
  return { raw, auth, count: new DataView(auth.buffer).getUint32(33) };
}

function windowsDevice(view) {
  const { crypto, location, navigator, PublicKeyCredential: credential } = view;
  const platform = navigator.userAgentData?.platform ?? navigator.platform ?? "";
  if (!view.isSecureContext || !/^Win/i.test(platform) || !credential ||
      typeof credential.isUserVerifyingPlatformAuthenticatorAvailable !== "function" ||
      !view.AuthenticatorAttestationResponse?.prototype.getPublicKey ||
      !view.AuthenticatorAttestationResponse?.prototype.getAuthenticatorData) return null;
  const rpId = location.hostname;
  const origin = location.origin;
  const publicKey = () => ({ challenge: random(crypto, 32), timeout: 60_000 });
  return {
    kind: "webauthn",
    label: "Windows Hello ile doğrula",
    note: "Windows güvenlik penceresinde bu Windows cihazını seç. Eşitlenen kimlik bilgileri Today kilidine eklenmez.",
    available: () => credential.isUserVerifyingPlatformAuthenticatorAvailable(),
    async enroll(signal) {
      const key = publicKey();
      const result = await navigator.credentials.create({ signal, publicKey: {
        ...key, rp: { id: rpId, name: "Today" },
        user: { id: random(crypto, 32), name: "today-local", displayName: "Today yerel kilit" },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        authenticatorSelection: {
          authenticatorAttachment: "platform", residentKey: "discouraged", userVerification: "required"
        }, attestation: "none", hints: ["client-device"]
      } });
      if (result?.type !== "public-key" || result.authenticatorAttachment !== "platform" ||
          result.response.getPublicKeyAlgorithm() !== -7) fail();
      const { count } = await verifyData(crypto, result.response, "webauthn.create", key.challenge,
        origin, rpId, result.response.getAuthenticatorData());
      const spki = result.response.getPublicKey();
      const enrollment = { kind: "webauthn", id: encode(result.rawId), key: encode(spki), count };
      if (!validDeviceEnrollment(enrollment)) fail();
      await crypto.subtle.importKey("spki", spki, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
      return enrollment;
    },
    async verify(enrollment, signal) {
      const options = publicKey();
      const assertion = await navigator.credentials.get({ signal, publicKey: {
        ...options, rpId, userVerification: "required", hints: ["client-device"],
        allowCredentials: [{ type: "public-key", id: decode(enrollment.id), transports: ["internal"] }]
      } });
      if (assertion?.type !== "public-key" || assertion.authenticatorAttachment !== "platform" ||
          encode(assertion.rawId) !== enrollment.id) fail();
      const response = assertion.response;
      const { raw, auth, count } = await verifyData(crypto, response, "webauthn.get",
        options.challenge, origin, rpId, response.authenticatorData);
      if ((count !== 0 || enrollment.count !== 0) && count <= enrollment.count) fail();
      const data = new Uint8Array(auth.length + 32);
      data.set(auth);
      data.set(new Uint8Array(await crypto.subtle.digest("SHA-256", raw)), auth.length);
      const key = await crypto.subtle.importKey("spki", decode(enrollment.key), {
        name: "ECDSA", namedCurve: "P-256"
      }, false, ["verify"]);
      if (!await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, rawSignature(response.signature), data)) fail();
      return { ...enrollment, count };
    }
  };
}

function nativeDevice(view, bridge) {
  const { plugin, platform, type, protection } = bridge;
  if (!bridge.available || !["ios", "android"].includes(platform)) return null;
  const { crypto } = view;
  const prompt = { title: "Today kilidini aç", reason: "Today kilidini cihaz biyometrisiyle doğrula.",
    useFallback: false, negativeButtonText: "İptal", maxAttempts: 1 };
  return {
    kind: "native",
    label: "Biyometriyle doğrula",
    async available() {
      const status = await plugin.isAvailable({ useFallback: false });
      return status.isAvailable && status.strongBiometryIsAvailable &&
        (platform === "ios" ? [type.FACE_ID, type.TOUCH_ID] : [type.FINGERPRINT, type.MULTIPLE])
          .includes(status.biometryType);
    },
    async enroll(signal) {
      if (signal.aborted) fail();
      const alias = "today-auth01-" + encode(random(crypto, 16));
      const token = encode(random(crypto, 32));
      try {
        if (platform === "ios") await plugin.verifyIdentity({ ...prompt, fallbackTitle: "" });
        if (signal.aborted) fail();
        await plugin.setCredentials({ ...prompt, server: alias, username: "today", password: token,
          accessControl: protection, authValidityDuration: 0 });
        if (signal.aborted) fail();
        return { kind: "native", alias, proof: await hash(crypto, token) };
      } catch (error) {
        await plugin.deleteCredentials({ server: alias }).catch(() => {});
        throw error;
      }
    },
    async verify(enrollment, signal) {
      if (signal.aborted) fail();
      const item = await plugin.getSecureCredentials({ ...prompt, server: enrollment.alias });
      if (signal.aborted || item.username !== "today" || !bounded(item.password, 44) ||
          await hash(crypto, item.password) !== enrollment.proof) fail();
      return enrollment;
    },
    discard: enrollment => plugin.deleteCredentials({ server: enrollment.alias })
  };
}

export function createApplicationLockDevice(view) {
  return view.TodayNativeBiometrics?.isNative
    ? nativeDevice(view, view.TodayNativeBiometrics) : windowsDevice(view);
}
