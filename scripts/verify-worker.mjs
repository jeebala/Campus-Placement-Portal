import { createRequire } from 'node:module';
import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
const require=createRequire(realpathSync(new URL('../node_modules/wrangler/package.json',import.meta.url)));
const {Miniflare}=require('miniflare');
const serverRoot=path.resolve('dist/server');
const files=readdirSync(serverRoot,{recursive:true}).filter(f=>/\.(js|mjs)$/.test(f)).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:a.localeCompare(b));
const mf=new Miniflare({modules:files.map(f=>({type:'ESModule',path:path.join(serverRoot,f)})),modulesRoot:serverRoot,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB']});
const db=await mf.getD1Database('DB');
try{
 for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()){
  const sql=readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint','');
  await db.batch(sql.split(';').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
 }
 const server=createServer(async(req,res)=>{try{const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);const response=await mf.dispatchFetch('http://localhost'+req.url,{method:req.method,headers:req.headers,...(body.length?{body}:{}),redirect:'manual'});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch(error){console.error(error);res.writeHead(500);res.end(JSON.stringify({error:String(error)}));}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 const result=await new Promise(resolve=>{const child=spawn('python3',['tests/integration.py'],{stdio:'inherit',env:{...process.env,TEST_BASE_URL:'http://127.0.0.1:'+port}});child.on('exit',resolve);child.on('error',()=>resolve(1));});
 await new Promise(resolve=>server.close(resolve));
 if(result!==0)process.exitCode=1;
}finally{await mf.dispose();}
