import { requireUser, ensurePortalAccount, sendError } from './_lib.js';

const paidSum=rows=>(rows||[]).reduce((s,p)=>s+Number(p.amount_paid||p.amount||0),0);

export default async function handler(req,res){
  try{
    if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
    const {user,svc}=await requireUser(req);
    const account=await ensurePortalAccount(user,svc);

    const clientRes=await svc.from('clients').select('id,name,email,phone,address,client_code').eq('id',account.client_id).single();
    if(clientRes.error)throw clientRes.error;

    const projectsRes=await svc.from('projects').select('id,client_id,project_code,title,status,total_amount,subtotal_amount,discount_amount,rush_fee,system_maintenance_fee,workload_surcharge,start_date,deadline_date,drive_url,drive_unlock_at,drive_expires_at,invoice_number,invoice_issue_date,invoice_due_date').eq('client_id',account.client_id).order('id',{ascending:false});
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
      const amountPaid=paidSum(pays),total=Number(p.total_amount||0),balance=Math.max(0,total-amountPaid);
      return {
        ...p,items:its,deliverables:ds,payments:pays,amount_paid:amountPaid,balance,
        drive_url:p.drive_url||null,
        payment_status:balance<=0?'PAID':amountPaid>0?'PARTIALLY PAID':(p.deadline_date&&new Date(p.deadline_date)<new Date()?'OVERDUE':'UNPAID')
      };
    });

    const safeSubs=subs.map(x=>({
      id:x.id,project_id:x.project_id,submitted_amount:Number(x.submitted_amount||0),transfer_fee:Number(x.extracted_transfer_fee||0),net_amount:Number(x.net_amount||x.submitted_amount||0),entry_source:x.entry_source||'manual',payment_method:x.payment_method||null,
      reference_number:x.reference_number||null,extracted_reference:x.extracted_reference||null,payment_date:x.payment_date||null,
      status:x.status,submitted_at:x.submitted_at,rejection_reason:x.rejection_reason||null
    }));

    return res.status(200).json({
      profile:clientRes.data,
      passwordSet:Boolean(account.password_set),
      projects:enriched,
      paymentSettings:settings,
      paymentSubmissions:safeSubs
    });
  }catch(e){return sendError(res,e)}
}
