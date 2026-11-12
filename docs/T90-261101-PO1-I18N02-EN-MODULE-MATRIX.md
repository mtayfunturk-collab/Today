# PO1-I18N02 — Modül İngilizce kaynak matrisi

12 Kasım 2026, TSİ. Yerel dal `task/t90-261101-po1-i18n02-en-module-matrix`, HEAD `b57dbceb53eb6a9aacc3bde709b4de096b77e38f`. Kaynak 89 kirli dosya ayrı worktree'de korundu. Kapsam geçmiş I18N03–06 kataloglarını bugünkü kaynaklara karşı salt okunur eşlemektir. [Makine matrisi](T90-261101-PO1-I18N02-EN-MODULE-MATRIX.json) katalog SHA'larını, güncel kaynak hashlerini, sahipleri ve kayan satır anahtarlarını taşır.

| Modül sahibi | EN taslak | Literal güncel kaynakta | Eski satır işareti kayan | Parametre uyumsuzluğu |
|---|---:|---:|---:|---:|
| I18N03 Health | 71 | 71 | 22 | 0 |
| I18N04 Sky | 66 | 66 | 0 | 0 |
| I18N05 Radio | 73 | 73 | 3 | 0 |
| I18N06 AI | 73 | 73 | 11 | 0 |
| **Toplam** | **283** | **283** | **36** | **0** |

Kataloglar eski Radio tabanına (`b57dbce`) bağlı taslaklardır. Literalin dosyada hâlâ bulunması o metnin kullanıcıya aynı anda, aynı sırada veya aynı izin durumunda çıktığını kanıtlamaz. Kayan 36 satır numarası güncel kaynak konumu için yeniden üretilmelidir. 283 giriş kapsam yüzdesi veya uygulama geneli eksiksizlik kanıtı değildir. Core/ortak katalogda ayrıca 135 EN taslak vardır; iki sayıyı toplayıp tamamlanmış çeviri sayısı diye sunmuyoruz.

**Sahiplik ve özel kapılar:** Health 22 HTML ve49 HealthHub metnini kapsar; `moduleHealthDesc` HTML'de “Beslenme, su ve yaşam”, HealthHub'da “Beslenme, spor ve yaşam”dır. I18N03 tek sahipli ürün metnine karar vermeli. Sky 5 kaynak dosyasındaki hesap sonucu/bağlam ile görünen açıklamayı ayırmalı; tarih ve koordinat gibi kullanıcı verisi çevrilmez. Radio 3 HTML ve70 UI taslağını oynatma/izin/hata durumlarıyla doğrulamalı; tek akış, mini oynatıcı ve geçmiş izinleri değişmez. AI 5 dosyadaki73 taslağı kanonik consent amacı, hesaplanan gözlem ve günlük çoklu pencere açıklamasından ayırmalı; model kanıtı ve kullanıcı verisi çeviriyle yeniden yazılmaz.

**Sıra:** Her modül sahibi kendi katalog satırlarını güncel kaynak satırlarına yeniden bağlar, dinamik/aria/hata ve boş durum kapsamını tamamlar, anlam ve parametreleri gözden geçirir. Sonra birleşik tam uygulama EN matrisi, kalıcı tercih/yedek/restore, erken ESM fallback ve fiziksel Safari/PWA kabulü değerlendirilir. Şu anda `AVAILABLE_LANGUAGES=['tr']`, Core `completeEnglishRelease=false`; hiçbir modül EN release onayı vermez.

Kod, şema, kullanıcı verisi, izinler ve canlı uygulama değişmedi. Bu belge kaynak tutarlılığı kontrolüdür; uygulama testleri, uzak CI veya fiziksel cihaz kabulü yapılmadı. Commit/push/PR/merge/deploy yok. Sıradaki ayrı görev olarak I18N03 Health kartının iki kaynak metni ve güncel katalog satırları ele alınabilir; bu envanter modül uygulamasını kendiliğinden başlatmaz.
