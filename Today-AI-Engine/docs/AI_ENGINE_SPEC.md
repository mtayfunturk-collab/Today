# AI Engine Spesifikasyonu

## Çıktı ilkesi

Her anlamlı öneri; özet, öneri, kanıt, güven düzeyi, belirsizlik, alternatif ve onay gereksinimi taşır. Veri yoksa çıkarım yapılmaz. Confidence, modelin doğruluk garantisi değil; eldeki kanıtların kural kapsamındaki yeterlilik göstergesidir.

NUT-017.1 `context-package` bir AI önerisi değil, analiz öncesi veri-minimum girdidir. Buna rağmen onayın kimliğini/durumunu, her öğenin provenance bilgisini, dışlama/redaksiyon gerekçelerini ve Sky sınırını görünür taşır. Analiz hattının `analysis-output` sözleşmesindeki dayanak, güven, belirsizlik, seçenekler ve onay alanları değişmemiştir.

## NUT-017.3 ilk kuralı

Koşullar:

- Aynı yerel gündeki en güncel Core seçimi `C` (`Zordu bugün`)
- Aynı yerel gündeki en güncel uyku kaydı 6 saatin altında

Çıktı:

- Toparlanma ihtimalini ihtiyatlı dille belirt.
- Kısa/hafif akşam planını seçenek olarak sun.
- Core ve Health olaylarını ayrı kanıtlar olarak göster.
- İş yükünün ve zorunlulukların bilinmediğini yaz.
- Hatırlatıcıyı yalnızca taslak olarak üret.

Bu kural NUT-017.3'te `daily-support-analyzer.mjs` içinde saf ve deterministik olarak uygulanmıştır. İki koşul birlikte bulunmuyorsa `no-matching-rule` döner ve öneri uydurulmaz. Confidence sabit kuralın seçili iki dayanağı kapsama göstergesidir; doğruluk olasılığı veya sağlık skoru değildir.

NUT-017.3.1, kuralı değiştirmeden `no-matching-rule` sonucuna güvenli `ruleEvaluation` tanısı ekler. Tanı; seçilen en güncel Core seçimini, uyku süresini, iki yerel tarihi ve her koşulun geçip geçmediğini gösterir. Geçersiz analiz isteğinde bu alan üretilmez. Tanı bir AI önerisi, teşhis, örüntü öğrenimi veya güven puanı değildir.

Sky Context Package içinde bulunabilir ancak analizör Sky bölümünü okumadan Core ve Health adaylarını ayrı seçer. Sky hiçbir `evidence` kaydı, güven girdisi, sağlık/duygu açıklaması veya nedensellik iddiası üretemez.

## NUT-017.4 kullanıcı kararı

Başarılı analiz çıktısındaki ilk işlem taslağı yalnız `pending-user-approval` durumunda karar katmanına verilir. Kullanıcı:

- Onaylarsa `approval-decision` v1 içinde `approved` kararı oluşur.
- Reddederse `rejected` kararı oluşur ve işlem yapılmaz.
- Hatırlatma saatini düzenlerse `edited` kararı ile yeni bir `pending-user-approval` taslağı oluşur; yeniden açık onay gerekir.

Karar işlemcisi eylemi yürütmez ve kalıcı audit yazmaz. Kullanıcı arayüzü olay kimliklerini veya kural kodlarını göstermez; dayanak metnini, anlaşılır güven düzeyini, belirsizlikleri, diğer seçenekleri ve karar durumunu gösterir. Sayısal confidence ve provenance-bağlı olay kimlikleri denetlenebilir iç sözleşmede korunur.

## NUT-017.5 karar makbuzu

Başarılı kullanıcı kararı, `decision-receipt` v1 sözleşmesine bağlı bir `user-decision-recorded` olayı üretir. Makbuz karar, analiz ve işlem taslağı kimliklerini birbirine bağlar; zamanı karar sözleşmesindeki `decidedAt` alanından alır ve sistem saatine erişmez.

Makbuzun kapsamı sabittir: yalnız cihazda, yalnız mevcut istek için ve kalıcı değildir. `actionExecuted`, `connectCalled`, `auditPersisted` ve `externalTransfer` her zaman `false` kalır. Düzenleme makbuzu yeni taslağın yeniden kullanıcı onayı istediğini ayrıca belirtir.

App, makbuzları teknik kimlikler olmadan “Karar geçmişi” altında sade cümlelerle gösterir. Bu liste yeni bağlam önizlemesinde, temizlemede veya sayfa yenilendiğinde sıfırlanır. NUT-017.5 foundation audit writer'ı yeniden kurmaz ve gelecekteki kalıcı audit hattı yerine geçmez.

## NUT-017.6 çok günlük örüntü gözlemi

`core-sleep-recurrence` capability'si yalnız yedi günlük, onaylı ve istek-süreli Context Package üzerinde çalışır. Her yerel gün için en güncel Core günlük seçimi ile en güncel geçerli uyku kaydı eşleştirilir. En az üç karşılaştırılabilir gün ve bunların en az ikisinde Core `C` ile 360 dakikanın altındaki uykunun birlikte görülmesi gerekir. Eşik karşılanmazsa örüntü uydurulmaz.

Başarılı `pattern-observation-output` v1 şunları zorunlu taşır:

- eşleşen her gün için provenance-bağlı Core ve Health dayanakları;
- pencere kapsamı ve tekrar oranına dayalı, doğruluk olasılığı olmayan gözlem gücü;
- nedensellik, eksik bağlam ve kısa pencere belirsizlikleri;
- kullanıcı seçenekleri;
- `approval.required=false`, `status=not-required` onay durumu;
- `causalityClaim=false`, `diagnosis=false`, `skyUsed=false` ve `actionProposed=false` sınırları.

Bu çıktı bir teşhis, öğrenilmiş kişisel model, gelecek tahmini veya “uyku zor güne neden oldu” iddiası değildir. Yalnız seçilen kayıtlarda iki durumun aynı günlerde tekrarlandığını betimler. Gözlem App belleğinde mevcut istek boyunca yaşar; karar makbuzu, Connect veya kalıcı audit üretmez.

## NUT-017.7 kullanıcı doğrulaması

Başarılı yedi günlük gözlemden sonra kullanıcı yalnız şu yanıtları verebilir:

- Bana uyuyor (`resonates`)
- Bana uymuyor (`does-not-resonate`)
- Emin değilim (`unsure`)

`pattern-feedback-processor.mjs` yanıtı yalnız geçerli ve değiştirilmemiş `pattern-observation-output` v1 ile kabul eder. Sonuç gözleme bağlı, sürümlü ve istek-süreli bir geri bildirim makbuzudur. Bu kayıt gözlemin dayanak, güven, belirsizlik, seçenek veya onay durumunu değiştirmez; yeni bir AI çıktısı ya da doğruluk etiketi üretmez.

App yalnız seçenekleri ve son seçimin alındığını gösterir. Teknik kimlikler görünmez. Seçim yeni önizleme, temizleme veya sayfa yenileme ile düşer; model öğrenmesi, kişisel profil, kalıcı hafıza, audit, Connect, dış aktarım veya işlem başlatmaz.

## Yasak çıktılar

- Teşhis: “Depresyondasın”, “uyku bozukluğun var”.
- Kesin astrolojik hüküm: “Bugün kesin çatışacaksın”.
- Korkutma veya buyurganlık.
- Olmayan kayda atıf.
- Sky göstergesini tıbbi/psikolojik nedensellik olarak kullanma.
- Onay olmadan `approved`, `scheduled`, `sent` veya `completed` eylemi.
- Düzenlemeyi otomatik onay sayma veya onay kararını gerçek eylem yapılmış gibi sunma.
- Geçici karar makbuzunu kalıcı audit, Connect çağrısı veya tamamlanmış işlem gibi sunma.
- Birlikte görülen Core–uyku kayıtlarını nedensellik, teşhis veya kişilik hükmü gibi sunma.
- Kullanıcı geri bildirimini öğrenilmiş gerçek, gözlemin doğruluğu, kalıcı tercih veya sonraki çıktıları değiştiren model eğitimi gibi sunma.
