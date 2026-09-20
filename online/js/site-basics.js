/* JUAN PROJECT Online — privacy, route-aware footer and lightweight site essentials */
(function(){
  "use strict";
  const CONSENT_KEY="JUAN_PRIVACY_CONSENT_V1";
  function syncFooter(){
    document.querySelectorAll(".jp-site-footer").forEach(function(x){x.remove();});
    const state=window.JPOAppState;
    if(!state||state.route!=="home"||state.portal?.profile)return;
    const page=document.querySelector("main.page");if(!page)return;
    const footer=document.createElement("footer");footer.className="jp-site-footer jp-home-only-footer";
    footer.innerHTML='<nav><a href="/terms">Terms of Service</a><a href="/privacy">Privacy Policy</a></nav><div>© 2026 JUAN PROJECT · Creative Services for a Brighter Tomorrow.</div>';
    page.appendChild(footer);
  }
  function consent(){
    if(localStorage.getItem(CONSENT_KEY))return;
    const el=document.createElement("aside");el.className="jp-cookie-banner";el.setAttribute("role","dialog");el.setAttribute("aria-label","Privacy preferences");
    el.innerHTML='<strong>Privacy & device storage</strong><p>JUAN PROJECT Online uses essential device storage for sign-in, cart, order tracking, popup frequency, and preferences. Optional anonymous promotion analytics help measure in-house ads.</p><div><button class="jp-cookie-secondary" id="jpEssentialOnly">Essential Only</button><button class="jp-cookie-primary" id="jpAcceptPrivacy">Accept</button></div>';
    document.body.appendChild(el);
    document.getElementById("jpEssentialOnly").onclick=function(){localStorage.setItem(CONSENT_KEY,"essential");el.remove();};
    document.getElementById("jpAcceptPrivacy").onclick=function(){localStorage.setItem(CONSENT_KEY,"all");el.remove();};
  }
  function enhance(){syncFooter();consent();document.querySelectorAll("img:not([alt])").forEach(function(img){img.alt="JUAN PROJECT visual";});}
  window.addEventListener("juan-online-render",enhance);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(enhance,250);});else setTimeout(enhance,250);
})();