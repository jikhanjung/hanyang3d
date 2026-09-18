// Pure transform shared with the multiplayer route simulation.
export function createMap1907Transform(cfg,bounds){
 const [xmin,ymin,xmax,ymax]=bounds,cx=(xmin+xmax)/2,cy=(ymin+ymax)/2,R=6378137;
 const scale=Math.cos(2*Math.atan(Math.exp(cy/R))-Math.PI/2);
 const c=cfg.coefficients;
 const det=c[1][0]*c[2][1]-c[2][0]*c[1][1];if(!Number.isFinite(det)||Math.abs(det)<1e-8)throw Error('Map transform');
 // Compact mountain registration moves map coordinates, never DEM heights.
 // Both model placement and texture UVs must use the same reversible transform.
 const anchors=cfg.local_calibration?.anchors??[];
 const displacement=(x,y)=>{let dx=0,dy=0;for(const a of anchors){const r=Math.hypot(x-a.pixel[0],y-a.pixel[1])/a.radius_px;if(r>=1)continue;const k=(1-r)**4*(1+4*r);dx+=k*a.weight_px[0];dy+=k*a.weight_px[1]}return [dx,dy]};
 const project=(x,y)=>{const [dx,dy]=displacement(x,y);x+=dx;y+=dy;return [c[0][0]+x*c[1][0]+y*c[2][0],c[0][1]+x*c[1][1]+y*c[2][1]]};
 const inverse=(x,y)=>{x-=c[0][0];y-=c[0][1];const u=(x*c[2][1]-y*c[2][0])/det,v=(y*c[1][0]-x*c[1][1])/det;let px=u,py=v;for(let i=0;i<100;i++){const [dx,dy]=displacement(px,py),nx=u-dx,ny=v-dy;if(Math.hypot(nx-px,ny-py)<1e-7)return [nx,ny];px=nx;py=ny}throw Error('Local map inverse did not converge')};

 return {project,inverse,scale,cx,cy,sourceXZ:(px,py)=>{const [x,y]=project(px,py);return {x:(x-cx)*scale,z:-(y-cy)*scale}}};
}
