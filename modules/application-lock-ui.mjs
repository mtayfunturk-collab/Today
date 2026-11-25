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

const settingsMarkup = `
  <h2>Güvenlik ve Gizlilik</h2>
  <p>Uygulama kilidi kişisel ekranları gizler. Cihazdaki verileri şifrelemez.</p>
  <p>Bu denemede kilit yalnızca açık sayfanın oturumunda çalışır.</p>
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
  <h1>Today kilitli</h1>
  <form data-unlock>
    <label>PIN veya parola
      <input name="secret" type="password" autocomplete="off" required maxlength="256">
    </label>
    <button type="submit">Kilidi aç</button>
  </form>
  <p role="status" data-lock-status></p>
  <details><summary>PIN’imi veya parolamı unuttum</summary>
    <p>Kurtarma bu denemede kullanıma açık değil. Today kayıtlarını veya yedeklerini silme.</p>
  </details>`;

const messages = {
  "invalid-secret": "6–12 rakamlı PIN veya en az 12 karakterli parola gir. İki giriş aynı olmalı.",
  incorrect: "PIN veya parola yanlış.",
  interrupted: "İşlem durduruldu. Yeniden dene.",
  unavailable: "Bu cihazda doğrulama şu anda kullanılamıyor.",
  "invalid-state": "Bu işlem şu anda kullanılamıyor."
};

export function mountApplicationLock({ session, privateContent, settings, lockScreen }) {
  const document = privateContent.ownerDocument;
  const view = document.defaultView;
  const events = new view.AbortController();
  const on = (target, event, listener) => target.addEventListener(event, listener, {
    signal: events.signal
  });
  const bind = (root, selector) => root.querySelector(selector);
  privateContent.setAttribute("data-auth-private", "");
  settings.setAttribute("data-auth-settings", "");
  lockScreen.setAttribute("data-auth-screen", "");
  settings.innerHTML = settingsMarkup;
  lockScreen.innerHTML = lockStyles + lockMarkup;
  const configure = bind(settings, "[data-lock-settings]");
  const unlock = bind(lockScreen, "[data-unlock]");
  const settingsStatus = bind(settings, "[data-settings-status]");
  const lockStatus = bind(lockScreen, "[data-lock-status]");
  const currentField = bind(settings, "[data-current-secret]");
  const controls = bind(settings, "[data-lock-controls]");
  const autoLock = bind(settings, "[data-auto-lock]");
  let lastMode;
  let refreshTimer;

  function render(state) {
    const locked = state.mode === "locked";
    const enabled = state.mode !== "disabled";
    if (locked) {
      privateContent.hidden = true;
      privateContent.inert = true;
      lockScreen.hidden = false;
    } else {
      lockScreen.hidden = true;
      privateContent.inert = false;
      privateContent.hidden = false;
    }
    if (state.mode !== lastMode) {
      configure.reset();
      unlock.reset();
      settingsStatus.textContent = "";
      lockStatus.textContent = "";
      if (locked && !document.hidden) unlock.elements.secret.focus();
    }
    lastMode = state.mode;
    currentField.hidden = !enabled;
    configure.elements.current.required = enabled;
    configure.elements.current.disabled = !enabled;
    configure.querySelector("button").textContent = enabled ? "PIN veya parolayı değiştir" : "Kilidi etkinleştir";
    controls.hidden = !enabled;
    autoLock.value = String(state.minutes);
    unlock.elements.secret.inputMode = state.type === "pin" ? "numeric" : "text";
    for (const form of [configure, unlock]) {
      form.querySelector("button").disabled = state.busy || state.waitSeconds > 0;
    }
    view.clearTimeout(refreshTimer);
    if (state.waitSeconds) {
      (locked ? lockStatus : settingsStatus).textContent =
        `Yeniden denemek için ${state.waitSeconds} saniye bekle.`;
      refreshTimer = view.setTimeout(() => render(session.snapshot()), 1000);
    } else {
      for (const status of [settingsStatus, lockStatus]) {
        if (status.textContent.startsWith("Yeniden denemek için ")) status.textContent = "";
      }
    }
  }

  const unsubscribe = session.subscribe(render);
  on(configure, "submit", async event => {
    event.preventDefault();
    const data = Object.fromEntries(new view.FormData(configure));
    const enabled = session.snapshot().mode !== "disabled";
    for (const name of ["current", "value", "confirmation"]) configure.elements[name].value = "";
    const result = await (enabled ? session.change(data) : session.enable(data));
    if (session.snapshot().mode === "locked" || events.signal.aborted) return;
    if (result === "ok") settingsStatus.textContent = enabled ? "Yeni giriş bilgisi hazır." : "Oturum kilidi etkin.";
    else if (!session.snapshot().waitSeconds && messages[result]) settingsStatus.textContent = messages[result];
  });
  on(unlock, "submit", async event => {
    event.preventDefault();
    const secret = unlock.elements.secret.value;
    unlock.reset();
    const result = await session.unlock(secret);
    if (events.signal.aborted) return;
    if (result === "ok") bind(settings, "[data-lock-now]").focus();
    else if (!session.snapshot().waitSeconds && messages[result]) lockStatus.textContent = messages[result];
  });
  on(autoLock, "change", () => session.setAutoLock(Number(autoLock.value)));
  on(bind(settings, "[data-lock-now]"), "click", () => session.lock());
  on(document, "pointerdown", session.activity);
  on(document, "keydown", session.activity);
  on(document, "visibilitychange", () => {
    if (document.hidden) session.lock();
    else if (session.snapshot().mode === "locked") unlock.elements.secret.focus();
  });
  on(view, "pagehide", session.lock);
  on(view, "pageshow", event => {
    if (event.persisted) session.lock();
  });
  return () => {
    events.abort();
    session.lock();
    unsubscribe();
    view.clearTimeout(refreshTimer);
  };
}
