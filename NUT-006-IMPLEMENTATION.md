# Today App — NUT-006 Uygulama Kaydı

**İş paketi:** NUT-006 — Hızlı Öğün ve Sıvı Kayıt Akışı  
**Durum:** Tamamlandı; birleşik regresyon başarılı  
**Uygulama tabanı:** Today App `2.0.0`, Core veri şeması `2`, NUT-001 sözleşmesi `1`, NUT-002 depolama şeması `1`, NUT-003 hesaplama sürümü `nutrition-calc-v1`, NUT-004 profil API’si `1`, NUT-005 kütüphane API’si `1`  
**Kayıt API sürümü:** `1`  
**Kayıt kural seti:** `today:nutrition:entry:v1`  
**Çevrimdışı kabuk:** `today-v2-foundation-017`  
**Tarih:** 6 Ağustos 2026

## 1. Sonuç

NUT-006, gerçek öğün ve sıvı tüketimini NUT-001 sözleşmelerine uygun, yerel, çevrimdışı, atomik ve izlenebilir kayıtlar olarak oluşturan servis katmanını ekler.

Bu iş paketi:

- Gerçek öğünü yalnız açık kullanıcı işlemiyle `meal_entry` olarak kaydeder.
- Gerçek sıvı tüketimini öğünden ayrı `hydration_entry` nesnesi olarak kaydeder.
- `eventAt` ile `consumedAt` alanlarını birebir eşleştirir.
- Gelecekteki plan zamanının gerçek tüketim zamanı gibi kullanılmasını engeller.
- Kütüphane besini, tarif ve öğün şablonunu canlı referans olarak tüketim kaydına bağlamaz; her gerçek tüketim için yeni `meal_item_snapshot` kayıtları üretir.
- Şablon miktarını NUT-003 ile deterministik olarak ölçekler.
- Sade modda kalori veya makro girişi istemeden ayrıntısız ya da metin tabanlı hızlı öğün kaydına izin verir.
- Eksik veya bilinmeyen besin değerini `0` yapmaz; gerçek `0` değerini ayrı biçimde korur.
- Hızlı tekrar işleminde önceki olayı veya snapshot kimliğini yeniden kullanmaz; yeni ve izlenebilir tüketim olayı oluşturur.
- Aynı istemci işlem kimliğinin yinelenen dokunuşlarını tek kayda indirir.
- Planlanan öğünü yalnız ayrıca onaylanan işlemle gerçek tüketime bağlar ve plan–tüketim güncellemesini atomik yapar.
- AI’ın gerçek tüketimi kendiliğinden kaydetmesini engeller; yalnız kullanıcı tarafından istenen, doğrulanmamış taslak oluşturur.
- AI taslağını yalnız ikinci bir açık kullanıcı kabulüyle yeni manuel kayda dönüştürür; özgün taslak değişmeden kalır.

Health ekranına görünür öğün veya sıvı formu eklenmemiştir. Modül sayfa açılışında IndexedDB oluşturmaz ve veri yazmaz.

## 2. Mimari sınır

Çalışma zamanı API’si:

```text
window.TodayNutritionEntry
```

Bağımlılık yönü:

```text
NUT-001 veri sözleşmeleri
          ↓
NUT-003 birim ve besin hesaplama
          ↓
NUT-005 sürümlü besin / tarif / şablon kütüphanesi
          ↓
NUT-006 hızlı öğün ve sıvı kayıt kuralları
          ↓
NUT-002 doğrulamalı atomik depolama
```

NUT-006:

- Yalnız `meal_entry`, `hydration_entry`, yeni `meal_item_snapshot` ve açık plan tüketiminde güncellenen `planned_meal` kayıtlarını yazar.
- Bütün kalıcı kayıtları `TodayNutritionStorage` üzerinden `today_nutrition` IndexedDB deposuna yazar.
- Core’un `today_store_v2` veya legacy localStorage alanlarını okumaz ve yazmaz.
- DOM, ağ, gerçek AI sağlayıcısı veya Connect sağlayıcısı kullanmaz.
- Besin değerini kendisi üretmez; doğrulanmış kütüphane kaynağını NUT-003/NUT-005 üzerinden hesaplar.
- Mevcut besin, tarif, şablon, geçmiş öğün veya kaynak snapshot kayıtlarını değiştirmez.
- Kayıt silme API’si yayımlamaz.
- Yüklenirken kalıcı veri oluşturmaz.

## 3. Sürüm katmanları

| Katman | Sürüm | İşlev |
|---|---:|---|
| Today uygulaması | `2.0.0` | Genel uygulama sürümü |
| Today Core veri şeması | `2` | Mevcut Core kayıtları |
| Beslenme sözleşmesi | `1` | NUT-001 kayıt biçimleri |
| Beslenme depolama şeması | `1` | NUT-002 IndexedDB sınırı |
| Hesaplama sürümü | `nutrition-calc-v1` | NUT-003 deterministik sonuçları |
| Profil API’si | `1` | NUT-004 profil ve hedef sözleşmesi |
| Kütüphane API’si | `1` | NUT-005 sürümlü kaynak sözleşmesi |
| Kayıt API’si | `1` | NUT-006 hızlı tüketim servis sözleşmesi |
| Kayıt kural seti | `today:nutrition:entry:v1` | Gerçek tüketim, tekrar, plan ve taslak yaşam döngüsü |
| Çevrimdışı kabuk | `today-v2-foundation-017` | Kayıt servisini içeren 24 dosyalık kabuk |

NUT-006 yeni kayıt türü veya fiziksel IndexedDB store’u eklemez. NUT-001’deki `meal_entry`, `hydration_entry`, `meal_item_snapshot` ve `planned_meal` türlerini, NUT-002’deki ortak kayıt store’unu kullanır. Bu nedenle Today uygulama sürümü, Core şeması, beslenme sözleşmesi, depolama şeması ve IndexedDB fiziksel sürümü yükseltilmemiştir.

## 4. Kayıt uzantıları

Her hızlı tüketim kaydı şu ad alanlı uzantıyı taşır:

```text
today.nutrition.entry
```

| Alan | Anlamı |
|---|---|
| `rulesetId` | Kayıt kural seti kimliği |
| `entryKind` | `meal` veya `hydration` |
| `captureMode` | Hızlı, özel, kütüphane, şablon, tekrar, plan veya taslak kabul akışı |
| `userAction` | Gerçek tüketimin kullanıcı işlemiyle oluştuğunu gösterir |
| `clientOperationId` | Yinelenen dokunuşları tek olaya indiren istemci kimliği |
| `sourceEntryId` | Hızlı tekrarda kaynak gerçek tüketim kaydı |
| `sourceTemplateId` | Şablondan kayıt akışında kaynak şablon sürümü |
| `sourcePlannedMealId` | Açıkça tüketilen plan kaydı |
| `derivedFromDraftId` | Kabul edilen AI taslağı |
| `snapshotCount` | Öğüne ait yeni değişmez snapshot sayısı |

Yeni tüketim snapshotları ayrıca şu uzantıyı taşır:

```text
today.nutrition.entry-snapshot
```

Bu iz; kaynak snapshot, kaynak tüketim, kaynak şablon, kütüphane sürümü, hazırlama biçimi, besin sürümü, kısıt etiketleri ve taslak sahipliğini gerektiği yerde korur.

AI isteği ve açık kabul izleri ayrı ad alanlarında saklanır:

```text
today.nutrition.entry-ai-request
today.nutrition.entry-approval
```

## 5. Hızlı öğün akışı

`logMeal(input, confirmation)` dört düşük eforlu kayıt biçimini destekler:

1. Ayrıntısız öğün: yalnız `mealType`; kapsam otomatik olarak `unspecified`, bilgi durumu `unknown` olur.
2. Özel öğe: ad ve isteğe bağlı miktar/besin değeri; kalori veya makro zorunlu değildir.
3. Kütüphane öğesi: etkin ve doğrulanmış `food_version` veya `recipe_version` ile seçilen miktar.
4. Öğün şablonu: etkin ve doğrulanmış `meal_template`; isteğe bağlı pozitif şablon çarpanı.

Bu kaynaklar aynı hızlı öğünde birlikte de kullanılabilir. Her kaynak yeni snapshot üretir. Snapshotların tamamı ve `meal_entry` tek `saveRecords` işlemiyle yazılır; herhangi bir kaynak veya hesaplama geçersizse kısmi kayıt kalmaz.

Gerçek öğünde:

- `source.kind = manual`
- `recordStatus = active`
- `verificationStatus = user_confirmed`
- `eventAt = payload.consumedAt`
- `plannedMealId = null` olur; plan bağlantısı yalnız ayrı plan tüketim API’sinden kurulabilir.

## 6. Bilinmeyen değer ve sade kayıt

Sade kayıt tasarımında kullanıcının kalori veya makro bilmesi beklenmez.

- Ayrıntısız öğün `unknown` bilgi durumu taşır.
- Besin değeri girilmeyen özel öğenin `nutrients` alanı boş kalır; sistem otomatik sıfır üretmez.
- `unknown` ölçüm `value: null` olarak korunur.
- Bilinen gerçek `0`, `status: known` ile ayrı tutulur.
- Tahmini değer yalnız açıklanabilir `basis` ile saklanabilir.
- Gerçek özel öğe miktarı belirtilmezse düşük eforlu varsayılan `1 portion` kullanılır.

Bu kurallar kayıt eksikliğini tüketim yokluğu veya sıfır besin değeri gibi yorumlamaz.

## 7. Kütüphane ve şablon snapshotları

Kütüphane besini veya tarifi tüketilirken:

1. Kaynağın etkin, doğrulanmış ve AI taslağı olmadığı doğrulanır.
2. Seçilen miktar kaynak porsiyonuyla birim açısından doğrulanır.
3. Besin değeri `nutrition-calc-v1` ile hesaplanır.
4. Yeni `meal_item_snapshot` oluşturulur.
5. Kaynak kayıt kimliği, mantıksal kimlik, sürüm, hazırlama biçimi ve besin sürümü snapshot içinde korunur.

Öğün şablonu tüketilirken şablonun mevcut snapshot içeriği canlı kütüphane verisinden yeniden hesaplanmaz. Her şablon snapshotı yeni kimlikle kopyalanır ve istenen pozitif çarpanla deterministik olarak ölçeklenir. Daha sonra kütüphane veya şablon değişse bile geçmiş tüketim değişmez.

## 8. Sıvı kayıt akışı

`logHydration(input, confirmation)` öğünden ayrı `hydration_entry` oluşturur.

Kurallar:

- Gerçek sıvı miktarı `known`, sıfırdan büyük ve hacim boyutunda olmalıdır.
- `ml`, `cl`, `dl` ve `l` gibi NUT-003 hacim birimleri kabul edilir ve girilen birim korunur.
- Kütle birimi yoğunluk varsayımıyla hacme çevrilmez.
- `unknown`, sıfır veya negatif miktar gerçek tüketim olarak kaydedilmez.
- `beverageType` izlenebilir bir kimliktir; yaygın türlerle sınırlı değildir.
- `logWater(amount, confirmation)` su için düşük eforlu yardımcı API sağlar.
- Sıvı kaydı hiçbir zaman `meal_entry` içine gömülmez.

## 9. Tekrar ve çift dokunuş güvenliği

`repeatEntry(recordId, overrides, confirmation)` yalnız etkin gerçek tüketimi tekrarlar.

- Öğün tekrarı her eski snapshot için yeni snapshot kimliği üretir.
- Eski snapshot içeriği ve bilinmeyen değerler aynen korunur.
- Eski `plannedMealId` yeni tekrar kaydına taşınmaz.
- Sıvı tekrarı yeni olay kimliği oluşturur; kullanıcı miktar veya içecek türünü açıkça değiştirebilir.
- AI taslağı gerçek tüketim gibi tekrar edilemez.

İstemci `clientOperationId` verdiğinde aynı öğün veya sıvı dokunuşunun yinelenmesi yeni olay oluşturmaz; ilk kayıt döner. Aynı işlem kimliği farklı tüketim türleri arasında yeniden kullanılırsa güvenli hata oluşur.

## 10. Planlanan öğünün açık tüketimi

`logPlannedMeal(plannedMealId, overrides, confirmation)` planı kendiliğinden tüketmez.

İşlem için birlikte şu koşullar gerekir:

- `userInitiated: true`
- `userConfirmed: true`
- `confirmPlanConsumption: true`

Plan kaydı etkin, manuel/doğrulanmış, `status: planned` ve henüz bağlantısız olmalıdır. Başarılı işlemde:

1. Planın item snapshotları yeni tüketim snapshotlarına kopyalanır.
2. Ayrı `meal_entry` gerçek `consumedAt` zamanı ile oluşturulur.
3. `meal_entry.payload.plannedMealId` plan kimliğini taşır.
4. Plan aynı atomik işlemde `status: linked` ve `mealEntryId` ile güncellenir.
5. Planın `plannedFor` / `eventAt` alanı değişmez; gerçek tüketim zamanı yerine kullanılmaz.

Plan daha önce bağlandıysa, AI taslağıysa veya işlem zamanı planın son güncellemesinden eskiyse hiçbir kısmi tüketim kaydı oluşmaz.

## 11. AI taslak ve kabul kapısı

AI gerçek tüketim oluşturamaz. `saveMealDraft` ve `saveHydrationDraft` yalnız şu izinlerle çalışır:

- `userRequested: true`
- `userDataUseApproved: true`
- Sürümlü AI istek kimliği ve model/işlem sürümü

AI tüketim kaydı:

- `source.kind = ai_draft`
- `recordStatus = draft`
- `verificationStatus = unverified`
- `knowledgeStatus = estimated`
- `userEdited = false` olarak kalır.

Taslaklar varsayılan gerçek tüketim sorgusuna girmez. Bilinmeyen AI sıvı miktarı `null` olarak korunur.

`acceptDraft` için normal kullanıcı onayına ek olarak `acceptDraft: true` gerekir. Kabul:

- Taslağı değiştirmez veya etkinleştirmez.
- Yeni manuel ve kullanıcı doğrulanmış kayıt oluşturur.
- Öğün taslağında yeni snapshot kimlikleri üretir.
- Bilinmeyen sıvı miktarı varsa kullanıcıdan gerçek, pozitif hacim miktarı ister.
- Taslak zamanını varsayılan olarak tüketim zamanı yapmaz; kabul işlemi zamanı kullanılır.
- Yalnız açık `useDraftConsumedAt: true` seçimiyle taslaktaki geçmiş zaman kullanılabilir.
- Aynı taslağın ikinci kez kabul edilmesini engeller.

## 12. API

```text
window.TodayNutritionEntry
```

Başlıca işlevler:

- `getSnapshot()`
- `getEntry(recordId, options)`
- `listEntries(options)`
- `logMeal(input, confirmation)`
- `logHydration(input, confirmation)`
- `logWater(amount, confirmation)`
- `repeatEntry(recordId, overrides, confirmation)`
- `logPlannedMeal(plannedMealId, overrides, confirmation)`
- `saveMealDraft(input, consent)`
- `saveHydrationDraft(input, consent)`
- `listDrafts(options)`
- `acceptDraft(draftId, overrides, confirmation)`

API ve dönen kayıt/özet nesneleri dışarıdan değiştirilemeyecek biçimde dondurulur.

## 13. Çalışma zamanı ve çevrimdışı kabuk

Script sırası:

```text
nutrition-contracts.js
nutrition-calculations.js
nutrition-storage.js
nutrition-migrations.js
nutrition-profile.js
nutrition-library.js
nutrition-entry.js
router.js
```

`nutrition-entry.js`, Router’dan önce yüklenir. Service Worker kabuğu `today-v2-foundation-017` olarak 24 dosyaya yükseltilmiştir.

Modül yüklenmesi:

- IndexedDB açmaz,
- tüketim kaydı oluşturmaz,
- görünür Health ekranını değiştirmez,
- Core/Health/Sky yönlendirmesine müdahale etmez.

## 14. Test ve kabul matrisi

NUT-006 için 90 pozitif, negatif, atomiklik, geçmiş koruma, taslak/onay ve entegrasyon testi eklenmiştir.

Başlıca doğrulananlar:

- Açık kullanıcı onayı olmadan gerçek tüketim oluşmaması
- `eventAt = consumedAt`
- Gelecek plan zamanının tüketim zamanı olmaması
- Ayrıntısız ve özel öğünde bilinmeyen değerlerin sıfıra dönüşmemesi
- Kütüphane ve şablon kaynaklarından yeni snapshot oluşması
- Şablon ölçekleme ve kaynak snapshot değişmezliği
- Sıvının ayrı nesne, pozitif ve hacim boyutunda kalması
- Çift dokunuş idempotency davranışı
- Hızlı tekrarda yeni olay ve yeni snapshot oluşturulması
- Plan tüketiminin ayrıca onaylı ve atomik olması
- AI taslağının gerçek kayıttan ayrılması
- Taslak kabulünde yeni manuel kayıt ve özgün taslak değişmezliği
- Core/Health/Sky görünür akışında regresyon olmaması
- Çevrimdışı kabukta yeni modülün bulunması

Kabul sonuçları:

- NUT-006 özel testleri: **90/90 başarılı**
- Önceki birleşik platform testleri: **683/683 başarılı**
- Birleşik platform kapısı: **773/773 başarılı**
- Statik regresyon: **30/30 başarılı**
- Service Worker olay regresyonu: **36/36 başarılı**
- Gerçek tarayıcı regresyonu: **32/32 başarılı**

## 15. Dosyalar

| Dosya | Durum | İşlev |
|---|---|---|
| `modules/nutrition-entry.js` | Yeni | Hızlı öğün, sıvı, tekrar, plan ve AI taslak kayıt servisi |
| `tests/nutrition-entry.test.cjs` | Yeni | 90 pozitif, negatif ve entegrasyon testi |
| `index.html` | Değişti | Kayıt servisinin Router öncesi çalışma zamanı sırası |
| `sw.js` | Değişti | Foundation-017 çevrimdışı kabuk |
| `tests/run-platform-regression.cjs` | Değişti | NUT-006 grubunun birleşik kapıya eklenmesi |
| `tests/automation-contract.test.cjs` | Değişti | 19 grup ve 773 test kabulü |
| `tests/static-regression.test.cjs` | Değişti | Yeni modül, script sırası ve kabuk parmak izleri |
| `tests/sw-event-regression.cjs` | Değişti | Foundation-017 ve 24 dosyalık kabuk testi |
| `tests/platform-browser-regression.test.cjs` | Değişti | Gerçek tarayıcıda kayıt API yükleme doğrulaması |
| `docs/NUT-006-IMPLEMENTATION.md` | Yeni | Uygulama, kabul ve devir kaydı |

`package.json`, `package-lock.json`, NUT-001 sözleşmesi, NUT-002 depolama/migration modülleri, NUT-003 hesaplama motoru, NUT-004 profil servisi ve NUT-005 kütüphane servisi değişmemiştir.

## 16. NUT-006 dışında kalanlar

- Health içinde görünür öğün veya sıvı giriş formu
- Kalori ve makro gösterge ekranı
- Öğün planı oluşturma ve takvimleme
- Toplu hazırlık, kalan porsiyon ve ev stoku yönetimi
- Alışveriş listesi
- Barkod, kamera veya uzak besin veritabanı bağlantısı
- HealthKit veya Health Connect
- Bulut senkronizasyonu
- AI’ın tüketimi kendiliğinden kaydetmesi
- Tanı, tedavi veya takviye önerisi

## 17. NUT-007 devir koşulları

Sıradaki mantıksal iş paketi **NUT-007 — Öğün Planı ve Planlanan Öğün Akışı** olacaktır.

NUT-007 şu sınırları korumalıdır:

1. `meal_plan` ve `planned_meal` kayıtları gerçek tüketim değildir.
2. Plan zamanı `plannedFor` / `eventAt` alanında tutulur; `consumedAt` taşımaz.
3. Plan öğeleri sürümlü kütüphane kaynaklarından yeni ve değişmez snapshotlara dönüştürülür.
4. Plan değişikliği geçmiş gerçek tüketim kayıtlarını veya snapshotlarını değiştirmez.
5. AI yalnız kullanıcı tarafından istenen plan taslağı hazırlayabilir; taslak onaysız etkin plan olamaz.
6. Planlanan öğün kendiliğinden tüketilmiş sayılmaz; gerçek tüketim yalnız NUT-006 `logPlannedMeal` açık onay kapısından geçer.
7. Plan, planlanan öğün ve snapshot yazımları atomik ve çevrimdışı olmalıdır.
8. Core verisi ile mevcut Core/Health/Sky yönlendirmesi korunmalıdır.
9. Görünür Health plan ekranı ayrı bir arayüz kararı verilmeden açılmamalıdır.

Sonuç: **NUT-006 tamamlandı. NUT-007 için teknik başlangıç koşulları sağlandı.**
