# Today App — NUT-007 Uygulama Kaydı

**İş paketi:** NUT-007 — Öğün Planı ve Planlanan Öğün Akışı  
**Durum:** Tamamlandı; birleşik regresyon başarılı  
**Uygulama tabanı:** Today App 2.0.0, Core veri şeması 2, NUT-001 sözleşmesi 1, NUT-002 depolama şeması 1, NUT-003 hesaplama sürümü nutrition-calc-v1, NUT-004 profil API’si 1, NUT-005 kütüphane API’si 1, NUT-006 kayıt API’si 1  
**Planlama API sürümü:** 1  
**Planlama kural seti:** today:nutrition:planning:v1  
**Çevrimdışı kabuk:** today-v2-foundation-018  
**Tarih:** 6 Ağustos 2026

## 1. Sonuç

NUT-007, öğün planlarını ve planlanan öğünlerin yaşam döngüsünü NUT-001 sözleşmelerine uygun, yerel, çevrimdışı, atomik ve izlenebilir kayıtlar olarak yöneten servis katmanını ekler.

Bu iş paketi:

- Bir meal_plan kaydını bağlı planned_meal kayıtları ve yeni meal_item_snapshot kayıtlarıyla aynı atomik işlemde oluşturur.
- Plan tarih aralığını, başlığı ve saat dilimini plan kaydında izler.
- Planlanan zamanı plannedFor ve eventAt alanlarında tutar; consumedAt üretmez.
- Plan öğelerini doğrulanmış besin, tarif ve öğün şablonu sürümlerinden yeni değişmez snapshotlara dönüştürür.
- Özel plan öğelerinde kalori veya makro zorunlu tutmaz.
- Bilinmeyen besin veya miktar değerini sıfıra dönüştürmez.
- Kütüphane ve şablon hesaplarını nutrition-calc-v1 üzerinden deterministik yapar.
- Profil kısıtlarını engelleyici otomasyon olarak değil, blocking: false açıklanabilir uyarı olarak saklar.
- Planlanan öğün ekleme, yeniden zamanlama, ikame, atlama ve iptal işlemlerini iyimser eşzamanlılık denetimiyle yürütür.
- İkame edilen öğünü silmez; cancelled durumuyla geçmişte bırakır ve yeni öğünü ayrı kimlikle oluşturur.
- Planı ancak bütün öğünler linked, skipped veya cancelled olduğunda tamamlar.
- Tamamlanan planı silmeden archived durumuna taşır.
- AI’ın yalnız açık kullanıcı isteğiyle draft ve unverified plan taslağı hazırlamasına izin verir.
- AI taslağını yalnız ikinci açık kullanıcı onayıyla yeni manuel plana dönüştürür; özgün taslağı değiştirmez.
- Planlanan öğünü kendiliğinden tüketilmiş saymaz.
- Gerçek tüketimi yalnız NUT-006 logPlannedMeal açık onay kapısına devreder.

Health ekranına görünür plan takvimi veya plan düzenleme formu eklenmemiştir. Modül sayfa açılışında IndexedDB oluşturmaz ve veri yazmaz.

## 2. Mimari sınır

Çalışma zamanı API’si:

    window.TodayNutritionPlanning

Bağımlılık yönü:

    NUT-001 veri sözleşmeleri
              ↓
    NUT-003 birim ve besin hesaplama
              ↓
    NUT-004 profil ve kısıt bağlamı
              ↓
    NUT-005 sürümlü besin / tarif / şablon kütüphanesi
              ↓
    NUT-007 öğün planlama kuralları
              ↓
    NUT-002 doğrulamalı atomik depolama

Gerçek tüketim yönü:

    NUT-007 açık tüketim isteği
              ↓
    NUT-006 logPlannedMeal onay kapısı
              ↓
    meal_entry + yeni tüketim snapshotları + linked planned_meal

NUT-007:

- Yalnız meal_plan, planned_meal ve yeni meal_item_snapshot kayıtlarını doğrudan yazar.
- Gerçek meal_entry kaydını doğrudan üretmez.
- Bütün kalıcı kayıtları TodayNutritionStorage üzerinden today_nutrition IndexedDB deposuna yazar.
- Yeni fiziksel IndexedDB store’u veya kayıt türü eklemez.
- Core’un today_store_v2 veya legacy localStorage alanlarını okumaz ve yazmaz.
- DOM, ağ, gerçek AI sağlayıcısı veya Connect sağlayıcısı kullanmaz.
- Mevcut besin, tarif, şablon, geçmiş tüketim veya eski snapshot kayıtlarını değiştirmez.
- Kalıcı kayıt silme API’si yayımlamaz.
- Yüklenirken kalıcı veri oluşturmaz.

## 3. Sürüm katmanları

| Katman | Sürüm | İşlev |
|---|---:|---|
| Today uygulaması | 2.0.0 | Genel uygulama sürümü |
| Today Core veri şeması | 2 | Mevcut Core kayıtları |
| Beslenme sözleşmesi | 1 | NUT-001 kayıt biçimleri |
| Beslenme depolama şeması | 1 | NUT-002 IndexedDB sınırı |
| Hesaplama sürümü | nutrition-calc-v1 | NUT-003 deterministik sonuçları |
| Profil API’si | 1 | NUT-004 profil ve kısıt sözleşmesi |
| Kütüphane API’si | 1 | NUT-005 sürümlü kaynak sözleşmesi |
| Kayıt API’si | 1 | NUT-006 gerçek tüketim kapısı |
| Planlama API’si | 1 | NUT-007 plan ve planlanan öğün servisi |
| Planlama kural seti | today:nutrition:planning:v1 | Plan, takvim, ikame ve taslak yaşam döngüsü |
| Çevrimdışı kabuk | today-v2-foundation-018 | Planlama servisini içeren 25 dosyalık kabuk |

NUT-007 yeni kayıt türü veya fiziksel IndexedDB store’u eklemez. NUT-001’deki meal_plan, planned_meal ve meal_item_snapshot türlerini, NUT-002’deki ortak kayıt store’unu kullanır. Bu nedenle Today uygulama sürümü, Core şeması, beslenme sözleşmesi, depolama şeması ve IndexedDB fiziksel sürümü yükseltilmemiştir.

## 4. Planlama uzantıları

Plan ve planlanan öğün kayıtları şu ad alanlı uzantıyı taşır:

    today.nutrition.planning

Meal plan uzantısındaki başlıca alanlar:

| Alan | Anlamı |
|---|---|
| rulesetId | Planlama kural seti kimliği |
| entityKind | meal_plan |
| title | İsteğe bağlı kullanıcı plan adı |
| timeZone | Plan saat dilimi |
| userAction | Etkin planın kullanıcı işlemiyle oluştuğunu gösterir |
| clientOperationId | Yinelenen plan oluşturma dokunuşlarını tek işleme indirir |
| revision | Plan üzerindeki atomik değişiklik sırası |
| warnings | Engelleyici olmayan açıklanabilir profil uyarıları |
| derivedFromDraftId | Kabul edilen AI plan taslağı |

Planned meal uzantısındaki başlıca alanlar:

| Alan | Anlamı |
|---|---|
| ownerPlanId | Sahip meal_plan kaydı |
| captureMode | custom, library, template, mixed, replacement_copy veya draft_acceptance |
| clientMealId | Aynı plan içinde yinelenmeyen istemci öğün kimliği |
| note | İsteğe bağlı plan notu |
| warnings | Öğüne ait engelleyici olmayan profil uyarıları |
| snapshotCount | Öğüne ait değişmez snapshot sayısı |
| revision | Öğün değişiklik sırası |
| replacesPlannedMealId | İkame edilen eski planlanan öğün |
| replacedByPlannedMealId | Eski öğünün yerine oluşturulan yeni öğün |
| derivedFromDraftPlannedMealId | Kabul edilen AI taslak öğünü |
| scheduleHistory | Son yirmi yeniden zamanlama izi |

Plan snapshotları ayrıca şu uzantıyı taşır:

    today.nutrition.planning-snapshot

Bu iz; sahip planı, sahip planlanan öğünü, kütüphane sürümünü, kaynak şablonu, kaynak snapshotı, hazırlama biçimini, besin sürümünü, kısıt etiketlerini ve AI taslak kabul kaynağını korur.

AI isteği ve açık kabul izleri ayrı ad alanlarında tutulur:

    today.nutrition.planning-ai-request
    today.nutrition.planning-approval

## 5. Plan oluşturma

createPlan(input, confirmation) açık kullanıcı işlemi ve onayı gerektirir.

Plan girdisi:

- startDate ve endDate alanlarını YYYY-MM-DD biçiminde taşır.
- İsteğe bağlı title ve timeZone alanları taşır.
- Sıfır ile yüz arasında planlanan öğün içerebilir.
- Aynı plan içindeki clientMealId değerlerini yinelenmeden tutar.
- Her planlanan öğünün zamanını plan tarih aralığı içinde doğrular.

Boş plan teknik olarak geçerlidir; fakat plan en az bir sonuçlanmış öğün olmadan completed durumuna geçirilemez.

Başarılı oluşturma işleminde:

1. Her öğün için yeni snapshot kimlikleri üretilir.
2. Her öğün ayrı planned_meal kaydı olur.
3. meal_plan kaydı plannedMealIds listesiyle bütün öğünlere bağlanır.
4. Snapshotlar, planned meal kayıtları ve plan tek saveRecords işlemiyle yazılır.
5. Herhangi bir öğe veya hesap geçersizse kısmi plan kalmaz.

## 6. Plan öğesi kaynakları

Bir planlanan öğün şu kaynakları tek başına veya birlikte kullanabilir:

1. Özel öğe
   - Ad zorunludur.
   - Miktar belirtilmezse kullanıcı planında 1 portion kullanılır.
   - Kalori ve makro zorunlu değildir.
   - Besin değeri yoksa nutrients boş kalır ve knowledgeStatus unknown olur.
2. Kütüphane besini veya tarifi
   - Yalnız etkin, doğrulanmış ve AI taslağı olmayan food_version veya recipe_version kabul edilir.
   - Seçilen miktar kaynak porsiyonuyla uyumlu olmalıdır.
   - Yeni snapshot nutrition-calc-v1 ile hesaplanır.
3. Öğün şablonu
   - Yalnız etkin, doğrulanmış ve AI taslağı olmayan meal_template kabul edilir.
   - Şablonun mevcut snapshot içeriği yeni kimliklerle kopyalanır.
   - Pozitif şablon çarpanı miktar ve besin değerlerini birlikte ölçekler.
   - Canlı kütüphane verisi geriye dönük yeniden hesaplanmaz.

Kütüphane, şablon veya özel kaynak aynı planlanan öğünde birlikte kullanılırsa captureMode mixed olur.

## 7. Bilinmeyen değer ilkesi

NUT-007 bilinmeyeni tüketim yokluğu veya sıfır besin değeri gibi yorumlamaz.

- Besin değeri girilmeyen özel öğenin nutrient haritası boş kalır.
- unknown ölçüm value: null olarak korunur.
- Bilinen gerçek 0, status: known ile ayrı tutulur.
- Tahmini değer yalnız açıklanabilir basis ile kabul edilir.
- AI özel öğesi besin değeri üretemez.
- AI özel öğe miktarı belirtilmezse unknown olarak kalır.
- AI taslağı kabul edildiğinde unknown değer sıfıra çevrilmez.

## 8. Profil uyarıları

Plan kaynaklarının constraintTags değerleri NUT-004 aktif profil kısıtlarıyla karşılaştırılır.

Eşleşme:

- Planı engellemez.
- Öğeyi silmez.
- Otomatik yasaklama veya tanı üretmez.
- blocking: false değerini taşır.
- Kısıt kimliği, kategori, etiket, eşleşen kaynak etiketi ve açıklama taşır.
- Aynı uyarı plan özetinde yinelenmez.

Bu yaklaşım kullanıcı kontrolünü korur; alerji, intolerans, etik tercih veya kişisel tercih kararı otomatik eyleme dönüşmez.

## 9. Takvim ve sorgu ayrımı

Başlıca sorgular:

- listPlans
- listPlannedMeals
- getPlan
- getSnapshot

Varsayılan sorgular:

- AI taslaklarını etkin planlara karıştırmaz.
- Planları ve gerçek tüketimleri ayrı tutar.
- Planlanan öğünleri plannedFor zamanına göre sıralar.
- Tarih aralığı, plan kimliği ve durum filtrelerini destekler.
- Arşivlenmiş planları yalnız açık includeArchived seçimiyle döndürür.

getPlan isteğe bağlı olarak bütün plan snapshotlarını da döndürür. Plan grafiği ve API sonuçları dışarıdan değiştirilemeyecek biçimde dondurulur.

## 10. Plan değişiklikleri

### Öğün ekleme

addPlannedMeal:

- Yalnız etkin manuel plana öğün ekler.
- Yeni öğün ve snapshotları oluşturur.
- Plan plannedMealIds listesini ve revision değerini aynı atomik işlemde günceller.
- Eski plan zamanıyla yapılan yazmayı reddeder.

### Plan penceresi

updatePlanWindow:

- Başlangıç, bitiş, başlık ve saat dilimini günceller.
- Yeni tarih aralığının mevcut planlanan öğünleri dışarıda bırakmasına izin vermez.
- Planlanan öğün veya snapshot içeriğini değiştirmez.

### Yeniden zamanlama

reschedulePlannedMeal:

- Yalnız status: planned öğünü değiştirir.
- plannedFor ve eventAt alanlarını birlikte günceller.
- Snapshot kimliklerini ve içeriğini değiştirmez.
- Önceki zamanı scheduleHistory içinde saklar.
- Plan tarih aralığı dışına çıkmaz.

### İkame

replacePlannedMeal:

- Eski planlanan öğünü silmez.
- Eski öğünü cancelled durumuna geçirir.
- Yeni öğünü ayrı kimlikle oluşturur.
- İçerik verilmezse eski snapshot içeriğini yeni snapshot kimlikleriyle kopyalar.
- Yeni içerik verilirse kaynakları yeniden doğrular ve yeni snapshotlar üretir.
- replacesPlannedMealId ve replacedByPlannedMealId ile iki yönlü iz bırakır.

### Atlama ve iptal

skipPlannedMeal ve cancelPlannedMeal:

- Yalnız henüz tüketilmemiş status: planned öğünde çalışır.
- mealEntryId alanını null tutar.
- Snapshotları silmez veya değiştirmez.
- Linked, skipped veya cancelled öğünü yeniden düzenlemez.

## 11. Tamamlama ve arşivleme

completePlan:

- Boş planı tamamlamaz.
- Bekleyen status: planned öğün varken çalışmaz.
- Bütün öğünler linked, skipped veya cancelled olduğunda planı completed yapar.
- Gerçek tüketim kaydı oluşturmaz.

archivePlan:

- Yalnız completed manuel planı arşivler.
- payload.status değerini archived yapar.
- recordStatus değerini archived yapar.
- Planı, öğünleri veya snapshotları silmez.

Plan tüketimi ana planı kendiliğinden tamamlamaz. Tamamlama ayrı kullanıcı işlemidir.

## 12. AI plan taslağı

savePlanDraft yalnız şu izinlerle çalışır:

- userRequested: true
- userDataUseApproved: true
- Sürümlü AI istek kimliği ve model/işlem sürümü

AI plan zinciri:

- source.kind = ai_draft
- recordStatus = draft
- verificationStatus = unverified
- knowledgeStatus = estimated
- meal_plan payload.status = draft olarak kalır.

AI:

- Gerçek tüketim oluşturamaz.
- Etkin plan yazamaz.
- Özel öğe için kalori veya makro üretemez.
- Doğrulanmış kütüphane kaynağını deterministik hesapla kullanabilir.
- Taslağı kullanıcı onayı olmadan plan sorgularına karıştıramaz.

acceptPlanDraft için normal kullanıcı onayına ek olarak acceptDraft: true gerekir.

Kabul:

- Özgün AI taslağını değiştirmez.
- Yeni manuel meal_plan oluşturur.
- Her planned_meal ve snapshot için yeni kimlik üretir.
- AI kaynak türünü etkin kayda taşımaz.
- Bilinmeyen özel miktarı sıfıra dönüştürmez.
- Öğün zamanı ve türü için açık kullanıcı değişikliklerini kabul eder.
- Aynı taslağın ikinci kez kabul edilmesini engeller.

## 13. Gerçek tüketim kapısı

consumePlannedMeal gerçek tüketimi kendi içinde yazmaz.

İşlem için birlikte şu koşullar gerekir:

- userInitiated: true
- userConfirmed: true
- confirmPlanConsumption: true
- Etkin manuel plan
- Henüz tüketilmemiş status: planned öğün

Koşullar sağlandığında çağrı NUT-006 TodayNutritionEntry.logPlannedMeal işlevine devredilir.

NUT-006:

1. Plan snapshotlarını yeni tüketim snapshotlarına kopyalar.
2. Ayrı meal_entry kaydı oluşturur.
3. Gerçek consumedAt zamanını kullanır.
4. planned_meal kaydını linked yapar.
5. mealEntryId ile planlanan ve gerçek öğünü atomik bağlar.

plannedFor hiçbir zaman varsayılan consumedAt olmaz.

## 14. Atomiklik ve eşzamanlılık

NUT-007 bütün yazma komutlarını tek sekmede sıraya alır.

Değişen mevcut kayıtlarda expectedUpdatedAtById kullanılır:

- Plan revizyonu başka işlem tarafından değişmişse eski yazma reddedilir.
- Planlanan öğün değişmişse eski yeniden zamanlama, ikame veya sonuç işlemi reddedilir.
- Kısmi snapshot, öğün veya plan kaydı kalmaz.
- Başarısız komut sonraki geçerli komutu zehirlemez.

clientOperationId:

- Yinelenen plan oluşturma dokunuşlarını tek plana indirir.
- Manuel plan ve AI taslak akışları arasında yeniden kullanılamaz.

clientMealId:

- Aynı plan içinde yinelenemez.
- Öğün ekleme tekrarlarında güvenli çakışma üretir.

## 15. API

    window.TodayNutritionPlanning

Başlıca sabitler:

- PLANNING_API_VERSION
- PLANNING_RULESET_ID
- PLAN_EXTENSION_KEY
- SNAPSHOT_EXTENSION_KEY
- AI_REQUEST_EXTENSION_KEY
- APPROVAL_EXTENSION_KEY
- DEFAULT_TIME_ZONE
- PLAN_RECORD_TYPES
- PLAN_STATUSES
- PLANNED_MEAL_STATUSES
- MEAL_TYPES

Başlıca işlevler:

- getSnapshot()
- getPlan(planId, options)
- listPlans(options)
- listPlannedMeals(options)
- createPlan(input, confirmation)
- addPlannedMeal(planId, mealInput, confirmation)
- updatePlanWindow(planId, changes, confirmation)
- reschedulePlannedMeal(plannedMealId, plannedFor, confirmation)
- replacePlannedMeal(plannedMealId, replacement, confirmation)
- skipPlannedMeal(plannedMealId, confirmation)
- cancelPlannedMeal(plannedMealId, confirmation)
- completePlan(planId, confirmation)
- archivePlan(planId, confirmation)
- savePlanDraft(input, consent)
- listDrafts()
- acceptPlanDraft(draftPlanId, overrides, confirmation)
- consumePlannedMeal(plannedMealId, overrides, confirmation)

API ve dönen plan grafikleri dışarıdan değiştirilemeyecek biçimde dondurulur.

## 16. Çalışma zamanı ve çevrimdışı kabuk

Script sırası:

    nutrition-contracts.js
    nutrition-calculations.js
    nutrition-storage.js
    nutrition-migrations.js
    nutrition-profile.js
    nutrition-library.js
    nutrition-entry.js
    nutrition-planning.js
    router.js

nutrition-planning.js Router’dan önce yüklenir. Service Worker kabuğu today-v2-foundation-018 olarak 25 dosyaya yükseltilmiştir.

Modül yüklenmesi:

- IndexedDB açmaz.
- Plan veya tüketim kaydı oluşturmaz.
- Görünür Health ekranını değiştirmez.
- Core, Health veya Sky yönlendirmesine müdahale etmez.

## 17. Test ve kabul matrisi

NUT-007 için 110 pozitif, negatif, atomiklik, geçmiş koruma, taslak/onay ve entegrasyon testi eklenmiştir.

Başlıca doğrulananlar:

- Açık kullanıcı onayı olmadan etkin plan oluşmaması
- Plan, planlanan öğün ve snapshot yazımının atomik olması
- plannedFor ve eventAt eşleşmesi
- consumedAt alanının plan kayıtlarına girmemesi
- Plan tarih aralığı ve saat dilimi doğrulaması
- Bilinmeyen değerlerin sıfıra dönüşmemesi
- Kütüphane ve şablon kaynaklarından yeni snapshot oluşması
- Şablon çarpanı ve kaynak snapshot değişmezliği
- Profil uyarılarının blocking: false kalması
- Takvim, plan ve durum sorgularının ayrılması
- İyimser eşzamanlılık ve istemci idempotency davranışı
- Yeniden zamanlamada snapshotların değişmemesi
- İkamede eski öğünün silinmemesi
- Atlama, iptal, tamamlama ve arşiv durum geçişleri
- AI taslağının etkin planlardan ayrılması
- AI’ın özel besin değeri üretememesi
- Taslak kabulünde yeni manuel plan ve özgün taslak değişmezliği
- Gerçek tüketimin yalnız NUT-006 açık onay kapısına devredilmesi
- Core, Health ve Sky görünür akışında regresyon olmaması
- Çevrimdışı kabukta yeni modülün bulunması

Kabul sonuçları:

- NUT-007 özel testleri: **110/110 başarılı**
- Önceki birleşik platform testleri: **773/773 başarılı**
- Birleşik platform kapısı: **883/883 başarılı**
- Statik regresyon: **30/30 başarılı**
- Service Worker olay regresyonu: **36/36 başarılı**
- Gerçek tarayıcı regresyonu: **32/32 başarılı**
- Otomasyon sözleşmesi: **8/8 başarılı**

## 18. Dosyalar

| Dosya | Durum | İşlev |
|---|---|---|
| modules/nutrition-planning.js | Yeni | Plan, planlanan öğün, takvim, ikame ve AI taslak servisi |
| tests/nutrition-planning.test.cjs | Yeni | 110 pozitif, negatif ve entegrasyon testi |
| index.html | Değişti | Planlama servisinin Router öncesi çalışma zamanı sırası |
| sw.js | Değişti | Foundation-018 çevrimdışı kabuk |
| tests/run-platform-regression.cjs | Değişti | NUT-007 grubunun birleşik kapıya eklenmesi |
| tests/automation-contract.test.cjs | Değişti | 20 grup ve 883 test kabulü |
| tests/static-regression.test.cjs | Değişti | Yeni modül, script sırası ve kabuk parmak izleri |
| tests/sw-event-regression.cjs | Değişti | Foundation-018 ve 25 dosyalık kabuk testi |
| tests/platform-browser-regression.test.cjs | Değişti | Gerçek tarayıcıda planlama API yükleme doğrulaması |
| docs/NUT-007-IMPLEMENTATION.md | Yeni | Uygulama, kabul ve devir kaydı |

package.json, package-lock.json, NUT-001 sözleşmesi, NUT-002 depolama ve migration modülleri, NUT-003 hesaplama motoru, NUT-004 profil servisi, NUT-005 kütüphane servisi ve NUT-006 kayıt servisi değişmemiştir.

## 19. NUT-007 dışında kalanlar

- Health içinde görünür plan takvimi veya plan düzenleme formu
- Görünür öğün veya sıvı giriş formu
- Kalori ve makro gösterge ekranı
- Otomatik plan oluşturma veya otomatik tüketim
- Push bildirim ve Connect takvim entegrasyonu
- Toplu hazırlık, kalan porsiyon ve ev stoku yönetimi
- Alışveriş listesi
- Barkod, kamera veya uzak besin veritabanı bağlantısı
- HealthKit veya Health Connect
- Bulut senkronizasyonu
- Tanı, tedavi veya takviye önerisi

## 20. Sonraki paket için devir koşulları

Bağlayıcı kayıtlarda NUT-008 başlığı henüz tanımlanmamıştır. Sonraki paket seçilirken şu sınırlar korunmalıdır:

1. meal_plan ve planned_meal gerçek tüketim değildir.
2. Görünür Health plan arayüzü açılacaksa mevcut Today sade ve düşük eforlu ürün dili korunmalıdır.
3. Plan ekranı gerçek tüketimi yalnız NUT-006 açık onay kapısından başlatmalıdır.
4. UI, besin değerini kendisi hesaplamamalı veya bilinmeyeni sıfır göstermemelidir.
5. AI plan taslakları etkin planlardan görünür ve işlevsel olarak ayrılmalıdır.
6. Profil uyarıları engelleyici otomasyona dönüşmemelidir.
7. Core verisi, mevcut Core/Health/Sky yönlendirmesi ve today_nutrition sınırı korunmalıdır.
8. Yeni uzak servis, bildirim veya Connect davranışı ayrı izin ve ürün kararı gerektirmelidir.

Sonuç: **NUT-007 tamamlandı. Sonraki beslenme iş paketi için teknik başlangıç koşulları sağlandı; başlık ayrı ürün kararıyla belirlenecektir.**
