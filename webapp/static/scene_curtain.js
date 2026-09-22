// A full-screen dreamlike curtain (deep indigo, drifting mist, breathing caption, blurred scene) for moving between scenes without showing the overview in between: the leaving page
// fades to black with a caption, the arriving page starts black (see the inline script in the template), keeps the
// loading text readable on the curtain, and lifts it only once the walker stands in first person again.
const KEY='hanyang3d-curtain';
function element(){
 let c=document.getElementById('scene-curtain');
 if(c)return c;
 c=document.createElement('div');c.id='scene-curtain';c.setAttribute('role','status');c.setAttribute('aria-live','polite');
 c.innerHTML='<strong class="curtain-caption"></strong><small class="curtain-progress"></small>';c.hidden=true;document.body.append(c);return c;
}
export function createSceneCurtain(){
 const c=element(),caption=c.querySelector('.curtain-caption'),progress=c.querySelector('.curtain-progress');
 let mirror=null;
 // While the scene loads behind the curtain, echo the loading card's message so the wait is not a blank screen.
 function mirrorLoading(){const message=document.getElementById('loading-message');if(!message)return;clearInterval(mirror);mirror=setInterval(()=>{progress.textContent=message.textContent;if(document.getElementById('scene-loading')?.hidden){progress.textContent='';clearInterval(mirror)}},200)}
 return {
  get holding(){return !c.hidden&&c.classList.contains('opaque')&&!c.classList.contains('lifting')},
  // Fade to black, then resolve so the caller can navigate.
  show(text){caption.textContent=text;progress.textContent='';c.hidden=false;c.classList.remove('lifting','opaque');void c.offsetWidth;c.classList.add('opaque');document.body.classList.add('dizzy');return new Promise(resolve=>setTimeout(resolve,1500))},
  // A page that opened behind the curtain (the inline script set it opaque before first paint).
  hold(text){caption.textContent=text;c.hidden=false;c.classList.add('opaque');c.classList.remove('lifting');document.body.classList.add('dizzy');mirrorLoading()},
  hide(){if(c.hidden)return;clearInterval(mirror);progress.textContent='';c.classList.add('lifting');c.classList.remove('opaque');document.body.classList.remove('dizzy');document.documentElement.classList.remove('curtain-start');setTimeout(()=>{c.hidden=true;c.classList.remove('lifting')},1750)},
  // The departing page notes the caption for the next page so the arrival starts dark with the same words.
  remember(text){try{sessionStorage.setItem(KEY,text)}catch{}},
  take(){try{const t=sessionStorage.getItem(KEY);sessionStorage.removeItem(KEY);return t}catch{return null}},
 };
}
