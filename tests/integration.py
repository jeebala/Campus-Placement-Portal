"""Use a freshly seeded LOCAL database; this suite mutates demo data."""
import json, os, uuid, urllib.request, urllib.error, http.cookiejar
BASE=os.environ.get('TEST_BASE_URL','http://127.0.0.1:5173').rstrip('/')
checks=0
class Client:
 def __init__(self):
  self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 def req(self,path,method='GET',body=None,origin=None):
  h={'Content-Type':'application/json'}
  if origin:h['Origin']=origin
  req=urllib.request.Request(BASE+'/api/'+path,data=json.dumps(body).encode() if body is not None else None,method=method,headers=h)
  try:
   with self.opener.open(req) as r:return r.status,json.loads(r.read())
  except urllib.error.HTTPError as e:return e.code,json.loads(e.read())
 def action(self,path,method,body,expected):
  status,data=self.req(path,method,body);check(status==expected,f'{method} {path}: expected {expected}, got {status}: {data}');return data
 def login(self,email):
  result=self.action('auth/login','POST',{'email':email,'password':'Campus@123'},200)
  status,session=self.req('auth/me');check(status==200 and session.get('user',{}).get('email')==email,'Login persists on the next request: '+email)
  return result
 def data(self):return self.action('dashboard','GET',None,200)
def check(value,label):
 global checks
 assert value,label;checks+=1;print('PASS',label[:110])
anon=Client();anon.action('dashboard','GET',None,401)
student=Client();student.login('student@campus.test')
low=Client();low.login('ineligible@campus.test')
recruiter=Client();recruiter.login('recruiter@campus.test')
other=Client();other.login('recruiter2@campus.test')
admin=Client();admin.login('admin@campus.test')
for client,pages in [(student,['/student','/student/openings','/student/openings/job-frontend','/student/applications','/student/applications/application-one','/student/profile']),(recruiter,['/recruiter','/recruiter/openings','/recruiter/candidates','/recruiter/candidates/application-one','/recruiter/company']),(admin,['/admin','/admin/companies','/admin/companies/company-nova','/admin/openings','/admin/openings/job-platform','/admin/audit'])]:
 for page in pages:
  with client.opener.open(BASE+page) as response:
   html=response.read().decode();check(response.status==200 and 'campus placement' in html.lower(),'Server renders '+page)
with student.opener.open(BASE+'/admin') as response:check(response.geturl().endswith('/student'),'Wrong-role page redirects to own portal')
forged=Client();forged.opener.addheaders=[('x-user-role','admin'),('x-user-email','admin@campus.test')]
forged.action('dashboard','GET',None,401)
d=student.data();check(all(j['status']=='approved' and j['company_status']=='approved' for j in d['jobs']),'Only fully approved openings are visible')
check('job-platform' not in [j['id'] for j in d['jobs']],'Pending opening is hidden')
low.action('applications','POST',{'job_id':'job-ml','cgpa':10,'branch':'CSE'},422)
check(len(low.data()['applications'])==0,'Forged client eligibility cannot create an application')
student.action('applications','POST',{'job_id':'job-platform'},404)
student.action('reviews','POST',{'entity_type':'company','entity_id':'company-nova','action':'approved','reason':'Spoof','role':'admin'},403)
recruiter.action('profile','PATCH',{'branch':'CSE','cgpa':10,'graduation_year':2027,'resume':'https://example.com'},403)
student.action('profile','PATCH',{'branch':'CSE','cgpa':11,'graduation_year':2027,'resume':'https://example.com'},400)
student.action('profile','PATCH',{'branch':'CSE','cgpa':8.6,'graduation_year':2027,'resume':'javascript:alert(1)'},400)
status,_=student.req('applications','POST',{'job_id':'job-design'},'https://evil.example');check(status==403,'Cross-origin submission blocked')
a=student.action('applications','POST',{'job_id':'job-design'},201)
student.action('applications','POST',{'job_id':'job-design'},409)
check(a['id'] in [x['id'] for x in student.data()['applications']],'Application persisted')
other.action('applications/status','PATCH',{'ids':['application-three'],'status':'Shortlisted'},403)
recruiter.action('applications/status','PATCH',{'ids':['application-three','application-two'],'status':'Shortlisted'},403)
check(next(x for x in recruiter.data()['applications'] if x['id']=='application-three')['status']=='Applied','Unauthorized mixed batch has no partial changes')
recruiter.action('applications/status','PATCH',{'ids':['application-three'],'status':'Offered'},409)
recruiter.action('applications/status','PATCH',{'ids':['application-three','application-four'],'status':'Shortlisted'},200)
r=recruiter.data();check(all(next(x for x in r['applications'] if x['id']==aid)['status']=='Shortlisted' for aid in ['application-three','application-four']),'Batch status persisted')
recruiter.action('applications/status','PATCH',{'ids':['application-one'],'status':'Offered','note':'Congratulations!'},200)
s=student.data();check(next(x for x in s['applications'] if x['id']=='application-one')['status']=='Offered','Student reads recruiter update')
check(any(x['application_id']=='application-one' and x['status']=='Offered' for x in s['events']),'History records transition')
recruiter.action('applications/status','PATCH',{'ids':['application-one'],'status':'Rejected'},409)
uid=uuid.uuid4().hex[:8];new=Client();email=uid+'@company.test'
new.action('auth/register','POST',{'role':'admin','email':email,'name':'Admin','password':'Campus@123'},400)
new.action('auth/register','POST',{'role':'recruiter','email':email,'name':'Test Recruiter','password':'Campus@123'},201);new.login(email)
new.action('company','POST',{'name':'Test Company '+uid,'industry':'Software','website':'https://example.com','description':'Test partner.'},201)
c=new.data()['company'];check(c['status']=='pending','New company starts pending')
job=new.action('jobs','POST',{'title':'Test Internship '+uid,'type':'Internship','location':'Remote','salary':'₹30,000 / month','description':'Test role.','min_cgpa':7,'departments':['CSE'],'graduation_year':2027,'deadline':'2030-11-15'},201)
check(job['id'] not in [j['id'] for j in student.data()['jobs']],'New opening hidden before review')
admin.action('reviews','POST',{'entity_type':'job','entity_id':job['id'],'action':'approved','reason':'Test'},409)
admin.action('reviews','POST',{'entity_type':'company','entity_id':c['id'],'action':'approved','reason':'Verified company'},200)
check(job['id'] not in [j['id'] for j in student.data()['jobs']],'Company approval alone does not expose pending job')
admin.action('reviews','POST',{'entity_type':'job','entity_id':job['id'],'action':'approved','reason':'Verified eligibility'},200)
check(job['id'] in [j['id'] for j in student.data()['jobs']],'Both approvals expose opening')
record=next(x for x in admin.data()['audits'] if x['entity_id']==job['id']);check(record['reviewer_id']=='admin-demo' and record['created_at'] and record['reason'],'Audit stores reviewer, timestamp, and reason')
admin.action('reviews','POST',{'entity_type':'job','entity_id':job['id'],'action':'rejected','reason':'Duplicate'},409)
new.action('company','POST',{'name':'Test Company '+uid,'industry':'Software','website':'https://example.com','description':'Updated description.'},201)
check(job['id'] not in [j['id'] for j in student.data()['jobs']],'Company changes require review again')
admin.action('reviews','POST',{'entity_type':'company','entity_id':c['id'],'action':'rejected','reason':'Missing verification'},200)
check(new.data()['company']['status']=='rejected','Recruiter sees rejection')
student.action('auth/logout','POST',{},200);student.action('dashboard','GET',None,401)
print(f'\n{checks} integration checks passed (cookie sessions).')
