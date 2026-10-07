import { env } from 'cloudflare:workers';
export function database():D1Database { if(!env.DB) throw new Error('The placement database is unavailable. Please try again shortly.'); return env.DB; }
export async function all(sql:string,...values:any[]){return (await database().prepare(sql).bind(...values).all()).results as any[];}
export async function one(sql:string,...values:any[]){return await database().prepare(sql).bind(...values).first<any>();}
