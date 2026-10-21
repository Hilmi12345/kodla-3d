import * as r from 'replicad';

let ocKernel = null;
let generatedPartId = 0;
export function setOpenCascadeKernel(kernel) { ocKernel = kernel; generatedPartId = 0; }
function shapeBounds(shape) {
  const [min, max] = shape.boundingBox.bounds;
  return { min: [...min], max: [...max] };
}

function stablePartId(name) {
  const base = String(name || 'parca').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'parca';
  return `${base}-${++generatedPartId}`;
}
function requireParca(value, label = 'model') {
  if (!(value instanceof Parca)) throw new Error(`${label} bir Parca olmalı; parça kimliğini korumak için birlestir/cikar API'sini kullanın.`);
  return value;
}
function historyFaces(list) {
  const items = new ocKernel.NCollection_List_TopoDS_Shape(list);
  const shapes = [];
  while (!items.IsEmpty()) { shapes.push(items.First()); items.RemoveFirst(); }
  items.delete(); list.delete();
  return shapes;
}
function booleanPart(aValue, bValue, ad, operation) {
  const a = requireParca(aValue, 'ilk girdi');
  const b = requireParca(bValue, 'ikinci girdi');
  if (!ocKernel) throw new Error('OpenCascade parça geçmişi başlatılmadı.');
  const operationId = stablePartId(ad || (operation === 'union' ? `${a.ad}-${b.ad}` : `cikar-${b.ad}`));
  const builder = operation === 'union'
    ? new ocKernel.BRepAlgoAPI_Fuse(a.sekil.wrapped, b.sekil.wrapped)
    : new ocKernel.BRepAlgoAPI_Cut(a.sekil.wrapped, b.sekil.wrapped);
  builder.SetToFillHistory(true);
  builder.Build();
  if (builder.HasErrors()) { builder.delete(); throw new Error(`${operation === 'union' ? 'Birleştirme' : 'Çıkarma'} '${a.ad}' ve '${b.ad}' parçalarında başarısız oldu.`); }
  builder.SimplifyResult(true, true, 0.001);
  const shape = r.cast(builder.Shape());
  const resultFaces = shape.faces;
  const ownersByHash = new Map();
  const addOwners = (face, owners) => {
    const key = String(face.hashCode);
    const prior = ownersByHash.get(key) || [];
    ownersByHash.set(key, [...new Set([...prior, ...owners])]);
  };
  const mapInput = (part, role) => {
    for (const face of part.sekil.faces) {
      const owners = part.faceSources[String(face.hashCode)] || [part.id];
      const modified = historyFaces(builder.Modified(face.wrapped));
      for (const raw of modified) {
        const match = resultFaces.find(candidate => candidate.wrapped.IsSame(raw));
        if (match) addOwners(match, role === 'tool' && operation === 'cut' ? [b.id] : owners);
        raw.delete?.();
      }
      if (!builder.IsDeleted(face.wrapped)) {
        const match = resultFaces.find(candidate => candidate.wrapped.IsSame(face.wrapped));
        if (match) addOwners(match, owners);
      }
      if (operation === 'cut' && role === 'tool') {
        for (const raw of historyFaces(builder.Generated(face.wrapped))) {
          const match = resultFaces.find(candidate => candidate.wrapped.IsSame(raw));
          if (match) addOwners(match, [b.id]);
          raw.delete?.();
        }
      }
    }
  };
  try {
    mapInput(a, 'argument');
    mapInput(b, 'tool');
    const faceSources = {};
    for (const face of resultFaces) faceSources[String(face.hashCode)] = ownersByHash.get(String(face.hashCode)) || [operationId];
    const nodes = [...a.nodes, ...b.nodes].map(node => ({ ...node }));
    const rootIds = new Set([a.rootId, b.rootId]);
    for (const node of nodes) if (rootIds.has(node.id)) node.groupId = operationId;
    const allIds = nodes.map(node => node.id);
    if (new Set(allIds).size !== allIds.length) throw new Error(`Birleştirme ağacında yinelenen parça kimliği var (${operationId}); parçaların adlarını/kimliklerini benzersiz yapın.`);
    nodes.push({ id: operationId, name: ad, type: operation, sourceId: null, groupId: null, visible: true, locked: false, parameters: { sourceIds: [a.rootId, b.rootId] }, bounds: shapeBounds(shape) });
    return new Parca(ad, shape, { id: operationId, rootId: operationId, nodes, faceSources });
  } finally { builder.delete(); }
}

function pozitif(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error(`${name} sıfırdan büyük bir sayı olmalı.`);
  return value;
}
function sonlu(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${name} sonlu bir sayı olmalı.`);
  return value;
}
function nokta(value, name) {
  if (!Array.isArray(value) || value.length !== 3) throw new Error(`${name} [x, y, z] biçiminde olmalı.`);
  return value.map((item, index) => sonlu(item, `${name}[${index}]`));
}
function yonDegeri(value) {
  const named = { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] };
  const direction = named[value] || nokta(value, 'eksen');
  if (Math.hypot(...direction) === 0) throw new Error('eksen yönü sıfır olamaz.');
  return direction;
}
function hataMetni(error) {
  return typeof error?.message === 'string' ? error.message : typeof error === 'string' ? error : 'OpenCascade işlemi geometri nedeniyle tamamlanamadı.';
}

export class Parca {
  constructor(ad, sekil, options = {}) {
    this.ad = ad;
    if (sekil instanceof Parca) {
      this.sekil = sekil.sekil;
      this.id = options.id || sekil.id;
      this.rootId = options.rootId || sekil.rootId;
      this.nodes = options.nodes || sekil.nodes.map(node => ({ ...node }));
      this.faceSources = options.faceSources || { ...sekil.faceSources };
      return;
    }
    this.sekil = sekil;
    this.id = options.id || stablePartId(ad);
    this.rootId = options.rootId || this.id;
    this.nodes = options.nodes || [{ id: this.id, name: ad, type: 'brep', sourceId: null, groupId: null, visible: true, locked: false, parameters: options.parameters || {}, bounds: shapeBounds(sekil) }];
    this.faceSources = options.faceSources || Object.fromEntries((sekil?.faces || []).map(face => [String(face.hashCode), [this.id]]));
  }
  yuvarlat(yaricap, yon = 'Z') {
    const amount = pozitif(yaricap, 'yaricap');
    try { return new Parca(this.ad, this.sekil.fillet(amount, e => e.inDirection(yon))); }
    catch (error) { throw new Error(`Yuvarlatma ${amount} mm (${yon} yönü) '${this.ad}' parçasında uygulanamadı: ${hataMetni(error)}`); }
  }
  icini_bosalt(duvar = 3) {
    const amount = pozitif(duvar, 'duvar');
    const top = this.sekil.boundingBox.bounds[1][2];
    const originalVolume = r.measureVolume(this.sekil);
    try {
      const shape = this.sekil.shell(amount, f => f.inPlane('XY', top));
      const resultVolume = r.measureVolume(shape);
      if (!(resultVolume < originalVolume - Math.max(1e-8, originalVolume * 1e-9))) {
        throw new Error(`İç hacim oluşmadı (önce ${originalVolume} mm³, sonra ${resultVolume} mm³); duvar kalınlığını küçültüp açık üst yüzeyi kontrol edin.`);
      }
      return new Parca(this.ad, shape);
    } catch (error) { throw new Error(`İç boşaltma ${amount} mm duvarla '${this.ad}' parçasında başarısız: ${hataMetni(error)}`); }
  }
  tasi(x = 0, y = 0, z = 0) { return new Parca(this.ad, this.sekil.clone().translate(x, y, z)); }
  delik_ac(cap, konumlar = [[0, 0]]) {
    pozitif(cap, 'cap');
    if (!Array.isArray(konumlar) || konumlar.length === 0) throw new Error('delik_ac en az bir global XY [x, y] koordinatı ister.');
    const [min, max] = this.sekil.boundingBox.bounds;
    let shape = this.sekil;
    for (const [index, point] of konumlar.entries()) {
      if (!Array.isArray(point) || point.length !== 2) throw new Error(`konumlar[${index}] global XY [x, y] biçiminde olmalı.`);
      const [x, y] = point.map((value, axis) => sonlu(value, `konumlar[${index}][${axis}]`));
      const cutter = r.makeCylinder(cap / 2, max[2] - min[2] + 2, [x, y, min[2] - 1]);
      try { shape = shape.cut(cutter); }
      catch (error) { throw new Error(`Delik ${index + 1} (global XY ${x}, ${y}; çap ${cap} mm) '${this.ad}' parçasında açılamadı: ${error.message}`); }
    }
    return new Parca(this.ad, shape);
  }
  dondur(aci, eksen = 'Z', merkez = [0, 0, 0]) {
    const angle = sonlu(aci, 'aci');
    const origin = nokta(merkez, 'merkez');
    return new Parca(this.ad, this.sekil.clone().rotate(angle, origin, yonDegeri(eksen)));
  }
  ayna(duzlem = 'YZ', merkez = [0, 0, 0]) {
    if (!['XY', 'YZ', 'XZ'].includes(duzlem)) throw new Error('Ayna düzlemi XY, XZ veya YZ olmalı.');
    return new Parca(this.ad, this.sekil.clone().mirror(duzlem, nokta(merkez, 'merkez')));
  }
  pah(yaricap) {
    const amount = pozitif(yaricap, 'yaricap');
    try { return new Parca(this.ad, this.sekil.chamfer(amount)); }
    catch (error) { throw new Error(`Pah ${amount} mm '${this.ad}' parçasında uygulanamadı: ${hataMetni(error)}`); }
  }
}

export function kutu({ ad = 'govde', genislik = 80, derinlik = 50, yukseklik = 25 } = {}) {
  return new Parca(ad, r.makeBaseBox(pozitif(genislik, 'genislik'), pozitif(derinlik, 'derinlik'), pozitif(yukseklik, 'yukseklik')));
}
export function silindir({ ad = 'silindir', cap = 30, yukseklik = 20 } = {}) {
  return new Parca(ad, r.makeCylinder(pozitif(cap, 'cap') / 2, pozitif(yukseklik, 'yukseklik')));
}
export function birlestir(a, b, ad = a.ad) { return booleanPart(a, b, ad, 'union'); }
export function cikar(a, b, ad = a.ad) { return booleanPart(a, b, ad, 'cut'); }
export function daireselLoft({ ad = 'loft', kesitler = [], duz = false } = {}) {
  if (!Array.isArray(kesitler) || kesitler.length < 2) throw new Error('Dairesel loft en az iki kesit ister.');
  const parsed = kesitler.map((section, index) => {
    const z = sonlu(section?.z, `kesitler[${index}].z`);
    const yaricap = pozitif(section?.yaricap, `kesitler[${index}].yaricap`);
    const merkez = section?.merkez === undefined ? [0, 0] : section.merkez;
    if (!Array.isArray(merkez) || merkez.length !== 2) throw new Error(`kesitler[${index}].merkez [x, y] olmalı.`);
    const xy = merkez.map((value, axis) => sonlu(value, `kesitler[${index}].merkez[${axis}]`));
    return { z, yaricap, merkez: xy };
  });
  if (new Set(parsed.map(section => section.z)).size !== parsed.length) throw new Error('Loft kesitlerinin z seviyeleri benzersiz olmalı.');
  if (parsed.some((section, index) => index > 0 && section.z <= parsed[index - 1].z)) throw new Error('Loft kesitleri artan z sırasıyla verilmelidir.');
  const sketches = parsed.map(section => r.sketchCircle(section.yaricap, { plane: 'XY', origin: [...section.merkez, section.z] }));
  try { return new Parca(ad, r.loft(sketches.map(sketch => sketch.wire), { ruled: Boolean(duz) })); }
  catch (error) { throw new Error(`Dairesel loft üretilemedi (${parsed.length} kesit): ${hataMetni(error)}`); }
  finally { sketches.forEach(sketch => sketch.delete()); }
}
export function profilLoft({ ad = 'profil_loft', kesitler = [], duz = false } = {}) {
  if (!Array.isArray(kesitler) || kesitler.length < 2 || kesitler.length > 100) throw new Error('profilLoft en az 2, en fazla 100 kesit ister.');
  const parsed = kesitler.map((section, sectionIndex) => {
    const z = sonlu(section?.z, `kesitler[${sectionIndex}].z`);
    if (!Array.isArray(section?.noktalar) || section.noktalar.length < 3 || section.noktalar.length > 100) throw new Error(`kesitler[${sectionIndex}].noktalar en az 3, en fazla 100 [x, y] noktası ister.`);
    const points = section.noktalar.map((point, pointIndex) => {
      if (!Array.isArray(point) || point.length !== 2) throw new Error(`kesitler[${sectionIndex}].noktalar[${pointIndex}] [x, y] biçiminde olmalı.`);
      return point.map((value, axis) => sonlu(value, `kesitler[${sectionIndex}].noktalar[${pointIndex}][${axis}]`));
    });
    if (points.length > 3 && Math.hypot(points[0][0] - points.at(-1)[0], points[0][1] - points.at(-1)[1]) < 1e-8) points.pop();
    if (points.length < 3) throw new Error(`kesitler[${sectionIndex}] kapanınca en az 3 köşe kalmalı.`);
    const twiceArea = points.reduce((area, point, index) => {
      const next = points[(index + 1) % points.length];
      return area + point[0] * next[1] - next[0] * point[1];
    }, 0);
    if (Math.abs(twiceArea) < 1e-8) throw new Error(`kesitler[${sectionIndex}] alanı sıfır olamaz.`);
    return { z, points };
  });
  if (new Set(parsed.map(section => section.z)).size !== parsed.length || parsed.some((section, index) => index > 0 && section.z <= parsed[index - 1].z)) throw new Error('Profil loft kesitleri benzersiz ve artan z sırasıyla verilmelidir.');
  if (new Set(parsed.map(section => section.points.length)).size !== 1) throw new Error('Profil loft kesitlerinde aynı sayıda karşılıklı köşe olmalı.');
  const sketches = parsed.map(section => {
    const sketcher = new r.Sketcher('XY', section.z);
    sketcher.movePointerTo(section.points[0]);
    for (const point of section.points.slice(1)) sketcher.lineTo(point);
    return sketcher.close();
  });
  try { return new Parca(ad, r.loft(sketches.map(sketch => sketch.wire), { ruled: Boolean(duz) })); }
  catch (error) { throw new Error(`Profil loft üretilemedi (${parsed.length} kesit): ${hataMetni(error)}`); }
  finally { sketches.forEach(sketch => sketch.delete()); }
}
export function profilDondur({ ad = 'donel_profil', noktalar = [], aci = 360 } = {}) {
  if (!Array.isArray(noktalar) || noktalar.length < 3) throw new Error('Döner profil en az üç [yaricap, z] noktası ister.');
  const points = noktalar.map((point, index) => {
    if (!Array.isArray(point) || point.length !== 2) throw new Error(`noktalar[${index}] [yaricap, z] biçiminde olmalı.`);
    const radius = sonlu(point[0], `noktalar[${index}].yaricap`);
    if (radius < 0) throw new Error(`noktalar[${index}].yaricap negatif olamaz.`);
    return [radius, sonlu(point[1], `noktalar[${index}].z`)];
  });
  const angle = sonlu(aci, 'aci');
  if (angle !== 360) throw new Error('Bu API yalnız kapalı CAD katısı üretmek için 360° döndürmeyi destekler.');
  const sketcher = new r.Sketcher('XZ');
  sketcher.movePointerTo(points[0]);
  for (const point of points.slice(1)) sketcher.lineTo(point);
  const sketch = sketcher.close();
  try { return new Parca(ad, sketch.revolve([0, 0, 1], { origin: [0, 0, 0], angle })); }
  catch (error) { throw new Error(`Döner profil üretilemedi (${angle}°): ${hataMetni(error)}`); }
}
export function profilSupur({ ad = 'supurulen_profil', profil = [], yol = [], frenet = false, gecis = 'transformed' } = {}) {
  if (!Array.isArray(profil) || profil.length < 3 || profil.length > 100) throw new Error('profil en az 3, en fazla 100 [u, v] noktası ister.');
  if (!Array.isArray(yol) || yol.length < 2 || yol.length > 200) throw new Error('yol en az 2, en fazla 200 [x, y, z] noktası ister.');
  if (!['right', 'transformed', 'round'].includes(gecis)) throw new Error('gecis right, transformed veya round olmalı.');
  const section = profil.map((point, index) => {
    if (!Array.isArray(point) || point.length !== 2) throw new Error(`profil[${index}] [u, v] biçiminde olmalı.`);
    return point.map((value, axis) => sonlu(value, `profil[${index}][${axis}]`));
  });
  const path = yol.map((point, index) => nokta(point, `yol[${index}]`));
  if (Math.hypot(...section[0].map((value, axis) => value - section.at(-1)[axis])) < 1e-8) section.pop();
  if (section.length < 3) throw new Error('profil kapandıktan sonra en az 3 farklı nokta kalmalı.');
  const twiceArea = section.reduce((area, point, index) => {
    const next = section[(index + 1) % section.length];
    return area + point[0] * next[1] - next[0] * point[1];
  }, 0);
  if (Math.abs(twiceArea) < 1e-8) throw new Error('profil alanı sıfır olamaz; kesit noktalarını kontrol edin.');
  for (let index = 1; index < path.length; index++) {
    if (Math.hypot(...path[index].map((value, axis) => value - path[index - 1][axis])) < 1e-8) throw new Error(`yol[${index}] önceki noktayla aynı; sıfır uzunluklu segment süpürülemez.`);
  }
  const tangent = path[1].map((value, axis) => value - path[0][axis]);
  const length = Math.hypot(...tangent);
  const normal = tangent.map(value => value / length);
  const seed = Math.abs(normal[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const projection = seed.reduce((sum, value, axis) => sum + value * normal[axis], 0);
  const xDirection = seed.map((value, axis) => value - projection * normal[axis]);
  const xLength = Math.hypot(...xDirection);
  for (let axis = 0; axis < 3; axis++) xDirection[axis] /= xLength;
  const plane = new r.Plane(path[0], xDirection, normal);
  const sketcher = new r.Sketcher(plane);
  let sketch, spine;
  try {
    sketcher.movePointerTo(section[0]);
    for (const point of section.slice(1)) sketcher.lineTo(point);
    sketch = sketcher.close();
    spine = r.assembleWire(path.slice(0, -1).map((point, index) => r.makeLine(point, path[index + 1])));
    return new Parca(ad, r.genericSweep(sketch.wire, spine, { frenet: Boolean(frenet), transitionMode: gecis }));
  } catch (error) { throw new Error(`Profil süpürme '${ad}' uygulanamadı: ${hataMetni(error)}`); }
  finally { sketch?.delete(); sketcher.delete(); spine?.delete(); plane.delete(); }
}
export function dogrusalDesen({ parca, adet = 2, aralik = [10, 0, 0], ad = `${parca?.ad || 'parca'}_desen` } = {}) {
  if (!(parca instanceof Parca)) throw new Error('parca bir CAD modeli olmalı.');
  if (!Number.isInteger(adet) || adet < 1 || adet > 100) throw new Error('desen adet değeri 1–100 arasında bir tam sayı olmalı.');
  const delta = nokta(aralik, 'aralik');
  const copies = Array.from({ length: adet }, (_, index) => parca.sekil.clone().translate(...delta.map(value => value * index)));
  return new Parca(ad, r.makeCompound(copies));
}
