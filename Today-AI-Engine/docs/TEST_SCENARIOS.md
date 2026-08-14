# Sentetik Test Senaryoları

1. Geçerli Core + Health bağlamı: Uyku 5 saat ve Core C; hafif plan önerisi, iki gerçek kanıt, belirsizlik ve onay bekleyen taslak beklenir.
2. Eksik Health verisi: Uyku kanıtı ve buna dayalı öneri üretilmemelidir.
3. Yalnız Sky göstergesi: Sağlık veya psikoloji sonucu üretilmemelidir.
4. Onay yok: Eylem `pending-user-approval` dışında bir duruma geçmemelidir.
5. Kullanıcı reddi: Connect çağrısı olmadan `rejected` audit olayı beklenir.
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
