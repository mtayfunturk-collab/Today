/**
 * Today App — Sky Hub
 * NUT-016.3 — Natal Harita Özeti
 *
 * Amaç:
 * - Today Sky için kalıcı ana bilgi mimarisini kurmak
 * - Bugünün Gökyüzü, Harita Özeti, Önemli Dönemler ve Doğum Bilgileri
 *   alanlarını tek Sky rotası altında toplamak
 * - Doğum bilgilerini ekleme, düzenleme ve açık onayla silme arayüzünü sunmak
 * - Harita Özeti ekranını cihaz içi hesap çekirdeğine bağlamak
 * - Profil durumunu cihaz içi Sky doğum profiliyle eşlemek
 * - Günlük transit, astrolojik yorum, konum izni ve dış ağ çağrısı eklememek
 */
(function () {
  "use strict";

  const API_VERSION = 3;
  const RULESET_ID = "today:sky:hub:nut-016.3";
  const VIEW_SELECTOR = '[data-view="sky"]';
  const PROFILE_STATES = Object.freeze([
    "missing",
    "ready"
  ]);
  const PANEL_DEFINITIONS = Object.freeze({
    birth: Object.freeze({
      title: "Doğum Bilgileri",
      description:
        "Doğum tarihi, saat bilgisi ve doğum yerini ekle veya düzenle.",
      stage: "NUT-016.2",
      icon: "○",
      requiresProfile: false
    }),
    natal: Object.freeze({
      title: "Harita Özeti",
      description:
        "Güneş, Ay, yükselen ve temel harita yerleşimlerinin sade özeti.",
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
  let birthPanel = null;
  let natalUi = null;
  let backButton = null;
  let profileApi = null;
  let interactionBound = false;
  let routeBound = false;
  let profileEventBound = false;

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
      .skyPanelShell,
      .skyBirthPanel {
        width: 100%;
        min-width: 0;
        max-width: 100%;
      }

      .skyHub[hidden],
      .skyPanelShell[hidden],
      .skyBirthPanel[hidden] {
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

      .skyBirthPanel {
        padding: 4px 2px 22px;
      }

      .skyBirthHeader {
        padding: 0 5px 13px;
        text-align: center;
      }

      .skyBirthIcon {
        width: 54px;
        height: 54px;
        display: grid;
        place-items: center;
        margin: 0 auto 12px;
        border: 1px solid color-mix(in srgb, var(--sky-accent) 36%, var(--stroke));
        border-radius: 18px;
        background: color-mix(in srgb, var(--sky-accent) 10%, transparent);
        color: color-mix(in srgb, var(--sky-accent) 72%, var(--text));
        font-size: 27px;
        line-height: 1;
      }

      .skyBirthHeader h2 {
        margin: 0;
        font-size: 22px;
        line-height: 1.25;
        letter-spacing: -.02em;
      }

      .skyBirthIntro {
        max-width: 36ch;
        margin: 7px auto 0;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.5;
      }

      .skyBirthState {
        display: inline-flex;
        margin-top: 10px;
        border: 1px solid color-mix(in srgb, var(--sky-accent) 34%, var(--stroke));
        border-radius: 999px;
        padding: 6px 9px;
        color: color-mix(in srgb, var(--sky-accent) 72%, var(--text));
        font-size: 10px;
        font-weight: 850;
      }

      .skyBirthNotice {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        margin-bottom: 13px;
        border: 1px solid color-mix(in srgb, var(--sky-accent) 25%, var(--stroke));
        border-radius: 16px;
        padding: 12px;
        background: color-mix(in srgb, var(--sky-accent) 7%, transparent);
      }

      .skyBirthNoticeIcon {
        flex: 0 0 auto;
        color: color-mix(in srgb, var(--sky-accent) 75%, var(--text));
        font-size: 17px;
        line-height: 1.3;
      }

      .skyBirthNotice strong,
      .skyBirthNotice span {
        display: block;
      }

      .skyBirthNotice strong {
        font-size: 12px;
        line-height: 1.35;
      }

      .skyBirthNotice span {
        margin-top: 3px;
        color: var(--muted);
        font-size: 11px;
        line-height: 1.45;
      }

      .skyBirthForm {
        display: grid;
        gap: 13px;
        border: 1px solid var(--stroke);
        border-radius: 20px;
        padding: 15px;
        background: rgba(255,255,255,.03);
      }

      .skyBirthField {
        min-width: 0;
      }

      .skyBirthLabel {
        display: block;
        margin-bottom: 6px;
        color: var(--text);
        font-size: 12px;
        font-weight: 850;
        line-height: 1.35;
      }

      .skyBirthInput,
      .skyBirthSelect {
        width: 100%;
        min-width: 0;
        min-height: 48px;
        box-sizing: border-box;
        border: 1px solid var(--stroke);
        border-radius: 14px;
        padding: 11px 12px;
        background: color-mix(in srgb, var(--bg) 76%, rgba(255,255,255,.06));
        color: var(--text);
        font: inherit;
        font-size: 16px;
      }

      .skyBirthInput:focus-visible,
      .skyBirthSelect:focus-visible,
      .skyBirthButton:focus-visible,
      .skyDeleteButton:focus-visible,
      .skyDeleteConfirmButton:focus-visible,
      .skyDeleteCancelButton:focus-visible,
      .skyPanelBack:focus-visible,
      .skyHubCard:focus-visible {
        outline: 3px solid color-mix(in srgb, var(--sky-accent) 70%, transparent);
        outline-offset: 2px;
      }

      .skyBirthInput[aria-invalid="true"],
      .skyBirthSelect[aria-invalid="true"] {
        border-color: #e27171;
      }

      .skyBirthInput:disabled {
        opacity: .56;
        cursor: not-allowed;
      }

      .skyBirthHelp,
      .skyBirthError {
        min-height: 16px;
        margin: 5px 2px 0;
        font-size: 10px;
        line-height: 1.4;
      }

      .skyBirthHelp {
        color: var(--muted);
      }

      .skyBirthError {
        color: #e78b8b;
        font-weight: 750;
      }

      .skyBirthButton,
      .skyDeleteButton,
      .skyDeleteConfirmButton,
      .skyDeleteCancelButton {
        width: 100%;
        min-height: 46px;
        border-radius: 14px;
        padding: 11px 13px;
        color: var(--text);
        font: inherit;
        font-weight: 850;
        cursor: pointer;
      }

      .skyBirthButton {
        border: 1px solid color-mix(in srgb, var(--sky-accent) 50%, var(--stroke));
        background: color-mix(in srgb, var(--sky-accent) 24%, rgba(255,255,255,.04));
      }

      .skyBirthManage {
        display: grid;
        gap: 10px;
        margin-top: 12px;
      }

      .skyBirthManage[hidden],
      .skyDeleteConfirm[hidden],
      .skyDeleteButton[hidden] {
        display: none !important;
      }

      .skyDeleteButton,
      .skyDeleteCancelButton {
        border: 1px solid var(--stroke);
        background: rgba(255,255,255,.035);
      }

      .skyDeleteConfirm {
        border: 1px solid color-mix(in srgb, #dd6969 48%, var(--stroke));
        border-radius: 16px;
        padding: 13px;
        background: color-mix(in srgb, #dd6969 8%, transparent);
      }

      .skyDeleteConfirm p {
        margin: 0 0 11px;
        color: var(--muted);
        font-size: 11px;
        line-height: 1.45;
        text-align: center;
      }

      .skyDeleteConfirmActions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .skyDeleteConfirmButton {
        border: 1px solid color-mix(in srgb, #dd6969 60%, var(--stroke));
        background: color-mix(in srgb, #dd6969 18%, transparent);
      }

      .skyBirthFeedback {
        min-height: 20px;
        margin: 10px 3px 0;
        color: var(--muted);
        font-size: 11px;
        font-weight: 700;
        line-height: 1.45;
        text-align: center;
      }

      .skyBirthFeedback[data-tone="success"] {
        color: #72c69a;
      }

      .skyBirthFeedback[data-tone="error"] {
        color: #e78b8b;
      }

      .skyBirthPanel > .skyPanelBack {
        margin-top: 12px;
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

        .skyBirthForm {
          padding: 13px;
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
        .skyBirthNotice,
        .skyBirthForm,
        .skyDeleteConfirm,
        .skyHubMark,
        .skyCardIcon,
        .skyPanelIcon,
        .skyBirthIcon {
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

  function buildBirthPanel() {
    const section = createElement("section", {
      className: "skyBirthPanel",
      id: "skyBirthPanel",
      attributes: {
        hidden: "",
        "aria-labelledby": "skyBirthTitle"
      }
    });
    const header = createElement("header", {
      className: "skyBirthHeader"
    });

    header.append(
      createElement("div", {
        className: "skyBirthIcon",
        text: "○",
        attributes: { "aria-hidden": "true" }
      }),
      createElement("h2", {
        id: "skyBirthTitle",
        text: "Doğum Bilgileri",
        attributes: { tabindex: "-1" }
      }),
      createElement("p", {
        className: "skyBirthIntro",
        text:
          "Kişisel Sky görünümünün temel bilgilerini ekle. Harita özeti, şehir eşleşmesi onaylandıktan sonra hazırlanır."
      }),
      createElement("span", {
        className: "skyBirthState",
        id: "skyBirthState",
        text: "Henüz kayıt yok"
      })
    );

    const notice = createElement("div", {
      className: "skyBirthNotice"
    });
    const noticeCopy = createElement("div");
    noticeCopy.append(
      createElement("strong", {
        text: "Yalnızca bu cihazda saklanır"
      }),
      createElement("span", {
        text:
          "Doğum bilgilerin bir sunucuya gönderilmez ve iznin olmadan başka modüllerle paylaşılmaz."
      })
    );
    notice.append(
      createElement("span", {
        className: "skyBirthNoticeIcon",
        text: "◇",
        attributes: { "aria-hidden": "true" }
      }),
      noticeCopy
    );

    const form = createElement("form", {
      className: "skyBirthForm",
      id: "skyBirthForm",
      attributes: { novalidate: "" }
    });

    const dateField = createElement("div", {
      className: "skyBirthField"
    });
    dateField.append(
      createElement("label", {
        className: "skyBirthLabel",
        text: "Doğum tarihi",
        attributes: { for: "skyBirthDate" }
      }),
      createElement("input", {
        className: "skyBirthInput",
        id: "skyBirthDate",
        type: "date",
        attributes: {
          name: "birthDate",
          autocomplete: "bday",
          required: "",
          "aria-describedby": "skyBirthDateError"
        }
      }),
      createElement("p", {
        className: "skyBirthError",
        id: "skyBirthDateError"
      })
    );

    const precisionField = createElement("div", {
      className: "skyBirthField"
    });
    const precisionSelect = createElement("select", {
      className: "skyBirthSelect",
      id: "skyBirthTimePrecision",
      attributes: {
        name: "timePrecision",
        required: "",
        "aria-describedby":
          "skyBirthPrecisionHelp skyBirthPrecisionError"
      }
    });
    precisionSelect.append(
      createElement("option", {
        text: "Kesin biliyorum",
        attributes: { value: "exact" }
      }),
      createElement("option", {
        text: "Yaklaşık biliyorum",
        attributes: { value: "approximate" }
      }),
      createElement("option", {
        text: "Bilmiyorum",
        attributes: { value: "unknown" }
      })
    );
    precisionField.append(
      createElement("label", {
        className: "skyBirthLabel",
        text: "Doğum saati bilgisi",
        attributes: {
          for: "skyBirthTimePrecision"
        }
      }),
      precisionSelect,
      createElement("p", {
        className: "skyBirthHelp",
        id: "skyBirthPrecisionHelp",
        text:
          "Saatin kesin değilse yaklaşık ya da bilinmiyor olarak işaretle."
      }),
      createElement("p", {
        className: "skyBirthError",
        id: "skyBirthPrecisionError"
      })
    );

    const timeField = createElement("div", {
      className: "skyBirthField",
      id: "skyBirthTimeField"
    });
    timeField.append(
      createElement("label", {
        className: "skyBirthLabel",
        text: "Doğum saati",
        attributes: { for: "skyBirthTime" }
      }),
      createElement("input", {
        className: "skyBirthInput",
        id: "skyBirthTime",
        type: "time",
        attributes: {
          name: "birthTime",
          autocomplete: "bday-time",
          required: "",
          "aria-describedby":
            "skyBirthTimeHelp skyBirthTimeError"
        }
      }),
      createElement("p", {
        className: "skyBirthHelp",
        id: "skyBirthTimeHelp",
        text: "Bildiğin yerel doğum saatini gir."
      }),
      createElement("p", {
        className: "skyBirthError",
        id: "skyBirthTimeError"
      })
    );

    const placeField = createElement("div", {
      className: "skyBirthField"
    });
    placeField.append(
      createElement("label", {
        className: "skyBirthLabel",
        text: "Doğum yeri",
        attributes: { for: "skyBirthPlace" }
      }),
      createElement("input", {
        className: "skyBirthInput",
        id: "skyBirthPlace",
        type: "text",
        attributes: {
          name: "birthPlace",
          autocomplete: "off",
          maxlength: "120",
          placeholder: "Örn. İstanbul, Türkiye",
          required: "",
          "aria-describedby":
            "skyBirthPlaceHelp skyBirthPlaceError"
        }
      }),
      createElement("p", {
        className: "skyBirthHelp",
        id: "skyBirthPlaceHelp",
        text:
          "Şehir ve ülke adı yeterli. Bilgiyi değiştirirsen Harita Özeti’nde şehir eşleşmesini yeniden doğrularsın."
      }),
      createElement("p", {
        className: "skyBirthError",
        id: "skyBirthPlaceError"
      })
    );

    form.append(
      dateField,
      precisionField,
      timeField,
      placeField,
      createElement("button", {
        className: "skyBirthButton",
        id: "skyBirthSave",
        text: "Bilgileri kaydet",
        type: "submit"
      })
    );

    const manage = createElement("div", {
      className: "skyBirthManage",
      id: "skyBirthManage",
      attributes: { hidden: "" }
    });
    const deleteButton = createElement("button", {
      className: "skyDeleteButton",
      id: "skyBirthDeleteRequest",
      text: "Doğum bilgilerini sil",
      type: "button",
      attributes: {
        "data-sky-action": "request-delete"
      }
    });
    const deleteConfirm = createElement("div", {
      className: "skyDeleteConfirm",
      id: "skyBirthDeleteConfirm",
      attributes: { hidden: "" }
    });
    const deleteActions = createElement("div", {
      className: "skyDeleteConfirmActions"
    });
    deleteActions.append(
      createElement("button", {
        className: "skyDeleteConfirmButton",
        text: "Evet, sil",
        type: "button",
        attributes: {
          "data-sky-action": "confirm-delete"
        }
      }),
      createElement("button", {
        className: "skyDeleteCancelButton",
        text: "Vazgeç",
        type: "button",
        attributes: {
          "data-sky-action": "cancel-delete"
        }
      })
    );
    deleteConfirm.append(
      createElement("p", {
        text:
          "Kayıtlı doğum bilgilerin bu cihazdan silinecek. Bu işlem geri alınamaz."
      }),
      deleteActions
    );
    manage.append(deleteButton, deleteConfirm);

    section.append(
      header,
      notice,
      form,
      manage,
      createElement("div", {
        className: "skyBirthFeedback",
        id: "skyBirthFeedback",
        attributes: {
          role: "status",
          "aria-live": "polite",
          "aria-atomic": "true"
        }
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

    return section;
  }

  function getBirthElement(id) {
    return birthPanel?.querySelector(`#${id}`) || null;
  }

  function setBirthFeedback(message = "", tone = "") {
    const feedback = getBirthElement(
      "skyBirthFeedback"
    );
    if (!feedback) return;

    feedback.textContent = message;
    if (tone) {
      feedback.dataset.tone = tone;
    } else {
      delete feedback.dataset.tone;
    }
  }

  function setBirthFieldError(fieldName, message = "") {
    const fieldIds = {
      birthDate: "skyBirthDate",
      timePrecision: "skyBirthTimePrecision",
      birthTime: "skyBirthTime",
      birthPlace: "skyBirthPlace"
    };
    const errorIds = {
      birthDate: "skyBirthDateError",
      timePrecision: "skyBirthPrecisionError",
      birthTime: "skyBirthTimeError",
      birthPlace: "skyBirthPlaceError"
    };
    const field = getBirthElement(fieldIds[fieldName]);
    const error = getBirthElement(errorIds[fieldName]);

    if (error) error.textContent = message;
    if (field) {
      if (message) {
        field.setAttribute("aria-invalid", "true");
      } else {
        field.removeAttribute("aria-invalid");
      }
    }
  }

  function clearBirthErrors() {
    [
      "birthDate",
      "timePrecision",
      "birthTime",
      "birthPlace"
    ].forEach(fieldName => {
      setBirthFieldError(fieldName);
    });
  }

  function readBirthDraft() {
    return {
      birthDate:
        getBirthElement("skyBirthDate")?.value || "",
      birthTime:
        getBirthElement("skyBirthTime")?.value || "",
      timePrecision:
        getBirthElement("skyBirthTimePrecision")?.value ||
        "exact",
      birthPlace:
        getBirthElement("skyBirthPlace")?.value || ""
    };
  }

  function syncBirthTimeInput() {
    const precision = getBirthElement(
      "skyBirthTimePrecision"
    );
    const time = getBirthElement("skyBirthTime");
    const help = getBirthElement(
      "skyBirthTimeHelp"
    );

    if (!precision || !time || !help) return;

    const isUnknown = precision.value === "unknown";
    time.disabled = isUnknown;
    time.required = !isUnknown;

    if (isUnknown) {
      help.textContent =
        "Saat bilinmiyor olarak saklanır; saat gerektiren sonuçlar üretilmez.";
      setBirthFieldError("birthTime");
    } else if (precision.value === "approximate") {
      help.textContent =
        "Girdiğin saat yaklaşık olarak işaretlenir.";
    } else {
      help.textContent =
        "Bildiğin yerel doğum saatini gir.";
    }
  }

  function resetDeleteConfirmation() {
    const request = getBirthElement(
      "skyBirthDeleteRequest"
    );
    const confirm = getBirthElement(
      "skyBirthDeleteConfirm"
    );

    if (request) request.hidden = false;
    if (confirm) confirm.hidden = true;
  }

  function renderBirthPanel(options = {}) {
    if (!birthPanel || !profileApi) return false;

    const profile = profileApi.getProfile();
    const draft = profileApi.profileToDraft(profile);
    const date = getBirthElement("skyBirthDate");
    const time = getBirthElement("skyBirthTime");
    const precision = getBirthElement(
      "skyBirthTimePrecision"
    );
    const place = getBirthElement("skyBirthPlace");
    const stateBadge = getBirthElement(
      "skyBirthState"
    );
    const saveButton = getBirthElement(
      "skyBirthSave"
    );
    const manage = getBirthElement(
      "skyBirthManage"
    );

    if (date) {
      date.max = profileApi.getTodayDateKey();
      date.value = draft.birthDate;
    }
    if (time) time.value = draft.birthTime;
    if (precision) {
      precision.value = draft.timePrecision;
    }
    if (place) place.value = draft.birthPlace;

    if (stateBadge) {
      stateBadge.textContent = profile
        ? "Kayıtlı"
        : "Henüz kayıt yok";
    }
    if (saveButton) {
      saveButton.textContent = profile
        ? "Değişiklikleri kaydet"
        : "Bilgileri kaydet";
    }
    if (manage) manage.hidden = !profile;

    birthPanel.dataset.profileStatus = profile
      ? "ready"
      : "missing";
    clearBirthErrors();
    syncBirthTimeInput();
    resetDeleteConfirmation();

    if (options.keepFeedback !== true) {
      setBirthFeedback();
    }

    return true;
  }

  function showBirthValidationErrors(errors = {}) {
    clearBirthErrors();

    const order = [
      "birthDate",
      "timePrecision",
      "birthTime",
      "birthPlace"
    ];
    order.forEach(fieldName => {
      setBirthFieldError(
        fieldName,
        errors[fieldName] || ""
      );
    });

    const firstInvalid = order.find(
      fieldName => Boolean(errors[fieldName])
    );
    const fieldIds = {
      birthDate: "skyBirthDate",
      timePrecision: "skyBirthTimePrecision",
      birthTime: "skyBirthTime",
      birthPlace: "skyBirthPlace"
    };

    if (firstInvalid) {
      focusElement(
        getBirthElement(fieldIds[firstInvalid])
      );
    }
  }

  function saveBirthProfile(event) {
    event.preventDefault();
    setBirthFeedback();

    const draft = readBirthDraft();
    const validation = profileApi.validateDraft(draft);

    if (!validation.valid) {
      showBirthValidationErrors(validation.errors);
      setBirthFeedback(
        "Eksik veya geçersiz alanları kontrol et.",
        "error"
      );
      return;
    }

    try {
      profileApi.saveProfile(validation.value, {
        userInitiated: true
      });
      setProfileStatus("ready", {
        announce: false
      });
      renderBirthPanel();
      setBirthFeedback(
        "Doğum bilgilerin bu cihaza kaydedildi.",
        "success"
      );
    } catch (error) {
      if (error?.details?.errors) {
        showBirthValidationErrors(
          error.details.errors
        );
      }
      setBirthFeedback(
        "Doğum bilgileri kaydedilemedi. Alanları kontrol edip yeniden dene.",
        "error"
      );
    }
  }

  function requestBirthDelete() {
    const request = getBirthElement(
      "skyBirthDeleteRequest"
    );
    const confirm = getBirthElement(
      "skyBirthDeleteConfirm"
    );

    if (request) request.hidden = true;
    if (confirm) {
      confirm.hidden = false;
      focusElement(
        confirm.querySelector(
          '[data-sky-action="confirm-delete"]'
        )
      );
    }
  }

  function confirmBirthDelete() {
    try {
      profileApi.deleteProfile({
        userInitiated: true,
        userConfirmed: true
      });
      setProfileStatus("missing", {
        announce: false
      });
      renderBirthPanel();
      setBirthFeedback(
        "Doğum bilgilerin bu cihazdan silindi.",
        "success"
      );
    } catch (error) {
      resetDeleteConfirmation();
      setBirthFeedback(
        "Doğum bilgileri silinemedi. Yeniden dene.",
        "error"
      );
    }
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
    birthPanel.hidden = true;
    natalUi?.close?.();
    skyView.setAttribute(
      "aria-labelledby",
      "skyTitle"
    );
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
    panelShell.hidden = [
      "birth",
      "natal"
    ].includes(panelId);
    birthPanel.hidden = panelId !== "birth";
    natalUi?.close?.();

    if (panelId === "birth") {
      renderBirthPanel();
      skyView.setAttribute(
        "aria-labelledby",
        "skyBirthTitle"
      );
      updateNavigationIdentity(definition.title);
      resetScroll();

      if (options.focus !== false) {
        focusElement(
          document.getElementById(
            "skyBirthTitle"
          )
        );
      }

      return true;
    }

    if (panelId === "natal") {
      skyView.setAttribute(
        "aria-labelledby",
        "skyNatalTitle"
      );
      updateNavigationIdentity(definition.title);
      resetScroll();
      return natalUi.open({
        focus: options.focus !== false
      });
    }

    skyView.setAttribute(
      "aria-labelledby",
      "skyPanelTitle"
    );

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
        "[data-sky-action]"
      );

      if (!actionTrigger || !skyView.contains(actionTrigger)) {
        return;
      }

      const action = actionTrigger.dataset.skyAction;

      if (action === "hub") showHub();
      if (action === "request-delete") {
        requestBirthDelete();
      }
      if (action === "cancel-delete") {
        resetDeleteConfirmation();
        focusElement(
          getBirthElement("skyBirthDeleteRequest")
        );
      }
      if (action === "confirm-delete") {
        confirmBirthDelete();
      }
    });

    getBirthElement("skyBirthForm")
      ?.addEventListener("submit", saveBirthProfile);

    getBirthElement("skyBirthTimePrecision")
      ?.addEventListener("change", () => {
        syncBirthTimeInput();
        setBirthFieldError("timePrecision");
        setBirthFeedback();
      });

    birthPanel.addEventListener("input", event => {
      const fieldName = event.target?.name;

      if (
        [
          "birthDate",
          "birthTime",
          "birthPlace"
        ].includes(fieldName)
      ) {
        setBirthFieldError(fieldName);
        setBirthFeedback();
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

  function bindProfileEvents() {
    if (profileEventBound) return;

    window.addEventListener(
      "today:sky-profile-change",
      event => {
        const nextStatus = event.detail?.status;

        if (PROFILE_STATES.includes(nextStatus)) {
          setProfileStatus(nextStatus, {
            announce: false
          });

          if (activePanel === "birth") {
            renderBirthPanel();
          }

          if (activePanel === "natal") {
            natalUi?.refresh?.({
              focus: false
            });
          }
        }
      }
    );

    profileEventBound = true;
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
      birthProfileContractVersion:
        profileApi?.CONTRACT_VERSION || null,
      natalUiApiVersion:
        natalUi?.API_VERSION || null,
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

    profileApi = window.TodaySkyBirthProfile;
    natalUi = window.TodaySkyNatalUI;
    const requiredProfileMethods = [
      "getStatus",
      "getProfile",
      "profileToDraft",
      "getTodayDateKey",
      "validateDraft",
      "saveProfile",
      "deleteProfile"
    ];
    const missingProfileMethods =
      requiredProfileMethods.filter(
        methodName =>
          !profileApi ||
          typeof profileApi[methodName] !==
            "function"
      );

    if (missingProfileMethods.length > 0) {
      return Object.freeze({
        initialized: false,
        reason: "sky_birth_profile_not_found",
        missing: Object.freeze(
          missingProfileMethods
        )
      });
    }

    const requiredNatalMethods = [
      "init",
      "open",
      "close",
      "refresh",
      "getState"
    ];
    const missingNatalMethods =
      requiredNatalMethods.filter(
        methodName =>
          !natalUi ||
          typeof natalUi[methodName] !==
            "function"
      );

    if (missingNatalMethods.length > 0) {
      return Object.freeze({
        initialized: false,
        reason: "sky_natal_ui_not_found",
        missing: Object.freeze(
          missingNatalMethods
        )
      });
    }

    profileStatus =
      profileApi.getStatus().status;

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
    birthPanel = buildBirthPanel();
    placeholder.remove();
    skyView.insertBefore(hub, bottomNav);
    skyView.insertBefore(panelShell, bottomNav);
    skyView.insertBefore(birthPanel, bottomNav);

    const natalResult = natalUi.init({
      skyView,
      bottomNav,
      onRequestHub: () => showHub(),
      onOpenBirth: () => openPanel("birth")
    });

    if (!natalResult.initialized) {
      return Object.freeze({
        initialized: false,
        reason:
          natalResult.reason ||
          "sky_natal_ui_init_failed"
      });
    }

    bindInteractions();
    interceptBackButton();
    bindRouteReset();
    bindProfileEvents();

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
