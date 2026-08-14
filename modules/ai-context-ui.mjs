/**
 * Today App — AI Context Consent, Preview & Explainable Analysis UI
 * NUT-017.3
 *
 * DOM sahipliği yalnız bu dosyadadır. Onay ve oluşturulan bağlam bellekte,
 * tek önizleme isteği boyunca tutulur; kalıcı depolamaya veya ağa yazılmaz.
 */
import {
  buildContextPreview
} from "./ai-context-bridge.mjs";
import {
  buildAnalysisPreview
} from "./ai-analysis-bridge.mjs";

export const API_VERSION = 1;
export const RULESET_ID = "today:ai-context-ui:nut-017.3";
export const PURPOSE =
  "Günlük denge için açıklanabilir seçenekler hazırlama";

const MAX_EVENTS_PER_SOURCE = 31;
const WINDOW_DAYS = 7;
let currentContext = null;
let currentAnalysis = null;
let requestSequence = 0;
let requestEpoch = 0;
let initialized = false;

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createContextWindow(now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - (WINDOW_DAYS - 1));

  return Object.freeze({
    startDate: dateKey(start),
    endDate: dateKey(end),
    maxEventsPerSource: MAX_EVENTS_PER_SOURCE
  });
}

function selectedClasses(root, source) {
  return [...root.querySelectorAll(
    `[data-ai-context-source="${source}"][data-ai-context-class]:checked`
  )].map(input => input.dataset.aiContextClass);
}

export function createConsent(root, requestedAt) {
  const coreClasses = selectedClasses(root, "core");
  const healthClasses = selectedClasses(root, "health");
  const skyClasses = selectedClasses(root, "sky");
  const coreAllowed = coreClasses.length > 0;
  const healthAllowed = healthClasses.length > 0;
  const skyAllowed = skyClasses.length > 0;

  requestSequence += 1;
  const token = `${Date.now().toString(36)}:${requestSequence.toString(36)}`;

  return Object.freeze({
    schemaVersion: 1,
    consentId: `consent:nut-017.2:${token}`,
    purpose: PURPOSE,
    granted: true,
    grantedAt: requestedAt,
    revokedAt: null,
    processing: Object.freeze({
      mode: "device-only",
      externalRecipient: null,
      retention: "request-scoped"
    }),
    permissions: Object.freeze({
      core: Object.freeze({
        allowed: coreAllowed,
        dataClasses: Object.freeze(coreClasses),
        includeFreeText: coreAllowed && coreClasses.includes("note")
      }),
      health: Object.freeze({
        allowed: healthAllowed,
        dataClasses: Object.freeze(healthClasses),
        includeFreeText: healthAllowed && Boolean(
          root.querySelector("[data-ai-context-free-text='health']")?.checked
        )
      }),
      sky: Object.freeze({
        allowed: skyAllowed,
        dataClasses: Object.freeze(skyClasses),
        includeFreeText: false,
        role: "symbolic-context-only"
      })
    })
  });
}

function setStatus(root, message, state = "idle") {
  const status = root.querySelector("#aiContextStatus");
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
}

function clearAnalysis(root) {
  currentAnalysis = null;
  const request = root.querySelector("#aiAnalysisRequest");
  const output = root.querySelector("#aiAnalysisOutput");
  const evidence = root.querySelector("#aiAnalysisEvidence");
  const uncertainty = root.querySelector("#aiAnalysisUncertainty");
  const alternatives = root.querySelector("#aiAnalysisAlternatives");
  const actions = root.querySelector("#aiAnalysisActions");
  const textFields = [
    "#aiAnalysisSummary",
    "#aiAnalysisSuggestion",
    "#aiAnalysisConfidence",
    "#aiAnalysisApproval",
    "#aiAnalysisSkyBoundary"
  ].map(selector => root.querySelector(selector));

  [evidence, uncertainty, alternatives, actions]
    .filter(Boolean)
    .forEach(list => list.replaceChildren());
  textFields.filter(Boolean).forEach(field => {
    field.textContent = "";
  });
  if (request) request.hidden = true;
  if (output) output.hidden = true;
}

function clearPreview(root, options = {}) {
  if (options.invalidate !== false) {
    requestEpoch += 1;
  }
  currentContext = null;
  clearAnalysis(root);
  const preview = root.querySelector("#aiContextPreview");
  const counts = root.querySelector("#aiContextCounts");
  const boundaries = root.querySelector("#aiContextBoundaries");
  const filters = root.querySelector("#aiContextFilters");

  if (counts) counts.replaceChildren();
  if (boundaries) boundaries.textContent = "";
  if (filters) filters.textContent = "";
  if (preview) preview.hidden = true;

  if (!options.keepStatus) {
    setStatus(root, "Önizleme belleği temizlendi.", "idle");
  }
}

function appendCount(documentRef, list, label, value) {
  const item = documentRef.createElement("li");
  item.textContent = `${label}: ${value}`;
  list.append(item);
}

function uniqueReasons(records) {
  return [...new Set(records.map(entry => entry.reason))].sort();
}

function renderPreview(root, context, sourceWarnings = []) {
  const preview = root.querySelector("#aiContextPreview");
  const counts = root.querySelector("#aiContextCounts");
  const boundaries = root.querySelector("#aiContextBoundaries");
  const filters = root.querySelector("#aiContextFilters");
  if (!preview || !counts || !boundaries || !filters) return;

  counts.replaceChildren();
  appendCount(root.ownerDocument, counts, "Core", context.counts.core);
  appendCount(root.ownerDocument, counts, "Health", context.counts.health);
  appendCount(
    root.ownerDocument,
    counts,
    "Sembolik Sky",
    context.counts.symbolicSky
  );

  boundaries.textContent = [
    "Onay: bu istek için verildi.",
    "İşleme: yalnız cihazda; kalıcılık: yalnız bu istek.",
    `Serbest metin: ${context.boundaries.freeTextIncluded ? "dahil" : "dahil değil"}.`,
    "Sky: yalnız sembolik bağlam; sağlık/duygu nedeni değil."
  ].join(" ");

  const omissionReasons = uniqueReasons(context.omissions);
  const redactionReasons = uniqueReasons(context.redactions);
  const warningReasons = uniqueReasons(sourceWarnings);
  const details = [
    `${context.counts.omitted} kayıt dışlandı`,
    `${context.counts.redacted} alan çıkarıldı`
  ];
  if (omissionReasons.length) {
    details.push(`dışlama gerekçeleri: ${omissionReasons.join(", ")}`);
  }
  if (redactionReasons.length) {
    details.push(`çıkarma gerekçeleri: ${redactionReasons.join(", ")}`);
  }
  if (warningReasons.length) {
    details.push(`kaynak uyarıları: ${warningReasons.join(", ")}`);
  }
  filters.textContent = `${details.join("; ")}.`;
  preview.hidden = false;
  const analysisRequest = root.querySelector("#aiAnalysisRequest");
  if (analysisRequest) analysisRequest.hidden = false;
}

function appendTextItem(documentRef, list, value) {
  const item = documentRef.createElement("li");
  item.textContent = value;
  list.append(item);
}

function sourceLabel(source) {
  if (source === "today-core") return "Core";
  if (source === "today-health") return "Health";
  return "Desteklenmeyen kaynak";
}

function renderAnalysis(root, analysis, context) {
  const output = root.querySelector("#aiAnalysisOutput");
  const summary = root.querySelector("#aiAnalysisSummary");
  const suggestion = root.querySelector("#aiAnalysisSuggestion");
  const evidence = root.querySelector("#aiAnalysisEvidence");
  const confidence = root.querySelector("#aiAnalysisConfidence");
  const uncertainty = root.querySelector("#aiAnalysisUncertainty");
  const alternatives = root.querySelector("#aiAnalysisAlternatives");
  const approval = root.querySelector("#aiAnalysisApproval");
  const actions = root.querySelector("#aiAnalysisActions");
  const skyBoundary = root.querySelector("#aiAnalysisSkyBoundary");
  if (
    !output || !summary || !suggestion || !evidence || !confidence ||
    !uncertainty || !alternatives || !approval || !actions || !skyBoundary
  ) return;

  summary.textContent = analysis.summary;
  suggestion.textContent = analysis.suggestion;
  evidence.replaceChildren();
  analysis.evidence.forEach(entry => appendTextItem(
    root.ownerDocument,
    evidence,
    `${entry.reference} — ${sourceLabel(entry.source)} kaydı ${entry.eventId}`
  ));
  confidence.textContent = [
    `%${Math.round(analysis.confidence * 100)}.`,
    "Bu değer doğruluk olasılığı değil, sabit kuralın seçili dayanakları kapsama düzeyidir."
  ].join(" ");
  uncertainty.replaceChildren();
  analysis.uncertainty.forEach(value => appendTextItem(
    root.ownerDocument,
    uncertainty,
    value
  ));
  alternatives.replaceChildren();
  analysis.alternatives.forEach(value => appendTextItem(
    root.ownerDocument,
    alternatives,
    value
  ));
  approval.textContent = analysis.requiresUserApproval
    ? "Onay durumu: işlem taslakları kullanıcı onayı bekliyor."
    : "Onay durumu: işlem taslağı yok.";
  actions.replaceChildren();
  analysis.proposedActions.forEach(action => appendTextItem(
    root.ownerDocument,
    actions,
    `${action.label} — onay bekliyor; NUT-017.3 bu taslağı yürütmez.`
  ));
  skyBoundary.textContent = context.counts.symbolicSky > 0
    ? "Sembolik Sky bağlamı pakette bulunuyor; önerinin dayanağına, güven hesabına veya sağlık/duygu yorumuna katılmadı."
    : "Sky verisi bu analizde kullanılmadı.";
  output.hidden = false;
}

function analysisIdFor(context) {
  let hash = 2166136261;
  for (const character of context.contextId) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `analysis:nut-017.3:${(hash >>> 0).toString(36)}`;
}

async function handleAnalysis(root) {
  if (!currentContext) {
    setStatus(root, "Önce onaylı bağlam önizlemesi oluşturun.", "error");
    return;
  }

  const button = root.querySelector("#btnAiAnalysis");
  if (button) button.disabled = true;
  setStatus(root, "Açıklanabilir öneri yalnız cihazda hazırlanıyor…", "busy");

  try {
    const result = await Promise.resolve(buildAnalysisPreview({
      analysisId: analysisIdFor(currentContext),
      requestedAt: new Date().toISOString(),
      context: currentContext
    }));

    if (!result.success) {
      currentAnalysis = null;
      const output = root.querySelector("#aiAnalysisOutput");
      if (output) output.hidden = true;
      const message = result.errorCode === "TODAY-AI-ANALYSIS-NO-MATCH"
        ? "Seçili kayıtlarda ilk NUT-017.3 kuralı eşleşmedi; öneri uydurulmadı."
        : "Analiz isteği güvenlik sınırlarında reddedildi.";
      setStatus(root, message, result.errorCode === "TODAY-AI-ANALYSIS-NO-MATCH"
        ? "idle"
        : "error");
      return;
    }

    currentAnalysis = result.analysis;
    renderAnalysis(root, result.analysis, currentContext);
    setStatus(
      root,
      "Öneri hazır. Hiçbir işlem başlatılmadı; taslak kullanıcı onayı bekliyor.",
      "success"
    );
  } catch (error) {
    currentAnalysis = null;
    const output = root.querySelector("#aiAnalysisOutput");
    if (output) output.hidden = true;
    setStatus(root, "Öneri hazırlanırken beklenmeyen hata oluştu.", "error");
  } finally {
    if (button) button.disabled = false;
  }
}

async function handlePreview(root) {
  const confirmation = root.querySelector("#aiConsentConfirm");
  const button = root.querySelector("#btnAiContextPreview");
  if (!confirmation?.checked) {
    setStatus(
      root,
      "Bu önizleme isteği için veri kullanımını açıkça onaylayın.",
      "error"
    );
    confirmation?.focus();
    return;
  }

  const requestedAt = new Date().toISOString();
  const consent = createConsent(root, requestedAt);
  if (!Object.values(consent.permissions).some(entry => entry.allowed)) {
    setStatus(root, "En az bir veri kapsamı seçin.", "error");
    return;
  }

  const requestId = consent.consentId.replace("consent:", "request:");
  const activeRequestEpoch = requestEpoch + 1;
  requestEpoch = activeRequestEpoch;
  clearPreview(root, { keepStatus: true, invalidate: false });
  if (button) button.disabled = true;
  setStatus(root, "Bağlam yalnız cihazda hazırlanıyor…", "busy");

  try {
    const result = await buildContextPreview({
      requestId,
      purpose: PURPOSE,
      requestedAt,
      window: createContextWindow(new Date(requestedAt)),
      consent
    });

    if (activeRequestEpoch !== requestEpoch) {
      return;
    }

    if (!result.success) {
      clearPreview(root, { keepStatus: true, invalidate: false });
      setStatus(
        root,
        `Bağlam hazırlanamadı (${result.errorCode}).`,
        "error"
      );
      return;
    }

    currentContext = result.context;
    renderPreview(root, result.context, result.sourceWarnings);
    setStatus(
      root,
      "Önizleme hazır. Öneri yalnız aşağıdaki ayrı komutla üretilebilir.",
      "success"
    );
  } catch (error) {
    if (activeRequestEpoch === requestEpoch) {
      clearPreview(root, { keepStatus: true, invalidate: false });
      setStatus(root, "Bağlam hazırlanırken beklenmeyen hata oluştu.", "error");
    }
  } finally {
    if (activeRequestEpoch === requestEpoch) {
      if (confirmation) confirmation.checked = false;
      if (button) button.disabled = false;
    } else if (button) {
      button.disabled = false;
    }
  }
}

export function getStatus() {
  return Object.freeze({
    apiVersion: API_VERSION,
    rulesetId: RULESET_ID,
    initialized,
    hasRequestScopedContext: Boolean(currentContext),
    contextId: currentContext?.contextId || null,
    analysisId: currentAnalysis?.analysisId || null,
    persistentConsent: false,
    externalTransfer: false,
    providerRegistered: false,
    aiProposalGenerated: Boolean(currentAnalysis),
    actionStarted: false
  });
}

export function initAIContextUI(documentRef = document) {
  if (initialized) return getStatus();

  const root = documentRef.querySelector("#aiContextPanel");
  if (!root) return getStatus();

  root.querySelector("#aiConsentPurpose").textContent = PURPOSE;
  root.querySelector("#btnAiContextPreview")?.addEventListener(
    "click",
    () => handlePreview(root)
  );
  root.querySelector("#btnAiContextClear")?.addEventListener(
    "click",
    () => {
      const confirmation = root.querySelector("#aiConsentConfirm");
      if (confirmation) confirmation.checked = false;
      clearPreview(root);
    }
  );
  root.querySelector("#btnAiAnalysis")?.addEventListener(
    "click",
    () => handleAnalysis(root)
  );
  root.querySelectorAll(
    "[data-ai-context-class], [data-ai-context-free-text]"
  ).forEach(input => input.addEventListener("change", () => {
    const hadContext = Boolean(currentContext);
    const requestWasBusy = Boolean(
      root.querySelector("#btnAiContextPreview")?.disabled
    );
    const confirmation = root.querySelector("#aiConsentConfirm");
    if (confirmation) confirmation.checked = false;
    clearPreview(root, { keepStatus: true });
    if (hadContext || requestWasBusy) {
      setStatus(
        root,
        "Kapsam değişti. Yeni önizleme için yeniden onay gerekir.",
        "idle"
      );
    }
  }));

  initialized = true;
  return getStatus();
}

const publicApi = Object.freeze({
  API_VERSION,
  RULESET_ID,
  PURPOSE,
  getStatus,
  init: initAIContextUI
});

if (typeof window !== "undefined") {
  window.TodayAIContextUI = publicApi;
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => initAIContextUI(document),
      { once: true }
    );
  } else {
    initAIContextUI(document);
  }
}

export default publicApi;
