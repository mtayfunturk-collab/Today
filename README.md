# Today

Core, Health ve Sky kayıtlarını kullanıcının izin verdiği kapsamda AI Engine ile anlamlandırmayı hedefleyen, cihaz içi veriye ve kullanıcı kararına öncelik veren günlük yaşam uygulaması. Önceki beslenme/hareket odak seçimi geri çekildi; kullanıcının yeni talebi günlük, 7/30/90 günlük AI gözlemleri ve sonrasında izinli saat/bildirim bağlantılarıdır. Core günlük farkındalığı, Health yerel kayıt/planlamayı, isteğe bağlı Sky sembolik düşünme alanını sağlar. AI Engine bugün sağlayıcısız günlük kurallar ve çok dönemli betimleyici gözlemlerle çalışır; genel sohbet veya otomatik dış işlem yapmaz.

Health → Sağlık → Kişisel Sağlık Verileri, native SDK bulunan telefonda seçilen son 1/7/30 günlük uyku/adım/antrenman özetini açık onayla geçici olarak incelemek içindir. Normal PWA'da erişim olmadığı açıklanır. [Native önizleme kurulumu](native/README.md) aynı web uygulamasını kullanır; PWA verisini otomatik taşımaz. [Teslim kapsamı, test kanıtı ve kalan cihaz/bildirim işleri](docs/NUT-019.2-IMPLEMENTATION.md).

Son saat önizlemesi, Ayarlar/AI içindeki ayrı ve varsayılan kapalı saat türleri seçilip yeniden onaylandığında gözleme katılabilir. Takvim günü uykusu ve antrenman oturum süresi manuel kayıtlardan ayrı kalır; yeni bir kalıcı sağlık/AI deposu oluşturulmaz. [Health–AI dilimi](docs/NUT-019.2.2-IMPLEMENTATION.md), [Android APK ve cihaz kabulü](native/DEVICE-VALIDATION.md), [onaylı bildirim tasarımı](docs/NUT-019.3-NOTIFICATION-DESIGN.md).

## Geliştirme ve doğrulama

Ana geliştirme ortamı Codex'tir. Önce [AGENTS.md](AGENTS.md) ve [proje kurallarını](docs/00_PROJECT_RULES.md) okuyun. `main` dalına doğrudan yazılmaz; mevcut NUT-018 çalışması `nut-018-ci-stabilization` ve taslak PR #1'de sürer.

CI Node 24 kullanır. Kurulum ve hızlı kapılar:

```sh
npm ci --ignore-scripts
npm test
node Today-AI-Engine/tests/run-tests.mjs
node tests/run-nut-017.9.cjs
node Today-AI-Engine/tests/run-benchmark.mjs
npm audit --audit-level=high
```

`npm test` platformun JSDOM/fake-indexeddb dahil birleşik kapısıdır. `npm run test:browser` mevcut JSDOM entegrasyonunu çalıştırır. Gerçek tarayıcı testi ayrıdır:

```sh
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

Playwright kendi yalnız-loopback test sunucusunu açar, her testte izole profil ve sentetik veri kullanır. Chromium ve iPhone görünümündeki Linux WebKit projeleri çalışır; bu fiziksel iPhone/Safari Ana Ekran PWA doğrulaması değildir. Sonuç kanıtı ve [cihaz kontrol planı](docs/NUT-018.3-VALIDATION.md) ayrı tutulur. Test sunucusu üretim/pilot dağıtım sunucusu değildir.

## Ürün sırası

[Yol haritası](docs/02_ROADMAP.md) ve [kabul fazları](docs/03_PHASES.md): teknik güven → kurucunun seçeceği günlük değer döngüsü → kontrollü gerçek kullanıcı PWA betası → pazar doğrulaması → App Store/Google Play hazırlığı. Önerilen işlevler teslim edilmiş özellik gibi sunulmaz.

Yerel tarayıcı verisi cihaz kaybı veya tarayıcı temizliğiyle kaybolabilir. PWA cache'i veri yedeği değildir; Core CSV tüm modüllerin tam yedeği değildir. Gerçek kullanıcı pilotundan önce yedek/geri yükleme kapsamı ve fiziksel cihaz akışları doğrulanmalıdır. Kullanıcı verisi/şema değişikliği, yeni model sağlayıcısı, dış aktarım ve mağaza gönderimi ayrı açık onay gerektirir.

Güncel teknik sonuçlar: [backlog](docs/10_TECHNICAL_BACKLOG.md), [changelog](docs/04_CHANGELOG.md) ve NUT-018.x raporları. Geçmiş test sayıları yeni çalıştırma yerine geçmez.

Ayarlar/AI içindeki bildirimler varsayılan kapalıdır. Destekleyen native kabukta ayrı saklama onayı ve OS izniyle, önceden hazırlanmış bir gözlem için aynı gün en fazla bir yerel bildirim planlanır. En çok 7 türetilmiş gözlem, 7 gün geçerlidir; süre dolanlar sonraki erişimde temizlenir. Yeni `today_ai_delivery_v1` anahtarı kullanıcı tarafından onaylandı; mevcut Core/Health depoları değişmez. Normal PWA'da telefon bildirimi/Web Push bağlı değildir. [NUT-019.3 uygulama durumu ve sınırlar](docs/NUT-019.3-IMPLEMENTATION.md).

Radio dalında **Today Radio** üzerinden Türkiye ve dünya istasyonları aranabilir. Radio Browser’a bağlantı, IP ve arama aktarımını açıklayan oturumluk izin ve yükle eylemi gerektirir; ilk açılış istek yapmaz. Ayrı yayıncı bağlantısı izni ve Dinle ile MP3/AAC veya cihazın native desteklediği HLS başlatılabilir; Durdur kaynağı kapatır. CORS izni olmayan yayınlar açılamaz. Mini-player ve dinleme geçmişi henüz yoktur. Fiziksel iPhone/Windows kabulü bekler. [Aşama kaydı](docs/TODAY-RADIO-IMPLEMENTATION.md).
