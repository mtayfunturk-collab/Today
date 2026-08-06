# Today App — NUT-010 Uygulama Kaydı

**İş paketi:** NUT-010 — Besin, Tarif ve Öğün Şablonu Arama–Seçim Akışı  
**Durum:** Tamamlandı; birleşik regresyon başarılı  
**Taban:** NUT-009 tamamlanmış Today deposu  
**Tarih:** 6 Ağustos 2026  
**Today uygulama sürümü:** 2.3.0  
**Core veri şeması:** 2  
**Beslenme sözleşmesi / depolama şeması:** 1 / 1  
**Beslenme kütüphanesi API sürümü:** 1  
**Beslenme giriş API sürümü:** 1  
**Beslenme UI API sürümü:** 3  
**Çevrimdışı kabuk:** `today-v2-foundation-022`

## 1. Sonuç

NUT-010, NUT-005'te hazırlanan sürümlü beslenme kütüphanesini ve NUT-006'daki değişmez tüketim akışını Today Health içindeki görünür öğün formuna bağlar.

Kullanıcı artık Health içinde:

- cihazındaki etkin besin, tarif ve öğün şablonlarını görebilir,
- ad, etiket ve hazırlama bilgisiyle arama yapabilir,
- sonuçları **Tümü / Besin / Tarif / Öğün şablonu** olarak filtreleyebilir,
- besin veya tarifi kayıtlı varsayılan porsiyonuyla öğüne ekleyebilir,
- tek bir öğün şablonu ile birden fazla besin/tarifi aynı öğünde birleştirebilir,
- seçimini gerçek tüketim oluşturmadan önce gözden geçirip çıkarabilir,
- **Öğünü kaydet** işlemiyle seçimi NUT-006'nın atomik ve izlenebilir kayıt kapısına devredebilir.

Kütüphane seçimi kendi başına tüketim değildir. Gerçek `meal_entry` ve bağlı `meal_item_snapshot` kayıtları yalnız formun açık kullanıcı işlemiyle gönderilmesinden sonra oluşur.

## 2. Ürün kararı

NUT-009 kapanış kaydı, sıradaki mantıksal aday olarak besin/tarif arama ve seçim akışını işaret etmişti. NUT-010 bu adımı öğün şablonlarını da kapsayacak biçimde tamamlar.

Bu paket şu ilkeleri korur:

- Health görünür ve doğrudan kullanılabilir biçimde ilerler.
- NUT-005 kütüphane ve NUT-006 kayıt servisleri yeniden yazılmaz.
- Kütüphane araması yalnız yerel cihaz verisini okur; ağ kaynağı kullanmaz.
- AI taslakları, arşivlenmiş ve superseded sürümler sonuçlara girmez.
- Bilinmeyen porsiyon `0` veya varsayılan bir sayı kabul edilmez.
- Bilinmeyen besin değerleri ekranda eksik olarak açıklanır; kalori veya makro uydurulmaz.
- Planlanan öğün gerçek tüketim sayılmaz.
- Core `localStorage` alanı ile `today_nutrition` IndexedDB alanı ayrı kalır.

## 3. Görünür Health akışı

### 3.1 Kütüphane alanı

Health içindeki **Öğün** kartına şu alanlar eklendi:

1. **Besin, tarif veya öğün ara** arama alanı,
2. kayıt türü filtresi,
3. **Sonuçlar** listesi,
4. **Bu öğüne seçilenler** listesi,
5. seçim ve bilgi durumu açıklaması.

Arama; kayıt adı, kütüphane etiketleri ve hazırlama biçimi metinlerini Türkçe büyük/küçük harf farkı olmadan eşleştirir. En fazla 20 sonuç görünür; arama yeni bir kalıcı kayıt veya ağ isteği oluşturmaz.

### 3.2 Görünürlük kapısı

Bir kütüphane kaydının sonuçlara girebilmesi için:

- türünün `food_version`, `recipe_version` veya `meal_template` olması,
- `recordStatus = active` olması,
- kaynağının `ai_draft` olmaması,
- doğrulama durumunun `user_confirmed` veya `source_verified` olması,
- görünür bir ad taşıması gerekir.

Bu savunma, NUT-005 `getSnapshot()` çıktısındaki etkin kayıt ayrımına ek bir UI sınırıdır. Kütüphane servisinin geçmiş ve taslak kayıtları değiştirilmez.

### 3.3 Varsayılan porsiyon

NUT-010 ayrıntılı miktar düzenleme ekranı açmaz:

- besin, kendi `servingBasis` ölçümüyle,
- tarif, kendi `yield` ölçümüyle,
- öğün şablonu, `templateMultiplier = 1` ile seçilir.

Besin veya tarifin varsayılan ölçümü `known` ya da `estimated`, sonlu ve sıfırdan büyük değilse **Ekle** işlemi kapalıdır ve **porsiyon bilgisi eksik** açıklaması gösterilir. Eksik miktar sessizce `0`, `1 porsiyon` veya başka bir tahmine dönüştürülmez.

Tahmini miktar, sonuçta **yaklaşık** etiketiyle gösterilir. Besin değerleri eksik fakat porsiyonu bilinen kayıt seçilebilir; kullanıcıya besin değerinin eksik olabileceği açıklanır ve bilinmeyen değerler snapshot içinde bilinmeyen kalır.

### 3.4 Geçici seçim durumu

Kütüphaneden **Ekle** işlemi:

- IndexedDB'ye yazmaz,
- `meal_entry` oluşturmaz,
- planı tüketilmiş saymaz,
- seçilen kayıt kimliği, türü, adı ve varsayılan miktarını yalnız geçici UI durumunda tutar.

Bir öğünde en fazla 20 kütüphane öğesi seçilebilir. NUT-006 tek şablon sözleşmesi nedeniyle aynı anda yalnız bir `meal_template` seçilebilir; ikinci şablon ilk şablonun yerini alır. Besin ve tarif seçimleri korunur.

Kullanıcı **Çıkar** ile seçimi gerçek kayıt oluşturmadan kaldırabilir. UI tarafından dışarı verilen seçim durumu değişmez kopyadır; dışarıdan değiştirilmesi çalışma durumunu etkilemez.

### 3.5 Gerçek tüketim kaydı

**Öğünü kaydet** işleminde UI, seçimi NUT-006 `logMeal()` çağrısına şu biçimde devreder:

- besin ve tarifler `items[]` içinde `recordId + amount + name`,
- seçili şablon `templateId + templateMultiplier: 1`,
- sade metin girişi varsa ayrı `customItems[]`,
- kullanıcı seçimi varsa `coverage = complete`,
- boş sade kayıt varsa önceki gibi `coverage = unspecified`.

NUT-006 kaynak kaydın etkinliğini ve doğrulanabilirliğini yeniden kontrol eder. Başarılı işlemde:

- her besin/tarif güncel kaynak sürümüyle hesaplanır,
- yeni ve değişmez `meal_item_snapshot` oluşur,
- kaynak `recordId`, mantıksal kimlik, sürüm, hazırlama ve besin değeri sürümü korunur,
- gerçek `meal_entry` ile snapshotlar atomik yazılır,
- geçici UI seçimi temizlenir.

Yazma başarısızsa sade metin ve kütüphane seçimleri korunur; kullanıcı tekrar deneyebilir.

## 4. Kütüphane boş ve hata durumları

Kütüphane boşsa Health:

- boş durumu açıkça gösterir,
- hiçbir besin veya değer uydurmaz,
- mevcut sade öğün adı akışını açık tutar.

Kütüphane okuma hatası günlük öğün/su geçmişini veya sade kayıt akışını kapatmaz. UI, kütüphane kayıtlarının silinmediğini açıklar ve ayrı `lastLibraryErrorCode` durumunu korur.

Kütüphane yenilendiğinde artık etkin olmayan bir seçimin kaynak kimliği sessizce kullanılmaz; geçici seçim güvenle düşürülür. Geçmiş günlerde arama, tür filtresi, **Ekle** ve **Çıkar** kontrolleri NUT-009 salt-okunur kuralıyla birlikte kapanır.

## 5. UI API v3

NUT-010, mevcut görünür UI modülünü sürümler:

```text
TodayNutritionUI.UI_API_VERSION = 3
TodayNutritionUI.UI_RULESET_ID = today:nutrition:ui:v3
```

Yeni yayımlanan sabitler ve işlem:

```text
MAX_VISIBLE_LIBRARY_RESULTS = 20
MAX_SELECTED_LIBRARY_ITEMS = 20
LIBRARY_TYPE_LABELS
refreshLibrary()
```

`getState()` artık günlük özetten ayrı bir `library` görünümü ve `lastLibraryErrorCode` sunar. NUT-005 `TodayNutritionLibrary` ve NUT-006 `TodayNutritionEntry` API sürümleri değişmez.

## 6. Veri ve şema etkisi

NUT-010 yeni IndexedDB store'u, beslenme kayıt türü veya migration oluşturmaz.

| Katman | NUT-009 | NUT-010 |
|---|---:|---:|
| Today uygulaması | 2.2.0 | 2.3.0 |
| Core veri şeması | 2 | 2 |
| Beslenme sözleşmesi | 1 | 1 |
| Beslenme depolama şeması | 1 | 1 |
| Beslenme kütüphanesi API | 1 | 1 |
| Beslenme giriş API | 1 | 1 |
| Beslenme UI API | 2 | 3 |
| Çevrimdışı kabuk | foundation-021 | foundation-022 |

Uygulama ve Core depolama sürüm damgaları `2.3.0` olarak birlikte yükseltilmiştir. Şema sürümü aynı kaldığı için veri migration'ı gerekmez.

## 7. Korunan sınırlar

- Today Core ve Today Sky akışları değiştirilmedi.
- Core veri anahtarları Health kütüphane akışı tarafından okunmadı veya yazılmadı.
- Beslenme verisi yalnız yerel `today_nutrition` deposunda kaldı.
- Kütüphane araması sayfa açılışında veri yazmadı.
- Kütüphane kaydı, sürüm geçmişi ve kaynak metadatası değiştirilmedi.
- Geçmiş tüketim snapshotları değiştirilmedi.
- Planlanan öğün açık **Tükettim** onayı olmadan gerçek kayda dönüşmedi.
- AI taslakları görünür arama sonucuna veya gerçek tüketim seçimine alınmadı.
- Bilinmeyen miktar veya besin değeri `0` yapılmadı.
- Ağ, harici besin sağlayıcısı, AI veya Connect çağrısı eklenmedi.

## 8. Erişilebilirlik ve mobil koruma

- Arama alanı ve tür filtresi görünür etiket taşır.
- Sonuçlar ile seçilenler ayrı adlandırılmış listelerdir.
- Sonuç ve seçim sayıları açıklayıcı `aria-label` değerleri taşır.
- **Ekle / Eksik / Eklendi / Çıkar** kontrolleri gerçek `button` öğeleridir.
- Eksik porsiyonlu kayıt erişilebilir etikette de açıklanır.
- Geçmiş gün ve yazma sırasında ilgili kontroller devre dışı kalır.
- Sonuç ve seçim kartları `min-width: 0` ile dar ekranda küçülebilir.
- Arama ve tür alanı 420 px altında `minmax(0, 1fr)` tek sütuna döner.
- NUT-008.1 dış grid ve kart genişlik korumaları aynen sürer.

## 9. Doğrulama

Birleşik platform regresyon kapısı:

```text
Platform Regression Gate: 1055/1055 başarılı
```

İlgili alt kapılar:

- Health UI: **106/106**
- Gerçek uygulama akışı + IndexedDB: **44/44**
- Statik mimari ve mobil genişlik koruması: **30/30**
- Service Worker olayları: **36/36**
- Otomasyon sözleşmesi: **8/8**

NUT-010 ile 33 yeni doğrulama eklenmiştir:

- 30 yeni Health UI testi,
- 3 yeni gerçek tarayıcı ve IndexedDB entegrasyon testi.

Önceki 1022 testin tamamı korunmuştur.

Gerçek entegrasyon testinde kullanıcı kaynağından bir besin, tarif ve öğün şablonu yerel kütüphanede oluşturulmuş; Health aramasıyla seçilmiş ve yalnız form onayı sonrasında kaynak kayıt kimliği ile `1.0.0` sürümünü koruyan yeni tüketim snapshotına dönüştüğü doğrulanmıştır.

## 10. Teslim dosyaları

NUT-010 yükleme paketi yalnız yeni veya değişen 14 dosyayı içerir:

1. `index.html`
2. `sw.js`
3. `package.json`
4. `package-lock.json`
5. `modules/storage.js`
6. `modules/version.js`
7. `modules/nutrition-ui.js`
8. `tests/nutrition-ui.test.cjs`
9. `tests/platform-browser-regression.test.cjs`
10. `tests/run-platform-regression.cjs`
11. `tests/static-regression.test.cjs`
12. `tests/sw-event-regression.cjs`
13. `tests/automation-contract.test.cjs`
14. `docs/NUT-010-IMPLEMENTATION.md`

NUT-001–009 dosyaları pakette gereksiz yere yinelenmez. Paket depo köküne, klasör yolları korunarak uygulanır.

## 11. Kabul kontrolü

GitHub Pages dağıtımı tamamlandıktan ve bekleyen uygulama güncellemesi açıkça etkinleştirildikten sonra:

1. Ana ekranda `build: 2.3.0` görünür.
2. Health **Öğün** kartında **Kütüphaneden seç** alanı görünür.
3. Arama alanı, tür filtresi, sonuçlar ve seçilenler listesi görünür.
4. Kütüphane boşsa sade kayıt açıklaması görünür ve öğün kaydı çalışır.
5. Etkin besin/tarif/şablon varsa sonuçlarda türü ve varsayılan porsiyonu görünür.
6. Porsiyonu bilinmeyen besin veya tarifte **Eksik** görünür ve seçim kapalıdır.
7. **Ekle** sonrasında tüketim sayısı değişmez; öğe seçilenler listesine geçer.
8. **Çıkar** seçimi gerçek kayıt oluşturmadan kaldırır.
9. **Öğünü kaydet** sonrasında seçim günlük kayda dönüşür ve seçilenler temizlenir.
10. Önceki güne geçildiğinde kütüphane giriş ve seçim kontrolleri kapanır.
11. Core ve Sky normal açılır; mevcut kullanıcı verileri korunur.

## 12. NUT-010 dışında kalanlar

- Görünür yeni besin/tarif/öğün şablonu oluşturma ve düzenleme,
- gram, mililitre, adet veya porsiyon miktarını ayrıntılı değiştirme,
- barkod tarama,
- ağ tabanlı besin veri kaynağı,
- görünür plan oluşturma veya plan düzenleme,
- hedef kartları ve profil ayar ekranı,
- AI tüketim taslağı ekranı,
- fiziksel ve geri döndürülemez kayıt silme.

Bir sonraki paket başlığı bu kayıtta bağlayıcı olarak sabitlenmemiştir. Mantıksal aday, kullanıcıların görünür biçimde kütüphane öğesi oluşturup sürümlü olarak yönetebilmesi veya seçilen öğenin miktarını güvenli birim kurallarıyla düzenleyebilmesidir.
