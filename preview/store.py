"""Shared, transactional test store. This server is never deployed to Vercel."""
import sqlite3, json, uuid, secrets, hashlib, threading, re, math
from contextlib import contextmanager
from datetime import datetime, timezone, timedelta

def now(): return datetime.now(timezone.utc).isoformat()
def uid(): return str(uuid.uuid4())
def digest(t): return hashlib.sha256(str(t).encode()).hexdigest()
def money(v):
 x=float(v or 0)
 if not math.isfinite(x) or x<0: raise ValueError('Enter a valid non-negative amount.')
 return round(x,2)
STAGES=['Order Confirmed','Payment Confirmed','Production Started','In Production','Quality Check','Ready for Delivery','Completed']
class Store:
 def __init__(self,path):
  self.db=sqlite3.connect(str(path),check_same_thread=False); self.lock=threading.RLock(); self.depth=0
  self.db.execute('pragma journal_mode=WAL')
  self.db.execute('create table if not exists records (tbl text, id text, data text, primary key(tbl,id))')
  self.db.execute('create table if not exists meta (id integer primary key, rev integer)'); self.db.execute('insert or ignore into meta values(1,0)'); self.db.commit()
 @contextmanager
 def transaction(self):
  with self.lock:
   outer=self.depth==0
   if outer:self.db.execute('begin immediate')
   self.depth+=1
   try:
    yield
    if outer:self.db.commit()
   except Exception:
    if outer:self.db.rollback()
    raise
   finally:self.depth-=1
 def close(self): self.db.close()
 def revision(self):
  with self.lock: return self.db.execute('select rev from meta where id=1').fetchone()[0]
 def rows(self,table):
  with self.lock: return [json.loads(x[0]) for x in self.db.execute('select data from records where tbl=?',(table,)).fetchall()]
 def get(self,t,id): return next((r for r in self.rows(t) if str(r['id'])==str(id)),None)
 def put(self,t,row):
  row=dict(row); row.setdefault('id',uid()); row.setdefault('created_at',now()); row['updated_at']=now()
  self.db.execute('insert or replace into records values(?,?,?)',(t,str(row['id']),json.dumps(row)))
  self.db.execute('update meta set rev=rev+1 where id=1'); return row
 def code(self,t,prefix):
  return prefix+str(max([int(str(r.get('client_code') or r.get('project_code') or r.get('code') or '0').split('-')[-1]) for r in self.rows(t) if re.search(r'\d+$',str(r.get('client_code') or r.get('project_code') or r.get('code') or '0'))]+[0])+1).zfill(3)
 def audit(self,title,entity=''):
  self.put('portal_activity',{'id':uid(),'title':title,'entity':entity,'at':now()})
 def match(self,r,filters):
  for op,k,v in filters:
   a=r.get(k)
   if op=='eq' and str(a)!=str(v): return False
   if op=='neq' and str(a)==str(v): return False
   if op=='is' and a!=v: return False
   if op=='in' and str(a) not in map(str,v): return False
   if op=='ilike' and not re.fullmatch(re.escape(str(v)).replace('%','.*'),str(a or ''),re.I): return False
   if op=='gte' and (a is None or a<v): return False
   if op=='lte' and (a is None or a>v): return False
   if op=='not' and a is None: return False
  return True
 def query(self,q):
  with self.transaction():
   table=q['table']; op=q.get('op','select'); filtered=[r for r in self.rows(table) if self.match(r,q.get('filters',[]))]
   result=filtered
   if op in ('insert','upsert'):
    vals=q.get('values',[]); vals=vals if isinstance(vals,list) else [vals]; result=[]
    for value in vals:
     row=dict(value)
     if table=='clients' and op=='insert':
      duplicate=next((r for r in self.rows(table) if r.get('email','').lower()==row.get('email','').lower() and row.get('email')),None)
      if duplicate: raise ValueError('A client with this email already exists.')
     old=None
     if op=='upsert':
      keys=q.get('conflict','id').split(','); old=next((r for r in self.rows(table) if all(str(r.get(k))==str(row.get(k)) for k in keys)),None)
     if old: row={**old,**row,'id':old['id']}
     if table=='clients': row.setdefault('client_code',self.code(table,'CL-')); row.setdefault('classification','New')
     if table=='projects':
      row.setdefault('project_code',self.code(table,'JP-')); row.setdefault('deliverables',[])
      c=self.get('clients',row.get('client_id')) or {}
      for k in ('name','email','phone','address'): row.setdefault('client_'+k,c.get(k,''))
     result.append(self.put(table,row))
   elif op=='update': result=[self.put(table,{**r,**q.get('values',{})}) for r in filtered]
   elif op=='delete':
    for r in filtered: self.db.execute('delete from records where tbl=? and id=?',(table,str(r['id'])))
    self.db.execute('update meta set rev=rev+1 where id=1'); result=[]
   if table=='projects' and op=='select':
    for r in result:
     r['payments']=[p for p in self.rows('payments') if str(p.get('project_id'))==str(r['id']) and not p.get('deleted_at')]
     r['project_items']=[i for i in self.rows('project_items') if str(i.get('project_id'))==str(r['id'])]
     r['deliverables']=r.get('deliverables') or [d for d in self.rows('deliverables') if str(d.get('project_id'))==str(r['id'])]
   for key,asc in reversed(q.get('orders',[])): result.sort(key=lambda r:str(r.get(key) or ''),reverse=not asc)
   if q.get('limit') is not None: result=result[:q['limit']]
   count=len(result)
   if q.get('single'):
    if len(result)>1 or (not result and q['single']=='single'): raise ValueError('Expected one record.')
    result=result[0] if result else None
   return {'data':result,'error':None,'count':count}
 def catalog(self):
  return {'categories':self.rows('catalog_categories'),'services':[r for r in self.rows('catalog_services') if r.get('active',True)],'packages':[r for r in self.rows('catalog_packages') if r.get('active',True)],'packageItems':self.rows('catalog_package_items')}
 def portal(self,cid):
  client=self.get('clients',cid)
  if not client: raise ValueError('Client not found.')
  account=next((a for a in self.rows('portal_accounts') if a.get('client_id')==cid),{})
  if account.get('portal_enabled') is False: raise PermissionError('Portal access disabled.')
  projects=self.query({'table':'projects','filters':[['eq','client_id',cid]]})['data']
  for p in projects:
   p['items']=p.pop('project_items',[]); p['amount_paid']=sum(float(x.get('amount_paid',x.get('amount',0))) for x in p['payments']); p['balance']=max(0,round(float(p.get('total_amount',0))-p['amount_paid'],2))
   p['payment_status']='PAID' if p['balance']==0 else 'PARTIALLY PAID' if p['amount_paid'] else 'UNPAID'
   p['files_locked']=p['balance']>0 and not p.get('files_override')
   if p['files_locked']: p['drive_url']=None
   p['deliverables']=[d for d in p.get('deliverables',[]) if d.get('client_visible',True)]
  return {'profile':client,'passwordSet':True,'projects':projects,'paymentSettings':self.get('payment_settings',1),'paymentSubmissions':[s for s in self.rows('payment_submissions') if s.get('client_id')==cid]}
 def safe_order(self,o): return {k:o.get(k) for k in ('id','code','name','title','items','total','subtotal','rush_fee','created_at','status','review_note','project_code')}
 def token_order(self,t):
  o=next((r for r in self.rows('incoming_orders') if r.get('token_hash')==digest(t)),None)
  if not o: raise ValueError('Tracking link is invalid or has been revoked.')
  return o
 def action(self,b,actor):
  with self.transaction(): return self._action(b,actor)
 def _action(self,b,actor):
  action=b.get('action','dashboard')
  if action=='accept-invite':
   i=next((i for i in self.rows('invitations') if secrets.compare_digest(i.get('token',''),str(b.get('token','')))),None)
   if not i or i['status']=='revoked' or i.get('expires_at','')<now(): raise ValueError('Invitation is invalid, revoked or expired.')
   i['status']='accepted';self.put('invitations',i); return {'client_id':i['client_id']}
  if action=='submit-order':
   name=str(b.get('name','')).strip(); email=str(b.get('email','')).strip().lower(); title=str(b.get('title','')).strip(); key=str(b.get('key',''))
   if len(name)>160 or len(title)>160 or len(email)>254 or len(str(b.get('notes','')))>3000: raise ValueError('Please shorten the submitted details.')
   if not name or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email) or not title or not key: raise ValueError('Name, valid email and project title are required.')
   existing=next((o for o in self.rows('incoming_orders') if o.get('submission_key')==key),None)
   if existing: return {'order':self.safe_order(existing),'token':existing['test_token']}
   items=[]
   for item in b.get('items',[]):
    table='catalog_packages' if item.get('type')=='package' else 'catalog_services'; product=self.get(table,item.get('id'))
    if not product or product.get('active') is False: raise ValueError('An item is no longer available. Refresh the shop.')
    qty=int(item.get('qty',1))
    if qty<1 or qty>100 or qty!=float(item.get('qty',1)): raise ValueError('Quantity must be between 1 and 100.')
    price=money(product.get('new_price',product.get('selling_price',product.get('sellingPrice',product.get('price',0)))))
    inclusions=product.get('includedServiceNames',[])
    if table=='catalog_packages' and not inclusions:
     for inc in self.rows('catalog_package_items'):
      if inc.get('package_id')==product['id']:
       service=self.get('catalog_services',inc.get('service_id')); inclusions.append((service or {}).get('name') or inc.get('item_name') or inc.get('name') or 'Deliverable')
    items.append({'id':uid(),'catalog_id':product['id'],'name':product['name'],'type':item.get('type'),'price':price,'qty':qty,'includedItems':inclusions})
   if not items: raise ValueError('Choose at least one service or package.')
   subtotal=round(sum(i['price']*i['qty'] for i in items),2); rush=0
   if b.get('deadline'):
    try: days=(datetime.fromisoformat(b['deadline']).date()-datetime.now().date()).days
    except ValueError: raise ValueError('Invalid requested date.')
    if days<0: raise ValueError('Requested date cannot be in the past.')
    rush=math.ceil(max(0,14-days)/4)*500
   token=secrets.token_urlsafe(32)
   o=self.put('incoming_orders',{'id':uid(),'code':self.code('incoming_orders','GO-'),'name':name,'email':email,'phone':str(b.get('phone','')),'title':title,'notes':str(b.get('notes','')),'deadline':b.get('deadline'),'items':items,'subtotal':subtotal,'rush_fee':rush,'total':subtotal+rush,'status':'Order Received','submission_key':key,'token_hash':digest(token),'test_token':token})
   self.audit('Guest order received',o['code']); return {'order':self.safe_order(o),'token':token}
  if action=='track': return {'order':self.safe_order(self.token_order(b.get('token','')))}
  if action=='resubmit':
   o=self.token_order(b.get('token',''))
   if o['status']!='Needs Changes': raise ValueError('This order is not awaiting changes.')
   o.update(notes=str(b.get('notes','')),status='Order Received',review_note=''); self.put('incoming_orders',o); return {'order':self.safe_order(o)}
  if action=='ads':
   date=now()[:10]; return {'ads':[a for a in self.rows('promotions') if a.get('enabled') and (not a.get('start') or a['start']<=date) and (not a.get('end') or a['end']>=date) and a.get('audience','all') in ('all','guest' if actor=='guest' else 'client')]}
  if action=='client-card':
   if actor in ('guest','admin'): raise PermissionError('Select a client to view their card.')
   c=self.get('clients',actor)
   if not c: raise ValueError('Client not found.')
   if not c.get('qr_token'): c['qr_token']=secrets.token_urlsafe(24); self.put('clients',c)
   return {'client':{k:c.get(k) for k in ('name','client_code','qr_token','classification')}}
  if action=='submit-payment':
   if actor in ('guest','admin'): raise PermissionError('Client access required.')
   p=self.get('projects',b.get('projectId'))
   if not p or p.get('client_id')!=actor: raise PermissionError('Project not found for this client.')
   amount=money(b.get('amount')); fee=money(b.get('transferFee')); sender=b.get('senderInstitution'); ref=str(b.get('referenceNumber','')).strip(); config=self.get('suite_config',1) or {}; rules=config.get('rules',{})
   rule=rules.get(sender,r'^\d{6,12}$' if sender=='maribank' else r'^[A-Za-z0-9_-]{4,64}$')
   if amount<=0 or not b.get('receiptPath') or not b.get('paymentDate') or not sender or not re.fullmatch(rule,ref): raise ValueError('Check amount, proof, sender, date and reference. MariBank requires 6–12 digits.')
   paid=sum(float(x.get('amount_paid',0)) for x in self.rows('payments') if x.get('project_id')==p['id'] and not x.get('deleted_at'))
   if amount>float(p.get('total_amount',0))-paid+0.01: raise ValueError('Amount exceeds the current project balance.')
   try: datetime.strptime(str(b.get('paymentDate','')),'%Y-%m-%d')
   except ValueError: raise ValueError('Enter a valid payment date.')
   duplicate=next((x for x in self.rows('payment_submissions') if x.get('reference_number')==ref and x.get('sender_institution')==sender and x.get('status')!='rejected'),None)
   if duplicate: raise ValueError('This reference has already been submitted.')
   s=self.put('payment_submissions',{'id':uid(),'client_id':actor,'project_id':p['id'],'submitted_amount':amount,'net_amount':amount,'transfer_fee':fee,'extracted_transfer_fee':fee,'reference_number':ref,'sender_institution':sender,'payment_method':b.get('paymentMethod',sender),'payment_date':b.get('paymentDate'),'receipt_path':b.get('receiptPath'),'status':'pending','submitted_at':now()}); self.audit('Payment submitted',p.get('project_code')); return {'submission':s,'ok':True}
  if actor!='admin': raise PermissionError('Workspace administration required.')
  if action=='dashboard': return {t:self.rows(t) for t in ('incoming_orders','clients','projects','payment_submissions','portal_accounts','invitations','portal_activity','promotions','suite_config')}
  if action=='review-order':
   o=self.get('incoming_orders',b.get('id'))
   if not o or o.get('project_id'): raise ValueError('Order is missing or already converted.')
   if b.get('status') not in ('Under Review','Needs Changes'): raise ValueError('Invalid review status.')
   if b['status']=='Needs Changes' and not str(b.get('note','')).strip(): raise ValueError('Explain the changes needed.')
   o.update(status=b['status'],review_note=str(b.get('note',''))); self.put('incoming_orders',o); self.audit('Order '+o['status'],o['code']); return {'ok':True}
  if action=='convert':
   o=self.get('incoming_orders',b.get('id'))
   if not o: raise ValueError('Order not found.')
   if o.get('project_id'): return {'client':self.get('clients',o['client_id']),'project':self.get('projects',o['project_id'])}
   c=next((r for r in self.rows('clients') if r.get('email','').lower()==o['email']),None)
   if not c: c=self.query({'table':'clients','op':'insert','values':{'name':o['name'],'email':o['email'],'phone':o['phone']}})['data'][0]
   ds=[]
   for item in o['items']:
    for n in range(item['qty']):
     ds.append({'id':uid(),'item_name':item['name'],'order_item_id':item['id'],'completed':False,'status':'Pending','children':[{'id':uid(),'item_name':s,'completed':False} for s in item['includedItems']]})
   p=self.query({'table':'projects','op':'insert','values':{'client_id':c['id'],'title':o['title'],'total_amount':o['total'],'subtotal_amount':o['subtotal'],'rush_fee':o['rush_fee'],'priority':o['rush_fee']>0,'deadline_date':o.get('deadline'),'start_date':now()[:10],'status':'Pending','delivery_status':'Pending','tracker_stage':0,'milestones':[{'stage':0,'at':now()}],'deliverables':ds}})['data'][0]
   self.query({'table':'project_items','op':'insert','values':[{**i,'project_id':p['id']} for i in o['items']]})
   self.provision(c['id']); o.update(status='Approved',project_id=p['id'],project_code=p['project_code'],client_id=c['id']); self.put('incoming_orders',o); self.audit('Order approved and converted',o['code']); return {'client':c,'project':p}
  if action=='review-payment':
   s=self.get('payment_submissions',b.get('id') or b.get('submissionId'))
   if not s: raise ValueError('Payment submission not found.')
   decision=b.get('decision') or b.get('status')
   if decision=='accepted': decision='approved'
   if decision not in ('approved','rejected'): raise ValueError('Invalid payment decision.')
   if s['status']=='approved': return {'ok':True}
   if s['status']=='rejected': raise ValueError('A rejected submission cannot be approved; submit a new proof.')
   if decision=='rejected' and not str(b.get('reason') or b.get('note') or b.get('adminNote') or b.get('reasonCode') or '').strip(): raise ValueError('Rejection reason is required.')
   if decision=='approved':
    self.put('payments',{'id':'submission-'+s['id'],'project_id':s['project_id'],'amount_paid':s['submitted_amount'],'payment_date':s['payment_date'],'payment_method':s['payment_method'],'reference_no':s['reference_number']})
   s.update(status=decision,reviewed_at=now(),rejection_reason=b.get('reason') or b.get('note') or b.get('adminNote') or b.get('reasonCode') or ''); self.put('payment_submissions',s); self.audit('Payment '+decision,s['id']); return {'ok':True}
  if action=='save-project':
   p=self.get('projects',b.get('id'))
   if not p: raise ValueError('Project not found.')
   updates=b.get('updates',{})
   for k in ('drive_url','files_override','tracker_stage','deliverables'): 
    if k in updates: p[k]=updates[k]
   if p.get('drive_url') and not re.match(r'^https://(drive|docs)\.google\.com/',p['drive_url']): raise ValueError('Use a Google Drive URL.')
   if 'tracker_stage' in updates:
    stage=int(updates['tracker_stage'])
    if stage<0 or stage>=len(STAGES): raise ValueError('Invalid stage.')
    p.setdefault('milestones',[]).append({'stage':stage,'at':now()}); p['status']='Completed' if stage==6 else 'In Progress'; p['delivery_status']='Delivered' if stage==6 else 'Pending'
   self.put('projects',p); self.audit('Project tracking/files updated',p.get('project_code')); return {'ok':True}
  if action=='lookup':
   value=str(b.get('value','')).strip()
   if '#track=' in value: value=value.split('#track=',1)[1]
   if '#client=' in value: value=value.split('#client=',1)[1]
   for c in self.rows('clients'):
    if value in (c.get('client_code'),c.get('qr_token')): return {'kind':'client','record':c}
   for o in self.rows('incoming_orders'):
    if value==o['code'] or digest(value)==o['token_hash']: return {'kind':'order','record':self.safe_order(o)}
   raise ValueError('No matching client or order.')
  if action=='classify':
   c=self.get('clients',b.get('id'))
   if not c or b.get('value') not in ('New','Returning','Loyal','VIP'): raise ValueError('Invalid client classification.')
   c['classification']=b['value']; self.put('clients',c); return {'ok':True}
  if action=='save-ad':
   a=dict(b.get('ad',{})); a['id']=a.get('id') or uid()
   if not str(a.get('title','')).strip(): raise ValueError('Ad title required.')
   for k in ('url','image'):
    if a.get(k) and not re.match(r'^https?://',a[k]): raise ValueError('Use an HTTP or HTTPS URL.')
   self.put('promotions',a); return {'ok':True}
  if action=='delete-ad': self.query({'table':'promotions','op':'delete','filters':[['eq','id',b['id']]]}); return {'ok':True}
  if action=='configure':
   cfg=dict(b.get('config',{})); cfg['id']=1
   for rule in cfg.get('rules',{}).values():
    if len(rule)>150: raise ValueError('Reference rule too long.')
    re.compile(rule)
   cfg.setdefault('rules',{})['maribank']=r'^\d{6,12}$'; self.put('suite_config',cfg); return {'ok':True}
  if action=='invite':
   if not self.get('clients',b.get('id')): raise ValueError('Client not found.')
   self.provision(b['id']); i=self.put('invitations',{'id':uid(),'client_id':b['id'],'token':secrets.token_urlsafe(24),'status':'pending','expires_at':(datetime.now(timezone.utc)+timedelta(days=7)).isoformat(),'mode':'test link — no email sent'}); self.audit('Invitation created',b['id']); return {'invitation':i}
  if action=='revoke-invite':
   i=self.get('invitations',b.get('id'))
   if not i: raise ValueError('Invitation not found.')
   i['status']='revoked'; self.put('invitations',i); return {'ok':True}
  raise ValueError('Unsupported action: '+str(action))
 def provision(self,cid):
  a=next((a for a in self.rows('portal_accounts') if a.get('client_id')==cid),None)
  return a or self.put('portal_accounts',{'id':uid(),'auth_user_id':cid,'client_id':cid,'password_set':True,'portal_enabled':True,'mode':'test'})
