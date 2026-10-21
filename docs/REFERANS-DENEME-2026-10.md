# Referanstan 3D denemesi · 21 Ekim 2026

## Kapsam ve dürüstlük notu

İstenen iki gerçek girdi (ölçülü braket fotoğrafı ve far benzeri parçanın ön+yan fotoğrafları) bu çalışma alanında yoktu. Mevcut `at-kafasi` fotoğrafı bu vakalardan biri olmadığı için kullanılmadı. Bu nedenle R7 burada yalnız sentetik, piksel maskesi kontrollü uçtan uca prova olarak ölçüldü; gerçek müşteri fotoğrafından AI modelleme kabulü **yapılmadı**. Modeller CAD profil API'siyle üretildi; AI'dan ayrı bir istem turu veya fiziksel baskı yok.

`verify:reference-r7` her vakada 0,9 ölçekli ilk profil ve ölçüden çıkarılan 1,0 profil üretti. Bu kontrollü değişiklik, IoU'nun yanlış ölçüde düşüp düzeltmede yükseldiğini sınar; müşteri fotoğrafı yinelemesi değildir.

## Sonuçlar

| Sentetik vaka | Bilinen ölçü | IoU, iterasyon 1 → 2 | Ölçülen boyut | Üretim süresi | Kabul |
| --- | --- | --- | --- | --- | --- |
| L braket | Genişlik 60 mm, derinlik 8 mm | 0,7127 → 0,9623 | 59,54 × 55,38 × 8,00 mm; bilinen genişlik hatası −0,46 mm, derinlik hatası 0 mm | 686 ms + 687 ms = 1,373 sn | Sentetik ölçüler/ön IoU geçti |
| Far benzeri trapez | Genişlik 80 mm, derinlik 35 mm; sentetik yan kontur da verildi | 0,8135 → 0,9889 | 80,00 × 40,96 × 35,00 mm; bilinen genişlik ve derinlik hatası 0 mm | 716 ms + 720 ms = 1,436 sn | Sentetik ölçüler/ön IoU geçti |

Tüm script süresi, kontur çıkarma ve dört karşılaştırma dahil 2,876 sn. İki vaka × iki üretim = dört geometri iterasyonu. Her üretim benzersiz kaynakla çalıştırılıp build cache miss edildi; `npm run verify:reference-r7` çıktısı süreleri makineye bağlı tek ölçümdür.

## Sınır

Sentetik IoU eşiği 0,90 ve verilen genişlik/derinlik toleransı ±1 mm karşılandı. Gerçek fotoğrafla AI girdisi şartı eksik olduğundan R7 bütünüyle kabul edildi denemez. Gerçek vaka ölçümü için kullanıcıdan izinli braket fotoğrafı + kumpas ölçüleri ve far benzeri parçanın eşlenmiş ön/yan görüntüleri gerekir. Montajlı parçalar için milimetrik oturma garantisi yoktur.
