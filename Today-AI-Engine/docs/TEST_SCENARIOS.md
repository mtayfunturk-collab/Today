# Sentetik Test Senaryoları

1. Geçerli Core + Health bağlamı: Uyku 5 saat ve Core C; hafif plan önerisi, iki gerçek kanıt, belirsizlik ve onay bekleyen taslak beklenir.
2. Eksik Health verisi: Uyku kanıtı ve buna dayalı öneri üretilmemelidir.
3. Yalnız Sky göstergesi: Sağlık veya psikoloji sonucu üretilmemelidir.
4. Onay yok: Eylem `pending-user-approval` dışında bir duruma geçmemelidir.
5. Kullanıcı reddi: Connect çağrısı olmadan `rejected` karar makbuzu beklenir.
6. Kullanıcı düzenlemesi: Yeni taslak ve yeni onay gerekir.
7. Teşhis dili: Politika kontrolü çıktıyı reddetmelidir.
8. Uydurma kanıt: Girdi olay kimliği bulunmayan evidence reddedilmelidir.
9. Bilinmeyen schemaVersion: Güvenli biçimde reddedilmeli, App verisi değiştirilmemelidir.
10. Hassas not: Bulut bağlamına varsayılan olarak dahil edilmemelidir.

## NUT-017.1 ek kapsamı

11. Amaç uyuşmazlığı, iptal edilmiş onay, gelecekte verilmiş onay ve bulut işleme talebi fail-closed reddedilir.
12. Olay sırası ters çevrildiğinde bağlam paketi byte-anlamlı olarak aynı kalır.
13. Core/Health notları, ayrıntılı antrenman alanları, kesin Sky konumu/timezone ve ham doğum profili pakete sızmaz.
14. `ai_draft` Nutrition kaydı yeni AI dayanağına çevrilmez.
15. Tekrarlı, pencere dışı, gelecekte oluşturulmuş ve kaynak limitini aşan olaylar gerekçeli omission üretir.
16. Core–Sky kaydı yalnız 10 gezegenli contract v1 şekli ve `interpretation=none`, `causalityClaim=false`, `aiProcessed=false` ile kabul edilir.
17. Sky yalnız `symbolicContext` bölümünde bulunur; `scientificEvidence=false` ve `causalityClaim=false` sabittir.
18. Runtime kaynaklarında DOM/depolama veya ağ çağrısı bulunmaz.

Sonuç: Foundation `10/10`, NUT-017.1 `41/41`; toplam `51 PASS / 0 FAIL`.

## NUT-017.3 ek kapsamı

19. Core `C` ve 330 dakika uyku birlikteyken iki provenance-bağlı dayanakla mevcut `analysis-output` v1 üretilir.
20. Uyku 360 dakika veya üstündeyse ya da Core seçimi `C` değilse `no-matching-rule` döner; çıktı uydurulmaz.
21. Context sırası veya sembolik Sky içeriği değiştiğinde analiz ve güven değeri değişmez.
22. Cihaz-dışı boundary, nedensellik iddialı sembolik bölüm ve gelecek zamanlı Context Package fail-closed reddedilir.
23. Çıktı belirsizlik, alternatifler, `requiresUserApproval=true` ve `pending-user-approval` taslağı taşır.
24. Analizör DOM, App depolaması, ağ, TodayAI/Connect veya sistem saatine erişmez.

Sonuç: Foundation `10/10`, NUT-017.1 `41/41`, NUT-017.3 `29/29`; toplam `80 PASS / 0 FAIL`.

## NUT-017.3.1 ek kapsamı

25. Uyku tam 360 dakika olduğunda tanı; Core koşulunu ve aynı tarih koşulunu başarılı, uyku eşiğini başarısız göstermelidir.
26. Core seçimi `C` değilse kontrollü `core-choice-not-hard-day` gerekçesi dönmelidir.
27. Uyku kaydı yoksa kontrollü `sleep-record-missing` gerekçesi dönmelidir.
28. Core ve uyku farklı yerel tarihlerdeyse `records-not-same-local-date` gerekçesi dönmelidir.
29. Geçersiz veya cihaz-dışı analiz isteğinde doğrulanmamış bağlam tanısı bulunmamalıdır.
30. App UI Core seçimini, uyku süresini, yerel tarih denetimini ve Türkçe eşleşmeme nedenini göstermelidir.

Sonuç: Foundation `10/10`, NUT-017.1 `41/41`, NUT-017.3.1 analiz/tanı `35/35`; toplam `86 PASS / 0 FAIL`. App kapısı `49/49` başarılıdır.

## NUT-017.3.2 host regresyon kapsamı

31 olaylık kaynak sınırı eski Health kayıtlarıyla dolmak üzereyken bugüne ait onaylı uyku olayı en yeni alt kümede korunmalıdır. Health public bağlam görünümü de kendi tür sınırında en yeni kayıtları seçmeli ve değişmez kopya döndürmelidir. Nihai olay dizisi sözleşme için kronolojik ve deterministik kalmalıdır.

Sonuç: AI Engine değişmeden `86 PASS / 0 FAIL`; NUT-017.3.2 App kapısı `50/50 PASS`.

## NUT-017.4 kullanıcı kararı kapsamı

31. Geçerli onay mevcut `approval-decision` v1 alanlarıyla `approved` geçici karar üretmeli; eylem yürütülmemelidir.
32. Ret `rejected` kararı üretmeli; yeni taslak veya dış işlem oluşturmamalıdır.
33. `22:30` saat düzenlemesi `edited` kararı ve yeni `pending-user-approval` taslağı üretmelidir.
34. Geçersiz saat, bilinmeyen alan, sonuçlanmış taslak ve sözleşme dışı karar fail-closed reddedilmelidir.
35. Karar işlemcisi ve App köprüsü DOM, storage, ağ, Connect, sistem saati veya kalıcı audit kullanmamalıdır.
36. UI onay, ret ve düzenleme sonrası yeniden onayı göstermeli; gerçek işlem yapılmadığını açıkça belirtmelidir.
37. UI dayanak, güven, belirsizlik, seçenek ve karar durumunu korurken olay kimliği, NUT/kural kodu veya filtre gerekçe kodu göstermemelidir.
38. Sky seçilmiş olsa bile dayanak, güven veya sağlık/duygu nedeni olmamalıdır.

Sonuç: Foundation `10/10`, NUT-017.1 `41/41`, NUT-017.3.1 analiz/tanı `35/35`, NUT-017.4 karar `28/28`; AI Engine toplam `114 PASS / 0 FAIL`. NUT-017.4 App kapısı `61/61 PASS`.

## NUT-017.5 karar makbuzu kapsamı

39. Onay, ret ve düzenleme sonuçları `decision-receipt` v1 sözleşmesine uygun, deterministik ve derin dondurulmuş olaylar üretmelidir.
40. Makbuz karar, analiz ve işlem taslağı kimliklerini tutarlı bağlamalı; değiştirilmiş veya uyuşmayan sonuçları fail-closed reddetmelidir.
41. Her makbuz yalnız cihazda ve mevcut istek için yaşamalı; kalıcılık, gerçek işlem, Connect, audit yazımı ve dış aktarım değerleri kapalı kalmalıdır.
42. Düzenleme makbuzu yeni işlem taslağını göstermeli ve bunun yeniden açık kullanıcı onayı istediğini belirtmelidir.
43. App'teki “Karar geçmişi” teknik kimlik veya kod göstermeden sade onay/ret/düzenleme cümleleri üretmelidir.
44. Yeni bağlam önizlemesi veya temizleme karar geçmişini sıfırlamalıdır.
45. Makbuz üreticisi DOM, App depolaması, ağ, Connect ve sistem saatine erişmemelidir.

Sonuç: Foundation `10/10`, NUT-017.1 `41/41`, NUT-017.3.1 analiz/tanı `35/35`, NUT-017.4 karar `28/28`, NUT-017.5 makbuz `31/31`; AI Engine toplam `145 PASS / 0 FAIL`. NUT-017.5 App kapısı `63/63 PASS`.

## NUT-017.6 çok günlük örüntü kapsamı

46. Tam 7 günlük pencerede 7 karşılaştırılabilir günün 3'ünde Core `C` + 6 saat altı uyku birlikteyse yalnız bu üç gün provenance-bağlı dayanak olmalıdır.
47. Üçten az karşılaştırılabilir gün varsa `insufficient-paired-days` dönmeli; gözlem uydurulmamalıdır.
48. Karşılaştırılabilir gün yeterli fakat iki tekrar yoksa `recurrence-not-observed` dönmelidir.
49. Tam 360 dakika uyku eşleşme sayılmamalıdır.
50. Aynı tarihte birden fazla Core/uyku kaydı varsa yalnız en güncel kayıt kullanılmalıdır.
51. Context sırası veya sembolik Sky içeriği değiştiğinde gözlem, dayanak ve güven değişmemelidir.
52. Çıktı dayanak, gözlem gücü, belirsizlik, seçenekler ve `not-required` onay durumunu taşımalıdır.
53. Nedensellik, teşhis, Sky kullanımı, eylem, Connect, dış aktarım, audit ve kalıcılık bayrakları kapalı olmalıdır.
54. App yetersiz veri veya tekrar bulunmamasını teknik kod göstermeden açıklamalı; başarılı gözlemde iç olay kimliklerini gizlemelidir.
55. Gözlemci ve App köprüsü DOM, storage, ağ, model sağlayıcısı, Connect veya sistem saatine doğrudan erişmemelidir.

Sonuç: Foundation `10/10`, NUT-017.1 `41/41`, NUT-017.3.1 analiz/tanı `35/35`, NUT-017.4 karar `28/28`, NUT-017.5 makbuz `31/31`, NUT-017.6 örüntü `40/40`; AI Engine toplam `185 PASS / 0 FAIL`. NUT-017.6 App kapısı `73/73 PASS`.

## NUT-017.7 örüntü geri bildirimi kapsamı

56. `resonates`, `does-not-resonate` ve `unsure` yanıtlarının her biri yalnız geçerli bir örüntü gözlemiyle kabul edilmelidir.
57. Makbuz geri bildirimi gerçek gözlem kimliğine bağlamalı; kullanıcı yanıtını ve açık etkileşim zamanını korumalıdır.
58. Nedensellik, teşhis, Sky, eylem, dış alıcı, kalıcılık, onay veya güven sınırı değiştirilmiş gözlem fail-closed reddedilmelidir.
59. Aynı geri bildirim isteği deterministik ve derin dondurulmuş sonuç vermelidir.
60. Gözlem/güven değişikliği, model güncellemesi, hafıza yazımı, eylem, Connect, kalıcı audit ve dış aktarım etkileri kapalı kalmalıdır.
61. İşlemci ve App köprüsü DOM, App storage, ağ, Connect veya sistem saatine doğrudan erişmemelidir.
62. App yalnız “Bana uyuyor”, “Bana uymuyor” ve “Emin değilim” seçeneklerini göstermeli; teknik kimlik veya kod göstermemelidir.
63. Kullanıcı son seçimini değiştirebilmeli; yeni önizleme veya temizleme geçici geri bildirimi sıfırlamalıdır.

Sonuç: Foundation `10/10`, NUT-017.1 `41/41`, NUT-017.3.1 analiz/tanı `35/35`, NUT-017.4 karar `28/28`, NUT-017.5 makbuz `31/31`, NUT-017.6 örüntü `40/40`, NUT-017.7 geri bildirim `47/47`; AI Engine toplam `232 PASS / 0 FAIL`. NUT-017.7 App kapısı `83/83 PASS`.

## NUT-017.8 sentetik benchmark kapsamı

64. Core `C` + 330 dakika uyku günlük analiz üretmeli; 360 dakika ve Core `B` vakaları kontrollü olarak sonuç üretmemelidir.
65. `externalTransfer=true` yapılmış bağlam günlük analiz tarafından fail-closed reddedilmelidir.
66. Üç karşılaştırılabilir gün ve iki tekrar taşıyan örüntü başarıyla gözlenmeli; yetersiz gün ve tekrar yokluğu ayrı kontrollü sonuçlar vermelidir.
67. Aynı Core/Health olaylarına sembolik Sky eklendiğinde örüntü çıktısı ve güven değeri değişmemelidir.
68. Üç kullanıcı geri bildirimi geçerli gözleme bağlanmalı; `causalityClaim=true` yapılmış gözlem reddedilmelidir.
69. Başarılı çıktılarda dayanak–provenance bağı, güven, belirsizlik, seçenek ve onay durumu bulunmalıdır.
70. Rapor ham olay kimliklerini taşımamalı; AI doğruluğu veya olasılık iddiası üretmemelidir.
71. Gerçek veri izni, dış alıcı, model sağlayıcısı, serbest metin, sentetik olmayan olay kimliği, bilinmeyen alan ve geçersiz pencere reddedilmelidir.
72. Vaka/veri/olay sırası değiştirilse de rapor deterministik olarak aynı kalmalıdır.
73. Değerlendirici DOM, storage, ağ, sistem saati, Connect veya audit writer kullanmamalı ve App çalışma zamanı kabuğuna eklenmemelidir.

Sonuç: NUT-017.8 değerlendirici `67/67`; AI Engine toplam `299 PASS / 0 FAIL`. Sentetik benchmark `12/12` vaka ve `0` güvenlik ihlali; NUT-017.8 Today entegrasyon kapısı `93/93 PASS`.
