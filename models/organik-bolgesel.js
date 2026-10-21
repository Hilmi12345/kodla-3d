// A local bulge changes the cheek area; the rest of the ellipsoid remains untouched.
const yuz = elipsoid({
  id: 'yuz-kutlesi',
  ad: 'Yüz ana hacmi',
  merkez: [0, 0, 0],
  yariCaplar: [13, 9, 16]
});
const yanak = bolgeselSekillendir({
  parca: yuz,
  islem: 'sisir',
  merkez: [10, -3, 0],
  yaricap: 6,
  derinlik: 2
});
return yanak;
