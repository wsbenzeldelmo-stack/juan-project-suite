import {getSupabase,session,signIn,setPassword,changePasswordWithCurrent,sendPasswordReset,signOut} from './auth.js';
import {getPortal,getCatalog,markPasswordSet} from './data.js';
import {uploadReceipt,extractReceipt,submitPayment as submitPaymentApi} from './payments.js';
import {peso,esc,fmtDate,remaining,toast} from './utils.js';

const root=document.getElementById('root');
const QR_FALLBACK='/assets/unionbank-bankqr-placeholder.jpg';
const ONBOARDING_KEY='JUAN_ONBOARDING_DONE_V3';

let state={
  route:'home',portal:null,selected:null,receiptPath:null,extractedReceipt:null,
  catalog:{categories:[],services:[],packages:[],packageItems:[]},catalogLoaded:false,
  gateOpen:false,onboardingStep:0,orderFilter:'active',shopItem:null,paymentProjectId:null,shopQuery:'',shopFilter:'all',shopSort:'default',manualPaymentAllowed:false,paymentEntrySource:'gemini',paymentFlow:''
};

const isLoggedIn=()=>Boolean(state.portal?.profile);
const initials=()=>esc((state.portal?.profile?.name||state.portal?.profile?.email||'JP').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase());
const brand=(compact=false)=>`<div class="brand ${compact?'compact':''}"><div><span>JUAN</span> <i>+</i><br><span>PROJECT</span> <em>Online</em></div></div>`;

const icons={
  home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/><path d="M9 20v-6h6v6"/>',
  orders:'<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 4.5h6"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  payment:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h3"/>',
  shop:'<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M8 8a4 4 0 0 1 8 0"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2H10V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  back:'<path d="m15 18-6-6 6-6"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  upload:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 15v5h16v-5"/>',
  drive:'<path d="M12 3 4 17h5l3-5 3 5h5L12 3Z"/><path d="M9 17h6"/>',
  chevron:'<path d="m9 18 6-6-6-6"/>',
  eye:'<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  folderlock:'<path d="M3 7h7l2 2h9v10H3z"/><rect x="13" y="13" width="6" height="5" rx="1"/><path d="M14.5 13v-1a1.5 1.5 0 0 1 3 0v1"/>'
};
const icon=(name,size=20)=>`<svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||''}</svg>`;

const nav=()=>`<nav class="nav">
  <button data-r="home" class="${state.route==='home'?'active':''}">${icon('home')}<span>Home</span></button>
  <button data-r="orders" class="${['orders','project','invoice'].includes(state.route)?'active':''}">${icon('orders')}<span>Orders</span></button>
  <button data-r="payment" class="${state.route==='payment'?'active':''}">${icon('payment')}<span>Payment</span></button>
  <button data-r="shop" class="${state.route==='shop'?'active':''}">${icon('shop')}<span>Shop</span></button>
  <button data-r="account" class="${state.route==='account'?'active':''}">${icon('settings')}<span>Settings</span></button>
</nav>`;

function welcomeScreen(){
  root.innerHTML=`<div class="welcome-shell"><div class="phone-page welcome-card"><div class="welcome-hero">${brand()}<h1>Your projects.<br><strong>In one place.</strong></h1><p>Track. Pay. Receive.<br>All made simple.</p></div><div class="welcome-actions"><button id="getStarted" class="btn dark full">Get Started</button><button id="welcomeSignIn2" class="btn full">Log In</button></div><div class="version">v1.1.1</div></div></div>`;
  document.getElementById('getStarted').onclick=()=>{state.onboardingStep=0;onboardingScreen()};
  document.getElementById('welcomeSignIn2').onclick=()=>authScreen();
}

const onboardingSlides=[
  {icon:'orders',title:'Track your projects',body:'See real-time progress, upcoming deliverables, and all your projects in one place.'},
  {icon:'payment',title:'Pay with ease',body:'View balances, submit payment receipts, and keep your transactions in one place.'}
];
function onboardingScreen(){
  const slide=onboardingSlides[state.onboardingStep];
  root.innerHTML=`<div class="onboard-shell"><div class="phone-page onboard-card"><button id="skipOnboard" class="text-button top-right">Skip</button><div class="onboard-main"><div class="onboard-icon">${icon(slide.icon,38)}</div><h2>${esc(slide.title)}</h2><p>${esc(slide.body)}</p><div class="dots">${onboardingSlides.map((_,i)=>`<span class="${i===state.onboardingStep?'active':''}"></span>`).join('')}</div></div><div class="onboard-actions single"><button id="onboardNext" class="btn primary full">${state.onboardingStep===onboardingSlides.length-1?'Get Started':'Next'}</button></div></div></div>`;
  document.getElementById('skipOnboard').onclick=()=>enterGuest();
  document.getElementById('onboardNext').onclick=()=>{if(state.onboardingStep<onboardingSlides.length-1){state.onboardingStep++;onboardingScreen()}else enterGuest()};
}
function enterGuest(){localStorage.setItem(ONBOARDING_KEY,'1');state.route='home';state.gateOpen=false;render()}

function authScreen(message=''){
  root.innerHTML=`<div class="auth-shell"><div class="phone-page auth-card"><button id="authBack" class="icon-button auth-back" aria-label="Back">${icon('back')}</button><div class="auth-copy auth-copy-top"><h1>Welcome Back</h1><p>Log in to your JUAN PROJECT Online account.</p></div><div class="field"><label>Email Address</label><input id="ae" class="input" type="email" autocomplete="username" placeholder="Email Address"></div><div class="field password-field"><label>Password</label><div class="password-input-wrap"><input id="ap" class="input" type="password" autocomplete="current-password" placeholder="Password"><button id="toggleLoginPass" type="button" class="password-eye" aria-label="Show password">${icon('eye',18)}</button></div><div id="loginValidation" class="field-error"></div></div><div class="auth-options"><label class="remember"><input type="checkbox" checked> <span>Remember me</span></label><button id="forgotPassword" class="text-button">Forgot password?</button></div><button id="ab" class="btn primary full">Log In</button><div class="info-box">${icon('lock',18)}<span>Use the temporary password provided by JUAN PROJECT. You will be asked to change it on your first login.</span></div>${message?`<p class="form-message">${esc(message)}</p>`:''}</div></div>`;
  const email=document.getElementById('ae'),pass=document.getElementById('ap'),btn=document.getElementById('ab');
  document.getElementById('authBack').onclick=()=>{localStorage.getItem(ONBOARDING_KEY)==='1'?render():welcomeScreen()};
  btn.onclick=async()=>{try{if(!email.value.trim()||!pass.value)throw Error('Enter your email and password.');btn.disabled=true;btn.textContent='Signing in…';await signIn(email.value.trim(),pass.value);await loadPortal()}catch(e){toast(e.message||'Invalid login credentials.')}finally{btn.disabled=false;btn.textContent='Log In'}};
  pass.addEventListener('keydown',e=>{if(e.key==='Enter')btn.click()});const toggle=document.getElementById('toggleLoginPass');if(toggle)toggle.onclick=()=>{const show=pass.type==='password';pass.type=show?'text':'password';toggle.setAttribute('aria-label',show?'Hide password':'Show password');};
  document.getElementById('forgotPassword').onclick=async()=>{try{if(!email.value.trim())throw Error('Enter your email address first.');await sendPasswordReset(email.value.trim());toast('If the account can receive email, a password reset link has been sent.')}catch(e){toast(e.message)}};
}

async function loadPortal(){
  try{state.portal=await getPortal();localStorage.setItem(ONBOARDING_KEY,'1');if(!state.portal.passwordSet)return renderSetPassword();state.route='home';render()}
  catch(e){state.portal=null;authScreen(e.message)}
}
function renderSetPassword(){
  root.innerHTML=`<div class="auth-shell"><div class="phone-page auth-card"><button id="passwordBack" class="icon-button auth-back" aria-label="Sign out">${icon('back')}</button><div class="password-icon">${icon('lock',34)}</div><div class="auth-copy centered"><h1>Change Your Password</h1><p>For your security, please change your temporary password.</p></div><div class="field"><label>Current Password</label><div class="password-input-wrap"><input id="currentPass" class="input" type="password" autocomplete="current-password" placeholder="Current Password"><button type="button" class="password-eye" data-toggle-pass="currentPass">${icon('eye',18)}</button></div></div><div class="field"><label>New Password</label><div class="password-input-wrap"><input id="p1" class="input" type="password" autocomplete="new-password" minlength="8" placeholder="New Password"><button type="button" class="password-eye" data-toggle-pass="p1">${icon('eye',18)}</button></div></div><div class="field"><label>Confirm New Password</label><div class="password-input-wrap"><input id="p2" class="input" type="password" autocomplete="new-password" minlength="8" placeholder="Confirm New Password"><button type="button" class="password-eye" data-toggle-pass="p2">${icon('eye',18)}</button></div></div><div class="password-rule">${icon('lock',18)}<span>Your new password must be at least 8 characters and include a mix of letters, numbers, and symbols.</span></div><button id="savep" class="btn primary full">Continue</button></div></div>`;
  document.getElementById('passwordBack').onclick=async()=>{await signOut();state.portal=null;authScreen()};
  document.getElementById('savep').onclick=async()=>{const cur=document.getElementById('currentPass'),p1=document.getElementById('p1'),p2=document.getElementById('p2'),btn=document.getElementById('savep');try{if(!cur.value)throw Error('Enter your temporary password.');if(p1.value.length<8)throw Error('Use at least 8 characters.');if(p1.value!==p2.value)throw Error('Passwords do not match.');btn.disabled=true;await changePasswordWithCurrent(state.portal.profile.email,cur.value,p1.value);await markPasswordSet();state.portal.passwordSet=true;toast('Password updated.');state.route='home';render()}catch(e){toast(e.message)}finally{btn.disabled=false}};
}

function gate(){state.gateOpen=true;render()}
function gateOverlay(){return state.gateOpen?`<div class="overlay" id="gateOverlay"><div class="sheet center"><button id="gateX" class="icon-button sheet-x">×</button><div class="sheet-icon">${icon('lock',26)}</div><h2>Log in required</h2><p>This feature is available to JUAN PROJECT clients only.</p><div class="sheet-actions"><button id="gateSignIn" class="btn primary full">Log In</button><button id="gateShop" class="btn full">Browse Shop</button></div></div></div>`:''}
function shopOverlay(){
  const x=state.shopItem;if(!x)return '';
  const price=x.kind==='Package'?Number(x.new_price||0):Number(x.price||0),old=x.kind==='Package'?Number(x.original_price||0):0;
  return `<div class="overlay" id="shopOverlay"><div class="sheet"><button id="shopX" class="icon-button sheet-x">×</button><div class="shop-kind">${esc(x.kind==='Package'?'Package':categoryName(x.category_id))}</div><h2 class="sheet-title">${esc(x.name)}</h2><div class="detail-price">${old>price?`<span>${peso(old)}</span>`:''}${peso(price)}</div><p class="detail-copy">${esc(x.description||'JUAN PROJECT creative service.')}</p>${!isLoggedIn()?'<div class="info-box compact-info"><span>Log in when you are ready to access client-only ordering and project tools.</span></div><button id="detailSignIn" class="btn primary full">Log In</button>':''}<button id="detailClose" class="btn full">Close</button></div></div>`;
}

function routePage(){if(state.route==='home')return home();if(state.route==='shop')return shop();if(state.route==='orders')return orders();if(state.route==='project')return project();if(state.route==='payment')return payment();if(state.route==='invoice')return invoice();if(state.route==='account')return account();return home()}
function render(){root.innerHTML=`<div class="app"><main class="page">${routePage()}</main>${nav()}${gateOverlay()}${shopOverlay()}</div>`;document.body.classList.toggle('modal-open',state.gateOpen||state.shopItem);bindGlobal();bind()}
function bindGlobal(){
  document.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{const r=b.dataset.r;if(['orders','payment','account'].includes(r)&&!isLoggedIn())return gate();state.route=r;render()});
  const ga=document.getElementById('gateSignIn');if(ga)ga.onclick=()=>{state.gateOpen=false;authScreen()};
  const gs=document.getElementById('gateShop');if(gs)gs.onclick=()=>{state.gateOpen=false;state.route='shop';render()};
  const gx=document.getElementById('gateX');if(gx)gx.onclick=()=>{state.gateOpen=false;render()};
  const overlay=document.getElementById('gateOverlay');if(overlay)overlay.onclick=e=>{if(e.target===overlay){state.gateOpen=false;render()}};
  const sx=document.getElementById('shopX'),dc=document.getElementById('detailClose');if(sx)sx.onclick=()=>{state.shopItem=null;render()};if(dc)dc.onclick=()=>{state.shopItem=null;render()};
  const dsi=document.getElementById('detailSignIn');if(dsi)dsi.onclick=()=>{state.shopItem=null;authScreen()};
  const so=document.getElementById('shopOverlay');if(so)so.onclick=e=>{if(e.target===so){state.shopItem=null;render()}};
}

function projectStats(p){const ds=p.deliverables||[];const done=ds.filter(x=>x.completed||String(x.status||'').toLowerCase()==='completed').length;return {done,total:ds.length,pct:ds.length?Math.round(done/ds.length*100):0}}
function activeProject(){const ps=state.portal?.projects||[];return ps.find(p=>!['completed','cancelled'].includes(String(p.status||'').toLowerCase()))||ps[0]||null}
function nextDeliverable(p){return (p?.deliverables||[]).find(d=>!d.completed&&String(d.status||'').toLowerCase()!=='completed')||null}
function pageHead(title,{back=false,more=true}={}){return `<div class="screen-head">${back?`<button class="icon-button" id="screenBack">${icon('back')}</button>`:'<span></span>'}<h1>${esc(title)}</h1>${more?`<button class="icon-button">${icon('more')}</button>`:'<span></span>'}</div>`}

function home(){
  if(!isLoggedIn())return `<div class="guest-home"><div class="guest-brand">${brand(true)}</div><div class="guest-copy"><span class="eyebrow">JUAN PROJECT ONLINE</span><h1>Creative services.<br>Simple client access.</h1><p>Browse the Shop without an account. Log in only when you need your projects, payments, invoices, and files.</p></div><div class="card guest-access"><div><b>Already a JUAN PROJECT client?</b><p>Use the email and temporary password provided by the admin.</p></div><button id="homeSignIn" class="btn primary full">Log In</button></div><button id="homeShop" class="btn full">Browse Shop</button></div>`;
  const p=activeProject(),s=p?projectStats(p):null,next=p?nextDeliverable(p):null,recent=[];
  (state.portal.paymentSubmissions||[]).slice(0,2).forEach(x=>recent.push({title:'Payment submitted',sub:fmtDate(x.payment_date||x.submitted_at),status:x.status||'Pending'}));
  if(p&&p.deliverables?.find(d=>d.completed))recent.push({title:'Deliverable completed',sub:fmtDate(p.deliverables.find(d=>d.completed)?.due_date||p.deadline_date),status:'Completed'});
  return `<div class="dashboard-head"><div><span>Good day,</span><h1>${esc(state.portal.profile.name||'Client')}</h1></div><div class="dashboard-actions"><button class="icon-button">${icon('bell')}</button><button id="topAccount" class="avatar">${initials()}</button></div></div>${p?`<div class="card active-project" data-open="${esc(p.id)}"><div class="eyebrow">Active Project</div><div class="project-code">${esc(p.project_code||p.id)}</div><div class="project-name">${esc(p.title)}</div><div class="progress"><span style="width:${s.pct}%"></span></div><div class="meta"><span>${s.done} of ${s.total} deliverables</span><b>${s.pct}%</b></div>${next?`<div class="next-deliverable"><span>Next Deliverable</span><b>${esc(next.item_name||'Deliverable')}</b><small>${esc(fmtDate(next.due_date||p.deadline_date))} · ${esc(remaining(next.due_date||p.deadline_date))}</small></div>`:''}</div>`:'<div class="card empty">No active project right now.</div>'}<div class="section-head"><h2>Recent Activity</h2><button id="homeOrders">View All</button></div><div class="card activity-card">${recent.map(x=>`<div class="activity-row"><span class="activity-icon">${icon(x.title.includes('Payment')?'payment':'orders',17)}</span><div><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></div><span class="badge ${String(x.status).toLowerCase()==='pending'?'pending':''}">${esc(x.status)}</span></div>`).join('')||'<div class="empty compact-empty">No recent activity.</div>'}</div>`;
}

function orders(){
  const all=state.portal?.projects||[],filter=state.orderFilter;
  const ps=all.filter(p=>filter==='all'||(filter==='completed'?String(p.status||'').toLowerCase()==='completed':!['completed','cancelled'].includes(String(p.status||'').toLowerCase())));
  return `${pageHead('My Projects',{back:false,more:false})}<div class="tabs order-tabs"><button data-order-filter="active" class="${filter==='active'?'active':''}">Active</button><button data-order-filter="completed" class="${filter==='completed'?'active':''}">Completed</button><button data-order-filter="all" class="${filter==='all'?'active':''}">All</button></div><div class="project-list">${ps.map(p=>{const s=projectStats(p);return `<div class="card project-list-card" data-open="${esc(p.id)}"><div class="project-list-top"><div><div class="project-code">${esc(p.project_code||p.id)}</div><div class="project-name">${esc(p.title||'Untitled Project')}</div></div>${icon('chevron',18)}</div><div class="progress"><span style="width:${s.pct}%"></span></div><div class="meta"><span>${s.done}/${s.total} deliverables</span><b>${s.pct}%</b></div></div>`}).join('')||'<div class="card empty">No matching projects.</div>'}</div>`;
}

function projectTracking(p){const st=String(p.status||'').toLowerCase(),ds=p.deliverables||[],done=ds.filter(d=>d.completed||String(d.status||'').toLowerCase()==='completed').length,total=ds.length,pct=total?done/total:0;let step=0;if(st.includes('complete')||st.includes('delivered'))step=3;else if(pct>=.75)step=2;else if(pct>0||st.includes('progress'))step=1;const stages=['Order Received','In Production','For Review','Delivered'];return `<div class="project-route card">${stages.map((x,i)=>`<div class="route-step ${i<=step?'done':''}"><span>${i<step?'✓':i+1}</span><small>${x}</small></div>${i<stages.length-1?`<i class="route-line ${i<step?'done':''}"></i>`:''}`).join('')}</div>`;}

function project(){
  const p=(state.portal?.projects||[]).find(x=>x.id===state.selected);if(!p){state.route='orders';return orders()}const s=projectStats(p);
  return `${pageHead('',{back:true,more:true})}${projectTracking(p)}<div class="project-detail-head"><div class="project-code">${esc(p.project_code||p.id)} <span class="badge">${esc(p.status||'Active')}</span></div><h1>${esc(p.title)}</h1><div class="progress"><span style="width:${s.pct}%"></span></div><div class="meta"><span>${s.done} of ${s.total} deliverables</span><b>${s.pct}%</b></div></div><div class="tabs detail-tabs"><button class="active">Deliverables</button><button id="projectDetailsBtn">Details</button><button id="projectInvoiceBtn">Invoice</button></div><div class="timeline card">${(p.deliverables||[]).map(d=>`<div class="deliverable"><span class="dot ${d.completed?'done':String(d.status||'').toLowerCase()==='in progress'?'progressing':''}">${d.completed?'✓':''}</span><div><div class="d-name">${esc(d.item_name||d.name||'Deliverable')}</div><div class="d-sub"><span class="status-text ${String(d.status||'').toLowerCase().replace(/\s+/g,'-')}">${esc(d.status||(d.completed?'Completed':'Pending'))}</span> <span>${esc(fmtDate(d.due_date||p.deadline_date))}</span></div></div><span></span></div>`).join('')||'<div class="empty compact-empty">No deliverables yet.</div>'}</div>${p.drive_url?`<div class="card project-drive-card timelock-folder"><div class="folder-lock-icon">${icon('folderlock',24)}</div><div class="drive-copy"><b>Project Files</b><small>Time-locked project folder · available while this project is active.</small></div><button class="btn small" data-drive="${esc(p.drive_url)}">Open in Drive</button></div>`:''}<div class="card balance-row"><div><span>Balance Due</span><b>${peso(p.balance)}</b></div><button class="btn primary" id="payProject">Make a Payment</button></div>`;
}

function payment(){
  const settings=state.portal?.paymentSettings||{},ps=(state.portal?.projects||[]).filter(p=>Number(p.balance||0)>0),qr=settings.qr_image_url||QR_FALLBACK;
  const selected=ps.find(p=>p.id===state.paymentProjectId)||ps[0]||null;if(selected&&!state.paymentProjectId)state.paymentProjectId=selected.id;
  const manual=state.manualPaymentAllowed&&state.paymentEntrySource==='manual',lock=manual?'':'readonly';
  return `${pageHead('Payment',{back:false,more:true})}<div class="tabs payment-tabs"><button class="active">Make a Payment</button><button id="paymentHistoryTab">History</button></div><div class="card payment-card"><b>Scan to Pay</b><p>Send your payment via ${esc(settings.method_label||'UnionBank InstaPay')}.</p><div class="qr-wrap"><img class="qr" src="${esc(qr)}" alt="UnionBank bank QR code"></div><div class="bank-meta"><div><span>Account Name</span><b>${esc(settings.account_name||'JUAN PROJECT')}</b></div><div><span>Account Number</span><b>${esc(settings.account_number||'•••• •••• 1710')}</b></div></div></div><div class="card payment-card secure-payment-card"><div class="secure-head"><div><b>Upload Payment Receipt</b><p>Gemini verifies the payment fields before submission.</p></div><span class="secure-chip">AI VERIFIED</span></div>${ps.length>1?`<div class="field"><label>Project</label><select id="payProjectSel" class="input">${ps.map(p=>`<option value="${esc(p.id)}" ${p.id===state.paymentProjectId?'selected':''}>${esc(p.project_code||p.id)} · ${esc(p.title)}</option>`).join('')}</select></div>`:`<input id="payProjectSel" type="hidden" value="${esc(selected?.id||'')}">`}<label class="upload" for="receipt"><input id="receipt" type="file" accept="image/jpeg,image/png,application/pdf" hidden>${icon('upload',26)}<b id="receiptLabel">Tap to upload receipt</b><span>JPG, PNG, or PDF · Max 5 MB</span></label><button id="readReceipt" class="btn full" style="margin-top:10px" disabled>Verify Receipt with Gemini</button><div id="verifiedPaymentFields" class="verified-fields ${state.extractedReceipt?'':'is-disabled'}"><div class="field"><label>Amount Paid</label><input id="payAmount" class="input locked-field" type="number" step="0.01" ${lock} value="${state.extractedReceipt?.netAmount??state.extractedReceipt?.amount??''}" placeholder="Waiting for Gemini"></div><div class="field"><label>Mode of Payment</label><input id="payMethod" class="input locked-field" ${lock} value="${esc(state.extractedReceipt?.paymentMethod||'')}" placeholder="Waiting for Gemini"></div><div class="field"><label>Reference Number</label><input id="payRef" class="input locked-field" ${lock} value="${esc(state.extractedReceipt?.referenceNumber||'')}" placeholder="Waiting for Gemini"></div><div class="field"><label>Date</label><input id="payDate" class="input locked-field" type="date" ${lock} value="${esc(state.extractedReceipt?.paymentDate||'')}"></div><div class="fee-readout"><span>Transfer fee deducted</span><b>${peso(Number(state.extractedReceipt?.transferFee||0))}</b></div></div>${state.manualPaymentAllowed?`<button id="manualEntryToggle" class="text-button manual-fallback">${manual?'Return to AI verified mode':'Gemini limit reached — Enter manually'}</button>`:''}<button id="submitPayment" class="btn primary full" style="margin-top:10px" ${(ps.length&&(state.extractedReceipt||manual))?'':'disabled'}>Submit Payment</button><div class="info-box">${icon('lock',18)}<span>Gemini-filled Amount Paid, payment mode, reference number, and date are locked. Manual encoding is available only when the Gemini usage limit is reached.</span></div></div>${paymentHistory()}`;
}
function paymentHistory(){const rows=state.portal?.paymentSubmissions||[];return `<div class="card payment-history"><div class="section-head inner"><h2>Payment History</h2></div>${rows.map(x=>`<div class="activity-row"><span class="activity-icon">${icon('payment',17)}</span><div><b>${peso(x.submitted_amount)}</b><small>${esc(x.reference_number||x.extracted_reference||'No reference')} · ${fmtDate(x.payment_date||x.submitted_at)}</small></div><span class="badge ${x.status==='pending'?'pending':''}">${esc(x.status)}</span></div>`).join('')||'<div class="empty compact-empty">No client-submitted payments yet.</div>'}</div>`}

function invoice(){
  const p=(state.portal?.projects||[]).find(x=>x.id===state.selected);if(!p){state.route='orders';return orders()}
  const subtotal=Number(p.subtotal_amount||p.items?.reduce((t,i)=>t+Number(i.price||0)*Number(i.qty||1),0)||p.total_amount||0),discount=Number(p.discount_amount||0),rush=Number(p.rush_fee||0),maintenance=Number(p.system_maintenance_fee||0),workload=Number(p.workload_surcharge||0),issue=p.invoice_issue_date||'',due=p.invoice_due_date||p.deadline_date||'';
  return `${pageHead('Invoice',{back:true,more:false})}<div id="clientInvoicePrintable" class="invoice workspace-document"><div class="invoice-h workspace-invoice-head"><div>${brand(true)}</div><div class="invoice-id"><span>INVOICE</span><b>${esc(p.invoice_number||('#'+(p.project_code||p.id)+'-2026'))}</b><i class="badge">${esc(p.payment_status||'UNPAID')}</i></div></div><div class="invoice-grid"><div><span>BILL TO</span><b>${esc(state.portal.profile.name||state.portal.profile.email)}</b><small>${esc(state.portal.profile.email||'')}</small></div><div><span>PROJECT</span><b>${esc(p.title)}</b><small>${issue?'Issued '+fmtDate(issue):''}${due?' · Due '+fmtDate(due):''}</small></div></div><table><thead><tr><th>ORDER ITEM</th><th>QTY</th><th>AMOUNT</th></tr></thead><tbody>${(p.items||[]).map(i=>`<tr><td>${esc(i.name||'Order Item')}</td><td>${Number(i.qty||1)}</td><td>${peso(Number(i.price||0)*Number(i.qty||1))}</td></tr>`).join('')||`<tr><td>${esc(p.title)}</td><td>1</td><td>${peso(subtotal)}</td></tr>`}</tbody></table><div class="invoice-summary-client"><div><span>Subtotal</span><b>${peso(subtotal)}</b></div>${discount?`<div><span>Discount</span><b>-${peso(discount)}</b></div>`:''}${rush?`<div><span>Rush Fee</span><b>${peso(rush)}</b></div>`:''}${maintenance?`<div><span>System Maintenance</span><b>${peso(maintenance)}</b></div>`:''}${workload?`<div><span>Workload Surcharge</span><b>${peso(workload)}</b></div>`:''}<div><span>Total</span><b>${peso(p.total_amount)}</b></div><div><span>Amount Paid</span><b>${peso(p.amount_paid)}</b></div><div class="invoice-balance"><span>Balance Due</span><b>${peso(p.balance)}</b></div></div><div class="invoice-footer">Thank you for choosing JUAN PROJECT.</div></div><button id="saveClientInvoice" class="btn full invoice-save-btn">Save / Print Invoice</button>`;
}

function account(){
  const p=state.portal.profile;
  return `${pageHead('Settings',{back:false,more:false})}<div class="card profile-card"><div class="avatar large">${initials()}</div><div><b>${esc(p.name||'Client')}</b><small>${esc(p.email||'')}</small><small>${esc(p.client_code||'')}</small></div>${icon('chevron',18)}</div><div class="settings-group"><div class="settings-label">Account</div><div class="card settings-list"><div class="settings-row"><div><b>Edit Profile</b><small>Managed by JUAN PROJECT</small></div>${icon('chevron',17)}</div><div class="settings-row password-settings"><div class="settings-password-copy"><b>Change Password</b><small>Update your current portal password.</small></div><div class="settings-password-form"><input id="newPass" class="input" type="password" minlength="8" placeholder="New password"><input id="newPass2" class="input" type="password" minlength="8" placeholder="Confirm password"><button id="changePass" class="btn full">Update Password</button></div></div><div class="settings-row"><b>Notifications</b>${icon('chevron',17)}</div></div></div><div class="settings-group"><div class="settings-label">Support</div><div class="card settings-list"><div class="settings-row"><b>Help & Support</b>${icon('chevron',17)}</div><div class="settings-row"><b>Terms & Privacy</b>${icon('chevron',17)}</div><div class="settings-row danger" id="logout"><b>Sign Out</b>${icon('chevron',17)}</div></div></div>`;
}

function categoryName(id){return state.catalog.categories.find(c=>c.id===id)?.name||'Service'}
function shopRow(x){
  const price=x.kind==='Package'?Number(x.new_price||0):Number(x.price||0),old=x.kind==='Package'?Number(x.original_price||0):0,key=`${x.kind}:${x.id}`;
  return `<div class="shop-row"><div><div class="shop-title">${esc(x.name)}</div><div class="shop-kind">${esc(x.product_code||'')} · ${esc(x.kind==='Package'?'Package':categoryName(x.category_id))}</div><p>${esc(x.description||'JUAN PROJECT creative service.')}</p></div><div class="shop-side"><div class="shop-price">${old>price?`<span>${peso(old)}</span>`:''}${peso(price)}</div><button class="btn small" data-view-shop="${esc(key)}">View</button></div></div>`
}
function shop(){
  const all=[...(state.catalog.services||[]).map(x=>({...x,kind:'Service'})),...(state.catalog.packages||[]).map(x=>({...x,kind:'Package'}))];
  const q=String(state.shopQuery||'').trim().toLowerCase(),pref=state.shopSort||'default';
  let items=all.filter(x=>!q||[x.name,x.description,x.kind,categoryName(x.category_id),x.product_code].some(v=>String(v||'').toLowerCase().includes(q)));
  const price=x=>x.kind==='Package'?Number(x.new_price||0):Number(x.price||0),code=x=>Number(String(x.product_code||'').match(/(\d+)$/)?.[1]||999999);items.sort(pref==='price-desc'?(a,b)=>price(b)-price(a)||code(a)-code(b):pref==='price-asc'?(a,b)=>price(a)-price(b)||code(a)-code(b):(a,b)=>code(a)-code(b));
  return `${pageHead('Shop',{back:false,more:false})}<p class="screen-subtitle">Explore JUAN PROJECT services and packages.${isLoggedIn()?'':' Log in to place an order.'}</p><div class="shop-tools"><div class="shop-search"><span>⌕</span><input id="shopSearch" value="${esc(state.shopQuery)}" placeholder="Search service ID or name"></div><select id="shopSort" class="input shop-sort"><option value="default" ${pref==='default'?'selected':''}>Default (by ID)</option><option value="price-desc" ${pref==='price-desc'?'selected':''}>Price: Highest to Lowest</option><option value="price-asc" ${pref==='price-asc'?'selected':''}>Price: Lowest to Highest</option></select></div><div class="shop-list">${items.map(shopRow).join('')||'<div class="card empty">No matching services.</div>'}</div>`
}
function findShopItem(key){const [kind,id]=String(key).split(':');if(kind==='Package')return {...state.catalog.packages.find(x=>x.id===id),kind};return {...state.catalog.services.find(x=>x.id===id),kind:'Service'}}

function bind(){
  document.querySelectorAll('[data-open]').forEach(x=>x.onclick=()=>{if(!isLoggedIn())return gate();state.selected=x.dataset.open;state.route='project';render()});
  document.querySelectorAll('[data-drive]').forEach(x=>x.onclick=()=>window.open(x.dataset.drive,'_blank','noopener'));
  const topAccount=document.getElementById('topAccount');if(topAccount)topAccount.onclick=()=>{state.route='account';render()};
  const homeShop=document.getElementById('homeShop');if(homeShop)homeShop.onclick=()=>{state.route='shop';render()};
  const homeSignIn=document.getElementById('homeSignIn');if(homeSignIn)homeSignIn.onclick=()=>authScreen();
  const homeOrders=document.getElementById('homeOrders');if(homeOrders)homeOrders.onclick=()=>{state.route='orders';render()};
  const back=document.getElementById('screenBack');if(back)back.onclick=()=>{if(state.route==='invoice'){state.route='project'}else if(state.route==='project'){state.route='orders'}else{state.route='home'}render()};
  document.querySelectorAll('[data-order-filter]').forEach(b=>b.onclick=()=>{state.orderFilter=b.dataset.orderFilter;render()});
  const payProject=document.getElementById('payProject');if(payProject)payProject.onclick=()=>{state.paymentProjectId=state.selected;state.route='payment';render()};
  const invoiceBtn=document.getElementById('projectInvoiceBtn');if(invoiceBtn)invoiceBtn.onclick=()=>{state.route='invoice';render()};
  const detailsBtn=document.getElementById('projectDetailsBtn');if(detailsBtn)detailsBtn.onclick=()=>toast('Project details are summarized in the project header.');
  document.querySelectorAll('[data-view-shop]').forEach(b=>b.onclick=()=>{state.shopItem=findShopItem(b.dataset.viewShop);render()});
  const shopSort=document.getElementById('shopSort');if(shopSort)shopSort.onchange=()=>{state.shopSort=shopSort.value;render()};
  const shopSearch=document.getElementById('shopSearch');if(shopSearch){shopSearch.oninput=()=>{state.shopQuery=shopSearch.value;const pos=shopSearch.selectionStart;render();const next=document.getElementById('shopSearch');if(next){next.focus();try{next.setSelectionRange(pos,pos)}catch{}}}};
  const paymentHistoryTab=document.getElementById('paymentHistoryTab');if(paymentHistoryTab)paymentHistoryTab.onclick=()=>document.querySelector('.payment-history')?.scrollIntoView({behavior:'smooth'});
  const projectSel=document.getElementById('payProjectSel');if(projectSel&&projectSel.tagName==='SELECT')projectSel.onchange=()=>{state.paymentProjectId=projectSel.value;const p=(state.portal?.projects||[]).find(x=>x.id===projectSel.value);const a=document.getElementById('payAmount');if(a&&p)a.value=Number(p.balance||0).toFixed(2)};

  const receipt=document.getElementById('receipt'),receiptLabel=document.getElementById('receiptLabel'),readBtn=document.getElementById('readReceipt');
  if(receipt)receipt.onchange=async()=>{const f=receipt.files?.[0];if(!f)return;try{state.extractedReceipt=null;state.receiptPath=await uploadReceipt(f);if(receiptLabel)receiptLabel.textContent='Receipt uploaded';if(readBtn)readBtn.disabled=false;toast('Receipt uploaded securely.')}catch(e){toast(e.message)}};
  if(readBtn)readBtn.onclick=async()=>{try{readBtn.disabled=true;readBtn.textContent='Verifying…';const x=await extractReceipt(state.receiptPath);state.extractedReceipt=x;state.manualPaymentAllowed=false;state.paymentEntrySource='gemini';toast('Payment details verified and locked.');render()}catch(e){if(e.status===429||e.status===501||e.code==='GEMINI_LIMIT'){state.manualPaymentAllowed=true;state.paymentEntrySource='manual';toast('Gemini limit reached. Manual entry is temporarily available.');render()}else toast(e.message)}finally{if(document.body.contains(readBtn)){readBtn.disabled=false;readBtn.textContent='Verify Receipt with Gemini'}}};
  const submitBtn=document.getElementById('submitPayment');if(submitBtn)submitBtn.onclick=async()=>{try{if(!state.receiptPath)throw Error('Upload a receipt first.');const amt=document.getElementById('payAmount'),projectSel=document.getElementById('payProjectSel'),method=document.getElementById('payMethod'),ref=document.getElementById('payRef'),date=document.getElementById('payDate'),amount=Number(amt?.value||0);if(!(amount>0))throw Error('A verified amount is required.');if(!projectSel?.value)throw Error('Select a project.');submitBtn.disabled=true;root.innerHTML=`<div class="flow-screen"><div class="flow-spinner"></div><h2>Processing Payment</h2><p>Securely validating your receipt and preparing the submission…</p></div>`;await new Promise(r=>setTimeout(r,650));await submitPaymentApi({projectId:projectSel.value,amount,paymentMethod:method?.value||'',referenceNumber:ref?.value||'',paymentDate:date?.value||'',receiptPath:state.receiptPath,extracted:state.extractedReceipt,entrySource:state.paymentEntrySource});root.innerHTML=`<div class="flow-screen success"><div class="flow-check">✓</div><h2>Payment Submitted</h2><p>Your payment was recorded successfully and is now pending admin approval.</p><button id="paymentDone" class="btn primary full">Done</button></div>`;state.portal=await getPortal();state.receiptPath=null;state.extractedReceipt=null;state.manualPaymentAllowed=false;state.paymentEntrySource='gemini';document.getElementById('paymentDone').onclick=()=>{state.route='payment';render()}}catch(e){toast(e.message);state.route='payment';render()}};
  const manualToggle=document.getElementById('manualEntryToggle');if(manualToggle)manualToggle.onclick=()=>{state.paymentEntrySource=state.paymentEntrySource==='manual'?'gemini':'manual';render()};
  document.querySelectorAll('[data-toggle-pass]').forEach(b=>b.onclick=()=>{const input=document.getElementById(b.dataset.togglePass);if(input)input.type=input.type==='password'?'text':'password';});
  const saveInvoice=document.getElementById('saveClientInvoice');if(saveInvoice)saveInvoice.onclick=()=>window.print();
  const changeBtn=document.getElementById('changePass');if(changeBtn)changeBtn.onclick=async()=>{try{const p1=document.getElementById('newPass'),p2=document.getElementById('newPass2');if((p1?.value||'').length<8)throw Error('Use at least 8 characters.');if(p1.value!==p2.value)throw Error('Passwords do not match.');await setPassword(p1.value);await markPasswordSet();toast('Password updated.');p1.value=p2.value=''}catch(e){toast(e.message)}};
  const logoutBtn=document.getElementById('logout');if(logoutBtn)logoutBtn.onclick=async()=>{await signOut();state.portal=null;state.route='home';render()};
}

(async()=>{try{await getSupabase();try{state.catalog=await getCatalog();state.catalogLoaded=true}catch(e){console.warn('Catalog:',e.message)}const s=await session();if(s)return loadPortal();if(localStorage.getItem(ONBOARDING_KEY)==='1')return render();welcomeScreen()}catch(e){console.error(e);if(localStorage.getItem(ONBOARDING_KEY)==='1')render();else welcomeScreen()}})();
