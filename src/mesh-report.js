const MAX_ANALYSIS_TRIANGLES = 750_000;

function pointKey(point) {
  return point.map(value => Object.is(value, -0) ? 0 : value).join(',');
}

function edgeKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function analyzeBinaryStl(input) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (bytes.length < 84) throw new Error('Binary STL başlığı eksik.');
  const triangleCount = bytes.readUInt32LE(80);
  if (bytes.length !== 84 + triangleCount * 50) throw new Error('STL üçgen tablosu tutarsız.');
  if (triangleCount > MAX_ANALYSIS_TRIANGLES) {
    return {
      status: 'partial', method: 'exact-float32-coordinate-welding', weldEpsilonMm: 0,
      triangles: triangleCount, analysisLimit: MAX_ANALYSIS_TRIANGLES,
      checks: { coordinates: 'not-checked-limit', selfIntersection: 'not-checked', indexRange: 'not-applicable-unindexed-stl' },
      topology: null, bounds: null,
      printability: { verdict: 'profile-required', notChecked: ['self-intersection', 'wall-thickness', 'minimum-feature-size', 'overhangs', 'flat-base', 'printer-profile'] }
    };
  }

  const vertexIds = new Map();
  const vertices = [];
  const triangles = new Array(triangleCount);
  const edgeMap = new Map();
  const duplicateFaces = new Set();
  const seenFaces = new Set();
  let nonFiniteCoordinates = 0;
  let zeroAreaTriangles = 0;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (let face = 0; face < triangleCount; face++) {
    const offset = 84 + face * 50 + 12;
    const points = [0, 1, 2].map(corner => [0, 1, 2].map(axis => bytes.readFloatLE(offset + corner * 12 + axis * 4)));
    const ids = points.map(point => {
      if (!point.every(Number.isFinite)) nonFiniteCoordinates++;
      point.forEach((value, axis) => { if (Number.isFinite(value)) { min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value); } });
      const key = pointKey(point);
      if (!vertexIds.has(key)) { vertexIds.set(key, vertices.length); vertices.push(point); }
      return vertexIds.get(key);
    });
    triangles[face] = ids;
    const [a, b, c] = points;
    const u = b.map((value, axis) => value - a[axis]);
    const v = c.map((value, axis) => value - a[axis]);
    const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (Math.hypot(...cross) === 0) zeroAreaTriangles++;
    const faceKey = [...ids].sort((x, y) => x - y).join(':');
    if (seenFaces.has(faceKey)) duplicateFaces.add(faceKey); else seenFaces.add(faceKey);
    for (const [from, to] of [[ids[0], ids[1]], [ids[1], ids[2]], [ids[2], ids[0]]]) {
      const key = edgeKey(from, to);
      let edge = edgeMap.get(key);
      if (!edge) edgeMap.set(key, edge = { count: 0, forward: 0, faces: [] });
      edge.count++; edge.forward += from < to ? 1 : 0; edge.faces.push(face);
    }
  }

  const parent = Int32Array.from({ length: triangleCount }, (_, index) => index);
  const root = value => { while (parent[value] !== value) { parent[value] = parent[parent[value]]; value = parent[value]; } return value; };
  const join = (a, b) => { const ra = root(a), rb = root(b); if (ra !== rb) parent[rb] = ra; };
  for (const edge of edgeMap.values()) for (let i = 1; i < edge.faces.length; i++) join(edge.faces[0], edge.faces[i]);
  const componentFaces = new Map();
  for (let i = 0; i < triangleCount; i++) { const key = root(i); if (!componentFaces.has(key)) componentFaces.set(key, []); componentFaces.get(key).push(i); }
  const componentOfFace = new Int32Array(triangleCount);
  const components = [...componentFaces.values()].map((faces, index) => { for (const face of faces) componentOfFace[face] = index; return { triangles: faces.length, signedVolumeMm3: 0, boundaryEdges: 0, nonManifoldEdges: 0, inconsistentOrientationEdges: 0 }; });
  for (const edge of edgeMap.values()) {
    const component = components[componentOfFace[edge.faces[0]]];
    if (edge.count === 1) component.boundaryEdges++;
    if (edge.count > 2) component.nonManifoldEdges++;
    if (edge.count === 2 && (edge.forward === 0 || edge.forward === 2)) component.inconsistentOrientationEdges++;
  }
  for (let face = 0; face < triangleCount; face++) {
    const [ia, ib, ic] = triangles[face];
    const a = vertices[ia], b = vertices[ib], c = vertices[ic];
    const cross = [b[1] * c[2] - b[2] * c[1], b[2] * c[0] - b[0] * c[2], b[0] * c[1] - b[1] * c[0]];
    components[componentOfFace[face]].signedVolumeMm3 += (a[0] * cross[0] + a[1] * cross[1] + a[2] * cross[2]) / 6;
  }
  for (const component of components) {
    component.closed = component.boundaryEdges === 0 && component.nonManifoldEdges === 0;
    if (!component.closed) component.signedVolumeMm3 = null;
  }
  const boundaryEdges = [...edgeMap.values()].filter(edge => edge.count === 1).length;
  const nonManifoldEdges = [...edgeMap.values()].filter(edge => edge.count > 2).length;
  const inconsistentOrientationEdges = [...edgeMap.values()].filter(edge => edge.count === 2 && (edge.forward === 0 || edge.forward === 2)).length;
  const hasBounds = nonFiniteCoordinates === 0 && vertices.length > 0 && min.every(Number.isFinite) && max.every(Number.isFinite);
  for (const component of components) {
    if (!component.closed || !Number.isFinite(component.signedVolumeMm3)) component.signedVolumeMm3 = null;
  }
  return {
    status: triangleCount === 0 || nonFiniteCoordinates > 0 ? 'invalid' : 'complete', method: 'exact-float32-coordinate-welding', weldEpsilonMm: 0,
    triangles: triangleCount, vertices: vertices.length, bounds: hasBounds ? { min, max, size: max.map((value, axis) => value - min[axis]) } : null,
    checks: {
      emptyGeometry: { status: triangleCount === 0 ? 'failed' : 'passed', triangles: triangleCount },
      coordinates: { status: nonFiniteCoordinates === 0 ? 'passed' : 'failed', nonFiniteValues: nonFiniteCoordinates },
      zeroAreaTriangles: { status: zeroAreaTriangles === 0 ? 'passed' : 'warning', count: zeroAreaTriangles },
      duplicateFaces: { status: duplicateFaces.size === 0 ? 'passed' : 'warning', count: duplicateFaces.size },
      indexRange: { status: 'not-applicable', reason: 'Binary STL üçgen köşelerini tekrarlar; dış indeks dizisi içermez.' },
      selfIntersection: { status: 'not-checked' }
    },
    topology: { boundaryEdges, nonManifoldEdges, inconsistentOrientationEdges, connectedComponents: components },
    printability: { verdict: triangleCount === 0 || nonFiniteCoordinates > 0 ? 'invalid-mesh' : 'profile-required', checked: ['boş geometri', 'STL koordinatları', 'üçgen alanı', 'yinelenen yüzler', 'tam kenar topolojisi', 'bağlı bileşen ve kapalı bileşen hacmi'], notChecked: ['self-intersection', 'minimum wall thickness', 'minimum feature size', 'flat-base suitability', 'overhang/supports', 'nozzle/resin profile'] }
  };
}
