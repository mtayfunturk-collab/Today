# Today App — NUT-011 Uygulama Kaydı

**İş paketi:** NUT-011 — Besin ve Tarif Kütüphanesi Yönetimi  
**Durum:** Tamamlandı; birleşik regresyon başarılı  
**Taban:** NUT-010 tamamlanmış Today deposu  
**Tarih:** 6 Ağustos 2026  
**Today uygulama sürümü:** 2.4.0  
**Core veri şeması:** 2  
**Beslenme sözleşmesi / depolama şeması:** 1 / 1  
**Beslenme kütüphanesi API sürümü:** 2  
**Beslenme kütüphanesi yönetim UI API sürümü:** 1  
**Günlük beslenme UI API sürümü:** 3  
**Çevrimdışı kabuk:** `today-v2-foundation-023`

## 1. Sonuç

NUT-011, NUT-005'te hazırlanan sürümlü yerel beslenme kütüphanesini Today Health içinde görünür bir kullanıcı yönetim akışına bağlar.

Kullanıcı artık Health içindeki **Kütüphanem** kartında:

- kendi besinini oluşturabilir,
- besinin varsayılan miktarını ve isteğe bağlı kalori/makrolarını girebilir,
- kütüphanedeki etkin besin veya tarifleri bileşen seçerek kendi tarifini oluşturabilir,
- kullanıcı kaydını geçmiş sürümü ezmeden düzenleyebilir,
- etkin kullanıcı kaydını arşivleyebilir,
- arşivlenen kaydı aynı kimlikle yeniden etkinleştirebilir.

Kütüphane yönetimi, öğün tüketiminden ayrıdır. Bir besin veya tarif oluşturmak tüketim kaydı üretmez; tüketim yalnız NUT-010 seçim alanı ve NUT-006 **Öğünü kaydet** kapısı üzerinden oluşur.

## 2. Ürün kararı ve kapsam

NUT-010 kapanışında görünür besin/tarif oluşturma ile ayrıntılı tüketim miktarı düzenleme iki mantıksal aday olarak bırakılmıştı. NUT-011, kullanıcının boş kütüphane durumunu kendi verisiyle doldurabilmesini sağlayan ilk adımı seçer.

Bu paketin kapsamı:

1. kullanıcı besini oluşturma,
2. kullanıcı tarifi oluşturma,
3. besin/tarif düzenlemesini yeni sürüm olarak kaydetme,
4. kullanıcı kaydını arşivleme ve geri alma,
5. yeni kayıtların NUT-010 arama/seçim alanına anında yansımasıdır.

Bu pakette öğün şablonu editörü, barkod tarama, ağ tabanlı besin veri kaynağı ve tüketim sırasında ayrıntılı gram/porsiyon düzenleme açılmaz.

## 3. Görünür Health akışı

### 3.1 Kütüphanem kartı

Health günlük akışına **Kütüphanem** kartı eklendi. Kartta:

- **+ Besin ekle**,
- **+ Tarif ekle**,
- etkin kullanıcı kayıtları,
- her etkin kayıtta **Düzenle / Arşivle**,
- gerektiğinde görünen **Arşivlenenler / Geri al** alanı bulunur.

Kart yalnız `source.kind = manual` ve `verificationStatus = user_confirmed` olan kullanıcı besin ve tariflerini yönetilebilir gösterir. Doğrulanmış veri paketi kayıtları öğün ve tarif bileşeni seçiminde kullanılabilir; ancak kullanıcı kaydı gibi düzenlenemez veya arşivlenemez. AI taslakları hiçbir yönetim ya da bileşen listesine girmez.

### 3.2 Besin oluşturma

Besin formu şu alanları sunar:

- ad,
- varsayılan miktar ve birim,
- isteğe bağlı kalori,
- isteğe bağlı protein,
- isteğe bağlı karbonhidrat,
- isteğe bağlı yağ,
- isteğe bağlı etiketler,
- isteğe bağlı hazırlama biçimi.

Varsayılan yeni besin miktarı `100 g` olarak açılır; kullanıcı bunu değiştirebilir. Miktar sonlu ve sıfırdan büyük olmalıdır.

Kalori veya makro alanının boş bırakılması `0` anlamına gelmez. Boş alanlar sözleşmeye uygun biçimde:

```text
status = unknown
value = null
```

olarak kaydedilir. Kullanıcının gerçekten girdiği `0` değeri ise bilinen gerçek sıfır olarak korunur.

### 3.3 Tarif oluşturma

Tarif formu:

- tarif adı,
- tarifin toplam miktarı/birimi,
- etkin besin veya tarif araması,
- seçilen her bileşen için miktar ve uyumlu birim,
- etiket ve hazırlama biçimi alanlarını içerir.

Bir tarif en az bir, en fazla 30 bileşen taşır. Bileşen araması yalnız cihazdaki etkin, doğrulanmış ve kullanılabilir varsayılan miktarı bulunan besin/tarif sürümlerini gösterir.

Birim seçenekleri NUT-003 deterministik birim kurallarıyla sınırlandırılır:

- kütle yalnız kütle birimleriyle,
- hacim yalnız hacim birimleriyle,
- bağlamsal birimler yalnız kendi kimlikleriyle kullanılabilir.

Kütle/hacim dönüşümü için yoğunluk varsayılmaz. Tarif kaydedildiğinde NUT-005 her bileşeni güncel kaynak kaydı ve sürümüyle yeni değişmez `meal_item_snapshot` kayıtlarına dönüştürür.

### 3.4 Düzenleme

**Düzenle** işlemi etkin kaydı yerinde değiştirmez:

- mevcut sürüm `superseded` olur,
- mantıksal kimlik korunur,
- sürüm `patch` düzeyinde artar (`1.0.0 → 1.0.1`),
- yeni etkin kayıt oluşur,
- geçmiş tüketim ve tarif snapshotları değişmez kalır.

Tarif düzenlenirken eski bileşen snapshotı superseded bir besin sürümüne dayanıyorsa yönetim UI'ı aynı mantıksal kimliğin güncel etkin sürümünü bulur. Artık etkin kaynağı bulunmayan bileşen sessizce uydurulmaz; kullanıcıya gözden geçirme uyarısı verilir.

Formda hiçbir gerçek değişiklik yoksa NUT-005 mevcut sürümü korur ve gereksiz yeni sürüm oluşturmaz.

### 3.5 Arşivleme ve geri alma

Arşivleme ayrıca kullanıcı onayı gerektirir. İşlem:

- fiziksel silme yapmaz,
- kaydı etkin arama/seçim sonuçlarından çıkarır,
- geçmiş öğün ve tarif snapshotlarını değiştirmez,
- kaydı **Arşivlenenler** alanında korur.

NUT-011 ile kütüphane servisine `restoreItem()` eklendi. **Geri al** işlemi yalnız arşivlenmiş kayıt için ve açık kullanıcı onayıyla çalışır; aynı mantıksal öğenin başka etkin sürümü varsa çakışmayı engeller. Başarılı geri alma aynı kayıt kimliğini yeniden `active` yapar.

## 4. Ayrı yönetim UI modülü

Yeni çalışma zamanı modülü:

```text
modules/nutrition-library-ui.js
```

Yayımlanan sözleşme:

```text
TodayNutritionLibraryUI.MANAGER_API_VERSION = 1
TodayNutritionLibraryUI.MANAGER_RULESET_ID = today:nutrition:library-ui:v1
```

Modül:

- kendi kalıcı deposunu açmaz,
- besin değeri hesaplamaz,
- Core `localStorage` alanına erişmez,
- ağ veya AI sağlayıcısı çağırmaz,
- yazmaları yalnız `TodayNutritionLibrary` servisine devreder,
- başarılı değişiklikten sonra NUT-010 öğün seçim listesini yeniler.

`init()` yalnız DOM olaylarını bağlar; sayfa açılışında IndexedDB okuması veya yazması oluşturmaz. Yerel kütüphane Health rotası açılınca `open()` üzerinden okunur.

## 5. Kütüphane API v2

NUT-011, mevcut NUT-005 servisini yeniden yazmaz. Yalnız geri alınabilir arşiv yönetimi için API'yi sürümler:

```text
TodayNutritionLibrary.LIBRARY_API_VERSION = 2
TodayNutritionLibrary.LIBRARY_RULESET_ID = today:nutrition:library:v2
```

Yeni yayımlanan işlem:

```text
restoreItem(recordId, confirmation)
```

`createFood`, `updateFood`, `createRecipe`, `updateRecipe`, `archiveItem`, AI taslak sınırları, doğrulanmış veri paketi ayrımı ve snapshot kuralları korunur.

## 6. Veri ve şema etkisi

NUT-011 yeni IndexedDB store'u, beslenme kayıt türü veya migration oluşturmaz.

| Katman | NUT-010 | NUT-011 |
|---|---:|---:|
| Today uygulaması | 2.3.0 | 2.4.0 |
| Core veri şeması | 2 | 2 |
| Beslenme sözleşmesi | 1 | 1 |
| Beslenme depolama şeması | 1 | 1 |
| Beslenme kütüphanesi API | 1 | 2 |
| Beslenme giriş API | 1 | 1 |
| Günlük beslenme UI API | 3 | 3 |
| Kütüphane yönetim UI API | — | 1 |
| Çevrimdışı kabuk | foundation-022 | foundation-023 |

Uygulama ve Core depolama sürüm damgaları `2.4.0` olarak birlikte yükseltilmiştir. Veri şemaları aynı kaldığı için migration gerekmez.

## 7. Korunan sınırlar

- Today Core ve Today Sky akışları değiştirilmedi.
- Core veri anahtarları beslenme yönetimi tarafından okunmadı veya yazılmadı.
- Beslenme verisi yalnız yerel `today_nutrition` IndexedDB alanında kaldı.
- Besin/tarif oluşturma tüketim kaydı üretmedi.
- Geçmiş tüketim ve tarif snapshotları düzenleme, arşivleme veya geri almada değiştirilmedi.
- Doğrulanmış veri paketi kaydı kullanıcı kaydı gibi gösterilmedi.
- AI taslağı görünür yönetim veya bileşen seçimine alınmadı.
- Bilinmeyen besin değeri `0` yapılmadı.
- Uyumsuz birimler varsayımla dönüştürülmedi.
- Planlanan öğün açık **Tükettim** onayı olmadan tüketim sayılmadı.
- Fiziksel ve geri döndürülemez silme API'si eklenmedi.
- Ağ, barkod, harici besin sağlayıcısı, AI veya Connect çağrısı eklenmedi.

## 8. Geçmiş gün davranışı

NUT-009 ve NUT-010 kuralları korunur:

- geçmiş günde yeni öğün/su kaydı kapalıdır,
- geçmiş günde kütüphaneden öğün seçme kontrolleri salt okunurdur,
- eski tüketim yalnız görüntülenebilir veya geri alınabilir biçimde arşivlenebilir.

**Kütüphanem** global cihaz kütüphanesidir; seçili güne ait tüketim işlemi değildir. Bu nedenle geçmiş gün görüntülenirken de kullanıcı kütüphanesi yönetilebilir. Her yönetim değişikliğinin geçmiş tüketim snapshotlarını değiştirmediği form ve durum metinlerinde açıkça belirtilir.

## 9. Erişilebilirlik ve mobil koruma

- Bütün form kontrolleri görünür etiket taşır.
- Oluşturma, düzenleme, arşivleme ve geri alma gerçek `button` öğeleridir.
- Yönetim ve form durumları ayrı `aria-live="polite"` yüzeyinde bildirilir.
- Kayıt sayıları açıklayıcı `aria-label` değerleri taşır.
- Tarif bileşeni miktar ve birim alanları bileşen adıyla erişilebilir biçimde etiketlenir.
- Yazma sırasında ilgili yönetim kontrolleri devre dışı kalır.
- Dar ekranda editör, besin değeri, metadata ve eylem gridleri `minmax(0, 1fr)` tek sütuna döner.
- Tarif bileşeni kartları mobilde dikey yerleşir.
- NUT-008.1 dış grid, kart genişliği ve `min-width: 0` korumaları aynen sürer.

## 10. Doğrulama

Birleşik platform regresyon kapısı:

```text
Platform Regression Gate: 1116/1116 başarılı
```

İlgili alt kapılar:

- Beslenme kütüphanesi servisi: **98/98**
- Yeni kütüphane yönetim UI: **52/52**
- Günlük Health UI: **106/106**
- Gerçek uygulama akışı + IndexedDB: **48/48**
- Statik mimari ve mobil genişlik koruması: **30/30**
- Service Worker olayları: **36/36**
- Otomasyon sözleşmesi: **8/8**

NUT-011 ile 61 yeni doğrulama eklenmiştir:

- 5 yeni kütüphane servis testi,
- 52 yeni bağımsız kütüphane yönetim UI testi,
- 4 yeni gerçek tarayıcı ve IndexedDB entegrasyon testi.

Önceki 1055 testin tamamı korunmuştur.

Gerçek entegrasyon akışında:

1. Health formundan kullanıcı besini oluşturuldu,
2. boş makroların `unknown/null` kaldığı doğrulandı,
3. düzenleme ile `1.0.1` sürümü oluştu,
4. tarif güncel besin sürümünden bileşen snapshotı üretti,
5. tarif arşivlenip geri alındı,
6. bileşen snapshotının bütün süreçte değişmediği doğrulandı.

## 11. Teslim dosyaları

NUT-011 yükleme paketi yalnız yeni veya değişen 16 dosyayı içerir:

1. `index.html`
2. `sw.js`
3. `package.json`
4. `package-lock.json`
5. `modules/storage.js`
6. `modules/version.js`
7. `modules/nutrition-library.js`
8. `modules/nutrition-library-ui.js`
9. `tests/nutrition-library.test.cjs`
10. `tests/nutrition-library-ui.test.cjs`
11. `tests/platform-browser-regression.test.cjs`
12. `tests/run-platform-regression.cjs`
13. `tests/static-regression.test.cjs`
14. `tests/sw-event-regression.cjs`
15. `tests/automation-contract.test.cjs`
16. `docs/NUT-011-IMPLEMENTATION.md`

NUT-001–010 dosyaları pakette gereksiz yere yinelenmez. Paket Today deposunun köküne, klasör yolları korunarak uygulanır.

## 12. Kabul kontrolü

GitHub Pages dağıtımı tamamlandıktan ve bekleyen uygulama güncellemesi açıkça etkinleştirildikten sonra:

1. Ana ekranda `build: 2.4.0` görünür.
2. Health içinde **Kütüphanem** kartı görünür.
3. **+ Besin ekle** ile besin formu açılır.
4. Boş bırakılan kalori/makrolar zorunlu olmaz ve `0` gösterilmez.
5. Kaydedilen besin etkin kayıt listesinde ve NUT-010 aramasında görünür.
6. **+ Tarif ekle** ile etkin besin/tarifler bileşen olarak seçilebilir.
7. Tarif bileşeni için miktar ve uyumlu birim değiştirilebilir.
8. **Düzenle** sonrasında kayıt sürümü artar; eski tüketimler değişmez.
9. **Arşivle** sonrasında kayıt etkin listeden ayrılır ve arşiv alanında görünür.
10. **Geri al** sonrasında aynı kayıt etkin listeye döner.
11. Core, Sky, günlük öğün/su, geçmiş gün ve plan akışları normal çalışır.

## 13. NUT-011 dışında kalanlar

- Görünür öğün şablonu oluşturma ve düzenleme,
- tüketim seçiminde gram/mililitre/adet/porsiyon miktarını değiştirme,
- barkod tarama,
- ağ tabanlı doğrulanmış besin veri kaynağı,
- toplu içe aktarma,
- görünür plan oluşturma veya plan düzenleme,
- hedef kartları ve profil ayar ekranı,
- AI kütüphane taslağı ekranı,
- fiziksel ve geri döndürülemez kayıt silme.

Bir sonraki paket başlığı bu kayıtta bağlayıcı olarak sabitlenmemiştir. Mantıksal aday, NUT-010 seçiminde öğün miktarını güvenli birim kurallarıyla düzenlemek veya görünür öğün şablonu yönetimini açmaktır.
