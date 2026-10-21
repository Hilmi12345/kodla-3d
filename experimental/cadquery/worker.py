"""Guvenilen yerel Python kodunu ayri surecte calistirir; sandbox degildir."""
import json
from pathlib import Path
import runpy
import sys
import traceback
import cadquery as cq
from engine.api import Parca


def main():
    folder = Path(sys.argv[1])
    try:
        scope = runpy.run_path(str(folder / "model.py"))
        model = scope.get("model")
        if isinstance(model, Parca):
            name, shape = model.ad, model.sekil
        else:
            name, shape = "model", model
        if not isinstance(shape, cq.Workplane):
            raise ValueError("Kod sonunda 'model' adli bir Parca veya CadQuery Workplane olmali.")
        solids = shape.solids().vals()
        if not solids or any(not solid.isValid() for solid in solids):
            raise ValueError("Model gecerli bir kati cisim icermiyor. Kesme ve birlestirmeleri kontrol et.")
        compound = cq.Compound.makeCompound(solids)
        cq.exporters.export(compound, str(folder / "model.stl"), tolerance=0.08, angularTolerance=0.1)
        cq.exporters.export(compound, str(folder / "model.step"))
        box = compound.BoundingBox()
        result = {"ok": True, "name": str(name), "size": [box.xlen, box.ylen, box.zlen],
                  "volume": compound.Volume(), "solids": len(solids), "faces": len(compound.Faces())}
    except Exception as exc:
        result = {"ok": False, "error": f"{type(exc).__name__}: {exc}", "detail": traceback.format_exc()}
    (folder / "result.json").write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
