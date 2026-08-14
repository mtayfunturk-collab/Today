# Veri Sözleşmeleri

## Kurallar

- Her olay `schemaVersion`, benzersiz kimlik, kaynak, tür, zaman ve payload taşır.
- Tarihler ISO 8601; kullanıcının yerel günü ayrıca `localDate` alanındadır.
- `source` yalnızca `today-core`, `today-health` veya `today-sky` olabilir.
- Yeni zorunlu alan, anlam değişikliği veya kırıcı enum değişikliği `schemaVersion` artışı gerektirir.
- Geriye uyumlu isteğe bağlı alan eklenmesi sürüm notuna yazılır; yine de sözleşme test edilir.
- AI kanıtı giriş olayının kimliğine bağlanır; yalnızca gösterim metnine dayanmaz.
- Ham serbest metin varsayılan olarak Connect veya bulut sağlayıcısına aktarılmaz.
- Today App kayıt şekilleri Engine içinde yeniden tanımlanmaz; App tarafındaki adaptör ortak olay zarfını üretir.

## Sözleşmeler

- `input-event.schema.json`: Core, Health ve Sky olaylarının ortak zarfı.
- `analysis-request.schema.json`: Tek istekli Context Package, sabit analiz capability'si ve çağrı zamanını taşıyan analiz isteği.
- `analysis-output.schema.json`: Açıklanabilir analiz ve onay bekleyen işlem taslakları.
- `approval-decision.schema.json`: Kullanıcının onay, ret veya düzenleme kararını kaydeder.
- `decision-receipt.schema.json`: Kararın izlenebilir fakat kalıcı olmayan, istek-süreli sonucunu kaydeder.
- `pattern-observation-request.schema.json`: Yedi günlük Context Package ve dar Core–uyku tekrar capability'sini taşır.
- `pattern-observation-output.schema.json`: Çok günlük betimleyici gözlemin dayanak, güven, belirsizlik, seçenek, onay ve sınırlarını taşır.
- `pattern-feedback.schema.json`: Kullanıcının geçerli örüntü gözlemine verdiği üç açık yanıttan birini ve yanıt zamanını taşır.
- `pattern-feedback-receipt.schema.json`: Geri bildirimin gözleme bağlı, cihaz-içi ve kalıcı olmayan sonucunu taşır.
- `data-usage-consent.schema.json`: Amaç, kaynak, veri sınıfı, serbest metin ve cihaz-içi işleme izni.
- `context-build-request.schema.json`: Onay, tarih penceresi ve ortak olay zarflarını taşıyan deterministik build isteği.
- `context-package.schema.json`: Minimize Core/Health bölümleri, ayrı sembolik Sky bağlamı, provenance, omission, redaction ve sınır beyanları.

## NUT-017.1 olay türleri

| Kaynak | Kabul edilen olaylar | Temel veri sınıfları |
| --- | --- | --- |
| `today-core` | `daily-checkin` | `daily-choice`, `color`, isteğe bağlı `note` |
| `today-health` | `sleep-record`, `energy-record`, `symptom-record`, `workout-record`, `nutrition-record` | `sleep`, `energy`, `symptoms`, `activity`, `hydration`, `nutrition`, `weight` |
| `today-sky` | `sky-moment`, `sky-periods`, `core-sky-symbolic-snapshot` | `moment`, `periods`, `core-sky-snapshot` |

`sky-birth-profile` ve `sky-observation-context` olay olarak sunulsa bile bağlama alınmaz. Nutrition olayında App'in `today:nutrition:record:v1` kaydı korunur; Engine yalnız desteklenen aktif record türlerinden gerekli sayısal alanları seçer ve `ai_draft` kaynağını geri besleme dayanağı yapmaz.

## Versiyon politikası

Engine bilinmeyen büyük şema sürümünü işlemeyi reddeder. Hatalı tekil olaylar paket içindeki `omissions` listesinde değersiz gerekçeye dönüşür; geçersiz onay ise tüm build işlemini durdurur. Migration, Today App veri katmanının sorumluluğudur; Engine ana veriyi migrate etmez.

## NUT-017.3 analiz isteği

`analysis-request` v1 yalnız `daily-support-suggestion` capability'sini kabul eder ve doğrudan `context-package` v1 referansı taşır. İstek zamanı bağlamın üretim zamanından önce olamaz. Analiz katmanı App olaylarını, DOM'u veya depolama anahtarlarını yeniden okumaz; yalnız verilen ve onay fişi içeren Context Package üzerinde çalışır.

`analysis-output` v1 değiştirilmemiştir. Her başarılı çıktı gerçek `eventId` değerlerine bağlı `evidence`, 0–1 aralığında kural kapsamı `confidence`, görünür `uncertainty`, kullanıcı `alternatives`, `requiresUserApproval=true` ve yalnız `pending-user-approval` işlem taslakları taşır.

NUT-017.3.1'de `no-matching-rule` hata ayrıntısı olarak eklenen `ruleEvaluation`, başarılı AI çıktı sözleşmesinin parçası değildir. Yalnız doğrulanmış Context Package'ten seçilen izinli Core/uyku gözlemlerini, sabit eşik ve aynı-tarih kontrollerini, kontrollü gerekçe kodlarını taşır. Geçersiz analiz isteğinde üretilmez.

## NUT-017.4 onay kararı

`approval-decision` v1 değiştirilmeden kullanılır. Her kayıt `decisionId`, `analysisId`, `actionId`, karar ve zamanı taşır. `edited` kararı `editedPayload` gerektirir; NUT-017.4'ün ilk dar uygulaması yalnız `HH:MM` biçimindeki `reminderTime` alanını kabul eder.

Karar işlemcisi yalnız `pending-user-approval` durumundaki mevcut taslağı kabul eder. Düzenleme sonucu üretilen yeni taslak tekrar `pending-user-approval` kalır. Karar kaydı Engine/App ana verisine yazılmaz; karar zamanı UI tarafından açık kullanıcı etkileşimi sırasında verilir.

## NUT-017.5 karar makbuzu

`decision-receipt` v1; `receiptId`, `decisionId`, `analysisId`, `actionId`, sonuç, olay zamanı, aktör, işlem durumu, kapsam ve etki beyanlarını taşır. Düzenleme sonucunda `replacementActionId` zorunludur ve yeni taslağın yeniden onay istediği belirtilir.

Makbuz üreticisi yalnız geçerli NUT-017.4 karar sonucunu kabul eder. Karar ve işlem taslağı kimlikleri/durumları uyuşmazsa fail-closed reddeder. Kapsam `device-only` ve `request-scoped`, `persistent=false`, dış alıcı `null`; eylem, Connect, kalıcı audit ve dış aktarım bayrakları `false` olmak zorundadır. Makbuz yeni bir Today App kayıt şekli veya storage anahtarı değildir.

## NUT-017.6 örüntü gözlemi

`pattern-observation-request` v1 yalnız `core-sleep-recurrence` capability'sini, istek zamanını ve `context-package` v1'i kabul eder. Context penceresi tam 7 yerel gün olmalı; cihaz-içi, istek-süreli onay ve sembolik Sky sınırları bozulmamalıdır.

`pattern-observation-output` v1; gözlem kimliği, özet, pencere sayıları, eşleşen günlere ait Core/Health dayanakları, gözlem gücü, belirsizlikler, seçenekler, onay durumu ve etki sınırlarını taşır. Sayısal güç puanı yalnız pencere kapsamı ile tekrar oranından türetilir ve `probabilityClaim=false` ile işaretlenir. Çıktı eylem taslağı içermez; `approval.status=not-required`, `causalityClaim=false`, `skyUsed=false` ve `actionProposed=false` sabittir.

## NUT-017.7 örüntü geri bildirimi

`pattern-feedback` v1; geri bildirim kimliği, sözleşmeye uygun örüntü gözlemi, `resonates`, `does-not-resonate` veya `unsure` yanıtı ve açık etkileşim zamanını taşır. İşlemci gözlemi yeniden üretmez; içeriğin dayanak, güven, onay ve güvenlik sınırlarını doğrulayarak değiştirilmiş gözlemi reddeder.

`pattern-feedback-receipt` v1; geri bildirim ve gözlem kimliklerini, kullanıcı yanıtını, zamanı, kapsamı ve etkileri bağlar. Kapsam `device-only`, `request-scoped`, `persistent=false`, dış alıcı `null` olmak zorundadır. Gözlem/güven değişikliği, model güncellemesi, hafıza yazımı, eylem, Connect, kalıcı audit ve dış aktarım bayraklarının tümü `false` kalır. Makbuz Today App ana kaydı veya storage anahtarı değildir.
