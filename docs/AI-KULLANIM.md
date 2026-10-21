# Kodla 3D — AI modelleme sözleşmesi

HTTP JSON API rotaları, kararlı hata kodları ve CLI kullanımı: [`docs/HTTP-API.md`](./HTTP-API.md).

Parametreli at profilleri ayrı örneklerdir: `at-kafasi` V1'i, `at-kafasi-v2` ise V2 profil çalışmasını gösterir. Her örneğin şeması `/api/examples` yanıtında taşınır; kodu aynı örnek adı ve parametre nesnesiyle gönder.

Varsayılan çalışma CAD'dir. Organik tasarım için üstteki mod menüsünden **Organik · SDF** seç. JavaScript kodunu `model.js` editörüne yaz, `return model;` ile döndür. Tüm koordinatlar ve ölçüler mm.

Kod, güvenilen yerel kullanıcı kodu olarak gerçek Node JavaScript'te çalışır; bu bir güvenlik sandbox'ı değildir. Dosya/ağ/işletim sistemi erişimi, sonsuz döngü ve dış yan etki yazma. Sunucu tek iş çalıştırır ve 60 saniyede keser.

## CAD modu: Replicad / OpenCascade

```js
const genislik = 80;
const derinlik = 50;
const yukseklik = 25;
const duvar = 3;

let model = kutu({ ad: 'govde', genislik, derinlik, yukseklik });
model = model.yuvarlat(5);
model = model.icini_bosalt(duvar);
return model;
```

- `kutu({ad, genislik, derinlik, yukseklik})`: varsayılan 80×50×25.
- `silindir({ad, cap, yukseklik})`: varsayılan çap 30, yükseklik 20.
- `birlestir(a, b, ad)` / `cikar(a, b, ad)`: Replicad BRep Boolean.
- `parca.yuvarlat(yaricap, yon='Z')`: belirtilen yöne paralel kenarlar.
- `parca.icini_bosalt(duvar=3)`: üst yüz açılır, duvar içe doğru kalınlaşır.
- `parca.tasi(x=0, y=0, z=0)`: mm öteleme.
- `parca.delik_ac(cap, [[x,y], ...])`: global XY merkezlerinde Z boyunca tam delik.
- `daireselLoft({ad,kesitler,duz})`: XY düzlemindeki dairesel `[z, yaricap, merkez?]` kesitleri artan Z sırasıyla birleştirir. `kesitler` örneği: `[{z:0,yaricap:8},{z:12,yaricap:5}]`.
- `profilLoft({ad,kesitler,duz})`: dairesel olmayan kapalı `[x,y]` poligon profillerini artan Z seviyelerinde loft eder. Her kesitte aynı sayıda köşe ve eşleşen sıra olmalı; `duz:true` doğrusal yüzey verir.
- `profilSupur({ad,profil:[[u,v],...],yol:[[x,y,z],...],frenet?,gecis?})`: kapalı kesiti global mm yolunda CAD katısı olarak süpürür. Profil başlangıç yolunun ilk teğetine dik yerel düzlemde çizilir; `gecis` `right`, `transformed` veya `round` olabilir. Ardışık eş yol noktaları geçersizdir.
- `profilDondur({ad,noktalar,aci:360})`: XZ profilini Z ekseninde kapalı katı olarak döndürür; noktalar `[yaricap,z]`, yarıçap negatif olamaz. Açık/kısmi revolve desteklenmez.
- `parca.dondur(aci, eksen='Z', merkez=[0,0,0])`, `parca.ayna(duzlem='YZ', merkez=[0,0,0])`, `parca.pah(mm)` ve `dogrusalDesen({parca,adet,aralik:[x,y,z]})`: ölçüleri mm, açı derece; desen bileşik çıktı içinde ayrı katılar üretir.
- İleri API: `replicad` nesnesi; örneğin `return replicad.makeBaseBox(20,30,10);`

`delik_ac` koordinatları global XY merkezleridir; mevcut davranış yerel/parça koordinatı değildir. Yuvarlatma ve iç boşaltma, Replicad/OpenCascade işlemi başarısız olursa parça adı ve boyutla hata verir; başarısız CAD işlemi yaklaşık mesh'e düşürülmez.

CAD çıktısı gerçek BRep katısından STL + STEP + `.js` kaynağıdır. STL sapması 0,08 mm; açısal tolerans 0,1 radyandır. Geometri kodu ve CAD mesh toleransları bu prototipte ayrı kullanıcı parametresi değildir.

## Organik mod: Manifold SDF

Organik komut yüzeyi `apiVersion: 1` sürümündedir; ortak build yanıtı `schemaVersion: 1` taşır. Komut referansının kaynağı `src/api-schema.js`, üretilen belge `docs/ORGANIK-API-REFERANSI.md` dosyasıdır. Güncellemek için `npm run api:docs`, belge/runtime eşleşmesini denetlemek için `npm run verify:api` çalıştır.

Kısa, mm tabanlı alan komutları kullan:

```js
const boyun = kapsul({
  ad: 'boyun',
  baslangic: [-3, 0, 0],
  bitis: [-1, 0, 21],
  baslangicYaricapi: 5,
  bitisYaricapi: 3.5
});
const kafa = elipsoid({
  ad: 'kafa',
  merkez: [3, 0, 22],
  yariCaplar: [7, 5.5, 8]
});
return yumusakBirlestir({ ad: 'boyun_ve_bas', parcalar: [boyun, kafa], genislik: 3.5 });
```

- `kure({ad, merkez:[x,y,z], yaricap})`: analitik küre alanı.
- `elipsoid({ad, merkez:[x,y,z], yariCaplar:[rx,ry,rz]})`: yaklaşık signed-distance alanı.
- `kapsul({ad, baslangic:[x,y,z], bitis:[x,y,z], yaricap, baslangicYaricapi, bitisYaricapi})`: eksen boyunca sabit veya değişken yarıçap.
- `kesitZinciri({id, ad, noktalar:[[x,y,z],...], kesitler:[{rx,ry,aci?},...], yumusaklik})`: Catmull–Rom merkez eğrisi boyunca dik eliptik kesitleri yumuşakça birleştirir. `rx` yanal, `ry` dikey yarıçaptır; `aci` kesiti dereceyle çevirir. Alan, sabit örneklenmiş 1-Lipschitz elipsoidlerin birleşimidir; iki eş dairesel kesitte kapsül alanını verir.
- `siluetHacmi({id, ad, kontur:[[x,z],...], kalinlik:[[x,z,yariKalinlik],...] | fonksiyon, yuvarlama})`: kapalı XZ profiline Y yönünde kalınlık verir. Tablo kesitleri 1-Lipschitz koni uzantısıyla bağlanır; fonksiyon 24×24 örneklenip iki doğrultudaki en büyük eğime göre normalize edilir. `yuvarlama` mm cinsinden kesişim kenarlarını yumuşatır.
- `yumusakBirlestir({ad, parcalar:[...], genislik})`: gerçek smooth SDF max; `genislik` mm cinsinden karışım aralığı.
- `yumusakCikar({ad, ana, kesici, genislik})`: yumuşatılmış fark/oyuk.
- Her parçada addan ayrı `id` ver; ad değişse de kimlik aynı kalır. `grup({id, ad, parcalar})` mantıksal ağaç oluşturur; aynı grup içindeki ad/ID çakışması açık hata verir.
- `simetrik({parca, duzlem:'YZ'|'XZ'|'XY', konum, id, ad})`: yerel bir yansıma kopyası üretir; kaynak ID ilişkisi ve negatif ölçek dönüşümü sonuçta korunur. STL meshing yüzey yönelimini yeniden oluşturur.
- `tasi({parca, x, y, z})`; `donustur({parca, tasima, olcek, aci, pivot})`. Sıra yerel ölçekte scale → rotate → translate; açı derece, koordinatlar mm. Sıfır ölçek geçersiz.
- `gorunum({parca, gorunur, kilitli})`; `parcaBul({parca, id})`; `parcaDegistir({parca:grup, id, yeniParca})`. Hedefli yenileme, kök/grup ID'sini ve diğer parçaları korur. Kilitli parçayı değiştirmek hata verir; görünmeyen parçalar yeni gruba katılmaz.
- `bolgeselSekillendir({parca, merkez, yaricap, derinlik, islem:'sisir'|'incelt'|'it'|'cek'|'yumusat', yon})`: compact cubic falloff ile yalnız bu etki yarıçapında alan değiştirir.
- `egriDetayi({hedef, noktalar, yaricap|yaricaplar, etki:'kabartma'|'oyuk', genislik})`: değişken kalınlıklı çizgiyi gerçek yüzey geometrisi olarak ekler/çıkarır. Kısayollar: `gozKapagi`, `dudakCizgisi`, `burunDeligi` (elipsoid çukuru), `yeleTutami`.

### Hatalı parametreyi düzeltme

Sıfır yarıçap geçersizdir ve açık doğrulama hatası verir:

```js
return kure({ ad: 'govde', yaricap: 0 });
```

Hata `yaricap sıfırdan büyük olmalı.` der. Pozitif ölçüyle yeniden üret:

```js
return kure({ ad: 'govde', yaricap: 3 });
```

Önizlemede eski başarıyı indirme; hatalı kodu düzeltip yeniden üret.

SDF içi pozitiftir. Smooth union dokudaki renk/normali değiştirmez, gerçek yüzey koordinatlarını değiştirir. Geniş blend yakındaki ayrı parçaları birleştirebilir; küçük blend örnek testte 3 mm boşluğu korudu, bu her şekil için matematiksel garanti değildir. Çıktı tek veya birden fazla kapalı üçgen yüzey kabuğu taşıyabilir; iç boşluğu olan bir parçanın iç ve dış kabukları ayrı yüzey bileşenleridir.

Organik üst menüde kalite seç: **Taslak 1,4 mm**, **Normal 0,8 mm**, **İnce 0,55 mm** yaklaşık `levelSet` kenar aralığıdır, fiziksel duvar/tolerans garantisi değildir. Tahmini 4 milyon grid hücreyi aşan iş başlatılmaz. Çok ince özellikler kaba örneklemede kaybolabilir veya hacmi değişebilir; normal/ince sonucu ölçüp karşılaştır.

Organik worker çıktıları STL + `.js` kaynağıdır. Güncel organik mesh için UI'deki **GLB · metreye dönüştür** düğmesi, mesh'i isteğe bağlı GLB 2.0 olarak paketler ve mm koordinatlarını sahne matrisinde metreye çevirir. Bu dönüşüm orijinal parametrik STEP üretmez. STL üçgen sayısı tek başına anatomi veya görsel kalite ölçüsü değildir.

`schemaVersion:1` sonucunun `parts` dizisi ID, ad, kaynak ilişkisi, grup, görünürlük/kilit, dönüşüm ve düzenleme işlemlerini taşır. `outputs/organik-t06-t08/` içinde simetri, yerel bölge ve kabartı/oyuk örnekleri ile doğrulama JSON'u bulunur. T08 örneği organik geometri göstergesidir; foto-gerçekçi at anatomisi değildir.

Parça ağacı CAD ve organik üretim yanıtlarından isimli düğümleri gösterir. At kafası CAD örneğinde OpenCascade boolean yüz geçmişi, birleşik son yüzleri oluşturan kaynak parçaya bağlar; canvas tıklaması aynı kaynak kimliğiyle ağaç seçimini, parametre/bounds ayrıntısını ve kaynak koda gitmeyi eşleştirir. Ağaçtan görünürlük, izolasyon ve parçaya kadraj odaklama da kullanılabilir. Bu ilişki bir CAD işlemi yüz geçmişi sunabildiği ölçüde korunur; bütün motorlara ve her boolean değişikliğine evrensel kaynak yüz garantisi verilmez.

T14 yerel referans paneli yalnız `at-kafasi` örneğinde `outputs/at-kafasi/referans.jpg` dosyasını gösterir. Referansın kaydı Doğukan tarafından sağlanan yerel dosya olarak tutulur; uygulama fotoğrafı dışarı yüklemez veya uzaktan getirmez. Kamuya açık lisans/yeniden dağıtım hakkı bilinmiyor. Overlay, yalnız viewport görünüşüne saydamlık/ölçek/yatay-dikey kaydırma uygular; STL/STEP geometrisini veya fotoğraf dosyasını değiştirmez. Fotoğraf perspektif açıdan, eşleşme ölçülü overlay değildir. Görünmeyen yüzler simetrik varsayılmıştır; ölçüler fotoğraftan çıkarılmamıştır.

## Ortak davranış ve sonuç sözleşmesi

`POST /api/build` JSON:

```json
{"mode":"organic","quality":"normal","code":"return kure({yaricap:10});"}
```

Eski istemcilerde `mode` yoksa CAD varsayılır. Kalite `taslak`, `normal`, `ince`; seçimin CAD'de geometrik etkisi yoktur.

Başarı yanıtında `schemaVersion:1`, `geometryType`, `unit:"mm"`, `bbox`, `size`, `volume`, parça özeti, motor/sürüm, `sourceHash`, `quality`, `mesh`, gerçek worker `formats` ve yalnız bu formatların `files` bağlantıları vardır. CAD `formats=[stl,step,js]`; organik worker `formats=[stl,js]`; GLB tarayıcıda isteğe bağlı ve ayrı üretilir. Organik `mesh.surfaceComponents` yüzey kabuğu sayısıdır; fiziksel baskı/parça dayanımını doğrulamaz. `mesh.boundaryEdges` ve `nonManifoldEdges` indeks tabanlı kenar sayımıdır; self-intersection denetimi değildir.

`GET /api/health` motorun hazır olup olmadığını, `GET /api/examples` kod örneği ve geometri modunu döndürür. Geçici indirmeler son 15 çalıştırmada tutulur; kalıcı kaynak `models/*.js` dosyasıdır.

## Hata ve güven sınırları

- Ölçüleri ve isimleri kod başında belirt; önce kaba hacmi, sonra detayı üret.
- `NaN`, sonsuz, sıfır/negatif yarıçap ve yanlış vektör boyutunu kullanma; açık doğrulama hatası beklenir.
- Çıktı sınır kutusuna taşıyorsa veya grid bütçesi aşılıyorsa kodu sadeleştir, taslak kalite seç veya şekli küçült.
- `solid`/`manifold` teknik olarak kapalı mesh demektir; baskı dayanımı, support yönü, nozzle profili veya toleransı kanıtlamaz.
- Fotoğraf tek açıysa görünmeyen yüzler varsayımdır. İnsan görsel kabulü ayrı kalır.
- AI kodunu anlamadan çalıştırma; sistem güvenlik ayarı veya kod sandbox'ı yoktur.


## Referanstan üretim ve IoU ile yineleme

Ön/yan/üst teknik çizimi yerelde maske veya elle kapalı poligon olarak ver. Teknik çizimde otomatik renk eşiği çizgi/ölçü yazılarını da alabileceği için dış gövdeyi poligonla çiz; delik, tırnak ve kesitleri ayrı aşamada ekle.

1. `POST /api/reference/contour` ile görünüş poligonundan mm konturu çıkar. `referans.poligon` içinde piksel genişliği/yüksekliği ve `[x,y]` noktaları bulunur; fiziksel `olcek.genislikMm` veya `olcek.mmPerPx` değerini gönder. `yon` (`on`, `yan`, `ust`) ve `toleransMm` seç.
2. Dönen konturu `referansProfili({yon:'on'})` veya `profilLoft` / `profilSupur` girdisine taşı. Derinliği ikinci görünüş veya müşteri ölçüsünden al; tek görünüş derinliği kanıtlamaz.
3. Modeli `POST /api/build` ile üret. `files.stl` URL'sindeki 32 karakterli run kimliğiyle `/api/compare` çağır; aynı referans, kamera ve ölçeği koru. `kamera` görünüşü eşleştirmeli (`top` gibi sabit kimlik veya `{direction,up}` vektörleri).
4. `iou` kesişim/birleşim oranıdır. `fazla` PNG modelin referans dışına taştığı, `eksik` PNG modelin karşılamadığı alanları gösterir; `overlayPng` içinde referans yeşil, model kırmızı, örtüşme gri görünür. `kenarMesafesiPx.mean` ve `p95` sınır sapmasını piksel cinsinden gösterir.
5. AI kodunda yalnız ölçülen sapmayı düzelt; yeniden build ve compare çalıştır. Her turda IoU, kenar mesafesi, ölçü ve kod değişikliğini kaydet. IoU tek başına boy/derinlik ölçüsünü veya görünmeyen yüzleri doğrulamaz; gerçek baskı ve montaj uyumu için kumpas/müşteri ölçüsü gerekir.

İstek/yanıt alanları, maske-görsel-poligon biçimleri, hata kodları ve çalışan curl fixture'ları [`docs/HTTP-API.md`](./HTTP-API.md) içinde. Referanslar yerel kalır; fotoğrafı çevrimiçi AI servisine göndermeden önce izin ve mahremiyet kapsamını doğrula.
## Kalıcı proje dosyası

**Farklı kaydet / indir** `.kodla3d.json` manifestini oluşturur; **Proje aç** dosyayı şema ve motor sürümleriyle doğrular. Dosya kaynak kodu, örnek, kalite, şemalı parametreler, kamera/projeksiyon, referansın göreli yolu ve hash'i, son başarılı sürümleri taşır. Referans resmi manifestin içine kopyalanmaz; yalnız mevcut yerel çalışma alanında beklenen dosyaya göre doğrulanır. İçe alınan proje geometriyi otomatik olarak geçerli saymaz: aynı kaynakla yeniden üretmeden STL/STEP indirme kapalı kalır. Son kaydedilmemiş değişikliklerde dosyayı değiştirme ve sekmeden çıkma uyarısı gösterilir.

# Teknik çizim PDF’sinden referans

Teknik çizim PDF’sini uygulamadaki referans alanına ekle. Sayfa, yerel sunucuda PNG’ye çevrilir; sayfa numarasını karttan seç. Teknik çizimlerde otomatik arka plan eşiğine güvenme: nesnenin dış sınırına canvas üzerinde elle tıklayarak kapalı poligon oluştur. Ön/yan/üst görünüşe uygun kamera ve çizimdeki ölçüyü mm cinsinden gir. Ardından `/api/reference/contour` ile profili üret, modeli oluştur ve aynı görünüş/ölçekle `/api/compare` çağır. Dönen IoU ile bindirmeyi incele; fazla/eksik alanın gösterdiği sınırı düzelt, poligonu veya parametreyi değiştir ve yeniden karşılaştır. IoU’yu tek başına ölçü veya montaj uyumu garantisi sayma.

PDF çağrısı: `POST /api/reference/pdf-page?page=2&scale=1.5`, gövde ham PDF baytları, `Content-Type: application/pdf`; yanıt `image/png`. PDF geçici bellekte işlenir, kalıcı olarak yazılmaz. Destek: en çok 25 MiB, 500 sayfa, 16 megapiksel/sayfa, ölçek 0.5–3; parola korumalı PDF desteklenmez. Kullanıcı tarafından seçilen sayfanın PNG çıktısı poligon çizimi için kartta görünür.

