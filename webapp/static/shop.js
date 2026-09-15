// MMORPG-style shop window and coin display. The server owns coins and packs: this module only shows the state the
// server returns (GET /api/player/) and sends account and trade requests; prices, stock and passwords are checked there. Prices are play values, not historical prices.
function drawIcon(icon,size=48){
 const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');
 g.fillStyle='#3a2c1f';g.fillRect(0,0,size,size);g.fillStyle='#5a4631';g.fillRect(2,2,size-4,size-4);
 if(icon.shape==='fish'){
  for(let i=0;i<3;i++){g.fillStyle=icon.color;g.beginPath();g.ellipse(size*.3+i*size*.2,size*.52,size*.07,size*.28,0,0,Math.PI*2);g.fill();
   g.fillStyle='rgba(0,0,0,.25)';g.beginPath();g.moveTo(size*.25+i*size*.2,size*.82);g.lineTo(size*.35+i*size*.2,size*.82);g.lineTo(size*.3+i*size*.2,size*.93);g.fill()}
 }else if(icon.shape==='roll'){
  g.fillStyle=icon.color;g.fillRect(size*.18,size*.3,size*.64,size*.42);
  g.fillStyle='rgba(0,0,0,.18)';g.beginPath();g.ellipse(size*.82,size*.51,size*.08,size*.21,0,0,Math.PI*2);g.fill();
  g.strokeStyle='rgba(60,40,20,.35)';g.strokeRect(size*.18,size*.3,size*.64,size*.42);
 }else{
  for(let k=0;k<3;k++){g.fillStyle=icon.color;g.fillRect(size*.16,size*.62-k*size*.18,size*.68,size*.16);g.fillStyle='rgba(255,255,255,.25)';g.fillRect(size*.2,size*.64-k*size*.18,size*.6,size*.03)}
 }
 return c;
}

export function formatMoney(mun){const nyang=Math.floor(mun/100),rest=mun%100;return nyang?`${nyang}냥${rest?` ${rest}문`:''}`:`${rest}문`}

const csrfToken=()=>document.cookie.split('; ').find(c=>c.startsWith('csrftoken='))?.slice(10)??'';
const post=(url,body)=>fetch(url,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRFToken':csrfToken()},body:JSON.stringify(body)});

export function createShop({container,data,onLogout}){
 const state={money:null,items:{},ready:false,loggedIn:false,name:''};
 let shop=null,quantity=1,busy=false,loginResolve=null,readyResolve;
 const whenReady=new Promise(resolve=>{readyResolve=resolve});
 // Coin display: when logged out it is a login button; when logged in it shows the name, coins and a logout button.
 const hud=document.createElement('div');hud.id='money-hud';hud.setAttribute('aria-live','polite');
 const hudText=document.createElement('button');hudText.type='button';hudText.className='hud-main';hudText.textContent='엽전 …';
 const hudLogout=document.createElement('button');hudLogout.type='button';hudLogout.className='hud-logout';hudLogout.textContent='나가기';hudLogout.hidden=true;
 hud.append(hudText,hudLogout);container.append(hud);
 hudLogout.onclick=async()=>{await post('/api/account/logout',{}).catch(()=>{});apply({logged_in:false});close();onLogout?.()};
 // Account dialog in the same adventure style as NPC conversations: name + password, log in or sign up.
 const account=document.createElement('div');account.id='account-overlay';account.hidden=true;
 account.innerHTML=`<form id="account-dialog" role="dialog" aria-modal="true" aria-label="이름 대기">
  <strong>한양 나그네 명부</strong><p class="account-intro">1인칭으로 들어가려면 이름을 대시오. 이 이름으로 함께 걷고, 엽전과 봇짐도 서버에 기록됩니다. 처음이면 이름과 비밀번호를 정하시오.</p>
  <label>이름 <input name="name" autocomplete="username" maxlength="16" required></label>
  <label>비밀번호 <input name="password" type="password" autocomplete="current-password" minlength="6" maxlength="128" required></label>
  <p class="account-message" aria-live="polite"></p>
  <div class="account-buttons"><button type="submit" value="login">들어가기</button><button type="submit" value="register">처음 왔소 (이름 정하기)</button><button type="button" class="account-cancel">닫기</button></div>
  <small>비밀번호는 6자 이상. 이름은 1~16자의 한글·한자·영문·숫자·공백·_ . -</small></form>`;
 container.append(account);
 const form=account.querySelector('form');
 account.querySelector('.account-cancel').onclick=()=>closeAccount();
 account.addEventListener('pointerdown',event=>{if(event.target===account)closeAccount()});
 form.onsubmit=async event=>{
  event.preventDefault();
  const mode=event.submitter?.value==='register'?'register':'login',msg=account.querySelector('.account-message');
  msg.textContent=mode==='register'?'이름을 적는 중…':'명부를 찾는 중…';
  try{
   const response=await post('/api/account/'+mode,{name:form.name.value,password:form.password.value});
   const answer=await response.json().catch(()=>null);
   // Take the waiting merchant before closing: closing the dialog forgets it.
   if(response.ok&&answer?.logged_in){apply(answer);form.password.value='';const resolve=loginResolve;loginResolve=null;account.hidden=true;resolve?.(answer.name)}
   else msg.textContent=answer?.error??'들어가지 못했소.';
  }catch{msg.textContent='서버에 닿지 않았소.'}
 };
 function openAccount(message=''){account.hidden=false;account.querySelector('.account-message').textContent=message;form.name.focus()}
 function closeAccount(){account.hidden=true;const resolve=loginResolve;loginResolve=null;resolve?.(null)}
 // Resolves with the account name once logged in (immediately if already), or null if the dialog is closed.
 async function requireLogin({message='',force=false}={}){
  await whenReady;
  if(state.loggedIn&&!force)return state.name;
  if(loginResolve)loginResolve(null);
  return new Promise(resolve=>{loginResolve=resolve;openAccount(message)});
 }
 const win=document.createElement('section');win.id='shop-window';win.hidden=true;win.setAttribute('role','dialog');win.setAttribute('aria-label','가게');
 win.innerHTML=`<header><strong class="shop-title"></strong><small class="shop-trade"></small><button type="button" class="shop-close" aria-label="가게 닫기">닫기</button></header>
 <div class="shop-panes"><div class="shop-pane"><h3>상인의 물건</h3><div class="shop-grid shop-goods"></div></div>
 <div class="shop-pane"><h3>내 봇짐</h3><div class="shop-grid shop-pack"></div></div></div>
 <footer><span class="shop-money"></span><span class="shop-qty">수량 <button type="button" data-q="1">1</button><button type="button" data-q="5">5</button><button type="button" data-q="10">10</button></span>
 <p class="shop-message" aria-live="polite"></p><small class="shop-note">가격은 기록에서 확인하지 않은 놀이용 값입니다. 엽전과 봇짐은 서버에 기록됩니다.</small></footer>
 <div class="shop-tip" hidden></div>`;
 container.append(win);
 const $=selector=>win.querySelector(selector);
 $('.shop-close').onclick=()=>close();
 win.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{quantity=Number(b.dataset.q);render()});
 const tip=$('.shop-tip');
 function message(text){$('.shop-message').textContent=text}
 function apply(answer){
  if(answer&&answer.logged_in===false){state.loggedIn=false;state.name='';state.money=null;state.items={};state.ready=true}
  else if(Number.isInteger(answer?.money)){state.loggedIn=true;state.name=answer.name;state.money=answer.money;state.items=answer.items??{};state.ready=true}
  // Logging in happens only when entering first person, so the display stays hidden until then.
  hud.hidden=!state.loggedIn;
  hudText.textContent=state.loggedIn?`${state.name} · 엽전 ${formatMoney(state.money)}`:'';
  hudLogout.hidden=!state.loggedIn;
  render();
 }
 async function refresh(){
  try{const response=await fetch('/api/player/',{credentials:'same-origin',cache:'no-store'});apply(response.ok?await response.json():{logged_in:false})}
  catch{apply({logged_in:false})}
  readyResolve();
 }
 async function request(action,id){
  if(busy||!shop)return;
  if(!state.loggedIn){message('1인칭으로 들어갈 때 이름을 대면 사고팔 수 있소.');return}
  busy=true;
  try{
   const response=await post('/api/shop/trade',{action,shop:shop.trade,item:id,quantity});
   const answer=await response.json().catch(()=>null);
   apply(answer);message(answer?.message??answer?.error??'거래하지 못했소.');
  }catch{message('서버에 닿지 않아 거래하지 못했소.')}
  finally{busy=false}
 }
 const sellPrice=id=>Math.floor(data.items[id].price*data.wallet.sell_rate);
 function slot(id,count,price,label,act){
  const item=data.items[id],cell=document.createElement('button');cell.type='button';cell.className='shop-slot';
  cell.append(drawIcon(item.icon));
  const name=document.createElement('span');name.className='slot-name';name.textContent=item.name;cell.append(name);
  const p=document.createElement('span');p.className='slot-price';p.textContent=formatMoney(price);cell.append(p);
  if(count!==null){const n=document.createElement('span');n.className='slot-count';n.textContent=count;cell.append(n)}
  cell.dataset.item=id;cell.setAttribute('aria-label',`${item.name} ${formatMoney(price)} ${label}`);
  cell.onclick=act;
  cell.onmouseenter=()=>{tip.hidden=false;tip.textContent=`${item.name} (한 ${item.unit}) — ${item.desc} · ${label} ${formatMoney(price)}`};
  cell.onmouseleave=()=>{tip.hidden=true};
  return cell;
 }
 function render(){
  if(!shop)return;
  $('.shop-money').textContent=!state.ready?'엽전 확인 중…':state.loggedIn?'엽전 '+formatMoney(state.money):'구경만 하는 중 (1인칭으로 들어가 이름을 대면 거래할 수 있소)';
  win.classList.toggle('browse-only',state.ready&&!state.loggedIn);
  win.querySelectorAll('[data-q]').forEach(b=>b.classList.toggle('active',Number(b.dataset.q)===quantity));
  $('.shop-goods').replaceChildren(...shop.items.map(id=>slot(id,null,data.items[id].price,'사기',()=>request('buy',id))));
  const packIds=Object.keys(state.items).filter(id=>data.items[id]);
  const pack=$('.shop-pack');pack.replaceChildren(...packIds.map(id=>slot(id,state.items[id],sellPrice(id),'팔기',()=>request('sell',id))));
  if(!packIds.length){const empty=document.createElement('p');empty.className='shop-empty';empty.textContent='봇짐이 비었소.';pack.append(empty)}
 }
 function open(merchant){
  const trade=data.shops[merchant.trade];if(!trade)return;
  shop={...trade,trade:merchant.trade};quantity=1;
  $('.shop-title').textContent=merchant.trade+(merchant.hanja?` (${merchant.hanja})`:'');
  $('.shop-trade').textContent=merchant.sells?`${merchant.sells}을 파는 가게`:'';
  message('');win.hidden=false;render();refresh();
 }
 function close(){shop=null;win.hidden=true;tip.hidden=true}
 document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(!account.hidden){event.preventDefault();closeAccount()}else if(shop){event.preventDefault();close()}});
 refresh();
 return {open,close,refresh,requireLogin,whenReady,state,get isOpen(){return !!shop},get busy(){return busy},window:win,hud,account};
}
