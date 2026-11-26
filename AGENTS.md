# Today AI geliştirme protokolü

Onaylanmış görevleri ana görev envanterindeki öncelik ve bağımlılık sırasıyla yürüt. Mevcut dalı ve PR'yi kullan. Kodlama, test, CI hatalarının kök neden analizi ve onay kapsamındaki düzeltmeler için alt görev başına yeni talimat bekleme. Bir görev engellenirse bağımsız onaylı göreve geç. Aynı başarısız işlemi yeni kanıt olmadan tekrarlama.

Staging ortam onayı, fiziksel cihaz kabulü, yeni yetki, maliyet, güvenlik yapılandırması, ürün kapsamı değişikliği, main merge, canlı yayın ve otonom giderilemeyen kritik engeller ürün sahibine aittir. Mevcut kişisel veri, kalıcı şema, harici veri aktarımı ve üretim geri yüklemesi için geçerli ayrı onay kurallarını koru. Gerçek veriyi test profillerinde kullanma. AUTH01 ve AUTH01-BIO cihaz kabulü ile canlı onaylar ayrı kapılardır.

Önemli kilometre taşlarında tamamlanan işi, test sonuçlarını, açık riskleri, sıradaki uygun görevi ve gerekli kullanıcı işlemini kaydet. Staging doğrulamasında [işletim kaydına](docs/TODAY-STAGING.md), görev ve yayın durumunda [ana envantere](https://github.com/mtayfunturk-collab/Today/blob/task/today-master-inventory/docs/TODAY-CURRENT-STATUS.md) başvur. Canlı GitHub Pages kaynak dalı ayrı yayın kararıyla yönetilir.
