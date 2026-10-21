from engine.api import kutu, birlestir

# L bicimli baglanti aparati. Koordinatlar mm.
taban = kutu("taban", genislik=70, derinlik=40, yukseklik=6)
taban = taban.delik_ac(cap=5, konumlar=[(-22, 0), (22, 0)])
arka = kutu("arka", genislik=70, derinlik=6, yukseklik=35)
arka = arka.tasi(y=17)
model = birlestir(taban, arka, ad="baglanti_aparati")
