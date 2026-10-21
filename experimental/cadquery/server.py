"""Yalniz 127.0.0.1 uzerinde calisan yerel gelistirme sunucusu."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import threading
import uuid
from urllib.parse import urlparse, unquote

ROOT = Path(__file__).resolve().parent
RUNS = ROOT / ".runtime" / "runs"
RUNS.mkdir(parents=True, exist_ok=True)
LOCK = threading.Lock()
MAX_RUNS = 15


class Handler(BaseHTTPRequestHandler):
    def send_bytes(self, status, data, mime="application/json", download=None):
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        if download:
            self.send_header("Content-Disposition", f'attachment; filename="{download}"')
        self.end_headers()
        self.wfile.write(data)

    def json(self, status, value):
        self.send_bytes(status, json.dumps(value, ensure_ascii=False).encode("utf-8"))

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/health":
            return self.json(200, {"ok": True, "engine": "CadQuery", "version": "0.1.0"})
        if path == "/api/examples":
            return self.json(200, [{"name": p.stem, "code": p.read_text(encoding="utf-8")}
                                   for p in sorted((ROOT / "examples").glob("*.py"))])
        match = re.fullmatch(r"/api/files/([a-f0-9]{32})/(model\.(stl|step)|model\.py)", path)
        if match:
            file = RUNS / match[1] / match[2]
            if file.is_file():
                return self.send_bytes(200, file.read_bytes(), "application/octet-stream", match[2])
            return self.json(404, {"error": "Cikti bulunamadi. Modeli yeniden uret."})
        file = (ROOT / "dist" / unquote(path).lstrip("/")).resolve()
        if path == "/":
            file = ROOT / "dist" / "index.html"
        if not file.is_relative_to(ROOT / "dist") or not file.is_file():
            return self.json(404, {"error": "Dosya yok. Arayuz icin once npm run build calistir."})
        mime = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
                ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml"}.get(file.suffix, "application/octet-stream")
        self.send_bytes(200, file.read_bytes(), mime)

    def do_POST(self):
        if self.path != "/api/build":
            return self.json(404, {"error": "Yol bulunamadi."})
        origin = self.headers.get("Origin")
        if origin and origin not in ("http://127.0.0.1:8765", "http://localhost:8765", "http://127.0.0.1:5173"):
            return self.json(403, {"error": "Yalniz yerel uygulamadan istek kabul edilir."})
        if self.headers.get_content_type() != "application/json":
            return self.json(415, {"error": "JSON gerekli."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 100_000:
                return self.json(413, {"error": "Kod en fazla 100 KB olabilir."})
            body = json.loads(self.rfile.read(length))
            code = body.get("code")
            if not isinstance(code, str) or not code.strip():
                return self.json(400, {"error": "Model kodu bos olamaz."})
        except (ValueError, AttributeError):
            return self.json(400, {"error": "Gecersiz JSON."})
        if not LOCK.acquire(blocking=False):
            return self.json(409, {"error": "Bir model uretiliyor. Bitmesini bekle."})
        try:
            # Yalniz bu uygulamanin rastgele kimlikli gecici calismalarini temizle.
            prior = sorted((p for p in RUNS.iterdir() if p.is_dir() and re.fullmatch(r"[a-f0-9]{32}", p.name)), key=lambda p: p.stat().st_mtime)
            for old in prior[:max(0, len(prior) - MAX_RUNS + 1)]:
                if old.resolve().is_relative_to(RUNS.resolve()):
                    shutil.rmtree(old)
            ident = uuid.uuid4().hex
            folder = RUNS / ident
            folder.mkdir()
            (folder / "model.py").write_text(code, encoding="utf-8")
            with (folder / "worker.log").open("w", encoding="utf-8") as log:
                process = subprocess.Popen([sys.executable, str(ROOT / "worker.py"), str(folder)],
                    cwd=ROOT, stdout=log, stderr=log,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
                try:
                    returncode = process.wait(timeout=60)
                except subprocess.TimeoutExpired:
                    # Windows venv baslaticisinin alt Python surecini de kapat.
                    if os.name == "nt":
                        subprocess.run([os.path.join(os.environ.get("SystemRoot", r"C:\Windows"), "System32", "taskkill.exe"),
                                        "/PID", str(process.pid), "/T", "/F"],
                                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5)
                    else:
                        process.kill()
                    process.wait(timeout=5)
                    raise
            result_file = folder / "result.json"
            if returncode != 0 or not result_file.is_file():
                return self.json(500, {"error": "Geometri motoru durdu. .runtime/runs icindeki worker.log dosyasina bak."})
            result = json.loads(result_file.read_text(encoding="utf-8"))
            if result["ok"]:
                result["files"] = {ext: f"/api/files/{ident}/model.{ext}" for ext in ("stl", "step", "py")}
            self.json(200 if result["ok"] else 422, result)
        except subprocess.TimeoutExpired:
            self.json(408, {"error": "Model 60 saniyede tamamlanamadi. Islemleri sadeleştir."})
        except Exception as exc:
            self.json(500, {"error": str(exc)})
        finally:
            LOCK.release()


if __name__ == "__main__":
    print("Kodla 3D: http://127.0.0.1:8765", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
