# PO1-I18N02 — Başlangıç hata metinleri

12 Kasım 2026, TSİ. Dar yerel uygulama dilimi; genel çok dillilik veya canlı sürüm kabulü değildir.

## Başlangıç ve kapsam

Kaynak `/workspace/Today-statistics-dynamic-copy`, dal `task/t90-261101-po1-i18n02-statistics-dynamic`; HEAD `b57dbceb53eb6a9aacc3bde709b4de096b77e38f`. Kaynaktaki61 kirli dosya yeni `task/t90-261101-po1-i18n02-startup-copy` dalına eksiksiz taşındı; önceki çalışma ağacı ve mevcut refs değiştirilmedi. Çalışma `/workspace/Today-startup-copy` içinde; commit yok.

Salt okunur uzak kontrol: PR1/2 açık ve draft. NUT `ede686d` / run41122504627 failure; Radio `b57dbce` / run41201384768 success. Bunlar eski uzak SHA sonuçlarıdır; yeni yerel patch için uzak CI çalışmadı.

İki üretici: index.html içindeki startup-manager yüklenememe fallback'i ve startup-manager.js içindeki kritik modül/migration hata yüzeyi. Sözlük ESM'i parse sonrasında çalışır; erken hata yüzeyi onu bekleyemez. Bu yüzden opsiyonel, donmuş TodayStartupCopy köprüsü hazırsa kullanılır; yoksa/boşsa/yanlış türse/getter hata verirse mevcut senkron Türkçe metin korunur. Geç yüklemede replay veya yeni listener yoktur; erken ekranın TR kalması bilinçli bağımlılık sınırıdır. Yeni bir kritik başlangıç bağımlılığı eklenmedi.

Başlık/retry mevcut key'lerden; üç gövde ve `{code}` şablonu için4 yeni key. Sözlük110 girdi, eski106 metin/çeviri/parametre aynı.66 İngilizce taslak ve44 çevrilmemiş girdi; yalnız TR hazır, İngilizce seçeneği ve kalıcı dil tercihi açılmaz. Metinler textContent ile yazılır, kod parametresi tek geçiş callback ile literal kalır. Kod satırı mevcut fail() sözleşmesine göre hata kodu + hata türü/eksik modül ayrıntısını korur. Hata kodları, seçim kapıları, migration, dispatcher, erişilebilirlik/focus/reload-once/dedup davranışları aynı.

## Test ve kanıt

Kanıt `/workspace/.cache/today-evidence/startup-copy-20261112/` altında; platform/AI/browser logları, çıkış kodları, başlangıç envanteri ve son audit hashleri bulunur.

- Yeni hedef test ilk7/8: VM aynı lexical bağlamda ESM kaynak kodunu iki kere değerlendirince `keys` redeclaration hatası. Ürün hatası değildi; ayrı modül lexical bağlamı ve aynı window owner ile test düzeltildi. Son hedef **8/8 PASS**; katalog **12/12 PASS**. İkisi platform toplamının içindedir.
- Tam `npm test`: **1272/1272 PASS**,32 grup,exit0.
- `node tests/run-nut-017.9.cjs`: **335/335 PASS**,exit0. Ayrı Engine/sentetik benchmark bu sunum diliminde tekrarlanmadı; önceki sonuçlar yeni test gibi sunulmaz.
- İlk seçili E2E **10PASS/2FAIL**: yeni test tanı satırının yalnız kod olduğunu varsaydı. Kaynaktaki değişmemiş fail() ve iki motor çıktısı `TODAY-STARTUP-001 — Error: TodayAI, TodayConnect` sözleşmesini gösterdi. Test artık phase/kod/eksik modül listesini ve tam satırı doğrular; üretim davranışı değiştirilmedi, beklenti gevşetilmedi.
- Hedefli düzeltme+ilgili regresyon **10/10 PASS (5 Chromium+5 WebKit)**,exit0; ilk geçen10+son geçen10 ile **20 ayrı senaryo doğrulanmış**,0 çözülmemiş hata. Tek20/20 koşu iddiası yok. İlk geçen10 senaryo gereksiz tekrarlanmadı; retries0, skip yok. Sözlük/startup dosyası aynı anda yokken Türkçe fallback, gerçek retry ile açılma ve korunmuş not; ready provider için iki hata yüzeyi/literal metin/focus; cached offline sözlük zinciri; eski kritik modül/SW güncelleme/Radio sürekliliği kapsamı.

- Son bütünlük denetimi **6/6 PASS**,0FAIL:61 kaynak dosyası/HEAD/dal/status ve mevcut refs, tam21 dosyalı delta, boş staging/whitespace, hata yüzeyleri dışındaki uygulama ve startup davranışı, eski106 sözlük girdisi ve yalnız cache sürümü değişikliği.

Dar başlangıç metni dilimi yerel otomatik kabulüyle tamamdır.

## Veri etkisi, risk ve sonraki adım

Uygulama2.23.3/schema2,128 shell dosyası; cache090→091. Yeni storage anahtarı/store/migration/veri aktarımı yok. Core callback'leri ve tüm işlevleri,writer,Radio oynatıcı,merkezi error-manager ve lockfile aynı. Tam restore, kısmi yazma rollback'i ve fiziksel iPhone kabulü bu adımla sağlanmış değildir. Hata gövdelerindeki önceki koruma metinleri aynen taşındı; yeni veri kurtarma garantisi verilmez. Yalnız ayrı sentetik profiller kullanıldı. WebKit iPhone13 emülasyonu fiziksel iPhone15/iOS18.7.8 Safari/PWA/Windows kabulü değildir.

21 dosyalı görev deltası:5 üretim dosyası,11 test/koşucu ve5 belge (bu rapor,katalog,güncel durum,changelog,backlog); tam path/hash audit.json içinde.

Sonraki bağımsız öneri: I18N02 merkezi hata bildirimlerinin ve kurtarma kontrol metinlerinin kapsamını doğrulayıp dar sunum dilimini uygulama. Log mesajı/hata kodu/diagnostic verisi kullanıcı çevirisi sayılmamalı. Sol Medium; aynı altyapı ve hedefli testler yeniden kullanılır. Genel I18N02,veri güveni/restore/fiziksel/pilot kapıları açık. Commit/push/PR/merge/deploy/uzak CI rerun yapılmadı; canlı değişmedi. Burada durulur.
