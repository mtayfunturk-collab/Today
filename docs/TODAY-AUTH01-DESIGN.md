# AUTH01 — Biyometri, parola ve yerel veri erişimi

25 Kasım 2026. Tasarım teslimi. Ürün dayanağı [ana görev kaydındaki AUTH01](TODAY-CURRENT-STATUS.md), referans uygulama Today 2.23.3 / 4061839. Kullanıcı notları ve sağlık verisi tarayıcı origin'inde saklanıyor. Şifreli yedek dosyası kendi parolasıyla açılır. Dosya parolası ile uygulama kimliğinin amaçları ayrıdır; mevcut yedek davranışı tasarımın dışında kalır.

## Ürün kararı

| Seçenek | Kullanıcıya sağladığı | Koşul |
|---|---|---|
| Cihazda uygulama kilidi | Paylaşılan, kilidi açık cihazda Today ekranına erişime karşı ek engel | Ekran kilidi ile diskteki verinin korunması ayrı tanımlanır. Koruma seçilen kapsama göre doğrulanır. |
| Cihaz içi şifreli veri alanı | Yerel kayıtların şifreli tutulmasını hedefler | Anahtar yaşam döngüsü ve kullanıcı kontrollü kurtarma tasarımı, mevcut kayıt ve yedek uyumu, ayrı veri/şema ve geçiş kararı gerekir. |
| Hesap ve passkey | Hesaba bağlı kimlik doğrulama ve oturum yönetimi | Standart WebAuthn hesap akışı bir relying party, doğrulanmış origin, oturum ve hesap kurtarma politikasına ihtiyaç duyar. Hesap altyapısı, senkronizasyon ve veri aktarımı ayrı ürün kararlarıdır. |

**İlk karar önerisi:** Paylaşılan cihazda ek mahremiyet hedefleniyorsa önce cihaz içi uygulama kilidinin fizibilitesini seçin. Depolanmış veriye veya çoklu cihaza ilişkin daha güçlü bir gereksinim varsa kapsamı önce ayrıca belirleyin. Ürün metni seçilen korumayı açıkça tarif etmeli ve tarayıcı depolamasının şifrelendiğini ancak bu özellik teslim edilirse söylemeli. Biyometrik doğrulamada işletim sistemi doğrulama sonucu kullanılabilir. Uygulama ham parmak izi veya yüz verisi istemez ve saklamaz. PWA ve native yüzeyleri ayrı değerlendirilir. [WebAuthn hesap akışı](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API)

## Uygulamaya geçmeden önce kabul

1. **Cihaz davranışı:** iPhone Safari, kurulu PWA, Windows ve varsa ayrı onaylı native kapsamdaki destek, iptal, izin reddi ve doğrulayıcı bulunmaması ayrı ölçülür. Biyometriyi kullanamayan kişinin neyle erişeceği ve doğrulama başarısızken hangi ekranı göreceği ürün kararında yazılır.
2. **Oturum sınırı:** İlk açılış, manuel kilitleme, arka plan ve yeniden açılış, geri gezinme/BFCache, çevrimdışı açılış ve birden fazla pencere için davranış belirlenir. Kilitli oturumda hassas ekran ve veriler istemeden gösterilmez. Kilit/oturum davranışı kullanıcı kaydını değiştirmez.
3. **Parola ve kurtarma:** Yedek parolası ile uygulama parolası ayrı kalır. Parola, doğrulayıcı kaybı ve cihaz değişiminde kurtarmanın neyi geri verebildiği açıklanır. Başarısız doğrulama ya da unutulan parola, mevcut notları veya yedekleri sessizce silmez. Veri alanı şifrelenecekse anahtar değişimi, kaybı ve kurtarma testleri tasarım eki olur.
4. **Veri ve yayın kapısı:** Seçilen akışın origin, depolama, anahtar, aktarım ve izin etkileri onaydan önce envantere girer. Sonra sentetik kayıtlarla veri korunumu, hata ve iptal, yedek uyumu, fiziksel cihaz ve erişilebilirlik kabulü yapılır. Mağaza ve native ertelemesi geçerlidir.

**Sonuç:** Uygulama kapsamı için önce yerel ekran kilidi, şifreli veri alanı veya hesap hedeflerinden biri seçilmeli. Bu belge seçimi uygulamıyor. Teknik tasarım, test ve uygulama kararı seçilen hedefe bağlanır.
