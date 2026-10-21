// At büstü V3 · yumuşak birleşimli organik alternatif.
// 22.10 yeniden kurgu: düz tabanlı kaide (baskıda yatağa oturur), enine sıkıştırma kaldırıldı,
// boyun kafadan kalın ve kavisli; yüz tek boru yerine alın → daralan burun sırtı → genişleyen burun ucu.
// Gözler oyuk değil, çukur içinde kabartma göz. Stilizedir, tek fotoğraftan elle yorumlanmıştır.
const yukseklik = parameters.yukseklik ?? 160;

// Kaide: alt yarısı dev bir elipsoitle kesilerek düz taban (z = 0).
const kaideHam = elipsoid({ id: 'kaide', ad: 'Kaide', merkez: [-22, 0, 5], yariCaplar: [29, 17, 7] });
const kaide = yumusakCikar({
  ad: 'Kaide düz taban', ana: kaideHam, genislik: 0.4,
  kesici: elipsoid({ id: 'taban-kesici', ad: 'Taban kesici', merkez: [-22, 0, -500], yariCaplar: [5000, 5000, 500] })
});
const gogus = elipsoid({ id: 'gogus', ad: 'Göğüs ve omuz', merkez: [-22, 0, 26], yariCaplar: [23, 17, 22] });
const boyun = kapsul({
  id: 'boyun', ad: 'Boyun', baslangic: [-30, 0, 26], bitis: [-6, 0, 98],
  baslangicYaricapi: 19, bitisYaricapi: 13.5
});
// Boyun üst çizgisi (tepe kavisi): arka hatta ayrı kapsül, yeleye zemin.
const tepe = kapsul({
  id: 'boyun-tepe', ad: 'Boyun tepe kavisi', baslangic: [-41, 0, 40], bitis: [-16, 0, 112],
  baslangicYaricapi: 8, bitisYaricapi: 7
});
const altGovde = yumusakBirlestir({ ad: 'Kaide, göğüs ve boyun', parcalar: [kaide, gogus, boyun, tepe], genislik: 4 });

// Kafa ~45° aşağı bakar; ense arkada-üstte, burun önde-altta.
const kafatasi = elipsoid({ id: 'kafatasi', ad: 'Alın ve kafatası', merkez: [0, 0, 116], yariCaplar: [17, 16, 15] });
const ganas = elipsoid({ id: 'ganas', ad: 'Çene kemiği (ganaş)', merkez: [0, 0, 97], yariCaplar: [20, 15.5, 19] });
const burunSirti = kapsul({
  id: 'burun-sirti', ad: 'Burun sırtı', baslangic: [10, 0, 108], bitis: [36, 0, 86],
  baslangicYaricapi: 13, bitisYaricapi: 10.5
});
const burun = kapsul({
  id: 'burun', ad: 'Burun', baslangic: [36, 0, 86], bitis: [50, 0, 74],
  baslangicYaricapi: 10.5, bitisYaricapi: 11
});
const burunUcu = elipsoid({ id: 'burun-ucu', ad: 'Burun ucu', merkez: [53, 0, 69], yariCaplar: [11, 12.5, 12] });
const dudak = elipsoid({ id: 'dudak', ad: 'Alt dudak', merkez: [49, 0, 58], yariCaplar: [9, 10, 5] });
const altCene = kapsul({
  id: 'alt-cene', ad: 'Alt çene', baslangic: [6, 0, 88], bitis: [43, 0, 63],
  baslangicYaricapi: 11, bitisYaricapi: 8
});
const kulaklar = [-1, 1].map((t) => {
  const yon = t < 0 ? 'sol' : 'sag';
  return yumusakBirlestir({
    ad: `Kulak ${t < 0 ? 'sol' : 'sağ'}`, genislik: 1.2, parcalar: [
      kapsul({ id: `kulak-${yon}`, ad: 'Kulak', baslangic: [-3, t * 8, 127], bitis: [2, t * 11, 152], baslangicYaricapi: 6, bitisYaricapi: 2.4 }),
      elipsoid({ id: `kulak-yaprak-${yon}`, ad: 'Kulak yaprağı', merkez: [-0.5, t * 9.5, 139], yariCaplar: [5, 3.2, 9] }),
    ],
  });
});
let bas = yumusakBirlestir({
  ad: 'Baş', genislik: 3,
  parcalar: [kafatasi, ganas, burunSirti, burun, burunUcu, dudak, altCene, ...kulaklar],
});

for (const t of [-1, 1]) {
  const yon = t < 0 ? 'sol' : 'sag';
  // Göz: önce sığ çukur, sonra içine kabartma göz küresi.
  bas = burunDeligi({ hedef: bas, ad: `goz-cukuru-${yon}`, merkez: [7, t * 15.5, 112], yariCaplar: [5, 2.5, 3.6], genislik: 0.6 });
  bas = yumusakBirlestir({
    ad: `Göz ${yon}`, genislik: 0.4,
    parcalar: [bas, elipsoid({ id: `goz-${yon}`, ad: `Göz ${yon}`, merkez: [7, t * 13.6, 112], yariCaplar: [3.6, 2.4, 3] })],
  });
  bas = burunDeligi({ hedef: bas, ad: `burun-delik-${yon}`, merkez: [60, t * 7, 72], yariCaplar: [3.2, 2.2, 4.2], genislik: 0.5 });
}

let model = yumusakBirlestir({ ad: 'At kafası · V3 organik', parcalar: [altGovde, bas], genislik: 4 });
model = yeleTutami({
  hedef: model, ad: 'yele',
  noktalar: [[-47, 0, 38], [-39, 0, 66], [-28, 0, 94], [-14, 0, 122]],
  yaricaplar: [5, 5.5, 5, 3.5], genislik: 1.5
});

const scale = yukseklik / 155;
// 0.013 mm kaydırma: yüzey örnekleme ızgarasına denk gelip sıfır alanlı üçgen üretmesin.
return donustur({
  parca: model, tasima: [0.013, 0.013, 0.013], olcek: [scale, scale, scale],
  aci: [0, 0, 0], pivot: [0, 0, 0]
});
