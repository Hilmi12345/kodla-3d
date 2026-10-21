"""AI icin kucuk CAD API'si. Tum uzunluklar milimetredir."""
from dataclasses import dataclass
import math
import cadquery as cq


def pozitif(deger, ad):
    deger = float(deger)
    if not math.isfinite(deger) or deger <= 0:
        raise ValueError(f"{ad} sifirdan buyuk ve sonlu olmali.")
    return deger


@dataclass(frozen=True)
class Parca:
    ad: str
    sekil: cq.Workplane

    def yuvarlat(self, yaricap, kenarlar="|Z"):
        """Varsayilan: dikey kenarlar. Islemler yeni parca dondurur."""
        return Parca(self.ad, self.sekil.edges(kenarlar).fillet(pozitif(yaricap, "yaricap")))

    def icini_bosalt(self, duvar=3):
        """Ust yuzu acik, sabit duvar kalinlikli govde."""
        return Parca(self.ad, self.sekil.faces(">Z").shell(-pozitif(duvar, "duvar")))

    def tasi(self, x=0, y=0, z=0):
        return Parca(self.ad, self.sekil.translate((x, y, z)))

    def delik_ac(self, cap, konumlar=((0, 0),)):
        """Ust duz yuzun yerel XY duzleminde tam gecen delikler."""
        return Parca(self.ad, self.sekil.faces(">Z").workplane().pushPoints(list(konumlar)).hole(pozitif(cap, "cap")))


def kutu(ad="govde", genislik=80, derinlik=50, yukseklik=25):
    return Parca(ad, cq.Workplane("XY").box(
        pozitif(genislik, "genislik"), pozitif(derinlik, "derinlik"),
        pozitif(yukseklik, "yukseklik"), centered=(True, True, False)))


def silindir(ad="silindir", cap=30, yukseklik=20):
    return Parca(ad, cq.Workplane("XY").circle(pozitif(cap, "cap") / 2).extrude(pozitif(yukseklik, "yukseklik")))


def birlestir(a, b, ad=None):
    return Parca(ad or a.ad, a.sekil.union(b.sekil))


def cikar(a, b, ad=None):
    return Parca(ad or a.ad, a.sekil.cut(b.sekil))


__all__ = ["Parca", "kutu", "silindir", "birlestir", "cikar"]
