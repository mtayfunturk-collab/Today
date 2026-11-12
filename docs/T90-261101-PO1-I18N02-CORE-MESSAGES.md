# PO1-I18N02 — Dinamik Core mesajları

11 Kasım 2026. Başlangıç SHA b57dbceb53eb6a9aacc3bde709b4de096b77e38f; yerel dal task/t90-261101-po1-i18n02-core-messages. Worktree /workspace/Today-core-message-copy, kaynak /workspace/Today-core-save-status; önceki51 yerel dosya korunarak kopyalandı. AGENTS/proje kuralları/changelog/backlog ve önceki CORE-SAVE-STATUS.md temel alındı.

## Dar uygulama

Core'un readOnly/saved/colorSaved/noteSaved/noteFailed/todayCleared/changeFailed mesajları üretici çağrı noktalarında sözlüğe bağlandı. Ertelenen core-static-copy-ui.mjs, yedi sabit metinden oluşan donmuş TodayCoreMessages nesnesini salt okunur/non-configurable window özelliği olarak bir kez kurar. Kullanıcı verisi, fonksiyon veya writer dışarı açılmaz. Önceden var olan aynı adlı özellik üzerine yazılmaz.

Legacy inline üreticinin coreMessage(key,fallback) erişimi senkrondur; hazır olmayan/eksik/boş/yanlış türde kopyada mevcut TR literaline düşer. Promise/await, sözlük-hazır olayı, eski status'u yeniden gösterme veya DOM MutationObserver yoktur. Mesajlar mevcut textContent/flash yolunda kalır. Rota/tarih/save sonucu ve notun450ms zamanlayıcı/Map guard'ları değişmez; gerçek kayıt helper'ı aynıdır.

Yeni core.changeFailed girdisi mevcut hata literalinden eklendi: katalog/sözlük80→81, önceki80 metin aynı. İngilizce null/untranslated;66 draft+15 untranslated, English release false ve hazır dil yalnız tr. Dil seçimi/tercih saklama/speech/AI eylemi eklenmedi. Aynı TR görünüm korunur. Cache086→087;128 shell/App2.23.3/schema2/lockfile aynı. Yeni dosya bağımlılığı yok; entry ve sözlük zaten offline shell'dedir.

## Test kapsamı ve sınır

Üretici callback testi fallback/ready iki durumda, üç akış×success/false/partial/throw ile24 kontrol yapar; eski kayıt doğruluğu guard'ları kaybolmaz. Katalog12 kontrolü81 girdi ve entry'nin yeni sınırlı tüketimini doğrular. Yeni browser senaryosu sentetik dictionary yanıtıyla mesajları değiştirip gerçek seçim/renk/not/reset/başarısız seçim/başarısız not akışında sözlük kullanımını, yedi mesajlı donmuş salt okunur köprüyü ve taslağın korunmasını gösterir. ReadOnly çağrısı kaynakta bağlanmıştır; yeni browser senaryosu geçmiş Core editörüne zorla girmez. Mevcut Core navigation ve dictionary-failure/offline testleri korunur.

Son platform1243/1243 ve AI/Radio335/335 PASS,exit0. Yeni24 ve katalog12 platform toplamına dahildir; tekrar toplanmaz. Browser **56/56 PASS (28 Chromium+28 WebKit),exit0**,2.8 dakika; bütünlük **6/6 PASS**. Bu oturumda başarısız koşu olmadı; skip/retry/timeout artışı yok. Kaynak51 dosya/HEAD/dal/status ve eski refs, yalnız19 dosyalı delta, boş staging/whitespace, save helper ve writer modüllerinin değişmezliği, tam bir sözlük key eklenmesi ve cache086→087 denetlendi (audit.json). Seçilen browser dosyaları core-message-copy,core-navigation,core-static-copy'dir; bütün E2E dosyalarının tam koşusu değildir. Üretim CSS, grafik, Radio/AI hesapları değişmediği için tüm düzen matrisleri/Engine/benchmark tekrarlanmadı. Fiziksel iPhone Safari/kurulu PWA/Windows kabulü yapılmadı; WebKit profili bunun yerini tutmaz.

Eski kayıt mesajı düzeltmesinin sınırı sürer: başarısız işlem RAM'de uygulanabilir ve canonical hata aldığında legacy değişmiş olabilir. Rollback/atomiklik/başarılı restore garantisi eklenmedi. TodayState/TodayStorage/day/router/Health/Sky/AI/Radio kodları, şema/key/store/migration,CSV ve kalıcı log ifadeleri aynı. Gerçek kullanıcı verisi kullanılmadı.

## Değişen dosya grupları

19 dosya kaynak worktree'ye göre değişir:4 üretim dosyası (index.html,modules/core-static-copy-ui.mjs,modules/locales/core-tr.mjs,sw.js);11 test/koşucu (core-save-status,catalog,automation,static,SW,iki AI referansı,core-static-copy hedefi/E2E testi,yeni core-message-copy E2E ve platform runner);4 belge/katalog (bu rapor,CORE-CATALOG.json,changelog,backlog). Tam yol/hash listesi audit.json içindedir.

**Durum:** Dinamik Core mesaj bağlaması yerel otomatik kabulüyle tamamlandı. Genel I18N02, veri kurtarma/restore ve fiziksel kabul tamamlanmadı. Sonraki işe geçilmedi.

## Kaydetme ve devam

Kanıt /workspace/.cache/today-evidence/core-message-copy-20261111: baseline.json,platform/ai-radio/browser log+exit ve audit.json. Kurulu kilitli bağımlılıklar kullanıldı; kurulum yok. Alt süreç/loopback/GStreamer için komut kapsamlı ağ ve /var/tmp izni kullanıldı; ürün dış veri aktarımı eklenmedi.

PR1/2 salt okunur açık/taslak; SHA ede686d/b57dbce. Uzak NUT41122504627 failure,Radio41201384768 success; yeni patch için CI çalışmadı. Commit/push/PR güncelleme/merge/deploy/CI rerun yok; canlı Today/Netlify aynı. Kullanıcının yerel sınırı AGENTS'in daha geniş akışından önceliklidir.

Sonraki ayrı öneri: I18N02 dinamik takvim tarih/hafta başlığı ve gün aria metinlerini mevcut kaynak/parametre sözleşmesinden ilk küçük sunum dilimi olarak ele almak. Yerel gün anahtarı/saat dilimi/hafta sırası ve kayıtlar değişmez; genel çok dillilik, veri/restore/pilot ve fiziksel kabul açık. Native saat/bildirim/mağaza ertelemesi sürer. Sonraki işe başlanmadı. Model önerisi Sol Medium; model/kota değişimi iddiası yoktur. Mevcut köprü giriş dosyası ve sözlük kullanıldı; yeni framework/dependency veya gereksiz test tekrarı yoktur.
