// Fixed left-thumb stick. Pointer capture keeps movement alive outside the ring.
export function createWalkJoystick(element,isActive){
 const knob=element.querySelector('.joystick-knob'),value={x:0,y:0};
 let pointer=null,origin=null,radius=40;
 function reset(){
  const id=pointer;pointer=null;value.x=value.y=0;knob.style.transform='translate(0px,0px)';element.classList.remove('pressed');
  if(id!==null&&element.hasPointerCapture(id))element.releasePointerCapture(id);
 }
 function move(event){
  if(event.pointerId!==pointer)return;
  const dx=event.clientX-origin.x,dy=event.clientY-origin.y,length=Math.hypot(dx,dy),scale=length?Math.min(radius,length)/length:0;
  knob.style.transform=`translate(${dx*scale}px,${dy*scale}px)`;
  const strength=Math.max(0,(Math.min(1,length/radius)-.12)/.88);
  value.x=length?dx/length*strength:0;value.y=length?dy/length*strength:0;
 }
 element.addEventListener('pointerdown',event=>{
  if(!isActive()||pointer!==null)return;event.preventDefault();
  const rect=element.getBoundingClientRect();origin={x:rect.x+rect.width/2,y:rect.y+rect.height/2};radius=rect.width*.32;
  pointer=event.pointerId;element.setPointerCapture(pointer);element.classList.add('pressed');move(event);
 });
 element.addEventListener('pointermove',move);
 for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,event=>{if(event.pointerId===pointer)reset()});
 element.addEventListener('contextmenu',event=>event.preventDefault());
 window.addEventListener('resize',reset);
 return {value,reset};
}
