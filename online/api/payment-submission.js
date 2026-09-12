import { requireUser, ensurePortalAccount, enforceRateLimit, sendError } from './_lib.js';
import {getPaymentInstitution,validatePaymentReference,sanitizePaymentReference} from '../js/payment-institutions.js';

export default async function handler(req,res){
  try{
    if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
    const {user,svc}=await requireUser(req);
    await enforceRateLimit(req,svc,'payment-submission',user.id,8,3600);
    const acc=await ensurePortalAccount(user,svc),b=req.body||{};
    const projectId=String(b.projectId||''),receiptPath=String(b.receiptPath||''),amount=Number(b.amount||0),senderInstitution=String(b.senderInstitution||'').trim().toLowerCase(),referenceNumber=sanitizePaymentReference(b.referenceNumber),paymentDate=String(b.paymentDate||'').trim(),transferFee=Math.max(0,Number(b.transferFee||0));
    const institution=getPaymentInstitution(senderInstitution);
    if(!projectId)return res.status(400).json({error:'Select the project for this payment.'});
    if(!(amount>0))return res.status(400).json({error:'Amount paid must be greater than 0.'});
    if(!institution)return res.status(400).json({error:'Select a supported sending bank or e-wallet.'});
    const referenceCheck=validatePaymentReference(senderInstitution,referenceNumber);
    if(!referenceCheck.ok)return res.status(400).json({error:referenceCheck.message,field:'referenceNumber'});
    if(!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate))return res.status(400).json({error:'Enter a valid payment date.'});
    if(!receiptPath)return res.status(400).json({error:'Upload your payment receipt before submitting.'});
    if(!receiptPath.startsWith(user.id+'/'))return res.status(403).json({error:'Invalid receipt path.'});

    const pr=await svc.from('projects').select('id,client_id,total_amount').eq('id',projectId).eq('client_id',acc.client_id).maybeSingle();
    if(pr.error||!pr.data)return res.status(404).json({error:'Project not found.'});
    const filename=receiptPath.slice((user.id+'/').length);if(!filename||filename.includes('/'))return res.status(403).json({error:'Invalid receipt path.'});
    const listed=await svc.storage.from('payment-receipts').list(user.id,{search:filename,limit:10});
    if(listed.error)throw listed.error;if(!(listed.data||[]).some(x=>x.name===filename))return res.status(400).json({error:'Uploaded receipt could not be verified.'});

    const existing=await svc.from('payments').select('amount_paid').eq('project_id',projectId);
    if(existing.error)throw existing.error;
    const paid=(existing.data||[]).reduce((s,p)=>s+Number(p.amount_paid||0),0),balance=Math.max(0,Number(pr.data.total_amount||0)-paid),netAmount=Math.max(0,amount-transferFee);
    if(amount>balance+0.01)return res.status(400).json({error:`Amount is greater than the current balance (${balance.toFixed(2)}).`});

    const duplicateSubmission=await svc.from('payment_submissions').select('id').ilike('reference_number',referenceNumber).in('status',['pending','accepted','approved']).limit(1);
    if(duplicateSubmission.error)throw duplicateSubmission.error;
    if((duplicateSubmission.data||[]).length)return res.status(409).json({error:'This reference number has already been submitted.'});
    const duplicatePayment=await svc.from('payments').select('id').ilike('reference_no',referenceNumber).limit(1);
    if(!duplicatePayment.error&&(duplicatePayment.data||[]).length)return res.status(409).json({error:'This reference number is already recorded as a payment.'});

    const verificationSnapshot={passed:true,sender:institution.code,sender_name:institution.name,reference_format:'valid',receipt:'present',amount:'valid',date:'valid',verified_at:new Date().toISOString()};
    const ins=await svc.from('payment_submissions').insert({project_id:projectId,client_id:acc.client_id,submitted_amount:amount,payment_method:institution.name,sender_institution:institution.code,reference_number:referenceNumber,payment_date:paymentDate,receipt_path:receiptPath,extracted_reference:null,extracted_amount:null,extracted_transfer_fee:transferFee,net_amount:netAmount,entry_source:'manual',extracted_date:null,extracted_method:null,status:'pending',verification_snapshot:verificationSnapshot}).select('id').single();
    if(ins.error)throw ins.error;
    return res.status(201).json({ok:true,id:ins.data.id,verification:verificationSnapshot});
  }catch(e){return sendError(res,e)}
}
