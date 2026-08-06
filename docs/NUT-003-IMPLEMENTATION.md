# Today App — NUT-003 Uygulama Kaydı

**İş paketi:** NUT-003 — Birim Dönüşümü, Tarif Ölçekleme ve Deterministik Besin Hesaplama Motoru  
**Durum:** Tamamlandı; birleşik regresyon başarılı  
**Uygulama tabanı:** Today App `2.0.0`, Core veri şeması `2`, NUT-001 sözleşmesi `1`, NUT-002 depolama şeması `1`  
**Hesaplama sürümü:** `nutrition-calc-v1`  
**Birim kural seti:** `today:nutrition:units:v1`  
**Çevrimdışı kabuk:** `today-v2-foundation-014`  
**Tarih:** 5 Ağustos 2026

## 1. Sonuç

NUT-003, NUT-001 kayıt sözleşmeleri ile NUT-002 çevrimdışı deposu arasına saf ve deterministik bir hesaplama katmanı ekler.

Bu iş paketi:

- Sürümlü ve taşınabilir birim dönüşüm kuralları sağlar.
- Yalnız aynı fiziksel boyuttaki birimleri dönüştürür.
- Kütle ile hacim arasında yoğunluk varsayımı yapmaz.
- Porsiyon, servis, adet ve dilim gibi bağlamsal birimleri birbirine eşitlemez.
- Besin değerlerini kaynak porsiyona göre deterministik ölçekler.
- Tarif bileşenlerini tarif sürümündeki kayıt kimlikleriyle birebir eşleştirir.
- Tarif miktarlarını ve besin değerlerini hedef porsiyona göre ölçekler.
- Öğün öğelerinin besin değerlerini birim uyumluluğunu doğrulayarak toplar.
- Eksik veya bilinmeyen katkıyı `0` kabul etmez.
- Bilinen ara toplamı izlenebilir tutar; nihai toplamı kesinmiş gibi göstermez.
- Hesap sonucunu kaynak kayıt, kaynak sürüm, kural seti ve hesaplama sürümüyle izler.
- NUT-001 sözleşmesinden geçen `meal_item_snapshot` kayıt adayları üretir.

Health ekranına yeni form, öğün girişi veya kalori görünümü eklenmemiştir. Hesaplama motoru sayfa açılışında veri oluşturmaz ve NUT-002’ye kendiliğinden yazmaz.

## 2. Mimari sınır

Çalışma zamanı API’si:

```text
window.TodayNutritionCalculations
```

Bağımlılık yönü:

```text
NUT-001 sözleşmeleri
        ↓
NUT-003 deterministik hesaplama
        ↓
NUT-002 doğrulamalı ve atomik depolama
```

NUT-003:

- `localStorage`, `IndexedDB` veya başka kalıcı alan kullanmaz.
- UI veya DOM öğesi oluşturmaz.
- Ağ isteği yapmaz.
- AI Engine çağırmaz.
- Kendiliğinden kayıt yazmaz.
- Core’un `today_store_v2` verisine dokunmaz.

Bu ayrım sayısal sonuçların model anlatımından, kullanıcı arayüzünden ve kalıcı depolamadan bağımsız test edilebilmesini sağlar.

## 3. Sürüm katmanları

| Katman | Sürüm | İşlev |
|---|---:|---|
| Today uygulaması | `2.0.0` | Genel uygulama sürümü |
| Today Core veri şeması | `2` | Mevcut Core kayıtları |
| Beslenme sözleşmesi | `1` | NUT-001 kayıt biçimleri |
| Beslenme depolama şeması | `1` | NUT-002 IndexedDB sınırı |
| Hesaplama API’si | `1` | NUT-003 tarayıcı API’si |
| Hesaplama sürümü | `nutrition-calc-v1` | Üretilen sonuçların algoritma kimliği |
| Birim kural seti | `today:nutrition:units:v1` | Uyumlu birimler ve kesin dönüşüm kesirleri |
| Hassasiyet | `12` basamak | Ara ve nihai sonuç yuvarlama sınırı |
| Çevrimdışı kabuk | `today-v2-foundation-014` | Yeni motoru içeren uygulama kabuğu |

NUT-003, Today uygulama sürümünü, Core veri şemasını, beslenme sözleşmesini veya IndexedDB fiziksel sürümünü yükseltmez. Yeni kalıcı veri biçimi oluşturulmadığı için migration gerekmez.

## 4. Birim kural seti

Taşınabilir kural dosyası:

```text
contracts/nutrition/v1/nutrition-unit-rules.json
```

### Kütle

| Birim | Temel `g` karşılığı |
|---|---:|
| `mcg` | `1 / 1.000.000` |
| `mg` | `1 / 1.000` |
| `g` | `1` |
| `kg` | `1.000` |

### Hacim

| Birim | Temel `ml` karşılığı |
|---|---:|
| `ml` | `1` |
| `cl` | `10` |
| `dl` | `100` |
| `l` | `1.000` |

### Enerji

| Birim | Temel `kJ` karşılığı |
|---|---:|
| `kj` | `1` |
| `kcal` | `4,184` |

### Bağlamsal birimler

```text
count
piece
portion
serving
slice
```

Bağlamsal birimler yalnız kendileriyle aynı birime dönüştürülebilir. Örneğin `portion → serving` dönüşümü yapılmaz; iki kavramın eşitliği ancak tarif veya ürün sürümünde açık bir oranla tanımlanabilir.

İlk sürümde bardak, yemek kaşığı ve çay kaşığı gibi bölgesel veya ürüne bağlı ölçüler bulunmaz. Kütle–hacim dönüşümü için yoğunluk tablosu da yoktur. Bu sınırlar yanlış kesinlik üretmemek için bilinçlidir.

## 5. Ölçüm ve belirsizlik kuralları

Her ölçüm NUT-001’in üç bilgi durumundan birini taşır:

- `known`
- `estimated`
- `unknown`

Değişmez kurallar:

1. `unknown` ölçümün değeri her zaman `null` kalır.
2. Gerçek `0`, bilinen bir değer olarak korunur.
3. Tahmini ölçüm açıklanabilir `basis` alanını korur.
4. Tahmini bir girdi sonucu da tahmini yapar.
5. Bilinmeyen ölçek katsayısı bütün türetilmiş değerleri bilinmeyen yapar.
6. Sıfır kaynak miktarı üzerinden oran hesaplanmaz.
7. Sonlu olmayan veya negatif miktar hesaplamaya alınmaz.
8. Dönüşüm ve toplama kaynak nesneleri değiştirmez.
9. Sonuçlar 12 basamakta sabit biçimde yuvarlanır.

## 6. Besin ölçekleme

Bir `food_version` kaydında besin değerleri `servingBasis` miktarına aittir. İstenen miktar önce kaynak birimine dönüştürülür ve oran şu şekilde kurulur:

```text
ölçek katsayısı = istenen miktar / kaynak porsiyon
```

Her besin değeri aynı katsayıyla ölçeklenir. Kaynak porsiyon, istenen miktar veya besin değerlerinden biri tahminiyse sonuç `estimated` olur. Herhangi bir değer bilinmiyorsa ilgili sonuç `unknown` olur; `0` üretilmez.

Sonuç en az şu izi taşır:

- Kaynak kayıt kimliği
- Mantıksal besin kimliği
- Kaynak sürümü
- Kaynak porsiyon
- İstenen miktar
- Ölçek katsayısı
- Hesaplama sürümü
- Birim kural seti sürümü
- Kullanılan kayıt kimlikleri
- Bilinen, tahmini ve bilinmeyen besin değerlerinin kapsamı

## 7. Tarif ölçekleme

Bir `recipe_version` kaydı yalnız `ingredientSnapshotIds` alanında tanımlanmış bileşenlerle hesaplanır.

Kabul sırası:

1. Tarif ve her bileşen NUT-001 ile doğrulanır.
2. Yinelenen bileşen kimliği reddedilir.
3. Gelen bileşen kümesi tarif sürümündeki kimliklerle birebir eşleştirilir.
4. Eksik veya fazla bileşen reddedilir.
5. Çağrı sırası değil, tarif sürümündeki kimlik sırası kullanılır.
6. Hedef verim ile kaynak verim arasındaki katsayı hesaplanır.
7. Her bileşenin miktarı ve besin değerleri ölçeklenir.
8. Kaynak bileşen kimliği, `referenceId` ve `sourceVersion` korunur.
9. Ölçeklenmiş bileşenlerin besin değerleri deterministik olarak toplanır.

Tarif sürümü dışında kalan bir bileşen sessizce hesaba eklenmez; eksik bileşen de sıfır katkı sayılmaz.

## 8. Toplama ve kısmi kapsam

Besin toplamı, aynı besin anahtarını taşıyan katkıları ortak ve uyumlu birime dönüştürür.

Bir besin değeri için:

- Bütün katkılar mevcut ve biliniyorsa nihai toplam hesaplanır.
- En az bir katkı tahminiyse nihai toplam `estimated` olur.
- En az bir katkı eksik veya bilinmiyorsa nihai toplam `unknown` olur.
- Bilinen katkıların ara toplamı `partialSubtotal` olarak izlenebilir kalır.
- `partialSubtotal`, nihai tüketim toplamı olarak sunulamaz.
- Eksik ve bilinmeyen katkı kayıt kimlikleri ayrı listelenir.

Örnek:

```text
A bileşeni: protein 10 g
B bileşeni: protein bilinmiyor

Nihai protein: unknown / null g
Bilinen ara toplam: 10 g
Bilinmeyen katkı: B
```

Bu yapı, “hesaplanamayan alan tüm öğünü hesaplanmış göstermez” kuralını sayısal katmanda zorunlu tutar.

## 9. Hesaplanmış kayıt kapısı

`buildCalculatedSnapshot` yalnız bu motorun geçerli `food` veya `recipe` sonucunu kabul eder.

Üretilen kayıt:

- `type = meal_item_snapshot`
- `source.kind = system_calculation`
- `calculationVersion = nutrition-calc-v1`
- Kaynak kayıt kimliği ve kaynak sürümü
- Birim kural seti kimliği ve sürümü
- Kullanılan kayıt kimlikleri
- Hesap kapsamı

taşır.

Kayıt adayı `TodayNutritionContracts.createRecord` kapısından geçmeden dışarı verilmez. NUT-003 kayıt yazmaz; tüketici bu nesneyi NUT-002’ye verdiğinde NUT-002 sözleşmeyi ve tam depo referans bütünlüğünü yeniden doğrular, ardından atomik yazım uygular.

Yabancı veya eksik `calculationVersion` taşıyan sonuç kayıtlaştırılamaz.

## 10. Tarayıcı API’si

```text
listUnits()
inspectUnit(unit)
canConvert(fromUnit, toUnit)
convertValue(value, fromUnit, toUnit)
convertMeasurement(measurement, targetUnit)
calculateScaleFactor(sourceMeasurement, targetMeasurement)
scaleMeasurement(measurement, factor)
scaleNutrientMap(nutrientMap, factor)
aggregateNutrients(entries, options)
calculateFoodNutrients(foodRecord, requestedAmount)
scaleRecipe(recipeRecord, ingredientRecords, targetYield)
calculateRecipeNutrients(recipeRecord, ingredientRecords, targetYield, options)
calculateMealNutrients(itemRecords, options)
buildCalculatedSnapshot(options)
```

API ve bütün sonuç nesneleri dışarıdan değiştirilemeyecek biçimde dondurulur.

## 11. Çalışma zamanı entegrasyonu

Script sırası:

```text
nutrition-contracts.js
nutrition-calculations.js
nutrition-storage.js
nutrition-migrations.js
```

Hesaplama motoru `index.html` içinde Router’dan önce yüklenir ve Service Worker uygulama kabuğuna eklenir. Kabuk sürümü `today-v2-foundation-014`, dosya sayısı `21` olmuştur.

Motorun yüklenmesi:

- Beslenme veritabanı oluşturmaz.
- Kullanıcı kaydı yazmaz.
- Health ekranını değiştirmez.
- Mevcut Core başlangıcını engellemez.

## 12. Test kabulü

| Test alanı | Sonuç |
|---|---:|
| NUT-001 veri sözleşmeleri | `60/60` |
| NUT-002 IndexedDB veri katmanı | `50/50` |
| NUT-002 migration orkestrasyonu | `20/20` |
| NUT-003 deterministik hesaplamalar | `84/84` |
| Önceki Today platform regresyonu | `294/294` |
| Birleşik platform kapısı | `508/508` |

Kritik negatif testler:

- Bilinmeyeni sıfırla temsil etme
- Kütle ile hacmi yoğunluk olmadan çevirme
- Porsiyon ile servis birimini varsayımla eşitleme
- Tanımsız birimi hesaplamaya alma
- Sıfır kaynak miktarına bölme
- Tahmini katsayıyı açıklamasız kullanma
- Eksik besin alanını sıfır katkı sayma
- Bilinmeyen katkıya rağmen nihai toplam üretme
- Uyumsuz besin birimlerini toplama
- Eksik veya fazla tarif bileşenini sessizce kullanma
- Geçersiz kaynak kaydı hesaplama
- Yabancı hesaplama sürümünü kayıtlaştırma
- Kullanıcı arayüzünün veya mevcut Core verisinin değişmesi

## 13. NUT-003’te yeni ve değişen dosyalar

| Dosya | İşlem | İşlev |
|---|---|---|
| `modules/nutrition-calculations.js` | Yeni | Deterministik hesaplama motoru |
| `contracts/nutrition/v1/nutrition-unit-rules.json` | Yeni | Taşınabilir sürümlü birim kuralları |
| `tests/nutrition-calculations.test.cjs` | Yeni | 84 hesaplama ve negatif kabul testi |
| `index.html` | Değişti | Hesaplama modülünün script sırası |
| `sw.js` | Değişti | Foundation-014 çevrimdışı kabuk |
| `tests/run-platform-regression.cjs` | Değişti | NUT-003 test grubunun birleşik kapıya eklenmesi |
| `tests/automation-contract.test.cjs` | Değişti | 16 grup ve 508 test kabulü |
| `tests/static-regression.test.cjs` | Değişti | Yeni üretim parmak izleri ve kabuk sırası |
| `tests/sw-event-regression.cjs` | Değişti | Foundation-014 ve 21 dosyalık kabuk testi |
| `tests/platform-browser-regression.test.cjs` | Değişti | Gerçek tarayıcıda hesaplama API’si yükleme doğrulaması |
| `docs/NUT-003-IMPLEMENTATION.md` | Yeni | Uygulama, kabul ve devir kaydı |

`package.json`, `package-lock.json`, NUT-001 sözleşmesi ve NUT-002 depolama/migration modülleri değişmemiştir.

## 14. NUT-003 dışında kalanlar

- Health beslenme arayüzü
- Beslenme profili formu
- Alerji ve tercih yönetimi
- Kullanıcının gerçek öğün girişi
- Besin, tarif veya öğün kütüphanesi ekranı
- Kalori ve makro görünümü
- Gıda yoğunluğu veritabanı
- Bardak/kaşık gibi bölgesel ölçü dönüşümleri
- AI anlatımı veya öneri üretimi
- Otomatik kayıt yazma
- HealthKit veya Health Connect
- Bulut senkronizasyonu

## 15. NUT-004 devir koşulları

Sıradaki iş paketi **NUT-004 — Beslenme Profili, Alerji/Tercih ve Hedef Sürümleme** olacaktır.

NUT-004 şu sınırları korumalıdır:

1. Beslenme, Today Health içinde kalır; ayrı ana modül olmaz.
2. Tek ana hedef ve sürümlü hedef geçmişi korunur.
3. Alerji, intolerans, etik tercih ve kişisel tercih aynı alanmış gibi birleştirilmez.
4. Sade kayıt modu varsayılan, ayrıntılı mod isteğe bağlı olur.
5. Profil değişikliği geçmiş öğün ve hesap sonuçlarını sessizce değiştirmez.
6. NUT-001 sözleşmeleri, NUT-002 atomik depo ve NUT-003 hesaplama sürümleri korunur.
7. AI hiçbir hedefi kullanıcı onayı olmadan etkinleştirmez.
8. İlk profil verisi yerel ve çevrimdışı çalışır.

Sonuç: **NUT-003 tamamlandı. NUT-004 başlangıç koşulları sağlandı.**
