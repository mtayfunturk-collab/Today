# PO1-I18N02 — İstatistik statik Türkçe metinleri

11 Kasım 2026. Başlangıç SHA `b57dbceb53eb6a9aacc3bde709b4de096b77e38f`.
Yerel dal `task/t90-261101-po1-i18n02-statistics-bindings`; worktree `/workspace/Today-statistics-tr-bindings`.
Kaynak `/workspace/Today-shared-tr-bindings`;45 yerel dosya değişikliği ayrı worktree'ye korunarak kopyalandı. AGENTS/proje kuralları/changelog/backlog ve [önceki ortak ekran dilimi](T90-261101-PO1-I18N02-SHARED-BINDINGS.md) doğrulandı. Sınırlı sunum işi; Sol Medium önerilir.

## Tamamlanan dar kapsam

`modules/core-static-copy.mjs` içindeki mevcut leaf-text/attribute bağlayıcısına donmuş STATISTICS_STATIC_BINDINGS eklendi: **14 hedef**. Önceki43 Core ve24 ortak hedef aynı kalır; toplam81 açık alan hedefi.

| Statik yüzey | Alan |
|---|---|
| Grafik açıklaması | chartMini text |
| Zaman aralığı grubu | aria-label |
| hour/day/week/month düğmeleri | dört title + dört aria-label |
| Özet başlığı | yalnız metin span'i; arrow korunur |
| CSV ve log temizleme düğmeleri | yalnız eylem etiketi |
| Mevcut log saklama açıklaması | statik metin |

Eksik beş anahtar statistics.mode.hour/day/week/month.title ve statistics.logsNotice olarak kaynak HTML'den eklendi. [Kaynak katalog](T90-261101-PO1-I18N02-CORE-CATALOG.json)75→80 girdi; eski75 key/tr/en/status/parameters/anchor kayıtları korunur. Yeni5 İngilizce null/untranslated; toplam66 unreviewed-draft/14 untranslated. completeEnglishRelease=false, AVAILABLE_LANGUAGES yalnız tr. Sözlük başlığındaki eski bağlantısızlık yorumu güncel sunum kullanımıyla düzeltildi. Görünen Türkçe kopya yeniden yazılmadı.

Grafik başlığı, erişilebilir grafik özeti ve sayısal özet renderChart/renderSummary sahipliğinde kalır; statistics.hour/day/week/month/loading girdileri bu statik bağlamaya alınmaz. Grafik serileri, dönem hesapları, SVG animasyonu, takvim/tarih ve kayıt verileri aynı. Health kartı açıklamasının önceki dinamik sahiplik sınırı sürer. Mode value/aria-pressed, odak, ikonlar, event listener'lar, accordion durumları, CSV kolon/dosya/veri sözleşmesi ve log temizleme davranışı korunur. Metin uygulamak export veya temizleme eylemi başlatmaz.

Mevcut cached bağlayıcı/sözlük değiştiği için yalnız SW cache etiketi **foundation-084→085** artırıldı. Kabuk aynı128 dosya; install/activation/açık kullanıcı onaylı update kodu aynı. Yeni runtime dosyası/entry bağımlılığı yok. index.html ve core-static-copy-ui.mjs aynı; app2.23.3/schema2/key/store/migration/lockfile aynı. Kalıcı dil tercihi, yeni seçici veya İngilizce açılmadı.

## Testler

Mevcut21 bağlayıcı testine5 kontrol eklendi:14 target/81 alan tekillik ve fallback eşliği, her değiştirilmiş hedefin gerçek alanına uygulanması, mod kimliği/pressed/odak/ikon/listener korunumu, gerçek sahipli dinamik grafik/özet alanlarına yazılmaması, export/clear/summary etiketinde eylem başlatılmaması ve arrow korunumu. Katalog testi80 girdiyi doğrular. npm test envanteri28 grup;1214→1219 kontrol.

Yeni iki senaryo/motor gerçek bootstrap'ta yalnız yerel sentetik sözlük yanıtını değiştirerek mod title/özet/açıklama/log metninin bağlandığını ispatlar. Dört grafik modu gerçek renderChart ile güncellenir; başlık/erişilebilir özet/tek pressed kontrolü doğrulanır. Yeniden bağlamada SVG/node/içerik/not/localStorage/odak/rota korunur, indirme/temizleme tetiklenmez. Gerçek kullanıcı profili, gerçek yayın veya dış veri kullanılmaz.

| Doğrulanan koşu | PASS | FAIL | Çıkış |
|---|---:|---:|---:|
| İlk bağlayıcı hedefi |26|0|0|
| Katalog hedefi |12|0|0|
| Yeni istatistik browser hedefi, Chromium+WebKit |4 (2+2)|0|0|
| Tam platform npm test |1219|0|0|
| AI/Radio kapısı |335|0|0|
| İlgili mevcut browser regresyonu, Chromium+WebKit |36 (18+18)|0|0|
| Nihai kaynak/kapsam bütünlüğü |6|0|0|

26/12 alt kontroller1219 içindedir; tekrar toplanmaz. İlk26 hedefi cache085 metadata güncellemesinden önce geçti; son platform aynı26'yı son kaynakta doğruladı. Başarısız koşu veya skip/retry/timeout artışı yapılmadı. İlgili mevcut browser regresyonu **36/36 PASS**,2.9 dakika,exit0 verdi. Yeni4 ve mevcut36 ayrı koşularda toplam40 benzersiz senaryodur; tek tam E2E koşusu olarak sunulmaz. Bu oturumda başarısız koşu olmadı. Bütünlük **6/6 PASS**: kaynak45 dosya/HEAD/dal/status, mevcut refs, yalnız17 dosyalı delta, boş staging/temiz whitespace, index/entry aynılığı ve SW'de yalnız084→085, eski75 kayıt korunarak tam5 key eklenmesi/yalnızTR hazır dili doğrulandı.

Yeni4 senaryodan sonra yalnız core-static-copy.spec.cjs ve today.spec.cjs seçili regresyonu çalıştırıldı; yeni4 gereksiz tekrarlanmaz. Bu seçki tüm E2E dosyalarının tek tam koşusu değildir. Üretim CSS/HTML/layout ve Engine hesapları değişmediği için diğer Health/Sky düzen matrisleri, Engine/benchmark tekrar çalıştırılmadı; önceki PASS'ler yeni sonuç sayılmaz. Otomatik Chromium/WebKit, gerçek iPhone15 Safari/kurulu PWA veya Windows kabulü değildir; fiziksel kabul açık.

Kurulu kilitli bağımlılıklar yeniden kullanıldı; npm install yapılmadı. Alt süreç/loopback/GStreamer için komut kapsamlı ağ ve /var/tmp izni; yeni ürün dış işlem/aktarım/sağlık okuması yoktur. Kanıt `/workspace/.cache/today-evidence/statistics-tr-bindings-20261111`: baseline.json,remote-status.json,target/catalog log+exit,target-browser log+exit,platform log+exit,ai-radio log+exit,regression-browser log+exit,audit.json.

## Değişen dosyalar

| Grup | Kaynak worktree'ye göre delta |
|---|---|
|3 üretim dosyası | modules/core-static-copy.mjs, modules/locales/core-tr.mjs, sw.js |
|10 test/koşucu | tests/core-static-copy.test.cjs, tests/core-tr-catalog.test.cjs, tests/e2e/statistics-static-copy.spec.cjs, tests/e2e/core-static-copy.spec.cjs, tests/run-platform-regression.cjs, tests/automation-contract.test.cjs, tests/static-regression.test.cjs, tests/sw-event-regression.cjs, tests/ai-context-ui.test.mjs, tests/ai-evaluation-gate.test.mjs |
|4 belge/katalog | bu rapor, T90-261101-PO1-I18N02-CORE-CATALOG.json,04_CHANGELOG.md,10_TECHNICAL_BACKLOG.md |

**Durum:** İstatistik statik Türkçe metin bağlama dilimi yerel otomatik kabulüyle tamamlandı; genel I18N02 devam eder. Sonraki göreve geçilmedi.

## Veri koruma ve uzak durum

Üretim delta yalnız bağlayıcı, TR sözlük ve SW cache etiketi. Mevcut not yazıcısı/Map/tarih/renk/choice, router/Health/Sky/AI/Radio ve saklama katmanları aynı. Önceki45 yerel değişiklik ve mevcut refs korunur; kullanıcı verisine veya kalıcı dil alanına dokunulmadı. Yeni istatistik etiketleri kayıt/kolon/dönem kimliklerine dönüşmez.

PR1/2 salt okunur: açık/taslak/unmerged, ede686d/b57dbce. Uzak NUT CI41122504627 failure, Radio CI41201384768 success; yeni patch için CI çalışmadı. Commit/push/PR güncelleme/merge/deploy/CI rerun yok; canlı Today/Netlify aynı. Kullanıcının yerel çalışma sınırı AGENTS'in daha geniş akışından önceliklidir.

Genel I18N02'de dinamik Core durumları/takvim/istatistik ve ortak başlangıç/fallback metinleri, kalıcı tercih ve tüm uygulama İngilizce kabulü açık kalır. T90-07/08 veri/restore/pilot kapıları ve fiziksel kabul korunur. Native saat/bildirim/mağaza ertelemesi sürer.

Sonraki ayrı öneri: I18N02 dinamik Core durum metinleri ve takvim/istatistik metinleri için mevcut taslaktaki kaynak/parametre/sahiplik sözleşmesini güncel üreticilerle doğrulayıp ilk dar sunum dilimini seçmek. Baştan envanter/tasarım üretme yok; gün anahtarı, saat dilimi, hesap ve kayıtlar değiştirilmez. Sonraki göreve başlanmadı. Sol Medium; mevcut sözlük/bağlayıcı/katalog/bağımlılıklar kullanıldı, hedef ve gerekli birleşik kapılardan sonra değişmeyen matrisler tekrarlanmadı. Model değişimi veya kota yüzdesi iddiası yoktur.
