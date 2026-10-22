# Kodla 3D geliştirme günlüğü

### 2026-10-22 · Luna V4 H1 — organik kesit zinciri

- `src/organic-api.js`: `kesitZinciri` eklendi. Catmull–Rom merkez eğrisi, değişken döndürülmüş eliptik kesitler ve kesit arası geçişleri örneklenmiş 1-Lipschitz alanların birleşimiyle üretir. İki eş dairesel kesitte kapsül alanını tam kullanır. API şeması, worker erişimi ve kullanım belgesi güncellendi.
- Yeni test: `scripts/verify-organic-loft.mjs` / `verify:organic-loft`; sabit kapsül alanı farkı, 10.000 rastgele Lipschitz çifti ve değişken kesitli S eğrisinin normal kalite kapalı mesh üretimini ölçer.
- Temiz klon regresyonunda `verify:exchange-reopen` mevcut `outputs/at-kafasi-v2` dosyalarına bağlandığı için başarısızdı. İzole wrapper artık bu fixture'ı geçici output kökünde kuruyor; doğrulayıcı da `KODLA3D_OUTPUT_ROOT` kullanıyor. Üretim çıktısı değiştirilmez.
- Ölçüm: kapsül farkı 0 mm; 10.000 çiftte en yüksek Lipschitz oranı 0,9614; S loft 1 kapalı bileşen, 17.008 üçgen, worker 2.240 ms. H1 sonrasında 22/22 `verify:*` geçti.

### 2026-10-22 · Luna V4 H2 — yan siluetten hacim

- `src/organic-api.js`: `siluetHacmi` kapalı XZ konturunu değişken Y yarı kalınlığına dönüştürür. Tablo girdisi sabit eğim sınırıyla 1-Lipschitz uzatılır; fonksiyon girdisi 24×24 hücrede örneklenip eğim normalize edilir. Yuvarlama pozitif alan kesişimini smooth-min ile yumuşatır. API şeması, worker ve kullanım belgeleri güncellendi.
- Yeni test: `scripts/verify-organic-silhouette.mjs` / `verify:organic-silhouette`; 80×50×20 mm sentetik kutu, ölçü, 10.000 Lipschitz çifti, kendi konturuyla yan IoU ve kapalı mesh'i denetler.
- Ölçüm: sentetik kutu 80×20×50 mm; 1 kapalı bileşen, 78.448 üçgen; 10.000 çifte en yüksek Lipschitz oranı 0,9682; kendi kontur IoU 1,000; worker 2.252 ms. Gerçek fotoğraf mevcut olmadığından bu test fotoğraf benzerliği ölçmez.

### 2026-10-22 · Luna V4 H3 — ayrı organik at modeli

- `models/organik-at-kafasi-v4.js` ve parametre şeması eklendi; V3 korunuyor. Gövde yan profili `siluetHacmi`; yanak, kabartmalı göz/kapak, öne açık burun yarığı, ağız/çene çizgileri, içi oyuk kulaklar, H1 yele ana kütlesi ve 8 yele tutamı eklendi. Taban siluetinde z=0 düz hat.
- `/api/examples` dosyayı otomatik listeler; UI adı, referans paneli ve at kamera yönleri V4'ü tanıyor. Hedef kontur fotoğraf yokluğunda elle çizilmiş geçici profildir; derinlik tahmindir, fotoğraf IoU'su veya görsel kabul iddiası yoktur.
- Yeni test: `scripts/verify-horse-v4.mjs` / `verify:horse-v4`; tek kapalı mesh, 160 mm yükseklik, kafa ön oranı ve altı görünüş PNG'sini ölçer. H4'te 45 sn süre eşiği eklenecek.
- Ölçüm: 85,96×36,00×159,98 mm; 224.158 üçgen; tek kapalı bileşen; açık/non-manifold 0; kafa ön oranı 0,436; altı görünüş PNG 45.187 B. Normal worker 48.100 ms sürdü; 45.000 ms hedefini aşması H4'te giderilecek. Referans fotoğrafı olmadığından gerçek IoU atlandı.

### 2026-10-22 · Luna V4 H4 — normal kalite alan hızlandırması

- `src/organic-api.js`: eğri detay alanında nokta dizisi/ara dizi üretimini skaler izdüşüme çevirdi; detay aracının etki kutusunun dışında pahalı eğri alanını hesaplamıyor. Kutu, eğri yarıçapı ve yumuşatma genişliğiyle genişletilir; sıfır yüzeyi korunur.
- Yeni test: `scripts/verify-horse-v4-performance.mjs` / `verify:horse-v4-performance`; V4 normal worker süresini <45 sn ve STL hacmini H4 öncesi 272.283,5238 mm³ değerinin ±%0,1 içinde tutar. V3 ölçümü aynı betiğe örnek adı vererek alınabilir.
- Ölçüm: V3 24.222 ms; V4 H4 öncesi 46.533 ms, sonrası 9.652 ms (tekrar 9.965 ms). V4 hacmi 272.283,5238 → 272.284,2790 mm³; fark %0,000277; boyut 85,962×36×159,978 mm aynı. Ayrıntı [`docs/BASELINE.md`](BASELINE.md).

### 2026-10-22 · Luna V4 H5 — baskı geometrisi regresyonları

- `scripts/verify-horse-v4.mjs` / `verify:horse-v4` artık 160±0,5 mm yükseklik, tek kapalı bileşen, açık/non-manifold 0, kafa ön oranı 0,35–0,45, normal üretim <45 sn ve altı görünüş PNG'sini birlikte doğrular.
- STL'de z<0,2 mm tüm üçgenlerin izdüşüm alanı kaide izdüşüm alanının %80'inden büyük olmalı; bu üretimde 1.972,08 / 1.992,35 mm² = %98,98 ölçüldü. Referans fotoğrafı yoksa test fotoğraf IoU'sunu açıkça atlar.
- H5 doğrulaması: 1 bileşen, açık kenar 0, non-manifold 0; yükseklik 159,978 mm; worker 9.718 ms; referans durumu “photo unavailable; IoU skipped”.

### 2026-10-22 · Luna V4 H6 — yerel gözden geçirme paketi

- `scripts/create-horse-v4-review-package.mjs` / `verify:horse-v4-review-package` normal kalite V4'ü üretip `outputs/at-kafasi-v4/` içine STL, altı görünüş PNG'si, ölçüm JSON'u ve IoU yineleme kaydını yazar. `outputs/` gitignore altında kalır; yerel çıktı commit edilmez.
- Referans fotoğrafı bu checkout'ta bulunmadığından gerçek `overlayPng` ve fotoğraf IoU'su üretilemedi. Paket bunu `REFERANS-EKSIK.md` ve `iou-yineleme.json` ile açıkça işaretler; sentetik bindirme eklenmedi.
- Üretilen paket: STL 224.084 üçgen, 272.284,279 mm³; 85,962×36×159,978 mm; altı görünüş PNG 45.196 B. H6 inceleme kapısı: paket Doğukan'a gösteriliyor; V4, Doğukan “oldu” demeden bitmiş sayılmayacak.

### 2026-10-22 · Doku — V3 at kafası yeniden kurgu, organik sınır kutusu, temiz klon

- `models/organik-at-kafasi-v3.js` yeniden yazıldı. Eski sürüm zürafa/hortum gibi görünüyordu: yüz tek kapsül, boyun kafadan ince, kaide elipsoit (tabanı tek noktadan değiyordu), model enine 0,8 sıkıştırılmıştı, göz oyuk açılarak yapılmıştı. Yenisinde kaide alttan kesilerek düz taban (z=0), sıkıştırma yok, kalın ve kavisli boyun + tepe kavisi, kafatası → daralan burun sırtı → genişleyen burun ucu zinciri, dolgun ganaş, çukur içinde kabartma göz ve boyun boyunca yele var. Normal kalite: 119,7×39,4×159,4 mm, 210.128 üçgen, 1 kapalı bileşen, 193,3 cm³. Hâlâ stilize; fiziksel baskı denenmedi.
- `src/organic-api.js`: `yumusakBirlestir` sınır payı `genislik·(n−1)·0,5` → `·0,25`. smoothMax her adımda en çok genislik/4 ekliyor; eski pay iç içe birleşimlerde katlanıp kutuyu şişiriyordu.
- `model-worker.mjs`: organik modda örnekleme öncesi iki aşamalı alan taraması (`tightOrganicBounds`): kaba tarama + kutu yüzlerinde 3× ince dilim taraması. Bütçe tahmini ve levelSet artık modelin gerçek kapladığı kutuyu kullanıyor (V3'te 9,6M → bütçe içi). Tarama ~1–2 sn.
- `scripts/create-at-kafasi-v2.mjs`, `scripts/verify-at-kafasi-v2.mjs`: `outputs/` repoda olmadığı için temiz klonda `referans.jpg` ve V1 manifest'i yoktu ve `build:horse-v2`/`verify:horse-v2`/`verify:exchange-reopen` çöküyordu. Referans artık isteğe bağlı; yoksa manifest referanssız üretilir.

### 2026-10-21 · Luna R5 — referans brifi ve proje paketi

- `index.html`, `src/main.js`, `src/style.css`: 1–3 yerel PNG/JPEG görünüşü, her görünüş için ön/yan/üst kamera, genişlik/yükseklik/derinlik ve açı alanları; montaj delikleri satırları; derinlik tahmini ve montaj oturma garantisi uyarıları eklendi. Referans canvas'ına tıklayarak kapalı poligon çizilip temizlenebilir; en az üç nokta olunca R2 polygon maskesi kullanılır. Bilinen ölçü varsa kontur üretim sırasında `parameters.referans.konturlar` olarak worker'a taşınıyor.
- Referans görsel base64 olarak `.kodla3d.json` proje dosyasının `references[]` alanına gömülür; proje açmada görsel/veri ve ölçüler forma geri yüklenir. Bu, JSON'u tek dosyalı paket yapar; toplam dosya 40 MiB, görsel başına 25 MiB sınırında.
- `src/project-manifest.js` ve `scripts/verify-project-manifest.mjs`: göreli yol, görsel MIME/base64, kamera, pozitif fiziksel ölçüler, açı, poligon boyut/nokta sınırları ve 3 referans üst sınırı doğrulaması. Round-trip/bozuk data/poligon ve sınır testleri geçti.
- Kabul: manifest'te referans data URI + ölçü + montaj deliği verisi aç/kaydet normalizasyonunda tutuldu (`verify:project`). Arayüz DOM/screenshot kontrolünde referans paneli, yükleme ve uyarı metni görünür. Gerçek kullanıcı görseli yüklenmedi.

### 2026-10-21 · Luna R6 — ölçekli siluet bindirmesi ve skor

- `src/main.js`: üretimden sonra seçili referans R3 API ile karşılaştırılır; IoU ve simetrik kenar ortalama/%95 skoru panelde gösterilir. Kırmızı model, yeşil referans, gri kesişim PNG'si viewport'a ve skor kartına konur; ortografik kamera mm/piksel ölçeğine ve görünüş yönüne bağlanır. Genel model için ön/yan vektörleri mevcut viewport eksenleriyle eşleşir.
- Görsel QA: 80×50×25 mm kutunun kendi maskesiyle API overlay PNG'si üretildi ve gözle incelendi; eşleşen 31.500 piksel alanı gri, arka plan saydam. Ölçüm IoU 1,000, ortalama kenar farkı 0 px. %10 ölçek farkında IoU 0,827 ve fazla maske doğru büyüme alanını kapsadı. `scripts/verify-reference-compare.mjs` geçti.
- Sınırlama: bu renk overlay'i ölçülebilir siluet karşılaştırmasıdır; perspektifli fotoğrafın 3D yüzeyle fiziksel eşleşmesi veya montaj uyumu garantisi değildir.

### 2026-10-21 · Luna R7 — sentetik uçtan uca prova

- `scripts/verify-reference-r7.mjs` ve `verify:reference-r7`: ön/yan siluetlerden mm konturu çıkarıp `referansProfili` üzerinden CAD sweep üretir, her modelde R3 IoU ölçer. Braket IoU 0,7127→0,9623, far benzeri sentetik profil 0,8135→0,9889; bilinen genişlik/derinlik hataları ≤0,46 mm. Dört cache miss üretim 682/676/712/709 ms, toplam script 2,852 sn; kayıt `docs/REFERANS-DENEME-2026-10.md`.
- R7'nin gerçek-fotoğraf şartı tamamlanmadı: çalışma alanında braket veya far fotoğrafları yoktu. Bu sonuçlar yalnız sentetik prova; gerçek müşteri fotoğrafı, AI istem yinelemesi, baskı ve montaj testi değildir. Gerçek vaka verilmeden R7 bütünüyle kabul edilmiş sayılmaz.

### 2026-10-21 · Luna R2–R7 — tam regresyon turu

- `npm run build` geçti (575,08 kB ana JS; Vite'ın mevcut 500 kB chunk uyarısı var).
- Elle poligon çizimi eklendikten sonra production build ve tüm UI/manifest sözdizim kontrolleri geçti. Sunucu 127.0.0.1:18774 açık ve `.runtime/luna-reference-validation` run köküne bağlıyken mevcut tüm 19 `verify:*` betiği sırayla geçti: api, silhouette, reference-mask, reference-compare, reference-contour, reference-r7, cad, sweep, parameters, glb (geçici geçerli GLB argümanıyla), project, parts, cad-provenance, at-part-provenance, mesh-report, exchange-reopen, jobs, horse-v2 ve fixtures. Fixture raporu da `.runtime` altına yönlendirildi; kalıcı `outputs` altına test raporu yazılmadı.
- R2–R6 sentetik/manifest/API ve arayüz kanıtları kabul eşiğini geçti. R7 sentetik IoU/ölçü provasını geçti; gerçek fotoğraf/AI girdisi yokluğu nedeniyle R7'nin brif kabulü açık.

### 2026-10-21 · Luna R3 — siluet karşılaştırma API'si

- `src/reference-compare.js` ve `POST /api/compare`: `runId` ya da kod+moddan STL alır; referans bilevel PNG, renk anahtarlı PNG/JPEG veya poligon olabilir. Bilinen mm/piksel ya da referans genişliği ile aynı ölçekte çizilir, sınır merkezleri hizalanır; IoU, simetrik kontur Chamfer ortalama/%95, fazla/eksik PNG ve yeşil/kırmızı/gri bindirme PNG'si döner. Görsel istekleri 36 MiB ile, görsel başına 16,7 MP ile sınırlı; karşılaştırma anahtarı model, referans, kamera ve ölçeği kapsar, 8 sonuç bellekte tutulur.
- `scripts/verify-reference-compare.mjs`: 80×50×25 mm kutu kendi siluetiyle IoU 1,000, kenar ortalaması 0 px verdi. %10 büyük ölçek IoU'yu 0,827'ye düşürdü; model pikseli 31.500→38.088. Fazla/eksik PNG ve ikinci istekte cache hit doğrulandı.
- Sunucu açıkken `verify:reference-compare` geçti. Kabul ölçütü geçti; doğrulama sentetik kutu üzerindedir.

### 2026-10-21 · Luna R4 — referans konturu ve profil uçları

- `src/reference-contour.js`: 0.5 seviye marching-squares dış konturu, kapalı döngü seçimi ve mm toleranslı Douglas–Peucker sadeleştirmesi. `POST /api/reference/contour` aynı R2 referans girdilerini alıp mm nokta listesini ve `profilLoft`, `profilSupur`, yarı profilli `profilDondur` için başlangıç şekillerini verir. Worker'daki `referansProfili({ad,yon,tolerans})` `parameters.referans.konturlar[yon]` verisini okur.
- `scripts/verify-reference-contour.mjs`: 80 mm çaplı, 1024×1024 sentetik daire çevre hatası %0,0063; L maskesi 0,1 mm toleransta 12, 5 mm'de 6 nokta verdi; API yanıtı ve loft nokta listesi doğrulandı.
- Sunucu açıkken `verify:reference-contour` geçti. Kabul ölçütü sentetik daire/L üzerinde geçti. R5 henüz kontur verisini proje/üretim akışına taşımadı.

### 2026-10-21 · Luna R2 — yerel referans maskeleri

- `src/reference-mask.js`: PNG/JPEG güvenli boyut sınırıyla çözümleniyor; hazır siyah-beyaz maske, köşe renginden düz arka plan anahtarı ve pixel-coordinate poligon rasterizer eklendi. PNG CRC, biçim, piksel bütçesi, alpha ve poligon sınırları doğrulanıyor. ML kullanılmıyor.
- `scripts/verify-reference-mask.mjs` / `verify:reference-mask`: sentetik 800×600 L silueti için hazır PNG, renk anahtarı ve poligon maskeleri 116.000 piksel verdi; JPEG key IoU=1,00. Test PNG/JPEG üretip byte boyutlarını ve geçersiz girdi reddini de kontrol ediyor.
- `pngjs@7.0.0` (MIT) ve `jpeg-js@0.4.4` (BSD-3-Clause) exact dependency olarak eklendi; `docs/LISANSLAR.md` güncellendi. JPEG decoder/encoder bileşenlerinin farklı lisans kökeni dağıtım öncesi lisans notunda belirtildi.
- `npm run verify:reference-mask` geçti; R2'nin sentetik kabulü ±%2 ölçüsünü geçti. API/UI entegrasyonu R3–R6 kapsamındadır.

### 2026-10-20 · Luna R1 — siluet maskesi

- `src/mesh-views.js`: STL üçgenlerinden `renderSilhouette(stl, {camera, width, height, fit})` ikili maskesi eklendi. Altı sabit görünüş ve serbest yön/up vektörü; otomatik sınır kutusu kadrajı ve açık `mmPerPx` ölçeği destekleniyor. Bozuk STL, sonlu olmayan koordinat, paralel kamera vektörleri ve aşırı görüntü boyutu reddedilir.
- `scripts/verify-silhouette.mjs` / `verify:silhouette`: 80×50×25 mm kutunun 400×400 önden silueti 80.000 piksel; analitik 400×200 dikdörtgenle hata %0. `mmPerPx=0,5` için 5.000, serbest kamera ve `mmPerPx=0,25` için 64.000 piksel. Üretilen maske PNG'si gözle incelendi; ortalı, kesilmemiş 400×200 dikdörtgen.
- Son doğrulama: production build geçti (566,30 kB ana JS; mevcut 500 kB Vite uyarısı sürüyor). Sunucu `127.0.0.1:8765` açıkken `verify:api`, `verify:silhouette`, `verify:cad`, `verify:sweep`, `verify:parameters`, `verify:glb` (geçici GLB dosya argümanıyla), `verify:project`, `verify:parts`, `verify:cad-provenance`, `verify:at-part-provenance`, `verify:mesh-report`, `verify:exchange-reopen`, `verify:jobs`, `verify:horse-v2` ve `verify:fixtures` geçti.
- `verify-job-lifecycle` içindeki CAD kalite-cache beklentisi, 20.10 cache düzeltmesiyle çelişiyordu: CAD'de etkisiz SDF `quality` alanı anahtara girmez. Test beklenen cache hit'e güncellendi; gerçek cache, PNG byte eşitliği ve timeout/crash toparlanma senaryoları geçti. Cache kodu değiştirilmedi.
- Doğrulama isteklerinin `.runtime/runs` retention'ı başlangıçtaki 15 run klasörünü yenileriyle değiştirdi; yedekten bu 15 klasör eksiksiz geri yüklendi. R2+ doğrulamaları için `KODLA3D_RUNS_DIR` ile ayrı test run kökü kullanılacak.
- Başlangıç yedeği: `Desktop/3d-Baski-uyg-yedek-2026-10-20-R1-baslangic` (908 dosya, 140,90 MB; `node_modules`, `.venv`, `outputs` hariç). R1 kabul ölçütü geçti. R2–R7 21.10.2026 devam oturumunda geliştirildi; gerçek fotoğraf bulunmadığından R7 sentetik kapsamda kaldı.

## 2026-10-21 — Doku denetimi: R1–R7

- Sunucu açıkken 18 `verify:*` bağımsız koşuldu, hepsi geçti; 20.10 önbellek/kadraj/test düzeltmeleri yerinde.
- **Gerçek fotoğraf denemesi:** `outputs/at-kafasi/referans.jpg` (beyaz zemin, renk anahtarı eşik 40) ↔ organik V3, `/api/compare`, `genislikMm:124`. `left` IoU 0,528 (kenar ort. 43 px, %95 99 px); `right` 0,462. Bindirme anlamlı: boyun/yele ve çene altı eksik (yeşil), kulaklar geride ve burun ucu fazla (kırmızı). Gerçek fotoğraf yolu çalışıyor; ölçek/hizalama fotoğrafta gövde göründüğü için yaklaşık.
- **Hata:** `verify:*` betikleri canlı sunucuda >14 üretim yapınca `.runtime/runs` saklama kuralı kullanıcının son 15 çalışma klasörünü siliyor (denetimde 15/15; yedekten geri yüklendi). Testler ayrı run kökü kullanmalı (ör. `KODLA3D_RUNS_DIR` + ayrı port).
- **Eksik:** `docs/HTTP-API.md` `/api/compare` ve `/api/reference/contour` uçlarını anlatmıyor; AI kullanım sözleşmesi bunları göstermeli.
- R7 gerçek müşteri fotoğrafı kabulü hâlâ açık (Luna raporuyla aynı).

## 2026-10-20 (akşam, Doku) — önbellek, kadraj, düzen, kırılgan test

- **Önbellek hiç tutmuyordu (`server.mjs`):** her üretim son 14 çalışma klasörü dışındakileri silerken önbelleğin işaret ettiği klasörleri de siliyordu; kopyalama sessizce düşüp yeniden hesaplanıyordu (ölçüm: 31 ıska / 2 isabet). Artık önbellekteki klasörler silinmez. Ayrıca anahtardan sonucu etkilemeyen alanlar çıkarıldı (CAD'de SDF `quality`, organikte `cadMeshQuality`, parametresiz istekte `example`). Ölçüm: at kafası V2 ikinci üretim 27 sn → 30–40 ms; sayfa açılışında son model 1 sn'de hazır. 8 girdilik bellek sınırı aynı.
- **Kadraj (`src/main.js` `frame`):** hedef NDC span 1.0/0.5'ten 1.5/0.8'e; model önizlemenin ~%75'ini dolduruyor (ölçüm `max=74.1%`). Önceki "yarım ekran" kararı at kafasını ızgarada küçük bırakıyordu.
- **Düzen (`src/style.css`):** editör alt şeridinde durum yazısı butonun altına giriyordu; açıklama tek satır + üç nokta, durum sağa, kısayol 1280 px altında gizli. Üst karşılama alanı sıkıştırıldı.
- **Test (`scripts/verify-at-kafasi-v2.mjs`):** yükseklik `160.0000001` tam eşitliği OpenCascade son basamağında kırılıyordu (`160.0000002`); 1e-4 toleransa alındı.
- Doğrulama: `npm run build`; sunucu açıkken bütün `verify:*` geçti (`verify:glb` dosya argümanı ister, bağımsız çalışmaz). Yedek: `Desktop/3d-Baski-uyg-yedek-2026-10-20` (node_modules/outputs hariç).
- **Organik V3 kafa oranları (`models/organik-at-kafasi-v3.js`):** ince boru burun + çubuk çene yerine alın, büyük yuvarlak çene kemiği (ganaş), düz burun sırtı, dolgun burun ucu, dudak ve yaprak kulak. Boyun/kaide aynı. Normal kalite: 124×30,4×153 mm, ~110,6 cm³, açık kenar 0, manifold olmayan kenar 0, tek parça. Yumuşak birleşim sınır kutusu bütçeyi aşmasın diye yan yarıçaplar ve birleşim payı ayarlandı; 0,013 mm kaydırma sıfır alanlı üçgeni önledi. Eski kaynak `models/organik-at-kafasi-v3.onceki-2026-10-20.js.bak`. Sırada boyun.
- **Açık (kod hatası değil, tasarım):** at V2/V3 at gibi okunmuyor — boyun düz boru, kafa ince ve gagamsı, çene/yanak/alın kütlesi yok, kulaklar iğne. Ayrı tasarım işi.

## 2026-10-20 — T24 kamera, alın izi ve organik at V3

- `src/main.js` at V1/V2/organik V3 kamera eksenlerini aynı at profiline bağladı. `Ön` +X yüz, `Sol` −Y profil; V2'nin yanlışlıkla genel kamerayı kullanması düzeltildi.
- Beyaz blaze viewport'ta CAD preview mesh'ine raycast edilerek yüzeye oturan ince bir ribbon olarak çiziliyor. Katı kaynağına, STL/STEP/GLB'ye eklenmiyor.
- `models/organik-at-kafasi-v3.js` ve parametre şeması eklendi: SDF ile yumuşak birleşen, 160 mm civarında kapalı bir organik örnek. Normal kalitede 149.766 üçgen ve 1 kapalı yüzey; 123×30,4×160 mm. Üretim sonucu canlı arayüzde açıldı; fotoğrafın 3D taraması veya baskı garantisi değildir.
- Üretilen STL `outputs/at-kafasi-v3-organik/at-kafasi-organik-v3.stl` yoluna arşivlendi; SHA-256 ve teknik mesh raporu yanına yazıldı. Tarayıcıdaki GLB dışa aktarma UI'si başarılı durum verdi (10.531,5 KB).
- `npm run build`, `node --check src/main.js`, `npm run verify:horse-v2` geçti. Üretim bundle'ı 566,30 kB, Vite'ın 500 kB uyarısı mevcut.
- Son V2 boyun loft adayının tarayıcı üretimi `[object WebAssembly.Exception]` verdi; başarısız taslak V2 kaynağına alınmadı. T24'ün CAD boyun silueti maddesi halen açık.

## 2026-10-19 — T08 kabul kaydı ve T11 sınırlı CAD primitive dilimi

- Ne yaptım: T08'i `docs/ILERLEME.md` içinde `verified` yaptım; ince 0,55 mm mesh'te base, her iki yele tutamı, oyuklar ve tam modelin tek yüzey bileşeni olduğu bilgisi ile parent'ın güncel IAB ölçülerini kanıt olarak iliştirdim.
- Neden: parent fresh 8766 sekmesinde en son güncel mesh/renderi kontrol etti; T08'in baskı güvenilirliği için eklenen connectedness şartı karşılandı.
- T11 kodu: `src/model-api.js` dairesel-loft kesitlerinin artan Z sırasını ve profil revolve için yalnız 360° kapalı katıyı doğruluyor; transform, ayna, pah ve doğrusal desen kısa API'lerini sağlıyor. `model-worker.mjs` bu komutları model koduna açıyor. `models/dairesel-loft.js`, `models/profil-dondur.js` örnek; `scripts/verify-cad-authoring.mjs` ve `npm run verify:cad` STL/STEP ölçü, solid ve hata sınırı kanıtı üretiyor.
- Hata açıklaması: `yuvarlat`, `icini_bosalt` ve `pah` başarısızlığında parça/boyut bağlamı korunuyor. `delik_ac` noktalarının global XY olduğu açık ve koordinatlar sonlu/2B doğrulanıyor. Geçersiz CAD işlemi yaklaşık mesh'e çevrilmiyor.
- Kapsam sınırı: genel BRep sweep, serbest profilli loft ve açık/kısmi revolve bu dilimde yok; T11 pending kalacak. Delikli aparat ve içi boş kapaklı kutu gövdesi kabul örnekleri test betiğine eklendi. UI'de bunların kullanıcı akışı henüz T12/T17 kapsamı değil.
- Doğrulama sırasında bulgu/düzeltme: doğrulama betiği ilk denemede iki ret isteğini paralel gönderdi; tek iş kuralı nedeniyle ikinci istek 409 aldı. Testleri sıraya aldım. Ayrıca 20 mm duvarlı 10×10×2 mm kutuda OpenCascade shell işlemi 200 döndürüp hacmi değiştirmedi; başlangıç hacmini `replicad.measureVolume` ile ölçüp no-op sonucunu açık hata yaptım. `yuvarlat` için OpenCascade'in boş hata nesnesine okunur fallback eklendi. Son fixture'lar bu davranışları 422 ve parça/ölçü bağlamıyla doğruluyor.
- Sonuç/kanıt: `npm run verify:cad` 8766 exact-project API'sinde geçti. Loft: 24 mm yüksek, 1 solid, 4.500 STL tri, STEP 13.666 byte. Döner profil: 20×20×18 mm, 1 solid, 1.634 tri, STEP 10.411 byte. Döndürme+pah 10×20×5 mm; ayna 20×10×5 mm; desen 3 solid, toplam 375 mm³; delikli aparat 30×20×5 mm/1 solid; boş kutu 30×20×15 mm/1 solid ve 3.592 mm³. Sırasız loft, 180° revolve, 20 mm fillet ve başarısız/no-op shell doğru bağlamlı 422 verdi. Rapor `outputs/cad-authoring/DOGRULAMA.json`.
- Gerileme/build: `node scripts/verify-first-sprint.mjs` (KODLA3D_PORT=8766) CAD kutu/aparatı ve organik taslak/normal/ince, Boolean, limit, invalid input/recovery kontrollerini geçti. İlgili kaynak ve betiklerde `node --check` geçti. `npm run build` geçti; mevcut Vite 512,69 kB chunk sınırı uyarısı sürüyor.
- T11 kapsam kararı: doğrulanmış dar dilim `docs/ILERLEME.md`'de “verified (sınırlı dilim)” olarak işaretli. Genel BRep sweep, serbest profilli loft, kavisli/değişken kesit sweep ve daha geniş rötuş seçenekleri pending; bunların doğrulaması gelmeden brif T11 tümüyle tamamlandı denmeyecek.
- Çalışma sunucusu: 8766 portu zaten açık, API güncel proje örneği/health yanıtı verdi; mevcut süreci kapatmadım. Kullanıcıdaki 8765 sunucusuna dokunulmadı.

## 2026-10-19 — T12 parça ağacı, parametre ve kaynak seçimi ilk dilimi

- Ne değiştirdim: `src/organic-api.js` primitive nodes için başlangıç parametreleri ve bounds metadata'sı ekliyor; transform sonrası node bounds'unu güncelliyor. `model-worker.mjs` bu alanları sonuç `parts` dizisine ekliyor; CAD ise birleşik BRep için yalnız aggregate bounds/kimlik sunuyor.
- Neden: AI'ın ürettiği mantıksal organik parçanın adı/kimliği, ölçüsü ve parametresi ayrı seçilebilir olmalı; ayna gibi türetilmiş parça kaynağı ve güncel konumu ayrı görünmeli.
- Arayüz: `index.html`, `src/main.js`, `src/style.css` seçilebilir hiyerarşik node listesi ve ayrıntı kartı ekliyor. Kart tür/ID/kaynak/grup/durum/bounds/başlangıç parametresi/dönüşüm/işlemi gösteriyor; kodda ID/ad bulunursa editörü o metne götürüyor. Kısım kullanılabilirliği notu, combined STL için henüz gerçek yüzey pick/hide/isolate/focus olmadığını açıklıyor.
- Doğrulama: `scripts/verify-part-tree.mjs` ve `npm run verify:parts` geçti. Sol elipsoid + taşıma ve YZ simetri fixture'ında 3 node, her node parametreleri, YZ mirror `sourceId`, ortak grup, dönüşümler ve iki kulağın z bounds'u kontrol edildi. İlk fixture aynı source node'u iki kez outer group'a ekleyerek beklenen duplicate-ID 422 aldı; fixture gerçek simetri grubuna göre düzeltildi. Bu inceleme mirror node bounds'unun kaynakta kaldığını ortaya çıkardı; `derivedPart` leaf bounds güncellemesi eklendi ve verifier pozitif/negatif X bounds'la regresyonu yakalıyor.
- UI kanıtı: 8766 IAB `?model=organik-simetri` DOM/screenshot kontrolünde 3 node listelendi; Sol kulak seçilince tür, ID, grup, `[-7.40,-1.90,-5.40]→[-2.60,1.90,5.40] mm`, ellipsoid center/radii ve `Kaynak kodda bul` düğmesi göründü. Tarayıcı error log'u boş. Seçim sonrası ekran ağacı/ayrıntı kartı görsel olarak kontrol edildi.
- Build/syntax: JS değişiklikleri `node --check` geçti; `npm run build` başarılı, Vite 515,71 kB ana chunk uyarısı verdi. `npm run verify:parts` API fixture'ı başarılı. 8766 test sunucusu tarayıcı kontrolünden sonra kapatıldı; 8765'e dokunulmadı.
- Sınır/durum: T12 `inprogress`. CAD at-kafası örneği tek BRep sonuç düğümü; loop içindeki kulakları parça kimliğiyle yeniden kurmuyor. Mevcut organic STL tek mesh olduğundan canvas hit-test, parçayı gizleme/izolasyon, focus, seçim highlight ve bağımsız parça preview'sü güvenle yapılamıyor; bu işler component-aware render/API dilimi gerektirir.
- Parent kabulü: exact-checkout 8766 fresh IAB ekranında 3 düğüm, seçili Sol kulak detayları, parametre, mm bounds/sourceId doğru; `Kaynak kodda bul` tıklaması editörde `kulak-sol` ifadesini seçip odağı verdi. Bu bounded T12 slice `verified (sınırlı dilim)` oldu. 8766 PID 20356 kontrol sonrasında kapatılacak; 8765'e dokunulmayacak.

## 2026-10-19 — T13 sabit kamera görünüşleri ilk dilimi

- Ne değiştirdim: `index.html` önizleme çubuğuna İzometrik/Ön/Arka/Sağ/Sol/Üst seçicisi ekledim; `src/main.js`'te kamera yönünü Z-up eksenleriyle seçilen preset'e bağladım. Üst görünüşte kamera up vektörü Y olarak ayarlanıyor. Var olan `frame()` bounds kadrajı, `ResizeObserver`, görünüm sıfırlama ve `.studio`/canvas ölçü sınırı korundu. `src/style.css` görünüş seçicisini araç çubuğuna sığdırıyor.
- Neden: kullanıcı modele bakış açısını orbit ile aramak zorunda kalmasın; sabit ortogonal yönler tekrar seçilebilir olsun.
- Doğrulama: `node --check src/main.js` ve `npm run build` geçti. Fresh IAB 8766 sekmesinde `organik-simetri` ile 6 değerin her biri seçilip DOM kamera-fit metrikleri okundu; tümünde model kadraj içinde: 637×395 canvas için izometrik 186×183 px (%48,0 max), ön/arka 275×196 (%49,6), sağ/sol 55×183 (%46,3), üst 310×66 (%48,7). Ön görünüş screenshot'ında iki kulak karşıdan tam görünür, orbit/zemin canvas'ta ve eski layout taşması yok; console error yok. `Görünümü sıfırla` seçili üst görünüşü korudu.
- Kapsam: T13 `inprogress`. Ortografik/perspektif seçimi, kesit düzlemi, kil/normaller/tel-kafes görünüm profilleri, çok açılı screenshot kaydı ve at modelinin profil/ön görsel kabulü pending. Bu fixture anatomik kalite kabulü değildir.
- Sunucu: parent önceki T12 sunucusunun kapatıldığını teyit etti. T13 kontrolü için exact-checkout 8766 PID 18812 kısa süre açıldı; test sonrası kapatılacak. 8765'e dokunulmadı.
- Parent live kabulü: fresh IAB'de altı dropdown seçeneği ve görünüş/fit değişimi doğrulandı; 637×395 px viewport'ta front 275×196, right 55×183, top 310×66, iso 186×183 px, her preset %50 sınırının içinde. Reset ve seçim sonrası UI iso'da. T13 `verified (sınırlı dilim)`; projection toggle, kesit/kil/normaller, multi-angle kayıt ve at profili pending. İkinci kısa sunucu PID 9968, kapatıldı; 8765'e dokunulmadı.
- T13 projection alt-dilimi: `index.html`'e Perspektif/Ortografik seçici, `src/main.js`'e kamera/OrbitControls yeniden kurma ve ortografik projected-bbox fit eklendi. Neden: T13'ün doğrusal ölçü incelemesi perspektif kısalması olmadan da yapılabilmeli. `node --check src/main.js` ve `npm run build` geçti (516,94 kB ana chunk uyarısı). IAB'de perspective + orthographic için iso/front/right/top seçildi; hiçbir console hatası yok. Orthographic viewport 637×395 px'te bbox'lar 188×196, 274×196, 59×196, 315×67 px; hepsi <%50. Reset seçili top view'u tuttu. Screenshot'ta üst görünüşte simetrik iki kulak düz planformda göründü. T13 sınırlı slice kapsamı genişledi; section/clay/normals/multiview capture/horse profile pending. Kısa test sunucusu PID 17516 kapatıldı; 8765'e dokunulmadı.
- T13 inceleme kipi dilimi: `index.html`'e normal ve X-kesit kontrolleri; `src/main.js`'e Three.js local clipping, mm bounds'a göre kesit slider'ı ve `MeshNormalMaterial`/clay materyali geçişi eklendi. Neden: formu yüzey normali ve kesilmiş iç kesitle kontrol etmek; bu kipler yalnız preview'dür, çıktı geometrisini değiştirmez. Tel kafes toggler'i yeni material geçişinde korunuyor. `node --check src/main.js` ve `npm run build` geçti; bundle 518,41 kB uyarısı verdi. IAB screenshot'ında Kesit konumu slider'ı görünür, model kesitli ve normals renkli; ardından kesit/normaller kapatılıp tel kafes açıldı. Düğme hidden/pressed durumları beklenen değerlerde, console error yok. T13 `verified (sınırlı dilim)`; multi-angle image save ve at profili kabulü pending. Test sunucusu PID 19088 kapatıldı; 8765'e dokunulmadı.

## 2026-10-19 — Sprint A başlangıcı

- Brif ve aktif kaynaklar incelendi; proje Git deposu olmadığı kaydedildi.
- Bu kayıt eklendi; henüz uygulama/dependency dosyası değiştirilmedi.


## 2026-10-19 — T01 ölçüm altyapısı, T02 paket incelemesi

- Worker aşama profili ve 20 ms RSS örneklemesi eklendi; benchmark betiği üç örneği üçer kez ölçmek üzere eklendi.
- Amaç: mevcut CAD performansını gerçek makinede belirlemek; geometri/export aşamalarını uydurma şekilde ayırmamak.
- `node --check` geçti. İlk benchmark betiğinde package export metadata hatası bulundu ve yerel `package.json` okuma ile düzeltildi; benchmark sürüyor.
- Manifold registry metadata onaylı ağ erişimiyle doğrulandı: 3.5.4, Apache-2.0. Kurulum yalnız izole `.runtime/spike` dizinine yapılacak; ana dependency listesi değişmeyecek.

## 2026-10-19 — T01 başlangıç ölçümü ve T02 Manifold spike

- T01: `docs/BASELINE.md` ve JSON raporu eklendi. Kutu/aparat/at üçer kez üretildi. Medyan API 1.436 / 1.503 / 46.378 sn; RSS örnek tepe 254 / 249 / 910 MiB. At geometri aşaması ~37 sn. “Cold” etiketi gerçeği yansıtmadığı için “sunucu zaten açık” olarak düzeltildi.
- T02: resmi `manifold-3d@3.5.4`, Apache-2.0, izole `.runtime/spike` altına kuruldu. Gerçek JS/WASM, SDF `levelSet`, hard/smooth union, kavisli boyun-baş, ince kapsül ve ayrı yüzeyler çalıştı. Üç STL, ölçüm JSON'u, aynı ölçekli Three.js preview eklendi.
- Üç kapalı mesh kanıtı: `NoError`, boundary/nonmanifold indeks kenarı 0. 2 mm yarıçaplı ince parça 1.4 mm meshing ayarında ~%4.6 hacim düşürdü.
- Alt-agent browser görünürlüğü yok; preview localhost:5174'te hazır, ama bu oturumdan render screenshot/görsel inceleme tamamlanamadı.

## 2026-10-19 — Manifold dependency entegrasyonu

- T02 spike geçiş kapısından sonra `manifold-3d@3.5.4` tam sürümü `package.json` ve `package-lock.json`'a eklendi; 37 paket kuruldu, npm audit 0 bulgu döndürdü.
- npm `esbuild@0.28.2` postinstall izin listesinde olmadığı için scripti çalıştırmadı. Sistem veya güvenlik politikası değiştirilmedi; uygulama build'iyle doğrulanacak.
- Neden: spike'ta doğrulanmış WASM yeteneğini uygulama API'sine bağlamak. Organik mesh hattı ayrı kalacak; CAD model kaynak ve STEP üretimi korunacak.

## 2026-10-19 — İlk CAD/organik entegrasyon kodu

- Yeni `src/organic-api.js`: SDF primitives (sphere, ellipsoid, variable-radius capsule), smooth union/subtraction; finite input checks, sampling bounds padding.
- Worker CAD/organic branch: Replicad/STEP davranışı korunur. Organik Manifold level-set, mm profile, samples/mesh/topology report, STL+JS; no false STEP. Source hash, schema v1, engine and quality fields.
- Server mode and quality allowlist, old clients default to CAD, format-driven download routes, example mode metadata.
- UI mode and quality pickers, mode-aware examples, organic STL preview and unsupported STEP button disabled. Added first curved neck/head model.
- Validations so far: JS syntax checks and `npm run build` pass. API build/exports are next; not marked done before their results.
- Build warning: minified client chunk 511.20 KB (>500 KB). Manifold WASM only loads in the server worker and isn't part of this browser chunk; warning is a project/frontend chunk observation, not a test failure.

## 2026-10-19 — Önizleme, uygulama ve sprint doğrulaması

- Preview screenshot yeniden alındı: 4/4 panel `Yüklendi`; sert birleşim, kıvrık boyun-baş ve yan siluet görünür. T02 görsel kontrolü geçti.
- Ana uygulama screenshot'ında organik örnek çizildi; SDF motor hazır, 18×11×35 mm, 9.560 üçgen, JS/STL etkin ve STEP kapalı. Bu yalnızca hacim prototipidir.
- `README.md`, `docs/DOGRULAMA.md`, `docs/ORGANIK-MOTOR-KARARI.md` ve spike README motor seçimi, çıktı formatları, sınırlar, ölçümler ve çalıştırma adımlarını kaydediyor.
- `npm run build` geçti (511.39 kB ana chunk uyarısı); altı JavaScript dosyasının `node --check` kontrolleri geçti.
- `node scripts/verify-first-sprint.mjs` CAD geriye uyumluluk, organik API/kalite/STL/topoloji, subtraction, limit, hatalı giriş ve toparlanma kontrollerini geçti. Doğrulama JSON'u yeniden üretildi.
- İlk sandbox build'inde Vite config erişimi engellendi; aynı build proje dizini için izinli yükseltilmiş çağrıyla tamamlandı. Başka dependency eklenmedi.

## 2026-10-19 — T06–T08 modelleme API'si (doğrulama sürüyor)

- Parçalara `id` / görünür ad ayrımı, grup ve node metadata'sı, görünürlük/kilit, pivotlu scale-rotate-translate, XY/XZ/YZ yansıma, ID ile bulma ve grup içi hedefli yenileme eklendi. Worker bu metadata'yı sonuç JSON'unda taşıyor.
- Bölgesel compact-cubic falloff ile sisir/incelt/it/cek ve yerel yumuşatma; değişen hacim işlemi ve değişken yarıçaplı eğri kabartma/oyuk eklendi. Göz kapağı, dudak çizgisi, burun çukuru ve yele tutamı için kısa yardımcılar tanımlandı.
- Örnekler: `models/organik-simetri.js`, `models/organik-bolgesel.js`, `models/organik-detay.js`; test/fixture betiği `scripts/verify-authoring-features.mjs`.
- Neden: T06–T08 kabulü parça kimliği ve hedefli düzenleme, lokal şekil etkisi ve çıktıda gerçekten var olan ayrıntı istiyor.
- İlk doğrulama geçişinde worker context'inde dört yeni yardımcı fonksiyonun dışa açılmadığı bulundu; worker binding düzeltildi. API scriptinde `.name` yerine `OrganikParca.ad` beklenmesi gerektiği saptandı ve test buna göre düzeltiliyor. Bu işler STL kanıtı, görsel kontrol ve tamamlanmış durum almadan verified işaretlenmeyecek.
- Sınırlar: SDF deformasyonu yaklaşık alan işlemi; yumuşatma/mesafe CAD doğruluğu sağlamaz. Eğri kabartılar ve oyuklar gerçek SDF mesh geometrisine girer, fakat yüzey hizalaması ve baskı min kalınlığı otomatik garanti edilmez.

### T08 kadraj düzeltmesi — 2026-10-19

- Ne değiştirdim: `src/main.js` fit/reset hesabı bounding sphere ve gerçek viewport FOV/aspect değerleriyle güncellendi; kamera mesafesi `fitRadius × 1.15 / sin(limitingFov/2)` olarak hesaplanıyor. Reset orbit damping'i temizleyip kamera kontrol state'ini kaydediyor.
- Neden: önceki deneme paydada `2 × sin(FOV/2)` kullandığından kamera mesafesini yarıya indiriyordu. Parent'in yeniden aldığı IAB ekranında T08 örneğinin bir kısmı kesik görünmüştü; sorun bounds/units varsayımıyla açıklanmıyordu.
- Sonuç/kanıt: son `npm run build` başarılı; yalnız 511,65 kB frontend chunk uyarısı var. Üst görev hard-reload + fresh tab ve reset ile yeniden denedi; ince 0.55 mm / 34.832 tri üretim durumu hazır olsa da modelin yalnız üst yarısı görünüyor ve kadrajın dışına taşıyor. Bu düzeltme görsel kontrolü geçmedi; T08 pending.
- Sonraki deneme: frame hesabına gerçek canvas `clientRect` ve projekte edilmiş 8 bounds köşesinin piksel sınırlarını ekle; kamera mesafesini gerçek kadraja göre iteratif ayarla. Hedef, model bbox'ının viewport genişlik/yüksekliğinin %80'ini aşmaması. Sonuç IAB screenshot ile yeniden kontrol edilmeli.
- Deneme eklendi: `frame()` viewport rect'i renderer ve kamera aspect'ine eşliyor, bounding-box 8 köşesinin NDC/piksel sınırını hesaplıyor; %80 viewport sınırı aşılırsa distance artırılıyor. Resize sonrası mesh için fit tekrarlanıyor; ölçüm `status.dataset.cameraFit` olarak DOM'da.
- Kanıt: `scripts/verify-authoring-features.mjs` passed; `npm run build` passed (512,60 kB bundle uyarısı). IAB screenshot bekliyor; T08 pending.
- Üst görev DOM ölçümü kamera yerine layout'u işaret etti: 720 px pencere içinde `.studio` 490 px, `.viewer-panel` 1289,4 px, `#viewport`/canvas 1196,4 px; studio overflow nedeniyle canvas/model aşağıdan kesiliyordu.
- `src/style.css`'te `.studio` grid satırı `minmax(0,1fr)`; viewer panel ve `#viewport` için `min-height:0`, yüksekliği parent'a bağlama, flex host'u `height:0` ile sıfır tabanlı büyütme ve overflow kontrolü eklendi. Viewer üst çubuğu `flex:none` yapıldı. Neden: intrinsic flex/grid minimumunun canvas host'u stüdyo dışına büyütmesini durdurmak.
- Sonuç kanıtı henüz yok; yeni build + IAB rect/screenshot bekleniyor. Geometrinin tamamının kadraja girdiği görülmeden T08 verified olmayacak.
- CSS sonrası IAB ölçümü: `.studio` 490 px; `.viewer-panel` 488 px; `#viewport`/canvas 395 px, taşma yok. Önceki fit sınırı model bbox'ını 119×147 px (viewport 637×395 px) tuttu; görünür yükseklik ~%37 idi. Yakınlaştırma hedefi NDC span 1.0 / max half-span .5'e güncellendi (~%50 viewport yüksekliği). Son screenshot bekleniyor.

### T10 sürümlü organik API referansı — 2026-10-19

- Ne değiştirdim: `src/api-schema.js` sürüm ve 18 komut tanımının kaynağı oldu (`apiVersion:1`, `schemaVersion:1`). Worker organik sonuçlarına `apiVersion` ekliyor. `npm run api:docs` bu kaynaktan `docs/ORGANIK-API-REFERANSI.md` üretiyor; `npm run verify:api` runtime export'larını, sürümleri ve örnek davranışını denetliyor. `docs/AI-KULLANIM.md` 0 mm hatalı yarıçap ve 3 mm düzeltme örneği içeriyor.
- Neden: küçük AI/başka tüketiciler için komut adı, parametre, sürüm ve hata düzeltme örneğini tek komut kaynağıyla eşleştirmek.
- İlk verifier denemesi hatalı örneği yanlış dosyada aradığı için başarısız oldu; iki belgeyi ayrı okuması sağlandı. Sonuç: reference generation ve `verify:api` geçti (18 komut, runtime API/schema 1; sıfır yarıçap reject ve düzeltme geçti). `npm run build` geçti; 512,69 kB bundle uyarısı mevcut.
- Ekledim: `scripts/verify-first-sprint.mjs` organic build yanıtlarında her üç kalite profilinin `apiVersion`/`schemaVersion` değerini kontrol ediyor; tam API server doğrulaması sıradaki sprint check'inde çalıştırılacak.
- Sonraki build doğrulaması: `node scripts/verify-first-sprint.mjs` geçti; CAD kutu/aparat regressions, organic taslak/normal/ince ve API/schema v1 alanları, boolean, grid budget, invalid input ve recovery kontrolleri çalıştı.

### T08 yele tutamı yüzey konumu — 2026-10-19

- Üst görev yeni kamera karesini ölçtü: viewport 637×395 px; model bbox 151×184 px, yükseklik ~%46,6 ve tam görünür. Göz ve burun oyukları okunuyor; yele önden belirgin değil.
- `models/organik-detay.js` iki strand merkez hattı başın görünen negatif-Y yüzeyine yaklaştırıldı; yüzeyden yaklaşık 1,1–1,3 mm dışarıda, yarıçaplar 1,1–1,7 mm. Neden: önceki tutamlar yüzey içinde kalıp silik görünüyordu.
- `scripts/verify-authoring-features.mjs` geçti. STL üretimi strand değişimini doğruluyor: 15.710→16.704 triangles, 785.584→835.284 bytes, volume 7.099,11→7.207,38 mm³. Yeni IAB screenshot bekleniyor; T08 görsel kabulü pending.
- Üst görev 8765'te eski örnek koordinatlarının geldiğini gördü. Port PID 9228 ve command line `node server.mjs`; sistem CIM sorgusu working directory vermedi, bu nedenle checkout eşleşmesi doğrulanamadı. Süreç durdurulmadı. Yalnız test için `KODLA3D_PORT` ortamı eklendi ve aynı proje kökünden 8766 preview başlatıldı; `/api/examples` yeni koordinatları ve `/api/health` yanıtı doğrulandı. Görsel teyit sonrası bu geçici süreç kapatılacak.
- T08 sonucu: parent fresh tab'da exact project 8766 preview'ünü kontrol etti. Kaynak preset yeni merkez koordinatlarını taşıyor; ince quality 0,55 mm, mesh 36.572 üçgen, 29×17,6×32 mm. Viewport 637×395 px, model bbox 151×182 px (~%46,1 yükseklik); tam kadraj. Göz ve burun oyukları; yan görünüşte en az bir yele çıkıntısı açık. T08 görsel kabulü geçti; bu foto-gerçekçi anatomi veya Doğukan'ın referans onayı değil. Geçici 8766 süreci kapatıldı; kullanıcıdaki 8765 sürecine dokunulmadı.

### T06/T07 doğrulama sonucu

- `scripts/verify-authoring-features.mjs` ilk testte worker helper binding'ini eksik buldu, ayrıca bir ID assertion yanlış property adı kullanıyordu; worker API namespace'i ve test beklentisi düzeltildi. Sonra grup kardeş alanı testi yüzeyin tam sıfır signed-distance noktasında olduğu için hatalı assertion verdi; kontrol noktasını küre içinden seçince hedefli değişiklik geçti.
- T06/T07 sonrası tüm authoring fixture'ları ve binary STL boy/üçgen sayısı doğrulandı. T06 testleri: kaynak/ayna ID ilişkisi, isimden bağımsız id, simetri ölçüsü, kilitli hareket ret, görünmeyen grup ret, hedef parça değişimi ve değişmeyen kardeş. T07 yerel bölge hacmi +33.95 mm³; uzaktaki nokta alanı değişmedi.
- İlk T08 oyuk 0.5 mm yarıçapta 0.8 mm sampling sırasında sıfır-alan STL triangle oluşturdu ve beklenen gibi 422 ile kesildi. Filtreyi gevşetmedim; groove'u 1.4 mm yarıçap/0.8 mm blend yaptım. Doğrulamada cavity −24.80 mm³, ridge +1.76 mm³, groove −23.09 mm³ oldu.
- Üst görev ilk T08 ekranında göz çukurunu tırtıklı, yele tutamını görünmez buldu. Örnek 30×16×32 mm düz kafa yerine uzatılmış burun ve öne yerleştirilmiş, 1.1–1.7 mm kalınlıkta iki tutamla değiştirildi; güncel STL testi geçti. Görsel screenshot henüz alınmadı, T08 görsel kabulü açık.
### T08 ince mesh bağlantı incelemesi — 2026-10-19

- Parent'in fresh tab ince kalite doğrulaması: 8766 açıkken `#run` başarılı; 29×17,6×32 mm; SDF 0,55 mm; 36.572 triangle. Görünür yele kabartısı ve tam kadraj onayı alındı. Önceki `Failed to fetch`, screenshot sonrası 8766 geçici servisini benim kapatmamdan kaynaklandı; API tekrar açılınca geçti.
- Fine STL fixture karşılaştırması: base=1 yüzey kabuğu; mane1+base=1; mane2+base=1; iki mane + base (oyuksuz)=2; cavities + base=1; tam model=2. Normal örnek=1. Bu, iki ayrı tutamın beraber ince örneklemede dar/ayrık temas riski oluşturduğunu gösteriyor.
- T08 yeniden pending. Yele merkez hatları yüzey içine daha sağlam gömülerek overlap artırılacak; kabul için fine STL `surfaceComponents=1`, mevcut göz/yele görünürlüğü ve yeni IAB screenshot gerekir. Üçgen/kabuk sayısı baskı dayanımı garantisi değildir.
- Düzeltme: iki strand centerline base yüzeyine ~1,1–1,3 mm daha içeriden bindirildi. Normal fixture 15.866 tri, 793.384 byte, 28,998×16,271×31,998 mm, hacim 7.131,56 mm³ ve 1 shell verdi. Fine izole test artık base=1 / her mane=1 / both=1 / cavity=1 / full=1. Fine mesh'in connectedness sorunu düzeldi.
- Parent fresh IAB 8766 screenshot: güncel koordinatlar, fine 0,55 mm, 35.214 tri, 29,0×16,3×32,0 mm, 1 surface shell. Canvas 637×395, bbox 151×183 (%47,8); göz/burun çukuru ve üst-sol yele çıkıntısı okunur. UI `#run` başarılı. T08 verified; bu gözlem foto-gerçekçi anatomiyi, kullanıcı estetik onayını veya fiziksel baskıyı iddia etmez. 8766 test sunucusu kontrol sonrası kapatıldı; 8765 PID 9228'e dokunulmadı.

### T14 yerel referans paneli — 2026-10-19

- Ne değiştirdim: `server.mjs` yalnız `/api/reference/at-kafasi` isteğinde `outputs/at-kafasi/referans.jpg` dosyasını JPEG olarak sunuyor. `index.html`, `src/main.js`, `src/style.css` at-kafasi presetine bağlı panel, yan fotoğraf, görünüş üstü opacity/zoom/yatay-dikey ayarı ve overlay düğmesini ekliyor. Overlay açılırken kamera ön + ortografik görünüşe geçiyor.
- Neden: brif tek referansı proje içinde gösterme ve karşılaştırmayı kolaylaştırmayı istiyor; fotoğrafın perspektif açısı ortografik geometriyle tam eşleşmez, görüntüden ölçek/3D rekonstrüksiyon çıkarmak doğru olmaz.
- Kaynak/mahremiyet: `outputs/at-kafasi/README.md` mevcut kaydı Doğukan tarafından sağlanan fotoğraf diye tanımlıyor. Dosya 36,854 byte; SHA-256 `3721DA1B7B7A641333BBB6607864E5DED8A959E3F44B924B998CCA9AEBEB4E52`. Kamuya açık lisans/yeniden dağıtım hakkı belgelenmemiş; özellik yalnız mevcut proje dosyasını yerel sunucudan okuyor; upload, uzak fetch veya yeni asset ekleme yok.
- Doğrulama: ilk sandbox `npm run build` config erişimi nedeniyle reddedildi; proje kapsamlı yükseltilmiş çalıştırma geçti. Daha sonra IAB açılışında `.runtime/runs/...` temizliği `EPERM rmdir` verdi; iki server'ın ortak çalışma klasöründe aynı geçici run klasörlerini temizlemesi yarış oluşturabilir. Parent talimatıyla CAD üretimi yeniden denenmedi ve 8765 user-owned sürece dokunulmadı. `node --check` geçti; son build 519,40 kB JS chunk uyarısıyla başarılı. Endpoint testi 200 / `image/jpeg` / 36,854 B / aynı SHA verdi.
- İlk IAB AX kontrolü panel/kaynak/dört slider öğelerini gösterdi. Sonraki kontrol overlay img'nin `src` değerinin boş olduğunu yakaladı; `index.html`'e `/api/reference/at-kafasi` kaynağı eklendi, dist tekrar build edildi ve kaynak, dist, canlı root HTML'de tam URL doğrulandı. Parent fresh IAB'de overlay `naturalWidth=554` gördü; toggle front+orthographic seçti ve fotoğraf viewport'ta göründü. Slider klavye ile opacity 55→54, zoom 100→101, x 0→1, y 0→−1 yaptı; inline opacity/transform güncellendi. T14 yerel referans paneli/overlay/kontrolleri `verified (sınırlı dilim)`.
- CAD mesh overlay testine `.runtime/runs` cleanup `EPERM` engel oldu. İki server aynı root'taki run klasörlerini silebileceği için yarış olası; PID/CIM sorgusu sandbox access denied, parent talimatıyla CAD API tekrar çağrılmadı. 8765 kullanıcı server'ı açık bırakıldı; 8766'yı çalıştıran exec session 56971 dokümantasyon sonrası kapatıldı. Model üstünde foto hizası, referansa göre siluet değerlendirmesi pending.

### T15 şemalı at kafası parametreleri — 2026-10-19

- Ne değiştirdim: `models/at-kafasi.parameters.json` büst yüksekliği (120–190/5 mm) ve kulak uzunluğu (24–52/2 mm) için tip/birim/min/max/step/default tanımlıyor. `/api/examples` bu sidecar şemasını örneğe ekliyor. `server.mjs` örnek kimliğini ve şema parametrelerini doğrulayıp çalışma klasörüne `parameters.json` yazıyor. Worker bunu `parameters` nesnesi olarak CAD/organic kaynak fonksiyonuna enjekte ediyor; sonuç ve CAD parça metadata'sı seçilen değerleri taşıyor. `models/at-kafasi.js` bu iki alanı geometriye bağlıyor. `index.html`/`src/main.js`/`src/style.css` şema kontrollü range paneli, numeric readout, 700 ms debounce, busy'de disabled, parametre değişince eski indirmeyi kapatma ve “henüz üretilmedi” durumunu ekliyor.
- Neden: kaynak satırlarını regex ile metin değiştirerek slider bağlamak, ölçüleri ve tüm modeli yanlış eşleyebilir. Değerleri kod metninden ayrı JSON ve doğrulanmış schema üzerinden geçirmek parametre niyetini açık tutar.
- Testte bulunan hata ve düzeltme: ilk izole 3 worker testi gösterdi ki mevcut normalize katsayısı değişken kulak tepesine göre hesaplanınca kulak uzunluğu tüm büstü de küçültüyordu. Modeli default 166 mm nominal envelope'a göre normalize ettim. Böylece kulak ölçüsü gövde ölçüsünü etkilemiyor, yükseklik bütün modeli oranlı ölçekliyor.
- Geometri kanıtı: worker'lar `%TEMP%/kodla3d-t15-param-check-fix` altında server API'sini çağırmadan çalıştı. Default `yukseklik=160,kulakUzunlugu=39`: bbox 121.4458×48.1928×160.0000 mm, 187,072 tri, 182,100.75 mm³; height 180: 136.6265×54.2169×180.0000 mm, 190,776 tri, 259,280.16 mm³; ear 51/height 160: X/Y bbox base'le aynı, Z yalnız 160→171.5663 mm, volume 182,100.75→182,775.04 mm³, 200,706 tri. Üçü worker `ok:true`, STEP/STL yazdı.
- Build: `node --check server.mjs`, `node --check model-worker.mjs`, `node --check src/main.js` ve `npm run build` geçti; ana JS 521.12 kB, Vite 500 KB sınır uyarısı var. `node --check models/at-kafasi.js` örnek snippet'teki üst seviye `return` nedeniyle başarısız olur; bu dosyalar worker `new Function` içinde çalıştırılan kaynak metnidir, normal ES module değildir; model geometri testini doğru worker context'i doğruladı.
- HTTP: GET `/api/examples` schema v1 ve iki parametreyi verdi. `yukseklik=195`, step'e uymayan `161`, string `kulakUzunlugu` istekleri build başlamadan 400 ve ilgili min/max/step mesajıyla reddedildi; hiçbir worker/run temizliği tetiklenmedi. `npm run build` geçti; 521,12 kB JS chunk uyarısı var.
- T15 sonucu: parent talimatıyla API schema + validation + ayrı worker parametre enjeksiyonu ve STL/bounds etkisi `verified (sınırlı dilim)`. UI sayfası init'te otomatik CAD build yaptığından ortak `.runtime/runs` `EPERM` cleanup yarışı sürerken IAB'de slider/debounce/freshness interaction test edilmedi; 8765'e dokunulmadı, 8766 test session 44897 kapatıldı. Slider UI, stale-download interaction, debounce live kabulü, toggle/enum/angle ve genel parametre schema'sı pending.

### T16 kalıcı proje — inceleme başlangıcı — 2026-10-19

- İnceleme: kullanıcı projeleri/manifest alanı yok; çalışma kaynağı localStorage source/mode/quality ve modeller `models/*.js`. Son 15 run temizliği `.runtime/runs` altına sınırlı. `outputs/` saklanan model/reference materyalidir; uygulamanın import/export akışı bunu değiştirmemeli.
- Kod (inprogress): `index.html`/`src/main.js`/`src/style.css` proje açma ve `.kodla3d.json` indirme kontrolleri. Manifest v1 model source/mode/quality/example/parameters, relative reference path+SHA+attribution, engine/API/result schema, camera/projection kaydediyor. Import file picker ile kullanıcının seçtiği JSON'u okur; JSON.parse + strict format/version/size/mode/quality/view/ref path/current parameter schema validation uygular. JS kaynak yürütülmüyor; “Modeli üret” veya auto-build olmadan geometri çalıştırılmaz. Import mevcut değişiklikler manifest snapshot'ından farklıysa onay ister, dosya kaynağı değişince eski STL/STEP indirmeyi kapatır. `beforeunload` ve proje dirty state'i; manifest indirme sonrası kaydedilen snapshot.
- `?preview=1` güvenli UI inceleme yolu: health/examples GET ile seçili örneği/şemayı doldurur; ilk otomatik CAD build'i ve “Modeli üret” düğmesini kapatır, parametre debounce'unu da build'e bağlamaz. Böylece ortak `.runtime/runs` temizliğine dokunmadan yalnız editor/proje ayarlarını önizlemeyi amaçlıyor. Bu route ve kod henüz build/IAB ile doğrulanmadı.
- T16 çalışmasında önceki `npm run build` sonucu geçerli kabul edilmemeli: en son T16 HTML/JS/CSS değişiklikleri sonrası `node --check`, `npm run build`, manifest indir/aç roundtrip, schema bozuk/çok büyük dosya, eksik/hash farklı referans, sürüm farkı, dirty warning ve IAB kontrolleri çalıştırılmadı. Uzun test veya test server'ı başlatılmadı; 8765'e dokunulmadı.
- Açık kapsam: Save As/üstüne kaydet, undo/redo veya eski başarılı sürüm history'si henüz yok. Temiz devamın ilk adımı `node --check src/main.js` ve yükseltilmiş proje içi `npm run build`; sonra sadece `?preview=1` ile paneli kontrol edip user-selected test manifest'ini aç/kaydet ve validation akışını doğrula. Normal route'ta worker build, shared run klasörü güvenli ayrılana kadar yeniden denenmemeli.

### T16 devamı — proje parametresi düzeltmesi — 2026-10-19

- Ne değiştirdim: `models/at-kafasi.parameters.json` içindeki `kulakUzunlugu.step` değerini 2 mm'den 1 mm'ye indirdim.
- Neden: default 39 mm, min 24 mm ve step 2 ile hizalı değildi. IAB önizlemesinde slider 40 mm'ye yuvarlanırken gösterge/kaynak 39 mm'de kalıyordu; bu değer manifest validator'ın step kontrolünü de geçemiyordu.
- Doğrulama: `node --check src/main.js` ve `npm run build` geçti. `?preview=1&model=at-kafasi` hard reload sonrası slider ve readout ikisi de 39 mm gösterdi; `Modeli üret`, STL ve STEP indirme kontrolleri disabled kaldı. Proje kaydetme durumu düğmeye basınca `Proje dosyasıyla eşleşiyor.` oldu.
- Sınır: IAB indirmesi standart `C:\Users\doguk\Downloads` konumunda bulunmadı; dosya içeriği ve gerçek aç-kaydet roundtrip kanıtı yok. Geçerli/hatalı import, ref/hash ve sürüm uyarıları, file size limitleri ve leave warning hâlâ bekliyor; T16 tamamlanmadı.

### T11–T16 devamı — 2026-10-19

- `src/model-api.js`/worker'a polygon profil ile genel yol süpürme (`profilSupur`) ve kesit loft'u (`profilLoft`) eklendi. `verify:sweep` gerçek CAD katısı, binary STL, STEP ISO başlığı, loft bounds/hacmi ve dejenere path reddini doğruladı. Neden: T11'de eksik olan serbest profil loft/sweep komutlarını model kodundan çağırabilmek.
- `src/parameter-schema.js` ortak server/UI validation kaynağı oldu; number, angle, boolean ve enum desteklendi. At modeli yele/yüz toggle ve burun açısı parametresi aldı. Neden: küçük kod üreten AI ve kullanıcı aynı şemada doğrulanabilir aralıklarla değişiklik yapabilsin.
- `src/project-manifest.js` proje açma validator'ına ayrıldı; boş/büyük kaynak, yol traversal, SHA biçimi, motor modu/örnek ve typed parameters sınanıyor. `verify:project` geçerli fixture normalizasyonunu ve invalid girdileri test ediyor. Import edilen JS otomatik çalıştırılmaz.
- Responsive canvas kuralı: 900 px altı `.viewer-panel` yüksekliği 400 px ve `#viewport` minimum yüksekliği 260 px. Önceki 100% height responsive override nedeniyle canvas sıfıra düşebiliyordu. Güncel 8766 preview'de canvas/grid ve referans overlay fotoğrafı render edildi.
- UI kanıtı: slider 160→190 mm; geometry bbox Z=190 mm; stale STL/STEP disabled iken build, sonra enabled fresh result. Yele false ile volume 304.94→294.39 cm³ ve faces 111→75. Proje save UI durumu temiz. Gerçek indirme/tekrar import file chooser ile doğrulanmadı.
- `npm run verify:cad`, `verify:sweep`, `verify:parts` (port 8766), `verify:parameters`, `verify:project`, syntax checks ve `npm run build` geçti. Build'in JS chunk'ı 529.31 kB; Vite >500 kB uyarısı sürüyor.
- T12'nin kullanıcı kabulü tamamlanmadı: CAD parça başına kimlikli mesh yok, UI tek birleşik preview gösteriyor. T13'te tek dosya multiview export eksik; T16 gerçek file roundtrip, Save As ve history eksik. Bu sınırlar kabul edilmeden bu milestone'lar verified sayılmaz.

### T13/T14 görünüş kaydı ve at kamera yönleri — 2026-10-19

- Viewer'a 6 sabit kamerayı 3×2 kompozisyonda PNG'e kaydeden düğme eklendi. Render sırasında 480×360 karolar kullanılıyor, üst/alt boşlukta görünüş etiketi yazılıyor. Referans overlay geçici olarak gizlenir, PNG blob oluşturulur, sonra preview kamerasının gerçek pozisyon/rotation/up/zoom/target geri yüklenir. Neden: atın ön/profil formunu her seferinde elle kamera aramadan karşılaştırmak.
- Brif at kafasının +X yönüne baktığını gösterirken varsayılan CAD kamera eşlemesi Ön'ü +Y'den görüyordu. Yalnız `at-kafasi` presetinde Ön/Arka ±X, Sol/Sağ ∓Y olarak eşlendi; overlay açılışı Sol+ortografik seçer. Diğer CAD modellerinin standart eksen haritası değişmedi.
- IAB: 70×40×35 mm bağlantı aparatı ve at büstünde 6 görünüşlü PNG tıklaması “indirildi” durumuna ulaştı; render sonrası mevcut izometrik kamera ve mesh geri geldi. Yeni at tabında Ön görünüş yüzü, Sol görünüş profili gösterdi. Fotoğraf overlay aynı profil yönünde görüldü. Fotoğraf tek perspektif olduğundan otomatik/gerçek geometrik hizalama iddia edilmez.
- Responsive canvas düzeltmesi dar ekranlarda 400 px viewer ve en az 260 px canvas alanı veriyor; preview-only sayfasında canvas/grid ve referans görseli görünür.
- Bilinen sınır: indirilen PNG'nin gerçek dosya içeriği IAB CUA Downloads yolunda bulunamadı; canvas.toBlob başarılı olması ve UI durum metni üretim kanıtı, dosyayı harici viewer'da açıp piksel-kare doğrulaması değildir. Ön/yan form görünür fakat fotoğraf-referans geometrik benzerlik değerlendirmesi manuel kalır.

### T15 açı ve T16 dosya adı — 2026-10-19

- At modelinde burunAcisi=5° slider canlı IAB'de otomatik yeniden üretim başlattı; worker 127,3×48,2×160 mm / 187,13 cm³ / 105 face sonucu verdi ve parameter state eşleşti. Neden: UI'da tanımlı açı yalnızca gösterge olarak kalmasın, gerçek model ekseninde geometriyi değiştirsin.
- Proje paneline dosya adı girişi ve Farklı kaydet/indir düğmesi eklendi. Manifest metadata adı ve indirilen filename normalize edilmiş project-name'den gelir; isim currentProjectSnapshot'a dahil, dolayısıyla kayıtsız ad değişikliği dirty sayılır. Manifest validator boş/uzun/geçersiz filename'i reddeder.
- Preview-only IAB'de dosya adı at-kafasi-test-save-as yapıldı; save düğmesi Proje dosyasıyla eşleşiyor durumuna geçti. JSON gerçek browser Downloads yolunda bulunamadığından tekrar açılıp import edildiği iddia edilmez.
- verify:project, verify:parameters, verify:sweep, verify:cad, verify:parts ve production build geçti. Son JS chunk 531,71 kB; Vite 500 kB üstü uyarısı.

### T16 gerçek manifest gidiş-dönüşü ve T18 organik GLB — 2026-10-19

- T16 gerçek tarayıcı turu: kendi izole 8767 preview sekmesinde `at-kafasi.kodla3d.json` Farklı kaydet düğmesiyle indirildi; tarayıcı indirme olayı dosya yolunu `C:\Users\doguk\Downloads\at-kafasi.kodla3d.json` olarak verdi ve durum `Proje dosyasıyla eşleşiyor.` oldu. Aynı dosya `Proje aç` file chooser'ına verildi; durum `Proje açıldı; geometriyi üretmeden önce kaynağı incele.` ve textarea kaynak boyutu 3.304 karakter çıktı. Geometri otomatik çalıştırılmadı. Böylece önceki dosya chooser sınırlaması kapandı; manifest dirty guard/versiyon geçmişi yine açık.
- T18 organik GLB: `GLTFExporter` lazy on-demand çalışacak şekilde UI'ya eklendi. Organik modelin Three.js mesh'i 0.001 scene matrix ile mm'den glTF metre birimine dönüştürülüyor. Düğme yalnız son build güncelse ve organik mesh modundaysa açılıyor; CAD STEP ve STL gerçek worker dosyaları olarak kalıyor. Organik için STEP devre dışı gerekçesi title'da yazıyor.
- Doğrulama: güncel `npm run build` başarılı; `verify:project`, `verify:parameters`, `verify:sweep` geçti. `KODLA3D_PORT=8767` ile `verify:cad` ve `verify:parts` geçti; kullanıcı 8765 sürecine dokunulmadı. IAB'de `organik-boyun` gerçek üretildi; GLB 689.392 B indirildi. `npm run verify:glb -- <model.glb>` binary header (magic glTF, v2, tam uzunluk), JSON chunk, 9.560 triangle accessor ve matrix diagonal `[0.001,0.001,0.001]` kontrol etti; mesh bounds metre cinsine çevrildiğinde 0.01799×0.01100×0.03499 m. GLTFExporter lazy import olarak 35,25 kB ayrı chunk'a bölündü; ana chunk 542,09 kB (500 kB uyarısı sürüyor).
- Not: ilk GLB doğrulama komutu node transform'ını `scale` alanında varsayarak başarısız oldu; dosyanın doğru `matrix` temsili olduğunu okuduktan sonra doğrulayıcı kontrolü gerçek GLB sözleşmesine uyarladım. Uygulama hatası değil, test varsayımıydı.
- Kalan genel brief: T12 parça kimlikli önizleme/picking mimari engelli; T17 editör, T19 mesh/print raporu, T20 cancel/recovery, T21 cache/perf, T22 tam AI sözleşmesi/CLI, T23 paketleme/lisans, T24 at V2 görsel/teknik teslim, T25 fixture seti, T26 görev benchmark'ı ve T27 uçtan uca kabul tamamlanmadı. T18 sınırlı dilimdir. T16 versiyon geçmişi/undo ve dirty/reference mismatch UI kabulü açık.
### 2026-10-19 · T16 başarılı sürüm geçmişi

- Proje manifest'i son 10 başarılı üretimin model kaynak/ayar snapshot'ını ve üretim hash/ölçü/hacim sonuçlarını saklar. Kullanıcı eski kaynağı geri açabilir; geometriyi tekrar üretmeden eski üretim dosyası indirilemez.
- Eski v1 dosyaları geçmiş alanı olmadan açılabilir. Geçmiş 700 KB ile sınırlıdır; proje manifest validator'ı kayıt sayısı, kaynak/ayar şeması ve ölçüm değerlerini doğrular.
- Gerekçe: T16'da yalnız tek güncel kaynak korunuyordu; başarılı önceki tasarıma dönüş mümkün değildi.
- Doğrulama: `npm run verify:project` ve `npm run build` geçti. İzole 8767'de bu oturumun canlı yeniden üret/kaydet/aç/geri yükle denemesi browser etkileşimini çalıştıramadı; canlı geçmiş turu doğrulanmış sayılmıyor.

### T11–T16 kabul ve provenance kapanışı — 2026-10-19

- T11 verifier'daki sahte kapsam düzeltildi: `kapakli-kutu-govdesi` yalnız boş gövdeyi test ediyordu. Yeni fixture gövde + geçme dili + kapaktan gerçek 2 katı çıkarır; 34×24×17,5 mm, 6022,72 mm³, STL 56 üçgen, STEP 62.823 B. Neden: kabul metnindeki çıkarılabilir kapağın gerçekten bulunması.
- T12 birleşik CAD parçası kimliğini bbox tahmini yerine OCCT boolean face history ile preview triangle gruplarına taşıdı. `model-api.js` yüz sahipliğini tutuyor; worker `preview.bin` oluşturuyor; Three.js raycast parça ID'sini ağaç seçimine eşliyor. At büstünde 111 yüzün 5'i sol, 5'i sağ kulak kaynağıyla bağlandı. Ağaçtan gizleme, izolasyon, focus, seçim ayrıntıları ve kaynak kodu bağlantısı eklendi/doğrulandı. Sınırlı yüz geçmişi fallback'i korunuyor.
- T15 provenance verifier 39 mm/45 mm kulak uzunluklarında iki gerçek CAD build karşılaştırıyor: her iki kulak üst Z=160,00→165,78 mm; boyun, baş, yele ve kaide bounds'ları aynı.
- T16 tarayıcı manifest indir/import/yeni sekmede aynı sonucu üret akışını tamamladı; 1 başarılı sürüm ve parametreler geri geldi, build öncesi dışa aktarım kapalıydı. Dirty/reload koruması canlı kontrol edildi. Kamera/projeksiyon manifestte saklanıyor; kamera değişmiş dosyanın yeniden import sonrası UI değeri sekme timeout'u nedeniyle bu tur teyit edilemedi.
- Proje docs: AI kullanım rehberindeki T12 tek-mesh blocker metni güncellendi; İLERLEME ve DOGRULAMA satırları yeni kanıtı taşıyor.
- Doğrulama: `verify:cad`, `verify:sweep`, `verify:cad-provenance`, `verify:at-part-provenance`, `verify:parts`, `verify:parameters`, `verify:project`, `npm run build` geçti. Bundle 551,97 kB; Vite 500 kB uyarısı sürüyor. Yerel altı görünüş PNG'si 1440×788/295.552 B olarak açıldı.
- Her iki izole UI testi ve verifier 8767'yi kullandı; 8765 kullanıcı sunucusuna dokunulmadı. Açık kullanıcı girdisi: at modelinin görsel kabulü ve referans fotoğrafının lisans kaydı.

### T16 sürüm geri açma, kamera ve kalıcı teslim — 2026-10-19

- Preview-only test manifestinde iki başarılı sürüm açıldı; önceki 45 mm kulak sürümü seçilip geri yüklendi, parametre slider'ı 45 mm oldu. Kirli proje durumuna geçti; geometri/export preview-only modunda kapalı kaldı.
- Kamera/projeksiyon manifesti `left`/`orthographic` olarak içe aktarıldı ve UI select'lerinde aynı değerler görüldü.
- Gerçek browser proje dosyası ve 6-view PNG `outputs/at-kafasi/` altına kalıcı örnek olarak kopyalandı; README'ye açılış/notlar eklendi. Referans resmi aynı klasörde kalmalıdır.
- Doğrulama bundle uyarısı hariç geçti; yalnız test 8767'de yapıldı, 8765'e dokunulmadı.
### 2026-10-19 · T17 editör ve hata düzeltme — ilk dilim

- Ne yaptım: kod alanına küçük, kütüphane gerektirmeyen JavaScript renklendirme katmanı, eşzamanlı satır numaraları, arama ve eşleşme sayacı/ileri-geri, Tab ile çok satır girintisi, Shift+Tab ile çıkarma, Enter ile girinti devamı, undo/redo düğmeleri eklendi. Ctrl+F aramaya odaklanır.
- Hata akışı: worker kaynak kodunu `node:vm.Script` ile aynı fonksiyon bağlamında sözdizimi açısından kontrol eder; hata satır/sütun bilgisini API cevabına ekler. Editör hatalı satırı işaretler, durum `Hata · satır N` der, eski mesh'i “Önceki sonuç” diye etiketler ve kaynak/STEP/STL/GLB indirmelerini kapatır. Düzeltilip yeniden üretildiğinde güncel çıktı durumu ve indirmeler geri açılır. Geometri motorunun parça/parametre bağlamlı hata mesajları korunur.
- Veri koruma: örnek değişimi, proje başlangıç snapshot'ından bu yana düzenleme varsa onay ister. `?model=` URL'si tarayıcıdaki kaynak koddan farklıysa başlangıçta kodu koruma seçeneği sunar; örnek adı localStorage'da saklanır.
- Neden: textarea'nın mevcut line gutter ve Tab desteği tek başına hızlı kod düzenlemeyi, satır bazlı hata teşhisini ve eski/yeni geometri ayrımını sağlamıyordu; URL örneği de kaydedilmiş taslağı sessizce değiştirebiliyordu.
- Canlı doğrulama: geçici localhost 8768 oturumunda 80×50×25 mm kutu önce üretildi. İki satırlı kaynaktaki 2. satır SyntaxError olarak gösterildi; önceki başarılı 30×20×10 mm model görünür kaldı, bütün geometri indirmeleri disabled oldu. Kod düzeltilince 6.00 cm³ katı yeniden üretildi ve güncel durumu geldi. `width` araması 2 eşleşme buldu; Tab/Shift+Tab ve Ctrl+Z/Ctrl+Y ile geri al/yinele denendi. Farklı `?model=kutu` URL'sinde farklı taslak bulunduğunda uyarı çıktı ve taslak korundu. Örnek dropdown'ında kirli taslak uyarısının native onayını otomasyonla güvenilir şekilde sonuçlandıramadım; bu UI dalı tam kabul edilmiş sayılmıyor.
- Doğrulama: `node --check src/main.js`, `node --check model-worker.mjs` ve `npm run build` geçti. Ana bundle 557,30 kB; Vite'ın 500 kB chunk uyarısı mevcut. Test sunucusu yalnız 127.0.0.1:8768'de, geçici run diziniyle çalıştı; kullanıcı uygulama portları kullanılmadı.

### 2026-10-19 · T19 ön teknik mesh/baskı raporu

- Ne yaptım: `src/mesh-report.js` binary STL dosyasından koordinat sonluluğu, boş mesh, tam sıfır alan, duplicate yüz, bounds, exact-float32 vertex eşleşmesi, kenar manifoldluğu, yön tutarlılığı, edge-connected bileşenler ve kapalı bileşen signed volume hesaplıyor. Worker CAD ve organik yanıtlara `meshReport` ekliyor; arayüzde genişletilebilir teknik rapor gösteriliyor.
- Tolerans/onarım: `weldEpsilonMm: 0`; yakın vertex'ler epsilon ile birleştirilmiyor. Binary STL indeks dizisi taşımaz, bu yüzden index range kontrolü “uygulanamaz” diye bildirilir. CAD'in mevcut temizlik adımı yalnız üç aynı köşeli sıfır uzunluklu üçgeni atar; rapor üçgen, bounds, signed hacim, bileşen ve topoloji özetini öncesi/sonrası verir. Organik STL aynen kalır. 750.000 üçgen üstünde rapor `partial` olarak işaretlenir.
- Sınırlar: self-intersection, minimum duvar/özellik, düz taban, overhang/support ve yazıcı/nozul/reçine profili kontrol edilmiyor. UI bu eksikleri gösterir ve “baskıya kesin hazır” demez. Bu rapor baskı garantisi değildir.
- Neden: üçgen sayısı tek başına mesh'in kapalı, yönü tutarlı veya üretilebilir olduğunu göstermez; onarım da hacmi/bağlantıyı sessizce değiştirmemeli.
- Fixture kanıtı: `npm run verify:mesh-report` boş STL'yi failed, kapalı tetra'yı +1/6 mm³, açık tetra'yı 3 sınır kenarı, duplicate yüzü 1, zero-area üçgeni 1 ve NaN koordinatını yakaladı. Sağlam fixture'e onarım uygulanmadı.
- Canlı kanıt: 80×50×25 mm CAD kutu STL 1.052 üçgen, 528 vertex, 1 kapalı edge-connected bileşen, 0 boundary/non-manifold/orientation edge, repair=false. Organik boyun 9.560 üçgen, 1 bileşen, 0 boundary/non-manifold/orientation edge; onarım öncesi/sonrası bounds 17,99×11,00×34,99 mm ve signed hacim 2.694,38 mm³ aynı, repair=false.
- Doğrulama: syntax kontrolleri, `npm run verify:mesh-report` ve `npm run build` geçti. Bundle 558,03 kB; Vite 500 kB uyarısı sürüyor. Yerel UI testi 8768 ve izole Temp run klasörünü kullandı; kullanıcı portuna dokunulmadı.

### 2026-10-19 · T20 iş durumu ve iptal — ilk dilim

- Ne yaptım: build'e istemci iş UUID'si, GET durum endpoint'i ve DELETE iptal endpoint'i eklendi. Worker geometri/mesh/export aşamalarını geçici dosyaya atomik yazar; API bunları 120 ms aralıkla okuyup aşama ve süreyi günceller. UI 350 ms'de durum alır ve “İşi iptal et” düğmesi sunar. Son 30 iş bellekte tutulur.
- Neden: uzun organik örneklerde kullanıcı işin nerede olduğunu görsün; kilitlenmiş model üretimi tüm uygulamayı yeniden başlatma gerektirmeden sonlandırılabilsin.
- Güvenlik/toparlanma: iptal veya timeout'ta yalnız worker'ın kendi PID ağacı kapatılır; `finally` her hata/iptal yolunda busy kilidini açar. Sınırlar: 100 KB model kodu, 60 sn worker (varsayılan), 1 MiB log, dosya başına 100 MiB ve toplam 250 MiB çıktı, organik örnekleme 4M hücre, STL raporu 750.000 üçgen, son 15 run klasörü. İptal/hata halinde eski mesh önizlemede kalır ama güncel kaynak indirme yetkisi kapalıdır.
- Kanıt: syntax kontrolleri, `npm run verify:jobs` ve `npm run build` geçti. İzole localhost/Temp testinde sonsuz döngü iptali → CAD üretimi; kısaltılmış 3,5 sn timeout (408) → CAD üretimi; `process.exit(7)` worker çökmesi → CAD üretimi geçti. Bundle 558,78 kB; Vite 500 kB uyarısı sürüyor.
- Açık kalan kabul: tarayıcıda üretim sırasında kaynak düzenleyip geç gelen eski sonucu görsel olarak kontrol et; metin/kaynak korunmalı ve indirmeler yalnız aynı kaynakla eşleşince açılmalı. Backend kabulü doğrulandı, UI genel kabulü inprogress.

### 2026-10-19 · T21 çıktı cache ve ölçüm

- Ne yaptım: başarılı üretimin STL/STEP/kaynak/önizleme dosyalarını mevcut run klasöründen bağlayan, en fazla 8 anahtarlı process-local LRU ekledim. Her tekrar yeni iş/run kimliği alır ve cache dosyalarını yeni run klasörüne kopyalar; endpoint file-ID sözleşmesi aynı kalır. `/api/cache/stats` sayaç ve cache implementation/reference hash'lerini gösterir.
- Cache anahtarı: model source, mode, quality, normalized parameters, example, schema/API sürümü, dependency manifest/lockfile, server/worker/model API/validator/mesh report source ve at referans görselinin SHA-256'sı. Job UUID anahtara girmez. Restart cache'i temizler; önceki 15 run klasöründen biri temizlendiyse kopya bulunamaz ve güvenli cache miss'te worker yeniden çalışır.
- Neden: aynı geometriyi yeniden üçgenleyip STEP/STL yazmamak; cache hit'te bağımsız çıktı dosyalarını id ile servis etmeye devam etmek. Worker havuzuna geçmedim: T01 at kafası worker tepe RSS ≈910 MiB ve işler arası bellek sıfırlama/izolasyon kanıtı yok. Serbest JavaScript yüzünden parça bağımlılık DAG'ı olmadığı için kısmi yeniden hesaplama iddiası da yok.
- Sınır: en çok 8 indeks girdisi; cache ayrı blob deposu değil, T20'nin 15 run klasörü ve 250 MiB/job sınırına bağlı. Organik 4M hücre sınırında açık hata var, otomatik düşük kaliteye geçiş yapılmıyor.
- Kanıt: `npm run verify:jobs` identical cache hit, STL SHA/size eşitliği, quality-key invalidation ve T20 cancellation/timeout/crash recovery senaryolarını geçti. `docs/cache-benchmark.json`: aynı 30×20×10 mm CAD için 5 sample; ilk wall 1.216 s / worker 509 ms, dört warm cache hit'in median wall'ı 15,364 ms, restore 5–6 ms; tüm STL'ler 684 B ve SHA `a70d8c…186eb`.
- Hedef güncelleme: T01 üçlü medianları kutu 1,436 s, aparat 1,503 s, at kafası 46,378 s. Yerel hedefler basit CAD cold ≤2 s, bu boyun fixture'ı taslak worker ≤1 s, at cold build ≤50 s. Sadece tek mini CAD varyantında cache ölçüldü; organik aileler ve at için cache hız dağılımı henüz ölçülmedi.

### 2026-10-19 · T22 JSON API ve CLI — ilk dilim

- Ne yaptım: `docs/HTTP-API.md` health/examples/jobs/cancel/cache/build/file rotalarını, istek ve yanıt alanlarını, sınırları ve örnekleri tanımlar. `scripts/kodla3d.mjs` ile health, examples, status, build, progress polling, Ctrl+C cancel ve `--out` dosya indirme var. API syntax error code/source location/hash, parameter path, job/stage ve ham stack'i ayırır; organik/CAD ölçüm, mesh raporu ve format bağlantılarını JSON'da döndürür. AI kullanım rehberi HTTP sözleşmesine bağlandı.
- Neden: bir ajan örnek ve parametre şemasını okuyup kodu doğrudan API'ye gönderebilsin; başarılı çıktıyı ölçü/mesh/indirme ile değerlendirebilsin.
- Kanıt: `node --check`, `npm run verify:parameters`, `npm run verify:jobs`, CLI help ve production build geçti. `verify:jobs` syntax/param error shape, source/parameter context, CLI Kutu üretimi ve STL/STEP/source dosyalarını indirdi. Build 558,77 kB JS; Vite 500 kB chunk uyarısı sürüyor.
- İlk dilimin açık maddesi sabit kameralı görsel artifact idi; aşağıdaki T22 tamamlama kaydı bunu kapatıyor. Otomatik LLM düzeltme döngüsü eklenmedi; model servisi yok.

### 2026-10-19 · T22 sabit görünüş PNG ve API/CLI kabulü

- Ne değiştirdim: `src/mesh-views.js` binary STL'den altı sabit ortografik kamerayı tek 720×408 PNG'e CPU üzerinde rasterize ediyor. CAD ve organik worker bu çıktıyı run klasörüne yazar; API `files.visual` URL'si ve kamera/boyut/üçgen metadata'sı verir; dosya `image/png` olarak sunulur. CLI `--out` ile `views.png` indirir. Render kaynak dosyası cache implementation fingerprint'ine eklendi.
- Neden: API kullanan bir kod ajanı modeli yalnız sayısal ölçülerle değil, API/CLI'den alabileceği sabit açılı görsel ile de değerlendirebilsin.
- Sınırlar: altı görünüş düz gölgelendirmeli küçük bir geometri tanı görselidir; fotogerçekçi değildir. 750.000 üçgen üstü reddedilir. Arayüzün etkileşimli, yüksek çözünürlüklü render'ı detay inceleme için kullanılmaya devam eder.
- Doğrulama: `npm run verify:jobs` geçti. API yanıtı kamera sırası, 720×408 PNG imza/header'ı, cache sonrası PNG byte eşitliği ve CLI `views.png` indirmesini; mevcut hata sözleşmesi, iptal, 408 timeout, worker çökmesi ve toparlanma kontrolleriyle birlikte doğruladı.

### 2026-10-19 · T23 yerel kontrol ve bağımlılık envanteri

- Kullanıcı akışı: `Kodla3D.cmd`/`Kodla3D.ps1` setup, start, status, diagnose ve stop komutları; çift tıklanan `Baslat.cmd` aynı start yoluna bağlandı. `-Port` test/alternatif instance için kullanılabilir. Health cevabı Node, direkt motor/viewer sürümlerini ve kök klasörün kısa hash'ini verir; aynı portta başka kopya varsa launcher ona sahip çıkmaz.
- Kurulum `npm ci` ile lockfile'a bağlı, ardından build alır. Gereksiz Git kontrolü ve vendor repo klonlama kaldırıldı; `vendor/`, `.venv/`, `experimental/` ve kullanıcı `outputs/` içeriği silinmez/değiştirilmez. Proje kodu güvenilen yerel JS olarak kalır; sandbox değildir, sunucu loopback'tedir.
- `docs/LISANSLAR.md` aktif doğrudan paketleri ve vendor snapshot revision/lisans metadata'sını ayırır. Projenin kendi açık kaynak lisansı seçilmedi. Transitive uyum veya LGPL dağıtım etkisi hakkında hukuki kabul verilmedi.
- Neden: günlük kullanıcı, doğru instance'ın çalışıp çalışmadığını ve sürümleri anlayabilsin; durdurma komutu yalnız bu klasörün PID + `server.mjs` yolunu doğrulayarak işlesin. İlk kurulum aktif runtime için gerekmeyen Git/vendor indirmesine takılmasın.
- Doğrulama: ayrı `127.0.0.1:18773` üzerinde başlatma, health/status PID eşleşmesi, Node/npm/dependency diagnose ve güvenli stop gözlendi. İlk Windows PowerShell çalıştırmasında UTF-8 kaynak Türkçe mesajı bozdu; `Kodla3D.ps1` BOM ile kaydedilince düzelmiş mesaj çıktı. Temiz makine kurulumunda `npm ci` bu turda çalıştırılmadı.

### 2026-10-19 · T24 at kafası V2 ilk teknik teslim

- Kaynak/model: V1 (`models/at-kafasi.js`, `outputs/at-kafasi/`) korundu; ayrı `models/at-kafasi-v2.js` ve `at-kafasi-v2.parameters.json` eklendi. Baş/yanak kesitleri sıklaştırıldı; `yanakDolgunlugu` ölçüsü şemaya eklendi; kaş kemeri ve bağlı yele silueti/olukları modellendi. Ayrı yanak ellipsoidini boolean ile birleştiren ilk deneme üç açık STL kenar üretti; kabul edilmedi. Yanak hacmi tek loft profiline taşındı ve kapalı mesh verdi. Görsel kontrolde fazla sivri duran ayrı yele çıkıntıları kaldırılıp ana bağlı ridge kesitleri/olukları düzenlendi.
- Üretim: `npm run build:horse-v2` her iki modeli geçici 127.0.0.1 server'ında, aynı altı CPU ortografik görünüş rasterizer'ıyla kurar. V2 çıktısı `outputs/at-kafasi-v2/` içinde kaynak, STL, STEP, iki PNG, proje manifesti, referans kopyası ve `DOGRULAMA.json` içerir.
- Teknik sonuç: kaide dahil 160 mm, 1 solid, 125 BRep yüz, 180.540 STL üçgen, analiz tam; boundary/non-manifold/yön kenarı 0, tek kapalı bileşen. Hacim 184,93 cm³; V1 182,10 cm³ (+1,55%; anatomi/benzerlik metriği değildir). STEP 2.320.826 B. Mesh raporu baskı profili, min duvar, destek/overhang ya da self-intersection garantisi vermez; STEP bağımsız CAD uygulamasında yeniden açılmadı.
- Doğrulama: `npm run verify:horse-v2`, V1+V2 `verify:parameters`, genel `verify:jobs` ve `npm run build` geçti. Vite ana JS 558,77 kB, 500 kB üstü chunk uyarısı değişmedi. Yalnız geçici 18773 portu kullanıldı; 8765 kullanıcı portuna dokunulmadı.
- Açık: beyaz alın lekesi renkli önizleme (bu CAD/STL tek malzemeli), boyun birleşimlerinin görsel kabulü, kullanıcının at formu onayı, fiziksel baskı ve referans fotoğrafının yeniden dağıtım lisansı.

### 2026-10-19 · T25 AI/geometry fixture çeşitliliği

- `models/organik-sap.js`: dört değişken yarıçaplı kapsül parçasının yumuşak birleşimiyle kavisli, tek bileşenli ergonomik sap örneği. Ana example API listesine otomatik eklendi.
- `docs/AI-FIXTURES.json`: 3 CAD / 5 organik örneğin beklenen model/mesh çıktısını; ayrı kabuk, boş kaynak, 0,2 mm alt-örnekleme probu, 4M hücre bütçesi, V2 dışı parametre ve worker crash/recovery edge cases'ini tanımlar. At büstü T24 V2 artifact testi bu manifestte ayrıca bağlanır.
- `npm run verify:fixtures` izole yerel API'de 8 başarılı örnek + 7 edge/recovery vakasını geçti. Ölçüleri, üçgenleri, bağlı kabukları, boundary/non-manifold kenarları, formatları ve source hash'lerini `docs/AI-FIXTURE-SONUCLARI.json`'a yazar. Crash testinden sonra CAD örneği tekrar üretildi.
- Gözlenen sınır: 0,2 mm çaplı organik küre normal kalite gridinde Manifold `NoError` koduyla geçerli hacim oluşturamadı; T19 raporu da min-feature/wall-size ölçmüyor. Grid aşımı sessiz kalite düşürmek yerine 422 açık hatadır. Bu suite gerçek AI ajan başarısı, fiziksel baskı veya insan estetik kabulü ölçmüyor.

### 2026-10-19 · T26 küçük model görev ölçüm protokolü

- `docs/AI-GOREV-SETI.md` içinde on kısa üretim/revizyon/hata/proje/çıktı görevi; her biri için kod çalışabilirliği, tasarım doğruluğu ve yerel verifier eşlemesi bulunuyor.
- `docs/AI-GOREV-SONUC-SABLONU.json` context bytes/characters/provider token kaynağı, ilk geçerli deneme, revizyon sayısı/süre, doğru parça, format/mesh, görsel reviewer ve tasarım puanını ayrı alanlara ayırıyor. Token veya estetik puan verisi yoksa null/not_run.
- Önceki local API/CAD/parts/project testleri ve T25 fixtures, görev bazlı makine zemini. Gerçek model/provider çağrısı veya ücretli hizmet başlatılmadı; AI başarı yüzdesi iddia edilmez.

### 2026-10-19 · T27 kabul çalışması checkpoint'i

- Kullanıcı isteğiyle mevcut nokta kaydedildi ve çalışma durduruldu. T27 brief/checklist, proje ilerleme tablosu ve test scriptlerinin yazma hedefleri incelendi.
- T27 `inprogress`; bu checkpoint turunda test komutu çalıştırılmadı, kaynak kodu veya kullanıcı çıktısı değiştirilmedi. Bazı eski doğrulayıcıların doğrudan `outputs/cad-authoring`, `outputs/organik-t06-t08` ve `outputs/organik-boyun` klasörlerine yazdığı görüldü; kullanıcı artefaktlarını ezmemek için izole çıktı yolu ayarlanmadan çalıştırılmayacak.
- Sonraki adım: testlerin geçici run/output kökünü destekleyip desteklemediğini denetle; mümkünse geçici klasöre yönlendir. Ardından geometri, CAD/STEP/STL, lifecycle ve UI maddelerini gerçek kanıtla tamamla ve `docs/T27-SON-KABUL-RAPORU.md` oluştur. STEP bağımsız reopen veya gerçek tarayıcı etkileşimi doğrulanamazsa raporda `denenmedi` olarak bırak.

### 2026-10-20 · T27 son teknik kabul

- `scripts/verify-exchange-reopen.mjs` ve `npm run verify:exchange-reopen` eklendi. Kutu, delikli aparat ve saklanan at V2 STEP dosyaları ayrı process'te Replicad/OpenCascade ile; STL'ler Manifold `MeshShape` ile yeniden açıldı. Bounds/hacim/solid/triangle sonuçları raporla eşleşti.
- Eski CAD/organik verifier'lar için `KODLA3D_OUTPUT_ROOT` eklendi; fixture sonuç dosyası `KODLA3D_FIXTURE_RESULTS` ile temp'e yönlendirilebiliyor. Pivot invariant testi eklendi. Kullanıcı `outputs/` klasörleri bu test koşusunda değiştirilmedi.
- Geçti: sweep, parameter, project, mesh-report, job lifecycle, exchange reopen, CAD authoring, first sprint, authoring features, part tree, CAD/At provenance ve AI fixtures. `verify-job-lifecycle` cancel/timeout/worker-crash recovery içeriyor.
- IAB'de T17 örnek confirm accept/cancel, at parametresiyle üretim, hatalı kaynak düzeltme ve T20 üretim sürerken source edit/stale result koruması gözlendi. Proje kaydet UI state'i güncellendi; bu turda indirilen dosya standart Downloads'ta bulunamadı. Gerçek T16 file-picker roundtrip önceki `ILERLEME.md`/`DOGRULAMA.md` kanıtında kalıyor.
- T23 temiz kurulum: proje dışındaki geçici temiz kopyada `npm ci` (60 paket), `npm audit` (0 vulnerability) ve production build geçti; aktif `node_modules` kullanılmadı. Esbuild script allowlist uyarısı ve 558,77 kB Vite chunk uyarısı sürüyor.
- T27 raporu: `docs/T27-SON-KABUL-RAPORU.md`. At V2 görsel kullanıcı kabulü, dış CAD uygulaması, gerçek baskı, küçük-model API benchmark'ı, referans fotoğrafı ve proje lisans kararı hâlâ açık; teknik test sonucu bunların yerine geçirilmedi.

### 2026-10-20 · T24 blaze önizleme devamı

- `src/main.js`: yalnız `at-kafasi-v2` aktif çıktısına viewport için açık renkli Catmull-Rom/TubGeometry çizgisi ekleniyor; iki yan için ayrı çizgiler temizlenebilir bir sahne grubu olarak tutuluyor. CAD mesh kaynak kodu değiştirilmedi; STL/STEP/GLB dışa aktarıcıları yalnız ana mesh'i aldığı için alın izi dosyalara eklenmiyor.
- `index.html`: önizleme altında rengin viewport katmanı olduğunu ve dışa aktarılan formatlara eklenmediğini belirten açıklama eklendi; `src/style.css` görünümünü düzenliyor.
- `npm run build` geçti; güncel ana JS 572,76 kB, Vite'nin 500 kB uyarısı sürüyor. Bu ortamdan izole tarayıcı önizlemesi açılamadığı için model yüzeyine oturma ve çizginin ekran görüntüsüyle kabulü doğrulanmadı. Bu işlev bu nedenle teknik olarak uygulandı ama görsel kabul edilmedi.
- Açık: boyun/baş birleşimi siluetini iyileştirme ve görsel kabul, kullanıcı onayı, fiziksel baskı, dış CAD uygulaması, küçük AI sağlayıcısı benchmark'ı, proje lisans seçimi ve referans görseli yeniden dağıtım hakkı.

### 2026-10-20 · T18 CAD ağ ayarları ve cache

- `index.html`/`src/main.js`: CAD taslak/normal/ince ağ ayarı görünür; seçili tolerans STL ve CAD önizleme ağına uygulanır, yerel taslakta ve proje manifestinde saklanır. Sonuç ölçüsünde kullanılan mm/rad değeri gösterilir.
- `src/project-manifest.js`: eski manifest ve sürüm kayıtlarında ayar yoksa `normal` kullanılır; bilinmeyen preset reddedilir.
- `server.mjs`/`model-worker.mjs`: API ağ presetini doğrular ve worker'a aktarır; cache anahtarı CAD ağ kalitesini içerir. Aynı girdide RAM cache önceki gerçek dosyaları yeni run klasörüne kopyalar, worker/STEP tekrar üretimi yapmaz. Soğuk ilk CAD üretimi STEP'i üretmeye devam eder.
- `docs/LUNA-GELISTIRME-BRIFI-2026-10-19.md`, `docs/HTTP-API.md`, `docs/ILERLEME.md` güncellendi. `npm run build` geçti; main JS 573,81 kB ve Vite 500 kB chunk uyarısı sürüyor. `node --check` server, worker ve manifestte geçti.
- Tarayıcıda yeni seçim/proje round-trip'i ayrıca görsel olarak denenmedi. T24 siluet kabulü, fiziksel baskı, harici CAD, küçük model benchmark'ı, lisans ve referans hakkı açık.
- T24 devamında boyun kesitleri için iki geçici CAD adayı gerçek OpenCascade worker'da üretildi ve altı görünüşte karşılaştırıldı. Geriye çekilmiş ilk aday boyun-başta keskin bir çıkıntı oluşturdu; küçük kaydırmalı ikinci aday boru görünümünü anlamlı azaltmadı. İki aday da `.runtime/runs` altından temizlendi, V2 kaynak/çıktısı korunarak görsel iddia eklenmedi. Bu gerçek build sırasında `cadMeshQuality` kapsam hatası bulundu ve worker'daki değişken kapsamı düzeltilip başarılı aday üretimiyle doğrulandı.

### 2026-10-20 · T24 boyun/omuz silueti ve teslim

- `models/at-kafasi-v2.js`: alt boyun merkezleri omuzdan enseye geriye doğru kıvrılacak şekilde güncellendi. Önceki V2 kaynağı ve V1 modeli korunuyor.
- IAB'de Sol profil gerçek üretimle incelendi; aday 125,3×48,2×160,0 mm, 1 CAD katısı ve 189,21 cm³ çıktı. Kalıcı `npm run build:horse-v2` geçti: 181.722 üçgen, 0 açık/non-manifold/yön hatalı kenar, STEP 2.285.147 B. Güncellenmiş STL/STEP, altı görünüş ve doğrulama raporu `outputs/at-kafasi-v2/` altında.
- Luna brifi ve `docs/ILERLEME.md` bu kanıta göre güncellendi. T24 yerel tasarım değişikliği tamamlandı; Doğukan'ın estetik onayı, fiziksel baskı/yazıcı profili, harici CAD uygulaması ve referans fotoğrafının yeniden dağıtım hakkı açık kabul kapıları olarak duruyor.

### 2026-10-21 · R8 — verify izolasyonu

- `scripts/verify-isolated.mjs`: her `npm run verify:*` komutu kendi OS geçici klasöründe `KODLA3D_RUNS_DIR`, `KODLA3D_OUTPUT_ROOT` ve ayrı localhost portuyla çalışır; test bitince başlattığı sunucu ve temp klasör temizlenir. Kendi sunucusunu açan `verify:jobs` ve `verify:fixtures` de izole run/output kökleri kullanır. `verify:horse-v2` çıktıları da geçici output köküne yazıp oradan doğrulanır; `verify:glb` geçici yapısal fixture kullanır.
- `server.mjs`: Windows timeout/iptalinde worker süreçleri doğrudan sonlandırılır. Eski `taskkill` yolu worker’ı kapatmayıp iptal testini zaman aşımına taşıyordu; düzeltme sonrası lifecycle testi iptal, timeout, crash toparlanması ve CLI senaryolarıyla geçti.
- Kanıt: 19/19 `verify:*` geçti. Üretim `.runtime/runs` öncesi/sonrası 116 dosya ve her yolun byte boyutu/SHA-256'sı aynı; toplu SHA-256 `3f2c6cd8fbcc57eabe7299c1ecf7d0db6e9bfc21193f68c48a45e8668c531eab`. Ayrıntı: [R8-RUNS-KARSILASTIRMA-2026-10-21.json](R8-RUNS-KARSILASTIRMA-2026-10-21.json).
- Başlangıç yedeği: `C:\Users\doguk\Desktop\3d-Baski-uyg-yedek-2026-10-21-R8-baslangic` (`node_modules`, `.venv`, `outputs` hariç).
### 2026-10-21 · R9 API dokümantasyonu ve gerçek curl

- `docs/HTTP-API.md`: `/api/compare` ve `/api/reference/contour` alanları, request/response örnekleri, `referans` tipleri, `anahtar.esik`, kamera, ölçek, hata kodları ve çalıştırılabilir curl fixture'ları belgelendi.
- `docs/AI-KULLANIM.md`: referans → elle/maske konturu → profil → model → compare → IoU bindirmesine göre yineleme akışı eklendi.
- Fixture verifier gerçek `curl.exe` çağrısıyla compare ve contour endpointlerini doğruluyor. Oversize contour isteğinin yanlış `INVALID_JSON` kodu `INPUT_TOO_LARGE` olarak düzeltildi.
- R9 sonrası 20/20 `verify:*` geçti; compare fixture IoU 1, contour 4 nokta üretti.

### 2026-10-21 · R10 PDF referansı

- `src/pdf-reference.js` ve `/api/reference/pdf-page`: PDF sayfası PDF.js (`5.4.624`, Apache-2.0) ve `@napi-rs/canvas` (`0.1.88`, MIT) ile yerel bellekte PNG'ye çevrilir; dosya 25 MiB, belge 500 sayfa, ölçek 0.5–3, sonuç 16 MP ile sınırlandırılır. Parolalı PDF reddedilir.
- Referans yükleyici PDF kabul eder, kartta sayfa numarası seçtirir; çıktı mevcut manuel poligon/maske/kontur hattına girer ve proje manifestine PDF baytları yerine PNG ile poligon yazılır. `docs/HTTP-API.md`, `docs/AI-KULLANIM.md` ve `docs/LISANSLAR.md` güncellendi.
- `verify:pdf-reference`, iki sayfalı yerel PDF fixture'ında özellikle 2. sayfayı seçerek PNG → elle poligon → kontur/profil → CAD modeli → compare akışını doğruladı. Fixture'da IoU 0,083; bu teknik çizim hedefi değil, tüm API geçişlerinin çalıştığını gösteren entegrasyon örneği. Bu son güncellemeden sonra 21/21 `verify:*` geçti.

### 2026-10-21 · R7 Vectra B yerel gerçek vaka

- `outputs/referans-deneme/vectra-b-fren-lambasi.jpg` yalnız yerelde açılıp elle incelendi ve Görünüm 2 ön, Görünüm 3 alt, Görünüm 4 yan kama için 16/16/15 noktalı dış sınır poligonları çizildi. Kaynak görsel hiçbir yere yüklenmedi.
- Genel ölçü varsayımı 285×95×55 mm. `1,5+28,5+1,5=31,5 cm` uç payı zinciri, çizimde iki defa verilen 28,5 cm genel genişlikle çelişiyor; uç payları genişliğe eklenmedi. Görsel ölçekte tutarsız olduğundan görünüşler ayrı eksende kendi etiketli ölçülerine kalibre edildi; varsayım ve ölçü hataları `docs/REFERANS-DENEY-2026-10.md` içinde.
- Dış gövde için elle çizilmiş yan profili genişlik boyunca süpüren tek katı üretildi; ölçülen bounding box 285×95×55 mm (hedef farkı 0,00 mm, yuvarlamaya göre). Nihai IoU: ön 0,9498, alt 0,9593, yan 0,9899. Ön/yan ≥0,90 hedefi geçti. Tırnak yuvaları/kesitler sonraki aşama; montaj uyumu iddiası yok.
- Beş geometri yinelemesi; yerel üretim+compare işlem toplamı 0,22 dk (manuel düzenleme hariç). Nihai ön/alt/yan bindirmeleri görüntülenip kontrol edildi. STL, elle poligon görüntüleri, compare overlay'leri ve JSON kanıtı `outputs/referans-deneme/` altında.
- Nihai R7 sonrası tüm 21 `verify:*` komutu geçti. `.runtime/runs` 131 kayıtla önce/sonra aynı; aggregate SHA-256 `1dea1a1087d4dfa63213cf58aaee3aa081d855c86d41721fb36c46afe3bcd35b`.


### 2026-10-22 · V4 fotoğraf silüeti — Doğukan onayı

- H6 incelemesinde Doğukan elle çizilmiş profili reddetti (yandan yaprak, önden 36 mm sabit levha). Doğukan'ın verdiği referans fotoğraftan maske çıkarıldı (beyaz zemin eşiği, 9 px açma ile kıl uçları temizlendi, 5 px poligon sadeleştirme), göğüs çapraz kesildi, taban düz. `models/organik-at-kafasi-v4.js` konturu bu 78 noktalık silüettir.
- Kalınlık bölgesel: ense→burun ekseni boyunca alın/göz 20, burun ucu 12, boyun 19–20, kulak 5 mm yarı kalınlık. Göz, göz kapağı, burun deliği, ağız ve çene hatları fotoğraftaki konumlarda; yele tutamları sağ yanda uzun, sol yanda kısa.
- Göz kapağı ve yele tutamları yüzeyden taşınca kapalı olmayan (non-manifold) kenar veriyordu; yüzeye gömüldü, tutam başı tepe kenarından 6 mm aşağı alındı. Sonuç 0 açık, 0 non-manifold.
- Model 161 mm geniş olduğundan `model-worker.mjs` organik hücre bütçesi 4M → 9M. `verify:horse-v4` ön oran aralığı 0,35–0,45 → 0,45–0,60 (gerçek kafa daha dolgun), `verify:horse-v4-performance` taban hacmi 552.598,35 mm³.
- Ölçüm: 161×43×160 mm, normal worker ~27 sn, kaide kaplama %98,3, yan silüet IoU 0,955 (fotoğraf maskesine karşı). Referans fotoğraf stok görsel (filigranlı) olduğu için repoya eklenmedi; `outputs/at-kafasi/referans.jpg` yerelde kalır.
