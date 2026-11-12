### Canlı aday — üretim restore ve fiziksel kabul

Yerel salt okunur önizleme ekranı tamamlandı. Yazma/kurtarma UI bağlantısı, BFCache/WebKit ve gerçek iPhone Safari/kurulu PWA kabulü açık; uzak CI yeni adayı henüz görmedi. Rapor: `docs/TODAY-LIVE-RESTORE-UI.md`.

### Canlı aday — BFCache ve Worker değişimi yarışı

Tek pencere kilidi Chromium sentetik kabulü geçti. Eski sürüm/BFCache penceresi, SW kontrolü değişimi ve uygulama sırası yarışları WebKit/iPhone dahil doğrulanmadan restore canlı açılmaz. Rapor: `docs/TODAY-LIVE-WRITER-ADMISSION.md`.

### Canlı aday — WebKit ve çoklu yazıcı kurtarma kapısı

Chromium gerçek IndexedDB sentetik commit/rollback kabulü var. WebKit çalışma ortamı eksik sistem kütüphaneleri nedeniyle açılmadı. Eski BFCache/çok sekmeli yazıcı ve gerçek iPhone Safari/PWA davranışı ayrıca doğrulanmalı. Rapor: `docs/TODAY-LIVE-NATIVE-RECOVERY-ACCEPTANCE.md`.


### Canlı aday — gerçek tarayıcıda sentetik kurtarma kabulü

Radio2.23.3 adayında sentetik apply/rollback testleri var. Üretim restore açılmadan gerçek IndexedDB, çok sekmeli eski yazıcı, kota/kesinti ve iPhone Safari/PWA kabulü gerekir. Rapor: `docs/TODAY-LIVE-SYNTHETIC-RECOVERY.md`.


### Canlı aday — transactional restore ve kesinti kapısı

Şifreli dosyanın güncel2.23.3 adayına salt okunur semantik önizleyicisi taşındı;Health52 ID/10 alias eşleşti. Apply kapalı. Rapor: `docs/TODAY-LIVE-RESTORE-PREVIEW.md`.

### Canlı aday — tam restore ve kesinti kabulü

Ayarlar yedek düğmesi güncel SW güvenlik sorgusuyla ayrı şifreli dosya sayfasını açar. Core TR sözlük136 taslak/EN kilitli;gerçek iki motor sentetik dosya kontrolü geçti. Rapor: `docs/TODAY-LIVE-BACKUP-LAUNCH.md`. Restore/fiziksel/canlı kapıları açık.

### Canlı aday — yedek giriş kontrolü ve geri yükleme

Yedek sayfası/UI ve worker tek pencere/lock protokolü yerel adayda;cache097/shell132. Başlangıçta veri erişimi yok, restore yok. Rapor: `docs/TODAY-LIVE-BACKUP-PAGE.md`.

### Canlı aday — export izolasyon protokolü

Eski şifreli yedek export modülü güncel adayda izole ve UI/SW bağımsız taşındı;23 LS/3 store sentetik test kapsamı eklendi. Rapor: `docs/TODAY-LIVE-EXPORT-PORT.md`. Restore ve canlı yayın açık.

### Canlı aday — güncel veri envanteri

Kullanıcının canlıya geçiş isteğiyle Pages2.23.3/082, yerel096 ve Netlify401 salt okunur karşılaştırıldı. Güncel adayın tam backup/restore ve cihaz kabulü açık. Rapor: `docs/TODAY-LIVE-RELEASE-GATE-2026-11-12.md`. Sıradaki dar iş güncel kalıcı veri envanteri.

### PO1-I18N03 — Health kartı ve katalog kaynak eşlemesi

Dört eski katalogda283 EN taslak kaynak literaline eşleşti;36 satır işareti güncel konumdan kaymış. Health kartındaki iki metin ayrımı açık. Rapor: `docs/T90-261101-PO1-I18N02-EN-MODULE-MATRIX.md`.

### PO1-I18N02 — Uygulama geneli EN kaynak matrisi

Mevcut I18N01 tercihi, güncel135 Core taslağı ve runtime sahipliği beş küçük kabul dilimine eşlendi. 12 ana grubun ilerleme ölçüsü belgelendi. Rapor: `docs/T90-261101-PO1-I18N02-EN-BINDING-DESIGN.md`.

### PO1-I18N02 — EN bağlama ve tercih tasarımı

Dinamik Core/ortak 14 üretici grubu güncel koda göre yeniden sınıflandırıldı; Health kartı metin ayrımı I18N03 sahibi olarak açık. Rapor: `docs/T90-261101-PO1-I18N02-EN-RUNTIME-INVENTORY.md`.

### PO1-I18N02 — Dinamik EN kapsam envanteri

135 Core/ortak EN taslağı gözden geçirildi; 11 katalog metni iyileştirildi. EN yayın kilidi korunuyor. Rapor: `docs/T90-261101-PO1-I18N02-EN-REVIEW.md`.

### PO1-I18N02 — İngilizce taslakların gözden geçirilmesi

Core/ortak katalogda 69 boş EN taslağı dolduruldu; 135/135 taslak, sıfır editoryal onay. TR çalışma dili ve EN yayın kilidi korunuyor. Yerel rapor: `docs/T90-261101-PO1-I18N02-EN-DRAFT.md`.

# TODAY MASTER PROJECT
## Technical Backlog

Document: Technical Backlog
Version: 1.0
Status: Active
Owner: Today Master Project
Current Phase: NUT-018 — Teknik stabilizasyon
Next Phase: Test kapsamı, bağımlılıklar ve gerçek tarayıcı/PWA hazırlığı
Last Updated: 29 October 2026

---

# Purpose

This document tracks technical improvements, refactoring tasks, and engineering work required to maintain a reliable and scalable Today platform.

---

# Phase 1 — Foundation

## 12 Kasım 2026 — PO1-I18N02 ortak fallback/metaveri metinleri

[İlk grafik açıklaması ve sürüm etiketi](T90-261101-PO1-I18N02-COMMON-FALLBACKS.md), task/t90-261101-po1-i18n02-common-fallbacks yerel dalı. İki dictionary key;yalnız başlangıç fallback'i ve gerçek sürüm değerinin literal sunumu. Canlı grafik özeti/alt kontroller/versiyon/HTML/writer/veri aynı.135 key,eski133 korunur;EN/tercih kapalı. Hedef8/8,katalog12/12,tam platform1322/1322,AI/Radio335/335,seçili browser16/16 (8+8),bütünlük6/6 PASS,0FAIL/exit0. Dar dilim yerel olarak tamam;tüm E2E/genel I18N02/fiziksel kabul değildir. Kaynak82 dosya korunur;cache096,shell129,App2.23.3/schema2/lockfile aynı. Genel I18N02/veri/restore/fiziksel/pilot kapıları açık. Sonraki ayrı öneri Core/ortak İngilizce taslaklarını tamamlama/inceleme;EN UI açılmaz (Luna/Sol Medium). Commit/push/PR/merge/deploy/CI rerun yok.

## 12 Kasım 2026 — PO1-I18N02 saf tarih sunumu

[Core/ay/takvim tarih sunumu](T90-261101-PO1-I18N02-DATE-PRESENTATION.md), task/t90-261101-po1-i18n02-date-presentation yerel dalı. Saf formatter ve day stili;active provider açık TR,classic guard bağımsız TR fallback. Yerel gün key/parse/DST/editability/CSV/kayıt aynı;EN/tercih açılmaz. Yeni hedef12/12,takvim13/13,katalog12/12,tam platform1314/1314,AI/Radio335/335,bütünlük6/6 PASS. Browser ilk16PASS/2FAIL,test fixture replacement `$&` hatasıydı;callback ile düzeltilen iki hedef2/2 PASS.18 ayrı senaryo doğrulandı,tek18/18 koşusu iddiası yok;açık hata yok. Dar dilim yerel olarak tamam,genel I18N02/fiziksel kabul değildir. Kaynak78 dosya korunur;cache095,shell129(tek ek bağımlılık),App2.23.3/schema2/133 dictionary/lockfile aynı. Genel I18N02/veri/restore/fiziksel/pilot kapıları açık. Sonraki ayrı öneri kalan fallback/metaveri sunumu (Luna/Sol Medium). Commit/push/PR/merge/deploy/CI rerun yok.

## 12 Kasım 2026 — PO1-I18N02 ayrı seçim-renk UI etiketleri

[Takvim/özet etiket sunumu](T90-261101-PO1-I18N02-CORE-LABELS.md), task/t90-261101-po1-i18n02-core-labels yerel dalı. Üç seçim/12 renk için donmuş provider;dört UI çağrısı/senkron TR fallback. choiceLabelTR/colorLabelTR ve CSV/writer/kimlikler aynı;133 dictionary key/metin korunur,EN/tercih yok. Yeni hedef10/10,istatistik8/8,katalog12/12;tam platform1302/1302,AI/Radio335/335,seçili browser16/16 (8+8) ve bütünlük6/6 PASS,0FAIL/exit0. Dar etiket dilimi yerel olarak tamam;tüm E2E/İngilizce/fiziksel kabul değildir. Kaynak75 dosya korunur;cache094,shell128,App2.23.3/schema2/lockfile aynı. Genel I18N02/veri/restore/fiziksel/pilot kapıları açık;sonraki ayrı öneri tarih sunumunu kayıt anahtarlarından bağımsız yerelleştirme hazırlığı (Sol Medium). Commit/push/PR/merge/deploy/CI rerun yok.

## 12 Kasım 2026 — PO1-I18N02 kapsam ve İngilizce hazırlık denetimi

[Core/ortak kapsam denetimi](T90-261101-PO1-I18N02-COVERAGE-REVIEW.md) ve kaynak/hash bağlı JSON envanteri task/t90-261101-po1-i18n02-coverage-review yerel dalında.146 statik aday:81 bağlı,2 dinamik bağlı,53 devredilen,8 marka,1 build etiketi,1 transient fallback;14 runtime üretici grubu ayrıca incelendi.133 katalog girdisi66 EN taslak+67 çevrilmemiş,0 reviewed. UI seçim/renk adları CSV ile aynı TR helper'ı kullanıyor;sonraki ayrı öneri sadece UI etiketi köprüsü (Sol Medium). Kaynak73 yerel dosya korunur;yalnız5 belge,runtime/test/şema/key/lockfile/cache093 aynı. İlk envanter7/8 parent/text node varsayımı düzeltildi;son8/8,katalog12/12 PASS. Kapsam/bütünlük6/6 PASS,0 nihai FAIL;dar denetim tamamlandı;tam platform/AI/browser değişmeyen runtime için tekrarlanmadı. Genel I18N02/veri/restore/fiziksel/pilot kapıları açık. Commit/push/PR/merge/deploy/CI rerun yok.

## 12 Kasım 2026 — PO1-I18N02 güncelleme paneli metinleri

[Mevcut SW güncelleme paneli sunumu](T90-261101-PO1-I18N02-UPDATE-COPY.md), task/t90-261101-po1-i18n02-update-copy yerel dalı. Altı metin opsiyonel donmuş provider/senkron TR fallback;Today Yenilik aynı. Kullanıcı onayı/defer/activation/controllerchange/reload/veri korunur.133 key,eski127 aynı;EN/tercih kapalı. Yeni hedef8/8,katalog12/12,tam platform1292/1292,AI/Radio335/335,seçili browser10/10 (5+5) ve bütünlük6/6 PASS,0FAIL/exit0. Dar dilim yerel olarak tamam;genel çok dillilik/tüm E2E/fiziksel kabul değildir. Kaynak69 yerel dosya korunur;cache093,shell128,App2.23.3/schema2/lockfile aynı. Native bildirim/yayın başlatılmadı;genel I18N02/veri/restore/fiziksel/pilot kapıları açık. Sonraki ayrı öneri Core/ortak metin kapsamı ve İngilizce hazırlık eksiklerini denetleme (Sol Medium). Commit/push/PR/merge/deploy/CI rerun yok.

## 12 Kasım 2026 — PO1-I18N02 merkezi hata metinleri

[Merkezi hata sunumu](T90-261101-PO1-I18N02-ERROR-COPY.md), task/t90-261101-po1-i18n02-error-copy yerel dalı.13 bilinen mesaj ve kontrol/kod şablonu salt okunur provider ile yalnız UI'da biçimlenir. Bilinmeyen/özel metin ve frozen log/console/event/kod/recovery aynı; ESM yoksa bağımsız senkron TR.127 key,eski110 korunur,EN/tercih kapalı. Yeni hedef12/12,katalog12/12 PASS;katalogun ilk dosya yolu düzenleme hatası düzeltildi. Platform1284/1284,AI/Radio335/335,seçili browser18/18 (9+9) ve bütünlük6/6 PASS,0 nihai FAIL/exit0;dar hata sunumu yerel olarak tamam. Tüm E2E/fiziksel kabul değildir. Kaynak65 dosya korunur;cache092,shell128,App2.23.3/schema2/lockfile aynı. Genel I18N02/veri/restore/fiziksel/pilot kapıları açık. Sonraki ayrı öneri mevcut SW güncelleme paneli metinleri (Sol Medium);native bildirim işi başlatılmaz. Commit/push/PR/merge/deploy/CI rerun yok.

## 12 Kasım 2026 — PO1-I18N02 başlangıç hata sunumu

[Başlangıç hata metinleri](T90-261101-PO1-I18N02-STARTUP-COPY.md), task/t90-261101-po1-i18n02-startup-copy dalında. İki hata yüzeyi opsiyonel/donmuş provider kullanır; erken ESM yüklenemezse senkron TR fallback bağımsızdır.110 key,eski106 aynı;EN/tercih kapalı. Kod/diagnostic,migration,kurtarma/focus/reload ve kayıtlar korunur. Hedef8/8,katalog12/12,platform1272/1272,AI/Radio335/335 PASS. Browser ilk10PASS/2FAIL yeni testin diagnostic satırı varsayımıydı; kaynak sözleşmesine göre tam satır testi düzeltildi. Hedefli tekrar+regresyon10/10 ve bütünlük6/6 PASS; ilk geçen10 ile20 ayrı browser senaryosu doğrulandı,tek20/20 koşu iddiası yok. Açık hata yok;dar başlangıç dilimi yerel olarak tamam. Kaynak61 yerel dosya korunur;cache091,shell128,App2.23.3/schema2/lockfile aynı. Merkezi error-manager bu dilimde değişmedi; genel I18N02/fiziksel/veri/restore/pilot kapıları açık. Commit/push/PR/merge/deploy/CI rerun yok;sonraki ayrı öneri ortak merkezi hata sunumu (Sol Medium).

## 12 Kasım 2026 — PO1-I18N02 dinamik istatistik metinleri

[Dinamik özet/grafik sunumu](T90-261101-PO1-I18N02-STATISTICS-DYNAMIC.md), task/t90-261101-po1-i18n02-statistics-dynamic dalında. Hesaplanmış label/count/title/total salt okunur provider ile biçimlenir; senkron TR fallback ve literal parametreler.7 gün/eşitlik/seri/toplam/CSV/writer aynı.106 sözlük,eski103 aynı;3 key/parametre,EN kapalı. Hedef8/8 ve katalog12/12 PASS; platform1264/1264,AI/Radio335/335,seçili browser60/60 (30+30) ve bütünlük6/6 da PASS,0FAIL/exit0. Gerçek Türkçe CSV iki motorda değişmez; dar dilim yerel olarak tamam, tüm E2E/genel çok dillilik kabulü değildir. Kaynak58 dosya korunur;cache090,shell128,App2.23.3/schema2 aynı. Yayın hazırlığı başlatılmadı;commit/push/PR/merge/deploy/CI rerun yok. Sonraki ayrı öneri ortak başlangıç/hata/fallback metinleri (Sol Medium); genel dil/veri/restore/fiziksel/pilot kapıları açık.

## 12 Kasım 2026 — PO1-I18N02 takvim günü aria metinleri ve genel durum

[Kaydı açıklayan takvim aria sunumu](T90-261101-PO1-I18N02-CALENDAR-ARIA.md), task/t90-261101-po1-i18n02-calendar-aria dalında.103 sözlük,eski95 aynı;8 yeni key ve iki parametreli metin. Ham not aktarılmadan tarih/durum/kayıt/hint birleştirilir; hesap/key/editability/CSV ve kayıtlar aynı. Hedef13/13,katalog12/12,platform1256/1256,AI/Radio335/335 PASS; seçili browser58/58 (29+29) ve bütünlük6/6 da PASS,0FAIL/exit0. Bu dar dilim yerel otomatik kabulüyle tamam; tüm E2E/genel çok dillilik tamamlandı iddiası yok. Kaynak56 dosya korunur;cache089,shell128,App2.23.3/schema2 aynı. [Ana talimat durum tablosu](TODAY-CURRENT-STATUS.md) güncellendi: UX yerel,aktif I18N02; diğer diller,ses/Radio ekleri,AUTH tasarımı,veri güveni/fiziksel kabul/pilot açık; kesin bitiş tarihi yok. Commit/push/PR/merge/deploy/CI rerun yok. Sonraki ayrı öneri dinamik istatistik sunumu (Sol Medium).

## 12 Kasım 2026 — PO1-I18N02 dinamik takvim, ilk dilim

[Core/ay tarih başlığı ve hafta günü sunumu](T90-261101-PO1-I18N02-CALENDAR-COPY.md) task/t90-261101-po1-i18n02-calendar-copy yerel dalında. Synchronous TR fallback/donmuş calendar köprüsü; local Date/gün anahtarı/Pazartesi sırası/editable kuralları aynı.95 sözlük, eski81 aynı;14 hafta günü etiketi, EN kapalı. İlk hedef6/8 iki yanlış test varsayımı; sözleşme doğrulanarak son8/8 PASS. Son platform1251/1251,AI/Radio335/335,seçili browser56/56 (28+28) ve bütünlük6/6 PASS,0 nihai FAIL/exit0; bu dar dilim yerel olarak tamam. Tüm E2E ve genel çok dillilik kabulü değildir. Üretim index/entry/sözlük/cache088;128 shell,App2.23.3/schema2/writer/lockfile aynı. Kaynak53 yerel dosya korunur. Fiziksel kabul/tercih/commit/push/PR/merge/deploy/CI rerun yok. Sonraki ayrı öneri gün hücresi aria açıklamaları (Sol Medium); genel dil/veri/restore/pilot kapıları açık.

## 11 Kasım 2026 — PO1-I18N02 dinamik Core mesajları

[Dinamik Core mesaj bağlaması](T90-261101-PO1-I18N02-CORE-MESSAGES.md) ayrı task/t90-261101-po1-i18n02-core-messages dalında: yedi salt okunur metin, senkron TR fallback; save guard/debounce/Map/rota/tarih aynı. Yeni core.changeFailed ile81 sözlük, önceki80 aynı; EN/tercih yok. Hedef24/24, katalog12/12, platform1243/1243 ve AI/Radio335/335 PASS; seçili browser56/56 (28+28) ve bütünlük6/6 da PASS,0FAIL/exit0. Bu dar dilim yerel otomatik kabulüyle tamam; tüm E2E/çok dillilik tamamlandı iddiası yok. Writer/şema/key/lockfile ve128 kabuk aynı; cache087. Kısmi yazma rollback'i eklenmedi. Kaynak51 dosya korunur; fiziksel kabul/yayın/commit/push/PR/merge/CI rerun yok. Sonraki ayrı öneri I18N02 dinamik takvim sunumu (Sol Medium); genel dil/veri/restore/pilot kapıları açık.

## Güncel devam — Core kayıt sonucu, 11 Kasım 2026

[Seçim/renk/reset sonuç mesajı düzeltmesi](CORE-SAVE-STATUS.md) task/t90-261101-po1-core-save-status yerel dalında. Eski callback'ler save sonucunu incelemiyordu; yeni yerel helper false/exception'da doğru hata mesajı, true'da eski başarı mesajını verir. Writer/şema/key/migration/dependency aynı; RAM rollback eklenmedi, canonical başarısızken legacy değişmiş olabilir. Eski hedef3PASS/9FAIL→12/12 PASS; son platform1231/1231, AI/Radio335/335 PASS. Core browser48/48 (24+24), seçili offline/SW/Radio8/8 (4+4) ve bütünlük6/6 PASS,0 nihai FAIL/exit0. Dar mesaj düzeltmesi yerel otomatik kabulüyle tamam; tek tam E2E iddiası yok. Kaynak49 yerel dosya korunur. Üretim index+cache foundation-086;128 shell ve App2.23.3/schema2 aynı. EN/tercih, fiziksel kabul/commit/push/PR/merge/deploy/CI rerun yok. Sonraki ayrı öneri I18N02 dinamik Core mesajlarını sözlüğe bağlamak (Sol High/Medium); veri/restore/pilot kapıları açık.

## Güncel devam — PO1-I18N02 dinamik sözleşme, 11 Kasım 2026

[15 üreticinin kaynak/parametre/sahiplik doğrulaması](T90-261101-PO1-I18N02-DYNAMIC-CONTRACT.md), task/t90-261101-po1-i18n02-dynamic-contract yerel dalında; eski3 Kasım tasarımı kullanıldı. Yerel tarih,7 günlük özet/eşitlik, grafik entry sayısı, CSV ortak helper ve kalıcı log metni sınırları kaydedildi. Üç timezone'da33 kaynak karakterizasyonu: seçim/renk/reset save=false iken başarı mesajına ilerliyor; not guard'ı doğru. Üç risk akışı sentetik olarak yeniden üretildi, düzeltilmedi; bu sonuç ürün PASS'i değildir. Kaynak/belge/kapsam7/7 PASS,0FAIL/exit0; uygulama kusurları bu sayıya başarı diye dahil edilmez. Yalnız4 belge; runtime/test/şema/key/lockfile/cache/sözlük aynı. Uygulama paketleri tekrarlanmadı, eski sonuçlar yeni kabul sayılmaz. Sonraki öncelik dinamik çeviriden önce dar Core başarısız kayıt mesajı düzeltmesi/kota doğrulaması (Sol High). Fiziksel/restore/pilot kapıları açık; uzak CI/commit/push/PR/merge/deploy yok.

## Güncel devam — PO1-I18N02 istatistik bağlama, 11 Kasım 2026

[İstatistik panelinin14 statik hedefi](T90-261101-PO1-I18N02-STATISTICS-BINDINGS.md) task/t90-261101-po1-i18n02-statistics-bindings yerel dalında; önceki67 hedef aynı, toplam81. Kaynaktaki5 eksik mode title/log açıklamasıyla katalog/sözlük80 girdi; eski75 aynı, İngilizce kapalı. Grafik başlık/erişilebilir özet ve hesaplar renderChart/renderSummary sahipliğinde. Hedef26/26, katalog12/12, yeni browser4/4, platform1219/1219 ve AI/Radio335/335 PASS,0FAIL/exit0; ilgili browser regresyon36/36 (18+18) ve bütünlük6/6 da PASS. Yeni4+mevcut36 ayrı seçilmiş koşulardır; tek tam E2E iddiası yok. Bu oturumda başarısız koşu olmadı. Dar istatistik dilimi yerel otomatik kabulüyle tamam, genel I18N02 açık. Üretim yalnız bağlayıcı/TR sözlük/cache foundation-085;128 kabuk/index/entry/şema/key/migration/lockfile aynı. Kaynak45 değişiklik korunur. Tercih yazımı, fiziksel kabul, uzak CI/commit/push/PR/merge/deploy yok. Sonraki ayrı öneri I18N02 dinamik metinlerde mevcut kaynak/parametre/sahiplik sözleşmesini güncel üreticilerle doğrulama (Sol Medium); genel çok dillilik ve veri/restore/pilot kapıları açık.

## Güncel devam — PO1-I18N02 ortak bağlama, 11 Kasım 2026

[Modül merkezi/Takvim/Ayarlar statik metin dilimi](T90-261101-PO1-I18N02-SHARED-BINDINGS.md) task/t90-261101-po1-i18n02-shared-bindings yerel dalında. Önceki43 hedefe24 ortak hedef; toplam67, aynı75 TR sözlük. İlk browser6PASS/4FAIL HealthHub'ın kart açıklamasını başlangıçta değiştirdiğini gösterdi; alan statik kapsamdan çıkarılıp korunma testine alındı, mevcut Health kodu aynı. Son hedef21/21, platform1214/1214, AI/Radio335/335 ve bütünlük6/6 PASS. Seçili browser birleşik39PASS/1FAIL; WebKit'te bilinçli kaynak hatasının mevcut uyarısını kullanıcı Kapat eylemiyle doğrulayan test düzeltmesinden sonra iki motorda hedef2/2 PASS.38 diğer+2 son hata akışı=40 benzersiz doğrulama; tek40/40 koşu iddiası yok, çözülmemiş hata yok. Dar dilim yerel olarak tamam; genel I18N02 açık. Üretim yalnız bağlayıcı + cache foundation-084; kabuk128, index/entry/sözlük/şema/key/migration/lockfile aynı. Kaynak43 yerel değişiklik korunur. İngilizce/tercih yazımı/fiziksel kabul/yayın yok; uzak CI yeni patch için çalışmadı, commit/push/PR/merge/deploy yok. Sonraki ayrı öneri I18N02 kalan istatistik statik metinleri (Sol Medium); dinamik ve genel çok dillilik kabulü açık.

## Güncel devam — PO1-I18N02 Home/Core bağlama, 11 Kasım 2026

[Dar Home/Core metin bağlaması](T90-261101-PO1-I18N02-CORE-BINDINGS.md) task/t90-261101-po1-i18n02-core-bindings yerel dalında:43 açık metin/aria/title/placeholder hedefi, leaf-only/idempotent uygulama, aynı Türkçe HTML fallback'i. Not değeri/odak/seçim/ikon/listener/dinamik durumlar ve Radio tek oynatıcı korunur. Çevrimdışı3 modül eklenerek kabuk128 dosya/cache foundation-083; App2.23.3/schema2/key/migration/lockfile aynı. Kaynak34 yerel değişiklik korunur. Hedef14/14, son platform1207/1207, AI/Radio335/335, tam browser82/82 (41+41) ve bütünlük6/6 PASS,0 nihai FAIL/exit0. Bu dar dilim yerel otomatik kabulüyle tamam; I18N02 diğer ortak/dinamik yüzeylerde devam eder. Ara cache envanter/etiket ve yeni testin henüz oluşmamış notu okuma hataları kök nedenleriyle belgeli; beklenti gevşetme/skip/retry yok. Yeni dil/tercih/İngilizce açılmadı; fiziksel kabul yok. Uzak CI yeni patch için çalışmadı, commit/push/PR/merge/deploy yok. Sonraki ayrı öneri I18N02 modül merkezi ve Takvim/Ayarlar statik ortak metinleri (Sol Medium); genel çok dillilik ve veri/restore/pilot kapıları açık.

## Güncel devam — PO1-I18N02 Core hazırlığı, 11 Kasım 2026

[Core katalog rebase ve Türkçe sözlük hazırlığı](T90-261101-PO1-I18N02-CORE-PREPARATION.md) task/t90-261101-po1-i18n02-core-tr yerel dalında: eski67 girdiden66 korunur, eski Core geri etiketi emekli edilir,9 güncel gezinme/renk/not hata girdisiyle75 kayıt hazırlanır. mint/Nane ve diğer kalıcı kimlikler aynı; İngilizce taslak/kapalıdır. Yeni donmuş CORE_TR hiçbir UI/SW tüketicisine bağlanmadı; tercih/veri yazımı yok. Hedef12/12, automation8/8 ve tam platform1193/1193 PASS,0FAIL/exit0; alt hedefler toplamın içindedir. Kaynak uygulama/şema/key/lockfile/SW değişmedi; önceki30 yerel değişiklik korundu. Ayrı browser/AI/benchmark tekrarlanmadı, fiziksel kabul yok. Yeni uzak CI/commit/push/PR/merge/deploy yok. Sonraki ayrı öneri aynı I18N02 içinde dar Home/Core statik TR bağlaması (Sol Medium); kalan dinamik/ortak metin, kalıcı tercih ve bütün uygulama İngilizce kabulü açıktır.

## Güncel devam — PO1-I18N01 çözümleyici, 11 Kasım 2026

[Saf dil çözümleyicisi ve yerel test kanıtı](T90-261101-PO1-I18N01-RESOLVER.md) ayrı task/t90-261101-po1-i18n01-resolver dalında tamamlandı. Manuel öncelik, auto/BCP47, yalnız hazır tr ve güvenli fallback; DOM/storage/ağ/tercih yazımı/UI bağlantısı yoktur. İngilizce etkinleştirilmedi. Hedef20/20, automation8/8 ve son platform1181/1181 PASS,0 FAIL/exit0; alt hedefler toplamın içindedir. İlk kapıdaki test grubu sırası hatası beklenti gevşetilmeden düzeltildi, başarısız log korundu. Yalnız modül/test/runner/envanter ve3 belge; kullanıcı verisi/key/şema/migration/lockfile/SW aynı. Kaynak yerel değişiklikler korunur. Ayrı browser/Engine/benchmark/AI entegrasyonu tekrarlanmadı; fiziksel kabul yok. Uzak CI yeni patch için çalışmadı; commit/push/PR/merge/deploy yok. Sonraki ayrı öneri I18N02 güncel Core katalog eşleme/TR sözlük hazırlığı (Sol Medium); kalıcı tercih ayrıca açık.

## Güncel devam — PO1-I18N01 tasarım güncellemesi, 11 Kasım 2026

[3 Kasım kararlarının güncel kaynakla doğrulaması](T90-261101-PO1-I18N01-LANGUAGE-DESIGN.md) task/t90-261101-po1-i18n01-current-design yerel dalında; yalnız3 belge. Tasarım tamam; kaynak/bütünlük5/5 PASS,0FAIL. Runtime ve kalıcı tercih uygulanmadı, yeni dil davranışı test edilmedi. Manuel öncelik/auto, yalnız hazır tr, gelecekte en, önerilen settings.uiLanguage, backup/writer yarış kapıları ve AI/DOM/state koruma sözleşmesi açık. Önceki kataloglar yeniden tasarlanmaz;67 kaynak literalinin güncel NAV01/renk/not farkları rebase edilmeli. Önceki backup modülleri güncel Radio'da üretim kabulü sayılamaz. Sonraki tek küçük iş **aynı I18N01 altında saf, salt okunur dil çözümleyicisi ve hedefli testler** (Sol Medium); yeni alan/yazıcı/seçici/üretimde EN bu adımda açılmaz. Uygulama paketleri bu belge oturumunda tekrarlanmadı. Fiziksel cihaz, tam veri/restore/pilot ve yayın kapıları açık; uzak yazma yok.

## Güncel devam — PO1-UX05 Radio/AI, 11 Kasım 2026

[Radio/AI hizalama ve testleri](T90-261101-PO1-UX05-RADIO-AI-ALIGNMENT.md) task/t90-261101-po1-ux05-radio-ai-alignment yerel dalında.10 durum/motor180 düzen; Radio katalog/gerçek ses/tek mini/izin sıfırlama ve AI onay/önizleme/gerçek öneri/düzenleme/günlük gözlem. Son platform1161/1161, AI/Radio335/335, browser76/76 ve bütünlük4/4 PASS,0 nihai FAIL. UX05 listelenen yüzeylerde yerel otomatik sunum kabulünü tamamladı; ilk izolasyon sorunları ve kapsam sınırları raporda. Üretim yalnızCSS; Radio2.23.3 ve AI davranışı/şema/key/JS/lockfile/SW aynı. Kaynak Sky dalı korunur. Sonraki tek öneri PO1-I18N01 dil altyapısı ve kalıcı tercih tasarımı (Sol Medium); yeni dil/anahtar eklenmedi. Fiziksel iPhone/PWA/Windows ve veri/restore/pilot/yayın kapıları açık; uzak yazma yok. Önceki UX04'ün UX05 önerisi bu dilimle ilerlemiştir.

## Güncel devam — PO1-UX04 Sky, 11 Kasım 2026

[Sky hizalama/ölçümü](T90-261101-PO1-UX04-SKY-ALIGNMENT.md) task/t90-261101-po1-ux04-sky-alignment yerel dalında. Başlık kırpması/39px eylemler düzeltilir;6 panel×2 profil×3 genişlik×2 yazı×3 tema =216 düzen/motor. Son hedef4/4 ve açık kullanıcı eylemli canlı gökyüzü2/2 PASS; son platform1161/1161, AI/Radio335/335, browser72/72 ve bütünlük4/4 PASS,0 nihai FAIL. UX04 listelenen yüzeylerde yerel otomatik sunum kabulünü tamamladı; fiziksel/koşullu sınırlar raporda. Sky hesaplama/profil/konum JS'si ve veri şeması/anahtarları aynı; kaynak Health dalı korunur. Sonraki tek öneri UX05 Radio/AI yüzey hizalaması (Sol Medium), henüz başlanmadı. Fiziksel iPhone/PWA/Windows, tam veri/restore/pilot ve yayın kapıları açık; uzak yazma yok. Aşağıdaki UX03 kaydının UX04 önerisi bu dilimle ilerlemiştir.

## Güncel devam — PO1-UX03 iç form dilimi, 10 Kasım 2026

[Health iç form ölçümü](T90-261101-PO1-UX03-HEALTH-FORMS.md) task/t90-261101-po1-ux03-health-forms dalında.14 yüzey/motor84 düzen; dolu spor programı/gün editörü/antrenman alanları dahil. Spor filtre sarma ve dar ekranda editör satırlarının alt alta yerleşmesi düzeltildi; diğer formlar için ek üretim değişikliği gerekmedi. Son platform1161/1161, AI/Radio335/335, browser68/68 ve bütünlük4/4 PASS,0 nihai FAIL. UX03 listelenen ana/iç form yüzeylerinde yerel otomatik kabulü tamamladı; koşullu durum ve fiziksel kapsam sınırları raporda. Kaynak Health ana yüzey dalı ve kullanıcı verisi korunur; şema/key/JS/lockfile/SW aynı. Sonraki bağımsız öneri UX04 Sky hizalama/ölçümü (Sol Medium). Fiziksel cihaz ve tam veri/restore/pilot kapıları açık; yayın yok. Aşağıdaki önceki iç form açık işi bu dilimle ilerlemiştir.

## Güncel devam — PO1-UX03 ilk Health dilimi, 10 Kasım 2026

[Health ana yüzey hizalaması](T90-261101-PO1-UX03-HEALTH-ALIGNMENT.md) task/t90-261101-po1-ux03-health-alignment yerel dalında. Ana merkezler, Su ve Kişisel Sağlık Verileri için6 yüzey/motor36 düzen; üst başlık,44px kontroller, sarma ve select tema/kontrastı. Son platform1161/1161, AI/Radio335/335, browser62/62 ve bütünlük4/4 PASS,0 nihai FAIL. İlk hatalar/ara kesilen koşu raporda. Yalnız scoped CSS; HTML/JS/ID/state/route/şema/lockfile/SW ve kaynak palet dalı korunur. **UX03 bütünü devam ediyor:** sonraki tek küçük öneri öğün/kütüphane, uyku/enerji/semptom ve spor iç formlarında büyük yazı/geometri kabulü (Sol Medium). UX04'e henüz geçilmez. Fiziksel cihaz/restore/pilot kapıları açık; yayın yok. Önceki palet kaydının UX03 önerisi bu güncel ilk dilimle ilerlemiştir.

## Güncel devam — PO1-COR01, 10 Kasım 2026

[Core 12 renk paleti](T90-261101-PO1-COR01-PALETTE.md) task/t90-261101-po1-cor01-palette dalında yerel otomatik kabulü tamamladı. Orijinal7 renk/ID aynı; pembe/mor/turkuaz/nane/gri eklendi, mevcut4×3 düzen44px. Hedef4/4, platform1161/1161, AI/Radio335/335, tam browser58/58 ve bütünlük4/4 PASS,0FAIL. Kaynak not güveni dalı değişmedi; şema/key/migration/lockfile/SW aynı. Fiziksel cihaz ve tüm yedek/restore/pilot kapıları açık; yayın yapılmadı. Sıradaki tek öneri PO1-UX03 Health hizalaması, Sol Medium; henüz başlanmadı. Önceki kayıtlar tarihsel durumdur.

## Güncel devam — Core not güveni, 10 Kasım 2026

[Not güveni düzeltmesi](CORE-NOTE-SAFETY.md) task/core-note-safety dalında hazır; önceki NAV01 kayıp engeli ve yerel otomatik kabul kapandı. Tarih/metin snapshot'ı, yalnız bellek taslağı, gün bazlı450ms zamanlayıcı, reset iptali ve başarısız kayıt mesajı. Platform1161/1161, AI/Radio335/335, tam browser54/54 ve bütünlük4/4 PASS,0 son FAIL. İlk16/18 ve düzeltilmiş kota2/2 raporda korunur. Önceki NAV01/CSS dalı değişmedi; üretim delta yalnız index, şema/key/migration/lockfile/SW aynı. Fiziksel kabul, tüm-modül restore/kesinti/pilot kapıları hâlâ açık; yayın yapılmadı. Sıradaki tek öneri PO1-COR01 renk paleti (Sol Medium), henüz başlatılmadı. Aşağıdaki NAV01 engel kaydı önceki dalın tarihsel durumudur.

## Güncel yerel durum — PO1-NAV01, 10 Kasım 2026

[Core ile başlama ve modül erişimi](T90-261101-PO1-NAV01-CORE-NAVIGATION.md) yerel task/t90-261101-po1-nav01-core-navigation dalında uygulanmış fakat **not güveni nedeniyle tamamlanmamıştır**. Başla→pick, küçük grid+görünür yönerge→modules, açık Core’a dön, pick.parent=home/modules.parent=pick; önceki Core CSS ve Radio2.23.3 korunur. Platform1161/1161, AI/Radio335/335, mevcut browser36/36 PASS; yeni NAV hedef8/10 PASS,2FAIL. Kaydetmeden hızlı geri dönüş taslağı eski notla değiştirir; sabit saatli eski sürüm kontrolü iki motorda kaybı kanıtladı. Sıradaki tek öneri yeni renklerden önce dar not taslağı/yazıcı güveni düzeltmesi ve hızlı dönüş/tarih sınırı regresyonudur. Yeni kimlik tahsis edilmedi. Bu görevde save/flush/şema/key/lockfile/SW değişmedi; kaynak dal/ref'ler ve kullanıcı verisi korunur. Yayın/PR/commit yok, gerçek iPhone/PWA kabulü yapılmadı; T90-07/08 veri/restore kapıları açık. Önceki UX02 kaydı tarihsel durumdur; sonraki NAV01 önerisi bu güncel engelle yer değiştirir.

## Son yerel uygulama — PO1-UX02 Core, 10 Kasım 2026

[Core hizalama patch'i ve test kanıtı](T90-261101-PO1-UX02-CORE-ALIGNMENT.md) task/t90-261101-po1-ux02-core-alignment dalında hazır. Mevcut Radio2.23.3 tasarımı üzerinde yalnız index.html Core CSS'si; diğer ürün JS/HTML/state/route/şema/SW korunur. Üç yeni senaryo/motor,24 düzen/motor; son hedef2/2, tam platform1161/1161, AI/Radio335/335 ve browser36/36 PASS,0 son FAIL,exit0. İlk hedef hataları ve düzeltmeleri ayrı belgeli; bütünlük4/4 PASS. Yeni CSS fiziksel iPhone/PWA/Windows kabulü veya yayın değildir; eski önizleme kabulü devralınmaz. Sıradaki tek öneri PO1-NAV01 yerel Başla→Core/modül ikonu akışı; save/flush, yeni key/şema, yeni renk/ses/dil/auth ve yayın ayrı kalır. T90-07/08 gerçek veri/restore/pilot kapıları açık; bu CSS onları kapatmaz.

## Güncel yerel Radio test tabanı — 10 Kasım 2026

[T90-07 Radio test tabanı](T90-261101-07-RADIO-TEST-BASELINE.md) ve JSON envanteri hazır. Yerel dal task/t90-261101-07-radio-test-baseline, HEAD b57dbce/App2.23.3.25 platform/19 entegrasyon/9 Engine grubu eksiksiz; UUID fixture var, ek NUT dosyası taşınmadı, runtime/test kaynakları aynı. Platform1161/1161, entegrasyon335/335, Engine403/403 raporlanan kontrol, benchmark16/16 ve0 güvenlik ihlali PASS. İlk browser29/1 başarısızlık /var/tmp erişim kök nedenine indirildi; scoped sandbox erişimiyle son WebKit15/15, ilk Chromium15/15 PASS. Bütünlük4/4 PASS. Fiziksel cihaz sonucu veya üretim restore kabulü değildir. Sıradaki tek öneri mevcut görünümü koruyan Core UX02 yerel CSS patch'i; index.html/Core seçicileriyle sınırlı. NAV01, save/restore/şema/renk ekleme/native özellik ve yayın bu işe karışmaz. T90-07/08 ve gerçek aday ACC01 kapıları açık; remote işlem yapılmadı.

## TB-001
Title: Remove duplicated HTML elements

Priority: High

Status: 🟢 Completed

Description:

Remove duplicated UI elements such as repeated navigation components and duplicated element IDs.

Completed Work:

- Removed duplicated Core action row.

- Removed duplicated `btnResetToday` element.

- Removed duplicated `statusPick` element.

- Removed duplicated Core bottom navigation.

Commit:

refactor: remove duplicated core html structure

---

## TB-002
Title: Unify Event Listeners

Priority: High

Status: 🟢 Completed

Description:

Ensure every user interaction is handled by a single event listener.

---

## TB-003
Title: Single Source of Truth

Priority: Critical

Status: 🟢 Completed

Description:

Choose one storage architecture as the primary data source and migrate legacy structures if required.

---

## TB-004
Title: Version Management

Priority: High

Status: 🟢 Completed

Description:

Unify application version management across HTML, JavaScript and Service Worker.

---

## TB-005
Title: Backup & Restore Validation

Priority: High

Status: 🟢 Completed

Description:

Verify backup and restore workflows using real application data.

---

## TB-006
Title: Migration Validation

Priority: Medium

Status: 🟢 Completed

Description:

Validate migration logic and ensure backward compatibility.

---

## TB-007
Title: Code Cleanup

Priority: Medium

Status: 🟢 Completed

Description:

Remove dead code, unused files and obsolete functions.

---

## TB-008
Title: Performance Review

Priority: Medium

Status: 🟢 Completed

Description:

Review startup performance, rendering and storage operations.

---

## TB-009
Title: Accessibility Review

Priority: Medium

Status: 🟢 Completed

Description:

Improve accessibility and semantic HTML where needed.

---

## TB-010
Title: Foundation Testing

Priority: Critical

Status: 🟢 Completed

Description:

Execute full regression tests after all Phase 1 tasks are completed.

---

# Phase 1 Closure

Work items

TB-001–TB-010

Result

🟢 Completed

> Faz 1 geliştirmeleri tamamlandı. Test edildi. Sonuç: Başarılı.

---

# Phase 2 — Platform Architecture

## TB-011
Title: Architecture Inventory

Priority: Critical

Status: 🟢 Completed

Acceptance:

Working files, data keys, dependencies and repetition risks are documented without changing source code.

---

## TB-012
Title: Startup Manager

Priority: Critical

Status: 🟢 Completed

Acceptance:

Critical modules start in one validated order behind a safe failure gate.

---

## TB-013
Title: Router

Priority: High

Status: 🟢 Completed

Acceptance:

Views and back behavior are managed from one central routing contract.

---

## TB-014
Title: Module Registry

Priority: High

Status: 🟢 Completed

Acceptance:

Core, Health and Sky use one registration and resolution contract.

---

## TB-015
Title: Central Error Manager

Priority: Critical

Status: 🟢 Completed

Acceptance:

Errors are standardized, privacy-preserving, bounded and recoverable.

---

## TB-016
Title: Schema and Migration Orchestration

Priority: Critical

Status: 🟢 Completed

Acceptance:

`0 → 1 → 2` and `1 → 2` upgrades preserve data, create one backup and do not repeat writes.

---

## TB-017
Title: Service Worker Update Manager

Priority: High

Status: 🟢 Completed

Acceptance:

Updates require user approval and old Today cache areas are removed safely.

---

## TB-018
Title: AI and Connect Adapter Interfaces

Priority: High

Status: 🟢 Completed

Acceptance:

The provider-free state is safe and creates no new visible screen, external transfer or unapproved action.

---

## TB-019
Title: Platform Regression and GitHub Actions

Priority: Critical

Status: 🟢 Completed

Acceptance:

The portable `npm test` gate completes on GitHub Actions with **294/294 successful, 0 failures**. The TB-019 commit changes only test and automation files and preserves `index.html`, `sw.js` and `modules/**`.

Phase 2 Closure

> **Faz 2 geliştirmeleri tamamlandı. GitHub Actions üzerinde test edildi. Sonuç: Başarılı.**

---

# Aktif teknik sıra — NUT-018

Sürekli geliştirme ortamı Codex'tir. Kullanıcı verileri/şemaları ve mevcut modüller korunur; main'e doğrudan yazılmaz, taslak PR #1 otomatik birleştirilmez.

| İş | Kapsam | Durum / kabul ölçütü |
|---|---|---|
| NUT-018 | İlk CI kök nedeni, başlangıç kapısı, güncel regresyon referansları | Tamamlandı: ea2f99d, Actions 40933274467 başarılı; platform 1116, AI 335, entegrasyon 96, benchmark 16 PASS |
| NUT-018.1 | Eksik Health Hub / tüketim editörü testleri ve kayıtlı test envanteri | Yerelde doğrulandı: 25 grup / 1155 PASS; AI 335, entegrasyon 96, benchmark 16 PASS. CI kaydı PR #1'de |
| NUT-018.2 | Bağımlılık güvenliği ve aktif sürüm tutarlılığı | Doğrulandı: df47b0e / Actions 40938911892; audit 0, paket/aktif sürüm 2.16.0; 1155/335/96/16 PASS |
| NUT-018.3 | Gerçek tarayıcı otomasyonu ve iPhone PWA doğrulama hazırlığı | Hazırlık uygulandı: Chromium 6 PASS, platform 1156 PASS; Chromium/WebKit CI kanıtı PR #1'de. Fiziksel iPhone/Android kabulü bekliyor |
| NUT-019.1 | Günlük / 7 / 30 / 90 günlük gözlemler; saat adaptör sözleşmesi | Yerel 1156/364/112/16 kapıları ve yeni Chromium senaryosu başarılı. Gerçek saat okuma ve telefon bildirimi bağlı değildir; kayıt docs/NUT-019.1-IMPLEMENTATION.md içinde. |
| NUT-019.2 | Health kişisel sağlık verisi native bağlantısı ve bildirim taşıyıcısı | Açık: kapsam/metin sözleşmesi ve 019.2.1 SDK/Health önizleme dilimi var. Health–AI bağlantısı ve izinli yerel zamanlayıcı uygulandı; fiziksel saat kabulü ve gerçek bildirim teslimi bekliyor. Tüm model/sürüm garantisi verilmez; kapsam docs/NUT-019.2-COMPATIBILITY.md içinde. |
| NUT-019.2.1 | İnce native preview, dar SDK okuyucusu ve kişisel veri ekranı | App 2.18.0, şema 2, foundation-072/117 dosya. Sağlık verisi yalnız istek belleğinde; kaynak/merged manifest/native derleme ve tarayıcı kanıtı docs/NUT-019.2-IMPLEMENTATION.md ile PR #1'de. Fiziksel cihaz testi değildir. |
| NUT-019.2.2 | Saat önizlemesinden ayrı AI onayı, kaynak anlamı ve Android cihaz paketi | App 2.19.0, şema 2, foundation-073/118 kayıt. Kalıcı yeni depo yok; geçici saat türleri manuel kayıtlardan ayrılır. Kod/test/CI kanıtı docs/NUT-019.2.2-IMPLEMENTATION.md ve PR #1'de. APK ve cihaz rehberi fiziksel kabul yerine geçmez. |
| NUT-019.3 | Günlük AI ve güncelleme OS bildirimi | Kullanıcı onaylı today_ai_delivery_v1 arşivi, native yerel bildirim adaptörü, tekilleştirme/sessiz saat/geri çekme ve UI uygulandı. 41101231255 completed/success doğrulandı; önceki durum API gecikmesi kapandı. İndirilen APK checksum ve 7 kritik kaynak dosyası eşleşti. APK 12999152208 ve boş fiziksel kabul formu docs/NUT-019.3-IMPLEMENTATION.md içinde; fiziksel teslim açık. Tek cihaz iPhone 15/iOS 18.7.8 + Mi Band 8/Mi Fitness; Windows erişimiyle önce Apple Sağlık aktarımı ve imzalı iOS dağıtım yolu gerekiyor. Hazır gözlem yokken mesaj planlanmaz. |

Tam modül yedekleme/geri yükleme, veri kaybı sınırları ve gizlilik bilgilendirmesi doğrulanmadan gerçek kişilerle pilot başlatılmaz. Yeni model sağlayıcısı, dış aktarım, hesap/senkronizasyon ve şema değişiklikleri ayrı karar gerektirir. Güncel ürün kapıları docs/02_ROADMAP.md ve docs/03_PHASES.md içindedir.

# Phase 3 — Native Mobile / Capacitor (önceki aday planı)

Aşağıdaki liste korunmuş teknik envanterdir. Mağaza hazırlığı kişisel kullanım ve pazar doğrulamasından sonra gelir. 30 Ekim kullanıcının istediği saat bağlantısı için dar native sağlık köprüsü NUT-019.2 kapsamında öne alınır; bu tam native yeniden yazım veya mağaza yayını kararı değildir.

Phase 3 task IDs will be finalized only after technical discovery and a fresh repository review. Application code must not change before the relevant backlog ID is assigned.

| Proposed order | Work package | Status |
|---:|---|---|
| 1 | Capacitor compatibility and dependency inventory | Next |
| 2 | Capacitor base configuration | Planned |
| 3 | iOS/Xcode project and signing foundation | Planned |
| 4 | Android/Android Studio project and signing foundation | Planned |
| 5 | Local notifications and user-selected reminder time | Planned |
| 6 | Haptic, sharing and file-system adapters | Planned |
| 7 | Keychain/Keystore secure-storage foundation | Planned |
| 8 | Biometric-lock foundation | Planned |
| 9 | Calendar/reminder adapters and permission management | Planned |
| 10 | iOS/Android device regression | Planned |

---

# Required Pre-change Check

Before every new technical work item:

1. Review `main`, the latest commit and the GitHub Actions result.
2. Read `docs/04_CHANGELOG.md` and this backlog.
3. Search existing modules for the same responsibility.
4. Preserve one data source and `modules/version.js` as the single version source.
5. Do not add a second listener to the same button, a copied view or a second export flow.
6. Do not mark production work complete until `npm test` passes.

---

# Workflow

Each task follows:

Analysis

↓

Implementation

↓

Testing

↓

Documentation

↓

CHANGELOG

↓

Commit

↓

Review

---

# Status Legend

⚪ Planned

🟡 In Progress

🟢 Completed

🔴 Blocked

## Güncel öncelik — NUT-020 mobil deneyim

Apple Developer maliyeti nedeniyle NUT-019 saat/bildirim fiziksel kabulü 2–4 ay veya üyelik mümkün olana kadar ertelendi; mevcut kod korunur. Önce iPhone PWA hizalama/taşma/scroll kararlılığı ve kontrollü yatay gezinme; sonra modül içerik/tasarım geliştirmesi; ardından az veri için belirsizliği gösteren AI gözlemleri. Native veya Web Push alternatifi bu ertelemeyi aşmak için başlatılmaz.

## NUT-RADIO güncel devir

feature/today-radio / Draft PR #2: katalog, tek aktif ses yöneticisi ve aynı singleton'a abone ana ekran mini-player uygulandı (App2.23.0). Önceki oynatma CI41174378955 dört job ve30 browser testi başarılı. Yeni mini-player istasyon/durum/stop/Radio geçişi sağlar, açılışta ağ/oynatma başlatmaz. Yayın durduktan sonra Radio'daki izin akışı gerekir. Son SHA CI sonucu PR #2'de izlenir; ardından Media Session ve uyku zamanlayıcısı ayrı küçük dilimlerdir. Fiziksel iPhone/Windows, volume ve favori/geçmiş/AI hâlâ açık. Saat/bildirim ertelemesi değişmedi.
