# PO1-I18N02 — Takvim günü erişilebilir açıklamaları

12 Kasım 2026. Başlangıç SHA b57dbceb53eb6a9aacc3bde709b4de096b77e38f; yerel dal task/t90-261101-po1-i18n02-calendar-aria. Kaynak /workspace/Today-calendar-copy, worktree /workspace/Today-calendar-aria; önceki56 yerel dosya değişikliği korunarak kopyalandı. AGENTS/proje kuralları/changelog/backlog, mevcut dinamik sözleşme ve10 Kasım devam planı kullanıldı.

## Uygulama

Mevcut TodayCalendarCopy salt okunur köprüsüne donmuş7 parçalı messages ve saf dayLabel(input) eklendi. calendarText üretici erişimi senkrondur; eksik/boş/yanlış türde metinde eski TR fallback kullanılır. dayLabel yalnız önceden hesaplanmış dateLabel,timeLabel,recordLabel ve editable boolean alır; geçersiz parametrelerde null döndürerek üreticinin mevcut fallback açıklamasını korur. Şablonun date/relation/record/hint alanları tek geçişli callback replace ile doldurulur; parametre içindeki {hint},$& veya markup yeniden değerlendirilmez.

renderCalendar'da geçmiş/gelecek/bugün, kayıt yok, renk etiketi, not varlığı ve klavye yönergesi sözlükten gelir. Kayıt parçalarının sırası ve noktalama aynı. Ham not metni API'ye/aria açıklamasına verilmez; yalnız not var bilgisi kullanılır. choiceLabelTR/colorLabelTR yardımcıları CSV için değiştirilmez. Date hesapları, key, Pazartesi sırası, gridcell node/klick/keyboard/editable/disabled/current kuralları, badge ve kayıtlar aynı.

Katalog/sözlük95→103:8 Türkçe key eklendi. İki parametreli metnin parameters alanı açıkça doğrulanır: color ve date/relation/record/hint. Eski95 key/tr/en/parameters aynı; yeni8 en=null, toplam66 draft/37 untranslated. İngilizce/kalıcı dil tercihi açılmadı. Takvim API'si kayıt/analiz/yeniden render/ağ olayı üretmez. Kullanıcı verisiyle HTML oluşturmaz; sonuç setAttribute ile aria-label olur.

Üretim delta index,entry,TR sözlük ve cache088→089;128 shell/App2.23.3/schema2/lockfile aynı. Yeni bağımlılık yok. Katalogda aria şablonunun kaynak satırı entry modülüne aittir; doğrulayıcı yalnız izinli index/entry kaynaklarını ve her literal/parametre/satır eşliğini doğrular. Diğer103 kopya runtime'da JSON'dan yüklenmez.

## Doğrulama

Hedef13/13 ve katalog12/12 PASS. Yeni5 hedef; altın beklenen gün açıklamaları, malformed input→null, tek geçişli literal parametreler, donmuş message alanları ve değişmez input/not metni gerekmemesi. Önceki3 timezone tarih kontrolleri korunur.

Yeni browser senaryosu sözlükte gün/not/şablon metnini değiştirerek gerçek calendar aria çıktısını doğrular: choice+renk+not varlığı görünür, SECRET-SYNTHETIC notun içeriği aria'da görünmez. Gerçek canonical kayıt önce/sonra aynı; yalnız bugün editable/current; Enter ile Core'a dönüş notu korur. Mevcut takvim, Core navigation(kota/throw/partial/success/draft/midnight) ve sözlük hatası/offline dosyaları beraber çalıştırılır. Ayrı sentetik profiller, gerçek kullanıcı verisi yok.

Son platform1256/1256 ve AI/Radio335/335 PASS,exit0. Hedef13/katalog12 platform toplamı içindedir. Seçili browser **58/58 PASS (29 Chromium+29 WebKit),2.9 dakika,exit0**; nihai bütünlük **6/6 PASS**. Bu oturumda başarısız koşu olmadı; skip/retry/timeout artışı yok. Kaynak56 dosya/HEAD/dal/status, eski refs, yalnız20 dosyalı delta ve boş staging/whitespace; day/writer/Radio/save guard değişmezliği, eski95 kopya korunarak8 key/parametre eklenmesi ve cache088→089 doğrulandı. Tüm E2E dosyalarının tek tam koşusu veya fiziksel iPhone Safari/PWA/Windows kabulü değildir. CSS ve diğer hesaplar değişmediğinden Engine/benchmark ve tüm modül düzen matrisleri tekrarlanmadı. Mevcut kilitli bağımlılıklar kullanıldı; kurulum yok. Alt süreç/loopback/GStreamer için komut kapsamlı ağ ve /var/tmp izni; ürün dış veri aktarımı yok.

## Değişen dosyalar

20 dosya:4 üretim (index.html,core-static-copy-ui.mjs,core-tr.mjs,sw.js),11 test/koşucu (calendar-copy hedef/E2E,katalog,runner,automation,static,SW,iki AI referansı,core-static-copy hedef/E2E),5 belge (bu rapor,CORE-CATALOG.json,TODAY-CURRENT-STATUS.md,changelog,backlog). Tam path/hash listesi audit.json içindedir.

**Durum:** Takvim günü erişilebilir açıklama dilimi yerel otomatik kabulüyle tamam. Genel I18N02, diğer ürün işleri, fiziksel ve veri güveni/pilot kapıları açık; sonraki bağımsız işe geçilmedi.

## Sınırlar ve devam

Day-manager,storage/state writer,save guard/Map/debounce,CSV,Health/Sky/Radio/AI aynı. Önceki kısmi yazma/rollback ve tam restore/pilot kapıları açık. Yeni şema/key/store/migration,English seçici,profil/speech veya dış Connect işlemi eklenmedi. Native saat/bildirim/mağaza ertelemesi korunur.

PR1/2 salt okunur açık/taslak/unmerged,ede686d/b57dbce. Uzak NUT41122504627 failure,Radio41201384768 success; yeni patch'in CI sonucu değildir. Commit/push/PR güncelleme/merge/deploy/CI rerun yok; canlı Today/Netlify aynı. Kullanıcının yerel sınırı AGENTS'in geniş akışından önceliklidir.

Kanıt /workspace/.cache/today-evidence/calendar-aria-20261112: baseline.json,platform/ai-radio/browser log+exit,audit.json. Güncel ana talimat durumu TODAY-CURRENT-STATUS.md içindedir. Sonraki ayrı öneri I18N02 istatistik dinamik özet/grafik erişilebilir metinlerini, hesap ve CSV helper sahipliklerini koruyarak bağlamak. Sonraki bağımsız göreve geçilmedi. Sol Medium; mevcut formatter/sözlük/entry kullanıldı, model değişimi/kota oranı iddiası yoktur.
