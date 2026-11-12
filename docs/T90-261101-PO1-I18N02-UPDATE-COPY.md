# PO1-I18N02 — Uygulama güncelleme paneli metinleri

12 Kasım 2026, TSİ. Mevcut Service Worker güncelleme panelinde küçük yerel sunum dilimi. Native/OS bildirim veya yayın işi başlatılmaz.

## Başlangıç, hedef ve kapsam

Başlangıç HEAD `b57dbceb53eb6a9aacc3bde709b4de096b77e38f`; kaynak `/workspace/Today-error-copy`, dal `task/t90-261101-po1-i18n02-error-copy`. Önceki6/6 audit/hash doğrulandı;69 kirli kaynak dosyası korunarak yeni `task/t90-261101-po1-i18n02-update-copy` dalı `/workspace/Today-update-copy` altında açıldı. Önceki ağacın HEAD/dal/status/dosya hashleri ve mevcut refs korunur. Stash/reset/clean/commit yok.

PR1/2 salt okunur yeniden kontrol: açık,head SHA'ları `ede686d` ve `b57dbce`; uzak dallar değişmedi. Son bilinen CI sırasıyla41122504627 failure ve41201384768 success; bu yeni yerel patch için uzak CI çalışmadı. Yerel çalışma/yayın yasağı AGENTS'in geniş commit/PR akışından önceliklidir.

Hedef dosyalar: service-worker-manager.js sunum yardımcı/oluşturma/show/applying bölümleri; mevcut ESM copy entry/TR sözlük/cache ve ilgili test/katalog belgeleri. Veri etkisi yok. Onay/erteleme,register/discovery/waiting/controllerchange/ACTIVATE_MESSAGE,tek reload,hata/diagnostic ve depolama değişiklikleri kapsam dışıdır. Boyut küçük; Sol Medium önerilir.

Kabul: altı metin hazır provider'dan gelsin, provider yok/bozukken eski senkron TR kalsın; tek panel ve mevcut erişilebilirlik korunsun. Kullanıcı tıklamadan activation mesajı veya reload olmasın; Daha sonra oturum ve waiting worker'ı korusun. Şimdi güncelle yalnız gerçek kullanıcı eyleminden sonra sürümü uygulasın ve Core kaydı kalsın.

## Uygulama

Donmuş/salt okunur TodayUpdateCopy altı key sağlar: update.title/ready/apply/later/applying/applyingButton. Sözlük133 key, önceki127 metin/EN/parametre aynı;6 ek çeviri henüz hazırlanmadı.66 EN taslak ve67 çevrilmemiş; yalnız TR hazır, İngilizce/kalıcı dil tercihi açılmaz.

Classic manager içindeki updateText() provider'ı beklemeden güvenli string kontrolü/try-catch ile metin alır. Boş/yanlış tür/getter hatası eski TR fallback'e düşer. Oluşturma,hazır ve uygulanıyor metinleri textContent ile yazılır; HTML yorumlanmaz. Geç provider eski paneli kendiliğinden değiştirmez; sonraki normal show döngüsünde iki kontrol etiketi de güncellenir. Replay/listener/timer/yeni kritik başlangıç bağımlılığı yok.

Türkçe başlık tam “Today Yenilik” kalır. Hazır mesajındaki açık kullanıcı onayı korunur; applying iki kontrolü devre dışı tutar, hata sonrası show mevcut kontrolleri yeniden açar. Worker protokolü ve click handler'ları aynı.

## Testler ve kanıt

Kanıt `/workspace/.cache/today-evidence/update-copy-20261112`: baseline,platform/AI/browser log/çıkış kodları,audit/son hash ve summary. Yeni hedef `node tests/update-copy.test.cjs`: **8/8 PASS**; katalog **12/12 PASS**. İkisi platform toplamına dahildir, tekrar toplanmaz.

Hedefler: altı bağımsız sentetik çeviri,fallback/bozuk getter,immutable owner,geç provider,aynı DOM/listener/tek panel,literal HTML metni,applying/yeniden hazır/visibility/aria davranışları. Aktivasyon öncesi yüzey yokken no-op da korunur. Kaynak üretim değişikliği yalnız sunumdur; tam iş akışı var olan SW manager testleri ve gerçek browser güncellemesiyle doğrulanır.

Tam `npm test` **1292/1292 PASS**,34 grup,exit0; `node tests/run-nut-017.9.cjs` **335/335 PASS**,exit0. Seçili tarayıcı **10/10 PASS (5 Chromium+5 WebKit)**,44.1s,exit0. Son bütünlük **6/6 PASS**,0FAIL:69 kaynak dosyası/HEAD/dal/status ve mevcut refs,20 dosyalı delta,boş staging/whitespace,sunum dışı update davranışları ve önceki127 sözlük girdisi/cache sözleşmesi. Tüm test koşuları ilk denemede başarılı;çözülmemiş hata yok. Dar güncelleme paneli dilimi yerel otomatik kabulüyle tamamlandı. Yeni browser senaryoları sözlük yanıtına sentetik metin koyar ve gerçek waiting worker oluşturur; defer oturum/waiting/userAccepted/not,apply gerçek controllerchange/reload/not korumasını doğrular. Mevcut dictionary bootstrap/başarısız yükleme/offline cache testleri birlikte çalışır. Tüm E2E matrisi veya fiziksel cihaz kabulü iddiası yok. Skip/kör retry/timeout artışı yok.

## Veri ve kalan risk

20 dosyalı delta:4 üretim (service-worker-manager.js,copy entry,core-tr.mjs,sw.js),11 test/koşucu ve5 belge. Tam path/hash audit.json içindedir. Cache092→093;128 shell dosyası ve App2.23.3/schema2 aynı. index/startup/error-manager,storage/state/migration,Radio player,lockfile ve uygulama özellikleri korunur. Yeni depolama key/store/şema/migration veya dış veri aktarımı yok; gerçek kullanıcı verisine dokunulmadı.

WebKit iPhone emülasyonu iPhone15/iOS18.7.8 gerçek Safari/PWA veya Windows kabulü değildir. Tam yedek/restore,kısmi yazma rollback'i,çeviri/dil tercihi/fiziksel/pilot kapıları açık. Ayrı Engine/sentetik benchmark bu sunum diliminde tekrarlanmadı; önceki sonuçlar yeni PASS sayılmaz.

Sonraki ayrı öneri: I18N02 Core/ortak metin kapsamını güncel kaynaklarla denetleyerek kalan kullanıcı yüzeylerini ve İngilizce hazırlık eksiklerini tek listede belirleme. Kayıt/CSV/log gibi veri sözleşmelerini UI çevirisiyle karıştırma. Bu öneri sonraki görevi otomatik başlatmaz. Sol Medium; aynı bağımlılık/test altyapısı ve hedefli browser seçimiyle kaynak tasarrufu. Commit/push/PR/merge/deploy/CI rerun yok; canlı uygulama değişmedi. Bu dilim sonunda durulur.
