import assert from 'node:assert/strict';

const port = Number(process.env.KODLA3D_PORT || 8765);
const response = await fetch(`http://127.0.0.1:${port}/api/build`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ mode: 'organic', code: `
const ear = elipsoid({id:'ear-left',ad:'Sol kulak',merkez:[-5,0,0],yariCaplar:[2,1.5,5]});
const moved = tasi({parca:ear,x:1,y:0,z:0});
return simetrik({parca:moved,duzlem:'YZ',id:'ear-right',ad:'Sağ kulak'});
` })
});
const result = await response.json();
assert.equal(response.status, 200, JSON.stringify(result));
assert.ok(result.ok && result.geometryType === 'organic');
const byId = new Map(result.parts.map(part => [part.id, part]));
const left = byId.get('ear-left');
const right = byId.get('ear-right');
const root = result.parts.find(part => part.type === 'group' && part.groupId === null);
assert.ok(left && right && root, 'named child nodes and group root are returned');
assert.equal(left.type, 'ellipsoid');
assert.deepEqual(left.parameters.radiiMm, [2, 1.5, 5]);
assert.deepEqual(left.transforms.at(-1).tasima, [1, 0, 0]);
assert.ok(left.bounds.min[0] < left.bounds.max[0] && left.bounds.min[2] < left.bounds.max[2]);
assert.equal(right.sourceId, 'ear-left', 'mirror retains source-node relationship');
assert.equal(right.groupId, root.id);
assert.ok(right.bounds.min[0] > 0 && left.bounds.max[0] < 0, 'mirrored node bounds follow the transformed geometry');
assert.equal(root.type, 'group');
assert.ok(root.bounds === undefined || root.bounds.min.every(Number.isFinite), 'optional group bounds are either omitted or finite');
const report = { status: 'passed', server: `http://127.0.0.1:${port}`, nodes: result.parts.length, selectedFixture: { left, right, root } };
console.log(JSON.stringify(report, null, 2));
