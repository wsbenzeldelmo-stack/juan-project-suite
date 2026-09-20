/* JUAN PROJECT Online — resilient in-house ads runtime */
(function(){
  "use strict";
  var VISITOR_KEY="JUAN_VISITOR_ID_V1",SESSION_KEY="JUAN_AD_SESSION_V1",POPUP_SESSION_KEY="JUAN_POPUP_SHOWN_SESSION";
  var data=null,bannerIndex=0,timer=null,impressed=new Set(),loadedAudience=null;
  function audienceMode(){return window.JuanSuiteRuntime.session()?.user?.id?"client":"guest";}
  function adContext(){var route=window.JPOAppState?.route||"home",aud=audienceMode();if(route==="shop")return aud+"_shop";return aud+"_home";}
  function placementMatches(ad,type){var p=String(ad.placement||"");var ctx=adContext();if(p==="homepage_"+type)return ctx==="guest_home"||ctx==="client_home";return p===ctx+"_"+type;}
  function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);}
  function visitor(){var v=localStorage.getItem(VISITOR_KEY);if(!v){v=uid();localStorage.setItem(VISITOR_KEY,v);}return v;}
  function session(){var s=sessionStorage.getItem(SESSION_KEY);if(!s){s=uid();sessionStorage.setItem(SESSION_KEY,s);}return s;}
  async function api(body){return window.JuanSuiteRuntime.request("/api/suite",body);}
  function event(ad,type,stable){
    try{
      var logged=window.JuanSuiteRuntime.session()?.user?.id||null;
      if(!logged&&localStorage.getItem("JUAN_PRIVACY_CONSENT_V1")!=="all")return;
      var viewer=logged||visitor(),key=stable?ad.id+":"+type+":"+viewer+":"+session():ad.id+":"+type+":"+viewer+":"+session()+":"+uid();
      api({action:"ad-event",ad_id:ad.id,visitor_id:logged?null:visitor(),session_id:session(),event_type:type,event_key:key}).catch(function(){});
    }catch(_){}
  }
  function destination(ad){
    var type=ad.destination_type||"no_action",value=ad.destination_value||"";
    if(type==="no_action")return;
    if(type==="external_url"&&/^https:\/\//i.test(value)){window.open(value,"_blank","noopener");return;}
    if(["shop","package","service"].includes(type)){var b=document.querySelector('.nav [data-r="shop"]');if(b)b.click();return;}
    if(["loyalty","referral"].includes(type)){var a=document.querySelector('.nav [data-r="account"]');if(a)a.click();return;}
    if(type==="page"){
      var page=String(value).replace(/^#?/,"").toLowerCase(),map={home:"home",orders:"orders",payment:"payment",shop:"shop",account:"account"};
      if(map[page])document.querySelector('.nav [data-r="'+map[page]+'"]')?.click();
    }
  }
  function bannerSlot(){
    var anchor=document.getElementById("jpAdBannerAnchor");if(!anchor)return null;
    var slot=document.getElementById("jpHouseBanner");if(slot&&slot.isConnected)return slot;
    slot=document.createElement("div");slot.id="jpHouseBanner";slot.className="jp-house-banner";anchor.replaceChildren(slot);return slot;
  }
  function showBanner(ad){
    var slot=bannerSlot();if(!slot)return;slot.classList.remove("visible");setTimeout(function(){
      slot.innerHTML='<button class="jp-banner-click" aria-label="'+String(ad.title||"Promotion").replace(/"/g,"&quot;")+'"><img src="'+String(ad.image||"").replace(/"/g,"&quot;")+'" alt="'+String(ad.image_alt||ad.title||"JUAN PROJECT promotion").replace(/"/g,"&quot;")+'"></button>';
      var img=slot.querySelector("img");img.onerror=function(){slot.innerHTML="";slot.classList.remove("visible");};slot.querySelector("button").onclick=function(){event(ad,"click",false);destination(ad);};
      requestAnimationFrame(function(){slot.classList.add("visible");});
      if(!impressed.has(ad.id)){impressed.add(ad.id);event(ad,"impression",true);}
    },80);
  }
  function resetRotation(banners){
    if(timer)clearInterval(timer);timer=null;if(banners.length<2)return;
    var seconds=Math.max(3,Number(data?.settings?.rotation_seconds||8));
    timer=setInterval(function(){bannerIndex=(bannerIndex+1)%banners.length;showBanner(banners[bannerIndex]);},seconds*1000);
  }
  function mountBanners(){
    if(!data)return;var banners=(data.ads||[]).filter(function(a){return a.ad_type==="banner"&&placementMatches(a,"banner")&&a.image;});if(!banners.length){if(timer)clearInterval(timer);timer=null;document.getElementById("jpHouseBanner")?.remove();return;}
    if(bannerIndex>=banners.length)bannerIndex=0;showBanner(banners[bannerIndex]);resetRotation(banners);
    var slot=bannerSlot();if(slot){["pointerenter","touchstart","focusin"].forEach(function(n){slot.addEventListener(n,function(){if(timer)clearInterval(timer);timer=null;},{passive:true});});["pointerleave","touchend","focusout"].forEach(function(n){slot.addEventListener(n,function(){resetRotation(banners);},{passive:true});});}
  }
  function popup(){
    if(!data)return;var popupKey=POPUP_SESSION_KEY+"_"+adContext();if(sessionStorage.getItem(popupKey))return;
    var ads=(data.ads||[]).filter(function(a){return a.ad_type==="popup"&&placementMatches(a,"popup")&&a.image&&!localStorage.getItem("JUAN_AD_SEEN_"+a.id);}).sort(function(a,b){return Number(b.priority||0)-Number(a.priority||0);});
    var ad=ads[0];if(!ad)return;sessionStorage.setItem(popupKey,"1");localStorage.setItem("JUAN_AD_SEEN_"+ad.id,"1");
    var layer=document.createElement("div");layer.className="jp-popup-ad-overlay";layer.innerHTML='<section class="jp-popup-ad" role="dialog" aria-modal="true" aria-label="'+String(ad.title||"Promotion").replace(/"/g,"&quot;")+'"><button class="jp-popup-close" aria-label="Close promotion">×</button><button class="jp-popup-image"><img src="'+String(ad.image).replace(/"/g,"&quot;")+'" alt="'+String(ad.image_alt||ad.title||"JUAN PROJECT promotion").replace(/"/g,"&quot;")+'"></button></section>';document.body.appendChild(layer);
    var close=function(){event(ad,"dismiss",false);layer.remove();};layer.querySelector(".jp-popup-close").onclick=close;layer.addEventListener("click",function(e){if(e.target===layer)close();});layer.querySelector(".jp-popup-image").onclick=function(){event(ad,"click",false);destination(ad);layer.remove();};layer.querySelector("img").onerror=function(){layer.remove();};event(ad,"impression",true);
  }
  function render(){try{mountBanners();popup();}catch(_){}}
  async function load(){try{data=await api({action:"ads"});loadedAudience=audienceMode();render();}catch(e){console.warn("In-house ads unavailable:",e?.message||e);}}
  window.addEventListener("juan-online-render",function(){if(loadedAudience!==audienceMode())load();else if(data)render();});
  document.addEventListener("visibilitychange",function(){if(document.hidden&&timer){clearInterval(timer);timer=null;}else if(!document.hidden&&data)mountBanners();});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(load,300);});else setTimeout(load,300);
})();