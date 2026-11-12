# PO1-I18N02 — Dinamik istatistik sunumu

12 Kasım 2026. Başlangıç SHA b57dbceb53eb6a9aacc3bde709b4de096b77e38f; yerel dal task/t90-261101-po1-i18n02-statistics-dynamic. Worktree /workspace/Today-statistics-dynamic-copy, kaynak /workspace/Today-calendar-aria. Önceki58 yerel dosya korunarak kopyalandı. AGENTS/proje kuralları/changelog/backlog ve mevcut dinamik sözleşme kullanıldı. Kullanıcının son yönlendirmesiyle yayın hazırlığına geçilmedi; yalnız sıradaki geliştirme uygulandı.

## Dar uygulama

Mevcut ESM entry içinde isteğe bağlı, salt okunur/donmuş TodayStatisticsCopy sunum nesnesi eklenir: empty, donmuş dört title, summary(choice,count),chartSummary(title,total). Nesne önceki sahibi ezmez. Yalnız hesaplanmış değerleri metne çevirir; state/storage okuma-yazma, saat/Date, ağ, olay, analiz veya yeniden çizim çağrısı yoktur.

Classic üreticilerde statisticsText senkron fallback'i kullanılır; ESM hazır değilse eski Türkçe literal sonuç aynıdır. Geçersiz label/count format çağrıları null döndürür ve çağıran üretici orijinal çıktıya düşer; yeni sayı uydurulmaz/clamp yapılmaz. Şablon parametreleri tek geçişli callback replace ile yerleştirilir; {count},$& veya markup gibi parametre içeriği yeniden yorumlanmaz. Çıktı mevcut textContent yolundadır.

renderSummary'nin7 yerel tarih penceresi, frekans/sıralama/eşitlik kuralları ve label helper'ları aynı. renderChart aynı seriyi aynı kez çağırır, toplamı aynı arr son değerinden alır; toPath/animasyon/dönem/mode/aria-pressed hesapları aynı. Grafik giriş loglarını, özet günlük seçimleri saymaya devam eder. choiceLabelTR/colorLabelTR ve CSV download/kolon/satır üretimi byte düzeyinde aynı; Türkçe CSV lokalizasyon sunumundan ayrıdır.

Üç yeni key: statistics.summary.empty,statistics.summary.most(choice,count),statistics.chart.accessible(title,total). Katalog/sözlük103→106; eski103 metin/parametre aynı. Yeni3 en=null;66 draft+40 untranslated, hazır dil yalnız tr. Üretim index/entry/TR sözlük ve SW cache089→090 ile sınırlıdır.128 shell/App2.23.3/schema2/lockfile aynı. Yeni runtime bağımlılığı veya kalıcı tercih/English seçimi eklenmedi.

## Test kapsamı

Yeni8 hedef kontrolü: tek/çok seçim özeti; boş özet; invalid label/count; sıfır/pozitif giriş toplamı; donmuş title/provider/önceden var olan sahip; literal template parametreleri; gerçek renderSummary'nin fallback/ready durumlarda boş/tek/7gün sınırı/eşitlik ve state korunumu; gerçek renderChart'ın fallback/ready dört modda bir seri çağrısı, aynı arr ve son toplamı koruması. Hedef8/8 PASS. Katalog12/12,106 key/parametre/source doğrulaması PASS. Yeni8 kontrol npm test'e31. grup olarak eklenir;1256→1264.

Yeni browser senaryosu sentetik yerel dictionary yanıtıyla boş/dolu özet, günlük chart title ve erişilebilir chart template'ini değiştirir; gerçek üreticilerin sözlüğü kullandığını doğrular. Dört mode düğmesi gerçek grafik üretir; nota/renge/seçime ait canonical kayıt önce/sonra aynı kalır. Gerçek CSV indirmesi Türkçe seçim/renk ve ham sentetik notu içerir, sözlük fixture'ının Sentetik metinlerini içermez. UI gizli mevcut export kontrolü kendi DOM handler'ından tetiklenir; fiziksel dokunma kabulü değildir. Üçüncü taraf/gerçek kullanıcı verisi kullanılmaz.

Mevcut istatistik statik E2E,Core navigation(kota/partial/throw/success/midnight/draft) ve sözlük hatası/offline dosyaları aynı seçilmiş koşudadır. Tüm E2E dosyalarının tek tam koşusu veya gerçek iPhone Safari/PWA/Windows kabulü değildir. CSS/diğer hesaplar değişmediğinden tüm modül düzen matrisleri/Engine/benchmark tekrarlanmadı. Son platform **1264/1264**, AI/Radio **335/335**, seçili browser **60/60 (30 Chromium+30 WebKit)** ve bütünlük **6/6 PASS**,0FAIL/exit0. Browser3.1 dakika; tüm koşular ilk denemede başarılı, skip/retry/timeout artışı yok. Yeni8/katalog12 platform içindedir; tekrar toplanmaz. Gerçek CSV dosyası iki motorda doğrulandı. Kaynak58 dosya/HEAD/dal/status ve mevcut refs, yalnız20 dosyalı delta, boş staging/whitespace; seri/path/animasyon,7gün/frekans/sıralama,CSV/label helper ve writer değişmezliği; eski103 sözlük girdisi korunarak3 key ve cache089→090 doğrulandı.

Mevcut kilitli bağımlılıklar kullanıldı; kurulum yok. Test alt süreç/loopback/GStreamer için komut kapsamlı ağ ve /var/tmp erişimi; ürün dış veri aktarımı veya yeni Connect işlemi yok. Kanıt /workspace/.cache/today-evidence/statistics-dynamic-copy-20261112: baseline.json,platform/ai-radio/browser log+exit,audit.json.

## Değişen dosyalar ve durum

20 dosya:4 üretim (index.html,core-static-copy-ui.mjs,core-tr.mjs,sw.js),11 test/koşucu (yeni statistics-copy ve statistics-dynamic-copy E2E,katalog,runner,automation,static,SW,iki AI cache referansı,core-static-copy hedef/E2E),5 belge (bu rapor,CORE-CATALOG.json,TODAY-CURRENT-STATUS.md,changelog,backlog). Tam path/hash listesi audit.json içindedir.

**Durum:** Dinamik istatistik sunumu yerel otomatik kabulüyle tamam. Genel I18N02, veri/restore/pilot ve fiziksel kabul tamamlanmadı; sonraki işe geçilmedi.

## Veri ve devam

Day/state/storage writer,Core save guard/Map/debounce,CSV/log,Calendar/Radio/Health/Sky/AI davranışları korunur. RAM rollback veya tam restore güvencesi eklenmedi; veri/restore/kesinti/pilot ve fiziksel kabul kapıları açık. Native saat/bildirim/mağaza ertelemesi sürer.

PR1/2 salt okunur açık/taslak/unmerged,ede686d/b57dbce; uzak NUT41122504627 failure,Radio41201384768 success. Yeni patch için CI çalışmadı. Commit/push/PR güncelleme/merge/deploy/CI rerun yok; canlı Today/Netlify aynı. Kullanıcının yerel sınırı AGENTS'in geniş akışından önceliklidir.

Sonraki ayrı öneri: I18N02 ortak başlangıç/hata ve fallback yüzeyi metinlerini mevcut durum kodları ve sahipleriyle eşleyip dar sunum dilimine almak; hata kodu/başlangıç güvenliği veya kurtarma davranışı çevrilmez/değiştirilmez. Genel çok dillilik ve kalıcı dil tercihi açık; sonraki bağımsız işe geçilmedi. Sol Medium; mevcut entry/sözlük köprüsü kullanıldı, model değişimi/kota yüzdesi iddiası yoktur.
