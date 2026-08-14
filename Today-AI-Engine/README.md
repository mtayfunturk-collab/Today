# Today AI Engine

Today AI Engine, Today App ile JSON veri sözleşmeleri üzerinden entegre olan, arayüzden ve App'in depolama katmanından bağımsız bir sistem katmanıdır.

`0.7.0-feedback`, mevcut `0.1.0-foundation` mimarisini ve NUT-017.1–17.6 sınırlarını yeniden oluşturmadan kullanıcının yedi günlük örüntü gözlemine verdiği geri bildirimi doğrular. Geri bildirim gözlemi değiştirmez, modeli eğitmez ve yalnız mevcut istek boyunca tutulur. Canlı/yerel model sağlayıcısı, dış servis işlemi, otomatik onay, kalıcı audit veya kalıcı AI belleği içermez.

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

- AI Engine geri bildirim katmanı sürümü: `0.7.0-feedback`
- Today App entegrasyon tabanı: NUT-017.7, App `2.15.0`, schema `2`, çevrimdışı kabuk `today-v2-foundation-066`
- Today App referans regresyonu: `822 PASS / 0 FAIL` (salt okunur paket raporu; burada yeniden çalıştırılmadı)
- AI Engine testi: `232 PASS / 0 FAIL` (`10` foundation + `41` NUT-017.1 + `35` NUT-017.3.1 + `28` NUT-017.4 + `31` NUT-017.5 + `40` NUT-017.6 + `47` NUT-017.7)
- Today App NUT-017.7 kapısı: `83 PASS / 0 FAIL`
- Durum: İlk günlük öneri ve yedi günlük gözlem kuralları değişmedi. Başarılı gözlemden sonra kullanıcı “Bana uyuyor”, “Bana uymuyor” veya “Emin değilim” seçebilir. Seçim gözlem, güven veya dayanakları değiştirmez; Sky, nedensellik, model öğrenmesi, kalıcı hafıza ve eylem kapalıdır.

Bu nedenle herhangi bir Faz 1–6 tamamlanmış sayılmamaktadır.

## Yapı

- `docs/`: ürün, mimari, güvenlik, entegrasyon ve faz belgeleri
- `contracts/`: JSON Schema veri sözleşmeleri
- `src/`: saf onay değerlendiricisi, deterministik Context Builder, sağlayıcısız günlük destek analizörü, geçici karar işlemcisi, istek-süreli karar makbuzu üreticisi, çok günlük örüntü gözlemcisi ve istek-süreli örüntü geri bildirimi işlemcisi
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

## Test

```bash
node tests/run-tests.mjs
```
