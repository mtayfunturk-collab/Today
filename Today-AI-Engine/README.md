# Today AI Engine

Today AI Engine, Today App ile JSON veri sözleşmeleri üzerinden entegre olan, arayüzden ve App'in depolama katmanından bağımsız bir sistem katmanıdır.

`0.3.0-analysis`, mevcut `0.1.0-foundation` mimarisini ve NUT-017.1 Context Builder sınırını yeniden oluşturmadan NUT-017.3 cihaz-içi açıklanabilir analiz adımını ekler. Canlı/yerel model sağlayıcısı, dış servis işlemi, otomatik onay veya kalıcı AI belleği içermez.

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

- AI Engine sürümü: `0.3.0-analysis`
- Today App entegrasyon tabanı: NUT-017.3, App `2.11.0`, schema `2`, çevrimdışı kabuk `today-v2-foundation-060`
- Today App referans regresyonu: `822 PASS / 0 FAIL` (salt okunur paket raporu; burada yeniden çalıştırılmadı)
- AI Engine testi: `80 PASS / 0 FAIL` (`10` foundation + `41` NUT-017.1 + `29` NUT-017.3)
- Durum: NUT-017.1 sınırı ve NUT-017.2 kaynak adaptörleri korunuyor; NUT-017.3 yalnız kullanıcı komutuyla ilk dar deterministik öneriyi üretiyor

Bu nedenle herhangi bir Faz 1–6 tamamlanmış sayılmamaktadır.

## Yapı

- `docs/`: ürün, mimari, güvenlik, entegrasyon ve faz belgeleri
- `contracts/`: JSON Schema veri sözleşmeleri
- `src/`: saf onay değerlendiricisi, deterministik Context Builder ve sağlayıcısız günlük destek analizörü
- `fixtures/synthetic/`: yalnızca sentetik test kayıtları
- `tests/`: bağımlılıksız sözleşme ve güvenlik testleri
- `docs/APP_CONTRACT_MAPPING.md`: NUT-017.1 için salt okunur Today App 2.9.0 referans eşlemesi
- `docs/NUT-017.1-IMPLEMENTATION.md`: adım uygulama raporu
- `../docs/NUT-017.2-IMPLEMENTATION.md`: Today App host entegrasyonu ve doğrulama raporu
- `../docs/NUT-017.3-IMPLEMENTATION.md`: açıklanabilir analiz host entegrasyonu ve doğrulama raporu

## Test

```bash
node tests/run-tests.mjs
```
