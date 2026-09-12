const assert=require('node:assert/strict'),fs=require('node:fs'),W=require('../../webapp/static/tps.js');
const e=JSON.parse(fs.readFileSync('gis/control_points/doseong_modern_preview.json')),d=JSON.parse(fs.readFileSync('gis/georeferenced/terrain3d/dem.json')),ps=[...e.landmarks,...e.suggested_anchors],R=6378137;
const project=p=>[R*p.lon*Math.PI/180,R*Math.log(Math.tan(Math.PI/4+p.lat*Math.PI/360))],base=W.fitTPS(ps.map(p=>p.pixel),ps.map(project)),warp=W.fitTerrainTPS(ps.map(p=>p.pixel),ps.map(project),e.terrain_alignment);
for(let x=1100;x<=2100;x+=100)for(let y=1250;y<=1750;y+=100)assert.deepEqual(warp(x,y),base(x,y));
for(const p of [...ps,...e.terrain_alignment.anchors])assert(Math.hypot(...warp(...p.pixel).map((v,i)=>v-project(p)[i]))<1e-5);
for(const [cols,rows] of [[32,28],[128,112],[256,224]]){
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
  const [a,b,c,f]=[[i,j],[i+1,j],[i,j+1],[i+1,j+1]].map(([x,y])=>warp(x*3124/cols,y*2743/rows));
  for(const p of [a,b,c,f])assert(p[0]>=d.bounds_3857[0]&&p[0]<=d.bounds_3857[2]&&p[1]>=d.bounds_3857[1]&&p[1]<=d.bounds_3857[3]);
  for(const [p,q,r] of [[a,b,f],[a,f,c]])assert((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])<0);
 }
}
console.log('Mountain alignment: exact core preservation, 5+3 targets, three fold-free grids and expanded DEM coverage passed');
