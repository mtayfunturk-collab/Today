import { createNotificationStore } from './notification-store.mjs';
import { createNativeNotificationAdapter } from './native-notification-adapter.mjs';
import { createNotificationService } from './notification-service.mjs';

const mounts = new WeakMap();
const heldNativeLocks = new Set();
// Only the generated single-WebView host may use this fallback when Web Locks
// is unavailable. A future second archive writer requires a native shared lock.
export function nativeContextLocks(bridge = globalThis.TodayNativeNotifications) {
  if (bridge?.isNative !== true || bridge.singleContext !== true ||
      !['ios','android'].includes(bridge.platform)) return null;
  return Object.freeze({ async request(name, options, callback) {
    if (options?.ifAvailable !== true || options?.mode !== 'exclusive') throw new Error('unsupported-lock-mode');
    if (heldNativeLocks.has(name)) return callback(null);
    heldNativeLocks.add(name);
    try { return await callback(Object.freeze({ name, mode: 'exclusive' })); }
    finally { heldNativeLocks.delete(name); }
  } });
}
const metricLabels = Object.freeze({ core: 'Günlük seçim', sleep: 'Uyku', energy: 'Enerji', fatigue: 'Yorgunluk',
  activity: 'Aktivite', 'wearable-sleep-calendar-day': 'Saat: takvim günündeki uyku',
  'wearable-steps': 'Saat: adım', 'wearable-workout-span': 'Saat: antrenman oturumu süresi' });
const valueLabels = { A: 'Bir şey oldu ama adı yok', B: 'Her şey çok net', C: 'Zordu bugün',
  low: 'Düşük', balanced: 'Dengeli', high: 'Yüksek', none: 'Yok', some: 'Biraz' };

async function defaultFactory(document) {
  const view = document.defaultView;
  const store = createNotificationStore({ storage: view.localStorage });
  const adapter = await createNativeNotificationAdapter();
  return createNotificationService({ store, adapter, locks: view.navigator.locks || nativeContextLocks(),
    appVersion: view.TodayVersion?.APP_VERSION });
}

function node(doc, tag, attrs = {}, text) {
  const result = doc.createElement(tag);
  Object.entries(attrs).forEach(([name, value]) => result.setAttribute(name, value));
  if (text !== undefined) result.textContent = text;
  return result;
}

export async function mountNotificationUI({ root = document, serviceFactory = defaultFactory } = {}) {
  const parent = root.querySelector('#aiContextPanel');
  if (!parent) return null;
  if (mounts.has(parent)) return mounts.get(parent);
  const mounting = build(parent, serviceFactory);
  mounts.set(parent, mounting);
  return mounting;
}

async function build(parent, serviceFactory) {
  const doc = parent.ownerDocument, view = doc.defaultView;
  const make = (tag, attrs, text) => node(doc, tag, attrs, text);
  const panel = make('section', { id: 'notificationPanel', 'aria-labelledby': 'notificationTitle' });
  const title = make('h4', { id: 'notificationTitle' }, 'Bildirimler ve gözlem arşivi');
  const availability = make('p', { id: 'notificationAvailability', role: 'status' }, 'Bildirim erişimi kontrol ediliyor.');
  const explanation = make('p', {}, 'Yeni bir AI gözlemi oluşturduğunda, seçtiğin saatte en fazla günde bir bildirim planlanabilir. Uygulama açılmadan her gün yeni AI üretilmez; hazır gözlem yoksa bildirim gönderilmez.');
  const form = make('form', { id: 'notificationPreferences' });
  const checkbox = (id, text) => {
    const label = make('label', { class: 'aiContextScope' });
    const input = make('input', { id, type: 'checkbox' }); label.append(input, doc.createTextNode(` ${text}`));
    form.append(label); return input;
  };
  const ai = checkbox('notificationAiEnabled', 'Günlük AI gözlemi bildirimi');
  const update = checkbox('notificationUpdateEnabled', 'Today Yenilik: yeni yüklenen sürüm bildirimi');
  const timeLabel = make('label', { for: 'notificationTime' }, 'AI bildirimi için yerel saat ');
  const time = make('input', { id: 'notificationTime', type: 'time' }); timeLabel.append(time); form.append(timeLabel);
  const quiet = make('p', {}, 'İstersen sessiz saat aralığını seç; iki alanı da boş bırakabilirsin.');
  const quietStartLabel = make('label', { for: 'notificationQuietStart' }, 'Başlangıç ');
  const quietEndLabel = make('label', { for: 'notificationQuietEnd' }, 'Bitiş ');
  const quietStart = make('input', { id: 'notificationQuietStart', type: 'time' });
  const quietEnd = make('input', { id: 'notificationQuietEnd', type: 'time' });
  quietStartLabel.append(quietStart); quietEndLabel.append(quietEnd);
  form.append(quiet, quietStartLabel, quietEndLabel);
  const consent = checkbox('notificationArchiveConsent', 'Bildirim tercihlerini ve türetilmiş, hassas olabilen AI özetlerini bu cihazda ayrı saklamayı onaylıyorum. En çok 7 gözlem, 7 gün geçerlidir; süresi dolanlar sonraki açılışta temizlenir. Ham notlar saklanmaz.');
  const apply = make('button', { id: 'btnNotificationApply', type: 'submit' }, 'Tercihleri uygula');
  const reset = make('button', { id: 'btnNotificationReset', type: 'button' }, 'Bildirim verilerini sıfırla');
  form.append(apply, reset);
  const status = make('p', { id: 'notificationStatus', role: 'status', 'aria-live': 'polite' });
  const archive = make('div', { id: 'notificationArchive' });
  const output = make('div', { id: 'notificationInsight', 'aria-live': 'polite' });
  panel.append(title, availability, explanation, form, status, archive, output); parent.append(panel);
  let service = null, ready = false, uiBusy = false, pendingOpen = null, archiveEpoch = 0;
  const failText = 'İşlem tamamlanamadı. Bildirim ve cihaz erişimi ayarlarını kontrol edip tekrar deneyebilirsin.';
  function reflect(sync = false) {
    const state = service?.getState?.();
    const supported = state?.supported === true && state?.exclusive === true;
    availability.textContent = supported
      ? 'Telefon bildirimleri kullanılabilir. İzin yalnız etkinleştirmek istediğinde sorulur.'
      : 'Bu cihazda telefon bildirimi planlanamıyor. Destekleyen telefon uygulaması gerekir; mevcut kayıtlarını kullanabilirsin.';
    for (const input of [ai, update, time, quietStart, quietEnd, consent, apply]) input.disabled = !supported || uiBusy;
    reset.disabled = !service || uiBusy;
    if (sync && state?.preferences) {
      ai.checked = state.preferences.aiEnabled; update.checked = state.preferences.updateEnabled;
      time.value = state.preferences.localTime || '';
      quietStart.value = state.preferences.quietHours?.start || ''; quietEnd.value = state.preferences.quietHours?.end || '';
    }
  }
  async function refreshArchive() {
    const epoch = ++archiveEpoch;
    if (!ready || !service) return;
    const result = await service.listInsights();
    if (epoch !== archiveEpoch || !result.ok) return;
    archive.replaceChildren();
    if (!result.insights.length) { archive.append(make('p', {}, 'Arşivde geçerli bir gözlem yok.')); return; }
    const list = make('ul', {});
    for (const insight of result.insights) {
      const item = make('li', {}), button = make('button', { type: 'button', 'data-open-insight': insight.id }, `${insight.window?.endDate || ''} · Gözlemi aç`);
      button.addEventListener('click', () => showInsight(insight.id)); item.append(button); list.append(item);
    }
    archive.append(list);
  }
  async function showInsight(id) {
    if (!ready) { pendingOpen = id; return; }
    const result = await service.openInsight(id);
    output.replaceChildren();
    if (!result.ok) { output.textContent = 'Bu gözlem artık kullanılamıyor veya süresi dolmuş. Yeni bir inceleme oluşturabilirsin.'; return; }
    const insight = result.insight, report = insight.report;
    view.TodayRouter?.navigate?.('settings', { moveFocus: false });
    output.append(make('h4', {}, 'Kaydedilmiş gözlemin'), make('p', {}, `${insight.window.startDate} – ${insight.window.endDate}`));
    for (const observation of report.observations || []) {
      if (observation.metric === 'core-short-sleep') {
        output.append(make('p', {}, `Ön gözlem: karşılaştırılabilir ${observation.recordedDays} günün ${observation.matchingDays} gününde zor gün ve kısa uyku birlikte kaydedilmiş. Neden-sonuç göstermez.`)); continue;
      }
      const unit = observation.unit === 'count' || observation.metric === 'wearable-steps' ? ' adım'
        : ['sleep','activity','wearable-sleep-calendar-day','wearable-workout-span'].includes(observation.metric) ? ' dk' : '';
      const text = (observation.values || []).map(row => {
        const label = observation.metric === 'fatigue' && row.value === 'high' ? 'Fazla' : valueLabels[row.value] ?? row.value;
        return `${row.localDate}: ${label}${unit}`;
      }).join('; ');
      output.append(make('p', {}, `${metricLabels[observation.metric] || 'Gözlem'} · ${observation.recordedDays} kayıtlı gün. ${text}`));
    }
    output.append(make('p', {}, 'Bu, oluşturulduğu andaki özetin kopyasıdır. Eksik günler sıfır sayılmaz; sağlık tanısı veya neden-sonuç iddiası değildir.'));
  }
  async function run(callback) {
    if (uiBusy || !ready) return;
    uiBusy = true; reflect();
    try { await callback(); } catch { status.textContent = failText; }
    finally { uiBusy = false; reflect(true); await refreshArchive(); }
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const desired = { ai: ai.checked, update: update.checked }, localTime = time.value;
    const hours = quietStart.value || quietEnd.value ? { start: quietStart.value, end: quietEnd.value } : null;
    const before = service?.getState?.().preferences;
    if (!ready || !before) return;
    if ((desired.ai || desired.update) && !consent.checked) { status.textContent = 'Önce ayrı saklama ve bildirim tercihini onayla.'; return; }
    if (desired.ai && !localTime) { status.textContent = 'AI bildirimi için bir yerel saat seç.'; return; }
    if (hours && (!hours.start || !hours.end || hours.start === hours.end)) { status.textContent = 'Sessiz saatlerin başlangıcını ve bitişini birlikte seç.'; return; }
    if (!desired.ai) { output.replaceChildren(); archive.replaceChildren(); }
    run(async () => {
      for (const kind of ['ai','update']) {
        const result = desired[kind]
          ? await service.enable({ kind, localTime: localTime || null, quietHours: hours, userConfirmed: true })
          : await service.disable(kind);
        if (!result.ok) { status.textContent = failText; return; }
      }
      consent.checked = false; status.textContent = 'Tercihler kaydedildi. Hazır gözlem ve uygun saat varsa bildirim planlanır; kesin teslim saati garanti edilmez.';
      if (!desired.ai) output.replaceChildren();
    });
  });
  reset.addEventListener('click', () => run(async () => {
    output.replaceChildren(); archive.replaceChildren(); consent.checked = false;
    const result = await service.reset();
    status.textContent = result.ok ? 'Yalnız bildirim verileri temizlendi. Core ve Health kayıtların korundu.' : failText;
    if (result.ok) { output.replaceChildren(); consent.checked = false; }
  }));
  view.addEventListener('today:ai-observation-ready', event => {
    if (!ready || event.detail?.userConfirmed !== true || !service.getState().preferences?.aiEnabled) return;
    run(async () => {
      const result = await service.offerObservation(event.detail.report, { userConfirmed: true, requestedAt: event.detail.requestedAt });
      status.textContent = !result.ok ? failText : result.status === 'scheduled'
        ? 'Gözlem kaydedildi ve bildirim planlandı. Telefonun teslimi geciktirebilir.'
        : 'Gözlem arşive kaydedildi; bu işlem için yeni bildirim planlanmadı.';
    });
  });
  try {
    service = await serviceFactory(doc);
    service.subscribe(event => {
      if (event.type === 'open') { if (ready) showInsight(event.insightId); else pendingOpen = event.insightId; }
      else if (event.type === 'update-open') {
        view.TodayRouter?.navigate?.('settings', { moveFocus: false });
        output.replaceChildren(make('p', {}, `Today Yenilik · Uygulamadaki sürüm: ${event.version}. Güncel özelliklerini inceleyebilirsin.`));
      } else if (ready) reflect();
    });
    const initialized = await service.init(); ready = true;
    if (!initialized.ok) status.textContent = failText;
    reflect(true); await refreshArchive();
    if (pendingOpen) await showInsight(pendingOpen);
  } catch { availability.textContent = 'Bu cihazda bildirim verilerine erişilemiyor.'; reflect(); }
  return Object.freeze({ getState: () => service?.getState?.() || { supported: false }, openInsight: showInsight });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const boot = () => { if (window.TodayStartup?.getStatus?.().phase === 'ready') mountNotificationUI().catch(() => {}); };
  window.addEventListener('today:startup-ready', boot);
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', boot, { once: true });
  boot();
}
