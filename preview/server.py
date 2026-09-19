#!/usr/bin/env python3
"""Run both original apps against one SQLite database. Loopback only, no cloud login."""
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit,parse_qs,unquote
import argparse,json,mimetypes,threading,traceback,os,uuid,base64
from store import Store,now
ROOT=Path(__file__).resolve().parents[1]
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args): pass
 def send(self,status,data,kind='application/json'):
  if not isinstance(data,bytes): data=(json.dumps(data) if kind=='application/json' else data).encode()
  self.send_response(status); self.send_header('Content-Type',kind); self.send_header('Content-Length',str(len(data))); self.send_header('Cache-Control','no-store'); self.send_header('X-Content-Type-Options','nosniff'); self.end_headers(); self.wfile.write(data)
 def do_GET(self): self.handle_request()
 def do_POST(self): self.handle_request()
 def do_DELETE(self): self.handle_request()
 def handle_request(self):
  try:
   host=self.headers.get('Host',''); allowed={f'localhost:{self.server.server_port}',f'127.0.0.1:{self.server.server_port}'}
   if host not in allowed: return self.send(403,{'error':'Test server is available only through localhost.'})
   origin=self.headers.get('Origin')
   if origin and origin not in {'http://'+h for h in allowed}: return self.send(403,{'error':'Cross-origin request refused.'})
   length=int(self.headers.get('Content-Length',0))
   if length>8*1024*1024: return self.send(413,{'error':'Maximum upload size is 8 MB.'})
   raw=self.rfile.read(length) if length else b''; body=json.loads(raw) if raw and 'application/json' in self.headers.get('Content-Type','') else {}
   parsed=urlsplit(self.path); path=unquote(parsed.path); qs=parse_qs(parsed.query); store=self.server.store; admin=self.server.app=='workspace'; actor='admin' if admin else self.headers.get('Authorization','').removeprefix('Bearer ').removeprefix('test:') or 'guest'
   if self.headers.get('X-Juan-Preview')=='1' and self.command!='GET' and not (path=='/api/suite' and body.get('action') in ('track','ads','client-card')):
    raise PermissionError('Client preview is read-only. Switch to a test client to submit changes.')
   if path=='/test/runtime.js': return self.send(200,(ROOT/'preview/runtime.js').read_bytes(),'text/javascript')
   if path.startswith('/test/static/'):
    p=(ROOT/'preview'/path.removeprefix('/test/static/')).resolve()
    if p.parent!=ROOT/'preview' or p.suffix not in ('.js','.css'): return self.send(404,{'error':'Not found'})
    return self.send(200,p.read_bytes(),mimetypes.guess_type(str(p))[0] or 'text/plain')
   if path=='/test/revision': return self.send(200,{'revision':store.revision()})
   if path=='/test/config': return self.send(200,store.get('suite_config',1) or {})
   if path=='/test/clients': return self.send(200,{'clients':[{k:c.get(k) for k in ('id','name','client_code')} for c in store.rows('clients')]})
   if path=='/test/qr.svg':
    from qrencoder import QRCode, QRErrorCorrectLevel
    text=qs.get('text',[''])[0]
    if len(text)>1000: raise ValueError('QR content too long.')
    qr=QRCode(None,QRErrorCorrectLevel.M); qr.addData(text); qr.make(); size=qr.getModuleCount(); rects=[]
    for y in range(size):
     for x in range(size):
      if qr.isDark(y,x): rects.append(f'M{x+4} {y+4}h1v1h-1z')
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size+8} {size+8}"><rect width="100%" height="100%" fill="white"/><path d="{"".join(rects)}" fill="black"/></svg>'
    return self.send(200,svg,'image/svg+xml')
   if path=='/test/query':
    if not admin: raise PermissionError('Workspace only.')
    return self.send(200,store.query(body))
   if path=='/test/rpc':
    if not admin: raise PermissionError('Workspace only.')
    if body.get('name')!='jp_replace_project_items': raise ValueError('Unsupported test RPC.')
    args=body['args']; pid=args['p_project_id']
    with store.transaction():
     store.query({'table':'project_items','op':'delete','filters':[['eq','project_id',pid]]})
     result=store.query({'table':'project_items','op':'insert','values':[{**i,'project_id':pid} for i in args['p_items']]})
    return self.send(200,result)
   if path=='/test/upload':
    if actor=='guest': raise PermissionError('Client or Workspace access required.')
    name=str(uuid.uuid4())+Path(qs.get('path',['file'])[0]).suffix.lower(); p=self.server.data_dir/'uploads'/name; p.parent.mkdir(exist_ok=True); p.write_bytes(raw)
    return self.send(200,{'data':{'path':name},'error':None})
   if path.startswith('/test/uploads/'):
    name=Path(path).name; p=self.server.data_dir/'uploads'/name
    if not p.is_file(): return self.send(404,{'error':'Proof not found.'})
    return self.send(200,p.read_bytes(),mimetypes.guess_type(str(p))[0] or 'application/octet-stream')
   if path=='/test/export':
    if not admin: raise PermissionError('Workspace only.')
    tables=[x[0] for x in store.db.execute('select distinct tbl from records')]
    return self.send(200,{'format':'juan-shared-preview-v1','exported_at':now(),'tables':{t:store.rows(t) for t in tables}})
   if path=='/api/suite':
    if body.get('action')=='submit-payment': self.check_proof(body)
    return self.send(200,store.action(body,actor))
   if path=='/api/catalog': return self.send(200,store.catalog())
   if path=='/api/portal-data':
    if actor in ('guest','admin'): raise PermissionError('Choose a test client from the top bar.')
    return self.send(200,store.portal(actor))
   if path=='/api/payment-submission':
    self.check_proof(body); return self.send(200,store.action({**body,'action':'submit-payment'},actor))
   if path=='/api/account': return self.send(200,{'ok':True})
   if path=='/api/drafts':
    if not admin: raise PermissionError('Workspace only.')
    if self.command=='GET': return self.send(200,{'drafts':store.rows('order_drafts')})
    if body.get('action')=='delete': store.query({'table':'order_drafts','op':'delete','filters':[['eq','id',body['id']]]}); return self.send(200,{'ok':True})
    row={k:v for k,v in body.items() if k!='action'}; return self.send(200,{'draft':store.query({'table':'order_drafts','op':'upsert','values':row})['data'][0]})
   if path=='/api/admin-portal':
    if not admin: raise PermissionError('Workspace only.')
    if self.command=='GET':
     clients=store.rows('clients'); accounts=store.rows('portal_accounts'); subs=store.rows('payment_submissions')
     for s in subs:
      s['receipt_url']='/test/uploads/'+Path(s.get('receipt_path','')).name; s['verification']={'valid':True,'errors':[]}; s['client_name']=next((c['name'] for c in clients if c['id']==s['client_id']),'Client')
     rows=[{**c,**next((a for a in accounts if a['client_id']==c['id']),{}),'id':c['id'],'client_id':c['id'],'portal_enabled':True,'password_set':True} for c in clients]
     return self.send(200,{'accounts':rows,'clientAccounts':[{**r,'status':'active' if r.get('portal_enabled') else 'disabled'} for r in rows],'clients':clients,'submissions':subs,'paymentSubmissions':subs,'settings':store.get('payment_settings',1),'projects':store.query({'table':'projects'})['data'],'activity':store.rows('portal_activity'),'accountSnapshot':{'rows':rows}})
    a=body.get('action')
    if a in ('reconcile-client-profile','reconcile-project-client'):
     project=store.get('projects',body.get('projectId')) if a=='reconcile-project-client' else None
     cid=body.get('clientId') or (project or {}).get('client_id'); client=store.get('clients',cid)
     if not client: raise ValueError('Client not found.')
     fields={k:body[k] for k in ('name','email','phone','address') if k in body}
     client=store.query({'table':'clients','op':'update','filters':[['eq','id',cid]],'values':fields})['data'][0]
     return self.send(200,{'ok':True,'client':client})
    if a=='delete-payment-review':
     submission=store.get('payment_submissions',body.get('id'))
     if submission and submission['status']=='approved': raise ValueError('Approved payments remain in payment history.')
     store.query({'table':'payment_submissions','op':'delete','filters':[['eq','id',body.get('id')]]});return self.send(200,{'ok':True})
    if a=='review-payment': return self.send(200,store.action(body,'admin'))
    if a=='save-project-drive-link': return self.send(200,store.action({'action':'save-project','id':body['projectId'],'updates':{'drive_url':body.get('url','')}},'admin'))
    if a=='save-payment-settings':
     row={k:v for k,v in body.items() if k!='action'}; row['id']=1; store.query({'table':'payment_settings','op':'upsert','values':row}); return self.send(200,{'ok':True})
    if a in ('provision-client-account','provision-all-clients'):
     with store.transaction():
      for c in store.rows('clients'):
       if a.endswith('all-clients') or c['id']==body.get('clientId'): store.provision(c['id'])
     return self.send(200,{'ok':True})
    if a=='set-client-access':
     store.query({'table':'portal_accounts','op':'update','filters':[['eq','client_id',body['clientId']]],'values':{'portal_enabled':bool(body.get('enabled',body.get('portalEnabled',True)))}}); return self.send(200,{'ok':True})
    raise ValueError('This account-management action requires the future Supabase deployment: '+str(a))
   if path.startswith('/api/'): return self.send(503,{'error':'This endpoint is not available in shared test mode.'})
   if path=='/sw.js': return self.send(200,"self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.registration.unregister()));",'text/javascript')
   p=(ROOT/self.server.app/path.lstrip('/')).resolve()
   if not p.is_relative_to(ROOT/self.server.app): raise PermissionError('Invalid path.')
   if p.is_dir(): p=p/'index.html'
   if not p.is_file(): return self.send(404,'Not found','text/plain')
   data=p.read_bytes()
   if p.suffix=='.html':
    text=data.decode(); import re
    text=re.sub(r'<script[^>]+src="https://cdn\.jsdelivr\.net/npm/@supabase/[^>]+></script>','',text)
    cfg=json.dumps({'app':self.server.app,'workspacePort':self.server.workspace_port,'onlinePort':self.server.online_port})
    injection=f'<script>window.JUAN_TEST_CONFIG={cfg};</script><script src="/test/runtime.js"></script><link rel="stylesheet" href="/test/static/suite.css"><script defer src="/test/static/jsQR.js"></script><script defer src="/test/static/suite.js"></script>'
    data=text.replace('</head>',injection+'</head>').encode()
   return self.send(200,data,mimetypes.guess_type(str(p))[0] or 'application/octet-stream')
  except PermissionError as e: self.send(403,{'error':str(e)})
  except (ValueError,KeyError) as e: self.send(400,{'error':str(e)})
  except Exception as e: traceback.print_exc(); self.send(500,{'error':str(e)})
 def check_proof(self,b):
  name=Path(str(b.get('receiptPath',''))).name
  if not name or not (self.server.data_dir/'uploads'/name).is_file(): raise ValueError('Upload a proof before submitting.')
def main():
 parser=argparse.ArgumentParser(description=__doc__); parser.add_argument('--workspace-port',type=int,default=8765); parser.add_argument('--online-port',type=int,default=8766); parser.add_argument('--data-dir',type=Path,default=ROOT/'preview-data'); args=parser.parse_args(); args.data_dir.mkdir(exist_ok=True,parents=True); store=Store(args.data_dir/'suite.sqlite')
 for app,port in [('workspace',args.workspace_port),('online',args.online_port)]:
  server=ThreadingHTTPServer(('127.0.0.1',port),Handler); server.app=app; server.store=store; server.data_dir=args.data_dir; server.workspace_port=args.workspace_port; server.online_port=args.online_port
  threading.Thread(target=server.serve_forever,daemon=True).start(); print(f'{app.title()}: http://localhost:{port}',flush=True)
 print('Shared test mode. Both apps use the same persistent store. Ctrl+C to stop.',flush=True)
 try: threading.Event().wait()
 except KeyboardInterrupt: pass
if __name__=='__main__': main()
