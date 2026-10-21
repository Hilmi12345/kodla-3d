# İlk iskelet doğrulaması — 19 Ekim 2026

Aktif motor: Replicad 1.1.0 + replicad-opencascadejs 1.1.0, Node 24.19.0. Arayüz derlemesi: Vite 7.3.7. Üretim derlemesi geçti; Three.js paketinin 500 KB üzerindeki boyutu için bilgilendirici uyarı var.

## Gerçek çıktı kontrolleri

| Örnek | Model ve STL ölçüleri | Hacim | STL üçgeni | STEP yeniden açma |
|---|---|---|---|---|
| L bağlantı aparatı | 70 × 40 × 35 mm | 28.744,38055 mm³ | 1036 | Hacim korunuyor |
| Yuvarlatılmış açık kutu | 80 × 50 × 25 mm | 27.907,03525 mm³ | 1052 | Hacim korunuyor |

STL dosyaları binary başlık, üçgen sayısı ve gerçek köşe koordinatlarından denetlendi. STEP dosyaları aynı CAD motorunda yeniden içeri alındı; hacimler 1e-6 bağıl tolerans içinde eşleşti. İndirilen `.js` kaynağı gönderilen kodla aynı.

- Negatif genişlik: HTTP 422, anlaşılır hata.
- Yabancı web origin'inden üretim isteği: HTTP 403.
- Tarayıcıda 80 mm genişlik 90 mm yapıldı: eski dosyaların indirilmesi kapandı; tekrar üretimde 90 × 50 × 25 mm / 30,73 cm³ gösterildi, indirmeler yeniden açıldı. 3D model görsel olarak incelendi.
- İç boşaltma işleminin işareti gerçek ölçü kontrolünde düzeltildi: dış ölçüler artık korunuyor.

## Sınırlar

Bu kontroller basit iki örneğe ve bir ölçü revizyonuna dayanır. Küçük AI modellerinin başarı oranı, detaylı organik tasarım, 3D yazıcıyla fiziksel baskı, dayanım ve üretim toleransları denenmedi. STEP yeniden açma aynı motorla yapıldı; farklı CAD yazılımıyla karşılaştırılmadı.

CadQuery'nin yerel Python motoru bu Windows ortamında import sırasında takıldı; çalışan motor olarak raporlanmaz. Deneme kodu `experimental/cadquery/` içinde korunur. Sistem güvenlik ayarları değiştirilmedi.

## At kafası referansı — ilk organik taslak

Doğukan'ın `images.jpg` referansı kullanılarak kodla stilize bir büst oluşturuldu. Varsayılan yükseklik 160 mm; fotoğraftan gerçek ölçü çıkarılmadı. Model 121,45 × 48,19 × 160 mm, tek katı cisim, 111 yüz ve 182,10 cm³ hacim olarak üretildi.

STL: 187.052 üçgen. Loft uçlarında float STL çıktısında oluşan 26 sıfır uzunluklu üçgen temizlendi; bu temizleme `model-worker.mjs` dışa aktarımına eklendi. Temiz STL'de tekrarlanan köşeli üçgen, açık kenar veya ikiden fazla kullanılan kenar kalmadı. STEP yeniden içeri alındığında hacim 1e-6 bağıl tolerans içinde korundu.

Tarayıcıda model açıldı ve görseli incelendi. Görsel değerlendirme: sade heykel/satranç taşı taslağına yakın; gerçekçi yele/deri/kas ayrıntıları yok. Kullanıcı beğenisi, birebir benzerlik ve fiziksel baskı doğrulanmadı. Kalıcı dosyalar `outputs/at-kafasi/` içinde.

## İlk organik API sprinti — 19 Ekim 2026

`scripts/verify-first-sprint.mjs` ile mevcut CAD varsayılanı ve yeni organik API doğrulandı. Ayrıntılı makine raporu `outputs/organik-boyun/DOGRULAMA.json` içinde.

- Legacy CAD isteği (mode olmadan) kutu/aparatı aynı ölçü ve hacimle üretti; STEP dosyaları ISO-10303 başlığıyla oluştu ve STEP yeniden açma hacimleri korundu.
- Organik taslak/normal/ince ayarlar sırasıyla 3152 / 9560 / 19998 üçgen üretti. İnce ayara göre hacim farkı taslakta %0.869, normalde %0.177 oldu. STL byte uzunluğu, finite koordinat, sıfır alan, kapalı kenar ve kaynak hash kontrolleri geçti.
- Smooth subtraction iç boşluk oluşturdu; 2 yüzey kabuğu sayıldı (dış ve iç yüzey). Ayrık şekillerin birleşmediği örnek korundu.
- Sıfır yarıçap ve grid sınır aşımı anlaşılır 422; bilinmeyen mod/kalite 400 verdi. Hatalı üretimden sonra worker kilidi serbest kaldı.
- Preview IAB screenshot'ında ilk dört viewport boştu. Kamera mesafesi hatası düzeltildikten sonra 4/4 panel `Yüklendi` oldu; hard union, kavisli hacim ve yan siluet görünür biçimde doğrulandı.

Bu kontroller organik ince detay/gerçekçilik, fiziksel baskı, dayanım veya yazıcı toleransı doğrulaması değildir. Üçgen ve süre/RAM değerleri küçük örneğe özeldir.

## T06–T08 modelleme API'si — 19 Ekim 2026

`node scripts/verify-authoring-features.mjs` geçmiştir. Kaynaklar, binary STL'ler, boyutlar, hacimler, parça manifest'i ve sınırlamalar `outputs/organik-t06-t08/DOGRULAMA.json` içinde.

- T06: `kulak-sol` ID'li parçanın `kulak-sag` aynası YZ düzleminde üretildi; `sourceId` bağlantısı, negatif ölçek transform metadata'sı, iki kapalı yüzey ve STL üçgen/byte sayısı doğrulandı. ID çakışması, isim çakışması, kilitli edit ve görünmeyen tekli grubun hataları denendi. Grup içindeki tek hedef parçayı taşımak kardeş parçanın field'ını ve group ID'sini korudu.
- T07: lokal compact-falloff yanak düzenlemesi ölçüldü: plain 7.832,52 mm³ → kabarık 7.866,47 mm³, +33,95 mm³. Etki yarıçapının dışındaki örnek noktada signed distance değişmedi. Göz çukuru işlemi için uzaktaki uçta değişim 0'dı.
- T08: binary STL'ye geçen göz çukuru −24,80 mm³; kabartılı eğri +1,76 mm³; dudak benzeri groove −23,09 mm³. Güncel birleşik kafa/burun ve iki yele-tutamı örneği 15.710 tri / 785.584 byte STL üretti. İlk çok ince groove sıfır alan triangle oluşturdu ve reddedildi; fixture çözünürlükle uyumlu kalınlığa taşındı.
- Üst görevin ilk görsel denetimi simetri ve yanak çıkıntısını gördü. İlk detay örneği göz çukurunu tırtıklı, yele tutamını görünmez gösterdi; örnek kod ve STL bu gözleme göre güncellendi. **Güncel T08 screenshot'ı alınana kadar görsel kabul tamamlanmış değildir.**

Bu API, interaktif parça ağacı UI değildir. Surface alignment, minimum duvar, fiziksel baskı veya at anatomisi garantisi de vermez.

## T11–T18 devamı — 19 Ekim 2026

- T11 genel profil süpürme/loft: `npm run verify:sweep` geçti; süpürme 1 CAD solid, 88 STL üçgeni, STEP 35.636 B; serbest loft 1 solid. Sıfır uzunluklu yol segmenti reddedildi.
- T12 parça ağacı: `npm run verify:parts` geçti (3 mantıksal organik düğüm, transform/source ilişkileri ve bounds). UI canvas picking ve CAD birleşik BRep'de gerçek parça mesh eşlemesi hâlâ yok; T12 tümüyle kabul edilmedi.
- T13: Altı görünüşlü PNG UI akışı ve at modeline özel kamera eksenleri IAB'de görüldü. Canvas PNG blob indirme bildirimi verdi; gerçek PNG dosya piksel doğrulaması tarayıcı indirme yolundan alınamadı.
- T15: sayı/açı/boolean parametreler model geometrisini değiştirdi; örneğin burun açısı 0°→5° bbox X ve hacmi değiştirdi. `verify:parameters` number/angle/boolean/enum doğrulamalarını geçti.
- T16 manifest: izole 8767 tarayıcıda indirilen `.kodla3d.json` gerçek file chooser ile geri açıldı. Geometri üretimi tetiklenmedi ve kaynak editörde geldi.
- T18 GLB: `organik-boyun` son mesh'inden IAB download'ı 689.392 B GLB 2.0 üretti. Dosya binary header/length, JSON chunk, tek mesh/9.560 triangle ve node matrix `[0.001,0,0;0,0.001,0;0,0,0.001]` açısından okundu. Accessor 17,99×11,00×34,99 mm bounds'un metre cinsine dönüştüğünü gösterdi. Bu dilim organik GLB içindir; format/yeniden açma matrisi ve 3MF değildir.
- Üretim derlemesi geçti; ana JS chunk 542,09 kB, lazy GLTFExporter chunk 35,25 kB. Ana chunk için Vite 500 kB üstü uyarısı sürüyor. `verify:project`, `verify:parameters`, `verify:sweep`, `verify:cad`, `verify:parts`, `verify:glb` kontrolleri başarıyla koştu. Lazy exporter sonrası indirilen GLB yine 689.392 B ve `verify:glb` passed. Sunucu yalnız izole 8767'deydi; 8765'e dokunulmadı.
## T16 başarılı sürüm geçmişi — 2026-10-19

- `npm run verify:project` passed: önceki başarılı sürümün parametre snapshot'ı korunuyor; geçersiz sonuç hacmi, 11 geçmiş girdisi ve 700 KB üstü geçmiş reddediliyor; legacy v1 manifest doğrulaması sürüyor.
- `npm run build` passed. Vite, ana 545,70 kB JS chunk için 500 kB uyarısı verdi.
- UI geçmişi proje manifest'inde son 10 başarılı üretimi saklar (700 KB bütçe). Restore kaynak ve ayarları geri açar; yeniden üretime kadar dosya indirmesi kapalıdır.
- Bu oturumda IAB'de yeni sürüm UI akışı doğrulanamadı; tıklama/kısayol ile üretim listesi değişmedi. Daha önceki gerçek manifest indirme/açma roundtrip kanıtı `ILERLEME.md` içinde korunur.

## T11–T16 kabul güncellemesi — 19 Ekim 2026

- T11 kapaklı kutu kabulindeki boşluk kapatıldı: eski kontrol yalnızca açık kutu gövdesini sınamıştı. `scripts/verify-cad-authoring.mjs` artık 30×20×15 mm boş gövde, geçme dili ve ayrı kapağı kuruyor. `npm run verify:cad` 8767'de geçti: 34×24×17,5 mm, 6022,72 mm³, 2 katı; STL 56 üçgen, STEP 62.823 B. Aynı koşuda delikli aparat 30×20×5 mm/1 katı; döndürülmüş profil 20×20×18 mm/1 katı. `npm run verify:sweep` da geçti: serbest sweep 1 katı/88 üçgen/STEP 35.636 B; loft 1 katı; sıfır uzunluklu segment açık hata verdi.
- T12 CAD yüz kimliği: OCCT `FillHistory` yüz geçmişi → `Face.hashCode` → mesh üçgen grubu → viewport raycast → parça ID hattı doğrulandı. Basit birleşim: 1 katı, 6 yüz, 12 üçgen ve tüm yüz grupları kaynak ID'lerine bağlı. Gerçek at büstü: 1 katı, 111 yüz, 187.342 üçgen; sol ve sağ kulak 5'er görünür yüzle eşleşti. IAB canvas tıklaması ağaç seçimini değiştirdi; gizle/izole/odak kontrolleri ve kaynak/parametre kartı çalıştı.
- T13: tarayıcıdan `kodla3d-coklu-gorunus.png` indirildi ve açıldı. PNG imzası `89-50-4E-47-0D-0A-1A-0A`; ölçü 1440×788, dosya 295.552 B, altı etiketli kamera görünüşü mevcut. Altı-view export kamera konumunu/target'ını geri yükledi.
- T15: at kafası aynı workerda iki kez üretildi. `kulakUzunlugu` 39→45 mm olunca iki kulak üst Z bounds'u 160,00→165,78 mm çıktı; boyun, baş, yele ve kaide bounds'ları eşit kaldı. `verify:at-part-provenance` bu gerçek üretim karşılaştırmasını içerir.
- T16 canlı tur: tarayıcı manifesti `C:\Users\doguk\Downloads\at-kafasi-t12-roundtrip.kodla3d.json` olarak indirdi; gerçek file chooser ile içe aldı. Yeni sekmede yeniden üretim ölçüleri 121,4×48,2×160 mm / 182,10 cm³ / 1 katı / 111 yüz ile manifest sürümüne eşti. Yeniden üretim öncesi mesh/STEP/STL indirme kapalıydı. Kirli proje durumu gösterildi; reload denemesinde sayfa/proje değeri korunarak unload uyarısının gezinmeyi engellediği gözlendi. Kamera/projeksiyon kaydı manifestte `left`/`orthographic` olarak bulundu; yeniden import UI kontrolü sekme zaman aşımı yüzünden tamamlanmadı.
- `npm run verify:project`, `verify:parameters`, `verify:cad-provenance`, `verify:parts`, `verify:at-part-provenance`, `verify:sweep`, `verify:cad` ve `npm run build` geçti. Üretim bundle'ı 551,97 kB; Vite 500 kB üstü bilgi uyarısı sürüyor.
- Geçici sunucu yalnız 8767'de çalıştı. 8765 kullanıcı sunucusuna dokunulmadı. Fotoğraf lisansı ve son at biçiminin görsel kabulü Doğukan'a açık durum olarak bırakıldı.

## T27 son kabul — 20 Ekim 2026

- Yeni `npm run verify:exchange-reopen`: kutu (80×50×25 mm), aparat (70×40×35 mm) ve at V2'nin gerçek STEP dosyaları ayrı test process'i içindeki Replicad/OpenCascade importer ile tekrar açıldı. Üçünde de 1 solid, önceki bounds ve hacim ölçüsü korundu. STL'ler Manifold `MeshShape` importer ile yeniden açıldı; üçgen sayısı kutu 1.052, aparat 1.036, at V2 180.540 olarak eşleşti.
- Geometri: CAD rotate+chamfer, mirror, pattern, loft, revolve, holes, detachable lid; organik pivot `[2,0,0]` etrafında X2 scale, symmetry, local edits, targeted child replacement ve smooth union kontrolleri geçti.
- İş yaşam döngüsü + fixture: `verify-job-lifecycle.mjs` cancel/timeout/crash sonrası toparlanmayı geçti; `verify-ai-fixtures.mjs` 8 başarı + 7 invalid/recovery vakasını geçti; crash sonrası CAD tekrar üretildi. `verify-first-sprint.mjs` ve CAD authoring testleri temp çıktı köküne yazdı.
- IAB 19428'de gerçek At V2 örneği açıldı; yanak 12→16 mm ile 119,5×48,2×160 mm/186,16 cm³ üretildi. Bozuk `return {` hatası önceki sonucu korudu ve indirmeyi kapattı; 30×20×10 mm/6 cm³ düzeltmesi geçti. Örnek onay/iptal, üretim sürerken editor source değişikliği ve geç gelen eski sonucun indirmeyi kapalı bırakması da gözlendi; yeni 44×20×10 mm/8,8 cm³ model başarıyla üretildi.
- Browser proje kaydet düğmesi “Proje dosyasıyla eşleşiyor” durumuna geçti. Bu koşuda indirme dosyası Windows Downloads dizininde gözlenmedi; gerçek file picker import/rebuild kanıtı önceki T16 kabul kaydında mevcut ve bu turda yeniden iddia edilmiyor.
- Yeni scratch kopyada lockfile `npm ci` 60 paket kurdu; npm audit 0 vulnerability verdi; `npm run build` geçti. Esbuild install-script allowlist uyarısı çıktı; build başarılı. Vite ana JS 558,77 kB, 500 kB uyarısı sürüyor. Aktif node_modules değişmedi.
- Kapsam sınırları: external desktop CAD app ile STEP açma, fiziksel baskı, duvar/overhang/print profile, at anatomisi için kullanıcı görsel kabulü, renkli blaze, AI provider benchmark'ı ve hukuki lisans onayı denenmedi. Detaylı geçer/denenmedi tablosu: [`T27-SON-KABUL-RAPORU.md`](./T27-SON-KABUL-RAPORU.md).

### T16 canlı restore ve kamera ayarı — ek kanıt

- Preview-only IAB'de iki başarılı sürümlü manifest açıldı; “Test sürümü · 45 mm kulak” seçilince kaynağı geri aç düğmesi kodu/parametre snapshot'ını getirdi ve UI kulak slider'ı 45 mm gösterdi. Dirty durumuna geçti; üretim disabled kaldı.
- Ayrı manifestte kamera `left`, projeksiyon `orthographic` olarak kaydedildi. Yeni preview sekmesinde içe aktarınca iki UI select de aynı değerleri gösterdi.
- Kalıcı teslim kopyaları `outputs/at-kafasi/at-kafasi-calisma.kodla3d.json` (16.052 B) ve `outputs/at-kafasi/coklu-gorunus.png` (295.552 B/1440×788) olarak saklandı; `outputs/at-kafasi/README.md` bunları ve referans dosyası şartını anlatıyor.

