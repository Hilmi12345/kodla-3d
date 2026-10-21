// V2 · 19 Ekim referans fotoğrafından geliştirilen, stilize ve tek katı CAD büst.
// Tarama değildir; görünmeyen taraf simetrik varsayılmıştır. V1 korunur.
const yukseklik = parameters.yukseklik ?? 160; // mm, kaide dahil
const kulakUzunlugu = parameters.kulakUzunlugu ?? 39; // mm, merkez hattı boyunca
const kulakBoyOrani = kulakUzunlugu / 39;
const yanakDolgunlugu = parameters.yanakDolgunlugu ?? 12; // mm, yanak hacim yarıçapı
const detaylar = parameters.detaylar ?? true;
const yele = parameters.yele ?? true;
const r = replicad;
const oran = yukseklik / 166;
function adlandir(id, ad, shape, parcaParametreleri = {}) {
  return new Parca(ad, shape.scale(oran), { id, parameters: { yukseklik, ...parcaParametreleri } });
}
function birlesim(a, b, ad) { return api.birlestir(a, b, ad); }
function cikarma(a, b, ad) { return api.cikar(a, b, ad); }

function yatayLoft(kesitler, uc) {
  const sketches = kesitler.map(([x,y,z,rx,ry]) =>
    r.sketchEllipse(rx, ry, { plane: new r.Plane([x,y,z], [1,0,0], [0,0,1]) }));
  return sketches[0].loftWith(sketches.slice(1), uc ? { endPoint: uc } : {});
}
function basLoft(kesitler) {
  const sketches = kesitler.map(([x,z,genislik,yariYukseklik]) =>
    r.sketchEllipse(genislik, yariYukseklik, { plane: new r.Plane([x,0,z], [0,1,0], [1,0,0]) }));
  return sketches[0].loftWith(sketches.slice(1), {startPoint:[-19,0,107],endPoint:[63,0,71]});
}
function oval(rx,ry,rz,x,y,z,aci=0) {
  return r.makeEllipsoid(rx,ry,rz).rotate(aci,[0,0,0],[0,1,0]).translate(x,y,z);
}

// Boyun: omuzdan enseye yumuşak, öne eğilen kesitler.
let boyun = adlandir('boyun','Boyun',yatayLoft([
  [-42,0,4,24,22],[-38,0,20,29,22],[-28,0,40,27,21],
  [-18,0,58,23,19],[-10,0,76,20,16],[-4,0,94,17,14],[-3,0,108,15,12]
]), { bolge: 'ense, göğüs ve boyun kesitleri' });
let bas = basLoft([
  [-19,107,8,16],[-14,114,11,19],[-7,120,14,22],[2,121,16,23],
  [12,114,15,21],[21,104,13,18],[28,96,yanakDolgunlugu,15.5],[35,89,11.5,14],
  [41,83,10,12],[51,76,11,10],[60,72,10,8],[63,71,8,7]
]);
if (parameters.burunAcisi) bas = bas.rotate(parameters.burunAcisi, [0,0,0], [0,1,0]);
let govde = birlesim(boyun, adlandir('bas','Baş',bas,{ bolge: 'kafatası, yanak ve burun', yanakDolgunlugu, burunAcisi: parameters.burunAcisi ?? 0 }), 'Baş ve boyun');

// İki ayrı, ince ve sivri kulak. Kökleri kafatasının içine girer.
for (const taraf of [-1,1]) {
  const kulak = adlandir(taraf < 0 ? 'kulak-sol' : 'kulak-sag', taraf < 0 ? 'Sol kulak' : 'Sağ kulak', yatayLoft([
    [-5,taraf*10,127,6.5,4.4],[-4,taraf*12,127+10*kulakBoyOrani,6,3.4],
    [-5,taraf*13.5,127+21*kulakBoyOrani,4.2,2.7],[-7,taraf*14,127+32*kulakBoyOrani,1.8,1.3]
  ],[-8,taraf*14,127+39*kulakBoyOrani]), { kulakUzunlugu, taraf: taraf < 0 ? 'sol' : 'sag' });
  govde = birlesim(govde, kulak, taraf < 0 ? 'Sol kulak birleşimi' : 'Sağ kulak birleşimi');
}

if (yele) {
  // Ense boyunca tek parça kabartma yele; ince saç telleri taklit edilmez.
  const ense = adlandir('yele','Yele',yatayLoft([
    [-53,0,31,3,5],[-48,0,45,4.5,6.5],[-43,0,60,5.2,7.5],
    [-37,0,75,6,8],[-31,0,91,5.8,7.5],[-24,0,106,5,6.5],
    [-17,0,119,4.2,5.5],[-10,0,130,3.2,4.5]
  ]), { yele: true });
  govde = birlesim(govde, ense, 'Yele birleşimi');
  for (const taraf of [-1,1]) {
    for (const [index, fark] of [-2,1.5].entries()) {
      const id = `yele-oluk-${taraf < 0 ? 'sol' : 'sag'}-${index + 1}`;
      const oluk = adlandir(id, `Yele oluğu ${taraf < 0 ? 'sol' : 'sağ'} ${index + 1}`, oval(0.8,3,23,-31+fark,taraf*6.8,88,26), { yele: true });
      govde = cikarma(govde, oluk, 'Yele olukları');
    }
  }
}

if (detaylar) {
  for (const taraf of [-1,1]) {
    // Kulak içi, göz çukuru ve ona bağlı kabartma göz.
    const yon = taraf < 0 ? 'sol' : 'sag';
    govde = cikarma(govde, adlandir(`kulak-ici-${yon}`, `Kulak içi ${yon}`, oval(3.3,2.2,10,-1.5,taraf*13,147,-8), { detaylar: true }), 'Kulak içi');
    govde = cikarma(govde, adlandir(`goz-cukuru-${yon}`, `Göz çukuru ${yon}`, oval(4.8,3,4.1,7,taraf*16.3,117), { detaylar: true }), 'Göz çukurları');
    govde = birlesim(govde, adlandir(`goz-${yon}`, `Göz kabartısı ${yon}`, r.makeSphere(2.4).translate(7,taraf*14,117), { detaylar: true }), 'Göz kabartıları');
    const kas = adlandir(`kas-${yon}`,`Kaş kemeri ${yon}`,oval(5.2,2.1,1.5,7,taraf*16.1,121,12),{detaylar:true});
    govde = birlesim(govde,kas,'Kaş kemeri birleşimi');
    // İki burun deliği ve yanlarda sığ ağız çizgisi.
    govde = cikarma(govde, adlandir(`burun-delik-${yon}`, `Burun deliği ${yon}`, oval(4,4,5.2,56.5,taraf*10.5,74,-20), { detaylar: true }), 'Burun delikleri');
    govde = cikarma(govde, adlandir(`agiz-cizgi-${yon}`, `Ağız çizgisi ${yon}`, oval(10,1.4,0.65,54,taraf*9.2,66.5,10), { detaylar: true }), 'Ağız çizgileri');
  }
}

// Düz tabanlı, eliptik kaide. Büstle tek katı cisim oluşturur.
const kaide = adlandir('kaide','Kaide',r.sketchEllipse(32,25).extrude(6).translate(-29,0,0));
govde = birlesim(govde, kaide, 'Kaide birleşimi');
return new Parca('At kafasi · V2 profil ve yele',govde);
