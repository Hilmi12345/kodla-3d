import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { validateProjectDocument } from './project-manifest.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const previewOnly = new URL(location.href).searchParams.get('preview') === '1';
const code = $('code');
const mode = $('mode');
const quality = $('quality');
const cadMeshQuality = $('cad-mesh-quality');
let files = null, builtCode = null, builtMode = null, builtQuality = null, builtCadMeshQuality = null, builtGeometryType = null, building = false, activeJobId = null, jobPollTimer = null, mesh = null, wire = false, normalMode = false, sectionEnabled = false;
let lastBuildFailed = false, errorLine = null, failedCode = null;
let partRecords = new Map(), partVisibility = new Map(), selectedPartId = null, isolatedPartId = null, partDescendants = new Map();
let partFaceSourcesByTriangle = [];
let samples = [];
let activeExample = '', activeParameters = {}, parameterSchema = null, builtParameters = null, parameterTimer = null;
let savedProjectSnapshot = null, projectFileSaved = false;
let successfulVersions = [];
let referenceItems = [];
let referenceOverlayFit = null;
const viewport = $('viewport');
const referenceOverlay = $('reference-overlay-image');
let blazePreview = null;
function clearBlazePreview() {
  if (!blazePreview) return;
  scene.remove(blazePreview);
  const materials = new Set();
  blazePreview.traverse(object => {
    object.geometry?.dispose();
    if (Array.isArray(object.material)) object.material.forEach(material => materials.add(material));
    else if (object.material) materials.add(object.material);
  });
  materials.forEach(material => material.dispose());
  blazePreview = null;
  $('blaze-preview-note').hidden = true;
}
function createHorseBlazePreview(example, targetMesh = mesh) {
  if (example !== 'at-kafasi-v2') return null;
  if (!targetMesh?.geometry) return null;
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0xf4ecda, roughness: .82, metalness: 0 });
  // Alın izi gerçek CAD yüzeyine ışınlanır; bu viewport katmanı kaynak katıya ve
  // STL/STEP/GLB indirmelerine eklenmez.
  const profile = [
    [2, 120.3, 3.6], [10, 113.5, 4.2], [20, 103.8, 4.5],
    [30, 92.2, 4.2], [40, 82.4, 3.8], [50, 74.6, 3.3], [58, 71.5, 2.8]
  ];
  const curve = new THREE.CatmullRomCurve3(
    profile.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal'
  );
  const raycaster = new THREE.Raycaster();
  const segments = 96;
  for (const side of [1, -1]) {
    const positions = [], indices = [];
    let previousBase = null;
    for (let i = 0; i <= segments; i++) {
      const point = curve.getPoint(i / segments);
      raycaster.set(new THREE.Vector3(point.x, side * 100, point.z), new THREE.Vector3(0, -side, 0));
      raycaster.far = 200;
      const hit = raycaster.intersectObject(targetMesh, false)[0];
      if (!hit) { previousBase = null; continue; }
      const center = hit.point.clone().addScaledVector(hit.face.normal, .035);
      const beforePoint = curve.getPoint(Math.max(0, i - 1) / segments);
      const afterPoint = curve.getPoint(Math.min(segments, i + 1) / segments);
      // Teğet profil eğrisinden alınır; merkez yüzey noktası gerçek mesh'ten gelir.
      const tangent = afterPoint.sub(beforePoint).setY(0).normalize();
      const across = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(THREE.MathUtils.lerp(3.6, 2.8, i / segments) / 2);
      const left = center.clone().add(across), right = center.clone().sub(across);
      const currentBase = positions.length / 3;
      positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
      if (previousBase !== null) indices.push(previousBase, previousBase + 1, currentBase, previousBase + 1, currentBase + 1, currentBase);
      previousBase = currentBase;
    }
    if (indices.length < 6) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const stripe = new THREE.Mesh(geometry, material);
    stripe.material.side = THREE.DoubleSide;
    stripe.name = `preview-only-horse-blaze-${side}`;
    group.add(stripe);
  }
  if (!group.children.length) { material.dispose(); return null; }
  return group;
}
function updateReferenceOverlay() {
  const opacity = Number($('reference-opacity').value) / 100;
  const scale = Number($('reference-zoom').value) / 100;
  const x = Number($('reference-x').value);
  const y = Number($('reference-y').value);
  referenceOverlay.style.opacity = String(opacity);
  referenceOverlay.style.transform = `translate(calc(-50% + ${x}%), calc(-50% + ${y}%)) scale(${scale})`;
}
function updateReferencePanel() {
    const enabled = ['at-kafasi', 'organik-at-kafasi-v4'].includes($('examples').value);
  $('reference-panel').hidden = !enabled;
  if (!enabled) {
    referenceOverlay.hidden = true;
    $('reference-overlay-toggle').setAttribute('aria-pressed', 'false');
  }
}
const scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(36, 1, 0.1, 10000);
camera.up.set(0, 0, 1);
const initialViewport = viewport.getBoundingClientRect();
camera.aspect = initialViewport.width / Math.max(initialViewport.height, 1);
camera.updateProjectionMatrix();
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.localClippingEnabled = true;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.appendChild(renderer.domElement);
let controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
let projectionMode = 'perspective';
scene.add(new THREE.HemisphereLight(0xffffff, 0x829277, 2.5));
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.position.set(70, -80, 130);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xe1eacf, 1.5);
fill.position.set(-80, 40, 50);
scene.add(fill);
const grid = new THREE.GridHelper(250, 25, 0xbfcbb3, 0xd5ddcc);
grid.rotation.x = Math.PI / 2;
grid.position.z = -0.08;
scene.add(grid);
let bounds = new THREE.Box3(new THREE.Vector3(-40, -25, 0), new THREE.Vector3(40, 25, 25));
const sectionPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
function makeMeshMaterial() {
  const clippingPlanes = sectionEnabled ? [sectionPlane] : [];
  return normalMode
    ? new THREE.MeshNormalMaterial({ wireframe: wire, clippingPlanes })
    : new THREE.MeshStandardMaterial({ color: 0xb7c997, roughness: .43, metalness: .08, wireframe: wire, clippingPlanes });
}
function updateSection() {
  const position = Number($('section-position').value) / 100;
  const x = bounds.min.x + (bounds.max.x - bounds.min.x) * position;
  sectionPlane.constant = -x;
  if (mesh) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
    material.clippingPlanes = sectionEnabled ? [sectionPlane] : [];
    material.needsUpdate = true;
  }
}
function frame(view = $('view-select')?.value || 'iso', sizeOverride = null, boundsOverride = null) {
  const fitBounds = boundsOverride || bounds;
  const actualRect = viewport.getBoundingClientRect();
  const rect = sizeOverride ? { ...actualRect, ...sizeOverride } : actualRect;
  if (rect.width > 0 && rect.height > 0) {
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
  }
  const center = fitBounds.getCenter(new THREE.Vector3());
  const size = fitBounds.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z, 1);
  const sphere = fitBounds.getBoundingSphere(new THREE.Sphere());
  const fitRadius = Math.max(sphere.radius, span / 2);
  let distance = fitRadius * 4;
  if (projectionMode === 'perspective') {
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(camera.aspect, .01));
    const limitingFov = Math.min(verticalFov, horizontalFov);
    distance = fitRadius * 1.15 / Math.sin(limitingFov / 2);
  }
  const horseExamples = ['at-kafasi', 'at-kafasi-v2', 'organik-at-kafasi-v3', 'organik-at-kafasi-v4'];
  const directions = horseExamples.includes(activeExample)
    ? { iso: [1, -1.5, 1.1], front: [1, 0, 0], back: [-1, 0, 0], right: [0, 1, 0], left: [0, -1, 0], top: [0, 0, 1] }
    : { iso: [1, -1.5, 1.1], front: [0, -1, 0], back: [0, 1, 0], right: [1, 0, 0], left: [-1, 0, 0], top: [0, 0, 1] };
  const direction = new THREE.Vector3(...(directions[view] || directions.iso)).normalize();
  camera.up.set(0, 0, 1);
  if (view === 'top') camera.up.set(0, 1, 0);
  const corners = [];
  for (const x of [fitBounds.min.x, fitBounds.max.x]) for (const y of [fitBounds.min.y, fitBounds.max.y]) for (const z of [fitBounds.min.z, fitBounds.max.z]) corners.push(new THREE.Vector3(x, y, z));
  // 20.10: model ekranin ~%75'ini doldursun (once yarisini dolduruyordu, at kafasi izgarada kayboluyordu); kenarda ~%10 pay
  const fitTarget = { spanNdc: 1.5, halfNdc: 0.8 };
  let projected = { width: 0, height: 0, maxX: 0, maxY: 0 };
  let orthoHeight = fitRadius * 4;
  if (projectionMode === 'orthographic') {
    camera.position.copy(center).addScaledVector(direction, distance);
    camera.lookAt(center);
    camera.updateMatrixWorld(true);
    const viewPoints = corners.map(corner => corner.clone().applyMatrix4(camera.matrixWorldInverse));
    const projectedWidth = Math.max(...viewPoints.map(p => p.x)) - Math.min(...viewPoints.map(p => p.x));
    const projectedHeight = Math.max(...viewPoints.map(p => p.y)) - Math.min(...viewPoints.map(p => p.y));
    orthoHeight = referenceOverlayFit ? Math.max(referenceOverlayFit.height*referenceOverlayFit.mmPerPx,referenceOverlayFit.width*referenceOverlayFit.mmPerPx/Math.max(camera.aspect,.01)) : Math.max(projectedHeight, projectedWidth / Math.max(camera.aspect, .01)) * 2.02;
  }
  for (let i = 0; i < 8; i++) {
    camera.position.copy(center).addScaledVector(direction, distance);
    camera.near = Math.max(distance / 1000, .01);
    camera.far = distance * 10;
    if (projectionMode === 'orthographic') {
      const halfHeight = orthoHeight / 2, halfWidth = halfHeight * Math.max(camera.aspect, .01);
      camera.left = -halfWidth; camera.right = halfWidth; camera.top = halfHeight; camera.bottom = -halfHeight;
    }
    camera.updateProjectionMatrix();
    camera.lookAt(center);
    camera.updateMatrixWorld(true);
    const points = corners.map(corner => corner.clone().project(camera));
    projected = {
      width: Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)),
      height: Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y)),
      maxX: Math.max(...points.map(p => Math.abs(p.x))),
      maxY: Math.max(...points.map(p => Math.abs(p.y)))
    };
    if (projected.width <= fitTarget.spanNdc && projected.height <= fitTarget.spanNdc && projected.maxX <= fitTarget.halfNdc && projected.maxY <= fitTarget.halfNdc) break;
    const correction = Math.max(projected.width / fitTarget.spanNdc, projected.height / fitTarget.spanNdc, projected.maxX / fitTarget.halfNdc, projected.maxY / fitTarget.halfNdc) * 1.025;
    if (projectionMode === 'orthographic') orthoHeight *= correction;
    else distance *= correction;
  }
  controls.target.copy(center);
  controls.enableDamping = false;
  controls.update();
  controls.enableDamping = true;
  controls.saveState();
  $('status').dataset.cameraFit = `viewport=${Math.round(rect.width)}x${Math.round(rect.height)}; bbox=${Math.round(projected.width * rect.width / 2)}x${Math.round(projected.height * rect.height / 2)}px; max=${(Math.max(projected.maxX, projected.maxY) * 100).toFixed(1)}%`;
  grid.scale.setScalar(span / 80);
  grid.position.set(center.x, center.y, fitBounds.min.z - span * .002);
}
new ResizeObserver(() => {
  const { width, height } = viewport.getBoundingClientRect();
  renderer.setSize(width, height);
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
  if (mesh) frame();
}).observe(viewport);
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
frame();

function updateModeControls() {
  quality.disabled = mode.value !== 'organic';
  cadMeshQuality.disabled = mode.value !== 'cad';
  try {
    localStorage.setItem('kodla3d:mode', mode.value);
    localStorage.setItem('kodla3d:quality', quality.value);
    localStorage.setItem('kodla3d:cad-mesh-quality', cadMeshQuality.value);
  } catch {}
}
const codeKeywords = new Set(['const','let','var','return','function','if','else','for','while','new','throw','try','catch','true','false','null','undefined','async','await','class','this']);
function escapeHtml(value) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
function highlightLine(line, state) {
  let html = '', i = 0;
  const add = (text, kind = '') => { html += kind ? `<span class="tok-${kind}">${escapeHtml(text)}</span>` : escapeHtml(text); };
  while (i < line.length) {
    if (state.blockComment) {
      const close = line.indexOf('*/', i);
      const end = close < 0 ? line.length : close + 2;
      add(line.slice(i, end), 'comment'); i = end; state.blockComment = close < 0; continue;
    }
    if (line.startsWith('//', i)) { add(line.slice(i), 'comment'); break; }
    if (line.startsWith('/*', i)) {
      const close = line.indexOf('*/', i + 2); const end = close < 0 ? line.length : close + 2;
      add(line.slice(i, end), 'comment'); i = end; state.blockComment = close < 0; continue;
    }
    const char = line[i];
    if (char === '"' || char === "'" || char === '`') {
      let end = i + 1;
      while (end < line.length) { if (line[end] === '\\') end += 2; else if (line[end++] === char) break; }
      add(line.slice(i, Math.min(end, line.length)), 'string'); i = Math.min(end, line.length); continue;
    }
    const number = line.slice(i).match(/^(?:0[xX][\da-fA-F_]+|0[bB][01_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?[\d_]+)?n?)/);
    if (number) { add(number[0], 'number'); i += number[0].length; continue; }
    const word = line.slice(i).match(/^[\p{L}_$][\p{L}\p{N}_$]*/u);
    if (word) { const value = word[0]; add(value, codeKeywords.has(value) ? 'keyword' : ''); i += value.length; continue; }
    add(char, /[=+*/%<>!&|?:.-]/.test(char) ? 'operator' : ''); i++;
  }
  return html || '&nbsp;';
}
function renderCodeOverlay() {
  const state = { blockComment: false };
  const sourceLines = code.value.split('\n');
  $('lines').innerHTML = sourceLines.map((_, index) => `<span class="line-number${errorLine === index + 1 ? ' error-line-number' : ''}">${index + 1}</span>`).join('\n');
  $('highlight').innerHTML = sourceLines.map((line, index) => `<span class="code-line${errorLine === index + 1 ? ' error-code-line' : ''}">${highlightLine(line, state)}</span>`).join('\n') + '\n';
  updateSearchCount();
}
function updateSearchCount() {
  const query = $('editor-search').value;
  if (!query) { $('search-count').textContent = ''; return; }
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const count = (code.value.match(new RegExp(escaped, 'gi')) || []).length;
  $('search-count').textContent = count ? `${count} eşleşme` : 'Eşleşme yok';
}
function sourceLineFromError(error) {
  if (Number.isInteger(error?.sourceLine) && error.sourceLine > 0 && error.sourceLine <= code.value.split('\n').length) return error.sourceLine;
  const details = `${error?.detail || ''}\n${error?.stack || ''}`;
  const candidates = [...details.matchAll(/<anonymous>:(\d+):(\d+)/g)].map(match => Number(match[1]) - 2).filter(line => line > 0 && line <= code.value.split('\n').length);
  return candidates.at(-1) ?? null;
}
function updateEditor() {
  renderCodeOverlay();
  const parameterKey = JSON.stringify(parameterSchema ? activeParameters : {});
  const parametersMatch = builtParameters !== null && parameterKey === builtParameters;
  const dirty = builtCode !== null && (code.value !== builtCode || !parametersMatch || mode.value !== builtMode || (mode.value === 'organic' && quality.value !== builtQuality) || (mode.value === 'cad' && cadMeshQuality.value !== builtCadMeshQuality));
  $('dirty').textContent = dirty ? '• değiştirildi' : '';
  const currentResult = files && code.value === builtCode && parametersMatch && mode.value === builtMode && (mode.value !== 'organic' || quality.value === builtQuality) && (mode.value !== 'cad' || cadMeshQuality.value === builtCadMeshQuality);
  $('editor-state').textContent = building ? 'Üretimde…' : currentResult ? 'Çıktı güncel' : lastBuildFailed && code.value === failedCode ? `Hata${errorLine ? ` · satır ${errorLine}` : ''}` : dirty ? 'Kod değişti' : 'Kod hazır';
  $('preview-state').hidden = !mesh || Boolean(currentResult);
  if ($('preview-state').hidden === false) $('preview-state').textContent = lastBuildFailed ? `Önceki sonuç${errorLine ? ` · hata satır ${errorLine}` : ''} · indirme kapalı` : 'Önceki sonuç · kod değişti · indirme kapalı';
  document.querySelectorAll('[data-format]').forEach(b => {
    const format = b.dataset.format;
    const available = format === 'glb' ? builtGeometryType === 'organic' : Boolean(files?.[format]);
    b.disabled = !currentResult || !available || building;
    if (format === 'step') b.title = mode.value === 'organic' ? 'Organik üçgen mesh kaynağından parametrik STEP üretilemez.' : '';
  });
  try { localStorage.setItem('kodla3d:source:js', code.value); } catch {}
  try { if (activeExample) localStorage.setItem('kodla3d:example', activeExample); } catch {}
  updateProjectState();
}
function renderMeshReport(report) {
  const panel = $('mesh-report');
  if (!report) { panel.hidden = true; return; }
  const topology = report.topology;
  const parts = [`${report.triangles.toLocaleString('tr-TR')} üçgen`];
  if (report.bounds?.size) parts.push(`${report.bounds.size.map(value => value.toFixed(2)).join(' × ')} mm`);
  if (topology) parts.push(`${topology.connectedComponents.length} bağlı yüzey`, `${topology.boundaryEdges} açık kenar`, `${topology.nonManifoldEdges} non-manifold kenar`);
  const repair = report.repair?.removedDegenerateTriangles || 0;
  parts.push(repair ? `${repair} bozuk üçgen atıldı` : 'otomatik değişiklik yok');
  parts.push('self-intersection kontrol edilmedi', 'yazıcı profili olmadan baskıya hazır garantisi yok');
  $('mesh-report-summary').textContent = parts.join(' · ');
  $('mesh-report-detail').textContent = JSON.stringify(report, null, 2);
  panel.hidden = false;
}
function renderParameterControls(schema, values = {}) {
  parameterSchema = schema?.schemaVersion === 1 && Array.isArray(schema.parameters) ? schema : null;
  activeParameters = {};
  const panel = $('parameters-panel');
  const fieldset = $('parameter-controls');
  fieldset.replaceChildren();
  panel.hidden = !parameterSchema;
  if (!parameterSchema) { $('parameter-state').textContent = 'Bu örnekte şemalı parametre yok.'; return; }
  for (const definition of parameterSchema.parameters) {
    if (!['number', 'angle', 'boolean', 'enum'].includes(definition.type)) continue;
    const value = values[definition.id] ?? definition.default;
    activeParameters[definition.id] = value;
    const label = document.createElement('label'); label.className = 'parameter-control';
    const title = document.createElement('span'); title.textContent = definition.label;
    let input, readout;
    if (definition.type === 'boolean') {
      input = document.createElement('input'); input.type = 'checkbox'; input.checked = value; input.dataset.parameterId = definition.id; input.setAttribute('aria-label', definition.label);
      readout = document.createElement('output'); readout.textContent = value ? 'Açık' : 'Kapalı';
    } else if (definition.type === 'enum') {
      input = document.createElement('select'); input.dataset.parameterId = definition.id; input.setAttribute('aria-label', definition.label);
      for (const optionValue of definition.options || []) { const option = document.createElement('option'); option.value = optionValue; option.textContent = definition.labels?.[optionValue] || optionValue; input.append(option); }
      input.value = value; readout = document.createElement('output'); readout.textContent = definition.labels?.[value] || value;
    } else {
      if (!Number.isFinite(definition.min) || !Number.isFinite(definition.max) || !Number.isFinite(definition.step) || definition.step <= 0 || definition.min > definition.max) continue;
      input = document.createElement('input'); input.type = 'range'; input.min = String(definition.min); input.max = String(definition.max); input.step = String(definition.step); input.value = String(value); input.dataset.parameterId = definition.id; input.setAttribute('aria-label', `${definition.label} (${definition.unit || '°'})`);
      readout = document.createElement('output'); readout.textContent = `${value} ${definition.unit || '°'}`;
    }
    const change = () => {
      const next = definition.type === 'boolean' ? input.checked : definition.type === 'enum' ? input.value : Number(input.value);
      activeParameters[definition.id] = next;
      readout.textContent = definition.type === 'boolean' ? (next ? 'Açık' : 'Kapalı') : definition.type === 'enum' ? (definition.labels?.[next] || next) : `${next} ${definition.unit || '°'}`;
      $('parameter-state').textContent = 'Parametre değişti · yeni model henüz üretilmedi.';
      updateEditor();
      clearTimeout(parameterTimer);
      if (!previewOnly) parameterTimer = setTimeout(() => build(), 700);
    };
    input.addEventListener(definition.type === 'number' || definition.type === 'angle' ? 'input' : 'change', change);
    label.append(title, input, readout); fieldset.appendChild(label);
  }
  $('parameter-state').textContent = 'Şema doğrulamalı değerler kullanılıyor.';
}
function projectReferences() { if(!referenceItems.length&&activeExample==='at-kafasi')return [{path:'outputs/at-kafasi/referans.jpg',sha256:'3721DA1B7B7A641333BBB6607864E5DED8A959E3F44B924B998CCA9AEBEB4E52',attribution:'Doğukan tarafından sağlanan yerel referans; lisans kaydı yok.'}];return referenceItems.map((item,index)=>({path:`references/${index+1}-${item.name.replace(/[^\w.-]+/g,'-')}`,data:item.data,camera:item.camera,measurements:{genislikMm:item.widthMm||undefined,yukseklikMm:item.heightMm||undefined,derinlikMm:item.depthMm||undefined,aciDeg:item.angleDeg||undefined},mask:item.mask,polygon:item.polygon||[],imageWidth:item.imageWidth,imageHeight:item.imageHeight,pdfPage:item.pdfPage,pdfPageCount:item.pdfPageCount,sourceFormat:item.pdfFile?'pdf':undefined,attribution:'Kullanıcının bu cihazda seçtiği yerel referans.'})); }
function renderReferenceItems() {
  const host=$('reference-items');host.replaceChildren();
  if(!referenceItems.length){host.innerHTML='<p>Ön, yan veya üst fotoğraf ekle. Tek fotoğraftan derinlik belirlenemez.</p>';return;}
  referenceItems.forEach((item,index)=>{const card=document.createElement('article');card.className='reference-item';card.innerHTML=`<canvas class="reference-mask-canvas" aria-label="${index+1}. referans maskesi; kontur noktaları eklemek için nesnenin çevresine tıkla"></canvas><small class="polygon-help">Elle kapalı poligon: nesnenin çevresine tıkla (${item.polygon?.length||0} nokta; en az 3). Fotoğraf göndermeden yerelde kalır.</small>${item.pdfFile?`<label>PDF sayfası (1–${item.pdfPageCount||'…'})<input data-pdf-page type="number" min="1" max="${item.pdfPageCount||1}" value="${item.pdfPage||1}"></label><button type="button" data-render-page>PDF sayfasını uygula</button>`:''}<label>Görünüş<select data-field="camera"><option value="front">Ön</option><option value="side">Yan</option><option value="top">Üst</option></select></label><label>Girdi<select data-field="mask"><option value="false">Fotoğraf · köşe rengi</option><option value="true">Hazır siyah/beyaz maske</option></select></label><label>Genişlik mm<input data-field="widthMm" type="number" min="0.01" step="0.1"></label><label>Yükseklik mm<input data-field="heightMm" type="number" min="0.01" step="0.1"></label><label>Derinlik mm<input data-field="depthMm" type="number" min="0.01" step="0.1"></label><label>Açı °<input data-field="angleDeg" type="number" step="0.1"></label><button type="button" data-clear>Poligonu temizle</button><button type="button" data-remove="${index}">Görünüşü kaldır</button>`;
    const canvas=card.querySelector('canvas'),ctx=canvas.getContext('2d'),image=new Image();const draw=()=>{if(!canvas.width||!canvas.height)return;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);const points=item.polygon||[];if(points.length){ctx.strokeStyle='#19a777';ctx.fillStyle='#e34b42';ctx.lineWidth=Math.max(2,canvas.width/320);ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));if(points.length>=3){ctx.closePath();ctx.fillStyle='rgba(25,167,119,.18)';ctx.fill();}ctx.stroke();for(const [x,y] of points){ctx.beginPath();ctx.arc(x,y,Math.max(3,canvas.width/100),0,Math.PI*2);ctx.fillStyle='#e34b42';ctx.fill();}}card.querySelector('.polygon-help').textContent=`Elle kapalı poligon: nesnenin çevresine tıkla (${points.length} nokta; en az 3). ${points.length>=3?'Karşılaştırmada bu maske kullanılır.':'Fotoğraftan otomatik köşe rengi kullanılabilir.'}`;};
    image.onload=()=>{item.imageWidth=image.naturalWidth;item.imageHeight=image.naturalHeight;canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;draw();};image.src=item.data;canvas.addEventListener('click',event=>{if(!canvas.width)return;const rect=canvas.getBoundingClientRect();item.polygon||=[];item.polygon.push([(event.clientX-rect.left)*canvas.width/rect.width,(event.clientY-rect.top)*canvas.height/rect.height]);draw();updateProjectState();});card.querySelector('[data-clear]').addEventListener('click',()=>{item.polygon=[];draw();updateProjectState();});
    if(item.pdfFile)card.querySelector('[data-render-page]').addEventListener('click',async()=>{const page=Number(card.querySelector('[data-pdf-page]').value);try{card.querySelector('[data-render-page]').disabled=true;await renderPdfReferencePage(item,page);renderReferenceItems();updateProjectState();}catch(error){$('project-state').textContent=`${item.name}: ${error.message}`;}finally{card.querySelector('[data-render-page]')?.removeAttribute('disabled');}});
    for(const el of card.querySelectorAll('[data-field]')){const field=el.dataset.field;el.value=String(item[field]??(field==='camera'?'front':field==='mask'?false:''));el.addEventListener('change',()=>{item[field]=field==='mask'?el.value==='true':field==='camera'?el.value:(el.value===''?undefined:Number(el.value));updateReferenceWarning();updateProjectState();});}card.querySelector('[data-remove]').addEventListener('click',()=>{referenceItems.splice(index,1);renderReferenceItems();updateReferenceWarning();updateProjectState();});host.append(card);});
}
function updateReferenceWarning(){const depthKnown=referenceItems.some(item=>item.depthMm>0),views=new Set(referenceItems.map(item=>item.camera));$('reference-depth-warning').textContent=`${!depthKnown&&!views.has('side')&&!views.has('top')?'Derinlik ölçüsü veya ikinci görünüş yok; model derinlik tahmini taşır. ':''}Montajlı parçalarda kumpas/müşteri ölçüsü olmadan milimetrik oturma garantisi yok.`;}
function mountingHoleData(){return $('mounting-holes').value.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map((line,index)=>{const values=line.split(/[;,\s]+/).map(Number);if(values.length!==3||!values.every(Number.isFinite)||values[2]<=0)throw new Error(`Montaj deliği ${index+1}: x,y,çap mm girin.`);return {x:values[0],y:values[1],cap:values[2]};});}
function toReferenceInput(item){if(item.polygon?.length>=3)return {poligon:{width:item.imageWidth,height:item.imageHeight,noktalar:item.polygon}};return item.mask?{maske:item.data}:{gorsel:item.data,anahtar:{esik:48}};}
async function renderPdfReferencePage(item,page){if(!Number.isInteger(page)||page<1||page>(item.pdfPageCount||1))throw new Error(`PDF sayfası 1 ile ${item.pdfPageCount||1} arasında olmalı.`);const response=await fetch(`/api/reference/pdf-page?page=${page}`,{method:'POST',headers:{'Content-Type':'application/pdf'},body:item.pdfFile});if(!response.ok){const error=await response.json();throw new Error(error.error||'PDF sayfası çevrilemedi.');}const blob=await response.blob();item.data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});item.pdfPage=Number(response.headers.get('X-PDF-Page'))||page;item.pdfPageCount=Number(response.headers.get('X-PDF-Page-Count'))||item.pdfPageCount;item.name=`${item.pdfName}-sayfa-${item.pdfPage}.png`;item.polygon=[];item.mask=false;}
function referenceCamera(view,example=activeExample){if(['at-kafasi','at-kafasi-v2','organik-at-kafasi-v3','organik-at-kafasi-v4'].includes(example))return view==='side'?'right':view;return view==='front'?{direction:[0,-1,0],up:[0,0,1]}:view==='side'?{direction:[1,0,0],up:[0,0,1]}:{direction:[0,0,1],up:[0,1,0]};}
async function collectReferenceBrief(){
  if(!referenceItems.length)return undefined;
  const konturlar={};
  for(const item of referenceItems){const yon={front:'on',side:'yan',top:'ust'}[item.camera],input={referans:toReferenceInput(item),yon,toleransMm:.5,olcek:item.widthMm?{genislikMm:item.widthMm}:item.heightMm?{yukseklikMm:item.heightMm}:undefined};const response=await fetch('/api/reference/contour',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const result=await response.json();if(response.ok)konturlar[yon]=result;}
  return {gorunusler:referenceItems.map(({camera,widthMm,heightMm,depthMm,angleDeg})=>({camera,widthMm,heightMm,depthMm,angleDeg})),montajDelikleri:mountingHoleData(),konturlar,derinlikTahmini:!referenceItems.some(item=>item.depthMm>0)&&referenceItems.length<2};
}
function currentProjectSnapshot() {
  const references = projectReferences();
  return JSON.stringify({ name: $('project-name').value, model: { source: code.value, mode: mode.value, quality: quality.value, cadMeshQuality: cadMeshQuality.value, example: activeExample || null, parameters: parameterSchema ? activeParameters : {}, referenceBrief:{mountingHolesText:$('mounting-holes').value} }, view: { camera: $('view-select').value, projection: $('projection-select').value }, references, versions: projectFileSaved ? successfulVersions : [] });
}
function updateProjectState() {
  const snapshot = currentProjectSnapshot();
  const dirty = savedProjectSnapshot !== null && snapshot !== savedProjectSnapshot;
  $('project-state').textContent = dirty ? 'Kaydedilmemiş proje değişikliği var.' : projectFileSaved ? 'Proje dosyasıyla eşleşiyor.' : 'Yerel çalışma; proje dosyası henüz indirilmedi.';
  $('project-state').dataset.dirty = String(dirty);
}
function projectDocument() {
  const now = new Date().toISOString();
  const name = $('project-name').value.trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').replace(/\s+/g, '-').slice(0, 64) || 'tasarim';
  return {
    format: 'kodla3d-project', projectVersion: 1,
    metadata: { name, savedAt: now },
    model: { source: code.value, mode: mode.value, quality: quality.value, cadMeshQuality: cadMeshQuality.value, example: activeExample || null, parameters: parameterSchema ? { ...activeParameters } : {}, referenceBrief:{montajDelikleri:mountingHoleData()} },
    references: projectReferences(),
    engine: { cad: 'Replicad / OpenCascade WASM 1.1.0', organic: 'Manifold SDF 3.5.4', apiVersion: 1, resultSchemaVersion: 1 },
    view: { camera: $('view-select').value, projection: $('projection-select').value },
    versions: successfulVersions
  };
}
function renderVersionControls() {
  const select = $('version-list');
  select.replaceChildren();
  for (const version of successfulVersions) {
    const option = document.createElement('option');
    option.value = version.id;
    option.textContent = version.label;
    select.appendChild(option);
  }
  $('version-panel').hidden = successfulVersions.length === 0;
  select.disabled = successfulVersions.length === 0;
  $('version-restore').disabled = successfulVersions.length === 0;
  $('version-state').textContent = successfulVersions.length ? `${successfulVersions.length} başarılı sürüm · proje dosyasına kaydedilir.` : 'Sürümler proje dosyasına kaydedilir.';
}
function rememberSuccessfulVersion(result, buildState) {
  const model = { source: buildState.source, mode: buildState.mode, quality: buildState.quality, cadMeshQuality: buildState.cadMeshQuality, example: buildState.example || null, parameters: buildState.parameters };
  const id = JSON.stringify(model);
  if (successfulVersions[0]?.id === id) return;
  const label = `${new Date().toLocaleString('tr-TR')} · ${result.size.map(value => value.toFixed(1)).join('×')} mm · ${(result.volume / 1000).toFixed(2)} cm³`;
  successfulVersions.unshift({ id, savedAt: new Date().toISOString(), label, model, result: { sourceHash: result.sourceHash, size: result.size, volume: result.volume } });
  successfulVersions = successfulVersions.slice(0, 10);
  while (successfulVersions.length > 1 && new TextEncoder().encode(JSON.stringify(successfulVersions)).length > 700_000) successfulVersions.pop();
  renderVersionControls();
  updateProjectState();
}
function restoreSuccessfulVersion() {
  const version = successfulVersions.find(item => item.id === $('version-list').value);
  if (!version) return;
  const dirty = savedProjectSnapshot !== null && currentProjectSnapshot() !== savedProjectSnapshot;
  if (dirty && !confirm('Kaydedilmemiş proje değişiklikleri var. Seçilen başarılı sürüm açılsın mı?')) return;
  const sample = samples.find(item => item.name === version.model.example);
  activeExample = sample?.name || '';
  $('examples').value = activeExample;
  mode.value = version.model.mode;
  quality.value = version.model.quality;
  cadMeshQuality.value = version.model.cadMeshQuality || 'normal';
  renderParameterControls(sample?.parameterSchema, version.model.parameters);
  code.value = version.model.source;
  updateReferencePanel();
  updateModeControls();
  files = null;
  $('status').textContent = 'Başarılı sürüm açıldı · aynı geometriyi yeniden üretmek için Modeli üret.';
  $('metrics').textContent = 'Önceki üretimin ölçüleri geçmişte saklıdır; indirme kapalıdır.';
  updateEditor();
}
function createCADPreview(result, buffer) {
  const meta = result.previewMesh;
  const positions = new Float32Array(buffer, 0, meta.vertices);
  const normals = new Float32Array(buffer, meta.vertices * 4, meta.vertices);
  const indexOffset = meta.vertices * 8;
  const indices = new Uint32Array(buffer, indexOffset, meta.indices);
  const groups = new Int32Array(buffer, indexOffset + meta.indices * 4, meta.groups * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  const ownerSets = new Map(), triangleSources = Array(meta.indices / 3).fill(null);
  for (let i = 0; i < groups.length; i += 3) {
    const start = groups[i], count = groups[i + 1], faceId = String(groups[i + 2]);
    const owners = [...new Set(result.faceSources?.[faceId] || [])].sort();
    const key = JSON.stringify(owners);
    if (!ownerSets.has(key)) ownerSets.set(key, owners);
    const materialIndex = [...ownerSets.keys()].indexOf(key);
    geometry.addGroup(start, count, materialIndex);
    for (let triangle = start / 3; triangle < (start + count) / 3; triangle++) triangleSources[triangle] = owners;
  }
  const palette = [0xb7c997, 0xc5a88b, 0xa8bac4, 0xc5bccb, 0xd3bc83, 0xa7c2ad, 0xd2a19b, 0x9eb8c9];
  const materials = [...ownerSets.values()].map((owners, index) => normalMode
    ? new THREE.MeshNormalMaterial({ wireframe: wire, clippingPlanes: sectionEnabled ? [sectionPlane] : [] })
    : new THREE.MeshStandardMaterial({ color: palette[index % palette.length], roughness: .43, metalness: .08, wireframe: wire, clippingPlanes: sectionEnabled ? [sectionPlane] : [] }));
  materials.forEach((material, index) => { material.userData.partOwnerIds = [...ownerSets.values()][index]; material.userData.baseColor = palette[index % palette.length]; });
  geometry.computeBoundingBox();
  return { geometry, materials, triangleSources };
}
function partIsVisible(id) {
  let part = partRecords.get(id), visited = new Set();
  while (part && !visited.has(part.id)) {
    visited.add(part.id);
    if (partVisibility.get(part.id) === false) return false;
    part = partRecords.get(part.groupId);
  }
  return true;
}
function updatePartVisuals() {
  if (!mesh || !Array.isArray(mesh.material)) return;
  for (const material of mesh.material) {
    const owners = material.userData.partOwnerIds || [];
    material.visible = isolatedPartId
      ? owners.some(id => partDescendants.get(isolatedPartId)?.has(id))
      : owners.some(partIsVisible);
    const selectedIds = selectedPartId ? partDescendants.get(selectedPartId) : null;
    material.color.set(selectedIds && owners.some(id => selectedIds.has(id)) ? 0xe0a464 : material.userData.baseColor);
  }
  $('part-tree').querySelectorAll('.part-visibility').forEach(button => {
    const visible = partVisibility.get(button.dataset.partId) !== false;
    button.textContent = visible ? 'Gizle' : 'Göster'; button.setAttribute('aria-pressed', String(visible));
  });
  $('part-tree').querySelectorAll('.part-isolate').forEach(button => {
    const active = isolatedPartId === button.dataset.partId;
    button.textContent = active ? 'Birleşik' : 'İzole'; button.setAttribute('aria-pressed', String(active));
  });
}
function showPartDetails(part) {
  if (!part) return;
  selectedPartId = part.id;
  const tree = $('part-tree');
  tree.querySelectorAll('.part-node').forEach(button => button.setAttribute('aria-selected', String(button.dataset.partId === part.id)));
  $('part-empty').hidden = true;
  const info = $('part-info');
  info.hidden = false;
  info.replaceChildren();
  const title = document.createElement('h3');
  title.textContent = part.name || part.id;
  info.appendChild(title);
  const rows = [
    ['Tür', part.type || 'parça'], ['Kimlik', part.id],
    ['Kaynak parça', part.sourceId || '—'], ['Grup', part.groupId || '—'],
    ['Durum', `${partVisibility.get(part.id) === false ? 'gizli' : 'görünür'} · ${part.locked ? 'kilitli' : 'kilitsiz'}`],
    ['Sınır kutusu', part.bounds ? `${part.bounds.min.map(v => v.toFixed(2)).join(', ')} → ${part.bounds.max.map(v => v.toFixed(2)).join(', ')} mm` : 'ölçülmedi']
  ];
  const metadata = document.createElement('dl');
  metadata.className = 'part-meta';
  for (const [label, value] of rows) {
    const term = document.createElement('dt'); term.textContent = label;
    const detail = document.createElement('dd'); detail.textContent = value;
    metadata.append(term, detail);
  }
  info.appendChild(metadata);
  const section = (label, value) => {
    const heading = document.createElement('strong'); heading.textContent = label;
    const pre = document.createElement('pre'); pre.className = 'part-ops'; pre.textContent = JSON.stringify(value ?? {}, null, 2);
    info.append(heading, pre);
  };
  section('Başlangıç parametreleri', part.parameters);
  if (part.transforms?.length) section('Dönüşümler', part.transforms);
  if (part.operations?.length) section('Sonraki işlemler', part.operations);
  const sourceIndex = code.value.indexOf(`'${part.id}'`) >= 0 ? code.value.indexOf(`'${part.id}'`) : code.value.indexOf(`"${part.id}"`);
  const mappedIndex = sourceIndex >= 0 ? sourceIndex : code.value.indexOf(part.name || part.id);
  const source = document.createElement('button');
  source.className = 'quiet part-source';
  source.textContent = mappedIndex >= 0 ? 'Kaynak kodda bul' : 'Kaynakta doğrudan eşleşme yok';
  source.disabled = mappedIndex < 0;
  source.addEventListener('click', () => {
    code.focus(); code.setSelectionRange(mappedIndex, mappedIndex + (sourceIndex >= 0 ? part.id.length : (part.name || part.id).length));
    const line = code.value.slice(0, mappedIndex).split('\n').length;
    code.scrollTop = Math.max(0, (line - 2) * 24);
  });
  info.appendChild(source);
  updatePartVisuals();
}
function renderParts(parts, faceSources = null) {
  const panel = $('parts-panel');
  const tree = $('part-tree');
  tree.replaceChildren();
  panel.hidden = !parts?.length;
  $('parts-count').textContent = parts?.length ? `${parts.length} düğüm` : '';
  $('part-info').hidden = true;
  $('part-info').replaceChildren();
  $('part-empty').hidden = false;
  partRecords = new Map((parts || []).map(part => [part.id, part]));
  partVisibility = new Map((parts || []).map(part => [part.id, part.visible !== false]));
  selectedPartId = null; isolatedPartId = null; partDescendants = new Map();
  for (const part of parts || []) {
    const descendants = new Set([part.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const candidate of parts) if (descendants.has(candidate.groupId) && !descendants.has(candidate.id)) { descendants.add(candidate.id); changed = true; }
    }
    partDescendants.set(part.id, descendants);
  }
  if (!parts?.length) return;
  const byId = new Map(parts.map(part => [part.id, part]));
  const pickableIds = new Set(Object.values(faceSources || {}).flat());
  const hasFaceAwareMesh = pickableIds.size > 1;
  const children = new Map();
  for (const part of parts) {
    const parentId = byId.has(part.groupId) && part.groupId !== part.id ? part.groupId : null;
    if (!children.has(parentId)) children.set(parentId, []);
    children.get(parentId).push(part);
  }
  const addNode = (part, level, visited) => {
    if (visited.has(part.id)) return;
    visited.add(part.id);
    const wrap = document.createElement('div'); wrap.className = 'part-row'; wrap.dataset.level = String(Math.min(level, 2));
    const row = document.createElement('button');
    row.type = 'button'; row.className = 'part-node'; row.dataset.partId = part.id;
    row.setAttribute('role', 'treeitem');
    row.setAttribute('aria-level', String(level + 1)); row.setAttribute('aria-selected', 'false');
    const label = document.createElement('span'); label.textContent = part.name || part.id;
    const type = document.createElement('span'); type.className = 'part-node-type'; type.textContent = part.type || 'parça';
    row.append(label, type); row.addEventListener('click', () => showPartDetails(part)); wrap.appendChild(row);
    const canControl = hasFaceAwareMesh && [...(partDescendants.get(part.id) || [])].some(id => pickableIds.has(id));
    if (canControl) {
      const actions = document.createElement('div'); actions.className = 'part-actions';
      const visibility = document.createElement('button'); visibility.type = 'button'; visibility.className = 'quiet part-visibility'; visibility.dataset.partId = part.id; visibility.textContent = 'Gizle'; visibility.setAttribute('aria-label', `${part.name || part.id} görünürlüğünü değiştir`);
      visibility.addEventListener('click', event => { event.stopPropagation(); partVisibility.set(part.id, partVisibility.get(part.id) === false); updatePartVisuals(); if (selectedPartId === part.id) showPartDetails(part); });
      const isolate = document.createElement('button'); isolate.type = 'button'; isolate.className = 'quiet part-isolate'; isolate.dataset.partId = part.id; isolate.textContent = 'İzole'; isolate.setAttribute('aria-label', `${part.name || part.id} parçasını izole et`);
      isolate.addEventListener('click', event => { event.stopPropagation(); isolatedPartId = isolatedPartId === part.id ? null : part.id; showPartDetails(part); });
      const focus = document.createElement('button'); focus.type = 'button'; focus.className = 'quiet part-focus'; focus.textContent = 'Odak'; focus.setAttribute('aria-label', `${part.name || part.id} parçasına odaklan`);
      focus.addEventListener('click', event => { event.stopPropagation(); const box = part.bounds; if (box?.min?.length === 3 && box?.max?.length === 3) frame(undefined, null, new THREE.Box3(new THREE.Vector3(...box.min), new THREE.Vector3(...box.max))); showPartDetails(part); });
      actions.append(visibility, isolate, focus); wrap.appendChild(actions);
    }
    tree.appendChild(wrap);
    for (const child of children.get(part.id) || []) addNode(child, level + 1, visited);
  };
  const visited = new Set();
  for (const root of children.get(null) || []) addNode(root, 0, visited);
  for (const part of parts) addNode(part, 0, visited);
  $('parts-count').textContent = `${parts.length} düğüm · ${tree.querySelectorAll('.part-node').length} gösteriliyor`;
  const first = tree.querySelector('.part-node');
  if (first) showPartDetails(parts.find(part => part.id === first.dataset.partId));
}
let pickStart = null;
const partRaycaster = new THREE.Raycaster();
renderer.domElement.addEventListener('pointerdown', event => { if (event.button === 0) pickStart = [event.clientX, event.clientY]; });
renderer.domElement.addEventListener('pointerup', event => {
  if (!pickStart || event.button !== 0 || !mesh || !partFaceSourcesByTriangle.length) { pickStart = null; return; }
  const moved = Math.hypot(event.clientX - pickStart[0], event.clientY - pickStart[1]); pickStart = null;
  if (moved > 4) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const pointer = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  partRaycaster.setFromCamera(pointer, camera);
  const hit = partRaycaster.intersectObject(mesh, false)[0];
  if (!hit || hit.faceIndex === undefined) return;
  const owners = partFaceSourcesByTriangle[hit.faceIndex] || [];
  const part = owners.map(id => partRecords.get(id)).find(item => item?.type === 'brep') || owners.map(id => partRecords.get(id)).find(Boolean);
  if (part) showPartDetails(part);
});
function updateMeshDisplayMaterials() {
  if (!mesh) return;
  const current = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  if (normalMode) {
    mesh.material = current.map(old => {
      const next = new THREE.MeshNormalMaterial({ wireframe: wire, clippingPlanes: sectionEnabled ? [sectionPlane] : [] });
      next.userData = { ...old.userData }; next.visible = old.visible; old.dispose(); return next;
    });
  } else if (current.every(material => material.isMeshNormalMaterial)) {
    mesh.material = current.map(old => {
      const next = new THREE.MeshStandardMaterial({ color: old.userData.baseColor ?? 0xb7c997, roughness: .43, metalness: .08, wireframe: wire, clippingPlanes: sectionEnabled ? [sectionPlane] : [] });
      next.userData = { ...old.userData }; next.visible = old.visible; old.dispose(); return next;
    });
  } else for (const material of current) { material.wireframe = wire; material.needsUpdate = true; }
  updatePartVisuals();
}
code.addEventListener('input', () => { if (code.value !== failedCode) errorLine = null; updateEditor(); });
$('project-name').addEventListener('input', updateProjectState);
$('reference-files').addEventListener('change',async event=>{
  const files=[...event.target.files||[]];if(referenceItems.length+files.length>3){$('project-state').textContent='En fazla üç görünüş ekleyebilirsin.';event.target.value='';return;}
  for(const file of files){if(file.size>25*1024*1024){$('project-state').textContent=`${file.name}: 25 MiB sınırı gerekli.`;continue;}const isPdf=file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf');if(!isPdf&&!['image/png','image/jpeg'].includes(file.type)){ $('project-state').textContent=`${file.name}: PNG, JPEG veya PDF gerekli.`;continue;}const item={name:file.name,data:'',camera:['front','side','top'][referenceItems.length]||'front',mask:false};if(isPdf){item.pdfFile=file;item.pdfName=file.name.replace(/\.pdf$/i,'');item.pdfPage=1;item.pdfPageCount=1;try{await renderPdfReferencePage(item,1);}catch(error){$('project-state').textContent=`${file.name}: ${error.message}`;continue;}}else item.data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});referenceItems.push(item);}
  event.target.value='';renderReferenceItems();updateReferenceWarning();updateProjectState();
});
$('mounting-holes').addEventListener('input',updateProjectState);
code.addEventListener('scroll', () => {
  $('lines').scrollTop = code.scrollTop;
  $('highlight').style.transform = `translate(${-code.scrollLeft}px, ${-code.scrollTop}px)`;
});
code.addEventListener('keydown', e => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = code.selectionStart, end = code.selectionEnd;
    if (e.shiftKey) {
      const lineStart = code.value.lastIndexOf('\n', start - 1) + 1;
      const selected = code.value.slice(lineStart, end);
      const updated = selected.replace(/^(?: {1,4}|\t)/gm, '');
      code.setRangeText(updated, lineStart, end, 'select');
      const removed = selected.length - updated.length;
      code.setSelectionRange(Math.max(lineStart, start - Math.min(removed, start - lineStart)), Math.max(lineStart, end - removed));
    } else if (start !== end && code.value.slice(start, end).includes('\n')) {
      const lineStart = code.value.lastIndexOf('\n', start - 1) + 1;
      const endLine = code.value.indexOf('\n', end);
      const lineEnd = endLine < 0 ? code.value.length : endLine;
      const selected = code.value.slice(lineStart, lineEnd);
      const updated = selected.replace(/^/gm, '    ');
      code.setRangeText(updated, lineStart, lineEnd, 'select');
      code.setSelectionRange(start + 4, end + 4 * (selected.match(/^/gm) || []).length);
    } else code.setRangeText('    ', start, end, 'end');
    updateEditor();
    return;
  }
  if (e.key === 'Enter' && code.selectionStart === code.selectionEnd) {
    const before = code.value.slice(0, code.selectionStart);
    const line = before.slice(before.lastIndexOf('\n') + 1);
    const indent = line.match(/^\s*/)?.[0] || '';
    const extra = /[{[(]\s*$/.test(line) ? '    ' : '';
    if (indent || extra) {
      e.preventDefault();
      code.setRangeText(`\n${indent}${extra}`, code.selectionStart, code.selectionEnd, 'end');
      code.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
});
function findInCode(direction = 1) {
  const query = $('editor-search').value;
  if (!query) return;
  const source = code.value.toLocaleLowerCase(); const needle = query.toLocaleLowerCase();
  const matches = []; let index = source.indexOf(needle);
  while (index !== -1) { matches.push(index); index = source.indexOf(needle, index + Math.max(needle.length, 1)); }
  updateSearchCount();
  if (!matches.length) return;
  const current = code.selectionStart;
  const target = direction > 0 ? (matches.find(value => value >= current + 1) ?? matches[0]) : ([...matches].reverse().find(value => value < current) ?? matches.at(-1));
  code.focus(); code.setSelectionRange(target, target + query.length);
  const before = code.value.slice(0, target).split('\n').length - 1;
  code.scrollTop = Math.max(0, before * 24 - code.clientHeight / 2);
  $('lines').scrollTop = code.scrollTop;
  $('highlight').style.transform = `translate(${-code.scrollLeft}px, ${-code.scrollTop}px)`;
}
$('editor-search').addEventListener('input', updateSearchCount);
$('editor-search').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); findInCode(e.shiftKey ? -1 : 1); } });
$('search-next').addEventListener('click', () => findInCode(1));
$('search-previous').addEventListener('click', () => findInCode(-1));
$('undo').addEventListener('click', () => { code.focus(); document.execCommand('undo'); updateEditor(); });
$('redo').addEventListener('click', () => { code.focus(); document.execCommand('redo'); updateEditor(); });
function downloadProject() {
  if (code.value.length > 100000) { $('project-state').textContent = 'Kaynak kod 100 KB sınırını aşıyor; proje dosyası indirilmedi.'; return; }
  let documentData;try{documentData=projectDocument();}catch(error){$('project-state').textContent=`Proje kaydedilemedi: ${error.message}`;return;}
  const serialized=JSON.stringify(documentData,null,2);if(serialized.length>40*1024*1024){$('project-state').textContent='Referans görselleriyle proje dosyası 40 MiB sınırını aşıyor.';return;}const blob = new Blob([`${serialized}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = `${documentData.metadata.name}.kodla3d.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  projectFileSaved = true;
  savedProjectSnapshot = currentProjectSnapshot();
  updateProjectState();
}
$('project-save').addEventListener('click', downloadProject);
$('version-list').addEventListener('change', () => { $('version-restore').disabled = !successfulVersions.some(item => item.id === $('version-list').value); });
$('version-restore').addEventListener('click', restoreSuccessfulVersion);
$('project-open').addEventListener('click', () => $('project-file').click());
$('project-file').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (file.size > 40 * 1024 * 1024) { $('project-state').textContent = 'Görselleri içeren proje dosyası 40 MiB sınırını aşıyor.'; return; }
  if (savedProjectSnapshot !== null && currentProjectSnapshot() !== savedProjectSnapshot && !confirm('Kaydedilmemiş proje değişiklikleri var. Açmak istediğin dosyayla değiştirilsin mi?')) return;
  try {
    const parsed = validateProjectDocument(JSON.parse(await file.text()), samples);
    referenceItems=parsed.references.filter(reference=>reference.data).map(reference=>({name:reference.path.split('/').at(-1),data:reference.data,camera:reference.camera||'front',mask:!!reference.mask,polygon:reference.polygon||[],imageWidth:reference.imageWidth,imageHeight:reference.imageHeight,widthMm:reference.measurements?.genislikMm,heightMm:reference.measurements?.yukseklikMm,depthMm:reference.measurements?.derinlikMm,angleDeg:reference.measurements?.aciDeg}));renderReferenceItems();updateReferenceWarning();
    $('mounting-holes').value=(parsed.model.referenceBrief?.montajDelikleri||[]).map(h=>`${h.x}, ${h.y}, ${h.cap}`).join('\n');
    successfulVersions = parsed.versions || [];
    renderVersionControls();
    const sample = samples.find(item => item.name === parsed.model.example);
    activeExample = sample?.name || '';
    $('project-name').value = parsed.metadata?.name || sample?.name || 'tasarim';
    mode.value = parsed.model.mode; quality.value = parsed.model.quality; cadMeshQuality.value = parsed.model.cadMeshQuality || 'normal';
    renderParameterControls(sample?.parameterSchema, parsed.model.parameters);
    if (sample) $('examples').value = sample.name; else $('examples').value = '';
    code.value = parsed.model.source;
    updateReferencePanel();
    updateModeControls();
    $('projection-select').value = parsed.view.projection;
    $('projection-select').dispatchEvent(new Event('change'));
    $('view-select').value = parsed.view.camera;
    $('view-select').dispatchEvent(new Event('change'));
    files = null;
    $('status').textContent = 'Proje açıldı · yeni geometri henüz üretilmedi.';
    $('metrics').textContent = 'Önceki önizleme varsa eski üretim olarak kalır; indirme kapalıdır.';
    updateEditor();
    projectFileSaved = true;
    savedProjectSnapshot = currentProjectSnapshot();
    updateProjectState();
    const assetWarnings = [];
    for (const reference of parsed.references) {
      if(reference.data)continue;
      if (reference.path !== 'outputs/at-kafasi/referans.jpg') { assetWarnings.push(`Proje dosyasında görsel verisi bulunmayan referans yolu: ${reference.path}`); continue; }
      const response = await fetch('/api/reference/at-kafasi');
      if (!response.ok) assetWarnings.push('At kafası referansı bu çalışma alanında bulunamadı.');
      else if (crypto?.subtle && reference.sha256) {
        const bytes = await response.arrayBuffer();
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
        if (hash !== reference.sha256) assetWarnings.push('At kafası referansı bulundu ama dosya hash’i manifest ile eşleşmiyor.');
      }
    }
    const engineKey = parsed.model.mode === 'cad' ? 'cad' : 'organic';
    const engineMismatch = parsed.engine[engineKey] !== projectDocument().engine[engineKey] || parsed.engine.apiVersion !== 1 || parsed.engine.resultSchemaVersion !== 1;
    $('project-state').textContent = assetWarnings.join(' ') || (engineMismatch ? 'Proje açıldı; motor veya API sürümü farklı, yeniden üretim sonucunu kontrol et.' : 'Proje açıldı; geometriyi üretmeden önce kaynağı incele.');
  } catch (error) {
    $('project-state').textContent = `Proje açılamadı: ${error.message}`;
  }
});
window.addEventListener('beforeunload', event => {
  if (savedProjectSnapshot !== null && currentProjectSnapshot() !== savedProjectSnapshot) { event.preventDefault(); event.returnValue = ''; }
});
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); build(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); $('editor-search').focus(); $('editor-search').select(); }
});
$('examples').addEventListener('change', e => {
  if (!e.target.value) return;
  if (savedProjectSnapshot !== null && currentProjectSnapshot() !== savedProjectSnapshot && !confirm('Kaydedilmemiş tasarım değişiklikleri var. Örnek kodla değiştirilsin mi?')) { e.target.value = activeExample; updateReferencePanel(); return; }
  const sample = samples.find(x => x.name === e.target.value);
  activeExample = sample.name;
  $('project-name').value = sample.name;
  renderParameterControls(sample.parameterSchema);
  updateReferencePanel();
  mode.value = sample.mode || 'cad';
  updateModeControls();
  code.value = sample.code;
  updateEditor();
});
$('reference-overlay-toggle').addEventListener('click', () => {
  const enabled = referenceOverlay.hidden;
  referenceOverlay.hidden = !enabled;
  $('reference-overlay-toggle').setAttribute('aria-pressed', String(enabled));
  if (enabled) {
    $('view-select').value = 'left';
    $('projection-select').value = 'orthographic';
    $('projection-select').dispatchEvent(new Event('change'));
    $('view-select').dispatchEvent(new Event('change'));
  }
});
['reference-opacity', 'reference-zoom', 'reference-x', 'reference-y'].forEach(id => $(id).addEventListener('input', updateReferenceOverlay));
updateReferenceOverlay();
mode.addEventListener('change', () => { updateModeControls(); updateEditor(); });
quality.addEventListener('change', () => { updateModeControls(); updateEditor(); });
cadMeshQuality.addEventListener('change', () => { updateModeControls(); updateEditor(); });
$('reset').onclick = () => frame();
$('capture-views').addEventListener('click', async () => {
  if (!mesh || building) return;
  const views = [['front','Ön'],['back','Arka'],['right','Sağ'],['left','Sol'],['top','Üst'],['iso','İzometrik']];
  const tileWidth = 480, tileHeight = 360, labelHeight = 34;
  const sheet = document.createElement('canvas'); sheet.width = tileWidth * 3; sheet.height = (tileHeight + labelHeight) * 2;
  const context = sheet.getContext('2d');
  const originalView = $('view-select').value;
  const originalCamera = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), up: camera.up.clone(), zoom: camera.zoom, target: controls.target.clone() };
  const wasOverlay = referenceOverlay && !referenceOverlay.hidden;
  if (wasOverlay) referenceOverlay.hidden = true;
  $('capture-views').disabled = true;
  $('status').textContent = 'Altı sabit görünüş hazırlanıyor…';
  try {
    for (let index = 0; index < views.length; index++) {
      const [view, label] = views[index];
      frame(view, { width: tileWidth, height: tileHeight });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      renderer.render(scene, camera);
      const x = index % 3 * tileWidth, y = Math.floor(index / 3) * (tileHeight + labelHeight);
      context.fillStyle = '#f4f5ef'; context.fillRect(x, y, tileWidth, tileHeight + labelHeight);
      context.drawImage(renderer.domElement, x, y, tileWidth, tileHeight);
      context.fillStyle = '#26342f'; context.font = '600 16px Segoe UI, Arial'; context.fillText(label, x + 12, y + tileHeight + 23);
    }
    const blob = await new Promise(resolve => sheet.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG dosyası oluşturulamadı.');
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = 'kodla3d-coklu-gorunus.png'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    $('status').textContent = 'Altı görünüşlü PNG indirildi.';
  } catch (error) {
    $('status').textContent = `Görünüş PNG’si oluşturulamadı: ${error.message}`;
  } finally {
    if (wasOverlay) referenceOverlay.hidden = false;
    $('view-select').value = originalView;
    frame(originalView);
    camera.position.copy(originalCamera.position); camera.quaternion.copy(originalCamera.quaternion); camera.up.copy(originalCamera.up); camera.zoom = originalCamera.zoom;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    controls.target.copy(originalCamera.target); controls.update(); controls.saveState();
    $('capture-views').disabled = !mesh;
  }
});
$('view-select').addEventListener('change', () => { frame($('view-select').value); updateProjectState(); });
$('projection-select').addEventListener('change', () => {
  const target = controls.target.clone();
  const position = camera.position.clone();
  const up = camera.up.clone();
  projectionMode = $('projection-select').value;
  const aspect = viewport.clientWidth / Math.max(viewport.clientHeight, 1);
  camera = projectionMode === 'orthographic'
    ? new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10000)
    : new THREE.PerspectiveCamera(36, aspect, 0.1, 10000);
  camera.position.copy(position); camera.up.copy(up); camera.lookAt(target);
  controls.dispose();
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.target.copy(target); controls.update();
  frame($('view-select').value);
  updateProjectState();
});
$('wire').onclick = () => {
  wire = !wire;
  $('wire').setAttribute('aria-pressed', String(wire));
  updateMeshDisplayMaterials();
};
$('normals').onclick = () => {
  normalMode = !normalMode;
  $('normals').setAttribute('aria-pressed', String(normalMode));
  updateMeshDisplayMaterials();
};
$('section-toggle').onclick = () => {
  sectionEnabled = !sectionEnabled;
  $('section-toggle').setAttribute('aria-pressed', String(sectionEnabled));
  $('section-control').hidden = !sectionEnabled;
  updateSection();
};
$('section-position').addEventListener('input', updateSection);
document.querySelectorAll('[data-format]').forEach(b => b.onclick = () => {
  if (b.dataset.format === 'glb') { exportOrganicGlb(b); return; }
  if (!files?.[b.dataset.format] || builtCode !== code.value) return;
  const a = document.createElement('a'); a.href = files[b.dataset.format]; a.download = `model.${b.dataset.format}`; a.click();
});

async function exportOrganicGlb(button) {
  if (!mesh || builtGeometryType !== 'organic' || builtCode !== code.value || building) return;
  button.disabled = true;
  try {
    const sceneForExport = new THREE.Scene();
    const exportMesh = new THREE.Mesh(mesh.geometry, new THREE.MeshStandardMaterial({ color: 0xb7c997 }));
    exportMesh.scale.setScalar(0.001); // Kodla 3D mm, glTF/GLB metre.
    sceneForExport.add(exportMesh);
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    const exporter = new GLTFExporter();
    const bytes = await exporter.parseAsync(sceneForExport, { binary: true, onlyVisible: true });
    const blob = new Blob([bytes], { type: 'model/gltf-binary' });
    if (!blob.size || blob.size < 20) throw new Error('GLB çıktısı boş veya eksik.');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'model.glb'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    $('status').textContent = `Organik GLB hazır · ${(blob.size / 1024).toFixed(1)} KB · ölçüler metreye çevrildi.`;
  } catch (error) {
    $('status').textContent = `GLB dışa aktarılamadı: ${error.message}`;
  } finally { updateEditor(); }
}

async function build() {
  if (previewOnly) { $('status').textContent = 'Yalnız önizleme · geometri üretimi kapalı.'; return; }
  if (building) return;
  clearTimeout(parameterTimer);
  building = true;
  const source = code.value;
  const selectedMode = mode.value;
  const selectedQuality = quality.value;
  const selectedCadMeshQuality = cadMeshQuality.value;
  const selectedExample = activeExample;
  const selectedParameters = parameterSchema ? { ...activeParameters } : {};
  const selectedParameterKey = JSON.stringify(selectedParameters);
  lastBuildFailed = false; errorLine = null;
  $('run').disabled = true;
  $('capture-views').disabled = true;
  $('parameter-controls').disabled = true;
  $('run').textContent = 'Üretiliyor…';
  activeJobId = crypto.randomUUID();
  $('cancel-build').hidden = false;
  $('cancel-build').disabled = false;
  $('status').textContent = selectedMode === 'organic' ? 'Organik yüzey örnekleniyor…' : 'CAD geometri hesaplanıyor…';
  $('error-panel').hidden = true;
  renderMeshReport(null);
  updateEditor();
  try {
    jobPollTimer = setInterval(async () => {
      try {
        const stateResponse = await fetch(`/api/jobs/${activeJobId}`);
        if (!stateResponse.ok) return;
        const job = await stateResponse.json();
        if (building && activeJobId === job.id && job.status === 'running') $('status').textContent = `${job.stage} · ${(job.elapsedMs / 1000).toFixed(1)} sn`;
      } catch {}
    }, 350);
    const referenceBrief=await collectReferenceBrief();
    const response = await fetch('/api/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: activeJobId, code: source, mode: selectedMode, quality: selectedQuality, cadMeshQuality: selectedCadMeshQuality, example: parameterSchema ? selectedExample : undefined, parameters: parameterSchema ? selectedParameters : undefined, referans:referenceBrief }) });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      const error = new Error(result.error || 'Model üretilemedi.'); error.detail = result.detail; error.sourceLine = result.sourceLine; error.sourceColumn = result.sourceColumn; throw error;
    }
    let geometry, material, triangleSources = [];
    if (result.geometryType === 'cad' && result.previewMesh && result.files.preview) {
      const previewResponse = await fetch(result.files.preview);
      if (!previewResponse.ok) throw new Error('Parça kimlikli önizleme dosyası alınamadı.');
      const previewBuffer = await previewResponse.arrayBuffer();
      if (previewBuffer.byteLength !== result.previewMesh.bytes) throw new Error('Parça kimlikli önizleme boyutu manifest ile uyuşmuyor.');
      const preview = createCADPreview(result, previewBuffer);
      geometry = preview.geometry; material = preview.materials; triangleSources = preview.triangleSources;
    } else {
      const stl = await fetch(result.files.stl);
      if (!stl.ok) throw new Error('Önizleme dosyası alınamadı.');
      geometry = new STLLoader().parse(await stl.arrayBuffer());
      geometry.computeVertexNormals(); material = makeMeshMaterial();
    }
    geometry.computeBoundingBox();
    if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); for (const oldMaterial of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) oldMaterial.dispose(); }
    clearBlazePreview();
    mesh = new THREE.Mesh(geometry, material);
    partFaceSourcesByTriangle = triangleSources;
    scene.add(mesh);
    blazePreview = createHorseBlazePreview(selectedExample);
    if (blazePreview) {
      scene.add(blazePreview);
      $('blaze-preview-note').hidden = false;
    }
    $('capture-views').disabled = false;
    bounds.copy(geometry.boundingBox);
    updateSection();
    frame();
    $('empty').hidden = true;
    files = result.files;
    builtCode = source;
    builtMode = selectedMode;
    builtQuality = selectedQuality;
    builtCadMeshQuality = selectedCadMeshQuality;
    builtGeometryType = result.geometryType;
    builtParameters = selectedParameterKey;
    lastBuildFailed = false; errorLine = null; failedCode = null;
    rememberSuccessfulVersion(result, { source, mode: selectedMode, quality: selectedQuality, cadMeshQuality: selectedCadMeshQuality, example: selectedExample, parameters: selectedParameters });
    renderParts(result.parts || [], result.faceSources || null);
    $('engine').textContent = result.geometryType === 'organic' ? 'Manifold SDF hazır' : 'OpenCascade hazır';
    $('status').textContent = `${result.name} · ${result.geometryType === 'organic' ? 'Organik mesh hazır' : 'Geçerli CAD katısı hazır'}`;
    $('parameter-state').textContent = parameterSchema ? 'Üretilen çıktı bu parametre değerleriyle eşleşiyor.' : 'Şema parametresi yok.';
    const detail = result.geometryType === 'organic' ? `SDF ${result.quality.edgeLengthMm} mm · ${result.mesh.triangles.toLocaleString('tr-TR')} üçgen` : `Ağ ${result.quality.stlToleranceMm} mm / ${result.quality.angularTolerance} rad · ${result.faces} yüz`;
    const bodyCount = result.geometryType === 'organic' ? `${result.mesh.surfaceComponents} yüzey kabuğu` : `${result.solids} CAD katısı`;
    $('metrics').textContent = `${result.size.map(x => x.toFixed(1)).join(' × ')} mm   /   ${(result.volume / 1000).toFixed(2)} cm³   /   ${bodyCount}   /   ${detail}`;
    renderMeshReport(result.meshReport);
    if(referenceItems.length&&result.files?.stl){try{const item=referenceItems[0],compare=await fetch('/api/compare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:result.files.stl.match(/\/api\/files\/([a-f0-9]{32})\//)?.[1],referans:toReferenceInput(item),kamera:referenceCamera(item.camera,selectedExample),olcek:item.widthMm?{genislikMm:item.widthMm}:item.heightMm?{yukseklikMm:item.heightMm}:undefined})}),score=await compare.json();if(compare.ok){$('reference-score').textContent=`${item.camera} · IoU ${(score.iou*100).toFixed(1)}% · kenar ortalama ${score.kenarMesafesiPx.mean.toFixed(2)} px / %95 ${score.kenarMesafesiPx.p95.toFixed(2)} px · yaklaşık siluet karşılaştırması`;$('reference-zoom').value='100';$('reference-x').value='0';$('reference-y').value='0';const overlayUrl=`data:image/png;base64,${score.overlayPng}`;$('reference-score-overlay').src=overlayUrl;$('reference-score-overlay').hidden=false;referenceOverlay.src=overlayUrl;referenceOverlay.hidden=false;updateReferenceOverlay();referenceOverlayFit={width:score.width,height:score.height,mmPerPx:score.mmPerPx};$('projection-select').value='orthographic';$('projection-select').dispatchEvent(new Event('change'));$('view-select').value=item.camera==='side'?'right':item.camera==='top'?'top':'front';$('view-select').dispatchEvent(new Event('change'));}else $('reference-score').textContent=`Siluet skoru üretilemedi: ${score.error||compare.statusText}`;}catch(error){$('reference-score').textContent=`Siluet skoru üretilemedi: ${error.message}`;}}
  } catch (error) {
    files = null;
    builtGeometryType = null;
    lastBuildFailed = true;
    failedCode = source;
    errorLine = sourceLineFromError(error);
    $('status').textContent = `${errorLine ? `Satır ${errorLine} · ` : ''}${error.message}`;
    $('metrics').textContent = mesh ? 'Önizlemede önceki başarılı model gösteriliyor; güncel kod üretilemedi.' : '';
    $('error-panel').hidden = false;
    renderMeshReport(null);
    const sourceContext = errorLine ? `Kaynak satırı ${errorLine}: ${code.value.split('\n')[errorLine - 1]?.trim() || '(boş satır)'}\n\n` : '';
    $('error-detail').textContent = `${sourceContext}${error.detail || error.message}`;
    if (!mesh) $('empty').textContent = 'Model üretilemedi. Kodunu kontrol et.';
    $('capture-views').disabled = !mesh;
  } finally {
    building = false;
    activeJobId = null;
    clearInterval(jobPollTimer); jobPollTimer = null;
    $('cancel-build').hidden = true;
    $('run').disabled = false;
    $('parameter-controls').disabled = false;
    $('run').innerHTML = 'Modeli üret <span>↗</span>';
    updateEditor();
  }
}
$('run').onclick = build;
$('cancel-build').onclick = async () => {
  if (!building || !activeJobId) return;
  $('cancel-build').disabled = true;
  $('status').textContent = 'İş iptal ediliyor…';
  try {
    const response = await fetch(`/api/jobs/${activeJobId}`, { method:'DELETE' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'İş iptal edilemedi.');
  } catch (error) { $('status').textContent = error.message; $('cancel-build').disabled = false; }
};
async function init() {
  try {
    $('project-open').disabled = true;
    const healthResponse = await fetch('/api/health');
    if (!healthResponse.ok) throw new Error('Motor yanıt vermiyor.');
    $('engine').textContent = 'OpenCascade hazır';
    const response = await fetch('/api/examples');
    if (!response.ok) throw new Error('Örnekler alınamadı.');
    samples = await response.json();
    $('project-open').disabled = false;
      const titles = { kutu: 'Açık kutu · CAD', aparat: 'Bağlantı aparatı · CAD', 'at-kafasi': 'At kafası · referans', 'at-kafasi-v2': 'At kafası · CAD V2', 'organik-at-kafasi-v3': 'At kafası · organik V3', 'organik-at-kafasi-v4': 'At kafası · organik V4', 'organik-boyun': 'Boyun ve baş · SDF' };
    samples.forEach(sample => { const option = document.createElement('option'); option.value = sample.name; option.textContent = titles[sample.name] || sample.name; $('examples').appendChild(option); });
    let saved, savedMode, savedQuality, savedCadMeshQuality, savedExample;
    try { saved = localStorage.getItem('kodla3d:source:js'); savedMode = localStorage.getItem('kodla3d:mode'); savedQuality = localStorage.getItem('kodla3d:quality'); savedCadMeshQuality = localStorage.getItem('kodla3d:cad-mesh-quality'); savedExample = localStorage.getItem('kodla3d:example'); } catch {}
    const requested = samples.find(x => x.name === new URL(location.href).searchParams.get('model'));
    const draftExample = samples.find(x => x.name === savedExample);
    const keepDraft = Boolean(requested && saved && requested.code !== saved && confirm(`Bu adres “${requested.name}” örneğini açıyor; tarayıcıda farklı kaydedilmiş kod var. Kaydedilmiş kodu koruyayım mı?`));
    const startupSample = keepDraft ? draftExample : requested;
    activeExample = keepDraft ? (draftExample?.name || '') : (startupSample?.name || '');
    $('project-name').value = startupSample?.name || 'tasarim';
    renderParameterControls(startupSample?.parameterSchema);
    mode.value = startupSample?.mode ?? (savedMode === 'organic' ? 'organic' : 'cad');
    quality.value = ['taslak', 'normal', 'ince'].includes(savedQuality) ? savedQuality : 'normal';
    cadMeshQuality.value = ['taslak', 'normal', 'ince'].includes(savedCadMeshQuality) ? savedCadMeshQuality : 'normal';
    code.value = keepDraft ? (saved ?? samples.find(x => x.name === 'kutu').code) : (startupSample?.code ?? saved ?? samples.find(x => x.name === 'kutu').code);
    if (startupSample) $('examples').value = startupSample.name;
    renderVersionControls();
    updateReferencePanel();
    updateModeControls();
    updateEditor();
    savedProjectSnapshot = currentProjectSnapshot();
    updateProjectState();
    if (previewOnly) {
      $('run').disabled = true;
      $('status').textContent = 'Yalnız önizleme · geometri üretimi kapalı.';
      $('empty').textContent = 'Proje ayarları önizleniyor; geometri üretimi kapalı.';
    } else await build();
  } catch (error) {
    $('engine').textContent = 'Motor bağlantısı yok';
    $('status').textContent = error.message;
    $('empty').textContent = 'Baslat.cmd dosyasıyla yerel motoru başlat.';
  }
}
init();

