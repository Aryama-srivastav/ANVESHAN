// ANVESHAN — Evidence Vault search, Audit Logs, Clearance, Settings and
// the Evidence Detail modal. Kept separate from App.tsx for clarity.
import React, { useState, useEffect, useRef } from "react";
// @ts-ignore — api.js is plain JS, no types
import { api } from "./api";
import {
  Search, ShieldCheck, Lock, FileText, Shield, Fingerprint,
  FileImage, FileAudio, FileVideo, File as FileLucide, X, Hash,
} from "lucide-react";
import { motion } from "framer-motion";

// ── Shared helpers (kept local to avoid circular imports) ────────────
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

const CLEARANCE_LABELS: Record<string, string> = {
  investigator: "LEVEL 5 — TOP SECRET AUTHORISED",
  admin: "LEVEL 6 — SYSTEM ADMINISTRATOR",
  auditor: "LEVEL 4 — AUDIT OBSERVER",
  viewer: "LEVEL 2 — READ ONLY",
};

export interface PanelUser {
  id: string;
  full_name: string;
  email: string;
  roles?: string[];
}

interface SearchHit {
  document_id: string;
  case_id: string;
  case_number: string;
  case_title: string;
  title: string;
  doc_type: string;
  sensitivity_level: string;
  score: number;
  excerpt: string;
  tags: string[];
  matched_fields: string[];
  activity_at: string;
  version_count: number;
}

const itemV = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

// ── Evidence Vault (real search over /v1/search) ─────────────────────
export function VaultView({ onOpenDocument }: { onOpenDocument: (docId: string) => void }) {
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{ total: number; took_ms: number } | null>(null);

  async function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    try {
      const res = await api.search({ q: search });
      setHits(res.hits || []);
      setMeta({ total: res.total, took_ms: res.took_ms });
    } catch {
      setHits([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { runSearch(); }, []);

  return (
    <motion.div variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }} initial="hidden" animate="show" className="max-w-7xl mx-auto p-8 space-y-6">
      <motion.div variants={itemV}>
        <div className="text-[10px] font-mono font-bold text-cybergold tracking-[0.2em] mb-2">EVIDENCE VAULT</div>
        <h1 className="text-3xl font-bold text-white font-mono tracking-wide mb-1">Semantic Search</h1>
        <p className="text-slate-500 text-sm">Full-text, entity and tag search across all evidence you are authorised to see.</p>
      </motion.div>

      <motion.form onSubmit={runSearch} variants={itemV} className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search titles, tags, metadata, document contents..." className="w-full h-12 pl-11 pr-28 bg-obsidian-800/60 backdrop-blur-xl border border-white/10 rounded-xl text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-cybergold/50 focus:ring-1 focus:ring-cybergold/30 transition-all" />
        <button type="submit" disabled={loading} className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-4 bg-white text-obsidian-900 rounded-lg text-[10px] font-mono font-bold tracking-widest disabled:opacity-40 transition-all">
          {loading ? "..." : "SEARCH"}
        </button>
      </motion.form>

      {meta && hits && hits.length > 0 && (
        <div className="text-[10px] font-mono text-slate-600 tracking-wider">
          {meta.total} MATCH{meta.total === 1 ? "" : "ES"} · {meta.took_ms}MS
        </div>
      )}

      <motion.div variants={itemV} className="space-y-4">
        {loading ? (
          <div className="py-16 text-center text-slate-500 font-mono text-sm">SEARCHING...</div>
        ) : hits === null || hits.length === 0 ? (
          <div className="glass-panel rounded-2xl py-16 text-center">
            <Search size={40} className="text-slate-700 mx-auto mb-4" />
            <p className="text-slate-500 font-mono text-sm">{hits === null ? "ENTER A QUERY" : "NO MATCHING EVIDENCE"}</p>
          </div>
        ) : (
          hits.map((hit: SearchHit) => <HitCard key={hit.document_id} hit={hit} onOpenDocument={onOpenDocument} />)
        )}
      </motion.div>
    </motion.div>
  );
}

function HitCard({ hit, onOpenDocument }: { hit: SearchHit; onOpenDocument: (docId: string) => void }) {
  const DIcon = docIcon(hit.doc_type);
  return (
    <motion.div whileHover={{ y: -2 }} onClick={() => onOpenDocument(hit.document_id)}
      className="glass-panel rounded-xl p-5 border border-white/5 cursor-pointer group hover:border-cybergold/40 transition-all">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-cybergold shrink-0 transition-colors">
          <DIcon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-bold text-white group-hover:text-cybergold transition-colors">{hit.title}</span>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-cybergold/10 text-cybergold border border-cybergold/20">SCORE {hit.score.toFixed(2)}</span>
            {hit.matched_fields.map((f: string) => (
              <span key={f} className="text-[9px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10">{f.toUpperCase()}</span>
            ))}
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-1.5">
            {hit.case_number} · {hit.case_title} · {hit.doc_type?.replace(/_/g, " ")} · {hit.sensitivity_level} · {hit.version_count} VERSION{hit.version_count === 1 ? "" : "S"}
          </div>
          {hit.excerpt && <p className="text-xs text-slate-500 mt-2 line-clamp-2 font-mono">…{hit.excerpt}…</p>}
          {hit.tags.length > 0 && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {hit.tags.map((t: string) => (
                <span key={t} className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-biometric/10 text-biometric border border-biometric/20">{t}</span>
              ))}
            </div>
          )}
        </div>
        <div className="text-[10px] font-mono text-slate-600 whitespace-nowrap">{formatDate(hit.activity_at)}</div>
      </div>
    </motion.div>
  );
}

// ── Audit Logs (global tamper-evident ledger) ────────────────────────
interface LedgerRecord {
  id: string;
  case_id: string | null;
  document_id: string | null;
  actor_user_id: string | null;
  event_type: string;
  payload_hash: string;
  previous_hash: string | null;
  record_hash: string;
  ledger_provider: string;
  transaction_id: string;
  created_at: string;
}

export function AuditLogsView({ role }: { role: string }) {
  const [records, setRecords] = useState<LedgerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chain, setChain] = useState<{ intact: boolean; problems: { record_id: string; issue: string }[]; checked?: number } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const canView = role === "admin" || role === "auditor";

  function load() {
    if (!canView) { setLoading(false); return; }
    setLoading(true);
    setError("");
    api.listAuditTrail({ limit: 200 })
      .then((data: LedgerRecord[]) => setRecords(data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  function verifyChain() {
    setVerifying(true);
    api.verifyAuditChain()
      .then((res: { intact: boolean; problems: { record_id: string; issue: string }[]; checked?: number }) => setChain(res))
      .catch(() => { })
      .finally(() => setVerifying(false));
  }

  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="glass-panel rounded-2xl p-10 text-center">
          <Lock size={40} className="text-slate-700 mx-auto mb-4" />
          <p className="text-white font-bold font-mono mb-1">RESTRICTED</p>
          <p className="text-slate-500 text-sm">The global audit ledger is visible to administrators and auditors only.</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }} initial="hidden" animate="show" className="max-w-7xl mx-auto p-8 space-y-6">
      <motion.div variants={itemV} className="flex items-end justify-between">
        <div>
          <div className="text-[10px] font-mono font-bold text-cybergold tracking-[0.2em] mb-2">TAMPER-EVIDENT LEDGER</div>
          <h1 className="text-3xl font-bold text-white font-mono tracking-wide">Audit Logs</h1>
        </div>
        <div className="flex gap-3">
          <button onClick={verifyChain} disabled={verifying} className="h-10 px-4 border border-biometric/40 rounded-xl text-xs font-mono font-bold text-biometric hover:bg-biometric/10 disabled:opacity-40 transition-all flex items-center gap-2">
            <ShieldCheck size={14} /> {verifying ? "VERIFYING..." : "VERIFY CHAIN"}
          </button>
          <button onClick={load} className="h-10 px-4 border border-white/10 rounded-xl text-xs font-mono font-bold text-slate-300 hover:bg-white/5 transition-all">REFRESH</button>
        </div>
      </motion.div>

      {chain && (
        <motion.div variants={itemV} className={`rounded-xl p-4 border text-xs font-mono ${chain.intact ? "bg-biometric/10 border-biometric/30 text-biometric" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
          {chain.intact
            ? `✓ CHAIN INTACT — all ${chain.checked ?? records.length} ledger records re-hashed and linked successfully.`
            : `✗ CHAIN BROKEN — ${chain.problems.length} integrity issue(s): ${chain.problems.slice(0, 3).map((p) => `${p.record_id.slice(0, 8)} (${p.issue})`).join(", ")}`}
        </motion.div>
      )}

      {loading ? (
        <div className="glass-panel rounded-2xl py-16 text-center text-slate-500 font-mono text-sm">LOADING LEDGER...</div>
      ) : error ? (
        <div className="glass-panel rounded-2xl py-16 text-center text-red-400 font-mono text-sm">{error}</div>
      ) : records.length === 0 ? (
        <div className="glass-panel rounded-2xl py-16 text-center">
          <FileText size={40} className="text-slate-700 mx-auto mb-4" />
          <p className="text-slate-500 font-mono text-sm">NO LEDGER RECORDS YET</p>
        </div>
      ) : (
        <motion.div variants={itemV} className="glass-panel rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 text-[9px] font-mono text-slate-500 tracking-widest">
                <th className="px-5 py-3">TIME</th>
                <th className="px-5 py-3">EVENT</th>
                <th className="px-5 py-3">ACTOR</th>
                <th className="px-5 py-3">RECORD HASH</th>
                <th className="px-5 py-3">TX ID</th>
              </tr>
            </thead>
            <tbody>
              {records.map((rec: LedgerRecord) => (
                <tr key={rec.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3 text-[10px] font-mono text-slate-500 whitespace-nowrap">{formatDate(rec.created_at)}</td>
                  <td className="px-5 py-3 text-xs font-mono text-white">{rec.event_type}</td>
                  <td className="px-5 py-3 text-[10px] font-mono text-slate-400">{rec.actor_user_id ? rec.actor_user_id.slice(0, 8) + "…" : "system"}</td>
                  <td className="px-5 py-3 text-[10px] font-mono text-biometric">{rec.record_hash.slice(0, 16)}…</td>
                  <td className="px-5 py-3 text-[10px] font-mono text-slate-500">{rec.transaction_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Clearance (users & roles) ────────────────────────────────────────
interface DirectoryUser {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  department: string | null;
  agency: string | null;
  clearance_level: string | null;
}

export function ClearanceView({ role, currentUser, onNotify }: { role: string; currentUser: PanelUser | null; onNotify: (m: string) => void }) {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isAdmin = role === "admin";

  function load() {
    if (!isAdmin) { setLoading(false); return; }
    setLoading(true);
    setError("");
    api.listUsers()
      .then((data: DirectoryUser[]) => setUsers(data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function changeRole(userId: string, roleName: string) {
    try {
      await api.assignRole(userId, roleName);
      onNotify(`Role '${roleName}' assigned`);
    } catch (err: any) {
      onNotify(err.message || "Failed to assign role");
    }
  }

  return (
    <motion.div variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }} initial="hidden" animate="show" className="max-w-7xl mx-auto p-8 space-y-6">
      <motion.div variants={itemV}>
        <div className="text-[10px] font-mono font-bold text-cybergold tracking-[0.2em] mb-2">ACCESS CONTROL</div>
        <h1 className="text-3xl font-bold text-white font-mono tracking-wide">Clearance</h1>
      </motion.div>

      {!isAdmin ? (
        <motion.div variants={itemV} className="glass-panel rounded-2xl p-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-cybergold/10 border border-cybergold/20 flex items-center justify-center"><Shield size={22} className="text-cybergold" /></div>
            <div>
              <div className="text-lg font-bold text-white font-mono">{currentUser?.full_name || "—"}</div>
              <div className="text-[10px] font-mono text-slate-500 mt-0.5">{currentUser?.email} · {role?.toUpperCase()}</div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="bg-obsidian-900/60 rounded-xl p-4 border border-white/5">
              <div className="text-[9px] font-mono text-slate-500 tracking-widest mb-1">CLEARANCE LEVEL</div>
              <div className="text-sm font-mono text-white">{CLEARANCE_LABELS[role] || "—"}</div>
            </div>
            <div className="bg-obsidian-900/60 rounded-xl p-4 border border-white/5">
              <div className="text-[9px] font-mono text-slate-500 tracking-widest mb-1">PERMISSIONS</div>
              <div className="text-xs font-mono text-slate-300">
                {role === "viewer" && "Read-only access to all cases and evidence."}
                {role === "auditor" && "View cases/evidence, audit ledger and chain verification."}
                {role === "investigator" && "View, upload and update evidence in any case."}
                {!["viewer", "auditor", "investigator"].includes(role) && "Standard access."}
              </div>
            </div>
          </div>
          <p className="text-[10px] font-mono text-slate-600 mt-6">Only administrators can view the full user directory and assign roles.</p>
        </motion.div>
      ) : loading ? (
        <div className="glass-panel rounded-2xl py-16 text-center text-slate-500 font-mono text-sm">LOADING USERS...</div>
      ) : error ? (
        <div className="glass-panel rounded-2xl py-16 text-center text-red-400 font-mono text-sm">{error}</div>
      ) : (
        <motion.div variants={itemV} className="glass-panel rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-sm font-mono font-bold text-white tracking-widest">USER DIRECTORY</h2>
            <span className="text-[10px] font-mono text-slate-500">{users.length} USERS</span>
          </div>
          <div className="divide-y divide-white/5">
            {users.map((u: DirectoryUser) => (
              <div key={u.id} className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-all">
                <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-slate-400"><Fingerprint size={16} /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white">{u.full_name}</div>
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">{u.email}{u.department ? ` · ${u.department}` : ""}{u.agency ? ` · ${u.agency}` : ""}</div>
                </div>
                <div className="text-[10px] font-mono text-slate-400 hidden md:block">{u.clearance_level || "—"}</div>
                <select
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) changeRole(u.id, e.target.value); e.currentTarget.value = ""; }}
                  className="h-9 px-3 bg-obsidian-900 border border-white/10 rounded-lg text-[10px] font-mono text-white focus:outline-none focus:border-cybergold/50 appearance-none"
                >
                  <option value="">ASSIGN ROLE…</option>
                  <option value="user">Investigator</option>
                  <option value="auditor">Auditor</option>
                  <option value="viewer">Viewer</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Settings (profile, MFA, system) ──────────────────────────────────
export function SettingsView({ role, currentUser, onNotify }: { role: string; currentUser: PanelUser | null; onNotify: (m: string) => void }) {
  const [mfa, setMfa] = useState<{ secret: string; provisioning_uri: string } | null>(null);
  const [backup, setBackup] = useState<{ storage_provider: string; encryption_enabled: boolean; backup_dir: string; backups: unknown[] } | null>(null);
  const isAdmin = role === "admin";

  function setupMfa() {
    api.setupMfa()
      .then((res: { secret: string; provisioning_uri: string }) => {
        setMfa(res);
        onNotify("MFA secret generated — store it in your authenticator");
      })
      .catch((err: Error) => onNotify(err.message));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (isAdmin) api.backupStatus().then(setBackup).catch(() => { }); }, [isAdmin]);

  return (
    <motion.div variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }} initial="hidden" animate="show" className="max-w-5xl mx-auto p-8 space-y-6">
      <motion.div variants={itemV}>
        <div className="text-[10px] font-mono font-bold text-cybergold tracking-[0.2em] mb-2">SYSTEM</div>
        <h1 className="text-3xl font-bold text-white font-mono tracking-wide">Settings</h1>
      </motion.div>

      <motion.div variants={itemV} className="glass-panel rounded-2xl p-8">
        <h2 className="text-sm font-mono font-bold text-white tracking-widest mb-6">PROFILE</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {([
            ["FULL NAME", currentUser?.full_name],
            ["EMAIL", currentUser?.email],
            ["ROLE", role?.toUpperCase()],
            ["USER ID", currentUser?.id],
          ] as [string, string | undefined][]).map(([label, value]) => (
            <div key={label} className="bg-obsidian-900/60 rounded-xl p-4 border border-white/5">
              <div className="text-[9px] font-mono text-slate-500 tracking-widest mb-1">{label}</div>
              <div className="text-xs font-mono text-white truncate">{value || "—"}</div>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div variants={itemV} className="glass-panel rounded-2xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-mono font-bold text-white tracking-widest">MULTI-FACTOR AUTHENTICATION</h2>
          <button onClick={setupMfa} className="h-9 px-4 bg-white text-obsidian-900 rounded-lg text-[10px] font-mono font-bold tracking-widest hover:shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all">GENERATE MFA SECRET</button>
        </div>
        {mfa ? (
          <div className="bg-obsidian-900/60 rounded-xl p-4 border border-biometric/20">
            <div className="text-[9px] font-mono text-biometric tracking-widest mb-2">TOTP SECRET — ENROL IN YOUR AUTHENTICATOR APP</div>
            <div className="text-xs font-mono text-biometric break-all">{mfa.secret}</div>
            <div className="text-[9px] font-mono text-slate-600 mt-3 break-all">{mfa.provisioning_uri}</div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 font-mono">Generate a TOTP secret to enrol this account in MFA. All prototype sessions already carry a verified MFA claim.</p>
        )}
      </motion.div>

      <motion.div variants={itemV} className="glass-panel rounded-2xl p-8">
        <h2 className="text-sm font-mono font-bold text-white tracking-widest mb-6">SYSTEM INFORMATION</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-obsidian-900/60 rounded-xl p-4 border border-white/5">
            <div className="text-[9px] font-mono text-slate-500 tracking-widest mb-1">ENVIRONMENT</div>
            <div className="text-xs font-mono text-white truncate">{(import.meta as any).env?.VITE_API_URL || "http://localhost:8000"}</div>
          </div>
          <div className="bg-obsidian-900/60 rounded-xl p-4 border border-white/5">
            <div className="text-[9px] font-mono text-slate-500 tracking-widest mb-1">CLEARANCE</div>
            <div className="text-xs font-mono text-white truncate">{CLEARANCE_LABELS[role] || "—"}</div>
          </div>
          {isAdmin && backup && (
            <div className="bg-obsidian-900/60 rounded-xl p-4 border border-white/5">
              <div className="text-[9px] font-mono text-slate-500 tracking-widest mb-1">BACKUPS</div>
              <div className="text-xs font-mono text-white truncate">{backup.storage_provider} · {backup.backups?.length ?? 0} snapshot{(backup.backups?.length ?? 0) === 1 ? "" : "s"}</div>
            </div>
          )}
        </div>
        <p className="text-[10px] font-mono text-slate-600 mt-6">Audit logging: every case creation, upload and version change is sealed into the tamper-evident ledger automatically.</p>
      </motion.div>
    </motion.div>
  );
}

// ── Document Detail Modal (view + metadata + integrity + versions) ───
interface DocVersion {
  id: string;
  version_number: number;
  content_hash: string;
  created_at: string;
}

interface DocIntegrityItem {
  version_id: string;
  version_number: number;
  is_original: boolean;
  expected_hash: string;
  observed_hash: string | null;
  status: string;
}

interface DocSignature {
  id: string;
  signer_user_id: string | null;
  algorithm: string;
  signed_hash: string;
  created_at: string;
}

interface DocLedgerRecord {
  id: string;
  event_type: string;
  record_hash: string;
  transaction_id: string;
  created_at: string;
}

interface DocDetail {
  id: string;
  title: string;
  doc_type: string;
  sensitivity_level: string;
  status: string;
  created_at: string;
  case_id?: string;
}

export function DocumentDetailModal({ docId, role, onClose, onNotify }: { docId: string; role: string; onClose: () => void; onNotify: (m: string) => void }) {
  const [detail, setDetail] = useState<DocDetail | null>(null);
  const [versions, setVersions] = useState<DocVersion[]>([]);
  const [integrity, setIntegrity] = useState<DocIntegrityItem[]>([]);
  const [signatures, setSignatures] = useState<DocSignature[]>([]);
  const [docTrail, setDocTrail] = useState<DocLedgerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newNotes, setNewNotes] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const canWrite = role === "investigator" || role === "admin";

  function loadAll() {
    setLoading(true);
    Promise.all([
      api.getDocument(docId),
      api.getDocumentVersions(docId),
      api.getIntegritySummary(docId, true),
      api.getDocumentAuditTrail(docId),
    ]).then(([d, v, i, t]) => {
      setDetail(d);
      setVersions(v);
      setIntegrity(i.versions || []);
      setDocTrail(t);
      const latest = (v as DocVersion[]).slice().sort((a, b) => b.version_number - a.version_number)[0];
      if (latest) api.listSignatures(docId, latest.id).then(setSignatures).catch(() => setSignatures([]));
    }).catch((err: Error) => onNotify(err.message || "Failed to load document"))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAll(); }, [docId]);

  async function uploadNewVersion() {
    if (!newFile) return;
    setBusy(true);
    try {
      await api.uploadDocumentVersion(docId, newFile, newNotes || "Revision upload");
      setNewFile(null);
      setNewNotes("");
      if (fileRef.current) fileRef.current.value = "";
      onNotify("New version uploaded — original preserved & change logged");
      loadAll();
    } catch (err: any) {
      onNotify(err.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function signLatest() {
    const latest = versions.slice().sort((a, b) => b.version_number - a.version_number)[0];
    if (!latest) return;
    setBusy(true);
    try {
      await api.signVersion(docId, latest.id);
      onNotify("Version digitally signed");
      loadAll();
    } catch (err: any) {
      onNotify(err.message || "Signing failed");
    } finally {
      setBusy(false);
    }
  }

  function download(v: DocVersion) {
    api.downloadVersion(docId, v.id, `${detail?.title || "evidence"}-v${v.version_number}`)
      .catch((err: Error) => onNotify(err.message));
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center p-6 overflow-y-auto" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} onClick={(e: React.MouseEvent) => e.stopPropagation()} className="w-full max-w-3xl my-8 bg-obsidian-800 border border-white/10 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold font-mono text-white tracking-widest flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-cybergold/10 flex items-center justify-center"><FileText size={18} className="text-cybergold" /></div>
              EVIDENCE DETAIL
            </h2>
            {detail && <p className="text-[10px] font-mono text-slate-500 mt-2">{detail.title} · {detail.doc_type?.replace(/_/g, " ")} · {detail.sensitivity_level}</p>}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-500 font-mono text-sm">LOADING EVIDENCE...</div>
        ) : !detail ? (
          <div className="py-16 text-center text-red-400 font-mono text-sm">EVIDENCE NOT FOUND OR ACCESS DENIED</div>
        ) : (
          <DetailBody
            detail={detail}
            versions={versions}
            integrity={integrity}
            signatures={signatures}
            docTrail={docTrail}
            canWrite={canWrite}
            busy={busy}
            newFile={newFile}
            newNotes={newNotes}
            fileRef={fileRef}
            setNewFile={setNewFile}
            setNewNotes={setNewNotes}
            onUpload={uploadNewVersion}
            onSign={signLatest}
            onDownload={download}
          />
        )}
      </motion.div>
    </motion.div>
  );
}

interface DetailBodyProps {
  detail: DocDetail;
  versions: DocVersion[];
  integrity: DocIntegrityItem[];
  signatures: DocSignature[];
  docTrail: DocLedgerRecord[];
  canWrite: boolean;
  busy: boolean;
  newFile: File | null;
  newNotes: string;
  fileRef: React.RefObject<HTMLInputElement | null>;
  setNewFile: (f: File | null) => void;
  setNewNotes: (n: string) => void;
  onUpload: () => void;
  onSign: () => void;
  onDownload: (v: DocVersion) => void;
}

function DetailBody(p: DetailBodyProps) {
  const integrityFor = (versionId: string) => p.integrity.find((it) => it.version_id === versionId);
  const allIntact = p.integrity.length === 0 || p.integrity.every((it) => it.status === "verified" || it.status === "unverified");
  return (
    <div className="space-y-6">
      {/* Metadata */}
      <div className="grid grid-cols-2 gap-3">
        {([
          ["UPLOADED", formatDate(p.detail.created_at), "text-white"],
          ["STATUS", p.detail.status, "text-white"],
          ["VERSIONS", String(p.versions.length), "text-white"],
          ["TAMPER STATUS", allIntact ? "VERIFIED ✓" : "TAMPERED ✗", allIntact ? "text-biometric" : "text-red-400"],
        ] as [string, string, string][]).map(([label, value, color]) => (
          <div key={label} className="bg-obsidian-900/60 rounded-xl p-4 border border-white/5">
            <div className="text-[9px] font-mono text-slate-500 tracking-widest mb-1">{label}</div>
            <div className={`text-xs font-mono ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Versions — original preserved, every change logged */}
      <div>
        <h3 className="text-[10px] font-mono text-slate-400 tracking-widest mb-3">VERSIONS — ORIGINAL PRESERVED, EVERY CHANGE LOGGED</h3>
        <div className="space-y-2">
          {p.versions.slice().sort((a, b) => a.version_number - b.version_number).map((v: DocVersion) => {
            const it = integrityFor(v.id);
            const tampered = it?.status === "tampered";
            return (
              <div key={v.id} className="bg-obsidian-900/60 rounded-xl p-4 border border-white/5 flex items-center gap-4">
                <div className={`px-2 py-1 rounded font-mono text-[10px] font-bold whitespace-nowrap ${v.version_number === 1 ? "bg-cybergold/10 text-cybergold border border-cybergold/20" : "bg-white/5 text-slate-300 border border-white/10"}`}>
                  {v.version_number === 1 ? "ORIGINAL v1" : `v${v.version_number}`}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[10px] font-mono truncate ${tampered ? "text-red-400" : "text-biometric"}`}>
                    <Hash size={10} className="inline mr-1" />{v.content_hash.slice(0, 24)}…
                  </div>
                  <div className="text-[9px] font-mono text-slate-600 mt-0.5">
                    {formatDate(v.created_at)} · {it ? (tampered ? "TAMPERED ✗" : it.status.toUpperCase()) : "INTEGRITY UNKNOWN"}
                    {it?.observed_hash && it.observed_hash !== "unreadable" ? ` · re-hash ${it.observed_hash.slice(0, 12)}…` : ""}
                  </div>
                </div>
                <button onClick={() => p.onDownload(v)} className="h-8 px-3 border border-white/10 rounded-lg text-[10px] font-mono font-bold text-slate-300 hover:bg-white/5 transition-all">DOWNLOAD</button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Digital signatures */}
      <div>
        <h3 className="text-[10px] font-mono text-slate-400 tracking-widest mb-3">DIGITAL SIGNATURES (LATEST VERSION)</h3>
        {p.signatures.length === 0 ? (
          <p className="text-xs font-mono text-slate-600">No signatures on the latest version yet.</p>
        ) : (
          <div className="space-y-2">
            {p.signatures.map((s: DocSignature) => (
              <div key={s.id} className="bg-obsidian-900/60 rounded-xl p-4 border border-white/5">
                <div className="text-[10px] font-mono text-cybergold"><Lock size={10} className="inline mr-1" />{s.algorithm} · {s.signed_hash.slice(0, 24)}…</div>
                <div className="text-[9px] font-mono text-slate-600 mt-1">signed {formatDate(s.created_at)} by {s.signer_user_id ? s.signer_user_id.slice(0, 8) + "…" : "system"}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Evidence ledger trail */}
      <div>
        <h3 className="text-[10px] font-mono text-slate-400 tracking-widest mb-3">EVIDENCE LEDGER TRAIL</h3>
        {p.docTrail.length === 0 ? (
          <p className="text-xs font-mono text-slate-600">No ledger records for this document.</p>
        ) : (
          <div className="space-y-1.5">
            {p.docTrail.map((r: DocLedgerRecord) => (
              <div key={r.id} className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
                <span className="text-slate-600 whitespace-nowrap">{formatDate(r.created_at)}</span>
                <span className="text-white">{r.event_type}</span>
                <span className="text-biometric">{r.record_hash.slice(0, 14)}…</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Update evidence (new version) */}
      {p.canWrite && (
        <div className="bg-obsidian-900/60 rounded-xl p-4 border border-white/5">
          <h3 className="text-[10px] font-mono text-slate-400 tracking-widest mb-3">UPDATE EVIDENCE — UPLOAD A NEW VERSION</h3>
          <div className="flex gap-3 items-center flex-wrap">
            <input ref={p.fileRef} type="file" onChange={(e) => p.setNewFile(e.target.files?.[0] || null)} className="text-xs font-mono text-slate-300 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-white/10 file:text-white file:text-[10px] file:font-mono" />
            <input value={p.newNotes} onChange={(e) => p.setNewNotes(e.target.value)} placeholder="Change notes (logged in audit trail)" className="flex-1 min-w-[200px] h-10 px-3 bg-obsidian-900 border border-white/10 rounded-lg text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-cybergold/50" />
            <button onClick={p.onUpload} disabled={!p.newFile || p.busy} className="h-10 px-4 bg-white text-obsidian-900 rounded-lg text-[10px] font-mono font-bold disabled:opacity-40 transition-all">
              {p.busy ? "UPLOADING..." : "UPLOAD NEW VERSION"}
            </button>
            <button onClick={p.onSign} disabled={p.busy || p.versions.length === 0} className="h-10 px-4 border border-cybergold/40 text-cybergold rounded-lg text-[10px] font-mono font-bold disabled:opacity-40 hover:bg-cybergold/10 transition-all">
              SIGN
            </button>
          </div>
        </div>
      )}
    </div>
  );
}






