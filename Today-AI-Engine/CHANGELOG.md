# Değişiklik Günlüğü

## 0.5.0-receipt — NUT-017.5 — 2026-08-14

- Onay, ret ve düzenleme sonucunu `decision-receipt` v1 sözleşmesine dönüştüren saf ve deterministik makbuz üreticisi eklendi.
- Makbuz karar, analiz ve işlem taslağı kimliklerini iç sözleşmede bağlar; kullanıcı yüzeyinde bu teknik kimlikler gösterilmez.
- Her makbuz `device-only`, `request-scoped` ve `persistent=false` sınırını; işlem, Connect, kalıcı audit ve dış aktarım yapılmadığını açıkça taşır.
- Today App'e yalnız ekran açıkken yaşayan, sade ve kapalı başlayan “Karar geçmişi” eklendi. Yeni önizleme veya temizleme bu geçmişi sıfırlar.
- Düzenleme makbuzu yeni taslağın yeniden onay beklediğini gösterir; düzenlemeyi veya önceki onayı gerçek işlem saymaz.
- Host: Today App `2.13.0`, schema `2`, çevrimdışı kabuk `today-v2-foundation-064`.
- Test sonucu: AI Engine `145/145`; NUT-017.5 App kapısı `63/63`; ilgili mevcut App grupları `142/142` başarılı.
- Önceden belgelenen platform tabanı değişmedi: static `25/30`, Service Worker event `23/36`, browser `47/48`; automation contract'ta beklenen workflow dosyası eksik.
- Migration gereksinimi: Yok; yeni storage anahtarı veya ana veri biçimi eklenmedi.
- Commit mesajı: `feat(ai): add request-scoped decision receipts (NUT-017.5)`

## 0.4.0-approval — NUT-017.4 — 2026-08-14

- Mevcut `approval-decision` v1 sözleşmesini kullanan saf ve deterministik karar işlemcisi eklendi.
- Onay ve ret yalnız istek-süreli karar üretir; eylem yürütmez, Connect çağırmaz veya kalıcı audit yazmaz.
- Düzenleme yalnız hatırlatma saatini kabul eder, yeni `pending-user-approval` taslağı üretir ve yeniden açık onay ister.
- Today App öneri kartı sadeleştirildi; ham olay kimlikleri, NUT/kural kodları ve filtre gerekçe kodları kullanıcı yüzeyinden kaldırıldı.
- Dayanak, güven, belirsizlik, seçenekler ve onay durumu iç sözleşmede korunurken kullanıcıya anlaşılır başlıklarla gösterildi.
- Sky önerinin dayanağı, güven girdisi veya sağlık/duygu nedeni olmadan sembolik sınırda kaldı.
- Host: Today App `2.12.0`, schema `2`, çevrimdışı kabuk `today-v2-foundation-063`.
- Test sonucu: AI Engine `114/114`; NUT-017.4 App kapısı `61/61`; ilgili mevcut App grupları `142/142` başarılı.
- Migration gereksinimi: Yok; yeni storage anahtarı veya ana veri biçimi eklenmedi.
- Commit mesajı: `feat(ai): add request-scoped suggestion decisions (NUT-017.4)`

## Host düzeltmesi — NUT-017.3.2 — 2026-08-14

- AI Engine kodu ve sözleşmeleri `0.3.1-analysis` olarak değişmeden kaldı.
- Today App kaynak adaptörünün sınırlandırılmış Health olaylarında en eski kayıtları tutması düzeltildi; artık en yeni deterministik alt küme korunur ve çıktı kronolojik sıraya geri getirilir.
- Bugün kaydedilen uyku olayının yoğun eski Health bağlamı altında düşmediğini doğrulayan regresyon eklendi.
- Host: Today App `2.11.2`, schema `2`, çevrimdışı kabuk `today-v2-foundation-062`.
- Test sonucu: AI Engine `86/86`; NUT-017.3.2 App kapısı `50/50`; ilgili mevcut App grupları `142/142` başarılı. Platform browser tabanı, önceden belgelenen tek hata ile `47/48` kaldı.
- Migration gereksinimi: Yok; kayıt biçimi ve depolama anahtarları değiştirilmedi.
- Commit mesajı: `fix(ai): retain latest health context records (NUT-017.3.2)`

## 0.3.1-analysis — NUT-017.3.1 — 2026-08-14

- Sorun: `no-matching-rule` yalnız genel hata kodu döndürdüğü için gerçek App verisinde hangi Core, uyku veya tarih koşulunun geçmediği görülemiyordu.
- Düzeltme: Engine, yalnız geçerli ve onaylı Context Package üzerinde en güncel Core/uyku gözlemlerini, sabit koşulları, üç denetim sonucunu ve makine-okunur gerekçeleri içeren derin dondurulmuş `ruleEvaluation` tanısı döndürür.
- Güvenlik: Geçersiz analiz isteğine tanı eklenmez; doğrulanmamış bağlam alanı sızdırılmaz. Sky tanıya, dayanağa veya güven hesabına katılmaz.
- Kural: `Core=C`, uyku `<360 dakika` ve aynı yerel tarih koşulları değiştirilmedi veya gevşetilmedi.
- Host: Today App `2.11.1`, schema `2`, çevrimdışı kabuk `today-v2-foundation-061`.
- Test sonucu: AI Engine `86/86`; NUT-017.3.1 App kapısı `49/49` başarılı.
- Migration gereksinimi: Yok; Today App ana verisi ve depolama anahtarları değiştirilmedi.
- Commit mesajı: `fix(ai): expose deterministic rule mismatch diagnostics (NUT-017.3.1)`

## 0.3.0-analysis — NUT-017.3 — 2026-08-14

- Adım: Sağlayıcısız, cihaz-içi açıklanabilir analiz isteği ve sonuç önizlemesi.
- Önceki sınırlar: `0.1.0-foundation` mimarisi ile NUT-017.1 Context Builder/onay modülleri korundu; policy guard, deterministic adapter, explanation builder, approval gateway, audit writer ve eski sentetik testler yeniden oluşturulmadı.
- Yeni sözleşme: `analysis-request.schema.json` v1; yalnız `daily-support-suggestion` capability'si ve `context-package` v1 kabul edilir.
- Mevcut çıktı: `analysis-output.schema.json` v1 değiştirilmeden dayanak, güven, belirsizlik, alternatifler ve onay durumu üretir.
- İlk kural: Aynı yerel gündeki en güncel Core `C` kaydı ile 6 saatin altındaki en güncel uyku kaydı birlikteyse ihtiyatlı hafif-plan/uyku hazırlığı seçeneği sunulur; eşleşme yoksa çıktı uydurulmaz.
- Sky sınırı: Sembolik Sky pakette bulunabilir fakat evidence, confidence veya sağlık/duygu yorumuna hiçbir etkisi yoktur.
- İşlem sınırı: Hatırlatıcı yalnız `pending-user-approval` taslağıdır; approval gateway, audit writer ve Connect çağrılmaz.
- Host: Today App `2.11.0`, schema `2`, çevrimdışı kabuk `today-v2-foundation-060`.
- Test sonucu: AI Engine `80/80`; NUT-017.3 App kapısı `48/48` başarılı.
- Migration gereksinimi: Yok; Today App ana verisi veya depolama anahtarları değiştirilmedi.
- Commit mesajı: `feat(ai): add deterministic explainable analysis preview (NUT-017.3)`

## Today App host entegrasyonu — NUT-017.2 — 2026-08-13

- AI Engine sürümü ve NUT-017.1 sözleşmeleri `0.2.0-context` olarak korundu.
- Today App `2.10.0` içinde public Core/Health/Nutrition/Core–Sky API'lerini kullanan salt okunur olay adaptörleri eklendi.
- App Ayarlar yüzeyine kaydedilmeyen, tek önizleme isteğine bağlı veri kapsamı/onayı eklendi.
- App köprüsü yalnız `buildTodayContext` ve veri kullanım onayı değerlendiricisini çağırır; AI sağlayıcısı veya Connect çağrısı yapmaz.
- Sky varsayılan kapalıdır ve yalnız `symbolic-context-only` bölümüne girebilir; nedensellik kapalıdır.
- Test sonucu: App NUT-017.2 `35/35`; AI Engine `51/51` başarılı.
- Today App schema `2` olarak kaldı; migration yoktur.
- Sonraki adım canlı model entegrasyonu değildir; açıklanabilir analiz isteği/çıktısı için ayrı NUT kapsamı ve açık kullanıcı kararı gerekir.

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
