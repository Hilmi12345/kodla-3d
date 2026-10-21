// XY seviyelerinde değişen kesitlerden kapalı, dairesel bir hacim üretir.
return daireselLoft({
  ad: 'gecisli_govde',
  kesitler: [
    { z: 0, yaricap: 10 },
    { z: 12, yaricap: 12 },
    { z: 24, yaricap: 7 }
  ]
});
