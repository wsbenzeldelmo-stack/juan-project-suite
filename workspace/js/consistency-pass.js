/* JUAN PROJECT Workspace — consistency & reliability pass */
(function(){
  "use strict";
  const SETTINGS_KEY="JUAN_WORKSPACE_SETTINGS_V2";
  const FORM_DRAFT_KEY="JUAN_WORKSPACE_DRAFTS_V2";
  let settingsBuilt=false, saveTimers=new Map();

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const toast=m=>window.showToast?window.showToast(m):void 0;
  const appReady=()=>window.app&&window.app.getWorkspaceState&&window.app.getDatabaseClient;
  function later(fn,n=0){if(appReady())return fn();if(n<80)setTimeout(()=>later(fn,n+1),75);}

  function cleanRootText(){
    Array.from(document.body.childNodes).forEach(node=>{
      if(node.nodeType===Node.TEXT_NODE&&/^(?:\\n|\s)+$/.test(String(node.textContent||"")))node.remove();
      if(node.nodeType===Node.TEXT_NODE&&String(node.textContent||"").includes("\\n"))node.textContent=String(node.textContent||"").replace(/\\n/g,"");
    });
  }

  function stored(){
    try{return {...defaults(),...JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}")};}catch(_){return defaults();}
  }
  function defaults(){
    return {
      workspaceName:"JUAN PROJECT Workspace",businessName:"JUAN PROJECT",timezone:"Asia/Manila",currency:"PHP",dateFormat:"MMM D, YYYY",
      showBusinessContact:true,includeBranding:true,autoReference:true,reconnectAutomatically:true,showConnectionSidebar:true,notifySyncFailure:true,
      accent:"mint",density:"comfortable",sidebarSize:"standard",rowHeight:"comfortable",reduceMotion:false,
      notifNewOrder:true,notifPaymentSubmitted:true,notifPaymentApproved:true,notifDeadline:true,notifOverdue:true,notifClientMessage:true,notifSyncFail:true,
      browserNotifications:false,notificationSounds:true,deadlineReminderDays:3,facialVerification:false,autoLock:true,autoLockMinutes:30,
      verifyReset:true,verifyDisconnect:true
    };
  }
  function savePrefs(patch){
    const next={...stored(),...patch};localStorage.setItem(SETTINGS_KEY,JSON.stringify(next));applyInterfacePrefs(next);setSettingsStatus("Saved");return next;
  }
  function applyInterfacePrefs(p=stored()){
    document.documentElement.dataset.jpDensity=p.density||"comfortable";
    document.documentElement.dataset.jpSidebarSize=p.sidebarSize||"standard";
    document.documentElement.dataset.jpRowHeight=p.rowHeight||"comfortable";
    document.documentElement.dataset.jpAccent=p.accent||"mint";
    document.documentElement.classList.toggle("jp-reduce-motion",!!p.reduceMotion);
  }
  function setSettingsStatus(text){
    const el=$("#jpSettingsSaveState");if(!el)return;
    el.textContent=text;el.classList.add("visible");
    clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove("visible"),text==="Saving…"?4000:1300);
  }

  function toggleRow(label,key,value,help=""){
    return '<label class="jp-settings-toggle-row"><span><b>'+esc(label)+'</b>'+(help?'<small>'+esc(help)+'</small>':'')+'</span><input type="checkbox" class="jp-setting-toggle jp-setting-local" data-key="'+esc(key)+'" '+(value?'checked':'')+'><i></i></label>';
  }
  function field(label,id,value,type="text",attrs=""){
    return '<label class="jp-settings-field"><span>'+esc(label)+'</span><input id="'+id+'" class="form-control jp-settings-control" type="'+type+'" value="'+esc(value||"")+'" '+attrs+'></label>';
  }
  function section(id,title,description,content,danger=false){
    return '<section id="settings-'+id+'" class="jp-settings-segment '+(danger?"danger":"")+'" data-segment="'+id+'"><div class="jp-settings-segment-head"><span>'+esc(title.toUpperCase())+'</span><p>'+esc(description||"")+'</p></div>'+content+'</section>';
  }

  function buildSettings(){
    const view=$("#view-settings");if(!view)return;
    const st=window.app.getWorkspaceState(),p=stored();
    const ownerName=st.ownerName||localStorage.getItem("JUAN_OWNER_NAME")||"BENZEL DELMO";
    const ownerEmail=st.ownerEmail||localStorage.getItem("JUAN_OWNER_EMAIL")||"ws.benzeldelmo@gmail.com";
    const ownerPhone=st.ownerPhone||localStorage.getItem("JUAN_OWNER_PHONE")||"0963 705 0477";
    const ownerAddress=st.ownerAddress||localStorage.getItem("JUAN_OWNER_ADDRESS")||"BATANGAS CITY, BATANGAS";
    const connected=!!st.isConnected;
    const initials=ownerName.split(/\s+/).filter(Boolean).map(x=>x[0]).join("").slice(0,2).toUpperCase()||"BD";
    const avatar=st.profilePhoto?'<img src="'+esc(st.profilePhoto)+'" alt="Benzel Delmo profile photo">':esc(initials);

    const profile=section("profile","Profile","Account owner and business contact information.",
      '<div class="card jp-settings-card jp-profile-card"><div class="jp-profile-identity"><div id="jpSettingsAvatar" class="jp-settings-avatar">'+avatar+'</div><div><h3>'+esc(ownerName)+'</h3><p>Workspace Owner</p><div class="jp-inline-actions"><button class="btn btn-secondary btn-sm" id="jpChangePhoto">Change Photo</button><button class="btn btn-danger btn-sm" id="jpRemovePhoto">Remove</button></div></div></div><div class="jp-settings-grid-2">'+
      field("Account Owner Name","jpOwnerName",ownerName)+field("Email Address","jpOwnerEmail",ownerEmail,"email")+
      field("Phone Number","jpOwnerPhone",ownerPhone)+
      '<label class="jp-settings-field wide"><span>Billing Address</span><textarea id="jpOwnerAddress" class="form-control jp-settings-control" rows="2">'+esc(ownerAddress)+'</textarea></label></div><div class="jp-settings-autosave-note">Profile edits save automatically. <span id="jpSettingsSaveState">Saved</span></div></div>');

    const workspace=section("workspace","Workspace","Workspace identity, localization, and invoice behavior.",
      '<div class="card jp-settings-card"><div class="jp-settings-grid-2">'+
      field("Workspace Name","jpWorkspaceName",p.workspaceName)+field("Business Name","jpBusinessName",p.businessName)+
      '<label class="jp-settings-field"><span>Time Zone</span><select class="form-control jp-setting-local" data-key="timezone"><option value="Asia/Manila" selected>Asia/Manila (GMT+8)</option></select></label>'+
      '<label class="jp-settings-field"><span>Currency</span><select class="form-control jp-setting-local" data-key="currency"><option value="PHP" selected>Philippine Peso (PHP ₱)</option></select></label>'+
      '<label class="jp-settings-field"><span>Date Format</span><select class="form-control jp-setting-local" data-key="dateFormat"><option>MMM D, YYYY</option><option>MM/DD/YYYY</option><option>DD/MM/YYYY</option></select></label></div>'+
      '<div class="jp-settings-toggle-list">'+toggleRow("Show business contact on invoices","showBusinessContact",p.showBusinessContact)+toggleRow("Include JUAN PROJECT branding","includeBranding",p.includeBranding)+toggleRow("Automatically assign JP reference numbers","autoReference",p.autoReference)+'</div></div>');

    const database=section("database","Database & Sync","Live Supabase connection and synchronization controls.",
      '<div class="card jp-settings-card"><div class="jp-db-status-row"><div class="jp-db-live"><i></i><div><b>'+(connected?'Connected · LIVE':'Sign in required')+'</b><small>'+(connected?'Your Workspace data is synchronized with Supabase.':'Connect to load and edit shared business data.')+'</small></div></div><div class="jp-db-meta"><span>Provider<b>Supabase</b></span><span>Project<b>JUAN PROJECT Production</b></span><span>Status<b>'+(connected?'All data synced':'Disconnected')+'</b></span></div></div>'+
      '<div class="jp-settings-button-row"><button class="btn btn-secondary" id="jpTestDb">Test Connection</button><button class="btn btn-primary" id="jpSyncNow">Sync Now</button><button class="btn btn-secondary" id="jpReconnectDb">Reconnect</button><button class="btn btn-danger" id="jpDisconnectDb">Disconnect</button></div>'+
      '<div class="jp-credential-note">Deployment credentials are managed through Vercel and are never displayed in Workspace.</div>'+
      '<div class="jp-settings-toggle-list">'+toggleRow("Reconnect Automatically","reconnectAutomatically",p.reconnectAutomatically)+toggleRow("Show Connection Status in Sidebar","showConnectionSidebar",p.showConnectionSidebar)+toggleRow("Notify Me When Sync Fails","notifySyncFailure",p.notifySyncFailure)+'</div></div>');

    const appearance=section("appearance","Appearance","Personalize how JUAN PROJECT Workspace looks and feels.",
      '<div class="jp-settings-grid-2"><div class="card jp-settings-card"><h3>Theme</h3><div class="jp-theme-options"><button data-theme="light" class="'+(st.themeMode!=="dark"?"active":"")+'"><span class="light-preview"></span><b>Light</b></button><button data-theme="dark" class="'+(st.themeMode==="dark"?"active":"")+'"><span class="dark-preview"></span><b>Dark</b></button><button data-theme="system"><span class="system-preview"></span><b>System</b></button></div><div class="jp-settings-toggle-list">'+toggleRow("Colorful Mode","colorfulMode",st.colorfulMode==="on","Uses stronger status colors for attention states.")+'</div></div>'+
      '<div class="card jp-settings-card"><h3>Interface</h3><div class="jp-accent-row"><span>Accent color</span><div class="jp-accent-dots"><button data-accent="mint" class="'+(p.accent==="mint"?"active":"")+'"></button><button data-accent="blue"></button><button data-accent="violet"></button><button data-accent="orange"></button><button data-accent="pink"></button></div></div>'+
      '<div class="jp-settings-grid-2 compact"><label class="jp-settings-field"><span>Density</span><select class="form-control jp-setting-local" data-key="density"><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label><label class="jp-settings-field"><span>Sidebar Size</span><select class="form-control jp-setting-local" data-key="sidebarSize"><option value="standard">Standard</option><option value="compact">Compact</option></select></label><label class="jp-settings-field"><span>Table Row Height</span><select class="form-control jp-setting-local" data-key="rowHeight"><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label></div>'+
      '<div class="jp-settings-toggle-list">'+toggleRow("Reduce Motion","reduceMotion",p.reduceMotion,"Minimize animations and transitions across the Workspace.")+'</div></div></div>'+
      '<div class="card jp-interface-preview"><span class="badge badge-red">Priority</span><span class="badge badge-neutral">In progress</span><span class="badge badge-green">Paid</span><button class="btn btn-primary btn-sm">Primary action</button></div>');

    const notifications=section("notifications","Notifications","Choose which events should get your attention.",
      '<div class="card jp-settings-card"><div class="jp-settings-toggle-list">'+
      toggleRow("New order received","notifNewOrder",p.notifNewOrder)+toggleRow("New payment submitted","notifPaymentSubmitted",p.notifPaymentSubmitted)+toggleRow("Payment approved","notifPaymentApproved",p.notifPaymentApproved)+toggleRow("Project deadline approaching","notifDeadline",p.notifDeadline)+toggleRow("Project overdue","notifOverdue",p.notifOverdue)+toggleRow("Client message received","notifClientMessage",p.notifClientMessage)+toggleRow("Database synchronization failure","notifSyncFail",p.notifSyncFail)+toggleRow("Browser notifications","browserNotifications",p.browserNotifications)+toggleRow("Notification sounds","notificationSounds",p.notificationSounds)+'</div>'+
      '<label class="jp-settings-field jp-reminder-field"><span>Deadline reminder</span><select class="form-control jp-setting-local" data-key="deadlineReminderDays"><option value="1">1 day before</option><option value="3">3 days before</option><option value="5">5 days before</option><option value="7">7 days before</option></select></label></div>');

    const data=section("data","Data Management","Backups, exports, and validated imports.",
      '<div class="card jp-settings-card"><div class="jp-data-actions"><button class="btn btn-secondary" id="jpExportBackup">Export JSON Backup</button><button class="btn btn-secondary" id="jpRestoreBackup">Restore or Import Data</button><button class="btn btn-secondary" id="jpImportCsv">Import CSV</button><button class="btn btn-secondary" id="jpTemplate">Download Import Template</button><button class="btn btn-secondary" data-export="projects">Export Projects</button><button class="btn btn-secondary" data-export="clients">Export Clients</button><button class="btn btn-secondary" data-export="finance">Export Invoices & Payments</button></div>'+
      '<input type="file" id="jpBackupInput" accept=".json" hidden><input type="file" id="jpHistoricalInput" accept=".csv,text/csv" hidden>'+
      '<div class="jp-data-status"><span>Last Backup<b id="jpLastBackup">Not recorded</b></span><span>Last Import Result<b id="jpLastImport">No recent import</b></span></div>'+
      '<div class="jp-import-area"><div><h3>Import Historical Records</h3><p>Choose a CSV or paste data. Nothing is imported until the preview is validated and confirmed.</p></div><button class="btn btn-secondary" id="jpChooseHistorical">Choose CSV</button><textarea id="legacyPasteData" class="form-control" rows="5" placeholder="Paste historical rows here, including the header row…"></textarea><button class="btn btn-secondary" id="jpPreviewImport">Preview & Validate</button><div id="jpImportPreview"></div></div></div>');

    const security=section("security","Security","Sign-in protection and sensitive-action verification.",
      '<div class="card jp-settings-card"><div class="jp-settings-button-row"><button class="btn btn-secondary" id="jpChangePassword">Change Password</button><button class="btn btn-secondary" id="jpActiveSessions">Active Sessions</button><button class="btn btn-secondary" id="jpSignInHistory">Sign-in History</button><button class="btn btn-danger" id="jpLogoutOthers">Log Out Other Sessions</button></div>'+
      '<div class="jp-settings-toggle-list">'+toggleRow("Facial Verification","facialVerification",p.facialVerification,"Optional additional security method. Password authentication remains required.")+toggleRow("Auto-Lock Workspace","autoLock",p.autoLock)+toggleRow("Require verification before resetting data","verifyReset",p.verifyReset)+toggleRow("Require verification before disconnecting the database","verifyDisconnect",p.verifyDisconnect)+'</div>'+
      '<label class="jp-settings-field jp-reminder-field"><span>Auto-lock duration</span><select class="form-control jp-setting-local" data-key="autoLockMinutes"><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option></select></label><div id="jpSecurityInfo" class="jp-inline-info">Current browser session is active.</div></div>');

    const about=section("about","About","Application, release, and deployment information.",
      '<div class="card jp-settings-card"><div class="jp-about-grid"><div><span>Application</span><b>JUAN PROJECT Workspace</b></div><div><span>Version</span><b>V1.3.3.2</b></div><div><span>Developed by</span><b>BENZEL DELMO</b></div><div><span>System</span><b>JUAN PROJECT Management System</b></div><div><span>Build</span><b id="jpBuildInfo">GitHub + Vercel</b></div><div><span>Database</span><b>Supabase Production</b></div></div><div class="jp-settings-button-row"><button class="btn btn-secondary" id="jpCheckUpdates">Check for Updates</button><a class="btn btn-secondary" href="/privacy" target="_blank" rel="noopener">Privacy Information</a><button class="btn btn-secondary" id="jpSystemInfo">System Information</button></div><details><summary>Release Notes</summary><p>Consistency and reliability pass: Orders workflow, autosave, Settings control center, command search, tables, client editing, and in-house ads.</p></details></div>');

    const danger=section("danger","Danger Zone","Sensitive operations require typed confirmation and verification.",
      '<div class="card jp-settings-card jp-danger-card"><div class="jp-danger-row"><div><b>Reset Workspace Data</b><small>Reset operational Workspace data using the protected reset workflow.</small></div><button class="btn btn-danger" data-danger="reset">Reset Workspace Data</button></div><div class="jp-danger-row"><div><b>Delete Imported Historical Records</b><small>Remove imported historical project records while preserving the canonical preload reference.</small></div><button class="btn btn-danger" data-danger="historical">Delete Imported Historical Records</button></div><div class="jp-danger-row"><div><b>Clear Cached Data</b><small>Clear browser-only drafts and cached interface preferences.</small></div><button class="btn btn-danger" data-danger="cache">Clear Cached Data</button></div><div class="jp-danger-row"><div><b>Disconnect Database</b><small>End this Workspace database session.</small></div><button class="btn btn-danger" data-danger="disconnect">Disconnect Database</button></div><div class="jp-danger-row"><div><b>Sign Out of Workspace</b><small>End the current Workspace account session.</small></div><button class="btn btn-danger" data-danger="signout">Sign Out of Workspace</button></div></div>',true);

    view.innerHTML='<header class="jp-settings-header"><div><span class="section-kicker">PREFERENCES</span><h1>Settings</h1><p>Manage your Workspace profile, preferences, and system settings.</p></div><div class="jp-settings-search-wrap"><input id="jpSettingsSearch" class="form-control" placeholder="Search settings" autocomplete="off"><div id="jpSettingsSearchResults" class="jp-settings-search-results"></div></div></header>'+
      '<div class="jp-settings-scroll">'+profile+workspace+database+appearance+notifications+data+security+about+danger+'</div>';
    settingsBuilt=true;bindSettings();
  }

  function debounce(key,fn,delay=550){
    clearTimeout(saveTimers.get(key));setSettingsStatus("Saving…");
    saveTimers.set(key,setTimeout(async()=>{try{await fn();setSettingsStatus("Saved");}catch(e){setSettingsStatus("Save failed");toast(e.message||"Could not save setting.");}},delay));
  }
  function bindSettings(){
    const p=stored();
    $$(".jp-setting-local").forEach(el=>{
      const key=el.dataset.key;if(!key)return;
      if(el.type==="checkbox"){el.checked=!!p[key];}
      else if(p[key]!=null)el.value=String(p[key]);
      el.addEventListener("change",async()=>{
        const value=el.type==="checkbox"?el.checked:(el.type==="number"?Number(el.value):el.value);
        if(key==="colorfulMode"){window.app.setColorfulMode(value?"on":"off");savePrefs({[key]:value});return;}
        savePrefs({[key]:value});
        if(key==="browserNotifications"&&value&&"Notification" in window&&Notification.permission==="default")try{await Notification.requestPermission();}catch(_){}
      });
    });
    const profileMap={
      jpOwnerName:v=>window.app.updateOwnerName(v),
      jpOwnerEmail:v=>window.app.updateOwnerEmail(v),
      jpOwnerPhone:v=>window.app.updateOwnerPhone(v),
      jpOwnerAddress:v=>window.app.updateOwnerAddress(v)
    };
    Object.entries(profileMap).forEach(([id,fn])=>{
      const el=$("#"+id);if(!el)return;el.addEventListener("input",()=>debounce(id,()=>fn(el.value),650));
    });
    ["jpWorkspaceName","jpBusinessName"].forEach(id=>{const el=$("#"+id);if(el)el.addEventListener("input",()=>debounce(id,()=>{savePrefs({[id==="jpWorkspaceName"?"workspaceName":"businessName"]:el.value.trim()});},500));});
    $("#jpChangePhoto")?.addEventListener("click",()=>window.app.editExistingProfilePhoto());
    $("#jpRemovePhoto")?.addEventListener("click",()=>window.app.removeProfilePhoto());
    $$("#settings-appearance [data-theme]").forEach(b=>b.addEventListener("click",()=>{
      const mode=b.dataset.theme;
      if(mode==="system"){
        const dark=matchMedia("(prefers-color-scheme: dark)").matches;window.app.setThemeMode(dark?"dark":"light");savePrefs({theme:"system"});
      }else{window.app.setThemeMode(mode);savePrefs({theme:mode});}
      $$("#settings-appearance [data-theme]").forEach(x=>x.classList.toggle("active",x===b));
    }));
    $$(".jp-accent-dots [data-accent]").forEach(b=>b.addEventListener("click",()=>{$$(".jp-accent-dots button").forEach(x=>x.classList.remove("active"));b.classList.add("active");savePrefs({accent:b.dataset.accent});}));
    $("#jpTestDb")?.addEventListener("click",()=>window.app.testDatabaseConnection());
    $("#jpSyncNow")?.addEventListener("click",async()=>{try{await window.app.refreshSharedTest();toast("Workspace synchronized.");}catch(e){toast(e.message);}});
    $("#jpReconnectDb")?.addEventListener("click",()=>window.app.connectDatabaseManually());
    $("#jpDisconnectDb")?.addEventListener("click",()=>dangerConfirm("DISCONNECT DATABASE","Database connection will end for this browser.",()=>window.app.disconnectDatabase()));
    $("#jpExportBackup")?.addEventListener("click",()=>{window.app.exportDataBackup();localStorage.setItem("JUAN_LAST_BACKUP_AT",new Date().toISOString());updateDataMeta();});
    $("#jpRestoreBackup")?.addEventListener("click",()=>$("#jpBackupInput").click());
    $("#jpBackupInput")?.addEventListener("change",e=>window.app.importDataBackup(e));
    $("#jpImportCsv")?.addEventListener("click",()=>$("#jpHistoricalInput").click());
    $("#jpChooseHistorical")?.addEventListener("click",()=>$("#jpHistoricalInput").click());
    $("#jpHistoricalInput")?.addEventListener("change",e=>previewFile(e.target.files?.[0]));
    $("#jpPreviewImport")?.addEventListener("click",()=>previewPasted());
    $("#jpTemplate")?.addEventListener("click",downloadTemplate);
    $$("[data-export]").forEach(b=>b.addEventListener("click",()=>exportCsv(b.dataset.export)));
    $("#jpChangePassword")?.addEventListener("click",changePasswordDialog);
    $("#jpActiveSessions")?.addEventListener("click",()=>{$("#jpSecurityInfo").textContent="Current browser session is active. Other sessions can be signed out below.";});
    $("#jpSignInHistory")?.addEventListener("click",()=>{$("#jpSecurityInfo").textContent="Sign-in history is available through Supabase authentication logs.";});
    $("#jpLogoutOthers")?.addEventListener("click",async()=>{const db=window.app.getDatabaseClient();if(!db)return;try{await db.auth.signOut({scope:"others"});toast("Other sessions signed out.");}catch(e){toast(e.message);}});
    $("#jpCheckUpdates")?.addEventListener("click",()=>toast("You are on the current Workspace build in this deployment."));
    $("#jpSystemInfo")?.addEventListener("click",()=>{$("#jpBuildInfo").textContent=navigator.platform+" · "+navigator.userAgent.split(" ").slice(-2).join(" ");});
    $$("[data-danger]").forEach(b=>b.addEventListener("click",()=>runDanger(b.dataset.danger)));
    bindSettingsSearch();updateDataMeta();
  }

  function updateDataMeta(){
    const b=$("#jpLastBackup"),i=$("#jpLastImport");
    const last=localStorage.getItem("JUAN_LAST_BACKUP_AT");if(b)b.textContent=last?new Date(last).toLocaleString("en-PH"):"Not recorded";
    if(i)i.textContent=localStorage.getItem("JUAN_LAST_IMPORT_RESULT")||"No recent import";
  }
  function bindSettingsSearch(){
    const input=$("#jpSettingsSearch"),box=$("#jpSettingsSearchResults");if(!input||!box)return;
    const entries=[];
    $$(".jp-settings-segment").forEach(section=>{
      const segment=section.dataset.segment;
      $$("label,.jp-danger-row,.jp-settings-button-row button,.jp-data-actions button",section).forEach(el=>{
        const text=String(el.innerText||el.textContent||"").trim().replace(/\s+/g," ");if(text)entries.push({segment,text,el});
      });
    });
    input.addEventListener("input",()=>{
      const q=input.value.trim().toLowerCase();$$(".jp-settings-search-hit").forEach(x=>x.classList.remove("jp-settings-search-hit"));
      if(!q){box.classList.remove("open");box.innerHTML="";return;}
      const hits=entries.filter(x=>x.text.toLowerCase().includes(q)).slice(0,10);
      box.innerHTML=hits.length?hits.map((x,i)=>'<button data-search-index="'+i+'"><span>'+esc(x.text)+'</span><small>'+esc(x.segment[0].toUpperCase()+x.segment.slice(1))+'</small></button>').join(""):'<div class="jp-settings-no-results">No settings found</div>';
      box.classList.add("open");
      $$("[data-search-index]",box).forEach(b=>b.onclick=()=>{const hit=hits[Number(b.dataset.searchIndex)];box.classList.remove("open");hit.el.classList.add("jp-settings-search-hit");hit.el.scrollIntoView({behavior:"smooth",block:"center"});setTimeout(()=>hit.el.classList.remove("jp-settings-search-hit"),2200);});
    });
  }
  function previewFile(file){
    if(!file)return;const r=new FileReader();r.onload=()=>showImportPreview(String(r.result||""),file);r.readAsText(file);
  }
  function previewPasted(){showImportPreview($("#legacyPasteData")?.value||"",null);}
  function showImportPreview(text,file){
    const host=$("#jpImportPreview");if(!host)return;
    const lines=String(text||"").replace(/\r/g,"").split("\n").filter(x=>x.trim());
    if(lines.length<2){host.innerHTML='<div class="jp-import-invalid">No valid records found.</div>';return;}
    const headers=lines[0].split(",").map(x=>x.trim());const sample=lines.slice(1,4);
    host.innerHTML='<div class="jp-import-preview-card"><div><b>'+Math.max(0,lines.length-1)+' records ready for validation</b><small>'+esc(headers.join(" · "))+'</small></div><div class="jp-import-sample">'+sample.map(x=>'<code>'+esc(x.slice(0,180))+'</code>').join("")+'</div><button class="btn btn-primary" id="jpConfirmImport">Import Validated Records</button></div>';
    $("#jpConfirmImport").onclick=async()=>{
      try{
        if(file){
          await window.app.handleLegacyCSVImport({target:{files:[file],value:""}});
        }else await window.app.importPastedSheetData();
        const result="Import completed "+new Date().toLocaleString("en-PH");localStorage.setItem("JUAN_LAST_IMPORT_RESULT",result);updateDataMeta();host.innerHTML='<div class="jp-import-valid">Import completed. Review Projects and Clients before continuing.</div>';
      }catch(e){host.innerHTML='<div class="jp-import-invalid">'+esc(e.message||"Import failed")+'</div>';}
    };
  }
  function downloadTemplate(){
    const text="project_id,project_name,project_type,client_id,client_email,amount_due,amount_received,start_date,due_date,payment_status,pending_amount\n";
    const a=document.createElement("a"),u=URL.createObjectURL(new Blob([text],{type:"text/csv"}));a.href=u;a.download="JUAN_PROJECT_IMPORT_TEMPLATE.csv";a.click();setTimeout(()=>URL.revokeObjectURL(u),500);
  }
  function exportCsv(kind){
    const st=window.app.getWorkspaceState();let rows=[],name="";
    if(kind==="projects"){name="JUAN_PROJECT_PROJECTS.csv";rows=[["Project ID","Project Name","Client","Email","Total","Start Date","Due Date"],...(st.projects||[]).filter(x=>!x.deleted).map(p=>[p.project_code,p.title,p.client_name,p.client_email,p.total_amount,p.start_date,p.deadline_date])];}
    else if(kind==="clients"){name="JUAN_PROJECT_CLIENTS.csv";rows=[["Client ID","Name","Email","Phone","Address"],...(st.clients||[]).filter(x=>!x.archived_at).map(c=>[c.client_code,c.name,c.email,c.phone,c.address])];}
    else{name="JUAN_PROJECT_FINANCE.csv";rows=[["Project ID","Project Name","Total","Paid","Balance"],...(st.projects||[]).filter(x=>!x.deleted).map(p=>{const paid=(p.payments||[]).filter(x=>!x.deleted_at).reduce((s,x)=>s+Number(x.amount_paid||0),0);return[p.project_code,p.title,p.total_amount,paid,Math.max(0,Number(p.total_amount||0)-paid)];})];}
    const csv=rows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\n"),a=document.createElement("a"),u=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),500);
  }
  function changePasswordDialog(){
    modalPrompt("Change Password","Enter a new password with at least 8 characters.","New password","Update Password",async value=>{
      if(value.length<8)throw new Error("Password must be at least 8 characters.");
      const db=window.app.getDatabaseClient();if(!db)throw new Error("Database is not connected.");
      const r=await db.auth.updateUser({password:value});if(r.error)throw r.error;toast("Password updated.");
    },"password");
  }
  function modalPrompt(title,message,placeholder,button,onSubmit,type="text"){
    const layer=document.createElement("div");layer.className="jp-settings-modal-layer";
    layer.innerHTML='<section class="jp-settings-modal"><button class="jp-settings-modal-x">×</button><h3>'+esc(title)+'</h3><p>'+esc(message)+'</p><input class="form-control" type="'+type+'" placeholder="'+esc(placeholder)+'"><div class="jp-settings-modal-actions"><button class="btn btn-secondary" data-cancel>Cancel</button><button class="btn btn-primary" data-ok>'+esc(button)+'</button></div><div class="jp-settings-modal-error"></div></section>';
    document.body.appendChild(layer);const input=$("input",layer);input.focus();
    const close=()=>layer.remove();$(".jp-settings-modal-x",layer).onclick=close;$("[data-cancel]",layer).onclick=close;
    $("[data-ok]",layer).onclick=async()=>{try{await onSubmit(input.value);close();}catch(e){$(".jp-settings-modal-error",layer).textContent=e.message||String(e);}};
    layer.addEventListener("keydown",e=>{if(e.key==="Escape")close();if(e.key==="Enter"){e.preventDefault();$("[data-ok]",layer).click();}});
  }
  function dangerConfirm(phrase,message,action){
    modalPrompt("Confirm destructive action",message+' Type "'+phrase+'" to continue.',phrase,"Continue",async value=>{if(value.trim()!==phrase)throw new Error("Confirmation phrase does not match.");await action();});
  }
  function runDanger(kind){
    if(kind==="reset")return dangerConfirm("RESET WORKSPACE","This begins the protected Workspace reset flow.",()=>window.app.openResetDataModal());
    if(kind==="cache")return dangerConfirm("CLEAR CACHE","Browser-only drafts and interface caches will be removed.",()=>new Promise(resolve=>window.app.requestDestructivePin("Clear Cached Data","Clear browser-only Workspace drafts and caches?",()=>{Object.keys(localStorage).filter(k=>k.startsWith("JUAN_")&&(k.includes("DRAFT")||k.includes("CACHE"))).forEach(k=>localStorage.removeItem(k));toast("Cached Workspace data cleared.");resolve();})));
    if(kind==="disconnect")return dangerConfirm("DISCONNECT DATABASE","The live Supabase session will be disconnected.",()=>new Promise(resolve=>window.app.requestDestructivePin("Disconnect Database","Disconnect this Workspace from Supabase?",async()=>{await window.app.disconnectDatabase();resolve();})));
    if(kind==="signout")return dangerConfirm("SIGN OUT","Your current Workspace session will end.",()=>new Promise(resolve=>window.app.requestDestructivePin("Sign Out","Sign out of JUAN PROJECT Workspace?",async()=>{await window.app.disconnectDatabase();resolve();})));
    if(kind==="historical")return dangerConfirm("DELETE HISTORICAL","Imported historical project records will be removed. The canonical preload reference remains.",()=>new Promise(resolve=>window.app.requestDestructivePin("Delete Imported Historical Records","Delete imported historical project rows from the active Workspace?",async()=>{await deleteHistorical();resolve();})));
  }
  async function deleteHistorical(){
    const db=window.app.getDatabaseClient();if(!db)throw new Error("Database is not connected.");
    const q=await db.from("projects").select("id").eq("pricing_version","legacy");if(q.error)throw q.error;
    const ids=(q.data||[]).map(x=>x.id);if(!ids.length){toast("No imported historical records found.");return;}
    for(const table of ["deliverables","project_items","payments"]){const r=await db.from(table).delete().in("project_id",ids);if(r.error)throw r.error;}
    const p=await db.from("projects").delete().in("id",ids);if(p.error)throw p.error;toast(ids.length+" imported historical projects deleted.");await window.app.refreshSharedTest();
  }

  async function saveProjectFilesSilent(projectId){
    const st=window.app.getWorkspaceState(),proj=(st.projects||[]).find(p=>String(p.id)===String(projectId)),db=window.app.getDatabaseClient();if(!proj||!db)return;
    const url=$("#projectFilesDriveUrl")?.value.trim()||"",unlock=$("#projectFilesUnlockAt")?.value||"",expires=$("#projectFilesExpiresAt")?.value||"";
    if(url&&!/^https:\/\/(drive|docs)\.google\.com\//i.test(url))return;
    const unlockIso=unlock?new Date(unlock).toISOString():null,expiresIso=expires?new Date(expires).toISOString():null;
    if(unlockIso&&expiresIso&&new Date(expiresIso)<=new Date(unlockIso))return;
    const updated_at=new Date().toISOString();
    const r=await db.from("projects").update({drive_url:url||null,drive_unlock_at:unlockIso,drive_expires_at:expiresIso,updated_at}).eq("id",proj.id).select("id").single();
    if(r.error)throw r.error;proj.drive_url=url||null;proj.drive_unlock_at=unlockIso;proj.drive_expires_at=expiresIso;proj.updated_at=updated_at;
  }
  async function saveProjectNotesSilent(projectId){
    const st=window.app.getWorkspaceState(),proj=(st.projects||[]).find(p=>String(p.id)===String(projectId)),db=window.app.getDatabaseClient(),field=$("#projectNotesTextarea");if(!proj||!db||!field)return;
    const notes=field.value.trim(),updated_at=new Date().toISOString();const r=await db.from("projects").update({notes,updated_at}).eq("id",proj.id).select("id").single();if(r.error)throw r.error;proj.notes=notes;proj.updated_at=updated_at;
  }
  function bindProjectDrafts(){
    document.addEventListener("input",e=>{
      const el=e.target;if(!(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement||el instanceof HTMLSelectElement)||!el.id)return;
      const view=el.closest(".view");if(!view)return;
      const st=window.app?.getWorkspaceState?.();
      let scope=view.id;
      if(view.id==="view-project-details"&&st?.activeProjectId)scope+=":"+st.activeProjectId;
      if(view.id==="view-client-profile"&&st?.activeClientId)scope+=":"+st.activeClientId;
      const drafts=readDrafts();drafts[scope]??={};drafts[scope][el.id]={value:el.type==="checkbox"?el.checked:el.value,at:Date.now()};localStorage.setItem(FORM_DRAFT_KEY,JSON.stringify(drafts));
      if(view.id==="view-project-details"&&st?.activeProjectId){
        if(el.id.startsWith("projectData"))debounce("project:"+st.activeProjectId,()=>window.app.saveProjectData({silent:true}),700);
        if(["projectFilesDriveUrl","projectFilesUnlockAt","projectFilesExpiresAt"].includes(el.id))debounce("files:"+st.activeProjectId,()=>saveProjectFilesSilent(st.activeProjectId),800);
        if(el.id==="projectNotesTextarea")debounce("notes:"+st.activeProjectId,()=>saveProjectNotesSilent(st.activeProjectId),800);
      }
    },true);
    window.addEventListener("focus",restoreActiveDrafts);
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")restoreActiveDrafts();});
  }
  function readDrafts(){try{return JSON.parse(localStorage.getItem(FORM_DRAFT_KEY)||"{}");}catch(_){return {};}}
  function restoreActiveDrafts(){
    const view=$(".view.active");if(!view)return;const st=window.app?.getWorkspaceState?.();let scope=view.id;
    if(view.id==="view-project-details"&&st?.activeProjectId)scope+=":"+st.activeProjectId;
    if(view.id==="view-client-profile"&&st?.activeClientId)scope+=":"+st.activeClientId;
    const d=readDrafts()[scope]||{};Object.entries(d).forEach(([id,row])=>{if(Date.now()-Number(row.at||0)>86400000)return;const el=document.getElementById(id);if(!el||document.activeElement===el)return;if(el.type==="checkbox")el.checked=!!row.value;else if(String(el.value||"")==="")el.value=row.value??"";});
  }

  function fixClientProfileGuard(){
    const original=window.app.openClientProfile?.bind(window.app);if(!original||original.__jpSafe)return;
    const safe=function(id){
      try{original(id);}catch(e){console.warn("Client profile render recovered:",e);}
      requestAnimationFrame(()=>{try{window.JPGeneral?.renderEditableClient?.();}catch(e){console.warn(e);}});
    };safe.__jpSafe=true;window.app.openClientProfile=safe;
  }
  function removeProjectSaveButtons(){
    $("#saveProjectDataBtn")?.remove();
    const fileBtn=$("#projectFilesSaveBtn");if(fileBtn){fileBtn.textContent="Saved automatically";fileBtn.disabled=true;fileBtn.classList.add("jp-autosave-placeholder");}
  }
  function portalPolish(){
    const table=$("#onlinePortalActivityPanel table");if(table)table.classList.add("jp-portal-activity-table");
  }
  function overviewPolish(){
    $$("#overviewCurrentProjects > *").forEach((x,i)=>x.classList.toggle("jp-overview-extra",i>=4));
  }

  function install(){
    cleanRootText();applyInterfacePrefs();buildSettings();bindProjectDrafts();fixClientProfileGuard();portalPolish();removeProjectSaveButtons();overviewPolish();
    const originalNav=window.app.navigateTo.bind(window.app);
    window.app.navigateTo=function(view){
      const r=originalNav(view);
      requestAnimationFrame(()=>{cleanRootText();if(view==="settings"){if(!settingsBuilt)buildSettings();}if(view==="client-profile")fixClientProfileGuard();if(view==="online-portal")portalPolish();if(view==="project-details")removeProjectSaveButtons();if(view==="my-works")overviewPolish();restoreActiveDrafts();});
      return r;
    };
    document.addEventListener("keydown",e=>{
      const mod=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent)?e.metaKey:e.ctrlKey;
      if(mod&&e.key.toLowerCase()==="s"){
        const active=$(".view.active");if(active?.id==="view-project-details"){e.preventDefault();const st=window.app.getWorkspaceState();Promise.allSettled([window.app.saveProjectData({silent:false}),saveProjectFilesSilent(st.activeProjectId),saveProjectNotesSilent(st.activeProjectId)]);}
      }
    },true);
    new MutationObserver(()=>{cleanRootText();portalPolish();overviewPolish();}).observe(document.body,{childList:true,subtree:true});
  }
  later(install);
})();
