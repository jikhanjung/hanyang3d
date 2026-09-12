/* Thin plate spline with affine polynomial and zero smoothing.
 * Kernel and block system: scipy.interpolate.RBFInterpolator documentation.
 * Input/output normalization improves conditioning; no survey accuracy is implied.
 */
(function(root){
  function solve(a,b){
    const n=a.length,m=b[0].length,rows=a.map((r,i)=>[...r,...b[i]]);
    for(let k=0;k<n;k++){
      let pivot=k;for(let i=k+1;i<n;i++)if(Math.abs(rows[i][k])>Math.abs(rows[pivot][k]))pivot=i;
      if(Math.abs(rows[pivot][k])<1e-12)throw Error('점이 중복되거나 한 직선에 모여 변환을 계산할 수 없습니다.');
      [rows[k],rows[pivot]]=[rows[pivot],rows[k]];
      const d=rows[k][k];for(let j=k;j<n+m;j++)rows[k][j]/=d;
      for(let i=0;i<n;i++)if(i!==k){const factor=rows[i][k];for(let j=k;j<n+m;j++)rows[i][j]-=factor*rows[k][j]}
    }
    return rows.map(r=>r.slice(n));
  }
  const kernel=(a,b)=>{const r2=(a[0]-b[0])**2+(a[1]-b[1])**2;return r2===0?0:0.5*r2*Math.log(r2)};
  function fitTPS(source,target){
    const n=source.length;
    if(n<3||n>40||target.length!==n)throw Error('대응점은 3~40개가 필요합니다.');
    if([...source,...target].some(p=>p.length!==2||p.some(v=>!Number.isFinite(v))))throw Error('유효하지 않은 좌표입니다.');
    const origin=source[0],targetOrigin=target[0];
    const scale=Math.max(...source.flatMap(p=>p.map((v,i)=>Math.abs(v-origin[i]))));
    if(!scale)throw Error('서로 다른 원본 위치가 필요합니다.');
    const targetScale=Math.max(1,...target.flatMap(p=>p.map((v,i)=>Math.abs(v-targetOrigin[i]))));
    const sites=source.map(p=>p.map((v,i)=>(v-origin[i])/scale));
    for(let i=0;i<n;i++)for(let j=0;j<i;j++)if(Math.hypot(sites[i][0]-sites[j][0],sites[i][1]-sites[j][1])<1e-8)throw Error('중복된 원본 위치입니다.');
    const a=Array.from({length:n+3},()=>Array(n+3).fill(0));
    sites.forEach((p,i)=>{sites.forEach((q,j)=>a[i][j]=kernel(p,q));[1,...p].forEach((v,j)=>{a[i][n+j]=v;a[n+j][i]=v})});
    const b=target.map(p=>p.map((v,i)=>(v-targetOrigin[i])/targetScale)).concat([[0,0],[0,0],[0,0]]);
    const coefficients=solve(a,b);
    return (x,y)=>{const p=[(x-origin[0])/scale,(y-origin[1])/scale],basis=sites.map(q=>kernel(p,q)).concat([1,...p]);
      return [0,1].map(axis=>targetOrigin[axis]+targetScale*basis.reduce((sum,v,i)=>sum+v*coefficients[i][axis],0))};
  }
  function barycentric(p,a,b,c){
    const det=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
    if(Math.abs(det)<1e-10)return null;
    const u=((b.y-c.y)*(p.x-c.x)+(c.x-b.x)*(p.y-c.y))/det;
    const v=((c.y-a.y)*(p.x-c.x)+(a.x-c.x)*(p.y-c.y))/det;
    return [u,v,1-u-v];
  }
  function fitTerrainTPS(source,target,config){
    const base=fitTPS(source,target);if(!config)return base;
    const polygon=config.flat_core_polygon;
    function weight(x,y){
      let inside=false,distance=Infinity;
      for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
        const a=polygon[j],b=polygon[i],dx=b[0]-a[0],dy=b[1]-a[1];
        if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
        const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));
        distance=Math.min(distance,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy));
      }
      if(inside)return 0;
      const t=Math.min(1,distance/config.transition_pixels);return t*t*(3-2*t);
    }
    const R=6378137,project=p=>[R*p.lon*Math.PI/180,R*Math.log(Math.tan(Math.PI/4+p.lat*Math.PI/360))];
    // Boundary values are modelling constraints, not additional surveyed controls.
    const pins=polygon.filter(p=>!source.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<.001));
    const sites=source.concat(pins,config.anchors.map(p=>p.pixel));
    const targets=target.concat(pins.map(p=>base(...p)),config.anchors.map(p=>{
      const b=base(...p.pixel),q=project(p),w=weight(...p.pixel);
      if(w<.01)throw Error('산지 대응점이 평지 보호 영역 안에 있습니다.');
      return b.map((v,i)=>v+(q[i]-v)/w);
    }));
    const outer=fitTPS(sites,targets);
    return (x,y)=>{const b=base(x,y),w=weight(x,y);if(!w)return b;const q=outer(x,y);return b.map((v,i)=>v+w*(q[i]-v))};
  }
  const api={fitTPS,fitTerrainTPS,barycentric};root.DoseongWarp=api;
  if(typeof module!=='undefined')module.exports=api;
})(globalThis);
