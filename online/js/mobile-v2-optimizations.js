/* JUAN PROJECT Online — approved mobile optimization + cross-platform feature pass */
(function(){
  "use strict";
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const peso=v=>new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP"}).format(Number(v||0));
  const state=()=>window.JPOAppState||{};
  let shopPrimary="all",shopSecondary="packages";

  function completedProjects(){
    return (state().portal?.projects||[]).filter(p=>Number(p.balance||0)<=0 && /deliver/i.test(String(p.status||p.delivery_status||""))).length;
  }
  function membership(){
    const n=completedProjects(), tiers=[["BRONZE",0,2],["SILVER",2,3],["GOLD",3,4],["PLATINUM",4,null]];
    let t=tiers[0]; for(const x of tiers) if(n>=x[1]) t=x;
    const pct=t[2]===null?100:Math.max(0,Math.min(100,Math.round((n-t[1])/Math.max(1,t[2]-t[1])*100)));
    return {count:n,name:t[0],next:t[2],remaining:t[2]===null?0:Math.max(0,t[2]-n),pct};
  }
  function referralCode(){
    const c=String(state().portal?.profile?.client_code||"").trim().toUpperCase();
    return c?("JUAN-"+c):"";
  }
  function closeOverlay(el){el?.remove();}
  function overlay(html,cls=""){
    const o=document.createElement("div");o.className="jp-v2-overlay "+cls;
    o.innerHTML='<div class="jp-v2-modal"><button class="jp-v2-x" aria-label="Close">×</button>'+html+'</div>';
    document.body.appendChild(o);$(".jp-v2-x",o).onclick=()=>closeOverlay(o);
    o.addEventListener("click",e=>{if(e.target===o)closeOverlay(o)});
    return o;
  }
  function shareReferral(){
    const code=referralCode(); if(!code)return;
    const text="Use my JUAN PROJECT referral code: "+code;
    if(navigator.share) navigator.share({title:"JUAN PROJECT Referral",text}).catch(()=>{});
    else navigator.clipboard?.writeText(code).then(()=>window.dispatchEvent(new CustomEvent("juan-referral-copied")));
  }
  function openQr(){
    const p=state().portal?.profile||{}, code=referralCode()||String(p.client_code||"JUAN PROJECT CLIENT");
    const displayName=p.name||p.email||"JUAN PROJECT Client";
    overlay('<div class="jp-qr-modal"><span class="jp-v2-kicker">Client QR</span><h2>'+esc(displayName)+'</h2><div class="jp-qr-frame"><img src="/api/qr?text='+encodeURIComponent(code)+'" alt="Client QR code"></div><div class="jp-qr-meta"><b>'+esc(p.client_code||"")+'</b><p>Scan to identify this JUAN PROJECT client.</p></div></div>',"jp-qr-overlay");
  }
  function openRewards(){
    const p=state().portal?.profile||{}, m=membership(), code=referralCode();
    const next=m.next===null?"Highest tier reached":m.remaining+" completed project"+(m.remaining===1?"":"s")+" until the next tier";
    const tiers=[["BRONZE","Member promos"],["SILVER","Expanded member benefits"],["GOLD","Priority member offers"],["PLATINUM","Exclusive top-tier rewards"]];
    const o=overlay(
      '<div class="jp-rewards-head"><span class="jp-v2-kicker">JUAN REWARDS</span><h2>Membership & benefits</h2><p>Completed and fully settled projects build your membership progress.</p></div>'+
      '<button class="jp-rewards-card" id="jpRewardsQr"><span>JUAN PROJECT</span><strong>'+esc(p.name||"Client")+'</strong><small>'+esc(p.client_code||"")+' · '+esc(m.name)+' MEMBER</small><i>Tap for client QR</i></button>'+
      '<section class="jp-rewards-progress"><div><span>'+esc(m.name)+'</span><b>'+m.pct+'%</b></div><div class="jp-rewards-track"><i style="width:'+m.pct+'%"></i></div><small>'+esc(next)+'</small></section>'+
      '<section class="jp-rewards-tiers">'+tiers.map((t,i)=>'<div class="'+(i<=tiers.findIndex(x=>x[0]===m.name)?"unlocked":"locked")+'"><b>'+t[0]+'</b><small>'+t[1]+'</small></div>').join("")+'</section>'+
      (code?'<section class="jp-referral-card"><span>YOUR REFERRAL CODE</span><b>'+esc(code)+'</b><button id="jpShareReferral">Share Code</button></section>':"")
    ,"jp-rewards-overlay");
    $("#jpRewardsQr",o)?.addEventListener("click",openQr);
    $("#jpShareReferral",o)?.addEventListener("click",shareReferral);
  }

  function enhanceClientHome(){
    const page=$(".app.client-mode.route-home .page"); if(!page||page.dataset.jpV2==="1")return;
    page.dataset.jpV2="1";
    const head=$(".dashboard-head",page),projects=state().portal?.projects||[],profile=state().portal?.profile||{};
    const due=projects.reduce((s,p)=>s+Math.max(0,Number(p.balance||0)),0),firstDue=projects.find(p=>Number(p.balance||0)>0);

    function dueMeta(project){
      if(!project)return null;
      const raw=project.payment_due_date||project.balance_due_date||project.due_date||project.deadline_date||null;
      if(!raw)return null;
      const d=new Date(raw); if(Number.isNaN(d.getTime()))return null;
      const today=new Date(); today.setHours(0,0,0,0); d.setHours(0,0,0,0);
      const days=Math.floor((today-d)/86400000);
      let label="Due",cls="normal";
      if(days>0&&days<=3){label="Grace Period";cls="grace";}
      else if(days>3){label="Overdue";cls="overdue";}
      else if(days===0){label="Due Today";cls="due";}
      return {date:d,label,cls};
    }

    if(head){
      head.classList.add("jp-home-head-fixed");
      const identity=$("h1",head),subtitle=$("p",head);
      if(identity){identity.textContent=profile.email||profile.name||"Client";identity.title=identity.textContent;}
      subtitle?.remove();
    }

    const heads=$$(".section-head",page);
    const activeHead=heads.find(h=>$("h2",h)?.textContent.trim()==="Active Project");
    const activeCard=activeHead?.nextElementSibling;
    if(activeHead){
      const title=$("h2",activeHead); if(title)title.textContent="Project Progress";
      activeHead.classList.add("jp-home-project-head");
    }
    if(activeCard)activeCard.classList.add("jp-home-project-card");

    const quick=$(".jp-quick-actions",page);
    const quickHead=$$(".section-head",page).find(h=>$("h2",h)?.textContent.trim()==="Quick Actions");
    quick?.remove();
    quickHead?.remove();

    const balanceHead=document.createElement("div");
    balanceHead.className="section-head jp-home-balance-head";
    balanceHead.innerHTML="<h2>Balance</h2>";
    const wallet=document.createElement("section");
    wallet.className="jp-home-wallet";
    const dm=dueMeta(firstDue);
    const dueRow=dm?'<div class="jp-home-due-row"><span>Due '+esc(dm.date.toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"}))+'</span><b class="jp-due-tag '+dm.cls+'">'+esc(dm.label)+'</b></div>':"";
    wallet.innerHTML='<div class="jp-home-wallet-copy"><strong>'+peso(due)+'</strong><small>Across active projects</small>'+dueRow+'</div><button id="jpHomePayNow" '+(due<=0?"disabled":"")+'>Pay Now</button>';

    if(head){
      if(activeHead&&activeCard){
        head.after(activeHead,activeCard,balanceHead,wallet);
      }else{
        head.after(balanceHead,wallet);
      }
    }
    $("#jpHomePayNow",wallet)?.addEventListener("click",()=>{if(firstDue)state().paymentProjectId=firstDue.id;$('.nav [data-r="payment"]')?.click()});

    const recent=$$(".section-head",page).find(h=>$("h2",h)?.textContent.trim()==="Recent Activity");
    recent?.classList.add("jp-home-recent-head");
    const ad=$("#jpAdBannerAnchor",page);if(ad)ad.classList.add("jp-home-bottom-ad","jp-home-ad-sticky");
  }

  function enhanceGuestHome(){
    const page=$(".app.guest-mode.route-home .page"); if(!page||page.dataset.jpV2==="1")return;
    page.dataset.jpV2="1";
    const home=$(".jp-guest-home-centered",page); if(!home)return;
    $(".jp-guest-about",home)?.remove();
    $(".jp-guest-tag",home)?.remove();
    const h=$(".jp-guest-hero h1",home);
    if(h) h.innerHTML='<span class="jp-pop-word">'+["J","U","A","N"," ","P","R","O","J","E","C","T"].map((x,i)=>x===" "?"<i>&nbsp;</i>":'<i style="--i:'+i+'">'+x+"</i>").join("")+'</span><strong>made simple.</strong>';
  }
  function enhanceWelcome(){
    const card=$(".jp-welcome-simplified"); if(!card||card.dataset.jpV2==="1")return; card.dataset.jpV2="1";
    $(".version",card)?.remove();
    $(".jp-guest-tag",card)?.remove();
    const h=$(".welcome-copy h1",card); if(h)h.innerHTML='<span class="jp-pop-word">'+["J","U","A","N"," ","P","R","O","J","E","C","T"].map((x,i)=>x===" "?"<i>&nbsp;</i>":'<i style="--i:'+i+'">'+x+"</i>").join("")+'</span><strong>made simple.</strong>';
    const p=$(".welcome-copy p",card); if(p)p.textContent="Shop creative services or track an existing Order Request.";
  }

  function enhanceOrders(){
    $$(".app.route-orders .project-list-card").forEach(card=>{
      if(card.dataset.jpV2==="1")return;card.dataset.jpV2="1";
      const top=$(".project-list-top",card),badge=$(".badge",card),amount=$(".meta b",card),chev=top?.querySelector("svg");
      if(top&&badge&&amount){
        const right=document.createElement("div");right.className="jp-order-right";right.append(badge,amount);
        if(chev)top.insertBefore(right,chev);else top.append(right);
      }
    });
  }

  function enhanceAccount(){
    const page=$(".app.client-mode.route-account .page"); if(!page||page.dataset.jpV2==="1")return;page.dataset.jpV2="1";
    const card=$(".membership-card",page),p=state().portal?.profile||{},m=membership(),code=referralCode();
    if(card){
      card.classList.add("jp-static-member-card");
      card.removeAttribute("role");card.removeAttribute("tabindex");
      const avatar=p.profile_photo_url?'<img src="'+esc(p.profile_photo_url)+'" alt="">':'<span>'+esc((p.name||p.email||"J").slice(0,1).toUpperCase())+'</span>';
      const displayName=p.name||p.email||"Client";
      card.innerHTML='<div class="jp-static-member-main jp-static-member-simple"><div class="jp-member-top"><b>JUAN PROJECT</b><span>'+m.name+' MEMBER</span></div><div class="jp-member-id"><div class="jp-fixed-avatar">'+avatar+'</div><div class="jp-member-identity"><h2>'+esc(displayName)+'</h2><small>'+esc(p.client_code||"")+'</small></div></div><button type="button" id="jpViewQr" class="jp-view-qr">View QR</button></div>';
      $("#jpViewQr",card)?.addEventListener("click",openQr);
    }

    $(".account-status-card",page)?.remove();
    $$(".settings-group",page).forEach(g=>{if($(".settings-label",g)?.textContent.trim()==="MEMBER BENEFITS")g.remove();});

    const accountGroup=$$(".settings-group",page).find(g=>$(".settings-label",g)?.textContent.trim()==="ACCOUNT");
    const notify=$("#enableBrowserNotifications",page);
    if(accountGroup&&notify){
      const notifyGroup=document.createElement("div");
      notifyGroup.className="settings-group jp-notification-settings";
      notifyGroup.innerHTML='<div class="settings-label">NOTIFICATIONS</div><div class="card settings-list"></div>';
      $(".settings-list",notifyGroup).append(notify);
      accountGroup.after(notifyGroup);
    }

    let about=$$(".settings-group",page).find(g=>["ABOUT","ABOUT & LEGAL"].includes($(".settings-label",g)?.textContent.trim()));
    if(about){
      $(".settings-label",about).textContent="ABOUT & LEGAL";
      const list=$(".settings-list",about);
      if(list){
        list.innerHTML='<div class="jp-about-legal-copy"><b>JUAN PROJECT Online</b><span>Developed by BENZEL DELMO</span><span>JUAN PROJECT System 2026</span></div>';
        if(code){const row=document.createElement("button");row.id="jpAccountReferral";row.className="settings-row settings-row-button";row.innerHTML='<div><b>Share Referral Code</b><small>'+esc(code)+'</small></div><span>›</span>';row.onclick=shareReferral;list.append(row);}
      }
    }else{
      about=document.createElement("div");about.className="settings-group jp-about-legal";about.innerHTML='<div class="settings-label">ABOUT & LEGAL</div><div class="card settings-list"><div class="jp-about-legal-copy"><b>JUAN PROJECT Online</b><span>Developed by BENZEL DELMO</span><span>JUAN PROJECT System 2026</span></div></div>';page.append(about);
    }
  }

  function tvCategoryIds(){
    return (state().catalog?.categories||[]).filter(c=>/tv|broadcast/i.test(String(c.name||""))).map(c=>String(c.id));
  }
  function applyShopFilter(){
    const ids=tvCategoryIds();
    $$(".app.route-shop .jp-shop-card").forEach(card=>{
      const key=$("[data-view-shop]",card)?.dataset.viewShop||"", [kind,id]=key.split(":");
      const item=kind==="Service"?(state().catalog?.services||[]).find(x=>String(x.id)===String(id)):null;
      let show=true;
      if(shopPrimary==="tv")show=kind==="Service"&&(!ids.length||ids.includes(String(item?.category_id)));
      else if(shopPrimary==="services")show=kind==="Service";
      else if(shopPrimary==="packages")show=kind==="Package";
      card.hidden=!show;
    });
  }
  function enhanceShop(){
    const page=$(".app.route-shop .page");if(!page)return;
    const chips=$(".jp-category-chips",page);
    if(chips&&!chips.dataset.jpV2){
      chips.dataset.jpV2="1";
      const ids=tvCategoryIds(),hasTv=(state().catalog?.services||[]).some(s=>!ids.length||ids.includes(String(s.category_id))),hasServices=(state().catalog?.services||[]).length>0,hasPackages=(state().catalog?.packages||[]).length>0;
      chips.innerHTML='<button class="'+(shopPrimary==="all"?"active":"")+'" id="jpFilterAll">All</button>'+(hasTv?'<button class="'+(shopPrimary==="tv"?"active":"")+'" id="jpFilterTv">TV Broadcasting</button>':'')+(hasServices?'<button class="'+(shopPrimary==="services"?"active":"")+'" id="jpFilterServices">Services</button>':'')+(hasPackages?'<button class="'+(shopPrimary==="packages"?"active":"")+'" id="jpFilterPackages">Packages</button>':'');
      $("#jpFilterAll",chips).onclick=()=>{shopPrimary="all";enhanceShopRefresh()};
      $("#jpFilterTv",chips)?.addEventListener("click",()=>{shopPrimary="tv";enhanceShopRefresh()});
      $("#jpFilterServices",chips)?.addEventListener("click",()=>{shopPrimary="services";enhanceShopRefresh()});
      $("#jpFilterPackages",chips)?.addEventListener("click",()=>{shopPrimary="packages";enhanceShopRefresh()});
    }
    $$(".jp-shop-card",page).forEach(c=>{c.classList.add("jp-v2-shop-card");});
    applyShopFilter();
    const cart=$("#shopOrderCart",page);if(cart)cart.classList.add("jp-v2-cart-icon");
  }

  function enhanceShopRefresh(){const chips=$(".jp-category-chips");if(chips)chips.dataset.jpV2="";enhanceShop();}
  function enhanceShopModal(){
    const sheet=$(".shop-detail-sheet");if(!sheet||sheet.dataset.jpV2==="1")return;sheet.dataset.jpV2="1";
    const item=state().shopItem;if(!item)return;sheet.classList.toggle("jp-package-modal",item.kind==="Package");
    $(".detail-copy",sheet)?.remove();$("#detailClose",sheet)?.remove();$("#detailLogIn",sheet)?.remove();
    const add=$("#detailStartProject",sheet);if(!add)return;
    let qty=1;add.disabled=false;add.textContent="Add to Cart";
    const price=Number(item.kind==="Package"?(item.new_price??item.original_price??0):(item.price||0)),original=Number(item.original_price||0);
    const priceBox=$(".detail-price",sheet);
    if(priceBox){
      priceBox.innerHTML=item.kind==="Package"&&original>price
        ?'<span class="jp-price-pair"><b>'+peso(price)+'</b><s>'+peso(original)+'</s></span>'
        :'<span class="jp-price-pair"><b>'+peso(price)+'</b></span>';
    }
    const actionRow=document.createElement("div");actionRow.className="jp-detail-action-row";
    const controls=document.createElement("div");controls.className="jp-detail-qty jp-detail-qty-inline";controls.innerHTML='<button type="button">−</button><b>1</b><button type="button">+</button>';
    add.parentNode.insertBefore(actionRow,add);actionRow.append(controls,add);
    const btns=$$("button",controls),minus=btns[0],plus=btns[1],val=$("b",controls);
    function sync(){val.textContent=qty;minus.disabled=qty<=1;add.disabled=false;}
    minus.onclick=()=>{qty=Math.max(1,qty-1);sync()};plus.onclick=()=>{qty=Math.min(100,qty+1);sync()};
    if(item.kind==="Package"){
      const packageItems=(state().catalog?.packageItems||[]).filter(x=>String(x.package_id)===String(item.id)),services=state().catalog?.services||[];
      const includedNames=packageItems.map(x=>services.find(s=>String(s.id)===String(x.service_id))?.name||x.item_name).filter(Boolean);
      const info=document.createElement("section");info.className="jp-package-detail";info.innerHTML='<h3>PACKAGE INCLUDES</h3><ul>'+includedNames.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul>';actionRow.before(info);
    }
    add.onclick=async()=>{add.disabled=true;const originalText=add.textContent;for(let i=0;i<qty;i++)await window.JPMobileCommerce?.addCatalogItem?.(item.kind,item.id);add.textContent="Added";setTimeout(()=>{add.textContent=originalText;add.disabled=false},450)};
    if(!state().portal?.profile){
      const login=document.createElement("button");login.className="jp-modal-login-link";login.innerHTML='Already a client? <span>Log in</span>';actionRow.after(login);login.onclick=()=>document.getElementById("homeLogIn")?.click();
    }
    sync();
  }

  function enhanceCart(){
    const flow=$(".jp-flow-cart");if(!flow)return;
    $$(".jp-cart-section-title",flow).forEach(x=>x.remove());
    const promo=$(".jp-promo-row",flow);if(promo){promo.disabled=true;promo.innerHTML='<span>Have a promo code?</span><b>Available Soon</b>';}
  }
  function enhanceReceipt(){
    const flow=$(".jp-flow-receipt");if(!flow||flow.dataset.jpV2==="1")return;flow.dataset.jpV2="1";
    $(".jp-flow-brand",flow)?.remove();
  }
  function enhancePrivacy(){
    const headings=$$("h1,h2,h3,b,strong").filter(x=>/privacy\s*&\s*device storage/i.test(x.textContent||""));
    headings.forEach(h=>{
      let box=h.closest(".sheet,.modal,[class*='consent'],[class*='privacy'],.card")||h.parentElement;
      if(box&&!box.classList.contains("jp-v2-privacy"))box.classList.add("jp-v2-privacy");
      const buttons=$$("button",box||document);
      buttons.forEach(b=>{if(/^accept$/i.test(b.textContent.trim()))b.textContent="Accept All";});
    });
  }

  function apply(){
    enhanceWelcome();enhanceGuestHome();enhanceClientHome();enhanceOrders();enhanceAccount();enhanceShop();enhanceShopModal();enhanceCart();enhanceReceipt();enhancePrivacy();
  }
  window.addEventListener("juan-online-render",()=>setTimeout(apply,0));
  window.addEventListener("juan-cart-change",()=>setTimeout(()=>{enhanceCart();enhanceShop();},0));
  let scheduled=false;
  new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;apply();});}).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",apply);else apply();
})();