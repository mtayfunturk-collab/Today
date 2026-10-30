/** Request-scoped, read-only wearable preview. No persistence or automatic AI transfer. */
import { createNativeWearableReader } from "./wearable-native-provider.mjs";
import { replaceWearablePreview, clearWearablePreview } from "./wearable-context-session.mjs";

export const PURPOSE = "Kişisel sağlık verilerimin seçtiğim günlük özetlerini cihazımda incelemek";
const mounts = new WeakMap();
const labels = Object.freeze({ sleep: "Takvim günündeki uyku", steps: "Adım", activity: "Antrenman oturumu süresi" });
const unavailableText = "Bu sürümde saat verisine erişim yok. Apple Health veya Health Connect bağlantısını destekleyen telefon uygulaması gerekir. Mevcut sağlık kayıtlarını kullanabilirsin.";

function localDateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")].join("-");
}

function element(document, tag, attributes = {}, text) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

export async function mountWearableUI({ root = document, readerFactory = createNativeWearableReader } = {}) {
  const panel = root.querySelector("#wellnessPersonalDataPanel");
  if (!panel) return null;
  if (mounts.has(panel)) return mounts.get(panel);
  const mounting = buildPanel(panel, readerFactory);
  mounts.set(panel, mounting);
  return mounting;
}

async function buildPanel(panel, readerFactory) {
  const document = panel.ownerDocument;
  const make = (tag, attrs, text) => element(document, tag, attrs, text);
  let reader = null;
  let supported = false;
  let busy = false;
  let epoch = 0;
  let hasResult = false;
  let activeController = null;
  const ReadAbortController = document.defaultView?.AbortController || globalThis.AbortController;

  const header = make("header", { class: "wellnessSubviewHeader" });
  header.append(make("h2", {}, "Kişisel Sağlık Verileri"), make("p", {},
    "Saat ve bilekliğinin paylaştığı günlük özetleri yalnız bu inceleme için oku."));
  const card = make("section", { class: "wellnessFoundationCard wearableReadCard", "aria-label": "Saat ve bileklik verileri" });
  const availability = make("p", { id: "wearableAvailability", role: "status", "aria-live": "polite" }, "Cihaz erişimi kontrol ediliyor.");
  const compatibility = make("p", {},
    "Apple Watch, Mi Fitness ve Zepp Life için destek, telefonuna ve üreticinin paylaştığı verilere bağlıdır; her model ve sürüm aynı veriyi sunmaz. Bazı Mi Fitness aktarımları üretici bulutuyla eşitleme gerektirir. Today bunu senin adına açmaz.");
  const fieldset = make("fieldset", { id: "wearableReadTypes" });
  fieldset.append(make("legend", {}, "Bu incelemede okunacak veriler"));
  for (const [type, label] of Object.entries(labels)) {
    const row = make("label", {});
    row.append(make("input", { type: "checkbox", "data-wearable-type": type }),
      document.createTextNode(` ${label}`));
    fieldset.append(row);
  }
  const periodLabel = make("label", { for: "wearableReadDays" }, "Dönem ");
  const period = make("select", { id: "wearableReadDays" });
  for (const [days, label] of [[1, "Bugün"], [7, "Son 7 gün"], [30, "Son 30 gün"]]) {
    period.append(make("option", { value: String(days) }, label));
  }
  period.value = "7";
  periodLabel.append(period);
  const historyNote = make("p", {}, "90 günlük saat geçmişi bu aşamada açık değil. Eksik günler sıfır kabul edilmez.");
  const sleepNote = make("p", {}, "Uyku süresi takvim gününe göre gösterilir. Gece yarısını aşan uyku günlere bölünür; bu değer bütün bir gecenin toplamı değildir.");
  const activityNote = make("p", {}, "Antrenman süresi, kaydedilmiş oturum aralığıdır; molaları içerebilir ve aktif hareket dakikasıyla aynı değildir.");
  const consentLabel = make("label", {});
  const consent = make("input", { id: "wearableReadConsent", type: "checkbox" });
  consentLabel.append(consent, document.createTextNode(
    " Seçtiğim türleri ve dönemi yalnız bu inceleme için okumayı onaylıyorum. Sonuçlar bu uygulama oturumunda geçicidir; kaydedilmez veya AI'a otomatik gönderilmez. AI'da kullanmak için ayrıca seçim ve onay gerekir."));
  const read = make("button", { id: "btnWearableRead", type: "button", disabled: "" }, "Seçtiğim verileri oku");
  const clear = make("button", { id: "btnWearableClear", type: "button" }, "Önizlemeyi temizle");
  const status = make("p", { id: "wearableReadStatus", role: "status", "aria-live": "polite" });
  const results = make("div", { id: "wearableReadResults", "aria-live": "polite" });
  card.append(availability, compatibility, fieldset, periodLabel, historyNote, sleepNote, activityNote, consentLabel,
    read, clear, status, results);
  panel.replaceChildren(header, card);

  const selectedTypes = () => [...fieldset.querySelectorAll("input:checked")]
    .map(input => input.dataset.wearableType);
  const updateReadButton = () => {
    read.disabled = !supported || busy || !consent.checked || selectedTypes().length === 0;
    read.setAttribute("aria-busy", String(busy));
  };
  const invalidate = (message = "") => {
    epoch += 1;
    activeController?.abort();
    clearWearablePreview();
    hasResult = false;
    consent.checked = false;
    results.replaceChildren();
    status.textContent = message;
    updateReadButton();
  };
  const api = Object.freeze({
    getState: () => Object.freeze({ initialized: true, supported, busy, hasResult }),
    clear: () => invalidate("Önizleme temizlendi. Yeni okuma için yeniden onay gerekir.")
  });

  fieldset.addEventListener("change", () => invalidate("Veri seçimin değişti. Yeniden onay gerekir."));
  period.addEventListener("change", () => invalidate("Dönem değişti. Yeniden onay gerekir."));
  consent.addEventListener("change", () => {
    if (!consent.checked) invalidate("Onay kaldırıldı. Sonuç temizlendi.");
    else updateReadButton();
  });
  clear.addEventListener("click", api.clear);
  read.addEventListener("click", async () => {
    if (busy || !supported || !consent.checked) return;
    const types = selectedTypes();
    const days = Number(period.value);
    if (!types.length || ![1, 7, 30].includes(days)) return;
    if (typeof ReadAbortController !== "function") {
      consent.checked = false;
      status.textContent = "Bu cihazda güvenli okuma başlatılamadı. Uygulamayı güncelleyip tekrar deneyebilirsin.";
      updateReadButton();
      return;
    }
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    const requestEpoch = ++epoch;
    const requestController = new ReadAbortController();
    activeController = requestController;
    busy = true;
    hasResult = false;
    clearWearablePreview();
    results.replaceChildren();
    status.textContent = "Seçtiğin özetler okunuyor. Telefonunda erişim izni sorulabilir.";
    updateReadButton();
    try {
      const result = await reader.read({ userConfirmed: true, purpose: PURPOSE, types,
        startDate: localDateKey(start), endDate: localDateKey(end), signal: requestController.signal });
      if (requestEpoch !== epoch) return;
      if (result?.ok !== true || !Array.isArray(result.samples)) {
        status.textContent = "Veriler okunamadı. Telefonundaki erişim ayarlarını kontrol edip tekrar deneyebilirsin.";
        return;
      }
      if (!result.samples.length) {
        status.textContent = "Bu dönem için okunabilir veri bulunamadı. Bu, izni reddettiğin anlamına gelmeyebilir; üretici eşitlemesini ve paylaşımını kontrol edebilirsin.";
        return;
      }
      const snapshot = replaceWearablePreview({ samples: result.samples, capturedAt: new Date().toISOString(),
        window: { startDate: localDateKey(start), endDate: localDateKey(end) } });
      if (!snapshot.ok) {
        status.textContent = "Veriler güvenli biçimde doğrulanamadı. Daha sonra tekrar deneyebilirsin.";
        return;
      }
      const list = make("ul", {});
      for (const sample of result.samples) {
        if (!Object.hasOwn(labels, sample.type)) continue;
        list.append(make("li", {}, `${sample.localDate} · ${labels[sample.type]}: ${sample.value} ${sample.type === "steps" ? "adım" : "dakika"}`));
      }
      results.append(make("p", {}, "Bu okumada alınan günlük özetler; kalıcı bağlantı veya kayıt oluşturulmadı."), list);
      hasResult = true;
      status.textContent = "Okuma tamamlandı. Sonuçlar bu önizlemede geçicidir.";
    } catch {
      if (requestEpoch === epoch) status.textContent = "Veriler okunamadı. Daha sonra tekrar deneyebilirsin.";
    } finally {
      if (activeController === requestController) activeController = null;
      busy = false;
      if (requestEpoch === epoch) {
        consent.checked = false;
      }
      updateReadButton();
    }
  });

  try {
    reader = await readerFactory();
    const availabilityResult = reader?.getAvailability?.();
    supported = availabilityResult?.supported === true && typeof reader?.read === "function";
    availability.textContent = supported
      ? "Telefonundaki sağlık verilerine erişim yolu hazır. İzin yalnız seçtiğin verileri okumak istediğinde istenir."
      : unavailableText;
  } catch {
    availability.textContent = unavailableText;
  }
  fieldset.disabled = !supported;
  period.disabled = !supported;
  consent.disabled = !supported;
  updateReadButton();
  return api;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const mountWhenReady = () => {
    if (window.TodayStartup?.getStatus?.().phase === "ready") {
      mountWearableUI().catch(() => {});
    }
  };
  window.addEventListener("today:startup-ready", mountWhenReady);
  window.addEventListener("today:health-hub-ready", mountWhenReady);
  // Deferred modules run while readyState is interactive, before classic scripts'
  // DOMContentLoaded handlers have constructed the Health Hub mount point.
  if (document.readyState !== "complete") {
    document.addEventListener("DOMContentLoaded", mountWhenReady, { once: true });
  }
  mountWhenReady();
}
