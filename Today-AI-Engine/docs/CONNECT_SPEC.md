# Connect Sınırı

Connect, AI Engine'in parçası değil ayrı sistem adaptörüdür. Engine yalnızca `proposedActions` üretir.

Durum akışı:

`pending-user-approval` → `approved` veya `rejected` → (Connect) `executing` → `succeeded` / `failed`

Kullanıcı düzenlerse özgün taslak korunur, yeni sürüm oluşturulur ve tekrar açık onay istenir. Yetki kapsamı; servis, işlem türü, veri alanları ve süre ile sınırlanır ve geri alınabilir olur.

NUT-017.4 yalnız `approved`, `rejected` veya `edited` geçici kararını üretir. `approved` kararı Connect'e iletilmez; eylem yapılmış, planlanmış veya kaydedilmiş sayılmaz.

NUT-017.5 bu geçici karardan yalnız istek-süreli bir makbuz üretir. Makbuz Connect komutu, yürütme yetkisi veya tamamlanmış işlem kanıtı değildir ve Connect'e iletilmez.

NUT-017.6 çok günlük gözlemi eylem taslağı veya kullanıcı onayı üretmez. Gözlem Connect'e iletilmez ve hiçbir yürütme akışını başlatamaz.

NUT-017.7 örüntü geri bildirimi de Connect komutu veya eylem onayı değildir. Kullanıcının “uyuyor”, “uymuyor” veya “emin değilim” seçimi gözlemi değiştirmez, Connect'e iletilmez ve yürütme yetkisi oluşturmaz.

NUT-017.8 sentetik benchmark yalnız geliştirme kalite kapısıdır. Sentetik vaka veya rapor Connect'e iletilmez; değerlendirme sırasında `connectCalled=false`, `actionExecuted=false` ve `externalTransfer=false` zorunludur.

Bu sürümde Connect adaptörü ve gerçek dış işlem yoktur.
