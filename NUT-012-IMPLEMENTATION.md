# Today App — NUT-012 Implementation

## Başlık
Consumption Editor — tüketim miktarı ve öğün ölçeği düzenleme

## Taban
- NUT-011
- Uygulama: 2.4.0
- Çevrimdışı kabuk: today-v2-foundation-023

## Hedef
- Uygulama: 2.4.1
- Çevrimdışı kabuk: today-v2-foundation-024

## Uygulanan kapsam
- Health öğün seçimindeki besin ve tarifler için tüketilen miktar alanı.
- Seçilen birim korunur; NUT-012 birimler arası tahmin üretmez.
- Öğün şablonu için pozitif ölçek çarpanı.
- 0.01–100000 aralığında deterministik istemci doğrulaması.
- Düzenlenen değerlerin yalnız yeni `meal_entry` anlık görüntüsüne aktarılması.
- Kütüphane kaynak kayıtlarının değişmez kalması.
- Başarısız kayıtta seçimlerin ve mevcut kayıtların korunması.
- Geçmiş günlerin salt okunur davranışının korunması.

## Mimari karar
`nutrition-ui.js` ve giriş servisinin iç durumunu değiştirmek yerine
`nutrition-consumption-editor.js` katman modülü eklendi. Modül formun capture
submit aşamasını yönetir, `TodayNutritionUI.getState()` üzerinden seçili
kayıtları okur ve mevcut `TodayNutritionEntry.logMeal()` sözleşmesine düzenlenen
miktarları gönderir. Böylece NUT-010/NUT-011 davranışı geri alınabilir ve bağımsız
kalır.

## Değişen dosyalar
- `index.html`
- `sw.js`
- `modules/version.js`
- `modules/nutrition-consumption-editor.js` (yeni)
- `package.json`
- `package-lock.json`
- `tests/nutrition-consumption-editor.test.cjs` (yeni)
- `docs/NUT-012-IMPLEMENTATION.md` (yeni)

## Kabul ölçütleri
1. Seçilen besin/tarif satırında miktar alanı görünür.
2. Varsayılan miktar kütüphane anlık görüntüsünden gelir.
3. Miktar değişikliği ana kütüphane kaydını değiştirmez.
4. Öğün şablonu ölçeği değiştirilebilir.
5. Sıfır, negatif, sayı olmayan ve üst sınırı aşan değerler kaydedilmez.
6. Başarılı kayıt sonrası öğün listesi yenilenir ve seçim temizlenir.
7. Service Worker yeni modülü çevrimdışı kabuğa alır.
