# PO1-UX03 — Health hizalaması, ilk dar uygulama dilimi

10 Kasım 2026. Yerel dal `task/t90-261101-po1-ux03-health-alignment`; başlangıç SHA `b57dbceb53eb6a9aacc3bde709b4de096b77e38f`, Radio2.23.3/schema2/foundation-082. Kaynak `/workspace/Today-core-palette` ağacındaki16 dirty dosya ayrı worktree'ye korunarak kopyalandı. Bu görev Health sunumudur; Core paleti, gezinme ve not güveni kodu korunur.

## Uygulama ve kapsam

Tek üretim dosyası `index.html`, işaretli PO1-UX03 CSS bloğu:

- Üst şerit44px/esnek başlık/44px grid; absolute başlık yerine doğal, ortalı ve sarılabilir başlık. Geri eylemi ve dinamik alt ekran başlıkları aynıdır.
- Health form kontrolleri en az44px,1rem yazı, esnek genişlik; düğme ve metinler sarılır. Bileşen stiliyle öncelik çakışmaması için kontrol seçicisi Health görünümüyle sınırlandırılmıştır.
- Ana merkez/kart/form kapsayıcılarında ortak genişlik ve min-width:0; başlıklar merkez ekseninde. Gün kontrolleri gerektiğinde sarılır.
-420px altında kütüphane editörü/besin/meta/bileşen ve tüketim editörünün alanları tek sütuna geçer; gerekli dikey kaydırma korunur.
- Health select'leri opak tema zemini/yazı rengi ve tema uyumlu native color-scheme kullanır. WebKit'te açık native zeminde açık yazı sorunu giderilir.

Yeni overflow:hidden/clip eklenmedi. Önceden bulunan global clip kuralları bu dar görevde topluca değiştirilmedi; bütün taşmaların giderildiği veya iOS bounce/klavye davranışının fiziksel olarak doğrulandığı söylenmez.

**Bu ilk dilimin doğrudan görsel kabulü6 yüzeydir:** Health ana merkezi, Beslenme merkezi, Sağlık merkezi, Spor merkezi, Su, Kişisel Sağlık Verileri. Ana ve ortak form CSS'si Health'in diğer alt ekranlarını da etkileyebilir; öğün/kütüphane, uyku/enerji/semptom ve spor kayıt/programlarının bütün iç formları için ayrıntılı büyük yazı/geometri kabulü henüz tamamlanmadı. UX03 bütünü tamamlandı sayılmaz. Sıradaki küçük iş bu alt formları aynı ölçüm kapsamına almak ve varsa dar CSS düzeltmeleri yapmaktır; UX04'e kendiliğinden geçilmez.

## Veri ve değişen dosyalar

Kaynak palet patch'ine göre6 dosyalı delta: `index.html`, `tests/static-regression.test.cjs` (yalnız index hash), yeni `tests/e2e/health-alignment.spec.cjs`, bu rapor, changelog/backlog. HTML/JS/DOM ID/metin/event/route, kalıcı veri anahtarı/store/şema/migration, depolama modülleri, Health/Sky/Radio/AI kodu, lockfile, SW ve sürüm etiketleri aynıdır. Yeni izin/senkronizasyon veya native saat/bildirim işi yoktur. Gerçek kullanıcı verisi yerine geçici sentetik tarayıcı profilleri kullanılır. LocalStorage değişmezlik testi yalnız ziyaret/tema DOM değişikliği için çalışır; tüm IndexedDB tiplerinin yedek/restore kabulü değildir.

## Test ve kök neden kayıtları

İki yeni senaryo/motor:

1.6 yüzey ×320/393/520px ×100/200% yazı =36 düzen/motor. Başlık merkez farkı<1px; görünür button/input/select/textarea viewport içinde, en az44px ve kendi yatay içeriği kutusuna sığar. Doğal dikey scroll korunur;6 ekran görüntüsü/motor alınır. Bu ölçüm bütün metin/panel/alt formların hiçbir koşulda kırpılmadığının kanıtı değildir.
2. Üç temada Sağlık/Kişisel Sağlık Verileri ziyaretleri, Su select yazı/zemin kontrastı≥4.5:1, ziyaret boyunca localStorage değerlerinin aynılığı ve Core'a dönüş. Kontrast yalnız örnek su select'inde hesaplanır; tam WCAG değerlendirmesi değildir.

İlk hedef **2PASS/2FAIL**: dinamik `.todayWaterSettings select` stili minimum42px'le yeni kontrol kuralını geçersiz kılıyordu. Yalnız Health selector önceliği düzeltilince ikinci hedef **4/4 PASS** oldu. Görsel WebKit incelemesi su select'inde açık native zemin/açık yazı sorununu ortaya çıkardı. Ara tam koşu ürün değişikliğinden önce bilinçli durduruldu: **9PASS/1 interrupted/52 çalıştırılmadı**; PASS kabul edilmedi.

Kontrast beklentisi eklendiğinde yeni hedef **2PASS/2FAIL**, yaklaşık1.12:1 verdi. Dinamik bileşenin sonra gelen yarı saydam zemini yine öncelikliydi. Yalnız Health select'inde daha güçlü seçiciyle opak tema zemini sağlandı; son kontrast hedefi **2/2 PASS** oldu. Beklenti/timeout gevşetilmedi, retry/skip eklenmedi. İlk ve ara loglar korunur; son tam koşu güncel CSS'yi ayrıca sınar.

Kanıt `/workspace/.cache/today-evidence/health-alignment-20261110`: `baseline.json`, `target.log`, `second-target.log`, `final-target.log`, `contrast-target.log`, `interrupted-browser.log`, son browser/platform/integration log ve exit JSON'ları. WebKit Linux iPhone profilidir; gerçek iPhone15 Safari/kurulu PWA veya Windows kabulü değildir. WebKit dependency katalog precheck'i atlanır fakat test ve assertion'lar çalışır; medya fixture için scoped `/var/tmp` erişimi kullanılır. Değişmeyen bağımsız Engine/benchmark tekrar çalıştırılmadı; eski403/16 yeni test sonucu sayılmaz.

## Yetki ve devam

PR1/PR2 salt okunur yeniden kontrol edildi: açık/taslak/unmerged, SHA'lar `ede686d`/`b57dbce`. Yeniden okunan mevcut CI1:41122504627 failure, Radio CI2:41201384768 success; yerel patch bu sonuçlarda yoktur. Bu patch için yeni uzak CI yoktur. Commit/push/PR güncelleme/merge/deploy/CI rerun yapılmadı; mevcut canlı uygulama ve Netlify önizlemesi değişmedi. Kullanıcının yerel sınırı AGENTS'in daha geniş akışından önceliklidir.

Sonraki öneri UX03 iç form kabulüdür; bu oturumda yeni bağımsız göreve başlanmaz. Fiziksel kabul, tam veri/restore/kesinti/pilot kapıları ve yayın ayrıca kalır. Model önerisi Sol Medium. Kullanım optimizasyonu: ilgili CSS ve ekranlarla sınırlı analiz, mevcut bağımlılıklar, önce hedefli test, görsel hata bulununca ara koşuyu kesme, son sürümde gerekli birleşik kapılar. Model veya kalan kullanım yüzdesi iddiası yoktur.

## Nihai yerel sonuç

| Kapı | PASS | FAIL |
|---|---:|---:|
| Platform, son CSS (`final-platform.log`) |1161|0|
| AI/Radio entegrasyonu |335|0|
| Tam Playwright, tek son koşu (31 Chromium+31 WebKit) |62|0|
| Bütünlük |4|0|

Tüm son kapılar exit0. Yeni Health4 test tam62'ye dahildir; hedef koşular ayrıca toplanmaz. Entegrasyon335 mevcut JS üzerinde bu aşamada çalıştı; sonraki son değişiklikler yalnız CSS ve index checksum'udur. Güncel CSS'de platform ve tam browser yeniden geçti. Son WebKit Su görüntüsü okunabilirlik için tekrar incelendi. `css-only.json` index'in yeni CSS dışındaki bütün içeriğinin kaynakla aynı olduğunu kanıtlar. Son audit kaynak HEAD/dal/16 dirty dosya ve eski refs'in korunduğunu, tam6 dosyalı deltayı, boş staging/temiz whitespace'i doğrular.

**Durum: ilk Health sunum dilimi yerel olarak tamamlandı; UX03 genel iç form kabulü devam ediyor.** Sonraki öneri öğün/kütüphane ve sağlık/spor iç formlarının ayrıntılı büyük yazı/geometri kontrolüdür. Fiziksel iPhone/PWA, veri/restore ve yayın kapıları açık. Bu oturumda başka bağımsız işe geçilmedi.
