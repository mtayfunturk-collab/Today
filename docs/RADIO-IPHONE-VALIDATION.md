# Today Radio — iPhone kabul kaydı

Tarih: 31 Ekim 2026. Donanım: kullanıcının iPhone15/iOS18.7.8 telefonu.
Durum: **Kullanıcının iPhone testinde ses ve mini gösterim doğrulandı; durdurma sonrası yeniden oynatma deneyimi açık.**

## Hazır sürüm

App2.23.0, schema2, foundation-079/125. Test edilmiş commit ff1b56361fd29583fb5ec9ad6c35d1f0c9c757ba.
Sabit yayın dalı: `preview/iphone-radio-2.23.0`. Bu dal geliştirme dalından bağımsız sabit tutulur; sonraki geliştirme push'ları kendiliğinden yayına çıkmaz.
[CI41176201646](https://github.com/mtayfunturk-collab/Today/actions/runs/41176201646) başarılı: platform1161, entegrasyon329, Engine403 raporlanan kontrol, benchmark16 ve browser30 PASS; FAIL0. Android/iOS derlemeleri geçti.

## Önceki yayın engeli — kullanıcı işlemiyle kapandı

Pages adresi https://mtayfunturk-collab.github.io/Today/ ve kaynak main/root. Kontrolde yayımlanan modüller App2.16.0/foundation-067, son başarılı Pages build commit'i3dbd265b9180034fd9439ee51e23375c4802e459 idi.
Pages kaynağını sabit test dalına değiştirme API isteği GitHub tarafından403 Resource not accessible by integration ile reddedildi. Ayar değişmedi; kullanıcıdan geniş yetki/token istenmez. Bu bir otomatik onay reddi değil, GitHub entegrasyon yetkisi sınırıdır. main'e yazma veya merge yapılmadı.

Kullanıcı işlemi:
1. [GitHub Pages ayarını](https://github.com/mtayfunturk-collab/Today/settings/pages) aç.
2. Deploy from a branch altında Branch: `preview/iphone-radio-2.23.0`, klasör: `/(root)` seç ve Save.
3. Pages yayını başarıyla tamamlandıktan sonra aynı Today adresini aç.
4. İlk kabul öncesi live modules/version.js=2.23.0 ve sw.js=foundation-079 ayrıca doğrulanmalı. Kaydetmek tek başına başarılı yayın kanıtı değildir.

Geri alma gerekirse Pages kaynağı tekrar main/root seçilebilir; bu eski2.16 koduna dönüş demektir, otomatik uygulanmaz. Veri silme/depo temizleme çözüm olarak önerilmez.

## Telefon testi — sonuçlar bekleniyor

Safari ve ana ekrana ekli PWA ayrı kaydedilir. Güncelleme isteği varsa kabul et; uygulamayı silme, Safari/site verisini temizleme. Aynı adres/origin kullanılır. Ana ekranda build2.23.0 görülmeden test başlatma.

| Kontrol | Safari | Ana ekran PWA |
|---|---|---|
| Açılışta mini oynatıcı görünür, ses kendiliğinden başlamaz | Bekliyor | Bekliyor |
| Radio'da dizin izni + İstasyonları yükle sonuç verir | Bekliyor | Bekliyor |
| Ayrı yayıncı izni + Dinle ile gerçek ses duyulur; hata varsa adı/metni kaydedilir | Bekliyor | Bekliyor |
| Başka modüle, sonra ana ekrana geçince aynı yayın sürer; mini ad/durum eşleşir | Bekliyor | Bekliyor |
| Mini Durdur sesin kesilmesini ve iki ekranın durdu bilgisini sağlar | Bekliyor | Bekliyor |
| Yeniden açılışta otomatik ses yok; mevcut Core/Health kayıtları korunur | Bekliyor | Bekliyor |
| Dikey kaydırma/hizalama ve yatay taşma normal | Bekliyor | Bekliyor |

CORS izni olmayan veya desteklenmeyen yayınların açılmaması bilinen sınırdır. Tüm istasyonlar başarısızsa aşama geçmedi sayılır; bir hata adını/metnini ve Safari mi PWA mı olduğunu raporla. Kullanıcı sağlık kayıtlarının içeriğini paylaşmak gerekmez. Kilit ekranı/arka plan bu aşamanın kabul garantisi değildir.

Sonraki adım: yukarıdaki telefon sonuçlarını al ve bu tabloyu güncelle. Telefon sonucu gelmeden fiziksel kabulü tamamlandı işaretleme.

## Canlı yayın doğrulaması

Kullanıcı Pages kaynağını seçti. API source preview/iphone-radio-2.23.0/root ve son Pages build ff1b56361fd29583fb5ec9ad6c35d1f0c9c757ba için built, hata yok; updated_at2026-10-31T06:59:36Z. Canlı HTTPS istekleriyle modules/version.js=2.23.0, sw.js=foundation-079 ve radio-ui.mjs/mini-player ile radio-player.mjs/ortak oynatıcı HTTP200 doğrulandı. İlk building kontrolünde eski2.16 ve Radio404 görülmüştü; build bitince yeni dosyalar doğrulandı. main değişmedi. Temiz yerel Chromium ile ek canlı smoke denemesi bulut ortamında ERR_CERT_AUTHORITY_INVALID nedeniyle sayfa yüklenmeden durdu; TLS doğrulaması kapatılmadı, bu kontrol PASS sayılmadı. Önceki CI30/30 tarayıcı sonucu ayrı kanıttır. Telefon testi henüz yapılmadı; Safari/PWA tablosu bekliyor.

## Kullanıcının ilk fiziksel telefon sonucu

Kullanıcı Türkiye ve Hindistan istasyonlarında gerçek ses duyduğunu, mini oynatıcı gösteriminin çalıştığını ve başka modüllere geçerken sesin sürdüğünü bildirdi. Mini-player Durdur sonrası yeniden oynatamadığını bildirdi. Safari mi Ana Ekran PWA mı olduğu henüz belirtilmedi; iki platform tablosuna birden PASS yazılmaz. Açılışta sessizlik, reload, kayıt korunması ve scroll ayrıca doğrulanmadı.

Kod incelemesi: mini-player yalnız Durdur/Radio’yu aç sunar; Radio’yu aç oynatmayı başlatmaz. reflectPlayer, Radio dışında inaktif duruma geçince yayıncı checkbox’ını temizler. Tekrar dinle ise aynı checkbox onayını ister. Bu nedenle home’da durdurma sonrası yeniden dinleme, Radio ekranında yayıncı iznini yeniden seçmeden çalışmaz. Kullanıcı deneyimi açığıdır; bağlantı hatası olduğu doğrulanmadı. Mevcut geçici yol: Radio’yu aç → yayıncı bağlantı iznini yeniden seç → Tekrar dinle. Sonraki küçük düzeltme, stop ile izin geri çekmeyi ayıran anlaşılır kullanıcı eylemli tekrar dinleme akışıdır; otomatik başlatma ve reload sonrası izin saklama eklenmemeli. Bu kayıt yalnız dokümandır; canlı2.23 kodu değiştirilmedi. Telefon kabulü kısmi, aşama tamamen kapatılmadı.

## Mini replay düzeltmesi — telefon tekrar testi bekliyor

Kullanıcı netleştirdi: Radio ekranındaki Tekrar dinle çalışıyor, aynı eylem mini-player içinde eksikti. App2.23.1 (a5c620d0868aa401a3a9313b186407793727e246), schema2/foundation-080/125: mini Durdur artık Tekrar dinle olur ve aynı oturumdaki seçimi/izni kullanır. Checkbox kaldırma replay engeli; reload temiz ve sessiz başlar. Önceki stop/route izin temizleme kararı değişti; otomatik oynatma/kalıcı izin eklenmedi.

CI41180093159 completed/success; dört job başarılı. Platform1161, entegrasyon330 (UI21 dahil), Engine403 raporlanan kontrol, benchmark16 ve0 güvenlik ihlali; Chromium15+WebKit15=30PASS/0FAIL logdan doğrulandı. Android/iOS derlemeleri başarılı. Test edilen commit sabit Pages test dalına fast-forward aktarıldı; dal adındaki2.23.0 tarihsel addır, içerik2.23.1 oldu. main değişmedi, merge yok. Canlı yayın ve kullanıcının fiziksel mini-stop/replay sonucu PR #2'de takip edilir. Sonraki adım: telefonda build2.23.1 ile mini Durdur→Tekrar dinle→ses dönüşünü doğrula.
