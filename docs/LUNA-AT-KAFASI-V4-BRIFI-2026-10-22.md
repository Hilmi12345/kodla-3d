# Luna brifi — at kafası V4: ata benzeyen organik büst (22 Ekim 2026)

Yazan: Doku. İsteyen: Doğukan.

## Amaç

Organik at büstü Doğukan'ın gözünde hâlâ "baya kötü". 22.10'da V3 iki kez elle yeniden kurgulandı
(`models/organik-at-kafasi-v3.js`, önizleme DokuOS `🏰 300-Projects/Kodla-3D/V3-2026-10-22.png`). Teknik olarak temiz
(tek kapalı bileşen, düz taban, 114×39×160 mm), ama satranç atı / çizgi film gibi duruyor.

Kök neden model kodu değil, **araç seti**: organik API'de yalnız elipsoit, kapsül ve yumuşak birleşim var. Bunlarla kurulan her
yüzey "balon zinciri" gibi görünüyor; atın yandan düz yüzü, keskin burun sırtı, yanaktaki yassı disk, çene altı oluğu
çıkmıyor. 21.10 ölçümü: gerçek at fotoğrafı ↔ V3 yan siluet IoU **0,53**.

Hedef: (1) organik API'ye ata (ve genel organik parçalara) yetecek iki yeni şekil aracı, (2) bu araçlarla referans fotoğrafın
yan silüetinden kurulan V4, (3) sayıyla ölçülen benzerlik ve **Doğukan'ın onayı**.

## Okunacaklar (önce)

`AGENTS.md`, `docs/AI-KULLANIM.md`, `docs/ORGANIK-API-REFERANSI.md`, `docs/HTTP-API.md` (`/api/compare`, `/api/reference/contour`),
`docs/CHANGELOG-KODLA3D.md` (22.10 iki girdi), `src/organic-api.js`, `model-worker.mjs` (`tightOrganicBounds`),
`src/reference-contour.js`, `src/reference-compare.js`, `models/organik-at-kafasi-v3.js`.

Proje artık git altında (`main`, github.com/Hilmi12345/kodla-3d). Her adım ayrı commit; iş başında `git pull`.
Referans fotoğraf **repoda yok**, laptopta: `outputs/at-kafasi/referans.jpg`. Dışarı yükleme, commit etme.

## Bilinen tuzaklar (22.10'da yaşandı)

- **Sınır kutusu:** `yumusakBirlestir` her parça için kutu payı ekliyor; iç içe birleşimde kutu şişiyor. Worker artık
  kaba+ince alan taramasıyla gerçek kutuyu buluyor; yeni şekillerin `bounds`'u yine de doğru olmalı (taramadan büyük, gereksiz büyük değil).
- **Kutu elemesi:** yumuşak birleşim, noktanın `genislik` kadar dışında kaldığı parçayı hesaplamıyor. Bunun doğru olması için her
  alanın **1-Lipschitz'e yakın** olması gerekir (gerçek mesafeden daha "yakın" değer döndürmemeli). Yeni şekiller bunu sağlamalı.
- **Süre:** worker 60 sn'de keser. V3 normal kalite 42 sn. Alan değerlendirmesi pahalı olursa normal kalite düşer.
- **Bütçe:** normal kalite ≈ 4M hücre (BCC ızgara, ×2). ~115×40×160 mm sığar; daha geniş kaide/yele bütçeyi aşar.
- **Eşit olmayan ölçek** (`olcek: [s, s*0.8, s]`) mesafeyi bozar; V3'teki enine sıkıştırma kaldırıldı, tekrar ekleme.
- Göz için `burunDeligi` (oyuk) kullanma; göz kabartma + çukur ister.

## İşler (sırayla; her biri ayrı kabul edilir)

### H1 — Kesit zinciri (organik loft)
Yeni API: `kesitZinciri({ id, ad, noktalar:[[x,y,z]...], kesitler:[{rx, ry, aci?}...], yumusaklik? })`.
Merkez eğrisi Catmull-Rom; her noktada eğriye dik eliptik kesit (rx yanal, ry dikey; `aci` eğri ekseni etrafında dönüş),
kesitler arası yumuşak geçiş. Boyun, burun sırtı, kulak ve yele bununla tek parça kurulabilmeli (balon zinciri yerine).
Alan: en yakın eğri parametresine göre yerel eliptik mesafe; 1-Lipschitz'i aşmayacak şekilde ölçekle (gerekirse min yarıçapa böl).
**Kabul:** (a) iki noktalı, sabit dairesel kesitli zincir, aynı `kapsul` ile her örnek noktada ±0,05 mm aynı alan;
(b) 10.000 rastgele nokta çiftinde |f(a)−f(b)| ≤ 1,02·|a−b|; (c) S eğrili, değişken kesitli test şekli normal kalitede
tek kapalı bileşen; (d) `verify:organic-loft` betiği.

### H2 — Siluet hacmi (yan profilden kalınlaştırma)
Yeni API: `siluetHacmi({ id, ad, kontur:[[x,z]...], kalinlik:[[x,z,yariKalinlik]...] | fonksiyon, yuvarlama })`.
XZ düzlemindeki kapalı 2B konturun işaretli mesafesi × Y'de yarı kalınlık (konum bağımlı, örnekten enterpolasyon),
kenarlar `yuvarlama` mm ile yumuşatılır. Kontur `referansProfili({yon:'yan'})` / `/api/reference/contour` çıktısını doğrudan alır.
Bu, yan silueti birebir tutturmanın yolu: atın yandan görünüşü fotoğraftan, enine kalınlık kesit tablosundan gelir.
**Kabul:** (a) 80×50 dikdörtgen kontur + sabit 10 mm yarı kalınlık → 80×20×50 kutuya ±0,5 mm, köşeler `yuvarlama` kadar yuvarlak;
(b) kendi konturundan üretilen şeklin yan IoU'su ≥ 0,98; (c) Lipschitz testi H1'deki gibi.

### H3 — Referanstan V4
`models/organik-at-kafasi-v4.js` (+ parametre şeması). V3 dosyasına dokunma; örnek listesine "At kafası · organik V4" ekle.
Kurgu: **gövde = siluetHacmi** (yan kontur referanstan, kalınlık tablosu: kulak dibi ~30, alın ~34, yanak ~38, burun sırtı ~24,
burun ucu ~28, boyun tabanı ~36 mm; oranları fotoğraftaki ön görünüşe/anatomiye göre ayarla), üstüne ayrıntı:
yanak (ganaş) diski, göz kabartması + göz kapağı (`gozKapagi`), burun deliği (açık yarık, öne bakan), çene altı oluğu,
ağız çizgisi (`dudakCizgisi`), kulaklar (H1, içi oyuk), yele (H1 + `yeleTutami` ile 6–10 tutam). Kaide düz tabanlı (z=0), V3'teki gibi.
Anatomi kontrol listesi (yan görünüş): ense en yüksek nokta, alın→burun düz ya da hafif dışbükey, göz enseden kafa boyunun ~1/3'ünde,
yanak kafanın en derin yeri, çene altından gırtlağa belirgin girinti, boyun üst çizgisi (kavis) ve gırtlak çizgisi ayrı.
**Kabul:** yan IoU ≥ 0,85 (V3: 0,53), ön görünüşte kafa genişliği/uzunluğu oranı 0,35–0,45; normal kalite tek kapalı bileşen,
taban düz, yükseklik 160 ± 0,5 mm, üretim < 45 sn.

### H4 — Hız
Normal kalite 45 sn altında kalmazsa: alan değerlendirmesini hızlandır (nokta dizileri yerine skaler aritmetik, parça başına
kutu elemesi H1/H2 içinde de, gerekirse kaba ızgarada ön-eleme). Şekli değiştirmeden ölç: önce/sonra aynı STL hacmi (±%0,1).
**Kabul:** V3 ve V4 normal kalite süreleri `docs/BASELINE.md`'ye; V4 < 45 sn.

### H5 — Regresyon testi
`scripts/verify-horse-v4.mjs` → `verify:horse-v4`: tek kapalı bileşen, açık/non-manifold kenar 0, yükseklik 160 ± 0,5,
taban düzlüğü (z < 0,2 mm üçgenlerin alanı ≥ kaide izdüşümünün %80'i), süre bütçesi. Referans fotoğrafı yoksa IoU adımı atlanır
ve bunu yazar (temiz klonda çökmez; 22.10'da `verify:horse-v2` bu yüzden çöküyordu).

### H6 — Gözden geçirme paketi ve onay kapısı
`outputs/at-kafasi-v4/`: altı görünüş PNG, yan referans bindirmesi (`overlayPng`), IoU yineleme seyri, STL.
Doğukan'a bu paketi göster. **Doğukan "oldu" demeden V4'ü bitti sayma**; geri bildirimi H3'e dön, yinelemeyi changelog'a yaz.

## Sınırlar ve yapılmayacaklar

- Image-to-3D / ML model yok; referans fotoğraf yerelde kalır.
- Mevcut `verify:*` (21 adet) her adımdan sonra geçmeli; V1/V2/V3 örnekleri ve önbellek davranışı bozulmamalı.
- Kalınlık tablosu tek fotoğraftan tahmindir; raporda "derinlik tahmini" diye yaz. Fiziksel baskı bu brifin kapsamı dışında.
- IoU tek ölçü değil: yüksek IoU ama "ata benzemiyor" mümkün. Son söz Doğukan'da.

## Teslim

Her H için: değişen dosyalar, test betiği, ölçüm, `CHANGELOG-KODLA3D.md` girdisi, ayrı commit. Görmeden "güzel oldu" yazma;
altı görünüşü ve bindirmeyi kendin aç, sonra raporla.
