// MMORPG-style shop window and coin display. The server owns coins and packs: this module only shows the state the
// server returns (GET /api/player/) and sends trade requests (POST /api/shop/trade); prices and stock checks happen
// there. Prices are play values, not historical prices.
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

export function createShop({container,data}){
 const state={money:null,items:{},ready:false};
 let shop=null,quantity=1,busy=false;
 const hud=document.createElement('div');hud.id='money-hud';hud.setAttribute('aria-live','polite');hud.title='내 엽전(서버에 기록됨)';hud.textContent='엽전 …';
 container.append(hud);
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
  if(Number.isInteger(answer?.money)){state.money=answer.money;state.items=answer.items??{};state.ready=true}
  hud.textContent=state.ready?'엽전 '+formatMoney(state.money):'엽전 —';
  render();
 }
 async function refresh(){
  try{const response=await fetch('/api/player/',{credentials:'same-origin',cache:'no-store'});apply(response.ok?await response.json():null)}
  catch{apply(null)}
 }
 async function request(action,id){
  if(busy||!shop)return;busy=true;
  try{
   const response=await fetch('/api/shop/trade',{method:'POST',credentials:'same-origin',cache:'no-store',
    headers:{'Content-Type':'application/json','X-CSRFToken':csrfToken()},body:JSON.stringify({action,shop:shop.trade,item:id,quantity})});
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
  $('.shop-money').textContent=state.ready?'엽전 '+formatMoney(state.money):'엽전 확인 중…';
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
 document.addEventListener('keydown',event=>{if(shop&&event.key==='Escape'){event.preventDefault();close()}});
 refresh();
 return {open,close,refresh,state,get isOpen(){return !!shop},get busy(){return busy},window:win,hud};
}
