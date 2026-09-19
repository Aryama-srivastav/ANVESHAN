import React, { useState, useEffect, useRef } from "react";
// @ts-ignore — api.js is plain JS, no types
import { api } from "./api";
import {
  ShieldAlert, Fingerprint, Lock, ChevronLeft, ChevronRight,
  FolderOpen, Database, FileText, Settings, Shield,
  Search, Filter, Activity, Clock, Hash,
  History, AlertTriangle, Eye, ShieldCheck, Plus, ArrowLeft,
  Upload, X, ChevronDown, Zap, ClipboardList, Settings2,
  FileImage, FileAudio, FileVideo, File as FileLucide
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Type definitions ─────────────────────────────────────────────────
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
}

// ── Animation Variants ───────────────────────────────────────────────
const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.15 } }
};
const staggerItem = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } }
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
  admin: { label: "LEVEL 6 — SYSTEM ADMINISTRATOR", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
  auditor: { label: "LEVEL 4 — AUDIT OBSERVER", color: "text-biometric", bg: "bg-biometric/10", border: "border-biometric/30" },
  viewer: { label: "LEVEL 2 — READ ONLY", color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/30" },
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
  return <Dashboard role={role || "investigator"} onLogout={handleLogout} />;
}

// ── Login View ───────────────────────────────────────────────────────
function LoginView({ onLogin }: { onLogin: (t: string, r: string) => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

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

  const roles = ["investigator", "auditor", "admin", "viewer"];

  return (
    <div className="min-h-screen bg-obsidian-900 flex relative overflow-hidden">
      {/* Scanline effect */}
      <div className="scan-line" />

      {/* Ambient grid */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: `linear-gradient(rgba(212,175,55,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.08) 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
        transform: "perspective(1000px) rotateX(60deg) scale(2)",
        transformOrigin: "top center",
      }} />

      {/* Left: Login Panel */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 0.75, 0.25, 1] }}
        className="flex-1 flex items-center justify-center p-8 z-10"
      >
        <div className="max-w-md w-full">
          <div className="flex items-center gap-4 mb-12">
            <div className="w-14 h-14 rounded-xl bg-navy-900 border border-cybergold/30 flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.2)]">
              <ShieldAlert size={28} className="text-cybergold" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white font-mono tracking-[0.2em]">ANVESHAN</h1>
              <p className="text-[10px] text-slate-500 tracking-[0.15em] font-mono mt-0.5">SECURE EVIDENCE INTELLIGENCE</p>
            </div>
          </div>

          <h2 className="text-4xl font-bold text-white leading-[1.1] mb-4">
            Access the<br />
            <span className="text-cybergold">Evidence Vault</span>
          </h2>
          <p className="text-slate-400 text-sm mb-10 max-w-sm leading-relaxed">
            Authenticate with your assigned clearance level. All sessions are encrypted and monitored.
          </p>

          <div className="space-y-3">
            {roles.map((r, i) => (
              <motion.button
                key={r}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                onClick={() => doLogin(r)}
                disabled={loading !== null}
                className={`w-full h-14 rounded-xl border font-mono text-sm tracking-widest font-bold flex items-center px-5 gap-4 transition-all duration-300 disabled:opacity-40 group
                  ${r === "investigator" ? "bg-cybergold/10 border-cybergold/40 text-cybergold hover:bg-cybergold hover:text-obsidian-900" :
                    r === "admin" ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white" :
                      r === "auditor" ? "bg-biometric/10 border-biometric/30 text-biometric hover:bg-biometric hover:text-obsidian-900" :
                        "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                  }`}
              >
                <Fingerprint size={18} className="group-hover:animate-pulse" />
                {loading === r ? "AUTHENTICATING..." : r.toUpperCase()}
              </motion.button>
            ))}
          </div>

          {error && (
            <motion.div {...fadeSlideUp} className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm font-mono">
              {error}
            </motion.div>
          )}

          <div className="mt-10 flex items-center gap-3 text-[10px] text-slate-600 font-mono">
            <Lock size={12} />
            <span>AES-256 · JWT · MFA ACTIVE · SESSION ENCRYPTED</span>
          </div>
        </div>
      </motion.div>

      {/* Right: Decorative panel */}
      <div className="hidden lg:flex flex-1 items-center justify-center border-l border-white/5 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-obsidian-800 to-obsidian-900" />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
          className="relative z-10 text-center px-12"
        >
          <div className="w-24 h-24 rounded-2xl bg-cybergold/10 border border-cybergold/20 flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(212,175,55,0.15)]">
            <Shield size={48} className="text-cybergold" />
          </div>
          <h3 className="text-3xl font-bold text-white font-mono tracking-widest mb-4">CLASSIFIED</h3>
          <p className="text-slate-500 text-sm max-w-xs mx-auto leading-relaxed">
            Tamper-proof chain of custody. Hash-verified integrity. Role-based access control.
          </p>
          <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-biometric/10 border border-biometric/20">
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-2 h-2 rounded-full bg-biometric shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
            <span className="text-biometric text-[10px] font-mono tracking-widest">SYSTEM ONLINE</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────
function Dashboard({ role, onLogout }: { role: string; onLogout: () => void }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString("en-GB", { hour12: false }));
  const [activeView, setActiveView] = useState<"overview" | "cases">("overview");
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [openedCase, setOpenedCase] = useState<CaseItem | null>(null);
  const [loadingCases, setLoadingCases] = useState(true);
  const [toast, setToast] = useState("");
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);

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
    api.listCases().then((data: CaseItem[]) => setCases(data)).catch(() => { }).finally(() => setLoadingCases(false));
  }

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  const clearance = CLEARANCE_MAP[role] || CLEARANCE_MAP.viewer;
  const activeCases = cases.filter(c => c.status === "Active").length;

  // If a case is opened, show case detail
  if (openedCase) {
    return (
      <DashboardShell sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} activeView={activeView} setActiveView={setActiveView} clearance={clearance} currentTime={currentTime} currentUser={currentUser} onLogout={onLogout} role={role}>
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
    <DashboardShell sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} activeView={activeView} setActiveView={setActiveView} clearance={clearance} currentTime={currentTime} currentUser={currentUser} onLogout={onLogout} role={role}>
      {activeView === "overview" ? (
        <OverviewView cases={cases} activeCases={activeCases} role={role} loadingCases={loadingCases} onOpenCase={setOpenedCase} onCreateCase={() => setShowNewCaseModal(true)} />
      ) : (
        <CasesListView cases={cases} role={role} loading={loadingCases} onOpenCase={setOpenedCase} onCreateCase={() => setShowNewCaseModal(true)} />
      )}

      {showNewCaseModal && (
        <NewCaseModal
          onClose={() => setShowNewCaseModal(false)}
          onSuccess={() => { setShowNewCaseModal(false); loadCases(); notify("Case file created & sealed"); }}
        />
      )}
      <Toast message={toast} />
    </DashboardShell>
  );
}

// ── Dashboard Shell (sidebar + topbar wrapper) ───────────────────────
function DashboardShell({ children, sidebarOpen, setSidebarOpen, activeView, setActiveView, clearance, currentTime, currentUser, onLogout, role }: any) {
  return (
    <div className="min-h-screen bg-obsidian-900 text-slate-200 flex font-sans overflow-hidden relative">
      {/* Ambient glow */}
      <motion.div
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 20, repeat: Infinity, repeatType: "reverse" }}
        className="absolute inset-0 z-0 pointer-events-none"
        style={{ background: "radial-gradient(circle at 30% 20%, rgba(212,175,55,0.04) 0%, transparent 50%)" }}
      />

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 260 : 80 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="glass-panel z-20 border-r border-white/5 flex flex-col shrink-0"
      >
        <div className="h-20 flex items-center px-6 border-b border-white/5 gap-4">
          <ShieldAlert size={28} className="text-cybergold shrink-0" />
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="font-mono font-bold tracking-[0.15em] text-white whitespace-nowrap text-sm">
                ANVESHAN
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 py-6 flex flex-col gap-1.5 px-3">
          <NavItem icon={Zap} label="Overview" active={activeView === "overview"} isOpen={sidebarOpen} onClick={() => setActiveView("overview")} />
          <NavItem icon={FolderOpen} label="Case Files" active={activeView === "cases"} isOpen={sidebarOpen} onClick={() => setActiveView("cases")} />
          <NavItem icon={Database} label="Evidence Vault" isOpen={sidebarOpen} onClick={() => setActiveView("cases")} />
          <NavItem icon={FileText} label="Audit Logs" isOpen={sidebarOpen} onClick={() => { }} />
          <NavItem icon={Shield} label="Clearance" isOpen={sidebarOpen} onClick={() => { }} />
          <NavItem icon={Settings} label="Settings" isOpen={sidebarOpen} onClick={() => { }} />
        </nav>

        <div className="px-4 pb-4 border-t border-white/5 pt-4">
          {sidebarOpen && (
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-8 h-8 rounded-lg bg-cybergold/10 border border-cybergold/20 flex items-center justify-center text-cybergold text-xs font-bold font-mono">
                {(currentUser?.full_name || "US").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white truncate">{currentUser?.full_name || "Operator"}</div>
                <div className="text-[10px] text-slate-500 font-mono">{role?.toUpperCase()}</div>
              </div>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="w-full flex items-center justify-center h-10 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-colors">
            {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col z-10 h-screen overflow-hidden">
        {/* Security Hero Banner */}
        <header className="h-16 glass-panel border-b border-white/5 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6">
            <div className={`px-3 py-1 rounded-full ${clearance.bg} border ${clearance.border} flex items-center gap-2`}>
              <ShieldCheck size={14} className={clearance.color} />
              <span className={`text-[10px] font-mono font-bold ${clearance.color} tracking-widest`}>{clearance.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-biometric shadow-[0_0_6px_rgba(0,240,255,0.8)]" />
              <span className="text-[10px] font-mono text-biometric/70 tracking-widest">ENCRYPTED</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-slate-500 font-mono text-sm">
              <Clock size={14} />
              <span className="tracking-wider tabular-nums">{currentTime}</span>
            </div>
            <button onClick={onLogout} className="text-[10px] font-bold text-slate-600 hover:text-red-400 transition-colors tracking-widest font-mono">
              TERMINATE
            </button>
          </div>
        </header>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {children}
        </div>
      </main>
    </div>
  );
}

// ── NavItem ──────────────────────────────────────────────────────────
function NavItem({ icon: Icon, label, active, isOpen, onClick }: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center h-11 rounded-xl transition-all duration-200 group ${active ? "bg-cybergold/10 border border-cybergold/20" : "hover:bg-white/5 border border-transparent"}`}>
      <div className={`w-11 h-11 shrink-0 flex items-center justify-center ${active ? "text-cybergold" : "text-slate-500 group-hover:text-slate-200"}`}>
        <Icon size={18} />
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} className={`text-xs font-mono tracking-wide whitespace-nowrap overflow-hidden ${active ? "text-white font-bold" : "text-slate-400 group-hover:text-slate-200"}`}>
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

// ── Overview View ────────────────────────────────────────────────────
function OverviewView({ cases, activeCases, role, loadingCases, onOpenCase, onCreateCase }: any) {
  const canCreate = role === "investigator" || role === "admin";

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="max-w-7xl mx-auto p-8 space-y-8">
      {/* Header */}
      <motion.div variants={staggerItem} className="flex items-end justify-between">
        <div>
          <div className="text-[10px] font-mono font-bold text-cybergold tracking-[0.2em] mb-2">COMMAND CENTER</div>
          <h1 className="text-3xl font-bold text-white font-mono tracking-wide">Secure Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Your classified workspace. All actions are logged.</p>
        </div>
        {canCreate && (
          <button onClick={onCreateCase} className="h-11 px-5 bg-white text-obsidian-900 font-bold font-mono text-xs tracking-widest rounded-xl flex items-center gap-2 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all hover:-translate-y-0.5">
            <Plus size={16} /> NEW CASE
          </button>
        )}
      </motion.div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard title="TOTAL CASE FILES" value={String(cases.length)} icon={FolderOpen} delay={0} />
        <MetricCard title="ACTIVE CASES" value={String(activeCases)} icon={Zap} delay={1} accent />
        <MetricCard title="INTEGRITY CHECKS" value="—" icon={ShieldCheck} delay={2} />
        <MetricCard title="ROLE" value={role?.toUpperCase() || "—"} icon={Shield} delay={3} />
      </div>

      {/* Recent Cases */}
      <motion.div variants={staggerItem} className="glass-panel rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-sm font-mono font-bold text-white tracking-widest">RECENT CASE FILES</h2>
          <span className="text-[10px] font-mono text-slate-500 tracking-wider">{cases.length} RECORDS</span>
        </div>
        {loadingCases ? (
          <div className="py-16 text-center text-slate-500 text-sm font-mono">LOADING RECORDS...</div>
        ) : cases.length === 0 ? (
          <div className="py-16 text-center">
            <FolderOpen size={40} className="text-slate-700 mx-auto mb-4" />
            <p className="text-slate-500 text-sm font-mono">NO CASE FILES FOUND</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {cases.slice(0, 8).map((c: CaseItem, i: number) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i }}
                onClick={() => onOpenCase(c)}
                className="flex items-center gap-5 px-6 py-4 hover:bg-white/[0.02] cursor-pointer transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-cybergold transition-colors">
                  <FolderOpen size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white group-hover:text-cybergold transition-colors">{c.title}</div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">{c.case_number} · {formatDate(c.created_at)}</div>
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
function CasesListView({ cases, role, loading, onOpenCase, onCreateCase }: any) {
  const [search, setSearch] = useState("");
  const canCreate = role === "investigator" || role === "admin";
  const filtered = cases.filter((c: CaseItem) => `${c.case_number} ${c.title}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="max-w-7xl mx-auto p-8 space-y-6">
      <motion.div variants={staggerItem} className="flex items-end justify-between">
        <div>
          <div className="text-[10px] font-mono font-bold text-cybergold tracking-[0.2em] mb-2">EVIDENCE VAULT</div>
          <h1 className="text-3xl font-bold text-white font-mono tracking-wide">Case Files</h1>
        </div>
        {canCreate && (
          <button onClick={onCreateCase} className="h-11 px-5 bg-white text-obsidian-900 font-bold font-mono text-xs tracking-widest rounded-xl flex items-center gap-2 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all hover:-translate-y-0.5">
            <Plus size={16} /> NEW CASE
          </button>
        )}
      </motion.div>

      <motion.div variants={staggerItem}>
        <div className="relative mb-6">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Query database..." className="w-full h-12 pl-11 pr-4 bg-obsidian-800/60 backdrop-blur-xl border border-white/10 rounded-xl text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-cybergold/50 focus:ring-1 focus:ring-cybergold/30 transition-all" />
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-500 font-mono text-sm">LOADING...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-16 text-center">
            <FolderOpen size={40} className="text-slate-700 mx-auto mb-4" />
            <p className="text-slate-500 font-mono text-sm">NO MATCHING RECORDS</p>
          </div>
        ) : filtered.map((c: CaseItem) => (
          <CaseCard key={c.id} caseItem={c} onClick={() => onOpenCase(c)} />
        ))}
      </motion.div>
    </motion.div>
  );
}

// ── Case Card ────────────────────────────────────────────────────────
function CaseCard({ caseItem, onClick }: { caseItem: CaseItem; onClick: () => void }) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={onClick}
      className="glass-panel rounded-xl p-6 border border-white/5 cursor-pointer group hover:border-cybergold/40 hover:shadow-[0_0_20px_rgba(212,175,55,0.1)] transition-all duration-300"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="text-[10px] font-mono text-slate-500 tracking-widest">{caseItem.case_number}</div>
        <StatusPill status={caseItem.status} />
      </div>
      <h3 className="text-lg font-bold text-white group-hover:text-cybergold transition-colors mb-2 leading-tight">{caseItem.title}</h3>
      {caseItem.description && <p className="text-xs text-slate-500 line-clamp-2 mb-4">{caseItem.description}</p>}
      <div className="pt-4 border-t border-white/5 text-[10px] font-mono text-slate-600 tracking-wider">
        FILED {formatDate(caseItem.created_at)}
      </div>
    </motion.div>
  );
}

// ── Case Detail View ─────────────────────────────────────────────────
function CaseDetail({ caseItem, role, onBack, onNotify, onUpdate }: any) {
  const [tab, setTab] = useState<"documents" | "audit">("documents");
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditEvent[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [modal, setModal] = useState<string | null>(null);

  const canWrite = role === "investigator" || role === "admin";

  function loadDocs() {
    setLoadingDocs(true);
    api.getCaseDocuments(caseItem.id).then(setDocs).catch(() => { }).finally(() => setLoadingDocs(false));
  }

  function loadAudit() {
    setLoadingAudit(true);
    api.getCaseAuditTrail(caseItem.id).then(setAuditTrail).catch(() => { }).finally(() => setLoadingAudit(false));
  }

  useEffect(() => { loadDocs(); loadAudit(); }, [caseItem.id]);

  return (
    <motion.div {...fadeSlideUp} className="max-w-6xl mx-auto p-8 space-y-6">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-cybergold text-xs font-mono font-bold tracking-widest transition-colors">
        <ArrowLeft size={14} /> ALL CASES
      </button>

      {/* Header */}
      <div className="glass-panel rounded-2xl p-8 flex items-start justify-between">
        <div>
          <div className="text-[10px] font-mono text-cybergold tracking-[0.2em] mb-2">{caseItem.case_number}</div>
          <h1 className="text-3xl font-bold text-white font-mono tracking-wide mb-3">{caseItem.title}</h1>
          <div className="flex gap-3">
            <StatusPill status={caseItem.status} />
            <span className="text-[10px] font-mono text-slate-500 tracking-wider flex items-center gap-1"><ClipboardList size={12} /> {docs.length} DOCUMENTS</span>
          </div>
          {caseItem.description && <p className="text-sm text-slate-400 mt-4 max-w-lg">{caseItem.description}</p>}
        </div>
        {canWrite && (
          <div className="flex gap-3">
            <button onClick={() => setModal("edit")} className="h-10 px-4 border border-white/10 rounded-xl text-xs font-mono font-bold text-slate-300 hover:bg-white/5 hover:border-white/20 transition-all flex items-center gap-2">
              <Settings2 size={14} /> EDIT
            </button>
            <button onClick={() => setModal("upload")} className="h-10 px-4 bg-white text-obsidian-900 rounded-xl text-xs font-mono font-bold flex items-center gap-2 hover:shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all">
              <Upload size={14} /> ADD EVIDENCE
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        <button onClick={() => setTab("documents")} className={`px-6 py-3 text-xs font-mono font-bold tracking-widest rounded-t-xl transition-all ${tab === "documents" ? "bg-obsidian-800/60 text-cybergold border-b-2 border-cybergold" : "text-slate-500 hover:text-white"}`}>
          DOCUMENTS <span className="ml-2 px-2 py-0.5 rounded-full bg-white/10 text-[10px]">{docs.length}</span>
        </button>
        <button onClick={() => setTab("audit")} className={`px-6 py-3 text-xs font-mono font-bold tracking-widest rounded-t-xl transition-all ${tab === "audit" ? "bg-obsidian-800/60 text-cybergold border-b-2 border-cybergold" : "text-slate-500 hover:text-white"}`}>
          AUDIT TRAIL <span className="ml-2 px-2 py-0.5 rounded-full bg-white/10 text-[10px]">{auditTrail.length}</span>
        </button>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {tab === "documents" && (
          <motion.div key="docs" {...fadeSlideUp}>
            {loadingDocs ? (
              <div className="py-16 text-center text-slate-500 font-mono text-sm">LOADING DOCUMENTS...</div>
            ) : docs.length === 0 ? (
              <div className="glass-panel rounded-2xl py-16 text-center">
                <Database size={40} className="text-slate-700 mx-auto mb-4" />
                <p className="text-white font-bold font-mono mb-1">NO EVIDENCE FILED</p>
                <p className="text-slate-500 text-sm">Add the first piece of evidence using the button above.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {docs.map((doc, i) => {
                  const DIcon = docIcon(doc.doc_type);
                  return (
                    <motion.div key={doc.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="glass-panel rounded-xl p-5 border border-white/5 hover:border-cybergold/30 transition-all cursor-pointer group flex items-center gap-4"
                    >
                      <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-cybergold transition-colors">
                        <DIcon size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white group-hover:text-cybergold transition-colors truncate">{doc.title}</div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">{doc.doc_type?.replace(/_/g, " ")} · {doc.sensitivity_level}</div>
                      </div>
                      <StatusPill status={doc.status === "active" ? "Active" : doc.status} />
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
              <div className="py-16 text-center text-slate-500 font-mono text-sm">LOADING AUDIT TRAIL...</div>
            ) : auditTrail.length === 0 ? (
              <div className="py-16 text-center">
                <ShieldCheck size={40} className="text-slate-700 mx-auto mb-4" />
                <p className="text-white font-bold font-mono mb-1">NO EVENTS RECORDED</p>
                <p className="text-slate-500 text-sm">Events appear here as actions are performed.</p>
              </div>
            ) : (
              <div className="space-y-0">
                {auditTrail.map((ev, i) => (
                  <div key={ev.id} className="flex gap-5 relative">
                    {i < auditTrail.length - 1 && <div className="absolute left-[7px] top-6 bottom-0 w-px bg-white/10" />}
                    <div className={`w-4 h-4 rounded-full border-2 mt-1 shrink-0 relative z-10 ${ev.event_type.includes("upload") || ev.event_type.includes("version") ? "border-biometric bg-biometric/20 shadow-[0_0_8px_rgba(0,240,255,0.3)]" : ev.event_type.includes("sign") ? "border-cybergold bg-cybergold/20" : "border-slate-600 bg-obsidian-800"}`} />
                    <div className="flex-1 pb-6">
                      <div className="text-sm font-bold text-white">{ev.action}</div>
                      <div className="text-[10px] font-mono text-slate-500 mt-1 flex items-center gap-3">
                        <span>{ev.event_type}</span>
                        {ev.event_hash && (
                          <span className="px-2 py-0.5 rounded bg-obsidian-900 border border-white/5 text-biometric">
                            <Hash size={10} className="inline mr-1" />{ev.event_hash.slice(0, 16)}…
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-slate-600 whitespace-nowrap mt-1">{formatDate(ev.created_at)}</div>
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
    </motion.div>
  );
}

// ── Metric Card ──────────────────────────────────────────────────────
function MetricCard({ title, value, icon: Icon, delay, accent }: any) {
  return (
    <motion.div variants={staggerItem} className="glass-panel rounded-xl p-6 glow-border relative overflow-hidden group hover:glow-border-hover">
      <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity duration-500">
        <Icon size={64} className={accent ? "text-cybergold" : "text-slate-400"} />
      </div>
      <div className="relative z-10">
        <h3 className="text-[9px] font-mono font-bold text-slate-500 tracking-[0.2em] mb-5">{title}</h3>
        <div className="text-3xl font-bold font-mono tracking-tight text-white">{value}</div>
      </div>
    </motion.div>
  );
}

// ── Status Pill ──────────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const s = status?.toLowerCase() || "";
  let cls = "bg-white/10 text-slate-400 border-white/10";
  if (s === "active") cls = "bg-biometric/10 text-biometric border-biometric/20";
  else if (s === "review") cls = "bg-cybergold/10 text-cybergold border-cybergold/20";
  else if (s === "closed") cls = "bg-slate-500/10 text-slate-400 border-slate-500/20";
  else if (s === "dissolved") cls = "bg-red-500/10 text-red-400 border-red-500/20";

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest border ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status?.toUpperCase()}
    </span>
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
      await api.createCase({ title, description });
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-obsidian-800 border border-white/10 rounded-2xl p-8 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold font-mono text-white tracking-widest flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cybergold/10 flex items-center justify-center"><FolderOpen size={18} className="text-cybergold" /></div>
          NEW CASE FILE
        </h2>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
      </div>
      <form onSubmit={submit} className="space-y-5">
        <label className="block">
          <span className="text-[10px] font-mono text-slate-500 tracking-widest block mb-2">CASE TITLE</span>
          <input value={title} onChange={e => setTitle(e.target.value)} required className="w-full h-12 px-4 bg-obsidian-900 border border-white/10 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-cybergold/50 focus:ring-1 focus:ring-cybergold/30 transition-all" />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono text-slate-500 tracking-widest block mb-2">DESCRIPTION</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full px-4 py-3 bg-obsidian-900 border border-white/10 rounded-xl text-sm font-mono text-white resize-none focus:outline-none focus:border-cybergold/50 focus:ring-1 focus:ring-cybergold/30 transition-all" />
        </label>
        {error && <p className="text-red-400 text-xs font-mono">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 h-11 border border-white/10 rounded-xl text-xs font-mono font-bold text-slate-400 hover:bg-white/5 transition-all">CANCEL</button>
          <button type="submit" disabled={loading} className="flex-1 h-11 bg-white text-obsidian-900 rounded-xl text-xs font-mono font-bold disabled:opacity-40 hover:shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all">
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
    <div className="bg-obsidian-800 border border-white/10 rounded-2xl p-8 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold font-mono text-white tracking-widest flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cybergold/10 flex items-center justify-center"><Settings2 size={18} className="text-cybergold" /></div>
          EDIT CASE
        </h2>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
      </div>
      <form onSubmit={submit} className="space-y-5">
        <label className="block">
          <span className="text-[10px] font-mono text-slate-500 tracking-widest block mb-2">CASE TITLE</span>
          <input value={title} onChange={e => setTitle(e.target.value)} required className="w-full h-12 px-4 bg-obsidian-900 border border-white/10 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-cybergold/50 transition-all" />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono text-slate-500 tracking-widest block mb-2">CONTEXT NOTES</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full px-4 py-3 bg-obsidian-900 border border-white/10 rounded-xl text-sm font-mono text-white resize-none focus:outline-none focus:border-cybergold/50 transition-all" />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono text-slate-500 tracking-widest block mb-2">STATUS</span>
          <select value={status} onChange={e => setStatus(e.target.value)} className="w-full h-12 px-4 bg-obsidian-900 border border-white/10 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-cybergold/50 transition-all appearance-none">
            <option value="Active">Active</option>
            <option value="Review">Review</option>
            <option value="Closed">Closed</option>
            <option value="Dissolved">Dissolved</option>
          </select>
        </label>
        {error && <p className="text-red-400 text-xs font-mono">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 h-11 border border-white/10 rounded-xl text-xs font-mono font-bold text-slate-400 hover:bg-white/5 transition-all">CANCEL</button>
          <button type="submit" disabled={loading} className="flex-1 h-11 bg-white text-obsidian-900 rounded-xl text-xs font-mono font-bold disabled:opacity-40 hover:shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all">
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
    <div className="bg-obsidian-800 border border-white/10 rounded-2xl p-8 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold font-mono text-white tracking-widest flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-biometric/10 flex items-center justify-center"><Upload size={18} className="text-biometric" /></div>
          ADD EVIDENCE
        </h2>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
      </div>
      <form onSubmit={submit} className="space-y-5">
        <label className="block">
          <span className="text-[10px] font-mono text-slate-500 tracking-widest block mb-2">EVIDENCE TITLE</span>
          <input value={title} onChange={e => setTitle(e.target.value)} required className="w-full h-12 px-4 bg-obsidian-900 border border-white/10 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-biometric/50 transition-all" />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-[10px] font-mono text-slate-500 tracking-widest block mb-2">TYPE</span>
            <select value={docType} onChange={e => setDocType(e.target.value)} className="w-full h-12 px-4 bg-obsidian-900 border border-white/10 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-biometric/50 transition-all appearance-none">
              <option value="forensic_report">Forensic Report</option>
              <option value="witness_statement">Witness Statement</option>
              <option value="surveillance_footage">Surveillance</option>
              <option value="chain_of_custody">Chain of Custody</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-mono text-slate-500 tracking-widest block mb-2">SENSITIVITY</span>
            <select value={sensitivity} onChange={e => setSensitivity(e.target.value)} className="w-full h-12 px-4 bg-obsidian-900 border border-white/10 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-biometric/50 transition-all appearance-none">
              <option value="public">Public</option>
              <option value="internal">Internal</option>
              <option value="restricted">Restricted</option>
              <option value="top_secret">Top Secret</option>
            </select>
          </label>
        </div>
        <div onClick={() => fileRef.current?.click()} className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${file ? "border-biometric/40 bg-biometric/5" : "border-white/10 hover:border-biometric/30 hover:bg-white/[0.02]"}`}>
          <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
          {file ? (
            <div className="text-sm font-mono text-biometric">{file.name} <span className="text-slate-500">({(file.size / 1024).toFixed(1)} KB)</span></div>
          ) : (
            <>
              <Upload size={24} className="text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400 font-mono">Click to attach file</p>
              <p className="text-[10px] text-slate-600 font-mono mt-1">Documents, images, audio, video</p>
            </>
          )}
        </div>
        {error && <p className="text-red-400 text-xs font-mono">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 h-11 border border-white/10 rounded-xl text-xs font-mono font-bold text-slate-400 hover:bg-white/5 transition-all">CANCEL</button>
          <button type="submit" disabled={loading || !title} className="flex-1 h-11 bg-biometric text-obsidian-900 rounded-xl text-xs font-mono font-bold disabled:opacity-40 hover:shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-all">
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
