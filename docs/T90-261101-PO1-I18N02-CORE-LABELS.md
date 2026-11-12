# PO1-I18N02 — Takvim/özet için ayrı seçim-renk sunumu

12 Kasım 2026, TSİ. Küçük, geri alınabilir yerel uygulama dilimi. Yeni dil,tercih veya veri özelliği açılmaz.

## Başlangıç ve kapsam

HEAD `b57dbceb53eb6a9aacc3bde709b4de096b77e38f`; kaynak `/workspace/Today-core-copy-review`, dal `task/t90-261101-po1-i18n02-coverage-review`. Önceki6/6 audit ve dosya hashleri doğrulanarak75 kirli kaynak dosyası yeni `task/t90-261101-po1-i18n02-core-labels` dalına `/workspace/Today-core-labels` altında eksiksiz taşındı. Kaynak ağaç/dallar korunur;stash/reset/clean/commit yok. PR1/2 açık/draft,uzak head'ler `ede686d`/`b57dbce` aynı. Son uzak CI41122504627 failure ve41201384768 success,eski SHA sonuçlarıdır;bu yerel patch için uzak CI çalışmadı.

Kapsam: index.html takvim aria ve istatistik özeti parametreleri,mevcut copy entry/provider/cache,test ve belgeler. Uygulama/şema2.23.3/2,kalıcı kimlikler,CSV,writer ve bütün diğer davranışlar korunur. İngilizce,kalıcı tercih,şema/key/migration,UI yeniden tasarımı,Health/Sky/Radio/AI işlev değişikliği ve yayın kapsam dışıdır. Boyut küçük;Sol Medium.

## Değişiklik

Önceki inceleme,choiceLabelTR/colorLabelTR helper'larının hem UI'da hem CSV'de kullanıldığını gösterdi. Helper'ı çevirmek CSV sözleşmesini sessizce değiştirirdi. Yeni TodayCoreLabels yalnız salt okunur UI haritaları sunar: üç A/B/C seçimi ve12 renk (mint dahil),tamamı mevcut133 key sözlükten. Köprü ve iki alt tablo donmuş/yazılamaz;mevcut owner'ın üzerine yazılmaz.

Yeni coreDisplayLabel() hazırsa kendi string etiketini alır;provider yok/bozuk/boş/yanlış tür/getter hata verirse mevcut Türkçe fallback'i kullanır. Boş fallback alan bilinmeyen kimlik provider'dan uydurma bir etiket almaz. Sadece dört UI çağrısı değişti:takvim seçim,renk ve özetin hazır/fallback şablon parametresi. Kaynak helper'lar ve bütün export kodu aynı kaldı.

Not içeriği etikete veya aria'ya aktarılmaz;takvim sadece not-var bilgisini kullanır. Parametreler literal kalır (HTML/placeholder/$& yeniden yorumlanmaz). Gün/editability,sıralama,sayım,yedi gün,toplamlar,CSV escaping/filename/header,save guard/debounce/Map aynı. Provider geç gelirse sonraki normal render kullanır;replay veya otomatik rota değişimi yok.

TR sözlük değişmedi;133 girdi,66 EN taslak+67 çevrilmemiş. EN seçeneği ve kalıcı dil tercihi açılmadı. Önceki COVERAGE-REVIEW JSON'u tarihsel denetim snapshot'ıdır;bu uygulamanın yeni index hash'ine taşınmış gibi gösterilmez. Aktif CORE-CATALOG source hash/ham satırları güncellenmiştir;eski133 girdi metin/EN/parametreleri aynıdır.

## Testler

Kanıt `/workspace/.cache/today-evidence/core-labels-20261112`: baseline.json,platform/AI/browser log ve çıkış kodları,audit.py/json,summary.json.

- Yeni hedef `node tests/core-labels.test.cjs` **10/10 PASS**.15 stabil ID/dictionary bağımsız fixture,immutable owner,TR helper değişmezliği,yok/partial/boş/getter hata fallback'i,bilinmeyen ID,literal parametreler;gerçek calendar renderer'da geçmiş/bugün/not gizliliği/editability ve gerçek summary/CSV handler karakterizasyonu.
- Mevcut istatistik **8/8**,katalog **12/12 PASS**. Hedefler platform toplamına dahildir;tekrar toplanmaz.
- Tam `npm test` **1302/1302 PASS**,35 grup,exit0; `node tests/run-nut-017.9.cjs` **335/335 PASS**,exit0; seçili browser **16/16 PASS (8 Chromium+8 WebKit)**,1.1 dakika,exit0; son bütünlük **6/6 PASS**,0FAIL. Kaynak75 dosya/HEAD/dal/status/mevcut refs,tam18 dosyalı delta,boş staging/whitespace,yalnız4 UI çağrısı+helper,eski133 dictionary girdisi ve cache sözleşmesi doğrulandı. Bütün test koşuları ilk denemede başarılı;skip/retry yok,çözülmemiş hata yok. Dar etiket sunumu dilimi yerel otomatik kabulüyle tamamlandı. Tüm E2E/İngilizce veya fiziksel kabul iddiası değildir. Browser gerçek dictionary yanıtına yalnız iki fixture etiketi koyar,not/seçim/mint kaydeder;takvim aria/özet,literal HTML/placeholder ve gerçek indirilen CSV'nin tam içeriği/filename/record korunmasını doğrular. Dictionary abort ile aynı TR fallback/CSV kabulü de çalışır. Mevcut calendar/statistics/static copy/offline testleri seçili koşudadır.

## Veri etkisi ve açık risk

18 dosyalı görev deltası:3 üretim (index.html,copy entry,sw.js),10 test/koşucu ve5 belge. Tam path/hash audit.json. Cache093→094;128 shell ve App2.23.3/schema2/lockfile aynı. Yeni localStorage/IndexedDB key/store/şema/migration veya dış veri aktarımı yok;gerçek kullanıcı verisine dokunulmaz. Sentetik ayrı profiller kullanılır.

Bu adım TR-only altyapı hazırlığıdır;genel I18N02/İngilizce tamamlanmış değildir. Tarih provider'ındaki tr-TR sabiti ve takvim aria tam tarihi sonraki sunum kapsamıdır. Tam yedek/restore,kısmi yazma rollback'i,fiziksel iPhone15/iOS18.7.8 Safari/kurulu PWA/Windows ve pilot kapıları açık. WebKit emülasyonu fiziksel kabul değildir. Ayrı Engine/sentetik benchmark bu sunum diliminde tekrarlanmadı;önceki sonuçlar yeni test gibi sunulmaz.

Sonraki bağımsız öneri: Core/takvim tarih sunumunu gün anahtarlarından bağımsız yerelleştirmeye hazırlamak;yerel tarih/DST/gün sınırı/editability kurallarını korumak. Sol Medium;mevcut modüller yeniden yazılmaz. İlgili hedef ve browser seçimiyle gereksiz tam E2E matrisleri tekrarlanmaz. Commit/push/PR/merge/deploy/CI rerun yok;canlı değişmedi. Dar dilim sonuçları kaydedilip burada durulur.
