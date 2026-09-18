import {t,lang,setLang} from './i18n.js';
// MMORPG-style shop window and coin display. The server owns coins and packs: this module only shows the state the
// server returns (GET /api/player/) and sends account and trade requests; prices, stock and passwords are checked there. Prices are play values, not historical prices.
function drawIcon(icon,size=48){
 const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');
 g.fillStyle='#3a2c1f';g.fillRect(0,0,size,size);g.fillStyle='#5a4631';g.fillRect(2,2,size-4,size-4);
 if(icon.shape==='reins'){
  g.strokeStyle=icon.color;g.lineWidth=size*.07;g.beginPath();g.ellipse(size*.46,size*.46,size*.26,size*.2,-.5,0,Math.PI*2);g.stroke();
  g.beginPath();g.moveTo(size*.62,size*.6);g.quadraticCurveTo(size*.8,size*.72,size*.72,size*.9);g.stroke();
  g.strokeStyle='#c9c2b0';g.lineWidth=size*.05;g.beginPath();g.arc(size*.24,size*.3,size*.08,0,Math.PI*2);g.stroke();
 }else if(icon.shape==='fish'){
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

export function formatMoney(mun){const nyang=Math.floor(mun/100),rest=mun%100;return nyang?t('{n}냥',{n:nyang})+(rest?' '+t('{n}문',{n:rest}):''):t('{n}문',{n:rest})}

const csrfToken=()=>document.cookie.split('; ').find(c=>c.startsWith('csrftoken='))?.slice(10)??'';
const post=(url,body)=>fetch(url,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRFToken':csrfToken()},body:JSON.stringify(body)});

export function createShop({container,data,onLogout,onUse}){
 const state={money:null,items:{},ready:false,loggedIn:false,name:''};
 let shop=null,quantity=1,busy=false,loginResolve=null,readyResolve,hudShown=false;
 const whenReady=new Promise(resolve=>{readyResolve=resolve});
 // Coin display: when logged out it is a login button; when logged in it shows the name, coins and a logout button.
 const hud=document.createElement('div');hud.id='money-hud';hud.setAttribute('aria-live','polite');
 const hudText=document.createElement('button');hudText.type='button';hudText.className='hud-main';hudText.textContent=t('엽전 …');
 const hudLogout=document.createElement('button');hudLogout.type='button';hudLogout.className='hud-logout';hudLogout.textContent=t('나가기');hudLogout.hidden=true;
 const hudPack=document.createElement('button');hudPack.type='button';hudPack.className='hud-pack';hudPack.textContent=t('봇짐');hudPack.title=t('봇짐 열기 (I)');
 hud.append(hudText,hudPack,hudLogout);container.append(hud);
 hudPack.onclick=()=>togglePack();
 hudLogout.onclick=async()=>{await post('/api/account/logout',{}).catch(()=>{});apply({logged_in:false});close();onLogout?.()};
 // Account dialog in the same adventure style as NPC conversations: name + password, log in or sign up.
 const account=document.createElement('div');account.id='account-overlay';account.hidden=true;
 account.innerHTML=`<form id="account-dialog" role="dialog" aria-modal="true" aria-label="${t('이름 대기')}">
  <strong>${t('한양 나그네 명부')}</strong><p class="account-intro">${t('1인칭으로 들어가려면 이름을 대시오. 이 이름으로 함께 걷고, 엽전과 봇짐도 서버에 기록됩니다. 처음이면 이름과 비밀번호를 정하시오.')}</p>
  <label>${t('이름')} <input name="name" autocomplete="username" maxlength="16" required></label>
  <label>${t('비밀번호')} <input name="password" type="password" autocomplete="current-password" minlength="6" maxlength="128" required></label>
  <p class="account-message" aria-live="polite"></p>
  <div class="account-buttons"><button type="submit" value="login">${t('들어가기')}</button><button type="submit" value="register">${t('처음 왔소 (이름 정하기)')}</button><button type="button" class="account-cancel">${t('닫기')}</button></div>
  <small>${t('비밀번호는 6자 이상. 이름은 1~16자의 한글·한자·영문·숫자·공백·_ . -')}</small></form>`;
 container.append(account);
 const form=account.querySelector('form');
 account.querySelector('.account-cancel').onclick=()=>closeAccount();
 account.addEventListener('pointerdown',event=>{if(event.target===account)closeAccount()});
 form.onsubmit=async event=>{
  event.preventDefault();
  const mode=event.submitter?.value==='register'?'register':'login',msg=account.querySelector('.account-message');
  msg.textContent=mode==='register'?t('이름을 적는 중…'):t('명부를 찾는 중…');
  try{
   const response=await post('/api/account/'+mode,{name:form.name.value,password:form.password.value});
   const answer=await response.json().catch(()=>null);
   // Take the waiting merchant before closing: closing the dialog forgets it.
   if(response.ok&&answer?.logged_in){apply(answer);form.password.value='';const resolve=loginResolve;loginResolve=null;account.hidden=true;resolve?.(answer.name)}
   else msg.textContent=answer?.error??t('들어가지 못했소.');
  }catch{msg.textContent=t('서버에 닿지 않았소.')}
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
 const win=document.createElement('section');win.id='shop-window';win.hidden=true;win.setAttribute('role','dialog');win.setAttribute('aria-label',t('가게'));
 win.innerHTML=`<header><strong class="shop-title"></strong><small class="shop-trade"></small><button type="button" class="shop-close" aria-label="${t('가게 닫기')}">${t('닫기')}</button></header>
 <div class="shop-panes"><div class="shop-pane"><h3>${t('상인의 물건')}</h3><div class="shop-grid shop-goods"></div></div>
 <div class="shop-pane"><h3>${t('내 봇짐')}</h3><div class="shop-grid shop-pack"></div></div></div>
 <footer><span class="shop-money"></span><span class="shop-qty">${t('수량')} <button type="button" data-q="1">1</button><button type="button" data-q="5">5</button><button type="button" data-q="10">10</button></span>
 <p class="shop-message" aria-live="polite"></p><small class="shop-note">${t('가격은 기록에서 확인하지 않은 놀이용 값입니다. 엽전과 봇짐은 서버에 기록됩니다.')}</small></footer>
 <div class="shop-tip" hidden></div>`;
 container.append(win);
 const $=selector=>win.querySelector(selector);
 $('.shop-close').onclick=()=>close();
 win.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{quantity=Number(b.dataset.q);render()});
 const tip=$('.shop-tip');
 // Pack window: explicit use buttons support touch and keyboard; right-click stays as a shortcut.
 const packWin=document.createElement('section');packWin.id='pack-window';packWin.hidden=true;packWin.setAttribute('role','dialog');packWin.setAttribute('aria-label',t('봇짐'));
 packWin.innerHTML=`<header><strong>${t('내 봇짐')}</strong><small>${t('물건 옆의 쓰기 버튼으로 사용')}</small><button type="button" class="pack-close">${t('닫기')}</button></header>
 <div class="shop-grid pack-items"></div><footer><span class="pack-money"></span><p class="pack-message" aria-live="polite"></p></footer>`;
 container.append(packWin);
 packWin.querySelector('.pack-close').onclick=()=>closePack();
 const packMessage=text=>{packWin.querySelector('.pack-message').textContent=text};
 function useItem(id){
  const item=data.items[id];if(!item||!(state.items[id]>0))return;
  if(!item.use){packMessage(t('{name}은(는) 쓸 데가 없소.',{name:item.name}));return}
  packMessage(onUse?.(id)??'');renderPack();
 }
 function renderPack(){
  if(packWin.hidden)return;
  packWin.querySelector('.pack-money').textContent=state.loggedIn?t('엽전 ')+formatMoney(state.money):'';
  const ids=Object.keys(state.items).filter(id=>data.items[id]),grid=packWin.querySelector('.pack-items');
  grid.replaceChildren(...ids.map(id=>{
   const item=data.items[id],cell=document.createElement('button');cell.type='button';cell.className='shop-slot';cell.dataset.item=id;
   cell.append(drawIcon(item.icon));
   const name=document.createElement('span');name.className='slot-name';name.textContent=item.name;cell.append(name);
   const n=document.createElement('span');n.className='slot-count';n.textContent=state.items[id];cell.append(n);
   const usable=item.use?t(' · 쓰기 가능'):'';
   cell.setAttribute('aria-label',`${item.name} ${state.items[id]}${item.unit}${usable}`);
   cell.onclick=()=>packMessage(t('{name} (한 {unit}) — {desc}',{name:item.name,unit:item.unit,desc:item.desc}));
   cell.oncontextmenu=event=>{event.preventDefault();useItem(id)};
   const entry=document.createElement('div');entry.className='pack-entry';entry.append(cell);
   if(item.use){const use=document.createElement('button');use.type='button';use.className='pack-use';use.dataset.item=id;use.textContent=t('쓰기');use.setAttribute('aria-label',t('{name} 쓰기',{name:item.name}));use.onclick=()=>useItem(id);entry.append(use)}
   return entry;
  }));
  if(!ids.length){const empty=document.createElement('p');empty.className='shop-empty';empty.textContent=t('봇짐이 비었소.');grid.append(empty)}
 }
 function openPack(){if(!state.loggedIn)return;packWin.hidden=false;packMessage('');renderPack()}
 function closePack(){packWin.hidden=true}
 function togglePack(){packWin.hidden?openPack():closePack()}
 function message(text){$('.shop-message').textContent=text}
 function apply(answer){
  if(answer&&answer.logged_in===false){state.loggedIn=false;state.name='';state.money=null;state.items={};state.ready=true}
  else if(Number.isInteger(answer?.money)){state.loggedIn=true;state.name=answer.name;state.money=answer.money;state.items=answer.items??{};state.ready=true}
  // The name, coins and logout belong to walking: the display shows only in first person while logged in.
  hud.hidden=!state.loggedIn||!hudShown;
  hudText.textContent=state.loggedIn?`${state.name} · ${t('엽전')} ${formatMoney(state.money)}`:'';
  hudLogout.hidden=!state.loggedIn;
  if(!state.loggedIn)closePack();
  render();renderPack();
 }
 async function refresh(){
  try{const response=await fetch('/api/player/',{credentials:'same-origin',cache:'no-store'});apply(response.ok?await response.json():{logged_in:false})}
  catch{apply({logged_in:false})}
  readyResolve();
 }
 async function request(action,id){
  if(busy||!shop)return;
  if(!state.loggedIn){message(t('1인칭으로 들어갈 때 이름을 대면 사고팔 수 있소.'));return}
  busy=true;
  try{
   const response=await post('/api/shop/trade',{action,shop:shop.trade,item:id,quantity});
   const answer=await response.json().catch(()=>null);
   apply(answer);message(answer?.message??answer?.error??t('거래하지 못했소.'));
  }catch{message(t('서버에 닿지 않아 거래하지 못했소.'))}
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
  cell.onmouseenter=()=>{tip.hidden=false;tip.textContent=t('{name} (한 {unit}) — {desc}',{name:item.name,unit:item.unit,desc:item.desc})+` · ${label} ${formatMoney(price)}`};
  cell.onmouseleave=()=>{tip.hidden=true};
  return cell;
 }
 function render(){
  if(!shop)return;
  $('.shop-money').textContent=!state.ready?t('엽전 확인 중…'):state.loggedIn?t('엽전 ')+formatMoney(state.money):t('구경만 하는 중 (1인칭으로 들어가 이름을 대면 거래할 수 있소)');
  win.classList.toggle('browse-only',state.ready&&!state.loggedIn);
  win.querySelectorAll('[data-q]').forEach(b=>b.classList.toggle('active',Number(b.dataset.q)===quantity));
  $('.shop-goods').replaceChildren(...shop.items.map(id=>slot(id,null,data.items[id].price,t('사기'),()=>request('buy',id))));
  const packIds=Object.keys(state.items).filter(id=>data.items[id]);
  const pack=$('.shop-pack');pack.replaceChildren(...packIds.map(id=>slot(id,state.items[id],sellPrice(id),t('팔기'),()=>request('sell',id))));
  if(!packIds.length){const empty=document.createElement('p');empty.className='shop-empty';empty.textContent=t('봇짐이 비었소.');pack.append(empty)}
 }
 function open(merchant){
  const trade=data.shops[merchant.trade];if(!trade)return;
  shop={...trade,trade:merchant.trade};quantity=1;
  $('.shop-title').textContent=t(merchant.trade)+(merchant.hanja&&lang!=='en'?` (${merchant.hanja})`:'');
  $('.shop-trade').textContent=merchant.sells?t('{sells}을 파는 가게',{sells:t(merchant.sells)}):'';
  message('');win.hidden=false;render();refresh();
 }
 function close(){shop=null;win.hidden=true;tip.hidden=true}
 // Escape closes the topmost window only; it must not also leave first person (captured before that handler).
 document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;const done=()=>{event.preventDefault();event.stopImmediatePropagation()};if(!account.hidden){done();closeAccount()}else if(shop){done();close()}else if(!packWin.hidden){done();closePack()}},true);
 refresh();
 function showHud(shown){hudShown=shown;hud.hidden=!state.loggedIn||!hudShown;if(!shown)closePack()}
 return {open,close,refresh,requireLogin,whenReady,showHud,openPack,closePack,togglePack,get packOpen(){return !packWin.hidden},packWindow:packWin,state,get isOpen(){return !!shop},get busy(){return busy},window:win,hud,account};
}
