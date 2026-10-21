# Manifold motor spike

Bu klasör, ana CAD motoruna bağlamadan önce `manifold-3d` JavaScript/WASM SDF davranışını doğrular.

## Çalıştırma

Proje kökünden, npm ağ erişimi gerektiğinde:

```powershell
npm install --prefix .runtime/spike --no-save --package-lock=false manifold-3d@3.5.4
node experimental/manifold/spike.mjs
```

Çıktı STL'leri ve ölçüm raporu `outputs/` altına yazar. `preview.html` / `preview.js` Vite ile proje kökünden servis edilir; yerel preview yolu `/experimental/manifold/preview.html`.

## Sınırlar

- Bu, küçük sentetik şekillerle teknik spike'tır; gerçekçi at anatomisi veya fotoğrafa benzerlik iddiası yoktur.
- `edgeLength` büyüdükçe ince detayın hacmi kaybolabilir. 2 mm kapsülde 0.8 → 1.4 mm örneği yaklaşık %4.6 hacim farkı verdi.
- Spike'taki RSS ve süreler küçük örnekler içindir; karmaşık sahnelere genellenemez.
- `manifold-3d@3.5.4` Apache-2.0'dır. Lisans metni paket içinde korunur.
