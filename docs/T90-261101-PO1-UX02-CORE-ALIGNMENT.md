# PO1-UX02 — Mevcut Core görünümünde dar hizalama uygulaması

10 Kasım 2026. Yerel dal `task/t90-261101-po1-ux02-core-alignment`; başlangıç Radio **b57dbceb53eb6a9aacc3bde709b4de096b77e38f**, App2.23.3/schema2/foundation-082. [Doğrulanmış Radio test tabanından](T90-261101-07-RADIO-TEST-BASELINE.md) devam edilir. Mevcut uygulama görünümü korunarak ilk gerçek ürün CSS değişikliği yapıldı; ayrı statik önizleme ürün ekranının yerine kopyalanmadı. Henüz commit/push/PR/yayın yoktur.

## Değişiklik

Tek uygulama dosyası `index.html`: yeni CSS kurallarının tamamı `[data-view="pick"]` altında. HTML/inline JS, DOM ID'leri, metinler, yedi renk kimliği, save/debounce ve router handler'ları byte düzeyinde korunur. Health/Sky/Radio/global kabuk stilleri değiştirilmez.

- Core başlığı44px / esnek tarih /44px grid; tarih optik merkezde, uzun metin sarılabilir. Takvim/geri kontrolleri44px dokunma alanını korur.
- Seçenekler16px iç boşluk/12px aralık; başlık ve açıklama uzun metinde kırpılmadan sarılır, okunabilir satır yüksekliği kullanır.
- Mevcut7 renk240px'le sınırlı, ortalı4+3 düzene gelir; yeni renk eklenmez.
- Not alanı minimum120px, esnek genişlik ve1rem/1.5 satır yüksekliği; eylem/durum satırı gerektiğinde sarılır. Durum metni sabit yüksekliğe kesilmez.
- Core içindeki mevcut Sky bağlantısı dahil görünen düğmeler en az44px yüksekliğe alınır; Sky özelliği/handler'ı değişmez. Mevcut gizli sıfırlama düğmesi gizli kalır.
- Alt modül kontrolleri Core kapsamında44px yüksekliği korur. Başla merkezi ve diğer rota kabukları aynı kalır.

Yeni CSS overflow gizleme/clip eklemez. Var olan global clip/screen overflow davranışı topluca kaldırılmaz; testte iç kontrollerin rect ve scrollWidth değerleri ayrıca ölçülerek kırpmanın başarı sanılması önlenir. Safe-area ikinci katmandan eklenmez. iOS toolbar/bounce/klavyenin gerçek davranışı bu otomasyonla doğrulanmış sayılmaz.

## Dosyalar ve kapsam

Bu görevin kaynak test tabanına göre deltası6 dosya:

1. `index.html` — yalnız işaretli Core CSS bloğu.
2. `tests/static-regression.test.cjs` — denetlenmiş yeni index hash'i; diğer üretim hash'leri ve30 testin beklentileri korunur.
3. `tests/e2e/core-alignment.spec.cjs` —3 yeni davranış/ölçüm senaryosu; otomatik Playwright keşfindedir.
4. Bu rapor.
5. `docs/04_CHANGELOG.md`.
6. `docs/10_TECHNICAL_BACKLOG.md`.

Önceki4 test tabanı belgesi korunarak ayrı worktree'ye kopyalandı; diğer kaynak ve uygulamalar taşınmadı. Şema/key/store/migration, modüller, lockfile, paket sürümü, native varlıklar ve SW değişmez. Sürüm/worker etiketleri yerel patch nedeniyle değiştirilmedi; bu haliyle yeni yayımlanmış sürüm değildir. Gelecek yayın adayında code/assets/worker/sürüm tutarlılığı ayrıca hazırlanmalı ve mevcut yayın yasağı için somut yetki sağlanmalıdır.

## Test kapsamı ve ilk başarısızlıklar

Yeni3 test her iki motorda çalışır:

| Senaryo | Doğrudan denetim |
|---|---|
| Ölçüm matrisi |320/393/430/1024px × dark/light/contrast ×100/200% kök fontu:24 düzen/motor. Uzun yapay tarih/seçenek/hata; tarih merkez farkı<1px; görünen her kontrol kart içinde, içerik kendi kutusundan taşmıyor ve eylemler≥44px. Kalıcı gün içeriği değişmiyor. |
| Klavye/not/geri dönüş | Ok tuşu ile seçim, mavi renk ve uzun Unicode yapay not; gerçek save sonrası reload/Calendar dönüşünde korunumu. Focus outline, büyük yazıda alt kontrole doğal kaydırma ve gizli reset görünürlüğünün korunumu. Yazılım klavyesi emülasyonu değildir. |
| İzolasyon | Core palet kimlikleri aynen;7 diğer rotada yeni CSS varken/yokken aynı DOM'un kabuk/kontrol ölçüm ve temel computed style değerleri eşit. Ürün rotaları değiştirilmez. |

İlk hedef6 koşusu **2 PASS/4 FAIL**: ölçüm iki motorda mevcut Core Sky düğmesinin40px kalmasını yakaladı; klavye testi ise ürünün zaten gizlediği reset düğmesini görünür varsayarak timeout verdi. Yalnız Core düğme yüksekliği düzeltildi; test görünen kontrolleri ölçüp resetin gizli kaldığını ayrıca doğrular. Ürün reseti açılmadı.

İkinci hedef koşusu **4 PASS/2 FAIL**:200% yazıda takvim emoji'si44px butonun42px iç alanından2px taştı. İkon düğmelerinin iç padding'i kaldırıldı;44px hit alanı küçültülmedi, taşma gizlenmedi. Son hedefli matris iki motorda2/2 PASS oldu. Son tam paket bütün6 yeni senaryoyu tekrar kapsar. Timeout/retry/skip veya beklenti toleransı artırılmadı. İlk/ikinci log, hata ekran görüntüsü ve trace korunur (`initial-core-browser.log`, `second-core-browser.log`, `core-results`, `core-final-results`); yeni son sonuçlar önceki başarısızlıkların yerine yazılmadı.

## Son doğrulama

Kanıt kökü `/workspace/.cache/today-evidence/core-alignment-20261110`. Başlangıç static hedef30/30 geçti; sonraki CSS düzeltmelerinin hash'i de nihai tam platform kapısında doğrulanır.

| Kapı | Sonuç | Kanıt |
|---|---|---|
| Son hedefli matris |2/2 PASS,0 FAIL,exit0|`matrix.log`, `matrix-exit.json`|
| Tam platform |1161/1161 PASS,0 FAIL,exit0|`platform.log`, `platform-exit.json`|
| Today AI/Radio entegrasyonu |335/335 PASS,0 FAIL,exit0|`integration.log`, `integration-exit.json`|
| Tam Chromium + WebKit |36/36 PASS,0 FAIL,exit0|`browser.log`, `browser-exit.json`;18 Chromium+18 WebKit.|
| Kapsam/bütünlük |4/4 PASS,0 FAIL|`audit.log`, `audit-exit.json`|

Hedefli2 matris senaryosu son browser toplamının içindedir; tekrar eklenmez. Yeni3 senaryo/motor eklendiği için önceki15+15 yerine18+18 test tamamlandı; bütün6 yeni senaryo son koşuda PASS. Engine403 ve benchmark16 önceki taban kanıtıdır, CSS-only değişiklikte tekrar koşulmuş sayılmaz. Engine/adapter/modül JS'si ve sözleşmeler değişmedi. Bir tam platform, bir entegrasyon ve son kod için bir tam browser koşusu yapıldı; ilk hedef hatalarında tam paket kör tekrarlanmadı.

Browser testleri temiz sentetik context, benzersiz loopback path ve yerel radyo fixture'ı kullanır; gerçek profil/saat/OS bildirimi/dış yayın yoktur. WebKit cache'inin bilinen library ön kontrolü için PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1; assertion'lar ve retries0 korunur. Önceki teşhise göre yalnız test komutu için /var/tmp yazma erişimi verildi; medya fixture'ı için gereken geçici dosya desteğidir. Sistem/proxy/TLS ayarı değiştirilmedi. Normal Core ekranının Chromium/WebKit PNG'leri görsel olarak incelendi; WebKit'in yüksek cihaz piksel oranı fiziksel telefon kabulü değildir.

## Korunum, kalan risk ve sonraki görev

Kaynak test tabanının HEAD/dal/status ve4 kirli belge hash'i korunur; eski git ref'leri değiştirilmedi. Bütün uygulama JS/modül/SW/lockfile/varlıklar aynı; index'te style dışı içerik eşittir. Statik testte yalnız index checksum güncellendi; başka beklenti gevşetilmedi. Staging boş; stash/reset/clean/cherry-pick, commit/push/PR/merge/deploy/CI yeniden çalıştırma yoktur. Salt okunur son Radio CI41201384768 aynı eski SHA için completed/success; bu yerel patch'i içermez.

Bu dar yerel hizalama uygulaması mevcut kullanıcı verilerine dokunmaz. Gerçek iPhone Safari/kurulu PWA ve Windows kabulü bu yeni CSS için henüz yapılmadı; dört ekranlı Netlify önizlemesine verilen önceki kabul devralınmaz. T90-07/08 eski writer/tam yedek/restore/kurtarma ve gerçek aday yayın kapıları açıktır. Yeni genel önizleme, hesap, dil, renk, ses veya native iş başlatılmaz.

Sonraki tek öneri PO1-NAV01'in yerel Core ile başlama/ikonla modül erişimi dilimi; ayrıca tetiklenir, mevcut kayıt kuyruğuna otomatik flush veya yeni kalıcı rota anahtarı eklenmez. Bu oturum yalnız UX02 Core hizalamasında durur. Önerilen model Sol Medium; değiştirilmedi. Mevcut test/dependency/cache yeniden kullanıldı; yeni paket kurulmadı ve kota tahmini yapılmadı.
