import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { authenticate } from '@/lib/auth';
import Portal from '@/app/portal';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{path:string[]}>}){const {path}=await params;const role=path[0];if(!['student','recruiter','admin'].includes(role))notFound();const requestHeaders=await headers();const user=await authenticate(requestHeaders.get('cookie'),requestHeaders);if(!user)redirect('/');if(user.role!==role)redirect('/'+user.role);const allowed:Record<string,string[]>= {student:['overview','openings','applications','profile'],recruiter:['overview','openings','candidates','company'],admin:['overview','companies','openings','audit']};const page=path[1]??'overview';if(!allowed[role].includes(page)||path.length>3)notFound();return <Portal user={user} page={page} detail={path[2]}/>;}
