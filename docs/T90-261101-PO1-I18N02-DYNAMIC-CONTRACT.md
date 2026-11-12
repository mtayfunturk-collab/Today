# PO1-I18N02 — Dinamik metin üreticileri ve parametre sözleşmesi

11 Kasım 2026. Başlangıç SHA `b57dbceb53eb6a9aacc3bde709b4de096b77e38f`.
Yerel dal `task/t90-261101-po1-i18n02-dynamic-contract`; worktree `/workspace/Today-dynamic-copy-contract`.
Kaynak `/workspace/Today-statistics-tr-bindings`;47 yerel dosya değişikliği korunarak kopyalandı. Bu görev kaynak/sözleşme doğrulamasıdır; runtime/arayüz/tercih yazımı uygulanmadı. AGENTS/proje kuralları/changelog/backlog okundu. Önceki3 Kasım I18N02 tasarımının dinamik metin tablosu güncel üreticilerle ayrıntılandırıldı; yeni bir dil mimarisi veya baştan tasarım yapılmadı. Eski tasarım `/workspace/Today-po1-i18n02-design/docs/T90-261101-PO1-I18N02-CORE-DESIGN.md`, SHA ve kopyası kanıtta.

## Güncel sahiplik ve parametreler

[Makine tarafından doğrulanabilir sözleşme](T90-261101-PO1-I18N02-DYNAMIC-CONTRACT.json),15 üretim sözleşmesi içerir. index.html ve modules/day-manager.js SHA256'ı, üretici/DOM hedefi, mevcut veya önerilen message key, parametre türü/kaynağı, korunacak davranış, tam kaynak satırı ve kalite önkoşulu kaydedildi. Önerilen key'ler dil tasarımıdır; runtime sözlüğüne eklenmedi veya depolama şemasına dönüştürülmedi.

| Sözleşme | Sahip / parametre | Koruma sınırı |
|---|---|---|
| core.readOnly | loadPickUI, parametresiz | Editable=false metin, true boş; izin/gün değişmez. |
| core.saved | choice click, parametresiz | Kayıt sonucu riski aşağıda; çeviri başarı kanıtı değildir. |
| core.colorSaved | color click, parametresiz | Renk ID/log verisi aynı; kayıt sonucu önkoşulu açık. |
| core.noteSaved | note debounce, parametresiz | success=true, doğru rota/tarih;450ms ve draft Map korunur. |
| core.noteFailed | aynı callback, parametresiz | false/throw ile oturum taslağı; kalıcı kurtarma garantisi yok. |
| core.todayCleared | reset click, parametresiz | Kayıt sonucu riski; yeni reset/rollback uygulanmaz. |
| core.date | handleRouteChange → TodayDay.prettyTR(dateKey) | Geçerli yerel gün anahtarı; day2-digit/monthlong/yearnumeric. |
| calendar.month | renderCalendar, mevcut yerel Date | Ay/yıl yalnız sunum; grid veya timezone yeniden hesaplanmaz. |
| calendar.weekdays | renderCalendar, sabit7 çift | Pazartesi sırası, kısa görünür/tam aria adları. |
| calendar.day.accessible | renderCalendar: dateLabel/relation/choiceLabel/colorLabel/hasNote/hasRecord/editable | Notun yalnız varlığı; ham not metni aktarılmaz. Geçmiş/gelecek/bugün, kayıt yok ve editable klavye eki korunur. |
| statistics.summary.empty | renderSummary, parametresiz | Son7 yerel tarih, bugün dahil; yeni çıkarım yok. |
| statistics.summary.most | choiceLabel,count | count1..7, mevcut pencere/sıralama/eşitlik davranışı aynı. |
| statistics.chart.title | renderChart, mode | hour/day/week/month kimlikleri ve seriler aynı. |
| statistics.chart.accessible | mevcut title,total | total=arr son değeri veya0; yeni aritmetik yok. |
| common.build | init, raw appVersion | Teknik sürüm çevrilmez; bu görev sürüm/cache artırmaz. |

## Kaynakla doğrulanan kritik ayrımlar

- **Tarih yereldir.** TodayDay.parseKey yerel Date üretir; toDateKey yerel getFullYear/getMonth/getDate kullanır. UTC ISO slice veya dile göre timezone değişimi yoktur. `tr-TR` bir gösterim dilidir, zorunlu Europe/Istanbul timezone değildir. Cihazın mevcut yerel tarih yorumu korunur; bozuk key bugünle sessizce değiştirilmez.
- **Özet ile grafik farklı sayar.** renderSummary seçimleri7 günde sayar. Grafik log entry sayılarını biriktirir: saat24 hücre, gün7 tarih, hafta4×7 geriye kayan gün, ay12 yerel takvim ayı. “Hafta”yı locale/ISO hafta başlangıcına taşımak hesap değişikliğidir ve kapsam dışıdır. Özet eşitliğinde mevcut stable-sort/ilk karşılaşma davranışı korunur; yeni puan/ranking eklenmez.
- **Label yardımcıları CSV ile paylaşılır.** choiceLabelTR ve colorLabelTR takvim/özet yanında CSV üretiminde de kullanılır. Global helper çevirisi veya bütün string'leri replace etmek CSV sözleşmesini değiştirir. Sunum çağrıları ayrılmalı; CSV kolon/satır/dosya adı, A/B/C,12 renk ID'si ve gün anahtarları aynı kalmalıdır. Bilinmeyen ileri sürüm ID'leri silinmez/normalleştirilmez; mevcut boş-label fallback'i kayıt mutasyonu gerekçesi olmaz.
- **Bazı Türkçe metinler veri olarak saklanır.** logChange.what içinde Seçim/Renk/Not güncellendi/Bugün sıfırlandı bulunur. Bunlar görünen status mesajıyla karıştırılıp kalıcı log metinlerine çevrilmez. Bu çalışma log modeli/migration önermez.
- **Dinamik hedef üreticide kalır.** statusPick için flash requestAnimationFrame ve900ms temizleme; notta450ms timer/tarih/rota guard'ları vardır. Statik bağlayıcıya bu hedefler eklenmez; MutationObserver ile görünen metinden geriye key çıkarımı veya eski mesajı sonradan yeniden gösterme yapılmaz. Dil/sözlük hazır olayı renderCalendar/analiz/kayıt/Radio eylemi tetiklemez.

## Yeniden üretilen kayıt sonucu riski

Mevcut `save()` TodayState.save sonucunu alır, başarısızlıkta merkezi hata bildirir ve sonucu döndürür. Seçim/renk/reset callback'leri sonucu incelemeden flash başarı metnine ilerler. Not callback'i ise save().success kontrolü ve try/catch kullanır.

Gerçek callback kaynak parçaları VM içinde yalnız sentetik kontrol/state ve **save→{success:false}** sınırıyla çalıştırıldı:

| Akış | Gözlenen mesaj | Durum |
|---|---|---|
| Seçim | Kaydedildi. | Başarısız sonuca rağmen yanıltıcı başarı. |
| Renk | Renk kaydedildi. | Aynı risk. |
| Sıfırlama | Bugün temizlendi. | Aynı risk. |
| Not | Not kaydedilemedi. Taslak bu oturumda korunuyor. | Doğru guard; pending draft tutuldu. |

Bu **üç ayrı risk akışının sentetik kaynak yürütmesiyle yeniden üretimidir**; gerçek kota/IndexedDB/localStorage arızası entegrasyon testi değildir. Gerçek kullanıcı verisine veya yazıcıya dokunulmadı. `save()` false sınırı, kısmi/başarısız yazmada atomic rollback veya iki deponun eski kaldığı güvencesini sağlamaz. UI başarı dilini bu belirsizlikle karıştırmamak gerekir. **Risk bu oturumda düzeltilmedi.** Genel ürün veya bu üç akış hatasız ilan edilmez.

## Sonraki dilim ve kabul sınırı

Öncelik, dinamik çeviriden önce **Core seçim/renk/reset akışlarında başarısız kayıt sonucu mesajının sentetik kota/başarısızlık testleriyle doğrulanıp dar kapsamla düzeltilmesidir**. Başarı yalnız gerçek sonuçla ayrılmalı; istisna/partial write'ta sahte “kaydedildi/temizlendi” olmamalı. Yeni storage key, transaction/rollback mimarisi veya şema değişikliği bu önerinin parçası değildir. Kayıtların atomic korunduğunu test etmeden vaat etme. Bekleyen not/reset ilişkisi ve iki veri katmanının gerçek sonuçları ayrı doğrulanmalı. Yeni NUT/TB numarası tahsis edilmedi; I18N02 sunumunun önkoşul bulgusudur. Kullanıcı tetiklemeden düzeltme koduna geçilmez.

Ardından6 Core durum key'inin üretici çağrı noktalarına bağlanması en küçük çeviri dilimidir. Legacy inline classic kod ile ertelenen ESM sözlüğü farklı zamanlarda hazır olur: üretici senkron Türkçe fallback ile çalışmalı; sözlük için save/debounce akışı await edilmemeli, yeni kritik startup bağımlılığı eklenmemeli. Yalnız mesaj döndüren isteğe bağlı salt okunur sunum erişimi somutlaştırılmalı; global API/adapter bu görevde kurulmadı. Eksik sözlükte mevcut Türkçe fallback, textContent güvenliği ve mevcut merkezi kaynak hatası uyarısı korunmalı. Sonraki tarihler/özet formatter'ları mevcut hesaplanmış parametreleri alır; kaydı okumak/yazmak, geçmişi normalize etmek, saat dilimini değiştirmek veya modülü remount etmek formatter'ın işi değildir.

Gelecek kabul: false/throw/partial result ve gerçek sentetik kota; eski not/taslak/gün/rota/odak; takvim invalid/ay-yıl/gece yarısı/üç timezone sınırları; özet0/1/7/eşitlik/unknown ID; parametre eksikliği/XSS/sayı sunumu; CSV byte sözleşmesi; offline sözlük kaybı ve tek Radio. Bu liste gelecek test kapsamıdır; bu görevde tamamlanmış kabul sayılmaz. İngilizce tam uygulama kapısından önce açılmaz; kalıcı tercih tasarımı/data-restore ve fiziksel iPhone/PWA kapıları hâlâ açıktır.

## Bu oturumdaki doğrulama

Üç timezone'da (Europe/Istanbul,UTC,America/New_York) toplam **33 kaynak davranışı kontrolü** çalıştırıldı:9 yerel gün roundtrip/beklenen TR tarih çıktısı;12 özet boş/tek kayıt/7 gün sınırı/eşitlik gözlemi;12 false-save akışı gözlemi (üç risk+doğru not guard'ı her timezone'da). Zaman dilimi tekrarları yeni bağımsız ürün senaryosu sayılmaz. Bu sonuçlar mevcut davranışı tanımlar; riskli çıktıyı yeniden üretmek uygulamanın PASS aldığı anlamına gelmez. Saf VM stubları gerçek browser/persistence/cihaz kabulünün yerini tutmaz.

Nihai kaynak/belge/kapsam kontrolü **7 PASS/0 FAIL,exit0** verdi: kaynak47 dosya/HEAD/dal/status ve mevcut refs korunumu; yalnız4 belge deltası; boş staging/temiz whitespace;15 sözleşmenin kaynak SHA/satır/parametre ve üç bloke key eşliği; eski tasarımın hash ile yeniden kullanımı;33 karakterizasyon gözleminin sözleşme kapsamıyla eşliği (`audit.json`). Bu7 PASS, üç açık uygulama kusurunun düzeltildiği anlamına gelmez. Runtime, tests, assets, index,81 statik binding,80 sözlük, cache foundation-085/app2.23.3/schema2 ve lockfile byte düzeyinde kaynakla aynıdır. Bu yüzden npm test/AI/Engine/benchmark/browser paketleri tekrar çalıştırılmadı; önceki1219/335/4+36 sonuçları yeni koşu sayılmaz. Fiziksel cihaz testi yoktur. Bağımlılık kurulmadı.

Kanıt `/workspace/.cache/today-evidence/dynamic-copy-contract-20261111`: baseline.json,prior-design.md,characterize.cjs,characterization.json,remote-status.json,audit.json. Yalnız4 belge değişir: bu rapor,15 sözleşmeli JSON,04_CHANGELOG.md,10_TECHNICAL_BACKLOG.md.

PR1/2 salt okunur kontrol edildi: açık/taslak/unmerged,ede686d/b57dbce. Uzak NUT CI41122504627 failure,Radio CI41201384768 success; bu belge patch'i için CI çalışmadı. Commit/push/PR güncelleme/merge/deploy/CI rerun yok. Kullanıcının yerel sınırı AGENTS'in geniş akışından önceliklidir; canlı Today/Netlify aynı. Native saat/bildirim/mağaza ertelemesi korunur.

**Durum:** Dinamik kaynak/parametre sözleşmesi doğrulama dilimi tamam; kayıt sonucu riski açık ve düzeltme bekliyor. Dinamik çeviri uygulanmadı. Bu analiz Sol Medium düzeyindedir; sonraki kayıt hatası/veri korunumu düzeltmesinde Sol High önerilir. Önceki tasarım kullanıldı, ilgili kaynaklar ve standart Node VM ile çalışıldı; değişmeyen paketler tekrarlanmadı. Model değişimi/kota yüzdesi iddiası yoktur. Sonraki bağımsız göreve başlanmadı.
