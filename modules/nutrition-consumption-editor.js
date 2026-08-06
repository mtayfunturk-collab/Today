/**
 * Today App — Nutrition Consumption Editor
 * NUT-012 — Per-item amount and recipe/template scaling at consumption time.
 *
 * This enhancement is intentionally layered over TodayNutritionUI. It does not
 * mutate library records. Edited amounts are applied only to the immutable meal
 * snapshots created by TodayNutritionEntry.logMeal().
 */
(function () {
  "use strict";

  const API_VERSION = 1;
  const RULESET_ID = "today:nutrition:consumption-editor:v1";
  const MIN_AMOUNT = 0.01;
  const MAX_AMOUNT = 100000;
  const DEFAULT_TEMPLATE_MULTIPLIER = 1;

  const overrides = new Map();
  let initialized = false;
  let submitting = false;
  let observer = null;
  let form = null;
  let selectedList = null;
  let status = null;

  function clone(value) {
    if (value === undefined) return undefined;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function createError(code, message, detail = null) {
    const error = new Error(message);
    error.name = "TodayNutritionConsumptionEditorError";
    error.todayCode = code;
    error.detail = detail;
    return error;
  }

  function stateSelections() {
    const ui = window.TodayNutritionUI;
    const selected = ui?.getState?.()?.library?.selected;
    return Array.isArray(selected) ? selected : [];
  }

  function normalizeNumber(rawValue) {
    const value = Number(String(rawValue).replace(",", "."));
    return Number.isFinite(value) ? value : NaN;
  }

  function validAmount(value) {
    return Number.isFinite(value) && value >= MIN_AMOUNT && value <= MAX_AMOUNT;
  }

  function unitLabel(unit) {
    return ({
      g: "g",
      kg: "kg",
      ml: "ml",
      l: "L",
      piece: "adet",
      portion: "porsiyon",
      serving: "porsiyon"
    })[unit] || unit || "birim";
  }

  function defaultOverride(selection) {
    if (selection.type === "meal_template") {
      return {
        type: selection.type,
        value: DEFAULT_TEMPLATE_MULTIPLIER,
        unit: "multiplier"
      };
    }

    return {
      type: selection.type,
      value: selection.amount?.value,
      unit: selection.amount?.unit,
      status: selection.amount?.status || "known",
      basis: selection.amount?.basis ?? null
    };
  }

  function getOverride(selection) {
    const current = overrides.get(selection.recordId);
    if (current) return current;
    const next = defaultOverride(selection);
    overrides.set(selection.recordId, next);
    return next;
  }

  function pruneOverrides(selections) {
    const active = new Set(selections.map(item => item.recordId));
    for (const key of overrides.keys()) {
      if (!active.has(key)) overrides.delete(key);
    }
  }

  function makeEditor(selection) {
    const wrapper = document.createElement("div");
    const label = document.createElement("label");
    const input = document.createElement("input");
    const helper = document.createElement("span");
    const current = getOverride(selection);

    wrapper.className = "healthConsumptionEditor";
    wrapper.dataset.nutritionConsumptionEditor = selection.recordId;
    label.className = "healthConsumptionLabel";
    input.className = "healthConsumptionInput";
    helper.className = "healthConsumptionUnit";

    input.type = "number";
    input.inputMode = "decimal";
    input.min = String(MIN_AMOUNT);
    input.max = String(MAX_AMOUNT);
    input.step = "0.01";
    input.value = String(current.value ?? "");
    input.dataset.nutritionAmountRecordId = selection.recordId;
    input.setAttribute("aria-label", `${selection.name} tüketim miktarı`);

    if (selection.type === "meal_template") {
      label.textContent = "Öğün ölçeği";
      helper.textContent = "kat";
    } else {
      label.textContent = "Tüketilen miktar";
      helper.textContent = unitLabel(current.unit);
    }

    wrapper.append(label, input, helper);
    return wrapper;
  }

  function renderEditors() {
    if (!selectedList) return;

    const selections = stateSelections();
    pruneOverrides(selections);
    const byId = new Map(selections.map(item => [item.recordId, item]));

    selectedList.querySelectorAll("[data-remove-nutrition-library]").forEach(button => {
      const recordId = button.dataset.removeNutritionLibrary;
      const item = button.closest("li");
      const selection = byId.get(recordId);
      if (!item || !selection) return;

      const existing = item.querySelector("[data-nutrition-consumption-editor]");
      if (existing) return;

      item.append(makeEditor(selection));
    });
  }

  function onAmountInput(event) {
    const input = event.target.closest("[data-nutrition-amount-record-id]");
    if (!input) return;

    const recordId = input.dataset.nutritionAmountRecordId;
    const selection = stateSelections().find(item => item.recordId === recordId);
    if (!selection) return;

    const value = normalizeNumber(input.value);
    const next = getOverride(selection);
    overrides.set(recordId, { ...next, value });

    const invalid = !validAmount(value);
    input.setAttribute("aria-invalid", String(invalid));
    if (invalid) {
      input.setCustomValidity(`Miktar ${MIN_AMOUNT} ile ${MAX_AMOUNT} arasında olmalı.`);
    } else {
      input.setCustomValidity("");
    }
  }

  function mealInput() {
    const selections = stateSelections();
    const mealType = document.getElementById("healthMealType")?.value;
    const customName = document.getElementById("healthMealName")?.value?.trim() || "";
    const template = selections.find(item => item.type === "meal_template");
    const items = selections
      .filter(item => ["food_version", "recipe_version"].includes(item.type))
      .map(item => {
        const override = getOverride(item);
        if (!validAmount(override.value)) {
          throw createError(
            "TODAY-NUTRITION-CONSUMPTION-001",
            `${item.name} için geçerli bir miktar gir.`,
            { recordId: item.recordId, value: override.value }
          );
        }
        return {
          recordId: item.recordId,
          amount: {
            status: override.status || item.amount?.status || "known",
            value: override.value,
            unit: override.unit || item.amount?.unit,
            basis: override.basis ?? item.amount?.basis ?? null
          },
          name: item.name
        };
      });

    const input = {
      mealType,
      coverage: customName || selections.length > 0 ? "complete" : "unspecified"
    };

    if (customName) input.customItems = [{ name: customName }];
    if (items.length > 0) input.items = items;

    if (template) {
      const multiplier = getOverride(template).value;
      if (!validAmount(multiplier)) {
        throw createError(
          "TODAY-NUTRITION-CONSUMPTION-002",
          `${template.name} için geçerli bir öğün ölçeği gir.`,
          { recordId: template.recordId, value: multiplier }
        );
      }
      input.templateId = template.recordId;
      input.templateMultiplier = multiplier;
    }

    return input;
  }

  function operationId() {
    return `health-ui-consumption-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function setStatus(message, kind = "neutral") {
    if (!status) return;
    status.textContent = message;
    status.dataset.kind = kind;
  }

  function clearSelection() {
    selectedList
      ?.querySelectorAll("[data-remove-nutrition-library]")
      .forEach(button => button.click());
    overrides.clear();
    const customName = document.getElementById("healthMealName");
    if (customName) customName.value = "";
  }

  async function submitEditedMeal(event) {
    if (submitting || !window.TodayNutritionUI?.selectedIsToday?.()) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    try {
      const input = mealInput();
      if (!form.reportValidity()) return;

      submitting = true;
      form.setAttribute("aria-busy", "true");
      const submitButton = document.getElementById("btnHealthMealSubmit");
      if (submitButton) submitButton.disabled = true;
      setStatus("Düzenlenen miktarlarla kaydediliyor…");

      const now = new Date().toISOString();
      await window.TodayNutritionEntry.logMeal(input, {
        userInitiated: true,
        userConfirmed: true,
        at: now,
        clientOperationId: operationId()
      });

      clearSelection();
      await window.TodayNutritionUI.refresh();
      setStatus("Öğün, düzenlenen tüketim miktarlarıyla kaydedildi.", "success");
    } catch (error) {
      setStatus(error?.message || "Öğün kaydedilemedi; mevcut kayıtların korunuyor.", "error");
    } finally {
      submitting = false;
      form.setAttribute("aria-busy", "false");
      const submitButton = document.getElementById("btnHealthMealSubmit");
      if (submitButton) submitButton.disabled = false;
    }
  }

  function init() {
    if (initialized) return getState();

    form = document.getElementById("healthMealForm");
    selectedList = document.getElementById("healthLibrarySelected");
    status = document.getElementById("healthStatus");

    if (!form || !selectedList || !window.TodayNutritionUI || !window.TodayNutritionEntry) {
      return { initialized: false, reason: "dependencies_not_ready" };
    }

    form.addEventListener("submit", submitEditedMeal, true);
    selectedList.addEventListener("input", onAmountInput);
    selectedList.addEventListener("change", onAmountInput);
    observer = new MutationObserver(renderEditors);
    observer.observe(selectedList, { childList: true, subtree: true });
    initialized = true;
    renderEditors();
    return getState();
  }

  function getState() {
    return Object.freeze({
      initialized,
      submitting,
      overrides: Object.freeze(clone([...overrides.entries()]))
    });
  }

  function boot() {
    if (init().initialized) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (init().initialized || attempts >= 40) window.clearInterval(timer);
    }, 100);
  }

  window.TodayNutritionConsumptionEditor = Object.freeze({
    API_VERSION,
    RULESET_ID,
    MIN_AMOUNT,
    MAX_AMOUNT,
    init,
    getState
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
