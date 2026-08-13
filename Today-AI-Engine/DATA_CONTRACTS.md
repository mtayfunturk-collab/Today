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
- `analysis-output.schema.json`: Açıklanabilir analiz ve onay bekleyen işlem taslakları.
- `approval-decision.schema.json`: Kullanıcının onay, ret veya düzenleme kararını kaydeder.
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
