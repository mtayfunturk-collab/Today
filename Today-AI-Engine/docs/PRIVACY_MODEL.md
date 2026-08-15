# Gizlilik Modeli

## Varsayılan

Veri cihazda kalır. NUT-017.1 yalnız `mode: device-only`, `externalRecipient: null` ve `retention: request-scoped` kabul eder. Engine'e yalnız seçilmiş olay zarfları verilir; Context Builder onaylı veri sınıflarını minimize eder ve kullanımdan sonra kalıcı hafıza oluşturmaz.

Core, Health ve Sky izinleri birbirinden ayrıdır. `includeFreeText` varsayılan olarak `false` kalır; veri sınıfı izni tek başına not eklemek için yeterli değildir. Sky için serbest metin hiçbir durumda kabul edilmez.

NUT-017.4 kullanıcı kararını da `request-scoped` tutar. Onay, ret veya düzenleme yeni bir storage anahtarına, Today ana verisine ya da kalıcı audit kaydına yazılmaz. Arayüz teknik olay kimliklerini göstermez; kimlikler yalnız iç sözleşmede denetlenebilirlik için korunur.

NUT-017.5 karar makbuzları da yalnız mevcut ekran isteğinin belleğinde tutulur. Yeni önizleme, temizleme veya sayfa yenileme geçmişi kaldırır. Makbuz dış alıcıya gönderilmez, kalıcı hale getirilmez ve gerçek işlem yapıldığı anlamına gelmez.

NUT-017.6 son 7 günlük gözlem için yeni veri toplamaz; aynı açık onayla hazırlanmış, minimize Context Package'i kullanır. Çıktı yalnız mevcut ekran isteğinde tutulur. Eşleşen günlerin iç dayanak kimlikleri kullanıcıya gösterilmez; Sky, serbest metin ve dış alıcı gözleme eklenmez.

NUT-017.7 kullanıcı geri bildirimini yalnız mevcut gözlem isteğinin belleğinde tutar. Yanıt yeni bir kullanıcı profiline, modele, ana Today kaydına, storage anahtarına veya kalıcı audit'e yazılmaz; cihaz dışına aktarılmaz. Kullanıcı yeni önizleme hazırladığında, temizlediğinde veya sayfayı yenilediğinde seçim düşer. İç makbuz kimlikleri kullanıcı arayüzünde gösterilmez.

NUT-017.8 kalite kapısı gerçek kullanıcı bağlamını kabul etmez. Kaynak kodla birlikte gelen olaylar `synthetic-*` kimliği taşır ve serbest metin içermez. Değerlendirme raporu ham olayları veya açıklama metnini kopyalamaz; yalnız kontrollü vaka sonuçlarını taşır ve çalışma sonunda kalıcı Engine belleği oluşturmaz. Bu rapor kullanıcı profiline bağlanmaz ve App arayüzünde gösterilmez.

NUT-017.9 ikinci günlük kural için yeni veri kaynağı açmaz; NUT-017.1'den beri onay kapsamındaki minimize `energy-record` alanlarını kullanır. Serbest metin, beden notu, kesin konum ve Sky bu kurala girmez. Kural sonucu ve eşleşmeme tanısı yalnız mevcut ekran isteğinin belleğinde yaşar; kullanıcı profiline, Today ana kaydına, storage anahtarına veya kalıcı audit'e yazılmaz.

## Bulut sağlayıcı eklenmeden önce zorunlu bildirim

- Gönderilecek alanlar
- İşleme amacı
- Alıcı servis
- Saklama süresi
- Özelliği kapatma yolu
- Cihaz içi alternatif

## Kullanıcı hakları

Analizden veri kaynağı çıkarma, Engine hafızasını görüntüleme/silme, dışa aktarma, bağlantıyı kesme ve verilen otomasyon yetkisini geri alma.

## Minimizasyon örnekleri

- Uyku bağlamında süre, kalite ve toparlanma alınabilir; yatma/kalkma saati ve not varsayılan olarak çıkarılır.
- Antrenmanda ad, görsel, kilo ve tekrar dökümü yerine süre ve tamamlanan egzersiz sayısı alınır.
- Core–Sky anlık görüntüsünde hesaplanan sembolik yerleşimler kalabilir; kesin konum, timezone ve ham doğum profili çıkarılır.
- Redaction kaydı yalnız alan yolunu ve gerekçeyi taşır; çıkarılan değeri tekrar etmez.
