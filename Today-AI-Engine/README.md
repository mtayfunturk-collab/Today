# Today AI Engine

Today AI Engine, Today App ile JSON veri sözleşmeleri üzerinden entegre olan, arayüzden ve App'in depolama katmanından bağımsız bir sistem katmanıdır.

`0.5.0-receipt`, mevcut `0.1.0-foundation` mimarisini ve NUT-017.1–17.4 sınırlarını yeniden oluşturmadan onay, ret ve düzenleme kararlarından sürümlü, istek-süreli karar makbuzları üretir. Canlı/yerel model sağlayıcısı, dış servis işlemi, otomatik onay, kalıcı audit veya kalıcı AI belleği içermez.

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

- AI Engine karar makbuzu katmanı sürümü: `0.5.0-receipt`
- Today App entegrasyon tabanı: NUT-017.5, App `2.13.0`, schema `2`, çevrimdışı kabuk `today-v2-foundation-064`
- Today App referans regresyonu: `822 PASS / 0 FAIL` (salt okunur paket raporu; burada yeniden çalıştırılmadı)
- AI Engine testi: `145 PASS / 0 FAIL` (`10` foundation + `41` NUT-017.1 + `35` NUT-017.3.1 + `28` NUT-017.4 + `31` NUT-017.5)
- Today App NUT-017.5 kapısı: `63 PASS / 0 FAIL`
- Durum: İlk dar kural değişmedi. Kullanıcı kararı sürümlü bir makbuza dönüştürülür ve sade karar geçmişinde yalnız mevcut ekran isteği boyunca gösterilir. Düzenleme yeniden onay ister; hiçbir karar eylemi yürütmez veya kalıcı yazılmaz.

Bu nedenle herhangi bir Faz 1–6 tamamlanmış sayılmamaktadır.

## Yapı

- `docs/`: ürün, mimari, güvenlik, entegrasyon ve faz belgeleri
- `contracts/`: JSON Schema veri sözleşmeleri
- `src/`: saf onay değerlendiricisi, deterministik Context Builder, sağlayıcısız günlük destek analizörü, geçici karar işlemcisi ve istek-süreli karar makbuzu üreticisi
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

## Test

```bash
node tests/run-tests.mjs
```
