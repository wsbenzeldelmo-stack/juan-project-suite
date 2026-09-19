import sys, tempfile, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'preview'))
try:
 from store import Store
except ImportError:
 Store=None
class SharedPreviewTests(unittest.TestCase):
 def setUp(self):
  self.assertIsNotNone(Store,'Shared store must exist')
  self.tmp=tempfile.TemporaryDirectory(); self.s=Store(Path(self.tmp.name)/'test.sqlite')
  self.s.query({'table':'catalog_services','op':'insert','values':{'id':'service1','name':'Stinger','price':500,'active':True,'product_code':'SRV-001'}})
 def tearDown(self):
  if hasattr(self,'s'): self.s.close(); self.tmp.cleanup()
 def order(self):
  return self.s.action({'action':'submit-order','key':'once','name':'Test Client','email':'client@example.com','title':'Broadcast','items':[{'id':'service1','type':'service','qty':2}]},'guest')
 def test_shared_durable_store(self):
  self.order(); other=Store(Path(self.tmp.name)/'test.sqlite')
  self.assertEqual(len(other.rows('incoming_orders')),1); other.close()
 def test_canonical_price_and_duplicate_submission(self):
  a=self.order(); b=self.order(); self.assertEqual(a['order']['id'],b['order']['id']); self.assertEqual(a['order']['total'],1000)
 def test_token_required(self):
  a=self.order()
  with self.assertRaises(ValueError): self.s.action({'action':'track','token':a['order']['code']},'guest')
  self.assertEqual(self.s.action({'action':'track','token':a['token']},'guest')['order']['status'],'Order Received')
 def test_conversion_is_idempotent(self):
  a=self.order()['order']; x=self.s.action({'action':'convert','id':a['id']},'admin'); y=self.s.action({'action':'convert','id':a['id']},'admin')
  self.assertEqual(x['project']['id'],y['project']['id']); self.assertEqual(len(self.s.rows('clients')),1); self.assertEqual(len(self.s.rows('projects')),1)
 def test_guest_cannot_admin(self):
  with self.assertRaises(PermissionError): self.s.action({'action':'convert','id':'anything'},'guest')
 def test_payment_fee_not_deducted_and_approval_once(self):
  c=self.s.action({'action':'convert','id':self.order()['order']['id']},'admin'); cid=c['client']['id']; pid=c['project']['id']
  p=self.s.action({'action':'submit-payment','projectId':pid,'amount':500,'transferFee':10,'senderInstitution':'maribank','referenceNumber':'123456','paymentDate':'2026-09-19','receiptPath':'test-proof.png'},cid)
  for _ in range(2): self.s.action({'action':'review-payment','id':p['submission']['id'],'decision':'approved'},'admin')
  self.assertEqual(len(self.s.rows('payments')),1); self.assertEqual(self.s.portal(cid)['projects'][0]['balance'],500)
 def test_bad_mari_reference(self):
  c=self.s.action({'action':'convert','id':self.order()['order']['id']},'admin')
  with self.assertRaises(ValueError): self.s.action({'action':'submit-payment','projectId':c['project']['id'],'amount':100,'senderInstitution':'maribank','referenceNumber':'12345','receiptPath':'proof','paymentDate':'2026-09-19'},c['client']['id'])
 def test_files_lock_hides_url(self):
  c=self.s.action({'action':'convert','id':self.order()['order']['id']},'admin')
  self.s.query({'table':'projects','op':'update','values':{'drive_url':'https://drive.google.com/secret'},'filters':[['eq','id',c['project']['id']]]})
  self.assertIsNone(self.s.portal(c['client']['id'])['projects'][0]['drive_url'])
if __name__=='__main__': unittest.main()
