# Luna brifi — tek referans + brif ölçüsünden hızlı 3D (20 Ekim 2026)

Yazan: Doku. İsteyen: Doğukan.

## Amaç

Bionluk'ta "şu parçanın 3D modelini istiyorum" ilanları var (ör. arabanın sol ön farı). Hedef: **bir referans fotoğraf + birkaç ölçü (genişlik, yükseklik, derinlik, açı)** ile modeli dakikalar içinde çıkarmak; yapay zekâ kodu yazarken **referansa ne kadar benzediğini bir sayıyla** görüp kendi kendine iyileştirebilsin.

Bugünkü durum: AI kodu yazıyor, `views.png` altı görünüşünü alıyor, ama benzerliği yalnız gözle değerlendirebiliyor. 20.10'da organik at V3 kafası bu yüzden elle, ~10 parça ayarlanarak düzeltildi; bu yöntem her referans için tekrarlanamaz.

## Okunacaklar (önce)

`AGENTS.md`, `docs/AI-KULLANIM.md`, `docs/HTTP-API.md`, `docs/CHANGELOG-KODLA3D.md` (20.10 akşam girdisi), `src/mesh-views.js` (yazılım rasterizer: `renderSixViewsPng`), `server.mjs` (`/api/build`, önbellek), `model-worker.mjs`.

Proje **git altında değil.** Başlamadan tam yedek al (`node_modules`, `.venv`, `outputs` hariç). Son yedek: `Desktop/3d-Baski-uyg-yedek-2026-10-20`.

## İşler (sırayla; her biri ayrı kabul edilir)

### R1 — Siluet maskesi çizici (en kritik)
`src/mesh-views.js` içindeki rasterizer'dan **ikili siluet maskesi** üreten bir fonksiyon çıkar: `renderSilhouette(stl, {camera, width, height, fit})` → `Uint8Array` (1 = model). Kamera: mevcut altı yön + serbest yön/up vektörü. Ölçekleme: modelin sınır kutusuna göre otomatik **ya da** dışarıdan verilen mm/piksel ölçeği (R3 için şart).
**Kabul:** 80×50×25 kutu, önden 400×400'de beklenen dikdörtgen maskeyi verir (piksel sayısı analitik değerle ±%1). Birim testi `scripts/verify-silhouette.mjs`.

### R2 — Referans maskesi
Referans görseli maskeye çevir. **İlk sürümde ML kullanma.** Desteklenecek girişler:
1. Kullanıcının verdiği hazır maske PNG'si (siyah/beyaz),
2. düz arka planlı fotoğraf için renk anahtarı + eşik (arka plan rengini köşeden örnekle),
3. arayüzde elle çizilen kapalı poligon (en güvenilir yol; far gibi parçalarda zaten gerekir).
PNG/JPEG çözmek için küçük, bağımlılıksız bir kütüphane seç (`pngjs`, `jpeg-js` gibi) ve `docs/LISANSLAR.md`'ye ekle.
**Kabul:** üç girişin her biri aynı test görselinden ±%2 aynı maskeyi verir.

### R3 — Benzerlik skoru + API
`POST /api/compare`: `{ runId | code+mode, referans: {maske|gorsel+anahtar|poligon}, kamera, olcek: {mmPerPx} | {genislikMm} }` → `{ iou, kenarMesafesiPx (ortalama + %95), fazla: maske, eksik: maske, overlayPng }`. `overlayPng`: referans yeşil, model kırmızı, örtüşme gri.
Ölçek: referanstaki bilinen bir ölçü (ör. "genişlik 320 mm") maskenin sınır kutusundan mm/piksel'e çevrilir; model aynı ölçekle çizilir. Hizalama: önce sınır kutusu merkezleri; isteğe bağlı küçük öteleme araması (±%5).
**Kabul:** bir modelin kendi siluetiyle karşılaştırması IoU ≥ 0,99; aynı model %10 büyütülünce IoU belirgin düşer ve `fazla` maskesi doğru tarafta görünür. Sonuç önbelleğe girer (anahtar: model + referans hash + kamera + ölçek).

### R4 — Kontur → profil
Referans maskesinin dış konturunu çıkar (marching squares), sadeleştir (Douglas–Peucker, tolerans mm cinsinden), mm'ye ölçekle ve **mevcut API'lere** verilecek nokta listesi olarak döndür: `profilLoft`, `profilSupur`, `profilDondur` (yarı profil). Yeni model fonksiyonu: `referansProfili({ad, yon:'on'|'yan'|'ust', tolerans})` worker'da önceden hesaplanmış konturu okur.
**Kabul:** bir dairenin konturu, verilen çapla ±%1 çevre; L şekli köşeleri korunur; nokta sayısı toleransla kontrol edilir.

### R5 — Brif formu ve iki görünüş
Arayüzde "Referanstan model" paneli: görsel yükle (1–3 adet: ön / yan / üst), her görsel için kamera yönü, bilinen ölçüler (genişlik, yükseklik, derinlik mm; isteğe bağlı açı), montaj delikleri listesi. Bu bilgiler proje dosyasına (`project-manifest.js`) girer ve modele `parameters.referans` olarak ulaşır.
Tek görselde derinlik bilinemez: **derinlik ölçüsü ya da ikinci görünüş yoksa** UI bunu açıkça uyarır; model "derinlik tahmini" etiketi taşır.
**Kabul:** proje kaydet/aç döngüsünde referanslar ve ölçüler kaybolmaz; görsel dosyası proje paketine kopyalanır.

### R6 — Önizlemede referans katmanı
Viewport'ta seçili kameraya yarı saydam referans görselini, R3 ölçeğiyle hizalı arka plan olarak koy; skor ve `overlayPng` panelde görünür.
**Kabul:** ön görünüşte kutu + kendi siluet görseli üst üste çakışır (göz kontrolü + R3 skoru).

### R7 — Uçtan uca deneme ve ölçüm
İki test vakası: (a) basit mekanik: ölçüleri verilmiş bir braket fotoğrafı, (b) far benzeri bir parça: ön + yan görsel, genişlik/yükseklik/derinlik. Her biri için AI'ya yalnız `docs/AI-KULLANIM.md` + R-araçları verilerek model ürettir; **IoU'nun yineleme başına seyri, toplam süre ve yineleme sayısı** `docs/REFERANS-DENEME-2026-10.md`'ye yazılır.
**Kabul:** ölçüler belirtilen toleransta (±1 mm ya da brifte yazan), ön IoU ≥ 0,90; süre ve sınırlar dürüstçe raporlanır.

## Sınırlar ve yapılmayacaklar

- Montaj gerektiren parçalarda fotoğraftan çıkan model **milimetrik oturma garantisi değildir.** UI ve rapor bunu açıkça söyler; kesin ölçü kumpas/müşteri verisi ister.
- İlk sürümde ML arka plan silme, görselden-mesh modelleri (image-to-3D) yok. Organik figürler için ileride ayrı değerlendirme; lisans ve kalite doğrulanmadan eklenmez.
- Mevcut örnekleri, önbelleği (20.10 düzeltmesi), kadrajı ve `verify:*` betiklerini bozma. Her R adımından sonra bütün `verify:*` sunucu açıkken geçmeli (`verify:glb` dosya argümanı ister).
- Gizli bilgi, müşteri görseli veya referans fotoğrafı dışarı gönderme; hepsi yerel.

## Teslim

Her R için: değişen dosyalar, yeni test betiği, ölçüm, `CHANGELOG-KODLA3D.md` girdisi. Doğrulamadığın şeyi "çalışıyor" diye yazma; görsel kaliteyi görmeden onaylama.

## Ek işler (21.10, Doku denetiminden sonra)

- **R8 — Test izolasyonu:** `verify:*` canlı sunucuda kullanıcının `.runtime/runs` geçmişini siliyor. `KODLA3D_RUNS_DIR` (+ gerekirse ayrı port); testler kendi geçici köklerinde. Kabul: testlerden sonra kullanıcının runs klasörü bayt bayt aynı.
- **R9 — Belge:** `HTTP-API.md` ve `AI-KULLANIM.md`'ye `/api/compare`, `/api/reference/contour` ve "IoU'ya bakarak yinele" akışı. Kabul: belgeden kurulan örnek curl çalışır.
- **R10 — PDF referans:** PDF sayfası yerelde PNG'ye çevrilip maske/kontur hattına girer; teknik çizimde poligon yolu da çalışır. Kabul: PDF → kontur → profil → model → compare uçtan uca.
- **R7 kapanışı:** Doğukan'ın getireceği gerçek Bionluk PDF'iyle süre, yineleme, IoU seyri ve ölçü hatası `REFERANS-DENEME-2026-10.md`'ye.
