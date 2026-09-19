import {createSettlement} from './settlement.js';

// The same small hanok models/instancing as 1750, with independent 1907 placement evidence.
export function createSettlement1907(data,infra,surface,buildings,inversePixel){
 let seed=data.seed>>>0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const segments=(pts,width)=>pts.slice(1).map((b,i)=>({a:surface(...pts[i]),b:surface(...b),width:typeof width==='function'?width(i):width}));
 const roads=infra.roads.features.flatMap(r=>segments(r.centerline,r.width_m/2));
 const water=segments(infra.river.centerline,i=>Math.max(infra.river.half_widths_px[i],infra.river.half_widths_px[i+1]??0)*2.2+4);
 const walls=segments(infra.wall.centerline,infra.wall.width_m/2+4);
 const distance=(x,z,s)=>{const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,t=Math.max(0,Math.min(1,((x-s.a.x)*dx+(z-s.a.z)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-s.a.x-t*dx,z-s.a.z-t*dz)};
 const within=(p,poly)=>{let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside};
 const candidates=[],records=[],cells=new Map(),cell=24,rejected={};
 const reject=reason=>{rejected[reason]=(rejected[reason]??0)+1;return false};
 const candidate=(x,z,w,d,h,yaw,mapped=false)=>({x,z,w,d,h,yaw,mapped,shop:!mapped&&random()<.2,rank:0,style:random(),radius:Math.hypot(w+2,d+2)/2,order:random()});
 // Individually read small symbols take priority over randomized roadside infill.
 for(const pixel of data.mapped_centers){const p=surface(...pixel),r=candidate(p.x,p.z,4+random()*2,4+random()*2,2.2+random()*.7,random()*.5,true);r.pixel=pixel;candidates.push(r)}
 for(const road of roads){
  const dx=road.b.x-road.a.x,dz=road.b.z-road.a.z,length=Math.hypot(dx,dz);if(length<1)continue;
  for(let along=random()*data.road_spacing_m;along<length;along+=data.road_spacing_m*(.8+random()*.5))for(const side of [-1,1])for(let row=0;row<2;row++){
   const w=5+random()*5,d=4.5+random()*4,h=2.3+random()*1.1,offset=road.width+Math.hypot(w+2,d+2)/2+3+random()*8+row*21;
   const x=road.a.x+dx*along/length-dz/length*offset*side,z=road.a.z+dz*along/length+dx/length*offset*side;
   // +Z points towards the street, +X follows its frontage.
   const yaw=Math.atan2(dz/length*side,-dx/length*side);
   candidates.push(candidate(x,z,w,d,h,yaw));
  }
 }
 candidates.sort((a,b)=>Number(b.mapped)-Number(a.mapped)||a.order-b.order);
 for(const r of candidates){
  if(records.length>=data.max_houses)break;
  const {x,z,radius}=r,pixel=r.pixel??inversePixel(x,z);r.pixel=pixel;
  if(data.excluded_polygons.some(poly=>within(pixel,poly))){reject('precinct');continue}
  if(roads.some(s=>distance(x,z,s)<s.width+radius+1)){reject('road');continue}
  if(water.some(s=>distance(x,z,s)<s.width+radius)){reject('water');continue}
  if(walls.some(s=>distance(x,z,s)<s.width+radius)){reject('wall');continue}
  if(buildings.some(b=>Math.hypot(x-b.position.x,z-b.position.z)<Math.hypot(b.userData.feature.symbol_size_m[0],b.userData.feature.symbol_size_m[2])/2+radius+8)){reject('landmark');continue}
  const heights=[];for(const a of [-.5,0,.5])for(const b of [-.5,0,.5]){const dx=a*(r.w+2),dz=b*(r.d+2);heights.push(surface.ground(x+dx*Math.cos(r.yaw)+dz*Math.sin(r.yaw),z-dx*Math.sin(r.yaw)+dz*Math.cos(r.yaw)))}
  if(heights.some(v=>v===null||!Number.isFinite(v))||Math.max(...heights)>120||Math.max(...heights)-Math.min(...heights)>1.1){reject('slope');continue}
  const ix=Math.floor(x/cell),iz=Math.floor(z/cell);let clash=false;
  for(let a=ix-1;a<=ix+1;a++)for(let b=iz-1;b<=iz+1;b++)for(const other of cells.get(a+','+b)??[])if(Math.hypot(x-other.x,z-other.z)<radius+other.radius+1)clash=true;
  if(clash){reject('house');continue}
  r.support={min:Math.min(...heights),max:Math.max(...heights)};r.support.terrain={...r.support};r.temporal=data.temporal;
  records.push(r);const key=ix+','+iz;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(r);
 }
 const settlement=createSettlement({features:[]},surface,surface.ground,{children:buildings},[],[],{records,density:1,lodDistance:800});
 settlement.group.name='estimated-houses-1907';settlement.updateHeights(1);
 return Object.assign(settlement,{stats:{candidates:candidates.length,accepted:records.length,mapped:records.filter(r=>r.mapped).length,rejected}});
}
