# PO1-I18N02 — Kayıt anahtarlarından bağımsız tarih sunumu

12 Kasım 2026, TSİ. Küçük yerel uygulama dilimi; İngilizce seçimi/kalıcı tercih veya veri değişikliği değildir.

## Başlangıç ve kapsam

HEAD `b57dbceb53eb6a9aacc3bde709b4de096b77e38f`. Kaynak `/workspace/Today-core-labels`, dal `task/t90-261101-po1-i18n02-core-labels`; önceki6/6 audit ve dosya hashleri doğrulanarak78 kirli kaynak dosyası yeni `task/t90-261101-po1-i18n02-date-presentation` dalında `/workspace/Today-date-presentation` altına korundu. Kaynak ağaç/dal/status/hash ve mevcut refs korunur. Stash/reset/clean/commit yok. Salt okunur PR1/2 kontrolü açık/draft,başlar `ede686d`/`b57dbce` aynı;son bilinen uzak CI41122504627 failure ve41201384768 success eski SHA'lara aittir. Yeni patch için uzak CI çalışmadı.

Hedefler: saf tarih sunum yardımcısı,mevcut CalendarCopy köprüsü,classic guard ve takvim aria tam tarih çağrısı;offline cache/test/katalog/belgeler. Kapsam dışı:day-manager/parseKey/todayKey/prettyTR,gün anahtarları,DST politikası,editability,matrix,CSV,kayıt/not,depolama/şema/migration,EN seçimi/kalıcı tercih,diğer özellikler ve yayın. Boyut küçük/orta;Sol Medium.

Kabul: Core/ay/takvim tam tarih aynı sunum yolunu kullansın;TR çıktıları eski Date seçenekleriyle birebir kalsın. Yardımcı dil/tarih/state okumadan açık girdiyi biçimlesin;yüklenememe/bozuk formatter mevcut senkron TR fallback'i kullansın. Yerel gün anahtarı,not/CSV ve tek düzenlenebilir bugün korunsun.

## Uygulama

Yeni modules/date-presentation.mjs saf formatDatePresentation(date,kind,language='tr') sağlar. Donmuş seçenekler:core(day2-digit/monthlong/yearnumeric),month(monthlong/yearnumeric),day(weekdaylong/daynumeric/monthlong/yearnumeric). Date.prototype.toLocaleDateString.call mevcut yerel zaman dilimini kullanır;UTC/ISO dönüşümü,tarih parse/mutasyon,yeni Date/today varsayımı yok. Başka realm Date'i kabul edilir. Invalid Date eski gibi Invalid Date kalır;yanlış style/dil ve Date olmayan girdi TypeError verir.

tr→tr-TR,en→en-US yalnız açık formatter yetenekleridir. Aktif provider bütün çağrılarda açıkça 'tr' geçirir. Navigator/device/IP/konum/storage okunmaz;AVAILABLE_LANGUAGES yalnız ['tr'],HTML lang tr kalır. Saf yardımcının EN testi uygulamada İngilizceyi açmaz.133 dictionary girdisi ve66 taslak/67 çevrilmemiş durumu aynıdır.

TodayCalendarCopy.format ortak yardımcıya delegasyon yapar;day stili eklenir. Takvim tam tarihi de calendarDate(dt,'day',eski TR fallback) üzerinden geçer. Classic calendarDate try/catch ve string kontrolüyle eksik/getter hata/throw/boş/yanlış türde TR fallback'i korur. Core/ay çağrı seçenekleri ve day-manager değişmedi. Kalıcı ID ve gün anahtarları UI metni olarak tekrar parse edilmez.

Yeni modül optional ESM entry'nin bağımlılığıdır. Yüklenemezse entry bağlamaları çalışmayabilir,ancak classic Core/takvim ve HTML fallback'i bağımsızdır. Root/iki motor kabulü bunu sınar. Cache094→095;129 shell dosyası,önceki128 + yalnız date-presentation.mjs. Offline test yeni4 dosyalı bağlama zincirini doğrular. Uygulama2.23.3/schema2/lockfile aynı.

## Testler

Kanıt `/workspace/.cache/today-evidence/date-presentation-20261112`: baseline,platform/AI/browser log/çıkış kodları,audit.py/json,summary.json.

- Yeni tarih hedefi **12/12 PASS**: İstanbul/UTC/New_York üç timezone,artık gün,yıl sınırı,ABD DST örnekleri ve değişmeyen local key/prettyTR;TR core/month/day golden eşdeğerliği,explicit EN/TR-only readiness,bilinmeyen kind/dil/geçersiz input/Invalid Date,cross-realm Date,saf importta DOM/device/storage/network yokluğu,guard fallback/fixture delegasyonu,offline bağımlılık kaydı.
- Mevcut takvim **13/13**,katalog **12/12 PASS**;hedefler platform toplamındadır,tekrar toplanmaz. Takvim VM test harness'i yeni gerçek yardımcı kodunu yükler;Date davranışı stub ile değiştirilmez.
- Tam `npm test` **1314/1314 PASS**,36 grup,exit0; `node tests/run-nut-017.9.cjs` **335/335 PASS**,exit0. Seçili ilk browser koşusu **16PASS/2FAIL**: yeni testte source.replace replacement string içindeki `$&` özel eşleme olarak açılmıştı;bu fixture hazırlama hatasıdır. Callback replacement kullanılarak beklenti gevşetilmeden düzeltildi;aynı iki hedef **2/2 PASS (1 Chromium+1 WebKit)**,10.9s,exit0. İlk geçen16+son2 ile **18 ayrı senaryo doğrulanmış**;tek18/18 koşusu iddiası yok. Çözülmemiş hata yok. Üretim kodu test hatası için değiştirilmedi;gereksiz başarılı senaryo tekrarı/skip/retry yapılmadı. Son bütünlük **6/6 PASS**,0FAIL:78 kaynak dosyası/HEAD/dal/status/mevcut refs,tam20 dosyalı delta,boş staging/whitespace,sunum dışı index akışı ve day/data/writer/CSV/dictionary/cache sözleşmesi doğrulandı. Dar tarih dilimi yerel otomatik kabulüyle tamamlandı;genel I18N02 veya fiziksel kabul değildir. Browser gerçek formatter yanıtına literal fixture koyup Core/ay/tam gün metnini doğrular;day key/record/not/editability ve gerçek CSV tam içerik/filename aynı. Yeni dependency abort durumunda TR fallback/record/CSV de doğrulanır. Mevcut calendar/label/static/offline dosyaları aynı seçili koşudadır.

## Veri ve risk

20 dosyalı delta:4 üretim (index,copy entry,date-presentation,sw),11 test/koşucu ve5 belge. Tam path/hash audit.json. Date/day/state/storage/migration,CSV,save guard/Map/debounce,günlük kayıtları/kimlikleri,Radio oynatıcı ve diğer özellikler korunur. Yeni localStorage/IndexedDB key/store/şema/migration,dış veri aktarımı veya otomatik eylem yok. Gerçek kullanıcı verisine dokunulmaz;ayrı sentetik profiller kullanılır.

Yeni bağımlılığın eksik yüklenmesi görünür resource uyarısı doğurabilir;test bunu gizlemez,gerçek Kapat eylemiyle doğrular ve classic fallback'i sınar. Tarih sunumunun tr-TR sabitini aktif locale'e bağlama ancak bütün çeviri/hazır dil kapıları kabul edildiğinde yapılmalıdır. Saf helper EN formatlayabiliyor diye hazır EN veya iPhone çevrimdışı dil desteği vaat edilmez.

Genel I18N02,EN/kalıcı tercih/tam yedek-restore/kısmi yazma rollback'i/fiziksel iPhone15 iOS18.7.8 Safari/kurulu PWA/Windows/pilot kapıları açıktır. WebKit emülasyonu fiziksel kabul değildir. Ayrı Engine/sentetik benchmark bu sunum değişikliği için tekrarlanmadı;önceki sonuçlar yeni PASS sayılmaz.

Sonraki bağımsız öneri: kalan Core/ortak fallback/metaveri metinlerini sözlük kapsamına almak;build sürüm değerini ve renderer ownership'ini korumak. Model mevcut tarih dilimi için Sol Medium;sonraki basit metin işi Luna ile değerlendirilebilir. Aynı test/bağımlılık altyapısı ve ilgili browser seçimi yeniden kullanılır. Commit/push/PR/merge/deploy/CI rerun yok;canlı değişmedi. Sonuç kaydedilip burada durulur.
