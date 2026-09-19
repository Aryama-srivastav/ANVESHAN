import React, { useState } from "react";
// @ts-ignore — api.js is plain JS, no types
import { api } from "./api";
import { X } from "lucide-react";

export default function ViewerAuthModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: (token: string) => void }) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (!open) return null;

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const res = await api.viewerRegister(email, password, name || email);
      setNotice(res.development_code ? `Code sent. Dev code: ${res.development_code}` : (res.message || "Code sent."));
      setAwaitingCode(true);
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const res = await api.viewerLogin(email, password);
      setNotice(res.development_code ? `Code sent. Dev code: ${res.development_code}` : (res.message || "Code sent."));
      setAwaitingCode(true);
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const res = await api.viewerVerify(email, code);
      onSuccess(res.access_token);
    } catch (err: any) {
      setError(err.message || "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "w-full h-12 px-4 bg-obsidian-900 border border-white/10 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-biometric/50 transition-all";
  const labelCls = "text-[10px] font-mono text-slate-500 tracking-widest block mb-2";
  const btnCls = "w-full h-12 bg-white text-obsidian-900 rounded-xl text-xs font-mono font-bold disabled:opacity-40";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md bg-obsidian-800 border border-white/10 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-mono font-bold text-white tracking-widest">VIEWER SECURE ACCESS</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
        </div>
        <p className="text-[11px] font-mono text-slate-400 mb-6">Email registration + 6-digit email code. Other roles stay in prototype mode.</p>
        <div className="flex gap-2 mb-6">
          <button onClick={() => { setTab("login"); setAwaitingCode(false); setError(""); setNotice(""); }} className={`flex-1 h-10 rounded-xl text-[11px] font-mono font-bold transition-all ${tab === "login" ? "bg-white text-obsidian-900" : "border border-white/10 text-slate-400 hover:bg-white/5"}`}>LOGIN</button>
          <button onClick={() => { setTab("register"); setAwaitingCode(false); setError(""); setNotice(""); }} className={`flex-1 h-10 rounded-xl text-[11px] font-mono font-bold transition-all ${tab === "register" ? "bg-white text-obsidian-900" : "border border-white/10 text-slate-400 hover:bg-white/5"}`}>REGISTER</button>
        </div>
        {notice && <p className="text-biometric text-xs font-mono mb-4">{notice}</p>}
        {tab === "register" && !awaitingCode && (
          <form onSubmit={register} className="space-y-4">
            <label className="block">
              <span className={labelCls}>FULL NAME</span>
              <input value={name} onChange={e => setName(e.target.value)} required className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>EMAIL</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>PASSWORD (MIN 8 CHARS)</span>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} className={inputCls} />
            </label>
            <button type="submit" disabled={busy} className={btnCls}>{busy ? "SENDING CODE..." : "REGISTER + SEND CODE"}</button>
          </form>
        )}
        {tab === "login" && !awaitingCode && (
          <form onSubmit={login} className="space-y-4">
            <label className="block">
              <span className={labelCls}>EMAIL</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>PASSWORD</span>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className={inputCls} />
            </label>
            <button type="submit" disabled={busy} className={btnCls}>{busy ? "SENDING CODE..." : "LOGIN + SEND CODE"}</button>
          </form>
        )}
        {awaitingCode && (
          <form onSubmit={verify} className="space-y-4">
            <p className="text-[11px] font-mono text-slate-400">A 6-digit code was sent to <span className="text-white">{email}</span>. It expires in 10 minutes.</p>
            <label className="block">
              <span className={labelCls}>6-DIGIT CODE</span>
              <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} required inputMode="numeric" placeholder="000000" className={`${inputCls} tracking-[0.5em] text-center`} />
            </label>
            <button type="submit" disabled={busy} className={btnCls}>{busy ? "VERIFYING..." : "VERIFY + ENTER"}</button>
            <button type="button" onClick={() => setAwaitingCode(false)} className="w-full h-10 border border-white/10 rounded-xl text-[11px] font-mono text-slate-400 hover:bg-white/5 transition-all">BACK</button>
          </form>
        )}
        {error && <p className="text-red-400 text-xs font-mono mt-4">{error}</p>}
      </div>
    </div>
  );
}
