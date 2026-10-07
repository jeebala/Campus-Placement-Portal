import { database, one, all } from '@/lib/database';
import { authenticate, permit, checkPassword, newSession, digest, HttpError, sameOrigin, passwordHash, revokeSession } from '@/lib/auth';
import { ensureDemoData } from '@/lib/seed';
import { eligibility, canTransition, DEPARTMENTS } from '@/lib/rules';
export const dynamic='force-dynamic';
const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const now=()=>new Date().toISOString();
const id=()=>crypto.randomUUID();
function text(value:any,label:string,max=500){if(typeof value!=='string'||!value.trim()||value.length>max)throw new HttpError(400,`${label} is required and must be under ${max} characters.`);return value.trim();}
function number(value:any,label:string,min:number,max:number){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new HttpError(400,`${label} must be between ${min} and ${max}.`);return value;}
function url(value:any,label:string){const s=text(value,label,1000);try{const u=new URL(s);if(!['https:','http:'].includes(u.protocol))throw Error();}catch{throw new HttpError(400,`${label} must be a valid http or https link.`);}return s;}
function profileInput(b:any){const branch=text(b.branch,'Department');if(!DEPARTMENTS.includes(branch))throw new HttpError(400,'Choose a supported department.');const year=number(b.graduation_year,'Graduation year',2026,2040);if(!Number.isInteger(year))throw new HttpError(400,'Graduation year must be a whole number.');return [branch,number(b.cgpa,'CGPA',0,10),year,url(b.resume,'Resume link'),typeof b.skills==='string'?b.skills.slice(0,500):''];}
const joinedJobs='SELECT j.*,c.name company_name,c.industry,c.website,c.description company_description,c.status company_status,c.owner_id FROM jobs j JOIN companies c ON c.id=j.company_id';
const joinedApps='SELECT a.*,u.name student_name,u.email student_email,j.title,j.type,j.location,j.salary,j.company_id,c.name company_name,c.owner_id,p.branch,p.cgpa,p.graduation_year,p.resume,p.skills FROM applications a JOIN users u ON u.id=a.student_id JOIN profiles p ON p.user_id=u.id JOIN jobs j ON j.id=a.job_id JOIN companies c ON c.id=j.company_id';
async function handler(req:Request,context:any){try{
 const {path}=await context.params;const route=path.join('/');
 if(req.method!=='GET')sameOrigin(req);
 await ensureDemoData();
 const user=await authenticate(req.headers.get('cookie'),req.headers);
 if(route==='auth/me'&&req.method==='GET')return json({user});
 const b:any=req.method==='GET'?{}:await req.json().catch(()=>{throw new HttpError(400,'Request must contain valid JSON.');});
 if(!b||typeof b!=='object'||Array.isArray(b))throw new HttpError(400,'Request must contain a JSON object.');
 if(route==='auth/login'&&req.method==='POST'){
  const email=text(b.email,'Email').toLowerCase();const password=text(b.password,'Password');
  const attempts=await one('SELECT COUNT(*) total FROM login_attempts WHERE email=? AND created_at>?',email,Date.now()-900000);if(attempts.total>=10)throw new HttpError(429,'Too many sign-in attempts. Try again in 15 minutes.');
  const account=await one('SELECT * FROM users WHERE email=?',email);
  if(!account||!await checkPassword(password,account.password)){await database().prepare('INSERT INTO login_attempts(id,email,created_at) VALUES(?,?,?)').bind(id(),email,Date.now()).run();throw new HttpError(401,'Email or password is incorrect.');}
  await database().prepare('DELETE FROM login_attempts WHERE email=?').bind(email).run();
  const token=await newSession(account.id,req.headers);const res=json({user:{id:account.id,name:account.name,email:account.email,role:account.role}});res.headers.set('Set-Cookie',`placement_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${new URL(req.url).protocol==='https:'?'; Secure':''}`);return res;
 }
 if(route==='auth/register'&&req.method==='POST'){
  if(b.role!=='recruiter')throw new HttpError(400,'Only company recruiter registration is available.');
  const email=text(b.email,'Email').toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new HttpError(400,'Enter a valid email.');if(await one('SELECT id FROM users WHERE email=?',email))throw new HttpError(409,'An account already uses this email.');
  const pass=text(b.password,'Password');if(pass.length<8)throw new HttpError(400,'Use a password with at least 8 characters.');const salt=id();const uid=id();
  await database().prepare('INSERT INTO users(id,name,email,password,role) VALUES(?,?,?,?,?)').bind(uid,text(b.name,'Name'),email,salt+':'+await passwordHash(pass,salt),'recruiter').run();return json({message:'Account created. Sign in and submit your company profile for review.'},201);
 }
 permit(user);
 if(route==='auth/logout'&&req.method==='POST'){await revokeSession(req.headers.get('cookie'),req.headers);const res=json({ok:true});res.headers.set('Set-Cookie','placement_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');return res;}
 if(route==='dashboard'&&req.method==='GET'){
  if(user.role==='student'){
   const profile=await one('SELECT * FROM profiles WHERE user_id=?',user.id);
   const jobs=await all(joinedJobs+" WHERE j.status='approved' AND c.status='approved' ORDER BY j.created_at DESC");
   const apps=await all(joinedApps+' WHERE a.student_id=? ORDER BY a.updated_at DESC',user.id);
   const events=await all('SELECT e.* FROM events e JOIN applications a ON a.id=e.application_id WHERE a.student_id=? ORDER BY e.created_at',user.id);
   return json({user,profile,jobs:jobs.map(j=>({...j,departments:JSON.parse(j.departments),reasons:eligibility(profile,j)})),applications:apps,events});
  }
  if(user.role==='recruiter')return json({user,company:await one('SELECT * FROM companies WHERE owner_id=?',user.id),jobs:await all(joinedJobs+' WHERE c.owner_id=? ORDER BY j.created_at DESC',user.id),applications:await all(joinedApps+' WHERE c.owner_id=? ORDER BY a.created_at DESC',user.id),events:await all('SELECT e.* FROM events e JOIN applications a ON a.id=e.application_id JOIN jobs j ON j.id=a.job_id JOIN companies c ON c.id=j.company_id WHERE c.owner_id=? ORDER BY e.created_at',user.id)});
  permit(user,'admin');return json({user,companies:await all('SELECT c.*,u.name owner_name,u.email owner_email FROM companies c JOIN users u ON u.id=c.owner_id ORDER BY c.created_at DESC'),jobs:await all(joinedJobs+' ORDER BY j.created_at DESC'),audits:await all('SELECT a.*,u.name reviewer_name FROM audits a JOIN users u ON u.id=a.reviewer_id ORDER BY a.created_at DESC')});
 }
 if(route==='profile'&&req.method==='PATCH'){permit(user,'student');const values=profileInput(b);const statements=[database().prepare('INSERT INTO profiles(user_id,branch,cgpa,graduation_year,resume,skills) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET branch=excluded.branch,cgpa=excluded.cgpa,graduation_year=excluded.graduation_year,resume=excluded.resume,skills=excluded.skills').bind(user.id,...values)];if(b.name)statements.push(database().prepare('UPDATE users SET name=? WHERE id=?').bind(text(b.name,'Name'),user.id));await database().batch(statements);return json({message:'Profile saved.'});}
 if(route==='company'&&req.method==='POST'){permit(user,'recruiter');const existing=await one('SELECT * FROM companies WHERE owner_id=?',user.id);const values=[text(b.name,'Company name'),text(b.industry,'Industry'),url(b.website,'Company website'),text(b.description,'Company description',5000)];if(existing)await database().prepare("UPDATE companies SET name=?,industry=?,website=?,description=?,status='pending',note='' WHERE id=? AND owner_id=?").bind(...values,existing.id,user.id).run();else await database().prepare("INSERT INTO companies(id,owner_id,name,industry,website,description,status,note,created_at) VALUES(?,?,?,?,?,?,'pending','',?)").bind(id(),user.id,...values,now()).run();return json({message:'Company submitted for placement cell approval.'},201);}
 if(route==='jobs'&&req.method==='POST'){
  permit(user,'recruiter');const company=await one('SELECT * FROM companies WHERE owner_id=?',user.id);if(!company)throw new HttpError(400,'Create your company profile first.');
  const departments=b.departments;if(!Array.isArray(departments)||departments.length===0||departments.some(d=>!DEPARTMENTS.includes(d)))throw new HttpError(400,'Select at least one valid department.');
  const type=text(b.type,'Role type');if(!['Internship','Full-time'].includes(type))throw new HttpError(400,'Choose Internship or Full-time.');const deadline=text(b.deadline,'Deadline');if(!/^\d{4}-\d{2}-\d{2}$/.test(deadline)||!Number.isFinite(Date.parse(deadline))||new Date(deadline).toISOString().slice(0,10)!==deadline||deadline<now().slice(0,10))throw new HttpError(400,'Choose a valid future deadline.');
  const year=number(b.graduation_year,'Graduation year',2026,2040);if(!Number.isInteger(year))throw new HttpError(400,'Graduation year must be a whole number.');
  const jid=id();await database().prepare("INSERT INTO jobs(id,company_id,title,type,location,salary,description,min_cgpa,departments,graduation_year,deadline,status,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,'pending','',?)").bind(jid,company.id,text(b.title,'Job title'),type,text(b.location,'Location'),text(b.salary,'Compensation'),text(b.description,'Job description',10000),number(b.min_cgpa,'Minimum CGPA',0,10),JSON.stringify([...new Set(departments)]),year,deadline,now()).run();return json({id:jid,message:'Opening submitted for approval.'},201);
 }
 if(route==='applications'&&req.method==='POST'){
  permit(user,'student');const job=await one(joinedJobs+' WHERE j.id=?',text(b.job_id,'Job ID'));if(!job||job.status!=='approved'||job.company_status!=='approved')throw new HttpError(404,'This opening is unavailable.');
  const profile=await one('SELECT * FROM profiles WHERE user_id=?',user.id);const reasons=eligibility(profile,job);if(reasons.length)throw new HttpError(422,reasons.join(' '));if(await one('SELECT id FROM applications WHERE student_id=? AND job_id=?',user.id,job.id))throw new HttpError(409,'You have already applied for this opening.');
  const aid=id(),stamp=now();await database().batch([database().prepare("INSERT INTO applications(id,student_id,job_id,status,snapshot,created_at,updated_at) VALUES(?,?,?,'Applied',?,?,?)").bind(aid,user.id,job.id,JSON.stringify(profile),stamp,stamp),database().prepare("INSERT INTO events(id,application_id,status,actor_id,note,created_at) VALUES(?,?,'Applied',?,'Application received.',?)").bind(id(),aid,user.id,stamp)]);return json({id:aid,message:'Application submitted. Good luck!'},201);
 }
 if(route==='applications/status'&&req.method==='PATCH'){
  permit(user,'recruiter');if(!Array.isArray(b.ids)||!b.ids.length||b.ids.length>40||b.ids.some((x:any)=>typeof x!=='string'))throw new HttpError(400,'Select between 1 and 40 applications.');
  const ids=[...new Set(b.ids)] as string[];const status=text(b.status,'Status');const note=typeof b.note==='string'?b.note.slice(0,1000):`Application moved to ${status.toLowerCase()}.`;
  const rows=await all(joinedApps+` WHERE a.id IN (${ids.map(()=>'?').join(',')})`,...ids);if(rows.length!==ids.length||rows.some(a=>a.owner_id!==user.id))throw new HttpError(403,'You may only update applicants to your own company.');
  if(rows.some(a=>!canTransition(a.status,status)))throw new HttpError(409,`One or more applicants cannot move to ${status}. Follow Applied → Shortlisted → Interview → Offered, or reject from an active stage.`);
  const stamp=now();
  const eventIds=rows.map(()=>id());
  const guard='(SELECT COUNT(*) FROM applications WHERE '+rows.map(()=>'(id=? AND status=?)').join(' OR ')+')=?';
  const guardValues=rows.flatMap(a=>[a.id,a.status]).concat(rows.length);
  const results=await database().batch([
   ...rows.map((a,i)=>database().prepare('INSERT INTO events(id,application_id,status,actor_id,note,created_at) SELECT ?,id,?,?,?,? FROM applications WHERE id=? AND status=? AND '+guard).bind(eventIds[i],status,user.id,note,stamp,a.id,a.status,...guardValues)),
   ...rows.map((a,i)=>database().prepare('UPDATE applications SET status=?,updated_at=? WHERE id=? AND status=? AND EXISTS(SELECT 1 FROM events WHERE id=?)').bind(status,stamp,a.id,a.status,eventIds[i]))
  ]);
  if(results[0].meta.changes===0)throw new HttpError(409,'The selected applications changed during this update. Refresh and try again.');
  return json({message:`Updated ${rows.length} application${rows.length===1?'':'s'}.`});
 }
 if(route==='reviews'&&req.method==='POST'){
  permit(user,'admin');const kind=b.entity_type;if(!['company','job'].includes(kind)||!['approved','rejected'].includes(b.action))throw new HttpError(400,'Invalid review action.');const table=kind==='company'?'companies':'jobs';const item=await one(`SELECT * FROM ${table} WHERE id=?`,text(b.entity_id,'Record ID'));if(!item)throw new HttpError(404,'Record not found.');if(item.status!=='pending')throw new HttpError(409,'This record has already been reviewed.');
  if(kind==='job'&&b.action==='approved'){const company=await one('SELECT status FROM companies WHERE id=?',item.company_id);if(company.status!=='approved')throw new HttpError(409,'Approve the company before approving its openings.');}
  const reason=text(b.reason,'Review note',2000);const stamp=now();await database().batch([database().prepare(`INSERT INTO audits(id,reviewer_id,entity_type,entity_id,entity_name,action,reason,created_at) SELECT ?,?,?,?,?,?,?,? FROM ${table} WHERE id=? AND status='pending'`).bind(id(),user.id,kind,item.id,item.name??item.title,b.action,reason,stamp,item.id),database().prepare(`UPDATE ${table} SET status=?,note=? WHERE id=? AND status='pending'`).bind(b.action,reason,item.id)]);return json({message:`${kind==='company'?'Company':'Opening'} ${b.action}.`});
 }
 throw new HttpError(404,'Endpoint not found.');
 }catch(error){if(error instanceof HttpError)return json({error:error.message},error.status);if(String(error).includes('UNIQUE constraint'))return json({error:'This record already exists. Refresh and try again.'},409);console.error('Placement API error',error);return json({error:'The placement service is temporarily unavailable. Please try again.'},503);}}
export const GET=handler;export const POST=handler;export const PATCH=handler;
