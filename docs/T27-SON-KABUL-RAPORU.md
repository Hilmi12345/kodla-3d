# T27 — Son kabul raporu

Tarih: 2026-10-20 · Ortam: Windows, Node v24.19.0, npm 11.17.0 · Sonuç: **teknik regresyon geçti; kullanıcı/üretim kabulleri ayrı açık**.

## Kabul maddeleri

| Gereksinim | Durum | Kanıt / sınır |
|---|---|---|
| Transform, pivot, bbox/ölçek, simetri, hedefli parça düzenleme ve smooth union | **Geçti** | `verify-authoring-features.mjs`: pivot `[2,0,0]` etrafında X2 ölçeklenen kürenin merkezi X=6 oldu; simetri sınırları, hedef çocuk düzenlemesi, uzak alanda değişmeme ve tek kabuklu smooth-union örneği geçti. `verify-cad-authoring.mjs`: dönüş/ayna/desen ölçüleri geçti. |
| Kutu/aparat CAD üretimi ve STEP/STL yeniden açma | **Geçti** | `verify-exchange-reopen.mjs`, API çıktısını ayrı test sürecinde Replicad/OpenCascade STEP importer ve Manifold tabanlı STL importer ile açtı. Kutu: 80×50×25 mm, STEP hacmi API ile aynı; 1.052 STL üçgeni korundu. Aparat: 70×40×35 mm; STEP hacmi API ile aynı; 1.036 STL üçgeni korundu. |
| At V2 STEP/STL yeniden açma | **Geçti, teknik importer kapsamı** | Mevcut V2 artifact'i tekrar açıldı: STEP 1 solid, 119,518×48,193×160 mm; hacim API ölçüsünden <0,001 mm³ farklı. STL: 180.540 üçgen, pozitif yeniden ölçülen hacim. Dış FreeCAD/Fusion uygulaması ayrıca denenmedi. |
| İptal, geçersiz girdi, kilit/recovery, stale result ve proje akışı | **Geçti, belirtilen kapsamlarda** | `verify-job-lifecycle.mjs`: iptal, 408 timeout, worker crash, crash sonrası CAD recovery ve indirme/cache doğrulamaları geçti. `verify-ai-fixtures.mjs`: 8 başarı örneği + 7 hata/recovery vakası geçti. Browser T17 accept/cancel ve T20 geç gelen sonuç testi aşağıda. T16 gerçek manifest indir/aç roundtrip'i `ILERLEME.md` ve `DOGRULAMA.md` içindeki önceki kabul kanıtında bulunuyor. |
| Sabit kamera V1/V2 görsel karşılaştırması | **Geçti, görsel kıyas olarak** | `outputs/at-kafasi-v1-ayni-kamera.png` ve `outputs/at-kafasi-v2-gorunumler.png` aynı CPU rasterizer/kamera sırasını kullanıyor. Piksel farkı estetik doğruluk puanı olarak kullanılmadı. Kullanıcı görsel onayı ayrı. |
| Gerçek tarayıcı: örnek → parametre → üret → hata düzelt → indir/proje | **Geçti kısmen; geçmiş T16 roundtrip ile tamamlanıyor** | IAB'de at V2 açıldı, yanak 12→16 mm yapıldı, 119,5×48,2×160 mm / 186,16 cm³ üretildi. `return {` hatası `Unexpected end of input` verdi; önceki sonuç gösterildi ve indirme kapandı. Kod düzeltildi; 30×20×10 mm / 6 cm³ kutu üretildi. Örnek değiştirme onayı kabul/iptal edildi: kabul örneği yükledi; iptal taslağı korudu. Uzun V2 üretimi sırasında kaynak 44 mm kutuya değiştirildi; geç gelen eski sonuç kodu ezmedi ve indirme kapalı kaldı. Sonra 44×20×10 mm / 8,8 cm³ güncel üretim geçti. Proje kaydet düğmesi “Proje dosyasıyla eşleşiyor” gösterdi. Bu IAB koşusunda indirilen dosya Windows `Downloads` içinde bulunamadı; gerçek import roundtrip iddiası bu turdaki buton tıklamasına dayanmıyor, önceki T16 file-picker roundtrip kanıtına dayanıyor. |
| Anlamlı hata koşulları ve final raporu | **Geçti** | Hatalı loft/revolve, başarısız fillet/shell, sıfır yarıçap, örnekleme bütçesi, worker crash ve sonrasında toparlanma test edildi. Bu rapor geçen/denenmeyen ayrımını ve komutları kaydeder. |

## Koşulan doğrulamalar

- `node scripts/verify-cad-sweep.mjs` — passed; sweep/loft katıları, STL, STEP ve geçersiz yol.
- `node scripts/verify-parameter-schema.mjs` — passed; V1/V2 varsayılanları, number/angle/boolean/enum, unknown key ve aralık.
- `node scripts/verify-project-manifest.mjs` — passed; roundtrip normalizasyonu, geçmiş boyutu, typed parametre, referans traversal/hash ve engine mismatch.
- `node scripts/verify-mesh-report.mjs` — passed; boş/açık/kapalı STL, duplicate face, zero-area ve NaN fixture'ları beklenen biçimde sınıflandırıldı.
- `node scripts/verify-job-lifecycle.mjs` — passed; izole sunucuda structured errors, polling/cancel/timeout/crash recovery, PNG/cache ve CLI download.
- `node scripts/verify-exchange-reopen.mjs` — passed; kutu, aparat ve at V2 STEP/STL importer roundtrip.
- `node scripts/verify-cad-authoring.mjs` — passed; geçici `KODLA3D_OUTPUT_ROOT` ile gerçek CAD şekilleri ve sınır hataları.
- `node scripts/verify-first-sprint.mjs` — passed; kutu/aparat, üç organik kalite, STL/topoloji, smooth subtraction ve budget/invalid input/recovery. Yazdığı kanıt OS temp'e yönlendirildi.
- `node scripts/verify-authoring-features.mjs` — passed; simetri, yeni pivot invariantı, targeted replacement, lokal deformasyon ve detaylar. Çıktıları OS temp'e yönlendirildi.
- `node scripts/verify-part-tree.mjs`, `verify-cad-provenance.mjs`, `verify-at-part-provenance.mjs` — passed; named nodes, transform/bounds, CAD yüz/üçgen kaynak kimliği ve At V2 kulak parametresi.
- `node scripts/verify-ai-fixtures.mjs` — passed; 8 başarılı örnek ve 7 edge/recovery vakası. Sonuç JSON'u OS temp'e yönlendirildi.
- Yeni geçici proje kopyasında `npm ci` — passed, 60 paket; `npm audit` 0 vulnerability bildirdi. Ardından `npm run build` — passed. `esbuild` install script'i npm allow-scripts uyarısı verdi; build yine geçti. Ana JS bundle 558,77 kB ile Vite 500 kB uyarısı sürüyor. Aktif projenin `node_modules` klasörü değiştirilmedi.

Çıktı üreten doğrulayıcılar T27 için `KODLA3D_OUTPUT_ROOT` veya `KODLA3D_FIXTURE_RESULTS` ile temp'e yönlendirildi. API testleri yalnız 19428/19429 portlarında koştu; kullanıcının 8765/8766 oturumlarına dokunulmadı. İzole sunucular kapatıldı.

## Denenmedi / kullanıcı kararı gerektiriyor

- At V2'nin anatomik görünümü Doğukan tarafından onaylanmadı; boyun/baş birleşimi hâlâ stilize ve fotoğraf taraması değil. 2026-10-20 takipte viewport için renkli alın izi kodlandı; üretim derlemesi geçti ancak izole tarayıcı açılamadığı için çizginin model yüzeyine oturuşu görsel olarak doğrulanmadı. STL/STEP/GLB'ye alın izi eklenmiyor.
- Fiziksel baskı, overhang/support, minimum duvar kalınlığı ve yazıcı toleransı doğrulanmadı.
- STEP dış bir CAD masaüstü uygulamasında açılmadı; burada bağımsız process instance ile Replicad/OpenCascade import edildi.
- Küçük AI model sağlayıcısına çağrı yapılmadı; token, maliyet ve görev başarı metriği yok.
- Projenin yayın lisansı seçilmedi; LGPL/transitive lisans etkisi hukuki uyumluluk görüşü değildir. Yerel referans fotoğrafının yeniden dağıtım hakkı bilinmiyor.

## T27 değişiklikleri

- `scripts/verify-exchange-reopen.mjs` eklendi; `npm run verify:exchange-reopen` komutuna bağlandı.
- `verify-cad-authoring.mjs`, `verify-first-sprint.mjs`, `verify-authoring-features.mjs` temp çıktı kökü kabul ediyor. `verify-authoring-features.mjs` origin-dışı pivot/ölçek doğrulamasını içeriyor.
- `verify-ai-fixtures.mjs` sonuç JSON yolunu `KODLA3D_FIXTURE_RESULTS` ile alabiliyor.
- Bu raporun teknik sonucu **geçti**; yukarıdaki görsel/print/lisans/benchmark sınırları ayrı açık iş olarak kalır.

## 2026-10-20 T24 devamı

V2 için beyaz blaze, kaynak geometriye veya ihracat mesh'ine katılmayan viewport `TubeGeometry` katmanı olarak eklendi. `index.html` bu farkı kullanıcıya açıklıyor. Güncel `npm run build` geçti; main bundle 572,76 kB ve Vite'nin 500 kB uyarısı sürüyor. Browser portu bu ortamdan erişilemedi; görsel UI kabulini ve boyun/baş siluet revizyonunu tamamlamıyor. Kod kaydı `docs/CHANGELOG-KODLA3D.md` bölümünde. Dış CAD, fiziksel baskı, gerçek küçük model benchmark'ı, yayın lisansı ve referans fotoğrafı hakları açık durumda.

İki geçici boyun-loft adayı üretildi ve altı görünüşte karşılaştırıldı. Büyük geriye kaydırma baş-boyun birleşiminde keskin çıkıntı yaptı; küçük kaydırma boru görünümünü yeterince değiştirmedi. İkisi de ana V2'ye alınmadı. Deneme sırasında worker tolerans değişkeninin blok kapsamı hatası yakalanıp düzeltildi; son aday gerçek OpenCascade üretiminden geçti. Bu siluet işi ve alın izinin ekrandaki uyumu kullanıcı görsel kabulü bekliyor.

## 2026-10-20 T18 devamı

CAD ağ kalitesi seçici eklendi: taslak `0.20 mm / 0.20 rad`, normal `0.08 mm / 0.10 rad`, ince `0.02 mm / 0.05 rad`. Seçim proje manifestinde ve localStorage'da saklanır; API değeri worker'a geçirir ve sonuçta gerçek toleranslar döner. Cache anahtarı bu ayarı kapsar; tekrarlanan aynı ayar/kod için RAM önbelleği dosyaları yeni run klasörüne taşır. Üretim derlemesi ve `node --check` geçti. Tarayıcıda kaydet/aç etkileşimi bu eklemeden sonra ayrıca gözlenmedi. Bu cache soğuk ilk CAD üretimindeki STEP üretimini kaldırmaz.
