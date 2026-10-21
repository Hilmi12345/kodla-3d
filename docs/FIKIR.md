# Kodla 3D — fikir ve ilk iskelet

Kaynak: Doğukan'ın 19 Ekim 2026 tarihli isteği. Proje adı geçici.

## Kullanıcı ve anı

Doğukan bir nesne tasarlamak istediğinde AI'a tarifini verir; AI'ın yazdığı koddan gerçek 3D model elde etmek, ölçüleri değiştirmek ve STL gibi dosyalar almak ister. Önce kendimiz kullanacağız, açık kaynak geliştirme hedefi var.

Üç soru: İstediğim şekil oluştu mu? Ölçüler doğru mu? Üretime aktarabilir miyim?

## Akış ve mimari

AI kısa bir JavaScript dosyası yazar → kullanıcı editörde açar → yerel OpenCascade WASM motoru modeli üretir → Three.js önizleme ve ölçüler gösterilir → aynı çalışmadan STL, STEP ve kaynak JavaScript indirilir.

- `src/model-api.js`: AI için kısa komutlar; ileri işler için Replicad API'si açık.
- `models/`: parametreli örnekler; kutu ve bağlantı aparatı.
- `model-worker.mjs`: ayrı Node sürecinde model üretimi, katı geçerliliği, ölçü ve çıktı.
- `server.mjs`: yalnız localhost üzerinde API ve arayüz sunumu.
- `src/main.js`: kod editörü, döndürülebilen önizleme ve çıktı akışı. Kod değiştiğinde eski çıktıyı indirmek engellenir.
- `vendor/replicad` ve `vendor/cadquery`: resmî kaynak inceleme kopyaları.

İlk iskelet ölçülü katı modelleme üzerine kuruldu. Doğukan ilk gerçek referans olarak at kafası fotoğrafı verdi. Loft ve katı işlemleriyle tanınabilir, stilize bir büst taslağı üretildi; fotoğraf gerçekçiliğine ulaşılmadı. Bu örnek mevcut kısa API'nin organik ayrıntı sınırını gösteriyor; tüm CAD motorlarının organik tasarım yapamayacağı sonucu çıkarılmaz.

## Altyapı kararı ve sınırı

İlk CadQuery kurulumunda yerel OCP/VTK kütüphaneleri import sırasında takıldı. Birden fazla resmî sürümde denendi; neden kesinleştirilmedi ve sistem güvenlik ayarları değiştirilmedi. Bu yaklaşım `experimental/cadquery/` altında korunur, çalışıyor sayılmaz.

Aktif motor için Node içinde çalışan Replicad/OpenCascade WebAssembly kullanıldı. Böylece CAD çekirdeğinin Windows yerel DLL yüklemesine ihtiyaç kalmadı. İki örneğin gerçek STL ölçüleri, STEP yeniden açma/hacim kontrolü ve tarayıcıdaki 80→90 mm revizyonu geçti. Sonuç ve sınırlar `docs/DOGRULAMA.md` dosyasında.

## Maliyet ve sınırlar

| Kaynak | Yaklaşım | Sınır |
|---|---|---|
| AI ücreti | Uygulama içinde model çağrısı yok | Anahtar gerekmez |
| Hesaplama | Yerel CPU, ayrı süreç | Aynı anda tek üretim, 60 saniye |
| Geçici depolama | Kaynak + STL + STEP | Son 15 üretim |
| Kullanıcı emeği | Son kod tarayıcıda saklanır | Kalıcı model için kaynak dosyası indirilir |

## Sonraki sıra

1. Doğukan'ın gerçek bir tasarımıyla detay ve revizyon akışını değerlendirmek.
2. Parametre paneli ve isimli parça ağacı.
3. AI'ın önizleme, ölçü ve hatayı okuyacağı geri bildirim akışı.
4. Profil çizimi, loft/revolve, desen ve montaj işlemlerinin kısa API'ye eklenmesi.
5. Küçük AI modellerinin başarı oranını gerçek görevlerde ölçmek.

Henüz yok: uygulama içi AI sohbeti, otomatik hata düzeltme, organik modelleme hattı, STL'den parametrik tasarıma dönüşüm, dayanım/tolerans analizi. Katı geçerliliği fiziksel baskı garantisi değildir. Yayın ve projenin kendi lisansı henüz seçilmedi.

Birincil kaynaklar: https://github.com/sgenoud/replicad · https://replicad.pages.dev/ · https://github.com/CadQuery/cadquery

## 2026-10-19 — İlk sprintte oluşan ürün sınırı

- Artık iki ayrı üretim modu var: CAD (Replicad/OpenCascade BRep, STL+STEP+JS) ve organik (Manifold SDF mesh, STL+JS). Ortak worker yanıtı şema v1, mm, bounds, hacim, parça özeti, motor/sürüm, source hash, kalite ve gerçek format listesi taşır.
- Organik örnek API'si: küre, elipsoid, variable radius kapsül, smooth union ve smooth subtraction. Kalite seçenekleri 1.4/0.8/0.55 mm yaklaşık örnek aralığı; 4 milyon tahmini grid hücresi üst sınırı.
- Sınır: elipsoid alan uzaklığı yaklaşık; organik mesh STEP değildir. İnsan görsel kabulü ve fiziksel baskı/doğruluk bu API ile doğrulanmış sayılmaz.
