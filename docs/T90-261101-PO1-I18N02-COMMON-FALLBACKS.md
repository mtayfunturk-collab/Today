# PO1-I18N02 — Son ortak fallback/metaveri etiketleri

12 Kasım 2026, TSİ. Küçük yerel metin sunumu; İngilizce veya kalıcı tercih etkinleştirilmez.

## Başlangıç ve kapsam

HEAD `b57dbceb53eb6a9aacc3bde709b4de096b77e38f`. Kaynak `/workspace/Today-date-presentation`,dal `task/t90-261101-po1-i18n02-date-presentation`;önceki6/6 audit/hash doğrulanıp82 kirli dosya yeni `task/t90-261101-po1-i18n02-common-fallbacks` dalında `/workspace/Today-common-fallbacks` altına korundu. Kaynak ağaç/HEAD/dal/status/dosya hashleri ve mevcut refs değişmez;stash/reset/clean/commit yok. PR1/2 salt okunur kontrolde açık/draft;head SHA'ları `ede686d`/`b57dbce` aynı. Yeni yerel patch için uzak CI çalışmadı.

Hedef: ilk grafik erişilebilir yükleniyor metni ve build etiketi için iki dictionary key;mevcut optional ESM entry'nin sonunda tek seferlik sunum. Boyut küçük;ekonomik model/Luna uygun. Model değiştirildiği iddia edilmez. Renderer,versiyon/şema sayısı,uygulama HTML'i,hesaplar,writer,kullanıcı verileri ve yeni EN/tercih kapsam dışı.

## Uygulama ve kabul

statistics.chart.loading mevcut “Grafik verisi hazırlanıyor.” metnini taşır. Yalnız aynı özgün fallback'i içeren childElementCount=0 alan değiştirilir;grafik renderer'ının canlı özeti veya eklenmiş alt kontrolleri silinmez. Genel statik binding listesine koşulsuz hedef eklenmedi;renderer ownership'i korunur.

common.build “build: {version}” şablonudur. Sürüm modülünün getCurrentVersion() fonksiyonu yalnız APP_VERSION/SCHEMA_VERSION döndürür;store okumaz. Entry hedef mevcut ve leaf ise sürümü buradan bir kez salt okunur alır. Nonempty string version ve token'ı içeren şablon literal callback ile birleştirilir. Metaveri eksik/bozuk/getter veya fonksiyon hata verirse eski inline build etiketi korunur;bozuk şablon özgün TR şablonuna düşer. Sürüm numarası değiştirilmez,parse edilmez veya UI metninden çıkarılmaz. Placeholder/$&/HTML yeniden yorumlanmaz.

135 sözlük girdisi:eski133 metin/EN/parametre aynı,iki yeni key untranslated.66 EN taslak+69 çevrilmemiş;0 reviewed EN. AVAILABLE_LANGUAGES ['tr'] ve HTML lang tr korunur. Dictionary/entry yüklenemezse eski HTML/inline fallback çalışır. Bir kere bootstrap olması canlı dil değiştirme kabulü değildir.

Cache095→096;129 shell,App2.23.3/schema2/lockfile aynı. Yeni module import,global provider,listener,timer,storage key/store/şema/migration veya dış veri aktarımı yok.

## Testler

Kanıt `/workspace/.cache/today-evidence/common-fallbacks-20261112`:baseline,platform/AI/browser log ve exit,audit.py/json,summary.

- Yeni hedef **8/8 PASS**:TR eşdeğerliği,sentetik etiket ve literal HTML,late bootstrap sonrası canlı chart ownership'i,nested control korunması,version literal/immutable/tek read,yok/boş/yanlış tür/throw metaveri ve eksik token fallback'i.
- Katalog **12/12 PASS**. Alt hedefler platform toplamındadır;tekrar toplanmaz.
- Tam `npm test` **1322/1322 PASS**,37 grup,exit0;`node tests/run-nut-017.9.cjs` **335/335 PASS**,exit0;seçili browser **16/16 PASS (8 Chromium+8 WebKit)**,1.1 dakika,exit0;son bütünlük **6/6 PASS**,0FAIL. Kaynak82 dosya/HEAD/dal/status/mevcut refs,tam19 dosyalı delta,boş staging/whitespace,append-only entry/index/metadata/writer değişmezliği ve eski133 girdi/yeni2 key/cache096 doğrulandı. Bütün koşular ilk denemede başarılı;skip/retry/açık hata yok. Dar ortak fallback/metaveri dilimi yerel otomatik kabulüyle tamamlandı;tüm E2E/genel I18N02 veya fiziksel kabul değildir. Browser gerçek dictionary yanıtını değiştirir;home build/ilk chart fallback'i,literal metin ve gerçek calendar chart çıktısını sınar. Gerçek ESM query import ile geç bootstrap çalıştırılır;canlı grafik/not/version korunur. Dictionary abort halinde özgün etiketler ve Core kayıt akışı da doğrulanır. Mevcut static/dynamic statistics ve static copy/offline dosyaları aynı seçili koşudadır.

19 dosyalı delta:3 üretim(entry,TR dictionary,sw),11 test/koşucu ve5 belge. Tam path/hash audit.json içindedir. index.html,version/day/date/state/storage/migration,CSV,grafik hesapları,Radio/Health/Sky/AI özellikleri aynı;gerçek kullanıcı verisine dokunulmaz. Yalnız sentetik ayrı profiller. Genel I18N02/tam yedek-restore/kısmi yazma rollback'i/fiziksel iPhone15 iOS18.7.8 Safari/kurulu PWA/Windows/pilot kapıları açık. Otomatik WebKit fiziksel kabul değildir. Ayrı Engine/sentetik benchmark bu iki metin için tekrarlanmadı;önceki sonuçlar yeni PASS sayılmaz.

## Sonraki görev ve durma noktası

Sonraki ayrı öneri: Core/ortak135 girdi için İngilizce taslakları tamamlayıp terim/parametre/erişilebilirlik incelemesi yapmak;uygulamada İngilizce seçimini açmamak. Diğer modül dilleri ve bütün uygulama kabulü tamamlanmadan EN hazır denmez. Önerilen model Luna veya Sol Medium;tam browser matrisleri yerine ilgili metin/renderer/metadata kontrolleri kullanılır. Commit/push/PR/merge/deploy/CI rerun yok;canlı değişmedi. Bu dilim sonuçları kaydedilip durulur.
