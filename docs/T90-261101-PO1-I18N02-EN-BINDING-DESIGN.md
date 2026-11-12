# PO1-I18N02 — İngilizce bağlama ve tercih tasarımı

12 Kasım 2026, TSİ. Yerel dal `task/t90-261101-po1-i18n02-en-binding-design`, HEAD `b57dbceb53eb6a9aacc3bde709b4de096b77e38f`. Kaynak 88 kirli dosya ayrı worktree içinde korundu. Bu belge mevcut I18N01 tasarımının uygulama adımlarını güncel 135 taslak ve çalışma zamanı envanteriyle eşler; yeni dil kodu veya kalıcı alan oluşturmaz.

## Bağlama sırası

1. **Kaynak ve hazır olma:** `core-tr.mjs` etkin kaynak kalır. 135 İngilizce metin katalogda taslaktır; uygulama sözlüğü yapılmadan her anahtarın kaynak, parametre, anlam ve erişilebilirlik kabulü doğrulanır. Health/Sky/Radio/AI sahiplerinin kendi katalogları tamamlanmadıkça `AVAILABLE_LANGUAGES=['tr']`, `completeEnglishRelease=false` kalır. Eksik anahtar Türkçeye güvenli düşer; karışık dil arayüzü yayın kabulü değildir.
2. **İlk açılış okuması:** I18N01 saf `resolveLanguage({preference,deviceLanguages,availableLanguages})` kullanılır. Adaptör hazır snapshot'tan tercihi alır; `navigator.languages` veya `navigator.language` yalnız cihaz önerisidir. IP/konum/sağlık verisi kullanılmaz. İlk okuma için yan etkili `loadStore()` çağrısı eklenmez; bozuk veya erişilemeyen depoda güvenli Türkçe görünüm ve doğru hata durumu gerekir.
3. **Sunum sahipliği:** Statik 81 hedef mevcut `applyCoreStaticCopy` kapsamıyla; Core/calendar/statistics/startup/error/update/labels tarih ve grafik sağlayıcıları mevcut renderer sahibiyle bağlanır. Canlı chart, not, choice/color ID, CSV ve AI kanonik onay metni kopyalanıp çevrilmez. Dil değişimi açık formu/Radio akışını baştan başlatmamalı; rota/focus/scroll korunmalı. ESM öncesi hata ekranı için bağımsız güvenli Türkçe fallback sürer.
4. **Kalıcı manuel tercih:** I18N01 önerisi `today_store_v2.settings.uiLanguage = auto|tr|en`; alan yokluğu auto'dur. `metadata.language` manuel tercih olarak yeniden yorumlanmaz. Bu alanın yazılması ayrı uygulama/kabul görevidir. Kanonik writer sahipliği, Core/tema eşzamanlı yazıları, main/backup/legacy etkisi ve hata sonrası saved/not-saved/outcome-unknown ayrımı kanıtlanmadan UI “hatırlandı” demez. Kayıt ve bilinmeyen settings alanları korunur.
5. **Yedek/geri yükleme:** Dil alanı açılırsa tam export/restore kapsamında alan yokluğu, auto/tr/en, bilinmeyen gelecek değer, eski arşiv, yarım yazma ve kesinti değerlendirilir. T90-04–08 güncel aday kabulü açıkken pilot/yayın tamamlanmış sayılmaz.

## Ayrı uygulanabilir dilimler

| Sıra | Küçük iş | Kabul kanıtı |
|---|---|---|
| A | EN metinlerin uygulama geneli kaynak/parametre ve editoryal kabulü | Core135 ve Health/Sky/Radio/AI dinamik/aria/hata metinlerinin tam matrisi; ürün sahibi metin kararı |
| B | Salt okunur EN sağlayıcı ve explicit hazır dil listesi | Eksik anahtar/bozuk parametre güvenli fallback; DOM textContent; kayıt/CSV/izin aynı |
| C | Dil adaptörü ve görünüm geçişi | Açık form, rota, takvim günü, grafik, hata ve Radio tek akış korunur; erken ESM hatası TR fallback |
| D | Tercih writer, tam yedek/restore ve hata kabulü | Yarış, kota, kapalı storage, geri okuma, başarısız restore, eski arşiv; sahte başarı yok |
| E | Gerçek cihaz kabulü ve yayın kararı | Safari ve kurulu iPhone PWA ayrı, Windows, büyük yazı/klavye; güncel birleşik testler ve pilot kapıları |

Her dilim ayrı kullanıcı tetiklemesiyle yürür. A tamamlanmadan EN seçenek açılmaz. Bu tasarım ne yerel profil/kimlik doğrulama ne de yeni hesap mimarisi oluşturur. Yeni anahtar/şema/migration, canlı dil geçişi, commit/push/PR/merge/deploy/CI rerun yapılmadı.

## Şu anki ilerlemenin ölçüsü

Ana talimatın **12 sıralı görev grubu** var. Bugün plan sırasındaki **ilk 6/12 grupta** yerel çalışma yapıldı: 1 tanesi salt okunur teşhis olarak kapandı; 5 grup yerel uygulama veya hazırlık gördü fakat güncel aday/gerçek cihaz/yayın kabulü nedeniyle bütünüyle kapanmadı. **6/12 grup** bağımsız kapanış için sırada bekliyor; önceki ses önizlemesi ve Radio temeli bu grupları bitirmiş sayılmaz. Bu görev grubu sayısı tamamlanma yüzdesi değildir; grupların iş büyüklüğü çok farklıdır. Şu an **6. grup, PO1-I18N02** içindeyiz. 12. grup kurucu kullanım ve pilot kararını içerir; otomatik kod tamamlanmasıyla kapanmaz.

| Grup | Durum |
|---|---|
| 1 T90-02 teşhis | Tamamlanan salt okunur teşhis |
| 2 T90-03 test fixture | Yerel düzeltme/kapılar; yeni uzak CI kabulü açık |
| 3 T90-04–08 veri güveni | Envanter ve prototipler var; tam güncel yedek/geri yükleme açık |
| 4 UX/NAV/COR | Yerel arayüz dilimleri var; güncel fiziksel kabul açık |
| 5 UX03–05 modül hizalama | Yerel dilimler var; güncel fiziksel kabul açık |
| 6 I18N01–06 | Aktif I18N02; EN ve kalan modüller açık |
| 7–12 ses, Radio ekleri, AUTH, aday kabulü, kurucu/pilot | Sonraki bağımsız gruplar; bazı ses önizlemesi ve Radio temeli mevcut, grup kapanışı yok |

Canlı Today bu yerel değişikliklerden güncellenmedi. App Store/Play ve saat/native bildirim ertelendi. Kesin bitiş tarihi veya ürün tamamlanma yüzdesi bu sayılardan çıkarılamaz.
