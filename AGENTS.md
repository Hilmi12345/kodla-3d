# Kodla 3D

Önce `docs/AI-KULLANIM.md` ve `docs/FIKIR.md` dosyalarını oku. Dil Türkçe, ölçüler mm. Aktif motor Replicad/OpenCascade WASM; kod dili JavaScript.

Model üretirken `models/` örneklerinden başla. Kısa komutlar `src/model-api.js` içinde. Sonucu `return model;` ile döndür. İleri tasarımda `replicad` nesnesi kullanılabilir. Parametreleri başta tanımla; geometriyi küçük adımlarla geliştir.

Yerel `POST /api/build` ile üret; dönen ölçüleri ve hata ayrıntısını değerlendir. Görseli görmeden görsel kaliteyi doğruladığını söyleme. Katı geçerliliği baskı dayanımı kanıtı değildir. Kalıcı kaynak `.js` dosyasıdır; `.runtime/runs` geçicidir.

`npm start`: sunucu, `npm run build`: arayüz derlemesi, `Baslat.cmd`: tek tık açılış. `experimental/cadquery/` başarısı doğrulanmamış eski Python denemesidir; aktif uygulamada kullanılmaz. `vendor/` inceleme kaynağıdır; çalışan motor npm paketlerinden yüklenir.
