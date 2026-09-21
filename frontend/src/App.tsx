import React, { useState, useEffect, useRef } from "react";
// @ts-ignore — api.js is plain JS, no types
import { api } from "./api";
import {
  ShieldAlert, Fingerprint, Lock, ChevronLeft, ChevronRight,
  FolderOpen, Database, FileText, Settings, Shield,
  Search, Clock, Hash,
  ShieldCheck, Plus, ArrowLeft, Brain,
  Upload, X, Zap, ClipboardList, Settings2,
  FileImage, FileAudio, FileVideo, File as FileLucide,
  Building2, KeyRound, Mail, ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { VaultView, AuditLogsView, ClearanceView, SettingsView, DepartmentsView, ViewerDashboard, PrototypeBanner, DocumentDetailModal } from "./panels";

// ── Type definitions ─────────────────────────────────────────────────
type ActiveView = "overview" | "cases" | "vault" | "departments" | "auditlogs" | "clearance" | "settings";

// ── Brand assets (optional uploads — nothing breaks when missing) ──────
// Upload on GitHub: ANVESHAN/frontend/public/brand/icon.png (logo) and
// ANVESHAN/frontend/public/brand/bg.png (background). They are served at
// /brand/icon.png and /brand/bg.png. BrandLogo / AppBackground below probe
// those URLs at runtime and fall back to the built-in look when absent.
const BRAND_ICON_URL = "/brand/icon.png";
const BRAND_BG_URL = "/brand/bg.png";

function useBrandAsset(url: string) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    const img = new Image();
    img.onload = () => { if (live) setReady(true); };
    img.onerror = () => { if (live) setReady(false); };
    img.src = url;
    return () => { live = false; };
  }, [url]);
  return ready;
}

/** Logo: your icon.png when uploaded, else the supplied fallback icon (ShieldAlert by default). */
function BrandLogo({ size = 28, boxClass = "", iconFallback }: { size?: number; boxClass?: string; iconFallback?: React.ComponentType<{ className?: string }> }) {
  const hasIcon = useBrandAsset(BRAND_ICON_URL);
  const Fallback = iconFallback ?? ShieldAlert;
  if (hasIcon) {
    return (
      <img src={BRAND_ICON_URL} alt="ANVESHAN logo" width={size} height={size}
        className={`rounded-lg object-contain shrink-0 ${boxClass}`} />
    );
  }
  return <Fallback size={size} className="text-cybergold shrink-0" />;
}

/** Background layer: your bg.png when uploaded, else a registry-hall gradient.
    Kept subtle — body already carries the texture; this adds depth in the shell. */
function AppBackground() {
  const hasBg = useBrandAsset(BRAND_BG_URL);
  if (hasBg) {
    return (
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <motion.img src={BRAND_BG_URL} alt="" aria-hidden
          initial={{ scale: 1.06 }}
          animate={{ scale: 1 }}
          transition={{ duration: 2.2, ease: [0.22, 0.75, 0.25, 1] }}
          className="w-full h-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#F4EFE4]/60 via-[#F4EFE4]/78 to-[#F4EFE4]/90" />
        {/* slow drifting sheen so the backdrop feels alive, never static */}
        <motion.div
          animate={{ x: ["-10%", "10%", "-10%"] }}
          transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-y-0 -left-1/4 w-1/2"
          style={{ background: "linear-gradient(100deg, transparent, rgba(154,123,46,0.07), transparent)" }}
        />
      </div>
    );
  }
  return (
    <>
      <motion.div
        animate={{ opacity: [0.35, 0.6, 0.35], scale: [1, 1.04, 1] }}
        transition={{ duration: 14, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        className="absolute inset-0 z-0 pointer-events-none"
        style={{ background: "radial-gradient(circle at 25% 15%, rgba(36,64,122,0.10) 0%, transparent 55%), radial-gradient(circle at 80% 85%, rgba(154,123,46,0.12) 0%, transparent 50%)" }}
      />
      <motion.div
        animate={{ y: [0, -14, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 z-0 pointer-events-none opacity-[0.5]"
        style={{ backgroundImage: "radial-gradient(rgba(27,42,74,0.10) 1px, transparent 1px)", backgroundSize: "26px 26px" }}
      />
    </>
  );
}

interface CaseItem {
  id: string;
  case_number: string;
  title: string;
  description?: string;
  status: string;
  created_at: string;
}

interface DocItem {
  id: string;
  title: string;
  doc_type: string;
  sensitivity_level: string;
  status: string;
  created_at: string;
}

interface AuditEvent {
  id: string;
  case_id: string;
  actor_user_id: string;
  event_type: string;
  action: string;
  details: Record<string, any>;
  event_hash?: string;
  created_at: string;
}

interface UserInfo {
  id: string;
  full_name: string;
  email: string;
  roles: string[];
  department?: string | null;
  agency?: string | null;
}

// ── Animation Variants ───────────────────────────────────────────────
const staggerContainer: import("framer-motion").Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.15 } }
};
const staggerItem: import("framer-motion").Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 260, damping: 24 } }
};
const fadeSlideUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
  transition: { duration: 0.35 }
};

// ── Helpers ──────────────────────────────────────────────────────────
function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function docIcon(docType: string) {
  if (docType?.includes("image")) return FileImage;
  if (docType?.includes("audio")) return FileAudio;
  if (docType?.includes("video")) return FileVideo;
  return FileLucide;
}

const CLEARANCE_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
  investigator: { label: "LEVEL 5 — TOP SECRET AUTHORISED", color: "text-cybergold", bg: "bg-cybergold/10", border: "border-cybergold/30" },
  admin: { label: "LEVEL 6 — SYSTEM ADMINISTRATOR", color: "text-seal", bg: "bg-seal/10", border: "border-seal/30" },
  auditor: { label: "LEVEL 4 — AUDIT OBSERVER", color: "text-biometric", bg: "bg-biometric/10", border: "border-biometric/30" },
  viewer: { label: "LEVEL 2 — READ ONLY", color: "text-[#4B5563]", bg: "bg-ink/5", border: "border-ink/20" },
};

// ── Root App ─────────────────────────────────────────────────────────
export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("anveshan_token"));
  const [role, setRole] = useState<string | null>(localStorage.getItem("anveshan_role"));

  function handleLogin(t: string, r: string) {
    setToken(t);
    setRole(r);
    localStorage.setItem("anveshan_token", t);
    localStorage.setItem("anveshan_role", r);
  }

  function handleLogout() {
    setToken(null);
    setRole(null);
    localStorage.removeItem("anveshan_token");
    localStorage.removeItem("anveshan_role");
  }

  if (!token) return <LoginView onLogin={handleLogin} />;
  return <Dashboard role={role || "investigator"} onLogout={handleLogout} onLogin={handleLogin} />;
}

// ── Login View ───────────────────────────────────────────────────────
// Serious registry gate: grey steel lock-pad with a restrained brass ring
// holds the uploaded icon (A-fingerprint). Clicking the icon dissolves the
// pad and reveals the sign-in options. No neon, no game-like motion.
function LoginView({ onLogin }: { onLogin: (t: string, r: string) => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"prototype" | "officer" | "viewer">("prototype");
  const [unlocked, setUnlocked] = useState(false);

  // Officer (email + password + optional MFA) state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  // Viewer (register → OTP → verify) state
  const [viewerEmail, setViewerEmail] = useState("");
  const [viewerPassword, setViewerPassword] = useState("");
  const [viewerName, setViewerName] = useState("");
  const [viewerStage, setViewerStage] = useState<"register" | "verify">("register");
  const [viewerCode, setViewerCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);

  async function doLogin(role: string) {
    setLoading(role);
    setError("");
    try {
      const res = await api.prototypeLogin(role, role);
      onLogin(res.access_token, role);
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(null);
    }
  }

  /** Officer credentials login — may return an MFA challenge instead of a token. */
  async function officerLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading("officer");
    setError("");
    try {
      const res = await api.login(email, password);
      if (res.mfa_required && res.challenge_token) {
        setChallengeToken(res.challenge_token);
        setError("");
        return;
      }
      if (!res.access_token) throw new Error("No access token returned");
      const me = await api.getUserMe().catch(() => null);
      onLogin(res.access_token, me?.roles?.[0] || "investigator");
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(null);
    }
  }

  /** Second factor: exchange the challenge token + 6-digit TOTP for a session. */
  async function officerVerifyMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeToken) return;
    setLoading("mfa");
    setError("");
    try {
      const res = await api.verifyMfa(challengeToken, mfaCode);
      const token = res.access_token || res.token;
      if (!token) throw new Error("MFA verification did not return a token");
      const me = await api.getUserMe().catch(() => null);
      onLogin(token, me?.roles?.[0] || "investigator");
    } catch (err: any) {
      setError(err.message || "MFA verification failed");
    } finally {
      setLoading(null);
    }
  }

  /** Viewer registration — issues an OTP challenge (dev code surfaced locally). */
  async function viewerRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading("viewer");
    setError("");
    try {
      const res = await api.viewerRegister(viewerEmail, viewerPassword, viewerName);
      setDevCode(res.development_code || null);
      setViewerStage("verify");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(null);
    }
  }

  /** Viewer login for an already-registered account — issues a fresh OTP. */
  async function viewerRequestOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading("viewer");
    setError("");
    try {
      const res = await api.viewerLogin(viewerEmail, viewerPassword);
      setDevCode(res.development_code || null);
      setViewerStage("verify");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(null);
    }
  }

  /** Viewer OTP verification — exchange the emailed code for a viewer session. */
  async function viewerVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading("viewer");
    setError("");
    try {
      const res = await api.viewerVerify(viewerEmail, viewerCode);
      const token = res.access_token || res.token;
      if (!token) throw new Error("Viewer verification did not return a token");
      onLogin(token, "viewer");
    } catch (err: any) {
      setError(err.message || "Verification failed");
    } finally {
      setLoading(null);
    }
  }

  const roles = ["investigator", "auditor", "admin", "viewer"];

  // Grey registry gate. Before unlock: steel lock-pad with brass ring
  // holding the icon. After unlock: the pad dissolves, options appear.
  const [padGone, setPadGone] = useState(false);
  // Light registry hall behind the gate too — texture visible, soft wash.
  const shellBg = "bg-[#EFE7D3]";
  function unlockGate() {
    if (unlocked) return;
    setUnlocked(true);
    setTimeout(() => setPadGone(true), 650);
  }

  return (
    <div className={`min-h-screen ${shellBg} flex items-center justify-center relative overflow-hidden transition-colors duration-700`}>
      {/* faint drifting texture accents behind the gate */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 animate-drift opacity-60" style={{ backgroundImage: "radial-gradient(rgba(36,64,122,0.10) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <motion.div animate={{ opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0"
          style={{ background: "radial-gradient(circle at 20% 12%, rgba(36,64,122,0.12), transparent 55%), radial-gradient(circle at 85% 88%, rgba(154,123,46,0.14), transparent 52%)" }} />
      </div>
      {/* Steel lock-pad gate — click the icon to dissolve */}
      {!padGone && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: unlocked ? 0 : 1, scale: unlocked ? 1.08 : 1 }}
          transition={{ duration: 0.6, ease: [0.22, 0.75, 0.25, 1] }}
          className="absolute inset-0 flex items-center justify-center z-20"
        >
          <div role="button" tabIndex={0} aria-label="Authenticate" onClick={unlockGate} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); unlockGate(); } }} className="relative flex flex-col items-center cursor-pointer">
            {/* Steel pad, lighter so the brass ring + icon pop */}
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
              className="relative flex items-center justify-center w-56 h-56 rounded-full bg-gradient-to-b from-[#9AA3B2] via-[#7C8698] to-[#5B636E] border-[6px] border-[#E8E2D2] shadow-[0_18px_50px_rgba(27,42,74,0.35)]">
              {/* Pulsing brass seal ring */}
              <div className="absolute -inset-2 rounded-full border-2 border-[#C9A36C] animate-seal" />
              {/* Centered icon (fingerprint fallback via BrandLogo) */}
              <div className="relative flex items-center justify-center w-28 h-28 rounded-2xl bg-[#FBF8F1] border border-[#D8CFB8] overflow-hidden shadow-inner">
                <BrandLogo size={64} iconFallback={Fingerprint} />
              </div>
              {/* shine sweep across the pad */}
              <div aria-hidden className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
                <div className="absolute top-0 bottom-0 w-1/3" style={{ background: "linear-gradient(100deg, transparent, rgba(255,255,255,0.35), transparent)", animation: "shine-sweep 4.5s ease-in-out infinite" }} />
              </div>
            </motion.div>
            <h1 className="mt-6 text-xl font-bold font-serif tracking-[0.3em] text-[#1B2A4A]">ANVESHAN</h1>
            <p className="mt-2 text-[9px] font-mono tracking-widest text-[#4A5568] uppercase">CLICK TO AUTHENTICATE</p>
          </div>
        </motion.div>
      )}
      {/* Options panel — revealed once the pad has dissolved */}
      {padGone && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 0.75, 0.25, 1] }}
          className="w-full max-w-md mx-auto p-8 relative z-10"
        >
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="glass-panel rounded-2xl p-7 panel-lift relative overflow-hidden">
            {/* brass top-rule + corner seal */}
            <div aria-hidden className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#9A7B2E] via-[#C9A36C] to-[#9A7B2E]" />
          <div className="flex items-center justify-center gap-3 mb-6">
            <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}>
              <BrandLogo size={38} />
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold font-serif text-[#16213c] tracking-wide leading-none">ANVESHAN</h1>
              <p className="text-[9px] font-mono tracking-[0.28em] text-[#9A7B2E] mt-1">SECURE DOCUMENT REGISTRY</p>
            </div>
          </div>
          <h2 className="text-xl font-bold text-center text-[#16213c] mb-1 font-serif">Evidence Registry</h2>
          <p className="text-center text-[#3E4A63] text-sm mb-6 font-medium">Sign in with your assigned clearance level.</p>
          {/* Mode selector */}
          <div className="flex gap-2 mb-6">
            {([["prototype", "ROLE ACCESS"], ["officer", "OFFICER LOGIN"], ["viewer", "PUBLIC VIEWER"]] as [typeof mode, string][]).map(([key, label]) => (
              <button key={key} onClick={() => { setMode(key); setError(""); setChallengeToken(null); }}
                className={`flex-1 h-9 rounded-lg font-mono text-[9px] font-bold tracking-widest transition-all ${mode === key ? "bg-[#24407A] text-white" : "bg-[#E5E0D8] text-[#4A4A4A] border border-[#D8CFB8] hover:bg-[#CBD5E1]"}`}>
                {label}
              </button>
            ))}
          </div>
          {mode === "prototype" && (
            <div className="space-y-3">
              {roles.map((r, i) => (
                <motion.button
                  key={r}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.1 }}
                  onClick={() => doLogin(r)}
                  disabled={loading !== null}
                  className={`w-full h-12 rounded-xl border font-mono text-sm tracking-widest font-bold flex items-center justify-center gap-3 transition-all duration-200 disabled:opacity-50 ${r === "investigator" ? "bg-[#24407A]/10 border-[#24407A]/30 text-[#24407A] hover:bg-[#24407A] hover:text-white" : r === "admin" ? "bg-[#7A1F2B]/10 border-[#7A1F2B]/30 text-[#7A1F2B] hover:bg-[#7A1F2B] hover:text-white" : r === "auditor" ? "bg-[#1E6B4A]/10 border-[#1E6B4A]/30 text-[#1E6B4A] hover:bg-[#1E6B4A] hover:text-white" : "bg-[#4A4A4A]/5 border-[#4A4A4A]/20 text-[#4A4A4A] hover:bg-[#4A4A4A]/10"}`}>
                  <Fingerprint size={18} />
                  {loading === r ? 'AUTHENTICATING...' : r.toUpperCase()}
                </motion.button>
              ))}
            </div>
          )}
          {/* Officer credentials login — email + password (+ TOTP) */}
          {mode === "officer" && (
            challengeToken ? (
              <form onSubmit={officerVerifyMfa} className="space-y-3">
                <div className="p-3 rounded-xl bg-[#24407A]/10 border border-[#24407A]/20 text-[#24407A] text-[10px] font-mono flex items-center gap-2">
                  <KeyRound size={12} /> MFA CHALLENGE — ENTER THE 6-DIGIT AUTHENTICATOR CODE
                </div>
                <input value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoFocus placeholder="000000"
                  className="w-full h-14 px-5 border border-[#D8CFB8] rounded-xl text-center text-2xl tracking-[0.5em] font-mono text-[#1B2A4A] focus:outline-none focus:border-[#24407A] transition-all" />
                <button type="submit" disabled={loading === "mfa" || mfaCode.length !== 6} className="w-full h-12 bg-[#24407A] text-white rounded-xl font-mono text-xs font-bold tracking-widest disabled:opacity-50">
                  {loading === "mfa" ? "VERIFYING..." : "VERIFY & ENTER"}
                </button>
                <button type="button" onClick={() => { setChallengeToken(null); setMfaCode(""); setError(""); }} className="w-full h-10 text-[#6B7280] hover:text-[#24407A] font-mono text-[10px] tracking-widest">← BACK</button>
              </form>
            ) : (
              <form onSubmit={officerLogin} className="space-y-3">
                <div className="relative">
                  <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="officer@registry.gov.in"
                    className="w-full h-12 pl-11 pr-4 border border-[#D8CFB8] rounded-xl text-sm font-mono text-[#1B2A4A] placeholder-[#9CA3AF] focus:outline-none focus:border-[#24407A] transition-all" />
                </div>
                <div className="relative">
                  <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••••••"
                    className="w-full h-12 pl-11 pr-4 border border-[#D8CFB8] rounded-xl text-sm font-mono text-[#1B2A4A] placeholder-[#9CA3AF] focus:outline-none focus:border-[#24407A] transition-all" />
                </div>
                <button type="submit" disabled={loading === "officer"} className="w-full h-12 bg-[#24407A] text-white rounded-xl font-mono text-xs font-bold tracking-widest disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading === "officer" ? "AUTHENTICATING..." : <><ArrowRight size={14} /> CONTINUE</>}
                </button>
              </form>
            )
          )}
          {/* Public viewer — self-registration with email OTP verification */}
          {mode === "viewer" && (
            viewerStage === "verify" ? (
              <form onSubmit={viewerVerify} className="space-y-3">
                <div className="p-3 rounded-xl bg-[#CAB879]/10 border border-[#CAB879]/20 text-[#24407A] text-[10px] font-mono leading-relaxed">
                  A 6-digit code was sent to <span className="text-[#1B2A4A]">{viewerEmail}</span>.
                  {devCode ? <span className="block mt-1 text-[#6B7280]">DEV CODE: <span className="text-[#24407A] tracking-widest">{devCode}</span></span> : null}
                </div>
                <input value={viewerCode} onChange={(e) => setViewerCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoFocus placeholder="000000"
                  className="w-full h-14 px-5 border border-[#D8CFB8] rounded-xl text-center text-2xl tracking-[0.5em] font-mono text-[#1B2A4A] focus:outline-none focus:border-[#24407A] transition-all" />
                <button type="submit" disabled={loading === "viewer"} className="w-full h-12 bg-[#CAB879] text-[#1B2A4A] rounded-xl font-mono text-xs font-bold tracking-widest disabled:opacity-50">
                  {loading === "viewer" ? "AUTHENTICATING..." : "VERIFY & ENTER"}
                </button>
                <button type="button" onClick={() => { setViewerStage("register"); setViewerCode(""); setError(""); }} className="w-full h-10 text-[#6B7280] hover:text-[#24407A] font-mono text-[10px] tracking-widest">← BACK</button>
              </form>
            ) : (
              <form onSubmit={viewerRegister} className="space-y-3">
                <div className="relative">
                  <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                  <input type="email" value={viewerEmail} onChange={(e) => setViewerEmail(e.target.value)} required placeholder="viewer@registry.gov.in"
                    className="w-full h-12 pl-11 pr-4 border border-[#D8CFB8] rounded-xl text-sm font-mono text-[#1B2A4A] placeholder-[#9CA3AF] focus:outline-none focus:border-[#24407A] transition-all" />
                </div>
                <input type="text" value={viewerName} onChange={(e) => setViewerName(e.target.value)} required placeholder="Full name for the record"
                  className="w-full h-12 px-4 border border-[#D8CFB8] rounded-xl text-sm font-mono text-[#1B2A4A] placeholder-[#9CA3AF] focus:outline-none focus:border-[#24407A] transition-all" />
                <div className="relative">
                  <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                  <input type="password" value={viewerPassword} onChange={(e) => setViewerPassword(e.target.value)} required placeholder="Password"
                    className="w-full h-12 pl-11 pr-4 border border-[#D8CFB8] rounded-xl text-sm font-mono text-[#1B2A4A] placeholder-[#9CA3AF] focus:outline-none focus:border-[#24407A] transition-all" />
                </div>
                <button type="submit" disabled={loading === "viewer"} className="w-full h-12 bg-[#CAB879] text-[#1B2A4A] rounded-xl font-mono text-xs font-bold tracking-widest disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading === "viewer" ? "SENDING..." : <><ArrowRight size={14} /> REGISTER &amp; SEND CODE</>}
                </button>
                <button type="button" onClick={() => viewerRequestOtp()} disabled={loading === "viewer"} className="w-full h-10 text-[#6B7280] hover:text-[#24407A] font-mono text-[10px] tracking-widest disabled:opacity-50">ALREADY REGISTERED — SEND CODE</button>
              </form>
            )
          )}

          {error && (
            <motion.div {...fadeSlideUp} className="mt-5 p-4 bg-[#7A1F2B]/10 border border-[#7A1F2B]/30 rounded-xl text-[#7A1F2B] text-sm font-mono">
              {error}
            </motion.div>
          )}

          <div className="mt-7 flex items-center justify-center gap-3 text-[10px] text-[#3E4A63] font-mono">
            <motion.span animate={{ scale: [1, 1.25, 1] }} transition={{ duration: 2, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-[#1E6B4A]" />
            <span>AES-256 · JWT · MFA ACTIVE · SESSION ENCRYPTED</span>
          </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────
function Dashboard({ role, onLogout, onLogin }: { role: string; onLogout: () => void; onLogin: (t: string, r: string) => void }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString("en-GB", { hour12: false }));
  const [activeView, setActiveView] = useState<ActiveView>("overview");
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [openedCase, setOpenedCase] = useState<CaseItem | null>(null);
  const [loadingCases, setLoadingCases] = useState(true);
  const [toast, setToast] = useState("");
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [openDocId, setOpenDocId] = useState<string | null>(null);
  // Tracks the newest case so the list can scroll to it + flash it after create.
  const [flashCaseId, setFlashCaseId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString("en-GB", { hour12: false })), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadCases();
    api.getUserMe().then(setCurrentUser).catch(() => { });
  }, []);

  function loadCases() {
    setLoadingCases(true);
    api.listCases()
      // Guard the shape: a proxy/error payload must not break the case lists.
      .then((data: CaseItem[]) => setCases(Array.isArray(data) ? data : []))
      .catch(() => { })
      .finally(() => setLoadingCases(false));
  }

  function quickPrototypeLogin(demoRole: "investigator" | "auditor" | "admin") {
    api.prototypeLogin(demoRole, demoRole).then((res: any) => {
      localStorage.setItem("anveshan_token", res.access_token);
      localStorage.setItem("anveshan_role", res.role);
      onLogin(res.access_token, res.role);
      setCurrentUser(res.user || null);
      notify("Signed in as demo " + res.role);
    }).catch((err: Error) => notify(err.message || "Prototype login failed"));
  }

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  // After a case is created: jump to the Case Files view, reload, then smooth-
  // scroll the new card into view and flash it so the click has a visible payoff.
  async function handleCaseCreated(created: any) {
    setShowNewCaseModal(false);
    setFlashCaseId(created?.id ?? null);
    // If we are on overview, switch to the full case list where the card lives.
    setActiveView("cases");
    try {
      const data = await api.listCases();
      setCases(Array.isArray(data) ? data : []);
    } catch { /* keep existing list on failure */ }
    setLoadingCases(false);
    notify(`Case file ${created?.case_number || "created"} sealed`);
    // Wait a beat for the list to render, then scroll to the new card.
    setTimeout(() => {
      const el = created?.id ? document.getElementById(`case-card-${created.id}`) : null;
      (el ?? contentRef.current)?.scrollIntoView({ behavior: "smooth", block: el ? "center" : "start" });
    }, 350);
    // Stop flashing after a few seconds.
    setTimeout(() => setFlashCaseId((cur) => (created?.id && cur === created.id ? null : cur)), 6000);
  }

  const clearance = CLEARANCE_MAP[role] || CLEARANCE_MAP.viewer;
  const activeCases = cases.filter(c => c.status === "Active").length;

  // Viewers get the public dashboard (notices + complaint desk only)
  if (role === "viewer") {
    return (
      <DashboardShell banner={<PrototypeBanner onQuickLogin={quickPrototypeLogin} />} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} activeView={activeView} setActiveView={setActiveView} clearance={clearance} currentTime={currentTime} currentUser={currentUser} onLogout={onLogout} role={role}>
        <div className="max-w-7xl mx-auto p-8">
          <ViewerDashboard onNotify={notify} />
        </div>
        <Toast message={toast} />
      </DashboardShell>
    );
  }

  // If a case is opened, show case detail (banner inside the shell so layout holds)
  if (openedCase) {
    return (
      <DashboardShell banner={<PrototypeBanner onQuickLogin={quickPrototypeLogin} />} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} activeView={activeView} setActiveView={setActiveView} clearance={clearance} currentTime={currentTime} currentUser={currentUser} onLogout={onLogout} role={role}>
        <CaseDetail
          caseItem={openedCase}
          role={role}
          onBack={() => setOpenedCase(null)}
          onNotify={notify}
          onUpdate={(updated: CaseItem) => { setOpenedCase(updated); setCases(cs => cs.map(c => c.id === updated.id ? updated : c)); }}
        />
        <Toast message={toast} />
      </DashboardShell>
    );
  }

  return (
      <DashboardShell banner={<PrototypeBanner onQuickLogin={quickPrototypeLogin} />} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} activeView={activeView} setActiveView={setActiveView} clearance={clearance} currentTime={currentTime} currentUser={currentUser} onLogout={onLogout} role={role}>
      {activeView === "overview" ? (
        <OverviewView cases={cases} activeCases={activeCases} role={role} loadingCases={loadingCases} onOpenCase={setOpenedCase} onCreateCase={() => setShowNewCaseModal(true)} />
      ) : activeView === "cases" ? (
        <CasesListView cases={cases} role={role} loading={loadingCases} flashCaseId={flashCaseId} onOpenCase={setOpenedCase} onCreateCase={() => setShowNewCaseModal(true)} />
      ) : activeView === "vault" ? (
        <VaultView onOpenDocument={setOpenDocId} />
      ) : activeView === "departments" ? (
        <DepartmentsView role={role} currentUser={currentUser} onNotify={notify} />
      ) : activeView === "auditlogs" ? (
        <AuditLogsView role={role} />
      ) : activeView === "clearance" ? (
        <ClearanceView role={role} currentUser={currentUser} onNotify={notify} />
      ) : (
        <SettingsView role={role} currentUser={currentUser} onNotify={notify} />
      )}

      {openDocId && (
        <DocumentDetailModal docId={openDocId} role={role} onClose={() => setOpenDocId(null)} onNotify={notify} />
      )}

      {showNewCaseModal && (
        <NewCaseModal
          onClose={() => setShowNewCaseModal(false)}
          onSuccess={handleCaseCreated}
        />
      )}
      <Toast message={toast} />
    </DashboardShell>
  );
}

// ── Dashboard Shell (sidebar + topbar wrapper) ───────────────────────
function DashboardShell({ children, banner, sidebarOpen, setSidebarOpen, activeView, setActiveView, clearance, currentTime, currentUser, onLogout, role }: any) {
  return (
    <div className="min-h-screen text-ink flex font-sans overflow-hidden relative" style={{ color: "#16213c" }}>
      {/* Background: your bg.png when uploaded, else the default glow */}
      <AppBackground />

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 260 : 80 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="glass-panel z-20 border-r border-fileline flex flex-col shrink-0 shadow-[8px_0_30px_rgba(27,42,74,0.10)]"
      >
        <div className="h-20 flex items-center px-6 border-b border-fileline gap-4 bg-gradient-to-r from-[#24407A]/[.06] to-transparent">
          <motion.div whileHover={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 0.5 }}>
            <BrandLogo size={30} />
          </motion.div>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="whitespace-nowrap">
                <div className="font-mono font-bold tracking-[0.15em] text-ink text-sm leading-none">ANVESHAN</div>
                <div className="text-[8px] font-mono tracking-[0.3em] text-[#9A7B2E] mt-1">EVIDENCE REGISTRY</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 py-6 flex flex-col gap-1.5 px-3">
          <NavItem icon={Zap} label="Overview" active={activeView === "overview"} isOpen={sidebarOpen} onClick={() => setActiveView("overview")} />
          <NavItem icon={FolderOpen} label="Case Files" active={activeView === "cases"} isOpen={sidebarOpen} onClick={() => setActiveView("cases")} />
          <NavItem icon={Database} label="Evidence Vault" active={activeView === "vault"} isOpen={sidebarOpen} onClick={() => setActiveView("vault")} />
          <NavItem icon={Building2} label="Departments" active={activeView === "departments"} isOpen={sidebarOpen} onClick={() => setActiveView("departments")} />
          <NavItem icon={FileText} label="Audit Logs" active={activeView === "auditlogs"} isOpen={sidebarOpen} onClick={() => setActiveView("auditlogs")} />
          {role !== "viewer" && <NavItem icon={Shield} label="Clearance" active={activeView === "clearance"} isOpen={sidebarOpen} onClick={() => setActiveView("clearance")} />}
          <NavItem icon={Settings} label="Settings" active={activeView === "settings"} isOpen={sidebarOpen} onClick={() => setActiveView("settings")} />
        </nav>

        <div className="px-4 pb-4 border-t border-fileline pt-4">
          {sidebarOpen && (
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-8 h-8 rounded-lg bg-cybergold/10 border border-cybergold/20 flex items-center justify-center text-cybergold text-xs font-bold font-mono">
                {(currentUser?.full_name || "US").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-ink truncate">{currentUser?.full_name || "Operator"}</div>
                <div className="text-[10px] text-[#6B7280] font-mono">{role?.toUpperCase()}</div>
              </div>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="w-full flex items-center justify-center h-10 rounded-lg hover:bg-ink/5 text-[#6B7280] hover:text-ink transition-colors">
            {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col z-10 h-screen overflow-hidden">
        {/* Security Hero Banner */}
        <header className="h-16 glass-panel border-b border-fileline px-8 flex items-center justify-between shrink-0 bg-gradient-to-r from-[#24407A]/[.05] via-transparent to-[#9A7B2E]/[.05]">
          <div className="flex items-center gap-6">
            <motion.div whileHover={{ scale: 1.04 }} className={`px-3 py-1 rounded-full ${clearance.bg} border ${clearance.border} flex items-center gap-2`}>
              <ShieldCheck size={14} className={clearance.color} />
              <span className={`text-[10px] font-mono font-bold ${clearance.color} tracking-widest`}>{clearance.label}</span>
            </motion.div>
            <div className="flex items-center gap-2">
              <motion.div animate={{ opacity: [1, 0.3, 1], scale: [1, 1.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-biometric shadow-[0_0_6px_rgba(36,64,122,0.45)]" />
              <span className="text-[10px] font-mono text-biometric font-bold tracking-widest">ENCRYPTED</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-[#3E4A63] font-mono text-sm font-semibold">
              <Clock size={14} />
              <span className="tracking-wider tabular-nums">{currentTime}</span>
            </div>
            <button onClick={onLogout} className="text-[10px] font-bold text-[#3E4A63] hover:text-seal transition-colors tracking-widest font-mono px-3 py-1.5 rounded-lg hover:bg-seal/10 border border-transparent hover:border-seal/20">
              TERMINATE
            </button>
          </div>
        </header>

        {/* Scrollable content area — smooth scroll for post-create jumps */}
        <div className="flex-1 overflow-y-auto scrollbar-hide scroll-smooth">
          {banner}
          {children}
        </div>
      </main>
    </div>
  );
}

// ── NavItem ──────────────────────────────────────────────────────────
function NavItem({ icon: Icon, label, active, isOpen, onClick }: any) {
  return (
    <motion.button whileHover={{ x: 3 }} whileTap={{ scale: 0.98 }} onClick={onClick} className={`w-full flex items-center h-11 rounded-xl transition-all duration-200 group relative overflow-hidden ${active ? "bg-gradient-to-r from-cybergold/20 to-cybergold/5 border border-cybergold/30 shadow-[0_2px_10px_rgba(154,123,46,0.15)]" : "hover:bg-ink/5 border border-transparent"}`}>
      {active && <motion.div layoutId="nav-glow" className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 rounded-full bg-gradient-to-b from-[#C9A36C] to-[#9A7B2E]" />}
      <div className={`w-11 h-11 shrink-0 flex items-center justify-center ${active ? "text-[#9A7B2E]" : "text-[#4A5568] group-hover:text-ink"}`}>
        <Icon size={18} />
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} className={`text-xs font-mono tracking-wide whitespace-nowrap overflow-hidden ${active ? "text-registry font-bold" : "text-[#4A5568] group-hover:text-ink"}`}>
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ── Overview View ────────────────────────────────────────────────────
function OverviewView({ cases, activeCases, role, loadingCases, onOpenCase, onCreateCase }: any) {
  const canCreate = role === "admin";

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="max-w-7xl mx-auto p-8 space-y-8">
      {/* Header — registry masthead with animated rule */}
      <motion.div variants={staggerItem} className="glass-panel rounded-2xl p-6 panel-lift relative overflow-hidden">
        <div aria-hidden className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#24407A] via-[#C9A36C] to-[#24407A]" />
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] font-mono font-bold text-[#9A7B2E] tracking-[0.24em] mb-2 flex items-center gap-2">
              <motion.span animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 2, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-[#9A7B2E]" />
              COMMAND CENTER
            </div>
            <h1 className="text-3xl font-bold text-[#16213c] font-serif tracking-wide">Secure Dashboard</h1>
            <p className="text-[#3E4A63] text-sm mt-1 font-medium">Your classified workspace. All actions are logged.</p>
          </div>
          {canCreate && (
            <motion.button whileHover={{ y: -2, scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={onCreateCase} className="h-11 px-5 bg-gradient-to-r from-[#24407A] to-[#1B2A4A] text-white font-bold font-mono text-xs tracking-widest rounded-xl flex items-center gap-2 shadow-[0_6px_20px_rgba(36,64,122,0.35)] hover:shadow-[0_8px_26px_rgba(36,64,122,0.45)] transition-all">
              <Plus size={16} /> NEW CASE
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard title="TOTAL CASE FILES" value={String(cases.length)} icon={FolderOpen} delay={0} />
        <MetricCard title="ACTIVE CASES" value={String(activeCases)} icon={Zap} delay={1} accent />
        <MetricCard title="INTEGRITY CHECKS" value="—" icon={ShieldCheck} delay={2} />
        <MetricCard title="ROLE" value={role?.toUpperCase() || "—"} icon={Shield} delay={3} />
      </div>

      {/* Recent Cases */}
      <motion.div variants={staggerItem} className="glass-panel rounded-2xl overflow-hidden panel-lift">
        <div className="px-6 py-5 border-b border-fileline flex items-center justify-between bg-gradient-to-r from-[#24407A]/[.05] to-transparent">
          <h2 className="text-sm font-mono font-bold text-[#16213c] tracking-widest flex items-center gap-2">
            <FolderOpen size={15} className="text-[#9A7B2E]" />
            RECENT CASE FILES
          </h2>
          <span className="text-[10px] font-mono text-[#3E4A63] font-bold tracking-wider bg-[#24407A]/10 px-2.5 py-1 rounded-full border border-[#24407A]/20">{cases.length} RECORDS</span>
        </div>
        {loadingCases ? (
          <div className="py-16 text-center text-[#3E4A63] text-sm font-mono font-bold">LOADING RECORDS...</div>
        ) : cases.length === 0 ? (
          <div className="py-16 text-center">
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity }}>
              <FolderOpen size={40} className="text-[#B9AE93] mx-auto mb-4" />
            </motion.div>
            <p className="text-[#3E4A63] text-sm font-mono font-bold">NO CASE FILES FOUND</p>
          </div>
        ) : (
          <div className="divide-y divide-fileline">
            {cases.slice(0, 8).map((c: CaseItem, i: number) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.06 * i }}
                whileHover={{ x: 4 }}
                onClick={() => onOpenCase(c)}
                className="flex items-center gap-5 px-6 py-4 hover:bg-[#24407A]/[.04] cursor-pointer transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#24407A]/15 to-[#9A7B2E]/10 border border-[#24407A]/20 flex items-center justify-center text-[#24407A] group-hover:text-[#9A7B2E] group-hover:border-[#9A7B2E]/40 transition-colors">
                  <FolderOpen size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-[#16213c] group-hover:text-[#24407A] transition-colors">{c.title}</div>
                  <div className="text-[11px] text-[#3E4A63] font-mono mt-0.5">{c.case_number} · {formatDate(c.created_at)}</div>
                </div>
                <StatusPill status={c.status} />
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Cases List View ──────────────────────────────────────────────────
function CasesListView({ cases, role, loading, flashCaseId, onOpenCase, onCreateCase }: any) {
  const [search, setSearch] = useState("");
  const canCreate = role === "admin";
  const filtered = cases.filter((c: CaseItem) => `${c.case_number} ${c.title}`.toLowerCase().includes(search.toLowerCase()));
  // Keep a DOM ref per card so a newly created case can be scrolled into view.
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const searchRef = useRef<HTMLInputElement | null>(null);

  // When the dashboard flags a fresh case, scroll it into the centre of the
  // scrollable content area. Cards carry id={`case-card-${id}`} as fallback.
  useEffect(() => {
    if (!flashCaseId) return;
    const t = setTimeout(() => {
      const el = cardRefs.current[flashCaseId] ?? document.getElementById(`case-card-${flashCaseId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
    return () => clearTimeout(t);
  }, [flashCaseId, cases]);

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="max-w-7xl mx-auto p-8 space-y-6">
      <motion.div variants={staggerItem} className="glass-panel rounded-2xl p-6 panel-lift relative overflow-hidden">
        <div aria-hidden className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#9A7B2E] via-[#C9A36C] to-[#9A7B2E]" />
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] font-mono font-bold text-[#9A7B2E] tracking-[0.24em] mb-2">EVIDENCE VAULT</div>
            <h1 className="text-3xl font-bold text-[#16213c] font-serif tracking-wide">Case Files</h1>
          </div>
          {canCreate && (
            <motion.button whileHover={{ y: -2, scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={onCreateCase} className="h-11 px-5 bg-gradient-to-r from-[#24407A] to-[#1B2A4A] text-white font-bold font-mono text-xs tracking-widest rounded-xl flex items-center gap-2 shadow-[0_6px_20px_rgba(36,64,122,0.35)] transition-all">
              <Plus size={16} /> NEW CASE
            </motion.button>
          )}
        </div>
      </motion.div>

      <motion.div variants={staggerItem}>
        <div className="relative mb-6">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9A7B2E]" />
          <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === "/" && document.activeElement !== searchRef.current) { e.preventDefault(); searchRef.current?.focus(); } }} placeholder="Search by case number or title... ( / )" className="w-full h-12 pl-11 pr-4 bg-[#FBF8F1]/90 border border-fileline rounded-xl text-sm font-mono text-[#16213c] placeholder:text-[#8A8578] placeholder:font-semibold focus:outline-none focus:border-[#24407A] focus:ring-2 focus:ring-[#24407A]/20 transition-all shadow-sm" />
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-[#3E4A63] font-mono text-sm font-bold">LOADING...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-16 text-center">
            <FolderOpen size={40} className="text-[#B9AE93] mx-auto mb-4" />
            <p className="text-[#3E4A63] font-mono text-sm font-bold">NO MATCHING RECORDS</p>
          </div>
        ) : filtered.map((c: CaseItem) => (
          <CaseCard key={c.id} caseItem={c} flash={c.id === flashCaseId} cardRef={(el: HTMLDivElement | null) => { cardRefs.current[c.id] = el; }} onClick={() => onOpenCase(c)} />
        ))}
      </motion.div>
    </motion.div>
  );
}

// ── Case Card ────────────────────────────────────────────────────────
function CaseCard({ caseItem, onClick, flash = false, cardRef }: { caseItem: CaseItem; onClick: () => void; flash?: boolean; cardRef?: (el: HTMLDivElement | null) => void }) {
  return (
    <motion.div
      ref={cardRef}
      id={`case-card-${caseItem.id}`}
      whileHover={{ y: -5, scale: 1.015 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      animate={flash ? { boxShadow: ["0 0 0 0 rgba(154,123,46,0.0)", "0 0 0 6px rgba(154,123,46,0.35)", "0 0 0 0 rgba(154,123,46,0.0)"] } : {}}
      onClick={onClick}
      title={`Open ${caseItem.case_number} — ${caseItem.title}`}
      className={`glass-panel rounded-xl p-6 cursor-pointer group panel-lift relative overflow-hidden ${flash ? "border-[#9A7B2E]" : ""}`}
    >
      {flash && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="absolute top-3 right-3 z-10 text-[8px] font-mono font-bold tracking-[0.2em] text-white bg-gradient-to-r from-[#9A7B2E] to-[#7A5F1F] px-2 py-0.5 rounded-full shadow">
          NEWLY SEALED
        </motion.div>
      )}
      <div aria-hidden className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#C9A36C] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-start justify-between mb-4">
        <div className="text-[10px] font-mono font-bold text-[#24407A] tracking-widest bg-[#24407A]/10 px-2 py-0.5 rounded border border-[#24407A]/20">{caseItem.case_number}</div>
        <StatusPill status={caseItem.status} />
      </div>
      <h3 className="text-lg font-bold font-serif text-[#16213c] group-hover:text-[#24407A] transition-colors mb-2 leading-tight">{caseItem.title}</h3>
      {caseItem.description && <p className="text-xs text-[#3E4A63] font-medium line-clamp-2 mb-4">{caseItem.description}</p>}
      <div className="pt-4 border-t border-fileline text-[10px] font-mono font-bold text-[#3E4A63] tracking-wider flex items-center gap-1.5">
        <Clock size={11} /> FILED {formatDate(caseItem.created_at)}
      </div>
    </motion.div>
  );
}

// ── Case Detail View ─────────────────────────────────────────────────
function CaseDetail({ caseItem, role, onBack, onNotify, onUpdate }: any) {
  const [tab, setTab] = useState<"documents" | "audit">("documents");
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditEvent[]>([]);
  const [mlData, setMlData] = useState<Record<string, { category: string; tags: string[]; status: string; confidence: number }>>({});
  // ML tag filter — clicking a tag chip shows only related evidence
  const [mlFilter, setMlFilter] = useState<string | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(true);
  // All unique ML tags across this case's evidence (for the filter row)
  const allMlTags = Array.from(new Set(Object.values(mlData).flatMap((d) => d.tags || [])));
  // Docs visible under the active tag filter
  const visibleDocs = mlFilter === null ? docs : docs.filter((doc) => (mlData[doc.id]?.tags || []).includes(mlFilter));
  const [modal, setModal] = useState<string | null>(null);
  const [openDocId, setOpenDocId] = useState<string | null>(null);

  const canWrite = role === "investigator" || role === "admin";

  function loadDocs() {
    setLoadingDocs(true);
    Promise.all([
      api.getCaseDocuments(caseItem.id).then(setDocs).catch(() => {}),
      loadMlForCase(),
    ]).finally(() => { setLoadingDocs(false); });
  }

  async function loadMlForCase() {
    const caseDocs = await api.getCaseDocuments(caseItem.id);
    const map: Record<string, { category: string; tags: string[]; status: string; confidence: number }> = {};
    for (const d of caseDocs || []) {
      try {
        const ml = await api.getMlSuggestions(d.id);
        if (ml && ml.status) {
          map[d.id] = { category: ml.category || "—", tags: ml.tags || [], status: ml.status, confidence: ml.confidence || 0 };
        }
      } catch {}
    }
    setMlData(map);
  }

  function loadAudit() {
    setLoadingAudit(true);
    api.getCaseAuditTrail(caseItem.id).then(setAuditTrail).catch(() => { }).finally(() => setLoadingAudit(false));
  }

  useEffect(() => { loadDocs(); loadAudit(); }, [caseItem.id]);

  return (
    <motion.div {...fadeSlideUp} className="max-w-6xl mx-auto p-8 space-y-6">
      {/* Back — returns to the case list that opened this dossier */}
      <button onClick={onBack} title="Back to Case Files list" className="flex items-center gap-2 text-[#3E4A63] hover:text-[#24407A] text-xs font-mono font-bold tracking-widest transition-colors">
        <ArrowLeft size={14} /> ALL CASES
      </button>

      {/* Header — dossier masthead: number, title, status, counts */}
      <div className="glass-panel rounded-2xl p-8 panel-lift relative overflow-hidden">
        <div aria-hidden className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#24407A] via-[#C9A36C] to-[#24407A]" />
        <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-mono font-bold text-[#24407A] tracking-[0.2em] mb-2 bg-[#24407A]/10 px-2 py-0.5 rounded border border-[#24407A]/20 w-fit">{caseItem.case_number}</div>
          <h1 className="text-3xl font-bold text-[#16213c] font-serif tracking-wide mb-3">{caseItem.title}</h1>
          <div className="flex gap-3 items-center">
            <StatusPill status={caseItem.status} />
            <span className="text-[10px] font-mono font-bold text-[#3E4A63] tracking-wider flex items-center gap-1"><ClipboardList size={12} /> {docs.length} DOCUMENTS</span>
          </div>
          {caseItem.description && <p className="text-sm text-[#3E4A63] font-medium mt-4 max-w-lg">{caseItem.description}</p>}
        </div>
        {canWrite && (
          <div className="flex gap-3">
            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={() => setModal("edit")} title="Edit case title, description and status" className="h-10 px-4 border border-fileline rounded-xl text-xs font-mono font-bold text-[#16213c] hover:bg-[#24407A]/[.06] hover:border-[#24407A]/30 transition-all flex items-center gap-2">
              <Settings2 size={14} /> EDIT
            </motion.button>
            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={() => setModal("upload")} title="Attach a new sealed evidence file to this case" className="h-10 px-4 bg-gradient-to-r from-[#24407A] to-[#1B2A4A] text-white rounded-xl text-xs font-mono font-bold flex items-center gap-2 shadow-[0_6px_18px_rgba(36,64,122,0.35)] transition-all">
              <Upload size={14} /> ADD EVIDENCE
            </motion.button>
          </div>
        )}
        </div>
      </div>

      {/* Tabs — documents grid vs tamper-evident audit trail */}
      <div className="flex gap-1">
        <button onClick={() => setTab("documents")} title="Sealed evidence files in this case" className={`px-6 py-3 text-xs font-mono font-bold tracking-widest rounded-t-xl transition-all ${tab === "documents" ? "bg-[#FBF8F1] text-[#24407A] border-b-2 border-[#24407A] shadow-sm" : "text-[#3E4A63] hover:text-[#16213c]"}`}>
          DOCUMENTS <span className="ml-2 px-2 py-0.5 rounded-full bg-[#24407A]/10 text-[10px]">{docs.length}</span>
        </button>
        <button onClick={() => setTab("audit")} title="Every action on this case, hash-chained" className={`px-6 py-3 text-xs font-mono font-bold tracking-widest rounded-t-xl transition-all ${tab === "audit" ? "bg-[#FBF8F1] text-[#24407A] border-b-2 border-[#24407A] shadow-sm" : "text-[#3E4A63] hover:text-[#16213c]"}`}>
          AUDIT TRAIL <span className="ml-2 px-2 py-0.5 rounded-full bg-[#24407A]/10 text-[10px]">{auditTrail.length}</span>
        </button>

      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {tab === "documents" && (
          <motion.div key="docs" {...fadeSlideUp} className="space-y-4">
            {allMlTags.length > 0 && (
              <div className="glass-panel rounded-xl px-4 py-3 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono font-bold text-[#6B7280] tracking-widest flex items-center gap-1.5">
                  <Brain size={12} className="text-cybergold" /> ML TAGS
                </span>
                <button onClick={() => setMlFilter(null)} className={`px-3 py-1 text-[10px] font-mono font-bold rounded-full border transition-all ${mlFilter === null ? "bg-cybergold/10 border-cybergold/30 text-cybergold" : "bg-obsidian-700 border-fileline text-[#6B7280] hover:border-ink/20"}`}>
                  ALL {docs.length}
                </button>
                {allMlTags.map((tag) => {
                  const n = docs.filter((d) => (mlData[d.id]?.tags || []).includes(tag)).length;
                  return (
                    <button key={tag} onClick={() => setMlFilter(mlFilter === tag ? null : tag)} className={`px-3 py-1 text-[10px] font-mono font-bold rounded-full border transition-all ${mlFilter === tag ? "bg-biometric/10 border-biometric/30 text-biometric" : "bg-obsidian-700 border-fileline text-[#6B7280] hover:border-ink/20"}`}>
                      #{tag} {n > 0 && <span className="opacity-70">· {n}</span>}
                    </button>
                  );
                })}
                {mlFilter !== null && (
                  <span className="text-[10px] font-mono text-[#6B7280]">showing {visibleDocs.length} of {docs.length} — click the tag again to clear</span>
                )}
              </div>
            )}

            {loadingDocs ? (
              <div className="py-16 text-center text-[#6B7280] font-mono text-sm">LOADING DOCUMENTS...</div>
            ) : docs.length === 0 ? (
              <div className="glass-panel rounded-2xl py-16 text-center">
                <Database size={40} className="text-[#B9AE93] mx-auto mb-4" />
                <p className="text-ink font-bold font-mono mb-1">NO EVIDENCE FILED</p>
                <p className="text-[#6B7280] text-sm">Add the first piece of evidence using the button above.</p>
              </div>
            ) : visibleDocs.length === 0 ? (
              <div className="glass-panel rounded-2xl py-16 text-center">
                <Brain size={40} className="text-[#B9AE93] mx-auto mb-4" />
                <p className="text-ink font-bold font-mono mb-1">NO EVIDENCE WITH THIS TAG</p>
                <p className="text-[#6B7280] text-sm">No evidence in this case carries the tag #{mlFilter}.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {visibleDocs.map((doc, i) => {
                  const DIcon = docIcon(doc.doc_type);
                  const tags = mlData[doc.id]?.tags || [];
                  return (
                    <motion.div key={doc.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} onClick={() => setOpenDocId(doc.id)}
                      className="glass-panel rounded-xl p-5 border border-fileline hover:border-cybergold/30 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-obsidian-700 flex items-center justify-center text-[#6B7280] group-hover:text-cybergold transition-colors">
                          <DIcon size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-ink group-hover:text-cybergold transition-colors truncate">{doc.title}</div>
                          <div className="text-[10px] font-mono text-[#6B7280] mt-0.5">{doc.doc_type?.replace(/_/g, " ")} · {doc.sensitivity_level}</div>
                        </div>
                        <StatusPill status={doc.status === "active" ? "Active" : doc.status} />
                      </div>
                      {tags.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap mt-3" onClick={(e) => e.stopPropagation()}>
                          {tags.map((tag) => (
                            <button key={tag} onClick={() => setMlFilter(mlFilter === tag ? null : tag)} title={`Show only evidence tagged #${tag}`}
                              className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded-full border transition-all ${mlFilter === tag ? "bg-biometric/10 border-biometric/30 text-biometric" : "bg-obsidian-700 border-fileline text-[#6B7280] hover:text-biometric hover:border-biometric/30"}`}>
                              #{tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {tab === "audit" && (
          <motion.div key="audit" {...fadeSlideUp} className="glass-panel rounded-2xl p-6">
            {loadingAudit ? (
              <div className="py-16 text-center text-[#6B7280] font-mono text-sm">LOADING AUDIT TRAIL...</div>
            ) : auditTrail.length === 0 ? (
              <div className="py-16 text-center">
                <ShieldCheck size={40} className="text-[#B9AE93] mx-auto mb-4" />
                <p className="text-ink font-bold font-mono mb-1">NO EVENTS RECORDED</p>
                <p className="text-[#6B7280] text-sm">Events appear here as actions are performed.</p>
              </div>
            ) : (
              <div className="space-y-0">
                {auditTrail.map((ev, i) => (
                  <div key={ev.id} className="flex gap-5 relative">
                    {i < auditTrail.length - 1 && <div className="absolute left-[7px] top-6 bottom-0 w-px bg-fileline" />}
                    <div className={`w-4 h-4 rounded-full border-2 mt-1 shrink-0 relative z-10 ${ev.event_type.includes("upload") || ev.event_type.includes("version") ? "border-biometric bg-biometric/20 shadow-[0_0_8px_rgba(36,64,122,0.25)]" : ev.event_type.includes("sign") ? "border-cybergold bg-cybergold/20" : "border-fileline bg-obsidian-800"}`} />
                    <div className="flex-1 pb-6">
                      <div className="text-sm font-bold text-ink">{ev.action}</div>
                      <div className="text-[10px] font-mono text-[#6B7280] mt-1 flex items-center gap-3 flex-wrap">
                        <span>{ev.event_type}</span>
                        {ev.actor_user_id && <span>by {ev.actor_user_id.slice(0, 8)}…</span>}
                        {ev.event_hash && (
                          <span className="px-2 py-0.5 rounded bg-obsidian-900 border border-fileline text-biometric">
                            <Hash size={10} className="inline mr-1" />{ev.event_hash.slice(0, 16)}…
                          </span>
                        )}
                      </div>
                      {ev.details && Object.keys(ev.details).length > 0 && (
                        <div className="text-[9px] font-mono text-[#6B7280] mt-2 space-y-0.5">
                          {Object.entries(ev.details).slice(0, 4).map(([k, v]) => (
                            <div key={k}><span className="text-[#6B7280]">{k}:</span> {String(v ?? "—").slice(0, 80)}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-[#6B7280] whitespace-nowrap mt-1">{formatDate(ev.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Case Modal */}
      {modal === "edit" && (
        <ModalBackdrop onClose={() => setModal(null)}>
          <EditCaseModal caseItem={caseItem} onClose={() => setModal(null)} onSuccess={(updated: CaseItem) => { setModal(null); onUpdate(updated); onNotify("Case updated"); loadAudit(); }} />
        </ModalBackdrop>
      )}

      {/* Upload Evidence Modal */}
      {modal === "upload" && (
        <ModalBackdrop onClose={() => setModal(null)}>
          <UploadEvidenceModal caseId={caseItem.id} onClose={() => setModal(null)} onSuccess={() => { setModal(null); loadDocs(); loadAudit(); onNotify("Evidence uploaded & sealed"); }} />
        </ModalBackdrop>
      )}

      {/* Document Detail Modal */}
      {openDocId && (
        <DocumentDetailModal docId={openDocId} role={role} onClose={() => setOpenDocId(null)} onNotify={onNotify} />
      )}
    </motion.div>
  );
}

// ── Metric Card ──────────────────────────────────────────────────────
function MetricCard({ title, value, icon: Icon, accent }: any) {
  return (
    <motion.div variants={staggerItem} whileHover={{ y: -4 }} className="glass-panel rounded-xl p-6 glow-border relative overflow-hidden group hover:glow-border-hover panel-lift">
      <div aria-hidden className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#C9A36C] to-transparent opacity-60" />
      <motion.div animate={{ rotate: [0, 6, -6, 0], scale: [1, 1.05, 1] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-4 right-4 opacity-[0.14] group-hover:opacity-25 transition-opacity duration-500">
        <Icon size={64} className={accent ? "text-[#9A7B2E]" : "text-[#24407A]"} />
      </motion.div>
      <div className="relative z-10">
        <h3 className="text-[9px] font-mono font-bold text-[#3E4A63] tracking-[0.2em] mb-5">{title}</h3>
        <div className="text-3xl font-bold font-mono tracking-tight text-[#16213c]">{value}</div>
      </div>
    </motion.div>
  );
}

// ── Status Pill ──────────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const s = status?.toLowerCase() || "";
  let cls = "bg-[#24407A]/10 text-[#24407A] border-[#24407A]/25";
  if (s === "active") cls = "bg-[#1E6B4A]/10 text-[#1E6B4A] border-[#1E6B4A]/25";
  else if (s === "review") cls = "bg-[#9A7B2E]/15 text-[#7A5F1F] border-[#9A7B2E]/35";
  else if (s === "closed") cls = "bg-[#3E4A63]/10 text-[#3E4A63] border-[#3E4A63]/25";
  else if (s === "dissolved") cls = "bg-seal/10 text-seal border-seal/25";

  return (
    <motion.span whileHover={{ scale: 1.06 }} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest border ${cls}`}>
      <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-current" />
      {status?.toUpperCase()}
    </motion.span>
  );
}

// ── Modal Backdrop ───────────────────────────────────────────────────
function ModalBackdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} onClick={e => e.stopPropagation()} className="w-full max-w-md">
        {children}
      </motion.div>
    </motion.div>
  );
}

// ── New Case Modal ───────────────────────────────────────────────────
function NewCaseModal({ onClose, onSuccess }: any) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const created = await api.createCase({ title, description });
      // Hand the created record back so the dashboard can scroll to it.
      onSuccess(created);
    } catch (err: any) {
      setError(err.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-obsidian-800 border border-fileline rounded-2xl p-8 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold font-mono text-ink tracking-widest flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cybergold/10 flex items-center justify-center"><FolderOpen size={18} className="text-cybergold" /></div>
          NEW CASE FILE
        </h2>
        <button onClick={onClose} className="text-[#6B7280] hover:text-ink transition-colors"><X size={20} /></button>
      </div>
      <form onSubmit={submit} className="space-y-5">
        <label className="block">
          <span className="text-[10px] font-mono text-[#6B7280] tracking-widest block mb-2">CASE TITLE</span>
          <input value={title} onChange={e => setTitle(e.target.value)} required className="w-full h-12 px-4 bg-obsidian-900 border border-fileline rounded-xl text-sm font-mono text-ink focus:outline-none focus:border-cybergold/50 focus:ring-1 focus:ring-cybergold/30 transition-all" />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono text-[#6B7280] tracking-widest block mb-2">DESCRIPTION</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full px-4 py-3 bg-obsidian-900 border border-fileline rounded-xl text-sm font-mono text-ink resize-none focus:outline-none focus:border-cybergold/50 focus:ring-1 focus:ring-cybergold/30 transition-all" />
        </label>
        {error && <p className="text-seal text-xs font-mono">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 h-11 border border-fileline rounded-xl text-xs font-mono font-bold text-[#6B7280] hover:bg-ink/5 transition-all">CANCEL</button>
          <button type="submit" disabled={loading} className="flex-1 h-11 bg-registry text-paper rounded-xl text-xs font-mono font-bold disabled:opacity-40 hover:shadow-[0_0_15px_rgba(36,64,122,0.25)] transition-all">
            {loading ? "CREATING..." : "CREATE CASE"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Edit Case Modal ──────────────────────────────────────────────────
function EditCaseModal({ caseItem, onClose, onSuccess }: any) {
  const [title, setTitle] = useState(caseItem.title);
  const [description, setDescription] = useState(caseItem.description || "");
  const [status, setStatus] = useState(caseItem.status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const updated = await api.updateCase(caseItem.id, { title, description, status });
      onSuccess(updated);
    } catch (err: any) {
      setError(err.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-obsidian-800 border border-fileline rounded-2xl p-8 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold font-mono text-ink tracking-widest flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cybergold/10 flex items-center justify-center"><Settings2 size={18} className="text-cybergold" /></div>
          EDIT CASE
        </h2>
        <button onClick={onClose} className="text-[#6B7280] hover:text-ink transition-colors"><X size={20} /></button>
      </div>
      <form onSubmit={submit} className="space-y-5">
        <label className="block">
          <span className="text-[10px] font-mono text-[#6B7280] tracking-widest block mb-2">CASE TITLE</span>
          <input value={title} onChange={e => setTitle(e.target.value)} required className="w-full h-12 px-4 bg-obsidian-900 border border-fileline rounded-xl text-sm font-mono text-ink focus:outline-none focus:border-cybergold/50 transition-all" />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono text-[#6B7280] tracking-widest block mb-2">CONTEXT NOTES</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full px-4 py-3 bg-obsidian-900 border border-fileline rounded-xl text-sm font-mono text-ink resize-none focus:outline-none focus:border-cybergold/50 transition-all" />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono text-[#6B7280] tracking-widest block mb-2">STATUS</span>
          <select value={status} onChange={e => setStatus(e.target.value)} className="w-full h-12 px-4 bg-obsidian-900 border border-fileline rounded-xl text-sm font-mono text-ink focus:outline-none focus:border-cybergold/50 transition-all appearance-none">
            <option value="Active">Active</option>
            <option value="Review">Review</option>
            <option value="Closed">Closed</option>
            <option value="Dissolved">Dissolved</option>
          </select>
        </label>
        {error && <p className="text-seal text-xs font-mono">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 h-11 border border-fileline rounded-xl text-xs font-mono font-bold text-[#6B7280] hover:bg-ink/5 transition-all">CANCEL</button>
          <button type="submit" disabled={loading} className="flex-1 h-11 bg-registry text-paper rounded-xl text-xs font-mono font-bold disabled:opacity-40 hover:shadow-[0_0_15px_rgba(36,64,122,0.25)] transition-all">
            {loading ? "SAVING..." : "SAVE CHANGES"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Upload Evidence Modal ────────────────────────────────────────────
function UploadEvidenceModal({ caseId, onClose, onSuccess }: any) {
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("forensic_report");
  const [sensitivity, setSensitivity] = useState("internal");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const doc = await api.createDocument({ case_id: caseId, title, doc_type: docType, sensitivity_level: sensitivity });
      if (file) await api.uploadDocumentVersion(doc.id, file, "Initial upload");
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-obsidian-800 border border-fileline rounded-2xl p-8 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold font-mono text-ink tracking-widest flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-biometric/10 flex items-center justify-center"><Upload size={18} className="text-biometric" /></div>
          ADD EVIDENCE
        </h2>
        <button onClick={onClose} className="text-[#6B7280] hover:text-ink transition-colors"><X size={20} /></button>
      </div>
      <form onSubmit={submit} className="space-y-5">
        <label className="block">
          <span className="text-[10px] font-mono text-[#6B7280] tracking-widest block mb-2">EVIDENCE TITLE</span>
          <input value={title} onChange={e => setTitle(e.target.value)} required className="w-full h-12 px-4 bg-obsidian-900 border border-fileline rounded-xl text-sm font-mono text-ink focus:outline-none focus:border-biometric/50 transition-all" />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-[10px] font-mono text-[#6B7280] tracking-widest block mb-2">TYPE</span>
            <select value={docType} onChange={e => setDocType(e.target.value)} className="w-full h-12 px-4 bg-obsidian-900 border border-fileline rounded-xl text-sm font-mono text-ink focus:outline-none focus:border-biometric/50 transition-all appearance-none">
              <option value="forensic_report">Forensic Report</option>
              <option value="witness_statement">Witness Statement</option>
              <option value="surveillance_footage">Surveillance</option>
              <option value="chain_of_custody">Chain of Custody</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-mono text-[#6B7280] tracking-widest block mb-2">SENSITIVITY</span>
            <select value={sensitivity} onChange={e => setSensitivity(e.target.value)} className="w-full h-12 px-4 bg-obsidian-900 border border-fileline rounded-xl text-sm font-mono text-ink focus:outline-none focus:border-biometric/50 transition-all appearance-none">
              <option value="public">Public</option>
              <option value="internal">Internal</option>
              <option value="restricted">Restricted</option>
              <option value="top_secret">Top Secret</option>
            </select>
          </label>
        </div>
        <div onClick={() => fileRef.current?.click()} className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${file ? "border-biometric/40 bg-biometric/5" : "border-fileline hover:border-biometric/30 hover:bg-ink/[0.03]"}`}>
          <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
          {file ? (
            <div className="text-sm font-mono text-biometric">{file.name} <span className="text-[#6B7280]">({(file.size / 1024).toFixed(1)} KB)</span></div>
          ) : (
            <>
              <Upload size={24} className="text-[#B9AE93] mx-auto mb-2" />
              <p className="text-sm text-[#6B7280] font-mono">Click to attach file</p>
              <p className="text-[10px] text-[#6B7280] font-mono mt-1">Documents, images, audio, video</p>
            </>
          )}
        </div>
        {error && <p className="text-seal text-xs font-mono">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 h-11 border border-fileline rounded-xl text-xs font-mono font-bold text-[#6B7280] hover:bg-ink/5 transition-all">CANCEL</button>
          <button type="submit" disabled={loading || !title} className="flex-1 h-11 bg-registry text-paper rounded-xl text-xs font-mono font-bold disabled:opacity-40 hover:shadow-[0_0_15px_rgba(36,64,122,0.25)] transition-all">
            {loading ? "SEALING..." : "SEAL & UPLOAD"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Toast ────────────────────────────────────────────────────────────
function Toast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-5 py-3 bg-obsidian-800 border border-cybergold/30 rounded-xl shadow-2xl text-sm font-mono text-cybergold">
      <ShieldCheck size={16} /> {message}
    </motion.div>
  );
}
