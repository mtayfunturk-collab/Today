# Canlı aday — kalıcı veri envanteri eşlemesi

12 Kasım 2026. Bu eşleme yalnız kaynak kod ve önceki T90-06 dışa aktarım sözleşmesinin isimlerini karşılaştırır; gerçek kullanıcı deposuna erişmez. Önceki `LS_KEYS` listesindeki **23/23 localStorage anahtarı** güncel Radio+Core/UX/I18N kaynaklarında ilgili sahibiyle eşleşir. Nutrition IndexedDB adı `today_nutrition`, sürüm1 ve 3 store (`records`, `metadata`, `migration_backups`) güncel kaynakta bulunur.

| Sahip | Anahtar sayısı | Kaynak |
|---|---:|---|
| Core canonical/backup ve app |3| `modules/storage.js`, `modules/state-manager.js` |
| Health su/yaşam/spor |9| `modules/health-hub.js` |
| Yerel AI bildirim deposu |1| `modules/notification-store.mjs` |
| Eski veri/migration uyumluluğu |10| `modules/migration.js` |
| **Toplam** |**23**| Kaynak literal eşleşmesi |

Bu kontrol dinamik anahtar keşfinin, dosya içeriğinin, yazıcı yarışının, tam dışa aktarımın veya geri yüklemenin kabulü değildir. Önceki exporter'ın 23 anahtarı kapsamı isim olarak güncel; kodu bu adayın üretim akışında yok. Yeni anahtar farkı görülürse eski export fail-closed `unregistered-data` davranışı korunmalıdır. Health, Core, Sky ve Radio verilerinin gerçek round-trip semantiği ayrıca doğrulanmalı.

**Sonraki adım:** Eski şifreli export'u yalnız salt okunur biçimde güncel adayda izole uygulama olarak uyarlayıp sentetik23 anahtar +3 store için dosya doğrulama ve readback kanıtı; restore ve UI ayrı kapı. Testler geçmeden canlıya çıkma.
