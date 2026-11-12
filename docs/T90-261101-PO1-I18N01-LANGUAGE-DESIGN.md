# PO1-I18N01 — Güncel dil altyapısı ve tercih tasarımı

11 Kasım 2026 (TSİ). **Tasarım güncellemesi; çalışma zamanı dil sistemi, tercih yazıcısı ve İngilizce seçimi uygulanmadı.** Yerel dal `task/t90-261101-po1-i18n01-current-design`, başlangıç SHA `b57dbceb53eb6a9aacc3bde709b4de096b77e38f`, App2.23.3/schema2/foundation-082. Önceki [UX05 yerel patch'i](T90-261101-PO1-UX05-RADIO-AI-ALIGNMENT.md) ve24 dirty dosyası ayrı worktree'ye korunarak kopyalandı.

3 Kasım tarihli aynı görev tasarımı `/workspace/Today-po1-next-plan/docs/T90-261101-PO1-I18N01-LANGUAGE-DESIGN.md` kaynağında bulundu. Bu çalışma önceki kararları yeniden icat etmez: manuel tercih önceliği, yalnız hazır dil, `settings.uiLanguage` önerisi, veri/backup kapıları ve sunum/kanıt ayrımı korunur. Önceki dosyanın tam kopyası ve SHA256'ı yeni kanıt dizininde saklanır. Eski belgeye ait tarih, NUT tabanı, test sayıları ve backup uygulaması bu çalışma için yeni kanıt sayılmaz.

## Güncel kaynakla doğrulanan durum ve farklar

| Kaynak | Doğrulanan davranış | Tasarıma etkisi |
|---|---|---|
| `modules/storage.js` | `metadata.language` boş store oluşturulurken navigator.language'dan alınır; settings varsayılanında yalnız theme vardır. updateSettings alanları birleştirir. | Metadata manuel tercih olarak kullanılmaz veya yeniden anlamlandırılmaz. |
| `modules/state-manager.js` | Save güncel canonical store.settings'i yayıp theme'i günceller; dil alanı için özel sözleşme yoktur. | Bilinmeyen ayarların korunması destekleyici bulgudur; yarış/kota/restore garantisi değildir. |
| `index.html`, `modules/day-manager.js` | lang=tr; takvim/gün ve bazı etiketlerde sabit Türkçe format/işlevler bulunur. | Yalnız html.lang değiştirmek yerelleştirme değildir. |
| Health/Sky/Radio/AI UI modülleri | DOM içinde üretilen Türkçe durumlar, hata, onay ve dinamik metinler vardır. | Statik HTML kataloğu bütün uygulama kapsamı sayılamaz. |
| `modules/notification-store.mjs` | CAVEATS dizisinin metin/sıra eşliği strict reportOf içinde doğrulanır. | Arşivdeki kanonik belirsizlik cümleleri çeviri uğruna değiştirilemez. |
| `modules/ai-context-ui.mjs` | PURPOSE hem görünür açıklama hem consent/context çağrı girdisidir. | Görünür metin ile kanonik amaç/onay sözleşmesi ayrılmalıdır. |
| Mevcut Radio çalışma ağacı | Üretim i18n/locale modülü ve tam backup/restore modülleri bulunmuyor. | Eski NUT adayındaki23 LS anahtarlı backup ve backup-core-preferences bulgusu burada uygulanmış kabul edilmez. |

Önceki I18N02–06 taslakları aynı eski plan ağacında mevcut; yeniden yazılmayacak, ilgili uygulama diliminde kaynakla eşlenecek. I18N02 Core kataloğunun sourceSha256'ı eski Radio index'idir (`77e2283d…`); şu anki index `60d2627d…` ile aynı değildir. Eski katalog67 literal ve completeEnglishRelease=false içerir. Yeni **Core’a dön**, **Modülleri aç**, yönerge, not hata metni ve yeni renkler kaynakla tekrar eşlenmelidir. Eski taslak Mercan/Coral öneriyordu; güncel onaylı uygulama `mint` / **Nane** kullanır. `mint` değeri `coral` yapılmaz. Önceki katalogdaki bütün girdilerin geçersiz olduğu da varsayılmaz; yalnız doğrulanmış farklar yeniden işlenir.

## Dil çözümleme sözleşmesi

Önceki saf API önerisi korunur: `resolveLanguage({preference, deviceLanguages, availableLanguages})` → effectiveLanguage + reason. Henüz export edilen bir API değildir. Fonksiyon DOM/storage/ağ/saat dilimi okumaz, dışarıdan verilen girdiyi değiştirmez. Uygulama adaptörü cihaz dillerini `navigator.languages`, yoksa `navigator.language` üzerinden sağlar. Konum/IP/user-agent/sağlık verisinden dil türetilmez; sunucu dil tespiti yoktur.

Şimdiki hazır dil yalnız **tr**'dir. Hedef ikinci dil **en**, format locale önerileri tr-TR/en-US'tir; İngilizce tüm uygulama kapısını geçmeden hazır dil listesine girmez.

| Girdi | Beklenen çözüm | Saklama davranışı |
|---|---|---|
| manual tr, cihaz en-US | tr / manual | Yeni yazma yok. |
| manual en, hazır tr+en | en / manual | Yeni yazma yok. |
| auto/yok, hazır tr+en, cihaz [fr-FR,en-GB,tr-TR] | en / device | Tespit saklanmaz. |
| auto/yok, hazır yalnız tr, cihaz [en-US,tr-TR] | tr / device | İngilizce menüye/ekrana açılmaz. |
| auto/yok, desteklenmeyen/boş/bozuk cihaz etiketleri | tr / fallback | Ham cihaz listesi yeni tercihe dönüştürülmez. |
| manual en, bu build en sunamıyor | tr / unavailable-preference | Saklı en korunur; sessiz tr/auto yazımı yok. |
| Bilinmeyen gelecek tercih veya geçersiz tür | tr / unsupported-preference | Ham değer silinmez/normalleştirilmez; güvenli görünüm. |
| Auto ve cihaz dili sonradan değişmiş | Sonraki belge açılışında tekrar çözümle | Açık formda kendiliğinden dil/rota değiştirme yok. |

Etiketler BCP47 temel dil eşlemesiyle tr/en'e indirgenir; geçersiz etiket uygulamayı düşürmez. Saf çözümleyici için toleranslı girdi sınırları somut testlerle uygulanmalı; dil eşleşmesi keyfi `startsWith` olmamalı. Kullanıcının manuel seçimi destekleniyorsa her zaman üstündür. Saklı dili bu build sunamıyorsa bütün görünüm güvenli Türkçe açılır, uygun kısa açıklama sunulur; yarım İngilizce oluşmaz.

## Kalıcı tercih: korunmuş öneri, henüz yazma yok

Yeni LS anahtarı yerine canonical `today_store_v2.settings.uiLanguage` alanı **auto/tr/en** olarak önerilir; alanın yokluğu auto anlamına gelir. Metadata, theme, günler/kullanım/log, kullanıcı metni ve bilinmeyen settings alanları korunur. Bu tasarım alanı etkinleştirme veya migration onayı değildir. Bu oturum alanı/anahtarı/şemayı eklemez.

İlk çözümleme salt okunurdur: absent alanı doldurmak için varsayılan yazma yoktur. Adaptör dili öğrenmek için boş store oluşturabilen loadStore'u erken çağırmaz. Mevcut startup doğrulama/migration kapısı korunur; sağlanan hazır snapshot veya yan etkisiz okuma kullanılır. Bozuk ham JSON, desteklenmeyen şema ve storage erişim hatasında dil okuyucusu reset/recovery başlatmaz; Türkçe güvenli görünümle devam eder.

Manuel yazma ayrıca dar uygulama dilimi gerektirir:

- Canonical writer sahipliği, main/backup/legacy ilişkisi ve eşzamanlı Core/tema yazmaları incelenir. Sadece updateSettings çağrısı eklemek yeterli değildir: dönüş değeri settings kopyasıdır; diske başarı ve diğer verilerin korunumu ayrıca doğrulanır.
- İzinli güncel snapshot üstünden yalnız ilgili alan değiştirilir; bilinmeyen alanlar düşürülmez. Geri okuma/durum ayrımı gerekir: saved / not-saved / outcome-unknown. Kota/erişim hatasında “hatırlandı” veya sahte başarı yoktur; görünümde geçici dil sunulursa kalıcı olmadığı söylenir.
- Readback tek başına yarış güvenliği/atomiklik kanıtı değildir. Birden fazla mevcut yazıcıyla ortak sahiplik/seri işlem kararı ve yarış testleri gerekir. Onaysız global kilit/migration veya bütün state katmanı yeniden yazımı bu tasarımın parçası değildir. Yazıcı kapsamı somutlaşmadan kalıcı dil UI'sı açılmaz.
- Gerçek tam export/restore envanteri ve validator mevcut adayda doğrulanır. Aynı key'in raw değerini export etmek tek başına preference restore kabulü değildir. Alan yokluğu/auto/tr/en/unknown, eski arşiv, yarım/başarısız yazma ve restore-startup korunumu sınanır. T90-07/08 açık kapıları geçmeden pilot/yayın kabulü verilmez.

## Sözlük, biçim ve DOM uygulama ilkeleri

Hafif, modüler ve uygulamayla birlikte paketlenen sözlükler yeterlidir; yeni framework/dış çeviri servisi seçilmez. Anlam kimlikleri (common.back, core.note.label gibi) sabit kalır. App-owned text/title/aria-label/placeholder/legend/option/status/hata/boş durum ve sonradan yazılan metinler envantere alınır. Metin ve adlandırılmış parametreler iki dilde aynı sözleşmeyi taşır; tekil/çoğul ayrıca denetlenir. Kaynak envanteri, çağrı yerleri ve editoryal inceleme birlikte İngilizce hazır kapısını oluşturur; yalnız key sayısı/parite yeterli değildir.

Kullanıcı notları, kayıt/renk/choice/ruleset/catalog/provider kimlikleri, ham arşivler, Radio yayıncı/istasyon adları çevrilmez. App'e ait ülke/filtre etiketleri çevrilebilir; option value ve dış dizin arama parametresi değiştirilmez. Çeviri hizmetine hiçbir ham kayıt gönderilmez.

Tarih/sayı yalnız Intl sunumudur: gün anahtarı YYYY-MM-DD, ISO anı, saat dilimi, hafta başlangıcı/sırası, ölçüm birimi ve saklanan miktar değişmez. Sayısal giriş parsing'i ayrı sözleşmedir; formatlanmış string veritabanındaki sayının yerine yazılmaz. Native tarih/saat/izin pencereleri OS/tarayıcı diline bağlıdır; app bunların dilini değiştirdiğini vaat etmez.

İleride dil değişimi belge lang alanını ve UI metinlerini günceller; ltr ilk iki dil için korunur. Gün/rota/takvim seçimi, Core bekleyen not Map'i, Health/Sky taslakları, odak/scroll, AI kapsam/onay/kanıt/karar ve tek Radio Audio korunmalıdır. Salt metin düğümü veya güvenli attribute güncellenir; input/SVG/ikon içeren label'ın tamamına textContent atanıp kontrol silinmez. innerHTML/otomatik sayfa reload'u, modül remount'u, ikinci listener/player veya yeniden fetch/analiz/bildirim yoktur. Async cevaplar eski dili geri yazmamalıdır.

AI çevirisi sunumda yapılır. Kural/eşik/kanıt/kapsam/güven/belirsizlik ve mevcut arşiv semantiği aynı kalır. CAVEATS veya PURPOSE için global string-replace yapılmaz; görünen çeviri, kanonik rapor/onay verisini yeniden yazmaz. Eski Türkçe raporların ham içerikleri korunur; güvenle temsil edilemeyen eski serbest metin çevrilmiş gibi gösterilmez. Tıbbi/psikolojik kesinlik veya yeni model/izin eklenmez. Native saat/bildirim ertelemesi geçerlidir.

## Uygulama sırası ve kabul kapıları

1. **Sıradaki küçük iş: aynı I18N01 altında saf, salt okunur dil çözümleyicisi + hedefli testler.** Mevcut diller yalnız tr; en örnekleri yalnız saf test girdilerinde. Yeni storage yazıcısı/alanı, seçici, DOM dil değişimi veya üretimde İngilizce açılışı yoktur. Bu oturum kodlamaya geçmez.
2. Mevcut I18N02–06 katalog/taslaklarını gerçek güncel Core/Health/Sky/Radio/AI kaynaklarıyla rebase et; duplicate tasarım yazma. Önce Core değişen NAV01/COR01/not metinlerini eşle. TR sunum bağlayıcıları küçük dilimlerle, veri/state korunumu testleriyle uygulanır.
3. Kalıcı tercih için writer/backup/restore etkisini ayrıca somutlaştır; yeni alanı açıklayıp ilgili kabulü tamamla. Yazma ve gerçek dil seçici o ayrı kapsamda ele alınır.
4. English hazırlığı ancak bütün app-owned modüller/dinamik metin/hata/aria ve formatlar, safe missing-key fallback'i, parametreler, uzun metin/temalar, reload/restore ve gerçek iPhone Safari/kurulu PWA kabulüyle açılır. Bilinçli modül bazlı çeviri dilimleri geliştirilir ama kullanıcıya karışık dil olarak sunulmaz.

Gelecek testler: çözümleme tablosu; metadata ile tercihin ayrılığı; storage kapalı/kota/bozuk veri; yeni alanın restore ve eşzamanlı yazıcı korunumu; missing key/parametre/çoğulluk; XSS güvenli metin; açık form/AI onay/Radio tek akış korunumu;320/393/430/520px ve büyük yazı; gerçek Safari/PWA/Windows. Bu liste planlanan kabul kapsamıdır, çalıştırılmış test değildir.

## Bu oturumun doğrulaması ve sınırları

Yalnız3 belge değişir: bu güncellenmiş tasarım, changelog ve backlog. Runtime/test/asset/lockfile/sürüm/SW byte düzeyinde kaynakla aynıdır. Kanıt `/workspace/.cache/today-evidence/language-design-20261111`: source snapshot, prior-source.json/önceki tasarım kopyası, source-evidence.json ve audit.json. Bütünlük ve kaynak bulguları5/5 PASS olarak aşağıdaki doğrulama kaydında yer alır; dil davranışı/tercih/çeviri testi değildir. Uygulama paketleri yalnız belge değiştiği için tekrar çalıştırılmaz; önceki UX05'in1161/335/76 sonucu yeni koşu sayılmaz.

PR1/PR2 yeniden salt okunur doğrulandı: açık/taslak/unmerged; SHA'lar ede686d/b57dbce. Mevcut CI1:41122504627 failure, Radio CI2:41201384768 success yeniden okunur; bu tasarım için CI tetiklenmez. Commit/push/PR güncelleme/merge/deploy/CI rerun yoktur. Kullanıcının yerel sınırı AGENTS'in daha geniş akışından önceliklidir. Canlı uygulama/Netlify değişmez.

**Durum: I18N01 tasarım güncellemesi tamam; runtime ve kalıcı tercih uygulaması henüz yoktur.** Sonraki öneri yukarıdaki1. adımdır, I18N02 tasarımını yeniden üretmek değildir. Model önerisi Sol Medium; yalnız rapor düzenlemesi Luna ile de yapılabilir. Eski tasarım yeniden kullanıldı, ilgili kaynaklarla sınırlı kontrol yapıldı, bağımlılık kurulmadı ve uygulama testleri gereksiz tekrarlanmadı. Model/kalan kota yüzdesi iddiası yoktur.

## Nihai belge doğrulama kaydı

| Kontrol | Sonuç |
|---|---|
| Kaynak HEAD/dal/status ve24 dirty dosya değişmezliği |PASS|
| Önceden var olan Git refs değişmezliği |PASS|
| Yalnız3 belgeli delta; diğer uygulama/test dosyaları byte eşit |PASS|
| Boş staging ve temiz whitespace |PASS|
|8 kaynak bulgusunun güncel kaynak/önceki tasarım SHA'sıyla eşliği |PASS|

Toplam **5 PASS/0 FAIL**, exit0 (`audit.json`). Sekiz kaynak bulgusu son kontrolün iç kapsamıdır;8 ayrı uygulama testi değildir. Dil çözümleme, tercih yazma veya gerçek cihaz testi bu oturumda çalıştırılmadı. Runtime dosyaları değişmediği için önceki uygulama kapıları tekrarlanmadı. Tasarım güncellemesi tamamlandı; sonraki salt okunur çözümleyici görevine geçilmedi.
