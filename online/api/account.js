import { requireUser, ensurePortalAccount, sendError } from './_lib.js';
export default async function handler(req,res){
  try{
    if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
    const {user,svc}=await requireUser(req);await ensurePortalAccount(user,svc);
    if(req.body?.action!=='password-set')return res.status(400).json({error:'Unknown action'});
    const u=await svc.from('portal_accounts').update({password_set:true,updated_at:new Date().toISOString()}).eq('auth_user_id',user.id);if(u.error)throw u.error;
    const authUpdate=await svc.auth.admin.updateUserById(user.id,{user_metadata:{...(user.user_metadata||{}),must_change_password:false,juan_project_client:true}});if(authUpdate.error)console.warn('Could not update password metadata:',authUpdate.error.message);
    return res.status(200).json({ok:true});
  }catch(e){return sendError(res,e)}
}
