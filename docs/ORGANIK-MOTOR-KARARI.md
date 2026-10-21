# Organik geometri motoru kararı — 19 Ekim 2026

## Karar

İlk organik geometri prototipi için `manifold-3d@3.5.4` JavaScript/WASM kullanılır. Mevcut Replicad/OpenCascade CAD hattı kutu, aparat ve STEP çıktılarının kaynağı olmaya devam eder. Motor, model türüne göre worker içinde seçilir; istemci mod belirtmiyorsa geriye uyumluluk için CAD seçilir.

## Kanıt

- Windows Node 24.19.0'da WASM başlatıldı; iki kürede sert Boolean ve smooth SDF union aynı sahada karşılaştırıldı.
- Kavisli boyun-baş ve değişken yarıçaplı kapsül üretildi; ölçülen örnek mesh'ler kapalı ve Manifold durumu `NoError` oldu.
- 2 mm yarıçaplı ince kapsülde 0.8 mm ve 1.4 mm örnekleme arasında yaklaşık %4.6 hacim farkı görüldü. Bu nedenle çözünürlük kullanıcı seçimine ve 4M grid üst sınırına bağlandı.
- Teknik preview'da dört viewport yeniden yüklendikten sonra 4/4 `Yüklendi` durumuna geçti; sert birleşim, organik boyun-baş ve yan görünüş çizildi.
- Detaylı uygulama doğrulama ölçümleri ve çıktılar `outputs/organik-boyun/DOGRULAMA.json` içindedir.

## Sınırlar

Bu seçim foto-gerçekçi hayvan anatomisini, baskı dayanımını veya her organik model için başarılı geometriyi garanti etmez. `levelSet` çözünürlüğü ince detayları kaybedebilir; büyük sınırlar bellek/iş süresi tüketimini artırır. `4M` grid tahmini koruması vardır. Bu sprintte organik çıktılar STL ve kaynak JS'tir; STEP desteği sunulmaz. İşlem kapalı mesh ve koordinat sağlığı kontrolleri yapar, fakat fiziksel yazıcı toleransı ölçmez.

`yumusakCikar` sonucunda dış yüzey ve oyuk iç yüzeyi ayrı yüzey kabukları olarak sayılabilir; bu, otomatik olarak ayrı fiziksel cisim anlamına gelmez.

## Değişiklik koşulu

At kafası gibi üretim hedefi için ayrıntılı bir modelleme katmanı planlamadan önce çoklu özelliklerin bir arada olduğu karmaşık referanslar ve ince parçalar üzerinde kalite/RAM sınırları ayrıca ölçülmelidir. İlk prototip boyun-baş hacmidir; at anatomisi iddiası taşımaz.
