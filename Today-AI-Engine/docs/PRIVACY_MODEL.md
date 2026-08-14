# Gizlilik Modeli

## Varsayılan

Veri cihazda kalır. NUT-017.1 yalnız `mode: device-only`, `externalRecipient: null` ve `retention: request-scoped` kabul eder. Engine'e yalnız seçilmiş olay zarfları verilir; Context Builder onaylı veri sınıflarını minimize eder ve kullanımdan sonra kalıcı hafıza oluşturmaz.

Core, Health ve Sky izinleri birbirinden ayrıdır. `includeFreeText` varsayılan olarak `false` kalır; veri sınıfı izni tek başına not eklemek için yeterli değildir. Sky için serbest metin hiçbir durumda kabul edilmez.

NUT-017.4 kullanıcı kararını da `request-scoped` tutar. Onay, ret veya düzenleme yeni bir storage anahtarına, Today ana verisine ya da kalıcı audit kaydına yazılmaz. Arayüz teknik olay kimliklerini göstermez; kimlikler yalnız iç sözleşmede denetlenebilirlik için korunur.

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
