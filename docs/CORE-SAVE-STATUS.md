# Core kayıt sonucu mesajı düzeltmesi

11 Kasım 2026. Başlangıç SHA `b57dbceb53eb6a9aacc3bde709b4de096b77e38f`.
Yerel dal `task/t90-261101-po1-core-save-status`, worktree `/workspace/Today-core-save-status`.
Kaynak `/workspace/Today-dynamic-copy-contract`;49 yerel dosya değişikliği korunarak kopyalandı. AGENTS/proje kuralları/changelog/backlog ve [önceki teşhis](T90-261101-PO1-I18N02-DYNAMIC-CONTRACT.md) okundu. Bu yeni NUT/TB kimliği değildir; I18N02 dinamik metin önkoşulundaki dar doğruluk düzeltmesidir.

## Kök neden ve uygulama

Seçim, renk ve sıfırlama callback'leri `save()` dönüşündeki success alanını incelemiyordu. Legacy yazma hatası ayrıca try/catch dışına taşabiliyordu. Yeni kapı testleri eski kaynakta3PASS/9FAIL verdi: üç normal başarı; üç akış×false/partial/throw hata.

index.html içindeki yerel `trySaveCoreChange` yalnız `save().success === true` için true döndürür. İstisnayı mevcut today:stateerror/TODAY-STATE-001 yoluna, yalnız errorName ile bildirir ve false döndürür. Normal false için save wrapper'ın mevcut hata bildirimi korunur. Not akışı refactor edilmedi.

Üç callback başarı sonucunu saklayıp mevcut kontrol/renk/takvim/özet güncellemelerini sürdürür. Başarıda eski Kaydedildi./Renk kaydedildi./Bugün temizlendi. mesajları; false veya exception'da tam **“Değişiklik tam kaydedilemedi. Tekrar deneyebilirsin.”** mesajı gösterilir. Reset'te mesaj mevcut loadPickUI çağrısından sonra kalır; aksi halde read-only/status yüklemesi mesajı temizleyebilirdi. Yeni hata metni dinamik üreticide kalır; statik bağlayıcıya/status gözlemcisine eklenmedi. Dil/tercih/EN açılmadı.

Üretim delta yalnız index.html ve SW cache foundation-085→086. App2.23.3/schema2,128 dosyalı shell, sürüm modülleri ve lockfile aynı. Katalog80 girdisinin yalnız index SHA/satır/kaynak dalı referansları güncellendi; TR sözlük ve entry/binding modülleri aynı. Önceki dinamik sözleşmenin kaynak SHA/satırları teşhis snapshot'ıdır; oradaki üç açık risk bu raporda ele alınır, eski kanıt yeniden yazılmaz.

## Veri etkisi ve sınırlar

TodayState/TodayStorage yazıcısı, legacy→canonical yazma sırası, anahtar/store/şema/migration, kayıtlar/CSV/log, router/Health/Sky/AI/Radio değiştirilmedi. Aynı kullanıcı eylemi aynı save çağrısını bir kez yapar. Yeni retry/yedek yazma veya migration yoktur.

Bu değişiklik **mesaj doğruluğudur, atomik kayıt/rollback değildir**. Canonical hata aldığında legacy kaydı zaten değişmiş olabilir. Reset veya seçim/renk değişikliği RAM'de eski davranıştaki gibi uygulanabilir; reset mevcut pending note iptalini sürdürür. Kullanıcının eski halinin RAM'e geri getirildiği veya iki deponun her durumda aynı kaldığı söylenmez. Mevcut writer'ın success=true fakat yalnız legacy yedek kullanılabilen fallback sözleşmesi de değiştirilmedi. Tam veri/restore/kesinti/pilot kapıları ayrıca açıktır.

## Test kanıtı

- Yeni tests/core-save-status.test.cjs, gerçek callback/helper kaynaklarını izole VM'de üç akış×success/false/partial/throw olarak12 kontrol eder. Eski kaynak3/12 exit1; düzeltme12/12 exit0. Beklenti gevşetme, skip/retry yok. Bu12 kontrol yeni29 gruplu npm test kapısına eklendi.
- Core navigation browser dosyasına15 senaryo/motor eklendi: üç akış×iki depoda kota/canonical kotası/legacy kotası/TodayState.save istisnası/gerçek başarı. Testler gerçek iki localStorage kaydını önce/sonra karşılaştırır; canonical hatada canonical'ın değişmediğini, legacy/both/throw durumunda iki kaydın da önceki kaldığını ve başarıda gerçek seçimin/rengin/resetin kaydolduğunu doğrular. Canonical hatada legacy rollback beklentisi eklenmez.
- Ayrı sentetik browser profili ve sabit saat kullanılır. Gizli mevcut reset dahil gerçek bağlı DOM handler'ları programatik click ile etkinleştirilir; fiziksel dokunma ergonomisi kabulü değildir. Bekleyen not, hızlı modül dönüşü, midnight, intentional empty text ve not kota senaryoları mevcut dosyada korunur. pageerror listesi boş olmalıdır; beklenen merkezi kayıt hatası uyarısı bastırılmaz.

Son platform **1231/1231 PASS**, AI/Radio **335/335 PASS**,0FAIL/exit0. Core browser **48/48 PASS (24+24)**; seçili offline/SW-update/Radio browser **8/8 PASS (4+4)**,0FAIL/exit0. Bunlar iki ayrı seçilmiş koşuda56 benzersiz senaryodur; bütün E2E dosyalarının tek tam koşusu değildir. Core paketindeki30 yeni senaryo48 toplamına dahildir. Başlangıçtaki beklenen kırmızı12'lik test dışında düzeltme sonrası başarısız koşu olmadı.

Nihai kaynak/kapsam bütünlüğü **6/6 PASS**: kaynak49 dosya/HEAD/dal/status ve mevcut refs korunumu, yalnız16 dosyalı görev deltası, boş staging/whitespace,80 katalog kopyası ve writer modüllerinin değişmezliği, SW'de yalnız085→086 doğrulandı (`audit.json`). Yeni12 platform toplamına dahildir; tekrar toplanmaz. Değişmeyen Engine/benchmark ve tüm CSS matrisleri tekrar çalıştırılmadı. Gerçek iPhone Safari/kurulu PWA/Windows kabulü yoktur; WebKit emülasyonu fiziksel kabul değildir.

Mevcut kilitli dependency'ler kullanıldı, kurulum/lockfile değişikliği yok. Alt süreç/loopback/GStreamer için komut kapsamlı ağ ve /var/tmp izni; gerçek kullanıcı verisi/yayın kullanılmadı. Kanıt `/workspace/.cache/today-evidence/core-save-status-20261111`: baseline.json,before.log,platform/ai-radio log+exit,core-browser log+exit,related-browser log+exit,audit.json.

## Değişen dosyalar

| Grup | Kaynak worktree'ye göre delta |
|---|---|
|2 üretim dosyası | index.html,sw.js |
|10 test/koşucu | tests/core-save-status.test.cjs,tests/e2e/core-navigation.spec.cjs,tests/run-platform-regression.cjs,tests/automation-contract.test.cjs,tests/static-regression.test.cjs,tests/sw-event-regression.cjs,tests/ai-context-ui.test.mjs,tests/ai-evaluation-gate.test.mjs,tests/core-static-copy.test.cjs,tests/e2e/core-static-copy.spec.cjs |
|4 belge/katalog | bu rapor,04_CHANGELOG.md,10_TECHNICAL_BACKLOG.md,T90-261101-PO1-I18N02-CORE-CATALOG.json |

**Durum:** Üç akışın başarısız sonuç/istisnada yanıltıcı başarı mesajı sorunu yerel otomatik kabul kapsamında düzeltildi. Genel kayıt atomikliği/veri kurtarma ve fiziksel kabul tamamlanmış sayılmaz. Sonraki işe geçilmedi.

## Uzak durum ve devam

PR1/PR2 salt okunur: açık/taslak/unmerged,ede686d/b57dbce. Uzak NUT CI41122504627 failure,Radio CI41201384768 success. Bunlar yeni yerel patch'in sonucu değildir. Commit/push/PR güncelleme/merge/deploy/CI rerun yapılmadı; canlı Today/Netlify aynı. Kullanıcının yerel sınırı AGENTS'in daha geniş akışından önceliklidir.

Sonraki ayrı öneri: I18N02 dinamik Core durum metinlerini üretici çağrı noktalarından sözlüğe bağlamak; bu başarısızlık mesajını da envantere alıp save sonucu guard'larını korumak. Kaynak/parametre sözleşmesi tekrar tasarlanmaz. Genel çok dillilik, kalıcı tercih, fiziksel ve veri güveni kapıları açık; native saat/bildirim/mağaza ertelemesi korunur. Sonraki işe geçilmedi. Model önerisi bu kayıt sonucu/veri korunumu işi için Sol High; model değişimi/kota yüzdesi iddiası yoktur. Önce hedefli kırmızı/yeşil, sonra gerekli platform/AI ve seçili browser kapıları kullanıldı.
