import { AUTO_LOCK_MINUTES } from "./application-lock.mjs";

const lockStyles = `
  <style>
    [data-auth-private][hidden], [data-auth-screen][hidden] { display: none !important }
    [data-auth-screen] {
      box-sizing: border-box; width: min(100%, 28rem); margin: 12vh auto 0;
      padding: clamp(16px, 6vw, 24px); border: 1px solid var(--stroke, #344159);
      border-radius: var(--radius, 24px); background: var(--card, #17233a);
      color: var(--text, #eef2ff); overflow-wrap: anywhere;
    }
    [data-auth-settings] { color: var(--text, #eef2ff); overflow-wrap: anywhere }
    :is([data-auth-screen], [data-auth-settings]) label { display: grid; gap: 6px; margin: 0 0 12px }
    [data-auth-settings] label[hidden] { display: none }
    :is([data-auth-screen], [data-auth-settings]) label[for$="-stored"] { display: flex; align-items: center }
    :is([data-auth-screen], [data-auth-settings]) input[type="checkbox"] {
      flex: none; width: 22px; height: 22px; min-height: 0;
    }
    :is([data-auth-screen], [data-auth-settings]) :is(input, select, button, summary) {
      box-sizing: border-box; min-height: 44px; max-width: 100%; font: inherit;
    }
    :is([data-auth-screen], [data-auth-settings]) :is(input, select) {
      width: 100%; padding: 10px 12px; color: var(--text, #eef2ff);
      background: var(--bg0, #101827); border: 1px solid var(--stroke, #536683);
      border-radius: 12px;
    }
    :is([data-auth-screen], [data-auth-settings]) button {
      padding: 8px 14px; border: 0; border-radius: 12px; white-space: normal;
      background: var(--btn, #fff); color: var(--btnText, #0b1220);
    }
    :is([data-auth-screen], [data-auth-settings]) :focus-visible {
      outline: 2px solid var(--focus, #ffd60a); outline-offset: 3px;
    }
  </style>`;

function codeMarkup(id) {
  return `<p>PIN veya parolanı ve kurtarma kodunu kaybedersen Today içinden kilidi açamazsın. Kayıtların silinmez.</p>
    <button type="button" data-issue-code>Kurtarma kodu oluştur</button>
    <p><output aria-label="Yeni kurtarma kodu" data-recovery-code></output></p>
    <label for="${id}-stored"><input id="${id}-stored" name="stored" type="checkbox" required> Kodu cihaz dışında sakladım</label>`;
}

const settingsMarkup = `
  <h2>Güvenlik ve Gizlilik</h2>
  <p>Uygulama kilidi kişisel ekranları gizler. Cihazdaki verileri şifrelemez.</p>
  <form data-lock-settings>
    <label data-current-secret hidden>Mevcut PIN veya parola
      <input name="current" type="password" autocomplete="off" maxlength="256">
    </label>
    <label>Yöntem
      <select name="type"><option value="pin">PIN</option><option value="password">Parola</option></select>
    </label>
    <label>Yeni PIN veya parola
      <input name="value" type="password" autocomplete="new-password" required maxlength="256">
    </label>
    <label>Yeni PIN veya parolayı yinele
      <input name="confirmation" type="password" autocomplete="new-password" required maxlength="256">
    </label>
    <div data-enrollment-code>${codeMarkup("enroll")}</div>
    <button type="submit">Kilidi etkinleştir</button>
  </form>
  <div data-lock-controls hidden>
    <label>Otomatik kilitleme
      <select data-auto-lock>
        ${AUTO_LOCK_MINUTES.map(value =>
          `<option value="${value}">${value ? `${value} dakika` : "Anında"}</option>`).join("")}
      </select>
    </label>
    <p>Arka plana geçince ekran her zaman kilitlenir. Dakika seçimi, açık ekrandaki hareketsizlik süresidir.</p>
    <button type="button" data-lock-now>Şimdi kilitle</button>
  </div>
  <p role="status" data-settings-status></p>`;

const lockMarkup = `
  <h1>Today hazırlanıyor</h1>
  <form data-unlock>
    <label>PIN veya parola
      <input name="secret" type="password" autocomplete="off" required maxlength="256">
    </label>
    <button type="submit">Kilidi aç</button>
  </form>
  <p role="status" data-lock-status></p>
  <details><summary>PIN’imi veya parolamı unuttum</summary>
    <form data-recover>
      <label>Mevcut kurtarma kodu<input name="previousCode" type="password" autocomplete="off" required maxlength="48"></label>
      <label>Yeni yöntem<select name="type"><option value="pin">PIN</option><option value="password">Parola</option></select></label>
      <label>Yeni PIN veya parola<input name="value" type="password" autocomplete="new-password" required maxlength="256"></label>
      <label>Yeni PIN veya parolayı yinele<input name="confirmation" type="password" autocomplete="new-password" required maxlength="256"></label>
      ${codeMarkup("recover")}
      <button type="submit">Kurtarma koduyla PIN veya parolayı yenile</button>
    </form>
  </details>`;

const messages = {
  "invalid-secret": "6–12 rakamlı PIN veya en az 12 karakterli parola gir. İki giriş aynı olmalı.",
  incorrect: "PIN veya parola yanlış.",
  interrupted: "İşlem durduruldu. Yeniden dene.",
  unavailable: "Bu cihazda doğrulama şu anda kullanılamıyor.",
  "invalid-state": "Bu işlem şu anda kullanılamıyor.",
  "committed-locked": "Değişiklik kaydedildi. Güncel PIN veya parolanla kilidi aç.",
  "enrollment-unavailable": "Diğer Today sekmelerini kapat. Güncel Today sürümünü açıp yeniden dene."
};

export function mountApplicationLock({ session, privateContent, settings, lockScreen, authorize = () => {}, enroll = operation => operation() }) {
  const document = privateContent.ownerDocument;
  const view = document.defaultView;
  const events = new view.AbortController();
  const on = (target, event, listener) => target.addEventListener(event, listener, { signal: events.signal });
  const bind = (root, selector) => root?.querySelector(selector);
  const channel = typeof view.BroadcastChannel === "function" ? new view.BroadcastChannel("today-auth01") : null;
  const changed = () => channel?.postMessage("lock");
  if (channel) on(channel, "message", event => {
    if (event.data === "lock") {
      session.lock();
      void session.refresh();
    }
  });

  privateContent.setAttribute("data-auth-private", "");
  settings?.setAttribute("data-auth-settings", "");
  lockScreen.setAttribute("data-auth-screen", "");
  if (settings) settings.innerHTML = settingsMarkup;
  lockScreen.innerHTML = lockStyles + lockMarkup +
    '<p role="status" data-unavailable hidden>Kilit durumu okunamadı. Sayfayı yeniden aç. Kayıtların silinmedi.</p>';
  const configure = bind(settings, "[data-lock-settings]");
  const unlock = bind(lockScreen, "[data-unlock]");
  const recover = bind(lockScreen, "[data-recover]");
  const settingsStatus = bind(settings, "[data-settings-status]");
  const lockStatus = bind(lockScreen, "[data-lock-status]");
  const currentField = bind(settings, "[data-current-secret]");
  const controls = bind(settings, "[data-lock-controls]");
  const autoLock = bind(settings, "[data-auto-lock]");
  const resetCode = form => {
    const output = bind(form, "[data-recovery-code]");
    if (output) output.textContent = "";
  };
  let lastMode, authorized = false, refreshTimer, enrolling = false;
  const allowed = mode => mode === "unlocked" || mode === "disabled";
  const manual = bind(settings, "[data-lock-now]") ?? bind(privateContent, "[data-lock-now]");

  function render(state) {
    const visible = allowed(state.mode);
    privateContent.hidden = !visible;
    privateContent.inert = !visible;
    lockScreen.hidden = visible;
    bind(lockScreen, "h1").textContent = state.mode === "locked" ? "Today kilitli" :
      state.mode === "blocked" ? "Today açılamadı" : "Today hazırlanıyor";
    unlock.hidden = state.mode !== "locked";
    bind(lockScreen, "details").hidden = state.mode !== "locked";
    bind(lockScreen, "[data-unavailable]").hidden = state.mode !== "blocked";
    if (visible && !authorized) {
      authorized = true;
      authorize();
    }
    if (state.mode !== lastMode) {
      for (const form of [configure, unlock, recover]) {
        form?.reset();
        resetCode(form);
      }
      if (settingsStatus) settingsStatus.textContent = "";
      lockStatus.textContent = "";
      if (!visible && allowed(lastMode)) view.dispatchEvent(new view.Event("today:application-lock"));
      if (state.mode === "locked" && !document.hidden) unlock.elements.secret.focus();
    }
    lastMode = state.mode;
    const enabled = state.mode === "unlocked" || state.mode === "locked";
    if (settings) {
      currentField.hidden = !enabled;
      configure.elements.current.required = enabled;
      configure.elements.current.disabled = !enabled;
      bind(configure, "[data-enrollment-code]").hidden = enabled;
      configure.elements.stored.required = !enabled;
      configure.elements.stored.disabled = enabled;
      bind(configure, 'button[type="submit"]').textContent = enabled ? "PIN veya parolayı değiştir" : "Kilidi etkinleştir";
      controls.hidden = !enabled;
      autoLock.value = String(state.minutes);
      autoLock.disabled = state.busy || state.waitSeconds > 0;
    } else if (manual) manual.hidden = !enabled;
    unlock.elements.secret.inputMode = state.type === "pin" ? "numeric" : "text";
    for (const form of [configure, unlock, recover]) {
      if (form) bind(form, 'button[type="submit"]').disabled = enrolling || state.busy || state.waitSeconds > 0;
    }
    view.clearTimeout(refreshTimer);
    const status = visible ? settingsStatus : lockStatus;
    if (state.waitSeconds && status) {
      status.textContent = `Yeniden denemek için ${state.waitSeconds} saniye bekle.`;
      refreshTimer = view.setTimeout(() => render(session.snapshot()), 1000);
    } else if (status?.textContent.startsWith("Yeniden denemek için ")) status.textContent = "";
  }

  function report(status, result, success) {
    if (result === "ok") status.textContent = success;
    else if (!session.snapshot().waitSeconds && messages[result]) status.textContent = messages[result];
  }

  for (const form of [configure, recover]) {
    if (!form) continue;
    const updateInputMode = () => {
      for (const name of ["value", "confirmation"]) form.elements[name].inputMode =
        form.elements.type.value === "pin" ? "numeric" : "text";
    };
    on(form.elements.type, "change", updateInputMode);
    on(form, "reset", () => view.queueMicrotask(updateInputMode));
    updateInputMode();
    on(bind(form, "[data-issue-code]"), "click", () => {
      try {
        const code = session.newRecoveryCode();
        if (!code) return;
        bind(form, "[data-recovery-code]").textContent = code;
        form.elements.stored.checked = false;
      } catch {
        report(form === configure ? settingsStatus : lockStatus, "unavailable");
      }
    });
  }

  if (configure) on(configure, "submit", async event => {
    event.preventDefault();
    const data = Object.fromEntries(new view.FormData(configure));
    const enabled = session.snapshot().mode === "unlocked";
    if (!enabled) data.code = bind(configure, "[data-recovery-code]").textContent;
    configure.reset();
    resetCode(configure);
    let result;
    if (enabled) result = await session.change(data);
    else {
      if (enrolling) return;
      enrolling = true;
      render(session.snapshot());
      try {
        result = await enroll(() => session.enable(data));
      } catch { result = "enrollment-unavailable"; }
      finally {
        session.discardRecoveryCode();
        enrolling = false;
        render(session.snapshot());
      }
    }
    if (result === "ok" || result === "committed-locked") changed();
    if (result === "committed-locked") report(lockStatus, result);
    else if (allowed(session.snapshot().mode)) report(settingsStatus, result, enabled ? "Yeni giriş bilgisi hazır." : "Uygulama kilidi etkin.");
  });
  on(unlock, "submit", async event => {
    event.preventDefault();
    const secret = unlock.elements.secret.value;
    unlock.reset();
    const result = await session.unlock(secret);
    if (result === "ok") (manual ?? privateContent).focus();
    else report(lockStatus, result);
  });
  on(recover, "submit", async event => {
    event.preventDefault();
    const data = Object.fromEntries(new view.FormData(recover));
    data.code = bind(recover, "[data-recovery-code]").textContent;
    recover.reset();
    resetCode(recover);
    const result = await session.recover(data);
    if (result === "ok" || result === "committed-locked") {
      changed();
      bind(lockScreen, "details").open = false;
      unlock.elements.secret.focus();
    }
    report(lockStatus, result, "Yeni PIN veya parolanla kilidi aç.");
  });
  if (autoLock) on(autoLock, "change", async () => {
    const result = await session.setAutoLock(Number(autoLock.value));
    if (result === "ok" || result === "committed-locked") changed();
    report(result === "committed-locked" ? lockStatus : settingsStatus, result, "Otomatik kilitleme güncellendi.");
  });
  if (manual) on(manual, "click", () => {
    session.lock();
    changed();
  });
  function suspend() {
    session.lock();
    for (const form of [configure, unlock, recover]) {
      form?.reset();
      resetCode(form);
    }
  }
  on(document, "pointerdown", session.activity);
  on(document, "keydown", session.activity);
  on(document, "input", session.activity);
  on(document, "visibilitychange", () => {
    if (document.hidden) suspend();
    else {
      void session.refresh();
      if (session.snapshot().mode === "locked") unlock.elements.secret.focus();
    }
  });
  on(view, "focus", () => { if (!document.hidden) void session.refresh(); });
  on(view, "pagehide", suspend);
  on(view, "pageshow", event => {
    if (event.persisted) {
      suspend();
      void session.refresh();
    }
  });
  const unsubscribe = session.subscribe(render);
  void session.refresh();
  return () => {
    events.abort();
    channel?.close();
    suspend();
    unsubscribe();
    view.clearTimeout(refreshTimer);
  };
}
