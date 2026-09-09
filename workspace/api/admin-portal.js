import { requireAdmin, sendError } from './_lib.js';

export default async function handler(req, res) {
  try {
    const { svc, user } = await requireAdmin(req);
    if (req.method === 'GET') {
      const [submissions, settings, projects, deliverables] = await Promise.all([
        svc.from('payment_submissions').select('*').order('submitted_at', { ascending: false }).limit(100),
        svc.from('payment_settings').select('*').eq('id', 1).maybeSingle(),
        svc.from('projects').select('id,title,client_id,project_code,status').order('id'),
        svc.from('deliverables').select('id,project_id,item_name,shared_drive_url,client_visible,due_date,completed').order('project_id')
      ]);
      const ids = [...new Set((submissions.data || []).map(x => x.client_id).filter(Boolean))];
      const clients = ids.length ? await svc.from('clients').select('id,name,email,client_code').in('id', ids) : { data: [] };
      const safeSubmissions = await Promise.all((submissions.data || []).map(async submission => {
        let receipt_url = null;
        if (submission.receipt_path) {
          const signed = await svc.storage.from('payment-receipts').createSignedUrl(submission.receipt_path, 300);
          if (!signed.error) receipt_url = signed.data?.signedUrl || null;
        }
        return { ...submission, receipt_url };
      }));
      res.setHeader('Cache-Control', 'private, no-store');
      return res.status(200).json({
        submissions: safeSubmissions,
        settings: settings.data || null,
        projects: projects.data || [],
        deliverables: deliverables.data || [],
        clients: clients.data || []
      });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const body = req.body || {};

    if (body.action === 'review-payment') {
      const id = String(body.id || '');
      const decision = body.decision === 'approved' ? 'approved' : body.decision === 'rejected' ? 'rejected' : '';
      if (!id || !decision) return res.status(400).json({ error: 'Invalid payment review request.' });
      const review = await svc.rpc('review_juan_payment_submission', {
        p_submission_id: id,
        p_decision: decision,
        p_admin_user: user.id,
        p_reason: decision === 'rejected' ? String(body.reason || '').slice(0,500) : null
      });
      if (review.error) {
        const message = String(review.error.message || 'Payment review failed.');
        const status = /already reviewed/i.test(message) ? 409 : /balance/i.test(message) ? 409 : 400;
        return res.status(status).json({ error: message });
      }
      return res.status(200).json({ ok: true, status: review.data });
    }

    if (body.action === 'save-delivery-link') {
      const id = String(body.deliverableId || '');
      if (!id) return res.status(400).json({ error: 'Deliverable is required.' });
      const drive = String(body.url || '').trim();
      if (drive && !/^https:\/\/(drive|docs)\.google\.com\//i.test(drive)) return res.status(400).json({ error: 'Enter a valid Google Drive link.' });
      const upd = await svc.from('deliverables').update({
        shared_drive_url: drive || null,
        client_visible: body.clientVisible !== false
      }).eq('id', id);
      if (upd.error) throw upd.error;
      return res.status(200).json({ ok: true });
    }

    if (body.action === 'save-payment-settings') {
      const payload = {
        id: 1,
        method_label: String(body.methodLabel || 'GCash').slice(0,80),
        account_name: String(body.accountName || '').slice(0,120),
        account_number: String(body.accountNumber || '').slice(0,80),
        qr_image_url: String(body.qrImageUrl || '').slice(0,1000),
        instructions: String(body.instructions || '').slice(0,1000),
        updated_at: new Date().toISOString()
      };
      const upsert = await svc.from('payment_settings').upsert(payload);
      if (upsert.error) throw upsert.error;
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (e) { return sendError(res, e); }
}
