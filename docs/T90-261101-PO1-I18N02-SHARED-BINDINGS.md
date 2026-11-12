# PO1-I18N02 — Ortak statik ekran metinleri

11 Kasım 2026. Başlangıç SHA `b57dbceb53eb6a9aacc3bde709b4de096b77e38f`.
Yerel dal `task/t90-261101-po1-i18n02-shared-bindings`; worktree `/workspace/Today-shared-tr-bindings`.
Kaynak `/workspace/Today-core-tr-bindings`; önceki43 yerel dosya değişikliği korunarak ayrı worktree'ye kopyalandı. [Önceki Home/Core dilimi](T90-261101-PO1-I18N02-CORE-BINDINGS.md) temel alındı. AGENTS/proje kuralları/changelog/backlog ve güncel PR/CI salt okunur kontrol edildi. Orta büyüklükte dar sunum işi; Sol Medium önerisi.

## Uygulama ve sınır

Mevcut `modules/core-static-copy.mjs` bağlayıcısına donmuş **SHARED_STATIC_BINDINGS,24 hedef** eklendi. Önceki CORE_STATIC_BINDINGS43 hedefi korunur; toplam67 açık metin/aria/title/placeholder hedefi. Yeni yüzeyler:

- Modül merkezi marka/geri düğmesi/grup etiketi, Core/Health/Sky başlıkları, Core/Sky açıklamaları, Radio kart adı/aria/açıklaması.
- Takvim geri/istatistik aria etiketleri, mevcut ay yönergesi; İstatistik/Ayarlar düğmeleri ve accordion başlıklarının yalnız metin span'leri.
- Tema etiketi, system/light/dark/contrast seçeneklerinin görünen metinleri ve mevcut cihaz içi saklama açıklaması.

Türkçe metinler ve sözlük75 kaydı aynı kalır. Mevcut DOM leaf/attribute yaklaşımı kullanılır; yeni renderer, event listener veya başlangıç aşaması yoktur. Yalnız HTML girintisi/satır sonu farkı olan metin yeniden yazılmaz; default uygulama iki kez çağrıldığında DOM mutation üretmez. İkon/input içeren hedef silinmez; güvenli fallback korunur. Tema option value/selectedIndex/focus/change listener, aria-expanded/controls/labelledby, kayıt kimlikleri ve Radio mini-player yönetimi değiştirilmez.

**Dinamik sahiplik:** `moduleHealthDesc` HealthHub tarafından başlangıçta “Beslenme, spor ve yaşam” yapılır. Bu alan statik bağlayıcıda yoktur. HTML/katalogdaki “Beslenme, su ve yaşam” ham literalinin varlığı çalışan UI'nin statik kopyası olduğu anlamına gelmez. Health açıklaması I18N03'te kendi üreticisiyle ele alınmalıdır; bütün75 kataloğu körlemesine DOM'a uygulama yapılmaz. Kalıcı veri/sözlük değerini bu göreve taşımak yerine mevcut üretici korunur.

Takvim başlık/tarih/gün hücreleri, grafik/özet/dinamik durumlar, AI içerik/onayları ve diğer modül iç yüzeyleri ayrı kalır. Kalıcı dil tercihi/alanı, dil seçici veya İngilizce etkinleştirilmedi; AVAILABLE_LANGUAGES yalnız tr. index.html, core-static-copy-ui.mjs, core-tr.mjs ve dil resolver'ı byte düzeyinde kaynakla aynıdır.

Cached modül değiştiği için SW etiketi **foundation-083→084** güncellendi. APP_SHELL128 girdisi ve install/activation/explicit update davranışı aynı. App2.23.3/schema2/key/store/migration ve lockfile değişmedi.

## Testler ve kök neden

Mevcut14 bağlayıcı kontrolüne7 yeni kontrol eklendi:24 hedef/67 toplam tekillik ve fallback eşliği, gerçek değişmiş hedef uygulaması, dört tema değerinin tümünde seçenek/odak/listener korunumu, kart/accordion ikon/aria/node/action korunumu, dinamik Health/Takvim/grafik/AI/Radio çıktısının korunumu, bozuk sözlük fallback'i ve güvenilmeyen markup'ın yalnız metin oluşu. `npm test` envanteri28 grup olarak kalır; toplam1207→1214.

Yeni2 browser senaryosu/motor, gerçek bootstrap'ta sentetik sözlük metninin uygulanmasını, gerçek Health/Core/Takvim/Ayarlar gezinmesini ve tema kaydını; yeniden bağlamada odak/option/localStorage ve üretilmiş takvim/grafik/AI node/içerik/rota/accordion/not korunmasını denetler. Önceki dictionary-failure senaryosu ortak ekranlar/tema kontrolüyle genişletildi. Mevcut offline dependency-chain ve ana uygulama akışları da çalıştırılır.

İlk10 browser hedefi **6 PASS/4 FAIL,exit1** verdi. İki motorda Health açıklamasını statik varsayan yeni bootstrap beklentisi ve genişletilmiş failure beklentisi yanlıştı; gerçek HealthHub overwrite'ı görüldü. İlk25 hedef Health açıklamasını tekrar uygulamada eski HTML kopyasına çevirebileceği için kapsam hatasıydı. Alan24 statik hedeften hariç bırakıldı, negatif korunma kontrolüne eklendi; gerçek sözlük bootstrap ispatı Core açıklamasında tutuldu. Beklentiler gerçek üretici metnini doğrular; Health kodu değiştirilmedi. Skip/kör retry/timeout artışı yoktur. İlk platform1214 ve AI335 koşuları geçse de bu FAIL nedeniyle aşama tamam sayılmadı; düzeltmeden sonra birleşik kapılar yeniden çalıştırıldı. Kanıtlar initial-* log/exit ve initial-browser-artifacts içinde saklanır.

## Nihai sonuç

| Sonuç kaydı | PASS | FAIL | Çıkış |
|---|---:|---:|---:|
| Son `npm test` —28 grup |1214|0|0|
| Son AI/Radio kapısı |335|0|0|
| Seçilen40 browser senaryosunun birleşik koşusu |39|1|1|
| Son hedefli dictionary-failure doğrulaması,2 motor |2|0|0|
| Nihai kaynak/kapsam bütünlüğü |6|0|0|

**Browser sonucunun sınırı:** birleşik koşu39/40 geçti; WebKit dictionary-failure testi, bilerek engellenen modülün mevcut merkezi `TODAY-RUNTIME-003` kaynak hatası uyarısını açması nedeniyle Ayarlar tıklamasında bloke oldu. Trace, hatanın core-static-copy-ui.mjs kaynak yükleme uyarısı olduğunu gösterdi. Üretim hata yöneticisi değiştirilmedi veya hata bastırılmadı. Test WebKit'te beklenen uyarıyı, kodunu ve görünürlüğünü doğrulayıp gerçek “Kapat” düğmesiyle devam eder; Chromium'da aynı yüzey görünürse aynı kullanıcı eylemi uygulanır. Son hedefli komut `playwright test tests/e2e/core-static-copy.spec.cjs --grep 'Dictionary load failure'` **2/2 PASS,exit0** verdi. Yeni skip/retry/force-click veya timeout artışı yok.

Bu40 senaryonun38'i değişmeyen diğer senaryolar,2'si son hedefli doğrulamadaki hata akışıdır; toplam40 benzersiz senaryo doğrulanmıştır. Chromium'daki hata akışının iki koşudaki PASS'i iki ayrı senaryo sayılmaz. **Tek bir40/40 tam koşu sonucu iddia edilmez**;39/1 ve2/0 kayıtları ayrı saklanır. Bu aşamada çözülmemiş test hatası kalmadı; dar ortak statik bağlama dilimi yerel olarak tamamlandı. Genel I18N02 ve fiziksel kabul hâlâ açıktır.

21 hedef kontrolü son platform logunda21/21 PASS olarak doğrulandı. Health açıklaması DOM'a önce gerçek runtime metni “Beslenme, spor ve yaşam” konularak eski sözlük kopyasının onu ezmediği negatif kontrolle kilitlendi. Bu ek kontrol sonrasında platform kapısı tekrar1214/1214 geçti; üretim kodu değişmedi. Kaynak/kapsam6/6: önceki43 yerel dosya/HEAD/dal/status ve mevcut refs, yalnız14 dosyalı görev deltası, boş staging/whitespace, index/entry aynılığı ve SW'de yalnız083→084, sözlük/katalog metin değişmezliği denetlendi. Yeni21 hedef kontrolü1214'e dahildir; sayılar tekrar toplanmaz. Hedef-only testin cache etiketi084 güncellemesinden önceki21 sonucu yeni tam kapı ile son sürümde de doğrulanır.

Browser komutu: `playwright test tests/e2e/shared-static-copy.spec.cjs tests/e2e/core-static-copy.spec.cjs tests/e2e/today.spec.cjs`; iki motor, retries0, sentetik ayrı profiller. Bu **seçilmiş bütünleşik tarayıcı kapsamıdır**, tüm E2E dosyalarının tam koşusu değildir. Üretim CSS/HTML/layout aynı kaldığından tüm Health/Sky dar ekran matrisleri ve değişmeyen Engine/benchmark tekrar çalıştırılmadı. Önceki82 sonucu yeni koşu sayılmaz. Fiziksel iPhone15 Safari/kurulu PWA/Windows kabulü yapılmadı; WebKit emülasyonu fiziksel kabul değildir.

Kurulu kilitli bağımlılıklar kullanıldı; npm install/lockfile değişikliği yok. Test alt süreç/loopback/GStreamer için komut kapsamlı ağ ve /var/tmp izni kullanıldı; yeni ürün dış bağlantısı/sağlık okuması/veri aktarımı eklenmedi. Kanıt `/workspace/.cache/today-evidence/shared-tr-bindings-20261111`: baseline.json, remote-status.json, initial-* ve browser artifacts, platform.log/exit, ai-radio.log/exit, combined-browser.log/exit ve combined-browser-artifacts, recovery-browser.log/exit, browser-summary.json, audit.json. İlk başarılı platform sonucu ve son Health negatif assertion öncesi başarılı platform kaydı da silinmeden saklanmıştır.

## Değişen dosyalar

| Grup | Kaynak worktree'ye göre delta |
|---|---|
|2 üretim dosyası | modules/core-static-copy.mjs, sw.js |
|9 test/koşucu | tests/core-static-copy.test.cjs, tests/e2e/shared-static-copy.spec.cjs, tests/e2e/core-static-copy.spec.cjs, tests/run-platform-regression.cjs, tests/automation-contract.test.cjs, tests/static-regression.test.cjs, tests/sw-event-regression.cjs, tests/ai-context-ui.test.mjs, tests/ai-evaluation-gate.test.mjs |
|3 belge | bu rapor,04_CHANGELOG.md,10_TECHNICAL_BACKLOG.md |

## Koruma, uzak durum ve devam

Önceki43 yerel dosya ve mevcut refs korunur. Bu görevin üretim deltası yalnız bağlayıcı + SW cache etiketi; kullanıcı verisi, Core yazıcısı/Map/not/tarih, gezinme, Health/Sky/AI/Radio çalışma zamanı, şema/anahtar/migration ve lockfile aynıdır. Gerçek kullanıcı profili kullanılmadı. T90-07/08 restore/veri güveni ve pilot kapıları, fiziksel kabul ve bütün uygulama çok dillilik açıktır; native saat/bildirim/mağaza ertelemesi geçerli.

PR1/PR2 açık/taslak/unmerged; ede686d/b57dbce. Mevcut uzak NUT CI41122504627 failure, Radio CI41201384768 success. Yeni patch için CI çalışmadı. Commit/push/PR güncelleme/merge/deploy/CI rerun yok; canlı Today/Netlify aynı. Kullanıcının yerel çalışma sınırı AGENTS'in geniş akışından önceliklidir.

Sonraki ayrı öneri: I18N02 istatistik panelinin kalan statik metin/aria/title etiketlerini ve eksik katalog girdilerini tamamlayıp aynı sunum sınırıyla bağlamak. Dinamik tarih/özet/grafik ve startup hataları ayrı doğrulanabilir dilimlerdir. Sonraki işe başlanmadı. Sol Medium; önceki sözlük/bağlayıcı/dependency'ler yeniden kullanıldı, yalnız ilgili dosyalar incelendi, gerekli birleşik kapılardan sonra CSS matrisleri/Engine/benchmark gereksiz tekrarlanmadı. Model/kota yüzdesi iddiası yok.
