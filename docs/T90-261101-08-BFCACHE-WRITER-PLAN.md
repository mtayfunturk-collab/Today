# T90-261101-08 — Eski sayfa ve BFCache yazıcısı kabul planı

Başlangıç SHA `46d6b28cb61a64773e8a1f0a993f091b964b230a`; yerel dal `task/t90-261101-08-bfcache-plan`. Bu belge yalnız test ve karar sınırını tanımlar. Üretim kodu, veri, şema, Service Worker ve canlı yayın değişmez.

## Neredeyiz?

GitHub Pages'te şifreli dosya üretimi ve dosya bütünlüğü kontrolü var. Geri yükleme kapsamı yalnız okunur; gerçek kayıtları değiştiren geri yükleme arayüzü kapalı. Sentetik prototipte geçici/kalıcı hata geri alması, işlem öncesi hedef değişimi, önceden açık ikinci sekmenin reddi ve yeni navigasyonun bekletilmesi otomatik sınandı. Bunlar gerçek iPhone'da geri yükleme kabulü değildir. iPhone güncelleme ve önizleme sorunu kullanıcının isteğiyle [iş #6](https://github.com/mtayfunturk-collab/Today/issues/6) kapsamında ertelendi.

## Açık güven sınırı

`modules/backup-export.mjs` içindeki bariyer exclusive Web Lock alır; `sw.js` yeni gezinmeleri aynı isimli shared lock ile bekletir ve `clients.matchAll({includeUncontrolled:true})` ile tek pencere arar. Buna karşılık mevcut Core, Health, State ve Nutrition yazıcıları ortak shared lock edinmez. Bu nedenle yalnız navigasyon kilidi, **zaten çalışan veya BFCache'ten canlanan eski yazıcıyı** durdurduğunu kanıtlamaz. Sentetik koordinatörün `barrier` bağımlılığı çağıran tarafından sağlanır; üretimde `fn=>fn()` kabul edilemez.

## Ayrı kabul senaryoları

| Senaryo | Gerekli gözlem | Geçme koşulu |
|---|---|---|
| Önceden açık ikinci sekme | Aynı test origin'inde ikinci Today client'ı | `prepare` yazmadan `other-client` verir; kaynak ve kurtarma günlüğü değişmez. Bu dar durum PR #8'de doğrulandı. |
| İşlem sırasında yeni gezinme | Exclusive kilit tutulurken ikinci navigasyon | Gezinme işlem bitene dek bekler; önceki veri veya günlük kısmi kalmaz. Mevcut Chromium kanıtı vardır. |
| Gerçek BFCache dönüşü | `pagehide` ve `pageshow` olaylarında `persisted===true`, aynı belge kimliği | Canlanan sayfanın yazma girişimi işlem sırasında ya bekler ya reddedilir; eski veri geri gelmez. `persisted!==true` sonucu PASS sayılmaz. |
| Eski/denetimsiz Worker | Eski script revision ve `controllerchange` anı testte görünür | Belirsiz worker veya istemci değişiminde işlem yazmadan durur ya da önceki görüntü güvenle geri alınır. |
| İşlem ortasında mevcut yazıcı | Yazıcı çağrısı, günlük `APPLYING` iken sentetik olarak zamanlanır | Aynı origin'deki Core/Health/Nutrition verisi kayıpsız kalır; geri alma parmak izi ve günlük temizliği doğrulanır. Bugünkü ortak kilit eksikliği nedeniyle bu koşul henüz sağlanmış sayılmaz. |

## Test düzeni ve karar

Her koşu ayrı rastgele `/runs/<id>/` kapsamı ve geçici tarayıcı profili kullanır. Yalnız sentetik not ve Nutrition kaydı yazılır. Test, eski belge/Worker kimliğini, BFCache `persisted` değerini, bariyerin başlangıç ve son client yanıtını, `today_recovery_v1` fazını ve işlem öncesi/sonrası bilinen alanların parmak izlerini kaydeder; özel kayıt içeriğini günlüklemez. BFCache uygunluğu oluşmazsa başka bir motor/cihazla tekrar kabul gerekir, normal geri navigasyonun geçmesi yeterli değildir.

İlk küçük uygulama adımı BFCache uygunluğunu ve eski Worker kimliğini yalnız test aracında gözlenebilir kılmaktır. Yazıcı gerçekten kilidi aşabiliyorsa üretim restore açılmaz; ortak yazıcı kapısı veya eşdeğer tek-yazıcı protokolü için ayrı mimari karar ve test gerekir. Mevcut şema/anahtar değiştirilmez. İkinci adım sentetik yarış ve geri alma kabulüdür. Son kapı, kullanıcının iPhone Safari ve kurulu PWA'sında ayrı fiziksel doğrulamadır; iş #6 erteliyken bu kapı kapatılamaz.

Bu plan test PASS sonucu veya üretim geri yükleme onayı değildir. Şifreli dosyanın bütünlük kontrolü, dosyanın gerçek verileri geri yükleyebildiğini tek başına kanıtlamaz.
