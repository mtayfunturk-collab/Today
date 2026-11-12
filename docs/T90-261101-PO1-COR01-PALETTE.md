# PO1-COR01 — Genişletilmiş Core renk paleti

10 Kasım 2026. Başlangıç SHA `b57dbceb53eb6a9aacc3bde709b4de096b77e38f`, App2.23.3/schema2/foundation-082; yerel dal `task/t90-261101-po1-cor01-palette`. Önceki Core not güveni patch'i `/workspace/Today-core-note-safety` kaynağından14 değişmiş dosyası korunarak ayrı worktree'ye kopyalandı. Mevcut canlı tasarım ve Radio oynatma mimarisi korunur. Bu dar görev yeni renklerdir; başka bağımsız geliştirmeye geçilmez.

## Değişiklik ve veri etkisi

Orijinal `navy/orange/red/blue/yellow/green/deep` kimlikleri, sıraları, adları ve hex değerleri aynen kalır. Sona5 seçenek eklenir:

| ID | Ad | Ton |
|---|---|---|
|pink|Pembe|#ed64a6|
|purple|Mor|#a78bfa|
|teal|Turkuaz|#14b8a6|
|mint|Nane|#a3e4b8|
|gray|Gri|#94a3b8|

Mevcut44px düğmeler,12 seçenekle240px palet alanında4×3 sarılır. Yeni seçeneklerin title/aria-label ve aria-pressed davranışı mevcut işleyici üzerinden çalışır. Her rengin vurgu eşlemesi ve takvim/özet/CSV için Türkçe renk etiketi eklenir. Renk seçimi isteğe bağlı kalır; psikolojik/sağlık anlamı veya AI kuralı atanmaz. Yeni renk seçmek dış bağlantı/izin açmaz.

Tek üretim dosyası `index.html`:5 CSS değişkeni,5 renk seçicisi,5 mevcut biçimde button, vurgu ve etiket haritalarına5'er giriş. Yeni DOM ID, kalıcı anahtar/store, şema, migration veya kayıt işleyicisi değişikliği yoktur. Onaylı ek seçenekler mevcut string `color` alanında kullanıcı seçimiyle saklanır; eski kayıtlar otomatik dönüştürülmez. Eski sürüme dönüşte yeni renk kimlikleri o sürümün görünümünde tanınmayabilir; tüm eski sürümlerin yeni tonları göstermesi vaat edilmez. Tam yedek/restore kabulünde yeni kimlikler de doğrulanmalıdır; T90-07/08 kapıları açık kalır.

Kaynak not güveni patch'ine göre7 dosyalı delta: `index.html`, `tests/static-regression.test.cjs` (yalnız index checksum), `tests/e2e/core-alignment.spec.cjs` (orijinal kimlikler+onaylı ekleri bekleyen envanter), yeni `tests/e2e/core-palette.spec.cjs`, bu rapor ve changelog/backlog; toplam **7** dosya. Router, not kaybı düzeltmesi, Health/Sky/Radio/AI, lockfile, depolama modülleri, SW ve sürüm etiketi aynıdır. Yeni seçenekler eski kalıcılık sözleşmesinin kabul ettiği string alanı kullanır; silent migration yoktur. Gerçek kullanıcı profiline dokunulmaz.

## Doğrulama kapsamı

İki yeni E2E senaryosu/motor:

-12 rengin her biri için erişilebilir adla seçim, tek aria-pressed seçimi, reload sonrası aynı ID/vurgu ve hem legacy hem v2 kayıtta rengin korunması; aynı sentetik notun ve anahtar envanterinin değişmemesi. Orijinal7 ton açık beklentiyle denetlenir.
-320px/200% yazıda dark/light/contrast temalarında üç sıra,44px hit alanları, yatay sığma, gerçek düğme dolgu rengi ve klavye Space/odak/selection. Pembe ve temalar için ekran görüntüleri.

Mevcut Core hizalama matrisi de12 düğmenin taşmasını ölçer. Önceki hızlı dönüş/not/gece yarısı/kota testleri korunur. Skip/retry/beklenti toleransı eklenmedi. Farklı beklenti yalnız bilerek7'den12'ye genişletilen palet envanteridir. Engine/benchmark kodu değişmediği için bağımsız paketler bu görevde yeniden çalıştırılmaz; eski403/16 yeni sonuç sayılmaz.

Kanıt `/workspace/.cache/today-evidence/core-palette-20261110`: başlangıç snapshot'ı, hedef/tam browser/platform/entegrasyon logları, exit JSON'ları, screenshot ve bütünlük raporu. Chromium ve Linux WebKit iPhone profili; gerçek iPhone15/Safari/kurulu PWA/Windows kabulü değildir. WebKit host katalog precheck'i atlanır, gerçek test/assertion çalışır; test süreçlerine scoped `/var/tmp` medya temp erişimi verilir. Bağımlılık kurulmadı/lockfile değiştirilmedi.

## Yetki ve devam

PR1/PR2 salt okunur yeniden kontrol edildi: açık/taslak/unmerged; başları `ede686d` ve `b57dbce`. Yeniden okunan eski CI1:41122504627 failure; Radio CI2:41201384768 success. Bu yerel patch uzak CI'da çalışmadı. Commit/push/PR güncelleme/merge/deploy/CI rerun yapılmadı; mevcut canlı uygulama/Netlify önizlemesi değişmedi. User'ın bu sınırı AGENTS'in geniş PR güncelleme akışından önceliklidir.

Sonraki bağımsız öneri PO1-UX03 — Health hizalaması; bu görevde başlanmaz. Yeni palette fiziksel iPhone kabulü ve tüm yedek/restore güven kapıları ayrıca gerekir. Model önerisi Sol Medium; model değiştirildiği iddia edilmez. Kullanım optimizasyonu: yalnız ilgili dosyalar, mevcut bağımlılıklar, önce hedefli sonra tek tam browser koşusu ve gerekli birleşik kapılar.

## Nihai yerel sonuç

| Kapı | PASS | FAIL |
|---|---:|---:|
| Hedefli palet (iki motor) |4|0|
| Platform (`npm test`) |1161|0|
| AI/Radio entegrasyonu |335|0|
| Tam Playwright (29 Chromium+29 WebKit) |58|0|
| Bütünlük denetimi |4|0|

Tüm son kapılarda exit0. Hedef4 test tam58'e dahildir; ayrıca toplanmaz. İlk başarısız ürün/test koşusu yoktur. Pembe seçili WebKit ekran görüntüsü görsel olarak incelendi. Kaynak14 dosya/HEAD/dal ve eski refs aynı; kaynak patch'ine göre tam7 dosyalı delta, boş staging/temiz whitespace. **PO1-COR01 yerel otomatik kabul tamamlandı.** Fiziksel iPhone/PWA/Windows, tam yedek/restore ve yayın kapıları açık kalır. Sonraki öneri PO1-UX03, henüz başlanmadı.
