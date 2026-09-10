const RULES={
  'gcash':{name:'GCash',pattern:/^\d{13}$/,message:'GCash reference numbers must contain exactly 13 numeric digits.'},
  'bpi':{name:'BPI (BPI Online/App)',pattern:/^[A-Za-z0-9]{13}$/,message:'BPI transaction references must contain exactly 13 letters or numbers.'},
  'bdo-mobile':{name:'BDO (Mobile App)',pattern:/^MA_PC-[A-Za-z0-9]{8}-\d{6,8}$/,message:'BDO Mobile references must follow MA_PC- + 8 letters/numbers + - + 6 to 8 digits.'},
  'bdo-web':{name:'BDO (Online Web)',pattern:/^FT-[A-Za-z0-9]{8}-\d{6,8}$/,message:'BDO Online references must follow FT- + 8 letters/numbers + - + 6 to 8 digits.'},
  'maya':{name:'Maya (PayMaya)',pattern:/^[A-Za-z0-9]{12}$/,message:'Maya reference numbers must contain exactly 12 letters or numbers.'},
  'metrobank':{name:'Metrobank',pattern:/^\d{12}$/,message:'Metrobank reference numbers must contain exactly 12 numeric digits.'},
  'landbank':{name:'Landbank',pattern:/^\d{14,15}$/,message:'Landbank InstaPay references must contain 14 to 15 continuous numeric digits.'},
  'unionbank':{name:'UnionBank (Intra-bank)',pattern:/^(UBP?)?[A-Za-z0-9]{10,15}$/,message:'UnionBank references must contain 10 to 15 letters or numbers, optionally beginning with UB or UBP.'},
  'gotyme':{name:'GoTyme Bank',pattern:/^[A-Za-z0-9]{12,15}$/,message:'GoTyme references must contain 12 to 15 letters or numbers.'},
  'maribank-seabank':{name:'MariBank / SeaBank',pattern:/^\d{12,15}$/,message:'MariBank / SeaBank references must contain 12 to 15 numeric digits.'}
};
export function sanitizeReference(value){return String(value||'').replace(/\s+/g,'').trim()}
export function verifySubmissionShape(submission){
  const checks=[];const fail=(code,label,message)=>checks.push({code,label,ok:false,message}),pass=(code,label)=>checks.push({code,label,ok:true,message:'Passed'});
  const source=String(submission?.sender_institution||'').trim().toLowerCase(),rule=RULES[source],reference=sanitizeReference(submission?.reference_number||'');
  rule?pass('sender','Sending institution'):fail('sender','Sending institution','Sending bank / e-wallet is missing or unsupported.');
  if(!reference)fail('reference','Reference number','Reference number is missing.');else if(rule&&!rule.pattern.test(reference))fail('reference','Reference number',rule.message);else if(rule)pass('reference','Reference number');
  submission?.receipt_path?pass('receipt','Receipt'):fail('receipt','Receipt','Payment receipt is missing.');
  Number(submission?.submitted_amount||0)>0?pass('amount','Amount'):fail('amount','Amount','Payment amount must be greater than 0.');
  submission?.payment_date?pass('date','Payment date'):fail('date','Payment date','Payment date is missing.');
  return {passed:checks.every(x=>x.ok),checks,source,source_name:rule?.name||submission?.payment_method||'Unknown sender',reference};
}
export function rejectionReasons(){return [
  {code:'incorrect_reference',label:'Incorrect reference number'},
  {code:'invalid_reference_format',label:'Reference format does not match selected bank'},
  {code:'unclear_receipt',label:'Receipt is unclear or unreadable'},
  {code:'receipt_mismatch',label:'Receipt does not match payment details'},
  {code:'amount_mismatch',label:'Amount does not match the receipt'},
  {code:'wrong_sender',label:'Incorrect sending bank / e-wallet selected'},
  {code:'duplicate_reference',label:'Duplicate payment / reference'},
  {code:'date_mismatch',label:'Payment date does not match receipt'},
  {code:'could_not_verify',label:'Payment could not be verified'},
  {code:'other',label:'Other'}
]}
