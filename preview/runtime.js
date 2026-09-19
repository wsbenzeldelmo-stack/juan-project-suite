/* Injected only by the loopback test server; never loaded in production. */
(()=>{
 const cfg=window.JUAN_TEST_CONFIG;
 const key='JUAN_TEST_CLIENT';
 const search=new URLSearchParams(location.search); if(search.has('client')&&!search.has('preview'))localStorage.setItem(key,search.get('client'));
 const nativeFetch=window.fetch.bind(window);window.fetch=(input,options={})=>{const headers=new Headers(options.headers||{});if(search.has('preview'))headers.set('X-Juan-Preview','1');return nativeFetch(input,{...options,headers})};
 const session=()=>{const id=cfg.app==='workspace'?'admin':search.has('preview')?search.get('client'):localStorage.getItem(key);return id?{user:{id,email:'test@localhost'},access_token:'test:'+id,refresh_token:'test'}:null};
 async function request(path,body,options={}){const r=await fetch(path,{method:body?'POST':'GET',...options,headers:{Authorization:'Bearer '+(session()?.access_token||''),'Content-Type':'application/json',...options.headers},body:body?JSON.stringify(body):undefined});const j=await r.json();if(!r.ok)throw Error(j.error||'Request failed');return j;}
 class Query{
  constructor(table){this.q={table,op:'select',filters:[],orders:[]};}
  select(columns='*'){this.q.columns=columns;return this;}
  insert(values){this.q.op='insert';this.q.values=values;return this;}
  upsert(values,opts={}){this.q.op='upsert';this.q.values=values;this.q.conflict=opts.onConflict||'id';return this;}
  update(values){this.q.op='update';this.q.values=values;return this;}
  delete(){this.q.op='delete';return this;}
  eq(k,v){this.q.filters.push(['eq',k,v]);return this;}
  neq(k,v){this.q.filters.push(['neq',k,v]);return this;}
  is(k,v){this.q.filters.push(['is',k,v]);return this;}
  in(k,v){this.q.filters.push(['in',k,v]);return this;}
  ilike(k,v){this.q.filters.push(['ilike',k,v]);return this;}
  gte(k,v){this.q.filters.push(['gte',k,v]);return this;}
  lte(k,v){this.q.filters.push(['lte',k,v]);return this;}
  not(k,op,v){this.q.filters.push(['not',k,v]);return this;}
  order(k,o={}){this.q.orders.push([k,o.ascending!==false]);return this;}
  limit(n){this.q.limit=n;return this;}
  single(){this.q.single='single';return this;}
  maybeSingle(){this.q.single='maybe';return this;}
  then(resolve,reject){return request('/test/query',this.q).catch(e=>({data:null,error:{message:e.message}})).then(resolve,reject);}
 }
 const channels=new Set();let lastRev=null;
 const client={from:t=>new Query(t),rpc:(name,args)=>request('/test/rpc',{name,args}),auth:{getSession:async()=>({data:{session:session()}}),getUser:async()=>({data:{user:session()?.user}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>{localStorage.removeItem(key)},setSession:async()=>({data:{session:session()}}),updateUser:async()=>({data:{user:session()?.user}})},storage:{from:()=>({upload:async(path,file)=>{const r=await fetch('/test/upload?path='+encodeURIComponent(path),{method:'POST',headers:{Authorization:'Bearer '+(session()?.access_token||'')},body:file});const j=await r.json();if(!r.ok)return {error:{message:j.error}};window.JuanTest.uploadedPaths[path]=j.data.path;return j;},createSignedUrl:async path=>({data:{signedUrl:'/test/uploads/'+encodeURIComponent(window.JuanTest.uploadedPaths[path]||path.split('/').pop())}}),getPublicUrl:path=>({data:{publicUrl:'/test/uploads/'+encodeURIComponent(path)}})})},channel:()=>{const c={callbacks:[],on(event,filter,fn){this.callbacks.push(fn);return this},subscribe(fn){channels.add(this);fn?.('SUBSCRIBED');return this}};return c},removeChannel:async c=>channels.delete(c)};
 window.JuanTest={client,session,request,uploadedPaths:{},cfg,preview:search.has('preview')};
 window.supabase={createClient:()=>client};
 setInterval(async()=>{try{const {revision}=await request('/test/revision');if(lastRev!==null&&revision!==lastRev){for(const c of channels)for(const fn of c.callbacks)fn({new:{entity:'catalog_shared',updated_at:new Date().toISOString()}});window.dispatchEvent(new Event('juan-shared-change'));}lastRev=revision;}catch{}},1500);
 navigator.serviceWorker?.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()));
})();
