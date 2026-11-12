# PO1-I18N02 — Core/ortak metin kapsamı ve İngilizce hazırlık denetimi

12 Kasım 2026, TSİ. Yalnız yerel denetim/dokümantasyon; uygulama kodu, testler, dil davranışı veya veri değişmez.

## Başlangıç ve sınır

HEAD `b57dbceb53eb6a9aacc3bde709b4de096b77e38f`; kaynak `/workspace/Today-update-copy`, dal `task/t90-261101-po1-i18n02-update-copy`. Önceki6/6 audit ve dosya hashleri doğrulanıp73 kirli kaynak dosyası korunarak yeni yerel `task/t90-261101-po1-i18n02-coverage-review` dalı `/workspace/Today-core-copy-review` altında açıldı. Önceki ağaca/dallara dokunulmadı;stash/reset/clean/commit yok. PR1/2 salt okunur kontrolünde açık ve önceki `ede686d`/`b57dbce` başları aynı. Uzak CI yeni çalışma için çalışmadı.

Hedef: birikmiş metin bağlamaları gerçekten hangi yüzeyleri kapsıyor, hangi metinler hâlâ TR üretiliyor ve EN için ne eksik? Hedef dosyalar yalnız bu rapor, makine okunur COVERAGE-REVIEW.json, güncel durum,changelog,backlog; toplam5 belge. Boyut küçük/orta; Sol Medium. Depolama/migration/key,CSV,not/kayıt,modül özellikleri,çeviri uygulaması,dil tercihi/yeni EN,commit/push/PR/merge/deploy/CI rerun kapsam dışı.

## Bulgu

[Kaynak/hash/alan/sahiplik envanteri](T90-261101-PO1-I18N02-COVERAGE-REVIEW.json) dokuz kaynak dosyasını pinler. Home/modules/pick/calendar HTML'indeki harf içeren text node,aria-label,title,placeholder taraması146 aday alan çıkarır. Runtime yüzeyleri14 ayrı üretici grubu olarak incelendi; statik sayıya eklenmez. Alan sayıları hazır dil yüzdesi veya bütün uygulamanın eksiksiz envanteri değildir; diğer modül ekranları,CSS üretilen içerik ve bütün runtime DOM'u bu tarama kapsamına girmez.

| Statik aday sınıfı | Sayı | Anlamı |
|---|---:|---|
| Sözlüğe bağlanmış statik hedef |81| Core43 + ortak24 + istatistik14; hedefler gerçek DOM ile eşleşir |
| Runtime üreticisine zaten bağlı başlangıç metni |2| calPill ve chartLabel; statik bağlayıcıya ikinci kez verilmez |
| Başka owner'a devredilen |53| Settings içindeki52 AI alanı I18N06; Health kart açıklaması I18N03 |
| Bağlanmamış marka alanı |8| Core alt nav'daki4 isim ve4 aria etiketi; ürün adları sabittir,8 eksik Türkçe çeviri sayılmaz |
| Build metaverisi etiketi |1| Sadece label/template ileride değerlendirilebilir; sürüm değeri değişmez |
| İlk grafik erişilebilir fallback'i |1| “Grafik verisi hazırlanıyor.”; render sırasında üzerine yazılır, mevcut runtime kusuru iddiası değildir |

Statik hedeflerin tamamı mevcut, ancak bu EN hazırlığına eşit değildir. Önemli açıklar:

1. **Takvim seçim/renk adları ve istatistikte en sık seçim:** çevrilmiş cümle şablonunun parametresi hâlâ choiceLabelTR/colorLabelTR üzerinden gelir. Aynı yardımcılar CSV de üretir. Ortak helper'ı çevirmek dışa aktarım sözleşmesini sessizce değiştirir; ayrı salt okunur UI etiketi gerekir.
2. **Tarih yerelleştirme:** Core/ay köprüsü tr-TR sabit; takvim gün aria tam tarihi doğrudan tr-TR kullanır. Dil adaptörü daha sonra sunumda uygulanırken yerel tarih/gün anahtarı/editability ve sıralama korunmalıdır.
3. **Sahiplik sınırı:** moduleHealthDesc HTML/katalog “Beslenme, su ve yaşam” derken HealthHub “Beslenme, spor ve yaşam” yazar. Kaynak literal doğrulaması runtime çeviri kanıtı değildir. Settings içindeki AI panelinin52 alanı da ortak Core bağlaması tamamlandı diye çevrilmiş sayılamaz.
4. **Erken hata fallback'leri:** startup/error/update köprüleri TR'de bağlı; ESM'den önceki hata Türkçe kalabilir. Yeni EN garantisi verilmeden fail-safe ve dil değişim kapsamı ayrıca kabul edilmelidir. Tanı kayıtları/console/event/kod metaverisi çeviri hedefi değildir.

## İngilizce durumu ve kapılar

Katalog133 girdi: **66 unreviewed-draft,67 untranslated,0 gözden geçirilmiş EN**. Hazır/draft ayrımı korunur;133 girdinin her biri anlam/terim/erişilebilirlik/parametre açısından incelenmeden Core EN tam denmez. Aynı kalacak marka adları da karar açısından gözden geçirilmelidir. Makine envanteri bütün key listelerini ve parametreli6 girdiyi (color; date/relation/record/hint; choice/count; title/total; iki code şablonu) taşır.

Runtime AVAILABLE_LANGUAGES yalnız ['tr']; HTML lang tr, mevcut TR sözlük133 ve cache foundation-093 aynı. Bu aşama yeni çeviri yazmaz;EN seçimini veya manuel kalıcı tercihi etkinleştirmez. Kalan UI etiket/tarih/fallback kapsamı, İngilizce sözlük/terim incelemesi, bütün modüllerde tamlık/placeholder/a11y kabulü,tercih/yedek kapsamı ve gerçek cihaz dil değişim kabulü ayrı kapılardır. Tarih/süre uydurulmaz.

## Test ve doğrulama

Kanıt `/workspace/.cache/today-evidence/core-copy-review-20261112`: baseline,scan.cjs/json/log,verify.cjs/verification.json/log,audit.py/json ve summary.

- İlk envanter doğrulaması7/8: doğrulayıcı bir parent'ın tüm textContent'ini, içindeki tek text node ile karşılaştırdı. AI amaç paragrafında birden çok metin düğümü var. Envantere textNodeIndex eklenip gerçek node ayrı doğrulandı; runtime değişmedi. İlk7/8 logu korunur, başarılı sayılmaz.
- Son envanter **8/8 PASS**: dosya hashleri,146 gerçek DOM alanı/tekil node,81 binding,53 owner ayrımı,14 üretici/ham kaynak satırı,EN listeleri/parametreler,TR-only readiness ve mevcut helper/CSV ortaklığının VM karakterizasyonu.
- Mevcut katalog testi **12/12 PASS** (`node tests/core-tr-catalog.test.cjs`).
- Son kaynak/ref/veri etkisi/kapsam denetimi **6/6 PASS**,0FAIL:73 kaynak dosyası/dal/HEAD/status ve mevcut refs, tam5 belge deltası,boş staging/whitespace,tüm runtime/test/bağımlılık/cache dosyalarının aynı olması ve doğrulanmış envanter hashleri. Bu denetim dilimi yerel olarak tamamlandı;çözülmemiş doğrulama hatası yok. Yeni uygulama kodu olmadığından tam npm/AI/browser/Engine/benchmark paketleri tekrarlanmadı. Önceki1292/1292 platform,335/335 AI/Radio,10/10 browser sonuçları önceki UPDATE-COPY diliminin kanıtıdır; yeni koşu gibi sayılmaz.

## Sonraki dar uygulama ve durma noktası

Öneri: **yalnız takvim aria ve istatistik özeti için seçim/renk UI etiketi köprüsü**. Mevcut dictionary key'leri ve bilinen A/B/C,12 renk kimliği kullanılır; kayıt ID'leri/şema ve CSV'nin Türkçe choiceLabelTR/colorLabelTR helper'ları aynen kalır. Yeni task/NUT/TB kimliği tahsis edilmez; aynı I18N02 içinde ayrı kullanıcı tetiklemesi gerekir.

Kabul: provider hazır/yok,üç seçim/12 renk/bilinmeyen ID,literal placeholder/HTML,geçmiş/bugün aria ve istatistik parametresi; CSV gerçek dosyası/başlıkları/veri aynı,ham not aria'ya taşınmaz. Önce hedefli,sonra gerekli birleşik kapı ve seçilmiş iki motor kabulü. Bu rapor uygulamayı kendiliğinden başlatmaz.

Veri etkisi yok;canlı değişmedi. Tam restore,kısmi yazma rollback'i,güncel gerçek iPhone15/iOS18.7.8 Safari/kurulu PWA/Windows ve pilot kapıları açık. Yalnız kaynak/sentetik karakterizasyon yapıldı;fiziksel test sonucu yok. Önerilen model Sol Medium;dar kaynak incelemesi ve değişmeyen runtime için tam paketleri tekrarlamamak kaynak optimizasyonudur. Sonuç kaydedilince burada durulur.
