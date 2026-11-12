# PO1-I18N02 — Dinamik Core/ortak EN kapsam envanteri

12 Kasım 2026, TSİ. Başlangıç `b57dbceb53eb6a9aacc3bde709b4de096b77e38f`; yerel dal `task/t90-261101-po1-i18n02-en-runtime-inventory`. Kaynak EN inceleme dalındaki 87 kirli dosya ayrı worktree içine korundu. Bu görev yalnız mevcut kodu ve belgeleri okur; yeni dil davranışı eklemez.

## Güncel kaynak bulgusu

Önceki `COVERAGE-REVIEW.json` envanterindeki **14 üretici grubu** yeniden sınıflandırıldı. Eski satır/hash işaretleri tarihsel kanıttır; bu tablo güncel kodu `index.html`, `modules/core-static-copy-ui.mjs`, `modules/core-static-copy.mjs`, `modules/date-presentation.mjs`, `modules/health-hub.js` ve ilgili manager dosyalarından okur. Grup sayısı dil hazırlık yüzdesi değildir.

| Grup | Mevcut Türkçe sunum | İngilizce kabulündeki açık iş |
|---|---|---|
| Core durumları | 7 anahtar `TodayCoreMessages` üzerinden, `index.html` gerçek save/reset üreticisine bağlı | EN sağlayıcı ve her durumun başarısızlık semantiği |
| Takvim başlığı/hafta günleri | `TodayCalendarCopy` başlık ve 7 kısa/tam gün çifti | EN görünüm ve ekran okuyucu kabulü |
| Core/ay/gün tarihleri | `calendarDate` üç noktada salt sunum `formatDatePresentation(...,'tr')` kullanır; helper açık EN çağrısını destekler | Seçilen dile bağlama; gün anahtarı ve editability ayrı kalmalı |
| Seçim/renk, takvim aria ve özet | `TodayCoreLabels` 3 seçim/12 renk salt UI etiketi sağlar; CSV Türkçe helper'ları ayrı kalır | EN etiketleri ve parametre birleşimi; CSV sözleşmesini koruma |
| İstatistik başlık/özet/grafik | `TodayStatisticsCopy` başlık, boş/en sık seçim ve erişilebilir grafik toplamını sağlar | EN başlık/şablon, gerçek grafikte sayısal ve ekran okuyucu kabulü |
| İlk grafik metni ve build etiketi | İsteğe bağlı ESM girişinde bir kez TR sözlüğüne bağlanır; canlı renderer'ın içeriği korunur | EN ilk yükleme/metadata fallback ve geç bootstrap kabulü |
| Startup/error/update | İsteğe bağlı TR sağlayıcıları bağlı; hata yöneticisi ESM'den önce yüklenebilir | Erken hata fallback'i, izin/uygulama durumu ve EN erişilebilirlik kabulü |
| Core alt nav ürün adları | 4 ad + 4 aria etiketi sabit ürün markası | Ürün sahibinin marka adlarını aynı tutma kararı; eksik çeviri sayılmıyor |
| Health modül kartı | HTML ve katalog `Beslenme, su ve yaşam`; HealthHub `modules/health-hub.js:5536` çalışınca `Beslenme, spor ve yaşam` yazar. Ortak binding bilinçli olarak kart açıklamasını atlar | I18N03 sahibinde tek kaynak metin kararı; iki farklı EN metni varmış gibi kapsam tam sayılmamalı |
| Ayarlar içindeki AI paneli | 52 statik aday AI sahibi altında | I18N06; Core katalog tamlığına eklenemez |
| CSV ve kayıt günlüğü | Türkçe CSV başlıkları ve seçim/renk adları, ham notlar/kayıt ID'leri korunur | Veri ve dışa aktarım sözleşmesi için ayrı karar; kullanıcı metni çevrilmez |

135 Core/ortak anahtarın tamamında EN **taslak** bulunur; bunlar çalışma zamanında yüklenmez. `AVAILABLE_LANGUAGES` yalnız `['tr']`, `completeEnglishRelease=false`. Türkçe köprülerin varlığı EN ekran kapsamı veya dil değiştirme kabulü değildir. Uygulama genelinde Health, Sky, Radio ve AI henüz İngilizce kabulünden geçmedi; açıkça eksik çevirilerle İngilizce seçimi açılmamalı.

## Karar ve sonraki dilim

Health açıklaması için aynı kartta iki sahip var. Ürün metni hangi açıklamayı kullanacaksa I18N03 altında netleştirilmeli; başlangıç ve çalışma zamanı kaynakları birlikte güncellenmeli. Core dilini açma öncesi ayrı dar görev: EN sağlayıcı/bağlama tasarımı, dil tercihi ile veri yedek kapsamı, erken hata fallback'i ve gerçek cihazda dil geçişi kabul koşullarını somutlaştırmak. Yeni kalıcı anahtar veya otomatik dil geçişi bu envanterde uygulanmaz.

Kod, test, depolama, şema, notlar, Health/AI iş mantığı ve kullanıcı verisi değişmedi. Fiziksel iPhone kabulü ve uzak CI yapılmadı. Commit/push/PR/merge/deploy yok. Önceki tam platform testleri bu belge görevine yeni test sonucu sayılmaz.
