// Raised strands and a shallow cavity are actual SDF features and appear in the exported STL.
const kafa = elipsoid({
  id: 'kafa',
  ad: 'Kafa ana hacmi',
  merkez: [0, 0, 0],
  yariCaplar: [12, 8, 16]
});
const burun = elipsoid({
  id: 'burun-hacmi',
  ad: 'Uzun burun hacmi',
  merkez: [9, 0, -5],
  yariCaplar: [8, 6, 7]
});
const kafaVeBurun = yumusakBirlestir({
  ad: 'Baş ve burun',
  parcalar: [kafa, burun],
  genislik: 3.5
});
const goz = burunDeligi({
  hedef: kafaVeBurun,
  ad: 'goz-cukuru',
  merkez: [5, -6.5, 5],
  yariCaplar: [3.8, 3, 3.2],
  genislik: 1.1
});
const burunDeligiSol = burunDeligi({
  hedef: goz,
  ad: 'burun-deligi',
  merkez: [14, -4.8, -5],
  yariCaplar: [2.7, 2.2, 2.4],
  genislik: 0.9
});
const yele1 = yeleTutami({
  hedef: burunDeligiSol,
  ad: 'yele-tutami-01',
  noktalar: [[-3, -4.3, 13], [-5, -5.1, 10], [-6.5, -6.7, 6], [-7, -7.1, 1]],
  yaricaplar: [1.7, 1.6, 1.5, 1.2],
  genislik: 1.0
});
const yele2 = yeleTutami({
  hedef: yele1,
  ad: 'yele-tutami-02',
  noktalar: [[-6, -4.1, 12], [-8, -4.4, 8], [-9, -4.8, 4], [-8.5, -5.5, 0]],
  yaricaplar: [1.5, 1.5, 1.3, 1.1],
  genislik: 0.9
});
return yele2;
