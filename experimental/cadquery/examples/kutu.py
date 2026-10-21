from engine.api import kutu

# Tum olculer mm. Parametreleri degistir, yeniden uret.
genislik = 80
derinlik = 50
yukseklik = 25
duvar = 3

model = kutu("duzenleyici", genislik, derinlik, yukseklik)
model = model.yuvarlat(yaricap=5)
model = model.icini_bosalt(duvar=duvar)
