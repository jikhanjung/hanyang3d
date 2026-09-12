const assert=require('node:assert/strict'),C=require('../../webapp/static/channel_terrain.js');
const path=C.profile([{x:0,z:0,height:20,width:10},{x:100,z:0,height:25,width:10},{x:200,z:0,height:12,width:10}]);
assert.equal(path[0].level,19);assert(path[1].level<19);assert.equal(path[2].level,11);
const match=C.nearest(50,0,path);assert.equal(match.distance,0);
assert(C.carvedHeight(24,match,2)<24);assert.equal(C.carvedHeight(5,match,2),5);
assert.equal(C.carvedHeight(24,C.nearest(50,40,path),2),24);
assert.equal(C.carvedHeight(24,match,4),C.carvedHeight(24,match,2)-2);
const geometry={positions:[0,20,-20,100,20,-20,0,20,20],index:[0,1,2],uv:[0,0,1,0,0,1],colors:[1,1,1,1,1,1,1,1,1]};
const refined=C.refine(geometry,path);assert(refined.index.length>3);assert(refined.positions.every(Number.isFinite));
assert.equal(geometry.positions.length,9);
console.log('Channel: downstream profile, cut-only terrain, corridor bounds, depth, local refinement, source preservation passed');

const steep=C.profile([{x:0,z:0,height:100,width:3},{x:100,z:0,height:90,width:5},{x:200,z:0,height:20,width:8}]);
for(let i=0;i<steep.length-1;i++){
 const drop=steep[i].level-steep[i+1].level;
 assert(drop>=.03-1e-9&&drop<=8+1e-9);
 assert(steep[i].level<=steep[i].height-1);
}
assert(steep[0].level>steep.at(-1).level);
console.log('Upstream: descending profile, bounded 8% grade and no terrain raising passed');
// A disconnected branch must not excavate a diagonal shortcut across the terrain.
{
 const C=require('../../webapp/static/channel_terrain.js');
 const path=[{x:0,z:0,level:10,width:2},{x:10,z:0,level:9,width:2},{x:100,z:100,level:11,width:2,breakBefore:true},{x:110,z:100,level:10,width:2}];
 assert(C.nearest(55,50,path).distance>60);
 assert.equal(C.carvedHeight(20,C.nearest(55,50,path),2),20);
 console.log('River branch: no synthetic connecting segment or unintended diagonal cut');
}
