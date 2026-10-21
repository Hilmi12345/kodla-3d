# Organik API referansı

Bu dosya `src/api-schema.js` kaynağından üretilir.

- Organik API sürümü: **1**
- Model sonuç sözleşmesi: **1**
- Koordinatlar ve ölçüler: **mm**; açı: **derece**.
- Model kodu `return model;` ile bir `OrganikParca` döndürür.

| Komut | Kullanım |
|---|---|
| `kure({id?, ad?, merkez?, yaricap?})` | Analitik signed-distance küresi üretir. |
| `elipsoid({id?, ad?, merkez?, yariCaplar?})` | Yaklaşık signed-distance elipsoidi üretir. |
| `kapsul({id?, ad?, baslangic, bitis, yaricap?, baslangicYaricapi?, bitisYaricapi?})` | Sabit veya değişken yarıçaplı tüp/kapsül üretir. |
| `kesitZinciri({id?, ad?, noktalar, kesitler, yumusaklik?})` | Catmull-Rom merkez eğrisi boyunca değişken eliptik kesitli organik hacim üretir. |
| `yumusakBirlestir({ad?, parcalar, genislik?})` | Parçaları gerçek SDF smooth union ile birleştirir. |
| `yumusakCikar({ad?, ana, kesici, genislik?})` | Ana hacimden kesiciyi yumuşak SDF farkıyla çıkarır. |
| `grup({id?, ad?, parcalar})` | Parçaları mantıksal grupta toplar. |
| `gorunum({parca, gorunur?, kilitli?})` | Parça görünürlüğünü veya kilidini ayarlar. |
| `tasi({parca, x?, y?, z?})` | Parçayı global mm eksenlerinde taşır. |
| `donustur({parca, tasima?, olcek?, aci?, pivot?})` | Ölçek → derece cinsinden döndürme → taşıma uygular. |
| `simetrik({parca, duzlem?, konum?, id?, ad?})` | YZ/XZ/XY düzleminde yansıma kopyası oluşturur. |
| `parcaBul({parca, id})` | Parça ağacında ID ile parça bulur. |
| `parcaDegistir({parca, id, yeniParca})` | Gruptaki tek hedefi yeniler; kardeşleri korur. |
| `bolgeselSekillendir({parca, merkez, yaricap?, derinlik?, islem?, yon?})` | Compact-cubic falloff ile yerel alan deformasyonu yapar. |
| `egriDetayi({hedef, noktalar, yaricap?, yaricaplar?, etki?, genislik?, ad?})` | Eğri boyunca gerçek kabartma veya oyuk geometrisi ekler. |
| `gozKapagi({hedef, noktalar, yaricap?, genislik?, ad?})` | Kabartmalı göz kapağı eğrisi üretir. |
| `dudakCizgisi({hedef, noktalar, yaricap?, genislik?, ad?})` | Oyuk dudak çizgisi üretir. |
| `yeleTutami({hedef, noktalar, yaricap?, yaricaplar?, genislik?, ad?})` | Değişken kalınlıklı yele tutamı kabartır. |
| `burunDeligi({hedef, merkez, yariCaplar?, genislik?, ad?})` | Elipsoidal burun çukuru çıkarır. |

Tam örnekler ve hata sınırları: [AI-KULLANIM.md](./AI-KULLANIM.md). Geometri ve baskı sınırları açıklanan prototip kısıtlarıdır.
