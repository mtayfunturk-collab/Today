# Today AI Engine

Today AI Engine, Today App ile JSON veri sözleşmeleri üzerinden entegre olan, arayüzden ve App'in depolama katmanından bağımsız bir sistem katmanıdır.

`0.9.0-rules`, mevcut `0.1.0-foundation` mimarisini ve NUT-017.1–17.8 çalışma sınırlarını yeniden oluşturmadan günlük destek analizini iki dar, açıklanabilir kurala genişletir. İlk kısa-uyku kuralı aynen ve öncelikli kalır; ikinci kural yalnız aynı gün “Zordu bugün”, düşük enerji ve fazla yorgunluk birlikteyse ihtiyatlı bir mola seçeneği üretir. Canlı/yerel model sağlayıcısı, dış servis işlemi, otomatik onay, kalıcı audit veya kalıcı AI belleği içermez.

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

- AI Engine günlük kural kataloğu: `0.9.0-rules`; değerlendirme katmanı: `0.9.0-evaluation`
- Today App çalışma tabanı: NUT-017.9, App `2.16.0`, schema `2`, çevrimdışı kabuk `today-v2-foundation-067`
- Today App referans regresyonu: `822 PASS / 0 FAIL` (salt okunur paket raporu; burada yeniden çalıştırılmadı)
- AI Engine testi: `335 PASS / 0 FAIL`
- NUT-017.9 birleşik sentetik benchmark: `16/16` vaka, `0` güvenlik ihlali
- Today App NUT-017.9 entegrasyon kapısı: `96 PASS / 0 FAIL`
- İlgili mevcut App grupları: `142 PASS / 0 FAIL`
- Durum: Günlük öneri iki kontrollü kurala sahiptir. Eşleşme yoksa öneri uydurulmaz; kullanıcı yalnız sade bir açıklama görür. Yedi günlük örüntü hâlâ yalnız Core–kısa uyku tekrarını inceler. Sky, model öğrenmesi, kalıcı hafıza, gerçek eylem ve dış aktarım kapalıdır.

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
- `../docs/NUT-017.9-IMPLEMENTATION.md`: öncelikli iki kurallı günlük destek kataloğu ve sade kullanıcı yüzeyi

## Test

```bash
node tests/run-tests.mjs
node tests/run-benchmark.mjs
```
