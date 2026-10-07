import {spawnSync} from 'node:child_process';
import {readdirSync,readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const mode=process.argv[2];
if(!['migrate','seed'].includes(mode))throw Error('Use migrate or seed.');
const ledgerPath='.wrangler/applied-migrations.json';
const ledger=existsSync(ledgerPath)?JSON.parse(readFileSync(ledgerPath,'utf8')):{};
const files=mode==='seed'?['db/seed.sql']:readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort().map(f=>'drizzle/'+f);
for(const file of files){
 const checksum=createHash('sha256').update(readFileSync(file)).digest('hex');
 if(mode==='migrate'&&ledger[file]){if(ledger[file]!==checksum)throw Error('An already applied migration was changed: '+file);console.log('Already applied:',file);continue;}
 const result=spawnSync(process.execPath,['./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','wrangler.json','--persist-to','.wrangler/state','--file',file],{stdio:'inherit'});
 if(result.status!==0)process.exit(result.status??1);
 if(mode==='migrate'){ledger[file]=checksum;mkdirSync('.wrangler',{recursive:true});writeFileSync(ledgerPath,JSON.stringify(ledger,null,2)+'\n');}
}
