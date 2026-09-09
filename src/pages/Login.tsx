import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Fingerprint, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { useStore } from '../store';

export default function Login() {
  const nav = useNavigate();
  const { users, setCurrentUser, api, pushToast } = useStore();
  const [step, setStep] = useState<'login' | 'mfa'>('login');
  const [email, setEmail] = useState('ananya.sharma@veritas.gov.in');
  const [password, setPassword] = useState('veritas2026');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);

  const doLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    if (!email.includes('@')) { setError('Enter a valid official email address.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setBusy(true);
    await new Promise((r) => setTimeout(r, 900));
    const found = users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || users[0];
    setCurrentUser({ name: found?.name || 'Insp. Ananya Sharma', role: found?.role || 'Investigating Officer', email });
    try {
      await api('audit', 'POST', { row: { actor: found?.name || 'Inspector Ananya Sharma', action: 'Login', resource: 'VERITAS Console', resource_id: 'SESSION', result: 'Success', reference: 'MFA-OK', details: 'Successful login with MFA challenge issued to registered device.', timestamp: new Date().toISOString() } });
    } catch {}
    setBusy(false);
    setStep('mfa');
  };

  const doMfa = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    const code = otp.join('');
    if (code.length < 6) { setError('Enter the 6-digit verification code. For the demo, any 6 digits work.'); return; }
    setBusy(true);
    await new Promise((r) => setTimeout(r, 1000));
    setBusy(false);
    pushToast({ title: 'Welcome back', message: 'Signed in to VERITAS Sovereign Node DL-04.', kind: 'success' });
    nav('/');
  };

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1);
    setOtp((p) => { const n = [...p]; n[i] = d; return n; });
    if (d && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
  };

  return (
    <div className="flex min-h-screen bg-[#edf0f5]">
      {/* Left brand panel */}
      <div className="hidden w-[44%] flex-col justify-between bg-[#0a2342] p-10 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10"><Shield size={20} strokeWidth={2} /></div>
          <div>
            <p className="text-[18px] font-bold tracking-tight">VERITAS</p>
            <p className="text-[12px] text-blue-200/80">Secure Digital Document Management</p>
          </div>
        </div>
        <div className="max-w-md">
          <p className="mono mb-4 inline-block rounded border border-white/15 bg-white/5 px-2 py-1 text-[10.5px] tracking-[0.08em] text-blue-100/80">PERMISSIONED LEDGER · NODE DL-04</p>
          <h1 className="text-[32px] font-bold leading-[1.15] tracking-tight">Secure. Traceable.<br />Verifiable.</h1>
          <p className="mt-3.5 text-[13.5px] leading-relaxed text-blue-100/75">“Every document is controlled. Every action is traceable. Every record can be verified.” Judicial-grade evidentiary vault engineered for investigation, legal, forensic and institutional workflows.</p>
          <div className="mt-7 space-y-2.5">
            {[
              ['SHA-256 fingerprinting', 'Every file sealed with a cryptographic digest'],
              ['Permissioned ledger anchoring', 'Consensus-validated across 8 MHA zones'],
              ['Complete audit trail', 'Login to verification — everything logged'],
            ].map(([t, s]) => (
              <div key={t} className="flex items-start gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-3">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#7ee2b0]" strokeWidth={2} />
                <div><p className="text-[13px] font-semibold">{t}</p><p className="text-[12px] text-blue-200/75">{s}</p></div>
              </div>
            ))}
          </div>
        </div>
        <p className="mono text-[10.5px] text-blue-200/60">ISO/IEC 27037 Evidentiary Standard · Prototype demo data</p>
      </div>

      {/* Right form */}
      <div className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-5 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0a2342]"><Shield size={18} className="text-white" /></div>
            <div><p className="text-[15px] font-bold text-[#0a2342]">VERITAS</p><p className="text-[11px] text-[#68778e]">Secure Digital Document Management</p></div>
          </div>

          <div className="v-card px-6 py-6">
            {step === 'login' ? (
              <>
                <h2 className="text-[19px] font-semibold tracking-tight text-[#101f36]">Secure sign in</h2>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[#68778e]">Authorised officers only. All sign-in attempts are audited.</p>
                <form onSubmit={doLogin} className="mt-4 space-y-3">
                  <div>
                    <label htmlFor="email" className="mb-1 block">Official email</label>
                    <input id="email" type="email" className="v-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@veritas.gov.in" autoComplete="username" />
                  </div>
                  <div>
                    <label htmlFor="password" className="mb-1 block">Password</label>
                    <input id="password" type="password" className="v-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
                  </div>
                  <label className="flex items-center gap-2 pt-0.5 text-[12.5px] font-normal text-[#3c4f68]">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-3.5 w-3.5 rounded border-[#cfd7e3] accent-[#0a2342]" /> Remember this device for 30 days
                  </label>
                  {error && <p className="flex items-start gap-2 rounded-lg border border-[#efc5c1] bg-[#fdf1f0] px-3 py-2 text-[12.5px] font-medium text-[#93312a]"><AlertCircle size={14} className="mt-0.5 shrink-0" />{error}</p>}
                  <button type="submit" disabled={busy} className="v-btn-primary w-full justify-center">
                    {busy ? <span className="v-spin h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white" /> : <Lock size={14} />} {busy ? 'Authenticating…' : 'Continue to MFA'}
                  </button>
                </form>
                <div className="v-panel mt-4 px-3.5 py-2.5 text-[12px] leading-relaxed text-[#5d6d84]">
                  <span className="font-semibold text-[#0a2342]">Demo access:</span> use the prefilled credentials and any 6-digit MFA code to enter. No real backend — fictional demo authentication.
                </div>
              </>
            ) : (
              <>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#eef2f7]"><Fingerprint size={22} className="text-[#0a2342]" strokeWidth={1.8} /></div>
                <h2 className="mt-2.5 text-[19px] font-semibold tracking-tight text-[#101f36]">Two-factor verification</h2>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[#68778e]">A 6-digit code was sent to your registered device ending <span className="mono font-medium text-[#1c2c46]">•••• 4810</span>. Demo: any 6 digits work.</p>
                <form onSubmit={doMfa} className="mt-4">
                  <div className="flex justify-between gap-1.5" role="group" aria-label="MFA code">
                    {otp.map((d, i) => (
                      <input key={i} id={`otp-${i}`} value={d} onChange={(e) => setDigit(i, e.target.value)} onKeyDown={(e) => { if (e.key === 'Backspace' && !otp[i] && i > 0) document.getElementById(`otp-${i - 1}`)?.focus(); }} inputMode="numeric" maxLength={1} aria-label={`Digit ${i + 1}`}
                        className="h-11 w-full rounded-lg border border-[#cfd7e3] bg-white text-center text-[17px] font-semibold text-[#0a2342] transition focus:border-[#0a2342] focus:shadow-[0_0_0_3px_rgba(10,35,66,.10)] focus:outline-none" />
                    ))}
                  </div>
                  {error && <p className="mt-3 flex items-start gap-2 rounded-lg border border-[#efc5c1] bg-[#fdf1f0] px-3 py-2 text-[12.5px] font-medium text-[#93312a]"><AlertCircle size={14} className="mt-0.5 shrink-0" />{error}</p>}
                  <button type="submit" disabled={busy} className="v-btn-primary mt-3.5 w-full justify-center">
                    {busy ? <span className="v-spin h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white" /> : <>Verify & enter VERITAS <ArrowRight size={14} /></>} {busy ? 'Verifying…' : ''}
                  </button>
                  <button type="button" onClick={() => setStep('login')} className="mt-2.5 w-full text-center text-[12.5px] font-semibold text-[#2456c6] hover:underline">Back to sign in</button>
                </form>
              </>
            )}
          </div>
          <p className="mt-3.5 text-center text-[11px] text-[#8a96ad]">VERITAS · Secure. Traceable. Verifiable. · Unauthorised access is prohibited and logged.</p>
        </div>
      </div>
    </div>
  );
}
