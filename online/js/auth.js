import {getConfig} from './config.js';
let client;export async function getSupabase(){if(client)return client;const c=await getConfig();client=window.supabase.createClient(c.SUPABASE_URL,c.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});return client}
export async function session(){const sb=await getSupabase();return (await sb.auth.getSession()).data.session}
export async function signIn(email,password){const sb=await getSupabase();const r=await sb.auth.signInWithPassword({email,password});if(r.error)throw r.error;return r.data}
export async function signUp({name,email,password}){const sb=await getSupabase();const r=await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin,userMetadata:{full_name:name,created_with_password:true},data:{full_name:name,created_with_password:true}}});if(r.error)throw r.error;return r.data}
export async function requestFirstAccess(email){const check=await fetch('/api/start-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const result=await check.json();if(!check.ok)throw Error(result.error||'Could not start access');return result}
export async function setPassword(password){const sb=await getSupabase();const r=await sb.auth.updateUser({password});if(r.error)throw r.error;return r.data}
export async function signOut(){const sb=await getSupabase();await sb.auth.signOut()}
