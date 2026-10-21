# Kodla 3D · v0.1

AI'ın kodla 3D model üretebileceği yerel tasarım uygulaması. İsim geçici. İki üretim hattı bulunur: doğrulanmış CAD katı/STEP hattı ve deneysel SDF organik/STL hattı.

İlk kurulumda **Kodla3D.cmd setup** çalıştır; sonra **Baslat.cmd** dosyasına çift tıkla. Varsayılan arayüz: http://127.0.0.1:8765. Sunucu yalnız bu bilgisayarda erişilebilir.

Kod değiştir → **Modeli üret** (Ctrl+Enter) → döndür/incele → CAD için **STL/STEP**, organik SDF için **STL** veya isteğe bağlı **GLB** (mm'den metreye dönüştürülmüş) ya da kaynak **.js** indir. Ölçüler mm. Örnekler açık kutu, delikli L aparatı ve organik kavisli boyun-baş.

İlk fotoğraf referansı denemesi: **At kafası · referans** örneği. Açılış: http://127.0.0.1:8765/?model=at-kafasi . Kalıcı STL/STEP/kaynak ve referans `outputs/at-kafasi/` içinde. Sonuç stilize büst taslağıdır; fotoğraftaki gerçekçi yüz/yele ayrıntıları düzeyinde değildir.

Geliştirme planı: `docs/LUNA-GELISTIRME-BRIFI-2026-10-19.md` — organik çekirdek, sade AI API'si, proje/parametre arayüzü, çıktı doğrulaması ve at kafası V2 için aşamalı görevler.

At kafası V2 kaynak ve teknik çıktıları: `outputs/at-kafasi-v2/`. Yeniden üretmek için `npm run build:horse-v2`, kayıtlı çıktıları hızlıca kontrol etmek için `npm run verify:horse-v2`.

Fixture çeşitliliği: `npm run verify:fixtures`. Beklenen sonuçlar `docs/AI-FIXTURES.json`, son yerel ölçüm `docs/AI-FIXTURE-SONUCLARI.json` içindedir.

## İlk kurulum

Node.js 22.12+ veya 24 gerekir. `Kodla3D.cmd setup` kilitli `package-lock.json` ile `npm ci` ve production build çalıştırır. Runtime kurulumu Git, Python veya AI servis anahtarı istemez; `vendor/` kaynak snapshot'ları aktif runtime için kullanılmaz ve korunur.

### Yerel kontrol komutları

```powershell
Kodla3D.cmd status
Kodla3D.cmd diagnose
Kodla3D.cmd stop
Kodla3D.cmd start -Port 18765
```

`stop`, yalnız kontrol scriptinin PID kaydını ve `server.mjs` komut yolunu doğrular; eşleşme yoksa hiçbir süreci kapatmaz. Varsayılan port doluysa başka bir Kodla 3D kopyasını yönetmez; boş portu `-Port` ile seç. Kurulum, başlatma ve lisans kapsamı: [`docs/T23-KULLANICI-AKISI.md`](./docs/T23-KULLANICI-AKISI.md), [`docs/LISANSLAR.md`](./docs/LISANSLAR.md).

## Nasıl çalışıyor?

`src/model-api.js`: CAD kısa komutları; `src/organic-api.js`: küre/elipsoid/kapsül ve SDF birleştirme/çıkarma API'si; `models/`: kaynak modeller (organik kıvrımlı sap örneği `organik-sap.js`); `model-worker.mjs`: CAD için Replicad/OpenCascade, organik hat için `manifold-3d@3.5.4` WebAssembly; `server.mjs`: yerel API ve statik arayüz; `src/main.js`: kod editörü ve Three.js önizleme. JavaScript kodu ayrı Node sürecinde çalışır. Organik hat deneysel örnekleme toleransları kullanır; taslak/normal/ince ayarları vardır ve organik model parametrik STEP üretmez.

`docs/AI-KULLANIM.md`: AI'a verilecek komut sözleşmesi. `docs/FIKIR.md`: fikir ve geliştirme sırası. `docs/ILERLEME.md`: Luna sprint görevleri, gerekçeler ve kanıtlar. `experimental/manifold/`: motor doğrulama spike'ı ve teknik önizlemesi. `vendor/replicad` ve `vendor/cadquery`: resmî kaynak kodu kopyaları; commit'leri yanlarındaki revision dosyalarında saklanır. Çalışan paket sürümleri `package-lock.json` ile sabittir; vendor kaynakları otomatik çalıştırılmaz.

## Geliştirme

`npm start`: yerel sunucu. Ayrı terminalde `npm run dev`: Vite arayüzü, API 8765'e yönlendirilir. `npm run build`: kalıcı arayüz derlemesi.

Son kod tarayıcı localStorage alanında saklanır; kalıcı model için `.js` kaynağını indir. Sunucuda son 15 üretim geçicidir. STL birim bilgisi taşımaz; dilimleyicide mm olarak açılmalı.

Yalnız güvendiğin yerel kodu çalıştır; kod yürütme bir güvenlik sandbox'ı değildir. Sunucu yalnız 127.0.0.1 üzerinde dinler. Katı cisim geçerliliği denetlenir; baskı dayanımı ve üretim toleransları henüz denetlenmez. Uygulama içinde AI sohbeti veya otomatik düzeltme döngüsü henüz yoktur.

## CadQuery denemesi

İlk yaklaşım CadQuery idi. Bu Windows ortamında OCP/VTK yerel kütüphaneleri yüklenirken takılma gözlendi; Python motoruyla başarılı model üretimi doğrulanamadı. Deneme kodları `experimental/cadquery/`, kaynak kopyası `vendor/cadquery/`, ayrı Python ortamı `.venv/` altında korunur. **Baslat.cmd bu denemeyi kullanmaz.** Aktif uygulama Replicad/OpenCascade WASM kullanır.

Paket lisans metadatası ve doğrudan bağımlılık kapsamı [`docs/LISANSLAR.md`](./docs/LISANSLAR.md) içinde kayıtlıdır. Bu envanter, tüm geçişli bağımlılıkların uyum denetimi veya projenin yayın lisansı kararı değildir. Bu projenin herkese açık yayın lisansı henüz seçilmedi.

Kaynaklar: https://github.com/sgenoud/replicad · https://replicad.pages.dev/ · https://github.com/CadQuery/cadquery
