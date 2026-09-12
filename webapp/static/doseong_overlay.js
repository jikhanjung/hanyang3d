/* Interactive visual exploration; all edited anchors remain proposed. */
const experiment=JSON.parse(document.getElementById('experiment').textContent),el=id=>document.getElementById(id);
const map=L.map('map',{zoomAnimation:false,minZoom:10,maxZoom:18}).setView([37.577,126.987],13);
const attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';
const bases={topo:L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{maxNativeZoom:17,maxZoom:18,attribution:attribution+' | SRTM | <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'}),osm:L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution})};
bases.topo.addTo(map);
for(const layer of Object.values(bases))layer.on('tileerror',()=>{if(map.hasLayer(layer))el('status').textContent='배경 타일을 불러오지 못했습니다. 배경 지도를 바꾸거나 인터넷 연결을 확인하세요.'});
L.control.scale({imperial:false}).addTo(map);map.attributionControl.addAttribution('옛 지도: 서울역사박물관 · 공공누리 제1유형');
const matrix=experiment.matrix_pixel_to_3857,[width,height]=experiment.image_size;
const raw=(x,y)=>L.point(matrix[0][0]*x+matrix[0][1]*y+matrix[0][2],matrix[1][0]*x+matrix[1][1]*y+matrix[1][2]);
const center=raw(width/2,height/2),groundFactor=1/Math.cos(L.CRS.EPSG3857.unproject(center).lat*Math.PI/180);
const state={east:0,north:0,scale:100,rotation:0,opacity:50};let visible=true,points=structuredClone([...experiment.landmarks,...experiment.suggested_anchors]),tps=null,mesh=[],screenTriangles=[],folds=0,pending=null;
const picture=new Image(),cols=32,rows=28;
function transformed(p){const q=p.subtract(center),a=-state.rotation*Math.PI/180,s=state.scale/100;return L.point(center.x+s*(q.x*Math.cos(a)-q.y*Math.sin(a))+state.east*groundFactor,center.y+s*(q.x*Math.sin(a)+q.y*Math.cos(a))+state.north*groundFactor)}
function undoGlobal(p){const a=state.rotation*Math.PI/180,s=state.scale/100,q=L.point(p.x-center.x-state.east*groundFactor,p.y-center.y-state.north*groundFactor);return L.point(center.x+(q.x*Math.cos(a)-q.y*Math.sin(a))/s,center.y+(q.x*Math.sin(a)+q.y*Math.cos(a))/s)}
function projected(x,y){return el('method').value==='tps'?L.point(tps(x,y)):raw(x,y)}
function position(x,y){return L.CRS.EPSG3857.unproject(transformed(projected(x,y)))}
function rebuild(){tps=DoseongWarp.fitTerrainTPS(points.map(p=>p.pixel),points.map(p=>{const q=L.CRS.EPSG3857.project(L.latLng(p.lat,p.lon));return [q.x,q.y]}),experiment.terrain_alignment);mesh=[];for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const x=width*i/cols,y=height*j/rows;mesh.push({x,y,p:projected(x,y)})}}
rebuild();
function triangles(nodes){const result=[];for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+1,c=a+cols+1,d=c+1;result.push([nodes[a],nodes[b],nodes[d]],[nodes[a],nodes[d],nodes[c]])}return result}
function triangleDraw(ctx,tri,ratio){const [a,b,c]=tri,det=(b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);
 const ux=((b.screen.x-a.screen.x)*(c.y-a.y)-(c.screen.x-a.screen.x)*(b.y-a.y))/det,uy=((b.screen.y-a.screen.y)*(c.y-a.y)-(c.screen.y-a.screen.y)*(b.y-a.y))/det;
 const vx=((c.screen.x-a.screen.x)*(b.x-a.x)-(b.screen.x-a.screen.x)*(c.x-a.x))/det,vy=((c.screen.y-a.screen.y)*(b.x-a.x)-(b.screen.y-a.screen.y)*(c.x-a.x))/det;
 ctx.save();ctx.setTransform(ratio,0,0,ratio,0,0);ctx.beginPath();const mid=L.point((a.screen.x+b.screen.x+c.screen.x)/3,(a.screen.y+b.screen.y+c.screen.y)/3);
 tri.forEach((n,i)=>{const v=n.screen.subtract(mid),length=Math.max(v.distanceTo([0,0]),1),p=n.screen.add(v.multiplyBy(0.4/length));i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)});ctx.closePath();ctx.clip();
 ctx.setTransform(ratio*ux,ratio*uy,ratio*vx,ratio*vy,ratio*(a.screen.x-ux*a.x-vx*a.y),ratio*(a.screen.y-uy*a.x-vy*a.y));ctx.drawImage(picture,0,0,width,height);ctx.restore();
}
const Overlay=L.Layer.extend({
 onAdd:function(m){this._map=m;this.canvas=L.DomUtil.create('canvas','doseong-canvas');this.buffer=document.createElement('canvas');m.getPanes().overlayPane.appendChild(this.canvas);m.on('move zoom resize',this.draw,this);this.draw()},
 onRemove:function(m){m.off('move zoom resize',this.draw,this);this.canvas.remove()},
 draw:function(){const size=map.getSize(),ratio=devicePixelRatio||1,c=this.canvas;c.width=Math.round(size.x*ratio);c.height=Math.round(size.y*ratio);c.style.width=size.x+'px';c.style.height=size.y+'px';L.DomUtil.setPosition(c,map.containerPointToLayerPoint([0,0]));
 const nodes=mesh.map(n=>({...n,screen:map.latLngToContainerPoint(L.CRS.EPSG3857.unproject(transformed(n.p)))}));screenTriangles=triangles(nodes);
 folds=screenTriangles.filter(([a,b,c])=>(b.screen.x-a.screen.x)*(c.screen.y-a.screen.y)-(b.screen.y-a.screen.y)*(c.screen.x-a.screen.x)<=0).length;
 if(folds)el('warpStatus').textContent=`격자 ${folds}곳이 접히거나 뒤집혔습니다. 점 위치를 되돌려 확인하세요.`;
 else if(!pending)el('warpStatus').textContent=el('method').value==='tps'?`TPS 대응점 ${points.length}개 · 검토용 변형`:'최초 성문 3점의 전체 배치 · 추가점은 TPS에서 반영';
 if(!picture.complete||!picture.naturalWidth||!visible)return;
 const ctx=c.getContext('2d');ctx.globalAlpha=pending?.stage==='target'?0:state.opacity/100;
 if(el('method').value==='affine'){const a=map.latLngToContainerPoint(position(0,0)),b=map.latLngToContainerPoint(position(width,0)),d=map.latLngToContainerPoint(position(0,height));ctx.setTransform(ratio*(b.x-a.x)/width,ratio*(b.y-a.y)/width,ratio*(d.x-a.x)/height,ratio*(d.y-a.y)/height,ratio*a.x,ratio*a.y);ctx.drawImage(picture,0,0,width,height)}
 else{this.buffer.width=c.width;this.buffer.height=c.height;const bc=this.buffer.getContext('2d');for(const tri of screenTriangles){if(tri.every(n=>n.screen.x<0)||tri.every(n=>n.screen.x>size.x)||tri.every(n=>n.screen.y<0)||tri.every(n=>n.screen.y>size.y))continue;triangleDraw(bc,tri,ratio)}ctx.drawImage(this.buffer,0,0)}
 if(el('grid').checked&&pending?.stage!=='target'){ctx.setTransform(ratio,0,0,ratio,0,0);ctx.globalAlpha=0.65;ctx.strokeStyle=folds?'#c83122':'#1e6e97';ctx.lineWidth=0.6;ctx.beginPath();for(const tri of screenTriangles){ctx.moveTo(tri[0].screen.x,tri[0].screen.y);tri.slice(1).forEach(n=>ctx.lineTo(n.screen.x,n.screen.y));ctx.closePath()}ctx.stroke()}
 }
});
const overlay=new Overlay().addTo(map),anchors=L.layerGroup().addTo(map);
function markerPosition(p){return L.CRS.EPSG3857.unproject(transformed(L.CRS.EPSG3857.project(L.latLng(p.lat,p.lon))))}
function showPoints(){anchors.clearLayers();el('pointList').replaceChildren();points.forEach((p,i)=>{
 const icon=L.divIcon({className:'warp-point',html:`<span>${i+1}</span>`,iconSize:[24,24],iconAnchor:[12,12]});
 const tip=document.createElement('span');tip.textContent=p.name;
 const marker=L.marker(markerPosition(p),{icon,draggable:el('method').value==='tps',autoPan:true}).bindTooltip(tip).addTo(anchors);
 marker.on('dragend',()=>{const old=[p.lat,p.lon],q=L.CRS.EPSG3857.unproject(undoGlobal(L.CRS.EPSG3857.project(marker.getLatLng())));p.lat=q.lat;p.lon=q.lng;p.status='proposed_user_edit';try{rebuild()}catch(error){[p.lat,p.lon]=old;rebuild();el('status').textContent=error.message}overlay.draw();showPoints()});
 const row=document.createElement('div'),name=document.createElement('span');name.textContent=`${i+1}. ${p.name} `;row.append(name);
 if(i>=3){const button=document.createElement('button');button.textContent='삭제';button.onclick=()=>{points.splice(i,1);rebuild();showPoints();overlay.draw()};row.append(button)}el('pointList').append(row);
})}
function fit(){map.fitBounds(L.latLngBounds(mesh.map(n=>L.CRS.EPSG3857.unproject(transformed(n.p)))),{padding:[12,12]})}
function cancel(){pending=null;el('cancelPoint').hidden=true;el('addPoint').disabled=false;map.getContainer().style.cursor='';overlay.draw()}
function sourceAt(screen){if(folds)return null;for(const tri of screenTriangles){const w=DoseongWarp.barycentric(screen,...tri.map(n=>n.screen));if(w&&w.every(v=>v>=-1e-6&&v<=1+1e-6))return [w.reduce((s,v,i)=>s+v*tri[i].x,0),w.reduce((s,v,i)=>s+v*tri[i].y,0)]}return null}
el('addPoint').onclick=()=>{if(points.length>=40){el('status').textContent='대응점은 최대 40개입니다.';return}el('method').value='tps';rebuild();visible=true;el('toggle').textContent='옛 지도 숨기기';if(state.opacity<20){el('opacity').value=60;el('opacity').oninput()}showPoints();pending={stage:'source'};el('cancelPoint').hidden=false;el('addPoint').disabled=true;map.getContainer().style.cursor='crosshair';el('warpStatus').textContent='1/2 옛 지도에서 맞출 지점을 클릭하세요.';overlay.draw()};
el('cancelPoint').onclick=cancel;
map.on('click',event=>{if(!pending)return;if(pending.stage==='source'){const pixel=sourceAt(event.containerPoint);if(!pixel){el('warpStatus').textContent='접히지 않은 원도 영역 안에서 선택하세요.';return}pending={stage:'target',pixel};el('warpStatus').textContent='2/2 현재 지도에서 같은 지점을 클릭하세요. 옛 지도를 잠시 숨겼습니다.';overlay.draw()}
 else{const q=L.CRS.EPSG3857.unproject(undoGlobal(L.CRS.EPSG3857.project(event.latlng))),name=el('pointName').value.trim()||`사용자점 ${points.length+1}`;points.push({name,pixel:pending.pixel,lat:q.lat,lon:q.lng,status:'proposed_user_edit',note:'브라우저에서 원도와 배경 지도를 순서대로 클릭. 역사적 동일성 미검증.'});try{rebuild();cancel();showPoints();el('pointName').value=''}catch(error){points.pop();rebuild();cancel();el('status').textContent=error.message}}});
picture.onload=()=>{overlay.draw();el('status').textContent='원도 로드 완료 · 조절값은 저장 버튼으로 보관하세요.'};picture.onerror=()=>el('status').textContent='원도 로드 실패';picture.src=experiment.image_url;
for(const key of Object.keys(state))el(key).oninput=()=>{state[key]=Number(el(key).value);el(key+'Value').textContent=state[key]+({east:' m',north:' m',scale:'%',rotation:'°',opacity:'%'}[key]);overlay.draw();if(key!=='opacity')showPoints()};
el('base').onchange=()=>{Object.values(bases).forEach(layer=>{if(map.hasLayer(layer))map.removeLayer(layer)});if(bases[el('base').value])bases[el('base').value].addTo(map)};
el('anchors').onchange=()=>el('anchors').checked?anchors.addTo(map):map.removeLayer(anchors);
el('toggle').onclick=()=>{visible=!visible;el('toggle').textContent=visible?'옛 지도 숨기기':'옛 지도 보이기';overlay.draw()};el('fit').onclick=fit;el('grid').onchange=()=>overlay.draw();
el('method').onchange=()=>{cancel();rebuild();showPoints();overlay.draw()};
el('reset').onclick=()=>{cancel();for(const key of Object.keys(state)){el(key).value=key==='scale'?100:key==='opacity'?50:0;el(key).oninput()}visible=true;el('toggle').textContent='옛 지도 숨기기';fit()};
el('resetPoints').onclick=()=>{cancel();points=structuredClone([...experiment.landmarks,...experiment.suggested_anchors]);rebuild();showPoints();overlay.draw()};
el('save').onclick=()=>{const record={schema_version:1,status:'unvalidated_visual_preview',experiment,method:el('method').value,points,adjustments:{...state},mesh:[cols,rows],smoothing:0,independent_checks:0,folded_triangles:folds,translation_units:'approximate ground metres at image center',rotation_units:'clockwise degrees',scale_units:'percent',saved_at:new Date().toISOString()};const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='doseong-overlay-placement.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
el('load').onchange=async()=>{try{const file=el('load').files[0];if(!file)return;if(file.size>1000000)throw Error('파일이 너무 큽니다.');const record=JSON.parse(await file.text());if(record.experiment?.input_sha256!==experiment.input_sha256||!['affine','tps'].includes(record.method))throw Error('이 원도의 배치 기록이 아닙니다.');if(!Array.isArray(record.points)||record.points.length<3||record.points.length>40)throw Error('대응점 수가 유효하지 않습니다.');for(const p of record.points){if(typeof p.name!=='string'||p.name.length>100||!Array.isArray(p.pixel)||p.pixel.length!==2||!p.pixel.every(Number.isFinite)||p.pixel[0]<0||p.pixel[0]>width||p.pixel[1]<0||p.pixel[1]>height||!Number.isFinite(p.lat)||Math.abs(p.lat)>85||!Number.isFinite(p.lon)||Math.abs(p.lon)>180)throw Error('대응점 좌표가 유효하지 않습니다.')}
 for(const key of Object.keys(state)){const value=record.adjustments?.[key];if(!Number.isFinite(value)||value<Number(el(key).min)||value>Number(el(key).max))throw Error('조절값이 범위를 벗어났습니다.')}
 DoseongWarp.fitTPS(record.points.map(p=>p.pixel),record.points.map(p=>{const q=L.CRS.EPSG3857.project(L.latLng(p.lat,p.lon));return [q.x,q.y]}));
 cancel();points=record.points;el('method').value=record.method;for(const key of Object.keys(state))state[key]=record.adjustments[key];rebuild();for(const key of Object.keys(state)){el(key).value=state[key];el(key).oninput()}showPoints();fit();el('status').textContent='배치 기록을 불러왔습니다.';
 }catch(error){el('status').textContent='불러오기 실패: '+error.message}finally{el('load').value=''}};
showPoints();fit();
