# Today AI Engine

Today AI Engine, Today App ile JSON veri sözleşmeleri üzerinden entegre olan, arayüzden ve App'in depolama katmanından bağımsız bir sistem katmanıdır.

`0.2.0-context`, mevcut `0.1.0-foundation` mimarisini değiştirmeden NUT-017.1 Today Context Builder ve Veri Kullanım Onayı sınırını ekler. Canlı model, gerçek kullanıcı verisi, dış servis işlemi ve otomasyon içermez.

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

- AI Engine sürümü: `0.2.0-context`
- Today App referans tabanı: NUT-016.6, App `2.9.0`, schema `2`, çevrimdışı kabuk `today-v2-foundation-058`
- Today App referans regresyonu: `822 PASS / 0 FAIL` (salt okunur paket raporu; burada yeniden çalıştırılmadı)
- AI Engine testi: `51 PASS / 0 FAIL` (`10` foundation + `41` NUT-017.1)
- Durum: NUT-017.1 Engine tarafı hazır; Today App olay adaptörleri ve UI entegrasyonu henüz yapılmadı

Bu nedenle herhangi bir Faz 1–6 tamamlanmış sayılmamaktadır.

## Yapı

- `docs/`: ürün, mimari, güvenlik, entegrasyon ve faz belgeleri
- `contracts/`: JSON Schema veri sözleşmeleri
- `src/`: saf onay değerlendiricisi ve deterministik Context Builder
- `fixtures/synthetic/`: yalnızca sentetik test kayıtları
- `tests/`: bağımlılıksız sözleşme ve güvenlik testleri
- `docs/APP_CONTRACT_MAPPING.md`: Today App 2.9.0 → AI Engine eşlemesi
- `docs/NUT-017.1-IMPLEMENTATION.md`: adım uygulama raporu

## Test

```bash
node tests/run-tests.mjs
```
