// At büstü V3 · yumuşak birleşimli organik alternatif.
// 22.10 ikinci kurgu: kafa yatay "yerel" eksende kurulur (x = burun yönü, z = alın üstü), sonra 50° aşağı eğilir.
// Yandan kama: derin, yuvarlak ganaş (yanakta iki disk) → düz burun sırtı → ince burun ucu.
// Boyun yuvarlak boru değil: yandan geniş, önden dar elipsoit zinciri + tepe kavisi + yele.
// Kaide alttan kesilir, düz taban (z = 0). Stilizedir, tek fotoğraftan elle yorumlanmıştır.
const yukseklik = parameters.yukseklik ?? 160;

// ── Kafa, yerel eksen (ense/poll = orijin) ──
const kafatasi = elipsoid({ id: 'kafatasi', ad: 'Alın ve kafatası', merkez: [4, 0, 0], yariCaplar: [14, 16, 13] });
const ceneOrta = elipsoid({ id: 'cene-orta', ad: 'Çene gövdesi', merkez: [14, 0, -12], yariCaplar: [17, 10, 15] });
const yanaklar = [-1, 1].map((t) => elipsoid({
  id: `ganas-${t < 0 ? 'sol' : 'sag'}`, ad: `Ganaş ${t < 0 ? 'sol' : 'sağ'}`,
  merkez: [14, t * 8, -12], yariCaplar: [16, 8, 16]
}));
const burunSirti = kapsul({
  id: 'burun-sirti', ad: 'Burun sırtı', baslangic: [8, 0, 2], bitis: [52, 0, 0],
  baslangicYaricapi: 12, bitisYaricapi: 9
});
const burunUcu = elipsoid({ id: 'burun-ucu', ad: 'Burun ucu', merkez: [60, 0, -4], yariCaplar: [11, 11, 12] });
const altCene = kapsul({
  id: 'alt-cene', ad: 'Alt çene', baslangic: [22, 0, -18], bitis: [54, 0, -12],
  baslangicYaricapi: 9, bitisYaricapi: 7
});
const dudak = elipsoid({ id: 'dudak', ad: 'Alt dudak', merkez: [58, 0, -15], yariCaplar: [8, 9, 5] });
const kulaklar = [-1, 1].map((t) => {
  const yon = t < 0 ? 'sol' : 'sag';
  return yumusakBirlestir({
    ad: `Kulak ${t < 0 ? 'sol' : 'sağ'}`, genislik: 1.2, parcalar: [
      kapsul({ id: `kulak-${yon}`, ad: 'Kulak', baslangic: [2, t * 7, 10], bitis: [-16, t * 10, 27], baslangicYaricapi: 5.5, bitisYaricapi: 2.2 }),
      elipsoid({ id: `kulak-yaprak-${yon}`, ad: 'Kulak yaprağı', merkez: [-6, t * 8.5, 18], yariCaplar: [5, 3, 7] }),
    ],
  });
});
let bas = yumusakBirlestir({
  ad: 'Baş', genislik: 4,
  parcalar: [kafatasi, ceneOrta, ...yanaklar, burunSirti, burunUcu, altCene, dudak, ...kulaklar],
});

for (const t of [-1, 1]) {
  const yon = t < 0 ? 'sol' : 'sag';
  // Göz alnın yan-üstünde: sığ çukur + içinde kabartma göz.
  bas = burunDeligi({ hedef: bas, ad: `goz-cukuru-${yon}`, merkez: [10, t * 15, 4], yariCaplar: [5, 2.5, 3.8], genislik: 0.6 });
  bas = yumusakBirlestir({
    ad: `Göz ${yon}`, genislik: 0.4,
    parcalar: [bas, elipsoid({ id: `goz-${yon}`, ad: `Göz ${yon}`, merkez: [10, t * 13.3, 4], yariCaplar: [3.6, 2.4, 3] })],
  });
  bas = burunDeligi({ hedef: bas, ad: `burun-delik-${yon}`, merkez: [68, t * 6.5, -1], yariCaplar: [4.2, 2.2, 3.2], genislik: 0.5 });
  bas = dudakCizgisi({
    hedef: bas, ad: `agiz-${yon}`, yaricap: 1, genislik: 0.6,
    noktalar: [[48, t * 7.6, -13], [56, t * 8.2, -13], [62, t * 6.2, -12.5]]
  });
}
// Burun aşağı 50° eğik; ense dünyada (2, 0, 114).
bas = donustur({ parca: bas, aci: [0, 50, 0], tasima: [2, 0, 114], olcek: [1, 1, 1], pivot: [0, 0, 0] });

// ── Kaide, göğüs, boyun ──
const kaideHam = elipsoid({ id: 'kaide', ad: 'Kaide', merkez: [-20, 0, 5], yariCaplar: [30, 18, 7] });
const kaide = yumusakCikar({
  ad: 'Kaide düz taban', ana: kaideHam, genislik: 0.4,
  kesici: elipsoid({ id: 'taban-kesici', ad: 'Taban kesici', merkez: [-20, 0, -500], yariCaplar: [5000, 5000, 500] })
});
// Yandan geniş (x), önden dar (y): sagital düzlemde yan yana üç kapsül (gırtlak, orta, tepe).
const boyunKesitleri = [
  kapsul({ id: 'boyun-girtlak', ad: 'Gırtlak hattı', baslangic: [-6, 0, 26], bitis: [4, 0, 92], baslangicYaricapi: 14, bitisYaricapi: 10 }),
  kapsul({ id: 'boyun', ad: 'Boyun', baslangic: [-24, 0, 28], bitis: [-8, 0, 100], baslangicYaricapi: 17, bitisYaricapi: 12 }),
];
const tepe = kapsul({
  id: 'boyun-tepe', ad: 'Boyun tepe kavisi', baslangic: [-44, 0, 38], bitis: [-8, 0, 118],
  baslangicYaricapi: 9, bitisYaricapi: 6
});
const altGovde = yumusakBirlestir({ ad: 'Kaide ve boyun', parcalar: [kaide, ...boyunKesitleri, tepe], genislik: 6 });

let model = yumusakBirlestir({ ad: 'At kafası · V3 organik', parcalar: [altGovde, bas], genislik: 6 });
model = yeleTutami({
  hedef: model, ad: 'yele',
  noktalar: [[-50, 0, 40], [-42, 0, 64], [-32, 0, 90], [-18, 0, 114], [-8, 0, 124]],
  yaricaplar: [5, 5.5, 5, 4, 3], genislik: 1.5
});

const scale = yukseklik / 146;
// 0.013 mm kaydırma: yüzey örnekleme ızgarasına denk gelip sıfır alanlı üçgen üretmesin.
return donustur({
  parca: model, tasima: [0.013, 0.013, 0.013], olcek: [scale, scale, scale],
  aci: [0, 0, 0], pivot: [0, 0, 0]
});
