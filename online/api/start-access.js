import { serviceClient, publicClient, enforceRateLimit, sendError } from './_lib.js';

function redirectUrl(req) {
  const configured = String(process.env.ONLINE_PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  const origin = String(req.headers.origin || '').trim();
  if (/^https:\/\//i.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return origin;
  return undefined;
}

export default async function handler(req,res){
  try{
    if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
    const email=String(req.body?.email||'').trim().toLowerCase();
    if(!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({error:'Enter a valid email address.'});
    const svc=serviceClient();
    await enforceRateLimit(req,svc,'first-access',email,5,900);
    const {data,error}=await svc.from('clients').select('id').ilike('email',email).limit(1);
    if(error)throw error;
    if(data?.length){
      const pub=publicClient();
      const options={shouldCreateUser:true};
      const target=redirectUrl(req);if(target)options.emailRedirectTo=target;
      const otp=await pub.auth.signInWithOtp({email,options});
      if(otp.error)throw otp.error;
    }
    // Deliberately generic: do not reveal whether an email is already a client.
    return res.status(200).json({ok:true,message:'If this email is linked to JUAN PROJECT, a secure access link will be sent.'});
  }catch(e){return sendError(res,e)}
}
