// V4 başlangıç profili: referans fotoğrafı bu çalışma klonunda yok; kontur geçici, elle çizilmiş tahmindir.
// Yan yüz XZ düzleminde, derinlik Y eksenindedir. Bütün ölçüler mm.
const height = parameters.yukseklik ?? 160;
const withMane = parameters.yele ?? true;
const withDetails = parameters.detaylar ?? true;

const contour = [
  [-62, 0], [10, 0], [12, 7], [-2, 16], [-14, 28], [-7, 46], [-4, 58], [1, 71], [7, 83],
  [12, 90], [18, 94], [23, 98], [24, 101], [17, 109], [9, 120], [2, 132], [-9, 141],
  [-18, 146], [-28, 151], [-36, 150], [-42, 143], [-50, 122],
  [-55, 90], [-56, 74], [-54, 58], [-50, 43], [-45, 30], [-48, 21], [-58, 15], [-62, 9]
];
// Yarı kalınlık tablosu derinlik tahminidir; tek yan fotoğraf görünmeyen ekseni ölçmez.
const thickness = (x, z) => {
  const smooth = (a, b, t) => { const q = Math.max(0, Math.min(1, (t - a) / (b - a))); return q * q * (3 - 2 * q); };
  const bridge = 17 - 5 * smooth(5, 16, x) * (1 - smooth(108, 132, z));
  const muzzle = 14 + smooth(90, 105, z) * 2 - smooth(110, 124, z) * 4;
  const cheek = 15 + 2 * smooth(-8, 8, x) * (1 - smooth(118, 136, z));
  const neck = 16 + 2 * (1 - smooth(28, 55, z));
  const poll = 15 + smooth(132, 151, z);
  return Math.max(12, Math.min(18, Math.max(bridge, muzzle, cheek, neck, poll)));
};

const body = siluetHacmi({ id: 'v4-govde', ad: 'Yan profilden ana hacim', kontur: contour, kalinlik: thickness, yuvarlama: 1.4 });
const ears = [-1, 1].map(side => {
  return kesitZinciri({
    id: `v4-kulak-${side}`, ad: `Kulak ${side < 0 ? 'sol' : 'sağ'}`,
    noktalar: [[-30, side * 6, 147], [-34, side * 7, 152], [-38, side * 8, 159.1]],
    kesitler: [{ rx: 3, ry: 4.2 }, { rx: 2.5, ry: 3.5 }, { rx: 0.7, ry: 1.4 }],
  });
});

const cheeks = [-1, 1].map(side => elipsoid({
  id: `v4-yanak-${side}`, ad: `Yanak ${side < 0 ? 'sol' : 'sağ'}`,
  merkez: [5, side * 10, 105], yariCaplar: [11, 5, 12],
}));
const eyes = [-1, 1].map(side => elipsoid({
  id: `v4-goz-${side}`, ad: `Göz kabartısı ${side < 0 ? 'sol' : 'sağ'}`,
  merkez: [-10, side * 14.4, 135], yariCaplar: [2.8, 1.6, 2.8],
}));
const mane = kesitZinciri({
  id: 'v4-yele-ana', ad: 'Yele ana kütlesi',
  noktalar: [[-35, 0, 151], [-42, 0, 132], [-49, 0, 109], [-54, 0, 84], [-53, 0, 62]],
  kesitler: [{ rx: 2.1, ry: 3.2 }, { rx: 2.8, ry: 4.1 }, { rx: 3.1, ry: 4.2 }, { rx: 3.2, ry: 4.1 }, { rx: 2.3, ry: 3.2 }],
});

let model = yumusakBirlestir({
  ad: 'At kafası · organik V4', genislik: 1.1,
  parcalar: [body, ...ears, ...cheeks, ...eyes, ...(withMane ? [mane] : [])],
});
for (const side of [-1, 1]) model = dudakCizgisi({
  hedef: model, ad: `Kulak iç oluğu ${side < 0 ? 'sol' : 'sağ'}`, yaricap: 0.8, genislik: 0.35,
  noktalar: [[-31, side * 14.5, 149], [-35, side * 16, 153], [-38, side * 15, 157]],
});

if (withDetails) {
  for (const side of [-1, 1]) {
    model = gozKapagi({
      hedef: model, ad: `Üst göz kapağı ${side < 0 ? 'sol' : 'sağ'}`, yaricap: 0.55, genislik: 0.35,
      noktalar: [[-13, side * 14.3, 136], [-10, side * 15.1, 138], [-7, side * 14.4, 136]],
    });
    model = dudakCizgisi({
      hedef: model, ad: `Öne açılan burun yarığı ${side < 0 ? 'sol' : 'sağ'}`, yaricap: 1.3, genislik: 0.35,
      noktalar: [[23, side * 15.1, 100.2], [24.5, side * 14.7, 101.2], [23.1, side * 15.3, 102.1]],
    });
    model = dudakCizgisi({
      hedef: model, ad: `Ağız çizgisi ${side < 0 ? 'sol' : 'sağ'}`, yaricap: 1.35, genislik: 0.35,
      noktalar: [[13, side * 16.2, 93], [18, side * 16.3, 94], [22, side * 14.8, 97]],
    });
    model = dudakCizgisi({
      hedef: model, ad: `Gırtlak oluğu ${side < 0 ? 'sol' : 'sağ'}`, yaricap: 1.15, genislik: 0.4,
      noktalar: [[-7, side * 17.5, 74], [-3, side * 17.3, 78], [2, side * 16.8, 82]],
    });
  }
}

if (withMane) {
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? -1 : 1, z = 76 + i * 9;
    model = yeleTutami({
      hedef: model, ad: `Yele tutamı ${i + 1}`, yaricaplar: [0.75, 1.05, 0.65], genislik: 0.35,
      noktalar: [[-54 + (z - 76) * 0.08, side * 13.4, z - 8], [-48 + (z - 76) * 0.07, side * 14.3, z], [-43 + (z - 76) * 0.05, side * 13.8, z + 7]],
    });
  }
}

const scale = height / 160;
// Tiny grid offset avoids exact iso-surface coincidences that can create zero-area STL facets.
return donustur({ parca: model, olcek: [scale, scale, scale], tasima: [0.013, 0.013, 0.013], aci: [0, 0, 0], pivot: [0, 0, 0] });
