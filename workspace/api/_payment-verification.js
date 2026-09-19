const RULES={
  'bdo':{name:'BDO Unibank',patterns:[/^MA_PC-[A-Za-z0-9]{8}-\d{6,8}$/,/^FT-[A-Za-z0-9]{8}-\d{6,8}$/],message:'BDO references must match the MA_PC-… mobile format or FT-… online format.'},
  'bdo-mobile':{name:'BDO Unibank',patterns:[/^MA_PC-[A-Za-z0-9]{8}-\d{6,8}$/],message:'BDO Mobile references must follow MA_PC- + 8 letters/numbers + - + 6 to 8 digits.'},
  'bdo-web':{name:'BDO Unibank',patterns:[/^FT-[A-Za-z0-9]{8}-\d{6,8}$/],message:'BDO Online references must follow FT- + 8 letters/numbers + - + 6 to 8 digits.'},
  'gcash':{name:'GCash',patterns:[/^\d{13}$/],message:'GCash reference numbers must contain exactly 13 numeric digits.'},
  'bpi':{name:'Bank of the Philippine Islands (BPI)',patterns:[/^[A-Za-z0-9]{13}$/],message:'BPI transaction references must contain exactly 13 letters or numbers.'},
  'maya':{name:'Maya',patterns:[/^[A-Za-z0-9]{12}$/],message:'Maya reference numbers must contain exactly 12 letters or numbers.'},
  'metrobank':{name:'Metrobank',patterns:[/^\d{12}$/],message:'Metrobank reference numbers must contain exactly 12 numeric digits.'},
  'landbank':{name:'Landbank',patterns:[/^\d{14,15}$/],message:'Landbank InstaPay references must contain 14 to 15 continuous numeric digits.'},
  'unionbank':{name:'UnionBank',patterns:[/^(UBP?)?[A-Za-z0-9]{10,15}$/],message:'UnionBank references must contain 10 to 15 letters or numbers, optionally beginning with UB or UBP.'},
  'pnb':{name:'Philippine National Bank (PNB)',patterns:[/^\d{14,15}$/],message:'PNB InstaPay references must contain 14 to 15 continuous numeric digits.'},
  'others':{name:'Other InstaPay Bank / E-Wallet',patterns:[/^\d{14,15}$/],message:'Other InstaPay references must contain 14 to 15 continuous numeric digits.'},
  /* Legacy-only sender codes retained so old pending submissions can still be reviewed. */
  'gotyme':{name:'GoTyme Bank',patterns:[/^[A-Za-z0-9]{12,15}$/],message:'GoTyme references must contain 12 to 15 letters or numbers.'},
  'maribank':{name:'MariBank',patterns:[/^\d{6,12}$/],message:'MariBank references must contain 6 to 12 numeric digits.'},
  'maribank-seabank':{name:'MariBank / SeaBank (legacy)',patterns:[/^\d{12,15}$/],message:'MariBank / SeaBank references must contain 12 to 15 numeric digits.'}
};
export function sanitizeReference(value){return String(value||'').replace(/\s+/g,'').trim()}
export function verifySubmissionShape(submission){
  const checks=[];const fail=(code,label,message)=>checks.push({code,label,ok:false,message}),pass=(code,label,message='Passed')=>checks.push({code,label,ok:true,message});
  const source=String(submission?.sender_institution||'').trim().toLowerCase(),rule=RULES[source],reference=sanitizeReference(submission?.reference_number||'');
  rule?pass('sender','Sending institution','Supported sender selected.'):fail('sender','Sending institution','Sending bank / e-wallet is missing or unsupported.');
  if(!reference)fail('reference','Reference number','Reference number is missing.');else if(rule&&!rule.patterns.some(p=>p.test(reference)))fail('reference','Reference number',rule.message);else if(rule)pass('reference','Reference number','Reference format matches the selected sender.');
  submission?.receipt_path?pass('receipt','Receipt','Receipt attached.'):fail('receipt','Receipt','Payment receipt is missing.');
  Number(submission?.submitted_amount||0)>0?pass('amount','Amount','Payment amount is valid.'):fail('amount','Amount','Payment amount must be greater than 0.');
  submission?.payment_date?pass('date','Payment date','Payment date is present.'):fail('date','Payment date','Payment date is missing.');
  return {passed:checks.every(x=>x.ok),checks,source,source_name:rule?.name||submission?.payment_method||'Unknown sender',reference};
}
export function rejectionReasons(){return [
  {code:'incorrect_reference',label:'Invalid reference number'},
  {code:'invalid_reference_format',label:'Reference format does not match sender'},
  {code:'unclear_receipt',label:'Receipt is unclear or unreadable'},
  {code:'receipt_mismatch',label:'Receipt does not match payment details'},
  {code:'amount_mismatch',label:'Amount does not match the receipt'},
  {code:'duplicate_reference',label:'Duplicate payment / reference'},
  {code:'wrong_sender',label:'Wrong sending bank / e-wallet'},
  {code:'date_mismatch',label:'Incorrect payment date'},
  {code:'could_not_verify',label:'Payment could not be verified'},
  {code:'other',label:'Other'}
]}
