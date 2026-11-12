# Today — Ana talimata göre güncel durum

12 Kasım 2026, TSİ. Kaynak: mevcut Radio tabanlı yerel aday ve10 Kasım TODAY-CURRENT-EXECUTION-PLAN.md. Bu belge ürün talimatını veya görev sırasını değiştirmez; otomatik yürütme/yayın yetkisi değildir.10 Kasım planındaki “hizalamalar henüz uygulanmadı” satırları aşağıdaki yerel ilerlemeyle güncellenmiştir; veri güvenliği ve kabul kapıları kapanmamıştır.

Güncel canlı adayda ayrı sentetik hedefe geri yükleme ve kesinti sonrası geri alma prototipi test edildi; yerel gerçek Chromium IndexedDB ve mevcut tek pencere kilidi kabulü ayrıca yürütüldü. Salt okunur önizleme formu yerel backup sayfasında çevrimdışı kabul aldı. Üretim restore bağlantısı, BFCache yarışı, WebKit ve fiziksel kabul açık. Ayrıntı `TODAY-LIVE-SYNTHETIC-RECOVERY.md`, `TODAY-LIVE-NATIVE-RECOVERY-ACCEPTANCE.md`, `TODAY-LIVE-WRITER-ADMISSION.md` ve `TODAY-LIVE-RESTORE-UI.md`.

## Hangi aşamadayız?

12 Kasım birleşik yerel adayın platform/AI/Radio ve sentetik tarayıcı kapıları geçti; ayrıntı `TODAY-LIVE-CANDIDATE-2026-11-12.md`. Uzak CI ve fiziksel cihaz kabulü henüz bu aday için yapılmadı.

**PO1-I18N02 — Core/ortak ekran çok dillilik sunumu üzerinde çalışıyoruz.** Core ile başlama,12 renk ve modül hizalamaları mevcut görünüm korunarak yerelde uygulanmıştır. Dil resolver'ı ve TR sözlük bağlamaları da yereldir. Kalıcı dil tercihi ve tam İngilizce henüz etkin değildir. Canlı geçiş hazırlığında salt okunur geri yükleme önizleyicisi yerel adaya alındı; sonuç TODAY-LIVE-RESTORE-PREVIEW raporunda.136 girdinin tamamında EN taslak var; ürün sahibi onaylı EN yok. Test sayısı ürünün tamamlanma yüzdesi değildir.

| Ana plan grubu | Güncel durum | Kapanması gereken |
|---|---|---|
| T90-03 test stabilizasyonu | Yerel kapılar çalışıyor; Radio tabanında fixture düzeltmesi mevcut | Yeni birleşik adayın uzak CI/release kabulü yok |
| T90-04–08 veri güveni | Envanter/tasarım/sentetik yedek-restore çalışmaları var | Güncel adayda bütün kalıcı veriler, tam restore/kesinti/kurtarma ve writer koruması |
| UX02/NAV01/COR01/UX03–05 | Core merkezli akış,12 renk ve Core/Health/Sky/Radio-AI hizalamaları yerel otomatik kabul aldı | Güncel gerçek adayda Safari/PWA/Windows kabulü ve yayın |
| I18N01–02 | Resolver ve Core/ortak TR sunumu ilerliyor; aktif aşama | Ortak hata/fallback/eksik yüzeyler; Core EN tamlığı; kalıcı tercih/yedek ve dil değişim kabulü |
| I18N03–06 | Health/Sky/Radio/AI katalog taslakları var | Güncel adayda uygulama, tam çeviri/parametre/erişilebilirlik ve çapraz durum kabulü |
| SP01/SP02/koşullu SP03 | Önceki düzenlenebilir taslak/transaction/yedek prototipleri ve dört ekran kabulü var | Gerçek Core not owner entegrasyonu; mikrofon ve dış aktarım izin ayrımı; yerel tanıma fizibilitesi/cihaz doğrulaması. Yerel ses sözü yok |
| RAD01–06 | Kabul edilmiş Radio2.23.3 korunuyor | Favori veri/yedek tasarımı+UI; metaveri fizibilitesi/izinli sağlayıcı ve doğru boş durum |
| AUTH01 | Tasarım/onay kapısı açık | Yerel profil/hesap/passkey/biyometri; anahtar/oturum/kurtarma tasarımı. Kimlik kodu ayrıca tasarım onayı ve ayrı görev ister |
| T90-09/ACC01 | Önceki dört ekranlı sentetik önizleme kullanıcı tarafından Safari/PWA/Windows'ta kabul edildi | Bütün özellikleri içeren gerçek Today adayının ayrı fiziksel kabulü; önizleme sonucu buna devredilmez |
| T90-12–26 kurucu/pilot/pazar | Güvenli aday sonrası planlı |14 gün kurucu kullanımı, kapsamı dondurulmuş10–20 kişilik pilot, fayda/güven/tekrar kullanım/ödeme/karar |

## Son ana talimat ne zaman biter?

Henüz tarihlendirilmiş bir bitiş planımız yok. Aktif I18N02'nin kapanması bile tek takvim etiketi işinden geniştir: kalan dinamik/ortak metinler, tam Core dil kapsamı ve ilişkili kabul gerekir. Ardından diğer modül dilleri, ses entegrasyonu,Radio ekleri,AUTH01 tasarımı,gerçek aday kabulü ve kurucu/pilot kararları vardır. Bir iş grubu birden fazla dar uygulama ve kabul oturumu gerektirebilir; tabloyu kalan oturum sayısı olarak kullanma. Tamamlanma yüzdesi veya kesin tarih uydurulmaz.

Ana talimatın gelişim/kabul bölümü; yetkilendirilmiş özellikler gerçek adaya entegre edildiğinde, gerekli otomatik kapılar ve tüm veri yedek/restore kabulü geçtiğinde, gerçek Safari/kurulu PWA/Windows kabulü yapıldığında kapanabilir. Güvenli adaydan sonra planlanan14 günlük kurucu kullanımı ve pilotun gözlem/karar süresi ayrıca gerekir. Koşullu90 gün hedefi bütün yeni özellikler için garanti bitiş tarihi değildir; geciken kapasite/cihaz/izin kapısında güven koşulları gevşetilmez.

Şifreli yedek güvenli uygulama girişi değildir. Ana talimat AUTH01 için tasarım ister; parola/passkey/biometrik kodu tasarım onayından sonra ayrı kapsamdır. Mağaza/saat/native bildirim maliyet ve platform ertelemesi sürer; ana talimatın tamamlanması otomatik App Store/Play yayını yetkisi vermez.

## Canlı durum ve devam

Kullanıcı 12 Kasımda önemli düzeltmelerden sonra canlıya geçme hedefini onayladı. Ancak güncel adayda tam veri yedek/geri yükleme ve fiziksel kabul kapıları açık; Netlify dışarıdan HTTP401. Ayrıntı TODAY-LIVE-RELEASE-GATE-2026-11-12.md. Bu oturumda push/PR/merge/deploy yapılmadı; Pages App2.23.3/foundation-082 olarak kalır.

Mevcut sıra korunur; bu görev sonrasında yalnız sıradaki I18N03 Health kartı kaynak metin farkı ve katalog rebase değerlendirmesi;EN UI etkinleştirme yok önerilir. Bağımsız işler kullanıcı tetiklemesiyle ilerler. Ses/güvenli giriş tasarımı kullanıcı ayrıca isterse önce ele alınabilir; bu durum diğer işleri otomatik başlatmaz. Core/Health/Sky/Radio'nun mevcut mimarisi ve “Sadece fark et.” ilkesi korunur.
