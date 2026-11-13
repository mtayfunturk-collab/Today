# Yedek sayfasından dönüş — Windows kabul düzeltmesi

Başlangıç: PR #3 adayı `135879926d9902b58f16bd3168f202083c71e19c`. Ayrı yerel dal: `task/t90-261101-backup-return`.

Windows kullanıcı denemesinde **Today’e dön** bağlantısı başlangıç ekranını açtı. Neden: `backup.html` doğrudan `index.html` adresine dönüyor, uygulama da her normal açılışta `home` rotasını seçiyordu. Bağlantı artık yalnız `fromBackup=modules` parametresini iletir; `index.html` yalnız bu tam değerde modüller rotasıyla başlar. Normal ve tanınmayan girişler başlangıç ekranında kalır. Depolama, not, yedek biçimi ve kullanıcı verisi değişmez.

Aynı denemede **Diğer Today pencerelerini kapat** uyarısı görüldü. Servis çalışanı aynı origin içindeki tüm açık pencereleri sayar; yedek sırasında yalnız `backup.html` penceresine izin verir. Tek pencereli sentetik Chromium akışında yedek dosyası üretimi geçti. Kullanıcının Windows anında başka sekme/kurulu PWA açık olup olmadığı henüz doğrulanmadığından güvenlik kilidi gevşetilmedi. Uyarı tekrar ederse aynı adresin tüm sekme ve PWA pencereleri kapatılıp tek pencereden yeniden denenmeli; tekrarında worker/client tanısı gerekir.

Yeni dönüş senaryosu Chromium 1/1 PASS; mevcut tek pencereli sentetik yedek senaryosu Chromium 1/1 PASS. Kaynak katalogu 12/12, statik sözleşme 30/30 ve tam platform kapısı 1446/1446 PASS, 0 FAIL. İlk tam koşu eski `index.html` SHA ve satır envanterinde durdu; satır sayısı korunup yalnız güncel SHA pinleri yenilendikten sonra kapı geçti. Fiziksel Windows yeniden kabulü ve iPhone testi bu düzeltme için bekliyor. Bu dal canlı Netlify veya GitHub Pages yayınına aktarılmadı.
