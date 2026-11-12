# PO1-I18N02 — Dinamik takvim sunumu, ilk dilim

12 Kasım 2026. Başlangıç SHA b57dbceb53eb6a9aacc3bde709b4de096b77e38f. Yerel dal task/t90-261101-po1-i18n02-calendar-copy; worktree /workspace/Today-calendar-copy. Kaynak /workspace/Today-core-message-copy; önceki53 yerel dosya değişikliği korunarak kopyalandı. AGENTS/proje kuralları/changelog/backlog ve mevcut dinamik sözleşme kullanıldı.

## Dar kapsam

Core tarih başlığı (#pillDate), ay/yıl başlığı (#monthTitle), Takvim etiketi (#calPill) ve yedi hafta günü başlığının kısa/tam aria metinleri bağlandı. Gün hücrelerinin kayıt bilgili aria açıklaması bu dilimde değiştirilmedi; renderCalendar'ın yerel tarih matrisi, Pazartesi sırası, gün anahtarı, editable/aria-current/disabled kuralları aynıdır.

Mevcut core-static-copy-ui.mjs içinde isteğe bağlı TodayCalendarCopy oluşturulur: salt okunur/donmuş nesne, iç içe donmuş7 weekday çifti, title ve iki mevcut tr-TR biçimini sunan format fonksiyonu. Önceden var olan aynı adlı sahip üzerine yazılmaz. Core biçimi day2-digit/monthlong/yearnumeric; ay biçimi monthlong/yearnumeric. timeZone parametresi yok; Date yerel OS saat dilimiyle yorumlanır. Date/gün anahtarı yeniden hesaplanmaz; day-manager.js değiştirilmez.

Classic üreticinin calendarDate erişimi senkrondur. ESM hazır değilse eskiden kullanılan prettyTR/toLocaleDateString ve orijinal weekday listesi fallback kalır; await/yeni kritik startup bağımlılığı, otomatik render veya dil değişim olayı yoktur. Gün hücresi hesapları ve ayrı prettyTR validasyonu aynen devam eder. Geçersiz date key için parseKey kontrolü korunur. Format API'sine doğrudan invalid Date verilirse mevcut native davranıştaki Invalid Date sonucu korunur; bugüne ikame yok. Bilinmeyen format türü TypeError üretir; uygulama çağrıları yalnız core/month sabitlerini kullanır.

Sözlük/katalog81→95: mon..sun kısa/tam14 girdi, kaynakta var olan Türkçe metinlerden eklendi; eski81 aynı. İngilizce29 untranslated+66 draft; hazır dil yalnız tr. Dil tercihi/şema/key/migration eklenmedi. Runtime değişikliği index/entry/TR sözlük/SW ile sınırlıdır; cache087→088, shell128/App2.23.3/schema2/lockfile aynı.

## Testler ve başlangıç varsayımları

Yeni8 hedef kontrol: üç timezone'da tarih biçimi/key roundtrip (Europe/Istanbul,UTC,America/New_York; artık gün/yıl başı/DST tarih örnekleri), ay sunumu,7 weekday sırası/aria, donmuş namespace ve önceden var olan sahibin korunması, invalid Date/unknown format ve classic fallback. İlk koşu6PASS/2FAIL: VM'de aynı module metnini iki kez çalıştırmak gerçek ESM cache davranışı değildi; ayrıca toLocaleDateString invalid Date'te mevcut kaynakta istisna değil Invalid Date döndürür. Üretim kodu değiştirilmeden testler gerçek sözleşmeye göre düzeltildi: ayrı context'te mevcut sahip korunumu ve bugüne dönüşmeyen Invalid Date. Son8/8 PASS; bunlar beklenti gevşetme veya skip/retry değildir.

Yeni browser senaryosu yerel sentetik dictionary yanıtıyla Pazartesi kısa/tam metnini değiştirir; gerçek renderCalendar çıktısını, Core/ay format eşliğini, tek editable/current gün hücresini, not ve gün anahtarı korunmasını ve donmuş7 çiftli köprüyü doğrular. Mevcut Core navigation (kota,partial,throw,başarı,midnight,taslak/reset) ve core-static-copy (sözlük hatası/offline) dosyaları beraber çalıştırılır. Ayrı sentetik profiller; fiziksel kullanıcı verisi kullanılmaz.

Son koşular: **platform1251/1251**, **AI/Radio335/335**, **seçilmiş browser56/56 (28 Chromium+28 WebKit)** ve **bütünlük6/6 PASS**,0 nihai FAIL/exit0. Browser2.7 dakikada tamamlandı; önceki Core hata/başarı ve sözlük kaybı/offline testleri de geçti. Yeni8 hedef platform toplamına dahildir; tekrar toplanmaz. İlk6/8 sonrası üretim değil yalnız yanlış test varsayımları düzeltildi; son8/8 ve tüm kapılar başarılıdır. Skip/retry/timeout artışı yapılmadı.

Bütünlük6 kontrolü: kaynak53 dosya/HEAD/dal/status ve mevcut refs; yalnız19 dosyalı delta; boş staging/whitespace; day-manager/writer/Radio/save guard değişmezliği; eski81 katalog metni korunarak14 weekday key ve source SHA eklenmesi; SW'de yalnız087→088. Kanıt audit.json içindedir.

**Durum:** İlk dinamik takvim sunum dilimi yerel otomatik kabulüyle tamam. Genel I18N02 ve hücre aria açıklaması kabulü tamamlanmadı. Yeni8 test npm test'e30. grup olarak eklendi; kapı1243→1251. Mevcut katalog95 girdi/29 untranslated referansları güncellendi. Üretim CSS, Radio/AI/Health/Sky ve hesaplar değişmediğinden tüm düzen matrisleri,Engine/benchmark tekrar çalıştırılmadı. Seçilmiş browser dosyaları tüm E2E dosyalarının tek tam koşusu değildir. Gerçek iPhone15 Safari/kurulu PWA ve Windows kabulü yapılmadı.

## Değişen dosyalar

4 üretim dosyası: index.html,modules/core-static-copy-ui.mjs,modules/locales/core-tr.mjs,sw.js.11 test/koşucu: yeni calendar-copy.test.cjs ve calendar-copy.spec.cjs; katalog,automation,platform runner,static,SW,iki AI cache referansı,core-static-copy hedefi ve offline E2E referansı.4 belge/katalog: bu rapor,CORE-CATALOG.json,changelog,backlog. Tam19 yol/hash listesi audit.json içindedir.

## Veri, uzak durum ve devam

Kayıt yazıcıları, Core save guard/helper, debounce/Map, log/CSV, tarih anahtarları ve Date parse kuralları aynı. Bu çeviri kısmi yazma rollback'i veya tam restore güvencesi eklemez. Genel I18N02, dil tercihi, tüm-modül İngilizce ve veri/restore/pilot kapıları açık kalır. Native saat/bildirim/mağaza ertelemesi korunur.

PR1/2 salt okunur açık/taslak/unmerged; ede686d/b57dbce. Uzak NUT41122504627 failure,Radio41201384768 success; yeni patch için CI çalışmadı. Commit/push/PR güncelleme/merge/deploy/CI rerun yok; canlı Today/Netlify aynı. Kullanıcının yerel sınırı AGENTS'in geniş akışından önceliklidir.

Kanıt /workspace/.cache/today-evidence/calendar-copy-20261112: baseline.json,platform/ai-radio/browser log+exit,audit.json. Mevcut kilitli bağımlılıklar kullanıldı; kurulum yok. Test alt süreç/loopback/GStreamer için komut kapsamlı ağ ve /var/tmp izni; ürün dış işlem veya veri aktarımı eklenmedi.

Sonraki ayrı öneri: I18N02 gün hücrelerinin kayıt bilgili erişilebilir açıklamalarını, mevcut parametre sözleşmesiyle bağlamak. Ham not yerine yalnız not varlığı, değişmez choice/renk ID'leri ve CSV'den ayrılmış sunum korunmalı. Sonraki işe geçilmedi. Sol Medium; mevcut sözlük/entry/API deseni kullanıldı, model değişimi/kota yüzdesi iddiası yoktur.
