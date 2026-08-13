# Değişiklik Günlüğü

## 0.2.0-context — 2026-08-13

- Adım: NUT-017.1 — Today Context Builder ve Veri Kullanım Onayı.
- Önceki sürüm: `0.1.0-foundation`; policy guard, deterministic adapter, explanation builder, approval gateway, audit writer ve mevcut sentetik testler yeniden oluşturulmadı veya değiştirilmedi.
- Today App referansı: NUT-016.6 / `2.9.0` / schema `2` / `today-v2-foundation-058`; referans rapor `822 PASS / 0 FAIL`.
- Yapılan değişiklikler: amaç-bağlı cihaz-içi onay, ayrı Core/Health/Sky veri sınıfları, deterministik ve saf Context Builder, veri minimizasyonu, provenance, omission/redaction kayıtları ve sembolik Sky bölümü eklendi.
- Yeni sözleşmeler: `data-usage-consent`, `context-build-request` ve `context-package`, her biri `schemaVersion: 1`.
- Entegrasyon etkisi: Engine yalnız `input-event` zarfı alır; DOM, App depolama anahtarı, ağ veya Connect çağrısı bilmez. TB-018 dar onay nesnesi için kayıpsız gerekli görünüm sağlanır.
- Gizlilik: NUT-017.1 yalnız `device-only`, `request-scoped`, `externalRecipient: null` politikasını kabul eder. Ham doğum/observation verisi ve kesin konum alınmaz; serbest metin ayrıca onaylanır.
- Sky sınırı: Core–Sky anlık görüntüsü yalnız `interpretation=none`, `causalityClaim=false`, `aiProcessed=false` doğrulanırsa sembolik bölüme girer.
- Test sonucu: `51 PASS / 0 FAIL` (`10` foundation + `41` NUT-017.1).
- Migration gereksinimi: Yok; Today App verisi okunmadı, yazılmadı veya migrate edilmedi.
- Bilinen boşluk: Health Hub uyku/enerji/belirti/antrenman kayıtlarının formal sürümlü JSON Schema'sı yoktur; App adaptörü ortak olay zarfını üretmelidir.
- Sonraki adım: NUT-017.2 kapsamında Today App tarafında salt veri adaptörlerini ve bağlam önizleme/onay UI'sını eklemek.
- Commit mesajı: `feat(ai-engine): add consent-gated context builder (NUT-017.1)`

## 0.1.0-foundation — 2026-07-20

- Proje: Today AI Engine
- Faz: Faz 5 öncesi mimari hazırlık
- Yapılan değişiklikler: Ürün mimarisi, veri sözleşmeleri, güvenlik sınırları, Human-in-the-Loop akışı, açıklanabilir öneri formatı ve sentetik test seti oluşturuldu.
- Değiştirilen dosyalar: README, docs, contracts, fixtures ve tests altındaki başlangıç dosyaları.
- Veri şeması değişikliği: İlk sözleşmeler `schemaVersion: 1` ile tanımlandı.
- Migration gereksinimi: Yok; gerçek veya eski Today App verisi değiştirilmedi.
- Test senaryoları: Geçerli Core/Health girdisi, açıklanabilir çıktı, onay bekleyen işlem, kaynak ayrımı ve yasaklı kesin/teşhis dili.
- Test sonucu: Başarılı (yalnızca bağımsız sözleşme/politika kapsamı).
- Bilinen sorunlar: Today App deposu ve `v10-APP-003` bu çalışma alanında bulunmadığı için entegrasyon ve geriye uyumluluk doğrulanmadı.
- Sonraki adım: Today App deposunu salt okunur inceleyerek mevcut storage anahtarlarını ve veri modelini sözleşmelerle eşlemek.
- Commit mesajı: `docs(ai-engine): add foundation architecture contracts and synthetic tests`
