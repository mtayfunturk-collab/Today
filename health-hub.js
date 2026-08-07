/**
 * Today App — Health Hub
 * NUT-013 — Health Information Architecture Refactor
 *
 * Amaç:
 * - Health girişini Spor / Beslenme / Sağlık olarak üç sade alana ayırmak
 * - Mevcut NUT-001–012 Beslenme arayüzünü değiştirmeden alt modüle taşımak
 * - Health ekranında yatay taşmayı engellemek ve görünümü viewport'a sabitlemek
 * - Spor ve Sağlık için bağımsız genişleme yüzeyleri hazırlamak
 */
(function () {
  "use strict";

  const API_VERSION = 1;
  const RULESET_ID = "today:health:hub:v1";
  const VIEW_SELECTOR = '[data-view="health"]';

  let initialized = false;
  let activeSection = "hub";
  let healthView = null;
  let hub = null;
  let nutritionPanel = null;
  let sportPanel = null;
  let wellnessPanel = null;
  let backButton = null;
  let styleElement = null;

  function createElement(tag, options = {}) {
    const element = document.createElement(tag);

    if (options.className) element.className = options.className;
    if (options.id) element.id = options.id;
    if (options.text) element.textContent = options.text;
    if (options.type) element.type = options.type;

    Object.entries(options.attributes || {}).forEach(([name, value]) => {
      element.setAttribute(name, value);
    });

    return element;
  }

  function installLayoutStyles() {
    if (document.getElementById("todayHealthHubStyles")) return;

    styleElement = document.createElement("style");
    styleElement.id = "todayHealthHubStyles";
    styleElement.textContent = `
      html,
      body {
        width: 100%;
        max-width: 100%;
        overflow-x: clip;
      }

      body {
        min-height: 100dvh;
      }

      .wrap {
        width: 100%;
        max-width: 100%;
        min-height: 100dvh;
        align-items: flex-start !important;
        padding:
          max(14px, env(safe-area-inset-top))
          max(14px, env(safe-area-inset-right))
          max(14px, env(safe-area-inset-bottom))
          max(14px, env(safe-area-inset-left)) !important;
        overflow-x: clip;
      }

      .screen {
        width: min(520px, 100%) !important;
        max-width: 100% !important;
        margin: 0 auto;
      }

      .inner,
      .healthView,
      .healthDashboard,
      .healthCard,
      .healthLibraryPicker,
      .healthLibraryEditor,
      .healthLibraryControls,
      .healthLibraryEditorGrid,
      .healthLibraryNutritionGrid,
      .healthLibraryMetaGrid,
      .healthRecipeIngredientControls {
        min-width: 0;
        max-width: 100%;
      }

      .healthView {
        overflow-x: clip;
      }

      .healthHub {
        display: grid;
        gap: 14px;
        width: 100%;
        max-width: 100%;
        padding-top: 4px;
      }

      .healthHubHeader {
        text-align: center;
        padding: 10px 4px 6px;
      }

      .healthHubMark {
        width: 54px;
        height: 54px;
        display: grid;
        place-items: center;
        margin: 0 auto 11px;
        border: 1px solid var(--stroke);
        border-radius: 18px;
        background: rgba(255,255,255,.045);
        font-size: 27px;
        font-weight: 900;
      }

      .healthHubTitle {
        margin: 0;
        font-size: 25px;
        line-height: 1.15;
        letter-spacing: -.02em;
      }

      .healthHubIntro {
        max-width: 34ch;
        margin: 8px auto 0;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.45;
      }

      .healthHubCards {
        display: grid;
        gap: 12px;
        width: 100%;
      }

      .healthHubCard {
        width: 100%;
        min-width: 0;
        min-height: 92px;
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 16px;
        border: 1px solid var(--stroke);
        border-radius: 20px;
        background: rgba(255,255,255,.04);
        color: var(--text);
        text-align: left;
        font: inherit;
        cursor: pointer;
      }

      .healthHubCard:active {
        transform: scale(.992);
      }

      .healthHubIcon {
        width: 46px;
        height: 46px;
        flex: 0 0 46px;
        display: grid;
        place-items: center;
        border: 1px solid var(--stroke);
        border-radius: 15px;
        background: rgba(255,255,255,.045);
        font-size: 22px;
        font-weight: 900;
      }

      .healthHubCopy {
        min-width: 0;
        flex: 1;
      }

      .healthHubCopy strong {
        display: block;
        font-size: 17px;
        line-height: 1.25;
      }

      .healthHubCopy span {
        display: block;
        margin-top: 4px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.4;
      }

      .healthHubArrow {
        flex: 0 0 auto;
        color: var(--muted);
        font-size: 20px;
      }

      .healthSubmodule {
        width: 100%;
        max-width: 100%;
      }

      .healthSubmodule[hidden],
      .healthHub[hidden] {
        display: none !important;
      }

      .healthPlaceholder {
        min-height: min(58dvh, 460px);
        display: grid;
        place-items: center;
        text-align: center;
        padding: 28px 8px;
      }

      .healthPlaceholderCard {
        width: min(100%, 360px);
        padding: 24px 18px;
        border: 1px solid var(--stroke);
        border-radius: 22px;
        background: rgba(255,255,255,.035);
      }

      .healthPlaceholderIcon {
        width: 52px;
        height: 52px;
        display: grid;
        place-items: center;
        margin: 0 auto 12px;
        border: 1px solid var(--stroke);
        border-radius: 17px;
        font-size: 24px;
      }

      .healthPlaceholderCard h2 {
        margin: 0;
        font-size: 20px;
      }

      .healthPlaceholderCard p {
        margin: 8px auto 0;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.5;
      }

      .healthPlaceholderBadge {
        display: inline-block;
        margin-top: 14px;
        padding: 7px 10px;
        border: 1px solid var(--stroke);
        border-radius: 999px;
        color: var(--muted);
        font-size: 11px;
        font-weight: 800;
      }

      @media (max-width: 420px) {
        .inner {
          padding: 18px !important;
        }

        .healthHub {
          gap: 11px;
        }

        .healthHubCard {
          min-height: 84px;
          padding: 14px;
        }

        .healthLibraryItem,
        .healthListItem {
          max-width: 100%;
        }

        .healthListTitle {
          white-space: normal;
          overflow-wrap: anywhere;
        }
      }
    `;

    document.head.appendChild(styleElement);
  }

  function makeHubCard(section, icon, title, description) {
    const button = createElement("button", {
      className: "healthHubCard",
      type: "button",
      attributes: {
        "data-health-hub-open": section,
        "aria-label": `${title} bölümünü aç`
      }
    });

    const iconElement = createElement("span", {
      className: "healthHubIcon",
      text: icon,
      attributes: { "aria-hidden": "true" }
    });

    const copy = createElement("span", { className: "healthHubCopy" });
    const strong = createElement("strong", { text: title });
    const detail = createElement("span", { text: description });
    copy.append(strong, detail);

    const arrow = createElement("span", {
      className: "healthHubArrow",
      text: "›",
      attributes: { "aria-hidden": "true" }
    });

    button.append(iconElement, copy, arrow);
    return button;
  }

  function makePlaceholder(id, icon, title, description) {
    const panel = createElement("section", {
      className: "healthSubmodule healthPlaceholder",
      id,
      attributes: {
        hidden: "",
        "aria-labelledby": `${id}Title`
      }
    });

    const card = createElement("div", { className: "healthPlaceholderCard" });
    const iconElement = createElement("div", {
      className: "healthPlaceholderIcon",
      text: icon,
      attributes: { "aria-hidden": "true" }
    });
    const heading = createElement("h2", {
      id: `${id}Title`,
      text: title
    });
    const text = createElement("p", { text: description });
    const badge = createElement("span", {
      className: "healthPlaceholderBadge",
      text: "Alt modül hazır"
    });

    card.append(iconElement, heading, text, badge);
    panel.appendChild(card);
    return panel;
  }

  function setTopbarMode(section) {
    const pill = healthView?.querySelector(".topbar .pill");
    if (!pill) return;

    const labels = {
      hub: "Today Health",
      sport: "Health · Spor",
      nutrition: "Health · Beslenme",
      wellness: "Health · Sağlık"
    };

    pill.textContent = labels[section] || labels.hub;

    if (backButton) {
      backButton.setAttribute(
        "aria-label",
        section === "hub"
          ? "Modül merkezine dön"
          : "Health ana ekranına dön"
      );
    }
  }

  function showSection(section, options = {}) {
    if (!["hub", "sport", "nutrition", "wellness"].includes(section)) {
      section = "hub";
    }

    activeSection = section;

    if (hub) hub.hidden = section !== "hub";
    if (sportPanel) sportPanel.hidden = section !== "sport";
    if (nutritionPanel) nutritionPanel.hidden = section !== "nutrition";
    if (wellnessPanel) wellnessPanel.hidden = section !== "wellness";

    setTopbarMode(section);

    if (section === "nutrition") {
      Promise.resolve(window.TodayNutritionUI?.open?.()).catch(() => {});
      Promise.resolve(window.TodayNutritionLibraryUI?.open?.()).catch(() => {});
    }

    if (options.focus !== false) {
      const focusTarget =
        section === "hub"
          ? hub?.querySelector(".healthHubTitle")
          : healthView?.querySelector(
              section === "nutrition"
                ? "#healthTitle"
                : `#health${section === "sport" ? "Sport" : "Wellness"}PanelTitle`
            );

      if (focusTarget) {
        focusTarget.tabIndex = -1;
        try {
          focusTarget.focus({ preventScroll: true });
        } catch (error) {
          focusTarget.focus();
        }
      }
    }

    if (options.scroll !== false) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }

    return getState();
  }

  function buildHub() {
    hub = createElement("section", {
      className: "healthHub",
      id: "healthHub",
      attributes: {
        "aria-labelledby": "healthHubTitle"
      }
    });

    const header = createElement("header", { className: "healthHubHeader" });
    const mark = createElement("div", {
      className: "healthHubMark",
      text: "♥",
      attributes: { "aria-hidden": "true" }
    });
    const title = createElement("h1", {
      className: "healthHubTitle",
      id: "healthHubTitle",
      text: "Health"
    });
    const intro = createElement("p", {
      className: "healthHubIntro",
      text: "Bugün bedeninde hangi alana bakmak istiyorsun?"
    });

    header.append(mark, title, intro);

    const cards = createElement("div", { className: "healthHubCards" });
    cards.append(
      makeHubCard(
        "sport",
        "↗",
        "Spor",
        "Antrenman, hareket, program ve gelişim."
      ),
      makeHubCard(
        "nutrition",
        "◐",
        "Beslenme",
        "Öğün, su, tarifler, kütüphane ve günlük kayıtlar."
      ),
      makeHubCard(
        "wellness",
        "+",
        "Sağlık",
        "Uyku, enerji, semptomlar ve beden notları."
      )
    );

    hub.append(header, cards);

    cards.addEventListener("click", (event) => {
      const button = event.target.closest("[data-health-hub-open]");
      if (!button) return;
      showSection(button.dataset.healthHubOpen);
    });
  }

  function wrapNutritionPanel() {
    const hero = healthView.querySelector(".healthHero");
    const dashboard = healthView.querySelector("#healthDashboard");

    if (!hero || !dashboard) {
      return false;
    }

    nutritionPanel = createElement("section", {
      className: "healthSubmodule",
      id: "healthNutritionPanel",
      attributes: {
        hidden: "",
        "aria-label": "Beslenme"
      }
    });

    hero.parentNode.insertBefore(nutritionPanel, hero);
    nutritionPanel.append(hero, dashboard);
    return true;
  }

  function interceptBackButton() {
    backButton = healthView.querySelector("#btnModulesFromHealth");
    if (!backButton) return;

    backButton.addEventListener(
      "click",
      (event) => {
        if (activeSection === "hub") return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        showSection("hub");
      },
      true
    );
  }

  function resetWhenOpeningHealth() {
    document.addEventListener(
      "click",
      (event) => {
        const trigger = event.target.closest('[data-open-module="health"]');
        if (!trigger) return;
        showSection("hub", { focus: false, scroll: false });
      },
      true
    );
  }

  function init() {
    if (initialized) return getState();

    healthView = document.querySelector(VIEW_SELECTOR);
    if (!healthView) {
      return {
        initialized: false,
        reason: "health_view_not_found"
      };
    }

    installLayoutStyles();

    if (!wrapNutritionPanel()) {
      return {
        initialized: false,
        reason: "nutrition_panel_not_found"
      };
    }

    buildHub();
    nutritionPanel.parentNode.insertBefore(hub, nutritionPanel);

    sportPanel = makePlaceholder(
      "healthSportPanel",
      "↗",
      "Spor",
      "Antrenman, hareket kütüphanesi, program ve ilerleme burada gelişecek."
    );

    wellnessPanel = makePlaceholder(
      "healthWellnessPanel",
      "+",
      "Sağlık",
      "Uyku, enerji, semptomlar ve beden notları burada gelişecek."
    );

    nutritionPanel.parentNode.insertBefore(sportPanel, nutritionPanel.nextSibling);
    nutritionPanel.parentNode.insertBefore(wellnessPanel, sportPanel.nextSibling);

    interceptBackButton();
    resetWhenOpeningHealth();

    initialized = true;
    showSection("hub", { focus: false, scroll: false });
    return getState();
  }

  function getState() {
    return Object.freeze({
      initialized,
      activeSection
    });
  }

  window.TodayHealthHub = Object.freeze({
    API_VERSION,
    RULESET_ID,
    init,
    showSection,
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
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
