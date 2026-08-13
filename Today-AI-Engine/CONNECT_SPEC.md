# Connect Sınırı

Connect, AI Engine'in parçası değil ayrı sistem adaptörüdür. Engine yalnızca `proposedActions` üretir.

Durum akışı:

`pending-user-approval` → `approved` veya `rejected` → (Connect) `executing` → `succeeded` / `failed`

Kullanıcı düzenlerse özgün taslak korunur, yeni sürüm oluşturulur ve tekrar açık onay istenir. Yetki kapsamı; servis, işlem türü, veri alanları ve süre ile sınırlanır ve geri alınabilir olur.

Bu sürümde Connect adaptörü ve gerçek dış işlem yoktur.

