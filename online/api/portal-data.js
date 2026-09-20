import { requireUser, ensurePortalAccount, enforceRateLimit, sendError } from './_lib.js';

const paidSum=rows=>(rows||[]).reduce((s,p)=>s+Number(p.amount_paid||p.amount||0),0);

function maintenanceFeeForSubtotal(subtotal){
  const value=Math.max(0,Number(subtotal||0));
  if(!(value>0))return 0;
  return Math.abs(Math.round(value))%100===99?26:25;
}

export default async function handler(req,res){
  try{
    if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
    const {user,svc}=await requireUser(req);
    await enforceRateLimit(req,svc,'portal-data-user',user.id,120,900);
    const account=await ensurePortalAccount(user,svc);

    // Select the full row so older databases do not fail when a newer optional column
    // (for example profile_photo_path or delivery_status) has not been migrated yet.
    const clientRes=await svc.from('clients').select('*').eq('id',account.client_id).single();
    if(clientRes.error)throw clientRes.error;

    const projectsRes=await svc.from('projects').select('*').eq('client_id',account.client_id).order('id',{ascending:false});
    if(projectsRes.error)throw projectsRes.error;
    const projects=projectsRes.data||[];
    const ids=projects.map(p=>p.id);

    let items=[],deliverables=[],payments=[],subs=[];
    if(ids.length){
      const [i,d,p,s]=await Promise.all([
        svc.from('project_items').select('*').in('project_id',ids),
        svc.from('deliverables').select('*').in('project_id',ids),
        svc.from('payments').select('*').in('project_id',ids),
        svc.from('payment_submissions').select('*').eq('client_id',account.client_id).order('submitted_at',{ascending:false})
      ]);
      items=i.data||[];deliverables=d.data||[];payments=p.data||[];subs=s.data||[];
    }

    const settings=(await svc.from('payment_settings').select('id,method_label,account_name,account_number,qr_image_url,instructions').eq('id',1).maybeSingle()).data||null;

    const enriched=projects.map(p=>{
      let ds=deliverables.filter(d=>d.project_id===p.id&&d.client_visible!==false).map(d=>({
        id:d.id,project_id:d.project_id,item_name:d.item_name||d.name||'Deliverable',completed:Boolean(d.completed),
        status:d.status||(d.completed?'Completed':'Pending'),progress:Number(d.progress||0),due_date:d.due_date||p.deadline_date,
        client_visible:d.client_visible!==false,completed_at:d.completed_at||null
      }));
      const its=items.filter(i=>i.project_id===p.id).map(i=>({id:i.id,project_id:i.project_id,name:i.name,price:Number(i.price||0),qty:Number(i.qty||1),type:i.type||'Item'}));
      if(!ds.length)ds=its.map((i,idx)=>({id:`derived-${p.id}-${idx}`,project_id:p.id,item_name:i.name,completed:false,status:'Pending',progress:0,due_date:p.deadline_date,client_visible:true}));
      const pays=payments.filter(x=>x.project_id===p.id).map(x=>({id:x.id,amount_paid:Number(x.amount_paid||x.amount||0),payment_date:x.payment_date||null,payment_method:x.payment_method||null,reference_no:x.reference_no||null}));
      const amountPaid=paidSum(pays);
      const itemSubtotal=its.reduce((sum,i)=>sum+Math.max(0,Number(i.price||0))*Math.max(1,Number(i.qty||1)),0);
      const subtotal=Math.max(0,Number(p.subtotal_amount||itemSubtotal||0));
      const storedMaintenance=Math.max(0,Number(p.system_maintenance_fee||0));
      const maintenance=storedMaintenance>0?storedMaintenance:maintenanceFeeForSubtotal(subtotal);
      const discount=Math.max(0,Number(p.discount_amount||0));
      const knownTotal=Math.max(0,subtotal-discount+Math.max(0,Number(p.rush_fee||0))+Math.max(0,Number(p.workload_surcharge||0))+maintenance);
      const total=Math.max(Math.max(0,Number(p.total_amount||0)),knownTotal),balance=Math.max(0,total-amountPaid);
      const delivered=String(p.delivery_status||'').toLowerCase()==='delivered'||['completed','delivered'].includes(String(p.status||'').toLowerCase());
      return {
        ...p,status:delivered?'Delivered':p.status,delivery_status:delivered?'Delivered':(p.delivery_status||'Pending'),
        system_maintenance_fee:maintenance,total_amount:total,
        items:its,deliverables:ds,payments:pays,amount_paid:amountPaid,balance,
        files_locked:balance>0&&!p.files_override,
        drive_url:(balance<=0||p.files_override)?(p.drive_url||null):null,
        payment_status:balance<=0?'PAID':amountPaid>0?'PARTIALLY PAID':(p.deadline_date&&new Date(p.deadline_date)<new Date()?'OVERDUE':'UNPAID')
      };
    });

    const safeSubs=subs.map(x=>({
      id:x.id,project_id:x.project_id,submitted_amount:Number(x.submitted_amount||0),transfer_fee:Number(x.extracted_transfer_fee||0),net_amount:Number(x.net_amount||x.submitted_amount||0),entry_source:x.entry_source||'manual',payment_method:x.payment_method||null,
      reference_number:x.reference_number||null,extracted_reference:x.extracted_reference||null,payment_date:x.payment_date||null,sender_institution:x.sender_institution||null,
      status:x.status,submitted_at:x.submitted_at,reviewed_at:x.reviewed_at||null,rejection_reason:x.rejection_reason||null,rejection_code:x.rejection_code||null,admin_note:x.admin_note||null
    }));

    let profilePhotoUrl=null;
    if(clientRes.data?.profile_photo_path){
      const signed=await svc.storage.from('juan-profile-images').createSignedUrl(clientRes.data.profile_photo_path,3600);
      if(!signed.error)profilePhotoUrl=signed.data?.signedUrl||null;
    }
    const profile={...clientRes.data,profile_photo_url:profilePhotoUrl};

    const [orderByClient,orderByEmail]=await Promise.all([
      svc.from('incoming_orders').select('id,code,title,status,created_at,updated_at,total,subtotal,discount_amount,rush_fee,deadline,review_note,project_id,client_id,items,client_accepted_at,revised_at,approved_at,converted_at,archived_at').eq('client_id',account.client_id).is('archived_at',null).order('created_at',{ascending:false}),
      clientRes.data?.email
        ? svc.from('incoming_orders').select('id,code,title,status,created_at,updated_at,total,subtotal,discount_amount,rush_fee,deadline,review_note,project_id,client_id,items,client_accepted_at,revised_at,approved_at,converted_at,archived_at').ilike('email',String(clientRes.data.email).trim()).is('archived_at',null).order('created_at',{ascending:false})
        : Promise.resolve({data:[],error:null})
    ]);
    if(orderByClient.error)throw orderByClient.error;if(orderByEmail.error)throw orderByEmail.error;
    const orderMap=new Map();
    [...(orderByClient.data||[]),...(orderByEmail.data||[])].forEach(o=>orderMap.set(String(o.id),{...o,total:Number(o.total||0),subtotal:Number(o.subtotal||0),discount_amount:Number(o.discount_amount||0),rush_fee:Number(o.rush_fee||0),items:Array.isArray(o.items)?o.items:[]}));
    const orderRequests=[...orderMap.values()].sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));

    return res.status(200).json({
      profile,
      passwordSet:Boolean(account.password_set),
      projects:enriched,
      orderRequests,
      paymentSettings:settings,
      paymentSubmissions:safeSubs
    });
  }catch(e){return sendError(res,e)}
}
