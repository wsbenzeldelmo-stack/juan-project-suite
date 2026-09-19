import unittest,tempfile,threading,sys,json,urllib.request,urllib.error
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'preview'))
from store import Store
from server import Handler,ThreadingHTTPServer
class HTTPTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.store=Store(Path(self.tmp.name)/'s.sqlite');self.servers=[]
  for app in ('workspace','online'):
   s=ThreadingHTTPServer(('127.0.0.1',0),Handler);s.app=app;s.store=self.store;s.data_dir=Path(self.tmp.name);s.workspace_port=8765;s.online_port=8766;self.servers.append(s);threading.Thread(target=s.serve_forever,daemon=True).start()
 def tearDown(self):
  for s in self.servers:s.shutdown();s.server_close()
  self.store.close();self.tmp.cleanup()
 def request(self,app,path,body=None,headers=None,raw=None):
  port=self.servers[0 if app=='workspace' else 1].server_port; data=json.dumps(body).encode() if body is not None else raw
  req=urllib.request.Request(f'http://127.0.0.1:{port}'+path,data=data,headers={'Content-Type':'application/json' if body is not None else 'application/octet-stream',**(headers or {})})
  try:
   with urllib.request.urlopen(req) as r: return r.status,r.read(),r.headers
  except urllib.error.HTTPError as e:return e.code,e.read(),e.headers
 def test_shared_order_conversion_and_client_view(self):
  status,data,_=self.request('workspace','/test/query',{'table':'catalog_services','op':'insert','values':{'id':'s','name':'Test service','price':1000,'active':True}});self.assertEqual(status,200)
  status,data,_=self.request('online','/api/suite',{'action':'submit-order','key':'http-test','name':'Example','email':'example@example.com','title':'Test','items':[{'id':'s','qty':1}]}); self.assertEqual(status,200);order=json.loads(data)['order']
  status,data,_=self.request('workspace','/api/suite',{'action':'convert','id':order['id']}); self.assertEqual(status,200);converted=json.loads(data)
  status,data,_=self.request('online','/api/portal-data',headers={'Authorization':'Bearer test:'+converted['client']['id']});self.assertEqual(status,200);self.assertEqual(json.loads(data)['projects'][0]['project_code'],converted['project']['project_code'])
 def test_guest_query_denied(self):self.assertEqual(self.request('online','/test/query',{'table':'clients'})[0],403)
 def test_preview_mutation_denied(self):self.assertEqual(self.request('online','/api/payment-submission',{},headers={'X-Juan-Preview':'1'})[0],403)
 def test_cross_origin_mutation_denied(self):self.assertEqual(self.request('workspace','/test/query',{'table':'clients'},headers={'Origin':'https://example.com'})[0],403)
 def test_static_ui_injects_only_test_runtime(self):
  for app in ('workspace','online'):
   status,data,_=self.request(app,'/');self.assertEqual(status,200);self.assertIn(b'JUAN_TEST_CONFIG',data);self.assertIn(b'/test/static/suite.js',data)
 def test_qr_renders(self):
  status,data,headers=self.request('online','/test/qr.svg?text=hello');self.assertEqual(status,200);self.assertIn(b'<svg',data);self.assertEqual(headers['Content-Type'],'image/svg+xml')
if __name__=='__main__':unittest.main()
