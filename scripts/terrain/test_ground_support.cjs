const assert=require('node:assert/strict');
const {footprintRange}=require('../../webapp/static/ground_support.js');
const surface=(positions,index)=>({positions,index});
// Plane y=x+z: clipping at the footprint edges must interpolate the surface.
const plane=surface([0,0,0,10,10,0,10,20,10,0,10,10],[0,2,1,0,3,2]);
const range=footprintRange([plane],[2,3,6,8]);
assert.equal(range.min,5);assert.equal(range.max,14);
// An interior ridge must be found even when all four footprint corners are low.
const peak=surface([0,0,0,10,0,0,10,0,10,0,0,10,5,25,5],[0,4,1,1,4,2,2,4,3,3,4,0]);
assert.equal(footprintRange([peak],[1,1,9,9]).max,25);
// Lifted draped imagery must also clear the slab; terrain alone is insufficient.
const lifted=surface(plane.positions.map((v,i)=>i%3===1?v+4:v),plane.index);
assert.equal(footprintRange([plane,lifted],[2,3,6,8]).max,18);
assert.throws(()=>footprintRange([plane],[11,11,12,12]),/No terrain/);
assert.throws(()=>footprintRange([plane],[3,3,2,2]),/Invalid/);
console.log('Ground support: sloped clipping, interior ridge, image offset, outside/invalid footprint passed');

// Rotated rectangle on y=x+z: exact extrema, not its larger world AABB.
const rotated=footprintRange([plane],[3,4,7,6],Math.PI/4);
assert.ok(Math.abs(rotated.min-(10-Math.SQRT2))<1e-9);
assert.ok(Math.abs(rotated.max-(10+Math.SQRT2))<1e-9);
assert.throws(()=>footprintRange([plane],[3,4,7,6],NaN),/Invalid/);
console.log('Rotated footprint: exact slope extrema passed');

// Road heights reuse triangle topology even while positions hold another exaggeration.
assert.equal(footprintRange([{...plane,heights:[.7,10.7,20.7,10.7]}],[2,3,6,8]).max,14.7);
