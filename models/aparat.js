// L biçimli bağlantı aparatı. Delik merkezleri global XY koordinatları.
let taban = kutu({ ad: 'taban', genislik: 70, derinlik: 40, yukseklik: 6 });
taban = taban.delik_ac(5, [[-22, 0], [22, 0]]);
const arka = kutu({ ad: 'arka', genislik: 70, derinlik: 6, yukseklik: 35 }).tasi(0, 17, 0);

return birlestir(taban, arka, 'baglanti_aparati');
