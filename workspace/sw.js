// JUAN PROJECT Workspace offline cache — 20260920-1805
const CACHE='juan-workspace-v1.8-settings-release';
const SHELL=["/","/index.html","/css/v1-2-ux.css","/css/v1-3-ux.css","/js/v1-2-ux.js","/js/v1-3-ux.js","/css/suite.css","/css/redesign-2026-09-20.css","/js/suite-prod.js","/js/workspace-redesign.js","/js/jsQR.js","/assets/brand/j-mark.svg","/assets/brand/juan-project.svg","/assets/brand/juan-project-workspace-master.png","/assets/icon-192.png","/assets/payment-institutions/bdo.png","/assets/payment-institutions/bpi.png","/assets/payment-institutions/gcash.png","/assets/payment-institutions/gotyme.png","/assets/payment-institutions/landbank.png","/assets/payment-institutions/maribank.png","/assets/payment-institutions/maya.png","/assets/payment-institutions/metrobank.png","/assets/payment-institutions/pnb.png","/assets/payment-institutions/unionbank.png","/css/general-update.css","/css/keyboard-shortcuts.css","/js/general-update.js","/js/keyboard-shortcuts.js","/css/consistency-pass.css","/js/consistency-pass.js"];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(SHELL))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

async function networkFirst(req){
  const cache=await caches.open(CACHE);
  try{
    const response=await fetch(req,{cache:'no-store'});
    if(response&&response.ok)await cache.put(req,response.clone());
    return response;
  }catch(error){
    const cached=await caches.match(req);
    if(cached)return cached;
    throw error;
  }
}

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;

  if(url.pathname.startsWith('/api/')){
    event.respondWith(fetch(req));
    return;
  }

  // App navigation and frequently updated JS/CSS must prefer the latest deployment.
  if(req.mode==='navigate'||url.pathname.endsWith('.js')||url.pathname.endsWith('.css')||url.pathname==='/sw.js'){
    event.respondWith(networkFirst(req));
    return;
  }

  // Immutable/static visual assets remain cache-first for offline performance.
  event.respondWith(
    caches.match(req).then(cached=>cached||fetch(req).then(async response=>{
      if(response&&response.ok){
        const cache=await caches.open(CACHE);
        await cache.put(req,response.clone());
      }
      return response;
    }))
  );
});
