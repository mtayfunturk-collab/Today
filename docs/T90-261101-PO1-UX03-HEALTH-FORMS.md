# PO1-UX03 — Health iç form ölçümü ve dar spor düzeltmesi

10 Kasım 2026. Yerel dal `task/t90-261101-po1-ux03-health-forms`; başlangıç SHA `b57dbceb53eb6a9aacc3bde709b4de096b77e38f`, App2.23.3/schema2/foundation-082. Önceki `/workspace/Today-health-alignment` ağacındaki18 dirty dosya korunarak ayrı worktree'ye taşınmadan kopyalandı. Önceki ana yüzey CSS/not güveni/Core paleti ve diğer modüller korunur. Yeni görev numarası yoktur; bu UX03'ün kalan iç form dilimidir.

## Bulgu ve düzeltme

Kaynak UI'da spor hareket filtreleri `overflow-x:auto` ile yatay şeritti. Yeni ölçüm, ekrandaki bütün filtre düğmelerinin aynı anda viewport içinde olmasını istediği için iki motorda ihlal bildirdi. Bu tüm sayfanın taşmasıyla aynı değildir; kaydırılabilir bir bileşendir. Bu dilimde filtreler esnek satırlara sarıldı: yatay şerit yerine doğal dikey yerleşimde tüm seçenekler görülebilir. Filtre eylemi/veri/aria davranışı aynıdır; overflow gizleme yoktur.

Sentetik program oluşturulup gerçek gün editörü açıldığında320px'te başlık+Kaydet ve görsel+hareket metni+yan düğmeler sayı alanlarını sıkıştırıyordu. Ölçülen sayı alanı iç genişliği38px, kendi scrollWidth'i47px'ti; gün adı alanının da varsayılan metni sığmıyordu.520px altında gün adı editörü tek sütun, hareket satırı doğal dikey grid oldu; eylemler altta yan yana. Taşı/kaldır düğmeleri44×44 minimum alanını korur. Daha uzun formlarda dikey scroll korunur; alanları kırparak çözülmez.

Tek üretim değişikliği `index.html` içindeki mevcut UX03 bloğuna eklenen scoped CSS'dir. Bütün HTML/JS/ID/metin/route/event, Health/Sky/Radio/AI ve depolama modülleri aynıdır. Key/store/şema/migration, kaydetme ve izin davranışı, lockfile/SW/sürüm etiketi değişmez. Önceki kaynak dal yerinde korunur. Gerçek kullanıcı kayıtları kullanılmaz; program oluşturma yalnız izole sentetik tarayıcı profilindeki mevcut UI eylemleriyle yapılır.

Kaynak ağaca göre6 dosya: `index.html`, `tests/static-regression.test.cjs` (yalnız index hash), yeni `tests/e2e/health-forms.spec.cjs`, bu rapor, changelog ve backlog.

## Yeni test kapsamı

3 E2E grup/motor:

| Grup | Ölçülen yüzeyler |
|---|---|
|Sağlık|Uyku, enerji, semptomlar, boş geçmiş|
|Spor|Program oluşturma, boş bugünkü antrenman, hareket kütüphanesi, boş gelişim; ayrıca UI ile oluşturulan3 günlük sentetik program özeti, gün editörü ve dolu antrenman alanları|
|Beslenme|Öğün ekle formu; yeni besin ve yeni tarif editörü|

14 yüzey ×320/393/520px ×100/200% kök yazı =84 düzen/motor. Görünür button/input/textarea/select rect'leri viewport içinde, minimum44px yükseklikte ve kendi yatay içerikleri kutuya sığar. Spor hareket/yan düğme genişliği CSS'de44px'e alınır. Bu test tüm iç metinlerin veya tüm koşullu alt durumların eksiksiz erişilebilirlik/kontrast kabulü değildir. Matris varsayılan temadadır; önceki6 ana yüzey/tema testleri de tam paket içindedir. Önceki Health CSS iki başlık/tema sorunu için aynen korunur.

Dolu gün editöründe uzun yapay başlık yazılıp klavyeyle End/Home kullanılarak metnin sonuna/başına ulaşılır; isim kaydet düğmesine basılmadığından kullanıcı onaysız program adı değişmez. Bu, gerçek iPhone yazılım klavyesi kabulü değildir. Besin/tarif editörleri kaydedilmeden kapatılır; program yalnız sentetik profilde oluşturulur. Mevcut platform paketi besin/öğün/su gerçek IndexedDB yazma ve Core korunumu gibi davranışları ayrıca çalıştırır.

İlk kaynak ölçümü **4PASS/2FAIL**: sadece spor filtre şeridi. Sarma düzeltmesi ve dolu program kapsamı eklenince ikinci hedef **4PASS/2FAIL**: bu kez program adı ve sayı alanı sıkışması. Dar grid düzeltmesiyle spor hedefi **2/2 PASS** oldu. Beklenti/timeout gevşetilmedi, skip/retry eklenmedi. İlk FAIL'ler log ve trace'leriyle korunur; son tam paket güncel testi ayrıca kapsar. Spor gün editörünün WebKit görüntüsü tam koşudan önce görsel olarak incelendi.

Kanıt `/workspace/.cache/today-evidence/health-forms-20261110`: başlangıç snapshot'ı, baseline/second/sport target logları ve exit JSON'ları, tam browser/platform/entegrasyon logları ve ekran görüntüleri. Linux WebKit iPhone profili fiziksel iPhone15/Safari/kurulu PWA/Windows değildir. Scoped `/var/tmp` medya temp erişimi kullanılır; WebKit bağımlılık katalog precheck'i atlanır, gerçek test/assertion'lar çalışır.

## Sınırlar ve devam

Bu dilim, önceki6 ana yüzey ve burada listelenen temel/dolu formlarla UX03'ün yerel otomatik sunum kabulünü tamamlamayı hedefler. Her kaydedilmiş geçmiş satırı/ithal veri kombinasyonu, hata/kota ekranı, tarifte dolu malzeme satırlarının tüm çeşitleri ve tüm spor program varyasyonları eksiksiz sınanmış sayılmaz. Yerel otomatik kabul fiziksel cihaz/klavye/dinamik Safari çubuğu kabulünün yerine geçmez. T90-07/08 tam veri yedek/restore/kesinti/pilot kapıları açıktır.

PR1/PR2 yeniden salt okunur kontrol edildi: açık/taslak/unmerged, başları `ede686d`/`b57dbce`. Commit/push/PR güncelleme/merge/deploy/CI rerun yoktur. Yeniden okunan mevcut CI1:41122504627 failure, Radio CI2:41201384768 success; yerel patch bu run'larda yoktur. Son yerel patch uzak CI'da çalışmadı; mevcut canlı uygulama ve Netlify önizlemesi aynı kalır. Kullanıcının bu sınırı AGENTS'in geniş güncelleme akışından önceliklidir.

Sonraki bağımsız öneri PO1-UX04 Sky hizalama/ölçümüdür; bu oturumda başlanmaz. Önerilen model Sol Medium. Mevcut bağımlılıklar yeniden kullanıldı; önce ilgili ekran ölçümleri, sonra gerekli birleşik kapılar çalıştırılır. Değişmeyen Engine/benchmark tekrar edilmez; önceki403/16 bu görevin yeni sonucu değildir. Model değişimi veya kalan kota yüzdesi iddia edilmez.

## Nihai yerel sonuç

| Kapı | PASS | FAIL |
|---|---:|---:|
| Platform (`npm test`) |1161|0|
| AI/Radio entegrasyonu |335|0|
| Tek son tam Playwright (34 Chromium+34 WebKit) |68|0|
| Bütünlük |4|0|

Tüm son kapılarda exit0. Yeni6 motor/grup kontrolü tam68'e dahildir; hedefler ayrıca toplanmaz. Önceki iki4/6 sonuçlarının hataları kapandı. Son spor klavye End/Home eklemesi tam koşuda iki motorda geçti. Kaynak HEAD/dal/18 dirty dosya ve eski refs aynı; tam6 dosyalı delta, boş staging/temiz whitespace. `css-only.json` index'in ek CSS dışındaki bütün içeriğinin kaynakla aynı olduğunu doğrular.

**Durum: UX03'ün listelenen ana yüzey ve iç formlardaki yerel otomatik sunum kabulü tamamlandı.** Bu fiziksel kabul veya tüm koşullu sağlık kayıtları için kapsamlı erişilebilirlik garantisi değildir. Gerçek iPhone/PWA/Windows ve veri/restore/pilot kapıları açık kalır. Sonraki öneri PO1-UX04; bu oturumda başlatılmadı.
