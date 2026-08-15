# Today AI Engine

Today AI Engine, Today App ile JSON veri sözleşmeleri üzerinden entegre olan, arayüzden ve App'in depolama katmanından bağımsız bir sistem katmanıdır.

`0.8.0-evaluation`, mevcut `0.1.0-foundation` mimarisini ve NUT-017.1–17.7 çalışma sınırlarını yeniden oluşturmadan günlük analiz, yedi günlük örüntü ve kullanıcı geri bildirimi davranışlarını sentetik vakalarla değerlendirir. Bu katman yalnız geliştirme kalite kapısıdır; kullanıcı ekranına çıkmaz, gerçek kullanıcı verisi kullanmaz ve geçiş oranını AI doğruluğu olarak sunmaz. Canlı/yerel model sağlayıcısı, dış servis işlemi, otomatik onay, kalıcı audit veya kalıcı AI belleği içermez.

## İlkeler

- Sadece fark et.
- Varsayılan olarak yerel ve veri-minimum çalışma.
- AI önerir; kullanıcı karar verir; Connect ancak açık onaydan sonra uygular.
- Kanıt, güven düzeyi ve belirsizlik görünürdür.
- Sağlık teşhisi ve kesin astrolojik hüküm üretilmez.
- AI Engine Today App DOM'una, CSS sınıflarına veya storage anahtarlarına bağlanmaz.
- Core, Health ve Sky izinleri amaç-bağlı ve ayrı veri sınıflarıyla verilir.
- Sky yalnız `symbolic-context-only` bölümünde kalır; sağlık veya duygu kanıtı değildir.

## Durum

- AI Engine değerlendirme katmanı sürümü: `0.8.0-evaluation`
- Today App çalışma tabanı değişmedi: NUT-017.7, App `2.15.0`, schema `2`, çevrimdışı kabuk `today-v2-foundation-066`
- Today App referans regresyonu: `822 PASS / 0 FAIL` (salt okunur paket raporu; burada yeniden çalıştırılmadı)
- AI Engine testi: `299 PASS / 0 FAIL` (`232` mevcut + `67` NUT-017.8)
- NUT-017.8 sentetik benchmark: `12/12` vaka, `0` güvenlik ihlali
- Today App NUT-017.8 entegrasyon kapısı: `93 PASS / 0 FAIL`
- Durum: İlk günlük öneri, yedi günlük gözlem ve üç geri bildirim seçeneği değişmedi. Yeni kalite kapısı eşleşme, sonuç üretmeme, reddetme, açıklanabilirlik ve Sky ayrımı beklentilerini yalnız sentetik olaylarla doğrular. Model öğrenmesi, kalıcı hafıza, eylem ve dış aktarım kapalıdır.

Bu nedenle herhangi bir Faz 1–6 tamamlanmış sayılmamaktadır.

## Yapı

- `docs/`: ürün, mimari, güvenlik, entegrasyon ve faz belgeleri
- `contracts/`: JSON Schema veri sözleşmeleri
- `src/`: saf onay değerlendiricisi, deterministik Context Builder, sağlayıcısız günlük destek analizörü, geçici karar işlemcisi, istek-süreli karar makbuzu üreticisi, çok günlük örüntü gözlemcisi, istek-süreli örüntü geri bildirimi işlemcisi ve sentetik benchmark değerlendiricisi
- `fixtures/synthetic/`: yalnızca sentetik test kayıtları
- `tests/`: bağımlılıksız sözleşme ve güvenlik testleri
- `docs/APP_CONTRACT_MAPPING.md`: NUT-017.1 için salt okunur Today App 2.9.0 referans eşlemesi
- `docs/NUT-017.1-IMPLEMENTATION.md`: adım uygulama raporu
- `../docs/NUT-017.2-IMPLEMENTATION.md`: Today App host entegrasyonu ve doğrulama raporu
- `../docs/NUT-017.3-IMPLEMENTATION.md`: açıklanabilir analiz host entegrasyonu ve doğrulama raporu
- `../docs/NUT-017.3.1-IMPLEMENTATION.md`: eşleşmeme tanısı hata düzeltmesi ve doğrulama raporu
- `../docs/NUT-017.3.2-IMPLEMENTATION.md`: Health bağlamında en yeni kayıtların korunması düzeltmesi
- `../docs/NUT-017.4-IMPLEMENTATION.md`: sade öneri ve onay/ret/düzenleme akışı
- `../docs/NUT-017.5-IMPLEMENTATION.md`: sürümlü, geçici karar makbuzu ve sade karar geçmişi
- `../docs/NUT-017.6-IMPLEMENTATION.md`: son 7 günlük, açıklanabilir ve nedenselliksiz Core–uyku tekrar gözlemi
- `../docs/NUT-017.7-IMPLEMENTATION.md`: örüntü gözlemi için sade, cihaz-içi ve kalıcı olmayan kullanıcı geri bildirimi
- `../docs/NUT-017.8-IMPLEMENTATION.md`: gerçek kullanıcı verisi kullanmayan sentetik benchmark ve güvenlik kapısı

## Test

```bash
node tests/run-tests.mjs
node tests/run-benchmark.mjs
```
