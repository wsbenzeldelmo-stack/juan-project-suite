import QRCode from 'qrcode';

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).send('Method not allowed');
  const text=String(req.query?.text||'').slice(0,2048);
  if(!text)return res.status(400).send('Missing text');
  try{
    const svg=await QRCode.toString(text,{type:'svg',margin:1,width:512,errorCorrectionLevel:'M'});
    res.setHeader('Content-Type','image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control','private, max-age=300');
    res.setHeader('X-Content-Type-Options','nosniff');
    return res.status(200).send(svg);
  }catch(e){
    console.error(e);return res.status(500).send('QR generation failed');
  }
}
