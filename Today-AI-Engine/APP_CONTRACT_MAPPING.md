# Today App 2.9.0 → AI Engine Sözleşme Eşlemesi

## İnceleme kapsamı

Today App NUT-016.6 kaynakları ve dağıtım paketi salt okunur incelendi. Doğrulanan taban: App `2.9.0`, store schema `2`, çevrimdışı kabuk `today-v2-foundation-058`, referans rapor `822 PASS / 0 FAIL`. App dosyası, DOM'u veya kullanıcı verisi değiştirilmedi.

## Eşleme

| App üreticisi | Güncel App şekli | AI Engine sınırı | NUT-017.1 davranışı |
| --- | --- | --- | --- |
| Core günlük kayıt | `choice`, `color`, `note`, zaman/değişim alanları; isteğe bağlı `coreSkyLink` | `today-core` / `daily-checkin` | Seçim ve renk ayrı sınıflar; not hem `note` sınıfı hem `includeFreeText` ister. Değişim günlüğü alınmaz. |
| Health uyku | `durationMinutes`, `quality`, `recovery`, yatma/kalkma zamanı, not | `today-health` / `sleep-record` | Süre/kalite/toparlanma seçilir; saat ve not varsayılan dışarıda. |
| Health enerji | `energy`, `fatigue`, `body`, not | `today-health` / `energy-record` | Sayısal/kategorik ölçüler seçilir; not ayrıca onaylıysa alınır. |
| Health belirti | `symptoms`, `severity`, `bodyArea`, serbest alanlar | `today-health` / `symptom-record` | `symptoms` veri sınıfı açıkça onaylanmalıdır; serbest alanlar ayrıca korunur. |
| Health antrenman | Süre ve exercise ayrıntıları | `today-health` / `workout-record` | Süre ve adetler türetilir; ad/görsel/set/tekrar/kg alınmaz. |
| Nutrition | `today:nutrition:record:v1`, `schemaVersion: 1`, sürümlü record türleri | `today-health` / `nutrition-record` | Aktif, desteklenen hydration/nutrition/weight/activity kayıtları minimize edilir; `ai_draft` reddedilir. |
| Sky birth profile | Contract v1 doğum tarihi/saati/yeri | Olay zarfına konmamalı | Sunulsa bile `raw-sky-input-excluded`. |
| Sky observation context | Contract v1 seçili takip yeri ve koordinatlar | Olay zarfına konmamalı | Sunulsa bile `raw-sky-input-excluded`. |
| Sky moment | Contract v1 deterministik hesap, yorum yok | `today-sky` / `sky-moment` | Yalnız açık Sky izniyle, sembolik bölümde ve hassas yer/zaman bağlamı çıkarılarak. |
| Sky periods | Contract v1, `symbolicOnly: true` | `today-sky` / `sky-periods` | Yalnız sembolik bölüm; nedensellik/bilimsel kanıt olamaz. |
| Core–Sky link | Contract v1 kullanıcı başlatımlı snapshot | `today-sky` / `core-sky-symbolic-snapshot` | 10 gezegen ve güvenlik bayrakları doğrulanır; kesin yer/timezone çıkarılır. |

## App adaptör sınırı

AI Engine, Today App'in `STORAGE_KEY` değerini, Health Hub yerel anahtarlarını, `window.TodayStorage` nesnesini veya DOM yapısını bilmez. Entegrasyon şu tek yönlü sınır üzerinden yapılır:

1. Today App kendi veri katmanından kaydı okur.
2. App tarafındaki salt adaptör kaydı `input-event.schema.json` zarfına dönüştürür.
3. Kullanıcı amaç ve veri sınıflarını onaylar.
4. App, `context-build-request` nesnesini AI Engine'e verir.
5. Engine yalnız minimize `context-package` döndürür; App ana verisini yazmaz.

Health Hub uyku, enerji, belirti ve antrenman kayıtları bugün gerçek veri üretse de Nutrition gibi formal sürümlü JSON Schema'ya sahip değildir. NUT-017.1 bu açığı Engine içinde storage şekillerini kopyalayarak kapatmaz. Formalizasyon ve migration kararı App veri katmanında kalır.

## TB-018 uyumluluğu

Mevcut `TodayAI.requestProposal` adaptörü `{ granted, purpose, grantedAt }` biçiminde dar onay görünümü bekler. `toAppAdapterConsent()` yalnız geçerli ayrıntılı onaydan bu görünümü üretir; Core/Health/Sky kapsamları Engine tarafında kaybolmadan korunur. Dış işlem hâlâ mevcut approval gateway ve ayrı Connect katmanına tabidir.
