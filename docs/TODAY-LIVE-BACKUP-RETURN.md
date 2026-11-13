# Yedek sayfasından dönüş — Windows kabul düzeltmesi

Başlangıç: PR #3 adayı `135879926d9902b58f16bd3168f202083c71e19c`. Ayrı yerel dal: `task/t90-261101-backup-return`.

Windows kullanıcı denemesinde **Today’e dön** bağlantısı başlangıç ekranını açtı. Neden: `backup.html` doğrudan `index.html` adresine dönüyor, uygulama da her normal açılışta `home` rotasını seçiyordu. Bağlantı artık yalnız `fromBackup=modules` parametresini iletir; `index.html` yalnız bu tam değerde modüller rotasıyla başlar. Normal ve tanınmayan girişler başlangıç ekranında kalır. Depolama, not, yedek biçimi ve kullanıcı verisi değişmez.

Aynı denemede **Diğer Today pencerelerini kapat** uyarısı görüldü. Kullanıcı Windows'ta yalnız bir pencere açık olduğunu doğruladı. Eski Service Worker tam `backup.html` URL'sini karşılaştırıyordu; sorgu/fragment eklenmiş aynı sayfa yanlış reddedilebilirdi. Yeni protokol aynı origin ve sayfa yolunu kabul eder, ancak **tek client ve aynı kaynak ID** şartını aynen korur. İkinci gerçek sekme reddedilir. Web Locks meşgul, başka pencere ve kaynak sayfa uyuşmazlığı artık ayrı hata metinleri verir; client URL'leri veya kullanıcı verisi raporlanmaz. Yeni SW cache etiketi `foundation-101` ile değişen dosyalar güncellenebilir. Tek pencereli sentetik Chromium akışında yedek dosyası üretimi geçti. Windows'taki özgül ret nedeni eski sürümden elde edilemedi; fiziksel tekrar testi gerekir.

Yeni dönüş, tek client/çift sekme, yedek oluşturma ve cache akışlarını kapsayan Chromium 9/9 PASS. Yedekleme modülü 40/40, SW olayları 38/38, kaynak katalogu 12/12, statik sözleşme 30/30 ve tam platform kapısı 1446/1446 PASS, 0 son FAIL. İlk tam koşu eski `index.html` SHA ve satır envanterinde durdu; satır sayısı korunup yalnız güncel SHA pinleri yenilendikten sonra kapı geçti. Fiziksel Windows/iPhone yeniden kabulü ayrıca kaydedilir. Bu dal canlı Netlify veya GitHub Pages yayınına aktarılmadı.

İlk uzak CI `43373790312` platform ve iki native önizleme işini geçirdi. Tarayıcı işi 176 PASS/2 FAIL verdi: Chromium ve WebKit'te ikinci pencere gerçekte engelleniyordu (`entered:false`), ancak iki test eski genel ret kodunu bekliyordu. Yalnız bu beklentiler yeni `other-client` koduna uyarlandı; yerel ilgili Chromium kurtarma dosyası 5/5 PASS. Güncellenen commit için uzak CI tekrar sonucu beklenir.

## Tek pencere uyarısı için salt okunur tanı

Sonraki fiziksel Windows denemesinde kullanıcı Chrome kullandığını, kurulu Today PWA olmadığını ve bütün sekmeleri kapatıp tarayıcıyı yeniden açarak `backup.html` adresini doğrudan ziyaret ettiğinde de `other-client` uyarısının sürdüğünü bildirdi. Bu, geçiş/BFCache açıklamasını tek başına yeterli kılmaz. Eski protokol client sayısı veya türünü vermediğinden özgül neden henüz bilinmiyor.

`foundation-102` tanısı ret anında yalnız toplam sayfa istemcisi, kaynağın listede bulunup bulunmadığı ve en çok üç diğer istemcinin `backup`/`app`/`other` sayfa türü, görünürlük ve iç çerçeve bilgisini gösterir. Tam URL, sorgu, not, sağlık verisi veya kayıt içeriği aktarılmaz; veri saklanmaz. Tek client ve aynı kaynak ID şartı aynen korunur. Yeni tanıdan sonra fiziksel Windows sonucuyla yanlış ikinci client'ın türü belirlenecek; güvenlik şartı kanıtsız gevşetilmeyecek.

Yerel tanı doğrulaması: SW 38/38, yedekleme 40/40, statik 30/30, ilgili Chromium 9/9 ve tam platform 1446/1446 PASS. Uzak CI ve fiziksel Windows tekrar sonucu bu yeni commit için bekleniyor.
