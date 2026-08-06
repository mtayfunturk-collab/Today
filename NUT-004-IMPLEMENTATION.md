# Today App — NUT-004 Uygulama Kaydı

**İş paketi:** NUT-004 — Beslenme Profili, Alerji/Tercih ve Hedef Sürümleme  
**Durum:** Tamamlandı; birleşik regresyon başarılı  
**Uygulama tabanı:** Today App `2.0.0`, Core veri şeması `2`, NUT-001 sözleşmesi `1`, NUT-002 depolama şeması `1`, NUT-003 hesaplama sürümü `nutrition-calc-v1`  
**Profil API sürümü:** `1`  
**Profil kural seti:** `today:nutrition:profile:v1`  
**Çevrimdışı kabuk:** `today-v2-foundation-015`  
**Tarih:** 5 Ağustos 2026

## 1. Sonuç

NUT-004, NUT-001’de tanımlanan `nutrition_profile`, `dietary_constraint` ve `nutrition_goal_version` kayıtlarını NUT-002’nin atomik çevrimdışı deposu üzerinde yöneten bir profil servis katmanı ekler.

Bu iş paketi:

- İlk beslenme profilini yalnız açık kullanıcı işlemiyle oluşturur.
- Sade kayıt modunu varsayılan tutar; ayrıntılı ve uzman modunu isteğe bağlı bırakır.
- Alerji, intolerans, etik tercih, kişisel tercih, dini kısıt, kullanıcı beyanlı tıbbi kısıt ve diğer kısıtları ayrı kategoriler olarak korur.
- Kısıt değişikliklerinde eski kaydı silmez; arşivleyip yeni kimlikli kayıt oluşturur.
- Aynı anda yalnız bir etkin ana hedefe izin verir.
- Hedef değişikliğinde yeni sürümü oluşturur, önceki sürümü aynı atomik işlemde `superseded` yapar ve profili yeni sürüme bağlar.
- Hedef geçmişini döngü, kopuk zincir, yanlış durum ve ters tarih bakımından doğrular.
- AI hedef önerisini yalnız taslak olarak saklar; açık kullanıcı onayı olmadan etkin hedef yapmaz.
- Kabul edilen AI taslağını ayrı ve kullanıcı onaylı manuel hedef kaydına dönüştürür; özgün taslağı değiştirmez.
- Profil değişikliklerinin geçmiş öğün, besin hesabı veya rapor kayıtlarına dokunmasını engeller.

Health ekranına profil formu, alerji listesi veya hedef görünümü eklenmemiştir. Modül sayfa açılışında beslenme veritabanı veya kullanıcı profili oluşturmaz.

## 2. Mimari sınır

Çalışma zamanı API’si:

```text
window.TodayNutritionProfile
```

Bağımlılık yönü:

```text
NUT-001 veri sözleşmeleri
          ↓
NUT-004 profil ve hedef kuralları
          ↓
NUT-002 doğrulamalı atomik depolama
```

NUT-003 hesaplama motoru bu akışın bağımlılığı değildir. Profil değişikliği besin değerini yeniden hesaplamaz, geçmiş kayıtları güncellemez ve hesaplama sürümünü değiştirmez.

NUT-004:

- Yalnız `nutrition_profile`, `dietary_constraint` ve `nutrition_goal_version` türlerini yazar.
- Core’un `today_store_v2` alanını okumaz veya yazmaz.
- `localStorage`, ağ, AI sağlayıcısı veya DOM API’si kullanmaz.
- Kayıtları yalnız `TodayNutritionStorage` üzerinden yazar.
- Tek ve çoklu değişiklikleri NUT-002’nin referans bütünlüğü ve transaction kapısından geçirir.
- Yüklenirken kalıcı veri oluşturmaz.

## 3. Sürüm katmanları

| Katman | Sürüm | İşlev |
|---|---:|---|
| Today uygulaması | `2.0.0` | Genel uygulama sürümü |
| Today Core veri şeması | `2` | Mevcut Core kayıtları |
| Beslenme sözleşmesi | `1` | NUT-001 kayıt biçimleri |
| Beslenme depolama şeması | `1` | NUT-002 IndexedDB sınırı |
| Hesaplama sürümü | `nutrition-calc-v1` | NUT-003 deterministik sonuçları |
| Profil API’si | `1` | NUT-004 tarayıcı servis sözleşmesi |
| Profil kural seti | `today:nutrition:profile:v1` | Profil, kısıt ve hedef yaşam döngüsü |
| Çevrimdışı kabuk | `today-v2-foundation-015` | Profil servisini içeren uygulama kabuğu |

NUT-004 yeni kayıt türü veya fiziksel store eklemez. Bu nedenle Today uygulama sürümü, Core şeması, NUT-001 sözleşmesi, NUT-002 depolama şeması ve IndexedDB fiziksel sürümü yükseltilmemiştir.

## 4. Profil kurulumu ve kayıt modu

Ana profil sabit kimlikle tutulur:

```text
nutrition-profile:main
```

İlk profil ancak `userInitiated: true` ve `userConfirmed: true` kapısından sonra oluşturulur. Sayfa açılışı veya modül yüklenmesi profil üretmez.

Kayıt modları:

| Mod | Amaç |
|---|---|
| `simple` | Varsayılan, düşük eforlu kayıt |
| `detailed` | İsteğe bağlı ayrıntılı takip |
| `professional` | Kullanıcı veya uzman hedefiyle ayrıntılı çalışma |

Aynı moda tekrar geçiş gereksiz yazma oluşturmaz. Mod değişikliği yalnız profil kaydını günceller; geçmiş öğünleri ve hesap sonuçlarını değiştirmez.

## 5. Kısıt kategorileri

NUT-004’ün kullanıcıya açık kategorileri:

| NUT-004 kategorisi | NUT-001 `kind` değeri | Ayrım biçimi |
|---|---|---|
| `allergy` | `allergy` | Doğrudan |
| `intolerance` | `intolerance` | Doğrudan |
| `ethical_preference` | `preference` | Sürümlü uzantı kategorisi |
| `personal_preference` | `preference` | Sürümlü uzantı kategorisi |
| `religious` | `religious` | Doğrudan |
| `medical` | `medical` | Yalnız kullanıcı beyanlı kısıt |
| `other` | `other` | Doğrudan |

Etik ve kişisel tercih, NUT-001 sözleşmesini yükseltmeden şu ad alanlı uzantıyla ayrılır:

```text
today.nutrition.constraint.category
```

Eski v1 `preference` kaydında bu kategori yoksa sistem onu etik veya kişisel diye tahmin etmez. `preference_unspecified` ve `needsClassification: true` olarak gösterir.

Kısıt yaşam döngüsü:

1. Yeni kısıt ayrı kimlikle ve `active` durumda oluşturulur.
2. Profil referansı aynı atomik yazımda eklenir.
3. Kısıt değişirse eski kayıt `archived` ve `active: false` olur.
4. Yeni içerik yeni kimlikle oluşturulur ve profil referansı yerinde değiştirilir.
5. Kısıt kaldırıldığında kayıt silinmez; arşiv geçmişinde kalır.

Aynı kategori ve aynı etiket, Türkçe büyük-küçük harf karşılaştırmasıyla ikinci kez etkinleştirilemez. Etik ve kişisel tercih aynı etiketi taşısa bile ayrı kategoriler olarak kalır.

## 6. Ana hedef ve sürüm geçmişi

Ana hedef işlemleri şu değişmezleri zorunlu tutar:

1. Etkin profil en fazla bir etkin hedefe işaret eder.
2. Yeni hedef sürümü önceki etkin hedefi `supersedesId` ile bağlar.
3. Önceki hedef aynı transaction içinde `superseded` olur.
4. Profil aynı transaction içinde yeni hedefe bağlanır.
5. Yeni sürümün `effectiveFrom` tarihi mevcut sürümden önce olamaz.
6. İçeriği değişmeyen hedef gereksiz yeni sürüm oluşturmaz.
7. Hedef ölçümlerinde `unknown` değer `null` kalır; `0` yapılmaz.
8. Farkındalık hedefi boş hedef haritasıyla çalışabilir; diğer hedef türleri en az bir ölçüm gerektirir.

Geçmiş güncel hedeften geriye doğru izlenir. Döngü, eksik önceki sürüm, ana zincire bağlanmayan `superseded` kayıt veya profil–etkin hedef uyuşmazlığı güvenli hata üretir.

## 7. AI hedef taslağı kapısı

AI hedefi iki ayrı aşamada ele alınır.

### Taslak oluşturma

AI taslağı yalnız:

- `userRequested: true`,
- `userDataUseApproved: true`,
- sürümlü AI kaynak kimliği

ile kaydedilebilir.

Taslak zorunlu olarak:

- `source.kind = ai_draft`,
- `knowledgeStatus = estimated`,
- `recordStatus = draft`,
- `verificationStatus = unverified`,
- `userEdited = false`

durumundadır. Profili ve etkin hedefi değiştirmez.

### Kullanıcı kabulü

Taslağın etkinleşmesi için ayrıca `userInitiated: true` ve `userConfirmed: true` gerekir. Kabul sırasında:

1. Taslağın hâlâ güncel ana hedef sürümüne dayandığı doğrulanır.
2. Taslağın içeriğiyle yeni kimlikli manuel kullanıcı hedefi oluşturulur.
3. Önceki etkin hedef `superseded` yapılır.
4. Profil yeni hedefe bağlanır.
5. Yeni hedef `today.nutrition.approval` uzantısıyla kaynak taslak kimliğini ve onay zamanını taşır.
6. Özgün AI taslağı değişmeden `draft` kalır.

Aynı taslak ikinci kez etkin hedefe dönüştürülemez. Taslak oluşturulduktan sonra ana hedef değişmişse eski taslak sessizce kabul edilmez.

## 8. Tarayıcı API’si

```text
getSnapshot()
createProfile(input, confirmation)
setTrackingMode(mode, confirmation)
addConstraint(input, confirmation)
replaceConstraint(constraintId, input, confirmation)
deactivateConstraint(constraintId, confirmation)
createGoalVersion(input, confirmation)
saveGoalDraft(input, requestConsent)
listGoalDrafts(options)
acceptGoalDraft(draftId, confirmation)
```

API, sabit listeler ve bütün çıktı anlık görüntüleri dışarıdan değiştirilemeyecek biçimde dondurulur. Aynı sekmedeki profil yazmaları sıraya alınır; NUT-002 iyimser `updatedAt` kontrolü eski kopyanın yeni kaydı ezmesini engeller.

## 9. Çalışma zamanı entegrasyonu

Script sırası:

```text
nutrition-contracts.js
nutrition-calculations.js
nutrition-storage.js
nutrition-migrations.js
nutrition-profile.js
router.js
```

Profil servisi Router’dan önce yüklenir ve Service Worker kabuğuna eklenir. Kabuk `today-v2-foundation-015` ve 22 dosyadır.

Modülün yüklenmesi:

- IndexedDB oluşturmaz.
- Kullanıcı profili yazmaz.
- Health ekranını değiştirmez.
- Core başlangıcını engellemez.
- AI veya Connect sağlayıcısı kaydetmez.

## 10. Test kabulü

| Test alanı | Sonuç |
|---|---:|
| NUT-001 veri sözleşmeleri | `60/60` |
| NUT-002 IndexedDB veri katmanı | `50/50` |
| NUT-002 migration orkestrasyonu | `20/20` |
| NUT-003 deterministik hesaplamalar | `84/84` |
| NUT-004 profil, kısıt ve hedef sürümleme | `82/82` |
| Önceki Today platform regresyonu | `294/294` |
| Birleşik platform kapısı | `590/590` |

Kritik negatif testler:

- Kullanıcı onayı olmadan profil, kısıt veya hedef değiştirme
- Alerji, intolerans, etik ve kişisel tercihi aynı kategoriye sıkıştırma
- Eski belirsiz tercihi sessizce etik veya kişisel sayma
- Etkin kısıtı profilden kopuk bırakma
- Kısıt değişikliğinde eski kaydı silme
- Aynı anda birden fazla etkin profil veya ana hedef
- Hedef geçmişinde döngü, kopuk sürüm veya ters tarih
- Bilinmeyen hedef değerini sıfıra çevirme
- AI taslağını etkin veya doğrulanmış kayıt yapma
- Güncel olmayan AI taslağını sessizce kabul etme
- Aynı AI taslağını iki kez etkinleştirme
- Profil değişikliğinde geçmiş öğün veya hesap kaydını değiştirme
- Modül yüklenirken kalıcı veri oluşturma

## 11. NUT-004’te yeni ve değişen dosyalar

| Dosya | İşlem | İşlev |
|---|---|---|
| `modules/nutrition-profile.js` | Yeni | Profil, kısıt, hedef sürümleme ve AI onay kapısı |
| `tests/nutrition-profile.test.cjs` | Yeni | 82 pozitif, negatif ve entegrasyon testi |
| `index.html` | Değişti | Profil servisinin çalışma zamanı sırası |
| `sw.js` | Değişti | Foundation-015 çevrimdışı kabuk |
| `tests/run-platform-regression.cjs` | Değişti | NUT-004 grubunun birleşik kapıya eklenmesi |
| `tests/automation-contract.test.cjs` | Değişti | 17 grup ve 590 test kabulü |
| `tests/static-regression.test.cjs` | Değişti | Yeni modül, script sırası ve kabuk parmak izleri |
| `tests/sw-event-regression.cjs` | Değişti | Foundation-015 ve 22 dosyalık kabuk testi |
| `tests/platform-browser-regression.test.cjs` | Değişti | Gerçek tarayıcıda profil API yükleme doğrulaması |
| `docs/NUT-004-IMPLEMENTATION.md` | Yeni | Uygulama, kabul ve devir kaydı |

`package.json`, `package-lock.json`, NUT-001 sözleşmesi, NUT-002 depolama/migration modülleri ve NUT-003 hesaplama motoru değişmemiştir.

## 12. NUT-004 dışında kalanlar

- Health içinde görünür profil formu
- Alerji veya tercih ekranı
- Hedef düzenleme ekranı
- Besin, tarif ve öğün kütüphanesi
- Gerçek öğün girişi
- Kalori ve makro görünümü
- AI’ın hedef veya sağlık tavsiyesi üretmesi
- Tanı, tedavi veya tıbbi kısıt doğrulaması
- HealthKit veya Health Connect
- Bulut senkronizasyonu

## 13. NUT-005 devir koşulları

Sıradaki iş paketi **NUT-005 — Besin, Tarif ve Öğün Kütüphanesi** olacaktır.

NUT-005 şu sınırları korumalıdır:

1. Besin ve tarif kayıtları sürümlü olur; geçmiş öğün anlık görüntüleri sonradan değişmez.
2. Kaynak, hazırlama biçimi, porsiyon temeli ve besin sürümü korunur.
3. Kullanıcının özel besini, doğrulanmış veri paketi ve AI taslağı aynı kaynak gibi gösterilmez.
4. AI besin değeri uyduramaz; eksik değer `unknown` kalır.
5. NUT-003 yalnız uyumlu birim ve doğrulanmış kayıtlarla hesap yapar.
6. Profil kısıtları kütüphane kaydını otomatik silmez veya yasaklamaz; yalnız ileride açıklanabilir uyarı bağlamı sağlar.
7. İlk kütüphane yerel ve çevrimdışı çalışır.
8. Health arayüzü ayrıca onaylanmadan genişletilmez.

Sonuç: **NUT-004 tamamlandı. NUT-005 başlangıç koşulları sağlandı.**
