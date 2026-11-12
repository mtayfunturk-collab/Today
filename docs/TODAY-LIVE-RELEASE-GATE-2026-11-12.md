# Today canlı güncelleme kapısı — 12 Kasım 2026

**12 Kasım güncellemesi:** Aşağıdaki ilk envanter ve entegrasyon maddeleri tarihsel teşhistir. Güncel yerel adayda şifreli tam export ve salt okunur restore önizlemesi var; sentetik restore/rollback prototipi yalnız testten çağrılıyor. Gerçek Chromium'da mevcut Worker kilidiyle sentetik kurtarma ve yeni navigasyon beklemesi 5/5 geçti; tam platform 1446/1446 geçti. BFCache sondasında geri navigasyon bekledi, ancak eski sayfa önbellekten canlanmadı; BFCache kabulü açık. Ayrıntılar `TODAY-LIVE-RESTORE-PREVIEW.md`, `TODAY-LIVE-SYNTHETIC-RECOVERY.md` ve `TODAY-LIVE-WRITER-ADMISSION.md`. Üretim restore, WebKit, gerçek iPhone/Windows yeni aday kabulü, uzak CI ve Pages yayını hâlâ açık. Canlı tarih; bu kapılar, adayın yayın dalına güvenli aktarımı ve kullanıcı cihaz kabulü bitmeden kesinleştirilemez.

Kullanıcı önemli düzeltmelerden sonra canlı Today'i kullanarak geliştirmeye devam etmek istedi. Bu istek canlıya geçiş hazırlığını yetkilendirir; veri koruma ve doğrulama kapıları hâlâ uygulanır. Yerel kaynak: `task/t90-261101-po1-i18n02-en-module-matrix`, HEAD `b57dbceb53eb6a9aacc3bde709b4de096b77e38f`, 91 korunmuş kirli dosya. Bu belge ayrı `task/t90-261101-live-gate` worktree'sinde oluşturuldu.

## Gerçek durum

- GitHub PR #1/#2 açık ve taslak; uzak başlar `ede686d`/`b57dbce`. Main'e merge edilmedi.
- GitHub Pages `/Today/modules/version.js` HTTP200, App2.23.3; `/Today/sw.js` HTTP200, foundation-082. Pages canlı Radio sürümüdür; yerel Core/UX/I18N düzeltmelerini içermez.
- Kullanıcının verdiği Netlify site kökü ve index adresi 12 Kasım salt okunur HTTPS kontrolde HTTP401 verdi. Erişilebilir yeni sürüm veya deploy doğrulanmadı. Netlify yönetim bağlantısı/oturumu yok; kimlik doğrulamasını atlama girişimi yapılmadı.
- Yerel adayda App2.23.3/schema2, SW foundation-096. Son üretim kodu değişikliği sonrası platform1322/1322, AI/Radio335/335 ve seçili Chromium/WebKit16/16 PASS kaydı vardır. Sonraki işler katalog/belgedir; bu kayıt yeni birleşik yayın adayı veya fiziksel cihaz sonucu değildir.

## Yayını engelleyen somut açıklar

1. Önceki T90-06 şifreli dışa aktarım ve T90-07 sentetik geri yükleme prototipleri farklı NUT tabanı/ayrı worktree'dedir. Radio+Core/UX/I18N güncel adayına entegre edilmedi. `backup.html` ve üretim backup modülleri bu adayda yoktur.
2. Eski tam veri kapsamı 23 localStorage anahtarı + Nutrition IndexedDB 3 store idi. Güncel adayın bütün kalıcı veri türleri ve değişmiş sahiplikleriyle yeniden envanter/uyarlama ve gerçek ürün dosyası round-trip kabulü gerekir. Ham dışa aktarım veya yalnız Core CSV tam yedek değildir.
3. Üretim geri yüklemede eski/BFCache yazıcı, pending not ve transaction yarışları, başarısız/kısmi işlemde önceki veri korunumu kanıtlanmadı. Önceki SP02 test-only sentetik prototip bu kapıyı kapatmaz.
4. Güncel birleşik adayda gerekli tam test kapıları ve gerçek iPhone15 Safari/kurulu PWA ayrı kabul henüz yapılmadı. Kullanıcının eski dört ekran önizleme ve Radio ses kabulü bu adayın fiziksel kabulü değildir.

## Güvenli ilerleme

A. Güncel Radio tabanında kalıcı veri anahtar adları eski exporter ile 23/23 ve Nutrition3/3 eşleşti; [eşleme](TODAY-LIVE-DATA-INVENTORY.md) var. Payload/round-trip hâlâ açık. B. Mevcut şifreli export/validator tasarımını veri ve eski writer korunarak tek adaya kontrollü taşı; yeni şema/migration varsa somut onay paketi gerekir. C. Boş/sentetik hedefe tam restore, kesinti ve yarış; bağımsız yeniden açma ve veri eşitliği. D. Birleşik platform/AI/Radio/browser/CI kanıtı ve ayrı iPhone Safari/PWA ile Windows kabul. E. Pages yayın kaynağında atomik sürüm ve cache güncellemesi, HTTPS doğrulaması, sonra telefonda veri/gezinti/Radio/Core kontrolü. Netlify kullanılacaksa HTTP401 erişim nedeni yetkili panelden giderilir; anonim erişim test edilir.

Şu anda publish/push/PR/merge yapılmadı. Canlı uygulama eski çalışır sürümde kalır. Bu rapor bitiş tarihi veya test geçişi icat etmez; bir sonraki dar görev A'dır.
