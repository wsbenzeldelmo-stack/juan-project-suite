import {session} from './auth.js';
export async function api(path,options={}){const s=await session();if(!s)throw Error('Please sign in again.');const headers={...(options.headers||{}),Authorization:`Bearer ${s.access_token}`};if(options.body&&!headers['Content-Type']&&typeof options.body==='string')headers['Content-Type']='application/json';const r=await fetch(path,{...options,headers});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'Request failed');return j}
export const getPortal=()=>api('/api/portal-data');
export const markPasswordSet=()=>api('/api/account',{method:'POST',body:JSON.stringify({action:'password-set'})});
