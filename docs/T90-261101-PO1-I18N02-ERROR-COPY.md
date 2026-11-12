# PO1-I18N02 — Merkezi hata bildirimlerinin dil sunumu

12 Kasım 2026, TSİ. Küçük, geri alınabilir yerel sunum dilimi; İngilizce etkinleştirme veya genel I18N02 tamamlanması değildir.

## Başlangıç ve kabul kapsamı

HEAD `b57dbceb53eb6a9aacc3bde709b4de096b77e38f`. Kaynak `/workspace/Today-startup-copy`, dal `task/t90-261101-po1-i18n02-startup-copy`; önceki6/6 audit ve hashler doğrulanarak65 kirli dosya korundu. Yeni yerel dal `task/t90-261101-po1-i18n02-error-copy`, çalışma `/workspace/Today-error-copy`. Önceki dal/ağaç değiştirilmedi; stash/reset/clean/commit kullanılmadı.

Salt okunur PR1/2 kontrolü: ikisi açık/draft; NUT `ede686d`, Radio `b57dbce` aynı. İlgili eski CI sonuçları sırasıyla41122504627 failure ve41201384768 success. Yeni yerel patch için uzak CI çalışmadı. Kullanıcının yerel çalışma sınırı AGENTS içindeki commit/PR iş akışından önceliklidir.

Kapsam: error-manager showNotice() ve mevcut ESM copy entry/sözlük/cache. Kabul:13 bilinen mesaj ve kurtarma kontrolü sözlükten gelebilsin; provider yüklenmez/bozuksa senkron TR kalsın; bilinmeyen/özel mesajlar aynen gösterilsin; normalize edilmiş kod/tanı ayrıntıları, frozen record,console,event,25 kayıt sınırı ve kurtarma eylemleri değişmesin. Ortak katalog127 key: önceki110 aynı,17 ek;66 EN taslak ve61 çevrilmemiş, yalnız TR hazır. Kalıcı dil tercihi veya EN seçimi açılmadı.

## Uygulama ve sahiplik

Read-only TodayErrorCopy iki donmuş tablo içerir: labels ve messages.13 kaynak literal'i açık whitelist ile dictionary key'lerine eşlenir; literal kaynağı çeviri değerinden bağımsızdır. Bu kayıt kimliği/alanı eklemeden yalnız gösterimi çevirmeyi sağlar. Testte sözlük değerleri sentetik değiştirildiğinde orijinal TR kaydın doğru sunuma eşlenmesi doğrulanır. Özel metinlere geniş string replacement uygulanmaz; prototype anahtarları own-property kontrolüyle korunur.

showNotice içindeki try/catch lookup; yanlış tür/boş/provider getter hatasında eski TR fallback'i kullanır. ESM yüklenmesini bekleme veya eski hataları replay yok. Erken hata Türkçe kalabilir; yeni kritik başlangıç bağımlılığı yok. Metinler textContent, kod parametresi callback ile literal yazılır. `{code}` içermeyen bozuk şablon Türkçe fallback'e düşer ve kod görünür kalır. Tanı kaydındaki userMessage/message/source/code/details/timestamp çevrilmez veya yeniden üretilmez. Console ve today:error payload aynı record'u kullanır.

Ana ekrana dön/Yeniden dene/Tamam/Kapat metinleri sunumdur; home/reload/dismiss kararları, click handler'ları ve erişilebilirlik role/aria-live değişmez. Service Worker güncelleme panelinin kendisi ve native/OS bildirim işi bu kapsamda değildir.

## Testler ve kanıt

Kanıt klasörü `/workspace/.cache/today-evidence/error-copy-20261112`: baseline.json,platform.log/exit,ai-radio.log/exit,browser.log/exit,audit.py/json ve summary.json.

- Yeni hedef `node tests/error-copy.test.cjs`:12/12 PASS.13 bilinen kaynak, bağımsız çeviri fixture'ı, özel/prototype/HTML metinleri, bozuk provider/token, frozen kayıt/console/event/özel detay filtresi; home/reload/dismiss,warning/fatal/hidden,late provider,tek yüzey/25 kayıt.
- İlk katalog çalıştırması dosya yolu hatasıyla çalışmadı: sayı güncellemesinin `261101` görev kimliğini de değiştirdiği test düzenleme hatası. Yol eski kimliğe düzeltildi; son katalog12/12 PASS. Üretim hatası değildir; bu başarısız deneme başarılı sayılmaz. Görev kimliği değiştirilmedi.
- Tam `npm test`: **1284/1284 PASS**,33 grup,exit0; `node tests/run-nut-017.9.cjs`: **335/335 PASS**,exit0. Seçili browser **18/18 PASS (9 Chromium+9 WebKit)**,53.9s,exit0. Üç dosya seçilmiştir; tüm E2E veya fiziksel kabul iddiası yok. Son bütünlük **6/6 PASS**,0FAIL:65 kaynak dosyası/HEAD/dal/status/mevcut refs,20 dosyalı delta,boş staging/whitespace,sadece showNotice değişimi ve eski110 sözlük girdisi/cache sözleşmesi. Birleşik kapılarda başarısız koşu olmadı; çözülmemiş hata yok. Dar hata sunumu dilimi yerel otomatik kabulüyle tamamlandı.12+12 hedef testi platform toplamının içindedir; sayılar tekrar toplanmaz.
- Tarayıcı kapsamı: gerçek dictionary yanıtına sentetik metin uygulanır; route/body/kod/label/log ayrımı ve gerçek home eylemi; warning/dismiss ve literal custom body; gerçek reload/not koruma. Mevcut Core dictionary abort/offline zinciri ve startup hata/retry senaryoları da seçili koşudadır. Skip/retry yok.

## Veri etkisi ve açık risk

20 dosyalı görev deltası:4 üretim (error-manager.js,copy entry,core-tr.mjs,sw.js),11 test/koşucu ve5 belge. Tam dosya/hash listesi audit.json içindedir. Cache091→092;128 shell ve App2.23.3/schema2 aynı. index/startup-manager,storage/state/migration,Radio player,SW update manager ve lockfile aynı.

Yeni localStorage/IndexedDB key/store/şema/migration veya dış ağ aktarımı yok. Günlük/not kayıtları çevrilmez. Eski hata metinleri aynen taşınır; bu adım yeni kurtarma/veri güvenliği garantisi değildir. Tam yedek/restore,kısmi yazma rollback'i,fiziksel cihaz ve pilot kapıları açık. Yalnız sentetik ayrı profiller; WebKit emülasyonu gerçek iPhone15/iOS18.7.8 Safari/PWA veya Windows fiziksel kabulü sayılmaz. Genel Engine/sentetik benchmark bu sunum değişikliği için ayrıca tekrarlanmaz; önceki sonuçlar yeni PASS sayılmaz.

Sonraki bağımsız öneri: I18N02 mevcut Service Worker güncelleme panelinin metin sunumu; güncellemeyi kullanıcı onaylamadan etkinleştirmeme davranışını koruma. Bu OS/native bildirim geliştirmesi değildir. Önerilen model Sol Medium; hedefli kontroller/önceki altyapı kullanılarak gereksiz tam browser matrisleri tekrarlanmaz. Commit/push/PR/merge/deploy/CI rerun yok; canlı değişmedi. Sonuç kaydedildikten sonra durulur.
