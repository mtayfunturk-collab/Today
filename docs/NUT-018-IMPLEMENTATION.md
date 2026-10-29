# NUT-018 — Today Teknik Stabilizasyon

Tarih: 29 Ekim 2026. Hedef dal: `nut-018-ci-stabilization`; taslak PR: [#1](https://github.com/mtayfunturk-collab/Today/pull/1).

## Kök neden ve kanıt

[İlk Actions çalıştırması 40930531664](https://github.com/mtayfunturk-collab/Today/actions/runs/40930531664), Node 24.22.1 / npm 11.19.1 üzerinde bağımlılıkları başarıyla kurdu. `Run regression gate` içindeki `npm test` çıkış kodu 1 verdi: **1095 PASS / 21 FAIL**, dört başarısız grup. AI Engine ve benchmark adımları bu yüzden atlandı. Sorun npm komutunun veya paket kurulumunun bozuk olması değildi.

| Grup | İlk CI PASS | İlk CI FAIL | Neden |
|---|---:|---:|---|
| Static regression | 25 | 5 | NUT-011 hash, script sırası, 129 HTML kimliği ve foundation-023 beklentileri güncel uygulamaya ait değildi. |
| Service Worker event | 23 | 13 | Testler 28 dosyalık eski aktif cache'i açıyordu; gerçek foundation-067 kabuğu 113 girdi içeriyordu. Yanlış cache adı birçok bağlı hata üretti. |
| Automation contract | 6 | 2 | Testte paket sürümü 2.4.0 sabitken paket/lock 2.4.1 idi; workflow iki olayda da contracts/** filtresini içermiyordu. |
| Browser regression | 47 | 1 | Sky Hub başlangıç kapısı başarısızken DOMContentLoaded ile çalışıyor, profil okuması TodayStorage.loadStore() üzerinden boş today_store_v2 oluşturuyordu. |

Eski commit `adefa65995fe3ea25834e1db79413e33d0958ffc` ayrı dizine çıkarılarak hata tekrarlandı. Bu tekrarda takvimdeki sabit 20 ms bekleme de aralıklı başarısız oldu: **1094 PASS / 22 FAIL**. Takvim dönüşü asenkron `history.go` / `popstate` sonucunu beklemelidir.

Hash güncellemeleri incelendi: iki dosyada yalnız sondaki boşluk, storage/version modüllerinde yalnız 2.4.0 → 2.16.0 sürüm damgası, Startup Manager'da daha önce eklenen hata ayrıntıları; index/SW'de belgelenmiş Health/Sky/AI geliştirmeleri vardı. Eski hash kontrolü kaldırılmadı; güncel açık referans değerlerine taşındı.

## Değişiklikler

- `modules/sky-hub.js`: otomatik başlangıç yalnız TodayStartup ready olduktan sonra çalışır; today:startup-ready olayı beklenir. Profil, hesaplama ve depolama API'leri değiştirilmedi.
- `sw.js`: düzeltmenin cache-first istemcilere ulaşması için kabuk foundation-067 → foundation-068. Açık kullanıcı onaylı güncelleme davranışı korundu.
- `tests/platform-browser-regression.test.cjs`: başarısız açılışta tüm localStorage snapshot'ının korunduğu, Sky'ın başlamadığı ve normal açılışta başladığı denetlenir; takvim testi sabit gecikme yerine rota sonucunu bekler.
- `tests/static-regression.test.cjs`: 182 HTML kimliği, güncel script sırası/hash'ler ve 113 kabuk girdisi. Ek olarak dosyaların fiziksel varlığı, benzersizliği ve HTML scriptlerinin offline kapsamı doğrulanır.
- `tests/sw-event-regression.cjs`: güncel cache/sayı referansı; mevcut install, activate, network-first, cache izolasyonu ve kullanıcı onayı kontrolleri korunur.
- `tests/ai-context-ui.test.mjs`, `tests/ai-evaluation-gate.test.mjs`: yeni kabuk sürümü beklentisi foundation-068 ile eşitlendi; mevcut 96 kontrollük Today AI entegrasyon kapısı CI'a eklendi.
- `tests/automation-contract.test.cjs`: test paketinin özel oluşu ve package/lock sürüm tutarlılığı doğrulanır; eski uygulama sürümü sabiti kullanılmaz. Yol filtreleri push ve pull_request için ayrı ayrı kontrol edilir.
- `.github/workflows/platform-regression.yml`: sözleşmeler ve kabuk bağımlılıkları filtrelere eklendi. Kurulum başarılıysa platform kapısı başarısız olsa bile AI kontrolleri çalışır; başarısız adımlar işi kırmaya devam eder.
- `docs/04_CHANGELOG.md` ve bu rapor: güncel sonuçlar ve kalan teknik borç kaydı.

## Doğrulama

Yerel ortam: Node 24.19.0 / npm 11.9.0; kilitli bağımlılıklar `npm ci --ignore-scripts` ile kuruldu. Platform koşucusu Europe/Istanbul kullanır. Gerçek kullanıcı deposuna erişilmedi; JSDOM ve fake-indexeddb içindeki sentetik veriler kullanıldı.

| Komut | PASS | FAIL |
|---|---:|---:|
| npm test (23 grup) | 1116 | 0 |
| node Today-AI-Engine/tests/run-tests.mjs | 335 | 0 |
| node Today-AI-Engine/tests/run-benchmark.mjs | 16 vaka | 0 |
| node tests/run-nut-017.9.cjs (Today AI entegrasyonu) | 96 | 0 |

Platform alt sonuçları: static **30/30**, SW event **36/36**, automation **8/8**, browser **48/48**, Startup Manager **15/15**. Benchmark: **0 güvenlik ihlali**. AI Engine'in 335 sayısı mevcut koşucunun raporladığı kontrol toplamıdır; bir kontrol birden fazla assertion içerebilir. `git diff --check` temiz.

Push sonrasındaki yeni Actions sonucu PR açıklamasında ayrıca kaydedilir; bu yerel sonuçlar tek başına uzak CI başarısı iddiası değildir.

## Korunan veri ve ürün sınırları

Core localStorage anahtarları, şema 2, beslenme IndexedDB store'ları/indeksleri ve migration yapısı değişmedi. Health/Sky hesaplamaları ve AI Engine kaynakları yeniden yazılmadı. Başlangıç başarısızlığında mevcut kayıtların tamamının byte düzeyinde aynı kaldığı test edilir. main dalına yazılmaz; PR taslak kalır ve birleştirilmez.

## Kalan riskler ve sonraki adımlar

Bu bölüm ilk NUT-018 kapanışının kaydıdır. Sonraki alt aşamaların güncel durumu `docs/10_TECHNICAL_BACKLOG.md` ve ayrı NUT-018.x raporlarında tutulur.

1. `npm audit` iki yüksek dereceli dolaylı geliştirme bağımlılığı bildiriyor: source-map-js ve undici. Ayrı, kontrollü bir lockfile güncellemesi ve regresyon doğrulaması önerilir; bu PR otomatik npm audit fix uygulamaz. Bu bildirimler ürün çalışma zamanında istismar kanıtı değildir.
2. Mevcut birleşik platform kapısı depodaki her bağımsız testi içermez. Kapı dışındaki health-hub testi DOMContentLoaded öncesi başlatılmış durum bekliyor; nutrition-consumption-editor testi eski foundation-024 / 2.4.1 sürümlerini bekliyor. Bu iki test ayrıca düzeltilip kapıya dahil edilmelidir; tüm depo testlerinin başarılı olduğu iddia edilmez.
3. Statik hash/sayı referansları onaylı üretim değişikliklerinde bilinçli güncelleme gerektirir. Uzun vadede sürüm, script sırası ve kabuk envanteri için tek kaynak önerilir.
4. JSDOM testleri gerçek iOS/Android tarayıcı ve Service Worker yaşam döngüsünün tamamını kapsamaz. Bir sonraki adım gerçek tarayıcıda normal/eksik-modül açılışı, mevcut kayıtla yeniden açılış ve kullanıcı onaylı offline güncelleme smoke testidir.
