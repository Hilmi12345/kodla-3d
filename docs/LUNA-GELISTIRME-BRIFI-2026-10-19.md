# Kodla 3D — Luna geliştirme brifi ve yapılacaklar

Tarih: 19 Ekim 2026. Durum: uygulanmış maddeler kanıtlarıyla eşlendi; bu dosya kalan kabul kapılarını da gösterir.

> Durum notu (2026-10-20): tamamlandı işaretleri, `docs/ILERLEME.md` içindeki görev kanıtlarıyla eşleştirildi. T18 RAM cache ve CAD ağ toleransı maddeleri tamamlandı. T24 yerel siluet düzenlemesi ve renkli önizleme ayrımı teknik olarak tamamlandı; Doğukan estetik kabulü ile dış cihaz, baskı ve lisans kapıları ilerleme tablosunda ayrıca tutulur.


Proje: `C:/Users/doguk/Desktop/3d Baskı uyg/`

## 1. Luna'ya verilecek görev

Bu uygulamayı, küçük bir AI modelinin de kısa ve tutarlı kodla detaylı 3D tasarım yapabileceği bir yerel araca geliştir. Kullanıcı Doğukan. Kullanım dili Türkçe. Başlangıçta kendimiz kullanacağız; açık kaynak yayın hedefi var.

İstenen akış: tarif/referans → düzenlenebilir kaynak → anlamlı isimleri olan parçalar → hızlı önizleme → ölçü ve görsel geri bildirim → kontrollü revizyon → doğrulanmış çıktı.

İlk gerçek referansımız at kafası. Mevcut uygulama tanınabilir bir stilize büst üretti; fotoğraftaki anatomi ve yele ayrıntılarına ulaşamadı. Amaç, aynı taslağı yalnız daha çok üçgenle sunmakla sınırlı değildir: şekli tarif etme, bölgesel değiştirme ve ayrıntı üretme kabiliyetini geliştirmektir.

Uygulama görevi verildiğinde bu belgeyi sırayla uygula. İlk olarak mevcut durumu kontrol et, ardından aşağıdaki aşamaları çalışır teslimler hâlinde ilerlet. Çalışan sonucu göstermeden görevi tamamlanmış işaretleme. Bir aşamanın teknik engeli varsa kanıtını ve uygulanabilir alternatifi kaydet; belirsiz bir araştırmada dönüp durma.

## 2. Önce oku ve gerçeği doğrula

1. `AGENTS.md`, `README.md`.
2. `docs/FIKIR.md`, `docs/AI-KULLANIM.md`, `docs/DOGRULAMA.md`.
3. `package.json`, `package-lock.json`, `server.mjs`, `model-worker.mjs`.
4. `src/model-api.js`, `src/main.js`, `src/style.css`, `index.html`.
5. `models/kutu.js`, `models/aparat.js`, `models/at-kafasi.js`.
6. `outputs/at-kafasi/referans.jpg`, `onizleme.png`, `README.md`, `DOGRULAMA.json`.

Kaynak dosyalar, bu brifin yazıldığı tarihten sonra değişmiş olabilir. Başlangıç raporunda farkları belirt. Kullanıcının mevcut modellerini, referansını ve eski çıktılarını koru.

### Doğrulanmış başlangıç

| Alan | Mevcut gerçek |
|---|---|
| Çalışma | Yerel Node sunucusu, `127.0.0.1:8765`, `Baslat.cmd` |
| Motor | Replicad 1.1.0 + replicad-opencascadejs 1.1.0; WASM yerel Node sürecinde çalışıyor |
| Arayüz | Three.js 0.180.0, Vite; basit textarea editörü, tek mesh önizleme |
| Model dili | Fonksiyon gövdesi olarak çalıştırılan JavaScript; kısa API otomatik sağlanıyor, `return model;` |
| Kısa API | Kutu, silindir, birleştirme/çıkarma; yuvarlatma, iç boşaltma, taşıma, delik |
| Üretim | Her işte yeni Node süreci ve WASM yüklemesi; tek eşzamanlı iş, 60 saniye sınırı |
| Çıktı | Her başarılı üretimde STL + STEP + kaynak oluşturuluyor |
| Kalıcılık | Editörün tek son kodu localStorage'da; sunucuda son 15 çalışma geçici |
| Önceki deneme | CadQuery yerel OCP/VTK importunda takıldı; `experimental/cadquery/` altında, aktif motor değil |
| AI bağlantısı | Henüz yok; ücretli API veya anahtar gerekmiyor |

At taslağı: **121,45 × 48,19 × 160 mm**, 1 katı, 111 yüz, 182,10 cm³. Temiz STL **187.052 üçgen**. Tekrarlanan köşeli 26 üçgen temizlendi; tam STL koordinatlarıyla açık/çoklu kullanılan kenar kalmadı. STEP aynı motorla yeniden açıldığında hacim korundu. Fiziksel baskı yapılmadı.

Kutu: 80 × 50 × 25 mm. Aparat: 70 × 40 × 35 mm. Bu örnekler mevcut CAD hattının regresyon örnekleridir.

### Başlangıçta görülen boşluklar

- `model-worker.mjs` yalnız `Parca` / BRep şekli kabul ediyor; organik mesh için sonuç sözleşmesi yok.
- Çok üçgen, tek başına daha iyi anatomi üretmedi. Atın formu sade heykel/satranç taşı düzeyinde kaldı.
- Parça adları önizlemeye ayrı kimlikler olarak taşınmıyor; görüntü tek STL mesh.
- Her önizlemede STEP ve STL oluşturulması tekrar maliyeti yaratıyor. Süre/RAM ölçümleri henüz alınmadı.
- Seçim, parça ağacı, bölgesel değişiklik, referans paneli, parametre paneli ve gerçek proje kaydı yok.
- Mevcut STL temizliği yalnız aynı konumdaki köşeleri olan üçgenleri ayıklıyor; genel mesh analiz sistemi değil.
- `new Function` gerçek yerel kod çalıştırıyor; süreç ayırmak güvenlik sandbox'ı sayılmaz.
- `manifold-3d` adı Replicad tiplerinde geçse de bu incelemede üst düzey `node_modules/manifold-3d` klasörü bulunmadı. Kurulu veya JS özelliklerinin kullanılabilir olduğunu varsayma.

## 3. Geliştirme yaklaşımı

Önerilen yön: **CAD ve organik tasarımın ortak bir proje/komut katmanı altında iki geometri hattı kullanması.** Bu, ölçülerek doğrulanacak bir mimari önerisidir.

- Ölçülü parçalar için çalışan Replicad/OpenCascade hattını kullan.
- Organik işler için mesh / örtük yüzey (SDF) temelli bir yolun yeterliliğini küçük bir prototiple göster.
- AI'a mümkün olduğunca ortak, küçük bir API sun. İki hattın anlamı farklı işlemlerini zorla aynı isim altında gizleme.
- Mesh için STL/GLB gibi gerçek desteklenen çıktıları sun. Organik mesh'i otomatik biçimde hassas parametrik STEP modeli diye adlandırma.
- Yeni büyük motor yazmaya başlamadan mevcut açık kaynak araçlarla ne yapılabildiğini ölç.

İlk aday: resmî JS/WASM paketi üzerinden **Manifold**. Mesh Boolean, yüzey iyileştirme ve SDF/level-set olanaklarını kullanılan JS sürümünde doğrula. Manifold Boolean union işlemi tek başına yumuşak organik birleşim sağlamaz; smooth union için alan fonksiyonunun nasıl kurulacağını ayrıca göster.

Three.js MarchingCubes önizleme/prototip adayı olabilir; sınıfın bulunması baskıya uygun kapalı yüzey garantisi vermez. Blender başsız süreç + Python, ancak ilk adaylar kalite hedefini karşılamazsa değerlendirilecek alternatif olsun. Yerel Python paketlerini tekrar tekrar değiştirerek önceki import takılmasına dönme; Blender'ın kendi runtime'ı ayrı değerlendirilir. Yeni servis/hesap/ücretli model bu planın ön koşulu değildir.

## 4. Teslim sırası ve geçiş kapıları

| Aşama | Sonuç | Sonraki aşamaya geçiş |
|---|---|---|
| A — Temel ölçüm ve motor denemesi | Mevcut üç örneğin ölçümü; yumuşak birleşimli organik küçük örnek | Görüntü ve mesh kontrolüyle gerçek fark gösterilmiş |
| B — Organik çekirdek ve sade API | İsimli parça, yerel değişim, simetri, ayrıntı, kalite ayarları | Aynı API ile en az üç farklı organik nesne üretilmiş |
| C — Çalışma masası | Parça ağacı, parametreler, proje kaydı, referans ve görünüşler | Kullanıcı kod/parça/çıktı ilişkisini kaybetmeden revize edebiliyor |
| D — Güvenilir çıktı ve AI geri bildirimi | Geometri raporu, desteklenen formatlar, iş durumu, AI kılavuzu | CAD örnekleri ve organik örnekler ilgili ölçütleri geçiyor |
| E — At kafası V2 ve teslim | Referansa daha yakın form, çok açılı karşılaştırma ve dosyalar | Teknik kontroller ayrı; görsel onay Doğukan'da |

Her aşama sonunda çalışır hâl, yapılanlar, ölçülenler ve açık kalanlar yazılsın. Bir sonraki aşamaya ilerlemek için gereksiz tekrar onayı isteme; kullanıcıya ait görsel onayı kendin verme.

## 5. P0 — Temel durum ve mimari (ilk yapılacaklar)

### T01 — Başlangıç ölçümünü kaydet

- [x] Kutu, aparat ve at modelini mevcut kodla çalıştır; kaynağın ve ayarların hash'ini kaydet.
- [x] Soğuk/sıcak başlangıç, geometri, meshing, STEP yazma, toplam süre ve tepe bellek ölçümlerini ayır.
- [x] Makine/runtime sürümlerini ve tekrar sayısını yaz. Henüz ölçülmeyen değerleri boş/ölçülmedi bırak.
- [x] Her örneğin STL boyutu, üçgen sayısı, katı sayısı, bbox ve hacmini kaydet.

**Teslim:** `docs/BASELINE.md` ve makinece okunur ölçüm JSON'u. **Kabul:** başka biri komutları izleyerek aynı örnekleri çalıştırabiliyor; ölçüm ile hedef karışmıyor.

### T02 — Organik motor için sınırlı teknik deneme

- [x] Adayın JS/WASM paketini, lisansını, Node/Windows çalışmasını ve gerçek API'sini doğrula.
- [x] İki hacmi sert ve yumuşak birleşimle üret; aynı kamerada yan yana göster.
- [x] Küre/elipsoid, değişken kalınlıklı kıvrımlı boyun ve sığ oyuk örneklerini üret.
- [x] SDF sınır kutusu taşması, ince parça ve birbirine yakın iki yüzey durumlarını dene.
- [x] Çözünürlük, bellek, üçgen sayısı, süre ve mesh kapanıklığını ölç.
- [x] Yeterli olmayan adayın nedenini kaydet; kanıt olmadan ikinci motoru tam ürüne gömme.

**Teslim:** `docs/ORGANIK-MOTOR-KARARI.md`, küçük çalışan deneme ve örnek çıktıları. **Kabul:** yumuşak hacim birleşimi geometrinin kendisinde mevcut; yalnız shading hilesi değil. JS binding'de bulunmayan C++ özelliği varmış gibi kullanılmıyor.

### T03 — Model sonuç sözleşmesini tanımla

- [x] `cad`, `organic` ve gerektiğinde `assembly` sonucunu ayıran sürümlü bir veri yapısı oluştur.
- [x] Sonuç: birim, bbox, parça kimlikleri/adları, mesh verisi, motor/sürüm, kalite, kaynak hash'i, desteklenen formatlar, uyarılar.
- [x] BRep kaynak ile üçgen mesh kaynak aynı alanmış gibi kabul edilmesin.
- [x] Eski `return new Parca(...)` modelleri çalışmaya devam etsin.
- [x] İndirme dosyasının hangi kaynak ve parametre sürümüne ait olduğu izlenebilsin.

**Teslim:** tipler/şema + kısa sözleşme belgesi. **Kabul:** eski iki CAD örneği ve yeni bir organik model aynı iş akışında doğru format seçenekleriyle açılıyor.

## 6. P1 — Organik modelleme ve AI'ın kullanacağı çekirdek

### T04 — Sade organik hacimler

- [x] Elipsoid, kapsül, konik/değişken yarıçaplı tüp, kesitlerden yüzey ve kapalı hacim üretimi.
- [x] Nokta/ölçek/açı verilerinde sayı, NaN, sonsuz, sıfır boyut, yanlış dizi uzunluğu kontrolleri.
- [x] Global eksen, yerel eksen, pivot ve transform sırası açık ve tutarlı olsun.
- [x] mm ile çözünürlük ilişkisi açık olsun; farklı boyutta aynı model beklenmedik şekilde dağılmasın.

**Kabul:** örnekler kısa kodla tekrar oluşturuluyor; hatalı giriş motorun belirsiz hatasına kadar ilerlemiyor.

### T05 — Gerçek yumuşak birleşim ve kesme

- [x] Smooth union, kontrollü smooth subtraction ve normal Boolean işlemlerinin kapsamını ayır.
- [x] Birleşme genişliği mm olarak yönetilsin; nesnenin boyutu değişince anlamını korusun.
- [x] Bölgesel yumuşatma, korunan keskin kenarlar ve birleşimden sonra hacim/bbox sapması raporu.
- [x] İşlemler bağlı olmayan iki parçayı sessizce tek kapalı nesne sanmasın.

**Kabul:** boyun/çene geçişinde ek yeri görünümü azalıyor; uzaktaki burun, kulak veya kaide istemeden erimiyor.

### T06 — İsimli parçalar, simetri ve bölgesel revizyon

- [x] Kalıcı benzersiz parça kimlikleri; kullanıcı adı değişse de seçimler bozulmasın.
- [x] Grup, görünürlük, kilit, yerel transform ve simetri düzlemi.
- [x] Yansıyan parçalarda ters normal / negatif ölçek / winding sorunu ele alınsın.
- [x] Birleşik yüzeyde kaynak bölge ilişkisi, uygulanabildiği ölçüde korunsun; sonrasında kimliğin kaybolduğu işlemler açıkça belirtilebilsin.
- [x] “Sol kulağı kısalt” değişimi sağ kulağa yalnız simetri açıkken yansısın.

**Kabul:** bir parçayı değiştiren komut yanlış parçayı veya tüm modeli değiştirmiyor; isim çakışması anlaşılır hata veriyor.

### T07 — Bölgesel şekillendirme ve yüzey düzenleme

- [x] Maskeli itme/çekme, şişirme/inceltme, kontrollü yumuşatma ve eğri boyunca biçim değişimi.
- [x] Etki merkezi, yarıçapı ve falloff kodla belirlenebilsin.
- [x] Hacim küçülmesi, keskin ayrıntıların kaybı ve ince bölgelerin kapanması ölçülsün.
- [x] Remesh/subdivision/decimation adımları ihtiyaç ve ölçümle eklensin; hepsi her üretimde koşmasın.

**Kabul:** göz çukuru ekleme burun ucunu bozmaz; ayrıntılı sürüm daha çok üçgen içermesinin yanında görünür biçim iyileştirmesi sağlar.

### T08 — Baskıda anlamı olan ayrıntılar

- [x] Eğri boyunca kabartma ve oyuk, kademeli derinlik/genişlik, yüzeye hizalama.
- [x] Göz kapağı, dudak çizgisi, burun deliği ve yele tutamı gibi yeniden kullanılabilir geometri örnekleri.
- [x] Yeleyi binlerce bağımsız kıl yerine bağlı, baskıda kalınlığı yönetilebilir tutamlarla temsil etme seçeneği.
- [x] Malzeme/normal-map görünümü ile STL'ye gerçekten geçen geometriyi arayüzde ayır.
- [x] İnce ayrıntıyı koruma düzeyi seçilen üretim profiline bağlanabilsin; yazıcı bilgisi yokken güvenli kalınlık garantisi verilmesin.

**Kabul:** ayrıntı düz materyal ve yandan ışıkta görünür; STL'yi tekrar açınca da vardır.

### T09 — Taslak / normal / çıktı kalitesi

- [x] Geometriyi tanımlayan kod ile örnekleme/meshing ayarlarını ayır.
- [x] Kalite değişimi isimli parça ve parametreleri değiştirmesin.
- [x] Çözünürlük ve grid/bellek bütçesine sınır koy; sınırı aşan isteği motor donmadan açıkla.
- [x] Yaklaşık çözünürlüğü veya ayrıntı kaybını gizleme; gerekirse kullanıcıya daha düşük taslak öner.

**Kabul:** taslak ile son çıktı temel silueti ve ölçüleri korur; küçültülmüş kalite gerçek son çıktıymış gibi etiketlenmez.

### T10 — Küçük ve sürümlü modelleme API'si

- [x] İlk kullanım için yaklaşık 15–20 temel komutla başlanabilen bir yüzey tasarla; bu bir başlangıç hedefidir, zorunlu yapay kota değildir.
- [x] Parametreler nesne şeklinde, tutarlı isimlerle; birim/pivot/dönüşüm sırası tek yerde açıklansın.
- [x] API sürümü, çalışan kısa örnek, hatalı örnek ve hata düzeltme örneği ekle.
- [x] API referansı tip/şemadan üretilebilsin; belgede yazan komutun çalışma testi bulunsun.
- [x] İleri motor erişimi mümkün olsun; basit bir iş için tüm OpenCascade API'sini bilmek gerekmesin.

**Önerilen kullanım hedefi — mevcut çalışan kod değildir:**

```js
const sahne = organikModel({ birim: 'mm', yukseklik: 160 });
const boyun = sahne.tup({ ad: 'boyun', yol: [...], kesitler: [...] });
const bas = sahne.hacim({ ad: 'bas', kesitler: [...] });
sahne.yumusakBirlestir([boyun, bas], { gecis: 6 });
sahne.simetrik('kulak', { duzlem: 'XZ', ...kulakParametreleri });
sahne.oyuk({ hedef: 'bas', ad: 'burun_deligi', ...oyukParametreleri });
return sahne;
```

## 7. P2 — Çalışma masası ve proje düzeni

### T11 — CAD komutlarını tamamla

- [x] Loft, revolve, sweep/profil, chamfer, döndürme, ayna ve desen için kısa komutlar.
- [x] Delik koordinatlarının global/yerel anlamını açık tut; mevcut API'nin global XY davranışını sessizce değiştirme.
- [x] Shell/fillet başarısızlığında sorumlu parçayı, boyutu ve olası düzeltmeyi göster.
- [x] Geçersiz CAD işlemini sessizce yaklaşık mesh'e çevirip hassas ölçü gibi sunma.

**Kabul:** delikli aparat, kapaklı kutu ve döndürülmüş profil örnekleri doğru ölçülerle üretilebiliyor.

### T12 — Parça ağacı ve model seçimi

- [x] İsimli ağaç; göster/gizle, seç, odaklan, izole et.
- [x] Canvas seçimi ile ağaç seçimi eşleşsin; seçim render sırasına bağlı olmasın.
- [x] Seçilen parçanın bbox, transform, parametre ve uyarıları gösterilsin.
- [x] Birleşmiş tek çıktı ile düzenleme sırasında ayrı mantıksal parçalar arasındaki ilişki korunabilsin.

**Kabul:** kullanıcı bir kulağa tıklayıp hangi kod/parametre tarafından üretildiğini görebiliyor.

### T13 — Görünüşler ve geometriyi değerlendirme

- [x] Ön/arka/sağ/sol/üst/izometrik sabit kameralar; ortografik/perspektif seçimi.
- [x] Tek tık kadraja sığdırma, doğru eksen/ölçek ve kesit düzlemi.
- [x] Düz kil görünümü, yüzey normali görünümü ve tel kafes; renk ile form kusurları örtülmesin.
- [x] Aynı modelin sabit ayarlarla çok açılı görüntüsünü kaydetme.
- [x] Dar pencere düzeninde modelin kulak/kaide gibi uçları kırpılmasın; yeniden boyutlandırma kadrajı korusun.

**Kabul:** atın profil ve önden formu kamera elle aranarak zaman kaybedilmeden inceleniyor.

### T14 — Yerel referans paneli

- [x] Fotoğraf ekleme, yanında görüntüleme, crop/opacity ve kamera hizalandığında overlay.
- [x] Perspektif fotoğraf ile ortografik modelin doğrudan aynı projeksiyon olmadığını hesaba kat.
- [x] Görünen silueti değerlendirme; görünmeyen taraftaki varsayımları proje notuna ekleme.
- [x] Referans proje içinde korunsun; otomatik harici servise yüklenmesin.

**Kabul:** `outputs/at-kafasi/referans.jpg` aynı çalışma alanında görünür; tek fotoğraftan kesin 3D veya gerçek ölçü çıkarılmış izlenimi oluşmaz.

### T15 — Şemalı parametre paneli

- [x] Sayı, aralık, açı, aç/kapa ve enum için tanımlı parametre şeması.
- [x] mm/° etiketi; min/max/step ve gerçek doğrulama.
- [x] Kaynak, parametre paneli ve çıktı tek bir gerçek kaynağa bağlı olsun.
- [x] Rastgele JavaScript satırlarını regex ile değiştirerek slider bağlama.
- [x] Güncelleme debounce; “henüz üretilmedi” durumu; eski sonucu indirmeyi engelleme.

**Kabul:** büst yüksekliği değişince referans model oranları korunuyor; yalnız kulak boyu parametresi kulakları etkiliyor.

### T16 — Kalıcı proje dosyası

- [x] Sürümlü proje manifest'i: kaynak, parametreler, referanslar, motor/API sürümü, kamera ve kalite ayarları.
- [x] Aç/kaydet/farklı kaydet; son kaydedilmemiş değişiklik uyarısı ve geri alma.
- [x] Başarılı sürümleri geri açma; geçici çalışma ve kalıcı proje ayrımı.
- [x] Son 15 çalışma temizliği kalıcı tasarıma veya `outputs/` arşivine dokunmasın.
- [x] Aynı proje başka makinede açıldığında eksik dosya/engine sürümü anlaşılır biçimde açıklansın.

**Kabul:** tarayıcı kapanıp açılınca proje dosyasından aynı tasarım üretilebiliyor; yalnız localStorage'a bağlı değil.

### T17 — Editör ve hata düzeltme akışı

- [x] Sözdizimi renklendirme, satır numarası, girinti, arama, undo/redo.
- [x] Model kodundaki hata satırı; motor/API'nin verdiği ölçü, parça/işlem bağlamı korunur.
- [x] Hata, eski başarılı önizlemeyi açıkça “önceki sonuç” olarak işaretler ve dışa aktarımları kapatır.
- [x] Örnek seçimi ve URL ile model açılışı değişen taslakta onay ister.
- [x] “Kod hazır”, “üretimde”, “kod değişti”, “hata”, “çıktı güncel” durumları gösterilir.

Uygulama: 2026-10-19'da ilk dilim tamamlandı. URL taslak koruması canlıda gözlendi; örnek dropdown'ındaki tarayıcı native onayının kullanıcı kabul/iptal etkileşimi ayrıca teyit edilmeli. Ayrıntı: `docs/CHANGELOG-KODLA3D.md` içindeki T17 kaydı.

**Kabul:** hatalı satır düzeltildikten sonra tasarım tek akışta tekrar üretilebiliyor; yanlış sürüm dosyası indirilmiyor.

## 8. P3 — Çıktı, performans ve AI geri bildirimi

### T18 — Gerçek desteklenen çıktı matrisi

| Model türü | Öncelikli çıktı | Koşul |
|---|---|---|
| CAD/BRep | STL, STEP, kaynak/proje | Hassas katı kaynak korunur |
| Organik mesh | STL, GLB, kaynak/proje | Mesh doğrulanır; GLB birim dönüşümü açıkça uygulanır |
| Karma tasarım | Desteklenen mesh çıktısı + kaynak parçalar | Tek parça STEP vaadi, tüm parçalar için gerçek destek varsa verilir |
| Sonraki aşama | 3MF | Gerçek format, birim ve parça desteği uygulanıp yeniden açılarak doğrulanır |

- [x] Aynı kod/mod/parametre/CAD ağ kalitesi kombinasyonu için mevcut RAM sonuç önbelleği STL, STEP, kaynak ve önizlemeyi tekrar hesaplamadan yeni iş klasörüne kopyalar; cache anahtarı ağ kalitesini de içerir. Soğuk ilk üretimde CAD STEP hâlâ hazırlanır.
- [x] CAD ağ toleransı seçimi görünür: taslak 0,20 mm / 0,20 rad, normal 0,08 mm / 0,10 rad, ince 0,02 mm / 0,05 rad. Seçim tarayıcıda ve proje manifestinde saklanır; worker bu değerleri STL ve viewport ağında kullanır. Organik örnekleme ayarı mevcut ayrı kalite seçicisidir.
- [x] Mesh'i faceted STEP'e çevirmek parametrik CAD kaynağını geri getirmiş sayılmaz.
- [x] Desteklenmeyen seçenek devre dışı ve nedeni açık olsun; boş dosya oluşturulmasın.

**Kabul:** her aktif indirme gerçek dosyayı oluşturuyor ve yeniden açılabiliyor.

### T19 — Mesh ve baskı uygunluğu raporu

- [x] Boş geometri, NaN/Inf koordinatı, sıfır alanlı üçgen ve yinelenen yüz raporlanır. Binary STL indeks taşımadığı açıkça belirtilir; index-range uygulanamaz.
- [x] Açık/çoklu kenar, tutarlı yönelim, edge-connected bileşenler ve kapalı bileşende imzalı hacim raporlanır.
- [x] Self-intersection yalnız test yoksa “kontrol edilmedi” gösterilir; bu prototipte test yok.
- [x] Epsilon/welding ayarı raporda görünür; exact float32 eşitliği kullanılır, weld epsilon 0 mm ve yakın vertex'ler toleransla birleştirilmez.
- [x] Boyutlar ölçülür; düz taban, minimum özellik/duvar ve overhang/support kapsam dışı olarak raporlanır.
- [x] Yazıcı/nozul/reçine profili olmadığından kesin baskı hazır etiketi verilmez.
- [x] Onarım öncesi/sonrası üçgen, bbox, hacim, bileşen ve topoloji özeti gösterilir. Açık mesh agresif biçimde kapatılmaz.

**Kabul:** bozuk fixture'lar doğru uyarı veriyor; sağlam örnekler gereksiz onarımla değişmiyor.

Uygulama: 2026-10-19'da ön teknik rapor dilimi tamamlandı. Ayrıntı ve 750.000 üçgen analiz sınırı: `docs/CHANGELOG-KODLA3D.md` içindeki T19 kaydı. Gerçek self-intersection ve yazıcı profiline dayalı baskı değerlendirmesi yapılmıyor.

### T20 — İş durumu, iptal ve hata toparlama

- [x] İş kimliği, aşama ve süre; geometri/meshing/export aşamalarını ayır.
- [x] İptal, zaman aşımı ve worker çökmesinde yalnız o işin süreçleri kapanıyor. Üç hata türünden sonra aynı server üzerinde CAD üretimi geçti.
- [x] `busy` kilidi her hata yolunda açılıyor; sonraki üretim çalışabiliyor. İptalden sonra aynı süreçte başarılı CAD üretimi doğrulandı.
- [x] Eski/geç gelen sonuç yeni editör kaynak metnini ezmiyor; değişmiş kodla çıktı eşleşmesi indirme kapısında kontrol ediliyor. Manuel gecikmeli sonuç UI senaryosu açık.
- [x] Kod, log, yüzey örnek sayısı ve çıktı boyutu için gerekçeli sınırlar: 100 KB kod, 1 MiB log, 4M grid hücresi, 100 MiB/dosya ve 250 MiB/toplam çıktı.

**Kabul:** sonsuz döngü/çökme/iptal denemesinden sonra uygulama tekrar başlatılmadan sağlam örnek üretilebiliyor.

Uygulama: 2026-10-19 backend kabulü doğrulandı: iş kimliği/aşaması/süre, iptal/timeout/worker crash sonrası CAD toparlanması ve kod/log/grid/çıktı sınırları. `npm run verify:jobs` ve production build geçti. Gecikmiş sonuç UI görsel kabulü açık; ayrıntı `docs/CHANGELOG-KODLA3D.md` T20 kaydı.

### T21 — Ölçüme dayalı hızlandırma

- [x] İçerik hash'i + parametre + kalite + motor/API sürümü + referans/asset sürümünü kapsayan cache anahtarı.
- [x] Tekrarlanan dışa aktarımı yeniden hesaplamama.
- [x] WASM sıcak worker havuzu açılmadı. T01 at kafası worker RSS tepe ölçümü ~910 MiB; bellek ömrü/işler arası tam reset kanıtı yok, her işte yeni worker izolasyonu korundu.
- [x] Tek parça değişiminde kısmi yeniden hesaplama yapılmıyor: serbest JS kodu ve parça bağımlılık grafiği yok; tam build akışı korunuyor, artımlı geometri iddiası yapılmıyor.
- [x] Grid çözünürlüğüyle maliyetin kübik büyümesi 4M hücre sınırıyla kesiliyor; sınır aşımında açık hata var, kalite sessiz düşürülmüyor.

Güncel yerel ölçümler (garanti değil): basit CAD 3 tekrar median wall 1,436 sn; aparatı 1,503 sn; at kafası 46,378 sn (worker medyanları sırasıyla 0,752/0,828/45,392 sn). Cache benchmark'ında aynı basit CAD için ilk worker wall 1,216 sn, dört cache tekrarı warm median 15,364 ms; STL 684 B ve hash 5 tekrarda aynı. Mevcut hedefler: basit CAD cold ≤2 sn; orta SDF boyun taslak fixture'ı için worker ≤1 sn (daha karmaşık organik modeller ayrıca ölçülecek); at başı CAD cold ≤50 sn. Bunlar bu makinenin örnek medyanlarıdır, dağıtım hedefi/garanti değil. Kaynaklar: `docs/baseline-measurements.json`, `docs/cache-benchmark.json`.

### T22 — AI'ın okuyacağı araç yüzeyi

- [x] Model üretimi, durum, parametre/nesne listesi, ölçüm, doğrulama raporu ve çıktı için belgeli JSON sözleşmesi.
- [x] Başarılı bir işin sabit kameralı görsellerini alabilme; yalnız “dosya oluştu” sinyali yetmesin.
- [x] Hata kodu + parça/işlem/parametre + düzeltme bağlamı; ham stack ayrı. Bilinmeyen part/operation açıkça null; parametre path ve syntax source konumu verilir.
- [x] Kaynak/sonuç ilişkisinin hash veya revizyonla doğrulanması.
- [x] CLI ve API sözleşme kontrolleri eklendi.
- [x] Otomatik düzeltme döngüsü eklenmedi; LLM ve gizli retry yok.

**Kabul:** bir ajan kodu gönderip sonucu ölçü/görsel/hata üzerinden değerlendirebiliyor; kullanıcı arayüzünü körlemesine tıklamak zorunda kalmıyor.

Uygulama: `/api` rotaları ve JSON/error schema `docs/HTTP-API.md` içinde; `node scripts/kodla3d.mjs` health/examples/status/build, progress ve çıktı indirme sunuyor. Worker her başarılı STL için ön/arka/sağ/sol/üst/izometrik sabit kameralı 720×408 PNG üretip API'dan `files.visual` olarak sunuyor; CLI `--out` bunu `views.png` diye kaydediyor. `npm run verify:jobs` hata sözleşmesini, PNG imza/boyut/sıra bilgisini, cache'te aynı PNG byte'larını, CLI dosya indirmesini ve iptal/zaman aşımı/çökme sonrası toparlanmayı doğruladı. Render düz gölgelendirmeli tanısal görseldir; ayrıntılı etkileşimli inceleme tarayıcı arayüzünde kalır. Otomatik LLM düzeltme döngüsü eklenmedi.

### T23 — Yerel çalışma ve dağıtım temizliği

- [x] Güvenilen yerel kod sözleşmesini koru; worker izolasyonu sandbox diye pazarlanmasın.
- [x] Sunucu localhost'ta kalsın. Dışa açma, kullanıcı hesabı, bulut ve ödeme akışı bu sürümün kapsamı değil.
- [x] Kurulum, başlatma, durdurma ve sürüm tanılama komutları anlaşılır olsun.
- [x] Bağımlılıklar kilitlensin; aktif/deneysel/vendor ayrımı ve lisanslar belgelenmiş olsun.
- [x] CadQuery denemesini ve kullanıcı çıktısını sormadan silme; projenin yayın lisansını kullanıcı adına seçip yayımlama.

Uygulama: `Kodla3D.cmd`/`Kodla3D.ps1` setup/start/status/diagnose/stop komutlarını sağlar; `Baslat.cmd` çift tıklama yolu korunmuştur. Health endpoint'i Node/engine/uygulama sürümü, direkt bağımlılık sürümleri ve yerel kurulum kimliği taşır. Ayrı 18773 portunda start → status → diagnose → stop akışı geçti. `Kurulum.ps1` artık kilitli `npm ci` + build kullanır ve Git/source-klon gerektirmez; vendor, deneysel CadQuery ve kullanıcı çıktıları korunur. `docs/T23-KULLANICI-AKISI.md` akış/risk kararlarını; `docs/LISANSLAR.md` kilitli paket ve snapshot metadata envanterini kaydeder. Temiz makinede `npm ci` baştan sona bu turda denenmedi; LGPL/transitive uyum ve proje yayın lisansı kararı açık.

## 9. P4 — At kafası V2: ana görsel kabul örneği

### T24 — Formu referans üzerinden yeniden kur

- [x] V1 kaynak ve çıktısını koru; V2 ayrı model/sürüm olsun.
- [x] Önce büyük siluet ve oranlar: boyun eğimi/kalınlığı, alın–burun açısı, çene hacmi, ağız uzunluğu, kulak boyu/aralığı.
- [x] Sonra göz konumu/kapak, elmacık/çene geçişi, burun delikleri ve dudak çizgisi.
- [x] Sonra bağlı yele tutamları; ayrıntı temel siluet kusurunu örtmek için kullanılmasın.
- [x] Keskin birleşim çizgileri ve boru gibi boyun görünümünü bölgesel şekillendirmeyle ele al. (V2 alt boyun merkezi geriye taşınarak omuzdan enseye daha belirgin bir geçiş verildi; tarayıcıdaki sol profil ve tek katı CAD üretimi kontrol edildi. Bu teknik değişiklik Doğukan'ın estetik onayı değildir.)
- [x] Fotoğraftaki görünen açıya yakın kamera hizala; ön/yan/arka/üç çeyrek görüntüler üret.
- [x] Beyaz alın lekesi gibi renk özelliklerini yüzey geometrisiyle karıştırma; renkli önizleme ve baskı formunu ayrı değerlendir. (Viewport ribbon'ı V2 CAD preview mesh'ine raycast ile yüzeyden 0,035 mm taşır; STL/STEP/GLB'den ayrı. Taze tarayıcı sekmesinde doğru profil görünüşünde canlı kontrol edildi; kullanıcının estetik kabulü ve fiziksel çok renkli baskı denemesi bu teknik maddeyi kapatmaz ve hâlâ dış kapıdır.)
- [x] Varsayılan 160 mm ölçüyü parametre olarak koru; gerçek hayattaki atın boyutu diye sunma.

**Teknik kabul:** amaçlanan bileşen sayısı, doğru ölçek, geçerli temiz STL, raporlu hacim/bbox ve tekrar üretilebilir kaynak.

**Görsel kabul:** V1 ve V2 aynı kamera/ışık/materyal altında karşılaştırılsın. Doku/Luna kendi gözlemini yazabilir; “Doğukan beğendi”, “birebir oldu”, “%95 benzer” gibi sonuçlar kullanıcı onayı veya tanımlı gerçek ölçüm olmadan yazılmasın. Tek fotoğrafın görünmeyen tarafı varsayım olarak kalsın.

**Teslim:** `models/at-kafasi-v2.js`, kalıcı proje, `outputs/at-kafasi-v2/` içinde kaynak/mesh/uygun formatlar, referans, çok açılı önizleme ve doğrulama JSON'u.

Uygulama: `models/at-kafasi-v2.js` ve ayrı parametre şeması oluşturuldu; V1 dosyalarına dokunulmadı. Daha sık baş profili/yanak kesitleri, yanak hacmi slider'ı, kaş kemeri, burun/ağız detayları ve bağlı yele kabartı/olukları eklendi. 2026-10-20'de alt boyun loft'u geriye akışlı omuz kütlesi verecek biçimde değiştirildi; IAB'de Sol profil kontrol edildi ve kalıcı V1/V2 üretimi tekrar geçti. Güncel V2 teknik sonuç: kaide dahil 160 mm, 1 solid, 125 BRep yüz, 181.722 STL üçgen, analiz tam; boundary/non-manifold/yön kenarı 0, tek kapalı bileşen. Hacim 189,21 cm³; V1'e göre +3,91% (anatomi/benzerlik metriği değildir). STEP 2.285.147 B. `npm run build:horse-v2` V1/V2'yi aynı sabit CPU kameralarında üretip karşılaştırır; `outputs/at-kafasi-v2/` kaynak, STL, STEP, iki PNG, proje manifesti, referans kopyası ve doğrulama raporunu tutar. Mesh raporu baskı profili, min duvar, destek/overhang ya da self-intersection garantisi vermez; STEP bağımsız CAD uygulamasında yeniden açılmadı. 2026-10-20'de `src/main.js` viewport'una yalnız önizlemede görünen, yüzeye raycast ile oturan açık renkli blaze çizgisi ve STL/STEP/GLB'ye girmediğini belirten UI notu eklendi; temiz IAB profilinde kontrol edildi. Açık: Doğukan'ın estetik kabulü, gerçek baskı ve referans fotoğrafının yeniden dağıtım lisansı. STEP bağımsız Replicad/OpenCascade import ile yeniden açıldı; harici CAD masaüstünde denenmedi.

### T25 — Tek örneğe göre tasarlamadığını göster

- [x] Organik örnekler: at büstü, basit yüz/maske, kıvrımlı sap veya doğal taş formu.
- [x] CAD örnekler: kapaklı kutu, delikli aparat, profil döndürme.
- [x] Hata örnekleri: boş model, ayrık parça, aşırı ince detay, çözünürlük aşımı, yanlış parametre, worker çökmesi.
- [x] Beklenen sonuçlar ve sınırlar fixture manifest'inde yazsın.

**Kabul:** API tek bir at şablonunun parametrelerinden ibaret değil; farklı nesneler aynı genel komutlarla üretilebiliyor.

Uygulama: `docs/AI-FIXTURES.json` 3 CAD ve 5 organik başarılı örneği/ayrık kabuk fixture'ını, boş kodu, 0,2 mm çözünürlük probunu, 4M grid bütçesini, geçersiz V2 parametresini ve worker çökmesini beklenen sonuç/sınırla tanımlar. T24 at V2 artefact'i ayrı `verify:horse-v2` ile bağlanır. `npm run verify:fixtures` 8 örneği (her örnekte ölçü, dolu ve complete mesh; topoloji; format), 7 edge/recovery vakasını izole API'de geçti; makinece yazılmış `docs/AI-FIXTURE-SONUCLARI.json` gerçek metrikleri saklar. 0,2 mm çaplı küre normal kalitede Manifold'un “geçerli hacim üretemedi” hatasıyla reddedildi; bu genel minimum özellik garantisi değildir. 4M grid üstü açık 422 hata verir; worker crash sonrası Kutu yeniden üretildi. Bu yerel fixture sonuçları gerçek AI/model başarı benchmark'ı veya baskı onayı değildir.

### T26 — Küçük AI kullanımını ölçülebilir hâle getir

- [x] 10 kısa görev tanımla: üret, ölçü değiştir, delik ekle, yalnız bir parçayı değiştir, simetri, organik birleşim, oyuk, hata düzelt, proje geri aç, çıktı al.
- [x] Ölçüler: kullanılan belge/context miktarı, ilk geçerli üretim, revizyon sayısı, doğru hedef parça, görsel uygunluk, çıktı geçerliliği.
- [x] Yalnız çalışabilir kod ile doğru tasarım başarılarını ayır.
- [x] Önce yerel görev/örnek testlerini tamamla. Gerçek küçük-model çalıştırması ayrıca izin/bütçe gerektiriyorsa bunu açık bırak.
- [x] Başka bir model/alt ajan veya ücretli servis kendiliğinden başlatma. Gerçek model denenmediyse “küçük AI ile başarı doğrulandı” deme.

**Teslim:** `docs/AI-GOREV-SETI.md` + sonuç şeması. Gerçek benchmark yapılmadıysa açık iş olarak görünür.

Uygulama: `docs/AI-GOREV-SETI.md` içinde 10 deterministik görev promptu, kod-vs-tasarım puanı, context byte/karakter/token kaynağı, deneme/revizyon/süre ve görsel reviewer protokolü var. `docs/AI-GOREV-SONUC-SABLONU.json` typed/boş sonuç şeması sunar. T25 yerel fixture seti ve önceki CAD/parametre/parça/proje verifier'ları makine tarafı zemindir. Harici model/provider çağrılmadı; sonuç şablonu `invoked:false`, `not_run`. Dolayısıyla T26 protokol slice doğrulandı, gerçek küçük-model başarısı doğrulanmadı ve ayrı izin/bütçe kararı bekler.

### T27 — Anlamlı testler ve son teslim

- [x] Geometri invariant testleri: transform/pivot, bbox/ölçek, simetri, hedef parça ve smooth union kapsamı. Kanıt: `verify-authoring-features.mjs`, `verify-cad-authoring.mjs`, `verify-part-tree.mjs`.
- [x] Kutu/aparat ve At V2 için CAD/STL/STEP üretildi; bağımsız Replicad/OpenCascade process instance ile STEP, Manifold mesh importer ile STL yeniden açıldı. Sınır: başka masaüstü CAD uygulamasında açma ayrıca denenmedi.
- [x] İptal, bozuk giriş, kilit/worker recovery, eski sonucu indirme koruması ve proje akışı kontrolleri. UI T17 kabul/iptal ile T20 geç gelen sonuç güncel turda; gerçek proje manifesti file-picker roundtrip önceki T16 kanıtında.
- [x] V1/V2 aynı sabit kameralarla kıyaslandı; PNG piksel farkı estetik/doğruluk puanı sayılmadı.
- [x] Gerçek tarayıcı akışı: örnek aç → parametre değiştir → üret → syntax hatasını düzelt → STL/STEP ve proje kaydetme akışı. Gerçek indirilmiş proje file-picker roundtrip önceki T16 kanıtıyla bağlı; bu turda tarayıcı indirmesinin Windows Downloads hedefi görünür olmadı.
- [x] Anlamlı hata yolları: sıfır yarıçap, grid bütçesi, geçersiz loft/revolve, fillet/shell başarısızlığı, iş iptali/timeout/worker crash ve toparlanma.
- [x] Son raporda geçen/başarısız/denenmedi ayrımı, komutlar ve artifact metrikleri: [`T27-SON-KABUL-RAPORU.md`](./T27-SON-KABUL-RAPORU.md); source of truth [`DOGRULAMA.md`](./DOGRULAMA.md).

Uygulama: 2026-10-20 T27 teknik regresyon raporu tamamlandı. `verify-exchange-reopen.mjs` kutu, aparat ve at V2 STEP/STL dosyalarını gerçek importerlarla tekrar açtı. `verify-authoring-features.mjs` origin-dışı pivot ölçek invarianti eklendi. Üç API verifier'ı geçici `KODLA3D_OUTPUT_ROOT` ile çalışıyor; fixture verifier sonucu `KODLA3D_FIXTURE_RESULTS` ile temp'e yazabiliyor. Yeni temiz klasörde `npm ci` ve `npm run build` geçti. Browser örnek onay/iptali, parametre revizyonu, hatalı kodu onarma ve üretim esnasında kaynak değiştirme gerçek IAB'de gözlendi. Görsel at formu kullanıcı onayı, dış CAD uygulaması, fiziksel baskı ve yayın lisansı teknik raporun dışında açık kapı olarak kaldı.

## 10. İlk sprintin dar kapsamı

İlk teslim **T01–T05 + T09'un temel kalite ayarı + T03'ün gerekli entegrasyonu** olsun. Birleşen iki organik hacim ve kaba boyun/baş örneği, gerçek önizleme ve geçerli STL ile gösterilsin. Kutu/aparat bozulmasın.

Bu kapı geçilince isimli parça/bölgesel revizyon ve çalışma masasına ilerle. Yeni büyük bir arayüzü, organik çekirdeğin işe yaradığını göstermeden baştan yazma. İlk sprintte faturalama, hesap, mağaza, sosyal paylaşım, tam Blender kopyası, ücretli image-to-3D entegrasyonu veya otomatik fotogrametri yapılmayacak.

## 11. Luna'nın bırakacağı iz ve rapor

- `docs/ILERLEME.md`: görev ID'si, durum (`bekliyor / sürüyor / doğrulandı / engel`), değişen dosyalar, kanıt ve sonraki adım.
- `docs/BASELINE.md`, `docs/ORGANIK-MOTOR-KARARI.md`, güncel `docs/AI-KULLANIM.md`.
- Yeni örnek kaynakları ve doğrulanmış kalıcı çıktı klasörleri.
- `docs/DOGRULAMA.md`: gerçekten yapılan kontroller; eski sonuçlar korunarak yeni sürüm ayrımı.
- Kısa son mesaj: ne artık yapılabiliyor, nasıl açılır, hangi örnek incelensin, hangi sınır açık.

Bir checkbox yalnız kod yazıldığı için tamam sayılmaz. İlgili kabul ölçütü geçmeli; görsel kalite onayı kullanıcıdaysa bu ayrı açık durum olarak kalmalı. Proje hafıza indeksindeki eski çakışmaları bu geliştirmeye bağlayıp kapsamı dağıtma; Markdown proje kaynaklarını gerçek kabul et.

## 12. Birincil kaynaklar ve kullanım sınırları

- [Replicad resmî kaynak](https://github.com/sgenoud/replicad), [kütüphane olarak kullanım](https://replicad.pages.dev/docs/use-as-a-library/): mevcut CAD/JS yaklaşımını ve entegrasyonu incelemek için.
- [Manifold resmî kaynak ve JS/WASM bağları](https://github.com/elalish/manifold), [teknik dokümantasyon](https://manifoldcad.org/docs/html/): sağlam mesh işlemleri, level-set ve yüzey iyileştirme adayı. Kütüphanenin kendi garanti koşullarını, geçerli giriş beklentisini ve JS sürümünün gerçek desteğini doğrula.
- [Three.js MarchingCubes](https://threejs.org/docs/pages/MarchingCubes.html): örtük yüzey prototipi adayı; tek başına baskı topolojisi garantisi değil.
- [Blender voxel/adaptive çözünürlük açıklaması](https://docs.blender.org/manual/en/4.3/sculpt_paint/sculpting/introduction/adaptive.html): organik formda remesh ve ayrıntı/yoğunluk dengesini anlamak için; otomatik doğru anatomi vaadi değil.

Bu kaynaklar aday değerlendirmesini destekler. Bu brif hazırlanırken Manifold kurulmadı, organik yeni motor uygulanmadı ve küçük AI benchmark'ı yapılmadı.
