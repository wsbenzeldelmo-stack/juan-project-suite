import { requireUser, ensurePortalAccount, sendError } from './_lib.js';
export default async function handler(req,res){
  try{
    if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
    const {user,svc}=await requireUser(req);
    const account=await ensurePortalAccount(user,svc);
    const action=req.body?.action;

    if(action==='password-set'){
      const u=await svc.from('portal_accounts').update({password_set:true,updated_at:new Date().toISOString()}).eq('auth_user_id',user.id);
      if(u.error)throw u.error;
      const authUpdate=await svc.auth.admin.updateUserById(user.id,{user_metadata:{...(user.user_metadata||{}),must_change_password:false,juan_project_client:true}});
      if(authUpdate.error)console.warn('Could not update password metadata:',authUpdate.error.message);
      return res.status(200).json({ok:true});
    }

    if(action==='profile-photo-set'){
      const path=String(req.body?.path||'').trim();
      if(path && !path.startsWith(`${user.id}/`))return res.status(400).json({error:'Invalid profile image path.'});
      if(path){
        const folder=user.id;
        const name=path.slice(folder.length+1);
        const listed=await svc.storage.from('juan-profile-images').list(folder,{search:name,limit:20});
        if(listed.error)throw listed.error;
        if(!(listed.data||[]).some(x=>x.name===name))return res.status(400).json({error:'Profile image upload could not be verified.'});
      }
      const u=await svc.from('clients').update({profile_photo_path:path||null}).eq('id',account.client_id);
      if(u.error)throw u.error;
      return res.status(200).json({ok:true});
    }

    return res.status(400).json({error:'Unknown action'});
  }catch(e){return sendError(res,e)}
}
