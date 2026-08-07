# Today App — NUT-013 Uygulama Kaydı

## İş paketi
**NUT-013 — Health Information Architecture Refactor**

## Amaç
Health giriş ekranını Today Modül Merkezi ile aynı sade mantığa taşımak:

- Spor
- Beslenme
- Sağlık

Mevcut NUT-001–012 beslenme işlevleri silinmez veya yeniden yazılmaz. Beslenme arayüzü `Health > Beslenme` alt alanına taşınır.

## Görsel/viewport kabulü
- Yatay taşma olmamalı.
- Health ekranı viewport genişliğini aşmamalı.
- Safe-area boşlukları korunmalı.
- Ana Health ekranı üstten sabit hizalı olmalı; görünüm değiştirirken dikey merkezleme kaynaklı sıçrama olmamalı.
- Uzun Beslenme içeriği normal dikey kaydırma ile erişilebilir kalmalı.

## Alt modüller
### Spor
NUT-013 yalnız mimari giriş yüzeyini açar. İşlevler sonraki paketlerde geliştirilecektir.

### Beslenme
Mevcut öğün, su, kütüphane, tarif, plan ve geçmiş akışları korunur.

### Sağlık
NUT-013 yalnız mimari giriş yüzeyini açar. Uyku, enerji, semptom ve beden notları sonraki paketlerde geliştirilecektir.

## Çalışma zamanı API
`window.TodayHealthHub`

- `API_VERSION = 1`
- `RULESET_ID = today:health:hub:v1`
- `init()`
- `showSection(section)`
- `getState()`

## Entegrasyon
`modules/health-hub.js` dosyası `nutrition-library-ui.js` sonrasında ve `router.js` öncesinde yüklenmelidir.

Önerilen sıra:

```html
<script src="./modules/nutrition-ui.js"></script>
<script src="./modules/nutrition-consumption-editor.js"></script>
<script src="./modules/nutrition-library-ui.js"></script>
<script src="./modules/health-hub.js"></script>
<script src="./modules/router.js"></script>
```

Service Worker APP_SHELL listesine `./modules/health-hub.js` eklenmeli ve cache sürümü bir kademe artırılmalıdır.

## Commit kuralı
NUT-013 tek paket / tek commit / tek deploy olarak uygulanmalıdır.
