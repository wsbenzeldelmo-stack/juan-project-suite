const CACHE='juan-workspace-v1.3.3.2-direct-supabase-v138';
const SHELL=['/','/index.html','/css/v1-2-ux.css','/css/v1-3-ux.css','/js/v1-2-ux.js','/js/v1-3-ux.js','/assets/brand/j-mark.svg','/assets/brand/juan-project.svg','/assets/brand/juan-project-workspace-master.png','/assets/icon-192.png','/assets/payment-institutions/bdo.png','/assets/payment-institutions/bpi.png','/assets/payment-institutions/gcash.png','/assets/payment-institutions/gotyme.png','/assets/payment-institutions/landbank.png','/assets/payment-institutions/maribank.png','/assets/payment-institutions/maya.png','/assets/payment-institutions/metrobank.png','/assets/payment-institutions/pnb.png','/assets/payment-institutions/unionbank.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.startsWith('/api/')){event.respondWith(fetch(req));return;}
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put('/index.html',copy));return r}).catch(()=>caches.match('/index.html')));return;
  }
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return r;})));
});
