// Kaba, bağlı bir boyun ve baş hacmi. Bütün ölçüler mm; birleşim SDF ile yumuşatılır.
const boyun = kapsul({
  ad: 'boyun',
  baslangic: [-3, 0, 0],
  bitis: [-1, 0, 21],
  baslangicYaricapi: 5,
  bitisYaricapi: 3.5
});
const kafa = elipsoid({
  ad: 'kafa',
  merkez: [3, 0, 22],
  yariCaplar: [7, 5.5, 8]
});
const model = yumusakBirlestir({ ad: 'Organik boyun ve bas', parcalar: [boyun, kafa], genislik: 3.5 });
return model;
