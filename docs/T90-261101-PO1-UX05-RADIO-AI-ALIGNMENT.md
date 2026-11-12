# PO1-UX05 — Radio ve AI yüzey hizalaması

11 Kasım 2026 (TSİ). Yerel dal `task/t90-261101-po1-ux05-radio-ai-alignment`; başlangıç SHA `b57dbceb53eb6a9aacc3bde709b4de096b77e38f`, App2.23.3/schema2/foundation-082. Kaynak `/workspace/Today-sky-alignment` ağacındaki22 dirty dosya ayrı worktree'ye kopyalandı; kaynak dal/ref/dosyalar korunur. Bu sunum dilimidir; yeni radyo veya AI özelliği değildir.

## Değişiklik ve veri sınırı

Tek üretim dosyası `index.html`, işaretli PO1-UX05 CSS bloğu:

- Radio üst başlığı ve Modüller düğmesi ortak orta eksende doğal dikey akışa gelir; başlık kırpılmaz.420px altında filtreler tek sütuna geçer.
- Radio eylem/form kontrolleri≥44px/1rem; yazılar/düğmeler sarılır. Yayıncı/dizin onay etiketleri≥44px, checkbox'ın kendisi mevcut boyutunda kalır. Native select'ler tema zemini/yazı ve color-scheme kullanır.
- Mevcut tek mini-player adı/durumu esnek yazı boyutuyla sarılır; eylemler44px ve kutuya sığar. İkinci mini-player, yeni host veya oynatma işleyicisi eklenmez.
- AI ana başlığı ortalanır; onay etiketleri≥44px, saat/select/button/summary alanları≥44px/1rem ve esnek genişliktedir. Kısa düğme satırları sarılır; açıklama/kanıt metinleri kırpılmadan akar. Temaya uyumlu select korunur.

Yeni overflow:hidden/clip veya sabit içerik yüksekliği eklenmez. Önceden var olan global clip kuralları bu görevde topluca değiştirilmez; her içerik kombinasyonunda sıçramasızlık/erişilebilirlik garantisi verilmez. Uzun izin/kanıt formlarının doğal dikey scroll'u sürer.

Kaynak Sky patch'ine göre6 dosyalı delta: `index.html`, `tests/static-regression.test.cjs` (yalnız denetlenen index hash), yeni `tests/e2e/radio-ai-alignment.spec.cjs`, bu rapor, changelog ve backlog. HTML/JS/metin/ID/event/route, Radio2.23.3 oynatma/tek player/dizin ve yayıncı izinleri, AI Engine/kanıt/onay, Core/Health/Sky, storage key/store/şema/migration, lockfile/SW/sürüm etiketleri aynı. AI içine mevcut bildirim tercih kontrollerinin sunumu da girer; native bildirim veya saat ertelemesi kaldırılmaz, davranış/izin/varsayılan tercihler değişmez. Favori/metaveri/hesap/dil veya yeni dış veri kaynağı eklenmez.

## Test kapsamı

İki yeni gerçek browser senaryosu/motor:

**Radio:** Sentetik katalog/yerel20sn sessiz MP3 ile izin öncesi durum, tek uzun isimli sonuç, yayıncı izni verilmeden ses başlamaması, gerçek HTMLAudio playing, modüllere geçişte tek mini-player ve pause/resume, Radio'ya dönüşte dizin izninin sıfırlanması/yeniden açık onay ve boş sonuç. Sayım ve tam sentetik istasyon adı fixture'ı doğrular. Audio kurucusu Proxy ile sayılır; oynatma taklit edilmez. Önceki gerçek medya/süreklilik testleri ayrıca tam pakettedir.

**AI:** Mevcut UI ile sentetik Core notu/seçimi ve düşük enerji/fazla yorgunluk/normal beden kaydı oluşturulur. Onay başlangıçta kapalıdır; açık onayla önizleme, gerçek kural tabanlı günlük öneri/açıklama, düzenleme saat alanı ve iptal,1 günlük gözlem sonucu ölçülür. Temizleme önizlemeyi kapatır ve onayı kaldırır. Otomatik öneri onayı/OS eylemi yoktur. Core gün verisi korunur ve dış istek yokluğu denetlenir.

Radio'da5 durum (boş başlangıç/sonuç/çalıyor/mini/boş arama), AI'da5 durum (onay/önizleme/açıklama/düzenleme/günlük gözlem) ×320/393/520px ×100/200% kök yazı ×3 tema =180 düzen/motor. Görünür kontrol ve checkbox etiketleri viewport içinde, en az44px yüksek ve kendi yatay içeriklerini kutularına sığdırır. Checkbox'ın18–20px görseli büyütülmeden etiketin dokunma alanı ölçülür. Bu bütün metin/diyagram/koşullu hata durumları için tam WCAG veya fiziksel cihaz kabulü değildir.

Radio sonuç/geçmiş izni ve AI veri onayı birbirine bağlanmaz. Radio favorileri veya dinleme geçmişi üretilmez; AI için gerçek Radio verisi kullanılmaz. Geçici sentetik profiller dışında kullanıcı verisine dokunulmaz.

## İlk hatalar ve test izolasyonu

İlk hedef **0PASS/4FAIL**. AI iki motorda18–21px onay etiketleri ve42px saat alanlarını bildirdi; bunlar scoped CSS ile düzeltildi. Radio testleri ise Service Worker bloke edildiğinde çıkan offline hata bildiriminin arama düğmesine tıklamayı örtmesi nedeniyle timeout verdi. Süre/beklenti gevşetilmedi ve force click kullanılmadı.

İkinci hedef **2PASS/2FAIL**: AI iki motorda geçti. Radio Chromium'da geri dönünce iznin devam edeceğini varsaydığı için başarısız oldu; ürün doğru şekilde dizin iznini sıfırlıyordu. Test yeniden açık onay verecek biçimde düzeltildi. WebKit'te Service Worker'a izin verilen ara kurulum ağ route taklidini atladı ve tek sentetik sonuç yerine canlı dizinden3 istasyon gösterdi; test bu noktada durdu, o istasyonların ses yayını başlatılmadı. Bu ara denemede arama ve kayıtlar sentetikti; not/sağlık bilgileri Radio istek parametrelerine eklenmez. Bu sonuç tam fixture izolasyonu kanıtı sayılmadı; loglar korunur.

Son Radio testi ayrı `serviceWorkers:block` describe bağlamında çalışır, beklenen offline uyarısı gerçek `Kapat` düğmesiyle kapatılır; AI normal SW bağlamında kalır. Bu ürün hatasını gizleyen DOM silme veya force click değildir; testin uygulamadığı offline capability uyarısı normal UI ile onaylanır. Katalog ve ses istekleri sentetik yanıtlarla karşılanır; exact station adı assertion'ı eklendi. İzole Radio hedefi **2/2 PASS** oldu. Son birleşik paket bütün senaryoları yeniden çalıştırır. İlk başarısızlıkların trace/log'ları silinmez.

Kanıt `/workspace/.cache/today-evidence/radio-ai-alignment-20261111`: baseline/second/radio target log ve exit JSON'ları, final platform/integration/browser logları, mini/Radio/AI görüntüleri ve bütünlük raporu. WebKit mini-player ve son tam koşunun Chromium AI görüntüleri görsel olarak incelendi. Linux WebKit iPhone profili gerçek iPhone15 Safari/kurulu PWA/Windows kabulü değildir. Native ses, medya geçici dosyası için scoped `/var/tmp` erişimiyle çalışır; dependency katalog precheck'i atlanır, browser/assertion'lar çalışır. Bağımsız Engine/benchmark değişmediğinden tekrar edilmez; eski403/16 yeni sonuç sayılmaz.

## Yetki ve sonraki iş

PR1/PR2 salt okunur yeniden kontrol edildi: açık/taslak/unmerged, SHA'lar `ede686d`/`b57dbce`. Mevcut CI1:41122504627 failure ve Radio CI2:41201384768 success; yeni yerel patch bunlarda yoktur. Commit/push/PR güncelleme/merge/deploy/CI rerun yapılmadı; canlı uygulama ve Netlify önizlemesi aynı. Kullanıcının yerel sınırı AGENTS'in geniş uzak güncelleme akışından önceliklidir.

Sonraki bağımsız öneri PO1-I18N01 dil altyapısı/kalıcı tercih tasarımıdır; bu görevde yeni dil veya anahtar eklenmez. Veri yedek/restore/kesinti/pilot kapıları ve fiziksel iPhone/PWA/Windows kabulü açık kalır. Model önerisi Sol Medium. Kullanım optimizasyonu: ilgili CSS/UI ile sınırlı inceleme, mevcut bağımlılıklar, kök nedenli hedefli testler ve son sürümde tek tam browser regresyonu. Model/kalan kredi yüzdesi iddiası yoktur.

## Nihai yerel sonuç

| Kapı | PASS | FAIL |
|---|---:|---:|
| Platform (`npm test`) |1161|0|
| AI/Radio entegrasyonu |335|0|
| Tek son tam Playwright (38 Chromium+38 WebKit) |76|0|
| Bütünlük |4|0|

Tüm son kapılar exit0. Yeni4 motor/senaryo kontrolü tam76'ya dahildir; hedefler ayrıca toplanmaz. Son tam koşuda iki motorda Radio exact sentetik isim/tek Audio/pause-resume/yeniden dizin onayı ve AI gerçek öneri/onay-temizleme/Core koruma/dış istek yokluğu geçti. Önceki medya/süreklilik ve diğer modül testleri de başarılıdır.

Son audit kaynak SHA/dal/22 dirty dosya ve eski refs'in korunduğunu, tam6 dosyalı deltayı ve boş staging/temiz whitespace'i doğrular. `css-only.json` index'in yeni scoped CSS dışındaki tüm içeriğinin kaynakla byte düzeyinde aynı olduğunu kanıtlar.

**Durum: PO1-UX05 listelenen Radio/AI yüzeylerinde yerel otomatik sunum kabulünü tamamladı.** Gerçek iPhone/PWA/Windows, tüm koşullu hata/örüntü varyasyonları ve tam veri/restore/pilot/yayın kabulü açık kalır. Sonraki öneri PO1-I18N01 tasarımı; bu oturumda başlatılmadı.
