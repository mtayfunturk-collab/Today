# PO1-I18N02 — Home/Core statik Türkçe metin bağlaması

11 Kasım 2026. Başlangıç SHA: `b57dbceb53eb6a9aacc3bde709b4de096b77e38f`.
Yerel dal: `task/t90-261101-po1-i18n02-core-bindings`.
Worktree: `/workspace/Today-core-tr-bindings`; kaynak `/workspace/Today-core-tr-catalog`.
Kaynağın 34 yerel değişikliği korunarak kopyalandı. İlgili AGENTS/proje kuralları/changelog/backlog ve [önceki hazırlık](T90-261101-PO1-I18N02-CORE-PREPARATION.md) okundu. İş sınıfı: sınırlı çok dosyalı sunum/çevrimdışı entegrasyonu, Sol Medium önerisi; model değiştirilmedi.

## Uygulanan dar kapsam

- `modules/core-static-copy.mjs`: mevcut donmuş CORE_TR sözlüğünü kullanarak **43 açık selector/alan bağlaması**. Home başlığı/açıklaması/Başla; Core ızgara/takvim aria etiketleri/yönerge/soru/seçimler/renk grubu/opsiyonel renk açıklaması/not etiketi/placeholder/sıfırla/alt gezinme aria etiketi; 12 rengin title/aria alanları.
- `applyCoreStaticCopy(root, copy=CORE_TR)` yalnız leaf textContent veya sabit aria-label/title/placeholder alanını günceller. Aynı değer için DOM yazımı yapılmaz. İçinde eleman bulunan text hedefi atlanır; gelecekte ikon/input eklenirse silinmez. Eksik/boş/yanlış türde/inherited sözlük girdisi HTML fallback'ini korur. Metinler HTML olarak çalıştırılmaz.
- `modules/core-static-copy-ui.mjs`: HTML parse sonrasında bir kez uygulayan module entry. Global API/listener/yeni başlangıç aşaması yoktur. index.html'e yalnız bu script etiketi eklendi. Mevcut Türkçe HTML, entry veya sözlük yüklenemezse erişilebilir ve çalışır kalır; bu iki dosya kritik startup bağımlılığı yapılmadı.
- Çevrimdışı kabuğa entry + bağlayıcı + core-tr sözlüğü eklendi: **125 → 128 dosya**. SW cache etiketi mevcut biçimle **foundation-082 → foundation-083** oldu; kullanıcı onaylı update/skipWaiting akışı değişmedi. Cache etiketi uygulama/veri sürümü değildir; APP_VERSION2.23.3, SCHEMA_VERSION2, sürüm modülleri ve lockfile aynı.
- Hazırlık kataloğunda yalnız güncel index SHA/satır konumları/kaynak dalı eşlendi. 75 key/tr/en/status/parameters ve sözlük dosyasının kendisi değişmedi. Katalog runtime'da yüklenmez. Önceki testin bağlantısız sözlük beklentisi yerine tek izinli TR bağlayıcı + offline cache sınırı denetlendi; dil resolver'ı hâlâ UI'ye bağlı değildir.

Üretim davranışı/sunum aynı Türkçedir. Dinamik not/save/read-only durumları, tarih, takvim/istatistik hesapları, modül merkezi/Health/Sky/Radio/AI metinleri bu bağlamanın dışında kaldı. Yeni language preference alanı/seçici veya İngilizce açılışı yoktur.

## Hata teşhisi ve test yaklaşımı

Yeni 14 hedef kontrol: bütün hedeflerin tekilliği/HTML fallback eşliği, sıfır gereksiz DOM mutation, değişmiş metni gerçek alanına uygulama, textarea kimliği/değer/seçim/odak/listener, ikon ve gelecekteki nested input korunumu, kapsam dışı modül/dinamik çıktılar, A-B-C/renk/aria referansları, bozuk sözlük fallback'i, markup'ın salt metin oluşu, olmayan yüzey, global cihaz/storage/ağ/ses nesnelerine erişimsizlik ve offline dependency closure.

Yeni 3 tarayıcı senaryosu/motor: yalnız sentetik dictionary network fixture'ıyla gerçek bootstrap bağlaması; sözlük yükleme hatasında Türkçe/Core kayıt akışı; cache'ten offline reload'da parser sırasında sentetik bozulan fallback'in gerçek entry tarafından düzeltilmesi ve kayıtlı not korunumu. Radio'nun mevcut gerçek HTMLAudio/sessiz MP3 senaryosu genişletildi: bağlayıcı iki kez uygulanırken aynı Audio/singleton/state ve tek stream korunur; mevcut mini pause/resume/modül geçişi kontrolleri devam eder. Gerçek yayın/şarkı/kullanıcı profili kullanılmaz.

Ara başarısızlıklar saklandı:

1. İlk SW event hedefi **34 PASS/2 FAIL**: testteki eski125 istek/cache envanteri yeni128 ile uyuşmadı; tam sayılar güncellendi.
2. İlk browser hedefi **3 PASS/3 FAIL**: yeni test okuyucusu450ms debounce kaydı oluşmadan henüz olmayan gün nesnesinin note alanına erişti. Optional okuma kullanıldı; aynı expect.poll ve beklenen gerçek not/saklama doğrulamaları korundu. Yeni skip/retry/timeout artışı veya üretim yazıcı değişikliği yok.
3. İlk tam platform nutrition-consumption-editor grubunda cache etiketinin sayısal foundation biçimi beklentisinde başarısız oldu. İlk denenen foundation-082-i18n-core-1 yerine mevcut biçimi sürdüren foundation-083 kullanıldı; beslenme testinin regex'i gevşetilmedi. AI/Radio kapısı ilk koşuda2 eski cache etiketi/kabuk sayısı assertion'ında başarısızdı (AI UI39/40, evaluation10/11). İlgili exact sürüm ve128 envanteri güncellendi; AI sözleşme/çalışma zamanı kodu değişmedi.

Son hedef browser **6/6 PASS** (3 Chromium +3 WebKit). Bu hedef foundation-083'e son biçim düzeltmesinden önceki kabuk etiketiyle geçti; son sürüm aynı senaryoları içeren tam browser koşusuyla ayrıca doğrulanır. Platform ve AI/Radio'nun nihai sonuçları aşağıdadır. Başarısız ara koşular nihai başarıya dahil edilmez.

## Nihai doğrulama

| Son koşu/kontrol | PASS | FAIL | Çıkış |
|---|---:|---:|---:|
| Hedef Core static copy |14|0|0|
| Platform `npm test` —28 grup |1207|0|0|
| AI/Radio `node tests/run-nut-017.9.cjs` |335|0|0|
| Tam Playwright Chromium + WebKit |82 (41+41)|0|0|
| Kaynak/kapsam/veri sınırı bütünlüğü |6|0|0|

Yeni14 kontrol, SW36 ve katalog12/automation8 kontrolü platform toplamına dahildir. AI cache hedef11,335'e dahildir. Yeni6 browser hedefi82'nin alt kapsamıdır; sayılar tekrar toplanmaz. Son tam browser koşusu foundation-083 ile, retries=0,8.3 dakikada geçti. Başlangıç/fallback, not taslakları/kota/gece yarısı, tüm modül düzenleri, gerçek IndexedDB/Service Worker/offline/onaylı update ve Radio/sessiz gerçek HTMLAudio sürekliliği kapsanır. İlk hedef düzeltmesinden sonra yeni başarısız browser koşusu yoktur.

Bütünlük6/6: kaynak34 dosya/HEAD/dal/status, mevcut refs, yalnız18 dosyalı görev deltası, boş staging/whitespace, index'e tek script/SW'ye yalnız3 dosya+sürüm eklenmesi ve75 sözlük/çeviri kaydının aynen korunumu. Başlangıç ve son kaynak hash'leri audit.json içindedir.

**Durum: Home/Core statik Türkçe bağlama dilimi yerel otomatik kabulüyle tamamlandı.** I18N02'nin diğer statik/dinamik yüzeyleri ve genel çok dillilik devam eder. Ayrı Engine/benchmark yeniden çalıştırılmadı; bu oturum için onların PASS sonucu iddia edilmez. Fiziksel iPhone/Safari/kurulu PWA/Windows kabulü yapılmadı; WebKit emülasyonu fiziksel kabul değildir.

Yerel kanıt dizini: `/workspace/.cache/today-evidence/core-tr-bindings-20261111`; baseline.json, remote-status.json, initial-sw-event-regression.log, initial-target-browser.log/exit, initial-browser-artifacts, initial-platform.log/exit, initial-ai-radio.log/exit, target-browser.log/exit, cache-target.log/exit, ai-cache-target.log/exit, platform.log/exit, ai-radio.log/exit, browser.log/exit ve audit.json. Kanıtlar gerçek sentetik koşulardır. Mevcut kilitli bağımlılıklar kullanıldı; kurulum yapılmadı. Alt süreç/loopback/GStreamer için komut kapsamlı ağ ve /var/tmp izni kullanıldı; yeni ürün veri aktarımı eklenmedi.

## Değişen dosyalar

| Grup | Bu görevin kaynak worktree'ye göre deltası |
|---|---|
|4 üretim dosyası | index.html, sw.js; yeni modules/core-static-copy.mjs ve modules/core-static-copy-ui.mjs |
|10 test/koşucu | tests/core-static-copy.test.cjs, tests/core-tr-catalog.test.cjs, tests/run-platform-regression.cjs, tests/automation-contract.test.cjs, tests/static-regression.test.cjs, tests/sw-event-regression.cjs, tests/ai-context-ui.test.mjs, tests/ai-evaluation-gate.test.mjs, tests/e2e/core-static-copy.spec.cjs, tests/e2e/today.spec.cjs |
|4 belge/katalog | bu rapor, T90-261101-PO1-I18N02-CORE-CATALOG.json,04_CHANGELOG.md,10_TECHNICAL_BACKLOG.md |

## Koruma ve açık kapılar

Core not yazıcısı, hızlı dönüş/bekleyen taslak Map'i, tarih/gün anahtarı, seçim/12 renk ID'leri, router/Health/Sky/AI/Radio çalışma zamanı ve kayıtları korunur. Depolama key/store/şema/migration/kalıcı dil alanı ve lockfile değişmedi; gerçek kullanıcı profiline dokunulmadı. Yeni SW etiketi yalnız uygulama statik cache'idir. T90-07/08 tam veri güveni/restore/pilot kapıları, gerçek cihaz kabulü ve bütün uygulama çok dillilik hâlâ açıktır. Native saat/bildirim/mağaza ertelemesi sürer.

PR1/PR2 salt okunur: açık/taslak/unmerged; ede686d/b57dbce. Uzak NUT CI41122504627 failure, Radio CI41201384768 success; yeni patch'e ait CI sonucu değildir. Commit/push/PR güncelleme/merge/deploy/CI rerun yapılmadı. Canlı Today/Netlify aynı; kullanıcının yerel sınırı AGENTS'ten önceliklidir.

**Sonraki tek öneri:** I18N02 içinde modül merkezi ve Takvim/Ayarlar'ın statik ortak metinlerini sözlüğe bağlamak; alan hedeflerini doğrulayıp mevcut kontrol/state'i korumak. Dinamik tarih/özet/grafik ve dil tercih yazımı ayrı dilimlerdir. Sıradaki işe başlanmadı. Mevcut katalog kullanıldı, hedeflerden sonra gerekli birleşik kapılar çalıştırıldı; değişmeyen Engine/benchmark tekrarlanmadı, kota tahmini yoktur.
