# Today native önizleme — gerçek cihaz kabulü

Durum: **Hazırlık; fiziksel cihazda henüz çalıştırılmadı.** Android debug/iOS simulator derlemesi, gerçek saat eşitlemesi veya OS izin kabulü anlamına gelmez. Bu belge kullanıcı tarafından yürütülecek adımları ve kanıt alanlarını tanımlar; boş satırlar PASS değildir.

## Android APK'yı edinme ve doğrulama

1. [Today Actions](https://github.com/mtayfunturk-collab/Today/actions) içinde `Today Platform Regression` çalıştırmasını aç. Dalın `nut-018-ci-stabilization`, commit SHA'sının incelemek istediğin kodla aynı olduğunu kontrol et.
2. `Native preview (android)` işinde derleme ve `Verify merged Android read permissions` adımlarının başarılı olduğunu doğrula. Yalnız ardından üretilen `today-android-preview-<tam kaynak commit SHA>` artifact'ini indir. PR çalıştırmalarında ad PR head SHA'sını kullanır; APK, GitHub'ın o çalıştırmadaki PR/base birleştirme ağacından derlenir. Bu yüzden kaynak SHA ile birlikte run ID ve base sürümünü de kaydet. GitHub oturumu/depo erişimi gerekebilir; artifact 7 gün sonra silinir. Eski artifact süresi dolmuşsa yeni başarılı çalıştırma gerekir.
3. ZIP'i boş bir test klasörüne çıkar. İçerik yalnız `app-debug.apk` ve `SHA256SUMS` olmalıdır. APK, uygulama varlıklarını içerir; kullanıcı profili, sağlık kaydı, CI logu veya imzalama hesabı artifact'e eklenmez.
4. Çıkarılan klasörde bütünlüğü doğrula. Linux:

```sh
sha256sum --check SHA256SUMS
```

macOS:

```sh
shasum -a 256 --check SHA256SUMS
```

Windows PowerShell:

```powershell
$expected = ((Get-Content .\SHA256SUMS -Raw).Trim() -split '\s+')[0]
$actual = (Get-FileHash .\app-debug.apk -Algorithm SHA256).Hash
if ($actual -ine $expected) { throw 'APK SHA256 eşleşmiyor' }
'APK SHA256 eşleşti'
```

Eşleşme, APK'nın bu artifact içindeki checksum'la aynı olduğunu gösterir; yayıncı sertifikası veya mağaza onayı değildir. Commit ve başarılı çalışma kaydını da kontrol et.

## Kurulum, güncelleme ve verinin yeri

Bu paket `app.today.preview` kimlikli, debug imzalı geliştirme uygulamasıdır. Mevcut oluşturucu Android sürüm adını `1.0` bırakır; web uygulamasının kendi sürümü ayrıca Ayarlar/Version Manager'da görünür. Hangi kodun test edildiğini APK sürüm adıyla değil **commit SHA ve Actions run ID** ile kaydet.

Android 8/API 26 minimum uygulama hedefidir; Health Connect'in cihazda gerçekten kullanılabilir olması ayrıca gerekir. Telefon/OS sürümüne göre Health Connect sistemde bulunur veya ayrı kurulur. Health erişimi yoksa uygulama bağlı durum üretmemelidir.

APK'yı telefonda açıp Android'in yalnız bu kurulum kaynağı için gösterdiği yükleme onayını kullanabilirsin. Alternatif olarak Android SDK Platform Tools kurulu test bilgisayarında, USB hata ayıklamasını telefonda bilerek açıp cihazı seç:

```sh
adb devices
adb -s <cihaz-seri-numarası> install app-debug.apk
```

`<cihaz-seri-numarası>` yer tutucusunu `adb devices` çıktısındaki test cihazıyla değiştir; komutu yer tutucuyla çalıştırma. Daha önce aynı uygulama kimliği ve aynı imza ile kurulmuş önizlemeyi verisini koruyarak güncellemek için:

```sh
adb -s <cihaz-seri-numarası> install -r app-debug.apk
```

CI debug imza anahtarı kalıcı bir yayın anahtarı değildir; ayrı çalıştırmalar farklı debug sertifikaları üretebilir. `INSTALL_FAILED_UPDATE_INCOMPATIBLE` alırsan bu veri kaybı olmayan güncelleme yolunun uygun olmadığını gösterir. Sorunu aşmak için mevcut uygulamayı otomatik kaldırma veya uygulama verisini temizleme. Önce hangi native test verisinin korunması gerektiğini belirle; tüm-modül yedek/geri yükleme henüz kanıtlanmış değildir.

Android'de **kaldırma** veya **uygulama verisini temizleme**, native önizlemenin yerel kayıtlarını siler. Test için silmeye karar verilmesi ancak bilinçli ve ayrı bir işlemdir; bu belge hiçbir kaldırma/temizleme komutu çalıştırmaz. APK güncellemesi aynı imzayla `-r` olduğunda da veri koruma davranışı ayrıca kabul testinde doğrulanmalıdır.

Native WebView deposu tarayıcı/PWA profilinden ayrıdır. PWA kayıtları kendiliğinden taşınmaz; uygulamanın ilk native açılışında boş görünmesi PWA verisinin silindiği anlamına gelmez. PWA profilini temizleme. Native Android Auto Backup kapalıdır; bu APK yeni bir bulut yedeği kurmaz. İlk kabulü ayrı sentetik test kayıtlarıyla yap; gerçek sağlık değerlerini veya ham notları test raporuna koyma.

## Üretici eşitlemesi ve dar izin akışı

1. Saat/bilekliği önce kendi resmî uygulamasıyla eşleştir. Telefon modeli/OS, saat modeli/firmware, Mi Fitness veya Zepp Life sürümü ve bölgeyi kaydet. Today doğrudan bütün Bluetooth modellerine eşleşmez.
2. Üretici uygulamasında ilgili türün Apple Health veya Health Connect'e gerçekten aktarıldığını kontrol et. Mi Fitness'ın bazı belgelenmiş akışları üretici bulut eşitlemesi gerektirir; Today bunu açmaz. Zepp Life Android → Health Connect desteği doğrulanmadı; veri yolu yoksa satır **destek doğrulanamadı** kalır.
3. Today → Health → Sağlık → Kişisel Sağlık Verileri'ni aç. Sadece ekranı açmak OS izni veya sağlık okuması başlatmamalıdır. Native sağlık erişimi yoksa açıklama ve kapalı okuma düğmesi beklenir.
4. İlk okumada yalnız **Adım**, **Bugün** ve bu inceleme için açık onayı seç. OS izin ekranında yalnız seçilen türün okunmasını kontrol et. Sağlık deposuna yazma, nabız/klinik veri, arka plan veya ek geçmiş izni istenmemelidir.
5. Sonucu üretici/OS merkezindeki aynı takvim günü ve aynı veri anlamıyla karşılaştır. Adım eksikse sıfır diye üretilmemeli; uyku gece yarısında günlere bölünür; antrenman oturum aralığı aktif hareket dakikası değildir.
6. Aynı adımları uyku ve antrenman için ayrı seçili izinlerle yürüt. İlgili tür üretici tarafından paylaşılmıyorsa bütün cihazı bağlı sayma; eksik türü açık kaydet.
7. OS iznini reddet, ardından sistem ayarından geri alıp tekrar dene. Android her sorgu öncesinde izni yeniden kontrol etmelidir. HealthKit boş okuma kesin ret diye sunulmamalıdır.
8. Okuma/izin beklerken onayı kaldır, tür/dönem değiştir veya önizlemeyi temizle. Açık OS penceresi zorla kapatılmayabilir; geç sonuç gösterilmemeli ve sonraki sorgular başlamamalıdır. Bekleyen işlem gerçekten bitmeden ikinci okuma açılmamalıdır.
9. Aynı kaynakta telefon+saat çakışmasını, gece yarısını, saat dilimi değişimini, boş dönem ve yeniden eşitlemeyi ayrı kaydet. Dönen özetin kaynağına göre yinelenen adım veya iki kez sayılan uyku/antrenman olmamalıdır.
10. Yeniden açılış, çevrimdışı Core/Health kayıtları ve aynı imzayla yükseltmede sentetik kullanıcı kayıtlarının korunduğunu doğrula. Saat okuması yalnız istek belleğindedir; kalıcı Health kaydı/AI aktarımının bu aşamadaki gerçek kapsamı ilgili commit'in raporuyla karşılaştırılır.

NUT-019.2.2 ve sonraki APK'da AI ayrı onayını da test et: saatten bir türü oku, Ayarlar/AI'da yalnız ilgili saat seçeneğini aç ve taze onayla dönemi incele. Değer ve Apple Health/Health Connect kaynağı ayrı görünmeli; AI kullanımı yeni OS okuması başlatmamalı. Health önizlemesini temizleyip AI'a dönünce eski sonuç kaldırılmalı ve yeni onay gerekmeli. Yeniden açılışta geçici saat snapshot'ı bulunmamalı; manuel veriler korunmalı. Telefon bildirimi teslimi henüz bu dilimde uygulanmadı; metnin depoda bulunması OS teslimi değildir. Henüz çalıştırılmamış akışları PASS işaretleme.

## iPhone / Apple Watch yolu

CI'daki `CODE_SIGNING_ALLOWED=NO` simulator derlemesi iPhone'a kurulabilir IPA üretmez. Bu artifact'le Apple Watch/HealthKit fiziksel kabulü yapılamaz. Gerçek cihaz kurulumu için macOS/Xcode, kullanıcının sahip olduğu uygun Apple imzalama hesabı/provisioning ve HealthKit yeteneği gerekir. Bu iş kapsamında hesap açılmadı, takım/sertifika seçilmedi, TestFlight'a yükleme veya mağazaya gönderim yapılmadı.

Bu adımlar somut cihaz/imzalama kapsamıyla ayrı yürütülür. Apple Watch/HealthKit izinleri yine cihaz kullanıcısı tarafından verilir; simulator başarısı yerine geçmez. Mi Fitness/Zepp Life iPhone aktarımı da üretici ve veri türü bazında ayrıca test edilir.

## Gerçek cihaz kayıt matrisi

Her satırı ayrı cihaz/OS/üretici uygulaması sürümü için çoğalt. Ham sağlık değerlerini veya ekran kilidi/hesap bilgilerini ekleme.

| Yol | Telefon/OS | Saat/firmware | Üretici uygulaması/sürüm/bölge | Today commit / run | İzin/ret/geri alma | Adım / uyku / antrenman | Boş veri / iptal / yeniden eşitleme | AI ayrı onay / bildirim teslimi | Sonuç |
|---|---|---|---|---|---|---|---|---|---|
| Android → Mi Fitness → Health Connect | Bekleniyor | Bekleniyor | Mi Fitness; sürüm/bölge bekleniyor | Bekleniyor | Çalıştırılmadı | Çalıştırılmadı | Çalıştırılmadı | Ayrı özellik kapısı; çalıştırılmadı | **Cihaz testi bekleniyor** |
| Android → Zepp Life → Health Connect | Bekleniyor | Bekleniyor | Zepp Life; aktarım desteği doğrulanmadı | Bekleniyor | Çalıştırılmadı | Çalıştırılmadı | Çalıştırılmadı | Ayrı özellik kapısı; çalıştırılmadı | **Veri yolu ve cihaz testi bekleniyor** |
| iPhone → Apple Watch → Apple Health | Bekleniyor | Bekleniyor | Apple Health/watchOS sürümü bekleniyor | Bekleniyor | Çalıştırılmadı | Çalıştırılmadı | Çalıştırılmadı | Ayrı özellik kapısı; çalıştırılmadı | **İmzalı cihaz kurulumu bekleniyor** |
| iPhone → Mi Fitness/Zepp Life → Apple Health | Bekleniyor | Bekleniyor | Uygulama/sürüm/bölge bekleniyor | Bekleniyor | Çalıştırılmadı | Çalıştırılmadı | Çalıştırılmadı | Ayrı özellik kapısı; çalıştırılmadı | **İmzalı cihaz kurulumu ve test bekleniyor** |

Her sorun için: cihaz satırı, commit/run, seçilen tür/dönem, beklenen davranış, gözlenen davranış, veri kaybı olup olmadığı ve yeniden üretme adımlarını yaz. Sonuç ancak gözlendiğinde PASS/FAIL olur; “derlendi” cihaz sonucu değildir.

## NUT-019.3 — Fiziksel bildirim kabulü (henüz yapılmadı)

Ayrı sentetik profilde iPhone ve Android için şu sonucu OS/sürüm/cihaz/uygulama sürümüyle kaydet:

1. İlk açılışta bildirim izni sorulmasın ve `today_ai_delivery_v1` oluşmasın. PWA'da native bildirim düğmeleri kapalı olsun.
2. Ayarlar/AI'da günlük kanal + yerel saat + ayrı saklama onayı ver; OS iznini reddet, sonra açık eylemle ver. İzin yokken planlama olmamalı.
3. Onaylı günlük/7 günlük gözlem oluştur. Seçilen gelecek saatte yalnız sabit gizli içerikli mesajı kontrol et; hassas özet/not kilit ekranında bulunmasın. Aynı gün ikinci gözlem ikinci mesaj üretmesin.
4. Uygulama kapalıyken bildirime dokun; aynı kayıtlı gözlem açılsın. Süresi geçmiş/silinmiş kimlik için dürüst kullanılamıyor mesajı olsun.
5. Sessiz saat, saat dilimi değişimi, çevrimdışı, OS pil kısıtı, yeniden başlatma ve izin iptalinde gerçek davranışı kaydet. Kesin teslim bekleme.
6. AI kanalını kapat/sıfırla: yalnız yeni arşiv ve Today bildirimleri temizlensin, mevcut Core/Health örnekleri korunsun. 7 gün dolduktan sonraki açılışta arşiv temizliğini doğrula.
7. Güncelleme kanalında ilk etkinleştirmede sahte mesaj olmamalı. Aynı imzalı yüksek bundle sürümü kurup açınca bir `Today Yenilik`, tekrar açılışta sıfır ek mesaj bekle. Farklı CI debug imzası nedeniyle profili silme.

Tarayıcı testindeki sentetik SDK callback/queue bu kontrollerin yerine geçmez. iOS unsigned simulator derlemesi gerçek iPhone teslimini kanıtlamaz.
