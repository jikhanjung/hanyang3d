import * as THREE from 'three';
import {hipGableRoof} from './throne_hall.js';

// An explorable interpretation, not a surveyed 1907 interior or a sales inventory.
export function createBookshop1907(feature,w,h,d){
 const group=new THREE.Group();group.name='hoedong-bookshop';
 const detail=new THREE.Group();detail.name='bookshop-books-and-shelves';
 const mats=Object.fromEntries(Object.entries({wall:0xd5c8ae,wood:0x624737,floor:0xa78c68,roof:0x3e484c,pages:0xd8c7a0}).map(([k,color])=>[k,new THREE.MeshStandardMaterial({color,roughness:1})]));
 mats.roof.side=THREE.DoubleSide; // Render the roof underside when walking indoors.
 const blocks=[],walkSurfaces=[],cameraShell=[];
 const box=(parent,name,x,y,z,sx,sy,sz,mat,blocking=false)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mats[mat]);m.name=name;m.position.set(x,y-h/2,z);parent.add(m);if(blocking){blocks.push({x,z,hw:sx/2,hd:sz/2});cameraShell.push(m)}return m};
 const X=w*.475,Z=d*.45,floor=.3;
 const slab=box(group,'bookshop-floor',0,floor/2,0,w,floor,d,'floor');walkSurfaces.push(slab);
 for(const sign of [-1,1])box(group,'bookshop-side-wall',sign*X,2.1,0,.22,3.6,Z*2,'wall',true);
 box(group,'bookshop-back-wall',0,2.1,-Z,X*2,3.6,.22,'wall',true);
 const door=2.8,wing=X-door/2;
 for(const sign of [-1,1])box(group,'bookshop-front-wall',sign*(door/2+wing/2),2.1,Z,wing,3.6,.22,'wall',true);
 box(group,'door-lintel',0,3.55,Z,door,.7,.24,'wood');
 const roof=new THREE.Mesh(hipGableRoof(w+1,d+1.5,1.8,.45,.05),mats.roof);roof.position.y=4.1-h/2;group.add(roof);cameraShell.push(roof);
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle='#ded0ac';ctx.fillRect(0,0,512,128);ctx.fillStyle='#302920';ctx.font='bold 80px serif';ctx.textAlign='center';ctx.fillText('匯東書館',256,92);
 const sign=box(group,'bookshop-sign',0,3.6,Z+.15,w*.55,.7,.12,'wood');sign.material=new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(canvas)});
 const books=[];
 function shelf(x,z,length,turn=0){
  const shelf=new THREE.Group();shelf.position.set(x,0,z);shelf.rotation.y=turn;detail.add(shelf);
  box(shelf,'shelf-back',0,1.65,-.23,length,2.7,.09,'wood');
  for(const s of [-1,1])box(shelf,'shelf-side',s*length/2,1.65,0,.10,2.7,.6,'wood');
  for(let level=0;level<4;level++){
   const y=.5+level*.62;box(shelf,'shelf-board',0,y,0,length,.08,.6,'wood');
   for(let j=0;j<Math.floor(length/.34);j++){
    const bx=-length/2+.2+j*.34;
    // Thread-bound volumes lie flat in varied stacks, rather than modern hardbacks.
    for(let k=0;k<2+(j+level)%3;k++)books.push({x:x+bx*Math.cos(turn),z:z-bx*Math.sin(turn),y:y+.09+k*.1,turn,color:(j+level)%4});
   }
  }
  blocks.push({x,z,hw:turn? .38:length/2+.08,hd:turn?length/2+.08:.38});
  // Collision shell stays in the base model even when fine shelves are out of LOD.
  const shell=box(group,'shelf-camera-shell',x,1.65,z,turn?.65:length+.12,2.7,turn?length+.12:.65,'wood');shell.material=new THREE.MeshBasicMaterial({visible:false});cameraShell.push(shell);
 }
 shelf(-X+.65,0,7,Math.PI/2);shelf(X-.65,0,7,-Math.PI/2);
 shelf(0,-Z+.55,10);shelf(-2.8,.1,3.8,Math.PI/2);shelf(2.8,.1,3.8,-Math.PI/2);
 // A short screen gives the back-left reading corner some privacy, with an open passage.
 shelf(-5,-1.6,2.6);
 box(group,'bookseller-counter',4.8,.8,3.6,3,1,1,'wood',true);
 const bookGeo=new THREE.BoxGeometry(.29,.075,.42),coverGeo=new THREE.BoxGeometry(.31,.015,.44),matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(1,1,1);
 const pages=new THREE.InstancedMesh(bookGeo,mats.pages,books.length),covers=new THREE.InstancedMesh(coverGeo,new THREE.MeshStandardMaterial({roughness:1}),books.length);pages.name='book-pages';covers.name='book-covers';
 const palette=[0x3d5364,0x754c3c,0x526454,0x8d7747];
 for(const [i,b] of books.entries()){
  rotation.setFromAxisAngle(new THREE.Vector3(0,1,0),b.turn);position.set(b.x,b.y-h/2,b.z);matrix.compose(position,rotation,scale);pages.setMatrixAt(i,matrix);
  position.y+=.045;matrix.compose(position,rotation,scale);covers.setMatrixAt(i,matrix);covers.setColorAt(i,new THREE.Color(palette[b.color]));
 }
 detail.add(pages,covers);group.add(detail);
 const light=new THREE.PointLight(0xffe3b0,22,18,2);light.position.set(0,3-h/2,0);group.add(light);
 Object.assign(group.userData,{parts:['open-door','shelves','thread-bound-books'],conceptual:true,blockingRects:blocks,walkSurfaces,cameraShell,closeDetail:detail,closeDistance:110,bookCount:books.length,
  interior:{volumes:[[-X+.15,floor,-Z+.15,X-.15,3.85,Z+.12]]},accessFront:d/2,accessHeight:floor,
  booksellerRoute:[[0,2.6],[4.8,1.8],[4.8,-3.1],[0,-3.1],[-4.9,-3.1],[0,-3.1],[0,2.6]],
  privateCorner:{x0:-6.3,x1:-4,z0:-4.1,z1:-2.6}});
 return group;
}
