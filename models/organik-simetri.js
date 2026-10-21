// Stable part ids remain unchanged if the display names are edited.
const kulakSol = elipsoid({
  id: 'kulak-sol',
  ad: 'Sol kulak',
  merkez: [-5, 0, 0],
  yariCaplar: [2, 1.5, 5]
});
const model = simetrik({
  parca: kulakSol,
  duzlem: 'YZ',
  konum: 0,
  id: 'kulak-sag',
  ad: 'Sağ kulak'
});
return model;
