export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  return res.status(410).json({error:'First Access is disabled. JUAN PROJECT client accounts are provisioned by the admin and use an initial password.'});
}
