/* JUAN PROJECT Workspace — coordinated Sep 20 update */
(function(){
  "use strict";
  var API=function(body){return window.JuanSuiteRuntime.request("/api/suite",body);};
  var esc=function(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});};
  var peso=function(v){return new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP"}).format(Number(v||0));};
  var dateText=function(v){
    if(!v)return "—";var s=String(v),d;
    if(/^\d{4}-\d{2}-\d{2}$/.test(s)){var p=s.split("-").map(Number);d=new Date(p[0],p[1]-1,p[2],12);}
    else d=new Date(s);
    return Number.isNaN(d.getTime())?"—":d.toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"});
  };
  var dateTime=function(v){if(!v)return "—";var d=new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleString("en-PH",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});};
  var toast=function(m){if(window.showToast)window.showToast(m);};
  var orders=[],filter="active",query="",overlay=null;

  function ready(fn,n){n=n||0;if(window.app&&window.JuanSuiteRuntime)return fn();if(n<60)setTimeout(function(){ready(fn,n+1);},100);}
  function closeOverlay(){if(overlay)overlay.remove();overlay=null;document.body.classList.remove("jp-general-modal-open");}
  function modal(html,cls){
    closeOverlay();overlay=document.createElement("div");overlay.className="jp-general-overlay";
    overlay.innerHTML='<section class="jp-general-modal '+(cls||"")+'" role="dialog" aria-modal="true">'+html+"</section>";
    document.body.appendChild(overlay);document.body.classList.add("jp-general-modal-open");
    overlay.addEventListener("click",function(e){if(e.target===overlay)closeOverlay();});
    return overlay.firstElementChild;
  }
  function confirmAction(options){
    options=options||{};
    return new Promise(function(resolve){
      var previous=overlay;
      if(previous)previous.style.display="none";
      var layer=document.createElement("div");layer.className="jp-confirm-overlay";
      layer.innerHTML='<section class="jp-confirm-card" role="alertdialog" aria-modal="true"><div class="jp-confirm-icon '+(options.danger?"danger":"")+'">'+(options.danger?"!":"✓")+'</div><h3>'+esc(options.title||"Confirm action")+'</h3><p>'+esc(options.message||"")+'</p><div class="jp-confirm-actions"><button class="btn btn-secondary" data-no>Cancel</button><button class="btn '+(options.danger?"btn-danger":"btn-primary")+'" data-yes>'+esc(options.confirmLabel||"Confirm")+'</button></div></section>';
      document.body.appendChild(layer);
      var onKey=function(e){if(e.key==="Escape"){finish(false);}else if(e.key==="Enter"){finish(true);}};
      function finish(value){document.removeEventListener("keydown",onKey,true);layer.remove();if(previous&&document.body.contains(previous))previous.style.display="";resolve(value);}
      layer.querySelector("[data-no]").onclick=function(){finish(false);};
      layer.querySelector("[data-yes]").onclick=function(){finish(true);};
      layer.addEventListener("click",function(e){if(e.target===layer)finish(false);});
      document.addEventListener("keydown",onKey,true);
      layer.querySelector("[data-yes]").focus();
    });
  }
  function preparingOrder(order){
    var layer=document.createElement("div");layer.className="jp-prepare-overlay";
    layer.innerHTML='<section class="jp-prepare-card"><div class="jp-prepare-mark"><span></span></div><div><span class="section-kicker">ORDER REQUEST</span><h3>Preparing '+esc(order?.code||"order")+'…</h3><p>Matching the client email and loading the request into New Order.</p></div></section>';
    document.body.appendChild(layer);
    return {
      done:function(message){layer.classList.add("done");layer.querySelector(".jp-prepare-mark").innerHTML="✓";layer.querySelector("h3").textContent=message||"Order ready";layer.querySelector("p").textContent="You can review dates, discounts, and charges before creating the project.";setTimeout(function(){layer.remove();},650);},
      fail:function(message){layer.classList.add("failed");layer.querySelector(".jp-prepare-mark").innerHTML="!";layer.querySelector("h3").textContent="Could not prepare order";layer.querySelector("p").textContent=message||"Try again.";setTimeout(function(){layer.remove();},1600);}
    };
  }

  function ensureOrdersView(){
    if(document.getElementById("view-orders"))return;
    var s=document.createElement("section");s.id="view-orders";s.className="view";
    s.innerHTML=
      '<header class="page-header"><div><div class="greeting-subtitle">Online Intake</div><h1 class="page-title">Orders</h1><div class="page-description">Review Order Requests before turning them into projects.</div></div><button class="btn btn-secondary" id="ordersRefreshBtn">Refresh</button></header>'+
      '<div class="view-toolbar unified-toolbar jp-orders-toolbar"><input class="form-control" id="ordersPageSearch" placeholder="Search Order ID, client, email, or request..."><div class="toolbar-actions"><div class="filter-pills" id="ordersPageFilters"></div></div></div>'+
      '<div class="card table-card"><div class="table-responsive"><table class="data-table unified-table jp-orders-page-table" data-keyboard-table="orders"><thead><tr><th>Order ID</th><th>Client</th><th>Request</th><th>Amount</th><th>Submitted</th><th>Status</th><th class="table-actions-col"></th></tr></thead><tbody id="ordersPageRows"></tbody></table></div></div>';
    var clients=document.getElementById("view-clients"),parent=clients?clients.parentNode:document.querySelector(".main-content");
    if(clients)parent.insertBefore(s,clients);else parent.appendChild(s);
    document.getElementById("ordersRefreshBtn").onclick=function(){renderOrders(true);};
    document.getElementById("ordersPageSearch").oninput=function(e){query=e.target.value.trim().toLowerCase();renderOrders(false);};
  }
  function effectiveStatus(o){return o.archived_at?"Archived":(o.status||"Order Received");}
  function drawFilters(){
    var host=document.getElementById("ordersPageFilters");if(!host)return;
    var opts=[["active","Active"],["all","All"],["approved","Approved"],["rejected","Rejected"],["archived","Archived"]];
    host.innerHTML=opts.map(function(x){return '<button class="filter-pill '+(filter===x[0]?"active":"")+'" data-filter="'+x[0]+'">'+x[1]+"</button>";}).join("");
    host.querySelectorAll("[data-filter]").forEach(function(b){b.onclick=function(){filter=b.dataset.filter;renderOrders(false);};});
  }
  function visibleOrders(){
    return orders.filter(function(o){
      var s=effectiveStatus(o).toLowerCase();
      if(filter==="active"&&(o.archived_at||s==="rejected"||s==="project created"))return false;
      if(filter==="approved"&&s!=="approved")return false;
      if(filter==="rejected"&&s!=="rejected")return false;
      if(filter==="archived"&&s!=="archived")return false;
      if(query&&((o.code||"")+" "+(o.name||"")+" "+(o.email||"")+" "+(o.title||"")+" "+s).toLowerCase().indexOf(query)<0)return false;
      return true;
    });
  }
  async function renderOrders(reload){
    ensureOrdersView();drawFilters();var body=document.getElementById("ordersPageRows");if(!body)return;
    if(reload!==false){
      body.innerHTML='<tr><td colspan="7" class="text-center text-muted py-4">Loading orders…</td></tr>';
      try{var d=await API({action:"dashboard"});orders=Array.isArray(d.incoming_orders)?d.incoming_orders:[];}
      catch(e){body.innerHTML='<tr><td colspan="7" class="text-center text-danger py-4">'+esc(e.message||"Orders could not be loaded.")+"</td></tr>";return;}
    }
    var list=visibleOrders();
    body.innerHTML=list.map(function(o){
      var id=esc(o.id),menu="orderPageMenu_"+String(o.id).replace(/[^a-zA-Z0-9_-]/g,""),status=effectiveStatus(o);
      return '<tr class="clickable-row" data-record-id="'+id+'" tabindex="-1" onclick="window.JPGeneral.openOrder(\''+id+'\')">'+
        '<td><strong class="project-id-cell">'+esc(o.code||"—")+"</strong></td>"+
        '<td><strong>'+esc(o.name||"Client")+'</strong><span class="jp-secondary-cell">'+esc(o.email||"")+"</span></td>"+
        '<td><strong>'+esc(o.title||"Order Request")+'</strong><span class="jp-secondary-cell">'+(o.items||[]).length+" item(s)</span></td>"+
        "<td><strong>"+peso(o.total)+"</strong></td><td class=\"jp-date-cell\">"+esc(dateText(o.created_at))+"</td>"+
        '<td><span class="badge '+(status==="Rejected"?"badge-red":status==="Approved"?"badge-green":"badge-neutral")+'">'+esc(status)+"</span></td>"+
        '<td class="table-row-actions" onclick="event.stopPropagation()"><div class="popover-wrap" id="'+menu+'"><button class="icon-more-button vertical-more" aria-label="Order actions" onclick="app.togglePopover(\''+menu+'\',event)">⋮</button><div class="popover-panel client-row-menu">'+
        '<button class="popover-action" onclick="window.JPGeneral.openOrder(\''+id+'\',true)">Edit Order</button>'+
        (o.project_id?"":'<button class="popover-action text-danger" onclick="window.JPGeneral.archiveOrder(\''+id+'\')">Delete Order</button>')+
        "</div></div></td></tr>";
    }).join("")||'<tr><td colspan="7" class="text-center text-muted py-4">No matching orders.</td></tr>';
  }
  function findOrder(id){return orders.find(function(o){return String(o.id)===String(id);});}
  function itemTable(items,editing){
    return (items||[]).map(function(i,n){
      var name=editing?'<input class="form-control" data-oname="'+n+'" value="'+esc(i.name||"Order Item")+'">':'<strong>'+esc(i.name||"Order Item")+"</strong>";
      var qty=editing?'<input class="form-control" data-oqty="'+n+'" type="number" min="1" value="'+Number(i.qty||1)+'">':String(Number(i.qty||1));
      var price=editing?'<input class="form-control" data-oprice="'+n+'" type="number" min="0" step=".01" value="'+Number(i.price||0)+'">':peso(i.price);
      return "<tr><td>"+name+"</td><td>"+qty+"</td><td>"+price+"</td><td>"+peso(Number(i.price||0)*Number(i.qty||1))+"</td></tr>";
    }).join("");
  }
  function openOrder(id,editing){
    var o=findOrder(id);if(!o)return;var items=(o.items||[]).map(function(i){return Object.assign({},i);});
    var canDecide=!o.project_id&&!o.archived_at&&o.status!=="Rejected"&&o.status!=="Project Created";
    var m=modal(
      '<header class="jp-general-modal-head"><div><span class="section-kicker">ORDER REQUEST</span><h2>'+esc(o.code||"Order")+'</h2><p>'+esc(o.title||"Order Request")+'</p></div><button class="jp-general-x" aria-label="Close">×</button></header>'+
      '<section class="card jp-order-client-card"><div class="jp-order-card-head"><div><div class="section-kicker">CLIENT INFORMATION</div><div class="jp-order-client-name">'+esc(o.name||"Client")+'</div></div><span class="badge '+(o.status==="Rejected"?"badge-red":o.status==="Approved"?"badge-green":"badge-neutral")+'">'+esc(effectiveStatus(o))+'</span></div><div class="jp-order-facts"><span>Email</span><b>'+esc(o.email||"—")+'</b><span>Phone</span><b>'+esc(o.phone||"—")+'</b><span>Requested Date</span><b>'+esc(dateText(o.deadline))+'</b><span>Submitted</span><b>'+esc(dateTime(o.created_at))+'</b></div></section>'+
      '<section class="card"><div class="card-header"><div><div class="section-kicker">ORDER ITEMS</div><h3 class="card-title">'+(editing?"Edit Requested Items":"Requested Items")+'</h3></div></div><div class="table-responsive"><table class="data-table jp-order-preview-table"><thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead><tbody>'+itemTable(items,!!editing)+"</tbody></table></div></section>"+
      '<section class="card jp-order-summary-card"><div class="section-kicker">ORDER SUMMARY</div><div><span>Subtotal</span><b>'+peso(o.subtotal)+'</b></div><div><span>Rush Fee</span><b>'+peso(o.rush_fee)+'</b></div><div><span>Discount</span><b>− '+peso(o.discount_amount)+'</b></div><div class="total"><span>Estimated Total</span><strong>'+peso(o.total)+'</strong></div></section>'+
      '<section class="card"><label class="form-label">Review Note</label><textarea id="orderPageNote" class="form-control" rows="3" placeholder="Add an internal note (optional)">'+esc(o.review_note||"")+"</textarea></section>"+
      '<footer class="jp-order-preview-actions">'+(editing?'<button class="btn btn-secondary" id="orderSaveEdits">Save Changes</button>':"")+(canDecide?'<button class="btn btn-danger" id="orderRejectBtn">Reject</button><button class="btn btn-primary" id="orderApproveBtn">Approve Order</button>':"")+"</footer>",
      "jp-order-preview-modal"
    );
    m.querySelector(".jp-general-x").onclick=closeOverlay;
    var save=m.querySelector("#orderSaveEdits");
    if(save)save.onclick=async function(){
      try{
        var edited=items.map(function(base,n){
          return Object.assign({},base,{name:m.querySelector('[data-oname="'+n+'"]').value.trim()||base.name,qty:Math.max(1,Number(m.querySelector('[data-oqty="'+n+'"]').value||1)),price:Math.max(0,Number(m.querySelector('[data-oprice="'+n+'"]').value||0))});
        });
        var r=await API({action:"revise-order",id:o.id,items:edited,rush_fee:Number(o.rush_fee||0),discount_amount:Number(o.discount_amount||0),note:m.querySelector("#orderPageNote").value,send_to_client:false});
        Object.assign(o,r.order);toast("Changes saved");openOrder(o.id,false);
      }catch(e){toast(e.message||"Could not save changes.");}
    };
    var reject=m.querySelector("#orderRejectBtn");
    if(reject)reject.onclick=async function(){
      var note=m.querySelector("#orderPageNote").value.trim();if(!note){toast("Add a rejection reason first.");return;}
      if(!(await confirmAction({title:"Reject "+o.code+"?",message:"This request will stay in history with a Rejected status.",confirmLabel:"Reject Order",danger:true})))return;
      try{
        await API({action:"review-order",id:o.id,status:"Rejected",note:note});
        o.status="Rejected";o.review_note=note;closeOverlay();toast("Order rejected.");renderOrders(false);
      }catch(e){toast(e.message);}
    };
    var approve=m.querySelector("#orderApproveBtn");
    if(approve)approve.onclick=async function(){
      if(!(await confirmAction({title:"Approve "+o.code+"?",message:"The request will be prepared in New Order. An existing client is used only when the email matches exactly.",confirmLabel:"Approve Order"})))return;
      var prep=preparingOrder(o);
      try{
        approve.disabled=true;
        var r=await API({action:"approve-order",id:o.id,note:m.querySelector("#orderPageNote").value});
        o.status="Approved";o.client_id=r.client?.id||null;Object.assign(o,r.order||{});
        closeOverlay();
        window.app.preloadOrderRequestData(r.order,r.client);
        prep.done((o.code||"Order")+" is ready");
        toast((o.code||"Order")+" loaded into New Order.");
      }catch(e){prep.fail(e.message);approve.disabled=false;toast(e.message);}
    };
  }
  async function archiveOrder(id){
    var o=findOrder(id);if(!o)return;
    if(!(await confirmAction({title:"Delete "+o.code+"?",message:"It will disappear from Active Orders and remain archived for history.",confirmLabel:"Delete Order",danger:true})))return;
    var index=orders.findIndex(function(x){return String(x.id)===String(id);});
    var snapshot=index>=0?Object.assign({},orders[index]):null;
    if(index>=0){orders[index].archived_at=new Date().toISOString();orders[index].status="Archived";}
    closeOverlay();renderOrders(false);toast("Order removed.");
    try{await API({action:"archive-order",id:id});}
    catch(e){if(index>=0&&snapshot)orders[index]=snapshot;renderOrders(false);toast("Delete failed: "+(e.message||e));}
  }

  function renderEditableClient(){
    var st=window.app.getWorkspaceState(),id=st.activeClientId,c=(st.clients||[]).find(function(x){return String(x.id)===String(id);}),host=document.getElementById("clientProfileContent");
    if(!c||!host)return;
    var ps=(st.projects||[]).filter(function(p){return !p.deleted&&String(p.client_id)===String(c.id);});
    var paid=function(p){return (p.payments||[]).filter(function(x){return !x.deleted_at;}).reduce(function(s,x){return s+Number(x.amount_paid||x.amount||0);},0);};
    var total=ps.reduce(function(s,p){return s+Number(p.total_amount||0);},0),paidTotal=ps.reduce(function(s,p){return s+paid(p);},0);
    document.getElementById("clientProfileName").textContent=c.name||"Client";document.getElementById("clientProfileEmail").textContent=(c.client_code||"Client")+" · Editable Client Record";
    host.innerHTML=
      '<div class="jp-inline-client-layout"><section class="card"><div class="card-header"><div><div class="section-kicker">CLIENT RECORD</div><h2 class="card-title">Client Information</h2></div><span class="badge badge-green">Active</span></div><div class="form-grid">'+
      '<div class="form-group"><label class="form-label">Client ID</label><input class="form-control" value="'+esc(c.client_code||"—")+'" readonly></div>'+
      '<div class="form-group"><label class="form-label">Full Name</label><input id="inlineClientName" class="form-control" value="'+esc(c.name||"")+'"></div>'+
      '<div class="form-group"><label class="form-label">Email</label><input id="inlineClientEmail" type="email" class="form-control" value="'+esc(c.email||"")+'"></div>'+
      '<div class="form-group"><label class="form-label">Contact Number</label><input id="inlineClientPhone" class="form-control" value="'+esc(c.phone||"")+'"></div>'+
      '<div class="form-group" style="grid-column:1/-1"><label class="form-label">Address</label><input id="inlineClientAddress" class="form-control" value="'+esc(c.address||"")+'"></div>'+
      '<div class="form-group" style="grid-column:1/-1"><label class="form-label">Notes</label><textarea id="inlineClientNotes" class="form-control" rows="4">'+esc(c.notes||"")+"</textarea></div></div>"+
      '<div class="jp-inline-form-footer"><span id="inlineClientSaveState">Changes save automatically.</span></div></section>'+
      '<aside class="card jp-inline-client-summary"><div class="section-kicker">SUMMARY</div><h2 class="card-title">Client Value</h2><div class="jp-summary-line"><span>Total Projects</span><b>'+ps.length+'</b></div><div class="jp-summary-line"><span>Total Project Value</span><b>'+peso(total)+'</b></div><div class="jp-summary-line"><span>Total Paid</span><b class="positive">'+peso(paidTotal)+'</b></div><div class="jp-summary-line"><span>Outstanding</span><b>'+peso(Math.max(0,total-paidTotal))+'</b></div><div class="jp-summary-line"><span>Date Added</span><b>'+esc(dateText(c.created_at))+"</b></div></aside></div>"+
      '<section class="card jp-inline-recent"><div class="card-header"><h2 class="card-title">Recent Projects</h2><button class="btn btn-secondary btn-sm" onclick="app.navigateTo(\'projects\')">View All →</button></div><div class="table-responsive"><table class="data-table"><thead><tr><th>Project</th><th>Value</th><th>Paid</th><th>Balance</th><th>Status</th><th>Date</th></tr></thead><tbody>'+
      (ps.slice().sort(function(a,b){return new Date(b.created_at||0)-new Date(a.created_at||0);}).slice(0,5).map(function(p){var pd=paid(p);return '<tr class="clickable-row" onclick="app.openProjectDetails(\''+esc(p.id)+'\')"><td><strong class="project-id-cell">'+esc(p.title||p.project_code||"Project")+'</strong></td><td>'+peso(p.total_amount)+'</td><td>'+peso(pd)+'</td><td>'+peso(Math.max(0,Number(p.total_amount||0)-pd))+'</td><td><span class="badge badge-green">'+esc(p.status||p.delivery_status||"Active")+'</span></td><td class="jp-date-cell">'+esc(dateText(p.created_at||p.start_date))+"</td></tr>";}).join("")||'<tr><td colspan="6" class="text-center text-muted">No projects.</td></tr>')+
      "</tbody></table></div></section>";
    var timer=null;
    ["inlineClientName","inlineClientEmail","inlineClientPhone","inlineClientAddress","inlineClientNotes"].forEach(function(fid){
      var field=document.getElementById(fid);if(!field)return;
      field.addEventListener("input",function(){
        localStorage.setItem("JUAN_CLIENT_DRAFT_"+c.id,JSON.stringify({name:document.getElementById("inlineClientName").value,email:document.getElementById("inlineClientEmail").value,phone:document.getElementById("inlineClientPhone").value,address:document.getElementById("inlineClientAddress").value,notes:document.getElementById("inlineClientNotes").value,at:Date.now()}));
        var stateEl=document.getElementById("inlineClientSaveState");if(stateEl)stateEl.textContent="Saving…";
        clearTimeout(timer);timer=setTimeout(function(){saveClient(c.id,true);},650);
      });
    });
    var draft=localStorage.getItem("JUAN_CLIENT_DRAFT_"+c.id);
    if(draft){try{var d=JSON.parse(draft);if(Date.now()-Number(d.at||0)<86400000){document.getElementById("inlineClientName").value=d.name??document.getElementById("inlineClientName").value;document.getElementById("inlineClientEmail").value=d.email??document.getElementById("inlineClientEmail").value;document.getElementById("inlineClientPhone").value=d.phone??document.getElementById("inlineClientPhone").value;document.getElementById("inlineClientAddress").value=d.address??document.getElementById("inlineClientAddress").value;document.getElementById("inlineClientNotes").value=d.notes??document.getElementById("inlineClientNotes").value;}}catch(_){}}
  }
  async function saveClient(id,silent){
    var st=window.app.getWorkspaceState(),c=(st.clients||[]).find(function(x){return String(x.id)===String(id);}),db=window.app.getDatabaseClient();if(!c||!db)return toast("Database is not connected.");
    var name=document.getElementById("inlineClientName").value.trim(),email=document.getElementById("inlineClientEmail").value.trim().toLowerCase(),phone=document.getElementById("inlineClientPhone").value.trim(),address=document.getElementById("inlineClientAddress").value.trim(),notes=document.getElementById("inlineClientNotes").value.trim();
    if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return toast("Enter a client name and valid email.");
    var stateEl=document.getElementById("inlineClientSaveState");
    try{
      var u=await db.from("clients").update({name:name,email:email,phone:phone||null,address:address||null,notes:notes}).eq("id",id).select("*").single();if(u.error)throw u.error;
      var pu=await db.from("projects").update({client_name:name,client_email:email,client_phone:phone||null}).eq("client_id",id);if(pu.error)throw pu.error;
      Object.assign(c,u.data);(st.projects||[]).filter(function(p){return String(p.client_id)===String(id);}).forEach(function(p){p.client_name=name;p.client_email=email;p.client_phone=phone||null;});
      localStorage.removeItem("JUAN_CLIENT_DRAFT_"+id);if(stateEl)stateEl.textContent="Saved";
      if(!silent)toast("Changes saved");
    }catch(e){if(stateEl)stateEl.textContent="Save failed";toast(e.code==="23505"?"That email is already assigned to another client.":e.message);}
  }

  function ensureAdsTab(){
    var tabs=document.getElementById("onlinePortalTabs");if(!tabs)return;
    var b=tabs.querySelector('[data-portal-tab="ads"]');
    if(!b){b=document.createElement("button");b.type="button";b.dataset.portalTab="ads";b.textContent="In-House Ads";tabs.appendChild(b);}
    b.disabled=false;b.removeAttribute("aria-disabled");b.style.pointerEvents="auto";
    b.onclick=function(e){e.preventDefault();e.stopPropagation();window.app?.setOnlinePortalTab?.("ads");};
    if(!tabs.dataset.jpAdsDelegated){
      tabs.dataset.jpAdsDelegated="1";
      tabs.addEventListener("click",function(e){var target=e.target.closest('[data-portal-tab="ads"]');if(!target)return;e.preventDefault();e.stopPropagation();window.app?.setOnlinePortalTab?.("ads");});
    }
    if(!document.getElementById("onlinePortalAdsPanel")){
      var p=document.createElement("div");p.id="onlinePortalAdsPanel";p.className="portal-panel hidden";p.innerHTML='<div id="jpAdsAdmin"></div>';
      var settingsPanel=document.getElementById("onlinePortalSettingsPanel"),activity=document.getElementById("onlinePortalActivityPanel");
      if(settingsPanel)settingsPanel.after(p);else if(activity)activity.after(p);else tabs.parentElement?.appendChild(p);
    }
  }
  function adStatus(a){
    if(a.archived_at||a.status==="archived")return "Archived";if(a.status==="paused")return "Paused";var now=Date.now(),start=a.start_at?new Date(a.start_at).getTime():0,end=a.end_at?new Date(a.end_at).getTime():0;
    if(end&&!a.no_expiration&&end<=now)return "Expired";if(start&&start>now)return "Scheduled";if(a.status==="published"&&a.enabled!==false)return "Live";return a.status==="draft"?"Draft":(a.status||"Draft");
  }
  async function renderAds(){
    ensureAdsTab();var host=document.getElementById("jpAdsAdmin");if(!host)return;host.innerHTML='<div class="card text-muted">Loading campaigns…</div>';
    try{
      var d=await API({action:"ad-dashboard"}),ads=d.ads||[],stats=d.stats||{},settings=d.settings||{rotation_seconds:8};
      var active=ads.filter(function(a){return adStatus(a)==="Live";}).length,banners=ads.filter(function(a){return a.ad_type==="banner";}).length,popups=ads.filter(function(a){return a.ad_type==="popup";}).length,scheduled=ads.filter(function(a){return adStatus(a)==="Scheduled";}).length;
      host.innerHTML=
        '<div class="jp-ads-heading"><div><span class="section-kicker">PROMOTIONS</span><h2>In-House Ads</h2><p>Create and manage banners and popups shown across JUAN PROJECT Online.</p></div><div><button class="btn btn-primary" id="jpCreateAd">+ Create Ad</button><button class="btn btn-secondary" id="jpBannerSettings">Banner Settings</button></div></div>'+
        '<div class="jp-ad-kpis"><div class="card"><span>Active Ads</span><strong>'+active+'</strong></div><div class="card"><span>Banner Ads</span><strong>'+banners+'</strong></div><div class="card"><span>Popup Ads</span><strong>'+popups+'</strong></div><div class="card"><span>Scheduled</span><strong>'+scheduled+"</strong></div></div>"+
        '<div class="view-toolbar unified-toolbar"><input id="jpAdSearch" class="form-control" placeholder="Search ad name or destination..."><div class="filter-pills" id="jpAdFilters"><button class="filter-pill active">All</button><button class="filter-pill">Banners</button><button class="filter-pill">Popups</button><button class="filter-pill">Scheduled</button><button class="filter-pill">Archived</button></div></div>'+
        '<div class="card table-card"><div class="table-responsive"><table class="data-table unified-table jp-ad-table"><thead><tr><th>Ad Name</th><th>Type</th><th>Status</th><th>Placement</th><th>Destination</th><th>Schedule</th><th>Performance</th><th class="table-actions-col"></th></tr></thead><tbody id="jpAdRows"></tbody></table></div></div>'+
        '<div class="card jp-ad-rules"><strong>Popup & Display Rules</strong><span>One unseen popup per visit · Once per campaign per viewer · Banner rotation: '+Number(settings.rotation_seconds||8)+" seconds · Fade transition</span></div>";
      var current="All",search=document.getElementById("jpAdSearch"),filters=document.getElementById("jpAdFilters"),rows=document.getElementById("jpAdRows");
      function draw(){
        var q=(search.value||"").toLowerCase().trim(),list=ads.filter(function(a){var s=adStatus(a);if(current==="Banners"&&a.ad_type!=="banner")return false;if(current==="Popups"&&a.ad_type!=="popup")return false;if(current==="Scheduled"&&s!=="Scheduled")return false;if(current==="Archived"&&s!=="Archived")return false;return !q||((a.title||"")+" "+(a.destination_type||"")+" "+(a.destination_value||"")).toLowerCase().indexOf(q)>=0;});
        rows.innerHTML=list.map(function(a){var s=stats[a.id]||{},imp=Number(s.impression||0),clk=Number(s.click||0),ctr=imp?((clk/imp)*100).toFixed(1):"0.0",menu="adMenu_"+a.id.replace(/-/g,"");return '<tr><td><strong>'+esc(a.title)+'</strong><span class="jp-secondary-cell">'+esc(a.body||"")+'</span></td><td><span class="badge badge-neutral">'+esc(a.ad_type||"banner")+'</span></td><td><span class="badge '+(adStatus(a)==="Live"?"badge-green":"badge-neutral")+'">'+esc(adStatus(a))+'</span></td><td>'+esc(a.placement||"—")+'</td><td>'+esc(a.destination_type||"no_action")+(a.destination_value?'<span class="jp-secondary-cell">'+esc(a.destination_value)+"</span>":"")+'</td><td>'+(a.start_at?esc(dateTime(a.start_at)):"Now")+'<span class="jp-secondary-cell">'+(a.no_expiration?"No expiration":a.end_at?"to "+esc(dateTime(a.end_at)):"—")+'</span></td><td><strong>'+imp.toLocaleString()+' views</strong><span class="jp-secondary-cell">'+ctr+'% CTR</span></td><td class="table-row-actions"><div class="popover-wrap" id="'+menu+'"><button class="icon-more-button vertical-more" onclick="app.togglePopover(\''+menu+'\',event)">⋮</button><div class="popover-panel client-row-menu"><button class="popover-action" data-aedit="'+a.id+'">Edit</button><button class="popover-action" data-atoggle="'+a.id+'">'+(adStatus(a)==="Live"?"Pause":"Publish")+'</button><button class="popover-action text-danger" data-aarchive="'+a.id+'">Archive</button></div></div></td></tr>';}).join("")||'<tr><td colspan="8" class="text-center text-muted py-4">No campaigns found.</td></tr>';
        rows.querySelectorAll("[data-aedit]").forEach(function(b){b.onclick=function(){openAd(ads.find(function(a){return a.id===b.dataset.aedit;}),renderAds);};});
        rows.querySelectorAll("[data-atoggle]").forEach(function(b){b.onclick=async function(){var a=ads.find(function(x){return x.id===b.dataset.atoggle;});try{await API({action:"save-ad",ad:Object.assign({},a,{status:adStatus(a)==="Live"?"paused":"published"})});toast(adStatus(a)==="Live"?"Campaign paused.":"Campaign published.");renderAds();}catch(e){toast(e.message);}};});
        rows.querySelectorAll("[data-aarchive]").forEach(function(b){b.onclick=async function(){if(!confirm("Archive this campaign?"))return;try{await API({action:"archive-ad",id:b.dataset.aarchive});toast("Campaign archived.");renderAds();}catch(e){toast(e.message);}};});
      }
      filters.querySelectorAll("button").forEach(function(b){b.onclick=function(){current=b.textContent.trim();filters.querySelectorAll("button").forEach(function(x){x.classList.toggle("active",x===b);});draw();};});search.oninput=draw;draw();
      document.getElementById("jpCreateAd").onclick=function(){openAd(null,renderAds);};document.getElementById("jpBannerSettings").onclick=function(){bannerSettings(settings,renderAds);};
    }catch(e){host.innerHTML='<div class="card text-danger">'+esc(e.message)+"</div>";}
  }
  async function uploadAd(file){
    if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw new Error("Use JPG, PNG, or WEBP.");
    var bitmap=await createImageBitmap(file),scale=Math.min(1,1600/bitmap.width),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
    var blob=await new Promise(function(r){canvas.toBlob(r,"image/webp",.84);});if(!blob||blob.size>2097152)throw new Error("Promotional image must be 2 MB or smaller after compression.");
    var db=window.app.getDatabaseClient();if(!db)throw new Error("Database is not connected.");var name="ads/"+Date.now()+"-"+(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2))+".webp",up=await db.storage.from("juan-ad-assets").upload(name,blob,{contentType:"image/webp",upsert:false});if(up.error)throw up.error;return db.storage.from("juan-ad-assets").getPublicUrl(name).data.publicUrl;
  }
  function openAd(a,done){
    a=a||{ad_type:"banner",status:"draft",placement:"homepage_banner",destination_type:"no_action",priority:0,no_expiration:false};
    var m=modal('<header class="jp-general-modal-head"><div><span class="section-kicker">'+(a.id?"EDIT CAMPAIGN":"CREATE AD")+'</span><h2>'+(a.id?esc(a.title):"New In-House Ad")+'</h2></div><button class="jp-general-x">×</button></header><div class="jp-ad-editor-grid">'+
      '<div class="form-group"><label class="form-label">Ad Type</label><select id="adType" class="form-control"><option value="banner">Banner</option><option value="popup">Popup</option></select></div><div class="form-group"><label class="form-label">Ad Name</label><input id="adTitle" class="form-control" value="'+esc(a.title||"")+'"></div>'+
      '<div class="form-group"><label class="form-label">Promotional Image</label><input id="adFile" class="form-control" type="file" accept="image/jpeg,image/png,image/webp"></div><div class="form-group"><label class="form-label">Destination</label><select id="adDestType" class="form-control"><option value="no_action">No Action</option><option value="shop">Shop</option><option value="package">Package</option><option value="service">Service</option><option value="referral">Referral</option><option value="loyalty">Loyalty</option><option value="page">Specific JPO Page</option><option value="external_url">External URL</option></select></div>'+
      '<div class="form-group"><label class="form-label">Destination Value</label><input id="adDest" class="form-control" value="'+esc(a.destination_value||"")+'"></div><div class="form-group"><label class="form-label">Placement</label><select id="adPlacement" class="form-control"><option value="homepage_banner">Homepage Banner</option><option value="homepage_popup">Homepage Popup</option></select></div>'+
      '<div class="form-group"><label class="form-label">Start Date / Time</label><input id="adStart" class="form-control" type="datetime-local"></div><div class="form-group"><label class="form-label">End Date / Time</label><input id="adEnd" class="form-control" type="datetime-local"></div><div class="form-group"><label class="form-label">Priority</label><input id="adPriority" class="form-control" type="number" min="0" max="1000" value="'+Number(a.priority||0)+'"></div><div class="form-group"><label class="form-label">Image Alt Text</label><input id="adAlt" class="form-control" value="'+esc(a.image_alt||a.title||"")+'"></div><label class="jp-check-row"><input id="adNoExpiry" type="checkbox"> No expiration</label></div><footer class="jp-order-preview-actions"><button id="adDraft" class="btn btn-secondary">Save Draft</button><button id="adPublish" class="btn btn-primary">Publish</button></footer>',"jp-ad-editor-modal");
    m.querySelector(".jp-general-x").onclick=closeOverlay;document.getElementById("adType").value=a.ad_type||"banner";document.getElementById("adDestType").value=a.destination_type||"no_action";document.getElementById("adPlacement").value=a.placement||"homepage_banner";document.getElementById("adNoExpiry").checked=!!a.no_expiration;
    function dt(v){if(!v)return "";var d=new Date(v),off=d.getTimezoneOffset();return new Date(d.getTime()-off*60000).toISOString().slice(0,16);}document.getElementById("adStart").value=dt(a.start_at);document.getElementById("adEnd").value=dt(a.end_at);
    async function save(status){
      var title=document.getElementById("adTitle").value.trim();if(!title)return toast("Ad name is required.");var file=document.getElementById("adFile").files[0],image=a.image||null;
      try{if(file)image=await uploadAd(file);var v=function(id){return document.getElementById(id).value;};await API({action:"save-ad",ad:Object.assign({},a,{id:a.id||null,title:title,ad_type:v("adType"),status:status,image:image,placement:v("adPlacement"),destination_type:v("adDestType"),destination_value:v("adDest").trim(),start_at:v("adStart")?new Date(v("adStart")).toISOString():null,end_at:v("adEnd")?new Date(v("adEnd")).toISOString():null,no_expiration:document.getElementById("adNoExpiry").checked,priority:Number(v("adPriority")||0),image_alt:v("adAlt").trim()||title,audience:"all"})});toast(status==="published"?"Campaign published.":"Draft saved.");closeOverlay();done();}catch(e){toast(e.message);}
    }
    document.getElementById("adDraft").onclick=function(){save("draft");};document.getElementById("adPublish").onclick=function(){save("published");};
  }
  function bannerSettings(settings,done){
    var m=modal('<header class="jp-general-modal-head"><div><span class="section-kicker">GLOBAL SETTINGS</span><h2>Banner Settings</h2></div><button class="jp-general-x">×</button></header><div class="form-group"><label class="form-label">Rotation Interval</label><input id="bannerSeconds" class="form-control" type="number" min="3" max="120" value="'+Number(settings.rotation_seconds||8)+'"></div><div class="form-group"><label class="form-label">Transition</label><input class="form-control" value="Fade" readonly></div><footer class="jp-order-preview-actions"><button id="bannerSave" class="btn btn-primary">Save Settings</button></footer>',"jp-banner-settings-modal");
    m.querySelector(".jp-general-x").onclick=closeOverlay;document.getElementById("bannerSave").onclick=async function(){try{await API({action:"ad-settings",rotation_seconds:Number(document.getElementById("bannerSeconds").value||8)});toast("Banner settings saved.");closeOverlay();done();}catch(e){toast(e.message);}};
  }

  function install(){
    document.getElementById("juanSuiteNavGroup")?.remove();
    document.getElementById("suiteHeaderRequests")?.remove();
    document.getElementById("suiteHeaderScanner")?.remove();
    document.querySelectorAll(".suite-order-shortcuts").forEach(function(x){x.remove();});
    document.getElementById("suiteProfilePreview")?.remove();
    ensureOrdersView();var nav=document.getElementById("workspaceOrdersNav");if(nav){nav.dataset.view="orders";nav.removeAttribute("onclick");}
    var originalNav=window.app.navigateTo.bind(window.app);window.app.navigateTo=function(view){var r=originalNav(view);if(view==="orders")setTimeout(function(){renderOrders(true);},0);if(view==="client-profile")setTimeout(renderEditableClient,0);if(view==="online-portal")setTimeout(ensureAdsTab,0);return r;};
    var openClient=window.app.openClientProfile&&window.app.openClientProfile.bind(window.app);if(openClient)window.app.openClientProfile=function(id){var r=openClient(id);setTimeout(renderEditableClient,0);return r;};
    var renderPortal=window.app.renderOnlinePortal&&window.app.renderOnlinePortal.bind(window.app);if(renderPortal)window.app.renderOnlinePortal=function(){var r=renderPortal();setTimeout(ensureAdsTab,0);return r;};
    var setTab=window.app.setOnlinePortalTab&&window.app.setOnlinePortalTab.bind(window.app);if(setTab)window.app.setOnlinePortalTab=function(tab){if(tab!=="ads")return setTab(tab);ensureAdsTab();document.querySelectorAll("#onlinePortalTabs button").forEach(function(b){b.classList.toggle("active",b.dataset.portalTab==="ads");});document.querySelectorAll("#view-online-portal .portal-panel").forEach(function(p){p.classList.add("hidden");});document.getElementById("onlinePortalAdsPanel").classList.remove("hidden");renderAds();};
    window.jpOpenOrders=function(){window.app.navigateTo("orders");};nav&&nav.addEventListener("click",function(e){e.preventDefault();window.app.navigateTo("orders");});ensureAdsTab();
    window.JPGeneral={renderOrders:renderOrders,openOrder:openOrder,archiveOrder:archiveOrder,renderEditableClient:renderEditableClient,renderAds:renderAds,closeOverlay:closeOverlay};
  }
  ready(install);
})();