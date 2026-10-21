# Kodla 3D · küçük model görev benchmark protokolü

**Amaç:** kısa kod görevlerinde iki ayrı şeyi ölçmek: JavaScript/CAD üretiminin teknik olarak çalışması ve modelin kullanıcının tarif ettiği doğru tasarımı üretmesi. Derlenmiş/kapalı mesh, tek başına estetik veya işlevsel doğruluk değildir.

## Sabit görevler

| ID | AI'a verilecek görev | Çalışabilir kod ölçütü | Tasarım ölçütü | Yerel kontrol / mevcut örnek |
|---|---|---|---|---|
| G01 | 60×40×25 mm, üstü açık, 3 mm duvarlı bir saklama kutusu yap. | CAD 200, 1 katı, STL+STEP. | dış bounds toleransı ±0,1 mm; açıklık üst yüzeyde ve taban kapalı. | `npm run verify:cad` + ölçü raporu |
| G02 | Kutunun yalnız yüksekliğini 25 mm'den 32 mm'ye çıkar. | ikinci API işi geçerli; kaynak hash'i değişmiş. | X/Y ve duvar parametreleri korunur; Z farkı 7±0,1 mm. | parametre revizyonu / ölçü karşılaştırması |
| G03 | 70×40 mm tabana iki adet Ø5 mm montaj deliği ve 35 mm arka duvar ekle. | CAD bir katı, STL+STEP. | delik merkezleri x=−22/+22 mm; arka duvar bağlantılı. | `npm run verify:cad` / `models/aparat.js` |
| G04 | At büstünde yalnız sağ ve sol kulak uzunluğunu 39→45 mm değiştir. | parametreli yeniden üretim başarılı. | iki kulak üst sınırı yükselir; boyun, baş, yele ve kaide bounds'u aynı kalır. | `npm run verify:at-part-provenance` |
| G05 | Organik bir sol kulak oluştur ve YZ düzleminde simetriyle sağ kulağı üret. | parça ID'leri korunur, iki kabuk raporlanır. | merkezler X ekseninde ayna; Y/Z bounds eşit. | `npm run verify:parts`; `organik-simetri` |
| G06 | Eğik bir boyun ile baş hacmini 3,5 mm yumuşak birleşimle birleştir. | organik STL üretilir, mesh complete. | 1 bağlı kabuk; verilen birleşim genişliği kaynakta doğru. | `npm run verify:fixtures`; `organik-boyun` |
| G07 | Basit yüzde bir göz çukuru ve burun deliği aç; çevredeki ana hacmi koru. | organik STL + mesh raporu. | belirtilen feature ID'leri görünür; bounds değişimi yerel kalır. | `npm run verify:fixtures`; `organik-detay` |
| G08 | Sözdizimi hatalı kodu düzelt; ardından sınır dışı yanak parametresini düzeltip yeniden üret. | syntax source line/path teşhisi ve ikinci başarılı build. | kullanıcının tarif etmediği geometri değişmez; parametre aralıkta olur. | `npm run verify:jobs`, `npm run verify:parameters` |
| G09 | Kaydedilmiş `.kodla3d.json` projesini aç ve son başarılı parametre/kaynak sürümünü geri getir. | proje manifesti tekrar okunur, hash ve parametreler uyuşur. | üretimden önce indirme kapalı; restore edilen değerler doğru. | `npm run verify:project` |
| G10 | Kutu için STL, STEP, kaynak ve altı görünüş PNG'i dışa aktar. | dosyalar HTTP/CLI'den alınır; STL/STEP header ve PNG ölçüsü doğru. | tüm dosyalar aynı source hash ve ölçü sürümüne bağlı. | `npm run verify:jobs`; T22/T25 fixture'ları |

## Puanlama

- **Kod çalışabilirliği (0/1):** geçerli giriş → doğru API modu → beklenen temel dosyalar; geçerli STL/STEP/PNG imza ve ölçüleri.
- **Tasarım doğruluğu (0–4):** görevin ölçü toleransı, yerel değişiklik, doğru parça/özellik ve görsel kriterleri ayrı puanlanır. Göreve uygulanmayan ölçüt `N/A`; “çalıştı” puanı değildir.
- **İş akışı:** ilk geçerli üretime kadar deneme sayısı, toplam revizyon, kaynak/parametre koruma, doğru hedef parça.
- **Görsel değerlendirme:** sabit kameralar, reviewer ve 1–5 puan + kısa gerekçe; ham piksel farkı estetik doğruluk sayılmaz. İnsan bakmadıysa `not_run`.
- **Context/maliyet:** tam gönderilen prompt/context UTF-8 byte ve karakter sayıları; provider token sayısı ancak gerçek runner veriyorsa. Uydurulmaz. Süre duvar saati; cold/warm ayrı kaydedilir.
- **Sınırlı başarı:** mesh kapanmış olsa da duvar kalınlığı, overhang, destek, self-intersection veya baskı dayanımı otomatik doğrulanmış sayılmaz.

## Protokol

1. Aynı model/provider sürümü, sistem yönergesi, örnek-belge paketi, quality ve başlangıç workspace'i sabitlenir.
2. Her görev temiz kaynak snapshot'ında bir kez başlar; modelin istem dışı önceki sonucu görmesi engellenir.
3. Ham istek, ilk cevap, düzeltme promptları, kod hash'leri ve deneme sayıları saklanır. Runner'ın token/maliyet çıktısı varsa kaydedilir.
4. Makine verifier'ı çalışabilirliği ve sayısal invariant'ları puanlar. Ayrı reviewer aynı kamera görüntülerini ve görev kriterini kullanıp tasarım puanı verir.
5. Başarısız sonuçlar silinmez. Özellikle kod geçerli ama tasarım yanlış olanlar ayrı hata sınıfıdır.
6. Gerçek model benchmark'ı için provider/model ve bütçe ayrıca belirlenmelidir. Bu protokolü yazmak, model çağrısı veya AI başarısı kanıtı değildir.

Makine verifier'larının sabit yerel zemini: [`AI-FIXTURES.json`](./AI-FIXTURES.json), [`AI-FIXTURE-SONUCLARI.json`](./AI-FIXTURE-SONUCLARI.json). Alan formatı için [`AI-GOREV-SONUC-SABLONU.json`](./AI-GOREV-SONUC-SABLONU.json).
