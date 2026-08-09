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

  const API_VERSION = 21;
  const RULESET_ID = "today:health:hub:nut-015.2";
  const VIEW_SELECTOR = '[data-view="health"]';

  let initialized = false;
  let activeSection = "hub";
  let healthView = null;
  let hub = null;
  let nutritionPanel = null;
  let sportPanel = null;
  let wellnessPanel = null;
  let wellnessHub = null;
  let wellnessActiveSection = "hub";
  let wellnessPanels = {};
  let backButton = null;
  let styleElement = null;
  let nutritionHub = null;
  let nutritionActiveSection = "hub";
  let nutritionPanels = {};
  let waterObserver = null;
  const WATER_GLASS_KEY = "today.health.water.glassMl";
  const WATER_TARGET_KEY = "today.health.water.targetMl";
  let mealHub = null;
  let mealActiveSection = "hub";
  let mealPanels = {};
  let mealEntryObserver = null;
  let sportActiveSection = "hub";
  let sportHub = null;
  let sportPanels = {};
  const SPORT_PROGRAM_KEY = "today.health.sport.program.v1";
  const SPORT_WORKOUT_LOG_KEY = "today.health.sport.workouts.v1";
  const SPORT_CUSTOM_DAYS_KEY = "today.health.sport.customDays.v1";
  const SPORT_DAY_SETTINGS_KEY = "today.health.sport.daySettings.v1";
  const WELLNESS_SLEEP_KEY = "today.health.wellness.sleep.v1";
  let sportProgramDraft = null;

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

      .todayWaterAdjust {
        display: grid;
        grid-template-columns: 52px minmax(0,1fr) 52px;
        gap: 10px;
        align-items: center;
        width: min(100%, 290px);
        margin: 13px auto 0;
      }

      .todayWaterAdjustButton {
        width: 52px;
        height: 52px;
        display: grid;
        place-items: center;
        border: 1px solid var(--stroke);
        border-radius: 50%;
        background: rgba(255,255,255,.055);
        color: var(--text);
        font: inherit;
        font-size: 25px;
        font-weight: 750;
      }

      .todayWaterAdjustButton:disabled {
        opacity: .35;
      }

      .todayWaterAdjustLabel {
        color: var(--muted);
        font-size: 12px;
        line-height: 1.35;
      }

      .todayWaterAdjustLabel strong {
        display: block;
        color: var(--text);
        font-size: 14px;
      }

      .mealHub,
      .mealSubview {
        width: 100%;
        max-width: 100%;
      }

      .mealHub[hidden],
      .mealSubview[hidden] {
        display: none !important;
      }

      .mealHubHeader {
        padding: 5px 4px 15px;
        text-align: center;
      }

      .mealHubHeader p {
        margin: 0;
        color: var(--muted);
        font-size: 13px;
      }

      .mealHubCards {
        display: grid;
        gap: 11px;
      }

      .mealHubCard {
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

      .mealHubIcon {
        width: 43px;
        height: 43px;
        flex: 0 0 43px;
        display: grid;
        place-items: center;
        border: 1px solid var(--stroke);
        border-radius: 14px;
        background: rgba(255,255,255,.04);
        font-size: 22px;
      }

      .mealHubCopy {
        min-width: 0;
        flex: 1;
      }

      .mealHubCopy strong {
        display: block;
        font-size: 16px;
      }

      .mealHubCopy small {
        display: block;
        margin-top: 3px;
        color: var(--muted);
        font-size: 11px;
        line-height: 1.35;
      }

      .mealSubviewHeader {
        padding: 4px 2px 12px;
        text-align: center;
      }

      .mealSubviewHeader h3 {
        margin: 0;
        font-size: 18px;
      }

      .mealSubviewHeader p {
        margin: 4px 0 0;
        color: var(--muted);
        font-size: 11px;
      }

      .mealCurrentOnly .healthListItem[data-today-entry-kind="water"] {
        display: none !important;
      }

      /* NUT-013.4 — Öğün ekle minimal düzen */
      #mealAddPanel {
        padding-bottom: calc(124px + env(safe-area-inset-bottom));
      }

      #mealAddPanel .mealSubviewHeader {
        padding-bottom: 10px;
      }

      #healthMealForm {
        display: grid;
        gap: 14px;
        padding: 0 !important;
        border: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
      }

      #healthMealForm > .healthSectionHead,
      #healthMealForm > header {
        display: none !important;
      }

      #healthMealForm .healthField,
      #healthMealForm label {
        min-width: 0;
      }

      #healthMealForm input,
      #healthMealForm select,
      #healthMealForm textarea {
        width: 100%;
        min-width: 0;
      }

      #healthMealType,
      #healthMealName {
        min-height: 50px;
        border-radius: 15px;
      }

      .todayMealPrimaryCard,
      .todayMealLibraryCard {
        width: 100%;
        padding: 16px;
        border: 1px solid var(--stroke);
        border-radius: 20px;
        background: rgba(255,255,255,.035);
      }

      .todayMealPrimaryCard {
        display: grid;
        gap: 13px;
      }

      .todayMealLibraryToggle {
        width: 100%;
        min-height: 50px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 0 14px;
        border: 1px solid var(--stroke);
        border-radius: 15px;
        background: rgba(255,255,255,.035);
        color: var(--text);
        font: inherit;
        font-weight: 800;
        text-align: left;
      }

      .todayMealLibraryToggle span:last-child {
        color: var(--muted);
        font-size: 20px;
        transition: transform .16s ease;
      }

      .todayMealLibraryToggle[aria-expanded="true"] span:last-child {
        transform: rotate(90deg);
      }

      .todayMealLibraryCard[hidden] {
        display: none !important;
      }

      .todayMealLibraryCard {
        display: grid;
        gap: 12px;
      }

      .todayMealLibraryCard fieldset {
        border: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
        min-width: 0;
      }

      .todayMealLibraryCard .healthLibraryControls,
      .todayMealLibraryCard .healthLibraryPicker {
        padding: 0 !important;
        border: 0 !important;
        background: transparent !important;
      }

      #btnHealthMealSubmit {
        width: 100%;
        min-height: 56px;
        margin: 2px 0 18px !important;
        border-radius: 17px !important;
        position: relative;
        z-index: 2;
      }

      #mealAddPanel + * {
        scroll-margin-bottom: 120px;
      }


      /* NUT-014.1 — Spor ana ekranı */
      .sportHub,.sportSubview{width:100%;max-width:100%}
      .sportHub[hidden],.sportSubview[hidden]{display:none!important}
      .sportHubHeader{text-align:center;padding:6px 4px 14px}
      .sportHubMark{width:56px;height:56px;display:grid;place-items:center;margin:0 auto 10px;border:1px solid var(--stroke);border-radius:18px;background:rgba(255,255,255,.045);font-size:25px}
      .sportHubIntro{max-width:34ch;margin:0 auto;color:var(--muted);font-size:13px;line-height:1.45}
      .sportHubCards{display:grid;gap:11px}
      .sportHubCard{width:100%;min-height:82px;display:flex;align-items:center;gap:13px;padding:14px;border:1px solid var(--stroke);border-radius:19px;background:rgba(255,255,255,.035);color:var(--text);text-align:left;font:inherit}
      .sportHubCard:active{transform:scale(.992)}
      .sportHubCardIcon{width:44px;height:44px;flex:0 0 44px;display:grid;place-items:center;border:1px solid var(--stroke);border-radius:14px;background:rgba(255,255,255,.045);font-size:21px;font-weight:900}
      .sportHubCardCopy{min-width:0;flex:1}
      .sportHubCardCopy strong{display:block;font-size:16px;line-height:1.25}
      .sportHubCardCopy small{display:block;margin-top:4px;color:var(--muted);font-size:11px;line-height:1.4}
      .sportSubview{min-height:min(58dvh,470px)}
      .sportSubviewHeader{text-align:center;padding:8px 4px 14px}
      .sportSubviewHeader h2{margin:0;font-size:21px}
      .sportSubviewHeader p{margin:5px auto 0;max-width:34ch;color:var(--muted);font-size:12px;line-height:1.45}
      .sportFoundationCard{width:100%;padding:18px;border:1px solid var(--stroke);border-radius:20px;background:rgba(255,255,255,.035)}
      .sportFoundationCard strong{display:block;font-size:15px}
      .sportFoundationCard p{margin:7px 0 0;color:var(--muted);font-size:12px;line-height:1.5}
      .sportFoundationBadge{display:inline-flex;align-items:center;min-height:30px;margin-top:13px;padding:0 10px;border:1px solid var(--stroke);border-radius:999px;color:var(--muted);font-size:11px;font-weight:800}


      /* NUT-014.2 — Programım */
      .sportProgramSetup,
      .sportProgramSummary {
        display: grid;
        gap: 13px;
      }

      .sportProgramSetup[hidden],
      .sportProgramSummary[hidden] {
        display: none !important;
      }

      .sportSetupStep {
        padding: 16px;
        border: 1px solid var(--stroke);
        border-radius: 20px;
        background: rgba(255,255,255,.035);
      }

      .sportSetupStep h3 {
        margin: 0 0 11px;
        font-size: 15px;
      }

      .sportChoiceGrid {
        display: grid;
        grid-template-columns: repeat(2,minmax(0,1fr));
        gap: 8px;
      }

      .sportChoice {
        min-height: 46px;
        padding: 9px 10px;
        border: 1px solid var(--stroke);
        border-radius: 14px;
        background: rgba(255,255,255,.025);
        color: var(--text);
        font: inherit;
        font-size: 12px;
        font-weight: 750;
      }

      .sportChoice[aria-pressed="true"] {
        background: rgba(255,255,255,.11);
        border-color: color-mix(in srgb,var(--text) 42%,transparent);
      }

      .sportSetupActions {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
        padding-bottom: calc(106px + env(safe-area-inset-bottom));
      }

      .sportPrimaryAction,
      .sportSecondaryAction {
        width: 100%;
        min-height: 50px;
        border-radius: 15px;
        font: inherit;
        font-weight: 850;
      }

      .sportPrimaryAction {
        border: 1px solid var(--text);
        background: #f5f7ff;
        color: #0b1323;
      }

      .sportPrimaryAction:disabled {
        opacity: .38;
      }

      .sportSecondaryAction {
        border: 1px solid var(--stroke);
        background: rgba(255,255,255,.035);
        color: var(--text);
      }

      .sportProgramHero {
        padding: 17px;
        border: 1px solid var(--stroke);
        border-radius: 20px;
        background: rgba(255,255,255,.04);
        text-align: center;
      }

      .sportProgramHero strong {
        display: block;
        font-size: 18px;
      }

      .sportProgramHero span {
        display: block;
        margin-top: 5px;
        color: var(--muted);
        font-size: 12px;
      }

      .sportDayList {
        display: grid;
        gap: 10px;
      }

      .sportDayCard {
        width: 100%;
        min-height: 86px;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px;
        border: 1px solid var(--stroke);
        border-radius: 18px;
        background: rgba(255,255,255,.035);
        color: var(--text);
        text-align: left;
        font: inherit;
      }

      .sportDayNumber {
        width: 42px;
        height: 42px;
        flex: 0 0 42px;
        display: grid;
        place-items: center;
        border: 1px solid var(--stroke);
        border-radius: 13px;
        font-weight: 900;
      }

      .sportDayCopy {
        min-width: 0;
        flex: 1;
      }

      .sportDayCopy strong {
        display: block;
        font-size: 15px;
      }

      .sportDayCopy small {
        display: block;
        margin-top: 3px;
        color: var(--muted);
        font-size: 11px;
        line-height: 1.35;
      }

      .sportEquipmentChoices {
        margin-top: 10px;
      }


      /* NUT-014.7 — Program günü ayarları */
      .sportDayTitleEditor{display:grid;grid-template-columns:1fr auto;gap:8px}
      .sportDayTitleInput{min-width:0;min-height:44px;padding:9px 11px;border:1px solid var(--stroke);border-radius:13px;background:rgba(255,255,255,.025);color:var(--text);font:inherit;font-weight:800}
      .sportDayTitleSave{min-width:72px;border:1px solid var(--stroke);border-radius:13px;background:rgba(255,255,255,.08);color:var(--text);font:inherit;font-weight:850}
      .sportProgramExerciseControls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:8px}
      .sportProgramExerciseField{display:grid;gap:4px}.sportProgramExerciseField label{color:var(--muted);font-size:9px;font-weight:800}
      .sportProgramExerciseField input{width:100%;min-height:38px;padding:7px;border:1px solid var(--stroke);border-radius:11px;background:rgba(255,255,255,.025);color:var(--text);font:inherit;text-align:center}
      .sportProgramMoveButtons{display:flex;gap:5px}.sportProgramMove{width:34px;height:34px;border:1px solid var(--stroke);border-radius:10px;background:rgba(255,255,255,.025);color:var(--text);font:inherit;font-weight:900}

      /* NUT-014.6 — Programım ↔ Hareket Kütüphanesi */
      .sportProgramDayEditor{display:grid;gap:11px;padding-bottom:calc(118px + env(safe-area-inset-bottom))}
      .sportProgramExerciseList{display:grid;gap:8px}
      .sportProgramExerciseRow{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--stroke);border-radius:16px;background:rgba(255,255,255,.03)}
      .sportProgramExerciseThumb{width:52px;height:52px;flex:0 0 52px;display:grid;place-items:center;border:1px solid var(--stroke);border-radius:13px;background:rgba(8,15,28,.35);overflow:hidden}
      .sportProgramExerciseThumb img{width:100%;height:100%;object-fit:contain;padding:5px}
      .sportProgramExerciseCopy{min-width:0;flex:1}.sportProgramExerciseCopy strong{display:block;font-size:12px}.sportProgramExerciseCopy small{display:block;margin-top:3px;color:var(--muted);font-size:10px}
      .sportProgramRemove{width:36px;height:36px;flex:0 0 36px;border:1px solid var(--stroke);border-radius:11px;background:rgba(255,255,255,.025);color:var(--muted);font:inherit;font-size:18px}
      .sportLibrarySelectCard{position:relative}
      .sportLibraryAddBadge{position:absolute;right:8px;top:8px;min-width:30px;height:30px;display:grid;place-items:center;border:1px solid var(--stroke);border-radius:999px;background:rgba(8,15,28,.82);font-size:17px;font-weight:900}
      .sportProgramEditorActions{display:grid;gap:8px}

      /* NUT-014.5 — Gelişim & Antrenman Geçmişi */
      .sportProgressShell{display:grid;gap:12px;padding-bottom:calc(118px + env(safe-area-inset-bottom))}
      .sportProgressStats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
      .sportProgressStat{min-width:0;padding:13px 8px;border:1px solid var(--stroke);border-radius:17px;background:rgba(255,255,255,.035);text-align:center}
      .sportProgressStat strong{display:block;font-size:19px;line-height:1.1}
      .sportProgressStat span{display:block;margin-top:5px;color:var(--muted);font-size:9px;line-height:1.25}
      .sportProgressSectionTitle{margin:5px 2px 0;font-size:14px}
      .sportProgressEmpty{padding:20px 16px;border:1px solid var(--stroke);border-radius:19px;background:rgba(255,255,255,.03);text-align:center}
      .sportProgressEmpty strong{display:block;font-size:15px}
      .sportProgressEmpty p{margin:7px auto 0;max-width:31ch;color:var(--muted);font-size:11px;line-height:1.5}
      .sportHistoryList{display:grid;gap:9px}
      .sportHistoryCard{width:100%;display:flex;align-items:center;gap:11px;padding:13px;border:1px solid var(--stroke);border-radius:17px;background:rgba(255,255,255,.035);color:var(--text);font:inherit;text-align:left}
      .sportHistoryDate{width:46px;height:46px;flex:0 0 46px;display:grid;place-items:center;border:1px solid var(--stroke);border-radius:14px;font-size:10px;font-weight:900;text-align:center;line-height:1.2}
      .sportHistoryCopy{min-width:0;flex:1}
      .sportHistoryCopy strong{display:block;font-size:13px}
      .sportHistoryCopy small{display:block;margin-top:4px;color:var(--muted);font-size:10px;line-height:1.35}
      .sportHistoryDetail{display:grid;gap:10px;padding-bottom:calc(118px + env(safe-area-inset-bottom))}
      .sportHistorySummary{padding:15px;border:1px solid var(--stroke);border-radius:18px;background:rgba(255,255,255,.04);text-align:center}
      .sportHistorySummary strong{display:block;font-size:16px}
      .sportHistorySummary span{display:block;margin-top:5px;color:var(--muted);font-size:11px}
      .sportHistoryExercise{display:flex;align-items:center;gap:11px;padding:12px;border:1px solid var(--stroke);border-radius:16px;background:rgba(255,255,255,.03)}
      .sportHistoryExerciseVisual{width:52px;height:52px;flex:0 0 52px;display:grid;place-items:center;border:1px solid var(--stroke);border-radius:13px;background:rgba(8,15,28,.35);overflow:hidden}
      .sportHistoryExerciseVisual img{width:100%;height:100%;object-fit:contain;padding:5px}
      .sportHistoryExerciseVisual span{font-size:16px;font-weight:900}
      .sportHistoryExerciseCopy{min-width:0;flex:1}
      .sportHistoryExerciseCopy strong{display:block;font-size:12px}
      .sportHistoryExerciseCopy small{display:block;margin-top:3px;color:var(--muted);font-size:10px;line-height:1.35}

      /* NUT-014.4 — Görsel Hareket Kütüphanesi */
      .sportLibraryFilters{display:flex;gap:7px;overflow-x:auto;max-width:100%;padding:2px 1px 7px;scrollbar-width:none;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch}
      .sportLibraryFilters::-webkit-scrollbar{display:none}
      .sportLibraryFilter{flex:0 0 auto;min-height:38px;padding:7px 12px;border:1px solid var(--stroke);border-radius:999px;background:rgba(255,255,255,.025);color:var(--muted);font:inherit;font-size:11px;font-weight:800}
      .sportLibraryFilter[aria-pressed="true"]{background:rgba(255,255,255,.12);color:var(--text)}
      .sportLibraryGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;width:100%;max-width:100%;padding-bottom:calc(132px + env(safe-area-inset-bottom))}
      .sportLibraryCard{min-width:0;overflow:hidden;padding:0;border:1px solid var(--stroke);border-radius:18px;background:rgba(255,255,255,.035);color:var(--text);font:inherit;text-align:left}
      .sportLibraryVisual{aspect-ratio:4/3;width:100%;display:grid;place-items:center;overflow:hidden;background:rgba(8,15,28,.38)}
      .sportLibraryVisual img{display:block;width:100%;height:100%;object-fit:contain;object-position:center;padding:6px}
      .sportLibraryCopy{display:block;min-width:0;padding:10px 8px 11px;text-align:center}.sportLibraryCopy strong{display:block;overflow:hidden;text-overflow:ellipsis;font-size:12px;line-height:1.25}.sportLibraryCopy small{display:block;margin-top:4px;overflow:hidden;text-overflow:ellipsis;color:var(--muted);font-size:9px;line-height:1.25}
      .sportSubviewHeader{text-align:center;margin-inline:auto;max-width:100%}
      .sportSubviewHeader h3,.sportSubviewHeader p{text-align:center}
      #sportExerciseLibraryView,#sportExercisePickerView{width:100%;max-width:100%;overflow-x:hidden}
      @media (max-width:359px){.sportLibraryGrid{gap:8px}.sportLibraryCopy strong{font-size:11px}.sportLibraryVisual{aspect-ratio:1/1}}
      @media (min-width:600px){.sportLibraryGrid{grid-template-columns:repeat(3,minmax(0,1fr))}.sportLibraryCopy strong{font-size:13px}}
      .sportExerciseDetail{display:grid;gap:13px;padding-bottom:calc(110px + env(safe-area-inset-bottom))}
      .sportExerciseDetailVisual{height:210px;display:grid;place-items:center;border:1px solid var(--stroke);border-radius:22px;background:rgba(8,15,28,.38)}
      .sportExerciseDetailVisual img{display:block;width:100%;height:100%;object-fit:contain;object-position:center;padding:10px}
      .sportExerciseDetailInfo{padding:15px;border:1px solid var(--stroke);border-radius:18px;background:rgba(255,255,255,.035)}
      .sportExerciseDetailInfo strong{display:block;font-size:16px}.sportExerciseDetailInfo p{margin:6px 0 0;color:var(--muted);font-size:12px;line-height:1.45}

      /* NUT-014.3 — Bugünkü Antrenman */
      .sportWorkoutShell{display:grid;gap:12px;padding-bottom:calc(112px + env(safe-area-inset-bottom))}
      .sportWorkoutShell[hidden]{display:none!important}
      .sportWorkoutDayPicker{display:grid;gap:9px}
      .sportWorkoutDayButton{width:100%;min-height:64px;display:flex;align-items:center;gap:11px;padding:12px;border:1px solid var(--stroke);border-radius:17px;background:rgba(255,255,255,.035);color:var(--text);font:inherit;text-align:left}
      .sportWorkoutDayButton strong{display:block;font-size:14px}
      .sportWorkoutDayButton small{display:block;margin-top:3px;color:var(--muted);font-size:11px}
      .sportWorkoutExercise{padding:14px;border:1px solid var(--stroke);border-radius:18px;background:rgba(255,255,255,.035)}
      .sportWorkoutExerciseHead{display:flex;align-items:center;gap:10px}
      .sportWorkoutExerciseIndex{width:38px;height:38px;display:grid;place-items:center;flex:0 0 38px;border:1px solid var(--stroke);border-radius:12px;font-weight:900}
      .sportWorkoutExerciseHead strong{display:block;font-size:14px}
      .sportWorkoutExerciseHead small{display:block;margin-top:2px;color:var(--muted);font-size:10px}
      .sportWorkoutFields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:12px}
      .sportWorkoutField{display:grid;gap:5px}
      .sportWorkoutField label{color:var(--muted);font-size:10px;font-weight:800}
      .sportWorkoutField input{width:100%;min-height:42px;padding:8px;border:1px solid var(--stroke);border-radius:12px;background:rgba(255,255,255,.025);color:var(--text);font:inherit;text-align:center}
      .sportWorkoutDone{width:100%;min-height:42px;margin-top:10px;border:1px solid var(--stroke);border-radius:12px;background:rgba(255,255,255,.03);color:var(--text);font:inherit;font-weight:800}
      .sportWorkoutDone[aria-pressed="true"]{background:rgba(255,255,255,.13)}
      .sportWorkoutMeta{text-align:center;color:var(--muted);font-size:11px}

      @media (max-width: 420px) {
        #mealAddPanel {
          padding-bottom: calc(132px + env(safe-area-inset-bottom));
        }

        .todayMealPrimaryCard,
        .todayMealLibraryCard {
          padding: 14px;
        }
      }



      /* NUT-015.2 — Uyku & Toparlanma */
      .sleepTracker {
        display: grid;
        gap: 12px;
        width: 100%;
        max-width: 100%;
        padding-bottom: calc(126px + env(safe-area-inset-bottom));
      }

      .sleepCard {
        width: 100%;
        min-width: 0;
        padding: 15px;
        border: 1px solid var(--stroke);
        border-radius: 20px;
        background: rgba(255,255,255,.03);
      }

      .sleepCardTitle {
        margin: 0 0 11px;
        font-size: 14px;
        text-align: center;
      }

      .sleepTimeGrid {
        display: grid;
        grid-template-columns: repeat(2,minmax(0,1fr));
        gap: 9px;
      }

      .sleepField {
        display: grid;
        gap: 6px;
        min-width: 0;
      }

      .sleepField span {
        color: var(--muted);
        font-size: 10px;
        font-weight: 800;
      }

      .sleepField input,
      .sleepNote {
        width: 100%;
        min-width: 0;
        border: 1px solid var(--stroke);
        border-radius: 14px;
        background: rgba(255,255,255,.025);
        color: var(--text);
        font: inherit;
      }

      .sleepField input {
        min-height: 46px;
        padding: 9px 10px;
        text-align: center;
      }

      .sleepDuration {
        display: grid;
        place-items: center;
        min-height: 62px;
        margin-top: 10px;
        border: 1px solid var(--stroke);
        border-radius: 16px;
        background: rgba(255,255,255,.022);
        text-align: center;
      }

      .sleepDuration strong {
        display: block;
        font-size: 20px;
      }

      .sleepDuration span {
        display: block;
        margin-top: 3px;
        color: var(--muted);
        font-size: 10px;
      }

      .sleepChoiceGrid {
        display: grid;
        grid-template-columns: repeat(3,minmax(0,1fr));
        gap: 8px;
      }

      .sleepChoice {
        min-width: 0;
        min-height: 46px;
        padding: 8px 6px;
        border: 1px solid var(--stroke);
        border-radius: 14px;
        background: rgba(255,255,255,.025);
        color: var(--text);
        font: inherit;
        font-size: 11px;
        font-weight: 800;
      }

      .sleepChoice[aria-pressed="true"] {
        background: rgba(255,255,255,.12);
        border-color: color-mix(in srgb,var(--text) 46%,transparent);
      }

      .sleepNote {
        min-height: 88px;
        resize: vertical;
        padding: 11px 12px;
        line-height: 1.45;
      }

      .sleepSave {
        width: 100%;
        min-height: 52px;
        border: 1px solid var(--text);
        border-radius: 16px;
        background: #f5f7ff;
        color: #0b1323;
        font: inherit;
        font-weight: 900;
      }

      .sleepSave:disabled {
        opacity: .38;
      }

      .sleepSavedSummary {
        display: grid;
        gap: 7px;
        padding: 14px;
        border: 1px solid var(--stroke);
        border-radius: 18px;
        background: rgba(255,255,255,.035);
        text-align: center;
      }

      .sleepSavedSummary[hidden] {
        display: none !important;
      }

      .sleepSavedSummary strong {
        font-size: 15px;
      }

      .sleepSavedSummary span {
        color: var(--muted);
        font-size: 11px;
        line-height: 1.4;
      }

      .sleepStatus {
        min-height: 18px;
        margin: 0;
        color: var(--muted);
        font-size: 10px;
        text-align: center;
      }

      @media (max-width:360px) {
        .sleepTimeGrid {
          grid-template-columns: 1fr;
        }

        .sleepChoice {
          font-size: 10px;
        }
      }

      /* NUT-015.1 — Sağlık ana ekranı */
      .wellnessHub,
      .wellnessSubview {
        width: 100%;
        max-width: 100%;
        min-width: 0;
      }

      .wellnessHub[hidden],
      .wellnessSubview[hidden] {
        display: none !important;
      }

      .wellnessHub {
        display: grid;
        gap: 13px;
        padding-bottom: calc(118px + env(safe-area-inset-bottom));
      }

      .wellnessHubHeader {
        width: 100%;
        padding: 6px 4px 12px;
        text-align: center;
      }

      .wellnessHubMark {
        width: 58px;
        height: 58px;
        display: grid;
        place-items: center;
        margin: 0 auto 12px;
        border: 1px solid var(--stroke);
        border-radius: 19px;
        background: rgba(255,255,255,.04);
      }

      .wellnessHubMark .healthCrescentSvg {
        width: 34px;
        height: 34px;
      }

      .wellnessHubTitle {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        overflow: hidden !important;
        clip: rect(0 0 0 0) !important;
        clip-path: inset(50%) !important;
        white-space: nowrap !important;
      }

      .wellnessHubIntro {
        max-width: 34ch;
        margin: 0 auto;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.45;
      }

      .wellnessHubCards {
        display: grid;
        gap: 11px;
        width: 100%;
      }

      .wellnessHubCard {
        width: 100%;
        min-width: 0;
        min-height: 84px;
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

      .wellnessHubCard:active {
        transform: scale(.992);
      }

      .wellnessHubCardIcon {
        width: 45px;
        height: 45px;
        flex: 0 0 45px;
        display: grid;
        place-items: center;
        border: 1px solid var(--stroke);
        border-radius: 15px;
        background: rgba(255,255,255,.04);
        color: var(--text);
        font-size: 21px;
        font-weight: 900;
        line-height: 1;
      }

      .wellnessHubCardCopy {
        min-width: 0;
        flex: 1;
      }

      .wellnessHubCardCopy strong {
        display: block;
        font-size: 16px;
        line-height: 1.25;
      }

      .wellnessHubCardCopy small {
        display: block;
        margin-top: 4px;
        color: var(--muted);
        font-size: 11px;
        line-height: 1.4;
      }

      .wellnessHistoryButton {
        width: 100%;
        min-height: 58px;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        border: 1px solid var(--stroke);
        border-radius: 18px;
        background: rgba(255,255,255,.022);
        color: var(--text);
        font: inherit;
        text-align: left;
      }

      .wellnessHistoryButton .wellnessHubCardIcon {
        width: 40px;
        height: 40px;
        flex-basis: 40px;
        border-radius: 13px;
        color: var(--muted);
        font-size: 18px;
      }

      .wellnessHistoryButton .wellnessHubCardCopy strong {
        font-size: 14px;
      }

      .wellnessHistoryButton .wellnessHubCardCopy small {
        font-size: 10px;
      }

      .wellnessSubview {
        display: grid;
        gap: 12px;
        padding-bottom: calc(118px + env(safe-area-inset-bottom));
      }

      .wellnessSubviewHeader {
        padding: 7px 4px 13px;
        text-align: center;
      }

      .wellnessSubviewHeader h2 {
        margin: 0;
        font-size: 21px;
      }

      .wellnessSubviewHeader p {
        max-width: 34ch;
        margin: 5px auto 0;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.45;
      }

      .wellnessFoundationCard {
        width: 100%;
        padding: 21px 17px;
        border: 1px solid var(--stroke);
        border-radius: 20px;
        background: rgba(255,255,255,.03);
        text-align: center;
      }

      .wellnessFoundationMark {
        width: 48px;
        height: 48px;
        display: grid;
        place-items: center;
        margin: 0 auto 11px;
        border: 1px solid var(--stroke);
        border-radius: 15px;
        background: rgba(255,255,255,.035);
        font-size: 21px;
      }

      .wellnessFoundationCard strong {
        display: block;
        font-size: 15px;
      }

      .wellnessFoundationCard p {
        max-width: 32ch;
        margin: 7px auto 0;
        color: var(--muted);
        font-size: 11px;
        line-height: 1.5;
      }

      .wellnessFoundationBadge {
        display: inline-flex;
        align-items: center;
        min-height: 29px;
        margin-top: 13px;
        padding: 0 10px;
        border: 1px solid var(--stroke);
        border-radius: 999px;
        color: var(--muted);
        font-size: 10px;
        font-weight: 800;
      }

      @media (max-width:420px) {
        .wellnessHub {
          gap: 10px;
          padding-bottom: calc(126px + env(safe-area-inset-bottom));
        }

        .wellnessHubCard {
          min-height: 80px;
          padding: 13px;
        }
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
      sport: sportActiveSection === "hub"
        ? "Spor"
        : ({program:"Programım",today:"Bugünkü Antrenman",exercises:"Hareketler",progress:"Gelişim"}[sportActiveSection] || "Spor"),
      nutrition: nutritionActiveSection === "hub"
        ? "Beslenme"
        : ({
            meals: "Öğünler",
            water: "Su",
            library: "Kütüphanem",
            history: "Geçmiş"
          }[nutritionActiveSection] || "Beslenme"),
      wellness: wellnessActiveSection === "hub"
        ? "Sağlık"
        : ({
            sleep:"Uyku & Toparlanma",
            energy:"Enerji & Beden",
            symptoms:"Belirtiler & Notlar",
            history:"Geçmiş"
          }[wellnessActiveSection] || "Sağlık")
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

    if (section === "sport") {
      showSportSection("hub", {focus:false});
    }

    if (section === "nutrition") {
      Promise.resolve(window.TodayNutritionUI?.open?.())
        .then(() => renderWaterVisual())
        .catch(() => {});
      Promise.resolve(window.TodayNutritionLibraryUI?.open?.()).catch(() => {});
      showNutritionSection("hub", { focus: false });
    }

    if (section === "wellness") {
      showWellnessSection("hub", {focus:false});
    }

    if (options.focus !== false) {
      const focusTarget =
        section === "hub"
          ? hub?.querySelector(".healthHubTitle")
          : section === "nutrition"
            ? healthView?.querySelector("#healthTitle")
            : section === "wellness"
              ? (wellnessActiveSection === "hub"
                  ? wellnessHub
                  : wellnessPanels[wellnessActiveSection]?.querySelector("h2"))
              : healthView?.querySelector("#healthSportPanelTitle");

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




  function wellnessDayKey(date = new Date()) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0,10);
  }

  function readSleepRecords() {
    try {
      const raw = localStorage.getItem(WELLNESS_SLEEP_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function saveSleepRecord(record) {
    try {
      const records = readSleepRecords();
      const next = records.filter(item => item.dayKey !== record.dayKey);
      next.unshift(record);
      localStorage.setItem(WELLNESS_SLEEP_KEY, JSON.stringify(next.slice(0,180)));
      return true;
    } catch (error) {
      return false;
    }
  }

  function sleepMinutesBetween(bedtime, wakeTime) {
    if (!bedtime || !wakeTime) return null;
    const [bh,bm] = bedtime.split(":").map(Number);
    const [wh,wm] = wakeTime.split(":").map(Number);
    if (![bh,bm,wh,wm].every(Number.isFinite)) return null;
    let start = bh * 60 + bm;
    let end = wh * 60 + wm;
    if (end <= start) end += 24 * 60;
    const minutes = end - start;
    return minutes > 0 && minutes <= 24 * 60 ? minutes : null;
  }

  function formatSleepDuration(minutes) {
    if (!Number.isFinite(minutes) || minutes <= 0) return "—";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (!mins) return `${hours} sa`;
    return `${hours} sa ${mins} dk`;
  }

  function renderSleepPanel(panel) {
    if (!panel) return;
    panel.replaceChildren();

    const header = createElement("header", {className:"wellnessSubviewHeader"});
    header.append(
      createElement("h2", {text:"Uyku & Toparlanma"}),
      createElement("p", {text:"Dün geceyi birkaç dokunuşla kaydet."})
    );

    const tracker = createElement("div", {className:"sleepTracker"});
    const todayKey = wellnessDayKey();
    const existing = readSleepRecords().find(item => item.dayKey === todayKey) || null;

    let quality = existing?.quality || null;
    let recovery = existing?.recovery || null;

    const timeCard = createElement("section", {className:"sleepCard"});
    timeCard.appendChild(createElement("h3", {className:"sleepCardTitle", text:"Uyku zamanı"}));

    const timeGrid = createElement("div", {className:"sleepTimeGrid"});
    const bedtimeLabel = createElement("label", {className:"sleepField"});
    bedtimeLabel.appendChild(createElement("span", {text:"Yatış"}));
    const bedtime = createElement("input", {
      type:"time",
      attributes:{
        value: existing?.bedtime || "",
        "aria-label":"Yaklaşık yatış saati"
      }
    });
    bedtimeLabel.appendChild(bedtime);

    const wakeLabel = createElement("label", {className:"sleepField"});
    wakeLabel.appendChild(createElement("span", {text:"Kalkış"}));
    const wake = createElement("input", {
      type:"time",
      attributes:{
        value: existing?.wakeTime || "",
        "aria-label":"Yaklaşık kalkış saati"
      }
    });
    wakeLabel.appendChild(wake);
    timeGrid.append(bedtimeLabel, wakeLabel);

    const duration = createElement("div", {className:"sleepDuration"});
    const durationValue = createElement("strong", {text:"—"});
    duration.append(
      durationValue,
      createElement("span", {text:"Yaklaşık uyku süresi"})
    );

    const updateDuration = () => {
      const minutes = sleepMinutesBetween(bedtime.value, wake.value);
      durationValue.textContent = formatSleepDuration(minutes);
      updateSaveState();
    };
    bedtime.addEventListener("change", updateDuration);
    wake.addEventListener("change", updateDuration);
    timeCard.append(timeGrid, duration);

    function makeChoiceCard(title, group, values, currentValue, onChange) {
      const card = createElement("section", {className:"sleepCard"});
      card.appendChild(createElement("h3", {className:"sleepCardTitle", text:title}));
      const grid = createElement("div", {className:"sleepChoiceGrid"});
      values.forEach(([value,label]) => {
        const button = createElement("button", {
          className:"sleepChoice",
          type:"button",
          text:label,
          attributes:{
            "data-sleep-group":group,
            "data-sleep-value":value,
            "aria-pressed": value === currentValue ? "true" : "false"
          }
        });
        button.addEventListener("click", () => {
          grid.querySelectorAll(".sleepChoice").forEach(node => {
            node.setAttribute("aria-pressed","false");
          });
          button.setAttribute("aria-pressed","true");
          onChange(value);
          updateSaveState();
        });
        grid.appendChild(button);
      });
      card.appendChild(grid);
      return card;
    }

    const qualityCard = makeChoiceCard(
      "Nasıl uyudun?",
      "quality",
      [["bad","Kötü"],["okay","Orta"],["good","İyi"]],
      quality,
      value => { quality = value; }
    );

    const recoveryCard = makeChoiceCard(
      "Uyandığında nasıl hissettin?",
      "recovery",
      [["low","Dinlenmedim"],["okay","Normal"],["good","Dinlendim"]],
      recovery,
      value => { recovery = value; }
    );

    const noteCard = createElement("section", {className:"sleepCard"});
    noteCard.appendChild(createElement("h3", {className:"sleepCardTitle", text:"Kısa not"}));
    const note = createElement("textarea", {
      className:"sleepNote",
      attributes:{
        maxlength:"240",
        placeholder:"İstersen bir şey ekle…",
        "aria-label":"Uyku kısa notu"
      }
    });
    note.value = existing?.note || "";
    noteCard.appendChild(note);

    const savedSummary = createElement("div", {
      className:"sleepSavedSummary",
      attributes: existing ? {} : {hidden:""}
    });
    const savedTitle = createElement("strong", {text:"Bugünün kaydı var"});
    const savedDetail = createElement("span", {text:""});
    savedSummary.append(savedTitle, savedDetail);

    const status = createElement("p", {className:"sleepStatus", text:""});
    const save = createElement("button", {
      className:"sleepSave",
      type:"button",
      text: existing ? "Kaydı güncelle" : "Kaydet",
      attributes:{disabled:""}
    });

    const qualityLabels = {bad:"Kötü",okay:"Orta",good:"İyi"};
    const recoveryLabels = {low:"Dinlenmedim",okay:"Normal",good:"Dinlendim"};

    const refreshSummary = record => {
      if (!record) {
        savedSummary.hidden = true;
        return;
      }
      savedSummary.hidden = false;
      const durationText = formatSleepDuration(record.durationMinutes);
      savedDetail.textContent =
        `${durationText} · ${qualityLabels[record.quality] || "Kalite yok"} · ${recoveryLabels[record.recovery] || "Toparlanma yok"}`;
    };

    function updateSaveState() {
      const durationMinutes = sleepMinutesBetween(bedtime.value, wake.value);
      const ready = Number.isFinite(durationMinutes) && quality && recovery;
      save.disabled = !ready;
    }

    save.addEventListener("click", () => {
      if (save.disabled) return;
      const durationMinutes = sleepMinutesBetween(bedtime.value, wake.value);
      const record = {
        id: existing?.id || `sleep-${Date.now()}`,
        dayKey: todayKey,
        date: new Date().toISOString(),
        bedtime: bedtime.value,
        wakeTime: wake.value,
        durationMinutes,
        quality,
        recovery,
        note: note.value.trim()
      };

      if (!saveSleepRecord(record)) {
        status.textContent = "Kayıt kaydedilemedi.";
        return;
      }

      refreshSummary(record);
      save.textContent = "✓ Kaydedildi";
      status.textContent = "Bugünün uyku kaydı güncellendi.";
      window.setTimeout(() => {
        save.textContent = "Kaydı güncelle";
      }, 900);
    });

    updateDuration();
    refreshSummary(existing);

    tracker.append(
      savedSummary,
      timeCard,
      qualityCard,
      recoveryCard,
      noteCard,
      save,
      status
    );

    panel.append(header, tracker);
    resetHealthScroll();
  }

  function wellnessCard(section, icon, title, detail, options = {}) {
    const button = createElement("button", {
      className: options.history
        ? "wellnessHistoryButton"
        : "wellnessHubCard",
      type: "button",
      attributes: {
        "data-wellness-open": section,
        "aria-label": `${title} bölümünü aç`
      }
    });

    const iconElement = createElement("span", {
      className: "wellnessHubCardIcon",
      text: icon,
      attributes: {"aria-hidden":"true"}
    });

    const copy = createElement("span", {className:"wellnessHubCardCopy"});
    copy.append(
      createElement("strong", {text:title}),
      createElement("small", {text:detail})
    );

    button.append(
      iconElement,
      copy,
      createElement("span", {
        className:"healthHubArrow",
        text:"›",
        attributes:{"aria-hidden":"true"}
      })
    );
    return button;
  }

  function makeWellnessFoundationPanel(id, title, detail, icon, nextStep) {
    const panel = createElement("section", {
      className:"wellnessSubview",
      id,
      attributes:{hidden:""}
    });

    const header = createElement("header", {className:"wellnessSubviewHeader"});
    header.append(
      createElement("h2", {text:title}),
      createElement("p", {text:detail})
    );

    const card = createElement("div", {className:"wellnessFoundationCard"});
    card.append(
      createElement("div", {
        className:"wellnessFoundationMark",
        text:icon,
        attributes:{"aria-hidden":"true"}
      }),
      createElement("strong", {text:nextStep}),
      createElement("p", {
        text:"Bu alanın navigasyonu NUT-015.1 ile hazırlandı. Veri girişi sonraki Sağlık paketinde bağlanacak."
      }),
      createElement("span", {
        className:"wellnessFoundationBadge",
        text:"Sağlık altyapısı hazır"
      })
    );

    panel.append(header, card);
    return panel;
  }

  function buildWellnessHub() {
    if (!wellnessPanel || wellnessHub) return;
    wellnessPanel.replaceChildren();

    wellnessHub = createElement("section", {
      className:"wellnessHub",
      id:"wellnessHub",
      attributes:{"aria-labelledby":"wellnessHubTitle"}
    });

    const header = createElement("header", {className:"wellnessHubHeader"});
    const mark = createElement("div", {
      className:"wellnessHubMark",
      attributes:{"aria-hidden":"true"}
    });
    mark.appendChild(createCrescentIcon());

    header.append(
      mark,
      createElement("h1", {
        className:"wellnessHubTitle",
        id:"wellnessHubTitle",
        text:"Sağlık"
      }),
      createElement("p", {
        className:"wellnessHubIntro",
        text:"Bugün bedeninde neyi fark ettin?"
      })
    );

    const cards = createElement("div", {className:"wellnessHubCards"});
    cards.append(
      wellnessCard(
        "sleep",
        "☾",
        "Uyku & Toparlanma",
        "Uyku, dinlenme ve toparlanma."
      ),
      wellnessCard(
        "energy",
        "◉",
        "Enerji & Beden",
        "Enerji, yorgunluk ve beden hissi."
      ),
      wellnessCard(
        "symptoms",
        "+",
        "Belirtiler & Notlar",
        "Belirti, ağrı ve beden notları."
      )
    );

    const history = wellnessCard(
      "history",
      "◷",
      "Geçmiş",
      "Önceki sağlık kayıtlarını gör.",
      {history:true}
    );

    wellnessHub.append(header, cards, history);
    wellnessPanel.appendChild(wellnessHub);

    wellnessPanels = {
      sleep: createElement("section", {
        className:"wellnessSubview",
        id:"wellnessSleepPanel",
        attributes:{hidden:""}
      }),
      energy: makeWellnessFoundationPanel(
        "wellnessEnergyPanel",
        "Enerji & Beden",
        "Bugünkü enerji ve beden hissini fark et.",
        "◉",
        "Enerji kaydı NUT-015.3'te geliyor"
      ),
      symptoms: makeWellnessFoundationPanel(
        "wellnessSymptomsPanel",
        "Belirtiler & Notlar",
        "Belirti, ağrı veya beden notunu kaydet.",
        "+",
        "Belirti kaydı NUT-015.4'te geliyor"
      ),
      history: makeWellnessFoundationPanel(
        "wellnessHistoryPanel",
        "Geçmiş",
        "Önceki sağlık kayıtlarını sade biçimde gör.",
        "◷",
        "Sağlık geçmişi NUT-015.5'te geliyor"
      )
    };

    Object.values(wellnessPanels).forEach(panel => {
      wellnessPanel.appendChild(panel);
    });

    renderSleepPanel(wellnessPanels.sleep);

    wellnessPanel.addEventListener("click", event => {
      const button = event.target.closest("[data-wellness-open]");
      if (!button) return;
      showWellnessSection(button.dataset.wellnessOpen);
    });

    showWellnessSection("hub", {focus:false});
  }

  function showWellnessSection(section, options = {}) {
    const valid = ["hub","sleep","energy","symptoms","history"];
    if (!valid.includes(section)) section = "hub";

    wellnessActiveSection = section;

    if (section === "sleep" && wellnessPanels.sleep) {
      renderSleepPanel(wellnessPanels.sleep);
    }

    if (wellnessHub) wellnessHub.hidden = section !== "hub";
    Object.entries(wellnessPanels).forEach(([name,panel]) => {
      if (panel) panel.hidden = name !== section;
    });

    const labels = {
      hub:"Sağlık",
      sleep:"Uyku & Toparlanma",
      energy:"Enerji & Beden",
      symptoms:"Belirtiler & Notlar",
      history:"Geçmiş"
    };

    const pill = healthView?.querySelector(".topbar .pill");
    if (pill && activeSection === "wellness") {
      pill.textContent = labels[section] || "Sağlık";
    }

    resetHealthScroll();

    if (options.focus !== false) {
      const target = section === "hub"
        ? wellnessHub
        : wellnessPanels[section]?.querySelector("h2");

      if (target) {
        target.tabIndex = -1;
        try {
          target.focus({preventScroll:true});
        } catch (error) {
          target.focus();
        }
      }
    }
  }

  function sportCard(section, icon, title, detail) {
    const button = createElement("button", {
      className: "sportHubCard",
      type: "button",
      attributes: {"data-sport-hub-open": section, "aria-label": `${title} bölümünü aç`}
    });
    const iconElement = createElement("span", {
      className: "sportHubCardIcon", text: icon, attributes: {"aria-hidden": "true"}
    });
    const copy = createElement("span", {className: "sportHubCardCopy"});
    copy.append(createElement("strong", {text: title}), createElement("small", {text: detail}));
    button.append(iconElement, copy, createElement("span", {className: "healthHubArrow", text: "›", attributes: {"aria-hidden": "true"}}));
    return button;
  }

  function readSportProgram() {
    try {
      const raw = localStorage.getItem(SPORT_PROGRAM_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function saveSportProgram(program) {
    try {
      localStorage.setItem(SPORT_PROGRAM_KEY, JSON.stringify(program));
      return true;
    } catch (error) {
      return false;
    }
  }

  function sportChoice(group, value, label, multi = false) {
    return createElement("button", {
      className: "sportChoice",
      type: "button",
      text: label,
      attributes: {
        "data-sport-choice-group": group,
        "data-sport-choice-value": value,
        "data-sport-choice-multi": multi ? "true" : "false",
        "aria-pressed": "false"
      }
    });
  }

  function sportSetupStep(title, choices) {
    const section = createElement("section", {className:"sportSetupStep"});
    section.appendChild(createElement("h3", {text:title}));
    const grid = createElement("div", {className:"sportChoiceGrid"});
    choices.forEach(choice => grid.appendChild(choice));
    section.appendChild(grid);
    return section;
  }

  function defaultProgramDays(days, goal = readSportProgram()?.goal || "muscle") {
    const strength = {
      2:[["Tüm Vücut Güç A","5 temel hareket"],["Tüm Vücut Güç B","5 temel hareket"]],
      3:[["İtiş Gücü","5 hareket"],["Çekiş Gücü","5 hareket"],["Alt Vücut Güç","5 hareket"]],
      4:[["Üst Vücut Güç A","5 hareket"],["Alt Vücut Güç A","5 hareket"],["Üst Vücut Güç B","5 hareket"],["Alt Vücut Güç B","5 hareket"]],
      5:[["Göğüs · Triceps Güç","5 hareket"],["Sırt · Biceps Güç","5 hareket"],["Bacak Güç","5 hareket"],["Omuz · Core Güç","5 hareket"],["Tüm Vücut Güç","5 hareket"]]
    };
    const muscle = {
      2:[["Tüm Vücut A","6 hareket"],["Tüm Vücut B","6 hareket"]],
      3:[["Göğüs · Omuz · Triceps","6 hareket"],["Sırt · Biceps","6 hareket"],["Bacak · Core","7 hareket"]],
      4:[["Üst Vücut A","6 hareket"],["Alt Vücut A","6 hareket"],["Üst Vücut B","6 hareket"],["Alt Vücut B","6 hareket"]],
      5:[["Göğüs · Triceps","6 hareket"],["Sırt · Biceps","6 hareket"],["Bacak","7 hareket"],["Omuz · Core","6 hareket"],["Tüm Vücut","6 hareket"]]
    };
    const condition = {
      2:[["Kardiyo · Interval","5 aktivite"],["Kondisyon · Core","6 aktivite"]],
      3:[["Interval Kardiyo","5 aktivite"],["Fonksiyonel Kondisyon","6 aktivite"],["Dayanıklılık Kardiyo","5 aktivite"]],
      4:[["Kısa Interval","5 aktivite"],["Fonksiyonel Devre","6 aktivite"],["Tempo Kardiyo","5 aktivite"],["Core · Mobilite","6 aktivite"]],
      5:[["Interval Kardiyo","5 aktivite"],["Fonksiyonel Devre","6 aktivite"],["Tempo Kardiyo","5 aktivite"],["Core · Mobilite","6 aktivite"],["Aktif Toparlanma","5 aktivite"]]
    };
    const general = {
      2:[["Genel Hareket A","6 aktivite"],["Genel Hareket B","6 aktivite"]],
      3:[["Hareket · Core","6 aktivite"],["Kardiyo · Mobilite","6 aktivite"],["Tüm Vücut","6 aktivite"]],
      4:[["Hareket A","6 aktivite"],["Kardiyo","5 aktivite"],["Hareket B","6 aktivite"],["Mobilite · Core","6 aktivite"]],
      5:[["Hareket A","6 aktivite"],["Kardiyo","5 aktivite"],["Hareket B","6 aktivite"],["Mobilite · Core","6 aktivite"],["Aktif Gün","5 aktivite"]]
    };
    const maps = {strength, muscle, condition, general};
    return (maps[goal] || muscle)[days] || (maps[goal] || muscle)[3];
  }

  const SPORT_EXERCISE_LIBRARY = [
    {id:"bench-press",name:"Bench Press",muscle:"Göğüs",category:"Göğüs",equipment:"Barbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/bench-press.jpg"},
    {id:"incline-dumbbell-press",name:"Incline Dumbbell Press",muscle:"Üst göğüs",category:"Göğüs",equipment:"Dumbbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/incline-dumbbell-press.jpg"},
    {id:"decline-bench-press",name:"Decline Bench Press",muscle:"Alt göğüs",category:"Göğüs",equipment:"Barbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/decline-bench-press.jpg"},
    {id:"cable-fly",name:"Cable Fly",muscle:"Göğüs",category:"Göğüs",equipment:"Cable",type:"strength",goals:["muscle","strength"],image:"./assets/sport/cable-fly.jpg"},
    {id:"push-up",name:"Şınav",muscle:"Göğüs · Triceps",category:"Göğüs",equipment:"Ekipmansız",type:"bodyweight",goals:["muscle","condition","general"],image:"./assets/sport/push-up.jpg"},
    {id:"chest-press",name:"Chest Press",muscle:"Göğüs",category:"Göğüs",equipment:"Makine",type:"strength",goals:["muscle","strength"],image:"./assets/sport/chest-press.jpg"},
    {id:"lat-pulldown",name:"Lat Pulldown",muscle:"Sırt",category:"Sırt",equipment:"Cable",type:"strength",goals:["muscle","strength"],image:"./assets/sport/lat-pulldown.jpg"},
    {id:"barbell-row",name:"Barbell Row",muscle:"Sırt",category:"Sırt",equipment:"Barbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/barbell-row.jpg"},
    {id:"cable-row",name:"Seated Cable Row",muscle:"Sırt",category:"Sırt",equipment:"Cable",type:"strength",goals:["muscle","strength"],image:"./assets/sport/cable-row.jpg"},
    {id:"t-bar-row",name:"T-Bar Row",muscle:"Sırt",category:"Sırt",equipment:"Makine",type:"strength",goals:["muscle","strength"],image:"./assets/sport/t-bar-row.jpg"},
    {id:"straight-arm-pulldown",name:"Straight Arm Pulldown",muscle:"Lat",category:"Sırt",equipment:"Cable",type:"strength",goals:["muscle","strength"],image:"./assets/sport/straight-arm-pulldown.jpg"},
    {id:"pull-up",name:"Pull Up",muscle:"Sırt",category:"Sırt",equipment:"Barfiks",type:"bodyweight",goals:["muscle","strength","general"],image:"./assets/sport/pull-up.jpg"},
    {id:"shoulder-press",name:"Shoulder Press",muscle:"Omuz",category:"Omuz",equipment:"Dumbbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/shoulder-press.jpg"},
    {id:"lateral-raise",name:"Lateral Raise",muscle:"Yan omuz",category:"Omuz",equipment:"Dumbbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/lateral-raise.jpg"},
    {id:"front-raise",name:"Front Raise",muscle:"Ön omuz",category:"Omuz",equipment:"Dumbbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/front-raise.jpg"},
    {id:"rear-delt-fly",name:"Rear Delt Fly",muscle:"Arka omuz",category:"Omuz",equipment:"Dumbbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/rear-delt-fly.jpg"},
    {id:"arnold-press",name:"Arnold Press",muscle:"Omuz",category:"Omuz",equipment:"Dumbbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/arnold-press.jpg"},
    {id:"upright-row",name:"Upright Row",muscle:"Omuz · Trapez",category:"Omuz",equipment:"Barbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/upright-row.jpg"},
    {id:"biceps-curl",name:"Biceps Curl",muscle:"Biceps",category:"Kol",equipment:"Dumbbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/biceps-curl.jpg"},
    {id:"hammer-curl",name:"Hammer Curl",muscle:"Biceps · Ön kol",category:"Kol",equipment:"Dumbbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/hammer-curl.jpg"},
    {id:"triceps-pushdown",name:"Triceps Pushdown",muscle:"Triceps",category:"Kol",equipment:"Cable",type:"strength",goals:["muscle","strength"],image:"./assets/sport/triceps-pushdown.jpg"},
    {id:"skull-crusher",name:"Skull Crusher",muscle:"Triceps",category:"Kol",equipment:"Barbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/skull-crusher.jpg"},
    {id:"concentration-curl",name:"Concentration Curl",muscle:"Biceps",category:"Kol",equipment:"Dumbbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/concentration-curl.jpg"},
    {id:"cable-curl",name:"Cable Curl",muscle:"Biceps",category:"Kol",equipment:"Cable",type:"strength",goals:["muscle","strength"],image:"./assets/sport/cable-curl.jpg"},
    {id:"bodyweight-squat",name:"Squat",muscle:"Bacak · Kalça",category:"Bacak",equipment:"Barbell",type:"strength",goals:["muscle","strength","general"],image:"./assets/sport/bodyweight-squat.jpg"},
    {id:"leg-press",name:"Leg Press",muscle:"Bacak",category:"Bacak",equipment:"Makine",type:"strength",goals:["muscle","strength"],image:"./assets/sport/leg-press.jpg"},
    {id:"deadlift",name:"Romanian Deadlift",muscle:"Arka bacak · Kalça",category:"Bacak",equipment:"Barbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/deadlift.jpg"},
    {id:"leg-extension",name:"Leg Extension",muscle:"Ön bacak",category:"Bacak",equipment:"Makine",type:"strength",goals:["muscle","strength"],image:"./assets/sport/leg-extension.jpg"},
    {id:"leg-curl",name:"Leg Curl",muscle:"Arka bacak",category:"Bacak",equipment:"Makine",type:"strength",goals:["muscle","strength"],image:"./assets/sport/leg-curl.jpg"},
    {id:"calf-raise",name:"Calf Raise",muscle:"Baldır",category:"Bacak",equipment:"Makine",type:"strength",goals:["muscle","strength"],image:"./assets/sport/calf-raise.jpg"},
    {id:"plank",name:"Plank",muscle:"Karın",category:"Karın",equipment:"Ekipmansız",type:"timed",goals:["condition","general"],image:"./assets/sport/plank.jpg"},
    {id:"crunch",name:"Crunch",muscle:"Karın",category:"Karın",equipment:"Ekipmansız",type:"bodyweight",goals:["muscle","general"],image:"./assets/sport/crunch.jpg"},
    {id:"russian-twist",name:"Russian Twist",muscle:"Karın · Oblik",category:"Karın",equipment:"Ekipmansız",type:"bodyweight",goals:["condition","general"],image:"./assets/sport/russian-twist.jpg"},
    {id:"bicycle-crunch",name:"Bicycle Crunch",muscle:"Karın · Oblik",category:"Karın",equipment:"Ekipmansız",type:"bodyweight",goals:["condition","general"],image:"./assets/sport/bicycle-crunch.jpg"},
    {id:"dead-bug",name:"Dead Bug",muscle:"Karın",category:"Karın",equipment:"Ekipmansız",type:"bodyweight",goals:["general"],image:"./assets/sport/dead-bug.jpg"},
    {id:"mountain-climber",name:"Mountain Climber",muscle:"Karın · Kardiyo",category:"Karın",equipment:"Ekipmansız",type:"bodyweight",goals:["condition","general"],image:"./assets/sport/mountain-climber.jpg"},
    {id:"treadmill-run",name:"Koşu Bandı",muscle:"Kardiyo",category:"Kardiyo",equipment:"Koşu bandı",type:"cardio",goals:["condition","general"],image:"./assets/sport/treadmill-run.jpg"},
    {id:"cycling",name:"Bisiklet",muscle:"Kardiyo",category:"Kardiyo",equipment:"Bisiklet",type:"cardio",goals:["condition","general"],image:"./assets/sport/cycling.jpg"},
    {id:"elliptical",name:"Eliptik",muscle:"Kardiyo",category:"Kardiyo",equipment:"Eliptik",type:"cardio",goals:["condition","general"],image:"./assets/sport/elliptical.jpg"},
    {id:"rowing-machine",name:"Kürek Makinesi",muscle:"Kardiyo · Sırt",category:"Kardiyo",equipment:"Kürek ergometresi",type:"cardio",goals:["condition","general"],image:"./assets/sport/rowing-machine.jpg"},
    {id:"jump-rope",name:"İp Atlama",muscle:"Kardiyo",category:"Kardiyo",equipment:"İp",type:"cardio",goals:["condition"],image:"./assets/sport/jump-rope.jpg"},
    {id:"brisk-walk",name:"Tempolu Yürüyüş",muscle:"Kardiyo",category:"Kardiyo",equipment:"Ekipmansız",type:"cardio",goals:["condition","general"],image:"./assets/sport/brisk-walk.jpg"},
    {id:"burpee",name:"Burpee",muscle:"Tüm vücut",category:"Fonksiyonel",equipment:"Ekipmansız",type:"bodyweight",goals:["condition","general"],image:"./assets/sport/burpee.jpg"},
    {id:"kettlebell-swing",name:"Kettlebell Swing",muscle:"Kalça · Arka bacak",category:"Fonksiyonel",equipment:"Kettlebell",type:"functional",goals:["condition","general","strength"],image:"./assets/sport/kettlebell-swing.jpg"},
    {id:"battle-rope",name:"Battle Rope",muscle:"Tüm vücut",category:"Fonksiyonel",equipment:"Battle rope",type:"functional",goals:["condition","general"],image:"./assets/sport/battle-rope.jpg"},
    {id:"medicine-ball-slam",name:"Medicine Ball Slam",muscle:"Tüm vücut",category:"Fonksiyonel",equipment:"Medicine ball",type:"functional",goals:["condition","general"],image:"./assets/sport/medicine-ball-slam.jpg"},
    {id:"farmer-walk",name:"Farmer's Walk",muscle:"Tüm vücut · Kavrama",category:"Fonksiyonel",equipment:"Dumbbell",type:"functional",goals:["condition","general","strength"],image:"./assets/sport/farmer-walk.jpg"},
    {id:"box-jump",name:"Box Jump",muscle:"Bacak · Patlayıcılık",category:"Fonksiyonel",equipment:"Box",type:"functional",goals:["condition","general"],image:"./assets/sport/box-jump.jpg"},
    {id:"cat-cow",name:"Cat Cow",muscle:"Omurga",category:"Mobilite",equipment:"Ekipmansız",type:"mobility",goals:["general","condition"],image:"./assets/sport/cat-cow.jpg"},
    {id:"hip-mobility",name:"Hip Flexor Stretch",muscle:"Kalça",category:"Mobilite",equipment:"Ekipmansız",type:"mobility",goals:["general","condition"],image:"./assets/sport/hip-mobility.jpg"},
    {id:"shoulder-mobility",name:"Shoulder Stretch",muscle:"Omuz",category:"Mobilite",equipment:"Ekipmansız",type:"mobility",goals:["general","condition"],image:"./assets/sport/shoulder-mobility.jpg"},
    {id:"full-stretch",name:"Thoracic Rotation",muscle:"Sırt · Göğüs",category:"Mobilite",equipment:"Ekipmansız",type:"mobility",goals:["general","condition"],image:"./assets/sport/full-stretch.jpg"},
  ];

  const SPORT_EXERCISE_ALIASES = Object.freeze({
    "one-arm-row":"barbell-row",
    "face-pull":"rear-delt-fly",
    "overhead-triceps":"skull-crusher",
    "goblet-squat":"bodyweight-squat",
    "jumping-jack":"burpee",
    "leg-raise":"dead-bug",
    "hanging-leg-raise":"dead-bug",
    "pec-deck-fly":"chest-press",
    "dumbbell-pullover":"cable-fly",
    "shrug":"upright-row"
  });
  function sportLibraryItem(id){
    const resolved=SPORT_EXERCISE_ALIASES[id]||id;
    return SPORT_EXERCISE_LIBRARY.find(item=>item.id===resolved)||null;
  }
  function exerciseIdFromName(name){
    const n=String(name||"").toLowerCase();
    return SPORT_EXERCISE_LIBRARY.find(item=>item.name.toLowerCase()===n)?.id||null;
  }

  function sportExerciseTemplates(dayTitle) {
    const name = String(dayTitle || "");
    if (name.includes("Göğüs") || name.includes("Üst Vücut")) {
      return [
        ["Chest Press","Göğüs","3","10"],
        ["Lat Pulldown","Sırt","3","10"],
        ["Shoulder Press","Omuz","3","10"],
        ["Seated Cable Row","Sırt","3","12"],
        ["Triceps Pushdown","Triceps","3","12"],
        ["Biceps Curl","Biceps","3","12"]
      ];
    }
    if (name.includes("Sırt")) {
      return [
        ["Lat Pulldown","Sırt","3","10"],
        ["Seated Cable Row","Sırt","3","10"],
        ["T-Bar Row","Sırt","3","10"],
        ["Face Pull","Arka omuz","3","12"],
        ["Biceps Curl","Biceps","3","12"],
        ["Hammer Curl","Biceps","3","12"]
      ];
    }
    if (name.includes("Bacak") || name.includes("Alt Vücut")) {
      return [
        ["Leg Press","Bacak","3","10"],
        ["Leg Curl","Arka bacak","3","12"],
        ["Leg Extension","Ön bacak","3","12"],
        ["Calf Raise","Baldır","3","15"],
        ["Hip Hinge","Kalça","3","10"],
        ["Core","Core","3","12"]
      ];
    }
    return [
      ["Leg Press","Bacak","3","10"],
      ["Chest Press","Göğüs","3","10"],
      ["Lat Pulldown","Sırt","3","10"],
      ["Shoulder Press","Omuz","3","10"],
      ["Leg Curl","Arka bacak","3","12"],
      ["Core","Core","3","12"]
    ];
  }

  function readWorkoutLogs() {
    try {
      const raw = localStorage.getItem(SPORT_WORKOUT_LOG_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function saveWorkoutLog(log) {
    try {
      const logs = readWorkoutLogs();
      logs.unshift(log);
      localStorage.setItem(SPORT_WORKOUT_LOG_KEY, JSON.stringify(logs.slice(0,100)));
      return true;
    } catch (error) {
      return false;
    }
  }

  function openSportWorkoutDay(dayIndex) {
    const panel = sportPanels.today;
    const program = readSportProgram();
    if (!panel || !program) return;

    const days = defaultProgramDays(Number(program.days), program.goal);
    const day = days[dayIndex] || days[0];
    const settings = daySettings(dayIndex,day[0]);
    panel.replaceChildren();

    const header = createElement("header",{className:"sportSubviewHeader"});
    header.append(
      createElement("h2",{text:`${dayIndex + 1}. Gün`}),
      createElement("p",{text:settings.title})
    );

    const shell = createElement("div",{className:"sportWorkoutShell"});
    const startedAt = Date.now();

    const workoutExercises = exerciseIdsForDay(dayIndex,day[0])
      .map(id=>sportLibraryItem(id))
      .filter(Boolean);

    workoutExercises.forEach((libraryExercise,index) => {
      const defaults=exerciseDefaults(dayIndex,libraryExercise.id);
      const exercise=[libraryExercise.name,libraryExercise.muscle,String(defaults.sets),String(defaults.reps)];
      const card = createElement("section",{
        className:"sportWorkoutExercise",
        attributes:{"data-workout-exercise":String(index),"data-exercise-id":libraryExercise.id}
      });
      const head = createElement("div",{className:"sportWorkoutExerciseHead"});
      const copy = createElement("span");
      copy.append(
        createElement("strong",{text:exercise[0]}),
        createElement("small",{text:exercise[1]})
      );
      head.append(
        createElement("span",{className:"sportWorkoutExerciseIndex",text:String(index+1)}),
        copy
      );

      const fields = createElement("div",{className:"sportWorkoutFields"});
      [["set",exercise[2],"Set"],["reps",exercise[3],"Tekrar"],["kg","","Kg"]].forEach(([key,value,label]) => {
        const wrap = createElement("div",{className:"sportWorkoutField"});
        const input = createElement("input",{
          type:"number",
          attributes:{
            min:"0",
            inputmode:"decimal",
            "data-workout-field":key,
            value
          }
        });
        wrap.append(createElement("label",{text:label}),input);
        fields.appendChild(wrap);
      });

      const done = createElement("button",{
        className:"sportWorkoutDone",
        type:"button",
        text:"Tamamlandı",
        attributes:{"aria-pressed":"false"}
      });
      done.addEventListener("click",() => {
        const pressed = done.getAttribute("aria-pressed") === "true";
        done.setAttribute("aria-pressed",pressed ? "false" : "true");
        done.textContent = pressed ? "Tamamlandı" : "✓ Tamamlandı";
      });

      card.append(head,fields,done);
      shell.appendChild(card);
    });

    const finish = createElement("button",{
      className:"sportPrimaryAction",
      type:"button",
      text:"Antrenmanı bitir"
    });
    finish.addEventListener("click",() => {
      const exercises = Array.from(shell.querySelectorAll("[data-workout-exercise]")).map((card,index) => {
        const exerciseId = card.dataset.exerciseId;
        const template = sportLibraryItem(exerciseId);
        const get = key => card.querySelector(`[data-workout-field="${key}"]`)?.value || "";
        return {
          exerciseId:exerciseId || `sport-exercise-${dayIndex}-${index}`,
          name:template?.name || "Hareket",
          muscle:template?.muscle || "",
          image:template?.image || null,
          sets:Number(get("set")) || 0,
          reps:Number(get("reps")) || 0,
          kg:Number(get("kg")) || 0,
          completed:card.querySelector(".sportWorkoutDone")?.getAttribute("aria-pressed") === "true"
        };
      });

      saveWorkoutLog({
        id:`workout-${Date.now()}`,
        date:new Date().toISOString(),
        dayIndex,
        dayTitle:settings.title,
        durationMinutes:Math.max(1,Math.round((Date.now()-startedAt)/60000)),
        exercises
      });
      renderSportProgress(sportPanels.progress);

      finish.textContent = "✓ Kaydedildi";
      setTimeout(() => {
        buildTodayWorkoutUI(panel,true);
        resetHealthScroll();
      },350);
    });

    shell.append(
      createElement("p",{className:"sportWorkoutMeta",text:"Set, tekrar ve ağırlık bilgilerini ihtiyacın kadar doldur."}),
      finish
    );
    panel.append(header,shell);
    resetHealthScroll();
  }

  function readSportDaySettings(){try{const raw=localStorage.getItem(SPORT_DAY_SETTINGS_KEY);const p=raw?JSON.parse(raw):{};return p&&typeof p==="object"?p:{}}catch(e){return {}}}
  function saveSportDaySettings(data){try{localStorage.setItem(SPORT_DAY_SETTINGS_KEY,JSON.stringify(data));return true}catch(e){return false}}
  function daySettings(dayIndex,fallbackTitle){const all=readSportDaySettings(),c=all[String(dayIndex)]||{};return {title:c.title||fallbackTitle,exercises:c.exercises&&typeof c.exercises==="object"?c.exercises:{}}}
  function updateDaySettings(dayIndex,patch){const all=readSportDaySettings(),key=String(dayIndex);all[key]={...(all[key]||{}),...patch};saveSportDaySettings(all)}
  function exerciseDefaults(dayIndex,exerciseId){const item=readSportDaySettings()[String(dayIndex)]?.exercises?.[exerciseId]||{};return {sets:Number(item.sets)||3,reps:Number(item.reps)||10}}
  function updateExerciseDefaults(dayIndex,exerciseId,patch){const all=readSportDaySettings(),key=String(dayIndex);all[key]=all[key]||{};all[key].exercises=all[key].exercises||{};all[key].exercises[exerciseId]={...(all[key].exercises[exerciseId]||{}),...patch};saveSportDaySettings(all)}

  function readSportCustomDays() {
    try {
      const raw=localStorage.getItem(SPORT_CUSTOM_DAYS_KEY);
      const parsed=raw?JSON.parse(raw):{};
      return parsed && typeof parsed==="object" ? parsed : {};
    } catch(error) { return {}; }
  }

  function saveSportCustomDays(data) {
    try {
      localStorage.setItem(SPORT_CUSTOM_DAYS_KEY,JSON.stringify(data));
      return true;
    } catch(error) { return false; }
  }

  function defaultExerciseIdsForDay(dayTitle) {
    const goal = readSportProgram()?.goal || "muscle";
    const byGoal = {
      condition:["treadmill-run","cycling","jump-rope","burpee","mountain-climber","plank"],
      general:["brisk-walk","bodyweight-squat","push-up","dead-bug","hip-mobility","full-stretch"]
    };
    if (byGoal[goal]) return byGoal[goal].slice();
    return sportExerciseTemplates(dayTitle).map(item=>exerciseIdFromName(item[0])).filter(Boolean);
  }

  function exerciseIdsForDay(dayIndex,dayTitle) {
    const custom=readSportCustomDays();
    const key=String(dayIndex);
    return Array.isArray(custom[key]) ? custom[key] : defaultExerciseIdsForDay(dayTitle);
  }

  function setExerciseIdsForDay(dayIndex,ids) {
    const custom=readSportCustomDays();
    custom[String(dayIndex)]=Array.from(new Set(ids));
    saveSportCustomDays(custom);
  }

  function renderSportProgramDayEditor(panel,dayIndex) {
    const program=readSportProgram();if(!panel||!program)return;
    const days=defaultProgramDays(Number(program.days), program.goal),day=days[dayIndex]||days[0],settings=daySettings(dayIndex,day[0]);panel.replaceChildren();
    const header=createElement("header",{className:"sportSubviewHeader"});header.append(createElement("h2",{text:`${dayIndex+1}. Gün`}),createElement("p",{text:settings.title}));
    const editor=createElement("div",{className:"sportProgramDayEditor"});
    const titleEditor=createElement("div",{className:"sportDayTitleEditor"}),titleInput=createElement("input",{className:"sportDayTitleInput",type:"text",attributes:{value:settings.title,maxlength:"48","aria-label":"Program günü adı"}}),titleSave=createElement("button",{className:"sportDayTitleSave",type:"button",text:"Kaydet"});
    titleSave.addEventListener("click",()=>{updateDaySettings(dayIndex,{title:titleInput.value.trim()||day[0]});renderSportProgramDayEditor(panel,dayIndex)});titleEditor.append(titleInput,titleSave);
    const list=createElement("div",{className:"sportProgramExerciseList"}),ids=exerciseIdsForDay(dayIndex,day[0]);
    if(!ids.length){const empty=createElement("div",{className:"sportProgressEmpty"});empty.append(createElement("strong",{text:"Bu güne hareket eklenmedi"}),createElement("p",{text:"Görsel kütüphaneden istediğin hareketleri ekleyebilirsin."}));list.appendChild(empty)}
    else ids.forEach((id,index)=>{const item=sportLibraryItem(id);if(!item)return;const d=exerciseDefaults(dayIndex,id),row=createElement("div",{className:"sportProgramExerciseRow"}),thumb=createElement("div",{className:"sportProgramExerciseThumb"}),img=document.createElement("img");img.src=item.image;img.alt="";thumb.appendChild(img);
      const body=createElement("div",{className:"sportProgramExerciseCopy"});body.append(createElement("strong",{text:item.name}),createElement("small",{text:`${item.muscle} · ${item.equipment}`}));
      const controls=createElement("div",{className:"sportProgramExerciseControls"});[["sets","Set",d.sets],["reps","Tekrar",d.reps]].forEach(([key,label,value])=>{const w=createElement("div",{className:"sportProgramExerciseField"}),input=createElement("input",{type:"number",attributes:{min:"1",max:"99",value:String(value),inputmode:"numeric"}});input.addEventListener("change",()=>{updateExerciseDefaults(dayIndex,id,{[key]:Math.max(1,Number(input.value)||1)});buildTodayWorkoutUI(sportPanels.today,true)});w.append(createElement("label",{text:label}),input);controls.appendChild(w)});body.appendChild(controls);
      const side=createElement("div"),moves=createElement("div",{className:"sportProgramMoveButtons"}),up=createElement("button",{className:"sportProgramMove",type:"button",text:"↑"}),down=createElement("button",{className:"sportProgramMove",type:"button",text:"↓"});up.disabled=index===0;down.disabled=index===ids.length-1;
      up.addEventListener("click",()=>{const n=[...ids];[n[index-1],n[index]]=[n[index],n[index-1]];setExerciseIdsForDay(dayIndex,n);renderSportProgramDayEditor(panel,dayIndex);buildTodayWorkoutUI(sportPanels.today,true)});
      down.addEventListener("click",()=>{const n=[...ids];[n[index+1],n[index]]=[n[index],n[index+1]];setExerciseIdsForDay(dayIndex,n);renderSportProgramDayEditor(panel,dayIndex);buildTodayWorkoutUI(sportPanels.today,true)});moves.append(up,down);
      const remove=createElement("button",{className:"sportProgramRemove",type:"button",text:"×"});remove.addEventListener("click",()=>{setExerciseIdsForDay(dayIndex,exerciseIdsForDay(dayIndex,day[0]).filter(x=>x!==id));renderSportProgramDayEditor(panel,dayIndex);buildTodayWorkoutUI(sportPanels.today,true)});side.append(moves,remove);row.append(thumb,body,side);list.appendChild(row)});
    const actions=createElement("div",{className:"sportProgramEditorActions"}),add=createElement("button",{className:"sportPrimaryAction",type:"button",text:"Hareket ekle"}),workout=createElement("button",{className:"sportSecondaryAction",type:"button",text:"Bu antrenmanı aç"}),back=createElement("button",{className:"sportSecondaryAction",type:"button",text:"Programıma dön"});
    add.addEventListener("click",()=>renderSportLibrarySelector(panel,dayIndex,"Tümü"));workout.addEventListener("click",()=>{showSportSection("today",{focus:false});openSportWorkoutDay(dayIndex)});back.addEventListener("click",()=>{
      panel.replaceChildren();
      panel.dataset.programReady="false";
      buildSportProgramUI(panel);
      const freshSetup=panel.querySelector("#sportProgramSetup");
      const freshSummary=panel.querySelector("#sportProgramSummary");
      if(freshSummary) freshSummary.hidden=true;
      if(freshSetup) freshSetup.hidden=false;
      sportProgramDraft={goal:null,level:null,days:null,duration:null,location:null,equipment:[]};
      resetHealthScroll();
    });actions.append(add,workout,back);editor.append(titleEditor,list,actions);panel.append(header,editor);resetHealthScroll();
  }

  function renderSportLibrarySelector(panel,dayIndex,activeCategory="Tümü") {
    const program=readSportProgram(); if(!program)return;
    const days=defaultProgramDays(Number(program.days), program.goal); const day=days[dayIndex]||days[0];
    panel.replaceChildren();
    const header=createElement("header",{className:"sportSubviewHeader"});
    header.append(createElement("h2",{text:"Hareket ekle"}),createElement("p",{text:`${dayIndex+1}. Gün · ${day[0]}`}));
    const filters=createElement("div",{className:"sportLibraryFilters"});
    ["Tümü","Göğüs","Sırt","Omuz","Kol","Bacak","Karın","Kardiyo","Fonksiyonel","Mobilite"].forEach(category=>{
      const b=createElement("button",{className:"sportLibraryFilter",type:"button",text:category,attributes:{"aria-pressed":category===activeCategory?"true":"false"}});
      b.addEventListener("click",()=>renderSportLibrarySelector(panel,dayIndex,category));filters.appendChild(b);
    });
    const selected=new Set(exerciseIdsForDay(dayIndex,day[0]));
    const grid=createElement("div",{className:"sportLibraryGrid"});
    SPORT_EXERCISE_LIBRARY.filter(item=>activeCategory==="Tümü"||item.category===activeCategory).forEach(item=>{
      const card=createElement("button",{className:"sportLibraryCard sportLibrarySelectCard",type:"button"});
      const visual=createElement("span",{className:"sportLibraryVisual"});if(item.image){const img=document.createElement("img");img.src=item.image;img.alt=`${item.name} hareket görseli`;visual.appendChild(img)}else{visual.appendChild(createElement("span",{text:item.icon||"●",attributes:{"aria-hidden":"true"}}))}
      const badge=createElement("span",{className:"sportLibraryAddBadge",text:selected.has(item.id)?"✓":"+"});
      visual.appendChild(badge);
      const copy=createElement("span",{className:"sportLibraryCopy"});copy.append(createElement("strong",{text:item.name}),createElement("small",{text:`${item.muscle} · ${item.equipment}`}));
      card.append(visual,copy);
      card.addEventListener("click",()=>{
        const ids=exerciseIdsForDay(dayIndex,day[0]);
        if(ids.includes(item.id)) setExerciseIdsForDay(dayIndex,ids.filter(x=>x!==item.id));
        else setExerciseIdsForDay(dayIndex,[...ids,item.id]);
        renderSportLibrarySelector(panel,dayIndex,activeCategory);
        buildTodayWorkoutUI(sportPanels.today,true);
      });
      grid.appendChild(card);
    });
    const done=createElement("button",{className:"sportPrimaryAction",type:"button",text:"Bitti"});
    done.addEventListener("click",()=>renderSportProgramDayEditor(panel,dayIndex));
    const wrap=createElement("div",{className:"sportProgramEditorActions"});wrap.appendChild(done);
    panel.append(header,filters,grid,wrap);resetHealthScroll();
  }

  function sportDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return {short:"—",long:"Tarih yok"};
    return {
      short: new Intl.DateTimeFormat("tr-TR",{day:"2-digit",month:"short"}).format(date),
      long: new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"long",year:"numeric"}).format(date)
    };
  }

  function startOfCurrentWeek() {
    const now = new Date();
    const day = (now.getDay() + 6) % 7;
    const start = new Date(now);
    start.setHours(0,0,0,0);
    start.setDate(start.getDate() - day);
    return start.getTime();
  }

  function renderSportProgress(panel) {
    if (!panel) return;
    panel.replaceChildren();

    const header = createElement("header",{className:"sportSubviewHeader"});
    header.append(
      createElement("h2",{text:"Gelişim"}),
      createElement("p",{text:"Yaptığın antrenmanları sade biçimde gör."})
    );

    const shell = createElement("div",{className:"sportProgressShell"});
    const logs = readWorkoutLogs()
      .slice()
      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const weekStart = startOfCurrentWeek();
    const thisWeek = logs.filter(log => new Date(log.date).getTime() >= weekStart).length;
    const last = logs[0] || null;

    const stats = createElement("div",{className:"sportProgressStats"});
    [
      [String(logs.length),"Toplam"],
      [String(thisWeek),"Bu hafta"],
      [last ? sportDate(last.date).short : "—","Son antrenman"]
    ].forEach(([value,label]) => {
      const stat = createElement("div",{className:"sportProgressStat"});
      stat.append(createElement("strong",{text:value}),createElement("span",{text:label}));
      stats.appendChild(stat);
    });
    shell.appendChild(stats);

    if (!logs.length) {
      const empty = createElement("div",{className:"sportProgressEmpty"});
      empty.append(
        createElement("strong",{text:"Henüz antrenman kaydı yok"}),
        createElement("p",{text:"Bugünkü Antrenman bölümünden ilk antrenmanını bitirdiğinde geçmişin burada oluşacak."})
      );
      const go = createElement("button",{className:"sportPrimaryAction",type:"button",text:"Bugünkü Antrenman"});
      go.addEventListener("click",()=>showSportSection("today"));
      shell.append(empty,go);
    } else {
      shell.appendChild(createElement("h3",{className:"sportProgressSectionTitle",text:"Antrenman Geçmişi"}));
      const list = createElement("div",{className:"sportHistoryList"});
      logs.forEach(log => {
        const completed = Array.isArray(log.exercises) ? log.exercises.filter(x=>x.completed).length : 0;
        const total = Array.isArray(log.exercises) ? log.exercises.length : 0;
        const card = createElement("button",{className:"sportHistoryCard",type:"button"});
        card.append(
          createElement("span",{className:"sportHistoryDate",text:sportDate(log.date).short}),
          (() => {
            const copy=createElement("span",{className:"sportHistoryCopy"});
            copy.append(
              createElement("strong",{text:log.dayTitle || "Antrenman"}),
              createElement("small",{text:`${completed}/${total} hareket · ${Number(log.durationMinutes)||0} dk`})
            );
            return copy;
          })(),
          createElement("span",{className:"healthHubArrow",text:"›",attributes:{"aria-hidden":"true"}})
        );
        card.addEventListener("click",()=>renderSportHistoryDetail(panel,log));
        list.appendChild(card);
      });
      shell.appendChild(list);
    }

    panel.append(header,shell);
    resetHealthScroll();
  }

  function renderSportHistoryDetail(panel,log) {
    if (!panel) return;
    panel.replaceChildren();

    const header=createElement("header",{className:"sportSubviewHeader"});
    header.append(
      createElement("h2",{text:log.dayTitle || "Antrenman"}),
      createElement("p",{text:sportDate(log.date).long})
    );

    const detail=createElement("div",{className:"sportHistoryDetail"});
    const exercises=Array.isArray(log.exercises)?log.exercises:[];
    const completed=exercises.filter(x=>x.completed).length;

    const summary=createElement("div",{className:"sportHistorySummary"});
    summary.append(
      createElement("strong",{text:`${completed}/${exercises.length} hareket tamamlandı`}),
      createElement("span",{text:`${Number(log.durationMinutes)||0} dakika`})
    );
    detail.appendChild(summary);

    exercises.forEach(exercise=>{
      const row=createElement("div",{className:"sportHistoryExercise"});
      const visual=createElement("div",{className:"sportHistoryExerciseVisual"});
      if(exercise.image){
        const img=document.createElement("img");
        img.src=exercise.image;
        img.alt="";
        visual.appendChild(img);
      } else {
        visual.appendChild(createElement("span",{text:exercise.completed?"✓":"·"}));
      }
      const copy=createElement("div",{className:"sportHistoryExerciseCopy"});
      const kg=Number(exercise.kg)||0;
      copy.append(
        createElement("strong",{text:exercise.name || "Hareket"}),
        createElement("small",{text:`${Number(exercise.sets)||0} set × ${Number(exercise.reps)||0} tekrar${kg ? ` · ${kg} kg` : ""}${exercise.completed ? " · Tamamlandı" : ""}`})
      );
      row.append(visual,copy);
      detail.appendChild(row);
    });

    const back=createElement("button",{className:"sportSecondaryAction",type:"button",text:"Geçmişe dön"});
    back.addEventListener("click",()=>renderSportProgress(panel));
    detail.appendChild(back);

    panel.append(header,detail);
    resetHealthScroll();
  }

  function renderSportLibrary(panel,activeCategory="Tümü"){
    if(!panel)return; panel.replaceChildren();
    const header=createElement("header",{className:"sportSubviewHeader"});
    header.append(createElement("h2",{text:"Hareketler"}),createElement("p",{text:"Hareketi ve ekipmanı görerek seç."}));
    const filters=createElement("div",{className:"sportLibraryFilters"});
    ["Tümü","Göğüs","Sırt","Omuz","Kol","Bacak","Karın","Kardiyo","Fonksiyonel","Mobilite"].forEach(category=>{
      const b=createElement("button",{className:"sportLibraryFilter",type:"button",text:category,attributes:{"aria-pressed":category===activeCategory?"true":"false"}});
      b.addEventListener("click",()=>renderSportLibrary(panel,category));filters.appendChild(b);
    });
    const grid=createElement("div",{className:"sportLibraryGrid"});
    SPORT_EXERCISE_LIBRARY.filter(item=>activeCategory==="Tümü"||item.category===activeCategory).forEach(item=>{
      const card=createElement("button",{className:"sportLibraryCard",type:"button"});
      const visual=createElement("span",{className:"sportLibraryVisual"});if(item.image){const img=document.createElement("img");img.src=item.image;img.alt=`${item.name} hareket görseli`;visual.appendChild(img)}else{visual.appendChild(createElement("span",{text:item.icon||"●",attributes:{"aria-hidden":"true"}}))}
      const copy=createElement("span",{className:"sportLibraryCopy"});copy.append(createElement("strong",{text:item.name}),createElement("small",{text:`${item.muscle} · ${item.equipment}`}));
      card.append(visual,copy);card.addEventListener("click",()=>renderSportExerciseDetail(panel,item));grid.appendChild(card);
    });
    panel.append(header,filters,grid);resetHealthScroll();
  }
  function renderSportExerciseDetail(panel,item){
    panel.replaceChildren();const header=createElement("header",{className:"sportSubviewHeader"});header.append(createElement("h2",{text:item.name}),createElement("p",{text:`${item.muscle} · ${item.equipment}`}));
    const detail=createElement("div",{className:"sportExerciseDetail"});const visual=createElement("div",{className:"sportExerciseDetailVisual"});if(item.image){const img=document.createElement("img");img.src=item.image;img.alt=`${item.name} hareket görseli`;visual.appendChild(img)}else{visual.appendChild(createElement("span",{text:item.icon||"●",attributes:{"aria-hidden":"true"}}))}
    const info=createElement("div",{className:"sportExerciseDetailInfo"});info.append(createElement("strong",{text:"Hareket özeti"}),createElement("p",{text:`${item.muscle} odaklı bu hareketi kontrollü tempo ve rahat hareket açıklığında uygula. Ekipman: ${item.equipment}.`}));
    const back=createElement("button",{className:"sportSecondaryAction",type:"button",text:"Hareketlere dön"});back.addEventListener("click",()=>renderSportLibrary(panel,"Tümü"));
    detail.append(visual,info,back);panel.append(header,detail);resetHealthScroll();
  }

  function buildTodayWorkoutUI(panel, force = false) {
    if (!panel) return;
    if (panel.dataset.todayReady === "true" && !force) return;
    panel.dataset.todayReady = "true";
    panel.replaceChildren();

    const header = createElement("header",{className:"sportSubviewHeader"});
    header.append(
      createElement("h2",{text:"Bugünkü Antrenman"}),
      createElement("p",{text:"Programından bir gün seç ve antrenmana başla."})
    );

    const program = readSportProgram();
    const shell = createElement("div",{className:"sportWorkoutShell"});

    if (!program) {
      const card = createElement("div",{className:"sportFoundationCard"});
      card.append(
        createElement("strong",{text:"Önce programını oluştur"}),
        createElement("p",{text:"Programım bölümünde birkaç seçim yaptıktan sonra antrenman günlerin burada görünecek."})
      );
      const go = createElement("button",{className:"sportPrimaryAction",type:"button",text:"Programım'a git"});
      go.addEventListener("click",() => showSportSection("program"));
      shell.append(card,go);
    } else {
      const picker = createElement("div",{className:"sportWorkoutDayPicker"});
      defaultProgramDays(Number(program.days), program.goal).forEach((day,index) => {
        const currentSettings=daySettings(index,day[0]),currentIds=exerciseIdsForDay(index,day[0]);
        const button = createElement("button",{
          className:"sportWorkoutDayButton",
          type:"button"
        });
        const copy = createElement("span",{className:"sportDayCopy"});
        copy.append(
          createElement("strong",{text:`${index+1}. Gün · ${day[0]}`}),
          createElement("small",{text:day[1]})
        );
        button.append(
          createElement("span",{className:"sportDayNumber",text:String(index+1)}),
          copy,
          createElement("span",{className:"healthHubArrow",text:"›",attributes:{"aria-hidden":"true"}})
        );
        button.addEventListener("click",() => openSportWorkoutDay(index));
        picker.appendChild(button);
      });
      shell.appendChild(picker);
    }

    panel.append(header,shell);
  }

  function buildSportProgramUI(panel) {
    if (!panel || panel.dataset.programReady === "true") return;
    panel.dataset.programReady = "true";
    panel.replaceChildren();

    const header = createElement("header", {className:"sportSubviewHeader"});
    header.append(
      createElement("h2", {text:"Programım"}),
      createElement("p", {text:"Sana uygun temel program yapısını birkaç seçimle kur."})
    );

    const setup = createElement("div", {
      className:"sportProgramSetup",
      id:"sportProgramSetup"
    });

    setup.append(
      sportSetupStep("Hedefin ne?", [
        sportChoice("goal","muscle","Kas geliştirme"),
        sportChoice("goal","strength","Güç"),
        sportChoice("goal","condition","Form & kondisyon"),
        sportChoice("goal","general","Genel hareket")
      ]),
      sportSetupStep("Seviyen?", [
        sportChoice("level","beginner","Başlangıç"),
        sportChoice("level","intermediate","Orta"),
        sportChoice("level","advanced","İleri")
      ]),
      sportSetupStep("Haftada kaç gün?", [
        sportChoice("days","2","2 gün"),
        sportChoice("days","3","3 gün"),
        sportChoice("days","4","4 gün"),
        sportChoice("days","5","5 gün")
      ]),
      sportSetupStep("Antrenman süresi?", [
        sportChoice("duration","30","30 dk"),
        sportChoice("duration","45","45 dk"),
        sportChoice("duration","60","60 dk"),
        sportChoice("duration","75","75+ dk")
      ]),
      sportSetupStep("Nerede çalışıyorsun?", [
        sportChoice("location","gym","Spor salonu"),
        sportChoice("location","home","Ev"),
        sportChoice("location","mixed","Karma")
      ])
    );

    const equipmentStep = sportSetupStep("Ekipman", [
      sportChoice("equipment","machines","Makineler",true),
      sportChoice("equipment","dumbbell","Dumbbell",true),
      sportChoice("equipment","barbell","Barbell",true),
      sportChoice("equipment","cable","Cable",true),
      sportChoice("equipment","cardio","Cardio",true)
    ]);
    equipmentStep.classList.add("sportEquipmentChoices");
    equipmentStep.hidden = true;
    setup.appendChild(equipmentStep);

    const actions = createElement("div", {className:"sportSetupActions"});
    const createButton = createElement("button", {
      className:"sportPrimaryAction",
      id:"btnCreateSportProgram",
      type:"button",
      text:"Programı oluştur",
      attributes:{disabled:""}
    });
    actions.appendChild(createButton);
    setup.appendChild(actions);

    const summary = createElement("div", {
      className:"sportProgramSummary",
      id:"sportProgramSummary",
      attributes:{hidden:""}
    });

    panel.append(header, setup, summary);

    sportProgramDraft = {
      goal:null, level:null, days:null, duration:null, location:null, equipment:[]
    };

    function updateCreateState() {
      const ready = sportProgramDraft.goal &&
        sportProgramDraft.level &&
        sportProgramDraft.days &&
        sportProgramDraft.duration &&
        sportProgramDraft.location;
      createButton.disabled = !ready;
      equipmentStep.hidden = !["gym","mixed"].includes(sportProgramDraft.location);
    }

    setup.addEventListener("click", event => {
      const button = event.target.closest("[data-sport-choice-group]");
      if (!button) return;
      const group = button.dataset.sportChoiceGroup;
      const value = button.dataset.sportChoiceValue;
      const multi = button.dataset.sportChoiceMulti === "true";

      if (multi) {
        const selected = new Set(sportProgramDraft[group] || []);
        if (selected.has(value)) selected.delete(value);
        else selected.add(value);
        sportProgramDraft[group] = Array.from(selected);
        button.setAttribute("aria-pressed", selected.has(value) ? "true" : "false");
      } else {
        setup.querySelectorAll(`[data-sport-choice-group="${group}"]`)
          .forEach(node => node.setAttribute("aria-pressed","false"));
        button.setAttribute("aria-pressed","true");
        sportProgramDraft[group] = value;
        if (group === "location" && value === "home") {
          sportProgramDraft.equipment = [];
          equipmentStep.querySelectorAll("[aria-pressed='true']")
            .forEach(node => node.setAttribute("aria-pressed","false"));
        }
      }
      updateCreateState();
    });

    createButton.addEventListener("click", () => {
      if (createButton.disabled) return;
      const program = {
        ...sportProgramDraft,
        days:Number(sportProgramDraft.days),
        duration:Number(sportProgramDraft.duration),
        createdAt:new Date().toISOString()
      };
      saveSportProgram(program);
      renderSportProgram(panel, program);
      buildTodayWorkoutUI(sportPanels.today, true);
    });

    const existing = readSportProgram();
    if (existing) renderSportProgram(panel, existing);
  }

  function renderSportProgram(panel, program) {
    const setup = panel.querySelector("#sportProgramSetup");
    const summary = panel.querySelector("#sportProgramSummary");
    if (!summary) return;

    if (setup) setup.hidden = true;
    summary.hidden = false;
    summary.replaceChildren();

    const goalLabels = {
      muscle:"Kas geliştirme",
      strength:"Güç",
      condition:"Form & kondisyon",
      general:"Genel hareket"
    };

    const hero = createElement("section", {className:"sportProgramHero"});
    hero.append(
      createElement("strong", {text:goalLabels[program.goal] || "Programım"}),
      createElement("span", {text:`${program.days} gün · ${program.duration}${program.duration >= 75 ? "+" : ""} dakika`})
    );

    const dayList = createElement("div", {className:"sportDayList"});
    defaultProgramDays(Number(program.days), program.goal).forEach((day,index) => {
      const currentSettings=daySettings(index,day[0]),currentIds=exerciseIdsForDay(index,day[0]);
      const card = createElement("button", {
        className:"sportDayCard",
        type:"button",
        attributes:{"aria-label":`${index+1}. gün ${currentSettings.title}`}
      });
      card.append(
        createElement("span", {className:"sportDayNumber", text:String(index+1)}),
        (() => {
          const copy = createElement("span", {className:"sportDayCopy"});
          copy.append(
            createElement("strong", {text:day[0]}),
            createElement("small", {text:day[1]})
          );
          return copy;
        })(),
        createElement("span", {className:"healthHubArrow", text:"›", attributes:{"aria-hidden":"true"}})
      );
      card.addEventListener("click",() => {
        renderSportProgramDayEditor(panel,index);
      });
      dayList.appendChild(card);
    });

    const edit = createElement("button", {
      className:"sportSecondaryAction",
      type:"button",
      text:"Programı düzenle"
    });
    edit.addEventListener("click", () => {
      summary.hidden = true;
      if (setup) setup.hidden = false;
      resetHealthScroll();
    });

    const actions = createElement("div", {className:"sportSetupActions"});
    actions.appendChild(edit);
    summary.append(hero, dayList, actions);
  }

  function makeSportPanel(id, title, detail, nextStep) {
    const panel = createElement("section", {className: "sportSubview", id, attributes: {hidden: ""}});
    const header = createElement("header", {className: "sportSubviewHeader"});
    header.append(createElement("h2", {text: title}), createElement("p", {text: detail}));
    const card = createElement("div", {className: "sportFoundationCard"});
    card.append(
      createElement("strong", {text: nextStep}),
      createElement("p", {text: "Bu ekran NUT-014.1 ile navigasyona hazırlandı. Gerçek veri ve kayıt akışı sonraki Spor paketlerinde bağlanacak."}),
      createElement("span", {className: "sportFoundationBadge", text: "Spor altyapısı hazır"})
    );
    panel.append(header, card);
    return panel;
  }

  function buildSportHub() {
    if (!sportPanel || sportHub) return;
    sportPanel.replaceChildren();

    sportHub = createElement("section", {className: "sportHub", id: "sportHub"});
    const header = createElement("header", {className: "sportHubHeader"});
    header.append(
      createElement("div", {className: "sportHubMark", text: "↗", attributes: {"aria-hidden": "true"}}),
      createElement("p", {className: "sportHubIntro", text: "Bugün hareketinde ne var?"})
    );

    const cards = createElement("div", {className: "sportHubCards"});
    cards.append(
      sportCard("program","▦","Programım","Haftalık planını ve antrenman günlerini gör."),
      sportCard("today","▶","Bugünkü Antrenman","Bugünün hareketlerini sırayla uygula."),
      sportCard("exercises","◫","Hareketler","Görsel egzersiz ve alet kütüphanesini aç."),
      sportCard("progress","↗","Gelişim","Antrenman geçmişini ve ilerlemeni gör.")
    );

    sportHub.append(header, cards);
    sportPanel.appendChild(sportHub);

    sportPanels = {
      program: createElement("section", {
        className:"sportSubview",
        id:"sportProgramPanel",
        attributes:{hidden:""}
      }),
      today: createElement("section",{
        className:"sportSubview",
        id:"sportTodayPanel",
        attributes:{hidden:""}
      }),
      exercises: createElement("section",{className:"sportSubview",id:"sportExercisesPanel",attributes:{hidden:""}}),
      progress: createElement("section",{className:"sportSubview",id:"sportProgressPanel",attributes:{hidden:""}})
    };
    Object.values(sportPanels).forEach(panel => sportPanel.appendChild(panel));
    buildSportProgramUI(sportPanels.program);
    buildTodayWorkoutUI(sportPanels.today);
    renderSportLibrary(sportPanels.exercises);
    renderSportProgress(sportPanels.progress);

    cards.addEventListener("click", event => {
      const button = event.target.closest("[data-sport-hub-open]");
      if (button) showSportSection(button.dataset.sportHubOpen);
    });
    showSportSection("hub", {focus:false});
  }

  function showSportSection(section, options = {}) {
    const valid = ["hub","program","today","exercises","progress"];
    if (!valid.includes(section)) section = "hub";
    sportActiveSection = section;
    if (sportHub) sportHub.hidden = section !== "hub";
    Object.entries(sportPanels).forEach(([name,panel]) => { if (panel) panel.hidden = name !== section; });

    const labels = {hub:"Spor",program:"Programım",today:"Bugünkü Antrenman",exercises:"Hareketler",progress:"Gelişim"};
    const pill = healthView?.querySelector(".topbar .pill");
    if (pill && activeSection === "sport") pill.textContent = labels[section] || "Spor";
    resetHealthScroll();

    if (options.focus !== false) {
      const target = section === "hub" ? sportHub : sportPanels[section]?.querySelector("h2");
      if (target) {
        target.tabIndex = -1;
        try { target.focus({preventScroll:true}); } catch(e) { target.focus(); }
      }
    }
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
          activeSection === "sport" &&
          sportActiveSection !== "hub"
        ) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          showSportSection("hub");
          return;
        }

        if (
          activeSection === "wellness" &&
          wellnessActiveSection !== "hub"
        ) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          showWellnessSection("hub");
          return;
        }

        if (
          activeSection === "nutrition" &&
          nutritionActiveSection === "meals" &&
          mealActiveSection !== "hub"
        ) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          showMealSection("hub");
          return;
        }

        if (
          activeSection === "nutrition" &&
          nutritionActiveSection !== "hub"
        ) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          mealActiveSection = "hub";
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

    buildMealHub(mealsPanel);

    const mealForm = document.getElementById("healthMealForm");
    if (mealForm && mealPanels.add) {
      mealPanels.add.appendChild(mealForm);
      simplifyMealAddForm();
    }

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

    if (entrySection && mealPanels.today) {
      mealPanels.today.appendChild(entrySection);
    }

    [
      summaryCard,
      currentOnlyNote,
      archivedSection,
      healthStatus
    ].filter(Boolean).forEach(node => historyPanel.appendChild(node));

    observeMealEntries();

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

    const adjust = createElement("div", {
      className: "todayWaterAdjust"
    });

    const removeButton = createElement("button", {
      className: "todayWaterAdjustButton",
      id: "btnTodayRemoveWaterGlass",
      type: "button",
      text: "−",
      attributes: { "aria-label": "Bir bardak suyu geri al" }
    });

    const adjustLabel = createElement("div", {
      className: "todayWaterAdjustLabel"
    });
    adjustLabel.append(
      createElement("strong", {
        id: "todayWaterAdjustTitle",
        text: "1 bardak"
      }),
      createElement("span", {
        id: "todayWaterAdjustMl",
        text: "350 ml"
      })
    );

    const addButton = createElement("button", {
      className: "todayWaterAdjustButton",
      id: "btnTodayAddWaterGlass",
      type: "button",
      text: "+",
      attributes: { "aria-label": "Bir bardak su ekle" }
    });

    adjust.append(removeButton, adjustLabel, addButton);

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
    visual.append(glasses, summary, adjust, settings);

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

    removeButton.addEventListener("click", async () => {
      removeButton.disabled = true;
      addButton.disabled = true;

      try {
        await removeLatestWaterGlass(Number(glassSelect.value));
      } finally {
        removeButton.disabled = false;
        addButton.disabled = false;
        renderWaterVisual();
      }
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

  async function removeLatestWaterGlass(glassMl) {
    const history = window.TodayNutritionHistory;
    const calculations = window.TodayNutritionCalculations;
    const ui = window.TodayNutritionUI;

    if (
      !history ||
      typeof history.loadDay !== "function" ||
      typeof history.archiveEntry !== "function" ||
      !calculations ||
      typeof calculations.convertMeasurement !== "function"
    ) {
      return false;
    }

    const dayKey = history.dayKeyFromDate(new Date());
    const day = await history.loadDay(dayKey);
    const hydration = (day.entries || [])
      .filter(record =>
        record?.type === "hydration_entry" &&
        record.recordStatus === "active"
      )
      .sort((left, right) =>
        Date.parse(right?.payload?.consumedAt || right?.createdAt || 0) -
        Date.parse(left?.payload?.consumedAt || left?.createdAt || 0)
      );

    if (hydration.length === 0) {
      return false;
    }

    const target = hydration.find(record => {
      try {
        const converted = calculations.convertMeasurement(
          record.payload.amount,
          "ml"
        );
        return (
          typeof converted?.value === "number" &&
          Math.abs(converted.value - glassMl) < 0.5
        );
      } catch (error) {
        return false;
      }
    }) || hydration[0];

    await history.archiveEntry(target.id, {
      userInitiated: true,
      userConfirmed: true,
      confirmEntryArchive: true,
      clientOperationId:
        `water-minus-${Date.now().toString(36)}`
    });

    if (typeof ui?.refresh === "function") {
      await ui.refresh({ announce: false });
    } else if (typeof ui?.open === "function") {
      await ui.open();
    }

    return true;
  }

  function mealCard(section, icon, title, detail) {
    const button = createElement("button", {
      className: "mealHubCard",
      type: "button",
      attributes: {
        "data-meal-hub-open": section,
        "aria-label": `${title} bölümünü aç`
      }
    });

    const iconElement = createElement("span", {
      className: "mealHubIcon",
      text: icon,
      attributes: { "aria-hidden": "true" }
    });

    const copy = createElement("span", {
      className: "mealHubCopy"
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

  function makeMealPanel(id, title, detail) {
    const panel = createElement("section", {
      className: "mealSubview",
      id,
      attributes: { hidden: "" }
    });

    const header = createElement("header", {
      className: "mealSubviewHeader"
    });
    header.append(
      createElement("h3", { text: title }),
      createElement("p", { text: detail })
    );
    panel.appendChild(header);
    return panel;
  }

  function simplifyMealAddForm() {
    const form = document.getElementById("healthMealForm");
    if (!form || form.dataset.todayMinimalReady === "true") return;

    const mealType = document.getElementById("healthMealType");
    const mealName = document.getElementById("healthMealName");
    const librarySearch = document.getElementById("healthLibrarySearch");
    const libraryType = document.getElementById("healthLibraryType");
    const libraryResults = document.getElementById("healthLibraryResults");
    const librarySelected = document.getElementById("healthLibrarySelected");
    const libraryNote = document.getElementById("healthLibraryNote");
    const resultCount = document.getElementById("healthLibraryResultCount");
    const selectedCount = document.getElementById("healthLibrarySelectedCount");
    const submit = document.getElementById("btnHealthMealSubmit");

    if (!mealType || !mealName || !submit) return;

    form.dataset.todayMinimalReady = "true";

    const primaryCard = createElement("section", {
      className: "todayMealPrimaryCard"
    });

    const typeContainer =
      mealType.closest(".healthField") ||
      mealType.closest("label") ||
      mealType.parentElement;

    const nameContainer =
      mealName.closest(".healthField") ||
      mealName.closest("label") ||
      mealName.parentElement;

    [typeContainer, nameContainer]
      .filter(Boolean)
      .forEach(node => primaryCard.appendChild(node));

    const toggle = createElement("button", {
      className: "todayMealLibraryToggle",
      id: "btnTodayMealLibraryToggle",
      type: "button",
      attributes: {
        "aria-expanded": "false",
        "aria-controls": "todayMealLibraryCard"
      }
    });
    toggle.append(
      createElement("span", { text: "Kütüphaneden ekle" }),
      createElement("span", {
        text: "›",
        attributes: { "aria-hidden": "true" }
      })
    );

    const libraryCard = createElement("section", {
      className: "todayMealLibraryCard",
      id: "todayMealLibraryCard",
      attributes: { hidden: "" }
    });

    const candidates = [
      librarySearch,
      libraryType,
      libraryResults,
      librarySelected,
      libraryNote,
      resultCount,
      selectedCount
    ]
      .filter(Boolean)
      .map(node =>
        node.closest("fieldset") ||
        node.closest(".healthLibraryPicker") ||
        node.closest(".healthField") ||
        node.parentElement
      )
      .filter(Boolean);

    const unique = [];
    const seen = new Set();
    candidates.forEach(node => {
      if (!seen.has(node) && !unique.some(parent => parent.contains(node))) {
        seen.add(node);
        unique.push(node);
      }
    });

    unique.forEach(node => libraryCard.appendChild(node));

    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      libraryCard.hidden = !open;

      if (open && librarySearch) {
        window.setTimeout(() => {
          try {
            librarySearch.focus({ preventScroll: true });
          } catch (error) {
            librarySearch.focus();
          }
        }, 0);
      }
    });

    const oldChildren = Array.from(form.children);
    oldChildren.forEach(node => {
      if (
        node !== primaryCard &&
        node !== toggle &&
        node !== libraryCard &&
        node !== submit &&
        !primaryCard.contains(node) &&
        !libraryCard.contains(node)
      ) {
        node.hidden = true;
        node.setAttribute("aria-hidden", "true");
      }
    });

    form.prepend(primaryCard);
    primaryCard.after(toggle, libraryCard);
    form.appendChild(submit);
  }

  function buildMealHub(mealsPanel) {
    if (!mealsPanel || mealHub) return;

    mealHub = createElement("section", {
      className: "mealHub",
      id: "mealHub"
    });

    const header = createElement("header", {
      className: "mealHubHeader"
    });
    header.appendChild(
      createElement("p", {
        text: "Bugün ne yedin?"
      })
    );

    const cards = createElement("div", {
      className: "mealHubCards"
    });
    cards.append(
      mealCard("add", "+", "Öğün ekle", "Kahvaltı, öğle, akşam veya ara öğün"),
      mealCard("today", "≡", "Bugünkü öğünler", "Bugün kaydettiğin öğünleri gör"),
      mealCard("history", "◷", "Geçmiş", "Önceki günlerin öğünlerine git")
    );

    mealHub.append(header, cards);
    mealsPanel.appendChild(mealHub);

    const addPanel = makeMealPanel(
      "mealAddPanel",
      "Öğün ekle",
      "Yalnız ihtiyacın olan alanları doldur."
    );
    const todayPanel = makeMealPanel(
      "mealTodayPanel",
      "Bugünkü öğünler",
      "Bugün kaydettiğin öğünler."
    );
    todayPanel.classList.add("mealCurrentOnly");

    mealPanels = {
      add: addPanel,
      today: todayPanel
    };

    mealsPanel.append(addPanel, todayPanel);

    cards.addEventListener("click", (event) => {
      const button = event.target.closest("[data-meal-hub-open]");
      if (!button) return;

      if (button.dataset.mealHubOpen === "history") {
        showNutritionSection("history");
        return;
      }

      showMealSection(button.dataset.mealHubOpen);
    });

    showMealSection("hub", { focus: false });
  }

  function classifyMealEntryItems() {
    const list = document.getElementById("healthEntryList");
    if (!list) return;

    list.querySelectorAll(".healthListItem").forEach(item => {
      const title = item.querySelector(".healthListTitle")?.textContent || "";
      item.dataset.todayEntryKind =
        /^(Su|Sıvı)\s*·/i.test(title.trim())
          ? "water"
          : "meal";
    });
  }

  function observeMealEntries() {
    const list = document.getElementById("healthEntryList");
    if (!list || mealEntryObserver || typeof MutationObserver !== "function") {
      classifyMealEntryItems();
      return;
    }

    mealEntryObserver = new MutationObserver(classifyMealEntryItems);
    mealEntryObserver.observe(list, {
      childList: true,
      subtree: true,
      characterData: true
    });
    classifyMealEntryItems();
  }

  function showMealSection(section, options = {}) {
    const valid = ["hub", "add", "today"];
    if (!valid.includes(section)) section = "hub";
    mealActiveSection = section;

    if (mealHub) mealHub.hidden = section !== "hub";

    Object.entries(mealPanels).forEach(([name, panel]) => {
      if (panel) panel.hidden = name !== section;
    });

    const pill = healthView?.querySelector(".topbar .pill");
    if (pill && nutritionActiveSection === "meals") {
      pill.textContent = section === "hub"
        ? "Öğünler"
        : section === "add"
          ? "Öğün ekle"
          : "Bugünkü öğünler";
    }

    classifyMealEntryItems();
    resetHealthScroll();

    if (options.focus !== false) {
      const target = section === "hub"
        ? mealHub
        : mealPanels[section]?.querySelector("h3");
      if (target) {
        target.tabIndex = -1;
        try { target.focus({ preventScroll: true }); }
        catch (error) { target.focus(); }
      }
    }
  }

  function renderWaterVisual() {
    const glasses = document.getElementById("todayWaterGlasses");
    const count = document.getElementById("todayWaterGlassCount");
    const amount = document.getElementById("todayWaterMl");
    const glassSelect = document.getElementById("todayWaterGlassMl");
    const targetSelect = document.getElementById("todayWaterTargetMl");
    const adjustTitle = document.getElementById("todayWaterAdjustTitle");
    const adjustMl = document.getElementById("todayWaterAdjustMl");
    const removeButton = document.getElementById("btnTodayRemoveWaterGlass");
    if (!glasses || !count || !amount || !glassSelect || !targetSelect) return;

    const state = window.TodayNutritionUI?.getState?.();
    const totalMl = Math.max(0, Number(state?.summary?.waterMl) || 0);
    const glassMl = Math.max(1, Number(glassSelect.value) || 350);
    const targetMl = Math.max(glassMl, Number(targetSelect.value) || 2800);
    const glassCount = Math.max(1, Math.ceil(targetMl / glassMl));
    const fullGlasses = Math.floor(totalMl / glassMl);
    const partialMl = totalMl % glassMl;
    const dimensions = waterGlassScale(glassMl);

    if (adjustTitle) adjustTitle.textContent = "1 bardak";
    if (adjustMl) adjustMl.textContent = `${glassMl} ml`;
    if (removeButton) removeButton.disabled = totalMl <= 0;

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

    if (section === "meals") {
      showMealSection("hub", { focus: false });
    }

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

    sportPanel = createElement("section", {
      className: "healthSubmodule",
      id: "healthSportPanel",
      attributes: {hidden: "", "aria-label": "Spor"}
    });

    wellnessPanel = createElement("section", {
      className:"healthSubmodule",
      id:"healthWellnessPanel",
      attributes:{hidden:"", "aria-label":"Sağlık"}
    });

    nutritionPanel.parentNode.insertBefore(sportPanel, nutritionPanel.nextSibling);
    nutritionPanel.parentNode.insertBefore(wellnessPanel, sportPanel.nextSibling);

    buildSportHub();
    buildWellnessHub();
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
      activeSection,
      sportActiveSection,
      wellnessActiveSection,
      nutritionActiveSection,
      mealActiveSection
    });
  }

  window.TodayHealthHub = Object.freeze({
    API_VERSION,
    RULESET_ID,
    init,
    showSection,
    showSportSection,
    showWellnessSection,
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
