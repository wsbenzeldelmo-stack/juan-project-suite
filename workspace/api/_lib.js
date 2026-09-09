import { createClient } from '@supabase/supabase-js';

export function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server Supabase credentials are not configured.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function publicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Public Supabase credentials are not configured.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function bearer(req) {
  const value = req.headers.authorization || '';
  return value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : '';
}

export async function requireUser(req) {
  const token = bearer(req);
  if (!token) throw Object.assign(new Error('Authentication required.'), { status: 401 });
  const svc = serviceClient();
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data?.user) throw Object.assign(new Error('Invalid or expired session.'), { status: 401 });
  return { user: data.user, svc, token };
}

export async function requireAdmin(req) {
  const ctx = await requireUser(req);
  const { data, error } = await ctx.svc.from('user_roles').select('role').eq('auth_user_id', ctx.user.id).maybeSingle();
  if (error || data?.role !== 'admin') throw Object.assign(new Error('Admin authorization required.'), { status: 403 });
  return ctx;
}

function makeLegacyClientId(userId) {
  return `client_${Date.now()}_${String(userId).replace(/-/g,'').slice(0,8)}`;
}

export async function ensurePortalAccount(user, svc) {
  let { data: account, error } = await svc.from('portal_accounts').select('*').eq('auth_user_id', user.id).maybeSingle();
  if (error) throw error;
  if (account) return account;

  const email = String(user.email || '').trim().toLowerCase();
  if (!email) throw new Error('Authenticated account has no email address.');

  let { data: client, error: clientError } = await svc.from('clients').select('id,name,email,phone,address,client_code').ilike('email', email).limit(1).maybeSingle();
  if (clientError) throw clientError;

  if (!client) {
    const fullName = String(user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0]).trim();
    const newClient = { id: makeLegacyClientId(user.id), name: fullName, email, phone: '', address: '' };
    const inserted = await svc.from('clients').insert(newClient).select('id,name,email,phone,address,client_code').single();
    if (inserted.error) throw inserted.error;
    client = inserted.data;
  }

  const createdWithPassword = user.user_metadata?.created_with_password === true;
  const insertedAccount = await svc.from('portal_accounts').insert({
    auth_user_id: user.id,
    client_id: client.id,
    password_set: createdWithPassword
  }).select('*').single();
  if (insertedAccount.error) throw insertedAccount.error;
  return insertedAccount.data;
}

export function sendError(res, error) {
  console.error(error);
  return res.status(error?.status || 500).json({ error: error?.message || 'Unexpected server error.' });
}
