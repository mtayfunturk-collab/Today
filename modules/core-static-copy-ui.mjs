import { formatDatePresentation } from './date-presentation.mjs';
import { CORE_TR } from './locales/core-tr.mjs';
import { applyCoreStaticCopy } from './core-static-copy.mjs';

// Module scripts run after HTML parsing. Existing TR HTML remains on load failure.
applyCoreStaticCopy(document);

// Optional synchronous copy for classic producers; no replay, event or storage.
const keys = ['core.readOnly', 'core.saved', 'core.colorSaved', 'core.noteSaved',
  'core.noteFailed', 'core.todayCleared', 'core.changeFailed'];
if (!Object.hasOwn(window, 'TodayCoreMessages')) {
  Object.defineProperty(window, 'TodayCoreMessages', {
    value: Object.freeze(Object.fromEntries(keys.map(key => [key, CORE_TR[key]]))),
    writable: false, configurable: false
  });
}

// Presentation only: callers retain their local Date/key and render lifecycle.
if (!Object.hasOwn(window, 'TodayCalendarCopy')) {
  Object.defineProperty(window, 'TodayCalendarCopy', {
    value: Object.freeze({
      title: CORE_TR['calendar.title'],
      messages: Object.freeze(Object.fromEntries(['past','future','today','noRecord','hasNote','color','editHint'].map(key =>
        [key, CORE_TR[`calendar.day.${key}`]]))),
      dayLabel(input) {
        if (!input || typeof input.dateLabel !== 'string' || typeof input.timeLabel !== 'string' ||
            typeof input.recordLabel !== 'string' || typeof input.editable !== 'boolean') return null;
        const template = CORE_TR['calendar.day.aria'] || '{date}, {relation}, {record}{hint}';
        const values = { date: input.dateLabel, relation: input.timeLabel, record: input.recordLabel,
          hint: input.editable ? (CORE_TR['calendar.day.editHint'] || '. Düzenlemek için Enter veya Boşluk tuşuna basın') : '' };
        return template.replace(/\{(date|relation|record|hint)\}/g, (_, key) => values[key]);
      },
      weekdays: Object.freeze(['mon','tue','wed','thu','fri','sat','sun'].map(day =>
        Object.freeze([CORE_TR[`calendar.weekday.${day}.short`], CORE_TR[`calendar.weekday.${day}.full`]]))),
      format(date, kind) {
        return formatDatePresentation(date, kind, 'tr');
      }
    }), writable: false, configurable: false
  });
}

// Read-only presentation of values already computed by the classic producers.
if (!Object.hasOwn(window, 'TodayStatisticsCopy')) {
  const fill = (template, values) => template.replace(/\{(choice|count|title|total)\}/g, (_, key) => String(values[key]));
  Object.defineProperty(window, 'TodayStatisticsCopy', {
    value: Object.freeze({
      empty: CORE_TR['statistics.summary.empty'] || 'Son 7 günde seçim yok.',
      titles: Object.freeze(Object.fromEntries(['hour','day','week','month'].map(mode => [mode, CORE_TR[`statistics.${mode}`]]))),
      summary(choice, count) {
        if (typeof choice !== 'string' || !Number.isSafeInteger(count) || count < 1) return null;
        return fill(CORE_TR['statistics.summary.most'] || 'Son 7 günde en çok: “{choice}” ({count} kez)', { choice, count });
      },
      chartSummary(title, total) {
        if (typeof title !== 'string' || !Number.isSafeInteger(total) || total < 0) return null;
        return fill(CORE_TR['statistics.chart.accessible'] || '{title}. Dönem sonundaki birikimli giriş sayısı: {total}.', { title, total });
      }
    }), writable: false, configurable: false
  });
}

// Optional startup presentation. Failure screens never depend on this module.
if (!Object.hasOwn(window, 'TodayStartupCopy')) {
  Object.defineProperty(window, 'TodayStartupCopy', {
    value: Object.freeze(Object.fromEntries(['startup.failed', 'common.retry',
      'startup.managerFailed', 'startup.moduleFailed', 'startup.migrationFailed', 'startup.code']
      .map(key => [key, CORE_TR[key]]))),
    writable: false, configurable: false
  });
}

// Exact known fallback messages only. Logs and custom messages retain their owner.
if (!Object.hasOwn(window, 'TodayErrorCopy')) {
  const messageSources = [
    [
      "error.message.startup",
      "Today başlatılamadı. Kayıtların silinmedi."
    ],
    [
      "error.message.route",
      "Bu ekran şu anda açılamadı. Kayıtların silinmedi."
    ],
    [
      "error.message.history",
      "Tarayıcı geri hareketi kullanılamadı. Uygulama içindeki geri düğmelerini kullanabilirsin."
    ],
    [
      "error.message.module",
      "Bu modül şu anda açılamadı. Kayıtların silinmedi."
    ],
    [
      "error.message.state",
      "Değişiklik cihazına tam kaydedilemedi. Mevcut güvenlik kopyası korundu."
    ],
    [
      "error.message.migration",
      "Today verileri güvenli biçimde hazırlanamadı. Mevcut kayıtların ve güvenlik kopyan korundu."
    ],
    [
      "error.message.offline",
      "Çevrimdışı kullanım hazırlanamadı. Uygulamayı çevrimiçi kullanmaya devam edebilirsin."
    ],
    [
      "error.message.update",
      "Yeni sürüm şu anda uygulanamadı. Mevcut sürümü kullanmaya devam edebilirsin."
    ],
    [
      "error.message.ai",
      "Yapay zekâ desteği şu anda kullanılamıyor. Today’i kullanmaya devam edebilirsin."
    ],
    [
      "error.message.connect",
      "Bağlantılı işlem şu anda tamamlanamadı. Today’i kullanmaya devam edebilirsin."
    ],
    [
      "error.message.resource",
      "Uygulama dosyalarından biri yüklenemedi. Kayıtların silinmedi."
    ],
    [
      "error.message.unexpected",
      "Beklenmeyen bir sorun oluştu. Kayıtların silinmedi."
    ],
    [
      "error.message.promise",
      "Beklenmeyen bir işlem hatası oluştu. Kayıtların silinmedi."
    ]
  ];
  Object.defineProperty(window, 'TodayErrorCopy', {
    value: Object.freeze({
      labels: Object.freeze(Object.fromEntries(['common.retry', 'error.home', 'error.ok', 'error.close', 'error.code']
        .map(key => [key, CORE_TR[key]]))),
      messages: Object.freeze(Object.fromEntries(messageSources.map(([key, source]) => [source, CORE_TR[key]])))
    }), writable: false, configurable: false
  });
}

// Update labels are presentation only; the classic manager owns approval/state.
if (!Object.hasOwn(window, 'TodayUpdateCopy')) {
  Object.defineProperty(window, 'TodayUpdateCopy', {
    value: Object.freeze(Object.fromEntries(["update.title", "update.ready", "update.apply", "update.later", "update.applying", "update.applyingButton"]
      .map(key => [key, CORE_TR[key]]))),
    writable: false, configurable: false
  });
}

// UI labels for stored IDs only; the Turkish export helpers remain independent.
if (!Object.hasOwn(window, 'TodayCoreLabels')) {
  Object.defineProperty(window, 'TodayCoreLabels', {
    value: Object.freeze({
      choices: Object.freeze(Object.fromEntries(['A', 'B', 'C']
        .map(id => [id, CORE_TR[`core.choice.${id.toLowerCase()}.title`]]))),
      colors: Object.freeze(Object.fromEntries(['navy', 'orange', 'red', 'blue', 'yellow', 'green',
        'deep', 'pink', 'purple', 'teal', 'mint', 'gray'].map(id => [id, CORE_TR[`color.${id}`]])))
    }), writable: false, configurable: false
  });
}

// Initial presentation only: never overwrite a chart renderer's live summary.
{
  const loading = document.getElementById?.('chartSummary');
  const message = CORE_TR['statistics.chart.loading'];
  if (loading && loading.childElementCount === 0 &&
      loading.textContent.trim() === 'Grafik verisi hazırlanıyor.' &&
      typeof message === 'string' && message.trim()) {
    loading.textContent = message;
  }

  const build = document.getElementById?.('buildTag');
  if (build && build.childElementCount === 0) {
    try {
      const version = window.TodayVersion?.getCurrentVersion?.()?.appVersion;
      if (typeof version === 'string' && version.trim()) {
        const candidate = CORE_TR['common.build'];
        const template = typeof candidate === 'string' && candidate.includes('{version}')
          ? candidate : 'build: {version}';
        build.textContent = template.replace(/\{version\}/g, () => version);
      }
    } catch (error) {
      // Keep the original inline build label if version metadata is unavailable.
    }
  }
}
