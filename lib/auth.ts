import { one, database } from './database';
export class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
export async function digest(value:string){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));}
export async function passwordHash(password:string,salt:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256));}
export async function checkPassword(password:string,stored:string){const [salt,hash]=stored.split(':');const actual=await passwordHash(password,salt);let diff=actual.length^hash.length;for(let i=0;i<actual.length;i++)diff|=actual.charCodeAt(i)^hash.charCodeAt(i);return diff===0;}
export async function authenticate(cookie: string | null, _headers?: Headers) {
  const token = cookie?.match(/(?:^|;\s*)placement_session=([^;]+)/)?.[1];
  if (!token) return null;
  return one('SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?', await digest(token), Date.now());
}
export async function revokeSession(cookie: string | null, _headers?: Headers) {
  const token = cookie?.match(/(?:^|;\s*)placement_session=([^;]+)/)?.[1];
  if (token) await database().prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();
}
export function permit(user:any,role?:string){if(!user)throw new HttpError(401,'Sign in to continue.');if(role&&user.role!==role)throw new HttpError(403,'Your account does not have permission for this action.');}
export function sameOrigin(req:Request){const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new HttpError(403,'Cross-site requests are not allowed.');}
export async function newSession(id: string, _headers?: Headers) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  await database().prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await digest(token), id, Date.now() + 86400000).run();
  return token;
}
