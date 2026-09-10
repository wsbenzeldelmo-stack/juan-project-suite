import {getSupabase,session,signIn,setPassword,changePasswordWithCurrent,sendPasswordReset,signOut} from './auth.js';
import {getPortal,getCatalog,markPasswordSet} from './data.js';
import {uploadReceipt,submitPayment as submitPaymentApi} from './payments.js';
import {peso,esc,fmtDate,remaining,toast} from './utils.js';

const root=document.getElementById('root');
const QR_FALLBACK='/assets/unionbank-bankqr-placeholder.jpg';
const ONBOARDING_KEY='JUAN_ONBOARDING_DONE_V5';

let state={
  route:'home',portal:null,selected:null,receiptPath:null,extractedReceipt:null,
  catalog:{categories:[],services:[],packages:[],packageItems:[]},catalogLoaded:false,
  gateOpen:false,onboardingStep:0,orderFilter:'active',shopItem:null,paymentProjectId:null,
  shopQuery:'',shopSort:'default',paymentFlow:'',
  notificationOpen:false
};

const isLoggedIn=()=>Boolean(state.portal?.profile);
const initials=()=>esc((state.portal?.profile?.name||state.portal?.profile?.email||'JP').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase());
const brand=(compact=false)=>`<div class="brand ${compact?'compact':''}" aria-label="JUAN PROJECT Online"><div><span>JUAN</span> <i>+</i><br><span>PROJECT</span> <em>Online</em></div></div>`;

const icons={
  home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/><path d="M9 20v-6h6v6"/>',
  orders:'<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 4.5h6"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  payment:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h3"/>',
  shop:'<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M8 8a4 4 0 0 1 8 0"/>',
  account:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  back:'<path d="m15 18-6-6 6-6"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  upload:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 15v5h16v-5"/>',
  drive:'<path d="M12 3 4 17h5l3-5 3 5h5L12 3Z"/><path d="M9 17h6"/>',
  chevron:'<path d="m9 18 6-6-6-6"/>',
  eye:'<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  folderlock:'<path d="M3 7h7l2 2h9v10H3z"/><rect x="13" y="13" width="6" height="5" rx="1"/><path d="M14.5 13v-1a1.5 1.5 0 0 1 3 0v1"/>',
  folder:'<path d="M3 7h7l2 2h9v10H3z"/>',
  alert:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/>',
  receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/>',
  spark:'<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.5 2.5 0 1 1 4.5 1.5c-.8.9-2.2 1.3-2.2 2.7M12 17h.01"/>'
};
const icon=(name,size=20)=>`<svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||''}</svg>`;

const nav=()=>`<nav class="nav" aria-label="Primary navigation">
  <button data-r="home" class="${state.route==='home'?'active':''}">${icon('home')}<span>Home</span></button>
  <button data-r="orders" class="${['orders','project','invoice'].includes(state.route)?'active':''}">${icon('orders')}<span>Orders</span></button>
  <button data-r="payment" class="${state.route==='payment'?'active':''}">${icon('payment')}<span>Payment</span></button>
  <button data-r="shop" class="${state.route==='shop'?'active':''}">${icon('shop')}<span>Shop</span></button>
  <button data-r="account" class="${state.route==='account'?'active':''}">${icon('account')}<span>Account</span></button>
</nav>`;

function welcomeScreen(){
  root.innerHTML=`<div class="welcome-shell"><div class="phone-page welcome-card"><div class="welcome-hero">${brand()}<div class="welcome-copy"><span class="eyebrow">CLIENT PORTAL</span><h1>Your projects.<br><strong>In one place.</strong></h1><p>Track progress, manage payments, and receive your files with less friction.</p></div></div><div class="welcome-actions"><button id="getStarted" class="btn primary full">Get Started</button><button id="welcomeLogIn" class="btn full">Log In</button></div><div class="version">JUAN PROJECT Online · V1.3.1</div></div></div>`;
  document.getElementById('getStarted').onclick=()=>{state.onboardingStep=0;onboardingScreen()};
  document.getElementById('welcomeLogIn').onclick=()=>authScreen();
}

const onboardingSlides=[
  '/assets/onboarding/onboarding-1.jpg',
  '/assets/onboarding/onboarding-2.jpg',
  '/assets/onboarding/onboarding-3.jpg'
];
function onboardingScreen(){
  const src=onboardingSlides[state.onboardingStep];
  root.innerHTML=`<div class="visual-onboard-shell"><div class="visual-onboard-card"><img class="visual-onboard-image" src="${src}" alt="JUAN PROJECT Online introduction ${state.onboardingStep+1} of ${onboardingSlides.length}"><button id="skipOnboard" class="visual-skip">Skip</button><div class="visual-onboard-controls"><div class="visual-dots">${onboardingSlides.map((_,i)=>`<span class="${i===state.onboardingStep?'active':''}"></span>`).join('')}</div><button id="onboardNext" class="visual-next" aria-label="${state.onboardingStep===onboardingSlides.length-1?'Finish introduction':'Next introduction'}">${state.onboardingStep===onboardingSlides.length-1?'Get Started':'→'}</button></div></div></div>`;
  document.getElementById('skipOnboard').onclick=()=>enterGuest();
  document.getElementById('onboardNext').onclick=()=>{if(state.onboardingStep<onboardingSlides.length-1){state.onboardingStep++;onboardingScreen()}else enterGuest()};
  const card=document.querySelector('.visual-onboard-card');let x0=null;
  card.addEventListener('touchstart',e=>{x0=e.touches?.[0]?.clientX??null},{passive:true});
  card.addEventListener('touchend',e=>{if(x0==null)return;const x1=e.changedTouches?.[0]?.clientX??x0,dx=x1-x0;x0=null;if(Math.abs(dx)<45)return;if(dx<0&&state.onboardingStep<onboardingSlides.length-1){state.onboardingStep++;onboardingScreen()}else if(dx>0&&state.onboardingStep>0){state.onboardingStep--;onboardingScreen()}},{passive:true});
}

function enterGuest(){localStorage.setItem(ONBOARDING_KEY,'1');state.route='home';state.gateOpen=false;render()}

function setFieldError(id,message=''){
  const el=document.getElementById(id);if(!el)return;
  el.textContent=message;
  const input=el.closest('.field')?.querySelector('.input');
  if(input)input.classList.toggle('invalid',Boolean(message));
}
function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim())}

function authScreen(message=''){
  root.innerHTML=`<div class="auth-shell"><div class="phone-page auth-card"><button id="authBack" class="icon-button auth-back" aria-label="Back">${icon('back')}</button><div class="auth-copy auth-copy-top"><span class="eyebrow">CLIENT ACCESS</span><h1>Welcome back</h1><p>Log in to view your projects, payments, invoices, and project files.</p></div><div class="field"><label for="ae">Email Address</label><input id="ae" class="input" type="email" autocomplete="username" placeholder="you@example.com"><div id="emailValidation" class="field-error"></div></div><div class="field password-field"><label for="ap">Password</label><div class="password-input-wrap"><input id="ap" class="input" type="password" autocomplete="current-password" placeholder="Enter your password"><button id="toggleLoginPass" type="button" class="password-eye" aria-label="Show password">${icon('eye',18)}</button></div><div id="loginValidation" class="field-error"></div></div><div class="auth-options"><label class="remember"><input id="rememberLogin" type="checkbox" checked> <span>Remember me</span></label><button id="forgotPassword" class="text-button">Forgot password?</button></div><button id="ab" class="btn primary full">Log In</button><div class="info-box">${icon('lock',18)}<span>Client accounts are provided by JUAN PROJECT when a project is created. If you received a temporary password, you will be asked to change it after logging in.</span></div>${message?`<p class="form-message error-message">${esc(message)}</p>`:''}</div></div>`;
  const email=document.getElementById('ae'),pass=document.getElementById('ap'),btn=document.getElementById('ab');
  document.getElementById('authBack').onclick=()=>{localStorage.getItem(ONBOARDING_KEY)==='1'?render():welcomeScreen()};
  email.addEventListener('blur',()=>setFieldError('emailValidation',email.value.trim()&&!validEmail(email.value)?'Enter a valid email address.':''));
  btn.onclick=async()=>{
    setFieldError('emailValidation','');setFieldError('loginValidation','');
    const e=email.value.trim();
    if(!e){setFieldError('emailValidation','Enter your email address.');email.focus();return}
    if(!validEmail(e)){setFieldError('emailValidation','Enter a valid email address.');email.focus();return}
    if(!pass.value){setFieldError('loginValidation','Enter your password.');pass.focus();return}
    try{
      btn.disabled=true;btn.innerHTML=`<span class="btn-spinner"></span> Logging you in…`;
      await signIn(e,pass.value);await loadPortal();
    }catch(err){setFieldError('loginValidation','Email or password is incorrect.');toast('Log in failed. Check your credentials and try again.')}finally{if(document.body.contains(btn)){btn.disabled=false;btn.textContent='Log In'}}
  };
  pass.addEventListener('keydown',e=>{if(e.key==='Enter')btn.click()});
  const toggle=document.getElementById('toggleLoginPass');if(toggle)toggle.onclick=()=>{const show=pass.type==='password';pass.type=show?'text':'password';toggle.setAttribute('aria-label',show?'Hide password':'Show password')};
  document.getElementById('forgotPassword').onclick=async()=>{try{const e=email.value.trim();if(!e||!validEmail(e)){setFieldError('emailValidation','Enter your registered email address first.');return}await sendPasswordReset(e);toast('If this account can receive email, a password reset link has been sent.')}catch(err){toast('Password reset could not be started right now.')}};
}

async function loadPortal(){
  try{state.portal=await getPortal();localStorage.setItem(ONBOARDING_KEY,'1');if(!state.portal.passwordSet)return renderSetPassword();state.route='home';render()}
  catch(e){state.portal=null;authScreen('We could not open your client portal. Please try again.')}
}
function renderSetPassword(){
  root.innerHTML=`<div class="auth-shell"><div class="phone-page auth-card"><button id="passwordBack" class="icon-button auth-back" aria-label="Log out">${icon('back')}</button><div class="password-icon">${icon('lock',34)}</div><div class="auth-copy centered"><span class="eyebrow">SECURITY STEP</span><h1>Change your password</h1><p>You are using a temporary password. Create a new password before continuing to your portal.</p></div><div class="field"><label>Current Password</label><div class="password-input-wrap"><input id="currentPass" class="input" type="password" autocomplete="current-password" placeholder="Current password"><button type="button" class="password-eye" data-toggle-pass="currentPass">${icon('eye',18)}</button></div></div><div class="field"><label>New Password</label><div class="password-input-wrap"><input id="p1" class="input" type="password" autocomplete="new-password" minlength="8" placeholder="New password"><button type="button" class="password-eye" data-toggle-pass="p1">${icon('eye',18)}</button></div></div><div class="field"><label>Confirm New Password</label><div class="password-input-wrap"><input id="p2" class="input" type="password" autocomplete="new-password" minlength="8" placeholder="Confirm new password"><button type="button" class="password-eye" data-toggle-pass="p2">${icon('eye',18)}</button></div><div id="passwordValidation" class="field-error"></div></div><div class="password-rule">${icon('lock',18)}<span>Use at least 8 characters. A mix of letters, numbers, and symbols is recommended.</span></div><button id="savep" class="btn primary full">Update Password & Continue</button></div></div>`;
  document.getElementById('passwordBack').onclick=async()=>{await signOut();state.portal=null;authScreen()};
  document.querySelectorAll('[data-toggle-pass]').forEach(b=>b.onclick=()=>{const input=document.getElementById(b.dataset.togglePass);if(input)input.type=input.type==='password'?'text':'password'});
  document.getElementById('savep').onclick=async()=>{const cur=document.getElementById('currentPass'),p1=document.getElementById('p1'),p2=document.getElementById('p2'),btn=document.getElementById('savep');setFieldError('passwordValidation','');if(!cur.value){setFieldError('passwordValidation','Enter your temporary password.');return}if(p1.value.length<8){setFieldError('passwordValidation','Use at least 8 characters.');return}if(p1.value!==p2.value){setFieldError('passwordValidation','Passwords do not match.');return}try{btn.disabled=true;btn.innerHTML=`<span class="btn-spinner"></span> Updating…`;await changePasswordWithCurrent(state.portal.profile.email,cur.value,p1.value);await markPasswordSet();state.portal.passwordSet=true;root.innerHTML=`<div class="flow-screen success"><div class="flow-check">✓</div><span class="eyebrow">ACCOUNT READY</span><h2>Password Updated</h2><p>Your JUAN PROJECT Online account is ready to use.</p><button id="passwordDone" class="btn primary full">Continue to Home</button></div>`;document.getElementById('passwordDone').onclick=()=>{state.route='home';render()}}catch(e){setFieldError('passwordValidation',e.message||'Password could not be updated.')}finally{if(document.body.contains(btn)){btn.disabled=false;btn.textContent='Update Password & Continue'}}};
}

function gate(){state.gateOpen=true;render()}
function gateOverlay(){return state.gateOpen?`<div class="overlay" id="gateOverlay"><div class="sheet center"><button id="gateX" class="icon-button sheet-x" aria-label="Close">×</button><div class="sheet-icon">${icon('lock',26)}</div><h2>Log in required</h2><p>This area contains private JUAN PROJECT client information.</p><div class="sheet-actions"><button id="gateLogIn" class="btn primary full">Log In</button><button id="gateShop" class="btn full">Continue Browsing</button></div></div></div>`:''}

function notificationOverlay(){
  if(!state.notificationOpen||!isLoggedIn())return'';
  const rows=activityFeed();
  return `<div class="overlay" id="notificationOverlay"><div class="sheet notification-sheet"><button id="notificationX" class="icon-button sheet-x" aria-label="Close">×</button><div class="sheet-header-left"><span class="eyebrow">ACTIVITY</span><h2 class="sheet-title">Notifications</h2><p>Project and payment updates from JUAN PROJECT.</p></div><div class="notification-list">${rows.map(x=>`<div class="notification-row"><span>${icon(x.icon,16)}</span><div><b>${esc(x.title)}</b><small>${esc(x.sub)} · ${esc(fmtDate(x.date))}</small></div></div>`).join('')||'<div class="empty compact-empty">No notifications yet.</div>'}</div></div></div>`;
}

function shopOverlay(){if(!state.shopItem)return'';const x=state.shopItem,price=x.kind==='Package'?Number(x.new_price||0):Number(x.price||0),old=x.kind==='Package'?Number(x.original_price||0):0;return `<div class="overlay" id="shopOverlay"><div class="sheet shop-detail-sheet"><button id="shopX" class="icon-button sheet-x" aria-label="Close">×</button><div class="shop-kind">${esc(x.product_code||'')} · ${esc(x.kind==='Package'?'Package':categoryName(x.category_id))}</div><h2 class="sheet-title">${esc(x.name)}</h2><div class="detail-price">${old>price?`<span>${peso(old)}</span>`:''}${peso(price)}</div><p class="detail-copy">${esc(x.description||'JUAN PROJECT creative service.')}</p><div class="service-detail-meta"><div><span>Turnaround</span><b>Standard 14 days</b></div><div><span>Ordering</span><b>${isLoggedIn()?'Client account ready':'Log in required'}</b></div></div>${isLoggedIn()?`<button id="detailStartProject" class="btn primary full">Start a Project</button>`:`<button id="detailLogIn" class="btn primary full">Log In to Start a Project</button>`}<button id="detailClose" class="btn full">Close</button></div></div>`}

function pageHead(title,{back=false,more=false}={}){return `<div class="screen-head"><button id="screenBack" class="icon-button ${back?'':'ghost-space'}" ${back?'':'disabled'} aria-label="Back">${back?icon('back'):''}</button><h1>${esc(title)}</h1><button class="icon-button ${more?'':'ghost-space'}" aria-label="More">${more?icon('more'):''}</button></div>`}
function projectStats(p){const ds=p?.deliverables||[],done=ds.filter(d=>d.completed||String(d.status||'').toLowerCase()==='completed').length,total=ds.length||Math.max(1,p?.items?.length||0),pct=total?Math.round(done/total*100):0;return{done,total,pct}}
function nextDeliverable(p){return (p?.deliverables||[]).filter(d=>!d.completed&&String(d.status||'').toLowerCase()!=='completed').sort((a,b)=>new Date(a.due_date||'9999-12-31')-new Date(b.due_date||'9999-12-31'))[0]||null}
function activeProject(){return (state.portal?.projects||[]).filter(p=>!['completed','cancelled','delivered'].includes(String(p.status||'').toLowerCase())).sort((a,b)=>new Date(a.deadline_date||'9999-12-31')-new Date(b.deadline_date||'9999-12-31'))[0]||null}
function latestProject(){return (state.portal?.projects||[])[0]||null}
function pendingSubmissionFor(p){return (state.portal?.paymentSubmissions||[]).find(x=>String(x.project_id)===String(p?.id)&&String(x.status||'').toLowerCase()==='pending')}
function nextAction(p){if(!p)return{kind:'none',title:'No action required',body:'You have no active project right now.'};const sub=pendingSubmissionFor(p);if(sub)return{kind:'pending',title:'Payment under review',body:`${peso(sub.submitted_amount)} submitted ${fmtDate(sub.payment_date||sub.submitted_at)}.`,cta:'View Payment',route:'payment'};if(Number(p.balance||0)>0)return{kind:'payment',title:'Payment required',body:`${peso(p.balance)} balance due for ${p.project_code||'your project'}.`,cta:'Pay Now',route:'payment'};const next=nextDeliverable(p);if(next)return{kind:'progress',title:'Production in progress',body:`Next: ${next.item_name||'Deliverable'} · ${fmtDate(next.due_date||p.deadline_date)}.`,cta:'Track Order',route:'project'};return{kind:'none',title:'No action required',body:'Your project is moving forward. We will surface the next step here.'}}
function activityFeed(){const rows=[];(state.portal?.paymentSubmissions||[]).slice(0,4).forEach(x=>rows.push({date:new Date(x.submitted_at||x.payment_date||0),title:'Payment submitted',sub:`${peso(x.submitted_amount)} · ${String(x.status||'pending')}`,icon:'payment'}));for(const p of state.portal?.projects||[]){for(const d of p.deliverables||[]){if(d.completed)rows.push({date:new Date(d.completed_at||d.due_date||p.deadline_date||0),title:'Deliverable completed',sub:`${p.project_code||''} · ${d.item_name||'Deliverable'}`,icon:'check'})}}return rows.filter(x=>!Number.isNaN(x.date.getTime())).sort((a,b)=>b.date-a.date).slice(0,5)}

function home(){
  if(!isLoggedIn())return `<div class="guest-home"><div class="guest-brand">${brand(true)}</div><div class="guest-copy"><span class="eyebrow">JUAN PROJECT ONLINE</span><h1>Track your project.<br>Shop when you need more.</h1><p>Browse JUAN PROJECT services as a guest. Client-only project, payment, invoice, and file tools unlock after you log in.</p></div><div class="guest-actions"><button id="homeShop" class="btn primary full">Browse Shop</button><button id="homeLogIn" class="btn full">Log In</button></div><div class="card guest-access"><div class="mini-icon">${icon('lock',19)}</div><div><b>Already a JUAN PROJECT client?</b><p>Your account is created by JUAN PROJECT when your project is recorded.</p></div></div></div>`;
  const p=activeProject(),s=p?projectStats(p):null,next=p?nextDeliverable(p):null,action=nextAction(p),recent=activityFeed();
  return `<div class="dashboard-head"><div><span>Good day,</span><h1>${esc((state.portal.profile.name||'Client').split(/\s+/)[0])}</h1></div><div class="dashboard-actions"><button id="notificationBtn" class="icon-button" aria-label="Notifications">${icon('bell')}</button><button id="topAccount" class="avatar">${initials()}</button></div></div>${p?`<button class="card active-project project-button" data-open="${esc(p.id)}"><div class="card-topline"><span class="eyebrow">ACTIVE PROJECT</span><span class="status-dot-label">${esc(p.status||'In Progress')}</span></div><div class="project-code">${esc(p.project_code||p.id)}</div><div class="project-name">${esc(p.title)}</div><div class="progress"><span style="width:${s.pct}%"></span></div><div class="meta"><span>${s.done} of ${s.total} deliverables</span><b>${s.pct}%</b></div>${next?`<div class="next-deliverable"><span>Next Deliverable</span><b>${esc(next.item_name||'Deliverable')}</b><small>${esc(fmtDate(next.due_date||p.deadline_date))} · ${esc(remaining(next.due_date||p.deadline_date))}</small></div>`:''}<div class="card-action-row"><span>View Order Tracker</span>${icon('chevron',17)}</div></button>`:'<div class="card empty guided-empty"><b>No active project</b><span>Your next active project will appear here.</span></div>'}<div class="section-head"><h2>Next Action</h2></div><div class="card next-action-card ${action.kind}"><div class="next-action-icon">${icon(action.kind==='payment'?'payment':action.kind==='pending'?'clock':action.kind==='progress'?'orders':'check',20)}</div><div><b>${esc(action.title)}</b><p>${esc(action.body)}</p></div>${action.cta?`<button id="nextActionBtn" class="btn small">${esc(action.cta)}</button>`:''}</div><div class="section-head"><h2>Recent Activity</h2><button id="homeOrders">View Orders</button></div><div class="card activity-card">${recent.map(x=>`<div class="activity-row"><span class="activity-icon">${icon(x.icon,16)}</span><div><b>${esc(x.title)}</b><small>${esc(x.sub)} · ${esc(fmtDate(x.date))}</small></div></div>`).join('')||'<div class="empty compact-empty">No recent activity yet.</div>'}</div>`;
}

function orders(){
  const all=state.portal?.projects||[],filter=state.orderFilter;
  const ps=all.filter(p=>filter==='all'||(filter==='completed'?['completed','delivered'].includes(String(p.status||'').toLowerCase()):!['completed','cancelled','delivered'].includes(String(p.status||'').toLowerCase())));
  return `${pageHead('Orders',{back:false,more:false})}<p class="screen-subtitle">Track each JUAN PROJECT order from confirmation to delivery.</p><div class="tabs order-tabs"><button data-order-filter="active" class="${filter==='active'?'active':''}">Active</button><button data-order-filter="completed" class="${filter==='completed'?'active':''}">Completed</button><button data-order-filter="all" class="${filter==='all'?'active':''}">All</button></div><div class="project-list">${ps.map(p=>{const s=projectStats(p);return `<button class="card project-list-card project-button" data-open="${esc(p.id)}"><div class="project-list-top"><div><div class="project-code">${esc(p.project_code||p.id)}</div><div class="project-name">${esc(p.title||'Untitled Project')}</div><small>${esc(p.status||'Pending')}</small></div>${icon('chevron',18)}</div><div class="progress"><span style="width:${s.pct}%"></span></div><div class="meta"><span>${s.done}/${s.total} deliverables</span><b>${s.pct}%</b></div>${p.deadline_date?`<div class="order-deadline">Estimated completion · ${esc(fmtDate(p.deadline_date))}</div>`:''}</button>`}).join('')||'<div class="card empty guided-empty"><b>No matching orders</b><span>Orders in this status will appear here.</span></div>'}</div>`;
}

function trackingStages(p){
  const s=projectStats(p),status=String(p.status||'').toLowerCase(),paid=Number(p.amount_paid||0),allDone=s.total>0&&s.done>=s.total;
  let current=0;
  if(paid>0||String(p.payment_status||'').toLowerCase().includes('paid'))current=1;
  if(status.includes('progress')||s.pct>0)current=Math.max(current,2);
  if(status.includes('production')||s.pct>=20)current=Math.max(current,3);
  if(status.includes('review')||status.includes('quality')||s.pct>=80)current=Math.max(current,4);
  if(status.includes('ready')||allDone||p.drive_url)current=Math.max(current,5);
  if(status.includes('complete')||status.includes('deliver'))current=6;
  return {current,stages:[
    ['Order Confirmed','Your project is recorded in JUAN PROJECT.'],
    ['Payment Confirmed','A payment has been recorded for this project.'],
    ['Production Started','Work has started on project deliverables.'],
    ['In Production','Your project is actively being produced.'],
    ['Quality Check','Deliverables are being reviewed before release.'],
    ['Ready for Delivery','Final files are being prepared for release.'],
    ['Completed','Your project is complete.']
  ]};
}
function projectTracking(p){const {current,stages}=trackingStages(p);return `<div class="tracking-card card"><div class="section-head inner"><div><span class="eyebrow">ORDER TRACKER</span><h2>Project Progress</h2></div><span class="tracker-step-count">${Math.min(current+1,stages.length)} of ${stages.length}</span></div><div class="route-timeline">${stages.map(([title,desc],i)=>`<div class="route-node ${i<current?'done':i===current?'current':'future'}"><div class="route-marker">${i<current?icon('check',13):i+1}</div><div class="route-copy"><b>${esc(title)}</b><small>${esc(desc)}</small>${i===current?'<span>Current stage</span>':''}</div></div>`).join('')}</div></div>`}

function folderState(p){
  const now=Date.now(),unlock=p.drive_unlock_at?new Date(p.drive_unlock_at).getTime():null,expires=p.drive_expires_at?new Date(p.drive_expires_at).getTime():null;
  if(expires&&Number.isFinite(expires)&&now>expires)return{mode:'expired',title:'Access Expired',body:'This project folder is no longer available. Contact JUAN PROJECT if you need access restored.'};
  if(!p.drive_url)return{mode:'locked',title:'Project Files',body:'Your project folder has not been released yet.'};
  if(unlock&&Number.isFinite(unlock)&&now<unlock)return{mode:'locked',title:'Project Files',body:`Files unlock ${fmtDate(p.drive_unlock_at)} · ${remaining(p.drive_unlock_at)}`};
  return{mode:'open',title:'Project Files',body:expires?`Available until ${fmtDate(p.drive_expires_at)}.`:'Your project files are ready.'};
}
function projectFolder(p){const f=folderState(p);return `<div class="card timelock-folder ${f.mode}"><div class="folder-lock-icon">${icon(f.mode==='open'?'folder':'folderlock',25)}</div><div class="drive-copy"><span class="eyebrow">SECURE DELIVERY</span><b>${esc(f.title)}</b><small>${esc(f.body)}</small></div>${f.mode==='open'?`<button class="btn small" data-drive="${esc(p.drive_url)}">Open in Drive</button>`:`<span class="lock-state">${f.mode==='expired'?'Expired':'Locked'}</span>`}</div>`}

function project(){
  const p=(state.portal?.projects||[]).find(x=>x.id===state.selected);if(!p){state.route='orders';return orders()}const s=projectStats(p);
  return `${pageHead('Order Tracker',{back:true,more:true})}<div class="project-summary-card card"><div class="card-topline"><span class="project-code">${esc(p.project_code||p.id)}</span><span class="badge">${esc(p.status||'Active')}</span></div><h2>${esc(p.title)}</h2><div class="progress"><span style="width:${s.pct}%"></span></div><div class="meta"><span>${s.done} of ${s.total} deliverables</span><b>${s.pct}%</b></div>${p.deadline_date?`<div class="estimated-row"><span>Estimated completion</span><b>${esc(fmtDate(p.deadline_date))}</b></div>`:''}</div>${projectTracking(p)}<div class="section-head"><h2>Deliverables</h2><span>${s.done} of ${s.total} completed</span></div><div class="deliverables-card card">${(p.deliverables||[]).map(d=>{const done=d.completed||String(d.status||'').toLowerCase()==='completed',progressing=!done&&String(d.status||'').toLowerCase().includes('progress');return `<div class="deliverable"><span class="dot ${done?'done':progressing?'progressing':''}">${done?'✓':''}</span><div><div class="d-name">${esc(d.item_name||d.name||'Deliverable')}</div><div class="d-sub"><span class="status-text ${String(d.status||'Pending').toLowerCase().replace(/\s+/g,'-')}">${esc(d.status||(done?'Completed':'Pending'))}</span><span>${esc(fmtDate(d.due_date||p.deadline_date))}</span></div></div></div>`}).join('')||'<div class="empty compact-empty">No deliverables have been added yet.</div>'}</div><div class="project-actions-row"><button class="btn" id="projectInvoiceBtn">View Invoice</button><button class="btn primary" id="payProject">Make a Payment</button></div>${projectFolder(p)}`;
}

function paymentSummary(p){if(!p)return'';return `<div class="payment-summary card"><div><span>Project Total</span><b>${peso(p.total_amount||0)}</b></div><div><span>Amount Paid</span><b>${peso(p.amount_paid||0)}</b></div><div class="balance"><span>Balance Due</span><b>${peso(p.balance||0)}</b></div></div>`}
function verifiedField(label,id,value,type='text',readonly=true){return `<div class="field"><label>${esc(label)}</label><input id="${id}" class="input ${readonly?'locked-field':''}" type="${type}" ${readonly?'readonly':''} value="${esc(value??'')}"></div>`}
function payment(){
  const settings=state.portal?.paymentSettings||{},all=state.portal?.projects||[],ps=all.filter(p=>Number(p.balance||0)>0),qr=settings.qr_image_url||QR_FALLBACK;
  const selected=all.find(p=>p.id===state.paymentProjectId)||ps[0]||latestProject();if(selected&&!state.paymentProjectId)state.paymentProjectId=selected.id;
  return `${pageHead('Payment',{back:false,more:false})}${selected?paymentSummary(selected):''}<div class="tabs payment-tabs"><button class="active">Make a Payment</button><button id="paymentHistoryTab">History</button></div><div class="card payment-card"><div class="payment-card-head"><div><span class="eyebrow">BANK TRANSFER</span><b>Scan to Pay</b><p>Send your payment via ${esc(settings.method_label||'UnionBank InstaPay')}.</p></div>${icon('payment',22)}</div><div class="qr-wrap"><img class="qr" src="${esc(qr)}" alt="UnionBank bank QR code"></div><div class="bank-meta"><div><span>Account Name</span><b>${esc(settings.account_name||'JUAN PROJECT')}</b></div><div><span>Account Number</span><b>${esc(settings.account_number||'•••• •••• 1710')}</b></div></div>${settings.instructions?`<p class="payment-instructions">${esc(settings.instructions)}</p>`:''}</div><div class="card payment-card secure-payment-card"><div class="secure-head"><div><span class="eyebrow">PAYMENT PROOF</span><b>Submit Payment Details</b><p>Upload a JPG, JPEG, PNG, or PDF receipt · maximum 5 MB.</p></div>${icon('receipt',22)}</div><label class="upload" for="receipt">${icon('upload',24)}<span id="receiptLabel">${state.receiptPath?'Receipt uploaded':'Choose receipt'}</span><small>Tap to select payment proof</small><input id="receipt" type="file" accept="image/jpeg,image/png,application/pdf" hidden></label><div class="manual-payment-grid"><div class="field"><label>Amount Paid</label><input id="payAmount" class="input" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00"></div><div class="field"><label>Mode of Payment</label><select id="payMethod" class="input"><option value="UnionBank">UnionBank</option><option value="GCash">GCash</option><option value="Maya">Maya</option><option value="Bank Transfer">Bank Transfer</option><option value="Other">Other</option></select></div><div class="field"><label>Reference Number</label><input id="payRef" class="input" autocomplete="off" placeholder="Transaction reference"></div><div class="field"><label>Payment Date</label><input id="payDate" class="input" type="date"></div><div class="field"><label>Transfer Fee</label><input id="payTransferFee" class="input" type="number" min="0" step="0.01" inputmode="decimal" value="0"></div><div class="fee-readout net"><span>Net Amount</span><b id="payNetAmount">₱0.00</b></div></div><div class="field"><label>Apply to Project</label><select id="payProjectSel" class="input">${(all||[]).map(p=>`<option value="${esc(p.id)}" ${selected?.id===p.id?'selected':''}>${esc(p.project_code||p.id)} · ${esc(p.title)}</option>`).join('')}</select></div><button id="submitPayment" class="btn primary full" ${!state.receiptPath?'disabled':''}>Submit Payment for Review</button><p class="form-help">Payment details are reviewed by JUAN PROJECT before they affect your balance.</p></div><div class="section-head payment-history"><h2>Payment History</h2></div><div class="card history-list">${(state.portal?.paymentSubmissions||[]).map(h=>`<div class="history-row"><div><b>${peso(h.submitted_amount)}</b><small>${esc(fmtDate(h.payment_date||h.submitted_at))} · ${esc(h.reference_number||'No reference')}</small></div><span class="badge ${String(h.status||'').toLowerCase()==='pending'?'pending':''}">${esc(h.status||'Pending')}</span></div>`).join('')||'<div class="empty compact-empty">No payment submissions yet.</div>'}</div>`;
}
async function exportNodeAsPng(element,filename){
  if(!element)throw Error('Invoice preview is not available.');
  const rect=element.getBoundingClientRect(),width=Math.max(1,Math.ceil(Math.max(rect.width,element.scrollWidth))),height=Math.max(1,Math.ceil(Math.max(rect.height,element.scrollHeight)));
  let css='';for(const sheet of Array.from(document.styleSheets)){try{css+=Array.from(sheet.cssRules||[]).map(r=>r.cssText).join('\n')+'\n'}catch(_){}}
  const clone=element.cloneNode(true);clone.style.margin='0';clone.style.boxShadow='none';clone.style.background='#fff';
  const serialized=new XMLSerializer().serializeToString(clone);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>${css}</style>${serialized}</div></foreignObject></svg>`;
  const svgUrl=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
  try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Could not render invoice image.'));img.src=svgUrl});const maxSide=8192,scale=Math.max(1,Math.min(2,maxSide/width,maxSide/height)),canvas=document.createElement('canvas');canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png',1));if(!png)throw Error('Could not create PNG.');const finalName=filename||'JUAN-PROJECT-Invoice.png',file=new File([png],finalName,{type:'image/png'});if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:finalName});return}catch(e){if(e?.name==='AbortError')return}}const url=URL.createObjectURL(png),a=document.createElement('a');a.href=url;a.download=finalName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}finally{URL.revokeObjectURL(svgUrl)}
}
function clientInvoiceFees(p){const rows=[];const add=(label,amount)=>{amount=Math.max(0,Number(amount||0));if(amount>0)rows.push({label,amount})};add('Rush Fee',p.rush_fee);add('Workload Surcharge',p.workload_surcharge);add('System Maintenance Fee',p.system_maintenance_fee);if(Array.isArray(p.additional_fees))p.additional_fees.forEach(f=>add(String(f?.label||f?.name||'Additional Fee'),f?.amount));return rows}

function invoice(){
  const p=(state.portal?.projects||[]).find(x=>x.id===state.selected)||latestProject();if(!p)return `${pageHead('Invoice',{back:true})}<div class="card empty">No invoice available.</div>`;
  const items=Array.isArray(p.items)?p.items:[],fees=clientInvoiceFees(p),additionalFeesTotal=fees.reduce((sum,f)=>sum+f.amount,0),discount=Math.max(0,Number(p.discount_amount||0));
  const itemSubtotal=items.reduce((t,i)=>t+Math.max(0,Number(i.price||0))*Math.max(1,Number(i.qty||1)),0),storedTotal=Math.max(0,Number(p.total_amount||0)),subtotal=Math.max(0,Number(p.subtotal_amount||itemSubtotal||(storedTotal-additionalFeesTotal+discount))),total=storedTotal||Math.max(0,subtotal+additionalFeesTotal-discount),due=p.invoice_due_date||p.deadline_date||'';
  const issued=new Date().toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}),feeBlock=fees.length?`<div class="invoice-fees-client"><div class="invoice-fees-title">Additional Fees</div>${fees.map(f=>`<div><span>${esc(f.label)}</span><b>+${peso(f.amount)}</b></div>`).join('')}<div class="invoice-fees-total"><span>Additional Fees Total</span><b>${peso(additionalFeesTotal)}</b></div></div>`:'';
  return `${pageHead('Invoice',{back:true,more:false})}<div id="clientInvoicePrintable" class="invoice workspace-document"><div class="invoice-h workspace-invoice-head"><div>${brand(true)}</div><div class="invoice-id"><span>INVOICE</span><b>${esc(p.invoice_number||('#'+(p.project_code||p.id)+'-2026'))}</b><i class="badge">${esc(p.payment_status||'UNPAID')}</i></div></div><div class="invoice-grid"><div><span>BILL TO</span><b>${esc(state.portal.profile.name||state.portal.profile.email)}</b><small>${esc(state.portal.profile.email||'')}</small></div><div><span>PROJECT</span><b>${esc(p.title)}</b><small>Issued ${esc(issued)}${due?' · Due '+esc(fmtDate(due)):''}</small></div></div><table><thead><tr><th>ORDER ITEM</th><th>QTY</th><th>AMOUNT</th></tr></thead><tbody>${items.map(i=>`<tr><td>${esc(i.name||'Order Item')}</td><td>${Math.max(1,Number(i.qty||1))}</td><td>${peso(Math.max(0,Number(i.price||0))*Math.max(1,Number(i.qty||1)))}</td></tr>`).join('')||`<tr><td>${esc(p.title)}</td><td>1</td><td>${peso(subtotal)}</td></tr>`}</tbody></table><div class="invoice-summary-client"><div><span>Subtotal</span><b>${peso(subtotal)}</b></div>${feeBlock}${discount>0?`<div><span>Discount</span><b>-${peso(discount)}</b></div>`:''}<div class="invoice-total-client"><span>Total</span><b>${peso(total)}</b></div><div><span>Amount Paid</span><b>${peso(p.amount_paid)}</b></div><div class="invoice-balance"><span>Balance Due</span><b>${peso(p.balance)}</b></div></div><div class="invoice-footer"><strong>JUAN PROJECT</strong><br>Thank you for choosing JUAN PROJECT.</div></div><div class="invoice-export-actions"><button id="saveClientInvoiceImage" class="btn primary full invoice-save-btn">Save as Image</button><button id="saveClientInvoice" class="btn full invoice-save-btn">Save / Print PDF</button></div>`;
}

function account(){
  const p=state.portal.profile;
  return `${pageHead('Account',{back:false,more:false})}<div class="card profile-card"><div class="avatar large">${initials()}</div><div><b>${esc(p.name||'Client')}</b><small>${esc(p.email||'')}</small><small>${esc(p.client_code||'')}</small></div></div><div class="settings-group"><div class="settings-label">ACCOUNT</div><div class="card settings-list"><div class="settings-row"><div><b>Profile</b><small>Managed by JUAN PROJECT Workspace</small></div>${icon('chevron',17)}</div><div class="settings-row password-settings"><div class="settings-password-copy"><b>Change Password</b><small>Update your current portal password.</small></div><div class="settings-password-form"><div class="password-input-wrap"><input id="newPass" class="input" type="password" minlength="8" placeholder="New password"><button type="button" class="password-eye" data-toggle-pass="newPass">${icon('eye',18)}</button></div><div class="password-input-wrap"><input id="newPass2" class="input" type="password" minlength="8" placeholder="Confirm password"><button type="button" class="password-eye" data-toggle-pass="newPass2">${icon('eye',18)}</button></div><button id="changePass" class="btn full">Update Password</button></div></div><div class="settings-row"><div><b>Notifications</b><small>Project and payment updates</small></div>${icon('chevron',17)}</div></div></div><div class="settings-group"><div class="settings-label">SUPPORT</div><div class="card settings-list"><div class="settings-row"><div><b>Help & Support</b><small>Contact JUAN PROJECT</small></div>${icon('chevron',17)}</div><div class="settings-row"><b>Terms & Privacy</b>${icon('chevron',17)}</div><div class="settings-row danger" id="logout"><b>Log Out</b>${icon('chevron',17)}</div></div></div><div class="settings-group"><div class="settings-label">ABOUT</div><div class="card settings-list"><div class="settings-row jp-about-row"><div><b>JUAN PROJECT Online</b><small>Version V1.3.1</small><small>Developed by BENZEL DELMO</small><small>JUAN PROJECT Management System</small></div></div></div></div>`;
}

function categoryName(id){return state.catalog.categories.find(c=>c.id===id)?.name||'Service'}
function shopRow(x){const price=x.kind==='Package'?Number(x.new_price||0):Number(x.price||0),old=x.kind==='Package'?Number(x.original_price||0):0,key=`${x.kind}:${x.id}`;return `<button class="shop-row" data-view-shop="${esc(key)}"><div><div class="shop-kind">${esc(x.product_code||'')} · ${esc(x.kind==='Package'?'Package':categoryName(x.category_id))}</div><div class="shop-title">${esc(x.name)}</div><p>${esc(x.description||'JUAN PROJECT creative service.')}</p></div><div class="shop-side"><div class="shop-price">${old>price?`<span>${peso(old)}</span>`:''}${peso(price)}</div>${icon('chevron',17)}</div></button>`}
function shop(){
  const all=[...(state.catalog.services||[]).map(x=>({...x,kind:'Service'})),...(state.catalog.packages||[]).map(x=>({...x,kind:'Package'}))];
  const q=String(state.shopQuery||'').trim().toLowerCase(),pref=state.shopSort||'default';
  let items=all.filter(x=>!q||[x.name,x.description,x.kind,categoryName(x.category_id),x.product_code].some(v=>String(v||'').toLowerCase().includes(q)));
  const price=x=>x.kind==='Package'?Number(x.new_price||0):Number(x.price||0),code=x=>Number(String(x.product_code||'').match(/(\d+)$/)?.[1]||999999);items.sort(pref==='price-desc'?(a,b)=>price(b)-price(a)||code(a)-code(b):pref==='price-asc'?(a,b)=>price(a)-price(b)||code(a)-code(b):(a,b)=>code(a)-code(b));
  return `${pageHead('Shop',{back:false,more:false})}<div class="shop-hero"><span class="eyebrow">JUAN PROJECT SERVICES</span><h2>Bring your next idea to life.</h2><p>Browse creative services and production packages. ${isLoggedIn()?'Your client account is ready when you want to start a project.':'Log in only when you are ready to start a project.'}</p></div><div class="shop-tools"><div class="shop-search"><span>⌕</span><input id="shopSearch" value="${esc(state.shopQuery)}" placeholder="Search service ID or name"></div><select id="shopSort" class="input shop-sort"><option value="default" ${pref==='default'?'selected':''}>Default (by ID)</option><option value="price-asc" ${pref==='price-asc'?'selected':''}>Price: Low to High</option><option value="price-desc" ${pref==='price-desc'?'selected':''}>Price: High to Low</option></select></div><div class="shop-list">${items.map(shopRow).join('')||'<div class="card empty guided-empty"><b>No matching services</b><span>Try a different service ID or keyword.</span></div>'}</div>`;
}
function findShopItem(key){const [kind,id]=String(key).split(':');if(kind==='Package')return {...state.catalog.packages.find(x=>String(x.id)===String(id)),kind};return {...state.catalog.services.find(x=>String(x.id)===String(id)),kind:'Service'}}

function routePage(){if(state.route==='home')return home();if(state.route==='shop')return shop();if(state.route==='orders')return orders();if(state.route==='project')return project();if(state.route==='payment')return payment();if(state.route==='invoice')return invoice();if(state.route==='account')return account();return home()}
function render(){root.innerHTML=`<div class="app"><main class="page">${routePage()}</main>${nav()}${gateOverlay()}${shopOverlay()}${notificationOverlay()}</div>`;bind()}

function bind(){
  document.querySelectorAll('.nav [data-r]').forEach(b=>b.onclick=()=>{const r=b.dataset.r;if(!isLoggedIn()&&['orders','payment','account'].includes(r))return gate();state.route=r;render()});
  document.querySelectorAll('[data-open]').forEach(x=>x.onclick=()=>{if(!isLoggedIn())return gate();state.selected=x.dataset.open;state.route='project';render()});
  document.querySelectorAll('[data-drive]').forEach(x=>x.onclick=()=>window.open(x.dataset.drive,'_blank','noopener'));
  const topAccount=document.getElementById('topAccount');if(topAccount)topAccount.onclick=()=>{state.route='account';render()};
  const homeShop=document.getElementById('homeShop');if(homeShop)homeShop.onclick=()=>{state.route='shop';render()};
  const homeLogIn=document.getElementById('homeLogIn');if(homeLogIn)homeLogIn.onclick=()=>authScreen();
  const homeOrders=document.getElementById('homeOrders');if(homeOrders)homeOrders.onclick=()=>{state.route='orders';render()};
  const notificationBtn=document.getElementById('notificationBtn');if(notificationBtn)notificationBtn.onclick=()=>{state.notificationOpen=true;render()};
  const nextActionBtn=document.getElementById('nextActionBtn');if(nextActionBtn)nextActionBtn.onclick=()=>{const p=activeProject(),a=nextAction(p);if(a.route==='project'&&p)state.selected=p.id;if(a.route)state.route=a.route;render()};
  const back=document.getElementById('screenBack');if(back&&!back.disabled)back.onclick=()=>{if(state.route==='invoice'){state.route='project'}else if(state.route==='project'){state.route='orders'}else{state.route='home'}render()};
  document.querySelectorAll('[data-order-filter]').forEach(b=>b.onclick=()=>{state.orderFilter=b.dataset.orderFilter;render()});
  const payProject=document.getElementById('payProject');if(payProject)payProject.onclick=()=>{state.paymentProjectId=state.selected;state.route='payment';render()};
  const invoiceBtn=document.getElementById('projectInvoiceBtn');if(invoiceBtn)invoiceBtn.onclick=()=>{state.route='invoice';render()};
  document.querySelectorAll('[data-view-shop]').forEach(b=>b.onclick=()=>{state.shopItem=findShopItem(b.dataset.viewShop);render()});
  const shopSort=document.getElementById('shopSort');if(shopSort)shopSort.onchange=()=>{state.shopSort=shopSort.value;render()};
  const shopSearch=document.getElementById('shopSearch');if(shopSearch){shopSearch.oninput=()=>{state.shopQuery=shopSearch.value;const pos=shopSearch.selectionStart;render();const next=document.getElementById('shopSearch');if(next){next.focus();try{next.setSelectionRange(pos,pos)}catch{}}}};
  const paymentHistoryTab=document.getElementById('paymentHistoryTab');if(paymentHistoryTab)paymentHistoryTab.onclick=()=>document.querySelector('.payment-history')?.scrollIntoView({behavior:'smooth'});
  const projectSel=document.getElementById('payProjectSel');if(projectSel)projectSel.onchange=()=>{state.paymentProjectId=projectSel.value;render()};

  const receipt=document.getElementById('receipt'),receiptLabel=document.getElementById('receiptLabel'),submitBtn=document.getElementById('submitPayment');
  if(receipt)receipt.onchange=async()=>{const f=receipt.files?.[0];if(!f)return;try{if(f.size>5*1024*1024)throw Error('Receipt must be 5 MB or smaller.');state.receiptPath=await uploadReceipt(f);if(receiptLabel)receiptLabel.textContent='Receipt uploaded';if(submitBtn)submitBtn.disabled=false;toast('Receipt uploaded securely.')}catch(e){toast(e.message)}};
  const updateNet=()=>{const a=Number(document.getElementById('payAmount')?.value||0),f=Math.max(0,Number(document.getElementById('payTransferFee')?.value||0)),n=Math.max(0,a-f),el=document.getElementById('payNetAmount');if(el)el.textContent=peso(n)};['payAmount','payTransferFee'].forEach(id=>document.getElementById(id)?.addEventListener('input',updateNet));
  if(submitBtn)submitBtn.onclick=async()=>{try{if(!state.receiptPath)throw Error('Upload a receipt first.');const amt=document.getElementById('payAmount'),projectSel=document.getElementById('payProjectSel'),method=document.getElementById('payMethod'),ref=document.getElementById('payRef'),date=document.getElementById('payDate'),fee=document.getElementById('payTransferFee'),amount=Number(amt?.value||0),transferFee=Math.max(0,Number(fee?.value||0));if(!(amount>0))throw Error('Enter the amount paid.');if(!method?.value)throw Error('Select a mode of payment.');if(!ref?.value.trim())throw Error('Enter the transaction reference number.');if(!date?.value)throw Error('Enter the payment date.');if(!projectSel?.value)throw Error('Select a project.');submitBtn.disabled=true;root.innerHTML=`<div class="flow-screen"><div class="flow-spinner"></div><span class="eyebrow">PAYMENT SUBMISSION</span><h2>Processing your payment…</h2><div class="processing-steps"><span class="done">Receipt uploaded</span><span>Validating details</span><span>Preparing submission</span></div><p>Please keep this page open for a moment.</p></div>`;await new Promise(r=>setTimeout(r,450));await submitPaymentApi({projectId:projectSel.value,amount,paymentMethod:method.value,referenceNumber:ref.value.trim(),paymentDate:date.value,transferFee,receiptPath:state.receiptPath,entrySource:'manual'});state.portal=await getPortal();state.receiptPath=null;root.innerHTML=`<div class="flow-screen success"><div class="flow-check">✓</div><span class="eyebrow">SUBMISSION RECEIVED</span><h2>Payment Submitted</h2><p>Your payment proof is pending JUAN PROJECT review. Your balance updates only after approval.</p><div class="success-summary"><div><span>Amount</span><b>${peso(amount)}</b></div><div><span>Status</span><b>Pending Review</b></div></div><button id="paymentBackOrder" class="btn primary full">Back to Order</button><button id="paymentHistoryDone" class="btn full">View Payment History</button></div>`;document.getElementById('paymentBackOrder').onclick=()=>{state.selected=projectSel.value;state.route='project';render()};document.getElementById('paymentHistoryDone').onclick=()=>{state.route='payment';render();setTimeout(()=>document.querySelector('.payment-history')?.scrollIntoView({behavior:'smooth'}),20)}}catch(e){toast(e.message||'Payment could not be submitted.');state.route='payment';render()}};
  document.querySelectorAll('[data-toggle-pass]').forEach(b=>b.onclick=()=>{const input=document.getElementById(b.dataset.togglePass);if(input)input.type=input.type==='password'?'text':'password'});
  const saveInvoice=document.getElementById('saveClientInvoice');if(saveInvoice)saveInvoice.onclick=()=>window.print();
  const saveInvoiceImage=document.getElementById('saveClientInvoiceImage');if(saveInvoiceImage)saveInvoiceImage.onclick=async()=>{try{saveInvoiceImage.disabled=true;saveInvoiceImage.textContent='Creating image…';const p=(state.portal?.projects||[]).find(x=>x.id===state.selected)||latestProject();await exportNodeAsPng(document.getElementById('clientInvoicePrintable'),`${p?.project_code||'JUAN-PROJECT'}-invoice.png`);toast('Invoice image saved.')}catch(e){toast(e.message||'Could not save invoice image.')}finally{if(document.body.contains(saveInvoiceImage)){saveInvoiceImage.disabled=false;saveInvoiceImage.textContent='Save as Image'}}};
  const changeBtn=document.getElementById('changePass');if(changeBtn)changeBtn.onclick=async()=>{try{const p1=document.getElementById('newPass'),p2=document.getElementById('newPass2');if((p1?.value||'').length<8)throw Error('Use at least 8 characters.');if(p1.value!==p2.value)throw Error('Passwords do not match.');changeBtn.disabled=true;changeBtn.textContent='Updating…';await setPassword(p1.value);await markPasswordSet();toast('Password updated.');p1.value=p2.value=''}catch(e){toast(e.message)}finally{if(document.body.contains(changeBtn)){changeBtn.disabled=false;changeBtn.textContent='Update Password'}}};
  const logoutBtn=document.getElementById('logout');if(logoutBtn)logoutBtn.onclick=async()=>{await signOut();state.portal=null;state.route='home';render()};
  const gateX=document.getElementById('gateX');if(gateX)gateX.onclick=()=>{state.gateOpen=false;render()};
  const gateLogIn=document.getElementById('gateLogIn');if(gateLogIn)gateLogIn.onclick=()=>authScreen();
  const gateShop=document.getElementById('gateShop');if(gateShop)gateShop.onclick=()=>{state.gateOpen=false;state.route='shop';render()};
  const notificationX=document.getElementById('notificationX');if(notificationX)notificationX.onclick=()=>{state.notificationOpen=false;render()};
  const shopX=document.getElementById('shopX');if(shopX)shopX.onclick=()=>{state.shopItem=null;render()};
  const detailClose=document.getElementById('detailClose');if(detailClose)detailClose.onclick=()=>{state.shopItem=null;render()};
  const detailLogIn=document.getElementById('detailLogIn');if(detailLogIn)detailLogIn.onclick=()=>authScreen();
  const detailStartProject=document.getElementById('detailStartProject');if(detailStartProject)detailStartProject.onclick=()=>{state.shopItem=null;toast('Project request flow will continue from your selected service.');render()};
}

(async()=>{try{await getSupabase();try{state.catalog=await getCatalog();state.catalogLoaded=true}catch(e){console.warn('Catalog:',e.message)}const s=await session();if(s)return loadPortal();if(localStorage.getItem(ONBOARDING_KEY)==='1')return render();welcomeScreen()}catch(e){console.error(e);if(localStorage.getItem(ONBOARDING_KEY)==='1')render();else welcomeScreen()}})();
