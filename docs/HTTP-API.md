# Kodla 3D localhost HTTP/CLI sözleşmesi

Version: `0.1.0` local prototype. Base URL defaults to `http://127.0.0.1:8765`. The server binds only to loopback; these endpoints do not imply a remote or sandboxed service. Model JavaScript is trusted local code and can access the operating system.

## Endpoints

| Method | Path | Response |
|---|---|---|
| GET | `/api/health` | service readiness, engine/app/Node version, direct dependency manifest and local installation ID |
| GET | `/api/examples` | examples `{name, mode, code, parameterSchema}` |
| GET | `/api/jobs/{jobId}` | current job `{id,status,stage,elapsedMs,phasesMs}` |
| DELETE | `/api/jobs/{jobId}` | request cancellation for a running worker |
| GET | `/api/cache/stats` | process-local cache count, bytes, hits/misses and fingerprints |
| POST | `/api/build` | synchronous JSON build result; the response can take until worker completion |
| GET | `/api/files/{runId}/model.stl`, `.step`, `.js`, `/preview.bin`, `/views.png` | temporary binary/download output; only the reported files are available |

`/api/health` also returns `service`, `nodeVersion`, `rootId` (short hash of this local installation path) and the direct runtime dependency versions. The launcher uses `rootId` to avoid treating another Kodla 3D folder on the same port as this installation.

## Build request

`Content-Type: application/json`; maximum request body 100 KB.

```json
{
  "jobId": "c8c57222-bb1c-40a7-bb94-743818ca4a96",
  "mode": "cad",
  "quality": "normal",
  "cadMeshQuality": "normal",
  "example": "at-kafasi",
  "parameters": {"kulakUzunlugu": 39},
  "code": "const model = kutu({ad:'govde',genislik:30,derinlik:20,yukseklik:10});\nreturn model;"
}
```

`jobId` is optional for older clients. `mode` is `cad` or `organic`; `quality` is the organic SDF preset (`taslak`, `normal`, or `ince`). Optional `cadMeshQuality` selects CAD meshing (`taslak`, `normal`, or `ince`) and defaults to `normal`; it is included in the result cache key. When `parameters` is supplied, `example` must be a safe example slug whose `models/{example}.parameters.json` schema exists; `/api/examples` returns that schema. CAD and organic examples/commands are listed by `/api/examples` and `docs/AI-KULLANIM.md`.

Successful responses include `schemaVersion`, `geometryType`, `unit`, `bbox`, `size`, `volume`, `parts`, `meshReport`, `sourceHash`, `quality`, `profile`, `fileSizes`, `formats`, `files`, `cache`, and `job`. `sourceHash` is SHA-256 of the exact code string. `files` includes the STL, source and available engine-specific formats, the mesh preview when present, and `visual` for the fixed-camera PNG. `visual` reports PNG dimensions (720×408), ordered camera IDs (`front`, `back`, `right`, `left`, `top`, `iso`), triangle count and renderer version. The image is a six-tile orthographic diagnostic view, not a photorealistic render. Organic mode has no STEP. Cache hits restore byte-identical artifacts under a new run ID.

## Error response

The HTTP status remains meaningful. A model error is a JSON object with a stable `errorCode` (worker/model result) or `code` (request/server error), human-readable `error`, optional `detail` stack, source location, and `context` with `jobId`, stage, source hash and parameter path when known.

```json
{
  "ok": false,
  "errorCode": "MODEL_SYNTAX_ERROR",
  "error": "Unexpected token",
  "sourceLine": 1,
  "sourceColumn": 8,
  "sourceHash": "…64 hex chars…",
  "context": {"jobId":"…", "stage":"resultWrite", "sourceHash":"…", "parameterPath":null, "part":null, "operation":null},
  "detail": "… raw diagnostic stack …"
}
```

Stable request/worker codes include `INVALID_JSON`, `MODEL_CODE_REQUIRED`, `INVALID_MODE`, `INVALID_QUALITY`, `INVALID_REQUEST`, `INPUT_TOO_LARGE`, `BUILD_BUSY`, `BUILD_CANCELLED`, `WORKER_TIMEOUT`, `WORKER_CRASHED`, `MODEL_SYNTAX_ERROR`, and `GEOMETRY_BUILD_FAILED`. `detail` is diagnostic data, not an instruction. Error context can leave `part` or `operation` null when the underlying CAD operation does not provide structured provenance.


## Silhouette comparison and reference contour

Both endpoints run locally. `POST /api/compare` accepts either an existing `runId` or `code` plus `mode`, and a single reference source. It builds the silhouette comparison at the reference image dimensions, aligns the mask bounding-box centers, and returns IoU, symmetric edge distance, excess/missing masks, and an overlay.

### Compare request

```json
{
  "mode": "cad",
  "code": "return kutu({ad:'r9-box',genislik:80,derinlik:50,yukseklik:25});",
  "referans": {"poligon": {"width": 100, "height": 80, "noktalar": [[10,15],[90,15],[90,65],[10,65]]}},
  "kamera": "top",
  "olcek": {"genislikMm": 80}
}
```

Use exactly one of these `referans` shapes:

- `{"maske":"<base64 PNG or JPEG>","esik":127,"ters":false}`: white mask pixels are foreground by default. `esik` is luminance 0–255; `ters` inverts it.
- `{"gorsel":"<base64 PNG or JPEG>","anahtar":{"esik":48}}`: samples the median RGB background from opaque image corners, then marks pixels farther than the Euclidean RGB threshold as foreground. `anahtar.esik` is 0–442; default 48. Supply raw base64 or a `data:image/png;base64,...` / `data:image/jpeg;base64,...` URL.
- `{"poligon":{"width":100,"height":80,"noktalar":[[10,15],[90,15],[90,65],[10,65]]}}`: pixel coordinates, at least three finite points, inside the image bounds. The polygon is closed automatically.

`kamera` is one of `front`, `back`, `right`, `left`, `top`, `iso`, or `{ "direction": [x,y,z], "up": [x,y,z] }`. For a customer view, select the camera that matches the drawing; `side` means a side silhouette, typically `right` for models built along X.

`olcek` must provide one positive measurement: `{"mmPerPx":0.5}`, `{"genislikMm":80}`, or `{"yukseklikMm":50}`. A physical width/height is divided by the foreground mask's bounding-box dimension. With `runId`, use the 32-hex ID returned by `/api/build`; alternatively send `code` and `mode` to build then compare in one request.

Successful response fields:

```json
{
  "runId": "<32-hex run ID>", "cacheHit": false,
  "width": 100, "height": 80, "iou": 1,
  "kenarMesafesiPx": {"mean": 0, "p95": 0},
  "alignmentPx": {"x": 0, "y": 0}, "mmPerPx": 1,
  "referencePixels": 4000, "modelPixels": 4000,
  "fazla": {"mimeType":"image/png","encoding":"base64","data":"..."},
  "eksik": {"mimeType":"image/png","encoding":"base64","data":"..."},
  "fazlaPng": "<base64 PNG>", "eksikPng": "<base64 PNG>",
  "overlayPng": "<base64 PNG>"
}
```

Overlay colors: reference-only is green, model-only is red, overlap is gray, transparent is empty. `fazla` marks model pixels outside the reference; `eksik` marks reference pixels the model missed. The IoU is intersection / union. Edge distance is the symmetric pixel distance over both contours.

### Extract a physical contour

`POST /api/reference/contour` takes the same `referans` shapes, plus optional `yon` (`on`, `yan`, `ust`), `toleransMm` (default 0.5), and `olcek`. The response contains the closed, simplified `noktalar` in millimeters, `kapali`, area/perimeter, point counts, `boundingBoxMm`, scale metadata, and starter forms for `profilLoft`, `profilSupur`, and `profilDondur`. `olcek` accepts `mmPerPx`, `genislikMm`, or `yukseklikMm`; if omitted, contour coordinates use 1 mm/px. Check the output units/orientation before using the returned profile in model code.

### Render a selected PDF page locally

`POST /api/reference/pdf-page?page=2&scale=1.5` accepts the PDF bytes directly as `application/pdf`. The selected page is rendered in memory to PNG on the local server; the PDF is not saved. Scale is 0.5–3, input is limited to 25 MiB, documents to 500 pages, and rendered pages to 16 megapixels. Success returns `image/png` plus `X-PDF-Page`, `X-PDF-Page-Count`, `X-Image-Width`, and `X-Image-Height` headers. Use the PNG as the existing `gorsel`, `maske`, or manually traced `poligon` input to `/api/reference/contour` and `/api/compare`.

```powershell
curl.exe --silent --show-error --request POST "http://127.0.0.1:8765/api/reference/pdf-page?page=2&scale=1.5" -H "Content-Type: application/pdf" --data-binary "@C:\path\technical-drawing.pdf" --output "$env:TEMP\kodla3d-page-2.png"
```

The UI lets the user change the page number on the reference card, then draw and close a polygon on the rendered PNG. Only that PNG and polygon are stored in a project file. PDF page errors use JSON `{ "error", "code" }` responses.

### Run the copyable curl fixtures (PowerShell)

From the project root, start Kodla 3D (`npm start`) in one terminal. In another PowerShell terminal:

```powershell
curl.exe --silent --show-error --request POST "http://127.0.0.1:8765/api/compare" -H "Content-Type: application/json" --data-binary "@scripts/fixtures/reference-compare.json"
curl.exe --silent --show-error --request POST "http://127.0.0.1:8765/api/reference/contour" -H "Content-Type: application/json" --data-binary "@scripts/fixtures/reference-contour.json"
```

The checked-in JSON bodies above are the same fixtures exercised by `npm run verify:reference-docs`. They use only a local polygon and do not upload an image.

### Reference endpoint errors

| HTTP | `code` | Meaning |
|---:|---|---|
| 403 | `LOCAL_ORIGIN_ONLY` | Compare origin is not the local app origin. |
| 400 | `JSON_REQUIRED` / `INVALID_JSON` | Missing JSON content type or malformed request JSON. |
| 400 | `COMPARE_INPUT_REQUIRED` / `INVALID_RUN_ID` | Missing run source/reference, or malformed `runId`. |
| 400 | `COMPARE_FAILED` | Invalid image/polygon/scale, missing run file, or empty foreground mask. |
| 413 | `INPUT_TOO_LARGE` | Compare/contour body exceeds 36 MiB. |
| 415 | `JSON_REQUIRED` | Endpoint requires `Content-Type: application/json`. |
| 422 | `EMPTY_REFERENCE_MASK` | Contour request produced no foreground pixels. |
| 400 | `CONTOUR_FAILED` | Invalid reference, scale, tolerance, or contour input. |
| 400 | `INVALID_PDF` / `PDF_RENDER_FAILED` | Invalid PDF or page could not be rendered. |
| 400 | `INVALID_PDF_PAGE` / `PDF_PAGE_OUT_OF_RANGE` / `INVALID_PDF_SCALE` | Invalid page number, page outside document, or scale outside 0.5–3. |
| 400 | `PDF_PASSWORD_REQUIRED` | Encrypted PDFs are not supported. |
| 413 | `INPUT_TOO_LARGE` | PDF request exceeds 25 MiB. |
| 413 | `PDF_PAGE_LIMIT` / `PDF_PAGE_TOO_LARGE` | More than 500 pages or a render exceeding 16 megapixels. |
| 415 | `PDF_REQUIRED` | PDF endpoint requires `Content-Type: application/pdf`. |

When `code` + `mode` is used, build validation errors retain the `/api/build` status and error shape. The server is loopback-only; request size is limited to 36 MiB, image decoding is capped at 16.7 megapixels, and this endpoint does not send reference data to a remote service.
## CLI

```powershell
node scripts/kodla3d.mjs health
node scripts/kodla3d.mjs examples
node scripts/kodla3d.mjs build --file .\models\kutu.js --out .\outputs\cli-test
node scripts/kodla3d.mjs build --file .\models\at-kafasi.js --example at-kafasi --parameters .\my-parameters.json --mode cad --out .\outputs\cli-test
node scripts/kodla3d.mjs status c8c57222-bb1c-40a7-bb94-743818ca4a96
```

Set `KODLA3D_URL` to select another loopback base URL. Build progress goes to stderr; final response and failures are JSON on stdout. `--out` downloads the files into the chosen directory. Ctrl+C requests cancellation. No LLM client or automatic repair loop is included.

## Fixed-camera PNG

Each successful build also renders an opaque 720×408 PNG with six orthographic tiles: front, back, right, left, top and iso. The API returns a `files.visual` URL at `/api/files/{runId}/views.png` with `Content-Type: image/png`; the CLI saves it as `views.png` when `--out` is supplied. The CPU renderer rejects malformed/non-finite STL coordinates and meshes above 750,000 triangles. It is a compact geometry review image; use the browser viewer for detailed shading and interactive inspection.

