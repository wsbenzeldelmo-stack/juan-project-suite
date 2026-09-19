(()=>{
  'use strict';
  const textOf=el=>String(el?.textContent||'').trim().replace(/\s+/g,' ').toUpperCase();
  const money=/PRICE|AMOUNT|TOTAL|PAID|BALANCE|REVENUE|CHARGE|FEE|SUBTOTAL/;
  const icon=()=>'<svg class="jp-action-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.7"></circle><circle cx="12" cy="12" r="1.7"></circle><circle cx="12" cy="19" r="1.7"></circle></svg>';

  window.TableActionMenu=window.TableActionMenu||{
    upgrade(button){
      if(!button)return;
      button.classList.add('table-action-button');
      if(!button.getAttribute('aria-label'))button.setAttribute('aria-label','Open actions');
      button.innerHTML=icon();
    }
  };

  function upgradeButton(button){
    const raw=String(button?.textContent||'').replace(/\s+/g,'').trim();
    if(/^(?:\.{3}|…|⋯|•••|···)$/.test(raw)||button?.classList.contains('icon-more-button')||button?.classList.contains('vertical-more')||button?.classList.contains('table-action-button')){
      window.TableActionMenu.upgrade(button);
    }
  }

  function normalize(table){
    if(!table||table.closest('.invoice,#clientInvoicePrintable,.workspace-document'))return;
    const heads=[...table.querySelectorAll('thead tr:first-child th')];
    if(heads.length<2)return;

    table.classList.add('jp-system-table');
    const wrap=table.closest('.table-responsive,.suite-scroll,.portal-payment-review-table-wrap');
    wrap?.classList.add('jp-system-table-wrap');

    const headers=heads.map(textOf);
    headers.forEach((h,i)=>{
      const cells=[...table.querySelectorAll('tbody tr')].map(r=>r.children[i]).filter(Boolean);
      if(money.test(h)){
        heads[i].classList.add('jp-money-head');
        cells.forEach(c=>c.classList.add('jp-money'));
      }else{
        heads[i].classList.add('jp-left-head');
        cells.forEach(c=>c.classList.add('jp-left-cell'));
      }
    });

    let action=headers.findIndex(h=>/^(ACTION|ACTIONS)$/.test(h));
    if(action<0){
      const last=heads.length-1;
      const label=String(heads[last]?.getAttribute('aria-label')||'').toUpperCase();
      const hasMenu=[...table.querySelectorAll('tbody tr')].some(r=>r.children[last]?.querySelector('.icon-more-button,.vertical-more,.table-action-button,[aria-label*="action" i]'));
      if(/ACTION/.test(label)||hasMenu)action=last;
    }
    if(action>=0){
      table.classList.add('jp-has-actions');
      heads[action].textContent='';
      heads[action].setAttribute('aria-label','Actions');
      heads[action].classList.add('jp-action-column');
      table.querySelectorAll('tbody tr').forEach(row=>{
        const cell=row.children[action];
        if(!cell)return;
        cell.classList.add('jp-action-column');
        cell.querySelectorAll('button').forEach(upgradeButton);
      });
    }
  }

  function apply(root=document){
    root.querySelectorAll?.('table').forEach(normalize);
  }
  let queued=false;
  const observer=new MutationObserver(()=>{
    if(queued)return;queued=true;
    requestAnimationFrame(()=>{queued=false;apply(document)});
  });
  const start=()=>{apply(document);observer.observe(document.body,{childList:true,subtree:true})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
  window.jpApplyOnlineTableSystem=apply;
})();