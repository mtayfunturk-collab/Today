# Today native bağlantı önizlemesi

Bu dizin aynı Today web uygulamasını ince Capacitor kabuğunda paketler. Apple Health/HealthKit ve Android Health Connect için gerçek `@capgo/capacitor-health` SDK köprüsü içerir. Üretim/mağaza uygulaması veya bütün saat modellerinde doğrulanmış bağlantı değildir. `app.today.preview` geçici uygulama kimliğidir; gönderim, imzalama hesabı veya mağaza kaydı oluşturmaz.

## Kurulum ve hazırlık

Node 22+ gerekir. Kilit dosyasını koruyarak:

```sh
npm --prefix native ci --ignore-scripts
npm --prefix native test
npm --prefix native run build:web
npm --prefix native run prepare:android
# macOS ve Xcode 26+ üzerinde:
npm --prefix native run prepare:ios
```

`prepare:android` / `prepare:ios`, web paketini hazırlar; platform yoksa `cap add`, sonra izin yapılandırması ve `cap sync` yapar. İndirilen paketlerden yerel Capacitor CLI çalışır; npx üzerinden kayıtsız bir sürüm indirilmez. `www/`, `android/`, `ios/` üretilebilir ve Git dışında tutulur. Native projede elle yapılan değişiklikler bu önizlemenin yeniden üretilebilir kaynakları değildir; kalıcı geliştirme gerekiyorsa hazırlık scriptine veya ayrı incelenen native kaynağa taşınır.

`build:web`, Service Worker APP_SHELL envanterini ve onun yerel module bağımlılıklarını okur. Yalnız uygulama dosyaları izin listesiyle kopyalanır; depo kökü, `.git`, testler, dokümanlar, kullanıcı dosyaları veya yerel profil verisi kopyalanmaz. Native bootstrap bütün uygulama scriptlerinden önce senkron çalışır; native Health proxy'sini kaydeder, izin veya veri istemez. Service Worker native ortamda kaydedilmez; paketin yerel dosyaları eski web cache'iyle değişmez. PWA'nın kaynak HTML'i ve normal SW davranışı korunur.

## Dar sağlık izinleri

Android hazırlığı, Capacitor template minimum API 24 değerini sabit sağlık kütüphanesinin gerektirdiği **API 26** seviyesine çıkarır; daha yüksek hedefi düşürmez. Health Connect'in cihazda bulunması/çalışması ayrıca sorgulanır; bu minimum değer her cihazda Health Connect kullanılabildiği anlamına gelmez. App manifesti plugin'in geniş varsayılan izinlerini açık `tools:node="remove"` talimatlarıyla daraltır. Derlenmiş/birleştirilmiş manifestte yalnız şu sağlık izinleri kalmalıdır:

- `android.permission.health.READ_STEPS`
- `android.permission.health.READ_SLEEP`
- `android.permission.health.READ_EXERCISE`

Yazma, diğer sağlık türleri, arka plan okuma veya geçmiş okuma izni yoktur. Yeni önizlemede Android **Auto Backup açıkça kapatılır** (`android:allowBackup="false"`); Capacitor template'in varsayılan bulut yedeği izni devralınmaz. Health Connect'in tür bazında gerçek OS izni ayrıca kullanıcıdan alınır; manifest bildirimi izin verildiği anlamına gelmez. Plugin'in izin gerekçesi Activity/alias'ı korunur; yerel `privacypolicy.html` açıklamasını açar.

iOS için yalnız HealthKit entitlement ve `NSHealthShareUsageDescription` eklenir; yazma açıklaması, klinik veya arka plan entitlement eklenmez. HealthKit boş sonucu ret diye etiketlenmez. Gerçek imzalanan build için HealthKit provisioning ve Apple izin akışı fiziksel cihazda doğrulanmalıdır.

## Derleme ve CI doğrulaması

Android: JDK 21, Android SDK 36 ve gerekli SDK araçları kurulu ortamda:

```sh
cd native/android
./gradlew :app:assembleDebug :app:processDebugMainManifest --no-daemon
cd ../..
npm --prefix native run verify:android-permissions
```

Son komut app `build/intermediates/merged_manifest*/` çıktılarını denetler; tek bir istenmeyen sağlık izninde, gereken üç izinden biri eksikse veya Auto Backup açık/eksikse başarısız olur. Kaynak manifestin kaldırma talimatlarıyla dolu olması derlenmiş dar kapsamın kanıtı değildir; gerçek merger çıktısı gerekir. İstenirse tek çıktı yolu `npm --prefix native run verify:android-permissions -- /tam/yol/AndroidManifest.xml` ile verilir.

iOS: macOS ve Xcode 26+ üzerinde platform hazırlandıktan sonra, imza/yayın yapmadan simulator derlemesi:

```sh
xcodebuild -project native/ios/App/App.xcodeproj -scheme App -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/today-native-ios-build CODE_SIGNING_ALLOWED=NO build
```

Bu komutlar native kaynakların derlenmesini doğrular; gerçek saatin veri paylaşımını, bildirim teslimini, imzalı cihaz kurulumunu veya mağaza kabulünü kanıtlamaz. Uyumluluk telefon/OS/saat/üretici uygulaması/sürüm/tür matrisiyle ayrıca kaydedilir.

Android CI, derleme ve birleşmiş manifest doğrulaması geçtikten sonra yalnız debug APK ile SHA256SUMS dosyasını `today-android-preview-<commit SHA>` artifact'i olarak 7 gün saklar. Bu bir mağaza sürümü değildir; iOS simulator derlemesi de iPhone'a kurulabilir paket değildir. İndirme, checksum, kurulum/güncelleme ayrımı ve henüz çalıştırılmamış gerçek cihaz kabul kaydı [DEVICE-VALIDATION.md](DEVICE-VALIDATION.md) içindedir.

## Veri ve dağıtım sınırı

Native WebView origin/deposu mevcut tarayıcı/PWA profilinden ayrıdır. Mevcut PWA kayıtları kendiliğinden taşınmaz. Bu paket otomatik migration, mevcut kullanıcı verisini silme veya yeni kalıcı sağlık şeması içermez. Saatten okunan özetlerin bu bağlantı dilimindeki hedefi açık oturum belleğinde önizlemedir; güncel Health/AI kaynak/onay davranışının sınırı ana uygulama raporunda açıklanır. Üretici Mi Fitness/Zepp Life bulutu Today'in cihaz içi işleme sınırından ayrıdır; kullanıcı adına üretici bulutu açılmaz.

NUT-019.3 ile @capacitor/local-notifications 8.3.1 üzerinden izinli yerel bildirim taşıyıcısı vardır. Arka plan AI veya push sunucusu yoktur. Sağlık/native SDK kodu eklemek gerçek cihaz izinlerinin verilmiş olduğu anlamına gelmez.

## Bağımlılık ve lisans kaydı

Capacitor core/CLI/Android/iOS **8.6.0** (MIT), Capgo Capacitor Health **8.11.13** (**MPL-2.0**) Local Notifications **8.3.1** (MIT) ve esbuild **0.28.2** (MIT) tam sürümle kilitlenir. Plugin kaynakları değiştirilmez. Health plugin lisansı native web paketine `health-plugin-LICENSE.txt` olarak eklenir; kaynak deposu [Cap-go/capacitor-health](https://github.com/Cap-go/capacitor-health). MPL bildirimleri ve kaynak erişimi dağıtım paketinde korunmalıdır; mağaza dağıtımı ayrıca incelenir. Capgo hesabı, ücretli güncelleme hizmeti, updater veya API anahtarı eklenmez.

İşletim sistemi API kaynakları: [HealthKit](https://developer.apple.com/documentation/healthkit/setting-up-healthkit), [Health Connect](https://developer.android.com/health-and-fitness/health-connect/get-started), [Capacitor ortam gereksinimleri](https://capacitorjs.com/docs/getting-started/environment-setup).

## Bildirim önizlemesi

Ayarlar/AI içinde bildirimler varsayılan kapalıdır. Ayrı saklama onayı, seçilen saat ve OS izni gerekir. AI bildirimi yalnız önceden üretilen gözlem içindir; saat geçtiyse ertesi güne yeni gözlem mesajı kurulmaz. OS yükü yalnız sabit metin + opak gözlem kimliği/sürüm taşır. Android POST_NOTIFICATIONS ve reboot restore receiver korunur; SCHEDULE_EXACT_ALARM/USE_EXACT_ALARM manifestten kaldırılır, SDK exact bayrakları false olur. Kesin saat/kapalı telefonda teslim garanti edilmez.

Güncelleme kanalı ilk etkinleştirmede sürümü başlangıç olarak kaydeder. Sonraki gerçek yüksek kurulu bundle sürümü uygulama açılışında bir kez `Today Yenilik` planlayabilir; mağazada güncelleme bulunması veya uygulama kapalıyken mağaza kontrolü değildir. PWA Service Worker güncelleme duyurusu uygulama içindedir. Cihaz kabul adımları `DEVICE-VALIDATION.md` içinde.
