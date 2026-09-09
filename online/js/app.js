import {getSupabase,session,signIn,setPassword,signOut} from './auth.js';
import {getPortal,getCatalog,markPasswordSet} from './data.js';
import {uploadReceipt,extractReceipt,submitPayment as submitPaymentApi} from './payments.js';
import {peso,esc,fmtDate,remaining,toast} from './utils.js';

const root=document.getElementById('root');
const QR_FALLBACK='/assets/unionbank-bankqr-placeholder.jpg';
const ONBOARDING_KEY='JUAN_ONBOARDING_DONE_V2';
const CART_KEY='JUAN_ONLINE_CART_V1';

function readCart(){try{return JSON.parse(localStorage.getItem(CART_KEY)||'[]')}catch{return []}}
function saveCart(){localStorage.setItem(CART_KEY,JSON.stringify(state.cart))}

let state={
  route:'home',
  portal:null,
  selected:null,
  receiptPath:null,
  extractedReceipt:null,
  catalog:{categories:[],services:[],packages:[],packageItems:[]},
  catalogLoaded:false,
  shopFilter:'all',
  shopQuery:'',
  cart:readCart(),
  cartOpen:false,
  gateOpen:false,
  onboardingStep:0
};

const isLoggedIn=()=>Boolean(state.portal?.profile);
const initials=()=>esc((state.portal?.profile?.name||state.portal?.profile?.email||'JP').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase());
const brand=()=>`<div class="brand">JUAN <span class="plus">+</span><br>PROJECT<small>CLIENT PORTAL</small></div>`;

const nav=()=>`<nav class="nav">
  <button data-r="home" class="${state.route==='home'?'active':''}"><span class="nav-icon">⌂</span><span>Home</span></button>
  <button data-r="orders" class="${state.route==='orders'||state.route==='project'||state.route==='invoice'?'active':''}"><span class="nav-icon">▣</span><span>Orders</span></button>
  <button data-r="payment" class="${state.route==='payment'?'active':''}"><span class="nav-icon">▤</span><span>Payment</span></button>
  <button data-r="shop" class="${state.route==='shop'?'active':''}"><span class="nav-icon">⌁</span><span>Shop</span></button>
  <button data-r="account" class="${state.route==='account'?'active':''}"><span class="nav-icon">⚙</span><span>Settings</span></button>
</nav>`;

const top=(title,sub='')=>`<div class="topbar"><div>${brand()}</div><button id="topAccount" class="avatar ${isLoggedIn()?'':'guest'}" aria-label="${isLoggedIn()?'Open settings':'Sign in'}">${isLoggedIn()?initials():'↗'}</button></div>${sub?`<div class="eyebrow">${esc(sub)}</div>`:''}<h1 class="title">${esc(title)}</h1>`;

function welcomeScreen(){
  root.innerHTML=`<div class="welcome-shell"><div class="welcome-card"><div class="welcome-top"><button id="welcomeSignIn" class="skip">Sign In</button></div><div class="welcome-hero">${brand()}<h1>Your projects.<br>In one place.</h1><p>Track projects, payments, deliverables, files, and invoices — all made simple.</p></div><div class="welcome-actions"><button id="getStarted" class="btn dark full">Get Started</button><button id="browseGuest" class="btn full">Browse as Guest</button></div><div class="version">JUAN PROJECT Online · Client Portal</div></div></div>`;
  document.getElementById('getStarted').onclick=()=>{state.onboardingStep=0;onboardingScreen()};
  document.getElementById('browseGuest').onclick=()=>enterGuest();
  document.getElementById('welcomeSignIn').onclick=()=>authScreen();
}

const onboardingSlides=[
  {icon:'▤',title:'Track your projects',body:'See project progress, deadlines, deliverables, and updates from JUAN PROJECT.'},
  {icon:'▰',title:'Payments made simple',body:'View balances, scan the payment QR, and submit receipts for approval.'},
  {icon:'▱',title:'Access files and invoices',body:'Open shared project files and review your project invoice whenever you need them.'}
];
function onboardingScreen(){
  const s=onboardingSlides[state.onboardingStep];
  root.innerHTML=`<div class="onboard-shell"><div class="onboard-card"><div class="onboard-top"><button id="skipOnboard" class="skip">Skip</button></div><div class="onboard-main"><div class="onboard-icon">${s.icon}</div><h2>${esc(s.title)}</h2><p>${esc(s.body)}</p><div class="dots">${onboardingSlides.map((_,i)=>`<span class="${i===state.onboardingStep?'active':''}"></span>`).join('')}</div></div><div class="onboard-actions"><button id="onboardBack" class="btn" ${state.onboardingStep===0?'disabled':''}>Back</button><button id="onboardNext" class="btn dark">${state.onboardingStep===onboardingSlides.length-1?'Explore JUAN PROJECT':'Next'}</button></div></div></div>`;
  document.getElementById('skipOnboard').onclick=()=>enterGuest();
  document.getElementById('onboardBack').onclick=()=>{if(state.onboardingStep>0){state.onboardingStep--;onboardingScreen()}};
  document.getElementById('onboardNext').onclick=()=>{if(state.onboardingStep<onboardingSlides.length-1){state.onboardingStep++;onboardingScreen()}else enterGuest()};
}

function enterGuest(){localStorage.setItem(ONBOARDING_KEY,'1');state.route='home';state.gateOpen=false;render()}

function authScreen(message=''){
  root.innerHTML=`<div class="auth-shell"><div class="auth-card"><div class="auth-hero">${brand()}<h1>Welcome Back</h1><p class="subtitle">Sign in using the email and temporary or personal password provided for your JUAN PROJECT client account.</p></div><div class="field"><label>Email Address</label><input id="ae" class="input" type="email" autocomplete="username" placeholder="you@example.com"></div><div class="field"><label>Password</label><input id="ap" class="input" type="password" autocomplete="current-password" placeholder="Password"></div><div class="auth-actions"><button id="ab" class="btn dark full">Sign In</button><button id="authGuest" class="btn full">Browse as Guest</button></div><p class="helper" style="margin-top:12px">There is no public account registration. Client accounts are created by JUAN PROJECT.</p>${message?`<p class="helper">${esc(message)}</p>`:''}</div></div>`;
  const email=document.getElementById('ae'),pass=document.getElementById('ap'),btn=document.getElementById('ab');
  btn.onclick=async()=>{try{btn.disabled=true;btn.textContent='Signing in…';await signIn(email.value.trim(),pass.value);await loadPortal()}catch(e){toast(e.message)}finally{btn.disabled=false;btn.textContent='Sign In'}};
  pass.addEventListener('keydown',e=>{if(e.key==='Enter')btn.click()});
  document.getElementById('authGuest').onclick=()=>enterGuest();
}

async function loadPortal(){
  try{
    state.portal=await getPortal();
    localStorage.setItem(ONBOARDING_KEY,'1');
    if(!state.portal.passwordSet)return renderSetPassword();
    state.route='home';render();
  }catch(e){state.portal=null;authScreen(e.message)}
}

function renderSetPassword(){
  root.innerHTML=`<div class="auth-shell"><div class="auth-card">${brand()}<div class="onboard-icon" style="margin:34px auto 22px">▣</div><h1 class="title" style="text-align:center">Change Your Password</h1><p class="subtitle" style="text-align:center">You are using your initial client password. Create a new password before continuing to the portal.</p><div class="field"><label>New Password</label><input id="p1" class="input" type="password" minlength="10"></div><div class="field"><label>Confirm New Password</label><input id="p2" class="input" type="password" minlength="10"></div><button id="savep" class="btn dark full">Update Password</button><p class="helper" style="text-align:center">Use at least 10 characters.</p></div></div>`;
  document.getElementById('savep').onclick=async()=>{const p1=document.getElementById('p1'),p2=document.getElementById('p2');try{if(p1.value.length<10)throw Error('Use at least 10 characters.');if(p1.value!==p2.value)throw Error('Passwords do not match.');await setPassword(p1.value);await markPasswordSet();toast('Password updated.');state.portal.passwordSet=true;state.route='home';render()}catch(e){toast(e.message)}};
}

function gate(){state.gateOpen=true;render()}
function closeGate(){state.gateOpen=false;render()}
function gateOverlay(){return state.gateOpen?`<div class="overlay" id="gateOverlay"><div class="sheet center"><div class="sheet-icon">▣</div><h2>Sign in required</h2><p>This area is available to JUAN PROJECT clients only. You can continue browsing the Shop without an account.</p><div class="sheet-actions"><button id="gateSignIn" class="btn dark full">Sign In</button><button id="gateShop" class="btn full">Browse Shop</button><button id="gateClose" class="btn ghost full">Not now</button></div></div></div>`:''}

function cartOverlay(){
  if(!state.cartOpen)return '';
  const total=state.cart.reduce((s,x)=>s+Number(x.price||0)*Number(x.qty||1),0);
  return `<div class="overlay" id="cartOverlay"><div class="sheet"><div class="row"><div><div class="eyebrow">SHOP SELECTION</div><h2 style="text-align:left;margin:4px 0">Your Cart</h2></div><button id="closeCart" class="btn small">Done</button></div><div>${state.cart.map(x=>`<div class="cart-item"><div><b>${esc(x.name)}</b><div class="helper">${esc(x.kind)} · ${peso(x.price)} each</div></div><div class="qty"><button data-dec="${esc(x.key)}">−</button><b>${Number(x.qty||1)}</b><button data-inc="${esc(x.key)}">+</button></div></div>`).join('')||'<div class="empty">Your cart is empty.</div>'}</div><div class="row" style="padding-top:15px"><span>Subtotal</span><b>${peso(total)}</b></div>${state.cart.length?`<button id="cartContinue" class="btn dark full" style="margin-top:14px">${isLoggedIn()?'Keep Selection':'Sign in to continue'}</button>`:''}</div></div>`;
}

function routePage(){
  if(state.route==='home')return home();
  if(state.route==='shop')return shop();
  if(state.route==='orders')return orders();
  if(state.route==='project')return project();
  if(state.route==='payment')return payment();
  if(state.route==='invoice')return invoice();
  if(state.route==='account')return account();
  return home();
}

function render(){
  root.innerHTML=`<div class="app"><main class="page">${routePage()}</main>${nav()}${gateOverlay()}${cartOverlay()}</div>`;
  document.body.classList.toggle('modal-open',state.gateOpen||state.cartOpen);
  bindGlobal();bind();
}

function bindGlobal(){
  document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>{
    const route=b.dataset.r;
    if(!isLoggedIn()&&['orders','payment','account'].includes(route))return gate();
    state.route=route;state.selected=null;render();
  });
  const ta=document.getElementById('topAccount');if(ta)ta.onclick=()=>{if(isLoggedIn()){state.route='account';render()}else authScreen()};
  const gs=document.getElementById('gateSignIn');if(gs)gs.onclick=()=>authScreen();
  const gshop=document.getElementById('gateShop');if(gshop)gshop.onclick=()=>{state.gateOpen=false;state.route='shop';render()};
  const gc=document.getElementById('gateClose');if(gc)gc.onclick=()=>closeGate();
  const go=document.getElementById('gateOverlay');if(go)go.onclick=e=>{if(e.target===go)closeGate()};
  const cc=document.getElementById('closeCart');if(cc)cc.onclick=()=>{state.cartOpen=false;render()};
  document.querySelectorAll('[data-inc]').forEach(b=>b.onclick=()=>changeCartQty(b.dataset.inc,1));
  document.querySelectorAll('[data-dec]').forEach(b=>b.onclick=()=>changeCartQty(b.dataset.dec,-1));
  const cont=document.getElementById('cartContinue');if(cont)cont.onclick=()=>{if(!isLoggedIn()){state.cartOpen=false;authScreen()}else{state.cartOpen=false;toast('Selection saved. JUAN PROJECT online checkout can be connected in a future update.');render()}};
  const co=document.getElementById('cartOverlay');if(co)co.onclick=e=>{if(e.target===co){state.cartOpen=false;render()}};
}

function projectStats(p){const ds=p.deliverables||[];const done=ds.filter(x=>x.completed||String(x.status||'').toLowerCase()==='completed').length;return {done,total:ds.length,pct:ds.length?Math.round(done/ds.length*100):0}}
function activeProject(){const ps=state.portal?.projects||[];return ps.find(p=>!['completed','cancelled'].includes(String(p.status||'').toLowerCase()))||ps[0]||null}
function nextDeliverable(p){return (p?.deliverables||[]).find(d=>!d.completed&&String(d.status||'').toLowerCase()!=='completed')||null}

function home(){
  if(!isLoggedIn()){
    const featured=(state.catalog.services||[]).slice(0,3);
    return `${top('Creative solutions made simple.','JUAN PROJECT ONLINE')}<div class="public-hero"><p>Browse JUAN PROJECT services and packages without an account. Sign in only when you need to track a project, pay, or access your files.</p><div class="hero-actions"><button id="homeShop" class="btn dark">Explore Services</button><button id="homeSignIn" class="btn">Client Sign In</button></div></div><div class="mini-stats"><div class="mini-stat"><b>Simple</b><span>clean client portal</span></div><div class="mini-stat"><b>Secure</b><span>account-only projects</span></div><div class="mini-stat"><b>Shared</b><span>one Workspace database</span></div></div><div class="section-head"><h2>Featured Services</h2><button id="viewAllShop">View all</button></div>${featured.map(x=>shopRow({...x,kind:'Service'})).join('')||'<div class="card empty">Shop catalog will appear here once services are enabled in Workspace.</div>'}`;
  }
  const p=activeProject();const s=p?projectStats(p):null;const next=p?nextDeliverable(p):null;
  const recent=[];
  (state.portal.paymentSubmissions||[]).slice(0,2).forEach(x=>recent.push({title:'Payment submitted',sub:`${peso(x.submitted_amount)} · ${fmtDate(x.payment_date||x.submitted_at)}`,status:x.status||'Pending'}));
  if(p)recent.push({title:p.title,sub:`${s.done} of ${s.total} deliverables`,status:p.status||'Active'});
  return `${top(`Good day, ${state.portal.profile.name||'Client'}`,'CLIENT DASHBOARD')}${p?`<div class="card hero-card project-card" data-open="${esc(p.id)}"><div class="project-head"><div><div class="eyebrow">ACTIVE PROJECT</div><div class="project-code" style="margin-top:5px">${esc(p.project_code||p.id)}</div><div class="project-name">${esc(p.title)}</div></div><span class="badge">${esc(p.status||'Active')}</span></div><div class="progress"><span style="width:${s.pct}%"></span></div><div class="meta"><span>${s.done} of ${s.total} deliverables</span><b>${s.pct}%</b></div>${next?`<div style="margin-top:16px"><div class="eyebrow">NEXT DELIVERABLE</div><b>${esc(next.item_name||'Deliverable')}</b><div class="helper">${esc(remaining(next.due_date||p.deadline_date))}</div></div>`:''}</div>`:'<div class="card empty">No active project right now.</div>'}<div class="section-head"><h2>Recent Activity</h2><button id="homeOrders">View orders</button></div><div class="card flat">${recent.map(x=>`<div class="list-row"><div class="row"><div><b>${esc(x.title)}</b><div class="helper">${esc(x.sub)}</div></div><span class="badge ${String(x.status).toLowerCase()==='pending'?'pending':''}">${esc(x.status)}</span></div></div>`).join('')||'<div class="list-row helper">No recent activity.</div>'}</div>`;
}

function orders(){
  const ps=state.portal?.projects||[];
  return `${top('My Projects','ORDERS')}<div class="tabs"><button class="active">Active</button><button>Completed</button><button>All</button></div>${ps.map(p=>{const s=projectStats(p);return `<div class="card project-card" data-open="${esc(p.id)}"><div class="project-head"><div><div class="project-code">${esc(p.project_code||p.id)}</div><div class="project-name">${esc(p.title||'Untitled Project')}</div><div class="helper">Due ${esc(fmtDate(p.deadline_date))}</div></div><span class="badge">${esc(p.status||'Active')}</span></div><div class="progress"><span style="width:${s.pct}%"></span></div><div class="meta"><span>${s.done}/${s.total} deliverables</span><b>${s.pct}%</b></div></div>`}).join('')||'<div class="card empty">No projects yet.</div>'}`;
}

function project(){
  const p=(state.portal?.projects||[]).find(x=>x.id===state.selected);if(!p){state.route='orders';return orders()}
  const s=projectStats(p);
  return `${top(p.title,p.project_code||p.id)}<button class="btn small" id="backOrders">← My Projects</button><div class="card" style="margin-top:12px"><div class="row"><span class="badge">${esc(p.status||'Active')}</span><b>${s.pct}%</b></div><div class="progress"><span style="width:${s.pct}%"></span></div><div class="meta"><span>${s.done} of ${s.total} deliverables</span><span>${esc(remaining(p.deadline_date))}</span></div><div class="tabs" style="margin-top:16px"><button class="active">Deliverables</button><button id="projectDetailsBtn">Details</button><button id="projectInvoiceBtn">Invoice</button></div>${(p.deliverables||[]).map(d=>`<div class="deliverable"><span class="dot ${d.completed?'done':''}">${d.completed?'✓':''}</span><div><div class="d-name">${esc(d.item_name||d.name||'Deliverable')}</div><div class="d-sub">${esc(d.status|| (d.completed?'Completed':'Pending'))} · ${esc(fmtDate(d.due_date||p.deadline_date))}</div></div>${d.shared_drive_url?`<button class="drive" data-drive="${esc(d.shared_drive_url)}" aria-label="Open shared Google Drive file">↗</button>`:''}</div>`).join('')||'<div class="helper" style="padding-top:14px">No deliverables yet.</div>'}</div><div class="card"><div class="row"><div><b>Balance Due</b><div class="helper">Approved payments only</div></div><div style="text-align:right"><div class="money" style="font-size:19px">${peso(p.balance)}</div><button class="btn small primary" id="payProject">Make a Payment</button></div></div></div>`;
}

function payment(){
  const settings=state.portal?.paymentSettings||{};const ps=(state.portal?.projects||[]).filter(p=>Number(p.balance||0)>0);const qr=settings.qr_image_url||QR_FALLBACK;
  return `${top('Payment','MAKE A PAYMENT')}<div class="tabs"><button class="active">Make a Payment</button><button id="paymentHistoryTab">History</button></div><div class="card"><b>Scan to Pay</b><p class="helper">${esc(settings.instructions||'Scan the bank QR, complete your payment, then upload the receipt below for approval.')}</p><div class="qr-wrap"><img class="qr" src="${esc(qr)}" alt="UnionBank InstaPay QR"><div class="qr-caption">${esc(settings.method_label||'UnionBank · InstaPay')}</div></div><div class="row" style="margin-top:12px"><span>${esc(settings.account_name||'JUAN PROJECT')}</span><b>${esc(settings.account_number||'•••• 1710')}</b></div></div><div class="card"><b>Upload Payment Receipt</b><div class="field" style="margin-top:14px"><label>Project</label><select id="payProjectSel" class="input">${ps.map(p=>`<option value="${esc(p.id)}">${esc(p.project_code||p.id)} · ${esc(p.title)} · ${peso(p.balance)}</option>`).join('')}</select></div><div class="field"><label>Amount</label><input id="payAmount" class="input" type="number" min="1" step="0.01"></div><div class="field"><label>Method</label><input id="payMethod" class="input" value="${esc(settings.method_label||'UnionBank InstaPay')}"></div><div class="field"><label>Reference Number</label><input id="payRef" class="input" placeholder="Can be read from receipt"></div><div class="field"><label>Date Paid</label><input id="payDate" class="input" type="date" value="${new Date().toISOString().slice(0,10)}"></div><label class="upload" for="receipt"><input id="receipt" type="file" accept="image/jpeg,image/png,application/pdf" hidden><b id="receiptLabel">Tap to upload receipt</b><div class="helper">JPG, PNG, or PDF · max 5 MB</div></label><button id="readReceipt" class="btn full" style="margin-top:10px" disabled>Read Receipt with AI</button><button id="submitPayment" class="btn dark full" style="margin-top:10px" ${ps.length?'':'disabled'}>Submit Payment</button></div>${paymentHistory()}`;
}
function paymentHistory(){const rows=state.portal?.paymentSubmissions||[];return `<div class="card flat"><div style="padding:16px"><b>Payment History</b></div><div class="table-list">${rows.map(x=>`<div class="list-row"><div class="row"><div><b>${peso(x.submitted_amount)}</b><div class="helper">${esc(x.reference_number||x.extracted_reference||'No reference')} · ${fmtDate(x.payment_date||x.submitted_at)}</div></div><span class="badge ${x.status==='pending'?'pending':''}">${esc(x.status)}</span></div></div>`).join('')||'<div class="list-row helper">No client-submitted payments yet.</div>'}</div></div>`}

function invoice(){
  const p=(state.portal?.projects||[]).find(x=>x.id===state.selected);if(!p){state.route='orders';return orders()}
  return `${top('Invoice',p.project_code||p.id)}<button class="btn small" id="backProject">← Project</button><div class="invoice" style="margin-top:12px"><div class="invoice-h"><div>${brand()}</div><div style="text-align:right"><div class="eyebrow">INVOICE</div><b>${esc('INV-'+String(p.project_code||p.id).replace('JP-',''))}</b><div style="margin-top:6px"><span class="badge">${esc(p.payment_status||'UNPAID')}</span></div></div></div><div class="invoice-grid"><div><div class="eyebrow">BILL TO</div><b>${esc(state.portal.profile.name||state.portal.profile.email)}</b><div class="helper">${esc(state.portal.profile.email||'')}</div></div><div><div class="eyebrow">PROJECT</div><b>${esc(p.title)}</b><div class="helper">Due ${esc(fmtDate(p.deadline_date))}</div></div></div><table><thead><tr><th>ORDER ITEM</th><th>QTY</th><th>AMOUNT</th></tr></thead><tbody>${(p.items||[]).map(i=>`<tr><td>${esc(i.name||'Item')}</td><td>${Number(i.qty||1)}</td><td>${peso(Number(i.price||0)*Number(i.qty||1))}</td></tr>`).join('')||`<tr><td>${esc(p.title)}</td><td>1</td><td>${peso(p.total_amount)}</td></tr>`}</tbody></table><div class="invoice-total"><div class="row"><span>Total</span><b>${peso(p.total_amount)}</b></div><div class="row"><span>Amount Paid</span><b>${peso(p.amount_paid)}</b></div><div class="card balance" style="margin-top:8px"><div class="eyebrow">BALANCE DUE</div><div class="money">${peso(p.balance)}</div></div></div></div>`;
}

function account(){
  const p=state.portal.profile;
  return `${top('Settings','ACCOUNT')}<div class="card"><div class="row"><div class="avatar">${initials()}</div><div style="flex:1"><b>${esc(p.name||'Client')}</b><div class="helper">${esc(p.email||'')}</div><div class="helper">${esc(p.client_code||'')}</div></div><span>›</span></div></div><div class="card settings-list"><div class="settings-row"><div><b>Edit Profile</b><div class="helper">Client information is managed by JUAN PROJECT.</div></div><span>›</span></div><div class="settings-row"><div style="width:100%"><b>Change Password</b><div class="field" style="margin-top:12px"><input id="newPass" class="input" type="password" minlength="10" placeholder="New password"></div><div class="field"><input id="newPass2" class="input" type="password" minlength="10" placeholder="Confirm password"></div><button id="changePass" class="btn full">Update Password</button></div></div><div class="settings-row"><b>Notifications</b><span>›</span></div></div><div class="card settings-list"><div class="settings-row"><b>Help & Support</b><span>›</span></div><div class="settings-row"><b>Terms & Privacy</b><span>›</span></div></div><button id="logout" class="btn full" style="color:#c62828">Sign Out</button>`;
}

function categoryName(id){return state.catalog.categories.find(c=>c.id===id)?.name||'Service'}
function shopRow(x){
  const price=x.kind==='Package'?Number(x.new_price||0):Number(x.price||0);const old=x.kind==='Package'?Number(x.original_price||0):0;const key=`${x.kind}:${x.id}`;
  return `<div class="shop-row"><div><div class="shop-kind">${esc(x.kind==='Package'?'Package':categoryName(x.category_id))}</div><div class="shop-title">${esc(x.name)}</div><p class="shop-desc">${esc(x.description||'JUAN PROJECT creative service.')}</p></div><div class="shop-side"><div class="shop-price">${old>price?`<span class="old-price">${peso(old)}</span>`:''}${peso(price)}</div><button class="btn small" data-add-shop="${esc(key)}">Add</button></div></div>`;
}
function shop(){
  const q=state.shopQuery.trim().toLowerCase();const filter=state.shopFilter;
  let items=[...(state.catalog.services||[]).map(x=>({...x,kind:'Service'})),...(state.catalog.packages||[]).map(x=>({...x,kind:'Package'}))];
  items=items.filter(x=>{const category=categoryName(x.category_id);const text=`${x.name||''} ${x.description||''} ${category}`.toLowerCase();const qok=!q||text.includes(q);const fok=filter==='all'||String(x.category_id||'uncategorized')===filter;return qok&&fok});
  const total=state.cart.reduce((s,x)=>s+Number(x.price||0)*Number(x.qty||1),0),count=state.cart.reduce((s,x)=>s+Number(x.qty||1),0);
  return `${top('Shop','BROWSE WITHOUT AN ACCOUNT')}<p class="subtitle">Simple, text-only catalog. Services and packages are pulled from the same catalog used by JUAN PROJECT Workspace.</p><div class="shop-toolbar"><input id="shopSearch" class="input shop-search" placeholder="Search services..." value="${esc(state.shopQuery)}"></div><div class="chips"><button class="chip ${filter==='all'?'active':''}" data-filter="all">All</button>${state.catalog.categories.map(c=>`<button class="chip ${filter===c.id?'active':''}" data-filter="${esc(c.id)}">${esc(c.name)}</button>`).join('')}</div><div class="shop-list">${items.map(shopRow).join('')||'<div class="card empty">No matching services.</div>'}</div>${count?`<div class="cart-strip"><div><div class="cart-count">${count} item${count===1?'':'s'} selected</div><div class="cart-sub">Subtotal ${peso(total)}</div></div><button id="reviewCart" class="btn small">Review</button></div>`:''}`;
}

function findShopItem(key){const [kind,id]=String(key).split(':');if(kind==='Package')return {...state.catalog.packages.find(x=>x.id===id),kind};return {...state.catalog.services.find(x=>x.id===id),kind:'Service'}}
function addToCart(key){const item=findShopItem(key);if(!item?.id)return;const price=item.kind==='Package'?Number(item.new_price||0):Number(item.price||0);const existing=state.cart.find(x=>x.key===key);if(existing)existing.qty=Number(existing.qty||1)+1;else state.cart.push({key,name:item.name,kind:item.kind,price,qty:1});saveCart();toast(`${item.name} added.`);render()}
function changeCartQty(key,delta){const x=state.cart.find(i=>i.key===key);if(!x)return;x.qty=Number(x.qty||1)+delta;if(x.qty<=0)state.cart=state.cart.filter(i=>i.key!==key);saveCart();render()}

function bind(){
  document.querySelectorAll('[data-open]').forEach(x=>x.onclick=()=>{if(!isLoggedIn())return gate();state.selected=x.dataset.open;state.route='project';render()});
  document.querySelectorAll('[data-drive]').forEach(x=>x.onclick=()=>window.open(x.dataset.drive,'_blank','noopener'));
  const homeShop=document.getElementById('homeShop');if(homeShop)homeShop.onclick=()=>{state.route='shop';render()};
  const homeSignIn=document.getElementById('homeSignIn');if(homeSignIn)homeSignIn.onclick=()=>authScreen();
  const viewAll=document.getElementById('viewAllShop');if(viewAll)viewAll.onclick=()=>{state.route='shop';render()};
  const homeOrders=document.getElementById('homeOrders');if(homeOrders)homeOrders.onclick=()=>{state.route='orders';render()};
  const backOrders=document.getElementById('backOrders');if(backOrders)backOrders.onclick=()=>{state.route='orders';render()};
  const payProject=document.getElementById('payProject');if(payProject)payProject.onclick=()=>{state.route='payment';render()};
  const invoiceBtn=document.getElementById('projectInvoiceBtn');if(invoiceBtn)invoiceBtn.onclick=()=>{state.route='invoice';render()};
  const backProject=document.getElementById('backProject');if(backProject)backProject.onclick=()=>{state.route='project';render()};
  const projectDetailsBtn=document.getElementById('projectDetailsBtn');if(projectDetailsBtn)projectDetailsBtn.onclick=()=>toast('Project details are already summarized on this page.');
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{state.shopFilter=b.dataset.filter;render()});
  const shopSearch=document.getElementById('shopSearch');if(shopSearch)shopSearch.oninput=()=>{state.shopQuery=shopSearch.value;clearTimeout(window.__shopSearchTimer);window.__shopSearchTimer=setTimeout(()=>render(),160)};
  document.querySelectorAll('[data-add-shop]').forEach(b=>b.onclick=()=>addToCart(b.dataset.addShop));
  const reviewCart=document.getElementById('reviewCart');if(reviewCart)reviewCart.onclick=()=>{state.cartOpen=true;render()};
  const paymentHistoryTab=document.getElementById('paymentHistoryTab');if(paymentHistoryTab)paymentHistoryTab.onclick=()=>document.querySelector('.card.flat')?.scrollIntoView({behavior:'smooth'});

  const receipt=document.getElementById('receipt'),receiptLabel=document.getElementById('receiptLabel'),readBtn=document.getElementById('readReceipt');
  if(receipt)receipt.onchange=async()=>{const f=receipt.files?.[0];if(!f)return;try{state.extractedReceipt=null;state.receiptPath=await uploadReceipt(f);if(receiptLabel)receiptLabel.textContent='Receipt uploaded';if(readBtn)readBtn.disabled=false;toast('Receipt uploaded securely.')}catch(e){toast(e.message)}};
  if(readBtn)readBtn.onclick=async()=>{try{readBtn.disabled=true;readBtn.textContent='Reading…';const x=await extractReceipt(state.receiptPath);state.extractedReceipt=x;const ref=document.getElementById('payRef'),amt=document.getElementById('payAmount'),date=document.getElementById('payDate'),method=document.getElementById('payMethod');if(x.referenceNumber&&ref)ref.value=x.referenceNumber;if(x.amount&&amt)amt.value=x.amount;if(x.paymentDate&&date)date.value=x.paymentDate;if(x.paymentMethod&&method)method.value=x.paymentMethod;toast('Receipt details prefilled. Please review them.')}catch(e){toast(e.message)}finally{readBtn.disabled=false;readBtn.textContent='Read Receipt with AI'}};
  const submitBtn=document.getElementById('submitPayment');if(submitBtn)submitBtn.onclick=async()=>{try{if(!state.receiptPath)throw Error('Upload a receipt first.');const amt=document.getElementById('payAmount'),projectSel=document.getElementById('payProjectSel'),method=document.getElementById('payMethod'),ref=document.getElementById('payRef'),date=document.getElementById('payDate');const amount=Number(amt?.value||0);if(!(amount>0))throw Error('Enter the amount paid.');submitBtn.disabled=true;await submitPaymentApi({projectId:projectSel?.value,amount,paymentMethod:method?.value||'',referenceNumber:ref?.value||'',paymentDate:date?.value||'',receiptPath:state.receiptPath,extracted:state.extractedReceipt});toast('Payment submitted for approval.');state.portal=await getPortal();state.receiptPath=null;state.extractedReceipt=null;render()}catch(e){toast(e.message)}finally{if(document.body.contains(submitBtn))submitBtn.disabled=false}};
  const changeBtn=document.getElementById('changePass');if(changeBtn)changeBtn.onclick=async()=>{try{const p1=document.getElementById('newPass'),p2=document.getElementById('newPass2');if((p1?.value||'').length<10)throw Error('Use at least 10 characters.');if(p1.value!==p2.value)throw Error('Passwords do not match.');await setPassword(p1.value);await markPasswordSet();toast('Password updated.');p1.value=p2.value=''}catch(e){toast(e.message)}};
  const logoutBtn=document.getElementById('logout');if(logoutBtn)logoutBtn.onclick=async()=>{await signOut();state.portal=null;state.route='home';render()};
}

(async()=>{
  try{
    await getSupabase();
    try{state.catalog=await getCatalog();state.catalogLoaded=true}catch(e){console.warn('Catalog:',e.message)}
    const s=await session();
    if(s)return loadPortal();
    if(localStorage.getItem(ONBOARDING_KEY)==='1')return render();
    welcomeScreen();
  }catch(e){console.error(e);if(localStorage.getItem(ONBOARDING_KEY)==='1')render();else welcomeScreen()}
})();
