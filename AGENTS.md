# Today geliştirme kuralları

Bu depo için ana geliştirme ortamı Codex'tir. Kullanıcının 29 Ekim 2026 tarihli sürekli geliştirme talimatı geçerlidir.

- Önce `docs/00_PROJECT_RULES.md`, güncel `docs/04_CHANGELOG.md` ve `docs/10_TECHNICAL_BACKLOG.md` dosyalarını oku; dalı, son commit'i ve Actions sonucunu kontrol et.
- Çalışmaları küçük, izlenebilir aşamalara ayır. Her anlamlı değişiklikten sonra ilgili testleri, aşama sonunda gerekli birleşik kapıları çalıştır. Kök nedenini bulmadan testleri gevşetme; başarısız aşamayı tamamlandı işaretleme.
- Her aşamada uygulama kaydı/changelog ve taslak PR açıklamasını güncelle. PASS/FAIL sayıları, kapsam sınırı ve sıradaki teknik önceliği kısa Türkçe raporla.
- `main` dalına doğrudan yazma, otomatik merge yapma. Mevcut NUT-018 işi `nut-018-ci-stabilization` dalında ve taslak PR #1'de sürer.
- Gerçek kullanıcı verilerini silme. localStorage/IndexedDB anahtarlarını, store'larını, şemalarını ve migration yapısını açık kullanıcı onayı olmadan değiştirme. Testlerde ayrı sentetik veri ve geçici tarayıcı profilleri kullan.
- Core, Health, Sky ve AI Engine'in mevcut mimarisini koru; gereksiz yeniden yazım ve yeni veri kaynaklarından kaçın. Güvenlik açısından kritik veya geri dönüşü zor değişiklikler için somut değişikliği hazırladıktan sonra onay iste.
- Gizlilik varsayılanı cihaz içi ve veri minimizasyonudur. AI önerir, kullanıcı karar verir; dış veri aktarımı/model sağlayıcısı veya gerçek eylem yürütme için açık onay gerekir. Sky sembolik/isteğe bağlıdır; sağlık veya duygu çıkarımına kanıt olmaz.
- Öncelikler: NUT-018.1 eksik testler; NUT-018.2 bağımlılık güvenliği ve sürüm tutarlılığı; NUT-018.3 gerçek tarayıcı ve iPhone PWA doğrulama hazırlığı. Fiziksel cihaz testi yapılmadıysa bunu açıkça belirt.
- Ürün odağı yeniden seçiliyor: önceki beslenme/hareket seçimi kullanıcı tarafından yanlışlıkla yapıldığı belirtilerek geri çekildi. Core–Health–Sky verilerini izin verilen kapsamda AI Engine ile anlamlandıran mimari korunur; kullanıcı sonrasında günlük, 7 günlük ve daha uzun dönemli AI gözlemleri, telefon bildirimi ve Health içinde akıllı saat entegrasyonu istedi. Bu yetenekler aşamalı geliştirilir; gerçek sağlık izinleri, native platform ve dış bildirim altyapısı somut kapsamla ayrıca kararlaştırılır. Önce kurucunun ikna olduğu günlük kullanım, sonra kontrollü gerçek kullanıcı PWA pilotu/pazar doğrulaması, ardından App Store ve Google Play hazırlığı. Hipotezleri doğrulanmış kullanıcı bulguları gibi sunma.

Uzun vadeli plan için `docs/02_ROADMAP.md` ve `docs/03_PHASES.md` kaynaklarını kullan. Gerçek cihaz, dış katılımcı veya mağaza hesabı gerektiren adımları otomatik testlerle tamamlanmış sayma.
