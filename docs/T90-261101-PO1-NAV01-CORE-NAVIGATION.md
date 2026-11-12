# PO1-NAV01 — Core ile başlama ve modül erişimi

> Güncel devam: [Core not güveni düzeltmesi](CORE-NOTE-SAFETY.md) ayrı `task/core-note-safety` dalında ele alındı. Aşağıdaki FAIL ve engel kayıtları önceki patch'in tarihsel sonuçlarıdır; güncel test/kabul durumu bağlantılı rapordadır.

10 Kasım 2026. **Durum: devam ediyor; not güveni engeli nedeniyle yayın adayı değildir.**

Başlangıç SHA `b57dbceb53eb6a9aacc3bde709b4de096b77e38f` (Radio2.23.3/schema2/foundation-082). Önceki [Core hizalama patch'i](T90-261101-PO1-UX02-CORE-ALIGNMENT.md) korunarak `task/t90-261101-po1-nav01-core-navigation` yerel dalına kopyalandı. Kaynak `/workspace/Today-core-alignment` çalışma ağacı değiştirilmedi. Bu dalda commit yok; patch henüz uzak depoda bulunmaz.

## Uygulanan dar değişiklik

- Başla kullanıcı eylemiyle `pick` rotasını açar. Açılış otomatik geçmez.
- Core'un mevcut sol kontrolü 22px dekoratif ızgara/44px dokunma alanı, `Modülleri aç` erişilebilir adı ve kısa görünür yönergeyle modül merkezini açar. ID korunur.
- Modül merkezinde `Core’a dön` önceki Core geçmiş kaydına döner; bulunamazsa aynı history girdisini değiştirir. Dört mevcut modül kartı korunur.
- Router yalnız iki ebeveyn rotasında değişir: `pick → home`, `modules → pick`. History marker, popstate, diğer ebeveynler ve eski sınırlı swipe kodu aynen korunur; yeni swipe yoktur.
- Health/Sky/Radio/Calendar/Settings davranışı, palet kimlikleri ve mevcut Radio tek oynatıcı mimarisi korunur.

Görev deltası: `index.html`, `modules/router.js`, mevcut üç test dosyası (`tests/static-regression.test.cjs`, `tests/platform-browser-regression.test.cjs`, `tests/e2e/today.spec.cjs`), Core hizalama testinin giriş yardımcısı (`tests/e2e/core-alignment.spec.cjs`), yeni `tests/e2e/core-navigation.spec.cjs`, bu rapor, changelog/backlog. Static envanter iki yeni ID'yi açıkça sayar (188); yalnız denetlenen index/router checksum'ları yenilenir. Eski bağımsız hizalama bloğu korunur.

## Not güveni engeli

`loadPickUI()` Core'a dönüşte textarea'yı eski kalıcı nottan doldurur. Mevcut `input` işleyicisinin 450ms zamanlayıcısı ise giriş anındaki taslağı yakalamaz; çalıştığı anda aynı textarea'nın değerini okur. Kayıt tamamlanmadan modüllere gidip Core'a hızlı dönmek yeni taslağı eski notla değiştirebilir ve zamanlayıcı eski değeri tekrar kaydeder.

Yeni hedef testte iki motorda beklenen `Sentetik hızlı dönüşte korunacak not` yerine boş metin görüldü. Beklenti gevşetilmedi; skip/retry eklenmedi. Hata testlerden çıkarılmadı. Gerçek zamanlı eski sürüm denemesinde Chromium kaybı doğruladı; WebKit'te 450ms sınırı aşılabildiği için karşılaştırma sabit saatle tekrarlandı. Önceki sürümün görünür kontrolleri ve gerçek history dönüşü kullanılarak zamanlayıcı bekletildi, dönüşten sonra 500ms ilerletildi. **Her iki motorda önceki sürümde de textarea ve kayıt boş kaldı** (`baseline-probe.json`, 2/2 hata yeniden üretimi). Bu 2 kontrol hata kanıtıdır; ürün PASS toplamına katılmaz.

Bu görev gezinme dilimidir: save/flush/yazıcı değişikliği yapılmadı. Kaynak not işleyicisi ve `loadPickUI` aynen korunur. **Engel kapanana kadar NAV01 tamamlandı sayılamaz; renk paleti görevine geçilmez.** Sıradaki küçük iş, mevcut tasarıma göre not taslağının giriş anında yakalanması ve hızlı dönüş/tarih değişimi testlerinin ayrı dar veri güveni diliminde ele alınmasıdır. Yeni görev kimliği kendiliğinden tahsis edilmez. Şema/key/migration gerektirmeyen çözüm tercih edilir.

## Doğrulama

Kanıt dizini `/workspace/.cache/today-evidence/core-navigation-20261110`.

| Kapı | PASS | FAIL | Sonuç |
|---|---:|---:|---|
| Router hedefli |15|0|Başarılı|
| Platform (`npm test`) |1161|0|exit0|
| AI/Radio entegrasyon (`node tests/run-nut-017.9.cjs`) |335|0|exit0|
| İlk NAV01 hedefi, Chromium+WebKit |8|2|exit1; not round trip başarısız|

Mevcut tam tarayıcı regresyonu (`today.spec.cjs` + `core-alignment.spec.cjs`) **36/36 PASS /0 FAIL**, exit0:18 Chromium+18 WebKit. Radio gerçek HTMLAudio fixture ile kullanıcı onayı, tek akış ve modüller arası süreklilik testi iki motorda geçti. Yeni NAV01'in değişmeyen4 senaryosu/motor **8 PASS**; sabit saatle güncellenen not dönüş testi ayrıca iki motorda **0 PASS/2 FAIL**, exit1 (`fixed-clock-note.log`). Böylece son sürüm kapsamındaki46 farklı motor/senaryonun toplamı **44 PASS/2 FAIL**; bu farklı süreçlerin birleşik kapsamıdır, tek yeşil full-suite koşusu değildir. Not testi tekrarının amacı timing belirsizliğini kaldırmaktır; hata sonraki aşamaya saklanarak başarılı gösterilmedi.

Ayrı bütünlük denetimi4/4 PASS: önceki kaynak HEAD/dal/dirty dosyaları aynı, eski refs aynı, kaynak hizalama patch'ine göre tam10 dosyalı dar delta, index/staging boş ve whitespace temiz. Üretim delta yalnız index/router'dır; not yazıcısı, diğer modüller, schema ve lockfile byte düzeyinde aynıdır. Engine/benchmark kodu değişmediğinden bu görevde tekrar çalıştırılmadı; önceki403/16 sonucu yeni çalıştırma sayılmadı.

 İlk static denemeleri yeni iki ID'nin sayı/sıralama envanteri nedeniyle 29/30 verdi; envanter gerçek DOM'a göre düzeltildikten sonra platform içindeki static30/30 geçti. İlk Node birleşik kapıları alt süreç çalıştırmada sandbox `spawnSync ... EPERM` nedeniyle koşamadı; bu sonuçlar PASS sayılmadı. Scoped network/process ve `/var/tmp` yazma erişimiyle aynı kapılar çalıştırıldı ve yukarıdaki nihai sonuçlar alındı. Lockfile/dependency/runtime değişmedi. WebKit host precheck atlanır; browser/assertion'lar çalışır.

## Veri ve yetki sınırı

Gerçek kullanıcı profili kullanılmadı. localStorage/IndexedDB anahtarı, store, şema, migration, kayıt işleyicisi, lockfile, SW ve sürüm etiketlerine dokunulmadı. Yeni dış bağlantı/izin/telemetri açılmaz. Yeni `Core’a dön` kalıcı tercih veya veri anahtarı oluşturmaz. Sadece geçici sentetik tarayıcı profilleri kullanılır. Native saat/bildirim ertelemesi sürer.

PR1/PR2 yeniden salt okunur doğrulandı: ikisi açık/taslak/unmerged. Başları sırasıyla `ede686d` ve `b57dbce`. Mevcut uzak CI1:41122504627 failure; Radio CI2:41201384768 success. Bunlar yerel NAV01 patch'ini içermez. Yeni uzak CI çalıştırılmadı. Commit/push/PR güncelleme/merge/deploy yapılmadı. Mevcut canlı tasarım ve Netlify önizlemesi değiştirilmedi.

Fiziksel iPhone15 Safari/kurulu PWA ve Windows kabulü bu patch için yapılmadı. Linux WebKit emülasyonu fiziksel cihaz kabulü değildir; eski önizleme kabulü devralınmaz. T90-07/08 veri/restore ve pilot kapıları açıktır. Önerilen model: mevcut dar veri güveni teşhisi için Sol High; güvenli gezinme/UI devamı için Sol Medium. Gereksiz tam depo taraması/dependency kurulumu yapılmadı; hata örtülmeden raporlandı.
