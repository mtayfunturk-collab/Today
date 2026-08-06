# Today App — NUT-005 Uygulama Kaydı

**İş paketi:** NUT-005 — Besin, Tarif ve Öğün Kütüphanesi  
**Durum:** Tamamlandı; birleşik regresyon başarılı  
**Uygulama tabanı:** Today App `2.0.0`, Core veri şeması `2`, NUT-001 sözleşmesi `1`, NUT-002 depolama şeması `1`, NUT-003 hesaplama sürümü `nutrition-calc-v1`, NUT-004 profil API’si `1`  
**Kütüphane API sürümü:** `1`  
**Kütüphane kural seti:** `today:nutrition:library:v1`  
**Çevrimdışı kabuk:** `today-v2-foundation-016`  
**Tarih:** 6 Ağustos 2026

## 1. Sonuç

NUT-005, NUT-001’de tanımlanan `food_version`, `recipe_version` ve `meal_template` kayıtlarını NUT-002’nin atomik çevrimdışı deposunda yöneten sürümlü beslenme kütüphanesi servis katmanını ekler.

Bu iş paketi:

- Kullanıcının oluşturduğu besinleri, doğrulanmış veri paketi kayıtlarını ve AI taslaklarını birbirinden açıkça ayırır.
- Besin ve tarifleri mantıksal kimlik ile `major.minor.patch` sürüm zincirinde tutar.
- Öğün şablonlarını aynı sürümleme ve geçmiş koruma ilkesiyle yönetir.
- Besin kaynağı, hazırlama biçimi, porsiyon temeli, besin değeri sürümü ve doğrulama durumunu korur.
- Tarif ve öğün şablonu bileşenlerini NUT-003 ile deterministik hesaplayıp değişmez `meal_item_snapshot` kayıtlarına dönüştürür.
- Yeni sürüm oluştuğunda önceki sürümü silmez; aynı atomik işlemde `superseded` yapar.
- Aynı içerikle yapılan gereksiz güncellemelerde yeni sürüm veya yeni anlık görüntü üretmez.
- Eski besin/tarif sürümleri değişse bile daha önce oluşturulmuş bileşen ve öğün anlık görüntülerini değiştirmez.
- AI’ın doğrulanmamış besin değeri üretmesini engeller; eksik değerleri `unknown / null` olarak korur.
- AI tarif ve şablon taslaklarında yalnız doğrulanmış yerel kütüphane kaynaklarından deterministik değer kullanır.
- AI taslağını yalnız açık kullanıcı onayıyla yeni ve ayrı bir manuel kayda dönüştürür; özgün taslak değişmeden kalır.
- Profil kısıtlarını otomatik yasak veya silme nedeni yapmaz; yalnız `blocking: false` açıklanabilir uyarı üretir.

Health ekranına görünür besin, tarif veya öğün şablonu arayüzü eklenmemiştir. Modül sayfa açılışında beslenme veritabanı veya kütüphane kaydı oluşturmaz.

## 2. Mimari sınır

Çalışma zamanı API’si:

```text
window.TodayNutritionLibrary
```

Bağımlılık yönü:

```text
NUT-001 veri sözleşmeleri
          ↓
NUT-003 deterministik hesaplama
          ↓
NUT-005 kütüphane ve anlık görüntü kuralları
          ↓
NUT-002 doğrulamalı atomik depolama

NUT-004 profil bağlamı ── yalnız açıklanabilir uyarı ──► NUT-005
```

NUT-005:

- Yalnız `food_version`, `recipe_version`, `meal_template` ve bunların `meal_item_snapshot` kayıtlarını yazar.
- Bütün kalıcı kayıtları `TodayNutritionStorage` üzerinden `today_nutrition` IndexedDB deposuna yazar.
- Core’un `today_store_v2` alanını okumaz veya yazmaz.
- `localStorage`, ağ, DOM, AI sağlayıcısı veya Connect sağlayıcısı kullanmaz.
- NUT-003 hesaplamalarını kendisi değiştirmez; yalnız doğrulanmış kayıtlar için çağırır.
- NUT-004 profil kaydını değiştirmez; profil kısıtını yalnız uyarı bağlamı olarak okur.
- Kayıtları silmez; sürümleme ve arşivleme yoluyla geçmişi korur.
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
| Kütüphane API’si | `1` | NUT-005 tarayıcı servis sözleşmesi |
| Kütüphane kural seti | `today:nutrition:library:v1` | Kaynak, sürüm, taslak ve anlık görüntü yaşam döngüsü |
| Çevrimdışı kabuk | `today-v2-foundation-016` | Kütüphane servisini içeren 23 dosyalık kabuk |

NUT-005 yeni kayıt türü veya fiziksel IndexedDB store’u eklemez. NUT-001’deki kayıt türlerini ve NUT-002’deki ortak kayıt store’unu kullanır. Bu nedenle Today uygulama sürümü, Core şeması, beslenme sözleşmesi, depolama şeması ve IndexedDB fiziksel sürümü yükseltilmemiştir.

## 4. Ortak kütüphane sürüm izi

Her kütüphane kaydı şu ad alanlı uzantıyı taşır:

```text
today.nutrition.library
```

Uzantı aşağıdaki izleri korur:

| Alan | Anlamı |
|---|---|
| `entityKind` | `food`, `recipe` veya `meal_template` |
| `logicalId` | Sürümler boyunca değişmeyen kütüphane kimliği |
| `version` | `major.minor.patch` kayıt sürümü |
| `supersedesId` | Bir önceki sürümün kayıt kimliği |
| `baseRecordId` | AI güncelleme taslağının dayandığı etkin sürüm |
| `sourceClass` | Kullanıcı, doğrulanmış paket veya AI taslağı ayrımı |
| `preparation` | Hazırlama yöntemi ve isteğe bağlı ayrıntı |
| `nutritionVersion` | Besin değeri veya deterministik hesaplama sürümü |
| `tags` | Kütüphane sınıflandırma etiketleri |
| `constraintTags` | Yalnız açıklanabilir profil uyarılarında kullanılan etiketler |
| `derivedFromId` | Kullanıcı düzenlemesinin veya kabul edilen taslağın kaynağı |

Sürüm değişmezleri:

1. Aynı mantıksal kimlik için en fazla bir etkin sürüm bulunur.
2. Yeni sürüm önceki sürümden büyük olmalıdır.
3. Önceki sürüm aynı atomik işlemde `superseded` yapılır.
4. Sürüm zinciri dallanamaz veya döngü oluşturamaz.
5. Sürüm kimliği ile `foodId` / `recipeId` alanı çelişemez.
6. İçerik değişmediyse gereksiz yeni sürüm oluşturulmaz.
7. Arşivlenen kayıt silinmez ve geçmişte kalır.

## 5. Kaynak ve doğrulama ayrımı

| Kütüphane kaynağı | `source.kind` | `sourceClass` | Doğrulama | Durum |
|---|---|---|---|---|
| Kullanıcının özel kaydı | `manual` | `user_custom` | `user_confirmed` | `active` |
| Doğrulanmış veri paketi | `data_package` | `verified_data_package` | `source_verified` | `active` |
| AI önerisi | `ai_draft` | `ai_draft` | `unverified` | `draft` |

Kaynak sınıfı kayıt kaynağıyla çelişirse yüksek seviye kütüphane doğrulaması güvenli hata verir. Manuel kayıt dış kaynak doğrulaması, AI taslağı kullanıcı doğrulaması veya veri paketi kullanıcı kaydı gibi gösterilemez.

Doğrulanmış veri paketi kaydı paket kimliğini ve paket sürümünü üst seviye `source` alanında korur. Kullanıcı paket kaydını değiştirirse yeni sürüm manuel kullanıcı kaydı olur ve `derivedFromId` ile özgün paket sürümüne bağlanır. Yeni bir veri paketi sürümü ayrıca içe aktarılırsa `source_verified` durumu korunur.

## 6. Besin sürümleri

Besin kaydı şu temel bilgileri birlikte korur:

- Mantıksal `foodId`
- Kayıt `version`
- Besin adı
- `servingBasis`
- Besin değeri haritası
- Kaynak referansları
- Hazırlama biçimi
- Besin değeri sürümü
- Kaynak ve doğrulama sınıfı
- Kısıt ve sınıflandırma etiketleri

`known`, `estimated` ve `unknown` ölçüm durumları NUT-001 biçiminde saklanır. Gerçek `0` değeri korunur; bilinmeyen değer hiçbir zaman `0` yapılmaz. Tahmini değer açıklanabilir dayanak olmadan kabul edilmez.

## 7. Tarif sürümleri ve bileşen anlık görüntüleri

Tarif oluşturulurken her bileşen:

1. Etkin `food_version` veya `recipe_version` kimliğiyle çözülür.
2. Kaydın AI taslağı olmadığı ve `user_confirmed` veya `source_verified` olduğu doğrulanır.
3. İstenen miktarın kaynak porsiyonuyla birim açısından uyumlu olduğu NUT-003 tarafından doğrulanır.
4. Besin değerleri `nutrition-calc-v1` ile deterministik hesaplanır.
5. Kaynak kayıt kimliği, mantıksal kimlik, kaynak sürümü, hazırlama biçimi, besin sürümü ve kısıt etiketleriyle yeni `meal_item_snapshot` kaydı oluşturulur.
6. Tarif ve bütün bileşen anlık görüntüleri tek atomik işlemde saklanır.

Tarif sürümü bileşen anlık görüntüsü kimliklerini sıralı biçimde taşır. Besin veya tarif daha sonra güncellense bile eski tarifin anlık görüntüleri değişmez. Tarif güncellemesinde yeni tarif sürümü ve yeni anlık görüntüler oluşturulur; eski tarif ve eski anlık görüntüler silinmez.

Kütle–hacim, porsiyon–servis veya başka uyumsuz birimler yoğunluk ya da eşitlik varsayımıyla çevrilmez. Uyumlu olmayan tek bileşen bütün atomik tarif yazımını durdurur.

## 8. Öğün şablonları

Öğün şablonu:

- Şablon adı
- `breakfast`, `lunch`, `dinner`, `snack` veya `other` öğün türü
- Sıralı öğe anlık görüntüsü kimlikleri
- Mantıksal şablon kimliği ve sürümü
- Kaynak, etiket ve hesaplama sürümü izi

taşır.

Şablon, tarif veya besin sürümünü doğrudan canlı referans gibi kullanmaz; seçilen miktarı yeni `meal_item_snapshot` kaydında sabitler. Şablon güncellendiğinde yeni sürüm ve yeni anlık görüntüler oluşturulur. Önceki şablon ve anlık görüntüler korunur.

Şablon henüz gerçek tüketim kaydı değildir. NUT-005 hiçbir `meal_entry` oluşturmaz ve şablonu tüketilmiş saymaz.

## 9. Deterministik hesaplama kapısı

NUT-005’in `calculateItem` ve anlık görüntü oluşturma akışları şu kapıyı uygular:

1. Kaynak türü yalnız `food_version` veya `recipe_version` olabilir.
2. Kaynak `active` olmalıdır.
3. Kaynak AI taslağı olamaz.
4. Kaynak `user_confirmed` veya `source_verified` olmalıdır.
5. Kaynağın kütüphane sürüm izi kendi kayıt alanlarıyla uyumlu olmalıdır.
6. Tarif bileşen anlık görüntüleri `system_calculation`, `active` ve `nutrition-calc-v1` olmalıdır.
7. Ölçüm birimleri NUT-003 kural setiyle uyumlu olmalıdır.

Bu kapı NUT-003’ü değiştirmez. NUT-003 saf hesaplama motoru olarak kalır; doğrulanmış kaynak seçimi ve kalıcı yazma sınırı NUT-005 tarafından uygulanır.

## 10. AI taslak kapısı

AI kütüphane taslağı iki aşamalı çalışır.

### Taslak oluşturma

AI taslağı yalnız:

- `userRequested: true`,
- `userDataUseApproved: true`,
- sürümlü AI kaynak kimliği

ile kaydedilebilir.

AI besin taslağı bilinen veya tahmini besin değeri üretemez. Eksik değerler şu biçimde kalır:

```text
status = unknown
value = null
```

AI tarif ve şablon taslaklarında besin değerleri AI tarafından yazılmaz; yalnız kullanıcının doğrulanmış yerel kütüphane kaynaklarından NUT-003 ile hesaplanır. Taslak tarif/şablon anlık görüntüleri de `draft` durumunda kalır.

### Kullanıcı kabulü

Taslağın etkinleşmesi için ayrıca `userInitiated: true` ve `userConfirmed: true` gerekir. Kabul sırasında:

1. Taslağın daha önce kabul edilmediği doğrulanır.
2. Güncelleme taslağıysa dayandığı sürümün hâlâ etkin olduğu doğrulanır.
3. Yeni manuel ve `user_confirmed` kayıt oluşturulur.
4. Tarif veya şablonda yeni deterministik anlık görüntüler oluşturulur.
5. Önceki etkin sürüm varsa aynı atomik işlemde `superseded` yapılır.
6. Yeni kayıt `today.nutrition.library-approval` uzantısıyla taslak kimliği ve onay zamanını taşır.
7. Özgün AI taslağı ve taslak anlık görüntüleri değiştirilmez.

## 11. Profil kısıtı uyarıları

`getConstraintWarnings` kütüphane öğesinin `constraintTags` alanını NUT-004’ün etkin profil kısıtlarıyla karşılaştırır.

Eşleşme:

- Türkçe büyük-küçük harf farkını dikkate almaz.
- Kısıt kimliğini, kategorisini, etiketini ve eşleşen kütüphane etiketini gösterir.
- Her zaman `blocking: false` döndürür.
- Kütüphane kaydını silmez, arşivlemez, gizlemez veya tüketimi yasaklamaz.
- Eşleşmeyi tanı, tedavi veya gıda güvenliği garantisi olarak sunmaz.

Profil API’si veya profil kaydı yoksa güvenli biçimde boş uyarı listesi döner.

## 12. Tarayıcı API’si

```text
getSnapshot()
getItem(recordId, options)
getVersionHistory(recordId)
calculateItem(recordId, amount)

createFood(input, confirmation)
importVerifiedFood(input, packageSource, confirmation)
updateFood(recordId, changes, confirmation)
importVerifiedFoodVersion(recordId, input, packageSource, confirmation)

createRecipe(input, confirmation)
importVerifiedRecipe(input, packageSource, confirmation)
updateRecipe(recordId, changes, confirmation)

createMealTemplate(input, confirmation)
updateMealTemplate(recordId, changes, confirmation)
archiveItem(recordId, confirmation)

saveFoodDraft(input, consent)
saveRecipeDraft(input, consent)
saveMealTemplateDraft(input, consent)
listDrafts(options)
acceptDraft(draftId, overrides, confirmation)

getConstraintWarnings(recordId, profileSnapshot)
```

API sabit listeleri ve bütün çıktı anlık görüntüleri dışarıdan değiştirilemeyecek biçimde dondurulur. Aynı sekmedeki kütüphane yazmaları sıraya alınır; NUT-002 iyimser `updatedAt` kontrolü eski kopyanın yeni kaydı ezmesini engeller.

## 13. Çalışma zamanı entegrasyonu

Script sırası:

```text
nutrition-contracts.js
nutrition-calculations.js
nutrition-storage.js
nutrition-migrations.js
nutrition-profile.js
nutrition-library.js
router.js
```

Kütüphane servisi Router’dan önce yüklenir ve Service Worker kabuğuna eklenir. Kabuk `today-v2-foundation-016` ve 23 dosyadır.

Modülün yüklenmesi:

- IndexedDB oluşturmaz.
- Besin, tarif veya şablon yazmaz.
- Health ekranını değiştirmez.
- Core başlangıcını engellemez.
- AI veya Connect sağlayıcısı kaydetmez.

## 14. Test kabulü

| Test alanı | Sonuç |
|---|---:|
| NUT-001 veri sözleşmeleri | `60/60` |
| NUT-002 IndexedDB veri katmanı | `50/50` |
| NUT-002 migration orkestrasyonu | `20/20` |
| NUT-003 deterministik hesaplamalar | `84/84` |
| NUT-004 profil, kısıt ve hedef sürümleme | `82/82` |
| NUT-005 besin, tarif ve öğün kütüphanesi | `93/93` |
| Önceki Today platform regresyonu | `294/294` |
| Birleşik platform kapısı | `683/683` |

Kritik negatif testler:

- Kullanıcı onayı olmadan besin, tarif, şablon, sürüm veya arşiv değişikliği
- Aynı mantıksal kimliğin iki etkin sürümü
- Geri giden, eşit, dallanan veya döngü oluşturan sürüm zinciri
- Kaynak sınıfını kullanıcı, veri paketi veya AI olduğundan farklı gösterme
- `unknown` değeri `0` yapma
- Geçersiz porsiyon veya boş besin değeriyle kısmi kayıt bırakma
- Doğrulanmamış, AI taslağı veya arşivli kaydı NUT-003 hesabına alma
- Kütle–hacim ve porsiyon–servis arasında doğrulanmamış dönüşüm yapma
- Eksik veya uyumsuz tarif bileşeninde kısmi anlık görüntü bırakma
- Yeni besin/tarif sürümüyle geçmiş anlık görüntüyü değiştirme
- AI’ın bilinen veya tahmini besin değeri uydurması
- AI taslağını kullanıcı isteği, veri kullanım onayı veya etkinleştirme onayı olmadan uygulama
- Güncel olmayan veya daha önce kabul edilmiş AI taslağını etkinleştirme
- Profil kısıtını otomatik yasak veya kayıt silme nedeni yapma
- Modül yüklenirken IndexedDB veya kullanıcı kaydı oluşturma

## 15. NUT-005’te yeni ve değişen dosyalar

| Dosya | İşlem | İşlev |
|---|---|---|
| `modules/nutrition-library.js` | Yeni | Sürümlü besin, tarif, şablon, anlık görüntü, kaynak ve AI onay servisi |
| `tests/nutrition-library.test.cjs` | Yeni | 93 pozitif, negatif ve entegrasyon testi |
| `index.html` | Değişti | Kütüphane servisinin çalışma zamanı sırası |
| `sw.js` | Değişti | Foundation-016 çevrimdışı kabuk |
| `tests/run-platform-regression.cjs` | Değişti | NUT-005 grubunun birleşik kapıya eklenmesi |
| `tests/automation-contract.test.cjs` | Değişti | 18 grup ve 683 test kabulü |
| `tests/static-regression.test.cjs` | Değişti | Yeni modül, script sırası ve kabuk parmak izleri |
| `tests/sw-event-regression.cjs` | Değişti | Foundation-016 ve 23 dosyalık kabuk testi |
| `tests/platform-browser-regression.test.cjs` | Değişti | Gerçek tarayıcıda kütüphane API yükleme doğrulaması |
| `docs/NUT-005-IMPLEMENTATION.md` | Yeni | Uygulama, kabul ve devir kaydı |

`package.json`, `package-lock.json`, NUT-001 sözleşmesi, NUT-002 depolama/migration modülleri, NUT-003 hesaplama motoru ve NUT-004 profil servisi değişmemiştir.

## 16. NUT-005 dışında kalanlar

- Health içinde görünür besin veya tarif kütüphanesi ekranı
- Hızlı öğün veya sıvı girişi
- Gerçek `meal_entry` veya `hydration_entry` oluşturma
- Planlanan öğün veya alışveriş listesi
- Kalori ve makro görünümü
- Barkod, kamera veya uzak besin veritabanı bağlantısı
- AI’ın besin değeri, tanı, tedavi veya takviye önermesi
- Bulut senkronizasyonu
- HealthKit veya Health Connect

## 17. NUT-006 devir koşulları

Sıradaki iş paketi **NUT-006 — Hızlı Öğün ve Sıvı Kayıt Akışı** olacaktır.

NUT-006 şu sınırları korumalıdır:

1. Gerçek tüketim yalnız açık kullanıcı işlemiyle `meal_entry` veya `hydration_entry` olarak kaydedilir.
2. `eventAt` ile `consumedAt` birebir eşleşir; planlanan tarih tüketim zamanı yerine kullanılamaz.
3. Kütüphane besini, tarif veya şablonu tüketim kaydına canlı referans gibi eklenmez; seçilen miktar yeni ve değişmez `meal_item_snapshot` kaydına dönüştürülür.
4. Planlanan öğün tüketilmiş sayılmaz; plan–tüketim geçişi otomatik olmaz.
5. Eksik kayıt eksik tüketim, bilinmeyen besin değeri ise `0` olarak yorumlanmaz.
6. Hızlı kayıt düşük eforlu olur; sade modda zorunlu kalori veya makro girişi istenmez.
7. Sıvı kaydı öğünden ayrı nesne olarak kalır.
8. AI tüketimi kendiliğinden kaydedemez; yalnız kullanıcı tarafından kabul edilebilir taslak hazırlayabilir.
9. İlk akış yerel ve çevrimdışı çalışır; Core verisine dokunmaz.
10. Görünür Health akışı eklenirse mevcut Core/Health/Sky yönlendirmesi, erişilebilirlik ve geri dönüş davranışları regresyon testleriyle korunur.

Sonuç: **NUT-005 tamamlandı. NUT-006 başlangıç koşulları sağlandı.**
