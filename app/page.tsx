'use client';
import { useEffect, useState } from 'react';
import { GraduationCap, Building2, ShieldCheck, ExternalLink } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
const roles = [{ id: 'student', name: 'Student', icon: GraduationCap, email: 'student@campus.test' }, { id: 'recruiter', name: 'Recruiter', icon: Building2, email: 'recruiter@campus.test' }, { id: 'admin', name: 'Placement cell', icon: ShieldCheck, email: 'admin@campus.test' }];
export default function Login() {
    const [role, setRole] = useState('student'), [email, setEmail] = useState('student@campus.test'), [password, setPassword] = useState('Campus@123'), [name, setName] = useState(''), [register, setRegister] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [embedded, setEmbedded] = useState(false);
    useEffect(() => { setEmbedded(window.self !== window.top); fetch('/api/auth/me').then(r => r.json()).then((d: any) => { if (d.user)
        window.location.replace('/' + d.user.role); }).catch(() => { }); }, []);
    async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(''); setMessage(''); try {
        const r = await fetch('/api/auth/' + (register ? 'register' : 'login'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, name, role: 'recruiter' }) });
        const d: any = await r.json();
        if (!r.ok)
            throw Error(d.error);
        if (register) {
            setRegister(false);
            setMessage(d.message);
        }
        else {
            const check = await fetch('/api/auth/me', { cache: 'no-store' });
            const session: any = await check.json();
            if (!session.user)
                throw Error('Your browser did not keep the sign-in session. Open the portal in its own tab, then sign in there.');
            window.location.href = '/' + session.user.role;
        }
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    return <div className="login">
  <header className="login-header"><a href="/" className="brand"><GraduationCap size={28}/><strong>Campus Placement</strong></a><span>Placement & Internship Cell</span></header>
  <main className="login-body">
   <section className="login-info"><p className="eyebrow">ACADEMIC YEAR 2026–27</p><h1>Placement portal</h1><p>Access campus openings, applications and recruitment decisions.</p><div className="login-guide"><h2>Using the portal</h2><dl><dt>Students</dt><dd>Update your academic details and resume before applying. Each opening lists its eligibility requirements.</dd><dt>Recruiters</dt><dd>Register your company, submit openings for review and manage applicants.</dd><dt>Placement cell</dt><dd>Review companies and openings. Approval decisions are recorded in the action log.</dd></dl></div><p className="login-note">Only approved companies and openings are listed for students.</p></section>
   <section className="login-form"><div className="login-form-inner"><h2>{register ? 'Recruiter registration' : 'Sign in'}</h2><p className="muted">{register ? 'Create an account to submit your company profile.' : 'Choose a demo account or enter your credentials.'}</p><Tabs value={role} onValueChange={r => { setRole(r); setEmail(roles.find(x => x.id === r)!.email); setPassword('Campus@123'); setRegister(false); setError(''); }}><TabsList className="role-tabs">{roles.map(r => <TabsTrigger key={r.id} value={r.id}>{r.name}</TabsTrigger>)}</TabsList></Tabs>{embedded && <p className="notice"><a className="text-link" href="/" target="_blank" rel="noopener">Open portal in a separate tab <ExternalLink size={14}/></a></p>}<form onSubmit={submit}>{register && <label>Full name<Input autoComplete="name" value={name} onChange={e => setName(e.target.value)} required placeholder="Your full name"/></label>}<label>Email address<Input autoComplete="username" type="email" value={email} onChange={e => setEmail(e.target.value)} required/></label><label>Password<Input autoComplete={register ? 'new-password' : 'current-password'} type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={register ? 8 : 1}/></label>{error && <div className="notice error" role="alert">{error}</div>}{message && <div className="notice success" role="status">{message}</div>}<Button className="primary login-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</Button></form>{role === 'recruiter' && <button className="text-button" onClick={() => { setRegister(!register); setEmail(''); setPassword(''); setError(''); }}>{register ? 'Back to sign in' : 'Register a new recruiter account'}</button>}<div className="demo-note"><strong>Demo access</strong><p>The selected account is prefilled. Password: <code>Campus@123</code></p></div></div></section>
  </main><footer className="login-footer">Campus Placement & Internship Portal · Academic demo</footer>
 </div>;
}
