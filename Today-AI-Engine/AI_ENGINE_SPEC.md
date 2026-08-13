# AI Engine Spesifikasyonu

## Çıktı ilkesi

Her anlamlı öneri; özet, öneri, kanıt, güven düzeyi, belirsizlik, alternatif ve onay gereksinimi taşır. Veri yoksa çıkarım yapılmaz. Confidence, modelin doğruluk garantisi değil; eldeki kanıtların kural kapsamındaki yeterlilik göstergesidir.

NUT-017.1 `context-package` bir AI önerisi değil, analiz öncesi veri-minimum girdidir. Buna rağmen onayın kimliğini/durumunu, her öğenin provenance bilgisini, dışlama/redaksiyon gerekçelerini ve Sky sınırını görünür taşır. Analiz hattının `analysis-output` sözleşmesindeki dayanak, güven, belirsizlik, seçenekler ve onay alanları değişmemiştir.

## İlk kural örneği

Koşullar:

- Core seçimi `C` (`Zordu bugün`)
- Uyku 6 saatin altında

Çıktı:

- Toparlanma ihtimalini ihtiyatlı dille belirt.
- Kısa/hafif akşam planını seçenek olarak sun.
- Core ve Health olaylarını ayrı kanıtlar olarak göster.
- İş yükünün ve zorunlulukların bilinmediğini yaz.
- Hatırlatıcıyı yalnızca taslak olarak üret.

## Yasak çıktılar

- Teşhis: “Depresyondasın”, “uyku bozukluğun var”.
- Kesin astrolojik hüküm: “Bugün kesin çatışacaksın”.
- Korkutma veya buyurganlık.
- Olmayan kayda atıf.
- Sky göstergesini tıbbi/psikolojik nedensellik olarak kullanma.
- Onay olmadan `approved`, `scheduled`, `sent` veya `completed` eylemi.
