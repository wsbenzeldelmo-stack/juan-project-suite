(()=>{'use strict';
const peso=v=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(Number(v||0));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})};
function state(){try{return window.app?.getWorkspaceState?.()||{}}catch{return {}}}
function balance(p){
  const pays=(p.payments||[]).filter(x=>!x.deleted_at).reduce((s,x)=>s+Number(x.amount_paid||x.amount||0),0);
  return Math.max(0,Number(p.total_amount||0)+Number(p.late_fee_total||0)-pays);
}
function statusClass(s){s=String(s||'').toLowerCase();if(s.includes('overdue'))return'overdue';if(s.includes('grace'))return'grace';if(s.includes('review'))return'review';return''}
function financeHTML(p){
  const bal=balance(p),fee=Number(p.late_fee_total||0),s=p.financial_status||p.payment_status||(bal<=0?'PAID':'UNPAID');
  return '<section class="jp-project-finance-panel" data-jp-finance-project="'+esc(p.id)+'"><div class="jp-finance-summary">'+
    '<div class="jp-finance-cell balance"><span>Current Balance</span><strong>'+peso(bal)+'</strong></div>'+
    '<div class="jp-finance-cell"><span>Payment Status</span><b class="jp-finance-tag '+statusClass(s)+'">'+esc(s)+'</b></div>'+
    '<div class="jp-finance-cell"><span>Due Date</span><strong>'+date(p.payment_due_date)+'</strong></div>'+
    '<div class="jp-finance-cell"><span>Overdue Fees</span><strong class="'+(fee>0?'jp-late-fee-row':'')+'">'+peso(fee)+'</strong></div>'+
    '</div><div class="jp-project-finance-note">Grace period ends '+date(p.grace_period_end)+' · Overdue status begins '+date(p.overdue_started_at)+'. Values are enforced by the JUAN PROJECT backend.</div></section>';
}
function findProjectFromDialog(root){
  const st=state(),ps=st.projects||[];
  const text=(root.textContent||'');
  return ps.find(p=>text.includes(p.project_code||'__none__')||text.includes(p.id)||text.includes(p.title||'__none__'))||null;
}
function enhanceProjectDialog(root){
  if(!root||root.dataset.jpFinanceEnhanced==='1')return;
  const p=findProjectFromDialog(root);if(!p)return;
  root.dataset.jpFinanceEnhanced='1';
  const target=root.querySelector('.modal-body,.jp-suite-body,.suite-panel>div:not(.suite-head),.project-details-content')||root.querySelector('header')?.nextElementSibling||root;
  const wrap=document.createElement('div');wrap.innerHTML=financeHTML(p);
  target.prepend(wrap.firstElementChild);
}
function enhancePaymentReview(root){
  if(!root||root.dataset.jpPaymentFinance==='1')return;
  const text=(root.textContent||'').toLowerCase();
  if(!text.includes('payment')||(!text.includes('approve')&&!text.includes('reject')))return;
  const st=state(),ps=st.projects||[];
  const p=ps.find(x=>(root.textContent||'').includes(x.project_code||'__')||(root.textContent||'').includes(x.title||'__'));
  if(!p)return;
  root.dataset.jpPaymentFinance='1';
  const box=document.createElement('div');box.className='jp-payment-review-finance';
  box.innerHTML='<div><span>Authoritative Balance</span><b>'+peso(balance(p))+'</b></div><div><span>Late Fees</span><b>'+peso(p.late_fee_total||0)+'</b></div><div><span>Status</span><b class="jp-finance-tag '+statusClass(p.financial_status)+'">'+esc(p.financial_status||'—')+'</b></div>';
  const body=root.querySelector('.modal-body,.jp-suite-body,.suite-panel')||root;body.prepend(box);
}
function normalizeTables(scope=document){
  scope.querySelectorAll('table').forEach(t=>{
    if(t.dataset.jpUnified==='1')return;t.dataset.jpUnified='1';
    t.querySelectorAll('thead th:last-child').forEach(th=>{const x=(th.textContent||'').trim().toLowerCase();if(x==='actions'||x==='action'||x==='options')th.textContent=''});
    t.querySelectorAll('button').forEach(b=>{
      const txt=(b.textContent||'').trim();
      if((txt==='...'||txt==='•••'||txt==='⋯')&&!b.querySelector('svg')){b.textContent='⋮';b.setAttribute('aria-label',b.getAttribute('aria-label')||'More actions');}
    });
  });
}
function cleanEscapedText(scope=document){
  const w=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);const nodes=[];while(w.nextNode())nodes.push(w.currentNode);
  nodes.forEach(n=>{if(/\\n|\/n/.test(n.nodeValue||'')){n.nodeValue=n.nodeValue.replace(/\\n|\/n/g,' ');n.parentElement?.classList.add('jp-cleaned-escaped-newline')}});
}
function activeProject(){
  const st=state(),id=st.activeProjectId;
  return (st.projects||[]).find(p=>String(p.id)===String(id))||null;
}
const financeHistoryCache=new Map();
async function getProjectFinancialHistory(projectId){
  const now=Date.now(),cached=financeHistoryCache.get(projectId);
  if(cached&&now-cached.at<20000)return cached.data;
  const rt=window.JuanSuiteRuntime;if(!rt?.request)return null;
  const data=await rt.request('/api/suite',{action:'project-financial-history',project_id:projectId});
  financeHistoryCache.set(projectId,{at:now,data});return data;
}
function ledgerLabel(type){
  const map={payment:'Payment',overdue_fee:'Overdue Fee',adjustment:'Adjustment',discount:'Discount',refund:'Refund',reversal:'Reversal',rush_fee:'Rush Fee',maintenance_fee:'Maintenance Fee',workload_surcharge:'Workload Surcharge'};
  return map[type]||String(type||'Entry').replace(/_/g,' ');
}
async function enhanceFinancialHistory(){
  const tab=document.getElementById('projTab-payment-tracker');
  if(!tab||!tab.classList.contains('active'))return;
  const p=activeProject();if(!p)return;
  let card=document.getElementById('jpFinancialLedgerCard');
  if(!card){
    card=document.createElement('section');card.id='jpFinancialLedgerCard';card.className='card jp-financial-ledger-card';
    card.innerHTML='<div class="card-header"><div><div class="section-kicker">AUDIT</div><h3 class="card-title">Financial Ledger</h3></div></div><div class="jp-financial-ledger-body"><div class="jp-history-loading">Loading backend ledger…</div></div>';
    tab.append(card);
  }
  if(card.dataset.projectId===String(p.id)&&card.dataset.loaded==='1')return;
  card.dataset.projectId=String(p.id);card.dataset.loaded='0';
  try{
    const data=await getProjectFinancialHistory(p.id);if(!data)return;
    if(card.dataset.projectId!==String(p.id))return;
    const ledger=data.ledger||[],invoices=data.invoices||[],notifications=data.notifications||[],body=card.querySelector('.jp-financial-ledger-body');
    body.innerHTML=
      '<div class="jp-ledger-summary">'+
        '<div><span>Ledger Entries</span><b>'+ledger.length+'</b></div>'+
        '<div><span>Issued Invoices</span><b>'+invoices.filter(x=>x.status!=='void').length+'</b></div>'+
        '<div><span>Latest Invoice</span><b>'+esc(invoices[0]?.invoice_number||'—')+'</b></div>'+
      '</div>'+
      (ledger.length?'<div class="jp-ledger-list">'+ledger.slice(0,12).map(x=>
        '<div class="jp-ledger-row"><div><strong>'+esc(ledgerLabel(x.entry_type))+'</strong><small>'+esc(x.note||'Backend financial event')+' · '+date(x.occurred_at)+'</small></div><b class="'+(x.direction==='credit'?'credit':'debit')+'">'+(x.direction==='credit'?'- ':'+ ')+peso(x.amount)+'</b></div>'
      ).join('')+'</div>':'<div class="jp-history-empty">No financial ledger entries yet.</div>')+
      (invoices.length?'<div class="jp-issued-invoices"><h4>Invoice Snapshots</h4>'+invoices.slice(0,6).map(inv=>
        '<div class="jp-invoice-snapshot-row"><div><strong>'+esc(inv.invoice_number)+'</strong><small>'+date(inv.issued_at)+' · '+esc(inv.status||'issued')+'</small></div><div><b>'+peso(inv.total)+'</b><small>Balance '+peso(inv.balance)+'</small></div></div>'
      ).join('')+'</div>':'')+
      (notifications.length?'<div class="jp-client-events"><h4>Client & Payment Events</h4><div class="jp-client-event-list">'+notifications.slice(0,10).map(n=>
        '<div class="jp-client-event"><i class="jp-client-event-dot '+esc(n.severity||'info')+'"></i><div class="jp-client-event-copy"><strong>'+esc(n.title||n.type||'Event')+'</strong><small>'+esc(n.body||'')+'</small></div><time>'+date(n.created_at)+'</time></div>'
      ).join('')+'</div></div>':'');
    card.dataset.loaded='1';
  }catch(e){
    const body=card.querySelector('.jp-financial-ledger-body');if(body)body.innerHTML='<div class="jp-history-empty">Financial history could not be loaded.</div>';
  }
}
function enhanceProjectPage(){
  const view=document.querySelector('#view-project-details.active');if(!view)return;
  const p=activeProject();if(!p)return;
  let panel=document.getElementById('jpProjectFinanceSummary');
  const wrap=document.createElement('div');wrap.innerHTML=financeHTML(p);
  const fresh=wrap.firstElementChild;fresh.id='jpProjectFinanceSummary';
  if(panel) panel.replaceWith(fresh);
  else{
    const progress=document.getElementById('projectOverallProgress');
    const tabs=view.querySelector('.project-details-tabs');
    if(progress)progress.after(fresh);else if(tabs)tabs.before(fresh);
  }
  enhanceInvoiceActions(p);
}
async function issueInvoiceSnapshot(project){
  const rt=window.JuanSuiteRuntime;
  if(!rt?.request)throw new Error('Workspace API is not ready.');
  const out=await rt.request('/api/suite',{action:'issue-invoice',project_id:project.id});
  window.showToast?.('Invoice snapshot issued'+(out?.invoice?.invoice_number?' · '+out.invoice.invoice_number:'')+'.');
  return out;
}
function enhanceInvoiceActions(p){
  const tab=document.getElementById('projTab-invoice'),bar=tab?.querySelector('.invoice-actions-bar');if(!bar||!p)return;
  let btn=document.getElementById('jpIssueInvoiceSnapshot');
  if(!btn){
    btn=document.createElement('button');btn.id='jpIssueInvoiceSnapshot';btn.className='btn btn-secondary btn-sm';
    const icon=window.JuanWorkspaceIcon?.('file','sm')||'';
    btn.innerHTML=icon+'<span>Issue Snapshot</span>';
    bar.prepend(btn);
  }
  btn.onclick=async()=>{
    if(btn.disabled)return;btn.disabled=true;
    const old=btn.innerHTML;btn.textContent='Issuing…';
    try{await issueInvoiceSnapshot(p)}catch(e){window.showToast?.(e?.message||String(e))}
    finally{btn.disabled=false;btn.innerHTML=old;}
  };
}
function enhancePaymentsPage(){
  const view=document.querySelector('#view-payments.active');if(!view)return;
  view.querySelectorAll('tbody tr').forEach(row=>{
    if(row.dataset.jpFinancialRow==='1')return;
    row.dataset.jpFinancialRow='1';
    const cells=[...row.cells];if(cells.length<8)return;
    const statusCell=cells[7],text=(statusCell?.textContent||'').trim().toUpperCase();
    if(!text)return;
    statusCell.classList.add('jp-financial-status-cell',statusClass(text));
  });
}
function enhanceSettingsPage(){
  const view=document.querySelector('#view-settings.active');if(!view)return;
  view.querySelectorAll('.jp-settings-segment').forEach(seg=>seg.setAttribute('tabindex','-1'));
}
function enhanceModals(){
  document.querySelectorAll('[role="dialog"],.modal,.jp-suite-modal,.suite-panel,.modal-card').forEach(d=>{enhanceProjectDialog(d);enhancePaymentReview(d)});
}
function run(){
  normalizeTables();cleanEscapedText();enhanceModals();enhanceProjectPage();enhancePaymentsPage();enhanceSettingsPage();enhanceFinancialHistory();
}
const mo=new MutationObserver(()=>requestAnimationFrame(run));mo.observe(document.documentElement,{subtree:true,childList:true});
document.addEventListener('DOMContentLoaded',run);
document.addEventListener('click',()=>setTimeout(run,0),true);
setInterval(()=>{if(document.hidden)return;enhanceProjectPage();enhancePaymentsPage();enhanceFinancialHistory()},2500);
setTimeout(run,500);setTimeout(run,1800);
})();