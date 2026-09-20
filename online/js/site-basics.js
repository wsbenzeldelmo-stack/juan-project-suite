/* JUAN PROJECT Online — privacy, footer and lightweight site essentials */
(function(){
  "use strict";
  const CONSENT_KEY="JUAN_PRIVACY_CONSENT_V1";
  function addFooter(){
    const page=document.querySelector("main.page");if(!page||page.querySelector(".jp-site-footer"))return;
    const footer=document.createElement("footer");footer.className="jp-site-footer";
    footer.innerHTML='<nav><a href="/terms">Terms of Service</a><a href="/privacy">Privacy Policy</a></nav><div>© 2026 JUAN PROJECT · Creative Services for a Brighter Tomorrow.</div>';
    page.appendChild(footer);
  }
  function accountActions(){
    const state=window.JPOAppState;if(!state||state.route!=="account"||!state.portal)return;
    const card=document.querySelector(".membership-card");if(!card||document.querySelector(".jp-account-card-actions"))return;
    const row=document.createElement("div");row.className="jp-account-card-actions";
    row.innerHTML='<label>Change Photo<input id="jpExternalPhotoInput" type="file" accept="image/jpeg,image/png,image/webp" hidden></label><button id="jpExternalClientQr">Show Client QR</button>';
    card.insertAdjacentElement("afterend",row);
    row.querySelector("label").onclick=function(){setTimeout(function(){document.getElementById("profilePhotoInput")?.click();},0);};
    row.querySelector("#jpExternalClientQr").onclick=function(){window.JuanSuite?.card?.();};
  }
  function consent(){
    if(localStorage.getItem(CONSENT_KEY))return;
    const el=document.createElement("aside");el.className="jp-cookie-banner";el.setAttribute("role","dialog");el.setAttribute("aria-label","Privacy preferences");
    el.innerHTML='<strong>Privacy & device storage</strong><p>JUAN PROJECT Online uses essential device storage for sign-in, cart, order tracking, popup frequency, and preferences. Optional anonymous promotion analytics help measure in-house ads.</p><div><button class="jp-cookie-secondary" id="jpEssentialOnly">Essential Only</button><button class="jp-cookie-primary" id="jpAcceptPrivacy">Accept</button></div>';
    document.body.appendChild(el);
    document.getElementById("jpEssentialOnly").onclick=function(){localStorage.setItem(CONSENT_KEY,"essential");el.remove();};
    document.getElementById("jpAcceptPrivacy").onclick=function(){localStorage.setItem(CONSENT_KEY,"all");el.remove();};
  }
  function enhance(){
    addFooter();accountActions();consent();
    document.querySelectorAll("img:not([alt])").forEach(function(img){img.alt="JUAN PROJECT visual";});
  }
  window.addEventListener("juan-online-render",enhance);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(enhance,250);});else setTimeout(enhance,250);
})();