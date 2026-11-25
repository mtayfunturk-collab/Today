# AUTH01 — Fiziksel iPhone kabulü

## Ürün sahibi sonucu

Fiziksel iPhone’da Ana Ekrana kurulu Today AI Beta için **PIN ile giriş geçti** ve **parola ile giriş geçti**. Test commit’i ve cihaz modeli bildirilmedi. Safari, çevrimdışı yeniden açılış, arka plan/uygulama değiştirici, BFCache, yükseltme, süreler, bekleme, kurtarma kodu, v5 ve cihaz performansı için fiziksel kabul bekliyor.

## Kurulum

1. PR #50’deki aday commit’i ve verilen özel HTTPS önizleme adresini doğrula. Adresin ana bilgisayarı canlı Today adresinden farklı olmalı.
2. iPhone modeli ve iOS sürümünü kaydet. Denemede yalnız sentetik Core notu, PIN, kurtarma kodu ve yedek dosyası kullan. Test profilini veya dosyaları üretim profiline taşıma.
3. Sonuçları **Safari** ve **Ana ekran PWA** için ayrı tut. Bir kontrolü geçti, başarısız, engelli veya uygulanamadı diye kaydet. PIN, kurtarma kodu, parola, yedek dosyası ve kişisel içerik paylaşma.

## Safari

1. Adayı Safari’de ilk kez aç. Başla ile Core’a git ve `AUTH01 Safari sentetik notu` yaz. Ayarlar → Güvenlik ve Gizlilik’te kilidin varsayılan kapalı olduğunu ve cihaz verilerini şifrelemediği açıklamasını gör.
2. Aynı adreste ikinci Safari sekmesi aç. İlk sekmede kilit kaydını dene. Uygulama diğer sekmeleri kapatmanı istemeli. İkinci sekmeyi kapat ve 6–12 basamaklı sentetik PIN ile kurulumu tamamla. Gösterilen kurtarma kodunu cihaz dışında sakla. Otomatik kilit varsayılanı 5 dakika olmalı. Süre menüsünde Anında, 1, 5, 15, 30 dakika görünmeli.
3. **Şimdi kilitle** ile kilitle. Kişisel ekranlar görünmemeli. Tek yanlış PIN denemesinde bekleme mesajını gözle. Bekleme bitince doğru PIN ile kilidi aç. PIN/parolayı değiştir ve yeni bilgiyle tekrar aç.
4. Safari’yi arka plana al, uygulama değiştiricideki önizlemeyi kontrol et, geri dön. Kilit açılmadan kişisel kayıt görünüyorsa başarısız kaydet. Aynı sekmede başka bir sayfaya gidip geri dön. Cihaz gerçek BFCache dönüşü yaptıysa (Web Inspector’da `pageshow.persisted`) sonucu ayrıca belirt. Bu sinyal doğrulanamadıysa geri gezinme sonucunu kaydet ve BFCache alanını açık bırak.
5. Adayın çevrimdışı kabuğu yüklüyken uçak modunu açıp Wi‑Fi’yi de kapat. Sayfayı yeniden aç ve PIN ile kilidi aç. Sentetik notu kontrol et. Aday origin’indeki `backup.html` adresini doğrudan aç. Yedek formundan önce PIN istenmeli. Sentetik v5 yedeği oluştur ve salt okunur önizlemede aç. Beklenti, üretim geri yüklemesini etkinleştirmeden dosya ve kapsam doğrulamasıdır.
6. Yeniden kilitle. **PIN’imi veya parolamı unuttum** ile test kodunu kullan, yeni PIN ve yeni kurtarma kodu al. Yeni PIN ile aç, notu kontrol et. Önceki kurtarma kodunu ikinci kez dene. Sistem onu reddetmeli.

## Ana ekrana kurulu PWA

1. İnterneti geri aç. Aday adresini Safari’de aç, **Paylaş → Ana Ekrana Ekle** ile kur ve simgeden başlat. Aday simgesini test için ayırt edilebilir bir adla kaydet.
2. Ayrı bir test bağlamı açıldıysa `AUTH01 PWA sentetik notu` ile kilit kur. Aday kilit ayarı bu cihazda zaten görünüyorsa yalnız test PIN’iyle devam et; Safari ve PWA depolarının ayrı olduğunu varsayma.
3. Safari listesindeki 3–6. adımları PWA’da tekrarla. Özellikle ana ekrana çıkma, uygulama değiştirici, PWA’yı kapatıp açma, çevrimdışı başlatma ve v5 dosya seçme/önizleme davranışlarını ayrı yaz.
4. Bir arka plan kilidi denemesinde PIN’i yazıp **Kilidi aç** düğmesine basma ile içerik görünmesi arasındaki süreyi yaklaşık ölç. Soğuk ve sıcak ilk açılışları ayrı kaydet. Bu süre uçtan uca kullanıcı bekleme süresidir; saf PBKDF2 ölçümü için fiziksel cihaz profili ayrı gerekir.

## Yayın kapısı

Önceki Worker’dan yükseltme aynı test origin’inde başlayıp tamamlanmalıdır. Adayı doğrudan açarak yapılan bu kontrol listesi tek başına yükseltme kanıtı sağlamaz. Gerçek cihazda eski sürümden geçiş, eski sekme, BFCache ve uygulama değiştirici sonucu ayrıca kayda geçer. Merge ve yayın için otomatik CI, fiziksel kabul ve ayrı ürün sahibi onayı gerekir.


## AUTH01-BIO fiziksel kabulü

1. iPhone 15 Safari’de ve Ana Ekran PWA’da Staging adayını sentetik verilerle aç. Ayarlar → Güvenlik ve Gizlilik ile kilit ekranında biyometri seçeneğinin görünmediğini doğrula. PIN ve parola girişini her bağlamda tekrar dene.
2. Aynı Staging origin’inde Wi‑Fi ve hücresel veriyi kapat. Safari ve kurulu PWA’yı ayrı ayrı aç. Çevrimdışı PIN/parola, içerik perdesi, arka plandan dönüş ve hareketsizlik kilidini doğrula.
3. İmzalı native iPhone 15 adayında Face ID’yi etkinleştir. Manuel kilit, uçak modu, arka plandan dönüş, otomatik kilit, iptal, PIN/parola alternatifi ve Face ID kaydı değişiminden sonra alternatif girişi dene. Touch ID destekli ayrı Apple cihazında aynı akışı tekrarla.
4. Native Android’de güçlü parmak izi ile aynı akışı doğrula. Windows’ta destekli HTTPS tarayıcısında bu Windows cihazını seç, çevrimdışı Hello girişini ve PIN/parola alternatifini doğrula.
5. Sürüm/commit, platform ve tarayıcı, her adımın sonucu ve hata belirtisini kaydet. PIN, parola, kurtarma kodu veya gerçek kişisel veri paylaşma.
