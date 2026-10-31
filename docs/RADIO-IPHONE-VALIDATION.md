# Today Radio — iPhone kabul kaydı

Tarih: 31 Ekim 2026. Donanım: kullanıcının iPhone15/iOS18.7.8 telefonu.
Durum: **Yayın yetkisi nedeniyle bekliyor; fiziksel test yapılmadı.**

## Hazır sürüm

App2.23.0, schema2, foundation-079/125. Test edilmiş commit ff1b56361fd29583fb5ec9ad6c35d1f0c9c757ba.
Sabit yayın dalı: `preview/iphone-radio-2.23.0`. Bu dal geliştirme dalından bağımsız sabit tutulur; sonraki geliştirme push'ları kendiliğinden yayına çıkmaz.
[CI41176201646](https://github.com/mtayfunturk-collab/Today/actions/runs/41176201646) başarılı: platform1161, entegrasyon329, Engine403 raporlanan kontrol, benchmark16 ve browser30 PASS; FAIL0. Android/iOS derlemeleri geçti.

## Yayın engeli

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

Sonraki adım: kullanıcı Pages kaynağını seçtikten sonra canlı sürümü doğrula; yukarıdaki telefon sonuçlarını al ve bu tabloyu güncelle. Telefon sonucu gelmeden fiziksel kabulü tamamlandı işaretleme.
