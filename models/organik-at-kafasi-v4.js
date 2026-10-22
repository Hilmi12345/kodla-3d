// V4 profil: referans fotoğrafın (outputs/at-kafasi/referans.jpg) yan silüetinden çıkarıldı.
// Yan yüz XZ düzleminde, burun +X yönünde, derinlik Y eksenindedir. Bütün ölçüler mm.
const height = parameters.yukseklik ?? 160;
const withMane = parameters.yele ?? true;
const withDetails = parameters.detaylar ?? true;

const contour = [[57.55, 0.05], [16.28, 0.05], [15.37, 0.67], [0.05, 82.06], [8.0, 87.71], [13.55, 97.67], [14.51, 101.4], [15.85, 103.22], [15.94, 105.23], [23.36, 112.08], [31.79, 116.96], [36.19, 118.2], [44.81, 122.51], [47.21, 124.62], [51.32, 124.91], [58.79, 129.79], [61.86, 129.41], [65.49, 130.94], [68.37, 133.14], [78.32, 132.28], [81.96, 133.72], [87.42, 137.64], [88.52, 139.03], [89.48, 147.27], [91.11, 152.72], [94.89, 157.56], [98.43, 159.95], [100.06, 159.66], [100.68, 158.76], [100.3, 152.05], [101.64, 142.19], [103.12, 141.09], [113.46, 137.93], [116.24, 138.03], [124.52, 146.98], [126.44, 151.96], [128.69, 152.48], [129.89, 149.56], [130.08, 143.53], [128.64, 137.5], [125.48, 129.26], [125.86, 125.15], [127.88, 122.47], [132.66, 111.55], [133.33, 106.38], [132.47, 103.41], [136.59, 93.74], [136.49, 85.51], [137.83, 80.81], [142.72, 69.71], [151.43, 55.06], [160.14, 33.7], [160.05, 29.11], [161.2, 24.32], [160.24, 18.58], [157.18, 13.79], [155.55, 8.81], [153.49, 6.56], [150.42, 5.41], [147.65, 5.31], [145.83, 3.69], [142.57, 2.63], [132.71, 1.96], [128.31, 4.55], [126.25, 6.7], [122.51, 18.86], [119.78, 21.69], [110.88, 28.29], [107.91, 31.84], [104.94, 33.46], [99.49, 38.92], [94.22, 41.51], [87.04, 43.33], [80.24, 47.16], [74.64, 39.35], [65.73, 23.46], [57.12, 12.16], [58.46, 1.63]];

const smooth = (a, b, t) => { const q = Math.max(0, Math.min(1, (t - a) / (b - a))); return q * q * (3 - 2 * q); };
const lerpTable = (table, t) => {
  if (t <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) if (t <= table[i][0]) {
    const [t0, v0] = table[i - 1], [t1, v1] = table[i];
    return v0 + (v1 - v0) * smooth(0, 1, (t - t0) / (t1 - t0));
  }
  return table[table.length - 1][1];
};
// Kafa ekseni: ense (101,138) → burun ucu (154,29).
const poll = [101, 138], muzzle = [154, 29];
const ax = [muzzle[0] - poll[0], muzzle[1] - poll[1]], axLen = Math.hypot(...ax);
// Yarı kalınlık: alın/göz hizası en geniş, burun ucu en dar, boyun orta, kulaklar ince.
const thickness = (x, z) => {
  const dx = x - poll[0], dz = z - poll[1];
  const t = (dx * ax[0] + dz * ax[1]) / (axLen * axLen);
  const dist = Math.abs(dx * ax[1] - dz * ax[0]) / axLen;
  const head = lerpTable([[0, 15], [0.35, 20], [0.55, 19], [0.8, 14], [1, 12]], t);
  const h = (1 - smooth(26, 42, dist)) * (1 - smooth(1.05, 1.2, t)) * smooth(-0.25, -0.05, t);
  const neck = 19 + smooth(40, 0, z);
  let half = neck + (head - neck) * h;
  half += (5 - half) * smooth(136, 146, z) * smooth(70, 85, x);
  return Math.max(5, Math.min(22, half));
};

const body = siluetHacmi({ id: 'v4-govde', ad: 'Fotoğraf silüetinden ana hacim', kontur: contour, kalinlik: thickness, yuvarlama: 1.4 });
const surf = (x, z, side, inset = 0) => [x, side * (thickness(x, z) - inset), z];
const eye = [99.6, 97.5];
const eyes = [-1, 1].map(side => elipsoid({
  id: `v4-goz-${side}`, ad: `Göz kabartısı ${side < 0 ? 'sol' : 'sağ'}`,
  merkez: surf(eye[0], eye[1], side, 0.8), yariCaplar: [3.6, 1.8, 2.6],
}));

let model = yumusakBirlestir({ ad: 'At kafası · organik V4 (fotoğraf)', genislik: 1.1, parcalar: [body, ...eyes] });

if (withDetails) {
  for (const side of [-1, 1]) {
    model = gozKapagi({
      hedef: model, ad: `Üst göz kapağı ${side < 0 ? 'sol' : 'sağ'}`, yaricap: 0.9, genislik: 0.5,
      noktalar: [surf(95.5, 98.5, side, 0.4), surf(99.6, 100.6, side, 0.1), surf(104, 98.8, side, 0.4)],
    });
    model = dudakCizgisi({
      hedef: model, ad: `Burun deliği ${side < 0 ? 'sol' : 'sağ'}`, yaricap: 1.4, genislik: 0.4,
      noktalar: [surf(138, 27, side), surf(141, 31.5, side), surf(143.5, 36, side)],
    });
    model = dudakCizgisi({
      hedef: model, ad: `Ağız çizgisi ${side < 0 ? 'sol' : 'sağ'}`, yaricap: 1.2, genislik: 0.35,
      noktalar: [surf(119.7, 23, side), surf(132, 19.5, side), surf(144.6, 15.3, side)],
    });
    model = dudakCizgisi({
      hedef: model, ad: `Çene kemiği hattı ${side < 0 ? 'sol' : 'sağ'}`, yaricap: 1.1, genislik: 0.45,
      noktalar: [surf(84, 78, side), surf(92, 62, side), surf(104, 52, side)],
    });
  }
}

if (withMane) {
  // Yele boyun sağ yanına dökülüyor (fotoğraftaki gibi); tepe hattından aşağı tutamlar.
  const crest = [[20, 108], [27, 114], [39, 122], [52, 128], [64, 133], [72, 135.5]];
  for (const side of [-1, 1]) crest.forEach(([x, z], i) => {
    const len = side > 0 ? 34 : 14;
    model = yeleTutami({
      hedef: model, ad: `Yele tutamı ${side > 0 ? 'sağ' : 'sol'} ${i + 1}`, yaricaplar: [1.3, 1.5, 1.2], genislik: 0.5,
      noktalar: [surf(x + 2, z - 6, side, 0.6), surf(x - 2, z - len * 0.5, side, 0.3), surf(x - 6, z - len, side, 0.5)],
    });
  });
}

// Kulak uçları yuvarlanınca silüet 158,79 mm kalıyor; ölçek bunu 160 mm hedefe tamamlar.
const scale = height / 158.79;
// Tiny grid offset avoids exact iso-surface coincidences that can create zero-area STL facets.
return donustur({ parca: model, olcek: [scale, scale, scale], tasima: [0.013, 0.013, 0.013], aci: [0, 0, 0], pivot: [0, 0, 0] });
