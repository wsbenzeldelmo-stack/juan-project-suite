import { requireAdmin, sendError } from './_lib.js';

async function listAllAuthUsers(svc){
  const out=[];let page=1;
  while(true){
    const {data,error}=await svc.auth.admin.listUsers({page,perPage:1000});
    if(error)throw error;
    const batch=data?.users||[];out.push(...batch);
    if(batch.length<1000)break;
    page+=1;
  }
  return out;
}

function normEmail(value){return String(value||'').trim().toLowerCase()}
function validEmail(value){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value||'').trim())}
function validDrive(value){return !value || /^https:\/\/(drive|docs)\.google\.com\//i.test(String(value).trim())}

async function getClientAccountSnapshot(svc){
  const [clientsRes,portalRes,rolesRes,authUsers]=await Promise.all([
    svc.from('clients').select('id,name,email,client_code,archived_at').order('client_code',{ascending:true,nullsFirst:false}),
    svc.from('portal_accounts').select('auth_user_id,client_id,password_set,portal_enabled,created_at,updated_at'),
    svc.from('user_roles').select('auth_user_id,role'),
    listAllAuthUsers(svc)
  ]);
  if(clientsRes.error)throw clientsRes.error;
  if(portalRes.error)throw portalRes.error;
  if(rolesRes.error)throw rolesRes.error;

  const portalByClient=new Map((portalRes.data||[]).map(x=>[String(x.client_id),x]));
  const authById=new Map(authUsers.map(u=>[u.id,u]));
  const authByEmail=new Map(authUsers.filter(u=>u.email).map(u=>[normEmail(u.email),u]));
  const roleByUser=new Map((rolesRes.data||[]).map(x=>[x.auth_user_id,x.role]));
  const emailCounts=new Map();
  for(const c of clientsRes.data||[]){const e=normEmail(c.email);if(e)emailCounts.set(e,(emailCounts.get(e)||0)+1)}

  const rows=(clientsRes.data||[]).map(c=>{
    const portal=portalByClient.get(String(c.id));
    const auth=portal?authById.get(portal.auth_user_id):authByEmail.get(normEmail(c.email));
    let status='needs_account';
    if(c.archived_at)status='archived';
    else if(!c.client_code)status='missing_client_id';
    else if(!validEmail(c.email))status='missing_email';
    else if(emailCounts.get(normEmail(c.email))>1)status='duplicate_email';
    else if(portal?.portal_enabled===false)status='disabled';
    else if(portal?.password_set)status='active';
    else if(portal)status='temporary_password';
    else if(auth)status='auth_unlinked';
    return {
      id:c.id,name:c.name,email:c.email,client_code:c.client_code,archived_at:c.archived_at||null,
      status,password_set:Boolean(portal?.password_set),portal_enabled:portal?.portal_enabled!==false,
      auth_user_id:portal?.auth_user_id||auth?.id||null,
      role:portal?roleByUser.get(portal.auth_user_id)||'client':auth?roleByUser.get(auth.id)||null:null,
      last_sign_in_at:auth?.last_sign_in_at||null
    };
  });
  return {rows,authUsers,portalByClient,authByEmail,roleByUser,emailCounts,authById};
}

async function setAuthMetadata(svc,user,patch){
  const current=user?.user_metadata||{};
  const updated=await svc.auth.admin.updateUserById(user.id,{user_metadata:{...current,...patch}});
  if(updated.error)throw updated.error;
  return updated.data?.user||user;
}

async function provisionOneClient(svc,client,snapshot,{refreshTemporary=false}={}){
  if(!client)return {status:'error',message:'Client not found.'};
  if(client.archived_at)return {status:'skipped',message:'Archived client was not provisioned.'};
  if(!client.client_code)return {status:'skipped',message:'Client ID is missing.'};
  if(!validEmail(client.email))return {status:'skipped',message:'A valid email is required.'};
  const email=normEmail(client.email);
  if((snapshot.emailCounts.get(email)||0)>1)return {status:'skipped',message:'Duplicate client email. Resolve duplicates first.'};

  const existingPortal=snapshot.portalByClient.get(String(client.id));
  if(existingPortal){
    if(existingPortal.password_set){
      return {status:'active',message:'Account already active. Existing password was preserved.',auth_user_id:existingPortal.auth_user_id};
    }
    if(refreshTemporary){
      const user=snapshot.authById.get(existingPortal.auth_user_id);
      if(user){
        const role=snapshot.roleByUser.get(user.id);
        if(role==='admin')return {status:'skipped',message:'Admin account was not changed.'};
        const upd=await svc.auth.admin.updateUserById(user.id,{password:client.client_code,email_confirm:true,user_metadata:{...(user.user_metadata||{}),client_code:client.client_code,client_id:client.id,must_change_password:true,juan_project_client:true}});
        if(upd.error)throw upd.error;
      }
    }
    return {status:'temporary_password',message:refreshTemporary?'Temporary password synchronized to the current Client ID.':'Account already exists and still requires a password change.',auth_user_id:existingPortal.auth_user_id,initial_password:client.client_code};
  }

  let user=snapshot.authByEmail.get(email);
  let created=false;
  let linkedExisting=false;
  if(user){
    const role=snapshot.roleByUser.get(user.id);
    if(role==='admin')return {status:'skipped',message:'This email belongs to an admin account and was not changed.'};
    const conflict=await svc.from('portal_accounts').select('client_id').eq('auth_user_id',user.id).maybeSingle();
    if(conflict.error)throw conflict.error;
    if(conflict.data&&String(conflict.data.client_id)!==String(client.id))return {status:'skipped',message:'The existing Auth account is already linked to another client.'};
    user=await setAuthMetadata(svc,user,{client_code:client.client_code,client_id:client.id,must_change_password:true,juan_project_client:true});
    linkedExisting=true;
  }else{
    const made=await svc.auth.admin.createUser({
      email,password:client.client_code,email_confirm:true,
      user_metadata:{client_code:client.client_code,client_id:client.id,must_change_password:true,juan_project_client:true}
    });
    if(made.error)throw made.error;
    user=made.data.user;created=true;
  }

  const role=snapshot.roleByUser.get(user.id);
  if(!role){const r=await svc.from('user_roles').insert({auth_user_id:user.id,role:'client'});if(r.error)throw r.error}
  const account=await svc.from('portal_accounts').upsert({auth_user_id:user.id,client_id:client.id,password_set:false,portal_enabled:true,updated_at:new Date().toISOString()},{onConflict:'auth_user_id'});
  if(account.error)throw account.error;

  if(created)return {status:'created',message:'Client account created.',auth_user_id:user.id,initial_password:client.client_code};
  if(linkedExisting)return {status:'linked',message:'Existing Auth user linked without changing its password. Force/reset password only if the client needs it.',auth_user_id:user.id};
  return {status:'linked',message:'Client account linked.',auth_user_id:user.id};
}

export default async function handler(req,res){
  try{
    const {svc,user}=await requireAdmin(req);

    if(req.method==='GET'){
      const [submissions,settings,projects,deliverables,accountSnapshot]=await Promise.all([
        svc.from('payment_submissions').select('*').order('submitted_at',{ascending:false}).limit(100),
        svc.from('payment_settings').select('*').eq('id',1).maybeSingle(),
        svc.from('projects').select('id,title,client_id,project_code,status,deadline_date,drive_url,drive_unlock_at,drive_expires_at').order('project_code',{ascending:true,nullsFirst:false}),
        svc.from('deliverables').select('id,project_id,item_name,client_visible,due_date,completed').order('project_id'),
        getClientAccountSnapshot(svc)
      ]);
      if(submissions.error)throw submissions.error;
      if(settings.error)throw settings.error;
      if(projects.error)throw projects.error;
      if(deliverables.error)throw deliverables.error;

      const clientsForNames=accountSnapshot.rows.map(x=>({id:x.id,name:x.name,email:x.email,client_code:x.client_code}));
      const safeSubmissions=await Promise.all((submissions.data||[]).map(async submission=>{
        let receipt_url=null;
        if(submission.receipt_path){
          const signed=await svc.storage.from('payment-receipts').createSignedUrl(submission.receipt_path,300);
          if(!signed.error)receipt_url=signed.data?.signedUrl||null;
        }
        return {...submission,receipt_url};
      }));

      res.setHeader('Cache-Control','private, no-store');
      return res.status(200).json({
        submissions:safeSubmissions,
        settings:settings.data||null,
        projects:projects.data||[],
        deliverables:deliverables.data||[],
        clients:clientsForNames,
        clientAccounts:accountSnapshot.rows
      });
    }

    if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
    const body=req.body||{};

    if(body.action==='provision-all-clients'){
      const snapshot=await getClientAccountSnapshot(svc);
      const results=[];
      for(const row of snapshot.rows){
        const client={id:row.id,name:row.name,email:row.email,client_code:row.client_code,archived_at:row.archived_at};
        try{results.push({...client,...await provisionOneClient(svc,client,snapshot,{refreshTemporary:true})})}
        catch(error){results.push({...client,status:'error',message:error?.message||'Account creation failed.'})}
      }
      const summary=results.reduce((acc,x)=>{acc[x.status]=(acc[x.status]||0)+1;return acc},{total:results.length});
      return res.status(200).json({ok:true,summary,results});
    }

    if(body.action==='provision-client-account'){
      const snapshot=await getClientAccountSnapshot(svc);
      const row=snapshot.rows.find(x=>String(x.id)===String(body.clientId||''));
      if(!row)return res.status(404).json({error:'Client not found.'});
      const result=await provisionOneClient(svc,row,snapshot,{refreshTemporary:false});
      return res.status(200).json({ok:true,result});
    }

    if(body.action==='reset-client-temporary-password'){
      const snapshot=await getClientAccountSnapshot(svc);
      const row=snapshot.rows.find(x=>String(x.id)===String(body.clientId||''));
      if(!row||!row.auth_user_id)return res.status(404).json({error:'Client account not found.'});
      if(!row.client_code)return res.status(400).json({error:'Client ID is missing.'});
      if(row.role==='admin')return res.status(409).json({error:'Admin passwords cannot be reset from Client Accounts.'});
      const authUser=snapshot.authUsers.find(x=>x.id===row.auth_user_id);
      const updated=await svc.auth.admin.updateUserById(row.auth_user_id,{password:row.client_code,email_confirm:true,user_metadata:{...(authUser?.user_metadata||{}),client_code:row.client_code,client_id:row.id,must_change_password:true,juan_project_client:true}});
      if(updated.error)throw updated.error;
      const upd=await svc.from('portal_accounts').update({password_set:false,portal_enabled:true,updated_at:new Date().toISOString()}).eq('auth_user_id',row.auth_user_id);
      if(upd.error)throw upd.error;
      return res.status(200).json({ok:true,initial_password:row.client_code});
    }

    if(body.action==='force-password-change'){
      const snapshot=await getClientAccountSnapshot(svc);
      const row=snapshot.rows.find(x=>String(x.id)===String(body.clientId||''));
      if(!row||!row.auth_user_id)return res.status(404).json({error:'Client account not found.'});
      if(row.role==='admin')return res.status(409).json({error:'Admin account cannot be changed here.'});
      const authUser=snapshot.authUsers.find(x=>x.id===row.auth_user_id);
      if(authUser)await setAuthMetadata(svc,authUser,{must_change_password:true,juan_project_client:true,client_code:row.client_code,client_id:row.id});
      const upd=await svc.from('portal_accounts').update({password_set:false,updated_at:new Date().toISOString()}).eq('auth_user_id',row.auth_user_id);
      if(upd.error)throw upd.error;
      return res.status(200).json({ok:true});
    }

    if(body.action==='set-client-access'){
      const snapshot=await getClientAccountSnapshot(svc);
      const row=snapshot.rows.find(x=>String(x.id)===String(body.clientId||''));
      if(!row||!row.auth_user_id)return res.status(404).json({error:'Client account not found.'});
      if(row.role==='admin')return res.status(409).json({error:'Admin access cannot be changed here.'});
      const enabled=body.enabled!==false;
      const upd=await svc.from('portal_accounts').update({portal_enabled:enabled,updated_at:new Date().toISOString()}).eq('auth_user_id',row.auth_user_id);
      if(upd.error)throw upd.error;
      return res.status(200).json({ok:true,enabled});
    }

    if(body.action==='review-payment'){
      const id=String(body.id||'');
      const decision=body.decision==='approved'?'approved':body.decision==='rejected'?'rejected':'';
      if(!id||!decision)return res.status(400).json({error:'Invalid payment review request.'});
      const review=await svc.rpc('review_juan_payment_submission',{p_submission_id:id,p_decision:decision,p_admin_user:user.id,p_reason:decision==='rejected'?String(body.reason||'').slice(0,500):null});
      if(review.error){const message=String(review.error.message||'Payment review failed.');const status=/already reviewed/i.test(message)?409:/balance/i.test(message)?409:400;return res.status(status).json({error:message})}
      return res.status(200).json({ok:true,status:review.data});
    }

    if(body.action==='save-project-drive-link'){
      const id=String(body.projectId||'');
      if(!id)return res.status(400).json({error:'Project is required.'});
      const drive=String(body.url||'').trim();
      if(!validDrive(drive))return res.status(400).json({error:'Enter a valid Google Drive link.'});
      const unlockAt=body.unlockAt?new Date(body.unlockAt):null;
      const expiresAt=body.expiresAt?new Date(body.expiresAt):null;
      if(unlockAt&&Number.isNaN(unlockAt.getTime()))return res.status(400).json({error:'Enter a valid folder unlock date and time.'});
      if(expiresAt&&Number.isNaN(expiresAt.getTime()))return res.status(400).json({error:'Enter a valid folder expiry date and time.'});
      if(unlockAt&&expiresAt&&expiresAt<=unlockAt)return res.status(400).json({error:'Folder expiry must be later than the unlock time.'});
      const upd=await svc.from('projects').update({
        drive_url:drive||null,
        drive_unlock_at:unlockAt?unlockAt.toISOString():null,
        drive_expires_at:expiresAt?expiresAt.toISOString():null
      }).eq('id',id);
      if(upd.error)throw upd.error;
      return res.status(200).json({ok:true});
    }

    // Backward-compatible alias from earlier portal-control builds.
    if(body.action==='save-delivery-link'){
      const projectId=String(body.projectId||'');
      if(projectId){
        const drive=String(body.url||'').trim();
        if(!validDrive(drive))return res.status(400).json({error:'Enter a valid Google Drive link.'});
        const upd=await svc.from('projects').update({drive_url:drive||null}).eq('id',projectId);
        if(upd.error)throw upd.error;
        return res.status(200).json({ok:true});
      }
      return res.status(400).json({error:'V1.1 delivery links are saved per project.'});
    }

    if(body.action==='save-payment-settings'){
      const payload={
        id:1,
        method_label:String(body.methodLabel||'UnionBank InstaPay').slice(0,80),
        account_name:String(body.accountName||'').slice(0,120),
        account_number:String(body.accountNumber||'').slice(0,80),
        qr_image_url:String(body.qrImageUrl||'').slice(0,1000),
        instructions:String(body.instructions||'').slice(0,1000),
        updated_at:new Date().toISOString()
      };
      const upsert=await svc.from('payment_settings').upsert(payload);
      if(upsert.error)throw upsert.error;
      return res.status(200).json({ok:true});
    }

    return res.status(400).json({error:'Unknown action.'});
  }catch(e){return sendError(res,e)}
}
