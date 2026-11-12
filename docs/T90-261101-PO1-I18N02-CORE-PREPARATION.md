# PO1-I18N02 — Güncel Core kataloğu ve Türkçe sözlük hazırlığı

11 Kasım 2026. Başlangıç SHA: `b57dbceb53eb6a9aacc3bde709b4de096b77e38f`.
Yerel dal/worktree: `task/t90-261101-po1-i18n02-core-tr`, `/workspace/Today-core-tr-catalog`.
Kaynak: `/workspace/Today-language-resolver`; önceki 30 yerel dosya değişikliği korunarak kopyalandı. Küçük/orta büyüklükte, geri alınabilir ve veri yazmayan hazırlık dilimidir. Model önerisi Sol Medium.

## Tamamlanan kapsam

3 Kasım I18N02 taslağı yeniden yazılmadı: `/workspace/Today-po1-i18n02-design/docs/T90-261101-PO1-I18N02-CORE-CATALOG.json` içindeki 67 girdi güncel Radio/UI kaynağıyla eşlendi. Önceki dosyanın SHA256'ı yeni katalogda `priorCatalogSha256` olarak ve kopyası yerel kanıtta korunur.

- 66 girdi aynı anlam anahtarı/Türkçe metinle korundu; mevcut İngilizce karşılıkları `unreviewed-draft` olarak kaldı.
- Eski `core.backModules` kaldırıldı. Aynı Türkçe literal Health/Sky geri düğmelerinde hâlâ vardır; Core'da bu literal geçiyor diye yanlış eşleme yapılmadı. Güncel Core ızgarası `core.openModules` / “Modülleri aç” olarak eşlendi; emekli anahtar ve yeni karşılığı katalogda kayıtlıdır. Bu yalnız hazırlık anahtarıdır, kullanıcı kayıt kimliği değildir.
- Core yönergesi, modül merkezinden Core'a dönüş, beş ek renk ve not kayıt hatasıyla toplam dokuz yeni girdi eklendi. Toplam **75 girdi**. Yeni girdilerin İngilizce alanı null/untranslated; çeviri uydurulmadı.
- `color.mint` / Nane dahil mevcut 12 renk ve A/B/C kimlikleri korundu. Ürün kopyası yeniden yazılmadı.
- [Kaynak kataloğu](T90-261101-PO1-I18N02-CORE-CATALOG.json) güncel index SHA256 `60d2627daa85e93b8f9574ebd6312d87fe9162c4b802f52c4185d05751c27a1f`, kaynak dalı ve her literal için ham eşleşen tüm satırları kaydeder. Satır kayıtları DOM bağlama hedefi veya tam kullanım analizi değildir; CSS/yorum/başka modül eşleşmeleri de olabilir. HOME marka sözcüğü gibi tekrarlar için bu ayrım önemlidir.
- `modules/locales/core-tr.mjs` aynı 75 anahtarın düz Türkçe stringlerinden oluşan donmuş `CORE_TR` nesnesini sunar. Sözlük hiçbir UI/startup/modül/SW tüketicisine bağlanmadı. Dil seçimi/DOM değiştirme/tercih yazıcısı yoktur.

Yeni test `tests/core-tr-catalog.test.cjs`, mevcut `npm test` koşucusuna 12 kontrol olarak eklendi. Önce nutrition-contracts / en son platform-browser sırası korunur; inventory sözleşmesi 27 grup/1193 kontrole güncellendi. Workflow/paket/lockfile değişmedi.

## Kabul kanıtı

| Kontrol | PASS | FAIL | Çıkış |
|---|---:|---:|---:|
| Hedef `node tests/core-tr-catalog.test.cjs` | 12 | 0 | 0 |
| `node tests/automation-contract.test.cjs` | 8 | 0 | 0 |
| `npm test` — 27 grup | 1193 | 0 | 0 |

12 katalog ve 8 automation kontrolü tam kapıya dahildir; tekrar toplanmaz. Kaynak hash/75 benzersiz anahtar/tüm literal satırları, gerçek DOM'daki yeni gezinme/12 renk/A-B-C/not alanları, sözlük paritesi/değişmezliği, yan etkisiz import, kapalı İngilizce ve UI/SW bağlantısızlığı denetlendi. JSDOM testi script çalıştırmadan belgeyi okur; fiziksel tarayıcı kabulü değildir. Bu görevde başarısız hedef veya kapı koşusu olmadı.

Mevcut kilitli bağımlılıklar yeniden kullanıldı; kurulum yapılmadı. Alt süreçli platform testi için yalnız komut kapsamlı ağ ve `/var/tmp` test erişimi sağlandı; yeni ürün bağlantısı/sağlık/radyo veri aktarımı eklenmedi. Testler sentetik veriler kullanır. Kanıt: `/workspace/.cache/today-evidence/core-tr-catalog-20261111/{baseline.json,prior-catalog.json,remote-status.json,platform.log,platform-exit.json,audit.json}`. Hedef sonuçları tam platform logunda da vardır.

UI kaynak dosyaları bu görevde değişmediğinden ayrı Playwright Chromium/WebKit, AI/Radio entegrasyonu, Engine ve benchmark tekrar çalıştırılmadı. Eski sonuçlar yeni koşu sayılmaz. npm test içindeki 48 platform-browser kontrolü ayrı Playwright veya gerçek iPhone Safari/kurulu PWA/Windows kabulü değildir. Fiziksel test yapılmadı.

## Veri güveni ve tamamlanmamış kapsam

Bu görevde üretim index/router/diğer modüller, SW, sürüm, storage anahtarı/store/şema/migration ve lockfile kaynakla aynıdır. Kalıcı dil alanı, kullanıcı verisi veya gerçek kullanıcı profili okunup yazılmadı. Önceki Core not güveni, gezinme, palet ve Radio tek oynatıcı değişiklikleri korunur. Nihai bütünlük kontrolü **5 PASS/0 FAIL, exit0** verdi: kaynak worktree/30 dosya hash'i, mevcut refs, yalnız sekiz dosyalı görev deltası, boş staging/temiz whitespace ve önceki 66 eşlemenin korunumu doğrulandı (`audit.json`).

Bu 75 girdi mevcut hazırlık diliminin kapsamıdır; bütün Core/ortak ekranlar eksiksiz çevrilmiş değildir. Dinamik ve ek statik kapsam açık:

| Kalan alan | Güncel kaynak | Sonraki kabul ihtiyacı |
|---|---|---|
| Statik metin/aria/title/placeholder bağlamaları | Home/Modules/Core kontrolleri | Her hedefe açık selector/alan sözleşmesi; ikon/input silmeden salt metin veya attribute güncelleme. |
| Takvim ve gün erişilebilirliği | index renderCalendar, pillDate üretimi | Intl tarih/gün sunumu; gün anahtarı/hafta sırası/ham kayıt korunumu. |
| İstatistik özet ve erişilebilir grafik | renderSummary, renderChart/chartSummary | Gerçek parametre/tekil-çoğul sözleşmesi; hesaplama/seri aynı. |
| Eksik sabit ortak metinler | mode title Saat/Gün/Hafta/Ay, log açıklaması, kısa navigasyon etiketleri | Ayrı kaynak/bağlama eşlemesi; mevcut katalog tam UI taraması sayılmaz. |
| Başlangıç ve ortak hatalar | index fallback, modules/startup-manager.js, router/registry yüzeyleri | Sözlük yüklenemese de erişilebilir güvenli TR fallback; teknik hata kodları aynı. |
| İzin/AI ve diğer modüller | I18N03–06 katalogları | AI kanonik CAVEATS/PURPOSE/kanıt/onay metinlerini değiştirmeyen sunum tasarımı. |
| Kalıcı tercih ve İngilizce | I18N01 tasarımı | Writer/backup/yarış/restore ve tüm uygulama çeviri/cihaz kabulü; şu anda açılmaz. |

`AVAILABLE_LANGUAGES=['tr']` ve `completeEnglishRelease=false` korunur. Sözlük hazırlığı yeni veri alanı/izin/yerel tanıma/güvenli giriş onayı değildir. T90-07/08 tam veri güveni ve pilot kapıları; fiziksel kabul; native saat/bildirim/mağaza ertelemesi sürer.

## Uzak durum ve devam noktası

PR1/PR2 salt okunur kontrol edildi: açık/taslak/birleştirilmemiş, SHA ede686d/b57dbce. Uzak NUT koşusu 41122504627 failure; Radio 41201384768 success. Yeni yerel patch için CI çalışmadı. Commit/push/PR güncelleme/merge/deploy/CI rerun yapılmadı; canlı Today ve Netlify değişmedi. Kullanıcının yerel çalışma sınırı AGENTS'in daha geniş akışından önceliklidir.

**Durum:** I18N02 güncel katalog + Türkçe sözlük hazırlık dilimi yerel olarak tamam. I18N02'nin UI bağlayıcı/dinamik metin kabulü devam eder; genel çok dillilik tamamlanmadı.

**Sonraki tek öneri:** aynı I18N02 içinde Home/Core statik metinlerini Türkçe sözlüğe dar kapsamla bağlamak; başlangıç fallback'ini, ikon/textarea/ID'leri ve not/Radio durumunu koruyan testler. Eksik hedefler bu dar yüzey için eşlenir; dinamik takvim/istatistik ve diğer modüllere aynı görevde genişlenmez. Bu sonraki görev başlatılmadı. Sol Medium; mevcut taslaklar ve kurulu bağımlılıklar kullanıldı, yalnız hedef test ve gerekli tek tam platform kapısı çalıştırıldı. Model değiştirme veya kalan kota iddiası yoktur.
