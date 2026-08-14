# Connect Sınırı

Connect, AI Engine'in parçası değil ayrı sistem adaptörüdür. Engine yalnızca `proposedActions` üretir.

Durum akışı:

`pending-user-approval` → `approved` veya `rejected` → (Connect) `executing` → `succeeded` / `failed`

Kullanıcı düzenlerse özgün taslak korunur, yeni sürüm oluşturulur ve tekrar açık onay istenir. Yetki kapsamı; servis, işlem türü, veri alanları ve süre ile sınırlanır ve geri alınabilir olur.

NUT-017.4 yalnız `approved`, `rejected` veya `edited` geçici kararını üretir. `approved` kararı Connect'e iletilmez; eylem yapılmış, planlanmış veya kaydedilmiş sayılmaz.

NUT-017.5 bu geçici karardan yalnız istek-süreli bir makbuz üretir. Makbuz Connect komutu, yürütme yetkisi veya tamamlanmış işlem kanıtı değildir ve Connect'e iletilmez.

Bu sürümde Connect adaptörü ve gerçek dış işlem yoktur.
