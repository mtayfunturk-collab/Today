# Today App — NUT-002 Uygulama Kaydı

**İş paketi:** NUT-002 — IndexedDB Tabanlı Çevrimdışı Beslenme Veri Katmanı ve Şema Geçişleri  
**Durum:** Tamamlandı; birleşik regresyon başarılı  
**Uygulama tabanı:** Today App `2.0.0`, Core veri şeması `2`, NUT-001 sözleşmesi `1`  
**Beslenme depolama şeması:** `1`  
**IndexedDB fiziksel sürümü:** `1`  
**Çevrimdışı kabuk:** `today-v2-foundation-013`  
**Tarih:** 5 Ağustos 2026

## 1. Sonuç

NUT-002, NUT-001’de tanımlanan 23 beslenme veri nesnesi için çalışan, çevrimdışı ve transaction tabanlı bir kalıcı veri sınırı oluşturur.

Bu iş paketi:

- Yalnız NUT-001 sözleşmesinden geçen beslenme kayıtlarını yazar.
- IndexedDB içinde beslenmeye ait ayrı bir veri alanı kullanır.
- Çoklu yazmaları tek transaction içinde atomik olarak gerçekleştirir.
- Tam depo yazmalarında referans bütünlüğünü zorunlu tutar.
- Planlanan ve tüketilen kayıtları ayrı sorgu kapılarından döndürür.
- AI taslaklarını varsayılan etkin kayıt sorgusuna karıştırmaz.
- Manuel ve migration öncesi kurtarma noktaları oluşturur.
- Başarısız migration’da özgün kayıtları değiştirmez.
- Dışa aktarma ve içe aktarma için sürümlü anlık görüntü sözleşmesi sağlar.
- Yeni modülleri `index.html` ve çevrimdışı uygulama kabuğuna bağlar.

Health ekranına yeni arayüz veya kullanıcı girişi eklenmemiştir.

## 2. Depolama sınırı

Beslenme kayıtları şu bağımsız veritabanında tutulur:

```text
today_nutrition
```

Today Core kayıtları mevcut `TodayStorage` ve `localStorage` alanında kalır. NUT-002:

- `today_store_v2` anahtarını okumaz veya yazmaz.
- Core, Takvim, İstatistik ve Ayarlar kayıtlarını taşımaya çalışmaz.
- Var olan Core migration akışını değiştirmez.
- Beslenme verisini Core veri nesnesinin içine gömmez.

Bu nedenle Today ana veri şeması `2` olarak korunur. Beslenme depolama şeması ve beslenme sözleşmesi ayrı sürümlenir.

## 3. Sürüm katmanları

| Katman | Sürüm | İşlev |
|---|---:|---|
| Today uygulaması | `2.0.0` | Uygulamanın genel sürümü |
| Today Core veri şeması | `2` | Mevcut localStorage kayıtları |
| Beslenme sözleşmesi | `1` | Kayıt biçimi ve semantik kurallar |
| Beslenme depolama şeması | `1` | IndexedDB depo yapısı |
| IndexedDB fiziksel sürümü | `1` | Store ve indeks kurulumu |
| Migration planı | `1` | Beslenme sözleşmesi geçiş adımları |
| Anlık görüntü sözleşmesi | `today:nutrition:storage-snapshot:v1` | Taşınabilir depo görüntüsü |

## 4. Fiziksel IndexedDB şeması

| Store | Anahtar | Sorumluluk |
|---|---|---|
| `records` | `id` | Doğrulanmış beslenme kayıtları |
| `metadata` | `key` | Depolama ve sözleşme sürümü, son migration |
| `migration_backups` | `id` | Migration ve geri yükleme kurtarma noktaları |

`records` store’u şu indeksleri taşır:

- `by_type`
- `by_record_status`
- `by_source_kind`
- `by_updated_at`
- `by_event_at`
- `by_type_and_status`
- `by_type_and_event_at`
- `by_schema_version`

Yedekler oluşturulma zamanı ve durumuna göre indekslenir.

## 5. Yazma kapısı

Tek veya çoklu kayıt yazımında sıra değişmezdir:

1. Her kayıt `TodayNutritionContracts.validateRecord` ile doğrulanır.
2. Kayıt bağımsız kopyaya çevrilir.
3. Mevcut tam depo ile birleştirilir.
4. Birleşik küme `requireReferences: true` ile doğrulanır.
5. Yazma işlemi tek IndexedDB transaction içinde tamamlanır.
6. Transaction başarısızsa hiçbir aday kayıt etkinleşmez.

Ek kurallar:

- Aynı işlemde yinelenen kimlik reddedilir.
- `add` modu var olan kaydı ezmez.
- `upsert` güncellemeye izin verir.
- İsteğe bağlı `expectedUpdatedAtById` ile eski kopyanın yeni veriyi ezmesi engellenir.
- API üzerinden gelen eşzamanlı yazmalar sıraya alınır.
- Başka bir kaydın kullandığı referans doğrudan silinemez.

## 6. Sorgu ayrımları

Genel `queryRecords` sorgusu AI taslaklarını varsayılan olarak döndürmez.

| API | Döndürdüğü kayıtlar |
|---|---|
| `queryRecords` | Filtrelenen doğrulanmış kayıtlar; AI taslakları varsayılan olarak hariç |
| `getPlannedRecords` | `meal_plan`, `planned_meal` |
| `getConsumedRecords` | `meal_entry`, `hydration_entry` |
| `getAiDrafts` | Yalnız `source.kind = ai_draft` kayıtları |

Tür, kayıt durumu, kaynak, olay tarih aralığı, sıralama, limit ve offset filtreleri desteklenir.

Bu ayrım `planlanan ≠ tüketilen` ve `AI taslağı ≠ doğrulanmış etkin kayıt` kurallarını yalnız UI dilinde değil, veri erişim katmanında da korur.

## 7. Yedek ve geri yükleme

`createBackup` mevcut beslenme deposunun bağımsız anlık kopyasını oluşturur. Yedek listesi varsayılan olarak kayıt içeriğini değil yalnız şu metadata alanlarını döndürür:

- Yedek kimliği
- Oluşturulma zamanı
- Sebep
- Durum
- Şema sürümleri
- Kayıt sayısı

`restoreBackup` doğrudan üzerine yazmaz. Önce geri yükleme öncesi mevcut durum için yeni bir kurtarma noktası oluşturur, ardından seçili yedeği atomik biçimde uygular.

## 8. Migration sınırı

NUT-002, beslenme sözleşmesi için kesintisiz adım zinciri zorunlu tutar:

```text
0 → 1
```

NUT-002 beslenme kaydı yazabilen ilk sürüm olduğu için onaylanmış bir eski beslenme veri biçimi yoktur. Bu nedenle `0 → 1` adımı:

- Boş depoyu güvenle sürüm `1` olarak işaretleyebilir.
- Metadata işareti geride kalmış fakat zaten geçerli v1 olan kaydı koruyabilir.
- Bilinmeyen eski payload’ı tahmin ederek yeni beslenme kaydına dönüştüremez.

Migration akışı:

1. Mevcut ve hedef sözleşme sürümleri karşılaştırılır.
2. Kesintisiz migration adımı doğrulanır.
3. Herhangi bir kayıt değişmeden önce `prepared` durumunda yedek oluşturulur.
4. Kayıtlar bellek içindeki bağımsız kopyalarda dönüştürülür.
5. Son küme güncel NUT-001 sözleşmesi ve referans bütünlüğüyle doğrulanır.
6. Kayıtlar, metadata ve yedek durumu tek transaction içinde uygulanır.
7. Başarılı yedek `applied`, başarısız dönüştürme yedeği `failed` işaretlenir.

Güncel depoda tekrar çalıştırılan migration hiçbir yazma veya yeni yedek oluşturmaz.

## 9. Anlık görüntü sözleşmesi

`exportSnapshot` şu alanları taşır:

- `snapshotSchemaId`
- Oluşturulma zamanı
- Veritabanı adı ve fiziksel sürümü
- Depolama şeması sürümü
- Beslenme sözleşmesi sürümü
- Kayıt sayısı
- Bağımsız kayıt kopyaları

`importSnapshot` yalnız güncel depolama ve sözleşme sürümüyle eşleşen, tam referans bütünlüğü doğrulanan görüntüyü kabul eder. Geçersiz görüntü mevcut veriyi değiştirmez.

## 10. Tarayıcı API’leri

```text
window.TodayNutritionStorage
window.TodayNutritionMigration
```

Başlıca depolama işlevleri:

- `initialize()`
- `getStatus()`
- `getRecord(id, options)`
- `queryRecords(options)`
- `getPlannedRecords(options)`
- `getConsumedRecords(options)`
- `getAiDrafts(options)`
- `saveRecord(record, options)`
- `saveRecords(records, options)`
- `deleteRecord(id)`
- `createBackup(reason)`
- `listBackups()`
- `restoreBackup(id)`
- `exportSnapshot()`
- `importSnapshot(snapshot, options)`
- `replaceAllRecords(records, options)`
- `applyMigrationPlan(options)`
- `close()`

Migration API:

- `inspect()`
- `run()`
- `getStatus()`

## 11. Çalışma zamanı entegrasyonu

Script sırası şöyledir:

```text
nutrition-contracts.js
nutrition-storage.js
nutrition-migrations.js
```

Üç modül `index.html` içinde Router’dan önce yüklenir ve Service Worker uygulama kabuğuna eklenir. Kabuk sürümü `today-v2-foundation-013` olarak yükseltilmiştir.

Beslenme deposu sayfa açılır açılmaz veri yazmaz veya boş veritabanı oluşturmaya zorlamaz. İlk beslenme veri tüketicisi API’yi çağırdığında başlatılır. IndexedDB desteğinin bulunmaması mevcut Core ekranını engellemez; ilgili Health yeteneği kendi hata sınırında ele alınacaktır.

## 12. Test kabulü

| Test alanı | Sonuç |
|---|---:|
| NUT-001 veri sözleşmeleri | `60/60` |
| NUT-002 IndexedDB veri katmanı | `50/50` |
| NUT-002 migration orkestrasyonu | `20/20` |
| Önceki Today platform regresyonu | `294/294` |
| Birleşik platform kapısı | `424/424` |

Testlerde doğrulanan kritik negatif durumlar:

- Bilinmeyen ölçümün sıfıra çevrilmesi
- Eksik referanslı kaydın yazılması
- Atomik çoklu yazmada kısmi kayıt oluşması
- AI taslağının varsayılan etkin sorguya karışması
- Plan kaydının tüketim sorgusuna karışması
- Kullanılan referansın silinmesi
- Eski kopyanın yeni kaydı ezmesi
- Geçersiz snapshot’ın mevcut veriyi değiştirmesi
- Eksik migration adımı
- Bilinmeyen eski verinin tahmini dönüştürülmesi
- Başarısız migration’da özgün kaydın değişmesi
- Uygulamadan daha yeni şemanın açılması

## 13. Değişen ve yeni dosyalar

| Dosya | İşlem | İşlev |
|---|---|---|
| `index.html` | Değişti | Beslenme modüllerinin çalışma zamanı sırası |
| `sw.js` | Değişti | Foundation-013 çevrimdışı kabuk |
| `modules/nutrition-storage.js` | Yeni | IndexedDB veri katmanı |
| `modules/nutrition-migrations.js` | Yeni | Sözleşme migration orkestrasyonu |
| `tests/nutrition-storage.test.cjs` | Yeni | 50 veri katmanı testi |
| `tests/nutrition-migrations.test.cjs` | Yeni | 20 migration testi |
| `tests/static-regression.test.cjs` | Değişti | Yeni script ve kabuk parmak izleri |
| `tests/sw-event-regression.cjs` | Değişti | Foundation-013 olay regresyonu |
| `tests/platform-browser-regression.test.cjs` | Değişti | Tarayıcıda yeni modüllerin yüklenmesi |
| `tests/automation-contract.test.cjs` | Değişti | 15 grup ve 424 test kabulü |
| `tests/run-platform-regression.cjs` | Değişti | NUT-002 test grupları |
| `package.json`, `package-lock.json` | Değişti | Test ortamı için sabit IndexedDB taklidi |

`fake-indexeddb` yalnız geliştirme/test bağımlılığıdır. Üretim çalışma zamanı tarayıcının yerleşik IndexedDB API’sini kullanır.

## 14. NUT-002 dışında kalanlar

- Health beslenme arayüzü
- Kullanıcının gerçek öğün girişi
- Besin veya tarif kütüphanesi
- Kalori ve makro hesaplama
- Otomatik veri üretme
- HealthKit veya Health Connect
- SQLite ve şifreli yerel depolama
- Bulut senkronizasyonu
- Canlı uzman paylaşımı

## 15. NUT-003 devir koşulları

Sıradaki iş paketi **NUT-003 — Birim Dönüşümü, Tarif Ölçekleme ve Deterministik Besin Hesaplama Motoru** olacaktır.

NUT-003 şu sınırları korumalıdır:

1. Hesaplamalar AI modeline bırakılmaz.
2. Bilinmeyen değer hiçbir toplamda sıfır kabul edilmez.
3. Birim dönüşümü yalnız uyumlu ve sürümlü dönüşüm kurallarıyla yapılır.
4. Tarif ölçekleme kaynak porsiyon ve sürüm bilgisini korur.
5. Hesap sonucu `calculationVersion` olmadan kayıtlaştırılmaz.
6. Hesaplanamayan alan, tüm öğünün hesaplanmış görünmesine neden olmaz.
7. NUT-002’ye yalnız doğrulanmış kayıtlar üzerinden yazılır.
8. İlk aşamada yeni kullanıcı arayüzü eklenmez.

Sonuç: **NUT-002 tamamlandı. NUT-003 başlangıç koşulları sağlandı.**
