# Today App — NUT-008 Uygulama Kaydı

**İş paketi:** NUT-008 — Health Beslenme Arayüzü ve Günlük Akış  
**Durum:** Tamamlandı; birleşik regresyon başarılı  
**Uygulama tabanı:** NUT-007 tamamlanmış tabanı  
**Today uygulama sürümü:** 2.1.0  
**Core veri şeması:** 2  
**Beslenme sözleşmesi / depolama şeması:** 1 / 1  
**Beslenme UI API sürümü:** 1  
**Beslenme UI kural seti:** today:nutrition:ui:v1  
**Çevrimdışı kabuk:** today-v2-foundation-019  
**Tarih:** 6 Ağustos 2026

## 1. Sonuç

NUT-008, NUT-001–007 arasında hazırlanan beslenme sözleşmesi, yerel depo, hesaplama, profil, kütüphane, hızlı kayıt ve planlama servislerini ilk kez Today Health içindeki görünür kullanıcı akışına bağlar.

Health ekranındaki eski “Yakında” yer tutucusu kaldırılmıştır. Kullanıcı artık Health modülünü açtığında:

- Bugünün öğün, sıvı ve bekleyen plan özetini görür.
- Tek dokunuşla 250 ml veya 500 ml su kaydeder.
- Öğün türünü seçip isteğe bağlı bir adla sade öğün kaydı oluşturur.
- Ad girmeden yalnız öğünün gerçekleştiğini kaydedebilir.
- Bugüne ait planlanan öğünleri ve durumlarını görür.
- Yalnız “Tükettim” düğmesine açıkça basarak planlanan öğünü gerçek tüketime dönüştürür.
- Bugünkü gerçek öğün ve sıvı kayıtlarını zaman sırasıyla görür.
- Kayıt veya okuma hatasında mevcut verilerin silinmediğini açıklayan güvenli durum mesajı alır.

Today Core ve Today Sky akışları korunmuştur. Health beslenme yazmaları Core localStorage kayıtlarını değiştirmez.

## 2. Neden önce görünür değişiklik yoktu?

NUT-001–007 paketleri kasıtlı olarak servis ve veri katmanlarını hazırladı:

| Paket | Hazırlanan katman | NUT-008 öncesi Health’te görünür müydü? |
|---|---|---:|
| NUT-001 | Beslenme veri sözleşmeleri | Hayır |
| NUT-002 | IndexedDB depolama ve migration | Hayır |
| NUT-003 | Birim ve besin hesaplama | Hayır |
| NUT-004 | Profil, kısıt ve hedef sürümleme | Hayır |
| NUT-005 | Besin, tarif ve öğün kütüphanesi | Hayır |
| NUT-006 | Hızlı öğün ve sıvı kayıt servisi | Hayır; form ayrıca bekletildi |
| NUT-007 | Öğün planı ve planlanan öğün servisi | Hayır; plan görünümü ayrıca bekletildi |
| NUT-008 | Health beslenme UI bağlayıcısı | Evet |

Önceki paketlerin görünür ekranı değiştirmemesi eksik yükleme değil, kullanıcı arayüzünü doğrulanmamış servislerin önüne geçirmeme kararıydı. NUT-008 bu ayrımı kapatır.

## 3. Görünür Health akışı

### Gün özeti

Özet yalnız bugünün gerçek kayıtlarını ve bugünün planlarını kullanır:

- Öğün sayısı `meal_entry` kayıtlarından gelir.
- Sıvı toplamı `hydration_entry` ölçümlerinin uyumlu hacim birimlerinden mililitreye çevrilmesiyle gösterilir.
- Bekleyen plan sayısı yalnız `planned_meal.payload.status = planned` kayıtlarını içerir.
- AI taslakları varsayılan sorgulara alınmaz.
- Planlanan öğün gerçek öğün sayısına eklenmez.

### Hızlı su kaydı

250 ml ve 500 ml düğmeleri NUT-006 `logWater` kapısını kullanır. Her dokunuş:

- Bilinen, pozitif ve `ml` birimli ayrı bir `hydration_entry` oluşturur.
- `userInitiated: true` ve `userConfirmed: true` taşır.
- Çift dokunuş riskine karşı tekil istemci işlem kimliği taşır.
- Kayıt tamamlanınca gün özetini ve listeyi yeniden okur.

### Sade öğün kaydı

Kullanıcı Kahvaltı, Öğle, Akşam, Ara öğün veya Diğer türlerinden birini seçebilir.

- Ad yazılırsa NUT-006 bu adı yeni `meal_item_snapshot` içinde saklar.
- Ad yazılmazsa `coverage: unspecified` ile ayrıntısız gerçek öğün kaydı oluşur.
- Kalori veya makro zorunlu değildir.
- UI besin değeri üretmez veya tahmin etmez.
- Başarılı yazımdan sonra metin alanı temizlenir.
- Başarısız yazımda kullanıcının yazdığı metin korunur.

### Bugünün planı

NUT-008, NUT-007 plan sorgusunu görünür hâle getirir.

- Planlandı, Kaydedildi, Atlandı ve İptal durumları birbirinden ayrılır.
- Yalnız `planned` durumundaki öğün “Tükettim” düğmesi taşır.
- “Tükettim” eylemi NUT-007 `consumePlannedMeal` üzerinden NUT-006 `logPlannedMeal` kapısına gider.
- İşlem `confirmPlanConsumption: true` ikinci açık onayını taşır.
- Başarılı işlem yeni gerçek `meal_entry` ve yeni tüketim snapshotları oluşturur; planlanan öğün `linked` olur.
- Plan zamanı kendiliğinden tüketim zamanı sayılmaz.

## 4. Bilinmeyen değer ilkesi

NUT-008 bilinmeyen besin veya miktar değerini sıfır gibi göstermez.

- Kalori ve makro UI içinde hesaplanmaz.
- Sade öğün besin değeri yoksa öğün yine kaydedilebilir; bilgi durumu `unknown` kalır.
- `unknown` sıvı miktarı günlük toplamın içine eklenmez.
- Toplam dışında bırakılan bilinmeyen sıvı için kullanıcıya açıklayıcı not gösterilir.
- Tahmini sıvı ölçümü toplamda kullanılırsa özet “yaklaşık” olarak etiketlenir.
- Uyumsuz hacim birimi UI içinde varsayımla dönüştürülmez.

## 5. Mimari sınır

Yeni çalışma zamanı API’si:

    window.TodayNutritionUI

Bağımlılık yönü:

    Health DOM
       ↓
    NUT-008 TodayNutritionUI
       ↓
    NUT-006 TodayNutritionEntry
    NUT-007 TodayNutritionPlanning
       ↓
    NUT-002 TodayNutritionStorage

Sıvı gösterim dönüşümü:

    TodayNutritionUI
       ↓
    NUT-003 TodayNutritionCalculations.convertMeasurement

NUT-008:

- Doğrudan IndexedDB transaction’ı açmaz.
- Core localStorage anahtarlarını okumaz veya yazmaz.
- Besin değeri hesaplamaz.
- Gerçek AI veya Connect sağlayıcısı çağırmaz.
- Kalıcı kayıt silme işlevi yayımlamaz.
- Modül dosyası yüklenirken veri okumaz veya yazmaz.
- `init` sırasında yalnız DOM olaylarını bağlar.
- Beslenme verisini ilk kez kullanıcı Health rotasını açınca okur.
- Bütün yazmaları NUT-006/007 servis onay kapılarından geçirir.

## 6. API yüzeyi

`window.TodayNutritionUI` şu üyeleri yayımlar:

| Üye | İşlev |
|---|---|
| UI_API_VERSION | UI API sürümü |
| UI_RULESET_ID | UI kural seti kimliği |
| MAX_VISIBLE_ENTRIES | Görünür günlük kayıt sınırı |
| MAX_VISIBLE_PLANNED_MEALS | Görünür plan sınırı |
| MEAL_LABELS | Öğün türlerinin Türkçe etiketleri |
| PLAN_STATUS_LABELS | Plan durumlarının Türkçe etiketleri |
| REQUIRED_IDS | Zorunlu Health DOM kimlikleri |
| init | Olayları bağlar; kalıcı veri okumaz |
| open | Health açılışını işaretler ve bugünü yükler |
| refresh | Gün özeti, plan ve kayıt listelerini yeniler |
| getState | UI yaşam döngüsü ve son özet durumunu döndürür |

API ve yayımlanan sabitler dışarıdan değiştirilemez.

## 7. Erişilebilirlik ve mobil davranış

- Health görünümü tek bir `h1` ve anlamlı bölüm `h2` başlıkları kullanır.
- Form alanları görünür etiketlere bağlıdır.
- Kayıt ve hata mesajları `role=status`, `aria-live=polite` alanında duyurulur.
- Dashboard yazma sırasında `aria-busy=true` olur.
- Yazma sırasında bütün Health eylemleri devre dışı bırakılır.
- Dokunma hedefleri en az 44 piksel yüksekliğindedir.
- Plan tüketim düğmeleri öğün adını içeren erişilebilir etiket taşır.
- Küçük ekranlarda öğün alanları tek kolona iner.
- Koyu, açık ve yüksek kontrast tema değişkenleri korunur.
- Alt modül navigasyonu kaydırma sırasında erişilebilir kalır.

## 8. Sürüm değişiklikleri

| Katman | NUT-007 | NUT-008 | Gerekçe |
|---|---:|---:|---|
| Today uygulaması | 2.0.0 | 2.1.0 | İlk görünür Health beslenme özelliği |
| Core veri şeması | 2 | 2 | Core modeli değişmedi |
| Beslenme sözleşmesi | 1 | 1 | Yeni kayıt türü yok |
| Beslenme depolama şeması | 1 | 1 | Yeni store veya indeks yok |
| Beslenme UI API | — | 1 | Yeni görünür bağlayıcı |
| Çevrimdışı kabuk | foundation-018 | foundation-019 | Yeni UI modülü ve index değişikliği |
| Kabuk dosya sayısı | 25 | 26 | `nutrition-ui.js` eklendi |

`modules/storage.js` ile `modules/version.js` birlikte 2.1.0’a yükseltilmiştir. Böylece migration sürüm hizalama kontrolü korunur. Veri şeması değişmediği için yeni Core veya beslenme migration’ı çalışmaz.

## 9. Hata ve eşzamanlılık davranışı

- Arayüz bağımlılığı veya zorunlu DOM öğesi eksikse uygulama kontrollü başlangıç hatası verir.
- Gün okuması başarısızsa Health “kayıtların silinmedi” mesajını gösterir.
- Snapshot adı okunamazsa ana öğün kaydı gizlenmez; öğün türü yedek etiket olur.
- Devam eden yazma sırasında ikinci UI yazması başlatılmaz.
- Eylemler tekil istemci işlem kimliği taşır.
- Yazma başarısızsa mevcut listeler ve kullanıcının öğün metni korunur.
- Yenileme istekleri sıra kimliği kullanır; eski asenkron sonuç yeni sonucu ezmez.

## 10. Doğrulama sonucu

Yeni ve güncellenen doğrulamalar:

- NUT-008 özel UI kabul matrisi: **57/57**
- Gerçek tarayıcı + IndexedDB akışı: **37/37**
- Statik mimari regresyon: **30/30**
- Service Worker olay regresyonu: **36/36**
- Otomasyon sözleşmesi: **8/8**
- Önceki NUT-001–007 ve platform testleri korunmuştur.

Birleşik sonuç:

    Platform Regression Gate: 945/945 başarılı

Gerçek tarayıcı entegrasyonu şu akışları doğrular:

1. Health’in “Yakında” yerine canlı panel açması.
2. 250 ml su kaydının gerçek IndexedDB `hydration_entry` oluşturması.
3. Adlı sade öğünün kalori uydurmadan gerçek `meal_entry` oluşturması.
4. Planlanan öğünün yalnız “Tükettim” onayıyla gerçek tüketime dönüşmesi.
5. Health yazmalarının Core localStorage kaydını değiştirmemesi.

## 11. NUT-008 teslim dosyaları

NUT-007 tabanına göre yeni veya değişen uygulama dosyaları:

1. `index.html`
2. `modules/nutrition-ui.js`
3. `modules/storage.js`
4. `modules/version.js`
5. `package.json`
6. `package-lock.json`
7. `sw.js`
8. `tests/automation-contract.test.cjs`
9. `tests/nutrition-ui.test.cjs`
10. `tests/platform-browser-regression.test.cjs`
11. `tests/run-platform-regression.cjs`
12. `tests/static-regression.test.cjs`
13. `tests/sw-event-regression.cjs`
14. `docs/NUT-008-IMPLEMENTATION.md`

## 12. Devir sınırı

NUT-008 aşağıdaki alanları bilerek kapsam dışında bırakır:

- Health içinde yeni öğün planı oluşturma ve düzenleme formu.
- Görünür besin/tarif/öğün şablonu arama ve seçim ekranı.
- Kalori/makro hedef kartları ve besin ayrıntı ekranı.
- Profil, alerji, tercih ve hedef ayarlarının görünür yönetimi.
- Geçmiş gün Health takvimi ve dönem istatistikleri.
- Hatırlatıcı, bildirim veya Connect entegrasyonu.
- AI öneri veya plan taslağı ekranı.

Sonraki paket bu alanlardan birini açarken şu sınırları korumalıdır:

- Mevcut NUT-001–008 servis ve UI katmanları yeniden yazılmamalıdır.
- Plan ile gerçek tüketim ayrımı korunmalıdır.
- Bilinmeyen değer sıfır gösterilmemelidir.
- AI taslakları açık onay olmadan gerçek kayda dönüşmemelidir.
- Core localStorage ve `today_nutrition` sınırı karıştırılmamalıdır.
- Health’in sade ve düşük eforlu ürün dili korunmalıdır.
