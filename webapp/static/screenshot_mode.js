import {t} from './i18n.js';

// Shared by both eras. Keep the actual panel/checkbox state so restoring the HUD
// does not reopen closed windows or overwrite the user's display preferences.
export function createScreenshotMode({renderer,scene,camera,menu,era}){
 const canvas=renderer.domElement;canvas.classList.add('scene-capture-canvas');
 const style=document.createElement('style');style.textContent=`
 body.photo-mode>*:not(#scene):not(#original):not(script):not(style){visibility:hidden!important;pointer-events:none!important}
 body.photo-mode #scene>*:not(.scene-capture-canvas){visibility:hidden!important;pointer-events:none!important}
 body.photo-mode #scene .scene-capture-canvas{visibility:visible!important}
 body.photo-mode #original .leaflet-control-container{visibility:hidden!important;pointer-events:none!important}
 .photo-actions{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px}
 `;document.head.append(style);
 const actions=document.createElement('div');actions.className='photo-actions';
 const toggle=document.createElement('button');toggle.type='button';toggle.title=t('Alt+Z 또는 Esc로 UI 복원');toggle.textContent=t('UI 숨기기 · Alt+Z');
 const save=document.createElement('button');save.type='button';save.textContent=t('스크린샷 저장');save.title=t('UI 없는 PNG 저장 · Alt+P');
 actions.append(toggle,save);menu.append(actions);
 let hidden=false,capturing=false;
 // Only screen labels, not shop signs or other sprites belonging to the world.
 const labelNames=new Set(['building-name-labels','mountain-name-labels','district-name-labels','place-name-labels','player-name','calibration-labels']);
 const render=renderer.render.bind(renderer);
 renderer.render=(root,view)=>{
  if((!hidden&&!capturing)||root!==scene)return render(root,view);
  const labels=[];
  root.traverse(o=>{if(o.visible&&labelNames.has(o.name)){labels.push(o);o.visible=false}});
  try{return render(root,view)}finally{for(const o of labels)o.visible=true}
 };
 function setHidden(value){
  hidden=value;document.body.classList.toggle('photo-mode',hidden);
  toggle.setAttribute('aria-pressed',String(hidden));
  canvas.focus({preventScroll:true});renderer.render(scene,camera);
 }
 async function capture(){
  if(document.getElementById('scene').hidden){window.alert(t('3D 지형 화면에서 스크린샷을 저장해 주세요.'));return}
  if(capturing)return;capturing=true;save.disabled=true;
  try{
   // Render and read in the same task: works without preserveDrawingBuffer.
   renderer.render(scene,camera);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
   if(!blob)throw new Error('PNG capture failed');
   const url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download=`hanyang3d-${era}-${new Date().toISOString().replace(/[:.]/g,'-')}.png`;a.click();
   setTimeout(()=>URL.revokeObjectURL(url),10000);
  }catch(error){console.error(error);window.alert(t('스크린샷을 저장하지 못했습니다. 다시 시도해 주세요.'))}
  finally{capturing=false;save.disabled=false;renderer.render(scene,camera)}
 }
 toggle.onclick=()=>setHidden(!hidden);save.onclick=capture;
 document.addEventListener('keydown',event=>{
  if(event.target.matches?.('input,textarea,select,[contenteditable="true"]'))return;
  if(hidden&&event.code==='Escape'){event.preventDefault();event.stopImmediatePropagation();setHidden(false);return}
  if(!event.altKey||event.ctrlKey||event.metaKey)return;
  if(event.code!=='KeyZ'&&event.code!=='KeyP')return;
  event.preventDefault();event.stopPropagation();if(event.repeat)return;
  if(event.code==='KeyZ')setHidden(!hidden);else capture();
 },true);
 // A two-finger touch restores controls on phones without leaving a widget in the shot.
 const touches=new Set();
 canvas.addEventListener('pointerdown',event=>{if(event.pointerType!=='touch')return;touches.add(event.pointerId);if(hidden&&touches.size>=2)setHidden(false)});
 for(const type of ['pointerup','pointercancel'])canvas.addEventListener(type,event=>touches.delete(event.pointerId));
 return {capture,setHidden,get hidden(){return hidden}};
}
