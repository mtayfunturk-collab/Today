# Geri yükleme yazıcı kabulü — mevcut adayın sınırı

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
