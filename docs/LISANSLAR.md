# Lisans envanteri · yerel geliştirme prototipi

Bu dosya kurulu doğrudan paketlerin `package.json` metadata'sından ve `package-lock.json` sabitlemesinden çıkarılmış teknik envanterdir. Lisans uyumu, yeniden dağıtım izni veya hukuki görüş değildir. Paketlerin kendi `LICENSE` dosyaları ve tüm geçişli bağımlılıklar dağıtım öncesi ayrıca gözden geçirilmelidir.

## Aktif doğrudan paketler

| Paket | Kilitli sürüm | Paket metadata'sındaki lisans | Kullanım |
|---|---:|---|---|
| `replicad` | 1.1.0 | MIT | CAD JavaScript API |
| `replicad-opencascadejs` | 1.1.0 | LGPL-2.1-only | CAD/OpenCascade WASM çekirdeği |
| `manifold-3d` | 3.5.4 | Apache-2.0 | Deneysel organik SDF/mesh hattı |
| `three` | 0.180.0 | MIT | Tarayıcı 3D önizlemesi |
| `vite` | package-lock'ta 7.3.7 | MIT | Geliştirme/build aracı |
| `pngjs` | 7.0.0 | MIT | PNG decode/encode; saf JavaScript, doğrudan runtime bağımlılığı yok |
| `jpeg-js` | 0.4.4 | BSD-3-Clause (paket metadata'sı) | JPEG decode; saf JavaScript |
| `pdfjs-dist` | 5.4.624 | Apache-2.0 | Kullanıcının seçtiği PDF sayfasını yerelde çözümleme/render etme |
| `@napi-rs/canvas` | 0.1.88 | MIT | PDF.js’e Node Canvas sağlayıp PNG’yi bellekte üretme |
| `@napi-rs/canvas-win32-x64-msvc` | 0.1.88 | MIT | Windows x64 yerel Skia binding’i; isteğe bağlı platform paketi |

## Yayına geçmeden önce

- Uygulama için `LICENSE` eklenmedi. `docs/LUNA-GELISTIRME-BRIFI-2026-10-19.md` T23 açıkça yayın lisansını kullanıcı adına seçip yayımlamayı yasaklıyor; Doğukan'ın MIT/Apache-2.0/MPL gibi seçeneklerden birini seçmesi gerekiyor.
- Kurulu `replicad-opencascadejs@1.1.0` metadata'sı `LGPL-2.1-only` diyor ve pakette LGPL-2.1 metni var. Open CASCADE'nin resmi lisans sayfası, OCCT için LGPL-2.1'e ek istisna bulunduğunu belirtiyor. Bu istisnanın kurulu WASM paketine hangi dosyalarla uygulandığı bu incelemede doğrulanmadı; dağıtım öncesi tam paket kaynak/yeniden bağlama yükümlülüğü ayrıca denetlenmeli.
- Doğrudan paket envanteri geçişli bağımlılıkların tam lisans uyumluluk taraması değildir. Yayın paketini üretmeden önce kilit dosyasındaki kullanılabilir tüm paketler için makinece üretilmiş SBOM/lisans raporu al ve `dist/` içine gerçekten kopyalanan notice'ları kontrol et.
- `outputs/at-kafasi*/referans.jpg` Doğukan'ın sağladığı dosyadır; yeniden dağıtım hakkı kayıtlı değil. Kamuya açık kaynak/paket çıkarmadan önce görseli dışarıda bırak veya sahibinden izin/lisans kaydı al. Bu not model kodu ve STL/STEP çıktılarının lisansından ayrıdır.
- `npm audit` güvenlik bulgularını raporlar; lisans izni veya uyumluluk onayı vermez.

`jpeg-js` README'si decoder kodunun Apache-2.0 lisanslı jpgjs çalışmasına, encoder'ın ise Adobe lisanslı as3corelib portuna dayandığını ayrıca belirtir; yayın öncesi `node_modules/jpeg-js/LICENSE` ve README'deki bu kapsam yeniden incelenmelidir.

PDF.js’in Apache-2.0, `@napi-rs/canvas` ve Windows platform paketinin MIT lisans metinleri kurulum kopyalarında kontrol edildi. Bu paketler PDF’yi yalnız yerelde, bellekte sayfa PNG’sine dönüştürür. [PDF.js lisansı](https://github.com/mozilla/pdf.js/blob/master/LICENSE), [Canvas lisansı](https://github.com/Brooooooklyn/canvas/blob/main/LICENSE). Resmi kaynaklar ayrıca: [Replicad MIT lisansı](https://github.com/sgenoud/replicad), [Open CASCADE lisans açıklaması](https://dev.opencascade.org/doc/occt-6.9.0/overview/html/), [Three.js lisansı](https://github.com/mrdoob/three.js/blob/dev/LICENSE), [pngjs](https://github.com/pngjs/pngjs), [jpeg-js](https://github.com/jpeg-js/jpeg-js). Kurulu npm sürümünün yerel `package.json` ve `LICENSE` dosyaları, bu envanterdeki sürüm için esas alınır.

## Vendor snapshot'ları (runtime'da kullanılmaz)

| Kaynak | Saklanan revision | Kopyadaki LICENSE |
|---|---|---|
| `vendor/replicad` | `e4b05f67dc4e2393a876ce8c5064a9c93db05bf1` | MIT (`vendor/replicad/LICENSE`) |
| `vendor/cadquery` | `33361dc1b5b70bc83ce36f1b34a01ca85dfca80a` | Apache-2.0 (`vendor/cadquery/LICENSE`) |

Çalışma zamanı paket sürümleri `package.json` içinde, çözümlenmiş tam sürümler ve integrity kayıtları `package-lock.json` içindedir. Kurulum `npm ci` kullanır. Kilit dosyası bütün geçişli paketlerin lisans metadatasını içerir, fakat bu sprint tüm transitive lisansların uyumluluk denetimini yapmadı.

## Korunan kaynaklar ve kapsam

- `vendor/replicad` ile `vendor/cadquery` kaynak inceleme snapshot'larıdır; runtime bunları yüklemez. Kurulum sırasında klonlanmaz, güncellenmez veya silinmez.
- CadQuery denemesi ve `.venv/` deneysel kalır; aktif uygulamanın gereksinimi değildir.
- Kullanıcı çıktıları `outputs/` içinde korunur; kurulum veya stop işlemi bunları temizlemez.
- Projenin kendi yayın lisansı seçilmedi. Proje kodu/kullanıcı görselleri için lisans uydurulmadı ve hiçbir lisans ekiyle yayın yapılmadı.

Kaynak dosyalar: her paketin kurulum kopyasındaki `node_modules/<paket>/package.json` ve `LICENSE`; çözümlenmiş sürümler için `package-lock.json`.
