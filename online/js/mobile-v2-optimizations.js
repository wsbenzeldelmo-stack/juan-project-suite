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
    overlay('<div class="jp-qr-modal"><span class="jp-v2-kicker">CLIENT QR</span><h2>'+esc(p.name||"JUAN PROJECT Client")+'</h2><img src="/api/qr?text='+encodeURIComponent(code)+'" alt="Client QR code"><b>'+esc(p.client_code||"")+'</b><p>Scan to identify this JUAN PROJECT client.</p></div>',"jp-qr-overlay");
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
    const head=$(".dashboard-head",page), projects=state().portal?.projects||[];
    const due=projects.reduce((s,p)=>s+Math.max(0,Number(p.balance||0)),0);
    const firstDue=projects.find(p=>Number(p.balance||0)>0);
    if(head){
      const wallet=document.createElement("section");wallet.className="jp-home-wallet";
      wallet.innerHTML='<div><span>BALANCE DUE</span><strong>'+peso(due)+'</strong><small>Across active projects</small></div><button id="jpHomePayNow" '+(due<=0?"disabled":"")+'>Pay Now</button>';
      head.after(wallet);
      $("#jpHomePayNow",wallet)?.addEventListener("click",()=>{if(firstDue)state().paymentProjectId=firstDue.id;$('.nav [data-r="payment"]')?.click()});
    }
    const quick=$(".jp-quick-actions",page);
    const heads=$$(".section-head",page), activeHead=heads.find(h=>$("h2",h)?.textContent.trim()==="Active Project");
    const quickHead=heads.find(h=>$("h2",h)?.textContent.trim()==="Quick Actions");
    const activeCard=activeHead?.nextElementSibling;
    if(quick&&activeHead&&activeCard){
      const grid=document.createElement("div");grid.className="jp-home-compact-grid";
      const left=document.createElement("div");left.className="jp-home-active-pane";
      const right=document.createElement("div");right.className="jp-home-action-rail";
      activeHead.before(grid); grid.append(left,right); left.append(activeHead,activeCard); right.append(quick); quickHead?.remove();
      const labels=[["clientStartOrder","New Order"],["clientTrackRequest","Track"],["clientCardAction","JUAN Rewards"]];
      labels.forEach(([id,label])=>{const b=$("#"+id,right);if(b){const strong=$("b",b);if(strong)strong.textContent=label;$("small",b)?.remove();}});
      const rewards=$("#clientCardAction",right); if(rewards) rewards.onclick=openRewards;
    }
  }

  function enhanceGuestHome(){
    const page=$(".app.guest-mode.route-home .page"); if(!page||page.dataset.jpV2==="1")return;
    page.dataset.jpV2="1";
    const home=$(".jp-guest-home-centered",page); if(!home)return;
    $(".jp-guest-about",home)?.remove();
    if(!$(".jp-guest-tag",home)){const tag=document.createElement("span");tag.className="jp-guest-tag";tag.textContent="GUEST MODE";home.prepend(tag);}
    const h=$(".jp-guest-hero h1",home);
    if(h) h.innerHTML='<span class="jp-pop-word">'+["J","U","A","N"," ","P","R","O","J","E","C","T"].map((x,i)=>x===" "?"<i>&nbsp;</i>":'<i style="--i:'+i+'">'+x+"</i>").join("")+'</span><strong>made simple.</strong>';
  }
  function enhanceWelcome(){
    const card=$(".jp-welcome-simplified"); if(!card||card.dataset.jpV2==="1")return; card.dataset.jpV2="1";
    $(".version",card)?.remove();
    if(!$(".jp-guest-tag",card)){const tag=document.createElement("span");tag.className="jp-guest-tag";tag.textContent="GUEST MODE";card.prepend(tag);}
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
      card.classList.add("jp-flip-card"); card.setAttribute("role","button");card.setAttribute("tabindex","0");
      const avatar=p.profile_photo_url?'<img src="'+esc(p.profile_photo_url)+'" alt="">':'<span>'+esc((p.name||p.email||"J").slice(0,1).toUpperCase())+'</span>';
      card.innerHTML='<div class="jp-flip-inner"><section class="jp-flip-face jp-flip-front"><div class="jp-member-top"><b>JUAN PROJECT</b><span>'+m.name+' MEMBER</span></div><div class="jp-member-id"><div class="jp-fixed-avatar">'+avatar+'</div><div><h2>'+esc(p.name||"Client")+'</h2><small>'+esc(p.client_code||"")+'</small></div></div><div class="jp-member-meta"><span>Member since <b>'+esc(p.created_at?new Date(p.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"}):"—")+'</b></span><span>Tier <b>'+m.name+'</b></span></div><div class="jp-member-progress"><div><span>Progress</span><b>'+m.pct+'%</b></div><i><em style="width:'+m.pct+'%"></em></i><small>'+(m.next===null?"Highest tier reached":m.remaining+" more completed project"+(m.remaining===1?"":"s")+" to next tier")+'</small></div></section><section class="jp-flip-face jp-flip-back"><b>JUAN PROJECT CLIENT</b><button class="jp-card-qr" type="button"><img src="/api/qr?text='+encodeURIComponent(code||p.client_code||"JUAN PROJECT")+'" alt="Client QR"></button><strong>'+esc(p.client_code||"")+'</strong><small>Tap QR to enlarge</small></section></div>';
      const flip=()=>card.classList.toggle("is-flipped");card.addEventListener("click",e=>{if(e.target.closest(".jp-card-qr"))return;flip()});card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();flip()}});
      $(".jp-card-qr",card)?.addEventListener("click",e=>{e.stopPropagation();openQr()});
    }
    $$(".settings-group",page).forEach(g=>{if($(".settings-label",g)?.textContent.trim()==="MEMBER BENEFITS")g.remove();});
    const about=$$(".settings-group",page).find(g=>$(".settings-label",g)?.textContent.trim()==="ABOUT");
    if(about&&code&&!$("#jpAccountReferral",about)){
      $(".settings-label",about).textContent="ABOUT & LEGAL";
      const list=$(".settings-list",about),row=document.createElement("button");row.id="jpAccountReferral";row.className="settings-row settings-row-button";
      row.innerHTML='<div><b>Share Referral Code</b><small>'+esc(code)+'</small></div><span>›</span>';row.onclick=shareReferral;list?.prepend(row);
    }
  }

  function tvCategoryIds(){
    return (state().catalog?.categories||[]).filter(c=>/tv|broadcast/i.test(String(c.name||""))).map(c=>String(c.id));
  }
  function applyShopFilter(){
    const ids=tvCategoryIds();
    $$(".app.route-shop .jp-shop-card").forEach(card=>{
      const key=$("[data-view-shop]",card)?.dataset.viewShop||"", [kind,id]=key.split(":");
      let show=true;
      if(shopPrimary==="tv"){
        if(shopSecondary==="packages")show=kind==="Package";
        else{
          const item=(state().catalog?.services||[]).find(x=>String(x.id)===String(id));
          show=kind==="Service" && (!ids.length||ids.includes(String(item?.category_id)));
        }
      }
      card.hidden=!show;
    });
  }
  function enhanceShop(){
    const page=$(".app.route-shop .page");if(!page)return;
    const chips=$(".jp-category-chips",page);
    if(chips&&!chips.dataset.jpV2){
      chips.dataset.jpV2="1";
      chips.innerHTML='<button class="'+(shopPrimary==="all"?"active":"")+'" id="jpFilterAll">All</button><button class="'+(shopPrimary==="tv"?"active":"")+'" id="jpFilterTv">TV Broadcasting</button><span class="jp-subfilters '+(shopPrimary==="tv"?"":"hidden")+'"><button class="'+(shopSecondary==="services"?"active":"")+'" id="jpFilterServices">Services</button><button class="'+(shopSecondary==="packages"?"active":"")+'" id="jpFilterPackages">Packages</button></span>';
      $("#jpFilterAll",chips).onclick=()=>{shopPrimary="all";enhanceShopRefresh()};
      $("#jpFilterTv",chips).onclick=()=>{shopPrimary="tv";shopSecondary="packages";enhanceShopRefresh()};
      $("#jpFilterServices",chips).onclick=()=>{shopPrimary="tv";shopSecondary="services";enhanceShopRefresh()};
      $("#jpFilterPackages",chips).onclick=()=>{shopPrimary="tv";shopSecondary="packages";enhanceShopRefresh()};
    }
    $$(".jp-shop-card",page).forEach(c=>{c.classList.add("jp-v2-shop-card");});
    applyShopFilter();
    const cart=$("#shopOrderCart",page);if(cart)cart.classList.add("jp-v2-cart-icon");
  }
  function enhanceShopRefresh(){const chips=$(".jp-category-chips");if(chips)chips.dataset.jpV2="";enhanceShop();}
  function enhanceShopModal(){
    const sheet=$(".shop-detail-sheet");if(!sheet||sheet.dataset.jpV2==="1")return;sheet.dataset.jpV2="1";
    $("#detailClose",sheet)?.remove();
    const item=state().shopItem;if(!item)return;
    let qty=1;
    const add=$("#detailStartProject",sheet);if(add){
      const controls=document.createElement("div");controls.className="jp-detail-qty";controls.innerHTML='<button type="button">−</button><b>1</b><button type="button">+</button>';
      add.before(controls);const [minus,plus]=$$("button",controls),val=$("b",controls);
      minus.onclick=()=>{qty=Math.max(1,qty-1);val.textContent=qty};plus.onclick=()=>{qty=Math.min(100,qty+1);val.textContent=qty};
      add.onclick=async()=>{add.disabled=true;for(let i=0;i<qty;i++)await window.JPMobileCommerce?.addCatalogItem?.(item.kind,item.id);add.textContent="Added";setTimeout(()=>{add.disabled=false;add.textContent="Add to Cart"},700)};
    }
    if(item.kind==="Package"){
      const packageItems=(state().catalog?.packageItems||[]).filter(x=>String(x.package_id)===String(item.id));
      const services=state().catalog?.services||[], includedIds=new Set(packageItems.map(x=>String(x.service_id||"")).filter(Boolean));
      const includedNames=packageItems.map(x=>services.find(s=>String(s.id)===String(x.service_id))?.name||x.item_name).filter(Boolean);
      const info=document.createElement("section");info.className="jp-package-detail";info.innerHTML='<h3>Package includes</h3><div>'+includedNames.map(x=>'<span>'+esc(x)+'</span>').join("")+'</div>';add?.before(info);
      const candidates=services.filter(s=>s.active!==false&&!includedIds.has(String(s.id))).sort((a,b)=>{const pa=/opening.*billboard|\bobb\b/i.test(a.name||"")?0:1,pb=/opening.*billboard|\bobb\b/i.test(b.name||"")?0:1;return pa-pb}).slice(0,3);
      if(candidates.length){
        const rec=document.createElement("section");rec.className="jp-smart-addons";rec.innerHTML='<h3>Complete your package</h3>'+candidates.map(s=>'<div><span><b>'+esc(s.name)+'</b><small>Recommended solo service</small></span><strong>'+peso(s.price)+'</strong><button data-addon="'+esc(s.id)+'">Add</button></div>').join("");add?.before(rec);
        $$("[data-addon]",rec).forEach(b=>b.onclick=async()=>{await window.JPMobileCommerce?.addCatalogItem?.("Service",b.dataset.addon);b.textContent="Added";b.disabled=true});
      }
    }
  }

  function enhanceCart(){
    const flow=$(".jp-flow-cart");if(!flow||flow.dataset.jpV2==="1")return;flow.dataset.jpV2="1";
    const items=(()=>{try{return JSON.parse(localStorage.getItem("JUAN_ORDER_REQUEST_CART_V1")||"[]")}catch{return[]}})();
    const cards=$$(".jp-cart-list .jp-cart-item",flow);let last="";
    cards.forEach((card,i)=>{const type=items[i]?.type==="package"?"Packages":"Services";card.dataset.kind=type.toLowerCase();if(type!==last){const h=document.createElement("div");h.className="jp-cart-section-title";h.textContent=type;card.before(h);last=type;}});
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
  window.addEventListener("juan-cart-change",()=>setTimeout(apply,0));
  new MutationObserver(()=>requestAnimationFrame(apply)).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",apply);else apply();
})();