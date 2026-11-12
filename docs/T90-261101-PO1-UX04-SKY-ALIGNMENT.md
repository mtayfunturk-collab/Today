# PO1-UX04 — Sky hizalaması ve yerel görsel kabul

11 Kasım 2026 (TSİ). Yerel dal `task/t90-261101-po1-ux04-sky-alignment`; başlangıç SHA `b57dbceb53eb6a9aacc3bde709b4de096b77e38f`, App2.23.3/schema2/foundation-082. Önceki `/workspace/Today-health-forms` çalışma ağacındaki20 dirty dosya ayrı worktree'ye korunarak kopyalandı. Health68/68 browser sonucu önceki aşamadır; yeni Sky sonucu aşağıda ayrı kaydedilir. Kaynak çalışma ağacı ve eski refs değişmez.

## Bulgu, değişiklik ve dosyalar

Sky üst başlığı absolute konum + sabit maksimum genişlik + nowrap/ellipsis ile dar ekranda kesiliyordu:320px'te kullanılabilir alan138px, doğal başlık genişliği165–194px. Bugünün Gökyüzü ve Önemli Dönemler ekranlarındaki bazı eylemler39px yükseklikteydi. Bu iki sorun mevcut profilsiz/sentetik profilli akışlarda ölçüldü.

Tek üretim dosyası `index.html`, yeni işaretli PO1-UX04 CSS bloğu:

- Üst şerit44px / esnek başlık /44px grid; başlık akış içinde ortalanır ve gerektiğinde sarılır. Başlıktaki ellipsis/kırpma kalkar; tüm Sky görünümünün mevcut global overflow davranışı bu görevde topluca değiştirilmez.
- Sky button/input/select/textarea/summary için minimum44px yükseklik, esnek genişlik ve1rem yazı. Düğme/summary ve temel metinlerde sarma; başlıklarda dengeli satır yüksekliği.
- Mevcut hub/panel/form kapsayıcıları ortak genişlik ve orta ekseni korur. Native select'ler opak tema zemini/yazı ve light/dark color-scheme kullanır.

Yeni overflow gizleme veya sabit form yüksekliği yoktur. Uzun formların doğal dikey kaydırması korunur; bütün içerik/diyagramların her koşulda sıçramasız veya kırpılmasız olduğu iddia edilmez.

Kaynak Health patch'ine göre6 dosyalı delta: `index.html`, `tests/static-regression.test.cjs` (yalnız denetlenen index hash), yeni `tests/e2e/sky-alignment.spec.cjs`, bu rapor, changelog ve backlog. HTML/JS/metin/DOM ID/event/route, Sky hesaplama ve profil modülleri, Core/Health/Radio/AI, localStorage/IndexedDB anahtar/store/şema/migration, lockfile/SW/sürüm etiketleri aynı kalır. Yeni konum izni/sağlayıcı/ağ aktarımı yoktur. Sky'ın sembolik ve isteğe bağlı sınırı korunur; sağlık/ruh hali çıkarımı eklenmez.

## Doğrulama kapsamı

İki yeni senaryo her motorda çalışır:

1. Profilsiz: Sky ana merkez, Doğum Bilgileri, Harita Özeti, Bugünün Gökyüzü, Önemli Dönemler, Core–Sky Bağlantısı. Bunların gerekli profil/konum eksikliği durumları korunur.
2. İzole sentetik profil: mevcut formda1990-06-15/08:30/İstanbul bilgileri kullanıcı eylemleriyle kaydedilir; yerel şehir dizininden aday seçilerek Harita Özeti açılır. Aynı6 panel ölçülür. Bugünün Gökyüzü'nde mevcut “doğum yerini kullan” düğmesine ayrıca basılır ve canlı saat görünürlüğü doğrulanır; normal uygulamada otomatik konum kullanımına dönüştürülmez.

6 panel ×3 genişlik (320/393/520) ×2 kök yazı ölçeği (100/200%) ×3 tema (dark/light/contrast) ×2 profil durumu =216 düzen/motor. Üst başlık merkez farkı<1px; görünür button/input/select/textarea/summary ve başlık rect'leri viewport içinde, eylemler≥44px ve kendi yatay içerikleri kutuya sığar. Core gün verileri ve Sky doğum profili ziyaretler boyunca aynıdır. Yeni test normal HTTP(S) dış kaynak isteği olmadığını da kontrol eder; genel güvenlik denetiminin yerine geçmez.

Ekran görüntüleri her panel/profil/motor için alınır. WebKit doğum formu ve profilli canlı gökyüzü görüntüleri görsel olarak incelendi. Test gerçek iPhone15/Safari/kurulu PWA/Windows kabulü değildir; Linux WebKit iPhone profilidir. Gerçek yazılım klavyesi, Safari çubuklarının hareketi ve tüm astrolojik diyagram işaretlerinin çakışmasızlığı bu ölçümün tamamlanmış kabulü sayılmaz. Yaklaşık/bilinmeyen saat, tüm coğrafi/DST adayları, silme onayı ve tüm genişletilmiş ayrıntıların kombinasyonları eksiksiz taranmadı; mevcut davranış testleri korunur.

## İlk sonuçlar ve kök nedenler

- İlk hedef **0PASS/4FAIL**. Profilsiz iki motor gerçek başlık kırpma/39px düğmeleri yakaladı. Profilli iki motor ise testin genel `data-sky-open=birth` seçicisinin iki farklı düğmeyle eşleşmesi yüzünden başlayamadı. Test özel `#skyBirthCard` kimliğiyle düzeltildi; ürün düğmeleri değiştirilmedi.
- İlk CSS sonrası ikinci hedef **0PASS/4FAIL**: artık iki profil akışı tamamlandı ve düğme ölçüleri düzeldi; dinamik `.skyView > .topbar .pill` kuralı sonra eklendiğinden başlık hâlâ kesiliyordu. Daha güçlü fakat yalnız Sky'a özgü seçiciyle düzeltildi.
- Üç temaya genişletilmiş hedef **4/4 PASS**. Canlı gökyüzü eylemi eklenince ayrı profilli hedef **2/2 PASS**. Son tam paket bu testi yeniden kapsar; hedefler toplam sonuca ayrıca eklenmez. Timeout/retry/skip veya geometri toleransı gevşetilmedi.

Kanıt `/workspace/.cache/today-evidence/sky-alignment-20261111`: baseline snapshot, baseline/second/final/live target log/exit JSON'ları, platform/entegrasyon ve tam browser logları, görüntüler ve bütünlük raporu. WebKit medya fixture için scoped `/var/tmp` erişimi kullanılır; dependency katalog precheck'i atlanır fakat gerçek browser/assertion çalışır. Bağımlılık kurulmadı. Bağımsız Engine/benchmark değişmediğinden tekrarlanmadı; önceki403/16 yeni sonuç sayılmaz.

## Uzak durum ve devam

PR1/PR2 yeniden salt okunur kontrol edildi: açık/taslak/unmerged, SHA'lar `ede686d`/`b57dbce`. Mevcut CI1:41122504627 failure ve Radio CI2:41201384768 success; bu yerel patch bunlara dahil değildir. Commit/push/PR güncelleme/merge/deploy/CI rerun yapılmadı; mevcut canlı uygulama ve Netlify önizlemesi korunur. Kullanıcının yerel sınırı AGENTS'in geniş PR güncelleme akışından önceliklidir.

Sonraki bağımsız öneri PO1-UX05 Radio/AI yüzey hizalamasıdır; burada başlanmaz. Fiziksel cihaz ve T90-07/08 veri/restore/kesinti/pilot kapıları açıktır. Model önerisi Sol Medium; model değiştirme veya kalan kullanım yüzdesi iddiası yoktur. Yalnız ilgili modüller, mevcut bağımlılıklar, hedefli testler ve aşama sonu tek tam browser koşusu kullanılır.

## Nihai yerel sonuç

| Kapı | PASS | FAIL |
|---|---:|---:|
| Platform (`npm test`) |1161|0|
| AI/Radio entegrasyonu |335|0|
| Tek son tam Playwright (36 Chromium+36 WebKit) |72|0|
| Bütünlük |4|0|

Tüm son kapılarda exit0. Yeni4 motor/senaryo kontrolü tam72'ye dahildir; hedefler ayrıca eklenmez. Son tam koşuda Sky Core/profil değişmezlik ve dış istek yokluğu assertion'ları iki motorda geçti. Son audit kaynak SHA/dal/20 dirty dosya ve eski refs'in aynılığını, tam6 dosyalı deltayı ve boş staging/temiz whitespace'i doğrular. `css-only.json` index'in yeni scoped CSS dışındaki bütün içeriğinin kaynakla byte düzeyinde aynı olduğunu kanıtlar.

**Durum: PO1-UX04 listelenen Sky yüzeylerinde yerel otomatik sunum kabulünü tamamladı.** Gerçek iPhone/PWA/Windows, tüm koşullu profil/harita/konum varyasyonları, tam veri/restore/pilot ve yayın kabulü açık kalır. Sonraki öneri PO1-UX05; bu oturumda başlatılmadı.
