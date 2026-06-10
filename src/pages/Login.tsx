import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getFirebaseAuth, initFirebase, fetchClientConfig } from '@/lib/firebase';
import { sessionLogin, accountStatus } from '@/lib/jobFlow';
import { Spinner } from '@/components/shared/Spinner';
import { Button } from '@/components/shared/Button';

export function LoginPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [initReady, setInitReady] = useState(false);

  useEffect(() => {
    fetchClientConfig()
      .then((cfg) => {
        initFirebase(cfg.firebase);
        setInitReady(true);
      })
      .catch(() => setError('Failed to load app configuration'));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      let cid = companyId.trim();
      if (!cid) {
        const r = await fetch(`/api/session/company-by-uid?uid=${encodeURIComponent(uid)}`);
        const d = await r.json();
        cid = d.companyId || '';
      }
      if (!cid) throw new Error('Company ID is required');

      const acct = await accountStatus(cid);
      if (acct.loginBlocked) {
        throw new Error(acct.blockMessage || 'Subscription expired. Contact support@bookawaka.com');
      }

      await sessionLogin(cid, uid);
      localStorage.setItem('bw_dispatcher_name', name || email.split('@')[0]);
      localStorage.setItem('bw_company_id', cid);
      localStorage.setItem('bw_session_id', `sess_${Date.now()}`);
      window.location.href = '/dispatch';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bw-bg p-4">
      <div className="w-full max-w-md bw-card p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-bw-gold tracking-tight">BookaWaka</h1>
          <p className="text-bw-muted text-sm mt-1">Dispatch Console</p>
        </div>
        {!initReady ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Name" className="w-full px-4 py-2.5 rounded-lg bg-bw-bg border border-bw-border text-bw-text focus:border-bw-primary outline-none" />
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full px-4 py-2.5 rounded-lg bg-bw-bg border border-bw-border text-bw-text focus:border-bw-primary outline-none" />
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full px-4 py-2.5 rounded-lg bg-bw-bg border border-bw-border text-bw-text focus:border-bw-primary outline-none" />
            <input value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="Company ID (optional if linked)" className="w-full px-4 py-2.5 rounded-lg bg-bw-bg border border-bw-border text-bw-text focus:border-bw-primary outline-none" />
            {error && <div className="text-bw-danger text-sm bg-red-950/30 border border-red-900 rounded-lg px-3 py-2">{error}</div>}
            <Button type="submit" variant="gold" className="w-full py-3 text-sm" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
            <p className="text-center text-xs text-bw-muted">
              <a href="/DispatcherLogin.aspx" className="text-bw-primary hover:underline">Create Account</a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
