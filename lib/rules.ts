export const DEPARTMENTS = ['CSE','IT','ECE','EEE','MECH','CIVIL'];
export const STAGES = ['Applied','Shortlisted','Interview','Offered'];
export function eligibility(profile:any,job:any,now=new Date()) {
 const reasons:string[]=[];
 if(!profile) return ['Complete your student profile before applying.'];
 if(profile.cgpa<job.min_cgpa) reasons.push(`This role requires a minimum CGPA of ${Number(job.min_cgpa).toFixed(1)}. Your CGPA is ${Number(profile.cgpa).toFixed(1)}.`);
 const departments=typeof job.departments==='string'?JSON.parse(job.departments):job.departments;
 if(!departments.includes(profile.branch)) reasons.push(`This role is open to ${departments.join(', ')}. Your department is ${profile.branch}.`);
 if(profile.graduation_year!==job.graduation_year) reasons.push(`This role is for the graduating class of ${job.graduation_year}. Your graduation year is ${profile.graduation_year}.`);
 if(!profile.resume) reasons.push('Add a resume link to your profile before applying.');
 if(job.deadline < now.toISOString().slice(0,10)) reasons.push('The application deadline has passed.');
 return reasons;
}
export function canTransition(from:string,to:string){return ({Applied:['Shortlisted','Rejected'],Shortlisted:['Interview','Rejected'],Interview:['Offered','Rejected'],Offered:[],Rejected:[]} as Record<string,string[]>)[from]?.includes(to)??false;}
