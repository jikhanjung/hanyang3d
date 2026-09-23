// A full-screen dreamlike curtain (deep indigo, drifting mist, breathing caption, blurred scene) for moving between scenes without showing the overview in between: the leaving page
// fades to black with a caption, the arriving page starts black (see the inline script in the template), keeps the
// loading text readable on the curtain, and lifts it only once the walker stands in first person again.
const KEY='hanyang3d-curtain';
function element(){
 let c=document.getElementById('scene-curtain');
 if(c)return c;
 c=document.createElement('div');c.id='scene-curtain';c.setAttribute('role','status');c.setAttribute('aria-live','polite');
 c.innerHTML='<strong class="curtain-caption"></strong><progress class="curtain-bar" max="1" value="0" hidden></progress><small class="curtain-progress"></small>';c.hidden=true;document.body.append(c);return c;
}
export function createSceneCurtain(){
 const c=element(),caption=c.querySelector('.curtain-caption'),progress=c.querySelector('.curtain-progress');
 // Pages that opened behind the pre-paint curtain have no bar yet; add one so loading shows as progress.
 let bar=c.querySelector('.curtain-bar');if(!bar){bar=document.createElement('progress');bar.className='curtain-bar';bar.max=1;bar.value=0;bar.hidden=true;caption.after(bar)}
 let mirror=null;
 // While the scene loads behind the curtain, echo the loading card's message so the wait is not a blank screen.
 // While the scene loads behind the curtain, echo the loading card's message and step bar on the curtain itself.
 function mirrorLoading(){const message=document.getElementById('loading-message'),source=document.getElementById('loading-progress');if(!message)return;clearInterval(mirror);bar.hidden=!source;
  const tick=()=>{progress.textContent=message.textContent;if(source){bar.max=source.max||1;bar.value=source.value}if(document.getElementById('scene-loading')?.hidden){bar.value=bar.max;progress.textContent='';clearInterval(mirror)}};tick();mirror=setInterval(tick,150)}
 return {
  get holding(){return !c.hidden&&c.classList.contains('opaque')&&!c.classList.contains('lifting')},
  // Fade to black, then resolve so the caller can navigate.
  show(text){caption.textContent=text;progress.textContent='';bar.hidden=true;c.hidden=false;c.classList.remove('lifting','opaque');void c.offsetWidth;c.classList.add('opaque');document.body.classList.add('dizzy');return new Promise(resolve=>setTimeout(resolve,1500))},
  // A page that opened behind the curtain (the inline script set it opaque before first paint).
  hold(text){caption.textContent=text;c.hidden=false;c.classList.add('opaque');c.classList.remove('lifting');document.body.classList.add('dizzy');mirrorLoading()},
  hide(){if(c.hidden)return;clearInterval(mirror);progress.textContent='';bar.hidden=true;c.classList.add('lifting');c.classList.remove('opaque');document.body.classList.remove('dizzy');document.documentElement.classList.remove('curtain-start');setTimeout(()=>{c.hidden=true;c.classList.remove('lifting')},1750)},
  // The departing page notes the caption for the next page so the arrival starts dark with the same words.
  remember(text){try{sessionStorage.setItem(KEY,text)}catch{}},
  take(){try{const t=sessionStorage.getItem(KEY);sessionStorage.removeItem(KEY);return t}catch{return null}},
 };
}
