// North-up mini-map baked from the same calibrated texture triangles as the scene.
export function createNavigation1907(geometry,texture){
 const panel=document.getElementById('first-person-map'),map=document.getElementById('walking-minimap'),ctx=map.getContext('2d');
 const size=240,span=1200,baked=document.createElement('canvas');baked.width=baked.height=2048;
 const p=geometry.attributes.position,uv=geometry.attributes.uv,n=Math.round(Math.sqrt(p.count)),ids=[];
 for(let j=0;j<n-1;j+=8)for(let i=0;i<n-1;i+=8){const x=Math.min(n-1,i+8),y=Math.min(n-1,j+8),a=j*n+i,b=j*n+x,c=y*n+i,d=y*n+x;ids.push(a,d,b,a,c,d)}
 let ready=false,minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
 for(let i=0;i<p.count;i++){minX=Math.min(minX,p.getX(i));maxX=Math.max(maxX,p.getX(i));minZ=Math.min(minZ,p.getZ(i));maxZ=Math.max(maxZ,p.getZ(i))}
 const scale=2048/Math.max(maxX-minX,maxZ-minZ),image=texture.image;
 function bake(){if(ready)return;const b=baked.getContext('2d');b.fillStyle='#d6c7a8';b.fillRect(0,0,2048,2048);
  for(let i=0;i<ids.length;i+=3){const triangle=[ids[i],ids[i+1],ids[i+2]],src=triangle.map(k=>[uv.getX(k)*image.width,(1-uv.getY(k))*image.height]),dst=triangle.map(k=>[(p.getX(k)-minX)*scale,(p.getZ(k)-minZ)*scale]);
   const [a,c,d]=src,[u,v,w]=dst,dx=c[0]-a[0],dy=c[1]-a[1],ex=d[0]-a[0],ey=d[1]-a[1],det=dx*ey-ex*dy;if(Math.abs(det)<1e-9)continue;
   const aa=((v[0]-u[0])*ey-(w[0]-u[0])*dy)/det,cc=((w[0]-u[0])*dx-(v[0]-u[0])*ex)/det,bb=((v[1]-u[1])*ey-(w[1]-u[1])*dy)/det,dd=((w[1]-u[1])*dx-(v[1]-u[1])*ex)/det;
   b.save();b.beginPath();b.moveTo(...u);b.lineTo(...v);b.lineTo(...w);b.closePath();b.clip();b.setTransform(aa,bb,cc,dd,u[0]-aa*a[0]-cc*a[1],u[1]-bb*a[0]-dd*a[1]);b.drawImage(image,0,0);b.restore();
  }ready=true;
 }
 function update(yaw,at){ctx.clearRect(0,0,size,size);ctx.fillStyle='#d6c7a8';ctx.fillRect(0,0,size,size);ctx.drawImage(baked,(at.x-span/2-minX)*scale,(at.z-span/2-minZ)*scale,span*scale,span*scale,0,0,size,size);ctx.save();ctx.translate(size/2,size/2);ctx.rotate(-yaw);ctx.fillStyle='#006fa8';ctx.strokeStyle='white';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(7,8);ctx.lineTo(0,5);ctx.lineTo(-7,8);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();ctx.fillStyle='#24372e';ctx.font='bold 14px system-ui';ctx.fillText('N ↑',10,21);map.dataset.worldX=at.x;map.dataset.worldZ=at.z}
 return {show(yaw,at){bake();panel.hidden=false;update(yaw,at)},hide(){panel.hidden=true},update};
}
