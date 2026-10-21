export const MODEL_SCHEMA_VERSION = 1;
export const ORGANIC_API_VERSION = 1;

export const ORGANIC_API_REFERENCE = [
  { name: 'kure', args: '{id?, ad?, merkez?, yaricap?}', purpose: 'Analitik signed-distance küresi üretir.' },
  { name: 'elipsoid', args: '{id?, ad?, merkez?, yariCaplar?}', purpose: 'Yaklaşık signed-distance elipsoidi üretir.' },
  { name: 'kapsul', args: '{id?, ad?, baslangic, bitis, yaricap?, baslangicYaricapi?, bitisYaricapi?}', purpose: 'Sabit veya değişken yarıçaplı tüp/kapsül üretir.' },
  { name: 'kesitZinciri', args: '{id?, ad?, noktalar, kesitler, yumusaklik?}', purpose: 'Catmull-Rom merkez eğrisi boyunca değişken eliptik kesitli organik hacim üretir.' },
  { name: 'yumusakBirlestir', args: '{ad?, parcalar, genislik?}', purpose: 'Parçaları gerçek SDF smooth union ile birleştirir.' },
  { name: 'yumusakCikar', args: '{ad?, ana, kesici, genislik?}', purpose: 'Ana hacimden kesiciyi yumuşak SDF farkıyla çıkarır.' },
  { name: 'grup', args: '{id?, ad?, parcalar}', purpose: 'Parçaları mantıksal grupta toplar.' },
  { name: 'gorunum', args: '{parca, gorunur?, kilitli?}', purpose: 'Parça görünürlüğünü veya kilidini ayarlar.' },
  { name: 'tasi', args: '{parca, x?, y?, z?}', purpose: 'Parçayı global mm eksenlerinde taşır.' },
  { name: 'donustur', args: '{parca, tasima?, olcek?, aci?, pivot?}', purpose: 'Ölçek → derece cinsinden döndürme → taşıma uygular.' },
  { name: 'simetrik', args: '{parca, duzlem?, konum?, id?, ad?}', purpose: 'YZ/XZ/XY düzleminde yansıma kopyası oluşturur.' },
  { name: 'parcaBul', args: '{parca, id}', purpose: 'Parça ağacında ID ile parça bulur.' },
  { name: 'parcaDegistir', args: '{parca, id, yeniParca}', purpose: 'Gruptaki tek hedefi yeniler; kardeşleri korur.' },
  { name: 'bolgeselSekillendir', args: '{parca, merkez, yaricap?, derinlik?, islem?, yon?}', purpose: 'Compact-cubic falloff ile yerel alan deformasyonu yapar.' },
  { name: 'egriDetayi', args: '{hedef, noktalar, yaricap?, yaricaplar?, etki?, genislik?, ad?}', purpose: 'Eğri boyunca gerçek kabartma veya oyuk geometrisi ekler.' },
  { name: 'gozKapagi', args: '{hedef, noktalar, yaricap?, genislik?, ad?}', purpose: 'Kabartmalı göz kapağı eğrisi üretir.' },
  { name: 'dudakCizgisi', args: '{hedef, noktalar, yaricap?, genislik?, ad?}', purpose: 'Oyuk dudak çizgisi üretir.' },
  { name: 'yeleTutami', args: '{hedef, noktalar, yaricap?, yaricaplar?, genislik?, ad?}', purpose: 'Değişken kalınlıklı yele tutamı kabartır.' },
  { name: 'burunDeligi', args: '{hedef, merkez, yariCaplar?, genislik?, ad?}', purpose: 'Elipsoidal burun çukuru çıkarır.' }
];
