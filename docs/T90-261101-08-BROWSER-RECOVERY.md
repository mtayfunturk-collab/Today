# T90-261101-08 — Sentetik tarayıcıda kalıcı hata kabulü

Başlangıç SHA `1613c1ec7b57f7311f562268af5073e0d4a2e298`; yerel dal `task/t90-261101-08-browser-recovery`. Değişiklik yalnız `tests/e2e/backup-recovery-native.spec.cjs` içindeki yeni senaryo ve bu rapordur. Üretim geri yükleme, kullanıcı verisi, depolama anahtarı/şema ve Service Worker değişmedi.

Önceden test edilen geçici yazma hatasından ayrı olarak, gerçek Chromium IndexedDB ve localStorage kullanan rastgele test origin'inde kalıcı localStorage yazma hatası üretildi. Sentetik geri yükleme `RECOVERY_REQUIRED` döndürdü; yeni koordinatörün başlangıç koruması hata sürerken `canStart:false` verdi. Hata kaldırıldığında koruma önceki görüntüyü geri aldı (`ROLLED_BACK_AND_CLEANED`), sonraki kontrol `NO_ATTEMPT` oldu. Bilinen localStorage alanları ve Nutrition veritabanının üç store'u işlem öncesi görüntüyle eşleşti. Test gerçek kullanıcı kaydı kullanmaz; üretim `apply` bağlantısı hâlâ kapalıdır.

Hedefli yeni senaryo **1/1 PASS**; ilgili Chromium dosyası **6/6 PASS**; tam platform **1447/1447 PASS**, son FAIL 0. Yerel WebKit çalıştırıcısı kurulu değil; CI ve gerçek iPhone Safari/PWA bu değişiklik için doğrulanmadı. Bu kabul, gerçek cihaz kesintisi, BFCache/eski yazıcı yarışı, kota tükenmesi veya üretim geri yükleme izni sayılmaz. iPhone `TODAY-SW-UPDATE-003` ve önizleme kabulü [bekleyen iş #6](https://github.com/mtayfunturk-collab/Today/issues/6) kapsamında ertelendi.

Sonraki dar öneri: aynı sentetik protokolün WebKit CI sonucunu ve eski/BFCache yazıcı yarışını ayrı kabul olarak ele almak. Gerçek veriye uygulama ve pilot kapısı açık kalır.

## 17 Kasım ek kabul — önceden açık Today sekmesi

Başlangıç SHA `7b71a53c37a9f588be6cd485eeb6e8ce4c905ef1`; yerel dal `task/t90-261101-08-existing-client-admission`. Önceden açık ikinci Today sekmesi varken sentetik koordinatörün `prepare` çağrısı gerçek Chromium'da `other-client` ile reddedildi. Kaynak Core kaydı değişmedi ve `today_recovery_v1` günlüğü oluşmadı. Bu, yalnız `browserBarrier` birim kontrolü değil, şifreli dosya → hazırlık → ret akışının tarayıcı kabulüdür.

Yeni senaryo **1/1 PASS**; ilgili Chromium dosyası **7/7 PASS**; tam platform **1447/1447 PASS**, son FAIL 0. Üretim kodu, veri şeması ve canlı sürüm değişmedi. Önceki BFCache sondasında sayfa önbellekten canlanmadı; bu yeni test de BFCache veya eski Worker'ın işlem sırasında yazmasını kanıtlamaz. Gerçek iPhone Safari/PWA ve ertelenmiş iş #6 açık kalır.
