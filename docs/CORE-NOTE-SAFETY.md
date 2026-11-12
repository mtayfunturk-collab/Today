# Core not güveni — NAV01 engelinin dar düzeltmesi

10 Kasım 2026. Yerel görev dalı `task/core-note-safety`; başlangıç SHA `b57dbceb53eb6a9aacc3bde709b4de096b77e38f` (Radio2.23.3/schema2/foundation-082). Önceki `/workspace/Today-core-navigation` çalışma ağacındaki13 dosyalı patch korunarak ayrı worktree'ye kopyalandı. Kaynak dal ve dosyalar yerinde korunur; yeni görev numarası tahsis edilmedi. Bu dilim kullanıcı tarafından “devam edelim” ile tetiklenen, [NAV01'de bulunan not kaybının](T90-261101-PO1-NAV01-CORE-NAVIGATION.md) düzeltmesidir; renk/dil/ses/auth veya yayın işi değildir.

## Kök neden ve düzeltme

Eski input zamanlayıcısı 450ms sonra textarea'nın o andaki değerini okuyordu. Arada Core'a dönüş `loadPickUI` ile eski kalıcı notu alana yükleyince taslak kayboluyordu. Önceki sabit saatli test Chromium ve WebKit'te FAIL verdi; önceki sürüm karşılaştırması da hatayı iki motorda üretti. Kanıt `/workspace/.cache/today-evidence/core-navigation-20261110/fixed-clock-note.log` ve `baseline-probe.json` içindedir.

Yeni işleyici giriş anındaki **tarih ve metni** yakalar. Yalnız bellekte, tarih anahtarına göre taslak/zamanlayıcı Map'i tutulur. Core'a dönüş aynı tarihin bekleyen taslağını gösterir; kayıt DOM'dan yeniden metin okumaz. Aynı günün yeni düzenlemesi önceki zamanlayıcıyı iptal eder; iki ayrı günün bekleyen kayıtları birbirini iptal etmez. Boş metin bilinçli düzenleme olarak korunur (`??`, truthy kontrolü kullanılmaz). Başarılı kayıt taslağı bellekten çıkarır. Mevcut gizli sıfırlama işleyicisi yalnız kendi gününün bekleyen kaydını iptal eder; eski taslak sonradan geri gelmez. Sıfırlama düğmesi görünür yapılmadı.

Kayıt başarısız dönerse veya legacy yazımından kota istisnası fırlarsa taslak oturumda tutulur ve görünür Core'da “Not kaydedilemedi. Taslak bu oturumda korunuyor.” gösterilir. Başarı mesajı yalnız başarılı sonuçta ve aynı günün Core ekranında gösterilir. İstisna merkezi hata kanalına yalnız sabit hata kodu/hata sınıfıyla bildirilir; not veya ham hata mesajı eklenmez. Otomatik yeniden deneme/flush eklenmedi; kullanıcı yeniden düzenlerse normal zamanlayıcı yeniden çalışır.

## Kapsam, veri ve sınırlar

Kaynak NAV01 patch'ine göre delta7 dosyadır: `index.html`, `tests/static-regression.test.cjs` (yalnız index checksum), `tests/e2e/core-navigation.spec.cjs`, bu rapor, önceki NAV01 raporuna güncel bağlantı, changelog ve backlog. Tek üretim dosyası index'tir; değişiklik sadece taslak Map'i, not yükleme/kayıt ve mevcut resetin zamanlayıcı temizliğidir. Tasarım/gezinme/palet, Router/Health/Sky/Radio/AI modülleri, depolama anahtarları/store/şema/migration, lockfile, SW/sürüm etiketi aynıdır. Kullanıcı verisi yerine ayrı sentetik profiller kullanıldı.

Bu bir işlem bütünlüğü veya tam yedek/geri yükleme çözümü değildir. Mevcut state yazıcısı legacy/v2 depolarını ayrı yazar; ikinci yazımda hata olursa kısmi kalıcılık mümkündür. Yeni hata mesajı başarı iddia etmez; atomik rollback iddiası yoktur. Bekleyen veya başarısız taslak yalnız bellektedir: sekme kapanması/reload/OS sonlandırması öncesinde henüz kalıcılaşmamış metin korunmuş sayılmaz. Mevcut450ms debounce devam eder; yeni kalıcı taslak anahtarı ya da migration eklenmedi. Çok sekmeli çakışma, BFCache ve genel kesinti/kurtarma T90-07/08 kapsamında açıktır. Bu küçük düzeltme pilot kapılarını kapatmaz.

## Testler ve teşhis

Yeni4 E2E senaryosu her motorda gerçek index işleyicilerini kullanır:

- Bekleyen taslağın dönüşte görünmesi, son düzenlemenin kazanması ve bilinçli boşaltmanın iki mevcut Core deposuna yazılması.
- Europe/Istanbul gece yarısı öncesi/sonrası iki taslak ve bağımsız zamanlayıcı; önceki günün seçimi, iki günün ayrı notları ve reload sonrası kalıcılık.
- Mevcut resetin yalnız sentetik kayıtta pending taslağı iptal etmesi.
- Legacy ve v2 yazımlarında sentetik kota hatası; önceki kalıcı kayıtların aynen kalması, hata metni ve modül dönüşünde bellek taslağının korunması. Bu senaryo tüm yazımları engeller; kısmi yazım/rollback testi değildir.

Önceki hızlı dönüş testi değiştirilmeden tutuldu. İlk hedef koşusu **16 PASS/2 FAIL**: not kaybı ve tarih sınırı geçti; kota testi eski legacy yazıcının senkron istisnasını ortaya çıkardı (`clock.runFor: QuotaExceededError`). Yalnız not callback'ine catch eklenince hedef kota testi **2/2 PASS**, exit0 oldu. Test beklentisi/timeout gevşetilmedi, retry/skip eklenmedi. Son birleşik sonuçlar aşağıdadır.

Kanıt `/workspace/.cache/today-evidence/core-note-safety-20261110`: ilk hedef `target.log`, düzeltme sonrası `quota-target.log`, platform/entegrasyon/tam browser logları ve exit JSON'ları. Testlerde kontrollü saat kullanımı yalnız senaryoları deterministik yapar; ürün saat/date kodu değiştirilmez. Browser motorları Chromium ve Linux WebKit iPhone profilidir. Scoped sandbox izniyle `/var/tmp` WebKit medya geçici dosyası yazımı açılır; host dependency katalog precheck'i atlanır, test/assertion'lar çalışır. Gerçek iPhone15/Safari/kurulu PWA/Windows kabulü yapılmadı; önceki önizleme kabulü bu patch'e taşınmaz.

## Uzak durum ve sonraki adım

PR1 ve PR2 açık/taslak/unmerged; SHA'ları `ede686d`/`b57dbce`. Salt okunur yeniden kontrol edilen eski CI1:41122504627 failure, Radio CI2:41201384768 success; yerel patch bu run'larda yoktur. Commit/push/PR güncelleme/merge/deploy/CI rerun yapılmadı. Kullanıcı talimatındaki yerel sınır AGENTS'in geniş GitHub güncelleme akışından önceliklidir. Mevcut canlı uygulama ve Netlify önizlemesi değişmedi.

Not güveni ve NAV01 otomatik kapıları geçerse sonraki ayrı öneri PO1-COR01 renk paletidir; kendiliğinden başlatılmaz. Fiziksel aday kabulü, sürüm/SW tutarlılığı ve yayın ayrıca gerekir. Model önerisi bu veri güveni dilimi için Sol High; sonraki sınırlı palet işi Sol Medium. Model değiştirme iddiası yok. Bağımlılık kurulmadı; ilgili dosyalar, önce hedefli test sonra bir tam birleşik regresyon kullanıldı. Değişmeyen bağımsız Engine/benchmark bu görevde tekrar çalıştırılmaz; eski403/16 yeni sonuç sayılmaz.

## Nihai yerel sonuç

| Kapı | PASS | FAIL | Çıkış |
|---|---:|---:|---:|
| Platform (`npm test`) |1161|0|0|
| AI/Radio entegrasyonu |335|0|0|
| Tam Playwright (27 Chromium +27 WebKit) |54|0|0|
| Bütünlük denetimi |4|0|0|

Tam browser tek koşuda54/54 başarılıdır; önceki NAV01 beş senaryo/motor ve yeni dört senaryo/motor bu toplama dahildir. İlk16/18 ve kota2/2 ayrıca toplanmaz. Önceki iki hızlı dönüş FAIL'i bu patch'te PASS oldu. Kontrol: eski kaynak çalışma ağacı/13 dirty dosya korunur, mevcut refs değişmez, tam7 dosyalı delta ve boş staging/temiz whitespace doğrulanır. `focused-integrity.json` eski NAV01 testlerinin değiştirilmediğini ve tüm CSS'nin byte düzeyinde aynı kaldığını ayrıca kanıtlar.

**Durum: dar not düzeltmesi ve NAV01'in yerel otomatik kabulü tamamlandı.** Fiziksel iPhone/PWA/Windows, yayın ve genel veri kurtarma kapıları açık kalır. Sıradaki öneri PO1-COR01; bu oturumda başlanmadı.
