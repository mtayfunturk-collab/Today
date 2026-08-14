/**
 * Today App — AI Context, Suggestion, Decision & Pattern Feedback UI
 * NUT-017.7
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
import {
  recordApprovalDecision
} from "./ai-approval-bridge.mjs";
import {
  buildPatternPreview
} from "./ai-pattern-bridge.mjs";
import {
  recordPatternFeedback
} from "./ai-pattern-feedback-bridge.mjs";

export const API_VERSION = 1;
export const RULESET_ID = "today:ai-context-ui:nut-017.7";
export const PURPOSE =
  "Günlük denge için kişisel öneri hazırlama";

const MAX_EVENTS_PER_SOURCE = 31;
const WINDOW_DAYS = 7;
let currentContext = null;
let currentAnalysis = null;
let currentAction = null;
let currentDecision = null;
let currentReceipts = [];
let currentPattern = null;
let currentPatternFeedback = null;
let currentReminderTime = "22:30";
let requestSequence = 0;
let requestEpoch = 0;
let decisionSequence = 0;
let feedbackSequence = 0;
let decisionBusy = false;
let patternBusy = false;
let feedbackBusy = false;
let initialized = false;

const MAX_REQUEST_RECEIPTS = 20;

const CHOICE_LABELS = Object.freeze({
  A: "Bir şey oldu ama adı yok",
  B: "Her şey çok net",
  C: "Zordu bugün"
});

const PATTERN_FEEDBACK_LABELS = Object.freeze({
  resonates: "Bana uyuyor",
  "does-not-resonate": "Bana uymuyor",
  unsure: "Emin değilim"
});

const RULE_REASON_LABELS = Object.freeze({
  "core-record-missing": "Bugün için günlük seçim bulunamadı.",
  "core-choice-not-hard-day":
    "Günlük seçim “Zordu bugün” değil.",
  "sleep-record-missing": "Bugün için uyku kaydı bulunamadı.",
  "sleep-duration-missing": "Uyku kaydında süre bulunamadı.",
  "sleep-duration-not-positive":
    "Uyku süresi geçerli görünmüyor.",
  "sleep-duration-not-below-threshold":
    "Uyku süresi 6 saatin altında değil.",
  "records-not-same-local-date":
    "Günlük seçim ve uyku kaydı aynı güne ait değil."
});

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

function clearRuleEvaluation(root) {
  const evaluation = root.querySelector("#aiRuleEvaluation");
  const items = root.querySelector("#aiRuleEvaluationItems");
  const summary = root.querySelector("#aiRuleEvaluationSummary");
  if (items) items.replaceChildren();
  if (summary) summary.textContent = "";
  if (evaluation) evaluation.hidden = true;
}

function setPatternStatus(root, message, state = "idle") {
  const status = root.querySelector("#aiPatternStatus");
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
}

function setPatternFeedbackStatus(root, message, state = "idle") {
  const status = root.querySelector("#aiPatternFeedbackStatus");
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
}

function clearPatternFeedback(root) {
  currentPatternFeedback = null;
  feedbackBusy = false;
  const controls = root.querySelector("#aiPatternFeedbackControls");
  controls?.querySelectorAll("[data-ai-pattern-feedback]").forEach(button => {
    button.disabled = false;
    button.setAttribute("aria-pressed", "false");
  });
  if (controls) controls.hidden = true;
  setPatternFeedbackStatus(root, "");
}

function clearPattern(root) {
  currentPattern = null;
  patternBusy = false;
  clearPatternFeedback(root);
  const button = root.querySelector("#btnAiPattern");
  const output = root.querySelector("#aiPatternOutput");
  const evidence = root.querySelector("#aiPatternEvidence");
  const uncertainty = root.querySelector("#aiPatternUncertainty");
  const alternatives = root.querySelector("#aiPatternAlternatives");
  const textFields = [
    "#aiPatternSummary",
    "#aiPatternConfidence",
    "#aiPatternApproval",
    "#aiPatternSkyBoundary"
  ].map(selector => root.querySelector(selector));

  [evidence, uncertainty, alternatives]
    .filter(Boolean)
    .forEach(list => list.replaceChildren());
  textFields.filter(Boolean).forEach(field => {
    field.textContent = "";
  });
  if (output) output.hidden = true;
  if (button) button.disabled = false;
  setPatternStatus(root, "");
}

function clearDecision(root) {
  currentAction = null;
  currentDecision = null;
  currentReceipts = [];
  currentReminderTime = "22:30";
  decisionBusy = false;

  const controls = root.querySelector("#aiDecisionControls");
  const editPanel = root.querySelector("#aiEditPanel");
  const decisionStatus = root.querySelector("#aiDecisionStatus");
  const reminderTime = root.querySelector("#aiReminderTime");
  const actionLabel = root.querySelector("#aiAnalysisActionLabel");
  const receiptPanel = root.querySelector("#aiDecisionReceipt");
  const receiptItems = root.querySelector("#aiDecisionReceiptItems");
  if (controls) controls.hidden = true;
  if (editPanel) editPanel.hidden = true;
  if (decisionStatus) {
    decisionStatus.textContent = "";
    decisionStatus.dataset.state = "idle";
  }
  if (reminderTime) reminderTime.value = currentReminderTime;
  if (actionLabel) actionLabel.textContent = "";
  if (receiptItems) receiptItems.replaceChildren();
  if (receiptPanel) receiptPanel.hidden = true;
}

function clearAnalysis(root) {
  currentAnalysis = null;
  clearPattern(root);
  clearDecision(root);
  clearRuleEvaluation(root);
  const request = root.querySelector("#aiAnalysisRequest");
  const output = root.querySelector("#aiAnalysisOutput");
  const evidence = root.querySelector("#aiAnalysisEvidence");
  const uncertainty = root.querySelector("#aiAnalysisUncertainty");
  const alternatives = root.querySelector("#aiAnalysisAlternatives");
  const textFields = [
    "#aiAnalysisSummary",
    "#aiAnalysisSuggestion",
    "#aiAnalysisConfidence",
    "#aiAnalysisApproval",
    "#aiAnalysisSkyBoundary"
  ].map(selector => root.querySelector(selector));

  [evidence, uncertainty, alternatives]
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
    setStatus(root, "Önizleme temizlendi.", "idle");
  }
}

function appendCount(documentRef, list, label, value) {
  const item = documentRef.createElement("li");
  item.textContent = `${label}: ${value}`;
  list.append(item);
}

function renderPreview(root, context, sourceWarnings = []) {
  const preview = root.querySelector("#aiContextPreview");
  const counts = root.querySelector("#aiContextCounts");
  const boundaries = root.querySelector("#aiContextBoundaries");
  const filters = root.querySelector("#aiContextFilters");
  if (!preview || !counts || !boundaries || !filters) return;

  counts.replaceChildren();
  appendCount(root.ownerDocument, counts, "Günlük kayıtlar", context.counts.core);
  appendCount(root.ownerDocument, counts, "Sağlık kayıtları", context.counts.health);
  appendCount(
    root.ownerDocument,
    counts,
    "Sky (sembolik)",
    context.counts.symbolicSky
  );

  boundaries.textContent = [
    "Seçtiğin bilgiler yalnız bu işlem için cihazında hazırlandı.",
    `Serbest metin ${context.boundaries.freeTextIncluded ? "dahil edildi" : "dahil edilmedi"}.`,
    "Sky yalnız sembolik kalır; sağlık veya duygu nedeni sayılmaz."
  ].join(" ");

  const warningText = sourceWarnings.length > 0
    ? " Bazı kayıtlar okunamadığı için kullanılmadı."
    : "";
  filters.textContent = [
    "Yalnız gerekli bilgiler kullanıldı.",
    `${context.counts.omitted} kapsam dışı kayıt ve`,
    `${context.counts.redacted} gereksiz alan öneriye dahil edilmedi.${warningText}`
  ].join(" ");
  preview.hidden = false;
  const analysisRequest = root.querySelector("#aiAnalysisRequest");
  if (analysisRequest) analysisRequest.hidden = false;
}

function appendTextItem(documentRef, list, value) {
  const item = documentRef.createElement("li");
  item.textContent = value;
  list.append(item);
}

function durationLabel(minutes) {
  if (!Number.isFinite(minutes)) return "süre bulunamadı";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0
    ? `${hours} saat`
    : `${hours} saat ${remainder} dakika`;
}

function renderRuleEvaluation(root, evaluation) {
  const panel = root.querySelector("#aiRuleEvaluation");
  const items = root.querySelector("#aiRuleEvaluationItems");
  const summary = root.querySelector("#aiRuleEvaluationSummary");
  if (!panel || !items || !summary || !evaluation) {
    clearRuleEvaluation(root);
    return;
  }

  const core = evaluation.observed?.core || null;
  const sleep = evaluation.observed?.sleep || null;
  const coreChoice = core?.choice
    ? CHOICE_LABELS[core.choice] || "tanınmayan seçim"
    : "seçim bulunamadı";

  items.replaceChildren();
  appendTextItem(
    root.ownerDocument,
    items,
    core
      ? `Günlük seçim: ${coreChoice}`
      : "Günlük seçim: bulunamadı"
  );
  appendTextItem(
    root.ownerDocument,
    items,
    sleep
      ? `Uyku: ${durationLabel(sleep.durationMinutes)}`
      : "Uyku: kayıt bulunamadı"
  );
  appendTextItem(
    root.ownerDocument,
    items,
    evaluation.checks?.sameLocalDate === true
      ? "Kayıtlar aynı güne ait."
      : evaluation.checks?.sameLocalDate === false
        ? "Kayıtlar farklı günlere ait."
        : "Kayıt günleri karşılaştırılamadı."
  );

  const reasons = Array.isArray(evaluation.reasons)
    ? evaluation.reasons.map(reason =>
        RULE_REASON_LABELS[reason] || "Kural koşullarından biri karşılanmadı."
      )
    : [];
  summary.textContent = reasons.length
    ? reasons.join(" ")
    : "Gerekli koşullar kontrol edildi.";
  panel.hidden = false;
}

function confidenceLabel(confidence) {
  if (confidence >= 0.8) return "Yüksek";
  if (confidence >= 0.6) return "Orta";
  return "Düşük";
}

function patternConfidenceLabel(level) {
  if (level === "strong") return "Güçlü";
  if (level === "moderate") return "Orta";
  return "Sınırlı";
}

function patternDateLabel(localDate) {
  const value = new Date(`${localDate}T12:00:00`);
  if (Number.isNaN(value.getTime())) return localDate;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short"
  }).format(value);
}

function renderPattern(root, observation, context) {
  const output = root.querySelector("#aiPatternOutput");
  const summary = root.querySelector("#aiPatternSummary");
  const evidence = root.querySelector("#aiPatternEvidence");
  const confidence = root.querySelector("#aiPatternConfidence");
  const uncertainty = root.querySelector("#aiPatternUncertainty");
  const alternatives = root.querySelector("#aiPatternAlternatives");
  const approval = root.querySelector("#aiPatternApproval");
  const skyBoundary = root.querySelector("#aiPatternSkyBoundary");
  const feedbackControls = root.querySelector("#aiPatternFeedbackControls");
  if (
    !output || !summary || !evidence || !confidence || !uncertainty ||
    !alternatives || !approval || !skyBoundary
  ) return;

  summary.textContent = observation.summary;
  evidence.replaceChildren();
  observation.evidence.forEach(entry => appendTextItem(
    root.ownerDocument,
    evidence,
    `${patternDateLabel(entry.localDate)} · ${entry.core.reference} · ` +
      entry.health.reference
  ));
  confidence.textContent =
    `${patternConfidenceLabel(observation.confidence.level)}. ` +
    `${observation.window.eligibleDays} karşılaştırılabilir gün ve ` +
    `${observation.window.matchingDays} tekrar temel alındı; ` +
    "doğruluk olasılığı değildir.";
  uncertainty.replaceChildren();
  observation.uncertainty.forEach(value => appendTextItem(
    root.ownerDocument,
    uncertainty,
    value
  ));
  alternatives.replaceChildren();
  observation.alternatives.forEach(value => appendTextItem(
    root.ownerDocument,
    alternatives,
    value
  ));
  approval.textContent =
    "Bu yalnız bir gözlem; onay vermen veya işlem yapman gerekmiyor.";
  skyBoundary.textContent = context.counts.symbolicSky > 0
    ? "Sky seçilmiş olsa da bu gözlemde kullanılmadı."
    : "Sky bu gözlemde kullanılmadı.";
  clearPatternFeedback(root);
  if (feedbackControls) feedbackControls.hidden = false;
  output.hidden = false;
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
  const actionLabel = root.querySelector("#aiAnalysisActionLabel");
  const controls = root.querySelector("#aiDecisionControls");
  const decisionStatus = root.querySelector("#aiDecisionStatus");
  const skyBoundary = root.querySelector("#aiAnalysisSkyBoundary");
  if (
    !output || !summary || !suggestion || !evidence || !confidence ||
    !uncertainty || !alternatives || !approval || !actionLabel ||
    !controls || !decisionStatus || !skyBoundary
  ) return;

  clearDecision(root);
  summary.textContent = analysis.summary;
  suggestion.textContent = analysis.suggestion;
  evidence.replaceChildren();
  analysis.evidence.forEach(entry => appendTextItem(
    root.ownerDocument,
    evidence,
    entry.reference
  ));
  confidence.textContent = `${confidenceLabel(analysis.confidence)}. ` +
    `Bu öneri ${analysis.evidence.length} seçili kayda dayanıyor; kesinlik değildir.`;
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
  currentAction = analysis.proposedActions[0] || null;
  approval.textContent = currentAction
    ? "Bu öneriyi kullanmak ister misin?"
    : "Bu öneride onay bekleyen bir işlem yok.";
  actionLabel.textContent = currentAction?.label || "";
  controls.hidden = !currentAction;
  decisionStatus.textContent = "";
  skyBoundary.textContent = context.counts.symbolicSky > 0
    ? "Sky seçilmiş olsa da bu öneride kullanılmadı."
    : "Sky bu öneride kullanılmadı.";
  output.hidden = false;
}

function analysisIdFor(context) {
  let hash = 2166136261;
  for (const character of context.contextId) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `analysis:nut-017.7:${(hash >>> 0).toString(36)}`;
}

function patternIdFor(context) {
  let hash = 2166136261;
  for (const character of `${context.contextId}|${context.window.startDate}`) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `pattern:nut-017.7:${(hash >>> 0).toString(36)}`;
}

function feedbackIdFor(observationId, response) {
  feedbackSequence += 1;
  let hash = 2166136261;
  for (const character of `${observationId}|${response}|${feedbackSequence}`) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `feedback:nut-017.7:${(hash >>> 0).toString(36)}:${feedbackSequence}`;
}

function decisionIdFor(analysisId, actionId) {
  decisionSequence += 1;
  let hash = 2166136261;
  for (const character of `${analysisId}|${actionId}|${decisionSequence}`) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `decision:nut-017.7:${(hash >>> 0).toString(36)}:${decisionSequence}`;
}

function setDecisionStatus(root, message, state = "idle") {
  const status = root.querySelector("#aiDecisionStatus");
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
}

function receiptTimeLabel(occurredAt) {
  const value = new Date(occurredAt);
  if (Number.isNaN(value.getTime())) return "";
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function receiptText(receipt) {
  const time = receiptTimeLabel(receipt.occurredAt);
  const timePart = time ? ` · ${time}` : "";
  if (receipt.outcome === "approved") {
    return `Onaylandı${timePart} · İşlem yapılmadı.`;
  }
  if (receipt.outcome === "rejected") {
    return `Reddedildi${timePart} · İşlem yapılmadı.`;
  }
  return `Düzenlendi${timePart} · Yeni taslak yeniden onay bekliyor.`;
}

function renderDecisionReceipts(root) {
  const panel = root.querySelector("#aiDecisionReceipt");
  const items = root.querySelector("#aiDecisionReceiptItems");
  if (!panel || !items) return;
  items.replaceChildren();
  currentReceipts.forEach(receipt => appendTextItem(
    root.ownerDocument,
    items,
    receiptText(receipt)
  ));
  panel.hidden = currentReceipts.length === 0;
}

function setDecisionButtonsDisabled(root, disabled) {
  ["#btnAiApprove", "#btnAiReject", "#btnAiEdit", "#btnAiEditSave"]
    .map(selector => root.querySelector(selector))
    .filter(Boolean)
    .forEach(button => {
      button.disabled = disabled;
    });
}

function closeEditPanel(root) {
  const editPanel = root.querySelector("#aiEditPanel");
  if (editPanel) editPanel.hidden = true;
}

function openEditPanel(root) {
  if (!currentAction || decisionBusy) return;
  const editPanel = root.querySelector("#aiEditPanel");
  const reminderTime = root.querySelector("#aiReminderTime");
  if (!editPanel || !reminderTime) return;
  reminderTime.value = currentReminderTime;
  editPanel.hidden = false;
  setDecisionStatus(root, "Yeni hatırlatma saatini seç.");
  reminderTime.focus();
}

async function handleDecision(root, decision, editedPayload) {
  if (!currentAnalysis || !currentAction || decisionBusy) {
    if (!decisionBusy) {
      setDecisionStatus(root, "Önce bir öneri oluştur.", "error");
    }
    return;
  }

  decisionBusy = true;
  setDecisionButtonsDisabled(root, true);
  setDecisionStatus(root, "Kararın hazırlanıyor…", "busy");

  try {
    const result = await Promise.resolve(recordApprovalDecision({
      decisionId: decisionIdFor(
        currentAnalysis.analysisId,
        currentAction.actionId
      ),
      analysisId: currentAnalysis.analysisId,
      action: currentAction,
      decision,
      decidedAt: new Date().toISOString(),
      ...(editedPayload === undefined ? {} : { editedPayload })
    }));

    if (!result.success) {
      setDecisionStatus(
        root,
        "Karar işlenemedi. Lütfen yeniden dene.",
        "error"
      );
      return;
    }

    currentDecision = result.decision;
    currentReceipts = [
      ...currentReceipts,
      result.receipt
    ].slice(-MAX_REQUEST_RECEIPTS);
    renderDecisionReceipts(root);
    closeEditPanel(root);
    const controls = root.querySelector("#aiDecisionControls");
    const approval = root.querySelector("#aiAnalysisApproval");
    const actionLabel = root.querySelector("#aiAnalysisActionLabel");

    if (decision === "edited") {
      currentReminderTime = editedPayload.reminderTime;
      currentAction = result.replacementAction;
      if (actionLabel) actionLabel.textContent = currentAction.label;
      if (approval) approval.textContent = "Güncellenen taslağı onaylamak ister misin?";
      if (controls) controls.hidden = false;
      setDecisionStatus(
        root,
        `Saat ${currentReminderTime} olarak değiştirildi. Yeni taslak onayını bekliyor.`,
        "success"
      );
      setStatus(root, "Değişiklik hazır. Son karar sana ait.", "success");
      return;
    }

    currentAction = null;
    if (controls) controls.hidden = true;
    if (decision === "approved") {
      if (approval) approval.textContent = "Öneriyi onayladın.";
      setDecisionStatus(
        root,
        "Onaylandı. Bu aşamada hatırlatıcı oluşturulmadı.",
        "success"
      );
      setStatus(root, "Kararın alındı. Henüz hiçbir işlem yapılmadı.", "success");
    } else {
      if (approval) approval.textContent = "Öneriyi kullanmamayı seçtin.";
      setDecisionStatus(root, "Hiçbir işlem yapılmadı.", "success");
      setStatus(root, "Öneri reddedildi. Hiçbir işlem yapılmadı.", "success");
    }
  } catch (error) {
    setDecisionStatus(
      root,
      "Karar işlenirken beklenmeyen bir hata oluştu.",
      "error"
    );
  } finally {
    decisionBusy = false;
    setDecisionButtonsDisabled(root, false);
  }
}

function handleEditSave(root) {
  const reminderTime = root.querySelector("#aiReminderTime")?.value || "";
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(reminderTime)) {
    setDecisionStatus(root, "Geçerli bir saat seç.", "error");
    return;
  }
  handleDecision(root, "edited", { reminderTime });
}

async function handleAnalysis(root) {
  if (!currentContext) {
    setStatus(root, "Önce kullanmak istediğin bilgileri onaylayıp önizle.", "error");
    return;
  }

  const button = root.querySelector("#btnAiAnalysis");
  if (button) button.disabled = true;
  setStatus(root, "Önerin hazırlanıyor…", "busy");

  try {
    const result = await Promise.resolve(buildAnalysisPreview({
      analysisId: analysisIdFor(currentContext),
      requestedAt: new Date().toISOString(),
      context: currentContext
    }));

    if (!result.success) {
      currentAnalysis = null;
      clearDecision(root);
      const output = root.querySelector("#aiAnalysisOutput");
      if (output) output.hidden = true;
      if (
        result.errorCode === "TODAY-AI-ANALYSIS-NO-MATCH" &&
        result.ruleEvaluation
      ) {
        renderRuleEvaluation(root, result.ruleEvaluation);
      } else {
        clearRuleEvaluation(root);
      }
      const message = result.errorCode === "TODAY-AI-ANALYSIS-NO-MATCH"
        ? "Bu kayıtlar için öneri oluşmadı. Nedeni aşağıda görebilirsin."
        : "Öneri hazırlanamadı.";
      setStatus(root, message, result.errorCode === "TODAY-AI-ANALYSIS-NO-MATCH"
        ? "idle"
        : "error");
      return;
    }

    currentAnalysis = result.analysis;
    clearRuleEvaluation(root);
    renderAnalysis(root, result.analysis, currentContext);
    setStatus(
      root,
      "Öneri hazır. Karar sana ait.",
      "success"
    );
  } catch (error) {
    currentAnalysis = null;
    clearRuleEvaluation(root);
    const output = root.querySelector("#aiAnalysisOutput");
    if (output) output.hidden = true;
    setStatus(root, "Öneri hazırlanırken beklenmeyen bir hata oluştu.", "error");
  } finally {
    if (button) button.disabled = false;
  }
}

async function handlePattern(root) {
  if (!currentContext) {
    setPatternStatus(
      root,
      "Önce kullanmak istediğin bilgileri onaylayıp önizle.",
      "error"
    );
    return;
  }
  if (patternBusy) return;

  const button = root.querySelector("#btnAiPattern");
  const activeContext = currentContext;
  const activeRequestEpoch = requestEpoch;
  clearPattern(root);
  patternBusy = true;
  if (button) button.disabled = true;
  setPatternStatus(root, "Son 7 gün inceleniyor…", "busy");

  try {
    const result = await Promise.resolve(buildPatternPreview({
      observationId: patternIdFor(activeContext),
      requestedAt: new Date().toISOString(),
      context: activeContext
    }));

    if (
      activeRequestEpoch !== requestEpoch ||
      activeContext !== currentContext
    ) return;

    if (!result.success) {
      const output = root.querySelector("#aiPatternOutput");
      if (output) output.hidden = true;
      const eligibleDays =
        result.patternEvaluation?.counts?.eligibleDays ?? 0;
      const message = result.errorCode ===
        "TODAY-AI-PATTERN-INSUFFICIENT-DATA"
        ? "Karşılaştırma için en az 3 günün hem günlük seçimi hem uyku " +
          `kaydı olmalı. Şu an ${eligibleDays} gün var.`
        : result.errorCode === "TODAY-AI-PATTERN-NO-RECURRENCE"
          ? "Son 7 günde bu birliktelik en az iki kez görülmedi. " +
            "Bu nedenle tekrar varmış gibi bir sonuç göstermedim."
          : "Son 7 gün incelenemedi. Lütfen yeniden dene.";
      setPatternStatus(
        root,
        message,
        result.errorCode === "TODAY-AI-PATTERN-REQUEST" ? "error" : "idle"
      );
      return;
    }

    currentPattern = result.observation;
    renderPattern(root, result.observation, activeContext);
    setPatternStatus(root, "Son 7 günlük gözlem hazır.", "success");
    setStatus(root, "Tekrarlar incelendi. Yorumlamak sana ait.", "success");
  } catch (error) {
    currentPattern = null;
    const output = root.querySelector("#aiPatternOutput");
    if (output) output.hidden = true;
    setPatternStatus(
      root,
      "Son 7 gün incelenirken beklenmeyen bir hata oluştu.",
      "error"
    );
  } finally {
    if (activeRequestEpoch === requestEpoch) {
      patternBusy = false;
      if (button) button.disabled = false;
    }
  }
}

async function handlePatternFeedback(root, response) {
  if (!currentPattern || !PATTERN_FEEDBACK_LABELS[response]) {
    setPatternFeedbackStatus(
      root,
      "Önce son 7 günlük gözlemi hazırla.",
      "error"
    );
    return;
  }
  if (feedbackBusy) return;

  const activePattern = currentPattern;
  const activeRequestEpoch = requestEpoch;
  const buttons = [...root.querySelectorAll("[data-ai-pattern-feedback]")];
  feedbackBusy = true;
  buttons.forEach(button => {
    button.disabled = true;
  });
  setPatternFeedbackStatus(root, "Seçimin alınıyor…", "busy");

  try {
    const result = await Promise.resolve(recordPatternFeedback({
      feedbackId: feedbackIdFor(activePattern.observationId, response),
      observation: activePattern,
      response,
      respondedAt: new Date().toISOString()
    }));

    if (
      activeRequestEpoch !== requestEpoch ||
      activePattern !== currentPattern
    ) return;

    if (!result.success) {
      setPatternFeedbackStatus(
        root,
        "Seçimin alınamadı. Lütfen yeniden dene.",
        "error"
      );
      return;
    }

    currentPatternFeedback = result.receipt;
    buttons.forEach(button => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.aiPatternFeedback === response)
      );
    });
    setPatternFeedbackStatus(
      root,
      `Geri bildirimin alındı: ${PATTERN_FEEDBACK_LABELS[response]}. ` +
        "Yalnız bu ekran açıkken tutuluyor.",
      "success"
    );
  } catch (error) {
    currentPatternFeedback = null;
    setPatternFeedbackStatus(
      root,
      "Seçimin alınırken beklenmeyen bir hata oluştu.",
      "error"
    );
  } finally {
    if (activeRequestEpoch === requestEpoch) {
      feedbackBusy = false;
      buttons.forEach(button => {
        button.disabled = false;
      });
    }
  }
}

async function handlePreview(root) {
  const confirmation = root.querySelector("#aiConsentConfirm");
  const button = root.querySelector("#btnAiContextPreview");
  if (!confirmation?.checked) {
    setStatus(
      root,
      "Devam etmek için seçtiğin bilgilerin kullanımını onayla.",
      "error"
    );
    confirmation?.focus();
    return;
  }

  const requestedAt = new Date().toISOString();
  const consent = createConsent(root, requestedAt);
  if (!Object.values(consent.permissions).some(entry => entry.allowed)) {
    setStatus(root, "En az bir bilgi türü seç.", "error");
    return;
  }

  const requestId = consent.consentId.replace("consent:", "request:");
  const activeRequestEpoch = requestEpoch + 1;
  requestEpoch = activeRequestEpoch;
  clearPreview(root, { keepStatus: true, invalidate: false });
  if (button) button.disabled = true;
  setStatus(root, "Seçtiğin bilgiler hazırlanıyor…", "busy");

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
        "Bilgiler hazırlanamadı. Lütfen yeniden dene.",
        "error"
      );
      return;
    }

    currentContext = result.context;
    renderPreview(root, result.context, result.sourceWarnings);
    setStatus(
      root,
      "Önizleme hazır. İstersen şimdi öneriyi oluşturabilirsin.",
      "success"
    );
  } catch (error) {
    if (activeRequestEpoch === requestEpoch) {
      clearPreview(root, { keepStatus: true, invalidate: false });
      setStatus(root, "Bilgiler hazırlanırken beklenmeyen bir hata oluştu.", "error");
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
    approvalState: currentAction
      ? "pending-user-approval"
      : currentDecision?.decision || null,
    hasPendingAction: Boolean(currentAction),
    receiptCount: currentReceipts.length,
    latestReceiptOutcome: currentReceipts.at(-1)?.outcome || null,
    patternObservationGenerated: Boolean(currentPattern),
    patternObservationId: currentPattern?.observationId || null,
    patternApprovalRequired: false,
    patternActionProposed: false,
    patternFeedbackRecorded: Boolean(currentPatternFeedback),
    patternFeedbackResponse: currentPatternFeedback?.response || null,
    patternFeedbackPersisted: false,
    patternFeedbackChangedObservation: false,
    modelUpdated: false,
    auditPersisted: false,
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
  root.querySelector("#btnAiPattern")?.addEventListener(
    "click",
    () => handlePattern(root)
  );
  root.querySelectorAll("[data-ai-pattern-feedback]").forEach(button => {
    button.addEventListener(
      "click",
      () => handlePatternFeedback(root, button.dataset.aiPatternFeedback)
    );
  });
  root.querySelector("#btnAiApprove")?.addEventListener(
    "click",
    () => handleDecision(root, "approved")
  );
  root.querySelector("#btnAiReject")?.addEventListener(
    "click",
    () => handleDecision(root, "rejected")
  );
  root.querySelector("#btnAiEdit")?.addEventListener(
    "click",
    () => openEditPanel(root)
  );
  root.querySelector("#btnAiEditSave")?.addEventListener(
    "click",
    () => handleEditSave(root)
  );
  root.querySelector("#btnAiEditCancel")?.addEventListener(
    "click",
    () => {
      closeEditPanel(root);
      setDecisionStatus(root, "Değişiklik yapılmadı.");
    }
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
        "Seçimlerin değişti. Yeni önizleme için yeniden onay gerekir.",
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
