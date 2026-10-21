import assert from 'node:assert/strict';
import { analyzeBinaryStl } from '../src/mesh-report.js';

function stl(faces) {
  const result = Buffer.alloc(84 + faces.length * 50);
  result.writeUInt32LE(faces.length, 80);
  faces.forEach((face, index) => face.forEach((point, corner) => point.forEach((value, axis) => result.writeFloatLE(value, 84 + index * 50 + 12 + corner * 12 + axis * 4))));
  return result;
}

const [a, b, c, d] = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]];
const tetra = [[a, c, b], [a, b, d], [a, d, c], [b, c, d]];
const empty = analyzeBinaryStl(stl([]));
assert.equal(empty.checks.emptyGeometry.status, 'failed');
assert.equal(empty.printability.verdict, 'invalid-mesh');
const solid = analyzeBinaryStl(stl(tetra));
assert.equal(solid.status, 'complete');
assert.equal(solid.topology.boundaryEdges, 0);
assert.equal(solid.topology.nonManifoldEdges, 0);
assert.equal(solid.topology.inconsistentOrientationEdges, 0);
assert.equal(solid.topology.connectedComponents.length, 1);
assert.equal(solid.topology.connectedComponents[0].closed, true);
assert.ok(Math.abs(solid.topology.connectedComponents[0].signedVolumeMm3 - 1 / 6) < 1e-6);
assert.equal(solid.printability.verdict, 'profile-required');
assert.equal(solid.checks.selfIntersection.status, 'not-checked');
assert.equal(solid.checks.indexRange.status, 'not-applicable');

const open = analyzeBinaryStl(stl(tetra.slice(1)));
assert.equal(open.topology.boundaryEdges, 3);
assert.equal(open.topology.connectedComponents[0].closed, false);
assert.equal(open.topology.connectedComponents[0].signedVolumeMm3, null);

const duplicateFace = analyzeBinaryStl(stl([...tetra, tetra[0]]));
assert.equal(duplicateFace.checks.duplicateFaces.count, 1);
assert.ok(duplicateFace.topology.nonManifoldEdges > 0);

const degenerate = analyzeBinaryStl(stl([...tetra, [a, a, b]]));
assert.equal(degenerate.checks.zeroAreaTriangles.count, 1);

const nonFiniteFaces = structuredClone(tetra);
nonFiniteFaces[0][0][0] = Number.NaN;
const nonFinite = analyzeBinaryStl(stl(nonFiniteFaces));
assert.equal(nonFinite.checks.coordinates.nonFiniteValues, 3);
assert.equal(nonFinite.bounds, null);

console.log(JSON.stringify({ empty: empty.checks.emptyGeometry.status, solid: { triangles: solid.triangles, signedVolumeMm3: solid.topology.connectedComponents[0].signedVolumeMm3 }, openBoundaryEdges: open.topology.boundaryEdges, duplicateFaces: duplicateFace.checks.duplicateFaces.count, zeroAreaTriangles: degenerate.checks.zeroAreaTriangles.count, nonFiniteCoordinateOccurrences: nonFinite.checks.coordinates.nonFiniteValues }, null, 2));
