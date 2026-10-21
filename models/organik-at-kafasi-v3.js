// At büstü V3 · yumuşak birleşimli organik alternatif.
// 20.10 kafa oranları (Doku): alın + büyük yuvarlak çene kemiği (ganaş) + düz burun sırtı + dolgun burun ucu + dudak,
// yaprak kulaklar. Boyun ve kaide değişmedi. 0.013 mm kaydırma: yüzey örnekleme noktasına denk gelip sıfır alanlı üçgen üretiyordu. Stilizedir, tek fotoğraftan elle yorumlanmıştır.
const yukseklik = parameters.yukseklik ?? 160;

const kaide = elipsoid({ id: 'kaide', ad: 'Kaide', merkez: [-28, 0, 5], yariCaplar: [29, 19, 5] });
const omuz = elipsoid({ id: 'omuz', ad: 'Omuz ve göğüs', merkez: [-30, 0, 27], yariCaplar: [18, 18, 27] });
const boyun = kapsul({
  id: 'boyun', ad: 'Boyun', baslangic: [-36, 0, 24], bitis: [-9, 0, 108],
  baslangicYaricapi: 16, bitisYaricapi: 11
});
const altGövde = yumusakBirlestir({ ad: 'Omuz ve boyun', parcalar: [kaide, omuz, boyun], genislik: 1.6 });

// Kafa ~45° aşağı bakar; tepe (ense) arkada-üstte, burun önde-altta.
const alin = elipsoid({ id: 'alin', ad: 'Alın ve kafatası', merkez: [2, 0, 118], yariCaplar: [16, 14, 15] });
const ganas = elipsoid({ id: 'ganas', ad: 'Çene kemiği (ganaş)', merkez: [3, 0, 96], yariCaplar: [19, 12.5, 18] });
const yuz = kapsul({
  id: 'yuz', ad: 'Burun sırtı ve yüz', baslangic: [12, 0, 106], bitis: [50, 0, 76],
  baslangicYaricapi: 13, bitisYaricapi: 10
});
const altCene = kapsul({
  id: 'alt-cene', ad: 'Alt çene', baslangic: [10, 0, 88], bitis: [50, 0, 64],
  baslangicYaricapi: 9, bitisYaricapi: 7
});
const burunUcu = elipsoid({ id: 'burun-ucu', ad: 'Burun ucu', merkez: [56, 0, 70], yariCaplar: [11, 9.5, 12] });
const dudak = elipsoid({ id: 'dudak', ad: 'Dudaklar', merkez: [56, 0, 60], yariCaplar: [8, 7.5, 5] });
const kulaklar = [-1, 1].map((t) => yumusakBirlestir({
  ad: `Kulak ${t < 0 ? 'sol' : 'sağ'}`, genislik: 1.2, parcalar: [
    kapsul({ id: `kulak-${t < 0 ? 'sol' : 'sag'}`, ad: 'Kulak', baslangic: [-4, t * 8, 128], bitis: [1, t * 10, 150], baslangicYaricapi: 6, bitisYaricapi: 2.6 }),
    elipsoid({ id: `kulak-yaprak-${t < 0 ? 'sol' : 'sag'}`, ad: 'Kulak yaprağı', merkez: [-1.5, t * 9.5, 140], yariCaplar: [5, 3.2, 9] }),
  ],
}));
const bas = yumusakBirlestir({ ad: 'Baş', parcalar: [alin, ganas, yuz, altCene, burunUcu, dudak, ...kulaklar], genislik: 2 });

const yele = kapsul({
  id: 'yele', ad: 'Yele', baslangic: [-40, 0, 39], bitis: [-16, 0, 126],
  baslangicYaricapi: 4, bitisYaricapi: 2.5
});
let model = yumusakBirlestir({ ad: 'At kafası · V3 organik', parcalar: [altGövde, bas, yele], genislik: 2 });

for (const taraf of [-1, 1]) {
  model = burunDeligi({
    hedef: model, ad: `goz-${taraf}`, merkez: [5, taraf * 13.2, 113],
    yariCaplar: [4, 2.8, 3.4], genislik: 0.6
  });
  model = burunDeligi({
    hedef: model, ad: `burun-delik-${taraf}`, merkez: [63, taraf * 6.2, 70],
    yariCaplar: [3, 2.4, 4.2], genislik: 0.5
  });
}

const scale = yukseklik / 160;
return donustur({
  parca: model, tasima: [0.013, 0.013, 0.25 * scale + 0.013], olcek: [scale, scale * 0.8, scale],
  aci: [0, 0, 0], pivot: [0, 0, 0]
});
