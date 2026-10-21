# Başlangıç performans ve geometri ölçümü

Tarih: 19 Ekim 2026, yerel makine. Tam örnek ve tekrar verisi: [`baseline-measurements.json`](baseline-measurements.json). Tekrar üretim: `node scripts/benchmark-baseline.mjs` (önce `npm start` ile sunucu açık olmalı).

## Ortam

- Windows 11, x64; Intel Core Ultra 5 125H, 18 mantıksal işlemci.
- Sistem belleği: 15.5 GiB; ölçüm başında kullanılabilir yaklaşık 5.1 GiB.
- Node 24.19.0; Replicad 1.1.0; replicad-opencascadejs 1.1.0; Three.js 0.180.0; Vite 7.3.7.
- Her API isteği yeni Node worker ve yeni WASM örneği başlatıyor. Sunucu önceden çalıştığı için “soğuk uygulama başlangıcı” ölçülmedi. İlk worker örneği ile sonraki fresh-worker örnekleri ayırt edildi; OS dosya önbelleği etkisi olabilir.
- Her model 3 kez üretildi. Dış süre HTTP+yanıtı kapsıyor; worker profilinde motor aşamaları ayrı. Worker RSS 20 ms'de bir örneklendi; çok kısa tepe atlanabilir.

## Sonuçlar

| Örnek | Toplam API medyanı | Worker medyanı | Worker RSS örnek maksimumu | BBox (mm) | Hacim (mm³) | Katı/yüz | STL üçgen/byte |
|---|---:|---:|---:|---|---:|---:|---:|
| Kutu | 1,436 sn | 0,752 sn | 254 MiB | 80×50×25 | 27.907,035 | 1 / 40 | 1.052 / 52.684 |
| Aparat | 1,503 sn | 0,828 sn | 249 MiB | 70×40×35 | 28.744,381 | 1 / 28 | 1.036 / 51.884 |
| At kafası V1 | 46,378 sn | 45,392 sn | 910 MiB | 121,446×48,193×160 | 182.100,746 | 1 / 111 | 187.052 / 9.352.684 |

RSS değeri uygulama worker prosesi için gözlenen en yüksek örnektir; sistemin toplam RAM kullanımını göstermez. Küçük CAD örneklerinde WASM başlatma yaklaşık 0,25–0,29 sn, geometri 0,30–0,33 sn; at örneğinde geometri yaklaşık 36,9–37,2 sn, meshleme+STL yaklaşık 6,0–6,4 sn ölçüldü. STEP yazımı at için ~0,44 sn idi. Replicad `blobSTL` tek çağrı olduğu için meshleme ve STL seri üretimi birbirinden ayrılamadı.

## Doğrulama ve sınırlar

Ölçüm betiği kaynak JS'in SHA-256'sini, API sonucu, üçgen sayısı ve üretilen STL dosyasının SHA-256/byte sayısını JSON'a yazar. Önceki `docs/DOGRULAMA.md` CAD kayıtları kutu/aparat STEP yeniden açma ve hacim eşitliğini doğrulamıştı; bu benchmark STEP round-trip'i tekrar çalıştırıp süre tutmuyor. Fiziksel baskı ve baskı dayanımı test edilmedi.

Makine üzerindeki tam soğuk uygulama başlangıcı, tepe bellek için 20 ms altındaki kısa olaylar ve STL üçgenleme ile dosyaya yazmanın ayrı süreleri bu ölçümde yok. Bu değerler hedef değil, T01 başlangıç referansıdır.
