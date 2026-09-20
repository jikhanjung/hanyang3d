import * as THREE from 'three';
import {createGranite} from './granite.js';
import {createTrees} from './trees.js';
import {createGroundColors} from './ground_colors.js';
// Transfer the 1750 woodland concept through its geographic calibration, never by 1907 image pixels.
export async function createNature1907({terrain,historical,world,groundAt,buildings,settlement,channel,infrastructure}){
 const [exp,data]=await Promise.all(['/gis/control_points/doseong_modern_preview.json','/gis/vegetation/doseong_trees.json'].map(async url=>{const r=await fetch(url);if(!r.ok)throw Error('Nature data unavailable');return r.json()}));
 const points=[...exp.landmarks,...exp.suggested_anchors],R=6378137,project=(lon,lat)=>[R*lon*Math.PI/180,R*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))],warp=DoseongWarp.fitTerrainTPS(points.map(p=>p.pixel),points.map(p=>project(p.lon,p.lat)),exp.terrain_alignment);
 const [iw,ih]=exp.image_size,grid=[];
 for(let j=0;j<=112;j++)for(let i=0;i<=128;i++)grid.push(world(...warp(i*iw/128,j*ih/112),0));
 const source=(px,py)=>{const u=px/iw*128,v=py/ih*112,i=Math.min(127,Math.floor(u)),j=Math.min(111,Math.floor(v)),a=u-i,b=v-j,k=j*129+i,ids=a>=b?[k,k+1,k+130]:[k,k+129,k+130],weights=a>=b?[1-a,a-b,b]:[1-b,b-a,a],p=new THREE.Vector3();ids.forEach((id,n)=>p.addScaledVector(grid[id],weights[n]));p.y=groundAt(p.x,p.z);return p};
 if(data.source_sha256!==exp.input_sha256)throw Error('Woodland source mismatch');
 const granite=createGranite([terrain.material,historical.material],source),trees=createTrees(data,source,{children:buildings},settlement,channel.path,{segments:[...infrastructure.wall.segments,...infrastructure.palaceWalls.flatMap(w=>w.segments)]},granite);
 trees.updateGround((x,z)=>{const y=groundAt(x,z);return {min:y,max:y,terrain:{min:y,max:y}}});trees.updateHeights(1);
 const groundColors=createGroundColors(terrain.material,terrain.geometry,trees.records);
 document.getElementById('granite3d').onchange=e=>granite.setEnabled(e.target.checked);
 return {granite,trees,groundColors,source};
}
