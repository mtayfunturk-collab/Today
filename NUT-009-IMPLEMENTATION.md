# Today App — NUT-009 Uygulama Kaydı

**İş paketi:** NUT-009 — Gün Geçmişi ve Beslenme Kayıt Yönetimi  
**Durum:** Tamamlandı; birleşik regresyon başarılı  
**Taban:** NUT-008.1 tamamlanmış Today deposu  
**Tarih:** 6 Ağustos 2026  
**Today uygulama sürümü:** 2.2.0  
**Core veri şeması:** 2  
**Beslenme sözleşmesi / depolama şeması:** 1 / 1  
**Beslenme geçmişi API sürümü:** 1  
**Beslenme UI API sürümü:** 2  
**Çevrimdışı kabuk:** `today-v2-foundation-021`

## 1. Sonuç

NUT-009, NUT-008 ile görünür hâle gelen günlük Health beslenme akışını geçmiş günlere ve güvenli kayıt düzeltmesine genişletir.

Kullanıcı artık Health içinde:

- önceki günlere geçebilir,
- **Bugün** düğmesiyle güncele dönebilir,
- seçili günün öğün, sıvı ve plan özetini görebilir,
- geçmiş günlerde yeni tüketim oluşturmadan kayıtlarını inceleyebilir,
- hatalı tüketim kaydını **Kaldır** işlemiyle günlük toplamdan çıkarabilir,
- arşivlenen kaydı **Geri al** işlemiyle aynı kimlikle yeniden etkinleştirebilir.

Kaldırma fiziksel silme değildir. Tüketim olayı, zamanı, kaynak bilgisi, payload'ı ve bağlı değişmez öğün anlık görüntüleri korunur. Yalnız `recordStatus`, açık kullanıcı işlemiyle `active ↔ archived` arasında yönetilir.

## 2. Ürün kararı

NUT-009 başlığı önceki paketlerde bağlayıcı olarak belirlenmemişti. NUT-008'in kapsam dışında bıraktığı görünür yetenekler arasından, günlük akışın doğal devamı olarak **gün geçmişi ve geri alınabilir kayıt düzeltmesi** seçildi.

Bu seçim şu ilkeleri korur:

- Health görünür ve kullanılabilir biçimde ilerler.
- NUT-001–008 servisleri yeniden yazılmaz.
- Geçmiş tüketim olayları fiziksel olarak silinmez.
- Planlanan öğün gerçek tüketim sayılmaz.
- Bilinmeyen miktar `0` kabul edilmez.
- AI taslağı kullanıcı onayı olmadan etkinleşmez.
- Core `localStorage` alanı ve `today_nutrition` IndexedDB alanı ayrılığı korunur.

## 3. Görünür Health akışı

### 3.1 Gün seçimi

Health özet kartına üç kontrol eklendi:

1. **‹** — önceki gün,
2. **Bugün** — güncel güne doğrudan dönüş,
3. **›** — sonraki gün.

Bugün görüntülenirken sonraki gün ve Bugün düğmeleri devre dışıdır. Bu sürüm gelecek günü tüketim geçmişi olarak açmaz.

Gün aralığı cihazın yerel takvim gününe göre hesaplanır. Tarih anahtarı `YYYY-AA-GG`, sorgu sınırları ise yerel 00:00:00.000 ve 23:59:59.999 değerlerinin ISO karşılıklarıdır.

### 3.2 Geçmiş gün modu

Geçmiş gün görüntülenirken:

- su hızlı ekleme düğmeleri kapalıdır,
- öğün türü ve adı alanları kapalıdır,
- **Öğünü kaydet** kapalıdır,
- planlanan öğünde **Tükettim** işlemi yayımlanmaz,
- salt-okunur durum açıklaması görünür.

Bu kural geçmiş günün yanlışlıkla yeni tüketim üretmesini engeller. Kayıt düzeltme ve geri alma işlemleri açık kalır.

### 3.3 Kaldır ve Geri al

Etkin öğün ve sıvı kayıtlarında **Kaldır** düğmesi görünür. Kullanıcıya, kaydın günlük toplamdan çıkarılacağı fakat güvenlik için arşivde korunacağı açıklanır.

Açık onaydan sonra:

- kayıt kimliği değişmez,
- `recordStatus = archived` olur,
- günlük öğün/sıvı toplamından çıkar,
- koşullu **Arşivlenen kayıtlar** kartında görünür,
- **Geri al** düğmesi kullanılabilir olur.

Geri alma açık kullanıcı onayıyla aynı kaydı `active` durumuna getirir. Kayıt yeniden gün toplamına katılır. Arşivde kayıt kalmadığında arşiv kartı gizlenir.

## 4. Yeni `nutrition-history` servis katmanı

Yeni çalışma zamanı modülü:

```text
modules/nutrition-history.js
```

Yayımlanan API:

```text
TodayNutritionHistory.HISTORY_API_VERSION = 1
TodayNutritionHistory.HISTORY_RULESET_ID = today:nutrition:history:v1
```

Ana yetenekler:

- `dayKeyFromDate(date)`
- `normalizeDayKey(dayKey)`
- `dayRange(dayKey)`
- `isToday(dayKey, now)`
- `shiftDay(dayKey, offset, options)`
- `loadDay(dayKey, options)`
- `archiveEntry(recordId, confirmation)`
- `restoreEntry(recordId, confirmation)`

Servis; NUT-006 tüketim, NUT-007 planlama ve NUT-002 depolama API'lerini kullanır. UI, ağ sağlayıcısı, Core veri alanı, AI veya Connect katmanına bağlanmaz.

## 5. Arşiv denetim izi

Kayıt yönetimi geçmişi ad alanlı uzantıda tutulur:

```text
extensions["today.nutrition.history"]
```

Her olay şu güvenli teknik bilgileri taşır:

- `action`: `archive` veya `restore`,
- `at`: işlem zamanı,
- `actor`: `user`,
- `reason`: sabit kullanıcı düzeltmesi nedeni,
- `clientOperationId`: istemci idempotency kimliği.

Olay listesi son 100 işlemle sınırlıdır. Serbest metin kullanıcı içeriği denetim izine kopyalanmaz.

## 6. Yazma güvenliği

Arşivleme ve geri alma için şu kapılar zorunludur:

- `userInitiated: true`,
- `userConfirmed: true`,
- arşivlemede `confirmEntryArchive: true`,
- geri almada `confirmEntryRestore: true`.

Ek güvenlikler:

- yazmalar tek sekmede sıraya alınır,
- `clientOperationId` aynı işlemin yinelenmesini çoğaltmaz,
- `expectedUpdatedAtById` ile iyimser eşzamanlılık kontrolü yapılır,
- eski zamanlı işlem daha yeni kaydı değiştiremez,
- yalnız gerçek `meal_entry` ve `hydration_entry` kayıtları yönetilebilir,
- AI taslakları bu akışa alınmaz,
- başka türdeki kayıtlar arşivlenmez,
- fiziksel `deleteRecord` çağrısı yapılmaz,
- yazma hatasında mevcut kayıt ve görünür özet korunur.

## 7. Veri ve şema etkisi

NUT-009 yeni IndexedDB store'u veya yeni beslenme kayıt türü oluşturmaz.

| Katman | NUT-008.1 | NUT-009 |
|---|---:|---:|
| Today uygulaması | 2.1.1 | 2.2.0 |
| Core veri şeması | 2 | 2 |
| Beslenme sözleşmesi | 1 | 1 |
| Beslenme depolama şeması | 1 | 1 |
| Beslenme UI API | 1 | 2 |
| Beslenme geçmişi API | — | 1 |
| Çevrimdışı kabuk | foundation-020 | foundation-021 |

Veri migration'ı gerekmemiştir. `today.nutrition.history` mevcut sözleşmenin ad alanlı `extensions` mekanizmasını kullanır.

## 8. Korunan sınırlar

- Today Core ve Today Sky akışları değiştirilmedi.
- Core veri anahtarları okunmadı veya yazılmadı.
- Beslenme verisi yalnız yerel `today_nutrition` deposunda kaldı.
- Mevcut öğün, sıvı, plan, kütüphane, profil ve hesaplama kayıtları taşınmadı.
- Öğün anlık görüntüleri değiştirilmedi veya silinmedi.
- Planlanan öğün açık **Tükettim** onayı olmadan gerçek kayda dönüşmedi.
- Bilinmeyen sıvı miktarı toplama `0` olarak katılmadı.
- AI/Connect görünür ana modül yapılmadı.
- Ağ veya harici sağlayıcı eklenmedi.

## 9. Erişilebilirlik ve mobil koruma

- Gün düğmeleri gerçek `button` kontrolleridir.
- Önceki ve sonraki gün düğmelerinin açıklayıcı `aria-label` değerleri vardır.
- Kaldır ve geri al düğmelerinin kayıt adına göre üretilen erişilebilir etiketleri vardır.
- Yazma ve gün yükleme sırasında ilgili kontroller devre dışı kalır.
- Geçmiş gün açıklaması görünür metin olarak sunulur.
- NUT-008.1 `minmax(0, 1fr)` ve `min-width: 0` mobil genişlik korumaları aynen sürer.
- Yeni kayıt yönetimi düğmeleri flex taşmasına karşı küçülebilen içerik alanıyla birlikte çalışır.

## 10. Doğrulama

Birleşik platform regresyon kapısı:

```text
Platform Regression Gate: 1022/1022 başarılı
```

İlgili alt kapılar:

- Beslenme geçmişi servisi: **54/54**
- Health UI: **76/76**
- Gerçek uygulama akışı + IndexedDB: **41/41**
- Statik mimari ve mobil genişlik koruması: **30/30**
- Service Worker olayları: **36/36**
- Otomasyon sözleşmesi: **8/8**

NUT-009 ile 77 yeni doğrulama eklenmiştir:

- 54 yeni geçmiş/arşiv servis testi,
- 19 yeni Health UI testi,
- 4 yeni gerçek tarayıcı ve IndexedDB entegrasyon testi.

Önceki 945 testin tamamı korunmuştur.

## 11. Teslim dosyaları

NUT-009 yükleme paketi yalnız yeni veya değişen 16 dosyayı içerir:

1. `index.html`
2. `sw.js`
3. `package.json`
4. `package-lock.json`
5. `modules/storage.js`
6. `modules/version.js`
7. `modules/nutrition-history.js`
8. `modules/nutrition-ui.js`
9. `tests/nutrition-history.test.cjs`
10. `tests/nutrition-ui.test.cjs`
11. `tests/platform-browser-regression.test.cjs`
12. `tests/run-platform-regression.cjs`
13. `tests/static-regression.test.cjs`
14. `tests/sw-event-regression.cjs`
15. `tests/automation-contract.test.cjs`
16. `docs/NUT-009-IMPLEMENTATION.md`

NUT-001–008.1 dosyaları pakette gereksiz yere yinelenmez. Paket depo köküne, klasör yolları korunarak uygulanır.

## 12. Kabul kontrolü

GitHub Pages dağıtımı tamamlandıktan ve bekleyen uygulama güncellemesi açıkça etkinleştirildikten sonra:

1. Ana ekranda `build: 2.2.0` görünür.
2. Health özet kartında **‹ / Bugün / ›** gün kontrolleri görünür.
3. Bugünde **›** ve **Bugün** devre dışıdır.
4. **‹** ile önceki gün açılır.
5. Geçmiş günde su ve öğün girişleri devre dışıdır.
6. Geçmiş planlarda **Tükettim** işlemi görünmez.
7. Etkin öğün ve sıvı kayıtlarında **Kaldır** görünür.
8. Kaldırma onayından sonra kayıt toplamdan çıkar ve arşiv kartına geçer.
9. **Geri al** aynı kaydı yeniden etkinleştirir.
10. Core ve Sky normal açılır; mevcut kullanıcı verileri korunur.

## 13. NUT-009 dışında kalanlar

- Besin ve tarif kütüphanesinde görünür arama/seçim,
- ayrıntılı miktar ve porsiyon girişi,
- görünür plan oluşturma veya plan düzenleme,
- hedef kartları ve profil ayar ekranı,
- AI tüketim taslağı ekranı,
- ağ tabanlı besin veri kaynağı,
- fiziksel ve geri döndürülemez kayıt silme.

Bir sonraki paket başlığı bu kapanış kaydında bağlayıcı olarak sabitlenmemiştir. Mantıksal aday, NUT-005 kütüphane altyapısını görünür öğün girişine bağlayan besin/tarif arama ve seçim akışıdır.
