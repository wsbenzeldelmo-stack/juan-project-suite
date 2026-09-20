import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { bearer, requireAdmin, serviceClient, enforceRateLimit, assertSafePost, sendError } from './_lib.js';

const STAGES=['Order Confirmed','Payment Confirmed','Production Started','In Production','Quality Check','Ready for Delivery','Completed'];
const now=()=>new Date().toISOString();
const today=()=>new Date().toISOString().slice(0,10);
const hash=v=>createHash('sha256').update(String(v||'')).digest('hex');
const token=()=>randomBytes(32).toString('base64url');
const guestTokenForKey=key=>{const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;if(!secret)throw new Error('Server Supabase credentials are not configured.');return createHmac('sha256',secret).update('juan-guest-order:'+String(key)).digest('base64url')};
const money=v=>{const n=Number(v||0);if(!Number.isFinite(n)||n<0)throw Object.assign(new Error('Enter a valid non-negative amount.'),{status:400});return Math.round(n*100)/100};
const bodyOf=req=>typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};

async function optionalUser(req,svc){
  const t=bearer(req); if(!t)return null;
  const {data,error}=await svc.auth.getUser(t);
  return error?null:(data?.user||null);
}
async function clientContext(req,svc){
  const user=await optionalUser(req,svc); if(!user)fail('Client login required.',401);
  const {data:account,error}=await svc.from('portal_accounts').select('*').eq('auth_user_id',user.id).maybeSingle();
  if(error)throw error;
  if(!account||account.portal_enabled===false)fail('JUAN PROJECT client access is unavailable for this account.',403);
  return {user,account};
}
async function audit(svc,title,entity='',actorUserId=null){
  await svc.from('portal_activity').insert({title,entity:entity||null,actor_user_id:actorUserId||null});
}
const safeOrder=o=>({
  id:o.id,code:o.code,name:o.name,email:o.email,phone:o.phone,title:o.title,notes:o.notes,
  items:Array.isArray(o.items)?o.items:[],subtotal:Number(o.subtotal||0),discount_amount:Number(o.discount_amount||0),rush_fee:Number(o.rush_fee||0),
  total:Number(o.total||0),deadline:o.deadline,created_at:o.created_at,status:o.status,
  review_note:o.review_note||'',revised_at:o.revised_at||null,client_accepted_at:o.client_accepted_at||null,approved_at:o.approved_at||null,
  terms_version:o.terms_version||null,terms_accepted_at:o.terms_accepted_at||null,archived_at:o.archived_at||null,converted_at:o.converted_at||null,
  project_code:o.project_code||null,project_id:o.project_id||null,client_id:o.client_id||null
});
async function orderView(svc,o){
  const view=safeOrder(o);
  if(o?.project_id){
    const {data:p,error}=await svc.from('projects').select('project_code').eq('id',o.project_id).maybeSingle();
    if(error)throw error;
    if(p?.project_code)view.project_code=p.project_code;
  }
  return view;
}
async function orderByToken(svc,t){
  if(!t)fail('Tracking token is required.');
  const {data,error}=await svc.from('incoming_orders').select('*').eq('token_hash',hash(t)).maybeSingle();
  if(error)throw error;if(!data)fail('Tracking link is invalid or has been revoked.',404);return data;
}
async function packageInclusions(svc,packageIds){
  if(!packageIds.length)return new Map();
  const {data:rows,error}=await svc.from('catalog_package_items').select('package_id,item_name,sort_order,service_id').in('package_id',packageIds).order('sort_order');
  if(error)throw error;
  const serviceIds=[...new Set((rows||[]).map(x=>x.service_id).filter(Boolean))];
  const names=new Map();
  if(serviceIds.length){
    const {data:services,error:se}=await svc.from('catalog_services').select('id,name').in('id',serviceIds);
    if(se)throw se;(services||[]).forEach(s=>names.set(String(s.id),s.name));
  }
  const out=new Map();
  (rows||[]).forEach(r=>{const a=out.get(String(r.package_id))||[];a.push(names.get(String(r.service_id))||r.item_name||'Deliverable');out.set(String(r.package_id),a)});
  return out;
}
async function provisionClient(svc,client){
  const {data:byClient,error:clientAccountError}=await svc.from('portal_accounts').select('*').eq('client_id',client.id).maybeSingle();
  if(clientAccountError)throw clientAccountError;
  if(byClient)return byClient;
  const email=String(client.email||'').trim().toLowerCase();if(!email)return null;

  let user=null;
  const listed=await svc.auth.admin.listUsers({page:1,perPage:1000});
  if(listed.error)throw listed.error;
  user=(listed.data?.users||[]).find(u=>String(u.email||'').trim().toLowerCase()===email)||null;

  if(user){
    const {data:role,error:roleError}=await svc.from('user_roles').select('role').eq('auth_user_id',user.id).maybeSingle();
    if(roleError)throw roleError;
    if(role?.role==='admin')fail('This email is already used by the Workspace admin account. Use a different client email.',409);

    const {data:byAuth,error:authAccountError}=await svc.from('portal_accounts').select('*').eq('auth_user_id',user.id).maybeSingle();
    if(authAccountError)throw authAccountError;
    if(byAuth){
      if(String(byAuth.client_id)!==String(client.id)){
        fail('This login is already linked to another client profile. Resolve the duplicate client record first.',409);
      }
      return byAuth;
    }
  }else{
    const created=await svc.auth.admin.createUser({
      email,password:String(client.client_code||'JP-CLIENT'),email_confirm:true,
      user_metadata:{juan_client_id:client.id,must_change_password:true,juan_project_client:true}
    });
    if(created.error)throw created.error;user=created.data.user;
  }

  const inserted=await svc.from('portal_accounts').insert({
    auth_user_id:user.id,client_id:client.id,password_set:false,portal_enabled:true,updated_at:now()
  }).select('*').single();
  if(inserted.error){
    if(inserted.error.code==='23505'){
      const existing=await svc.from('portal_accounts').select('*').or(`auth_user_id.eq.${user.id},client_id.eq.${client.id}`).limit(1).maybeSingle();
      if(!existing.error&&existing.data)return existing.data;
    }
    throw inserted.error;
  }
  const {data:role}=await svc.from('user_roles').select('auth_user_id,role').eq('auth_user_id',user.id).maybeSingle();
  if(!role){const ins=await svc.from('user_roles').insert({auth_user_id:user.id,role:'client'});if(ins.error)throw ins.error}
  return inserted.data;
}
function nestDeliverables(rows){
  const byId=new Map((rows||[]).map(r=>[String(r.id),{...r,children:[]}]));
  const top=[];
  for(const r of byId.values()){
    if(r.parent_id&&byId.has(String(r.parent_id)))byId.get(String(r.parent_id)).children.push(r);
    else top.push(r);
  }
  top.forEach(p=>p.children.sort((a,b)=>Number(a.child_index||0)-Number(b.child_index||0)));
  return top;
}
async function dashboard(svc){
  const [io,cl,pr,del,ps,pa,inv,act,ads,cfg]=await Promise.all([
    svc.from('incoming_orders').select('*').order('created_at',{ascending:false}),
    svc.from('clients').select('*').order('created_at',{ascending:false}),
    svc.from('projects').select('*').order('created_at',{ascending:false}),
    svc.from('deliverables').select('*').order('created_at',{ascending:true}),
    svc.from('payment_submissions').select('*').order('submitted_at',{ascending:false}),
    svc.from('portal_accounts').select('*').order('created_at',{ascending:false}),
    svc.from('portal_invitations').select('*').order('created_at',{ascending:false}),
    svc.from('portal_activity').select('*').order('created_at',{ascending:false}).limit(100),
    svc.from('promotions').select('*').order('created_at',{ascending:false}),
    svc.from('suite_config').select('*').eq('id',1)
  ]);
  for(const x of [io,cl,pr,del,ps,pa,inv,act,ads,cfg])if(x.error)throw x.error;
  const dels=del.data||[];
  const projects=(pr.data||[]).map(p=>({...p,deliverables:nestDeliverables(dels.filter(d=>String(d.project_id)===String(p.id)))}));
  const promotions=(ads.data||[]).map(a=>({...a,start:a.start_date,end:a.end_date}));
  const activity=(act.data||[]).map(a=>({...a,at:a.created_at}));
  const paymentSubmissions=await Promise.all((ps.data||[]).map(async submission=>{
    let receipt_url=null;
    if(submission.receipt_path){
      const signed=await svc.storage.from('payment-receipts').createSignedUrl(submission.receipt_path,300);
      if(!signed.error)receipt_url=signed.data?.signedUrl||null;
    }
    return {...submission,receipt_url};
  }));
  return {incoming_orders:io.data||[],clients:cl.data||[],projects,payment_submissions:paymentSubmissions,portal_accounts:pa.data||[],invitations:inv.data||[],portal_activity:activity,promotions,suite_config:cfg.data||[]};
}
async function publicAds(req,svc){
  const user=await optionalUser(req,svc);
  let audience='guest',clientId=null;
  if(user){
    const {data}=await svc.from('portal_accounts').select('client_id').eq('auth_user_id',user.id).maybeSingle();
    if(data){audience='client';clientId=data.client_id}
  }
  const [adsRes,settingsRes]=await Promise.all([
    svc.from('promotions').select('*').neq('status','archived').order('priority',{ascending:false}).order('created_at',{ascending:false}),
    svc.from('ad_settings').select('*').eq('id',1).maybeSingle()
  ]);
  if(adsRes.error)throw adsRes.error;if(settingsRes.error)throw settingsRes.error;
  const instant=Date.now();
  const ads=(adsRes.data||[]).filter(a=>{
    if(a.enabled===false)return false;
    if(!['all',audience].includes(a.audience||'all'))return false;
    if(!['published','scheduled'].includes(String(a.status||'draft')))return false;
    const start=a.start_at?new Date(a.start_at).getTime():null,end=a.end_at?new Date(a.end_at).getTime():null;
    if(start&&start>instant)return false;
    if(!a.no_expiration&&end&&end<=instant)return false;
    return true;
  }).map(a=>({...a,effective_status:'published',start:a.start_at||a.start_date,end:a.end_at||a.end_date}));
  return {ads,settings:settingsRes.data||{rotation_seconds:8,transition:'fade'},client_id:clientId};
}
async function recordAdEvent(b,req,svc){
  const adId=String(b.ad_id||''),eventType=String(b.event_type||''),visitorId=String(b.visitor_id||'').slice(0,120),sessionId=String(b.session_id||'').slice(0,120);
  if(!adId||!['impression','click','dismiss'].includes(eventType)||!sessionId)fail('Invalid ad event.');
  const user=await optionalUser(req,svc);let clientId=null;
  if(user){const {data}=await svc.from('portal_accounts').select('client_id').eq('auth_user_id',user.id).maybeSingle();clientId=data?.client_id||null}
  if(!clientId&&!visitorId)fail('Visitor identifier required.');
  const eventKey=String(b.event_key||`${adId}:${eventType}:${clientId||visitorId}:${sessionId}`).slice(0,300);
  const {error}=await svc.from('ad_events').insert({ad_id:adId,client_id:clientId,visitor_id:clientId?null:visitorId,session_id:sessionId,event_type:eventType,event_key:eventKey});
  if(error&&error.code!=='23505')throw error;
  return {ok:true,duplicate:error?.code==='23505'};
}
async function submitOrder(b,svc){
  const name=String(b.name||'').trim(),email=String(b.email||'').trim().toLowerCase(),key=String(b.key||'').trim();
  if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!key)fail('Name and a valid email address are required.');
  if(b.termsAccepted!==true||String(b.termsVersion||'')!=='2026-09-20')fail('Please read and accept the current JUAN PROJECT Online Terms of Service.');
  if(name.length>160||email.length>254||String(b.notes||'').length>3000||String(b.title||'').length>160)fail('Please shorten the submitted details.');
  const {data:existing,error:ee}=await svc.from('incoming_orders').select('*').eq('submission_key',key).maybeSingle();if(ee)throw ee;
  if(existing)return {order:safeOrder(existing),token:guestTokenForKey(key),duplicate:true};
  const requested=Array.isArray(b.items)?b.items:[];if(!requested.length)fail('Choose at least one service or package.');
  const serviceIds=[],packageIds=[];
  requested.forEach(i=>{const kind=String(i.type||i.kind||'service').toLowerCase();(kind==='package'?packageIds:serviceIds).push(String(i.id))});
  const [sr,pk]=await Promise.all([
    serviceIds.length?svc.from('catalog_services').select('*').in('id',serviceIds):Promise.resolve({data:[],error:null}),
    packageIds.length?svc.from('catalog_packages').select('*').in('id',packageIds):Promise.resolve({data:[],error:null})
  ]);
  if(sr.error)throw sr.error;if(pk.error)throw pk.error;
  const services=new Map((sr.data||[]).map(x=>[String(x.id),x])),packages=new Map((pk.data||[]).map(x=>[String(x.id),x]));
  const inc=await packageInclusions(svc,packageIds);
  const items=requested.map(i=>{
    const kind=String(i.type||i.kind||'service').toLowerCase()==='package'?'package':'service';
    const p=(kind==='package'?packages:services).get(String(i.id));if(!p||p.active===false)fail('An item is no longer available. Refresh the shop.');
    const qty=Math.trunc(Number(i.qty||1));if(qty<1||qty>100)fail('Quantity must be between 1 and 100.');
    const price=money(kind==='package'?(p.new_price??p.original_price??0):p.price);
    return {id:randomUUID(),catalog_id:p.id,name:p.name,type:kind,price,qty,includedItems:kind==='package'?(inc.get(String(p.id))||[]):[]};
  });
  const title=String(b.title||'').trim()||items[0]?.name||'Order Request';
  const subtotal=Math.round(items.reduce((s,i)=>s+i.price*i.qty,0)*100)/100;
  const hasPackage=items.some(i=>i.type==='package'),standardDays=hasPackage?14:10;
  let rush=0;
  if(b.deadline){
    const deadline=new Date(String(b.deadline)+'T00:00:00');if(Number.isNaN(deadline.getTime()))fail('Invalid requested date.');
    const start=new Date(today()+'T00:00:00'),days=Math.round((deadline-start)/86400000);if(days<0)fail('Requested date cannot be in the past.');
    rush=Math.ceil(Math.max(0,standardDays-days)/4)*500;
  }
  const raw=guestTokenForKey(key),initialTotal=subtotal+rush;
  const acceptanceKey=hash(`${email}|${key}|2026-09-20`);
  const {data,error}=await svc.from('incoming_orders').insert({
    name,email,phone:String(b.phone||''),title,notes:String(b.notes||''),deadline:b.deadline||null,items,
    subtotal,discount_amount:0,rush_fee:rush,total:initialTotal,status:'Order Received',submission_key:key,token_hash:hash(raw),
    terms_version:'2026-09-20',terms_accepted_at:now(),terms_acceptance_key:acceptanceKey,
    original_snapshot:{items,subtotal,discount_amount:0,rush_fee:rush,total:initialTotal,deadline:b.deadline||null,title}
  }).select('*').single();
  if(error)throw error;await audit(svc,'Guest order received',data.code);return {order:safeOrder(data),token:raw};
}
async function convertOrder(id,svc,adminUser){
  const {data:o,error}=await svc.from('incoming_orders').select('*').eq('id',id).maybeSingle();if(error)throw error;if(!o)fail('Order not found.',404);
  if(o.project_id){
    const [c,p]=await Promise.all([svc.from('clients').select('*').eq('id',o.client_id).single(),svc.from('projects').select('*').eq('id',o.project_id).single()]);
    if(c.error)throw c.error;if(p.error)throw p.error;return {client:c.data,project:p.data};
  }
  let {data:client,error:ce}=await svc.from('clients').select('*').ilike('email',o.email).limit(1).maybeSingle();if(ce)throw ce;
  if(!client){
    const created=await svc.from('clients').insert({id:randomUUID(),name:o.name,email:o.email,phone:o.phone||null}).select('*').single();if(created.error)throw created.error;client=created.data;
  }
  const pId=randomUUID();
  const items=Array.isArray(o.items)?o.items:[];
  const hasPackage=items.some(i=>String(i.type||'').toLowerCase()==='package');
  const createdProject=await svc.from('projects').insert({
    id:pId,client_id:client.id,client_name:client.name,client_email:client.email,client_phone:client.phone,
    title:o.title,status:'In Progress',delivery_status:'Pending',priority:Number(o.rush_fee||0)>0,
    project_type:hasPackage?'PACKAGE':'SOLO',pricing_version:'v2',
    start_date:today(),deadline_date:o.deadline||null,subtotal_amount:o.subtotal||0,discount_amount:o.discount_amount||0,rush_fee:o.rush_fee||0,total_amount:o.total||0,
    notes:`Guest order ${o.code||''}`.trim(),tracker_stage:0,milestones:[{stage:0,at:now()}]
  }).select('*').single();
  if(createdProject.error)throw createdProject.error;
  const project=createdProject.data;
  if(items.length){
    const rows=[];
    items.forEach((i,n)=>{
      const kind=String(i.type||'service').toLowerCase()==='package'?'package':'service';
      const parentId=randomUUID();
      rows.push({
        id:parentId,project_id:project.id,parent_item_id:null,
        catalog_service_id:kind==='service'?(i.catalog_id||null):null,
        catalog_package_id:kind==='package'?(i.catalog_id||null):null,
        product_code:null,name:i.name,item_type:kind==='package'?'PACKAGE':'SOLO',
        quantity:Math.max(1,Number(i.qty||1)),unit_price:Number(i.price||0),
        billable:true,counts_as_deliverable:kind!=='package',status:'Pending',progress:0,
        due_date:o.deadline||null,completed_at:null,shared_drive_url:null,client_visible:true,sort_order:n,
        included_items:i.includedItems||[]
      });
      if(kind==='package'){
        (i.includedItems||[]).forEach((name,j)=>rows.push({
          id:randomUUID(),project_id:project.id,parent_item_id:parentId,product_code:null,
          name:String(name),item_type:'PACKAGE_COMPONENT',quantity:1,unit_price:0,
          billable:false,counts_as_deliverable:true,status:'Pending',progress:0,
          due_date:o.deadline||null,completed_at:null,shared_drive_url:null,client_visible:true,sort_order:j
        }));
      }
    });
    const ins=await svc.from('project_items').insert(rows);if(ins.error)throw ins.error;
  }
  const deliverables=[];
  for(const item of items){
    for(let n=0;n<Number(item.qty||1);n++){
      const parentId=randomUUID();
      deliverables.push({id:parentId,project_id:project.id,item_name:item.name,completed:false,progress:0,status:'Pending',client_visible:true,source_type:'guest_order',order_item_id:item.id,order_item_occurrence:n+1,package_name:item.type==='package'?item.name:null});
      (item.includedItems||[]).forEach((name,j)=>deliverables.push({id:randomUUID(),project_id:project.id,item_name:name,completed:false,progress:0,status:'Pending',client_visible:true,source_type:'guest_order_child',order_item_id:item.id,order_item_occurrence:n+1,parent_id:parentId,parent_key:parentId,package_name:item.name,child_index:j}));
    }
  }
  if(deliverables.length){const ins=await svc.from('deliverables').insert(deliverables);if(ins.error)throw ins.error}
  try{await provisionClient(svc,client)}catch(e){console.warn('Portal provisioning deferred:',e?.message||e)}
  const upd=await svc.from('incoming_orders').update({status:'Approved',project_id:project.id,client_id:client.id,approved_at:now(),conversion_lock:null,conversion_started_at:null}).eq('id',o.id);if(upd.error)throw upd.error;
  await audit(svc,'Order approved and converted',o.code,adminUser.id);return {client,project};
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed.'});
  try{
    assertSafePost(req,98304);
    const b=bodyOf(req),action=String(b.action||'dashboard'),svc=serviceClient();

    if(action==='submit-order'){if(String(b.website||'').trim())fail('Request blocked.',400);await enforceRateLimit(req,svc,'guest-order-ip','',8,3600);return res.status(200).json(await submitOrder(b,svc));}
    if(action==='track'){await enforceRateLimit(req,svc,'guest-track-ip','',60,900);return res.status(200).json({order:await orderView(svc,await orderByToken(svc,b.token))});}
    if(action==='track-public'){
      await enforceRateLimit(req,svc,'guest-track-public-ip','',30,900);
      const code=String(b.code||'').trim().toUpperCase(),email=String(b.email||'').trim().toLowerCase();
      if(!code||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('Enter your Order Request ID and email address.');
      const {data:o,error}=await svc.from('incoming_orders').select('*').eq('code',code).ilike('email',email).maybeSingle();
      if(error)throw error;if(!o)fail('No order request matched those details.',404);
      return res.status(200).json({order:await orderView(svc,o)});
    }
    if(action==='accept-revision'){
      await enforceRateLimit(req,svc,'guest-accept-revision-ip','',20,3600);
      const o=await orderByToken(svc,b.token);
      if(o.status!=='Revised Offer Sent')fail('This order request does not have a revised offer awaiting acceptance.');
      const {data,error}=await svc.from('incoming_orders').update({status:'Client Accepted',client_accepted_at:now()}).eq('id',o.id).select('*').single();
      if(error)throw error;await audit(svc,'Client accepted revised offer',o.code);return res.status(200).json({order:safeOrder(data)});
    }
    if(action==='resubmit'){await enforceRateLimit(req,svc,'guest-resubmit-ip','',12,3600);
      const o=await orderByToken(svc,b.token);if(o.status!=='Needs Changes')fail('This order is not awaiting changes.');
      const {data,error}=await svc.from('incoming_orders').update({notes:String(b.notes||''),status:'Order Received',review_note:''}).eq('id',o.id).select('*').single();if(error)throw error;
      await audit(svc,'Guest order resubmitted',o.code);return res.status(200).json({order:safeOrder(data)});
    }
    if(action==='ads'){await enforceRateLimit(req,svc,'public-ads-ip','',120,900);return res.status(200).json(await publicAds(req,svc));}
    if(action==='ad-event'){await enforceRateLimit(req,svc,'public-ad-event-ip','',240,900);return res.status(200).json(await recordAdEvent(b,req,svc));}
    if(action==='accept-invite'){await enforceRateLimit(req,svc,'invite-accept-ip','',20,3600);
      const t=String(b.token||'');const {data:i,error}=await svc.from('portal_invitations').select('*').eq('token',t).maybeSingle();if(error)throw error;
      if(!i||i.status==='revoked'||new Date(i.expires_at)<new Date())fail('Invitation is invalid, revoked or expired.',404);
      const {data:c,error:ce}=await svc.from('clients').select('id,name,email,client_code').eq('id',i.client_id).single();if(ce)throw ce;
      await svc.from('portal_invitations').update({status:'accepted',accepted_at:now()}).eq('id',i.id);
      return res.status(200).json({client_id:c.id,name:c.name,email:c.email,client_code:c.client_code});
    }
    if(action==='client-card'){
      const {user,account}=await clientContext(req,svc);await enforceRateLimit(req,svc,'client-card-user',user.id,40,900);
      let {data:c,error}=await svc.from('clients').select('*').eq('id',account.client_id).single();if(error)throw error;
      if(!c.qr_token){const q=token().slice(0,32);const up=await svc.from('clients').update({qr_token:q}).eq('id',c.id).select('*').single();if(up.error)throw up.error;c=up.data}
      const {data:projects,error:pe}=await svc.from('projects').select('id,total_amount,status,delivery_status').eq('client_id',c.id);if(pe)throw pe;
      const ids=(projects||[]).map(p=>p.id);
      let pays=[];
      if(ids.length){const pr=await svc.from('payments').select('project_id,amount_paid,deleted_at').in('project_id',ids);if(pr.error)throw pr.error;pays=pr.data||[]}
      const completed=(projects||[]).filter(p=>{
        const delivered=['completed','delivered'].includes(String(p.status||'').toLowerCase())||String(p.delivery_status||'').toLowerCase()==='delivered';
        const paid=pays.filter(x=>String(x.project_id)===String(p.id)&&!x.deleted_at).reduce((sum,x)=>sum+Number(x.amount_paid||0),0);
        return delivered&&paid+0.005>=Number(p.total_amount||0);
      }).length;
      const loyalty=completed>=4?'PLATINUM':completed>=3?'GOLD':completed>=2?'SILVER':'BRONZE';
      return res.status(200).json({client:{name:c.name,client_code:c.client_code,qr_token:c.qr_token,classification:c.classification||'New',loyalty_tier:loyalty,completed_projects:completed,member_since:c.created_at}});
    }

    const {user}=await requireAdmin(req);await enforceRateLimit(req,svc,'suite-admin-user',user.id,120,900);

    if(action==='dashboard')return res.status(200).json(await dashboard(svc));
    if(action==='ad-dashboard'){
      const [ads,settings,events]=await Promise.all([
        svc.from('promotions').select('*').order('created_at',{ascending:false}),
        svc.from('ad_settings').select('*').eq('id',1).maybeSingle(),
        svc.from('ad_events').select('ad_id,event_type,created_at').order('created_at',{ascending:false}).limit(5000)
      ]);
      if(ads.error)throw ads.error;if(settings.error)throw settings.error;if(events.error)throw events.error;
      const stats={};
      (events.data||[]).forEach(e=>{const s=stats[e.ad_id]||(stats[e.ad_id]={impression:0,click:0,dismiss:0});if(e.event_type in s)s[e.event_type]++});
      return res.status(200).json({ads:ads.data||[],settings:settings.data||{rotation_seconds:8,transition:'fade'},stats});
    }
    if(action==='revise-order'){
      const {data:o,error}=await svc.from('incoming_orders').select('*').eq('id',b.id).maybeSingle();if(error)throw error;
      if(!o||o.project_id)fail('Order request is missing or already converted.');
      if(o.status==='Rejected')fail('Rejected order requests must be reopened before revising.');
      const source=Array.isArray(b.items)?b.items:[];
      if(!source.length)fail('Keep at least one order item.');
      const items=source.slice(0,100).map(i=>{
        const qty=Math.trunc(Number(i.qty||1)),price=money(i.price);
        if(qty<1||qty>100)fail('Item quantities must be between 1 and 100.');
        if(price<0)fail('Item prices cannot be negative.');
        return {id:String(i.id||randomUUID()),catalog_id:i.catalog_id||null,name:String(i.name||'Order Item').trim().slice(0,180),type:String(i.type||'service').toLowerCase()==='package'?'package':'service',price,qty,includedItems:Array.isArray(i.includedItems)?i.includedItems.slice(0,100).map(x=>String(x).slice(0,180)):[]};
      });
      const subtotal=Math.round(items.reduce((sum,i)=>sum+i.price*i.qty,0)*100)/100;
      const rush=money(b.rush_fee),discount=money(b.discount_amount);
      if(rush<0||discount<0)fail('Rush fee and discount cannot be negative.');
      const total=Math.max(0,Math.round((subtotal+rush-discount)*100)/100);
      const sent=Boolean(b.send_to_client),status=sent?'Revised Offer Sent':'Under Review',note=String(b.note||'').trim().slice(0,3000);
      const {data:updated,error:ue}=await svc.from('incoming_orders').update({items,subtotal,discount_amount:discount,rush_fee:rush,total,review_note:note,status,revised_at:now(),client_accepted_at:null}).eq('id',o.id).select('*').single();
      if(ue)throw ue;
      const rev=await svc.from('order_request_revisions').insert({order_id:o.id,items,subtotal,discount_amount:discount,rush_fee:rush,total,note,sent_to_client:sent,created_by:user.id});if(rev.error)throw rev.error;
      await audit(svc,sent?'Revised offer sent':'Order request revised',o.code,user.id);
      return res.status(200).json({order:safeOrder(updated)});
    }
    if(action==='review-order'){
      const status=String(b.status||'');if(!['Under Review','Needs Changes','Rejected'].includes(status))fail('Invalid review status.');
      if(['Needs Changes','Rejected'].includes(status)&&!String(b.note||'').trim())fail('Explain the requested changes or rejection.');
      const {data:o,error}=await svc.from('incoming_orders').select('*').eq('id',b.id).maybeSingle();if(error)throw error;if(!o||o.project_id)fail('Order is missing or already converted.');
      const up=await svc.from('incoming_orders').update({status,review_note:String(b.note||'')}).eq('id',o.id);if(up.error)throw up.error;
      await audit(svc,'Order '+status,o.code,user.id);return res.status(200).json({ok:true});
    }
    if(action==='approve-order'){
      const {data:o,error}=await svc.from('incoming_orders').select('*').eq('id',b.id).maybeSingle();if(error)throw error;
      if(!o||o.project_id||o.archived_at)fail('Order request is missing, archived, or already converted.');
      const normalizedEmail=String(o.email||'').trim().toLowerCase();
      let {data:client,error:ce}=await svc.from('clients').select('*').eq('email',normalizedEmail).limit(1).maybeSingle();if(ce)throw ce;
      if(!client){const created=await svc.from('clients').insert({id:randomUUID(),name:o.name,email:normalizedEmail,phone:o.phone||null}).select('*').single();if(created.error)throw created.error;client=created.data}
      const {data:updated,error:ue}=await svc.from('incoming_orders').update({status:'Approved',approved_at:now(),client_id:client.id,review_note:String(b.note||o.review_note||'')}).eq('id',o.id).select('*').single();
      if(ue)throw ue;await audit(svc,'Order approved for entry',o.code,user.id);
      return res.status(200).json({order:safeOrder(updated),client});
    }
    if(action==='archive-order'){
      const {data:o,error}=await svc.from('incoming_orders').select('*').eq('id',b.id).maybeSingle();if(error)throw error;if(!o)fail('Order not found.',404);
      if(o.project_id)fail('Converted order requests cannot be deleted. Keep them as history.');
      const stamp=now();const up=await svc.from('incoming_orders').update({status:'Archived',archived_at:stamp}).eq('id',o.id);if(up.error)throw up.error;
      await audit(svc,'Order archived',o.code,user.id);return res.status(200).json({ok:true});
    }
    if(action==='link-order-project'){
      const {data:o,error}=await svc.from('incoming_orders').select('*').eq('id',b.order_id).maybeSingle();if(error)throw error;if(!o)fail('Order request not found.',404);
      const {data:p,error:pe}=await svc.from('projects').select('id,client_id,project_code,source_order_id').eq('id',b.project_id).maybeSingle();if(pe)throw pe;if(!p)fail('Project not found.',404);
      if(o.client_id&&String(o.client_id)!==String(p.client_id))fail('Order request and project client do not match.');
      const proj=await svc.from('projects').update({source_order_id:o.id}).eq('id',p.id);if(proj.error)throw proj.error;
      const updated=await svc.from('incoming_orders').update({status:'Project Created',project_id:p.id,client_id:p.client_id,converted_at:now()}).eq('id',o.id).select('*').single();if(updated.error)throw updated.error;
      await audit(svc,'Order converted to project',o.code,user.id);return res.status(200).json({order:safeOrder(updated.data),project:p});
    }
    if(action==='convert')fail('Direct conversion is disabled. Approve the request, preload it into New Order, then create the project.',409);
    if(action==='review-payment'){
      const decision=String(b.decision||b.status||'');const reason=String(b.reason||b.note||'');
      const {data,error}=await svc.rpc('review_juan_payment_submission',{p_submission_id:b.id||b.submissionId,p_decision:decision,p_admin_user:user.id,p_reason:reason||null});
      if(error)throw error;await audit(svc,'Payment '+data,String(b.id||b.submissionId),user.id);return res.status(200).json({ok:true,status:data});
    }
    if(action==='save-project'){
      const {data:p,error}=await svc.from('projects').select('*').eq('id',b.id).single();if(error)throw error;
      const u=b.updates||{},patch={};if('drive_url'in u)patch.drive_url=String(u.drive_url||'')||null;if('files_override'in u)patch.files_override=!!u.files_override;
      if('tracker_stage'in u){
        const stage=Number(u.tracker_stage);if(!Number.isInteger(stage)||stage<0||stage>=STAGES.length)fail('Invalid project stage.');
        patch.tracker_stage=stage;patch.milestones=[...(Array.isArray(p.milestones)?p.milestones:[]),{stage,at:now()}];
        patch.status=stage===6?'Completed':'In Progress';patch.delivery_status=stage===6?'Delivered':'Pending';
      }
      if(patch.drive_url&&!/^https:\/\/(drive|docs)\.google\.com\//i.test(patch.drive_url))fail('Use a Google Drive URL.');
      const up=await svc.from('projects').update(patch).eq('id',p.id);if(up.error)throw up.error;
      if(Array.isArray(u.deliverables))for(const d of u.deliverables){
        if(d.id){const x=await svc.from('deliverables').update({completed:!!d.completed,status:d.completed?'Completed':'Pending',progress:d.completed?100:0,completed_at:d.completed?now():null}).eq('id',d.id).eq('project_id',p.id);if(x.error)throw x.error}
        for(const c of (d.children||[])){if(c.id){const x=await svc.from('deliverables').update({completed:!!c.completed,status:c.completed?'Completed':'Pending',progress:c.completed?100:0,completed_at:c.completed?now():null}).eq('id',c.id).eq('project_id',p.id);if(x.error)throw x.error}}
      }
      await audit(svc,'Project tracking/files updated',p.project_code,user.id);return res.status(200).json({ok:true});
    }
    if(action==='lookup'){
      let value=String(b.value||'').trim();if(value.includes('#track='))value=value.split('#track=').pop();if(value.includes('#client='))value=value.split('#client=').pop();
      const {data:c,error:ce}=await svc.from('clients').select('*').or(`client_code.eq.${value},qr_token.eq.${value}`).limit(1).maybeSingle();if(ce)throw ce;if(c)return res.status(200).json({kind:'client',record:c});
      const {data:o,error:oe}=await svc.from('incoming_orders').select('*').eq('code',value).maybeSingle();if(oe)throw oe;if(o)return res.status(200).json({kind:'order',record:safeOrder(o)});
      const {data:tok,error:te}=await svc.from('incoming_orders').select('*').eq('token_hash',hash(value)).maybeSingle();if(te)throw te;if(tok)return res.status(200).json({kind:'order',record:safeOrder(tok)});
      fail('No matching client or order.',404);
    }
    if(action==='classify'){
      if(!['New','Returning','Loyal','VIP'].includes(b.value))fail('Invalid client classification.');
      const up=await svc.from('clients').update({classification:b.value}).eq('id',b.id).select('id').maybeSingle();if(up.error)throw up.error;if(!up.data)fail('Client not found.',404);
      await audit(svc,'Client classified '+b.value,String(b.id),user.id);return res.status(200).json({ok:true});
    }
    if(action==='save-ad'){
      const a=b.ad||{},title=String(a.title||'').trim(),type=String(a.ad_type||a.type||'banner'),status=String(a.status||'draft');
      if(!title)fail('Ad name is required.');
      if(!['banner','popup'].includes(type))fail('Choose Banner or Popup.');
      if(!['draft','scheduled','published','paused','expired','archived'].includes(status))fail('Invalid campaign status.');
      const destinationType=String(a.destination_type||'no_action'),destinationValue=String(a.destination_value||'').trim();
      if(!['no_action','shop','package','service','referral','loyalty','page','external_url'].includes(destinationType))fail('Invalid ad destination.');
      if(destinationType==='external_url'&&!/^https:\/\//i.test(destinationValue))fail('External ad URLs must use HTTPS.');
      if(['package','service','page'].includes(destinationType)&&!destinationValue)fail('Choose a valid destination before publishing.');
      const startAt=a.start_at||null,endAt=a.no_expiration?null:(a.end_at||null),priority=Math.max(0,Math.min(1000,Math.trunc(Number(a.priority||0))));
      if(startAt&&Number.isNaN(new Date(startAt).getTime()))fail('Invalid campaign start date.');
      if(endAt&&Number.isNaN(new Date(endAt).getTime()))fail('Invalid campaign end date.');
      if(startAt&&endAt&&new Date(endAt)<=new Date(startAt))fail('Campaign end must be after the start.');
      if(status==='published'&&!String(a.image||'').trim())fail('Upload a promotional image before publishing.');
      const row={
        title,body:String(a.body||''),cta:String(a.cta||'Learn more'),url:destinationType==='external_url'?destinationValue:null,image:String(a.image||'').trim()||null,
        audience:a.audience||'all',enabled:!['paused','archived','expired','draft'].includes(status),
        ad_type:type,status,placement:String(a.placement||('popup'===type?'homepage_popup':'homepage_banner')),
        destination_type:destinationType,destination_value:destinationValue||null,start_at:startAt,end_at:endAt,no_expiration:Boolean(a.no_expiration),
        priority,image_alt:String(a.image_alt||title).slice(0,240),published_at:status==='published'?(a.published_at||now()):null,archived_at:status==='archived'?now():null
      };
      let q=a.id?svc.from('promotions').update(row).eq('id',a.id):svc.from('promotions').insert(row);
      const {data,error}=await q.select('*').single();if(error)throw error;return res.status(200).json({ok:true,ad:data});
    }
    if(action==='ad-settings'){
      const seconds=Math.max(3,Math.min(120,Math.trunc(Number(b.rotation_seconds||8))));
      const {data,error}=await svc.from('ad_settings').upsert({id:1,rotation_seconds:seconds,transition:'fade',updated_at:now()},{onConflict:'id'}).select('*').single();
      if(error)throw error;return res.status(200).json({ok:true,settings:data});
    }
    if(action==='archive-ad'){
      const {error}=await svc.from('promotions').update({status:'archived',enabled:false,archived_at:now()}).eq('id',b.id);if(error)throw error;return res.status(200).json({ok:true});
    }
    if(action==='delete-ad'){
      const {data:a,error:ae}=await svc.from('promotions').select('id,status').eq('id',b.id).maybeSingle();if(ae)throw ae;if(!a)fail('Ad not found.',404);
      const {count,error:ce}=await svc.from('ad_events').select('id',{count:'exact',head:true}).eq('ad_id',a.id);if(ce)throw ce;
      if(a.status!=='draft'||Number(count||0)>0)fail('Only unused draft ads can be permanently deleted. Archive this campaign instead.');
      const {error}=await svc.from('promotions').delete().eq('id',a.id);if(error)throw error;return res.status(200).json({ok:true});
    }
    if(action==='configure'){
      const cfg=b.config||{},rules=cfg.rules||{};rules.maribank='^\\d{6,12}$';
      const {error}=await svc.from('suite_config').upsert({id:1,online_url:cfg.online_url||null,workspace_url:cfg.workspace_url||null,rules},{onConflict:'id'});if(error)throw error;
      return res.status(200).json({ok:true});
    }
    if(action==='invite'){
      const {data:c,error}=await svc.from('clients').select('*').eq('id',b.id).single();if(error)throw error;
      try{await provisionClient(svc,c)}catch(e){console.warn('Provisioning:',e?.message||e)}
      const t=token();const ins=await svc.from('portal_invitations').insert({client_id:c.id,token:t,status:'pending'}).select('*').single();if(ins.error)throw ins.error;
      await audit(svc,'Invitation created',c.client_code,user.id);return res.status(200).json({invitation:ins.data});
    }
    if(action==='revoke-invite'){const {error}=await svc.from('portal_invitations').update({status:'revoked'}).eq('id',b.id);if(error)throw error;return res.status(200).json({ok:true})}
    if(action==='export'){
      const d=await dashboard(svc);return res.status(200).json({exported_at:now(),...d});
    }
    fail('Unsupported action: '+action,404);
  }catch(error){return sendError(res,error)}
}
