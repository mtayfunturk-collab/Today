# TODAY MASTER PROJECT
## Ürün Yol Haritası

Sürüm: 2.0
Durum: Aktif plan; gelecek fazlar tamamlanmış değildir
Güncelleme: 30 Ekim 2026
Güncel uygulama sürümünün kaynağı: `modules/version.js`
Aktif iş: NUT-018, `nut-018-ci-stabilization`, taslak PR #1

## Hedef

Today, **Core, Health ve Sky kayıtlarını kullanıcının izin verdiği kapsamda AI Engine ile anlamlandıran** gizlilik odaklı bir günlük yaşam platformu olarak geliştirilir. Mimari, ürünün ana vaadi ve ilk kullanım senaryosu ayrı kararlardır. Önceki beslenme/hareket seçimi kullanıcı tarafından yanlışlıkla yapıldığı belirtilerek geri çekildi. Ana vaat için bütünsel farkındalık, günlük karar desteği ve kişisel günlük seçenekleri yeniden sunuldu; kullanıcı daha sonra günlük, 7 günlük ve uzun dönemli gözlemler, telefon bildirimi ve Health içinde akıllı saat bağlantısını istedi. Bu istek NUT-019.1 gözlem dilimi ve NUT-019.2 platform/izin tasarımı olarak izlenir. Bu seçenekler modül mimarisini değiştirmez. Nihai dağıtım hedefi App Store ve Google Play'dir. Önce kurucunun düzenli kullanmak isteyeceği değer kanıtlanır; ardından gerçek kişilerle kontrollü PWA pilotu ve pazar doğrulaması yapılır.

29 Ekim kararı, önceki plandaki “hemen Capacitor'a geç” sırasını değiştirir. Native paketleme, kullanıcı değerini kanıtlamanın ön koşulu değildir. Mevcut Core, Health, Sky modülleri ve AI Engine/Connect sınırları korunur; yeni bir uygulama veya paralel veri modeli kurulmaz. Faz 1–2 tarihsel kayıtları aşağıda korunmuştur.

30 Ekim kapsam kararı: Apple Watch, Android ve Xiaomi/Mi Fitness ile Zepp Life dahil mümkün olan en geniş saat/bileklik desteği hedeflenir. Native sağlık adaptörü bu istenen yetenek için gereklidir; mağazaya gönderim veya tüm modellerde uyumluluk onayı anlamına gelmez. HealthKit ve Health Connect üzerinden gerçekten aktarılabilen türler alınır. Tüm sürümler için destek iddiası yerine model/telefon/üretici uygulaması bazında kabul kaydı tutulur. Güncelleme başlığı `Today Yenilik`; günlük AI gövdesi `Today, yeni bir gözlemin var. Uygulamayı açıp inceleyebilirsin.` olur. [Uyumluluk, üretici bulutu ve bildirim sınırları](NUT-019.2-COMPATIBILITY.md).

[NUT-019.2.1](NUT-019.2-IMPLEMENTATION.md) native SDK okuyucusu ve Health kişisel veri önizlemesini ekler. Bu dar bağlantı kabuğu, aynı web uygulamasını kullanır; fiziksel saat kabulü, otomatik AI aktarımı, bildirim teslimi veya mağaza yayını değildir. Pilot veri güveni ve kişisel kullanım kapıları korunur.

[NUT-019.2.2](NUT-019.2.2-IMPLEMENTATION.md), son geçici saat önizlemesini ayrı AI onayıyla ve manuel kayıt anlamından ayrı kullanır; Android APK/cihaz kabul paketini ekler. [NUT-019.3 bildirimi](NUT-019.3-NOTIFICATION-DESIGN.md) için yeni sınırlı gözlem deposu somut öneridir; mevcut depolama sınırına uygun açık kapsam onayı olmadan uygulanmaz. Günlük mesaj ancak gerçek/açılabilir gözlem olduğunda hedeflenir; kapalı uygulamada her gün yeni AI sözü verilmez.

## Bugünkü ürün ile hedef arasındaki fark

| Alan | Mevcut taban | Sıradaki değer hipotezi |
|---|---|---|
| Core | Günlük seçim, renk, isteğe bağlı not, takvim ve istatistik | 30–60 saniyede tamamlanan ve kaydedildiği açıkça görülen günlük kontrol |
| Health | Yerel beslenme kayıtları/kütüphanesi/planlama; hareket/antrenman yüzeyleri; uyku, enerji, toparlanma gibi kaynaklar | Diğer modüllerle aynı zaman çizgisinde anlaşılabilen, düşük çabalı beden/alışkanlık kayıtları; ürünün tek odağı olduğu varsayılmaz |
| Sky | Doğum profili, harita ve dönem/yansıtma yüzeyleri | İsteyen kullanıcının açtığı ayrı bir sembolik düşünme alanı; sağlık veya duygu çıkarımına dayanak olmaz |
| AI Engine | Cihaz içi iki günlük kural ve yedi günlük Core–uyku gözlemi; ayrıca açık istek onayıyla 1/7/30/90 günlük beş metrik özeti ve sınırlı ön örüntüler; geçici geri bildirim | “Bugün bende ne dikkat çekiyor, dayanağı ne, istersem ne yapabilirim?” sorusuna yararlı ve kısa yanıt |
| Connect | Adaptör sınırı; AI önerisi gerçek dış işlem yapmaz | Yalnız doğrulanmış ihtiyaç varsa kullanıcı onaylı dar bir işlem; ilk pilot için zorunlu değil |

AI Engine şu an bir dil modeli, kişiyi öğrenen kalıcı hafıza veya genel sohbet asistanı değildir. Sentetik testlerin geçmesi kullanıcı faydası ya da klinik doğruluk kanıtı değildir. Geçici AI kararları/geri bildirimleri yenilemede sıfırlanır; kalıcıymış gibi anlatılmaz.

## Geliştirme fazları

Ayrıntılı kabul kapıları [03_PHASES.md](03_PHASES.md) içindedir. Her alt işin kodu, testleri, Türkçe sonucu ve changelog kaydı aynı dal/PR içinde izlenir; aşama sonunda sıradaki iş belirlenir.

| Faz | Amaç ve iş sırası | Çıkış kanıtı |
|---|---|---|
| 3 — Teknik ve PWA hazırlığı | NUT-018.1 eksik testler; NUT-018.2 bağımlılık/sürüm tutarlılığı; NUT-018.3 gerçek tarayıcı ve iPhone PWA doğrulama hazırlığı | Genişletilmiş CI yeşil, bağımlılık durumu açıklanmış, cihaz matrisi ve tekrar edilebilir testler hazır; fiziksel cihaz sonucu ayrıca kayıtlı |
| 4 — Kurucunun kullanmak istediği ürün | Önerilen NUT-019: kullanıcıyla seçilecek ilk değer döngüsü, veri taşınabilirliği ve açıklanabilir AI desteği; küçük kabul edilebilir dilimler | 14 günlük kişisel kullanım günlüğü; en az üç somut yarar örneği, çözülmüş ana sürtünmeler, veri kaybı olmadan tekrar açılış |
| 5 — Kontrollü gerçek kullanıcı PWA betası | Önerilen NUT-020: anlaşılır ilk açılış, bağımsız modül tercihleri, güvenli yedek/geri yükleme, kurulum/kullanım rehberi ve isteğe bağlı geri bildirim | 10–20 gönüllüyle önerilen iki haftalık pilot; gözlenen kullanım sorunları ve kayıpsız yükseltme kanıtı |
| 6 — Pazar doğrulaması ve ürün odağı | Önerilen NUT-021: hangi kullanıcıya hangi tekrar eden fayda, alternatifler, geri dönüş, ödeme isteği görüşmeleri | Önceden belirlenen ölçütlere göre devam/daralt/değiştir kararı; veriler ve örneklem sınırlamaları belgeli |
| 7 — Native ve mağaza hazırlığı | Önerilen NUT-022: doğrulanmış akışa Capacitor kabuğu, izin/adaptörler, iOS/Android cihaz testleri, TestFlight/Play kapalı test, mağaza beyanları | Desteklenen cihazlarda geçiş/geri yükleme/güncelleme başarılı; gizlilik ve mağaza koşulları karşılanmış; gönderim için ayrı açık onay |

Faz numaraları ilerleme sırasını belirtir; tüm modülleri tek tek yeniden yazma sırası değildir. Core/Health/Sky/AI işleri ihtiyaç doğrulandıkça aynı ürün döngüsünü iyileştirir. TÜBİTAK BiGG, DE02, finansman ve araştırma paralel iş alanları olarak kalır; teknik veya pazar kabul kapılarının yerine geçmez.

## Ürünü zenginleştirecek öncelikli dilimler

1. **Güvenilir günlük değer döngüsü:** izin verilen modüllerde kolay kayıt → zaman içindeki gözlem → dayanağı ve belirsizliği görünen içgörü → kullanıcı isterse bir sonraki adım. Hangi değerin ana vaat olacağı yeni seçimle belirlenecek; beslenme, hareket veya başka bir kullanım tek başına dayatılmaz. Yeni kalıcı veri gerekirse tasarım/şema etkisi önce onaya sunulur. Sky'ı kullanmak veya Health'in tüm alanlarını doldurmak zorunlu olmaz. İlk iş mevcut ekranların kullanımını gözlemlemek ve bir sürtünmeyi düzeltmektir.
2. **Anlaşılır AI desteği:** farklı zamanlardaki izinli kayıtları karşılaştırıp tekrarlayan ilişkileri görünür kılmak yarar hipotezidir; bugünkü iki kuralın geniş kişisel örüntü keşfini zaten yaptığı iddia edilmez. Core günlük seçimi, uyku ve enerji yalnız kullanıcının izin verdiği açıklanabilir bağlamı destekler. Kullanıcı seçtiği veri kapsamını görür; bir gözlem, dayanak, eksik bilgi ve en fazla birkaç seçenek alır. Yetersiz veride neyin eksik olduğunu açıklar, öneri uydurmaz. Günlük analiz ve haftalık gözlemin mevcut davranışı korunarak erişimi sadeleştirilebilir.
3. **Haftalık değerlendirme:** kullanıcının seçtiği yaşam alanlarında fark ettiği tekrarlar ve kolay/zor bulduğu adımlar, kayıt kapsamı ve gözlenen birliktelikler gösterilir; eksik gün suçluluk, seri kaybı veya başarısızlık puanına dönüştürülmez. Kilo odaklılık, öğün “iyi/kötü” yargısı veya aşırı egzersiz teşviki yapılmaz; nedensellik/kişilik hükmü kurulmaz. Kullanıcı “bana uyuyor/uymuyor/emin değilim” diyebilir. Kalıcı geri bildirim veya tercih yeni bir kapsamdır; onaylı tasarım ve veri etkisi incelemesi olmadan saklanmaz.
4. **Kayıt ve veri güveni:** tüm modüller için nelerin cihazda tutulduğunu, dışa aktarımın neleri içerdiğini ve neleri içermediğini anlaşılır kıl. Tam yedek/geri yükleme eksikse gerçek kullanıcı pilotundan önce ayrı iş olarak tamamla; Core CSV'yi tam yedek diye sunma.
5. **İsteğe bağlı bildirim:** kullanıcının istediği güncelleme ve günlük AI türleri ayrı tercihler olur. Güncelleme yalnız yeni sürüm gerçekten hazırsa; AI bildirimi yalnız açılabilir yeni gözlem varsa, seçilen yerel zamanda en fazla günde bir kez hedeflenir. Bildirim varsayılan kapalı ve kapatılabilir olmalıdır. Mevcut istek-süreli AI onayı arka plan çalışmasına izin vermez; zamanlanmış analiz/veri kapsamı ayrıca açıkça onaylanır. Şablonların test edilmesi gerçek cihaz teslimi değildir; native izin/iptal/zamanlama ayrı kabul kapısıdır.

Bu liste uygulandı iddiası değil, test edilecek ürün hipotezidir. Her dilim en az bir gözlenen sorunu çözer; kişisel kullanım sonucu yarar üretmeyen zenginlik çıkarılabilir.

## İlk betaya eklenmeyecekler

- Zorunlu hesap, zorunlu tüm-modül kullanımı, puan/seri baskısı ve kullanıcıyı yargılayan sağlık skoru.
- Genel amaçlı sohbet, yalnız etiket için dil modeli ekleme, gizli bulut aktarımı veya varsayılan serbest metin toplama.
- Teşhis, tedavi, kesin astrolojik hüküm; Sky'dan sağlık/duygu nedeni çıkarma.
- Otomatik takvim/e-posta işlemleri, geniş Connect izinleri veya denetlenmeyen kişisel AI hafızası.
- Kanıtlanmış ihtiyaç olmadan sosyal akış, reklam profili, abonelik duvarı veya kapsamlı native yeniden yazım. İstenen HealthKit/Health Connect adaptörleri mevcut modülleri yeniden yazmadan, dar ve salt okunur kapsamda geliştirilir.

## Pazar doğrulaması: önerilen ölçüm planı

Ana ürün vaadi ve hedef kullanıcı hipotezi yeni seçimle netleştirilecek. Önceki beslenme/hareket hipotezi geri çekildi; çok dönemli AI gözlemleri ve izinli cihaz/bildirim bağlantıları kullanıcı tarafından istendi; mevcut modül mimarisi korunur. Önerilen genel değer, kişinin kendi kayıtlarından anlaşılır ve açıklanabilir gözlemler edinebilmesidir; bu henüz onaylanmış ürün odağı veya araştırmayla doğrulanmış kullanıcı bulgusu değildir.

Aşağıdaki eşikler pilot başlamadan gözden geçirilecek karar yardımcılarıdır; elde edilmiş sonuç veya sektör standardı değildir. Küçük örneklemde sayı ve payda birlikte raporlanır; örneğin 4/10 ve 8/20 aynı ürün-pazar uyumu kanıtı sayılmaz.

| Soru | Önerilen ölçü | İlk karar eşiği hipotezi |
|---|---|---|
| İlk değer anlaşılır mı? | Yardımsız ilk kaydı ve kendi özetini görebilen katılımcı / başlayan | En az %80; tamamlayamayan her kişiyle sürtünme incelemesi |
| Düzenli kullanılır mı? | İlk yedi günün en az dördünde kayıt yapan kişi / başlayan | En az %50 |
| Geri dönme nedeni var mı? | 7. gün veya sonraki gün uygulamaya dönen kişi / başlayan | En az %40; hatırlatma etkisi ayrıca not edilir |
| Fayda gerçek mi? | Son hafta somut bir karar/farkındalık örneği anlatabilen kişi / görüşülen | En az yarısı; “güzel görünüyor” tek başına yeterli değil |
| Kullanım güvenli mi? | Veri kaybı, onaysız aktarım, ciddi izin/başlangıç hatası | Sıfır tolerans; pilot ilgili sorunda durdurulur |
| Ödeme gerekçesi ne? | Alternatifi, vazgeçme nedeni ve ödeme isteği görüşmesi | Sayı hedefi dayatılmaz; tekrarlanan ihtiyaç ve neden belgelenir |

Ölçüm için gizli telemetri eklenmez. İlk pilot, katılımcının gönüllü paylaştığı kullanım özeti ve görüşmeleriyle yürütülebilir; not/sağlık/doğum ham verisi istenmez. Otomatik analitik gerekirse amaç, alan, alıcı, saklama ve çıkış yolu önceden açıklanır, açık onay alınır. Kullanıcılarla iletişime geçmek bu yol haritasıyla yetkilendirilmiş sayılmaz.

## Gizlilik, veri kaybı ve yayımlama sınırları

- Tarayıcı verisini temizleme, özel gezinme, cihaz kaybı ve işletim sistemi depolama tahliyesi yerel veriyi kaybettirebilir. PWA kurulumu veya Service Worker cache'i veri yedeği değildir; farklı origin/cihaza otomatik taşınma varsayılmaz.
- Pilot öncesi sürümlü tüm-modül dışa aktarım/geri yükleme kapsamı fiilen test edilir. Geri yükleme mevcut verinin üzerine onaysız yazmaz; hassas yedek dosyasının korunması kullanıcıya anlatılır. Şema değişikliği ayrıca onay gerektirir.
- Yeni model sağlayıcısı, kalıcı AI hafızası, bulut/senkronizasyon veya hassas veri aktarımı önerisi önce somut tasarım ve riskleriyle onaya sunulur; varsayılan cihaz içi çalışma sürer.
- Hesap yoksa hesap silme akışı varmış gibi beyan edilmez. Hesap eklenirse gerçek hesap/veri silme ve saklama süreçleri yayımdan önce tamamlanır; yerel veri temizliği açık kullanıcı onayı ve yedek seçeneğiyle tasarlanır.
- Ücretli dijital özellikler ancak değer doğrulandıktan sonra değerlendirilir; o gün geçerli mağaza ödeme/abonelik koşulları uygulanır. Gizlilik politikası, App Privacy/Data Safety beyanı gerçek ağ/SDK davranışıyla uyumlu olmalıdır.
- Main'e doğrudan yazılmaz, otomatik merge/yayın yapılmaz. Mağaza gönderimi, imzalama/hesap bağlantısı ve geri dönüşü zor değişiklikler ayrı açık onay gerektirir.

## Sıradaki öncelik

Önce NUT-018.1–018.3 kanıtları kapanır. Sonra önerilen ilk ürün işi, mevcut veriyle normal/yeniden/çevrimdışı açılışın ve tüm-modül yedek/geri yükleme kapsamının doğrulandığı, kurucunun günlük kullanım sürtünmelerini kaydettiği **NUT-019 modüller arası ürün kabul envanteri** olur. Temel kabul sorusu, yeniden seçilecek ürün vaadine göre kullanıcıyla belirlenecek. Beslenme/hareket tek odak olarak dayatılmaz. Güncel teknik dilimler ve gerçek bağlantı sınırları NUT-019.1 uygulama raporunda izlenir. Bu envanterden yalnız bir küçük kullanıcı akışı seçilip uygulanır; kullanıcı gözlemi olmadan geniş özellik paketi başlatılmaz.

## Tarihsel kayıt — 31 Temmuz 2026

Aşağıdaki sayılar o dönemin kapanış kaydıdır; mevcut dalın güncel test sonucu veya mağaza hazırlığı anlamına gelmez.

# Phase 2 Closure — 31 July 2026

Work items

TB-011–TB-019

Delivered:

- architecture inventory and dependency/repetition map,
- centralized startup order,
- central Router and Module Registry,
- central error management,
- schema and migration orchestration,
- user-approved Service Worker update flow,
- AI and Connect adapter interfaces,
- portable local regression gate and GitHub Actions automation.

Technical baseline:

- Application version: `2.0.0`
- Data schema: `2`
- Active shell: `today-v2-foundation-012`
- Regression: **294/294 successful, 0 failures**
- GitHub Pages deployment: successful

> **Faz 2 geliştirmeleri tamamlandı. GitHub Actions üzerinde test edildi. Sonuç: Başarılı.**

---
