import * as THREE from 'three';

// A world-fixed horizontal compass, viewed with the map camera's exact orientation.
export function createCompass3D(element){
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x000000,0);element.append(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,20);
 scene.add(new THREE.HemisphereLight(0xffffff,0x72808a,2.2));
 const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(-2,4,3);scene.add(light);
 const red=new THREE.MeshStandardMaterial({color:0xd9302b,roughness:.5,metalness:.12});
 const silver=new THREE.MeshStandardMaterial({color:0xe5e9eb,roughness:.5,metalness:.18});
 function needle(tip,material,name){
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([-.22,0,0,.22,0,0,0,0,tip,0,.105,tip*.25,0,-.065,tip*.25],3));
  const indices=[0,3,2,2,3,1,0,1,3,0,2,4,2,1,4,0,4,1];
  if(tip>0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  g.setIndex(indices);g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,material);mesh.name=name;scene.add(mesh);return mesh;
 }
 const north=needle(-1,red,'north-needle'),south=needle(1,silver,'south-needle');
 const ring=new THREE.Mesh(new THREE.TorusGeometry(1.13,.015,6,64),new THREE.MeshStandardMaterial({color:0x708078,transparent:true,opacity:.65,roughness:1}));
 ring.rotation.x=Math.PI/2;scene.add(ring);
 const hub=new THREE.Mesh(new THREE.SphereGeometry(.095,12,8),new THREE.MeshStandardMaterial({color:0x414d49,metalness:.3,roughness:.4}));scene.add(hub);
 function label(letter,z,color){
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
  const ctx=canvas.getContext('2d');ctx.font='bold 44px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=5;ctx.strokeStyle='#fffdf3';ctx.strokeText(letter,32,34);ctx.fillStyle=color;ctx.fillText(letter,32,34);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:true,depthWrite:false}));sprite.position.set(0,.16,z);sprite.scale.set(.36,.36,1);scene.add(sprite);
 }
 label('N',-1.32,'#bf2723');label('S',1.32,'#34483e');
 const direction=new THREE.Vector3();let heading=0,lastWidth=0,lastHeight=0;
 function update(source){
  const width=element.clientWidth,height=element.clientHeight;
  if(width!==lastWidth||height!==lastHeight){renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();lastWidth=width;lastHeight=height}
  camera.quaternion.copy(source.quaternion);camera.position.set(0,0,4.8).applyQuaternion(camera.quaternion);camera.updateMatrixWorld();
  source.getWorldDirection(direction);
  if(Math.hypot(direction.x,direction.z)>1e-8)heading=(Math.atan2(direction.x,-direction.z)*180/Math.PI+360)%360;
  const pitch=Math.asin(THREE.MathUtils.clamp(direction.y,-1,1))*180/Math.PI;
  element.dataset.yaw=heading.toFixed(2);element.dataset.pitch=pitch.toFixed(2);
  element.setAttribute('aria-label',`북쪽을 가리키는 수평 나침반. 시선 방위 ${Math.round(heading)%360}도, 상하 기울기 ${Math.round(pitch)}도`);
  renderer.render(scene,camera);
 }
 return {update,renderer,scene,camera,north,south,ring};
}
