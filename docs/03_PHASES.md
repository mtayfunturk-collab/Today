# TODAY MASTER PROJECT
## Geliştirme Fazları ve Kabul Kapıları

Sürüm: 2.0
Durum: Aktif plan
Güncelleme: 29 Ekim 2026
Sürüm kaynağı: `modules/version.js`; şema kaynağı ilgili depolama sözleşmeleri
Aktif iş: NUT-018 / `nut-018-ci-stabilization` / taslak PR #1

## Kullanım

Bu belge yapılacak işlerin kabul koşullarını tanımlar; aşağıdaki planlar teslim edilmiş özellik veya başarılı test iddiası değildir. Güncel çalıştırma sonucu ilgili NUT uygulama raporunda ve PR'da tutulur. Faz 1–2 tarihsel kapanışları belgenin sonunda korunur. Önceki plandaki Faz 3 native önceliğinin yerini, gerçek kullanıcı faydasını mağaza paketlemesinden önce doğrulayan bu sıra alır.

Durumlar: **Planlandı**, **Çalışılıyor**, **Doğrulandı**, **Engelli**. Bir faz, zorunlu fiziksel cihaz testi veya kullanıcı kabulü eksikse tamamlanmış sayılmaz. Hazırlık işinin tamamlanması gerçek cihaz doğrulamasının yapıldığı anlamına gelmez.

## Faz 3 — NUT-018 teknik güven ve PWA hazırlığı

Giriş: mevcut geliştirme dalı ve taslak PR korunur; son başarılı test, güncel kaynak ve açık teknik borç incelenir. Şema, kayıt anahtarları ve mevcut modül davranışı korunur.

| İş | Dar kapsam | Çıkış kanıtı | Sonraki iş |
|---|---|---|---|
| NUT-018.1 | Eksik Health Hub/tüketim editörü testlerinin kök nedenini düzelt; gerçek test envanterini CI'a bağla | İlgili testler ve birleşik kapı PASS/FAIL sayılarıyla yeşil; hiçbir test sessizce atlanmamış; rapor/changelog güncel | NUT-018.2 |
| NUT-018.2 | Dolaylı geliştirme bağımlılıkları ve paket/çalışma zamanı sürüm tutarlılığı | Yeniden üretilebilir temiz kurulum, güncel audit sonucu, açıklanmış kalan bulgu varsa risk kaydı, ilgili regresyonlar yeşil | NUT-018.3 |
| NUT-018.3 | Gerçek tarayıcı otomasyonu, iPhone PWA test senaryoları ve cihaz matrisi hazırlığı | Sentetik/izole veride tarayıcı testleri yeşil; fiziksel cihazda yapılacak adımlar/kanıt alanları hazır | Fiziksel iPhone ve Android doğrulaması / NUT-019 kabul envanteri |

Fazın ürün pilotuna geçiş kapısı: desteklenen fiziksel iPhone Safari + Ana Ekran PWA ve Android Chrome/PWA'da normal açılış, yeniden açılış, yerel kayıt, çevrimdışı kullanım ve kullanıcı onaylı güncelleme kayıpsız çalışmalıdır. Masaüstü WebKit veya mobil viewport, gerçek iPhone/Apple PWA yaşam döngüsünün kanıtı değildir. Gerekli cihaz erişimi yoksa ilgili kayıt **Engelli / cihaz sonucu bekleniyor** kalır.

## Faz 4 — Kurucunun beslenme/hareket hedeflerini sürdürme döngüsü

Önerilen iş paketi ailesi: NUT-019. Henüz kod kapsamı kesinleştirilmiş değildir; ilk alt iş aşağıdaki kabul envanteridir.

Giriş:

- Teknik kapı yeşil; fiziksel cihaz sonuçları ve bilinen sınırlamalar görünür.
- Tam veri dışa aktarımı/geri yükleme kapsamı envanteri çıkarılmış; Core CSV'nin kapsam sınırı açık.
- Kullanıcının birincil beklentisi **“Beslenme ve hareket hedeflerimi sürdürebilmek”** olarak alınır; “bugün hangi küçük adımı kolaylaştıracak?” kabul örnekleri yazılır. Core check-in, uyku/enerji ve AI bu odağı destekler; Sky isteğe bağlı ayrı bir düşünme alanıdır.

Küçük teslim sırası:

1. **NUT-019.1 — Kabul ve veri güveni envanteri:** kurucunun beslenme/hareket hedefini sürdürürken kullandığı yolları, gereksiz kayıt adımlarını, eksik geri bildirimi ve tam yedek/geri yükleme boşluklarını somut örneklerle belirle. Gerçek kullanıcı pilotuna kadar eksik veri güveni işleri zorunlu blokerdır.
2. **NUT-019.2 — Bir günlük akış dilimi:** mevcut Health kayıt/planlama ve hareket yüzeylerinden tek küçük sürtünmeyi gider; kullanıcının kendi seçtiği küçük hedef, düşük çabalı kayıt ve bir sonraki adım döngüsünü tasarla. Önerilen hedef akışı henüz uygulanmış değildir. Kalıcı hedef kaydı yeni veri yapısı gerektirirse önce veri etkisi ve onay kapısı tamamlanır. Kayıt durumu ve boş/eksik veri açıklamaları sadeleşir. Yeni veri modeli yerine mevcut API'leri kullan.
3. **NUT-019.3 — Bir açıklanabilir AI dilimi:** mevcut iki günlük kural ve yedi günlük gözlemi beslenme/hareket hedefinin günlük koşullarını anlamak için daha erişilebilir kıl. Yeni hedefe yönelik öneri ayrı doğrulanacak hipotezdir; mevcut kural kataloğu hedef koçluğu yapıyormuş gibi anlatılmaz. Her çıktı dayanak, belirsizlik, seçenek ve geçerli onay durumunu korur; eşleşme yoksa veri uydurmaz.
4. **NUT-019.4 — Kişisel kullanım kabulü:** önerilen 14 günlük kullanım; kayıt/yeniden açılış/güncelleme, üç somut fayda örneği, kullanılmayan yüzeyler ve açık sorunlar belgelenir. Bu süre kullanıcı benimsemesi veya pazar sonucu sayılmaz.

Çıkış:

- Kurucu, üç farklı günde “Today beslenme veya hareket hedefimi sürdürmemi nasıl kolaylaştırdı; hangi küçük adımı ben seçtim?” sorusunu somut örnekle cevaplayabilir.
- Kritik akışlar testli, kullanıcı verisi kayıpsız, ana sürtünmeler giderilmiş veya pilot sınırı açıkça konmuş.
- Health ana değer akışıdır; Core kısa günlük bağlam sağlar, tüm modülleri doldurma zorunluluğu olmaz. Sky tamamen isteğe bağlıdır. Eksik gün suçluluk veya seri kaybı yaratmaz; kilo/kalori takıntısı ve öğün ahlakileştirmesi teşvik edilmez.
- Sadece arayüz zenginliği veya test sayısı yeterli kabul edilmez; fayda örneği yoksa kapsam daraltılır.

## Faz 5 — Kontrollü gerçek kullanıcı PWA betası

Önerilen iş paketi ailesi: NUT-020. Pilot katılımcısı toplama, mesaj gönderme ve gerçek veriye erişim ayrı kullanıcı talimatı gerektirir.

Giriş:

- Faz 4 kabulü, fiziksel cihaz kapısı ve tüm-modül yedek/geri yükleme doğrulaması tamamlanmış.
- İlk açılış, yerel veri riski, AI kapsam/onayı, isteğe bağlı Sky, kurulum ve destek yolu anlaşılır.
- Yaş/ülke/hedef kitle ve sağlık dışı kullanım iddiası belirlenmiş; pilot için açık katılım ve veri toplama sınırı yazılmış.
- Sabit HTTPS origin ve kullanıcı onaylı sürüm yükseltme planı hazır; dağıtım/pilot başlatma açık onay bekler.

Teslim:

- Önerilen 10–20 gönüllü, iki haftalık sınırlı pilot; önce küçük bir dilimle başlatılır.
- Yardımsız ilk kayıt, isteğe bağlı Health girişi, bir anlamlı AI çıktısı veya anlaşılır “yeterli veri yok” sonucu.
- Pilot geri bildirimi kullanıcı isterse ve ham not/sağlık/doğum bilgisi olmadan alınır; gizli takip eklenmez.
- Güncelleme/yeniden açılış/çevrimdışı kullanım ve yedeği yeni izole kurulumda geri yükleme örneği doğrulanır.

Çıkış:

- Her sorunda etkilenen sürüm, tekrar adımları, veri etkisi ve çözüm kaydı var.
- Veri kaybı/onaysız aktarım/başlangıcı engelleyen sorun yok; varsa pilot durdurulur, düzeltilir, yeniden doğrulanır.
- Kullanıcıların değer bulduğu ve kullanmadığı akışlar sayı/payda ve nitel örneklerle raporlanır.
- Sonraki faza geçmek için yalnız indirme/kurulum sayısı yeterli değildir.

## Faz 6 — Pazar doğrulaması ve odak kararı

Önerilen iş paketi ailesi: NUT-021.

Giriş: gözlenmiş pilot kullanımı; payda, katılım koşulları ve veri boşlukları açık rapor. [Yol haritasındaki](02_ROADMAP.md) ilk pilot eşikleri başlangıç hipotezidir ve pilot başlamadan belirlenir.

Çalışma:

- Hangi problem ve kullanıcı grubu tekrar kullanım yaratıyor? Alternatif olarak ne kullanılıyor?
- İlk değer süresi, yedi günlük kullanım, geri dönüş, somut yarar örneği ve vazgeçme nedenleri birlikte değerlendirilir.
- Ödeme isteği görüşmeleri ürün faydasından ayrı incelenir; söylenen ödeme isteği gelir olarak yazılmaz.
- Genişletilecek tek akış seçilir; gereksiz yüzey azaltılır. Yeni özellik önerisi kullanıcı problemi ve beklenen ölçümle yazılır.

Çıkış: **devam / belirli kullanıcı grubuna daralt / ürün hipotezini değiştir** kararı, gerekçesi ve yeni test planı belgelenir. Küçük pilot tek başına ürün-pazar uyumu veya klinik fayda kanıtı değildir. Yeterli tekrar değer yoksa native geliştirme ve ücretlendirme yatırımı ertelenir.

## Faz 7 — Native, kapalı test ve mağazalar

Önerilen iş paketi ailesi: NUT-022.

Giriş: Faz 6'da devam kararı; mevcut web/PWA ürününde doğrulanmış günlük değer; desteklenecek cihaz/OS matrisi; App Store/Google Play hedef bölgeleri ve dağıtım hesabı sahipliği belirlenmiş.

Küçük teslim sırası:

1. Capacitor uyumluluk/bağımlılık envanteri; aynı uygulama akışlarını kullanan ince native kabuk.
2. iOS/Android build ve imzalama hazırlığı; gizli anahtarlar kaynak depoya girmez. Hesap, sertifika veya mağaza bağlantısı için açık onay alınır.
3. PWA → native veri taşıma ve sürüm yükseltme planı; aynı origin/depo varsayımı yapılmaz. Veri etkili şema/taşıma tasarımı uygulamadan önce onaya sunulur.
4. Yalnız ürün için gereken izin/adaptörler; ret/iptal/geri alma davranışı test edilir. HealthKit/Health Connect ve arka plan bildirimleri ayrıca ihtiyaç doğrulaması ister.
5. Fiziksel iOS/Android regresyonu ve TestFlight/Play kapalı test; yedek/geri yükleme, uygulama güncellemesi, ekran okuyucu, klavye, güvenli alan ve offline senaryoları.
6. Gerçek veri akışına uygun gizlilik politikası, destek ve mağaza formları. Hesap varsa hesap/veri silme; ücretli dijital özellik varsa güncel mağaza ödeme ve abonelik gereklilikleri karşılanır.
7. Mağaza görselleri/açıklaması sağlık teşhisi veya AI doğruluğu iddiası içermez; uygulamanın somut faydasını anlatır. Gönderim için ayrı açık kullanıcı onayı alınır.

Çıkış: desteklenen cihazlarda kabul akışları ve güncellemeler kayıpsız; kritik kusur yok; mağaza beyanları/SDK davranışı uyumlu; gerekli politikalar/süreçler hazır ve kapalı test bulguları giderilmiş. Mağaza incelemesine gönderim, kabul veya yayın bu planla yapılmış sayılmaz.

## Tüm fazlarda geçerli sınırlar

- Codex ana geliştirme ortamıdır; var olan geliştirme dalı, küçük izlenebilir commit/PR ve GitHub belgeleri kullanılır. Main'e doğrudan yazılmaz, otomatik merge yapılmaz.
- Her anlamlı değişiklikten sonra ilgili testler; hata varsa kök neden → düzeltme → tekrar test. Test başarısız veya zorunlu kabul eksikse tamamlandı etiketi verilmez.
- Depolama şeması/kullanıcı verisi etkisi, kritik gizlilik/güvenlik veya geri dönüşü zor işlem önce somut değişiklik ve gerekçeyle onaya sunulur.
- Varsayılan veri cihazda kalır. Yeni sağlayıcı, dış aktarım, kalıcı AI hafızası ve otomatik dış işlem ayrı kapsam/onay gerektirir.
- Sky yalnız sembolik/isteğe bağlı bağlamdır; Core/Health kanıtı, güven girdisi veya tıbbi/psikolojik neden olamaz.
- Her alt aşamada Türkçe sonuç: değişiklik, PASS/FAIL, veri etkisi, kalan risk ve sıradaki öncelik. Dokümantasyondaki plan bir test sonucu yerine geçmez.

## Tarihsel faz kapanışları

Aşağıdaki kapanış kayıtları 31 Temmuz 2026 tabanını anlatır; güncel sürüm, güncel test veya tüm-modül ürün hazırlığı iddiası değildir.

# Phase 1 — Foundation

Status

🟢 Completed

Work Items

TB-001–TB-010

Purpose

Build a reliable technical foundation for Today.

Objectives

- Code inventory
- Architecture documentation
- Storage reliability
- Data model
- Backup
- Restore
- Migration
- Version management
- Testing
- Changelog system

Completion Criteria

- No duplicate code
- Single version source
- Reliable storage
- Successful backup & restore
- Successful migration
- Successful tests

Closure

> Faz 1 geliştirmeleri tamamlandı. Test edildi. Sonuç: Başarılı.

---

# Phase 2 — Platform Architecture

Status

🟢 Completed

Work Items

TB-011–TB-019

Purpose

Prepare Today for long-term scalability.

Objectives

- Modular architecture
- Shared state
- Routing
- Data contracts
- AI Adapter
- Connect Adapter
- Accessibility
- Performance
- Automated testing

Delivered Work

| Work item | Delivery | Status |
|---|---|---|
| TB-011 | Architecture inventory and dependency/repetition map | Completed |
| TB-012 | Central Startup Manager | Completed |
| TB-013 | Central Router | Completed |
| TB-014 | Module Registry | Completed |
| TB-015 | Central Error Manager | Completed |
| TB-016 | Schema and migration orchestration | Completed |
| TB-017 | Service Worker update management | Completed |
| TB-018 | AI/Connect adapter interfaces | Completed |
| TB-019 | Platform regression tests and GitHub Actions gate | Completed |

Verification

- Portable regression command: `npm test`
- GitHub Actions: **294/294 successful, 0 failures**
- GitHub Pages deployment: successful
- TB-019 production-code changes: none

Closure

> **Faz 2 geliştirmeleri tamamlandı. GitHub Actions üzerinde test edildi. Sonuç: Başarılı.**

---
