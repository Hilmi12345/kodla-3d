// Yumuşak birleşen kapsül parçalarıyla kavisli, tek parça ergonomik sap taslağı.
const alt = kapsul({id:'sap-alt',ad:'Alt kavrama',baslangic:[-15,0,0],bitis:[-17,0,18],yaricap:4});
const dirsek1 = kapsul({id:'sap-dirsek-1',ad:'Alt dirsek',baslangic:[-17,0,18],bitis:[-14,0,35],baslangicYaricapi:4,bitisYaricapi:3.6});
const dirsek2 = kapsul({id:'sap-dirsek-2',ad:'Üst dirsek',baslangic:[-14,0,35],bitis:[-7,0,48],baslangicYaricapi:3.6,bitisYaricapi:3.4});
const ust = kapsul({id:'sap-ust',ad:'Üst kavrama',baslangic:[-7,0,48],bitis:[5,0,53],baslangicYaricapi:3.4,bitisYaricapi:4});
return yumusakBirlestir({id:'kavisli-sap',ad:'Kavisli ergonomik sap',parcalar:[alt,dirsek1,dirsek2,ust],genislik:2.5});
