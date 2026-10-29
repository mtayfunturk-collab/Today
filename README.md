# Today

Core, Health ve Sky kayıtlarını kullanıcının izin verdiği kapsamda AI Engine ile anlamlandırmayı hedefleyen, cihaz içi veriye ve kullanıcı kararına öncelik veren günlük yaşam uygulaması. Önceki beslenme/hareket odak seçimi geri çekildi; kullanıcının yeni talebi günlük, 7/30/90 günlük AI gözlemleri ve sonrasında izinli saat/bildirim bağlantılarıdır. Core günlük farkındalığı, Health yerel kayıt/planlamayı, isteğe bağlı Sky sembolik düşünme alanını sağlar. AI Engine bugün sağlayıcısız günlük kurallar ve çok dönemli betimleyici gözlemlerle çalışır; genel sohbet veya otomatik dış işlem yapmaz.

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
