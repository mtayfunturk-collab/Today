# Today AI Staging işletim kaydı

## Dağıtım ve doğrulama

Today Staging, sentetik kabul için ayrılmış Cloudflare Pages projesidir. GitHub Actions'tan onaylı adayın tam SHA'sı ve aynı SHA'ya ait dört başarılı platform işiyle çalıştırılır. `staging` ortam onayı yükleme öncesinde zorunludur. Workflow ve paketleyici değişiklikleri ayrı `main` onayına tabidir.

Doğrulayıcı mevcut dağıtım adresini Cloudflare Pages API'sindeki `canonical_deployment` kaydından alır. Yüklemeden önce sabit ve güncel hash adresindeki Access koruması ile servis erişimini doğrular. Yükleme sonrası yeni dağıtım kimliğini, hash adresini ve SHA'yı aynı API'den alır. İki adreste de `/`, `/index.html`, `/sw.js` ve `/candidate.json` oturumsuz olarak bilinen Access girişine yönlendirmelidir. Ardından servis kimliğiyle alınan `candidate.json` ve `sw.js` onaylı paketin dosyalarıyla bayt düzeyinde eşleşmelidir. Yeşil doğrulama adımı ve Actions özetindeki adres, commit ve Worker sürümü tam doğrulamanın kanıtıdır. Yükleme sonrası doğrulama başarısızsa iş başarısız raporlanır ve yayımlanmış olabilecek adayın durumu incelenir. Yeniden yükleme veya geri alma ayrı onaylı işlemdir.

Önceki hash adreslerini elle güncellemek gerekmez. `CLOUDFLARE_STAGING_PREVIEW_URLS` yeni workflow tarafından okunmaz. Eski değişkenin kaldırılması gerekmez. Aday kodu GitHub runner'da yürütülmez. Workflow yalnız `today-ai-staging.pages.dev` projesini hedefler.

## Yeni servis erişimi için ürün sahibi onayı

Cloudflare Zero Trust'ta süreli **Today Staging CI** Service Token oluştur. Sabit Staging ve wildcard Staging Access uygulamalarına **Service Auth** kuralı ekle. **Include → Service Token** alanında yalnız bu token'ı seç. Mevcut ürün sahibi Allow kurallarını koru. Token'ı başka Access uygulamasına veya canlı hosta ekleme. Kimlik bilgilerini GitHub'daki yalnız `staging` ortamına `CLOUDFLARE_STAGING_ACCESS_CLIENT_ID` ve `CLOUDFLARE_STAGING_ACCESS_CLIENT_SECRET` secret'ları olarak gir. Mevcut Pages API token'ı ve hesap kimliği yükleme ve dağıtım metadatası için ayrı kalır. Service Token başlıkları yönlendirme takip edilmeden yalnız doğrulanan Staging adreslerine gönderilir. Servis erişimi eksikse iş yüklemeden önce durur. [Cloudflare Service Tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/)

## 26 Kasım 2026 — Worker 115

İlk otomatik Staging çalışması başarılı. Dağıtılan paket `9a2f07d069fa29e99dbbb8d4a4e1e9793ed49f38` ve `foundation-115` içeriyor. Sabit adres ve yeni hash adresinde sekiz oturumsuz isteğin tamamı Access'e yönlendi. Yayımlanan `candidate.json` için servis kimliğiyle içerik teyidi henüz yapılmadı. Fiziksel AUTH01 ve AUTH01-BIO kabulü açık. Canlı GitHub Pages kaynağı `4061839`. [Actions 45773111486](https://github.com/mtayfunturk-collab/Today/actions/runs/45773111486) · [Staging dağıtımı](https://61bf0577.today-ai-staging.pages.dev/) · [AUTH01 PR #50](https://github.com/mtayfunturk-collab/Today/pull/50)
