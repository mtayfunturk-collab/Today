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

  const API_VERSION = 3;
  const RULESET_ID = "today:health:hub:v4";
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
  let nutritionHub = null;
  let nutritionActiveSection = "hub";
  let nutritionPanels = {};
  let waterObserver = null;
  const WATER_GLASS_KEY = "today.health.water.glassMl";
  const WATER_TARGET_KEY = "today.health.water.targetMl";

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
      html, body {
        width: 100%;
        max-width: 100%;
        overflow-x: clip;
      }

      body { min-height: 100dvh; }

      .wrap {
        width: 100%;
        max-width: 100%;
        min-height: 100dvh;
        align-items: center !important;
        justify-content: center !important;
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

      body[data-route="health"] .wrap {
        align-items: flex-start !important;
      }

      body[data-route="health"] .screen {
        min-height: calc(100dvh - 28px);
      }

      [data-view="pick"].show,
      [data-view="health"].show,
      [data-view="sky"].show {
        min-height: calc(100dvh - 28px);
        display: flex !important;
        flex-direction: column;
      }

      [data-view="pick"] > .bottomNav,
      [data-view="health"] > .bottomNav,
      [data-view="sky"] > .bottomNav {
        margin-top: auto !important;
        flex: 0 0 auto;
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

      .healthView { overflow-x: clip; }

      .healthView > .topbar {
        position: relative;
        min-height: 50px;
        margin-bottom: 4px;
      }

      .healthView > .topbar .pill {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        border: 0;
        background: transparent;
        padding: 0 8px;
        color: var(--text);
        font-size: 22px;
        font-weight: 900;
        letter-spacing: -.02em;
        white-space: nowrap;
      }

      .healthView > .topbar .topbarSpacer {
        width: 44px;
        height: 44px;
        flex: 0 0 44px;
      }

      .healthHub {
        display: grid;
        gap: 14px;
        width: 100%;
        max-width: 100%;
        padding-top: 2px;
      }

      .healthHubHeader {
        text-align: center;
        padding: 4px 4px 8px;
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
        font-size: 31px;
        font-weight: 900;
        line-height: 1;
      }

      .healthHubTitle {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        overflow: hidden !important;
        clip: rect(0 0 0 0) !important;
        clip-path: inset(50%) !important;
        white-space: nowrap !important;
      }

      .healthHubIntro {
        max-width: 36ch;
        margin: 0 auto;
        color: var(--muted);
        font-size: 14px;
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

      .healthHubCard:active { transform: scale(.992); }

      .healthHubIcon {
        width: 46px;
        height: 46px;
        flex: 0 0 46px;
        display: grid;
        place-items: center;
        border: 1px solid var(--stroke);
        border-radius: 15px;
        background: rgba(255,255,255,.045);
        font-size: 24px;
        font-weight: 900;
        line-height: 1;
      }

      .healthCrescentSvg {
        width: 29px;
        height: 29px;
        display: block;
        color: var(--text);
      }

      .healthCrescentSvgLarge {
        width: 32px;
        height: 32px;
      }

      .healthHubCopy { min-width: 0; flex: 1; }

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
        font-size: 26px;
        line-height: 1;
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

      .healthCollapsibleSection > .healthSectionHead {
        cursor: pointer;
        user-select: none;
        margin-bottom: 0;
      }

      .healthCollapsibleSection[data-collapsed="false"] > .healthSectionHead {
        margin-bottom: 11px;
      }

      .healthCollapseArrow {
        display: inline-grid;
        place-items: center;
        width: 24px;
        height: 24px;
        margin-left: 6px;
        color: var(--muted);
        font-size: 17px;
        transition: transform .15s ease;
      }

      .healthCollapsibleSection[data-collapsed="false"] .healthCollapseArrow {
        transform: rotate(90deg);
      }

      .healthCollapsibleSection > ol[hidden] {
        display: none !important;
      }

      /* NUT-013.2 — Beslenme Hub */
      .nutritionHub,
      .nutritionSubview {
        width: 100%;
        max-width: 100%;
      }

      .nutritionHub[hidden],
      .nutritionSubview[hidden] {
        display: none !important;
      }

      .nutritionHubHeader {
        padding: 8px 4px 15px;
        text-align: center;
      }

      .nutritionHubMark {
        width: 52px;
        height: 52px;
        display: grid;
        place-items: center;
        margin: 0 auto 10px;
        border: 1px solid var(--stroke);
        border-radius: 17px;
        background: rgba(255,255,255,.045);
        font-size: 23px;
      }

      .nutritionHubIntro {
        margin: 0 auto;
        max-width: 34ch;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.45;
      }

      .nutritionHubCards {
        display: grid;
        gap: 11px;
      }

      .nutritionHubCard {
        width: 100%;
        min-height: 78px;
        display: flex;
        align-items: center;
        gap: 13px;
        padding: 14px;
        border: 1px solid var(--stroke);
        border-radius: 19px;
        background: rgba(255,255,255,.035);
        color: var(--text);
        text-align: left;
        font: inherit;
      }

      .nutritionHubCardIcon {
        width: 43px;
        height: 43px;
        flex: 0 0 43px;
        display: grid;
        place-items: center;
        border: 1px solid var(--stroke);
        border-radius: 14px;
        background: rgba(255,255,255,.04);
        font-size: 20px;
      }

      .nutritionHubCardCopy {
        min-width: 0;
        flex: 1;
      }

      .nutritionHubCardCopy strong {
        display: block;
        font-size: 16px;
      }

      .nutritionHubCardCopy small {
        display: block;
        margin-top: 3px;
        color: var(--muted);
        font-size: 11px;
        line-height: 1.35;
      }

      .nutritionSubviewHeader {
        padding: 5px 2px 13px;
        text-align: center;
      }

      .nutritionSubviewHeader h2 {
        margin: 0;
        font-size: 20px;
      }

      .nutritionSubviewHeader p {
        margin: 5px 0 0;
        color: var(--muted);
        font-size: 12px;
      }

      .todayWaterVisual {
        padding: 17px 14px;
        border: 1px solid var(--stroke);
        border-radius: 20px;
        background: rgba(255,255,255,.035);
        text-align: center;
      }

      .todayWaterGlasses {
        min-height: 116px;
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        justify-content: center;
        gap: 9px;
        padding: 8px 2px 13px;
      }

      .todayWaterGlass {
        position: relative;
        flex: 0 0 auto;
        border: 2px solid color-mix(in srgb, var(--text) 55%, transparent);
        border-radius: 4px 4px 8px 8px;
        overflow: hidden;
        background: rgba(255,255,255,.018);
        transition: width .18s ease, height .18s ease;
      }

      .todayWaterGlass::before {
        content: "";
        position: absolute;
        left: 3px;
        right: 3px;
        bottom: 3px;
        height: calc(var(--fill, 0) * 1%);
        max-height: calc(100% - 6px);
        border-radius: 2px 2px 5px 5px;
        background: color-mix(in srgb, #69a9ff 72%, var(--accent));
        opacity: .9;
      }

      .todayWaterSummary {
        display: grid;
        gap: 3px;
      }

      .todayWaterSummary strong {
        font-size: 17px;
      }

      .todayWaterSummary span {
        color: var(--muted);
        font-size: 12px;
      }

      .todayWaterAdd {
        width: min(100%, 250px);
        min-height: 44px;
        margin-top: 13px;
        border: 1px solid var(--stroke);
        border-radius: 14px;
        background: rgba(255,255,255,.06);
        color: var(--text);
        font: inherit;
        font-weight: 800;
      }

      .todayWaterSettings {
        display: grid;
        grid-template-columns: minmax(0,1fr) minmax(0,1fr);
        gap: 9px;
        margin-top: 13px;
      }

      .todayWaterSettings label {
        display: grid;
        gap: 5px;
        text-align: left;
        color: var(--muted);
        font-size: 11px;
      }

      .todayWaterSettings select {
        width: 100%;
        min-width: 0;
        min-height: 42px;
        border: 1px solid var(--stroke);
        border-radius: 13px;
        background: rgba(255,255,255,.04);
        color: var(--text);
        padding: 8px 10px;
        font: inherit;
      }

      .nutritionLegacyWater {
        margin-top: 12px;
      }

      .nutritionLegacyWater .healthQuickActions {
        display: none !important;
      }

      @media (max-width: 420px) {
        .inner { padding: 18px !important; }
        .healthHub { gap: 11px; }
        .healthHubCard { min-height: 84px; padding: 14px; }

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


  function createCrescentIcon(className = "healthCrescentSvg") {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    const maskId = `todayCrescentMask-${Math.random().toString(36).slice(2)}`;

    svg.setAttribute("viewBox", "0 0 64 64");
    svg.setAttribute("class", className);
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    const defs = document.createElementNS(ns, "defs");
    const mask = document.createElementNS(ns, "mask");
    mask.setAttribute("id", maskId);

    const white = document.createElementNS(ns, "rect");
    white.setAttribute("x", "0");
    white.setAttribute("y", "0");
    white.setAttribute("width", "64");
    white.setAttribute("height", "64");
    white.setAttribute("fill", "white");

    const cutout = document.createElementNS(ns, "circle");
    cutout.setAttribute("cx", "23");
    cutout.setAttribute("cy", "32");
    cutout.setAttribute("r", "21");
    cutout.setAttribute("fill", "black");

    mask.append(white, cutout);
    defs.appendChild(mask);

    const outer = document.createElementNS(ns, "circle");
    outer.setAttribute("cx", "32");
    outer.setAttribute("cy", "32");
    outer.setAttribute("r", "23");
    outer.setAttribute("fill", "currentColor");
    outer.setAttribute("mask", `url(#${maskId})`);

    svg.append(defs, outer);
    return svg;
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
      attributes: { "aria-hidden": "true" }
    });

    if (section === "wellness") {
      iconElement.appendChild(createCrescentIcon());
    } else {
      iconElement.textContent = icon;
    }

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
      attributes: { "aria-hidden": "true" }
    });

    if (id === "healthWellnessPanel") {
      iconElement.appendChild(createCrescentIcon("healthCrescentSvg healthCrescentSvgLarge"));
    } else {
      iconElement.textContent = icon;
    }
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
      hub: "Health",
      sport: "Spor",
      nutrition: nutritionActiveSection === "hub"
        ? "Beslenme"
        : ({
            meals: "Öğünler",
            water: "Su",
            library: "Kütüphanem",
            history: "Geçmiş"
          }[nutritionActiveSection] || "Beslenme"),
      wellness: "Sağlık"
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
      Promise.resolve(window.TodayNutritionUI?.open?.())
        .then(() => renderWaterVisual())
        .catch(() => {});
      Promise.resolve(window.TodayNutritionLibraryUI?.open?.()).catch(() => {});
      showNutritionSection("hub", { focus: false });
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
      resetHealthScroll();
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
      text: "Bugün bedeninde neyi fark etmek istiyorsun?"
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
        "",
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
    hero.hidden = true;
    hero.setAttribute("aria-hidden", "true");
    return true;
  }

  function interceptBackButton() {
    backButton = healthView.querySelector("#btnModulesFromHealth");
    if (!backButton) return;

    backButton.addEventListener(
      "click",
      (event) => {
        if (
          activeSection === "nutrition" &&
          nutritionActiveSection !== "hub"
        ) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          showNutritionSection("hub");
          return;
        }

        if (activeSection === "hub") return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        if (activeSection === "nutrition") {
          nutritionActiveSection = "hub";
        }

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
        showSection("hub", { focus: false, scroll: true });
      },
      true
    );
  }


  function resetHealthScroll() {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch (error) {
      window.scrollTo(0, 0);
    }

    if (document.scrollingElement) {
      document.scrollingElement.scrollTop = 0;
      document.scrollingElement.scrollLeft = 0;
    }

    if (healthView) {
      healthView.scrollTop = 0;
      healthView.scrollLeft = 0;
    }
  }

  function nutritionCard(section, icon, title, detail) {
    const button = createElement("button", {
      className: "nutritionHubCard",
      type: "button",
      attributes: {
        "data-nutrition-hub-open": section,
        "aria-label": `${title} bölümünü aç`
      }
    });

    const iconElement = createElement("span", {
      className: "nutritionHubCardIcon",
      text: icon,
      attributes: { "aria-hidden": "true" }
    });

    const copy = createElement("span", {
      className: "nutritionHubCardCopy"
    });
    copy.append(
      createElement("strong", { text: title }),
      createElement("small", { text: detail })
    );

    button.append(
      iconElement,
      copy,
      createElement("span", {
        className: "healthHubArrow",
        text: "›",
        attributes: { "aria-hidden": "true" }
      })
    );

    return button;
  }

  function makeNutritionPanel(id, title, detail) {
    const panel = createElement("section", {
      className: "nutritionSubview",
      id,
      attributes: { hidden: "" }
    });

    const header = createElement("header", {
      className: "nutritionSubviewHeader"
    });
    header.append(
      createElement("h2", { text: title }),
      createElement("p", { text: detail })
    );
    panel.appendChild(header);
    return panel;
  }

  function buildNutritionHub() {
    const dashboard = document.getElementById("healthDashboard");
    if (!dashboard || nutritionHub) return;

    nutritionHub = createElement("section", {
      className: "nutritionHub",
      id: "nutritionHub"
    });

    const header = createElement("header", {
      className: "nutritionHubHeader"
    });
    header.append(
      createElement("div", {
        className: "nutritionHubMark",
        text: "◐",
        attributes: { "aria-hidden": "true" }
      }),
      createElement("p", {
        className: "nutritionHubIntro",
        text: "Bugün beslenmende ne var?"
      })
    );

    const cards = createElement("div", {
      className: "nutritionHubCards"
    });
    cards.append(
      nutritionCard("meals", "◉", "Öğünler", "Öğün ekle ve düzenle"),
      nutritionCard("water", "◒", "Su", "Günlük su kaydı"),
      nutritionCard("library", "▤", "Kütüphanem", "Besinler ve tarifler"),
      nutritionCard("history", "◷", "Geçmiş", "Günler ve arşiv")
    );

    nutritionHub.append(header, cards);
    dashboard.prepend(nutritionHub);

    cards.addEventListener("click", (event) => {
      const button = event.target.closest("[data-nutrition-hub-open]");
      if (!button) return;
      showNutritionSection(button.dataset.nutritionHubOpen);
    });

    const mealsPanel = makeNutritionPanel(
      "nutritionMealsPanel",
      "Öğünler",
      "Ne yediğini kaydet."
    );
    const waterPanel = makeNutritionPanel(
      "nutritionWaterPanel",
      "Su",
      "Bugün ne kadar içtin?"
    );
    const libraryPanel = makeNutritionPanel(
      "nutritionLibraryPanel",
      "Kütüphanem",
      "Besinlerini ve tariflerini yönet."
    );
    const historyPanel = makeNutritionPanel(
      "nutritionHistoryPanel",
      "Geçmiş",
      "Günlük kayıtlarını ve arşivi gör."
    );

    nutritionPanels = {
      meals: mealsPanel,
      water: waterPanel,
      library: libraryPanel,
      history: historyPanel
    };

    [mealsPanel, waterPanel, libraryPanel, historyPanel]
      .forEach(panel => dashboard.appendChild(panel));

    const mealForm = document.getElementById("healthMealForm");
    if (mealForm) mealsPanel.appendChild(mealForm);

    const waterTitle = document.getElementById("healthWaterTitle");
    const legacyWater = waterTitle?.closest("section");
    if (legacyWater) {
      legacyWater.classList.add("nutritionLegacyWater");
      waterPanel.appendChild(legacyWater);
    }

    const libraryManager =
      document.getElementById("healthLibraryManager");
    if (libraryManager) libraryPanel.appendChild(libraryManager);

    const summaryCard =
      document.querySelector(".healthSummaryCard");
    const currentOnlyNote =
      document.getElementById("healthCurrentOnlyNote");
    const entrySection =
      document.getElementById("healthEntriesTitle")?.closest("section");
    const archivedSection =
      document.getElementById("healthArchivedSection");
    const healthStatus =
      document.getElementById("healthStatus");

    [
      summaryCard,
      currentOnlyNote,
      entrySection,
      archivedSection,
      healthStatus
    ].filter(Boolean).forEach(node => historyPanel.appendChild(node));

    const planSection =
      document.getElementById("healthPlanTitle")?.closest("section");
    if (planSection) {
      planSection.hidden = true;
      planSection.setAttribute("aria-hidden", "true");
    }

    buildWaterVisual(waterPanel);
    showNutritionSection("hub", { focus: false });
  }

  function readWaterPreference(key, fallback) {
    try {
      const value = Number(localStorage.getItem(key));
      return Number.isFinite(value) && value > 0 ? value : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveWaterPreference(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch (error) {}
  }

  function waterGlassScale(ml) {
    const clamped = Math.max(250, Math.min(500, ml));
    const ratio = (clamped - 250) / 250;
    return {
      width: Math.round(29 + ratio * 10),
      height: Math.round(48 + ratio * 18)
    };
  }

  function buildWaterVisual(panel) {
    if (!panel || document.getElementById("todayWaterVisual")) return;

    const visual = createElement("section", {
      className: "todayWaterVisual",
      id: "todayWaterVisual"
    });

    const glasses = createElement("div", {
      className: "todayWaterGlasses",
      id: "todayWaterGlasses"
    });

    const summary = createElement("div", {
      className: "todayWaterSummary"
    });
    summary.append(
      createElement("strong", {
        id: "todayWaterGlassCount",
        text: "0 / 8 bardak"
      }),
      createElement("span", {
        id: "todayWaterMl",
        text: "0 ml"
      })
    );

    const addButton = createElement("button", {
      className: "todayWaterAdd",
      id: "btnTodayAddWaterGlass",
      type: "button",
      text: "+ 1 bardak"
    });

    const settings = createElement("div", {
      className: "todayWaterSettings"
    });

    const glassLabel = createElement("label");
    glassLabel.appendChild(createElement("span", { text: "Bardak hacmi" }));
    const glassSelect = createElement("select", {
      id: "todayWaterGlassMl",
      attributes: { "aria-label": "Bardak hacmi" }
    });
    [250, 300, 350, 500].forEach(value => {
      glassSelect.appendChild(
        createElement("option", {
          text: `${value} ml`,
          attributes: { value: String(value) }
        })
      );
    });

    const targetLabel = createElement("label");
    targetLabel.appendChild(createElement("span", { text: "Günlük hedef" }));
    const targetSelect = createElement("select", {
      id: "todayWaterTargetMl",
      attributes: { "aria-label": "Günlük su hedefi" }
    });
    [2000, 2500, 2800, 3000, 3500].forEach(value => {
      targetSelect.appendChild(
        createElement("option", {
          text: `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value / 1000)} L`,
          attributes: { value: String(value) }
        })
      );
    });

    glassLabel.appendChild(glassSelect);
    targetLabel.appendChild(targetSelect);
    settings.append(glassLabel, targetLabel);
    visual.append(glasses, summary, addButton, settings);

    const legacyWater = panel.querySelector(".nutritionLegacyWater");
    if (legacyWater) panel.insertBefore(visual, legacyWater);
    else panel.appendChild(visual);

    glassSelect.value = String(readWaterPreference(WATER_GLASS_KEY, 350));
    targetSelect.value = String(readWaterPreference(WATER_TARGET_KEY, 2800));

    glassSelect.addEventListener("change", () => {
      saveWaterPreference(WATER_GLASS_KEY, Number(glassSelect.value));
      renderWaterVisual();
    });

    targetSelect.addEventListener("change", () => {
      saveWaterPreference(WATER_TARGET_KEY, Number(targetSelect.value));
      renderWaterVisual();
    });

    addButton.addEventListener("click", () => {
      const ml = Number(glassSelect.value);
      const proxy = document.querySelector("[data-health-water-ml]");
      if (!proxy || !Number.isFinite(ml)) return;

      const previous = proxy.dataset.healthWaterMl;
      proxy.dataset.healthWaterMl = String(ml);
      proxy.click();
      proxy.dataset.healthWaterMl = previous || "250";

      window.setTimeout(renderWaterVisual, 150);
      window.setTimeout(renderWaterVisual, 600);
    });

    const summaryText = document.getElementById("healthSummaryText");
    if (summaryText && typeof MutationObserver === "function") {
      waterObserver = new MutationObserver(renderWaterVisual);
      waterObserver.observe(summaryText, {
        childList: true,
        characterData: true,
        subtree: true
      });
    }

    renderWaterVisual();
  }

  function renderWaterVisual() {
    const glasses = document.getElementById("todayWaterGlasses");
    const count = document.getElementById("todayWaterGlassCount");
    const amount = document.getElementById("todayWaterMl");
    const glassSelect = document.getElementById("todayWaterGlassMl");
    const targetSelect = document.getElementById("todayWaterTargetMl");
    if (!glasses || !count || !amount || !glassSelect || !targetSelect) return;

    const state = window.TodayNutritionUI?.getState?.();
    const totalMl = Math.max(0, Number(state?.summary?.waterMl) || 0);
    const glassMl = Math.max(1, Number(glassSelect.value) || 350);
    const targetMl = Math.max(glassMl, Number(targetSelect.value) || 2800);
    const glassCount = Math.max(1, Math.ceil(targetMl / glassMl));
    const fullGlasses = Math.floor(totalMl / glassMl);
    const partialMl = totalMl % glassMl;
    const dimensions = waterGlassScale(glassMl);

    glasses.replaceChildren();

    for (let index = 0; index < glassCount; index += 1) {
      let fill = 0;
      if (index < fullGlasses) fill = 100;
      else if (index === fullGlasses && partialMl > 0) {
        fill = Math.round((partialMl / glassMl) * 100);
      }

      const glass = createElement("span", {
        className: "todayWaterGlass",
        attributes: { "aria-hidden": "true" }
      });
      glass.style.width = `${dimensions.width}px`;
      glass.style.height = `${dimensions.height}px`;
      glass.style.setProperty("--fill", String(fill));
      glasses.appendChild(glass);
    }

    const equivalent = Math.min(glassCount, Math.floor(totalMl / glassMl));
    count.textContent = `${equivalent} / ${glassCount} bardak`;
    amount.textContent = totalMl >= 1000
      ? `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(totalMl / 1000)} L`
      : `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(totalMl)} ml`;
  }

  function showNutritionSection(section, options = {}) {
    const valid = ["hub", "meals", "water", "library", "history"];
    if (!valid.includes(section)) section = "hub";

    nutritionActiveSection = section;

    if (nutritionHub) nutritionHub.hidden = section !== "hub";

    Object.entries(nutritionPanels).forEach(([name, panel]) => {
      if (panel) panel.hidden = name !== section;
    });

    const pill = healthView?.querySelector(".topbar .pill");
    const labels = {
      hub: "Beslenme",
      meals: "Öğünler",
      water: "Su",
      library: "Kütüphanem",
      history: "Geçmiş"
    };
    if (pill) pill.textContent = labels[section] || "Beslenme";

    renderWaterVisual();
    resetHealthScroll();

    if (options.focus !== false) {
      const target = section === "hub"
        ? nutritionHub
        : nutritionPanels[section]?.querySelector("h2");
      if (target) {
        target.tabIndex = -1;
        try { target.focus({ preventScroll: true }); }
        catch (error) { target.focus(); }
      }
    }
  }

  function refineGlobalHealthIdentity() {
    const moduleDescription = document.getElementById("moduleHealthDesc");
    if (moduleDescription) {
      moduleDescription.textContent = "Beslenme, spor ve yaşam";
    }

    const mainHealthIcon =
      document.querySelector("#btnModuleHealth .moduleIcon");
    if (mainHealthIcon) {
      mainHealthIcon.textContent = "♥";
    }

    document
      .querySelectorAll('[data-open-module="health"] .navIcon')
      .forEach((icon) => {
        icon.textContent = "♥";
      });
  }

  function setupCollapsibleSection(section, titleText) {
    if (!section || section.dataset.healthCollapsibleReady === "true") {
      return;
    }

    const head = section.querySelector(".healthSectionHead");
    const list = section.querySelector("ol");
    if (!head || !list) return;

    const title = head.querySelector(".healthSectionTitle");
    if (title && titleText) title.textContent = titleText;

    section.classList.add("healthCollapsibleSection");
    section.dataset.healthCollapsibleReady = "true";
    section.dataset.collapsed = "true";
    list.hidden = true;

    head.setAttribute("role", "button");
    head.setAttribute("tabindex", "0");
    head.setAttribute("aria-expanded", "false");

    const arrow = createElement("span", {
      className: "healthCollapseArrow",
      text: "›",
      attributes: { "aria-hidden": "true" }
    });
    head.appendChild(arrow);

    const toggle = () => {
      const willOpen = section.dataset.collapsed !== "false";
      section.dataset.collapsed = willOpen ? "false" : "true";
      list.hidden = !willOpen;
      head.setAttribute("aria-expanded", String(willOpen));
    };

    head.addEventListener("click", toggle);
    head.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggle();
    });
  }

  function simplifyNutritionRecords() {
    const entriesSection =
      document.getElementById("healthEntriesTitle")?.closest("section");
    setupCollapsibleSection(entriesSection, "Bugünün kayıtları");

    const archivedSection =
      document.getElementById("healthArchivedSection");
    setupCollapsibleSection(archivedSection, "Arşiv");
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
    refineGlobalHealthIdentity();

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
      "",
      "Sağlık",
      "Uyku, enerji, semptomlar ve beden notları burada gelişecek."
    );

    nutritionPanel.parentNode.insertBefore(sportPanel, nutritionPanel.nextSibling);
    nutritionPanel.parentNode.insertBefore(wellnessPanel, sportPanel.nextSibling);

    buildNutritionHub();
    simplifyNutritionRecords();
    interceptBackButton();
    resetWhenOpeningHealth();

    initialized = true;
    showSection("hub", { focus: false, scroll: true });
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
