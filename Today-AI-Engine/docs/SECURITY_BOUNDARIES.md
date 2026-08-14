# Güvenlik ve Risk Sınırları

| Alan | İzin verilen | Yasak / yükseltme sınırı |
| --- | --- | --- |
| Sağlık | İhtiyatlı farkındalık ve profesyonel destek seçeneği | Teşhis, tedavi, kesin hüküm |
| Ruh sağlığı | Yargılamayan destek dili | Klinik tanı, kriz riskini küçümseme |
| Astroloji | Sembolik, olasılık dili | Bilimsel nedensellik veya kesin gelecek |
| Finans/hukuk | Genel bilgi ve uzman desteği seçeneği | Kişiye özel yüksek riskli kesin talimat |
| Dış işlemler | Onay bekleyen taslak | Onaysız gönderme, silme, planlama |
| Veri | Amaçla sınırlı minimum bağlam | Gizli veriyi gereksiz aktarma/eğitim |
| Onay | Amaç, zaman, kaynak ve veri sınıfı kapsamı | Başka amaçta tekrar kullanım, iptal sonrası kullanım |
| Çalışma ortamı | Cihaz-içi, istek-süreli saf dönüşüm | DOM/storage erişimi, ağ aktarımı, kalıcı Engine hafızası |
| Sky girdisi | Ayrı sembolik bağlam ve doğrulanmış sınır bayrakları | Sağlık/duygu nedeni, bilimsel kanıt, ham doğum/konum |
| Analiz | Yalnız sürümlü Context Package ve belgelenmiş dar deterministik kural | DOM/storage yeniden okuma, model sağlayıcısı, Sky dayanağı, eşleşmesiz çıkarım |
| Karar | Mevcut sözleşmeyle istek-süreli onay, ret ve yeniden onay isteyen düzenleme | Replay, otomatik onay, eylem yürütme, kalıcı audit veya kararın başka istekte kullanımı |

Yüksek risk sinyali algılanırsa otomatik eylem üretilmez; belirsizlik belirtilir ve uygun profesyonel/acil destek yolu hatırlatılır.

Geçersiz veya iptal edilmiş onayda Context Builder fail-closed davranır. `interpretation`, `causalityClaim` veya `aiProcessed` sınırını bozan Core–Sky kaydı tüm isteği kirletmeden gerekçeli olarak dışlanır.

NUT-017.3 analizörü yalnız `device-only`, `request-scoped`, `externalRecipient: null` Context Package kabul eder. Başarılı işlem taslağı dahi yürütülmez; approval gateway, audit writer ve Connect bu adımın kapsamı dışındadır.

NUT-017.3.1 eşleşmeme tanısı yalnız analiz isteği ve Context Package tamamen doğrulandıktan sonra oluşturulur. Geçersiz istekte gözlem veya gerekçe ayrıntısı döndürülmez. Sky değerlendirme tanısına alınmaz; tanı cihaz dışına aktarılmaz veya kalıcı tutulmaz.

NUT-017.4 karar işlemcisi yalnız `pending-user-approval` taslağını kabul eder. Düzenleme yeni onay bekleyen taslak üretir. Sonuçta `executionRequested`, `auditPersisted` ve `externalTransfer` değerleri `false` kalır; App köprüsü DOM, storage, ağ veya Connect çağırmaz.
