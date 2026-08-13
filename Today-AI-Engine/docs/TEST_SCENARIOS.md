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
