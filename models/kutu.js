// Tüm ölçüler mm. Parametreleri değiştir, yeniden üret.
const genislik = 80;
const derinlik = 50;
const yukseklik = 25;
const duvar = 3;

let model = kutu({ ad: 'duzenleyici', genislik, derinlik, yukseklik });
model = model.yuvarlat(5);
model = model.icini_bosalt(duvar);

return model;
