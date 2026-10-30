# NUT-RADIO — Aşama 1: mimari ve uygulanabilirlik

30 Ekim 2026. **Analiz tamamlandı; ürün kodu/kalıcı depo/ses oynatma eklenmedi.** Model önerisi Sol Medium. Modelin otomatik değiştirildiği iddia edilmez.

## Mevcut işlerin korunması ve bağımlılık

- İnceleme başlangıcı: `nut-018-ci-stabilization`, `d10f1ebc84f0885a673e23c95021c6b7467abfde`; çalışma ağacı temiz. Uzak dallar main ve nut-018-ci-stabilization; açık Draft PR #1. main'e yazılmadı/merge yapılmadı.
- Saat SDK/Health ekranı, ayrı onaylı Health–AI kaynağı ve izinli yerel bildirim/arşiv kodu var. Fiziksel iPhone/miBand kabulü ve imzalı dağıtım yapılmadı; Apple Developer maliyeti nedeniyle kullanıcı bunları 2–4 ay/üyelik mümkün olana kadar erteledi. Radio bunları yeniden başlatmaz.
- Mobil hizalama/scroll ve Core–Health–Sky swipe dilimi bu commit'te var. Actions **41116016970 failure**: platform/Android/iOS başarılı, tarayıcı **25 PASS / 1 FAIL**. Yeni mobil testinde Linux WebKit `new Touch(...)` için `TypeError: Illegal constructor` verdi. Chromium 13 geçti; WebKit 12 geçti/1 başarısız. Bu, test sürücüsünün platform uyumsuzluğudur; iPhone ürün hareketinin doğru çalıştığını kanıtlamaz.
- Radio `feature/today-radio` dalında bu commit'ten ayrıldı. Bu aşama yalnız dokümandır. PR hedefi geliştirme dalı olur; böylece Radio farkı PR #1'i tekrar içermez. PR #1 değişirse Radio tabanı kontrollü güncellenir. Yeni ürün uygulamasından önce ana geliştirme dalında Touch testinin taşınabilir hale gelmesi ve yeşil taban gerekir; burada sessizce düzeltilmedi.

## Mevcut mimariye ekleme noktaları

| Alan | Bulgu / en küçük ekleme |
|---|---|
| PWA | Vanilla HTML/CSS + classic/ES module; framework değişimi gerekmez. Mevcut App 2.20.1, Core şema 2. |
| Ana ekran | index.html home görünümü: başlık/Başla/durum; tek kompakt mini-player alanı. İçerik tabanlı yükseklik, sabit ekran kaplayan overlay yok. |
| Modül/navigasyon | Router sekiz mantıksal rota/altı görünüm; modules kartlarına Radio, ayrı `radio` görünümü/parent modules eklenebilir. Geri/odak/aria/URL geçmişi aynı router'da kalır. Swipe sırası ayrı ürün kararıdır; bu aşamada değişmez. |
| Başlatma | TodayStartup ready sonrası idempotent mount. Ses nesnesi route içinde yaratılmaz; render/unmount oynatmayı yeniden başlatmaz. |
| SW/native paket | SW başka origin isteklerini mevcut kodda ele almıyor. Sadece statik Radio modülleri APP_SHELL'e girer; akış/HLS/metadata/logo/dizin cache'e alınmaz. Same-origin canlı yol da eklenirse ayrıca dışlanır. Kabuk sürümü/hash/envanter testleri uygulama diliminde güncellenir. Native build izin listesi yeni module importlarını toplar; native ses yetkisi bu işte eklenmez. |
| Depolar | Core today_store_v2 ve nutrition IndexedDB gibi mevcut depolar korunur. Radio bağımsız depo sözleşmesi; eski store/migration'a alan eklenmez. |
| AI | data-usage-consent/context-builder/multi-window-observer ve source adapter katmanı var. Mevcut kaynak kataloğu Core/Health/Sky; Radio'yu bunlardan biri gibi gizlemek yerine ayrı, varsayılan kapalı kaynak gerekir. Aşama 6'ya kadar AI'a veri yok. |

Önerilen dosyalar: radio-directory.mjs (doğrulama/fetch), radio-player.mjs (tek audio), radio-store.mjs (ayrı bounded depo), radio-ui.mjs ve radio-mini-player.mjs (ortak state aboneleri). Mevcut Health/Sky/AI dosyaları yeniden yazılmaz. Aşama 2'de temel player çekirdeği gerekir; Aşama 4 aynı çekirdeği genişletir, ikinci player oluşturmaz.

## Dizin araştırması ve ölçülen erişim

Kaynak: [Radio Browser giriş belgesi](https://api.radio-browser.info/), [sunucu API belgesi](https://de1.api.radio-browser.info/). Araştırma istemcisi kişisel veri/çerez göndermedi; yayın dinlemedi, click/vote endpoint'i çağırmadı.

- Sunucu dokümanı ve `GET /json/stations/search?countrycode=TR&hidebroken=true&limit=3`: HTTP 200, Access-Control-Allow-Origin `*`.
- Üç kayıt döndü: AAC/HLS, MP3/doğrudan ve UNKNOWN/HLS. Yalnız **1/3 url_resolved HTTPS**. Bu küçük örnek tüm katalog oranı değildir. Hiçbirinin gerçek ses teslimi test edilmedi; lastcheckok başarı garantisi sayılmaz.
- Resmî belge ücretsiz/açık kullanım ve sunucu keşfi/ayna değiştirme yaklaşımını anlatır. UUID istasyon kimliği ve countrycode kullanılır. Sunucu ismi kalıcı sabit varsayılmaz; tarayıcı DNS sorgusu yapamadığından belgelenmiş HTTPS keşif yolu + doğrulanmış sınırlı ayna listesi uygulanmalı. Aşama 2 öncesi keşif endpoint/CORS davranışı ayrıca sınanır.
- Belge tanımlayıcı istemci adı ve click bildirimi ister. Web sayfası User-Agent başlığını güvenilir biçimde değiştiremez; desteklenen kimlik mekanizması doğrulanmalı. Click popülerlik endpoint'i dış dinleme sinyalidir: varsayılan otomatik çağrı önerilmiyor; sağlayıcı beklentisiyle uyumu uygulama öncesi çözülmeli. Şeffaf izin olmadan gönderilmez.
- API kullanımı, istasyon yayın hakkı veya logo lisansı anlamına gelmez. Açık veri seti lisansının kapsamı, sağlayıcı koşulları ve istasyon/logo izinleri dağıtımdan önce ayrıca doğrulanmalı; bu inceleme bunlar için hukukî uygunluk onayı vermez. İlk görünüm yerel harf/simge kullanır, dış favicon otomatik yüklemez.

Web araştırma aracı sonraki sorgularda hata verdi; erişim kontrolü aynı resmî adreslerde HTTPS istemcisiyle yapıldı. Başarısız Apple arşiv sayfasından platform garantisi türetilmedi.

## Ses, güven ve gizlilik sınırı

- İlk yol kullanıcı eylemiyle doğrudan HTTPS MP3/AAC; `canPlayType` yalnız aday seçer, `playing` gerçek state'i belirler. Uzantı/codec etiketi tek başına yeterli değil. HLS: Safari native yeteneği kontrol edilir; Windows tarayıcısında destek yoksa açık hata. hls.js ilk sürüme otomatik eklenmez; gerekirse pinli bağımlılık ve manifest/segment/key CORS testleriyle sonraki dilimdir.
- Dizin `fetch` CORS ister. Basit `<audio src>` CORS'suz cross-origin çalabilir; bundan metadata/Web Audio erişimi sonucu çıkarılmaz. Zorunlu `crossOrigin=anonymous` bazı akışları kırabilir. HLS JS yolunda tüm alt kaynaklar CORS gerektirir. HEAD/fetch hatası tek başına “yayın kapalı” kararı vermez. [Media CORS](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/crossOrigin), [codec kılavuzu](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs).
- Şema: UUID, bounded düz metin ad/ülke/dil/tag, codec/hls ve URL alanları doğrulanır; HTML innerHTML ile basılmaz. Yalnız HTTPS; credentials, localhost, literal özel/link-local IP, bozuk/çok uzun URL ve javascript/data/file şemaları reddedilir. Keyfî kullanıcı URL girişi ilk kapsamda yok. Bu kontroller DNS rebinding/redirect zincirinin tamamını tarayıcıdan kanıtlamaz; proxy/SSRF servisi kurulmaz. HTTPS→HTTP bozulması destekleniyor gibi sunulmaz.
- Dizin açılması IP ve arama metnini dizine, oynatma IP'yi yayıncıya iletir; “tamamen cihazdan çıkmıyor” denmez. İlk açılış/ana ekran mount'u ağ/ses başlatmaz; Radio'da açık “istasyonları yükle”, oynatmada ayrı kullanıcı eylemi ve kısa dış bağlantı açıklaması. Arama debounce/abort/eski yanıt epoch'u, limit/pagination, zaman aşımı ve en çok sınırlı ayna denemesi; sınırsız retry/otomatik başka istasyon yok.
- Tek audio instance, durumlar idle/loading/playing/paused/buffering/error. İstasyon değişince eski kaynak durdurulur; geç play promise ve eski event'ler session token ile dışlanır. Pause/durdur ağ yüklemesini keser; tekrar oynat canlı noktadan yeniden bağlanabilir. Yalnız playing “canlı” göstergesi; yüklenirken dönüyor olması başarı değildir.
- Audio dış bileşenlerin ortak state kaynağıdır. Media Session varsa yalnız desteklenen play/pause/stop handler'ları, istasyon adı/“canlı radyo” metadata'sı. Doğrulanmamış şarkı adı yok. API/OS arka plan, kilit ekranı ve başka uygulama kesintisi garantisi vermez. [play izin/hata modeli](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play), [Media Session](https://developer.mozilla.org/en-US/docs/Web/API/MediaSession).
- iPhone 15/iOS 18.7.8 Safari ve Ana Ekran PWA ayrı kabul satırlarıdır. Ses seviyesi programatik kontrolü platforma bağlıdır; desteklenmeyen cihazda çalışıyor gibi slider yerine sistem ses tuşu açıklaması. Native Web Audio ile bu sınır aşılmaya çalışılmaz. [volume desteği](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/volume), [WebKit medya altyapısı](https://webkit.org/blog/13851/introducing-managed-media-source/).
- Uyku zamanlayıcısı duvar saati deadline'ını her resume/play girişinde denetler. OS askıya alınmış JS'in tam saatte çalışacağı vaat edilmez. Arka plan kesintisi/uyku süresi gerçek cihazda ölçülür; maliyet nedeniyle ertelenen native işi yeniden açılmaz.

## Ayrı kalıcı veri önerisi — bu aşamada oluşturulmadı

`today_radio_v1` adlı tek ayrı localStorage anahtarı önerisi: schemaVersion1, sınırlı tercihler, en çok 100 UUID favori ve minimal doğrulanmış istasyon snapshot'ı; toplam 128KiB. Yazma yalnız ilgili kullanıcı eyleminden sonra, kotada eski değer korunur. Geçmiş ve AI varsayılan kapalı; geçmiş kapalıyken “son dinlenen” de oturum belleğiyle sınırlıdır, favori geçmiş sayılmaz. Önceki uygulama ses tercihi açılışta otomatik play yaptırmaz.

Ayrıntılı geçmiş için ayrı `today_radio_history` IndexedDB önerilir: yalnız history session store'u; en çok 200 kayıt/30 gün, temizleme sonraki erişimde. stationUUID/name, bounded genre/source, UTC start/end, zaman dilimi ve yaklaşık duration; parça metadata'sı ilk kapsamda yok. Tarayıcı kapatılmasında tam end bilinmeyebilir: incomplete state, son doğrulanmış süre; kapalı süre eklenmez. Sessizlik/buffering süresi ölçülmez; playing aralıkları monotonic saat ve heartbeat ile ölçülür, büyük timer boşluğu sayılmaz. Bu süre cihazın gerçekten duyulduğunu kanıtlamaz.

Kapatma yeni yazmayı derhal keser; kullanıcı mevcut geçmişi ayrıca görüntüler/siler. “Geçmişi sil” yalnız Radio geçmişini temizler ve bekleyen async yazıyı session epoch ile iptal eder; favoriler/Health/Core korunur. Silme ve izin geri alma AI snapshot'ını geçersiz kılar. **Anahtar/DB, saklama sınırı ve izin UI'si uygulanmadan önce somut veri etkisi netleştirilmelidir; mevcut veri şeması değiştirilmez.** İki kalıcı depo bu analizde yalnız öneridir.

AI izni geçmiş saklamadan ayrıdır; her analizde seçili dönem için sınırlı, mümkünse gün/saat dilimi/tür toplamı kullanılır. Dış modele/merkezi sunucuya veri gönderilmez. Örnekte “klasik” istasyon etiketi, çalan parçanın türü veya kullanıcının duygu durumu değildir. 7 günlük daha sık gözlemi, karşılaştırma tabanı ve yeterli farklı gün olmadan üretilmez; eşikler sentetik karşı örneklerle belirlenir, az veri için kesin psikolojik/tıbbî sonuç yoktur.

## Aşamalar ve geçiş kapıları

| Aşama | Küçük teslim / doğrulama | Model |
|---|---|---|
| 1 | Bu rapor; dal/PR/CI ve API erişimi kanıtı. Ürün kodu yok. | Sol Medium |
| Önkoşul | PR #1 Touch sürücüsü düzeltmesi, yeşil WebKit tabanı; Radio'ya kontrollü taban aktarımı | Sol Medium |
| 2a | Sahte dizinle URL/DTO/search/filter/abort/error/empty; bağımsız Radio route/UI | Luna / Sol Medium |
| 2b | Tek player temel çekirdeği ve kullanıcı eylemli gerçek dizin; TR/dünya, favori/oturum-son-listesi | Sol Medium |
| 3 | Mini-player aynı state; yön değişiminde tek audio, accessible controls/odak, mobil sığma | Luna |
| 4 | Kesinti/state yarışları, uyku deadline, Media Session ve yetenekli volume; iki gerçek platform kabulü | Sol Medium/High |
| 5 | Onaylı ayrı bounded geçmiş, süre hesaplama/silme/kota/crash/geri alma | Sol Medium |
| 6 | Ayrı Radio AI consent/source, geçmiş kapalı/ret koşulunda sıfır veri, kanıt/az veri karşı örnekleri | Sol High |
| 7 | Her dilimde hedefli test; aşama sonu platform/Engine/integration/benchmark + Chromium/WebKit | Luna / Sol Medium |

Tüm aşamalarda ağ/medya API'leri deterministik test double ile sınanır; canlı istasyon testleri kararsız olduklarından zorunlu CI geçişinin yerine konmaz. Arama/filtreler, URL saldırıları, reject play, eski event, tek audio, route/mini senkronu, quota, izin/silme yarışı ve askıda timer gerekli testlerdir. Kaynak sayıları gerçek test sonuçlarından gelir; test yazılmadan PASS sayısı uydurulmaz.

Gerçek Windows Chromium/Edge ve fiziksel iPhone Safari/PWA: ilk izinli play, iki istasyon arasında geçiş, app içi rota, kilit ekranı, kulaklık/telefon kesintisi, çevrimdışı/ağa dönüş, ses tuşu ve uyku timer'ı ayrı kaydedilir. Linux WebKit iPhone profili fiziksel kanıt değildir.

## Aşama 1 sonucu ve başlangıç kararları

**Koşullu uygulanabilir.** Radyo PWA'da ücretli Apple Developer üyeliği olmadan ilk ön plan kullanımına adaydır; kesintisiz arka plan/lock screen/iOS ses seviyesi ve tüm istasyonlara garanti yoktur. Kendi yayın sunucusu, müzik barındırma, proxy veya ücretli servis yok.

Önerilen ilk kapsam: yalnız doğrulanmış HTTPS adayları; MP3/AAC + native HLS yeteneği; yerel simge; no autoplay; tek audio; geçmiş/AI kapalı; dış logo/click yok. Karar kapıları: sağlayıcının click beklentisiyle privacy uyumu, gerçek istasyon/logo koşulları, HLS Windows fallback gereksinimi ve yukarıdaki somut ayrı depo sınırları. Bu kapılar çözülmeden geçmiş/AI veya “tüm istasyonlar çalışır” teslimi işaretlenmez.

Bu aşama testleri: iki resmî API HTTP kontrolü **2 PASS / 0 FAIL**; örnek 3 kaydın yalnız 1'i HTTPS aday (oynatma testi değil). Çalıştırılmamış ürün ses/iPhone/Windows testleri PASS sayılmaz. Yalnız belgeler değiştiğinden geçen uygulama kapıları tekrar çalıştırılmadı; önceki taban CI başarısızlığı yukarıda açık. Sonraki görev: mevcut WebKit test bağımlılığını kapatıp 2a DTO/dizin sözleşmesini izole testlerle hazırlamak.

## Aşama 2a — Dizin sözleşmesi uygulaması

radio-directory.mjs ve 19 hedefli test eklendi; birleşik test koşucusuna kaydedildi (284/284). Eski platform1161/Engine403/benchmark16 korundu. HTTP/JSON/MIME/yanıt boyutu, UUID/URL/dil/tür alanları, filtre kodlaması, duplicate, boş/hatalı yanıt, ayna fallback, timeout, cancel ve eski arama yarışı test edildi. Adaptör kurulduğunda istek yok; search userConfirmed=true ister. credentials omit/referrer yok/cache yok/redirect error; aynalar yalnız doğrulanmış Radio Browser HTTPS origin'leri ve en çok3. Tüm literal IP yayınları konservatif olarak reddedilir; DNS/redirect güvenliğinin tamamı kanıtlanmış sayılmaz.

Bu modül henüz index/router/SW tarafından yüklenmez; kullanıcıya Radio varmış gibi gösterilmez. Depo/AI/ses/history/logo/click yok; yeni uygulama sürümü veya migration yok. Ayna keşfi/sağlayıcı click koşulu halen açık. Sonraki küçük dilim sahte adaptörle erişilebilir Radio arama/filtre/empty/error ekranıdır. Canlı dizin ve oynatıcı ayrı kapılardır.

Ana dal Touch test düzeltmesi ede686d: Event üstünde sentetik touches/changedTouches kullanılır; hedefli Chromium1/1. Bu sentetik handler sözleşmesidir, fiziksel parmak kaydırması değildir. Uzak WebKit sonucu SHA/PR ile izlenir; başarılı doğrulanmadan engel kapandı denmez.

## Aşama 2b — Ayrı Radio görünümü, örnek katalog

App2.21.0, schema2, foundation-076/124. Önceki 1c16eb6 CI41122648364 completed/success ile WebKit sentetik touch engeli kapandı. Radio UI, dokuzuncu router rotası/yedinci fiziksel görünüm ve dördüncü Registry modülüdür; üç ortak alt navigasyona Radio eklendi. Yeni module startup-ready sonrası idempotent mount edilir, ilk açılışta istek/oynatma/depo yoktur.

createPreviewDirectory, gerçek DTO doğrulayıcısına örnek veriler döndürür; örnek kayıtlar açık etiketlidir ve hiçbir yayın adresine gidilmez. Ülke/dil/tür/isim filtresi yalnız submit'te işler. Busy sırasında iptal/filtre değişimi/rota çıkışı eski yanıtın görünmesini engeller; hata retry sunar. Sonuç adları textContent ile basılır; logo/link/audio yoktur. Sağlayıcı click/kimlik/koşul ve gerçek HLS kararları açıkken canlı katalog bağlanmaz. Ekranda favori, son dinlenen veya mini-player varmış gibi gösterilmez.

UI8 yeni kontrol entegrasyona eklendi: toplam292. Platform1161, Engine403, benchmark16/0ihlal, native15 ve Chromium14 geçti. Yeni gerçek Chromium senaryosu393px'de Radio açma→3örnek→ülke/tür filtresi→tek sonuç→boş arama→geri→Core koruması ve dış ağ0 kontrol eder. Son media cascade/Health global hizalama düzeltmesinden sonra mobil/Radio hedefi 2/2 ve statik30/30 geçti; fiziksel telefon kanıtı değildir. Native Android asset/sync hazırlığı geçti, yeni imzalı dağıtım yapılmadı. Statik kimlik/rota/kart/hash/envanter referansları eklenen sözleşmeye göre güncellendi; kapsam azaltılmadı.

Sonraki küçük dilim: Radio Browser sağlayıcı beklentisini/privacy sınırını netleştirip izinli gerçek katalogya geçiş; sonra tek audio çekirdeği ve mini-player. Geçmiş/AI için yeni depo oluşturulmadı. Önizleme UI'si bu tüm-modül tesliminin tamamlandığı anlamına gelmez.

## Aşama 2c — Kullanıcı eylemiyle gerçek katalog

App2.21.1/schema2/foundation-077/124. Önceki19a2baf CI41124365909 completed/success, tüm dört job başarılı. Radio'nun varsayılan sağlayıcısı artık createLiveRadioDirectory: tek bilinen bootstrap de1'dan izin sonrası /json/servers keşfi; yalnız *.api.radio-browser.info HTTPS origin'leri, en çok100 discovery kaydı/512KiB, hostname tekilleştirme ve en çok3rastgele ayna. Discovery başarısızsa açık bootstrap listesiyle sınırlı fallback; timeout discovery+arama+body için tek bütçedir. Sağlayıcı API listesi bugün iki farklı IP kaydında yalnız aynı de1 adını verdi; tek giriş noktasının erişilebilirlik riski sürer. Arama is_https=true ile sınırlı, client HTTPS/DTO doğrulaması korunur.

Görünür oturumluk checkbox IP ve arama/filtre seçimlerinin Radio Browser'a gittiğini açıklar; yükle eylemi olmadan discovery dahil istek yoktur. İzin kaldırma/route çıkışı epoch/AbortController ile iptal eder, sonucu siler, izin yeniden gerekir. Geçmiş ve sağlık verisi otomatik toplanmaz/gönderilmez; kullanıcı kendi arama metnini dizine gönderdiğini görür. User-Agent tarayıcı tarafından yönetilir; kimlik header'ı spoof edilmedi. Dizin listeleme dışında click/vote/popülerlik veya kullanıcı analitiği gönderilmez; oynatıcı öncesi sağlayıcının click tavsiyesi ve platform sınırları ayrıca kararlaştırılır.

Sonraki30 kayıt offset ile yüklenir; filtre/yeniden arama offset'i sıfırlar. Ayıklanan güvensiz/duplicate kayıt sayısı görünür. Sonuçlar oynatma başarısı değildir, istasyonların yalnız geçmiş dizin kontrolü vardır. Logo/stream/metadata/şarkı adı veya yeni depolama yoktur. Ülke/dil seçenekleri başlangıç listesiyle sınırlıdır; Dünya tüm ülkelerden arar. Örnek sağlayıcı yalnız izole UI test yardımı olarak korunur; ürünün varsayılanı gerçek katalogdur.

İki resmî endpoint HTTPS araştırma istemcisinde HTTP200/CORS* döndürdü: /json/servers ve TR limit3 is_https araması. Bu oynatma veya kullanıcının iPhone'u için kabul değildir. Sentetik browser route fixture gerçek API şemasını kullanır; onaysız0istek, izinli discovery/search, filtre, no stream, Core koruma ve sayfadan çıkınca izin geri alma sınanır. Node directory23/UI12 ve birleşik300, platform1161/Engine403/benchmark16/native15 PASS. Chromium14/14 PASS; yeni uzak CI sonucu PR #2'de SHA ile izlenir.

Sıradaki küçük iş: tek audio state manager ve açık oynat/durdur; önce sağlayıcı click bildirimi tercihini metin ve testlerle somutlaştır. Playlist/HLS/codec uyumluluğu ve yayın/logo kullanım hakları dağıtım öncesi kapıdır; açık API müzik/logo lisansı değildir. iPhone fiziksel kabulü yapılmadı; Apple Developer/native bildirim ertelemesi korunur.

### WebKit fixture hatası ve düzeltmesi

Runtime c4ac76d CI41126002787 üç başarılı job, browser27PASS/1FAIL verdi. İndirilen sentetik diagnostic artifact13009604800 ağ trace'i WebKit'in /json/servers ve filtresiz /json/stations/search isteğinde gerçek Radio Browser response/header/body aldığını gösterdi. page.route Service Worker yolunu yakalamamıştı; iki doğrulanabilir gerçek kayıt üç sabit fixture kaydı yerine geldi. Sağlık/geçmiş/Core notu aktarımı yoktu, yalnız boş arama ve limit/HTTPS alanları vardı.

Sadece Radio E2E describe'ı serviceWorkers:block kullanır; context.route tüm ağı kontrol eder, yerel uygulama isteklerini geçirir, Radio Browser için CORS* fixture döndürür, diğer tüm dış origin'leri abort eder. Böylece test canlı sunucuya bağlı değildir; diğer offline/SW testleri etkilenmez. Beklenen3kaydı2yaparak veya test atlayarak hata gizlenmedi. Ürün kodu/filtre ve sürüm bu düzeltmede değişmez. Yeni CI'da WebKit doğrulanmadan bu test engeli kapandı işaretlenmez.
