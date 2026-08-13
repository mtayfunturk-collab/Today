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

Yüksek risk sinyali algılanırsa otomatik eylem üretilmez; belirsizlik belirtilir ve uygun profesyonel/acil destek yolu hatırlatılır.

Geçersiz veya iptal edilmiş onayda Context Builder fail-closed davranır. `interpretation`, `causalityClaim` veya `aiProcessed` sınırını bozan Core–Sky kaydı tüm isteği kirletmeden gerekçeli olarak dışlanır.
