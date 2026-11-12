# Birleşik Today adayı — GitHub aktarım öncesi kayıt

12 Kasım 2026, TSİ. Taban `feature/today-radio` / `b57dbceb53eb6a9aacc3bde709b4de096b77e38f`; yerel dal `task/t90-261101-live-synthetic-recovery`. Mevcut Radio ses/mini oynatıcı korunur. Yerel aday Core merkezli gezinme, 12 renk, Core/Health/Sky/Radio-AI hizalamaları, Türkçe statik metin bağlamları, şifreli tam dışa aktarım ve salt okunur geri yükleme önizlemesi içerir. İngilizce seçim, sesli not, favori/metaveri, güvenli giriş ve üretim restore etkin değildir. Sentetik `backup-recovery.mjs` üretim girişine bağlanmaz.

Kabul: `npm test` **1446/1446 PASS** (41 grup); AI/Radio birleşik **335/335 PASS**; AI Engine toplam **403/403 PASS**; sentetik benchmark **16/16 vaka, sıfır güvenlik ihlali**. Gerçek Chromium backup sayfası **4/4**, sentetik geri yükleme ve tek pencere kilidi **5/5**, çevrimdışı Core **3/3 PASS**. Bu sonuçlar yeni uzak dal CI veya fiziksel iPhone kabulü değildir. WebKit bu ortamda sistem kütüphanesi yokluğundan çalıştırılamadı. Kanıt `/workspace/.cache/today-evidence/synthetic-recovery-20261112/`.

Veri etkisi: uygulama kayıt anahtarı, Nutrition store/şema ve migration değiştirilmedi; testler ayrı sentetik profilde çalıştı. SW kabuğu `foundation-100` ve 141 dosyadır. Canlı Pages `App2.23.3/foundation-082` olarak kaldı.

Uzak aday için amaç Radio dalını hedefleyen **taslak**, birleştirilmemiş PR ve yeni CI kanıtı oluşturmaktır. GitHub Pages yayını için ayrıca üretim geri yükleme güvenliği, adayın gerçek iPhone Safari/kurulu PWA ve Windows kabulü gerekir. `main` doğrudan değiştirilmeyecek.

## İlk uzak CI ve native paket düzeltmesi

Commit `acc991ef` yeni `task/t90-261101-live-synthetic-recovery` dalına gönderildi; Radio dalına karşı taslak PR #3 açıldı. Run `43288730436` platform job'ı başarılı, Android native preview `Prepare bundled native preview` adımında `Asset is outside the native allowlist: backup.html` ile başarısız oldu. Yeni yedek sayfası SW uygulama kabuğunda mevcut; native paketleyici yalnız `index.html` gibi açık kök dosyalarını kabul ediyordu. Dar düzeltme `backup.html` dosyasını native uygulama varlık izin listesine ekler; kullanıcı dosyası veya depo dışı yol kabul edilmez. Yerel `npm --prefix native test` **1/1 PASS** ve `npm --prefix native run build:web` **PASS** (140 izinli varlık + üç bootstrap/privacy/license dosyası). Diğer CI job'ları ilk run sırasında henüz tamamlanmamıştı; yeni commit için uzak CI sonucu ayrıca izlenmelidir.
