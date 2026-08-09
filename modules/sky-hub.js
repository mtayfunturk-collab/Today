/**
 * Today App — Sky Hub
 * NUT-016.1 — Sky Ana Ekranı
 *
 * Amaç:
 * - Today Sky için kalıcı ana bilgi mimarisini kurmak
 * - Bugünün Gökyüzü, Harita Özeti, Önemli Dönemler ve Doğum Bilgileri
 *   alanlarını tek Sky rotası altında toplamak
 * - Sonraki NUT adımları için veri üretmeyen ekran kabukları hazırlamak
 * - Astroloji hesap motoru, konum izni, ağ çağrısı ve veri saklama eklememek
 */
(function () {
  "use strict";

  const API_VERSION = 1;
  const RULESET_ID = "today:sky:hub:nut-016.1";
  const VIEW_SELECTOR = '[data-view="sky"]';
  const PROFILE_STATES = Object.freeze([
    "missing",
    "ready"
  ]);
  const PANEL_DEFINITIONS = Object.freeze({
    birth: Object.freeze({
      title: "Doğum Bilgileri",
      description:
        "Doğum tarihi, saati ve yerini ekleme ve düzenleme alanı burada yer alacak.",
      stage: "NUT-016.2",
      icon: "○",
      requiresProfile: false
    }),
    natal: Object.freeze({
      title: "Harita Özeti",
      description:
        "Güneş, Ay, yükselen ve temel harita yerleşimlerinin sade özeti burada yer alacak.",
      stage: "NUT-016.3",
      icon: "◎",
      requiresProfile: true
    }),
    today: Object.freeze({
      title: "Bugünün Gökyüzü",
      description:
        "Güncel gökyüzünün sade günlük görünümü burada yer alacak.",
      stage: "NUT-016.4",
      icon: "✦",
      requiresProfile: true
    }),
    periods: Object.freeze({
      title: "Önemli Dönemler",
      description:
        "Devam eden ve yaklaşan belirgin dönemlerin görünümü burada yer alacak.",
      stage: "NUT-016.5",
      icon: "◌",
      requiresProfile: true
    })
  });

  let initialized = false;
  let activePanel = "hub";
  let profileStatus = "missing";
  let skyView = null;
  let hub = null;
  let panelShell = null;
  let backButton = null;
  let interactionBound = false;
  let routeBound = false;

  function createElement(tag, options = {}) {
    const element = document.createElement(tag);

    if (options.className) element.className = options.className;
    if (options.id) element.id = options.id;
    if (options.text !== undefined) {
      element.textContent = String(options.text);
    }
    if (options.type) element.type = options.type;

    Object.entries(options.attributes || {}).forEach(
      ([name, value]) => {
        element.setAttribute(name, String(value));
      }
    );

    return element;
  }

  function installStyles() {
    if (document.getElementById("todaySkyHubStyles")) return;

    const style = document.createElement("style");
    style.id = "todaySkyHubStyles";
    style.textContent = `
      body[data-route="sky"] .wrap {
        align-items: flex-start !important;
      }

      body[data-route="sky"] .screen {
        min-height: calc(100dvh - 28px);
      }

      .skyView {
        --sky-accent: #8192ff;
        width: 100%;
        min-width: 0;
        max-width: 100%;
        padding-bottom: 18px;
        overflow-x: clip;
      }

      html[data-theme="light"] .skyView {
        --sky-accent: #4e62ca;
      }

      .skyView.show {
        min-height: calc(100dvh - 28px);
        display: flex !important;
        flex-direction: column;
      }

      .skyView > .topbar {
        position: relative;
        min-height: 50px;
        margin-bottom: 4px;
      }

      .skyView > .topbar .pill {
        position: absolute;
        left: 50%;
        top: 50%;
        max-width: calc(100% - 116px);
        transform: translate(-50%, -50%);
        overflow: hidden;
        border: 0;
        padding: 0 8px;
        background: transparent;
        color: var(--text);
        font-size: 20px;
        font-weight: 900;
        letter-spacing: -.02em;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .skyView > .topbar .topbarSpacer {
        width: 44px;
        height: 44px;
        flex: 0 0 44px;
      }

      .skyView > .bottomNav {
        flex: 0 0 auto;
        margin-top: auto !important;
      }

      .skyHub,
      .skyPanelShell {
        width: 100%;
        min-width: 0;
        max-width: 100%;
      }

      .skyHub[hidden],
      .skyPanelShell[hidden] {
        display: none !important;
      }

      .skyHub {
        display: grid;
        gap: 14px;
        padding-top: 2px;
      }

      .skyHubHeader {
        padding: 4px 4px 8px;
        text-align: center;
      }

      .skyHubMark {
        width: 56px;
        height: 56px;
        display: grid;
        place-items: center;
        margin: 0 auto 11px;
        border: 1px solid color-mix(in srgb, var(--sky-accent) 40%, var(--stroke));
        border-radius: 19px;
        background: color-mix(in srgb, var(--sky-accent) 13%, transparent);
        color: color-mix(in srgb, var(--sky-accent) 72%, var(--text));
        font-size: 30px;
        font-weight: 900;
        line-height: 1;
      }

      .skyHubTitle {
        margin: 0;
        font-size: 23px;
        line-height: 1.2;
        letter-spacing: -.02em;
      }

      .skyHubIntro {
        max-width: 35ch;
        margin: 7px auto 0;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.45;
      }

      .skyHubCards {
        display: grid;
        gap: 11px;
        width: 100%;
      }

      .skyHubCard {
        width: 100%;
        min-width: 0;
        min-height: 82px;
        display: flex;
        align-items: center;
        gap: 13px;
        border: 1px solid var(--stroke);
        border-radius: 20px;
        padding: 15px;
        background: rgba(255,255,255,.035);
        color: var(--text);
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .skyHubCard:active {
        transform: scale(.992);
      }

      .skyPrimaryCard {
        min-height: 116px;
        border-color: color-mix(in srgb, var(--sky-accent) 38%, var(--stroke));
        background:
          linear-gradient(
            145deg,
            color-mix(in srgb, var(--sky-accent) 18%, transparent),
            rgba(255,255,255,.035)
          );
      }

      .skyCardIcon {
        width: 45px;
        height: 45px;
        flex: 0 0 45px;
        display: grid;
        place-items: center;
        border: 1px solid color-mix(in srgb, var(--sky-accent) 30%, var(--stroke));
        border-radius: 15px;
        background: color-mix(in srgb, var(--sky-accent) 9%, transparent);
        color: color-mix(in srgb, var(--sky-accent) 68%, var(--text));
        font-size: 23px;
        font-weight: 900;
        line-height: 1;
      }

      .skyPrimaryCard .skyCardIcon {
        width: 50px;
        height: 50px;
        flex-basis: 50px;
        border-radius: 17px;
        font-size: 26px;
      }

      .skyCardCopy {
        min-width: 0;
        flex: 1;
      }

      .skyCardCopy strong {
        display: block;
        font-size: 16px;
        line-height: 1.25;
      }

      .skyPrimaryCard .skyCardCopy strong {
        font-size: 18px;
      }

      .skyCardCopy span {
        display: block;
        margin-top: 4px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.4;
      }

      .skyCardMeta {
        display: inline-flex !important;
        width: max-content;
        max-width: 100%;
        margin-top: 9px !important;
        border: 1px solid color-mix(in srgb, var(--sky-accent) 34%, var(--stroke));
        border-radius: 999px;
        padding: 5px 8px;
        color: color-mix(in srgb, var(--sky-accent) 72%, var(--text)) !important;
        font-size: 10px !important;
        font-weight: 850;
      }

      .skyCardArrow {
        flex: 0 0 auto;
        color: var(--muted);
        font-size: 20px;
      }

      .skyStatus {
        min-height: 18px;
        margin: 0 2px;
        color: var(--muted);
        font-size: 11px;
        line-height: 1.4;
        text-align: center;
      }

      .skyPanelShell {
        min-height: min(58dvh, 460px);
        display: grid;
        place-items: center;
        padding: 22px 2px;
      }

      .skyPanelCard {
        width: min(100%, 380px);
        padding: 24px 18px;
        border: 1px solid color-mix(in srgb, var(--sky-accent) 30%, var(--stroke));
        border-radius: 22px;
        background:
          linear-gradient(
            145deg,
            color-mix(in srgb, var(--sky-accent) 11%, transparent),
            rgba(255,255,255,.03)
          );
        text-align: center;
      }

      .skyPanelIcon {
        width: 54px;
        height: 54px;
        display: grid;
        place-items: center;
        margin: 0 auto 13px;
        border: 1px solid color-mix(in srgb, var(--sky-accent) 36%, var(--stroke));
        border-radius: 18px;
        color: color-mix(in srgb, var(--sky-accent) 72%, var(--text));
        font-size: 27px;
        line-height: 1;
      }

      .skyPanelCard h2 {
        margin: 0;
        font-size: 21px;
        line-height: 1.25;
      }

      .skyPanelDescription,
      .skyPanelNote {
        margin: 8px auto 0;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.5;
      }

      .skyPanelNote {
        max-width: 34ch;
        font-size: 11px;
      }

      .skyPanelBadge {
        display: inline-block;
        margin-top: 15px;
        border: 1px solid color-mix(in srgb, var(--sky-accent) 36%, var(--stroke));
        border-radius: 999px;
        padding: 7px 10px;
        color: color-mix(in srgb, var(--sky-accent) 72%, var(--text));
        font-size: 11px;
        font-weight: 850;
      }

      .skyPanelBack {
        width: 100%;
        min-height: 44px;
        margin-top: 17px;
        border: 1px solid var(--stroke);
        border-radius: 14px;
        background: rgba(255,255,255,.045);
        color: var(--text);
        font: inherit;
        font-weight: 850;
        cursor: pointer;
      }

      @media (max-width: 380px) {
        .skyHub {
          gap: 12px;
        }

        .skyHubCard {
          min-height: 78px;
          padding: 13px;
        }

        .skyPrimaryCard {
          min-height: 108px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .skyHubCard:active {
          transform: none;
        }
      }

      @media (forced-colors: active) {
        .skyHubCard,
        .skyPanelCard,
        .skyHubMark,
        .skyCardIcon,
        .skyPanelIcon {
          forced-color-adjust: auto;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createCard({
    id,
    panel,
    icon,
    title,
    description,
    primary = false
  }) {
    const button = createElement("button", {
      className:
        primary
          ? "skyHubCard skyPrimaryCard"
          : "skyHubCard",
      id,
      type: "button",
      attributes: {
        "data-sky-open": panel,
        "aria-label": title
      }
    });
    const iconElement = createElement("span", {
      className: "skyCardIcon",
      text: icon,
      attributes: { "aria-hidden": "true" }
    });
    const copy = createElement("span", {
      className: "skyCardCopy"
    });
    const titleElement = createElement("strong", {
      id: primary ? "skyPrimaryTitle" : undefined,
      text: title
    });
    const descriptionElement = createElement("span", {
      id: primary ? "skyPrimaryDescription" : undefined,
      text: description
    });

    copy.append(titleElement, descriptionElement);

    if (primary) {
      copy.appendChild(
        createElement("span", {
          className: "skyCardMeta",
          id: "skyPrimaryMeta",
          text: "Profil gerekli"
        })
      );
    }

    button.append(
      iconElement,
      copy,
      createElement("span", {
        className: "skyCardArrow",
        text: "›",
        attributes: { "aria-hidden": "true" }
      })
    );

    return button;
  }

  function buildHub() {
    const section = createElement("section", {
      className: "skyHub",
      id: "skyHub",
      attributes: { "aria-labelledby": "skyTitle" }
    });
    const header = createElement("header", {
      className: "skyHubHeader"
    });

    header.append(
      createElement("div", {
        className: "skyHubMark",
        text: "✦",
        attributes: { "aria-hidden": "true" }
      }),
      createElement("h1", {
        className: "skyHubTitle",
        id: "skyTitle",
        text: "Today Sky",
        attributes: {
          "data-view-title": "",
          tabindex: "-1"
        }
      }),
      createElement("p", {
        className: "skyHubIntro",
        text: "Gökyüzünün ritmini sade biçimde gör."
      })
    );

    const cards = createElement("div", {
      className: "skyHubCards",
      attributes: {
        "aria-label": "Today Sky alanları"
      }
    });

    cards.append(
      createCard({
        id: "skyPrimaryCard",
        panel: "birth",
        icon: "✦",
        title: "Gökyüzü profilini oluştur",
        description:
          "Kişisel görünümü hazırlamak için doğum bilgilerini ekle.",
        primary: true
      }),
      createCard({
        id: "skyNatalCard",
        panel: "natal",
        icon: "◎",
        title: "Harita Özeti",
        description:
          "Temel yerleşimlerin için sade bir görünüm."
      }),
      createCard({
        id: "skyPeriodsCard",
        panel: "periods",
        icon: "◌",
        title: "Önemli Dönemler",
        description:
          "Devam eden ve yaklaşan belirgin dönemler."
      }),
      createCard({
        id: "skyBirthCard",
        panel: "birth",
        icon: "○",
        title: "Doğum Bilgileri",
        description:
          "Tarih, saat ve yer bilgilerini ekle."
      })
    );

    section.append(
      header,
      cards,
      createElement("div", {
        className: "skyStatus",
        id: "skyStatus",
        attributes: {
          role: "status",
          "aria-live": "polite",
          "aria-atomic": "true"
        }
      })
    );

    return section;
  }

  function buildPanelShell() {
    const section = createElement("section", {
      className: "skyPanelShell",
      id: "skyPanelShell",
      attributes: {
        hidden: "",
        "aria-labelledby": "skyPanelTitle"
      }
    });
    const card = createElement("div", {
      className: "skyPanelCard"
    });

    card.append(
      createElement("div", {
        className: "skyPanelIcon",
        id: "skyPanelIcon",
        text: "✦",
        attributes: { "aria-hidden": "true" }
      }),
      createElement("h2", {
        id: "skyPanelTitle",
        text: "Today Sky",
        attributes: { tabindex: "-1" }
      }),
      createElement("p", {
        className: "skyPanelDescription",
        id: "skyPanelDescription"
      }),
      createElement("span", {
        className: "skyPanelBadge",
        id: "skyPanelBadge"
      }),
      createElement("p", {
        className: "skyPanelNote",
        id: "skyPanelNote",
        text:
          "Bu adımda örnek astrolojik veri veya hesaplanmış sonuç gösterilmiyor."
      }),
      createElement("button", {
        className: "skyPanelBack",
        text: "Sky ana ekranına dön",
        type: "button",
        attributes: {
          "data-sky-action": "hub"
        }
      })
    );

    section.appendChild(card);
    return section;
  }

  function getTopbarPill() {
    return skyView?.querySelector(
      ":scope > .topbar .pill"
    ) || null;
  }

  function focusElement(element) {
    if (!element || typeof element.focus !== "function") return;

    try {
      element.focus({ preventScroll: true });
    } catch (error) {
      element.focus();
    }
  }

  function resetScroll() {
    try {
      window.scrollTo({ top: 0, behavior: "auto" });
    } catch (error) {
      window.scrollTo(0, 0);
    }
  }

  function updateNavigationIdentity(label) {
    const pill = getTopbarPill();
    if (pill) pill.textContent = label;

    if (backButton) {
      backButton.setAttribute(
        "aria-label",
        activePanel === "hub"
          ? "Modül merkezine dön"
          : "Sky ana ekranına dön"
      );
    }
  }

  function showHub(options = {}) {
    if (!initialized) return false;

    activePanel = "hub";
    hub.hidden = false;
    panelShell.hidden = true;
    updateNavigationIdentity("Today Sky");
    resetScroll();

    if (options.focus !== false) {
      focusElement(
        document.getElementById("skyTitle")
      );
    }

    return true;
  }

  function openPanel(panelId, options = {}) {
    if (!initialized) return false;

    const definition = PANEL_DEFINITIONS[panelId];
    if (!definition) return false;

    activePanel = panelId;
    hub.hidden = true;
    panelShell.hidden = false;

    document.getElementById("skyPanelIcon").textContent =
      definition.icon;
    document.getElementById("skyPanelTitle").textContent =
      definition.title;
    document.getElementById("skyPanelDescription").textContent =
      definition.description;
    document.getElementById("skyPanelBadge").textContent =
      `${definition.stage} · Hazırlanıyor`;

    const note = document.getElementById("skyPanelNote");
    note.textContent =
      definition.requiresProfile && profileStatus === "missing"
        ? (
            "Kişisel görünüm için doğum bilgileri gerekecek. " +
            "Bu adımda örnek astrolojik veri gösterilmiyor."
          )
        : "Bu adımda örnek astrolojik veri veya hesaplanmış sonuç gösterilmiyor.";

    updateNavigationIdentity(definition.title);
    resetScroll();

    if (options.focus !== false) {
      focusElement(
        document.getElementById("skyPanelTitle")
      );
    }

    return true;
  }

  function setProfileStatus(nextStatus, options = {}) {
    if (!PROFILE_STATES.includes(nextStatus)) return false;

    profileStatus = nextStatus;

    if (!initialized) return true;

    const primaryCard =
      document.getElementById("skyPrimaryCard");
    const primaryTitle =
      document.getElementById("skyPrimaryTitle");
    const primaryDescription =
      document.getElementById("skyPrimaryDescription");
    const primaryMeta =
      document.getElementById("skyPrimaryMeta");
    const birthDescription =
      document.querySelector(
        "#skyBirthCard .skyCardCopy span"
      );

    if (nextStatus === "ready") {
      primaryCard.dataset.skyOpen = "today";
      primaryCard.setAttribute(
        "aria-label",
        "Bugünün Gökyüzü"
      );
      primaryTitle.textContent = "Bugünün Gökyüzü";
      primaryDescription.textContent =
        "Bugünün gökyüzü görünümü burada yer alacak.";
      primaryMeta.textContent = "Günlük görünüm";
      if (birthDescription) {
        birthDescription.textContent =
          "Kayıtlı doğum bilgilerini görüntüle veya düzenle.";
      }
    } else {
      primaryCard.dataset.skyOpen = "birth";
      primaryCard.setAttribute(
        "aria-label",
        "Gökyüzü profilini oluştur"
      );
      primaryTitle.textContent =
        "Gökyüzü profilini oluştur";
      primaryDescription.textContent =
        "Kişisel görünümü hazırlamak için doğum bilgilerini ekle.";
      primaryMeta.textContent = "Profil gerekli";
      if (birthDescription) {
        birthDescription.textContent =
          "Tarih, saat ve yer bilgilerini ekle.";
      }
    }

    if (options.announce !== false) {
      const status = document.getElementById("skyStatus");
      if (status) {
        status.textContent =
          nextStatus === "ready"
            ? "Gökyüzü profili hazır."
            : "Gökyüzü profili henüz oluşturulmadı.";
      }
    }

    window.dispatchEvent(
      new window.CustomEvent(
        "today:sky-profile-state",
        {
          detail: Object.freeze({
            status: profileStatus
          })
        }
      )
    );

    return true;
  }

  function bindInteractions() {
    if (interactionBound) return;

    skyView.addEventListener("click", (event) => {
      const openTrigger = event.target.closest(
        "[data-sky-open]"
      );

      if (openTrigger && skyView.contains(openTrigger)) {
        openPanel(openTrigger.dataset.skyOpen);
        return;
      }

      const actionTrigger = event.target.closest(
        '[data-sky-action="hub"]'
      );

      if (actionTrigger && skyView.contains(actionTrigger)) {
        showHub();
      }
    });

    interactionBound = true;
  }

  function interceptBackButton() {
    backButton = document.getElementById(
      "btnModulesFromSky"
    );

    if (!backButton) return;

    backButton.addEventListener("click", (event) => {
      if (activePanel === "hub") return;

      event.preventDefault();
      event.stopImmediatePropagation();
      showHub();
    });
  }

  function bindRouteReset() {
    if (routeBound) return;

    window.addEventListener(
      "today:routechange",
      (event) => {
        if (event.detail?.to === "sky") {
          showHub({ focus: false });
        }
      }
    );

    routeBound = true;
  }

  function listPanels() {
    return Object.freeze(
      Object.entries(PANEL_DEFINITIONS).map(
        ([id, definition]) =>
          Object.freeze({
            id,
            title: definition.title,
            stage: definition.stage
          })
      )
    );
  }

  function getState() {
    return Object.freeze({
      initialized,
      activePanel,
      profileStatus,
      panelIds: Object.freeze(
        Object.keys(PANEL_DEFINITIONS)
      )
    });
  }

  function init() {
    if (initialized) return getState();

    skyView = document.querySelector(VIEW_SELECTOR);
    if (!skyView) {
      return Object.freeze({
        initialized: false,
        reason: "sky_view_not_found"
      });
    }

    const bottomNav = skyView.querySelector(
      ":scope > .bottomNav"
    );
    const placeholder = skyView.querySelector(
      ":scope > .modulePlaceholder"
    );

    if (!bottomNav || !placeholder) {
      return Object.freeze({
        initialized: false,
        reason: "sky_shell_not_found"
      });
    }

    installStyles();
    skyView.classList.add("skyView");

    hub = buildHub();
    panelShell = buildPanelShell();
    placeholder.remove();
    skyView.insertBefore(hub, bottomNav);
    skyView.insertBefore(panelShell, bottomNav);

    bindInteractions();
    interceptBackButton();
    bindRouteReset();

    initialized = true;
    setProfileStatus(profileStatus, {
      announce: false
    });
    showHub({ focus: false });

    return getState();
  }

  window.TodaySkyHub = Object.freeze({
    API_VERSION,
    RULESET_ID,
    PROFILE_STATES,
    init,
    listPanels,
    openPanel,
    showHub,
    setProfileStatus,
    getState
  });

  function boot() {
    const result = init();
    if (result.initialized) return;

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (init().initialized || attempts >= 40) {
        window.clearInterval(timer);
      }
    }, 100);
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      boot,
      { once: true }
    );
  } else {
    boot();
  }
})();
