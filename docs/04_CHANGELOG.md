# TODAY MASTER PROJECT
## CHANGELOG

Document: Changelog
Version: 1.0
Status: Active
Owner: Today Master Project
Last Updated: 30 October 2026

---

# Changelog Rules

Every meaningful change in the project must be recorded here.

Each entry should include:

- Date
- Version
- Phase
- Module
- Summary
- Files Changed
- Tests
- Result
- Commit Message

---

# Version History

---

## NUT-RADIO.3d — Tek Radio kartı ve ortalanmış başlangıç

App2.23.3/schema2/foundation-082/125. Mini kontroller modüller altında ayrı panel olmaktan çıkarılıp mevcut Radio kartının tek görsel kabuğuna alındı. Kart açma ve oynatma düğmeleri kardeştir; iç içe button yoktur. Seçim yapılmadan mini alan gizli; seçili istasyonda ad/durum/durdur-devam aynı kartta görünür. Mobile home route, flex-start kuralından ayrılarak dikey merkeze döner; diğer rotalar üst hizayı korur. Ses/izin/veri yapısı değişmedi. UI22 ve gerçek tarayıcıda viewport merkez/tek kart kontrolleri; son kapılar PR #2'de izlenir. Yeni radyo kapsamı açılmaz; son fiziksel kabul beklenir.

---

## NUT-RADIO.3c — Modüller ekranı ve aynı medya öğesinde sürdürme

App2.23.2/schema2/foundation-081/125. Telefon tekrarında mini replay başarısız bildirildi; fiziksel olay/log bulunmadığı için tek bir OS nedeni kesinleştirilmedi. Önceki stop kaynağı unload edip yeni Audio oluşturuyordu. Mini kontrol artık pause/resume ile aynı audio/src/currentTime'ı kullanır; tam stop/izin iptali hâlâ kaynağı boşaltır. Eski play promise reddi ve gecikmiş pause olayı resume'u bozamaz; yeni playing olayı olmadan başarı gösterilmez. Canlı yayın tamponu/zaman aşımı tarayıcıya bağlıdır, kesin DVR/aynı saniye garantisi yoktur. Mini-player Başla ekranından kaldırıldı, modüller ekranına taşındı. Player25 testi ve gerçek HTMLAudio same-element/currentTime E2E genişletildi. CI ve canlı sürüm kanıtı PR #2'de; fiziksel tekrar sonucu gelmeden radyo aşaması kapanmaz.

---

## NUT-RADIO.3b — Mini oynatıcıdan tekrar dinleme

App2.23.1/schema2/foundation-080/125. Telefon testinde bildirilen eksik mini replay akışı düzeltildi: Durdur düğmesi aynı oturumda Tekrar dinle olur; aynı seçilmiş istasyonu, Radio UI'ın mevcut yayıncı iznini denetleyerek kullanıcı dokunuşuyla başlatır. Stop izni geri çekmez. Checkbox'ı kaldırmak akışı durdurur ve mini replay'i kapatır; reload oturum seçimini/iznini temizler. Yeni kalıcı veri veya ikinci audio yoktur. Canlı radyoda yeniden başlatma güncel yayın noktasına bağlanır. UI21 testi; yeni birleşik mini-stop/replay/revoke senaryosu ve gerçek HTMLAudio E2E genişletildi. Son test ve CI kanıtı PR #2'de; fiziksel tekrar testi bekliyor.

---

## NUT-RADIO.3a — Ana ekran mini oynatıcısı

31 Ekim 2026; App2.23.0/schema2/foundation-079/125. radio-ui.mjs ana ekrana tek idempotent mini oynatıcı ekler: sembol, istasyon adı, gerçek oynatma/bağlanma/bekleme/hata durumu, Durdur ve Radio'yu aç. Radio ekranıyla aynı singleton kullanılır; ikinci audio veya yeni istek oluşturmaz. Durdurdan sonra yeniden başlatma Radio'daki görünür yayıncı izninden geçer. İlk açılış sessizdir; kalıcı veri, favori/geçmiş/AI eklenmedi. Küçük ekranda düğmeler alt satıra iner, uzun adlar kırılır; 44px dokunma hedefleri ve erişilebilir durum metni vardır. UI20/20 (yeni5 mini kontrol), static30/30 geçti. Birleşik kapılar ve uzak CI sonucu PR #2'de kaydedilir. Sürüm testi eski2.22 beklentisiyle10/11 verdi; yeni2.23 sürümüne güncellendikten sonra11/11 geçti. Sıradaki dilim Media Session ve uyku zamanlayıcısıdır; fiziksel iPhone/Windows, ticari yayın ve arka plan kabulü açık kalır.

---

## NUT-RADIO.2d — Tek oynatma yöneticisi

App2.22.0, Core şema2, foundation-078 /125 kabuk kaydı.

- radio-player.mjs tek ortak sahip/aktif oturum sağlar. Audio nesnesi yalnız açık Dinle eyleminde oluşturulur; kaynak değişiminden önce eski akış boşaltılır. Nesne oturum başına yenilenerek eski olay/reject/timeout yeni oturumu etkilemez; rota değişimi nesne yaratmaz. Çalıyor yalnız playing olayında, waiting/stalled buffer ve bağlantı hatasında açık hata/durdurma; otomatik retry yok.
- Radio Browser izninden ayrı yayıncı bağlantısı checkbox'ı; Dinle/Durdur/Tekrar dinle ve durum bölümü eklendi. Yayın izni geri alınca akış durur. Rota değişiminde aktif ses sürer; sayfa yenilenince otomatik başlamaz. Dinleme geçmişi/AI veya yeni kalıcı depo yok.
- İlk kapsam MP3/AAC/AAC+ ve cihazın native HLS desteği. Anonim CORS zorunlu, global no-referrer meta; CORS vermeyen veya desteklenmeyen yayın hata verir. Proxy/hls.js/ambient cross-origin credentials eklenmedi. Ses düzeyi şimdilik sistem tuşlarıyla; arka plan/lockscreen garantisi yok.
- Player21/UI15 dahil entegrasyon324, platform1161, Engine403, benchmark16/0ihlal, native15, Chromium15 PASS/0FAIL. Yeni browser senaryosu kendimiz ürettiğimiz sessiz MP3'ü route fixture üzerinden gerçek medya öğesinde oynatır; izin/no stream→playing→modül değişimi/yeni kaynak yok→stop→reload/no autoplay ve Core korunması doğrulanır. Ticari yayın veya fiziksel cihaz testi değildir.
- Ağ fixture'larında serviceWorkers:block nedeniyle oluşan beklenen kayıt hatası bildirimi, uzayan formun düğmelerini örtüyordu. Yalnız Radio test grubunda no-SW destek yolu açıkça seçildi; diğer13 offline/SW testi aynen korunur, gerçek ürün hatası gizlenmez.
- Sonraki küçük dilim ana ekran mini-player; Media Session, ses düzeyi yetenek kontrolü, uyku zamanlayıcısı ve fiziksel iPhone/Windows kabulü sonra. Yeni CI/commit kanıtı PR #2'de.

---

## NUT-RADIO.2c — CI kapanış kaydı

Actions41126865552 / a9f4f04 completed/success, platform ve iki native derleme ile Chromium/WebKit işi başarılı. Job logu Chromium14+WebKit14=28PASS/0FAIL verdi. Önceki WebKit ağ fixture hatası kapandı. Runtime c4ac76d ve App2.21.1 aynı; yalnız sonuç belgesi güncellendi, test tekrar edilmedi. Yerel platform1161/entegrasyon300/Engine403/benchmark16/native15/Chromium14 PASS; gerçek ses ve cihaz kabulü yok. Sıradaki küçük görev tek audio yöneticisi.

---

## NUT-RADIO.2c — WebKit ağ fixture izolasyonu

CI41126002787 browser27PASS/1FAIL: WebKit'te Service Worker, page.route taklidini atlayıp gerçek filtrelenmemiş dizin yanıtını aldı (3beklenirken2güvenli kayıt). Trace /json/servers ve /json/stations/search?hidebroken=true&limit=30&offset=0&is_https=true gerçek API yanıtlarını kanıtladı. Kullanıcı sağlık/geçmiş/not verisi yok; izole sentetik test profili kullanıldı. Ürün hatası diye doğrulama gevşetilmedi.

Yalnız Radio katalog E2E'sinde serviceWorkers:block + context.route ile deterministik yanıt ve diğer dış origin'lere abort uygulandı. Diğer13SW/offline/gezinme testinin ayarları korunur. Hedefli Chromium ve yeni WebKit CI sonucu PR #2'de; ürün sürümü/depolar değişmedi.

---

## NUT-RADIO.2c — İzinli gerçek istasyon kataloğu

App 2.21.1; Core şema 2; foundation-077 / 124 kayıt.

- Örnek katalog yerine Radio Browser bağlantısı; ilk açılışta istek yok. IP/arama/filtre aktarımı açıkça belirtilen, varsayılan boş oturumluk izin ve yükle eylemi gerekir. İzin kaldırma/rota çıkışı istek ve sonuçları temizler; kalıcı tercih/depo yoktur.
- HTTPS sunucu keşfi yalnız sağlayıcı hostname'lerini kabul eder, IP alanlarını kullanmaz; doğrulanmış en çok üç ayna, tek timeout bütçesi, bootstrap fallback. Bugünkü resmî keşif iki IP kaydında aynı de1 hostname'ini verdi; birden çok bağımsız canlı sunucu varmış gibi raporlanmadı. Arama is_https=true; DTO son URL'yi ayrıca doğrular.
- 30'luk sayfalama, artan offset, filtrede sıfırlama, ayıklanan kayıt açıklaması ve doğrulanmamış yayın etiketi. Logo, click/oy, stream, audio, favori/geçmiş/AI isteği yok.
- Directory23 ve UI12 hedefli test, birleşik300 PASS; platform1161, Engine403, benchmark16/0ihlal ve native15 geçti. Chromium14/14 PASS; uzak CI kanıtı PR #2'de tutulur. İki resmî API HTTP200/CORS kontrolü yapıldı; radyo sesi dinlenmedi. İlk E2E'nin bulduğu erken rota değişiminde yanlış bağlantı kapalı mesajı düzeltildi ve regresyon testi eklendi.
- Önceki CI41124365909 success olarak doğrulandı. Gerçek iPhone/Windows cihaz kabulü veya site yayını yapılmadı.

---

## NUT-RADIO.2b — Radio tasarım önizlemesi

App 2.21.0; Core şema 2; foundation-076 / 124 kabuk kaydı.

- Radio, Registry/Router içinde dördüncü modül/dokuzuncu rota/yedinci görünüm oldu; ortak alt navigasyon dört sütuna geçti. Core/Health/Sky ve geri/odak/aria davranışı korundu.
- Açık etiketli örnek katalog: arama, ülke/dil/tür filtreleri, boş/hata/yükleme/iptal durumları; iptal/rota veya filtre değişimi eski sonucu dışlar. Otomatik ağ, yayın/oynatıcı, favori/kalıcı geçmiş veya AI yok. Doğrulanmış Radio Browser DTO adaptörü örnek yanıtlarla kullanılır.
- İlk tarayıcı koşusu Registry'nin Radio alt gezinme bağını beklediğini gösterdi; dört modüllü navigasyon eklendi. Ekran görüntüsü incelemesi genel wrap ve Health’in sonradan eklediği global !important hizalamanın mobil üst hizalamayı ezdiğini gösterdi; media kuralı sonraya taşınıp route niteliğiyle kapsamı belirginleştirildi, mobil scrollbar rezervi kaldırıldı.
- Yerel UI 8/8, entegrasyon 292/292, platform 1161/1161, Engine 403 kontrol, benchmark 16/16, native 15/15 ve Chromium 14/14 PASS; FAIL 0. Son CSS düzeltmesi hedefli mobil/Radio E2E 2/2 ve statik 30/30 kapısıyla doğrulandı; uzak CI sonucu PR #2'de. Fiziksel iPhone/Windows testi yapılmadı.
- Önceki CI 41122648364 success: WebKit Touch engeli kapandı. Yeni sürümün dağıtıldığı veya canlı istasyonların çalıştığı iddia edilmez.

---

## NUT-RADIO.2a — İzole dizin adaptörü

Yeni radio-directory.mjs: doğrulanmış HTTPS/UUID DTO, TR/dünya arama/ülke/dil/tür filtresi, sınırlı pagination/ayna/timeout, iptal/eski sonuç, 512KiB yanıt tavanı ve kayıt tekilleştirme. Mount/ağ/oynatma/depo/AI yok; adaptör yalnız açık kullanıcı eylemiyle kullanılabilir. Kullanıcı arayüzü sonraki dilimdir.

Radio 19/19, birleşik entegrasyon 284/284; platform 1161, Engine 403 ve benchmark 16 PASS/0 FAIL. Bu aşama sahte API kullanır; gerçek radyo/iPhone testi değildir. Ana geliştirme dalındaki sentetik Touch sürücüsü düzeltmesi bu dala da alındı; yerel Chromium hedefi 1/1. WebKit CI sonucu PR'lerde izlenir.

---

## NUT-RADIO.1 — Mimari ve uygulanabilirlik

feature/today-radio, taban d10f1eb; ürün sürümü/depolar değişmedi. Modül/mini-player/tek audio, API/HTTPS/CORS/HLS, dış bağlantı gizliliği, önerilen ayrı depolar ve aşamalar raporlandı. İki API HTTP kontrolü 2 PASS/0 FAIL; gerçek yayın/cihaz testi yapılmadı. Taban CI 41116016970: 25 tarayıcı PASS/1 FAIL; WebKit testindeki Touch kurucusu uyumsuzluğu entegrasyon önkoşulu. Mevcut dal, saat/bildirim kodu ve ertelenme kararı korundu. Ayrıntı docs/TODAY-RADIO-IMPLEMENTATION.md.

---

## NUT-020.1 — WebKit test sürücüsü düzeltmesi

CI 41116016970 WebKit'te constructible olmayan Touch nedeniyle 25 PASS/1 FAIL verdi. Sentetik gesture testinde Event + salt okunur touches/changedTouches payload kullanıldı; ürün router/CSS ve test beklentileri değiştirilmedi. Gerçek parmak/OS hareketi ayrı cihaz kabulüdür. Yerel hedefli Chromium sonucu ve uzak WebKit CI kanıtı PR #1'de izlenir. Bu dilimde Radio kodu yoktur.

---

## NUT-020.1 — Mobil yerleşim ve modül kaydırma

App 2.20.1, Core şema 2, foundation-075 / 122 kayıt.

- Saat/bildirim fiziksel kabulü maliyet nedeniyle kullanıcı isteğiyle ertelendi.
- Dar ekranda 94vw kart + dış padding taşması giderildi; mobil üst hizalama/svh ve 16px form yazısı ile viewport değişimi/odak zoom etkisi azaltıldı. Görseller ve başlık satırı mevcut alana sığar. iOS işletim sistemi hareketlerinin tümü engellendi iddiası yoktur.
- Core–Health–Sky ana sayfaları arasında 80px yatay hareketle sıralı geçiş; dikey/çoklu/kenar/uzun hareket, seçim, form, odaklı giriş, yatay kaydırılabilir alan ve Health alt ekranları dışlanır. İlk/son sayfada döngü yok; mevcut düğme/geri gezinmesi korunur. Veri deposu değişmedi.
- Router 15/15; platform 1161/1161, entegrasyon 265/265, AI 403/403, benchmark 16/16, Chromium 13/13 PASS; FAIL 0. Uzak WebKit/native CI sonucu PR #1’de izlenir. İlk yeni E2E koşusunda testin yanlış getRoute çağrısı düzeltildi; ürün beklentisi gevşetilmedi. Fiziksel iPhone kabulü bekliyor.
- Sonraki dilim: içerik ve görsel hiyerarşi; AI ayrı aşamada az veride gözlem/örüntü/güven sınırını ayırır.

---

## NUT-019.3 — iPhone 15 / Mi Band 8 kabul kapsamı

Tarih: 30 Ekim 2026. App 2.20.0/kod 06ebb6c aynı.

- Kullanıcı cihazı iPhone 15/iOS 18.7.8, tek bilekliği Mi Band 8/Mi Fitness; Windows erişimi ve Mac/Xcode yokluğu kaydedildi. Bu bilgi fiziksel test sonucu sayılmadı.
- Apple Sağlık'ta Mi Fitness kaynaklı tür kontrolü, PWA sınırı ve bulut macOS→imzalı iOS→TestFlight hazırlığının hesap/yetki koşulları açıklandı. Android APK/simulator telefona kurulum yolu olarak önerilmez. İmzalama/hesap/dağıtım işlemi yapılmadı.
- Yalnız belgeler değişti; uygulama testleri tekrar edilmedi. Diff ve kayıt tutarlılığı kontrol edildi; cihaz PASS/FAIL yok, tüm fiziksel kontroller bekliyor. Commit: docs: tailor device acceptance to iPhone 15 and Mi Band 8.

---

## NUT-019.3 — İndirilen Android paketinin bütünlüğü

Tarih: 30 Ekim 2026; App 2.20.0/kod 06ebb6c aynı.

- Artifact 12999152208 indirildi; ZIP digest, iki dosyalı envanter ve APK SHA256SUMS eşleşmesi doğrulandı. Yedi kritik paket dosyası 06ebb6c ile byte düzeyinde eşleşti; native plugin/bootstrap ve paket dışlamaları kontrol edildi.
- APK SHA256: cb39769772f51d89651bbafe051c7cd327f31c0dcf2c96f33b256d4865817f7e. Kontroller PASS, FAIL 0; uygulama testleri tekrar edilmedi. İmza ve fiziksel cihaz/OS teslimi testi değildir.
- Genel run 41101231255 API'de completed/success olarak doğrulandı; önceki queued/null tutarsızlığı kapandı. Ayrıntı docs/NUT-019.3-IMPLEMENTATION.md içinde. Yalnız belgeler değişti; mevcut veriler ve uygulama kodu korundu. Commit: docs: verify downloaded notification preview package.

---

## NUT-019.3 — Uzak test kanıtı ve cihaz kabul devri

Tarih: 30 Ekim 2026. Uygulama sürümü 2.20.0 ve kod 06ebb6c değişmedi.

- Actions 41101231255 iş logları: platform 1161, Engine 403, entegrasyon 265, benchmark 16, native 15/OS, Chromium 12 + WebKit 12 PASS; FAIL 0. Android/iOS derleme ve Android merged manifest doğrulandı. Genel durum API'si queued/null kaldığından run success sonucu iddia edilmedi.
- Bildirim kodunu içeren APK artifact 12999152208, ZIP digest/son erişim ve gerçek cihaz kabul sonuç formu uygulama kaydına eklendi. Fiziksel cihaz testleri çalıştırılmadı.
- Yalnız belgeler değişti; doğrulanmış testler tekrar edilmedi. Bağlantı/kimlik/test sayısı ve diff kontrolleri yapıldı. Commit: docs: record notification CI evidence and device handoff.

---

## NUT-019.3 — Onaylı yerel bildirim ve sınırlı gözlem arşivi

Tarih: 30 Ekim 2026. App 2.20.0; Core şema 2; foundation-074 / 122 kabuk kaydı.

- Kullanıcı onaylı ayrı today_ai_delivery_v1 deposu, 7 gözlem/7 gün geçerlilik/sonraki erişimde temizlik, varsayılan kapalı tercihler ve ayrı UI/OS izni uygulandı. Ham not/olay/cihaz kimliği arşivlenmez; mevcut Core/Health şemaları korunur.
- Yerel native SDK 8.3.1, rezervasyon/tekilleştirme/sessiz saat/DST/kota/iptal/açma ve Ayarlar/AI arşivi eklendi. OS temizliği hatasında da süre dolan sağlık özeti önce silinir; yalnız cleanup ID'leri kalır. Exact alarm kapalıdır.
- Yalnız hazır gözlem için aynı gün en çok bir AI mesajı; kurulu yüksek bundle sürümü sonraki açılışta Today Yenilik. PWA telefon push'u, kapalı uygulamada AI üretimi, mağaza sürüm sorgusu yoktur.
- Testler: platform 1161, Engine 403, entegrasyon 265, benchmark 16, native 15, Chromium 12 PASS; FAIL 0, audit 0, benchmark ihlal 0. Uzak CI/derleme/WebKit kanıtı SHA ile PR #1'de; fiziksel cihaz teslimi yapılmadı.
- Dosyalar: dört bildirim modülü/testi; AI UI olayı; native bootstrap/izin/lock; E2E, sürüm/SW referansları ve belgeler. Ayrıntı docs/NUT-019.3-IMPLEMENTATION.md.
- Commit: feat: add opt-in local observation notifications (NUT-019.3).

---

## NUT-019.2.2 — Saat verisinden ayrı onaylı AI gözlemi ve cihaz paketi

Tarih: 30 Ekim 2026. App 2.19.0; Core şema 2; foundation-073 / 118 kabuk kaydı.

- Son Health saat önizlemesi yalnız bellekte tutulan, temizleme/yenilemede revizyonu değişen bir kaynak oldu. AI'da üç ayrı, varsayılan kapalı saat sınıfı ve taze onay gerekir; SDK tekrar okunmaz. Yeni kalıcı sağlık/AI kaydı yoktur.
- Context/consent v1 kataloğuna takvim günü uykusu, adım, antrenman oturum süresi eklendi. Manuel kayıtlar ve eski kısa-gece kuralları aynı kalır; yeni veriler farklı metriklerdir. Kaynak/kayıt tavanı kaybı açıklanır; asenkron toplamada geri alınan snapshot dışlanır.
- Android CI'da başarılı derleme/merged manifest kontrolünden sonra yalnız APK+SHA256SUMS artifact'i, 7 günlük saklama ve fiziksel cihaz kabul rehberi eklendi. iOS simulator cihaz kurulumu sayılmaz; debug imza/native origin/veri kaybı sınırları açıklandı.
- Testler: platform 1161/1161, Engine 403/403, entegrasyon 182/182, benchmark 16/16 (0 güvenlik ihlali), native 13/13, Chromium 10/10; FAIL 0. Yeni kapsam: 39 Engine, 9 oturum kaynağı, 5 source adapter, 6 AI UI ve 2 Health UI kontrolü. SHA/CI/artifact kanıtı PR #1'de tutulur.
- Bildirim için ayrı today_ai_delivery_v1 depo tasarımı somutlaştırıldı; uygulanmadı. Kullanıcının depolama değişikliğinde onay sınırı nedeniyle önce bu kapsam onaylanmalıdır. Günlük OS bildirimi veya kapalı uygulamada AI üretimi henüz kurulmadı.
- Değişen alanlar: Engine consent/context/observer, kaynak adaptörü, Health/AI UI ve yeni session modülü, ilgili testler, APK workflow/cihaz rehberi, sürüm/SW ve proje belgeleri. Kayıtlar docs/NUT-019.2.2-IMPLEMENTATION.md ve docs/NUT-019.3-NOTIFICATION-DESIGN.md.

---

## NUT-019.2.1 — Health ekranı ve gerçek native SDK köprüsü

Tarih: 30 Ekim 2026. App 2.18.0; Core şema 2; foundation-072 / 117 kabuk kaydı.

- Health/Sağlık/Kişisel Sağlık Verileri: seçilen uyku/adım/antrenman türleri ve son 1/7/30 gün için her istekte açık onayla geçici önizleme. PWA'da native erişim yoksa okuma kapalı; bağlı iddiası yok.
- Aynı web uygulaması için ayrı kilit dosyalı Capacitor 8.6.0 / Health 8.11.13 native kabuğu, gerçek SDK sağlayıcısı, Android üç dar okuma izni ve merged-manifest kapısı, iOS HealthKit okuma yapılandırması eklendi. Android minSdk 26, Auto Backup kapalı; yeni üretici bulutu/hesabı yok.
- İptal/tür/dönem değişimi sonraki SDK çağrılarını durdurur, geç sonuç atılır. Günlük kaynak/aralık tekilleştirmesi, eksik ile sıfır ayrımı, uyku/antrenman anlamı ve DST sınırları test edildi. Mevcut kullanıcı verisi anahtarları, şema ve migration yapısı korundu; native ayrı origin'dir, PWA verisi otomatik taşınmaz.
- Gerçek Chromium ilk koşusundaki boş panel lifecycle yarışı araştırılıp düzeltildi: interactive aşamasında erken mount, DOMContentLoaded/Health hazır olayıyla tekrar edilir. Eski kodda mounted=false, düzeltmeyle true; beklentiler gevşetilmedi.
- Yerel sonuç: platform 1161/1161, AI Engine 364/364, entegrasyon 160/160, benchmark 16/16, native hazırlık 13/13, Chromium 9/9; FAIL 0, benchmark güvenlik ihlali 0. Native audit 0 açık. Android hazırlığı başarılı; gerçek native derleme/merged manifest ve WebKit CI kanıtı SHA ile PR #1'de tutulur.
- Değişen alanlar: Health hub, yeni UI/SDK sağlayıcısı, okuma sözleşmesi/iptal, native/**, index/SW/sürüm, ilgili test kapıları/E2E, CI ve proje belgeleri. Kayıt docs/NUT-019.2-IMPLEMENTATION.md.
- Sonraki kapı: fiziksel cihaz kabulü, onaylı Health–AI kaynak bağlantısı, günlük analiz/bildirim taşıyıcısı. Bunlar henüz tamamlanmadı; bildirim gönderimi, yeni kalıcı sağlık kaydı, push sunucusu veya mağaza yayını yok.

---

## NUT-019.2 — Çoklu ekosistem hedefi ve bildirim içeriği

Tarih: 30 Ekim 2026. App 2.17.0 / Core şema 2 / foundation-071 değişmedi.

- Kullanıcı Apple Watch, Android ve Xiaomi/Mi Fitness ile Zepp Life dahil geniş saat/bileklik desteğini istedi. HealthKit ve Health Connect yolları belgelendi; tüm model/sürümlere destek sözü verilmedi. Belgelenen Xiaomi akışındaki üretici bulut koşulu açıklandı.
- Henüz uygulamada yüklenmeyen saat sözleşmesine iki değiştirilemez bildirim şablonu eklendi: güncelleme başlığı tam Today Yenilik; AI gövdesi tam Today, yeni bir gözlemin var. Uygulamayı açıp inceleyebilirsin. Eski önizleme export'u korundu.
- Değişen dosyalar: modules/wearable-read-adapter.mjs, tests/wearable-read-adapter.test.mjs, AGENTS.md, yol haritası, fazlar, backlog, NUT-019.1 kaydı ve yeni docs/NUT-019.2-COMPATIBILITY.md. Aday faz numaraları gerçekleşen işlerle hizalandı; veri güveni/pilot kapıları korunuyor.
- İçerik/okuma sözleşmesi testleri 10/10 geçti. Yerel platform 1156/1156, AI Engine 364/364, entegrasyon 114/114, benchmark 16/16 ve 0 güvenlik ihlali; FAIL 0. SHA bazlı CI kanıtı PR #1'de tutulur.
- Sonuç: kapsam/içerik dilimi hazır; native sağlayıcı, Health bağlantı akışı, günlük AI onayı/zamanlayıcısı ve gerçek telefon bildirimi henüz uygulanmadı. Veri/depo şeması veya dış aktarım değişmedi. Sonraki teknik öncelik iki OS sağlayıcısını dar okuma kapsamında hazırlamak ve gerçek cihaz kabulüdür; NUT-019.2 bütünü tamamlandı işaretlenmedi.

---

## NUT-019.1 — Çok dönemli AI gözlemleri

Tarih: 29 Ekim 2026. App 2.17.0; Core şema 2; kabuk foundation-071.

- Açık, istek-süreli onayla Bugün/7/30/90 günlük betimleyici gözlem ve kapsam seçimi eklendi. Tek gün tekrar sayılmaz; az verideki birliktelik yalnız ön gözlemdir. Eksik günler sıfır sayılmaz.
- Eski günlük analiz/yedi günlük örüntü API'leri korundu; beş metrik ve kayıtlı günlerde kategorik tekrarlar eklendi. Kaynak, gün ve belirsizlik izi tutulur; Sky sağlık kanıtına katılmaz.
- Saat için salt okunur sağlayıcı sözleşmesi ve gizli sağlık bilgisi taşımayan bildirim metni önizlemesi hazırlandı. Native sağlayıcı kaydedilmedi, Health'e saat verisi alınmadı ve telefon bildirimi gönderilmedi.
- Testler: platform 1156/1156; AI Engine 364/364; entegrasyon 112/112; benchmark 16/16 ve 0 güvenlik ihlali; yeni dönem seçimi yerel Chromium'da geçti. Tam tarayıcı CI kanıtı PR #1'de tutulur.
- Kayıt: docs/NUT-019.1-IMPLEMENTATION.md. Sonraki adım platform/izin kapsamı seçimi, Health kişisel sağlık verisi akışı ve güvenilir native/Web Push taşıyıcısıdır. Gerçek sağlık verisi ve arka plan bildirim altyapısı için kullanıcı sınırları korunur.

Commit: `feat(ai): add consented daily and multi-window observations (NUT-019.1)`

---

## Ürün odağı düzeltmesi — 29 Ekim 2026

- Kullanıcı önceki beslenme/hareket seçimini yanlışlıkla yaptığını belirterek geri çekti. Bu seçim artık ürünün ana yönü veya geliştirme yetkisi olarak kullanılmaz; aşağıdaki eski aşama notları tarihsel kayıttır.
- Core–Health–Sky verilerini izin verilen kapsamda AI Engine ile anlamlandıran mimari korunur. Ana vaat ve ilk kullanım senaryosu ayrı kararlardır; yeni seçim bekleniyor.
- AGENTS, README, roadmap/fazlar, backlog ve NUT-018.3 sonraki adım metinleri düzeltildi. Çalışan uygulama, testler, veri anahtarları ve şemalar değişmedi.
- Doğrulama: Markdown bağlantıları ve diff kontrolü. Runtime testleri belge değişikliği için yeniden çalıştırılmadı; 052dbd2 CI kanıtı aynı kod için geçerlidir.

Commit: `docs: reopen product direction without changing module architecture`

---

## NUT-018.3 — Gerçek tarayıcı/PWA hazırlığı ve ürün fazları

Tarih: 29 Ekim 2026. Modül: otomasyon / SW yaşam döngüsü / ürün planı. Veri şemaları aynı; App 2.16.0, kabuk foundation-070.

- Kesin sürümlü Playwright 1.64.1, yalnız-loopback sunucu, her test için izole sentetik bağlam ve altı gerçek tarayıcı senaryosu eklendi. CI Chromium ve iPhone görünümündeki Linux WebKit'i ayrı işte çalıştırır; hata tanısı 7 gün tutulur.
- İlk gerçek Chromium koşusu 3 PASS / 3 FAIL verdi: iki updatedAt beklentisi kullanıcı içeriğiyle sınırlandı. Üçüncü hata gerçekti: eski aktif worker redundant olduğunda kullanıcı onayı sıfırlanıyordu. Yalnız önceden activated olmuş worker'ın normal emekliliği ayrıldı; başarısız kurulum ve onaysız yenilememe kontrolleri korunur.
- Yeni SW regresyonu eski kodda 29/30, düzeltmeyle 30/30; yerel Chromium son koşusu 6 PASS / 0 FAIL. Platform 1156 PASS / 0 FAIL; AI Engine 335/0, entegrasyon 96/0, benchmark 16/0, audit 0 açık. Resmi iki motorun CI kanıtı aynı commit için taslak PR #1'de tutulur.
- Fiziksel iPhone Safari/Ana Ekran PWA ve Android cihaz kabul matrisi hazır; testler fiziksel cihazda yapılmış sayılmaz. Üretime/pilota dağıtım yapılmadı.
- Roadmap/fazlar kullanıcının beslenme-hareket sürdürülebilirliği önceliğine göre güncellendi: teknik güven → kurucu kullanımı → kontrollü PWA betası → pazar doğrulaması → native/mağaza hazırlığı. Mevcut deterministik AI ve önerilen işlevler açıkça ayrıldı.

Dosyalar: Playwright config/sunucu/spec, workflow ve test bağımlılıkları; modules/service-worker-manager.js, sw.js, ilgili test/snapshot referansları; README'ler, mimari, roadmap/fazlar, teknik backlog ve NUT-018.3 kabul kaydı.

Sıradaki öncelik: fiziksel cihaz kabul kaydı ve NUT-019.1 beslenme/hareket kullanım + tam veri taşınabilirliği envanteri. Şema, yeni dış sağlayıcı, kullanıcı pilotu ve mağaza gönderimi için ilgili açık onay sınırları korunur.

Commit: `test: add real browser PWA gates and preserve update approval (NUT-018.3)`

---

## NUT-018.2 — Bağımlılık güvenliği ve sürüm tutarlılığı

Tarih: 29 Ekim 2026. Modül: test bağımlılıkları / otomasyon. Üretim verisi veya şema değişmedi.

- Hedefli lockfile güncellemesi: source-map-js 1.2.1 → 1.2.2, undici 7.29.0 → 7.30.1; doğrudan jsdom/fake-indexeddb sürümleri korundu.
- package/lock sürümleri aktif uygulama 2.16.0 ile hizalandı; Node aralığı kilitli jsdom 29'un destek aralığıyla eşitlendi.
- Mevcut otomasyon sözleşmesi aktif Storage/Version Manager ve paket sürüm tutarlılığını, eski kök kopyalarının yüklenmemesini doğrular.
- CI'a yüksek/kritik bağımlılık bildirimlerinde işi kıran audit adımı eklendi.

Dosyalar: package.json, package-lock.json, .github/workflows/platform-regression.yml, tests/automation-contract.test.cjs, NUT-018.2 raporu ve teknik kayıtlar.

Testler: temiz kurulum başarılı; audit **0 açık**; platform **1155 PASS / 0 FAIL**; AI Engine **335 / 0**, AI entegrasyonu **96 / 0**, benchmark **16 / 0**, güvenlik ihlali **0**; diff kontrolü temiz. Audit anlık bağımlılık veritabanı sonucudur. Sonraki öncelik NUT-018.3 gerçek tarayıcı ve iPhone PWA hazırlığı.

Commit: `chore: align runtime versions and secure test dependencies (NUT-018.2)`

---

## NUT-018.1 — Eksik test kapsamı

Tarih: 29 Ekim 2026. Modül: Health / otomatik doğrulama. Uygulama 2.16.0, şema 2; offline kabuk foundation-069.

- Health Hub testi gerçek DOMContentLoaded sırasını bekler; hatalı sabit başarı sayısı yerine çalışan kontroller sayılır.
- Tüketim editörü mevcut statik kontrollerine ek olarak gerçek DOM etkileşimiyle miktar/birim, şablon ölçekleme, geçersiz miktar, geçmiş gün, hata sonrası toparlanma ve çift gönderim davranışını doğrular.
- Çalışan kayıt sırasında ikinci gönderimin alt Nutrition UI işleyicisine kaçtığı doğrulandı. Capture işleyicisindeki olay durdurma, submitting kontrolünden önceye alındı; kayıt API'si/şeması değişmedi. Kalıcı kaydın çoğaldığı iddia edilmez.
- İki eksik grup npm test'e eklendi. Otomasyon envanteri platform ve AI kapılarının tüm mevcut test dosyalarını tekrarsız kapsadığını denetler.
- Codex çalışma sınırları AGENTS.md'ye kaydedildi; ürünün birincil hedefi beslenme/hareket sürdürülebilirliği olarak tanımlandı.

Değişenler: iki Health test dosyası, platform koşucusu ve otomasyon sözleşmesi; modules/nutrition-consumption-editor.js, sw.js ve ilgili kabuk referansları; AGENTS.md, mimari/backlog, NUT-018.1 uygulama kaydı ve bu changelog.

Doğrulama: platform **1155 PASS / 0 FAIL**, AI Engine **335 / 0**, Today AI entegrasyonu **96 / 0**, sentetik benchmark **16 / 0**, güvenlik ihlali **0**. CI kanıtı taslak PR #1'de tutulur. Sonraki teknik öncelik NUT-018.2 bağımlılık güvenliği ve sürüm tutarlılığıdır.

Commit: `test: complete Health regression coverage (NUT-018.1)`

---

## NUT-018 — CI and startup stabilization

Date: 29 October 2026
Module: Platform automation / Sky startup
Version: App remains 2.16.0; offline shell foundation-068; data schemas unchanged.

Summary

- Diagnosed Actions run 40930531664: dependency installation succeeded, but stale NUT-011 snapshots, missing contract path filters and a real startup storage write broke the platform gate.
- Gated automatic Sky initialization on Startup Manager readiness, preserving localStorage/IndexedDB keys and migrations. Bumped the shell so offline clients can receive the fix.
- Refreshed explicit static/SW baselines without dropping behavioral assertions; strengthened failed-startup storage preservation and offline inventory checks.
- Replaced the calendar test's fixed 20 ms sleep with a bounded wait for asynchronous history navigation.
- Added the existing 96-control Today AI integration gate and synchronized its two shell-version expectations.
- Extended workflow dependency paths and kept AI checks running after a platform failure when installation succeeds; all failing checks still fail the job.

Files Changed

- `.github/workflows/platform-regression.yml`, `modules/sky-hub.js`, `sw.js`
- `tests/ai-context-ui.test.mjs`, `tests/ai-evaluation-gate.test.mjs`
- `tests/automation-contract.test.cjs`, `tests/platform-browser-regression.test.cjs`, `tests/static-regression.test.cjs`, `tests/sw-event-regression.cjs`
- `docs/NUT-018-IMPLEMENTATION.md`, this changelog

Tests

- Platform: **1116 PASS / 0 FAIL** (including static 30/30, SW 36/36, automation 8/8, browser 48/48).
- AI Engine: **335 reported controls PASS / 0 FAIL**.
- Synthetic benchmark: **16 PASS / 0 FAIL**, **0 safety violations**.
- Today AI integration: **96 PASS / 0 FAIL**.
- Controlled 50 ms history delay reproduced the calendar race; the corrected test passed 48/48 with and without the delay.
- `git diff --check` clean. Fresh remote Actions results are recorded on draft PR #1 after the branch update.

Result

Local regression validation passed. Keep PR #1 draft and unmerged. Existing audit warnings (two high-severity transitive development dependencies) and stale standalone Health/editor tests outside the gate remain documented follow-ups.

Commit Message

`fix(ci): stabilize regression baselines and gate Sky startup (NUT-018)`

---

## Version 2.16.0 / AI Engine 0.9.0-rules — NUT-017.9

Date

15 August 2026

Phase

Explainable daily rule catalog checkpoint

Status

🟡 NUT-017.9 completed; product phase closure not claimed

Summary

- Added a second narrow daily rule for same-day `Core C`, low energy and high fatigue.
- Preserved the existing same-day `Core C` + sleep-below-six-hours rule as the deterministic first priority.
- Reused `analysis-request` and `analysis-output` v1; every result still carries evidence, confidence, uncertainty, options and approval state.
- Kept partial matches from producing suggestions and translated no-match details into plain Core, sleep, energy and fatigue text.
- Kept internal rule IDs, reason codes, event IDs, numeric confidence and NUT version text out of the user surface.
- Kept Sky outside matching, evidence, confidence and health/emotion causality.
- Extended the synthetic benchmark from 12 to 16 cases while retaining backward compatibility with the NUT-017.8 suite.
- Raised App to `2.16.0` and shell to `today-v2-foundation-067`; schema remains `2` with no migration or new storage key.

Tests

- AI Engine: **335/335 successful**.
- Synthetic benchmark: **16/16 cases**, **0 safety violations**.
- NUT-017.9 Today integration gate: **96/96 successful**.
- Existing relevant App groups: **142/142 successful**.
- Existing documented platform debt remains: static **25/30**, Service Worker event **23/36**, browser **47/48**; automation contract still lacks `.github/workflows/platform-regression.yml`.

Result

Today can prepare a second cautious daily option from existing minimized Health data without adding a model provider, persistent memory, Connect execution or technical UI noise. The original short-sleep behavior remains stable.

Commit

`feat(ai): add deterministic daily rule catalog (NUT-017.9)`

---

## AI Engine 0.8.0-evaluation — NUT-017.8

Date

15 August 2026

Phase

AI synthetic evaluation checkpoint

Status

🟡 NUT-017.8 completed; product phase closure not claimed

Summary

- Added versioned `benchmark-suite` and `benchmark-report` v1 contracts.
- Added a pure deterministic evaluator for 12 source-controlled synthetic daily-analysis, pattern-observation and pattern-feedback cases.
- Covered successful output, controlled no-result behavior and fail-closed rejection of modified safety boundaries.
- Checked evidence linkage, confidence/uncertainty/options/approval fields and pending/no-action states.
- Verified that adding symbolic Sky leaves the Core–sleep observation unchanged and never introduces causality or diagnosis.
- Restricted inputs to `synthetic-*` events and narrow payloads without free text; reports do not copy raw events.
- Kept real user data, accuracy claims, model providers, learning, DOM/storage/network access, action execution, Connect, persistent audit and external transfer disabled.
- Kept the user interface unchanged. App remains `2.15.0`, schema `2`, shell `today-v2-foundation-066`; no migration or storage key was added.

Tests

- AI Engine: **299/299 successful**.
- Synthetic benchmark: **12/12 cases**, **0 safety violations**.
- NUT-017.8 Today integration gate: **93/93 successful**.
- Existing documented platform baseline remains unchanged: static **25/30**, Service Worker event **23/36**, browser **47/48**; automation contract still lacks `.github/workflows/platform-regression.yml`.

Result

The existing deterministic Today AI behaviors now have a repeatable synthetic release gate before any new rule, provider, memory or Connect scope is considered. No technical benchmark data was added to the user surface.

Commit

`test(ai): add synthetic safety benchmark (NUT-017.8)`

---

## Version 2.15.0 — NUT-017.7

Date

14 August 2026

Phase

AI pattern feedback checkpoint

Status

🟡 NUT-017.7 completed; product phase closure not claimed

Summary

- Added versioned `pattern-feedback` and `pattern-feedback-receipt` v1 contracts.
- Added a pure deterministic processor that accepts only three explicit user responses linked to a valid NUT-017.6 observation.
- Rejected observations whose evidence, confidence, approval, causality, diagnosis, Sky, action or retention boundaries were changed.
- Added “Bana uyuyor”, “Bana uymuyor” and “Emin değilim” to the successful seven-day observation card.
- Kept technical feedback, receipt and observation identifiers out of the user surface.
- Kept only the latest choice in memory for the current screen request; reset it on a new preview, clear or reload.
- Kept observation/confidence changes, model learning, persistent memory, action execution, Connect, persistent audit and external transfer disabled.
- Raised App to `2.15.0` and shell to `today-v2-foundation-066`; schema remains `2` with no migration or new storage key.

Tests

- AI Engine: **232/232 successful**.
- NUT-017.7 App gate: **83/83 successful**.
- Existing Adapter, Migration, Router, Startup and Service Worker Manager groups: **142/142 successful**.
- Existing platform baseline remained unchanged: static **25/30**, Service Worker event **23/36**, browser **47/48**; automation contract still lacks `.github/workflows/platform-regression.yml`.

Result

The user can tell Today whether the displayed seven-day observation feels applicable without turning that response into a learned fact, permanent preference or external action.

Commit

`feat(ai): add request-scoped pattern feedback (NUT-017.7)`

---

## Version 2.14.0 — NUT-017.6

Date

14 August 2026

Phase

AI multi-day pattern observation checkpoint

Status

🟡 NUT-017.6 completed; product phase closure not claimed

Summary

- Added versioned `pattern-observation-request` and `pattern-observation-output` v1 contracts.
- Added a pure, deterministic seven-day observer for same-local-date Core `C` and sleep-below-six-hours recurrence.
- Required at least three comparable Core/sleep days and at least two matching days; otherwise no pattern is invented.
- Added provenance-linked evidence, observation strength, uncertainty, options and an explicit no-approval state.
- Defined observation strength as window coverage plus recurrence, not a probability of truth.
- Added a separate, plain-language “Son 7 güne bak” command and observation card.
- Kept internal event IDs and NUT/ruleset/schema codes out of the user surface.
- Kept Sky outside matching, evidence, confidence and health/emotion causality.
- Kept action proposals, Connect, persistent audit, storage writes and external transfer disabled.
- Raised App to `2.14.0` and shell to `today-v2-foundation-065`; schema remains `2` with no migration or new storage key.

Tests

- AI Engine: **185/185 successful**.
- NUT-017.6 App gate: **73/73 successful**.
- Existing Adapter, Migration, Router, Startup and Service Worker Manager groups: **142/142 successful**.
- Existing platform baseline remained unchanged: static **25/30**, Service Worker event **23/36**, browser **47/48**; automation contract still lacks `.github/workflows/platform-regression.yml`.

Result

The user can separately inspect whether the documented Core/sleep combination recurred during the last seven days. The output describes co-occurrence only; it does not claim cause, diagnosis, prediction or action.

Commit

`feat(ai): add explainable seven-day pattern observation (NUT-017.6)`

---

## Version 2.13.0 — NUT-017.5

Date

14 August 2026

Phase

AI decision receipt checkpoint

Status

🟡 NUT-017.5 completed; product phase closure not claimed

Summary

- Added the versioned `decision-receipt` v1 contract and a pure deterministic receipt builder.
- Linked each validated approve, reject or edit decision to its analysis and proposed action inside the internal contract.
- Added a collapsed, plain-language “Karar geçmişi” visible only during the current screen request.
- Reset the temporary history on a new preview, clear or page reload.
- Kept internal receipt, decision, analysis and action IDs out of the user interface.
- Kept edited drafts pending another explicit approval.
- Kept action execution, Connect, persistent audit, storage writes and external transfer disabled.
- Raised App to `2.13.0` and shell to `today-v2-foundation-064`; schema remains `2` with no migration or new storage key.

Tests

- AI Engine: **145/145 successful**.
- NUT-017.5 App gate: **63/63 successful**.
- Existing Adapter, Migration, Router, Startup and Service Worker Manager groups: **142/142 successful**.
- Existing platform baseline remained unchanged: static **25/30**, Service Worker event **23/36**, browser **47/48**; automation contract still lacks `.github/workflows/platform-regression.yml`.

Result

The user can see a concise receipt for each decision made during the current suggestion request. A receipt records intent only; it does not mean that a reminder or external action has happened and it is not persisted.

Commit

`feat(ai): add request-scoped decision receipts (NUT-017.5)`

---

## Version 2.12.0 — NUT-017.4

Date

14 August 2026

Phase

AI suggestion decision checkpoint

Status

🟡 NUT-017.4 completed; product phase closure not claimed

Summary

- Reused the existing approval-decision v1 contract for request-scoped approve, reject and edit decisions.
- Added a pure AI Engine decision processor and a DOM/storage/network-independent App bridge.
- Made editing create a new pending reminder draft that requires another explicit approval.
- Simplified the user surface and removed internal event IDs, NUT/rule IDs and filtering reason codes from visible copy.
- Preserved evidence, confidence, uncertainty, alternatives and approval state while translating confidence into plain language.
- Kept Sky symbolic and outside evidence, confidence and health/emotion causality.
- Kept Connect execution, persistent audit, external transfer and permanent AI memory disabled.
- Raised App to `2.12.0` and shell to `today-v2-foundation-063`; schema remains `2` with no migration or new storage key.

Tests

- AI Engine: **114/114 successful**.
- NUT-017.4 App gate: **61/61 successful**.
- Existing Adapter, Migration, Router, Startup and Service Worker Manager groups: **142/142 successful**.
- Browser baseline: **47/48**, preserving the pre-existing startup/empty-store expectation failure.

Result

The user can now approve, reject or edit a suggestion in clear language. The decision remains in memory for the current request and never implies that a reminder or external action has been performed.

Commit

`feat(ai): add request-scoped suggestion decisions (NUT-017.4)`

---

## Version 2.11.2 — NUT-017.3.2

Date

14 August 2026

Phase

AI context source-adapter correction

Status

🟡 NUT-017.3.2 completed; product phase closure not claimed

Summary

- Fixed source-cap selection that retained the oldest Health events and could exclude a newly saved sleep record.
- Changed bounded source selection to keep the newest deterministic subset and then restore chronological output order.
- Changed the Health public context view to retain the newest records per type when its own limit is reached.
- Added a regression in which an approved current sleep event must survive older Health-event pressure.
- Kept the NUT-017.3.1 rule, diagnostics and AI Engine `0.3.1-analysis` unchanged.
- Kept Sky symbolic and outside evidence, confidence, mismatch checks and health/emotion causality.
- Raised App to `2.11.2` and shell to `today-v2-foundation-062`; schema remains `2` with no migration.

Tests

- AI Engine: **86/86 successful** (unchanged Engine).
- NUT-017.3.2 App gate: **50/50 successful**.
- Existing Adapter, Migration, Router, Startup and Service Worker Manager groups: **142/142 successful**.
- Browser baseline: **47/48**, preserving the pre-existing startup/empty-store expectation failure.

Result

The latest approved sleep record can no longer be displaced by older Health events solely because the per-source limit is reached. No live model/provider, approval execution, audit write or Connect action was introduced.

Commit

`fix(ai): retain latest health context records (NUT-017.3.2)`

---

## Version 2.11.1 — NUT-017.3.1

Date

14 August 2026

Phase

AI Engine explainable-analysis correction

Status

🟡 NUT-017.3.1 completed; product phase closure not claimed

Summary

- Added deterministic mismatch diagnostics for the existing first rule.
- Displayed the selected latest Core choice, sleep duration, local dates and controlled rejection reason.
- Preserved the strict `Core=C`, sleep `<360 minutes`, same-local-date rule.
- Kept invalid requests fail-closed without diagnostic data exposure.
- Kept Sky outside evidence, confidence, diagnostics and health/emotion reasoning.
- Raised App to `2.11.1` and shell to `today-v2-foundation-061`; schema remains `2` with no migration.

Tests

- AI Engine: **86/86 successful**.
- NUT-017.3.1 App gate: **49/49 successful**.
- Existing Adapter, Migration, Router, Startup and Service Worker Manager groups: **142/142 successful**.
- Browser baseline: **47/48**, preserving the pre-existing single failure.

Result

The previously opaque no-match result now explains exactly which approved rule input failed. No live model/provider, approval execution, audit write or Connect action was introduced.

Commit

`fix(ai): expose deterministic rule mismatch diagnostics (NUT-017.3.1)`

---

## Version 2.11.0 — NUT-017.3

Date

14 August 2026

Phase

AI Engine explainable analysis preparation

Status

🟡 NUT-017.3 completed; product phase closure not claimed

Summary

- Added a provider-free, deterministic and device-only daily support analyzer.
- Added the versioned `analysis-request` contract while preserving the existing `analysis-output` contract.
- Implemented only the documented first rule: Core `C` plus sleep below six hours.
- Added a separate explicit command after the consent-gated context preview.
- Rendered evidence, confidence, uncertainty, alternatives and approval state.
- Kept Sky out of evidence, confidence and health/emotion reasoning even when symbolic context is selected.
- Kept proposed actions at `pending-user-approval`; no approval gateway, audit writer or Connect execution was added.
- Raised the offline shell from `today-v2-foundation-059` to `today-v2-foundation-060`.
- Kept the Today data schema at `2`; no migration was added.

Files Changed

- `Today-AI-Engine/contracts/analysis-request.schema.json`
- `Today-AI-Engine/src/daily-support-analyzer.mjs`
- `Today-AI-Engine/tests/daily-support-analyzer.test.mjs`
- `modules/ai-analysis-bridge.mjs`
- `modules/ai-context-ui.mjs`
- `index.html`
- `sw.js`
- `modules/version.js`
- `modules/storage.js`
- `tests/ai-analysis-bridge.test.mjs`
- `tests/ai-context-ui.test.mjs`
- `tests/run-nut-017.3.cjs`
- `docs/NUT-017.3-IMPLEMENTATION.md`
- AI Engine and Today architecture/changelog documents

Tests

- NUT-017.3 App gate: **48/48 successful**.
- AI Engine: **80/80 successful** (`10` foundation + `41` context/consent + `29` explainable analysis).
- Existing Adapter, Migration, Router, Startup and Service Worker Manager groups: **142/142 successful**.
- Browser baseline: **47/48**, preserving the pre-existing single failure.
- Legacy general gate: **1089/1116 individual checks successful**, but failed as a gate because the same four stale groups remain unresolved.

Result

NUT-017.3 successful. No phase closure claimed. No live model/provider or executable action was introduced.

Commit

`feat(ai): add deterministic explainable analysis preview (NUT-017.3)`

---

## Version 2.10.0 — NUT-017.2

Date

13 August 2026

Phase

AI Engine integration preparation

Status

🟡 NUT-017.2 completed; product phase closure not claimed

Summary

- Added read-only Core, Health, Nutrition and optional Core–Sky event adapters.
- Added purpose-bound, one-request, device-only data usage consent in Settings.
- Added a context preview backed by the unchanged NUT-017.1 Context Builder.
- Kept Sky symbolic, separate from Core/Health and non-causal.
- Did not register an AI provider, generate a recommendation or start Connect.
- Raised the offline shell from `today-v2-foundation-058` to `today-v2-foundation-059`.
- Kept the Today data schema at `2`; no migration was added.

Files Changed

- `index.html`
- `sw.js`
- `modules/version.js`
- `modules/storage.js`
- `modules/health-hub.js`
- `modules/ai-context-source-adapters.js`
- `modules/ai-context-bridge.mjs`
- `modules/ai-context-ui.mjs`
- `tests/ai-context-*.test.*`
- `tests/run-nut-017.2.cjs`
- `tests/platform-browser-regression.test.cjs`
- `docs/NUT-017.2-IMPLEMENTATION.md`
- `docs/01_ARCHITECTURE.md`
- `docs/04_CHANGELOG.md`
- `Today-AI-Engine/README.md`
- `Today-AI-Engine/CHANGELOG.md`
- `Today-AI-Engine/docs/ARCHITECTURE.md`
- `Today-AI-Engine/docs/PHASES.md`

Tests

- NUT-017.2: **35/35 successful**.
- AI Engine: **51/51 successful**.
- Existing Adapter, Router, Startup and Service Worker Manager groups: **101/101 successful**.
- Browser baseline: **47/48**, preserving the pre-existing single failure.
- Legacy general gate: **1089/1116 individual checks successful**, but failed as a gate because four stale groups remain unresolved.

Result

NUT-017.2 successful. No phase closure claimed.

Commit

`feat(ai): add consent-gated context preview (NUT-017.2)`

---

## Version 2.0.0

Date

31 July 2026

Phase

Phase 2 — Platform Architecture

Status

🟢 Completed

Summary

- **TB-011:** Inventoried the working architecture, data flows, dependencies and repetition risks.
- **TB-012:** Added Startup Manager for dependency validation and safe application boot.
- **TB-013:** Added the central Router for view transitions and back behavior.
- **TB-014:** Added the central Module Registry for Core, Health and Sky.
- **TB-015:** Added Central Error Manager for safe `error` and `unhandledrejection` handling.
- **TB-016:** Added backed-up, repeat-safe migration orchestration for `0 → 1 → 2` and `1 → 2`.
- **TB-017:** Added user-approved Service Worker updates and old-cache cleanup.
- **TB-018:** Added safe, immutable TodayAI and TodayConnect adapter contracts for the provider-free state.
- **TB-019:** Added the portable `npm test` regression gate and GitHub Actions workflow.

Changed

- Centralized the startup sequence around validated dependencies.
- Separated routing, module resolution, error handling and Service Worker registration into single-responsibility modules.
- Raised the active application shell to `today-v2-foundation-012`.
- Centralized application version `2.0.0` and data schema `2` under `modules/version.js`.

Preserved

- Today Core, Today Health and Today Sky user flows.
- Calendar, Statistics and Settings views.
- Existing data keys, theme, CSV export and edit behavior.
- Router back behavior and visible product language.
- Local-first operation, data minimization and user control.

Files Changed Across Phase 2

- index.html
- sw.js
- modules/startup-manager.js
- modules/router.js
- modules/module-registry.js
- modules/error-manager.js
- modules/migration.js
- modules/service-worker-manager.js
- modules/adapter-interfaces.js
- package.json
- package-lock.json
- tests/**
- .github/workflows/platform-regression.yml
- docs/01_ARCHITECTURE.md
- docs/02_ROADMAP.md
- docs/03_PHASES.md
- docs/04_CHANGELOG.md
- docs/10_TECHNICAL_BACKLOG.md

Tests

- GitHub Actions: **294/294 successful, 0 failures**.
- GitHub Pages deployment: successful.
- TB-019 changed only test and automation files; `index.html`, `sw.js` and `modules/**` remained unchanged from TB-018.

Result

Successful

Closure

> **Faz 2 geliştirmeleri tamamlandı. GitHub Actions üzerinde test edildi. Sonuç: Başarılı.**

Commit

test(platform): enable TB-019 automated regression gate

---

## Phase 1 Closure — TB-001–TB-010

Status

🟢 Completed

Summary

- Duplicate Core markup and duplicate IDs were removed.
- Event-listener ownership was unified.
- Storage and state were moved toward a single source of truth.
- Version management was centralized.
- Backup/restore and migration behavior were validated.
- Dead-code, performance and accessibility reviews were completed.
- Foundation regression testing completed successfully.

Result

Successful

Closure

> Faz 1 geliştirmeleri tamamlandı. Test edildi. Sonuç: Başarılı.

---

## Version 10-APP-003

Date

29 July 2026

Phase

Phase 1 – Foundation

Status

🟡 In Progress

Summary

- Today Master Project initiated.
- Development phases defined.
- Architecture documentation started.
- Roadmap documentation created.
- Phase management introduced.
- Changelog system initialized.

Modules

- Core
- Documentation

Files

- docs/01_ARCHITECTURE.md
- docs/02_ROADMAP.md
- docs/03_PHASES.md
- docs/04_CHANGELOG.md

Tests

Documentation review completed.

Result

In Progress

Commits

docs: add initial Today Master Project architecture

docs: add Today Master Project roadmap

docs: add development phases tracker

docs: initialize project changelog

---

# Future Entry Template

## Version

Date

Phase

Status

Summary

Modules

Files Changed

Tests

Result

Commit Message

---

## TB-001 — Duplicate HTML Cleanup

Date

29 July 2026

Phase

Phase 1 – Foundation

Summary

- Removed duplicated Core action row.

- Removed duplicated Core bottom navigation.

- Removed duplicated `btnResetToday`.

- Removed duplicated `statusPick`.

Files Changed

- index.html

Tests

- Home

- Module Center

- Today Core

- Health

- Sky

- Calendar

Result

Successful

Commit

refactor: remove duplicated core html structure
