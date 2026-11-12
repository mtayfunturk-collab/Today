# T90-07 — Radio tabanında test envanteri ve başlangıç doğrulaması

10 Kasım 2026. Başlangıç **b57dbceb53eb6a9aacc3bde709b4de096b77e38f**, App2.23.3/schema2/foundation-082; yerel dal `task/t90-261101-07-radio-test-baseline`, worktree `/workspace/Today-radio-test-baseline`. Sadece Radio kaynağından oluşturuldu; yerel NUT birikimi topluca kopyalanmadı. Kullanıcının sıradaki tek test altyapısı/envanter işi uygulandı. Görünüm/ürün davranışı veya gerçek veri geçişi uygulanmadı.

## Envanter uzlaştırma sonucu

[Envanter JSON'u](T90-261101-07-RADIO-TEST-BASELINE.json):25 platform grubu1161 kontrol,19 Today AI/Radio entegrasyon grubu ve9 Engine test grubu. Root44 dosya iki koşucuda tam olarak birer kez kayıtlı; Engine9 test dosyası kendi koşucusunda eksiksiz kayıtlı. Workflow platform, entegrasyon, Engine ve benchmark komutlarını zaten çağırır. Gerçek Radio envanteri ile dosya keşfi eşleşir.

`tests/automation-contract.test.cjs` mevcut haliyle bu kapsamı zaten denetliyor;8/8 geçti. Nutrition UUID fixture düzeltmesi yerel NUT ile byte eşit ve50/50 geçti. Koşucu/test/helper taşımak veya sayıları değiştirmek gerekmedi. Gereksiz patch üretmek yerine mevcut envanter yeniden kanıtlandı. `requiredNutFilesCopied=[]`, `runnersChanged=false`.

Önceki2081 kontrol, ayrı NUT+prototip ağacının kapsamıydı. Buradaki1161 ile aynı ürün kapsamı değildir; fark silinen/skip edilen test sayısı olarak yorumlanmaz. Radio runtime'ında bulunmayan backup/draft/recovery prototype testleri bu tabana körlemesine eklenmedi. Yeni Core/restore kapsaması iddia edilmez. Bu çalışma NUT ile bütünleşmiş tam ürün adayı değildir; Radio tabanının güncel yerel başlangıç kanıtıdır.

## Gerçek koşular

Kanıt `/workspace/.cache/today-evidence/radio-test-baseline-20261110` altında; her ana komutun exit-code JSON'u ayrı tutulur.

| Kapı | PASS | FAIL | Kanıt |
|---|---:|---:|---|
| Automation hedef |8|0|`automation.log`, `target-exits.json`|
| Nutrition hedef |50|0|`nutrition.log`, `target-exits.json`|
| Radio directory/UI/player hedef |23+22+25|0|`radio-directory.log`, `radio-ui.log`, `radio-player.log`|
| Tam npm test |1161|0|`platform.log`, `platform-exit.json` exit0|
| Today AI/Radio entegrasyonu |335|0|`integration.log`, `integration-exit.json` exit0|
| AI Engine raporlanan kontroller |403|0|`engine.log`, `engine-exit.json` exit0|
| Sentetik benchmark |16|0|`benchmark.log`, `benchmark-exit.json` exit0; güvenlik ihlali0|
| Chromium desktop |15|0|İlk `browser.log` koşusunun Chromium bölümü tamamlandı.|
| Linux WebKit iPhone profili |15|0|`webkit.log`, `webkit-exit.json` exit0; dar /var/tmp erişimiyle son koşu.|

Hedef automation/Nutrition platform toplamının, Radio23+22+25 ise335 entegrasyon toplamının alt kümeleridir; ayrıca eklenip toplam şişirilmez. Engine403 kendi çıktısındaki10 grubun toplamıdır;403 ayrı bağımsız vaka veya assert sayımı iddia edilmez. Benchmark16 vaka, Engine içindeki benchmark evaluator85 kontrolünden farklı bir kapıdır. Tek platform/entegrasyon/Engine/benchmark koşusu çalıştırıldı; değişmeyen kapılar tekrar edilmedi.

İlk browser koşusu **29 PASS /1 FAIL,exit1**: Chromium15/15, WebKit14/15. Hata `today.spec.cjs:530`, radyo oynatmada Çalıyor yerine gerçek hata durumudur; sonuç başarılı diye sunulmadı. Beklenti/süre/codec/MP3/HTMLAudio kodu veya üretim player değiştirilmedi, skip/retry eklenmedi. İlk log, screenshot ve trace `browser.log`/`browser-results` içinde korunur.

## WebKit hatasının kök nedeni

Minimal native Audio probe'ları yalnız aynı20 saniyelik yapay sessiz MP3'ü kullandı. Data URI playback native currentTime ilerlemesiyle çalıştı; decoder yok varsayımı doğrulanmadı. Aynı MP3'ün route.fulfill ile HTTPS network akışı GStreamer `downloadbuffer0` hatası verdi: **Could not create temp file /var/tmp/WebKit-Media-XXXXXX; Read-only file system**. Native MediaError.code4 ve NotSupportedError üretildi. Trace'te fixture HTTP200 ve20062 byte olarak teslim edildi; station erişilemez varsayımıyla ürün kodu değiştirilmedi.

`TMPDIR` ayarı WebKit'in bu yolunu değiştirmedi. Ayrı null audio driver denemesi de temp-file sorununu çözmedi; son testte kullanılmadı. Yalnız komut sandbox'ına `additional_permissions.file_system.write=["/var/tmp"]` eklenince aynı network probe1.22 saniye native currentTime/readyState4 ile çalıştı. Bu, scope'lu test ortamı erişimidir; sistem izinleri/sudo/proxy/TLS/SW veya uygulama sandbox'ı değiştirilmedi. Kullanılan ses dosyası test fixture'ıdır; dış yayın veya kullanıcı kaydı yoktur. Fiziksel cihaz sesi/arka plan kabulü değildir.

İlgili kanıtlar `audio-probe-network.log` (hata), `audio-probe-tmp.log` (aynı hata), `audio-probe-writable.log` (native ilerleme). Base64 fixture içeren ayrıntılı loglar yapay veridir; metin raporuna taşınmadı. WebKit15 test yeniden yalnız bu dar temp erişimiyle çalıştırıldı:15/15 PASS,0 FAIL,exit0; son radyo testi dahil. Chromium'un ilk koşuda geçen15 testi ve diğer paketler tekrar edilmedi. Böylece iki motor için son doğrulanmış sonuç15+15=30 PASS,0 son FAIL; tek yeni30/30 koşusu yapıldı iddiası yoktur. `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` önceden hazırlanmış WebKit cache'inin host-library ön kontrolü içindir; assertion'lar etkindir. Linux WebKit gerçek iPhone değildir.

## Korunum ve uzak durum

Yalnız4 belge/envanter dosyası: bu rapor, JSON, changelog, backlog. Başlangıç commit'indeki bütün izlenen uygulama/test/fixture/workflow/lockfile/asset dosyaları byte düzeyinde korunur. Native SDK derlemesi/kurulumu veya gerçek saat/bildirim işi yapılmadı; mevcut testlerdeki sentetik bridge kontrolleri fiziksel özellik kabulü sayılmaz.

Önceki hazırlık kaynağı `/workspace/Today-po1-candidate-scope` dal/SHA/status ve260 kirli dosya hash'i; temiz `/workspace/Today` Radio dalı ve mevcut bütün git ref'leri koruma kaydına alındı. Yeni yerel task ref'i dışında eski ref değiştirilmedi. Staging boş; commit/push/PR/merge/deploy/CI rerun/cherry-pick/stash/reset/clean yok. Şema/key/store/gerçek kullanıcı verisi değişmedi. Kök node_modules symlink yerine ignored dizinde mevcut kilitli dependency hedeflerine bağlantılar kullanıldı; paket/lockfile ve dependency içerikleri değişmedi.

Salt okunur PR2 kontrolü head b57dbce/açık/taslak/merge edilmemiş. Son Radio Actions run **41201384768**, aynı SHA için completed/success gözlendi (`remote-ci.json`); yeni yerel görev için CI tetiklenmedi. AGENTS/proje kuralları, Radio ve hazırlık changelog/backlog'u okundu; kullanıcının Today commit/push/yayın yasağı normal iş akışına önceliklidir. Cloud environment runtime/package yönergesi kullanıldı.

## Sonraki tek öneri

Bu dar test tabanı görevi tamamlandı; kapsam/bütünlük denetimi4/4 PASS,0 FAIL (`audit.log`). Üretim ve test kaynakları Radio başlangıcıyla byte eşit; bu sonuç yeni Core/restore entegrasyon kapılarını kapatmaz.

Test tabanı tamamlandığında **PO1-UX02'nin yalnız Core'a hedeflenmiş yerel CSS patch'i**: Radio tabanındaki index.html içinde `[data-view="pick"]` başlık/seçenek/renk grubu/not/durum hizalaması; mevcut görünüm,7 renk kimliği, bütün handler ve Radio oynatma sürekliliği korunur. NAV01, yeni renk/ses/auth/dil, note save callback'i, SW/restore/şema bu işe karıştırılmaz. Mevcut kaynakta kalan veri güvenliği riskleri CSS ile çözüldü sayılmaz.

Bu öneri yeni görevde ayrıca tetiklenir; bu oturum görsel kodlamaya geçmez. T90-07/08 tam veri/legacy writer/restore/kurtarma kapıları ve gerçek ürün adayı ACC01 açık kalır; kullanıcı önizleme kabulü gerçek aday kabulüne aktarılmaz. Üretim/pilot yayını başlamaz. Mevcut ayrı Sites yayın onayı Today deposu remote işlemi yetkisi değildir.

Önerilen model Sol Medium; model değiştirilmedi. Kaynak envanter yeniden kullanıldı; gerekli tek tam platform ve hedefli arıza teşhisi dışında test tekrarı yapılmadı. Kota tahmini yoktur.
