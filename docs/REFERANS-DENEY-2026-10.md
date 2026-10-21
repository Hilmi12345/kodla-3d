# R7 · Opel Vectra B iç ilave fren lambası · 2026-10-21

Kaynak: [`outputs/referans-deneme/vectra-b-fren-lambasi.jpg`](../outputs/referans-deneme/vectra-b-fren-lambasi.jpg). Marka/logolar içeren görsel yalnız bu makinede işlendi; herhangi bir sunucuya veya dış servise yüklenmedi.

## Elle çıkarılan görünüşler ve sonuç

Teknik çizim olduğundan her görünüşün dış gövde sınırı elle poligonla çizildi. Her görünüşün ölçek/oranı, etiketli yatay ve düşey ölçülerine göre ayrı kalibre edildi; çizim ölçekte tutarlı değil. Model yalnız dış kabuk profili; tırnak yuvaları, kesitler, lens ve montaj detayları ikinci aşamada.

| Görünüş | Elle poligon | Çizimden ölçülen dikey boy | Verilen dış ölçü | Dikey kalibrasyon | Nihai IoU | Kenar ort. / P95 |
|---|---:|---:|---:|---:|---:|---:|
| 2 · Ön | 16 nokta | 49,16 mm | 55 mm | ×1,1189 | **0,9498** | 2,30 / 14,14 px |
| 3 · Alt | 16 nokta | 61,58 mm | 95 mm derinlik varsayımı | ×1,5427 | **0,9593** | 2,96 / 15,73 px |
| 4 · Yan kama | 15 nokta | 75,04 mm | 55 mm | ×0,7329 | **0,9899** | 0,23 / 1,00 px |

![Görünüm 2 ön · elle çizilen dış sınır](../outputs/referans-deneme/vectra-r7-on-elle-poligon.png)

![Ön görünüş · referans ve model bindirmesi](../outputs/referans-deneme/vectra-r7-on-overlay-kirp.png)

![Yan kama · referans ve model bindirmesi](../outputs/referans-deneme/vectra-r7-yan-overlay-kirp.png)

![Alt görünüş · referans ve model bindirmesi](../outputs/referans-deneme/vectra-r7-alt-overlay-kirp.png)

## Ölçü çelişkisi ve varsayım

Çizimde uç payları `1,5 + 28,5 + 1,5 cm = 31,5 cm`; aynı çizimde toplam genişlik iki kez `28,5 cm` yazıyor. Bu ölçüler birbiriyle uyuşmuyor. Ayrıca alt görünüşün çizilmiş en-boy oranı 28,5 × 9,5 cm’yi taşımıyor. Tekrarlanan 28,5 cm toplam genişliği esas aldım; uç paylarını genel genişliğe eklemedim. Yan görünüşten 9,5 cm derinlik, kesit/yan ölçülerinden 5,5 cm yükseklik aldım. Bu nedenle ham görünüşleri ölçü etiketlerine göre ayrı eksende kalibre ettim. Bu seçim, muhtemel AI çiziminin geometrik doğruluğunu kanıtlamaz.

Üretilen bir CAD katısının ölçüsü 285 × 95 × 55 mm; raporlanan bounding-box ölçü hatası (hedefe göre) **0,00 × 0,00 × 0,00 mm**. Kontur sadeleştirmesinde küçük sapmalar kaldı: ön yükseklik +0,43 mm, alt derinlik +0,17 mm, yan yükseklik −0,71 mm. IoU raster siluet benzerliğidir; montaj doğruluğu veya milimetrik oturma garantisi değildir.

## Yineleme ve süre

Beş geometri yinelemesi yapıldı. Sırasıyla ilk loft, çizim oranı kalibrasyonu, loft kesitlerini kama konturuna yaklaştırma, elle izlenen yan profilin genişlik boyunca süpürülmesi ve nominal 55 mm yüksekliğe ayarlandı. IoU seyri:

| Yineleme | Ön | Alt | Yan |
|---:|---:|---:|---:|
| 1 · ilk loft, ham maske | 0,8617 | 0,6330 | 0,7494 |
| 2 · etiket ölçüsüne kalibrasyon | 0,9685 | 0,9695 | 0,8185 |
| 3 · loft kesit düzeltmesi | 0,9823 | 0,9584 | 0,8608 |
| 4 · elle çizilmiş yan profil süpürme | 0,9385 | 0,9593 | 0,9877 |
| 5 · 55 mm nominal yükseklik | **0,9498** | **0,9593** | **0,9899** |

Yerel üretim ve üç görünüş compare çağrılarının toplam işlem süresi **0,22 dakika** (yaklaşık 13 saniye); manuel poligon ve profil düzenleme süresi kronometrelenmedi. Son model [`models/vectra-b-fren-lambasi.js`](../models/vectra-b-fren-lambasi.js), STL ve tam boy overlay dosyaları `outputs/referans-deneme/r7-runs/` ile `outputs/referans-deneme/` altında. Nihai run: `78adf981f6ad4ea18a973a4a192e81d3`; 1 katı, 56 üçgenli hafif dış kabuk.
