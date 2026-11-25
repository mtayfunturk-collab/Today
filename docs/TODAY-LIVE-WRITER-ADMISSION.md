# Geri yükleme yazıcı kabulü — mevcut adayın sınırı

## 25 Kasım 2026 — v5 kalıcı yazıcı envanteri ve eski sayfa kararı

Taban taslak PR #47 / `b2e48b7` (bağımlılık: #46 → #47). Bu envanter, canlı kaynakta yüklenen dosyalar ve `setItem`/`removeItem`, IndexedDB `readwrite`/`onupgradeneeded` yolları üzerinden çıkarıldı. Yedek kapsamındaki 28 localStorage anahtarının hepsi bugün yazılan aktif kayıt değildir; eski/reserve anahtarları da arşivde korunur.

| Yazıcı | Kalıcı hedef | Başlangıç veya kullanıcı eylemi |
| --- | --- | --- |
| `modules/storage.js` | `today_store_v2`, `today_store_v2_backup` | Gün kaydı, yedek kopyası; `loadStore()` bozuk/boş ana depoyu açılışta da yazabilir. |
| `modules/state-manager.js` | `today_app_v10`, ardından `TodayStorage.saveDay()` | Eski durum kopyası; `load()` eksik/uyumsuz kopyayı açılışta oluşturabilir. `save()` birden çok gün kaydına yayılabilir. |
| `modules/health-hub.js` | İki su, üç wellness, dört spor anahtarı | Manuel tercih ve kayıtlar; su anahtarı fonksiyon argümanıyla seçilir. |
| `modules/notification-store.mjs` | `today_ai_delivery_v1` | Tercih/gözlem/teslim güncellemesi; boş durumda veya reset'te anahtarı kaldırabilir. |
| `modules/plans-store.mjs`, `modules/places-store.mjs` | `today.plans.v1`, `today.places.v1` | Ekleme, düzenleme, durum ve silme bütün listeyi tek anahtara yeniden yazar. |
| `modules/nutrition-storage.js` | IndexedDB `today_nutrition`: `records`, `metadata`, `migration_backups` | Yedi `readwrite` işlem yolu; ilk `openDatabase()` `onupgradeneeded` içinde store/index ve metadata oluşturabilir. |

`index.html` güncel Core için `modules/storage.js` yükler. Kök `storage.js` aynı yazı kodunun eski kopyasıdır; güncel sayfa onu yüklemese de eski önbellek/sayfa riskinin envanterinden çıkarılamaz. `modules/backup-recovery.mjs` yalnız sentetik v1 prototipte `today_recovery_v1` günlüğü, hedef localStorage ve Nutrition veritabanına yazar; üretim başlangıcına bağlı değildir. `sw.js` uygulama kabuğunu CacheStorage'a yazar, kullanıcı veri yedeğinin hedefi değildir. Sky kaydı Core/State yolundan geçer; Odak, Koleksiyonlar, Alanlarım ve Radio favorileri için bugünkü kodda ayrı kalıcı yazıcı bulunmadı. Bu son cümle gelecekte yeni yazıcı eklendiğinde yeniden denetlenmelidir.

**Eski sayfa karar sınırı:** Yeni sürümde bütün yukarıdaki yazılar ortak shared Web Lock ve güncel Worker/sürüm kabulüne bağlansa bile, daha önce açılmış JS bunu kullanmaz. Bugünkü `browserBarrier` görünür ikinci istemciyi reddeder ve yeni navigasyonu kilitler; 12 Kasım BFCache sondası gerçek geri dönüş üretmedi. `clients.matchAll`, `BroadcastChannel`, `pageshow` veya zorunlu yeniden yükleme tek başına eski sayfanın hiçbir zaman yazamayacağını burada kanıtlamaz. Bu nedenle aynı origin üzerinde üretim restore için eski/BFCache yazıcı dışlama kabulü hâlâ **FAIL/açık**tır. Kabul yöntemi desteklenen gerçek tarayıcılarda eski sayfanın geri dönüşü, Worker değişimi ve yazı yarışını gözleyip eski yazının reddedildiğini göstermelidir; yalnız yeni kodun davranışını test etmek yeterli değildir. Kanıt üretilemezse ayrı origin'e kullanıcı eylemli şifreli dosya taşıma seçeneği ürün/veri kararı olarak ayrıca tasarlanır. Bu dilim böyle bir taşıma, şema değişimi veya restore açılışı yapmaz.

## 25 Kasım 2026 — Web Lock yazıcı katılımı sınırı

`task/today-writer-lock-advisory-probe` dalı, PR #46 başı `111b7c4` üzerine yalnız sentetik tarayıcı testi ve bu tasarım kaydını ekler. Ayrı geçici origin'de iki yedek sayfası açıldı. İlki gerçek `today:backup:v1:<scope>` exclusive Web Lock'unu tuttuğu sırada ikincisi geçici bir localStorage anahtarına doğrudan yazdı; ilk sayfa değeri okudu. Chromium hedefli kurtarma tarayıcı grubu **6/6 PASS**, birleşik platform **1532/1532 PASS**. Bu, Web Locks'un localStorage yazma işlemini kendiliğinden engellemediğini gösterir. Mevcut `browserBarrier` ikinci pencereyi reddeder; test onu atlayan bir BFCache kanıtı değildir ve üretim geri yükleme kabulü değildir.

**Ortak yazıcı sözleşmesi için önerilen sıra:** (1) Core, Health, State, Nutrition, bildirim, Planlar ve Yerler dahil her normal kalıcı yazı yolunu tek envanterde eşleştir; yeni yazıdan önce aynı kapsam kilidinde shared izin ve güncel Worker/sürüm doğrulaması iste. (2) `pagehide`, `pageshow.persisted`, Worker değişimi ve izin kaybında eski yazı yetkisini geçersiz kıl; yeniden doğrulanamayan yazı başlamasın. (3) Geri yükleme exclusive izin, sabit Worker protokolü ve tam önceki görüntünün doğrulanmasıyla çalışsın; kesinti halinde açılış eski görüntü geri alınana kadar kapalı kalsın. (4) Bütün yeni yazıcılar katılsa bile daha önce açılmış eski JS sayfası ortak kilidi kullanmaz. Aynı origin'deki eski/BFCache sayfasının kesin olarak dışlandığı gerçek tarayıcı ve fiziksel iPhone kabulü olmadan bu sözleşme üretim restore için yeterli sayılmaz. Bu dışlama kanıtlanamazsa sürümlü, ayrı origin üzerinde kullanıcı eylemli dosya taşıma seçeneği ayrıca ürün/veri kararı olarak değerlendirilir; bugün uygulanmaz.

**Açık kabul:** Geçici test yalnız ikinci normal sekmede kilidin danışmalı olduğunu kanıtlar. BFCache'ten gerçekten geri dönen eski sayfa, Worker güncelleme yarışı, WebKit ve fiziksel iPhone Safari/kurulu PWA ile kesinti/kota senaryoları hâlâ doğrulanmadı. Mevcut depolama anahtarı/şeması, uygulama yazıcısı ve üretim restore değişmedi.

## 25 Kasım 2026 — canlı v5 kapsam farkı

Canlı kaynak `release/today-backup-candidate-2a70ec9` / `4061839` artık Planlar (`modules/plans-store.mjs`, `today.plans.v1`) ve Yerler (`modules/places-store.mjs`, `today.places.v1`) yazıcılarını da içerir. Core (`modules/storage.js` ve kök kopyası), Health (`modules/health-hub.js`), durum yöneticisi (`modules/state-manager.js`), Nutrition (`modules/nutrition-storage.js`) ve bildirim tercih deposu (`modules/notification-store.mjs`) ile birlikte bu iki yazıcı da üretim geri yüklemesi için ortak durdurma/kabul sözleşmesinin kapsamına girer. Bu dosyalarda ortak bir yazıcı kapısı henüz yoktur. Mevcut `browserBarrier` yedek dışa aktarımı sırasında tek pencere ve Worker denetimi yapar; eski BFCache sayfasının veya yeni normal yazıcıların restore sırasında yazamayacağını kanıtlamaz. Önceki BFCache sondasının sonuç sınırı değişmedi.

v5 dosyasında gerçek sentetik Planlar ve Yerler kayıtları varken ürüne bağlanmamış v1 kurtarma prototipinin dosyayı `unsupported-recovery-version` ile reddettiği hedefli test eklendi. Hedef localStorage ve IndexedDB değişmedi; kurtarma günlüğü oluşmadı. Bu yalnız yanlış sürümün prototipe girmesini önleyen bir regresyon kapısıdır, v5 geri yükleme kabulü değildir. Üretim için önce bütün normal yazıcıların ve eski sürüm/Worker dönüşlerinin aynı fail-closed protokole katılması, ardından çok sekme/BFCache/WebKit ve fiziksel iPhone kesinti kabulü gerekir. Üretim restore kapalı kalır; bunun etkinleştirilmesi ayrıca ürün sahibi onayı gerektirir.

12 Kasım 2026, TSİ. Yerel `task/t90-261101-live-synthetic-recovery` dalı; taban `b57dbceb53eb6a9aacc3bde709b4de096b77e38f`. Bu belge üretimde geri yükleme açmaz ve depolama şeması değiştirmez.

## Mevcut yol

`modules/backup-export.mjs` içindeki `browserBarrier` güvenli bağlam, kontrol eden Service Worker ve Web Locks ister. `today:backup:v1:<scope>` için exclusive lock alır; Worker'dan kapsam, navigasyon kilidi ve **tek açık Today penceresi** doğrulamasını iş öncesinde ve sonrasında ister. `sw.js` aynı lock altında sayfa navigasyonunu shared modda ele alır. Bu, desteklenmeyen ortamda fail-closed davranır. `modules/backup-recovery.mjs` hâlâ yalnız sentetik prototiptir; bir `barrier` argümanı alır ama hangi kilidin verildiğini kendisi doğrulamaz.

Gerçek Chromium'da geçici profilde, prototipe mevcut `browserBarrier` verilerek sentetik commit/rollback testleri geçti. İkinci Today sekmesi açıkken kilit iş gövdesine girmeden reddetti; sekme kapanınca kabul etti. Ayrı testte ikinci sekme önizleme ile apply arasında hedefi değiştirdiğinde `target-changed` kontrolü yazmayı durdurdu. Yeni testte exclusive lock tutulurken açılan Today navigasyonu işlem serbest kalana kadar bekledi. Hedefli E2E **5/5 PASS**, kanıt `/workspace/.cache/today-evidence/synthetic-recovery-20261112/native-chromium-navigation.log`. Bu yeni navigasyon testi BFCache geri dönüşünü veya eski Worker'ı sınamaz. Önceki platform kapısı **1446/1446 PASS**; bu dilimde uygulama kodu değişmedi.

## Açık güven sınırı

Core depolama (`modules/storage.js` ve kök kopyası), Health (`modules/health-hub.js`), durum yöneticisi (`modules/state-manager.js`) ve Nutrition (`modules/nutrition-storage.js`) mevcut normal yazıcılarıdır. Her yazıcı ortak bir shared lock kullanmıyor. Bu yüzden yalnız Web Lock edinmek mevcut açık uygulama sekmesindeki yazmayı durdurmaz; tek pencere kontrolü buna karşı bugünkü kabul koşuludur. BFCache'ten dönen sayfa, kontrol edilmeyen eski Worker, sekme yarışları ve SW yaşam döngüsü gerçek WebKit/iPhone'da ayrıca sınanmalıdır. `barrier: fn=>fn()` üretimde kabul edilemez.

## Üretime geçiş için somut koşullar

1. Restore yalnız ayrı sayfada, açık kullanıcı onayıyla ve güncel Worker protokolü altında açılmalı. Kullanılacak bariyer `browserBarrier` veya eşdeğer fail-closed bir uygulama bariyeri olmalı; SW denetimi, scope ve tek pencere uygulama boyunca korunmalı.
2. Başka Today penceresi, eski sürüm, Worker değişimi veya kilit belirsizliği tespit edilirse uygulama başlamamalı ya da güvenli kurtarma durumuna geçmeli. Mevcut kullanıcı kayıtlarına sessiz kısmi yazma olmamalı.
3. Gerçek WebKit tarayıcı ve kullanıcının iPhone 15 Safari/kurulu PWA'sında sekme, geri/ileri önbelleği, uygulama kapatma, kota ve kesinti testleri ayrı geçmeli. Otomatik WebKit testi fiziksel kabul yerine geçmez.
4. Tam ürün veri kapsamı ve dışa aktarılmış kurtarma dosyası kullanıcıya doğrulatılmadan canlı restore açılmamalı. İzinler ithalde kapalı kalmalı.

WebKit bu ortamda sistem kütüphanesi eksikliği yüzünden açılmadı; fiziksel iPhone kabulü yapılmadı. Canlı Pages değişmedi, commit/push/PR/merge/deploy yok. Sonraki küçük iş BFCache/Worker değişimi yarışını gerçek Chromium'da sentetik olarak sınamak, ardından iPhone kabul listesini hazırlamak.

## 12 Kasım BFCache sondası

Ayrı geçici Chromium penceresinde eski Today sayfası `about:blank` arkasına alındı. Worker'ın `TODAY_BACKUP_CHECK` yanıtı yalnız geri yükleme sayfasını istemci saydı (`onlyClient=true`); exclusive bariyer başladı. Eski pencerenin geri navigasyonu bariyer açıkken bekledi, serbest bırakılınca açıldı. Ancak sayfa içi rastgele işaret geri dönmedi: tarayıcı bu denemede sayfayı BFCache'ten canlandırmak yerine yeniden yükledi. Bu yüzden sonuç yalnız normal geri navigasyon için kanıttır; BFCache kabulü **çalıştırılamadı**. Geçici test kalıcı süite eklenmedi. Kanıt `/workspace/.cache/today-evidence/synthetic-recovery-20261112/bfcache-probe.log`. Gerçek iPhone Safari/PWA geri dönüşü ayrıca sınanmalı.
