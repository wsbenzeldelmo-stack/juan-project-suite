import {getConfig} from './config.js';
let client;
export async function getSupabase(){
  if(client)return client;
  const c=await getConfig();
  client=window.supabase.createClient(c.SUPABASE_URL,c.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  return client;
}
export async function session(){const sb=await getSupabase();return (await sb.auth.getSession()).data.session}
export async function signIn(email,password){const sb=await getSupabase();const r=await sb.auth.signInWithPassword({email,password});if(r.error)throw r.error;return r.data}
export async function setPassword(password){const sb=await getSupabase();const r=await sb.auth.updateUser({password});if(r.error)throw r.error;return r.data}
export async function changePasswordWithCurrent(email,currentPassword,newPassword){const sb=await getSupabase();const auth=await sb.auth.signInWithPassword({email,password:currentPassword});if(auth.error)throw new Error('Your current password is incorrect.');const r=await sb.auth.updateUser({password:newPassword});if(r.error)throw r.error;return r.data}
export async function sendPasswordReset(email){const sb=await getSupabase();const redirectTo=`${window.location.origin}/`;const r=await sb.auth.resetPasswordForEmail(email,{redirectTo});if(r.error)throw r.error;return r.data}
export async function signOut(){const sb=await getSupabase();await sb.auth.signOut()}
