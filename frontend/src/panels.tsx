// ANVESHAN — Evidence Vault search, Audit Logs, Clearance, Settings and
// the Evidence Detail modal. Kept separate from App.tsx for clarity.
import React, { useState, useEffect, useRef } from "react";
// @ts-ignore — api.js is plain JS, no types
import { api } from "./api";
import {
  Search, ShieldCheck, Lock, FileText, Shield, Fingerprint,
  FileImage, FileAudio, FileVideo, File as FileLucide, X, Hash,
  Building2, ArrowRightLeft, Check, XCircle, Send, RefreshCw,
  BarChart3, Truck, Scale, Gavel, Users, ClipboardList,
  Megaphone, Bell, TicketCheck, Copy, Inbox,
  Pin,
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
  department?: string | null;
  agency?: string | null;
}

// ── Department configuration (case-lifecycle departments) ──────────────
export const DEPARTMENTS: { key: string; name: string; icon: any; operate: string[]; view: string[] }[] = [
  { key: "criminal_records", name: "Criminal Record Dataset", icon: BarChart3, operate: ["admin"], view: ["admin", "investigator"] },
  { key: "e_forensics", name: "E-Forensics", icon: Truck, operate: ["admin"], view: ["admin", "investigator", "auditor"] },
  { key: "police", name: "Police", icon: Shield, operate: ["admin"], view: ["admin", "investigator", "auditor"] },
  { key: "legal", name: "Legal", icon: Scale, operate: ["admin"], view: ["admin", "investigator", "auditor"] },
  { key: "judiciary", name: "Judiciary", icon: Gavel, operate: ["admin"], view: ["admin", "investigator", "auditor", "viewer"] },
  { key: "forensics", name: "Forensics", icon: Fingerprint, operate: ["admin"], view: ["admin", "investigator"] },
  { key: "prison", name: "Prison", icon: Users, operate: ["admin"], view: ["admin", "investigator"] },
  { key: "nyaya", name: "Nyaya (Judicial Verdicts)", icon: ClipboardList, operate: ["admin"], view: ["admin", "investigator", "auditor", "viewer"] },
];

export interface DepartmentItem {
  key: string;
  name: string;
  description: string;
  can_operate: boolean;
  can_view: boolean;
}

export interface DepartmentRecord {
  id: string;
  department: string;
  case_id: string | null;
  case_number: string | null;
  title: string;
  body: string;
  created_by_user_id: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface ComplaintItem {
  id: string;
  token: string;
  email: string;
  subject: string;
  details: string;
  department: string;
  status: string;
  created_at: string;
  updated_at: string | null;
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
  const [pinned, setPinned] = useState<SearchHit[]>([]);

  function togglePin(hit: SearchHit) {
    setPinned((prev) => {
      const exists = prev.find((p) => p.document_id === hit.document_id);
      return exists ? prev.filter((p) => p.document_id !== hit.document_id) : [...prev, hit];
    });
  }
  function clearPins() { setPinned([]); }

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
        <h1 className="text-3xl font-bold text-ink font-mono tracking-wide mb-1">Semantic Search</h1>
        <p className="text-[#6B7280] text-sm">Full-text, entity and tag search across all evidence you are authorised to see.</p>
      </motion.div>

      <motion.form onSubmit={runSearch} variants={itemV} className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B7280]" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search titles, tags, metadata, document contents..." className="w-full h-12 pl-11 pr-28 bg-obsidian-800/60 backdrop-blur-xl border border-fileline rounded-xl text-sm font-mono text-ink placeholder:text-[#9CA3AF] focus:outline-none focus:border-cybergold/50 focus:ring-1 focus:ring-cybergold/30 transition-all" />
        <button type="submit" disabled={loading} className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-4 bg-registry text-paper rounded-lg text-[10px] font-mono font-bold tracking-widest disabled:opacity-40 transition-all">
          {loading ? "..." : "SEARCH"}
        </button>
      </motion.form>

      {meta && hits && hits.length > 0 && (
        <div className="text-[10px] font-mono text-[#6B7280] tracking-wider">
          {meta.total} MATCH{meta.total === 1 ? "" : "ES"} · {meta.took_ms}MS
        </div>
      )}

      {/* Pinned evidence strip */}
      {pinned.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-2 items-center gap-x-3">
          <span className="text-[9px] font-mono font-bold text-cybergold tracking-widest uppercase">PINNED</span>
          {pinned.map((p) => (
            <button key={p.document_id} onClick={() => togglePin(p)} aria-label={`Unpin ${p.title}`} title="Unpin this evidence"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-obsidian-700 border border-cybergold/30 text-cybergold hover:bg-cybergold/10 transition-all">
              <Pin size={11} className="fill-cybergold/30" />
              <span className="text-[9px] font-mono max-w-[180px] truncate">{p.title}</span>
              <X size={10} className="text-[#6B7280] hover:text-cybergold" />
            </button>
          ))}
          <button onClick={clearPins} className="text-[8px] font-mono text-[#6B7280] hover:text-cybergold underline">CLEAR ALL</button>
        </motion.div>
      )}

      <motion.div variants={itemV} className="space-y-4">
        {loading ? (
          <div className="py-16 text-center text-[#6B7280] font-mono text-sm">SEARCHING...</div>
        ) : hits === null || hits.length === 0 ? (
          <div className="glass-panel rounded-2xl py-16 text-center">
            <Search size={40} className="text-[#B9AE93] mx-auto mb-4" />
            <p className="text-[#6B7280] font-mono text-sm">{hits === null ? "ENTER A QUERY" : "NO MATCHING EVIDENCE"}</p>
          </div>
        ) : (
          hits.map((hit: SearchHit) => (
            <HitCard
              key={hit.document_id}
              hit={hit}
              onOpenDocument={onOpenDocument}
              pinned={pinned.some((p) => p.document_id === hit.document_id)}
              onPin={() => togglePin(hit)}
            />
          ))
        )}
      </motion.div>
    </motion.div>
  );
}

function HitCard({ hit, onOpenDocument, pinned = false, onPin }: { hit: SearchHit; onOpenDocument: (docId: string) => void; pinned?: boolean; onPin?: () => void }) {
  const DIcon = docIcon(hit.doc_type);
  return (
    <motion.div whileHover={{ y: -2 }} onClick={() => onOpenDocument(hit.document_id)}
      className="glass-panel rounded-xl p-5 border border-fileline cursor-pointer group hover:border-cybergold/40 transition-all">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-obsidian-700 flex items-center justify-center text-[#6B7280] group-hover:text-cybergold shrink-0 transition-colors">
          <DIcon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-bold text-ink group-hover:text-cybergold transition-colors">{hit.title}</span>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-cybergold/10 text-cybergold border border-cybergold/20">SCORE {hit.score.toFixed(2)}</span>
            {hit.matched_fields.map((f: string) => (
              <span key={f} className="text-[9px] font-mono px-2 py-0.5 rounded bg-obsidian-700 text-[#4B5563] border border-fileline">{f.toUpperCase()}</span>
            ))}
          </div>
          <div className="text-[10px] font-mono text-[#6B7280] mt-1.5">
            {hit.case_number} · {hit.case_title} · {hit.doc_type?.replace(/_/g, " ")} · {hit.sensitivity_level} · {hit.version_count} VERSION{hit.version_count === 1 ? "" : "S"}
          </div>
          {hit.excerpt && <p className="text-xs text-[#4B5563] mt-2 line-clamp-2 font-mono">…{hit.excerpt}…</p>}
          {hit.tags.length > 0 && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {hit.tags.map((t: string) => (
                <span key={t} className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-biometric/10 text-biometric border border-biometric/20">{t}</span>
              ))}
            </div>
          )}
        </div>
                <div className="flex flex-col items-end gap-2">
          <div className="text-[10px] font-mono text-[#6B7280] whitespace-nowrap">{formatDate(hit.activity_at)}</div>
          {onPin && (
            <button onClick={(e) => { e.stopPropagation(); onPin(); }}
              aria-label={pinned ? "Unpin evidence" : "Pin evidence"}
              title={pinned ? "Unpin this evidence" : "Pin this evidence"}
              className={`p-1 rounded-md transition-all ${pinned ? "bg-cybergold text-obsidian-900" : "bg-obsidian-700 text-[#6B7280] hover:text-cybergold hover:bg-cybergold/10"}`}>
              <Pin size={12} className={pinned ? "fill-obsidian-900" : ""} />
            </button>
          )}
        </div>
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
          <Lock size={40} className="text-[#B9AE93] mx-auto mb-4" />
          <p className="text-ink font-bold font-mono mb-1">RESTRICTED</p>
          <p className="text-[#6B7280] text-sm">The global audit ledger is visible to administrators and auditors only.</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }} initial="hidden" animate="show" className="max-w-7xl mx-auto p-8 space-y-6">
      <motion.div variants={itemV} className="flex items-end justify-between">
        <div>
          <div className="text-[10px] font-mono font-bold text-cybergold tracking-[0.2em] mb-2">TAMPER-EVIDENT LEDGER</div>
          <h1 className="text-3xl font-bold text-ink font-mono tracking-wide">Audit Logs</h1>
        </div>
        <div className="flex gap-3">
          <button onClick={verifyChain} disabled={verifying} className="h-10 px-4 border border-biometric/40 rounded-xl text-xs font-mono font-bold text-biometric hover:bg-biometric/10 disabled:opacity-40 transition-all flex items-center gap-2">
            <ShieldCheck size={14} /> {verifying ? "VERIFYING..." : "VERIFY CHAIN"}
          </button>
          <button onClick={load} className="h-10 px-4 border border-fileline rounded-xl text-xs font-mono font-bold text-ink hover:bg-ink/5 transition-all">REFRESH</button>
        </div>
      </motion.div>

      {chain && (
        <motion.div variants={itemV} className={`rounded-xl p-4 border text-xs font-mono ${chain.intact ? "bg-biometric/10 border-biometric/30 text-biometric" : "bg-seal/10 border-seal/30 text-seal"}`}>
          {chain.intact
            ? `✓ CHAIN INTACT — all ${chain.checked ?? records.length} ledger records re-hashed and linked successfully.`
            : `✗ CHAIN BROKEN — ${chain.problems.length} integrity issue(s): ${chain.problems.slice(0, 3).map((p) => `${p.record_id.slice(0, 8)} (${p.issue})`).join(", ")}`}
        </motion.div>
      )}

      {loading ? (
        <div className="glass-panel rounded-2xl py-16 text-center text-[#6B7280] font-mono text-sm">LOADING LEDGER...</div>
      ) : error ? (
        <div className="glass-panel rounded-2xl py-16 text-center text-seal font-mono text-sm">{error}</div>
      ) : records.length === 0 ? (
        <div className="glass-panel rounded-2xl py-16 text-center">
          <FileText size={40} className="text-[#B9AE93] mx-auto mb-4" />
          <p className="text-[#6B7280] font-mono text-sm">NO LEDGER RECORDS YET</p>
        </div>
      ) : (
        <motion.div variants={itemV} className="glass-panel rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-fileline text-[9px] font-mono text-[#6B7280] tracking-widest">
                <th className="px-5 py-3">TIME</th>
                <th className="px-5 py-3">EVENT</th>
                <th className="px-5 py-3">ACTOR</th>
                <th className="px-5 py-3">RECORD HASH</th>
                <th className="px-5 py-3">TX ID</th>
              </tr>
            </thead>
            <tbody>
              {records.map((rec: LedgerRecord) => (
                <tr key={rec.id} className="border-b border-fileline hover:bg-ink/[0.03] transition-colors">
                  <td className="px-5 py-3 text-[10px] font-mono text-[#6B7280] whitespace-nowrap">{formatDate(rec.created_at)}</td>
                  <td className="px-5 py-3 text-xs font-mono text-ink">{rec.event_type}</td>
                  <td className="px-5 py-3 text-[10px] font-mono text-[#4B5563]">{rec.actor_user_id ? rec.actor_user_id.slice(0, 8) + "…" : "system"}</td>
                  <td className="px-5 py-3 text-[10px] font-mono text-biometric">{rec.record_hash.slice(0, 16)}…</td>
                  <td className="px-5 py-3 text-[10px] font-mono text-[#6B7280]">{rec.transaction_id}</td>
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
        <h1 className="text-3xl font-bold text-ink font-mono tracking-wide">Clearance</h1>
      </motion.div>

      {!isAdmin ? (
        <motion.div variants={itemV} className="glass-panel rounded-2xl p-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-cybergold/10 border border-cybergold/20 flex items-center justify-center"><Shield size={22} className="text-cybergold" /></div>
            <div>
              <div className="text-lg font-bold text-ink font-mono">{currentUser?.full_name || "—"}</div>
              <div className="text-[10px] font-mono text-[#6B7280] mt-0.5">{currentUser?.email} · {role?.toUpperCase()}</div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="bg-obsidian-900/60 rounded-xl p-4 border border-fileline">
              <div className="text-[9px] font-mono text-[#6B7280] tracking-widest mb-1">CLEARANCE LEVEL</div>
              <div className="text-sm font-mono text-ink">{CLEARANCE_LABELS[role] || "—"}</div>
            </div>
            <div className="bg-obsidian-900/60 rounded-xl p-4 border border-fileline">
              <div className="text-[9px] font-mono text-[#6B7280] tracking-widest mb-1">PERMISSIONS</div>
              <div className="text-xs font-mono text-[#4B5563]">
                {role === "viewer" && "Read-only access to all cases and evidence."}
                {role === "auditor" && "View cases/evidence, audit ledger and chain verification."}
                {role === "investigator" && "View, upload and update evidence in any case."}
                {!["viewer", "auditor", "investigator"].includes(role) && "Standard access."}
              </div>
            </div>
          </div>
          <p className="text-[10px] font-mono text-[#6B7280] mt-6">Only administrators can view the full user directory and assign roles.</p>
        </motion.div>
      ) : loading ? (
        <div className="glass-panel rounded-2xl py-16 text-center text-[#6B7280] font-mono text-sm">LOADING USERS...</div>
      ) : error ? (
        <div className="glass-panel rounded-2xl py-16 text-center text-seal font-mono text-sm">{error}</div>
      ) : (
        <motion.div variants={itemV} className="glass-panel rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-fileline flex items-center justify-between">
            <h2 className="text-sm font-mono font-bold text-ink tracking-widest">USER DIRECTORY</h2>
            <span className="text-[10px] font-mono text-[#6B7280]">{users.length} USERS</span>
          </div>
          <div className="divide-y divide-fileline">
            {users.map((u: DirectoryUser) => (
              <div key={u.id} className="flex items-center gap-4 px-6 py-4 hover:bg-ink/[0.03] transition-all">
                <div className="w-9 h-9 rounded-lg bg-obsidian-700 flex items-center justify-center text-[#6B7280]"><Fingerprint size={16} /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-ink">{u.full_name}</div>
                  <div className="text-[10px] font-mono text-[#6B7280] mt-0.5">{u.email}{u.department ? ` · ${u.department}` : ""}{u.agency ? ` · ${u.agency}` : ""}</div>
                </div>
                <div className="text-[10px] font-mono text-[#4B5563] hidden md:block">{u.clearance_level || "—"}</div>
                <select
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) changeRole(u.id, e.target.value); e.currentTarget.value = ""; }}
                  className="h-9 px-3 bg-obsidian-900 border border-fileline rounded-lg text-[10px] font-mono text-ink focus:outline-none focus:border-cybergold/50 appearance-none"
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
        <h1 className="text-3xl font-bold text-ink font-mono tracking-wide">Settings</h1>
      </motion.div>

      <motion.div variants={itemV} className="glass-panel rounded-2xl p-8">
        <h2 className="text-sm font-mono font-bold text-ink tracking-widest mb-6">PROFILE</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {([
            ["FULL NAME", currentUser?.full_name],
            ["EMAIL", currentUser?.email],
            ["ROLE", role?.toUpperCase()],
            ["USER ID", currentUser?.id],
          ] as [string, string | undefined][]).map(([label, value]) => (
            <div key={label} className="bg-obsidian-900/60 rounded-xl p-4 border border-fileline">
              <div className="text-[9px] font-mono text-[#6B7280] tracking-widest mb-1">{label}</div>
              <div className="text-xs font-mono text-ink truncate">{value || "—"}</div>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div variants={itemV} className="glass-panel rounded-2xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-mono font-bold text-ink tracking-widest">MULTI-FACTOR AUTHENTICATION</h2>
          <button onClick={setupMfa} className="h-9 px-4 bg-registry text-paper rounded-lg text-[10px] font-mono font-bold tracking-widest hover:shadow-[0_0_15px_rgba(36,64,122,0.25)] transition-all">GENERATE MFA SECRET</button>
        </div>
        {mfa ? (
          <div className="bg-obsidian-900/60 rounded-xl p-4 border border-biometric/20">
            <div className="text-[9px] font-mono text-biometric tracking-widest mb-2">TOTP SECRET — ENROL IN YOUR AUTHENTICATOR APP</div>
            <div className="text-xs font-mono text-biometric break-all">{mfa.secret}</div>
            <div className="text-[9px] font-mono text-[#6B7280] mt-3 break-all">{mfa.provisioning_uri}</div>
          </div>
        ) : (
          <p className="text-xs text-[#6B7280] font-mono">Generate a TOTP secret to enrol this account in MFA. All prototype sessions already carry a verified MFA claim.</p>
        )}
      </motion.div>

      <motion.div variants={itemV} className="glass-panel rounded-2xl p-8">
        <h2 className="text-sm font-mono font-bold text-ink tracking-widest mb-6">SYSTEM INFORMATION</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-obsidian-900/60 rounded-xl p-4 border border-fileline">
            <div className="text-[9px] font-mono text-[#6B7280] tracking-widest mb-1">ENVIRONMENT</div>
            <div className="text-xs font-mono text-ink truncate">{(import.meta as any).env?.VITE_API_URL || "http://localhost:8000"}</div>
          </div>
          <div className="bg-obsidian-900/60 rounded-xl p-4 border border-fileline">
            <div className="text-[9px] font-mono text-[#6B7280] tracking-widest mb-1">CLEARANCE</div>
            <div className="text-xs font-mono text-ink truncate">{CLEARANCE_LABELS[role] || "—"}</div>
          </div>
          {isAdmin && backup && (
            <div className="bg-obsidian-900/60 rounded-xl p-4 border border-fileline">
              <div className="text-[9px] font-mono text-[#6B7280] tracking-widest mb-1">BACKUPS</div>
              <div className="text-xs font-mono text-ink truncate">{backup.storage_provider} · {backup.backups?.length ?? 0} snapshot{(backup.backups?.length ?? 0) === 1 ? "" : "s"}</div>
            </div>
          )}
        </div>
        <p className="text-[10px] font-mono text-[#6B7280] mt-6">Audit logging: every case creation, upload and version change is sealed into the tamper-evident ledger automatically.</p>
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

interface TagItem {
  id: string;
  name: string;
  category?: string | null;
}

interface MlSuggestion {
  document_id: string;
  engine: string;
  status: string;
  category: string;
  confidence: number;
  tags: string[];
  entities: Record<string, string[]>;
  scores: Record<string, number>;
  excerpt: string;
  scored_at?: string | null;
}

interface LineageVersion {
  version_id: string;
  version_number: number;
  is_original: boolean;
  recorded_hash: string;
  anchored_hash: string | null;
  byte_status: string;
  record_status: string;
}

interface LineageResult {
  document_id: string;
  intact: boolean;
  issues: string[];
  versions: LineageVersion[];
}

export function DocumentDetailModal({ docId, role, onClose, onNotify }: { docId: string; role: string; onClose: () => void; onNotify: (m: string) => void }) {
  const [detail, setDetail] = useState<DocDetail | null>(null);
  const [versions, setVersions] = useState<DocVersion[]>([]);
  const [integrity, setIntegrity] = useState<DocIntegrityItem[]>([]);
  const [signatures, setSignatures] = useState<DocSignature[]>([]);
  const [docTrail, setDocTrail] = useState<DocLedgerRecord[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [ml, setMl] = useState<MlSuggestion | null>(null);
  const [lineage, setLineage] = useState<LineageResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newNotes, setNewNotes] = useState("");
  const [newTag, setNewTag] = useState("");
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

    // Tags, ML suggestions and cross-version lineage are advisory: a failure
    // here must never block the core evidence view.
    api.getDocumentTags(docId).then(setTags).catch(() => setTags([]));
    api.getMlSuggestions(docId).then(setMl).catch(() => setMl(null));
    api.getDocumentLineage(docId).then(setLineage).catch(() => setLineage(null));
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

  async function addTag() {
    const name = newTag.trim();
    if (!name) return;
    setBusy(true);
    try {
      // Reuse an existing tag with the same name, otherwise create it first.
      const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
      let tagId = existing?.id;
      if (!tagId) {
        const created = await api.createTag({ name, category: "manual" });
        tagId = created.id;
      }
      await api.linkTag(docId, tagId);
      setNewTag("");
      onNotify(`Tag "${name}" attached & logged`);
      api.getDocumentTags(docId).then(setTags).catch(() => { });
    } catch (err: any) {
      onNotify(err.message || "Failed to add tag");
    } finally {
      setBusy(false);
    }
  }

  async function acceptSuggestions(overrides?: { tags?: string[]; category?: string }) {
    setBusy(true);
    try {
      const res = await api.acceptMlSuggestions(docId, overrides || {});
      setMl(res);
      onNotify("ML suggestions confirmed by officer — applied to evidence");
      api.getDocumentTags(docId).then(setTags).catch(() => { });
    } catch (err: any) {
      onNotify(err.message || "Failed to accept suggestions");
    } finally {
      setBusy(false);
    }
  }

  async function reclassify() {
    setBusy(true);
    try {
      const res = await api.reclassifyDocument(docId);
      setMl(res);
      onNotify("Re-classified by the ML engine — review and confirm");
    } catch (err: any) {
      onNotify(err.message || "Classification failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center p-6 overflow-y-auto" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} onClick={(e: React.MouseEvent) => e.stopPropagation()} className="w-full max-w-3xl my-8 bg-obsidian-800 border border-fileline rounded-2xl p-8 shadow-xl">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold font-mono text-ink tracking-widest flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-cybergold/10 flex items-center justify-center"><FileText size={18} className="text-cybergold" /></div>
              EVIDENCE DETAIL
            </h2>
            {detail && <p className="text-[10px] font-mono text-[#6B7280] mt-2">{detail.title} · {detail.doc_type?.replace(/_/g, " ")} · {detail.sensitivity_level}</p>}
          </div>
          <button onClick={onClose} className="text-[#6B7280] hover:text-ink transition-colors"><X size={20} /></button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-[#6B7280] font-mono text-sm">LOADING EVIDENCE...</div>
        ) : !detail ? (
          <div className="py-16 text-center text-seal font-mono text-sm">EVIDENCE NOT FOUND OR ACCESS DENIED</div>
        ) : (
          <DetailBody
            detail={detail}
            versions={versions}
            integrity={integrity}
            signatures={signatures}
            docTrail={docTrail}
            tags={tags}
            ml={ml}
            lineage={lineage}
            canWrite={canWrite}
            busy={busy}
            newFile={newFile}
            newNotes={newNotes}
            newTag={newTag}
            fileRef={fileRef}
            setNewFile={setNewFile}
            setNewNotes={setNewNotes}
            setNewTag={setNewTag}
            onUpload={uploadNewVersion}
            onSign={signLatest}
            onDownload={download}
            onAddTag={addTag}
            onAcceptSuggestions={acceptSuggestions}
            onReclassify={reclassify}
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
  tags: TagItem[];
  ml: MlSuggestion | null;
  lineage: LineageResult | null;
  canWrite: boolean;
  busy: boolean;
  newFile: File | null;
  newNotes: string;
  newTag: string;
  fileRef: React.RefObject<HTMLInputElement | null>;
  setNewFile: (f: File | null) => void;
  setNewNotes: (n: string) => void;
  setNewTag: (t: string) => void;
  onUpload: () => void;
  onSign: () => void;
  onDownload: (v: DocVersion) => void;
  onAddTag: () => void;
  onAcceptSuggestions: (overrides?: { tags?: string[]; category?: string }) => void;
  onReclassify: () => void;
}

function DetailBody(p: DetailBodyProps) {
  const integrityFor = (versionId: string) => p.integrity.find((it) => it.version_id === versionId);
  const allIntact = p.integrity.length === 0 || p.integrity.every((it) => it.status === "verified" || it.status === "unverified");
  return (
    <div className="space-y-6">
      {/* Metadata */}
      <div className="grid grid-cols-2 gap-3">
        {([
          ["UPLOADED", formatDate(p.detail.created_at), "text-ink"],
          ["STATUS", p.detail.status, "text-ink"],
          ["VERSIONS", String(p.versions.length), "text-ink"],
          ["TAMPER STATUS", allIntact ? "VERIFIED ✓" : "TAMPERED ✗", allIntact ? "text-biometric" : "text-seal"],
        ] as [string, string, string][]).map(([label, value, color]) => (
          <div key={label} className="bg-obsidian-900/60 rounded-xl p-4 border border-fileline">
            <div className="text-[9px] font-mono text-[#6B7280] tracking-widest mb-1">{label}</div>
            <div className={`text-xs font-mono ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Versions — original preserved, every change logged */}
      <div>
        <h3 className="text-[10px] font-mono text-[#6B7280] tracking-widest mb-3">VERSIONS — ORIGINAL PRESERVED, EVERY CHANGE LOGGED</h3>
        <div className="space-y-2">
          {p.versions.slice().sort((a, b) => a.version_number - b.version_number).map((v: DocVersion) => {
            const it = integrityFor(v.id);
            const tampered = it?.status === "tampered";
            return (
              <div key={v.id} className="bg-obsidian-900/60 rounded-xl p-4 border border-fileline flex items-center gap-4">
                <div className={`px-2 py-1 rounded font-mono text-[10px] font-bold whitespace-nowrap ${v.version_number === 1 ? "bg-cybergold/10 text-cybergold border border-cybergold/20" : "bg-obsidian-700 text-[#4B5563] border border-fileline"}`}>
                  {v.version_number === 1 ? "ORIGINAL v1" : `v${v.version_number}`}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[10px] font-mono truncate ${tampered ? "text-seal" : "text-biometric"}`}>
                    <Hash size={10} className="inline mr-1" />{v.content_hash.slice(0, 24)}…
                  </div>
                  <div className="text-[9px] font-mono text-[#6B7280] mt-0.5">
                    {formatDate(v.created_at)} · {it ? (tampered ? "TAMPERED ✗" : it.status.toUpperCase()) : "INTEGRITY UNKNOWN"}
                    {it?.observed_hash && it.observed_hash !== "unreadable" ? ` · re-hash ${it.observed_hash.slice(0, 12)}…` : ""}
                  </div>
                </div>
                <button onClick={() => p.onDownload(v)} className="h-8 px-3 border border-fileline rounded-lg text-[10px] font-mono font-bold text-ink hover:bg-ink/5 transition-all">DOWNLOAD</button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Digital signatures */}
      <div>
        <h3 className="text-[10px] font-mono text-[#6B7280] tracking-widest mb-3">DIGITAL SIGNATURES (LATEST VERSION)</h3>
        {p.signatures.length === 0 ? (
          <p className="text-xs font-mono text-[#6B7280]">No signatures on the latest version yet.</p>
        ) : (
          <div className="space-y-2">
            {p.signatures.map((s: DocSignature) => (
              <div key={s.id} className="bg-obsidian-900/60 rounded-xl p-4 border border-fileline">
                <div className="text-[10px] font-mono text-cybergold"><Lock size={10} className="inline mr-1" />{s.algorithm} · {s.signed_hash.slice(0, 24)}…</div>
                <div className="text-[9px] font-mono text-[#6B7280] mt-1">signed {formatDate(s.created_at)} by {s.signer_user_id ? s.signer_user_id.slice(0, 8) + "…" : "system"}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tags & ML classification (Step 9) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-mono text-[#6B7280] tracking-widest">TAGS & ML CLASSIFICATION</h3>
          <button onClick={p.onReclassify} disabled={p.busy} className="h-7 px-3 border border-fileline rounded-lg text-[9px] font-mono font-bold text-ink hover:bg-ink/5 disabled:opacity-40 transition-all">
            RE-RUN CLASSIFIER
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {p.tags.length === 0 ? (
            <span className="text-xs font-mono text-[#6B7280]">No tags linked to this evidence yet.</span>
          ) : (
            p.tags.map((t: TagItem) => (
              <span key={t.id} className="px-2.5 py-1 rounded-lg bg-cybergold/10 border border-cybergold/20 text-cybergold text-[10px] font-mono">
                #{t.name}{t.category ? <span className="text-[#6B7280]"> · {t.category}</span> : null}
              </span>
            ))
          )}
        </div>

        {p.canWrite && (
          <div className="flex gap-3 items-center flex-wrap mb-4">
            <input
              value={p.newTag}
              onChange={(e) => p.setNewTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); p.onAddTag(); } }}
              placeholder="Add a tag (audited)"
              className="flex-1 min-w-[180px] h-9 px-3 bg-obsidian-900 border border-fileline rounded-lg text-xs font-mono text-ink placeholder:text-[#9CA3AF] focus:outline-none focus:border-cybergold/50"
            />
            <button onClick={p.onAddTag} disabled={p.busy || !p.newTag.trim()} className="h-9 px-4 bg-registry text-paper rounded-lg text-[10px] font-mono font-bold disabled:opacity-40 transition-all">
              ADD TAG
            </button>
          </div>
        )}

        {p.ml ? (
          <div className="bg-obsidian-900/60 rounded-xl p-4 border border-fileline space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono">
              <span className={`px-2 py-0.5 rounded font-bold ${p.ml.status === "accepted" ? "bg-biometric/10 text-biometric border border-biometric/20" : "bg-cybergold/10 text-cybergold border border-cybergold/20"}`}>
                {p.ml.status.toUpperCase()}
              </span>
              <span className="text-[#4B5563]">ENGINE {p.ml.engine}</span>
              <span className="text-ink">CATEGORY {p.ml.category?.replace(/_/g, " ")}</span>
              <span className="text-[#4B5563]">CONFIDENCE {(p.ml.confidence * 100).toFixed(1)}%</span>
            </div>

            {p.ml.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {p.ml.tags.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded bg-obsidian-700 border border-fileline text-[#4B5563] text-[10px] font-mono">{t}</span>
                ))}
              </div>
            )}

            {p.ml.entities && Object.keys(p.ml.entities).length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono">
                {Object.entries(p.ml.entities).map(([kind, values]) => (
                  <span key={kind} className="text-[#6B7280]">
                    {kind.toUpperCase()}: <span className="text-[#4B5563]">{values.join(", ")}</span>
                  </span>
                ))}
              </div>
            )}

            {p.ml.excerpt && (
              <p className="text-[10px] font-mono text-[#6B7280] border-l-2 border-fileline pl-3 leading-relaxed">{p.ml.excerpt}</p>
            )}

            {p.canWrite && p.ml.status !== "accepted" && (
              <div className="flex gap-2 pt-1">
                <button onClick={() => p.onAcceptSuggestions()} disabled={p.busy} className="h-8 px-4 bg-biometric/10 border border-biometric/30 text-biometric rounded-lg text-[10px] font-mono font-bold hover:bg-biometric/20 disabled:opacity-40 transition-all">
                  CONFIRM & APPLY SUGGESTIONS
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs font-mono text-[#6B7280]">No ML classification stored for this evidence. Re-run the classifier to generate suggestions.</p>
        )}
      </div>

      {/* Cross-version lineage verification (V2) */}
      <div>
        <h3 className="text-[10px] font-mono text-[#6B7280] tracking-widest mb-3">LINEAGE VERIFICATION — FILE · RECORD · CHAIN</h3>
        {!p.lineage ? (
          <p className="text-xs font-mono text-[#6B7280]">Lineage verification unavailable for this evidence.</p>
        ) : (
          <div className="space-y-3">
            <div className={`rounded-xl p-3 border text-[10px] font-mono font-bold tracking-wider ${p.lineage.intact ? "bg-biometric/10 border-biometric/30 text-biometric" : "bg-seal/10 border-seal/30 text-seal"}`}>
              {p.lineage.intact ? "LINEAGE INTACT ✓ — FILE, RECORD AND HASH CHAIN ALL VERIFY" : `LINEAGE BROKEN ✗ — ${p.lineage.issues.length} ISSUE${p.lineage.issues.length === 1 ? "" : "S"} DETECTED`}
            </div>

            {p.lineage.issues.length > 0 && (
              <ul className="space-y-1">
                {p.lineage.issues.map((issue, idx) => (
                  <li key={idx} className="text-[10px] font-mono text-seal border-l-2 border-seal/40 pl-3">{issue}</li>
                ))}
              </ul>
            )}

            <div className="space-y-2">
              {p.lineage.versions.map((lv: LineageVersion) => {
                const ok = lv.byte_status === "verified" && lv.record_status === "anchored";
                return (
                  <div key={lv.version_id} className="bg-obsidian-900/60 rounded-xl p-3 border border-fileline flex items-center gap-3 flex-wrap">
                    <span className={`px-2 py-0.5 rounded font-mono text-[9px] font-bold ${lv.is_original ? "bg-cybergold/10 text-cybergold border border-cybergold/20" : "bg-obsidian-700 text-[#4B5563] border border-fileline"}`}>
                      {lv.is_original ? "ORIGINAL v1" : `v${lv.version_number}`}
                    </span>
                    <span className={`text-[10px] font-mono ${lv.byte_status === "verified" ? "text-biometric" : "text-seal"}`}>
                      FILE {lv.byte_status.toUpperCase()}
                    </span>
                    <span className={`text-[10px] font-mono ${lv.record_status === "anchored" ? "text-biometric" : lv.record_status === "unanchored" ? "text-[#6B7280]" : "text-seal"}`}>
                      RECORD {lv.record_status.toUpperCase()}
                    </span>
                    <span className={`text-[10px] font-mono ${ok ? "text-biometric" : "text-[#6B7280]"}`}>{ok ? "PASS ✓" : "REVIEW"}</span>
                    <span className="text-[9px] font-mono text-[#6B7280] ml-auto truncate max-w-[45%]">{lv.recorded_hash?.slice(0, 24)}…</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Evidence ledger trail */}
      <div>
        <h3 className="text-[10px] font-mono text-[#6B7280] tracking-widest mb-3">EVIDENCE LEDGER TRAIL</h3>
        {p.docTrail.length === 0 ? (
          <p className="text-xs font-mono text-[#6B7280]">No ledger records for this document.</p>
        ) : (
          <div className="space-y-1.5">
            {p.docTrail.map((r: DocLedgerRecord) => (
              <div key={r.id} className="flex items-center gap-3 text-[10px] font-mono text-[#4B5563]">
                <span className="text-[#6B7280] whitespace-nowrap">{formatDate(r.created_at)}</span>
                <span className="text-ink">{r.event_type}</span>
                <span className="text-biometric">{r.record_hash.slice(0, 14)}…</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Update evidence (new version) */}
      {p.canWrite && (
        <div className="bg-obsidian-900/60 rounded-xl p-4 border border-fileline">
          <h3 className="text-[10px] font-mono text-[#6B7280] tracking-widest mb-3">UPDATE EVIDENCE — UPLOAD A NEW VERSION</h3>
          <div className="flex gap-3 items-center flex-wrap">
            <input ref={p.fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.rtf,.odt,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.tif,.webp,.mp3,.wav,.ogg,.m4a,.flac,.mp4,.mov,.avi,.mkv,.webm,.wmv,.csv,.json,.xml,.xlsx,.xls,.ppt,.pptx" onChange={(e) => p.setNewFile(e.target.files?.[0] || null)} className="text-xs font-mono text-[#4B5563] file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-obsidian-700 file:text-ink file:text-[10px] file:font-mono" />
            <input value={p.newNotes} onChange={(e) => p.setNewNotes(e.target.value)} placeholder="Change notes (logged in audit trail)" className="flex-1 min-w-[200px] h-10 px-3 bg-obsidian-900 border border-fileline rounded-lg text-xs font-mono text-ink placeholder:text-[#9CA3AF] focus:outline-none focus:border-cybergold/50" />
            <button onClick={p.onUpload} disabled={!p.newFile || p.busy} className="h-10 px-4 bg-registry text-paper rounded-lg text-[10px] font-mono font-bold disabled:opacity-40 transition-all">
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

// ── Prototype banner ─────────────────────────────────────────────────
// Cosmetic only: labels the demo environment and offers one-click demo
// sign-in. Rendered inside the scrollable content column (not above the
// fixed-height shell) so it never breaks the sidebar layout.
export function PrototypeBanner({ onQuickLogin }: { onQuickLogin: (role: "investigator" | "auditor" | "admin") => void }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  if (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_PROTOTYPE_MODE === "false") return null;
  return (
    <div className="border-b border-cybergold/25 bg-cybergold/10">
      <div className="px-4 py-2 flex items-center gap-3 flex-wrap">
        <span className="px-2 py-0.5 rounded bg-cybergold text-obsidian-950 text-[10px] font-mono font-bold tracking-widest">PROTOTYPE</span>
        <p className="text-[11px] font-mono text-cybergold/90 tracking-wide">
          DEMO ENVIRONMENT — demo identities only, no live case data.
        </p>
        <div className="flex items-center gap-1.5 ml-auto">
          {(["investigator", "auditor", "admin"] as const).map((r) => (
            <button key={r} onClick={() => onQuickLogin(r)}
              className="px-2.5 py-1 rounded-lg border border-cybergold/30 text-cybergold text-[10px] font-mono font-bold hover:bg-cybergold/10 transition-all">
              {r.toUpperCase()}
            </button>
          ))}
          <button onClick={() => setDismissed(true)} aria-label="Dismiss prototype banner"
            className="p-1 rounded-lg text-cybergold/60 hover:text-cybergold hover:bg-cybergold/10 transition-all">
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Viewer dashboard: public notices + complaint desk only ─────────────
// Notices: Nyaya + Judiciary department records (both viewer-visible in
// the backend permission matrix). Complaints: unauthenticated public
// endpoints (raise with email, track with token).
export function ViewerDashboard({ onNotify }: { onNotify: (m: string) => void }) {
  const [notices, setNotices] = useState<DepartmentRecord[]>([]);
  const [loadingNotices, setLoadingNotices] = useState(true);
  const [noticesError, setNoticesError] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [raising, setRaising] = useState(false);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [trackToken, setTrackToken] = useState("");
  const [tracking, setTracking] = useState(false);
  const [trackError, setTrackError] = useState("");
  const [tracked, setTracked] = useState<ComplaintItem | null>(null);

  useEffect(() => { loadNotices(); }, []);

  async function loadNotices() {
    setLoadingNotices(true);
    setNoticesError("");
    try {
      const [nyaya, judiciary] = await Promise.all([
        api.listDepartmentRecords("nyaya").catch(() => []),
        api.listDepartmentRecords("judiciary").catch(() => []),
      ]);
      const merged: DepartmentRecord[] = [...(nyaya || []), ...(judiciary || [])]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setNotices(merged);
    } catch (err: any) {
      setNoticesError(err?.message || "Could not load public notices");
    } finally {
      setLoadingNotices(false);
    }
  }

  async function raiseComplaint(e: React.FormEvent) {
    e.preventDefault();
    setRaising(true);
    setIssuedToken(null);
    try {
      const res = await api.raiseComplaint({ email: email.trim(), subject: subject.trim(), details: details.trim(), department: "nyaya" });
      setIssuedToken(res.token);
      setSubject("");
      setDetails("");
      onNotify("Complaint filed — save your tracking token");
    } catch (err: any) {
      onNotify(err?.message || "Could not file complaint");
    } finally {
      setRaising(false);
    }
  }

  async function trackComplaint(e: React.FormEvent) {
    e.preventDefault();
    if (!trackToken.trim()) return;
    setTracking(true);
    setTrackError("");
    setTracked(null);
    try {
      const res: ComplaintItem = await api.trackComplaint(trackToken.trim());
      setTracked(res);
    } catch (err: any) {
      setTrackError(err?.message || "Complaint not found — check the token and try again");
    } finally {
      setTracking(false);
    }
  }

  function copyToken() {
    if (!issuedToken) return;
    try {
      navigator.clipboard.writeText(issuedToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  }

  const statusColor = (s: string) =>
    s === "resolved" || s === "closed" ? "bg-biometric/10 text-biometric border-biometric/20"
    : s === "in_review" || s === "actioned" ? "bg-cybergold/10 text-cybergold border-cybergold/20"
    : "bg-obsidian-700 text-[#4B5563] border-fileline";

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[11px] font-mono font-bold text-[#6B7280] tracking-widest flex items-center gap-2">
            <Megaphone size={14} className="text-cybergold" /> PUBLIC NOTICES — NYAYA & JUDICIARY
          </h2>
          <button onClick={loadNotices} className="flex items-center gap-1.5 text-[10px] font-mono text-[#6B7280] hover:text-ink transition-all">
            <RefreshCw size={12} /> REFRESH
          </button>
        </div>
        {loadingNotices ? (
          <p className="text-xs font-mono text-[#6B7280] py-8 text-center">LOADING NOTICES…</p>
        ) : noticesError ? (
          <p className="text-xs font-mono text-seal py-8 text-center">{noticesError}</p>
        ) : notices.length === 0 ? (
          <div className="glass-panel rounded-xl p-8 text-center">
            <Bell size={28} className="text-[#B9AE93] mx-auto mb-3" />
            <p className="text-ink font-mono font-bold text-sm mb-1">NO PUBLIC NOTICES PUBLISHED YET</p>
            <p className="text-[#6B7280] text-xs font-mono">Judicial verdicts and public announcements will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {notices.map((n) => (
              <div key={n.id} className="glass-panel rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold border bg-obsidian-700 text-[#4B5563] border-fileline">
                    {n.department.toUpperCase()}
                  </span>
                  <span className="text-[10px] font-mono text-[#6B7280]">{formatDate(n.created_at)}</span>
                </div>
                <h3 className="text-ink font-bold text-sm mb-1.5 leading-snug">{n.title}</h3>
                {n.body && <p className="text-xs text-[#4B5563] line-clamp-3 leading-relaxed">{n.body}</p>}
                {n.case_number && <p className="text-[10px] font-mono text-[#6B7280] mt-2">REF {n.case_number}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-panel rounded-xl p-6" data-viewer_raise>
          <h2 className="text-[11px] font-mono font-bold text-[#6B7280] tracking-widest flex items-center gap-2 mb-1">
            <Send size={14} className="text-cybergold" /> FILE A COMPLAINT
          </h2>
          <p className="text-[11px] font-mono text-[#6B7280] mb-4">No login needed — you will receive a tracking token.</p>
          <form onSubmit={raiseComplaint} className="space-y-3">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email"
              className="w-full h-10 px-3 bg-obsidian-900 border border-fileline rounded-lg text-xs font-mono text-ink placeholder:text-[#9CA3AF] focus:outline-none focus:border-cybergold/50" />
            <input value={subject} onChange={(e) => setSubject(e.target.value)} required minLength={5} maxLength={255} placeholder="Subject (min 5 characters)"
              className="w-full h-10 px-3 bg-obsidian-900 border border-fileline rounded-lg text-xs font-mono text-ink placeholder:text-[#9CA3AF] focus:outline-none focus:border-cybergold/50" />
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} placeholder="Describe the issue in detail…"
              className="w-full px-3 py-2.5 bg-obsidian-900 border border-fileline rounded-lg text-xs font-mono text-ink placeholder:text-[#9CA3AF] focus:outline-none focus:border-cybergold/50 resize-y" />
            <button type="submit" disabled={raising || !email.trim() || !subject.trim()}
              className="w-full h-10 bg-registry text-paper rounded-lg text-[11px] font-mono font-bold disabled:opacity-40 transition-all">
              {raising ? "FILING…" : "SUBMIT COMPLAINT"}
            </button>
          </form>
          {issuedToken && (
            <div className="mt-4 p-3 rounded-xl bg-biometric/10 border border-biometric/25">
              <p className="text-[10px] font-mono font-bold text-biometric tracking-widest flex items-center gap-1.5 mb-1.5">
                <TicketCheck size={13} /> COMPLAINT FILED — SAVE THIS TOKEN
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-2.5 py-1.5 bg-obsidian-900 rounded-lg text-biometric text-xs font-mono break-all">{issuedToken}</code>
                <button onClick={copyToken} className="p-2 rounded-lg border border-biometric/25 text-biometric hover:bg-biometric/10 transition-all" title="Copy token">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="glass-panel rounded-xl p-6">
          <h2 className="text-[11px] font-mono font-bold text-[#6B7280] tracking-widest flex items-center gap-2 mb-1">
            <Inbox size={14} className="text-biometric" /> TRACK YOUR COMPLAINT
          </h2>
          <p className="text-[11px] font-mono text-[#6B7280] mb-4">Enter the token issued when you filed.</p>
          <form onSubmit={trackComplaint} className="flex gap-2 mb-4">
            <input value={trackToken} onChange={(e) => setTrackToken(e.target.value)} placeholder="Paste tracking token…"
              className="flex-1 h-10 px-3 bg-obsidian-900 border border-fileline rounded-lg text-xs font-mono text-ink placeholder:text-[#9CA3AF] focus:outline-none focus:border-biometric/50" />
            <button type="submit" disabled={tracking || !trackToken.trim()}
              className="h-10 px-4 bg-registry text-paper rounded-lg text-[11px] font-mono font-bold disabled:opacity-40 transition-all">
              {tracking ? "…" : "TRACK"}
            </button>
          </form>
          {trackError && <p className="text-xs font-mono text-seal">{trackError}</p>}
          {tracked && (
            <div className="p-4 rounded-xl bg-obsidian-900/60 border border-fileline space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${statusColor(tracked.status)}`}>
                  {tracked.status.replace(/_/g, " ").toUpperCase()}
                </span>
                <span className="text-[10px] font-mono text-[#6B7280]">{formatDate(tracked.created_at)}</span>
              </div>
              <h3 className="text-ink font-bold text-sm">{tracked.subject}</h3>
              {tracked.details && <p className="text-xs text-[#4B5563] leading-relaxed">{tracked.details}</p>}
              <p className="text-[10px] font-mono text-[#6B7280]">DEPARTMENT {tracked.department.toUpperCase()}</p>
            </div>
          )}
          {!tracked && !trackError && (
            <p className="text-[11px] font-mono text-[#6B7280]">Status, department and last update will appear here.</p>
          )}
        </div>
      </section>
    </div>
  );
}

interface DeptRequest {
  id: string;
  document_id: string;
  document_title: string | null;
  from_user_id: string;
  from_user_name: string | null;
  from_department: string | null;
  to_department: string | null;
  purpose: string;
  requested_access_level: string;
  status: string;
  review_notes: string | null;
  reviewed_by_name: string | null;
  created_at: string;
  reviewed_at: string | null;
}

interface TransferItem {
  id: string;
  document_id: string;
  from_user_id: string | null;
  to_user_id: string;
  from_department: string | null;
  to_department: string | null;
  from_agency: string | null;
  to_agency: string | null;
  transfer_purpose: string;
  access_level: string;
  status: string;
  transfer_hash: string;
  created_at: string;
  accepted_at: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-cybergold/10 text-cybergold border-cybergold/20",
  approved: "bg-biometric/10 text-biometric border-biometric/20",
  accepted: "bg-biometric/10 text-biometric border-biometric/20",
  rejected: "bg-seal/10 text-seal border-seal/30",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded font-mono text-[9px] font-bold border ${STATUS_STYLES[status] || "bg-obsidian-700 text-[#4B5563] border-fileline"}`}>
      {status.toUpperCase()}
    </span>
  );
}

export function DepartmentsView({ role, currentUser, onNotify }: { role: string; currentUser: PanelUser | null; onNotify: (m: string) => void }) {
  const [tab, setTab] = useState<"requests" | "transfers">("requests");
  const [requests, setRequests] = useState<DeptRequest[]>([]);
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // New-request form state
  const [cases, setCases] = useState<{ id: string; case_number: string; title: string }[]>([]);
  const [caseId, setCaseId] = useState("");
  const [caseDocs, setCaseDocs] = useState<{ id: string; title: string }[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [toDepartment, setToDepartment] = useState("");
  const [purpose, setPurpose] = useState("");
  const [accessLevel, setAccessLevel] = useState("read");

  const isAdmin = role === "admin";
  const myDepartment = currentUser?.department || null;

  /** A request is reviewable when the reviewer belongs to the destination
   *  department or is an administrator. */
  function canReview(req: DeptRequest) {
    if (req.status !== "pending") return false;
    if (isAdmin) return true;
    return !!req.to_department && req.to_department === myDepartment;
  }

  function loadAll() {
    setLoading(true);
    Promise.all([
      api.listDepartmentRequests(),
      api.listTransfers(),
    ]).then(([r, t]) => {
      setRequests(r || []);
      setTransfers(t || []);
    }).catch((err: Error) => onNotify(err.message || "Failed to load department data"))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAll(); }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { api.listCases().then(setCases).catch(() => setCases([])); }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!caseId) { setCaseDocs([]); setDocumentId(""); return; }
    api.getCaseDocuments(caseId).then(setCaseDocs).catch(() => setCaseDocs([]));
  }, [caseId]);

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!documentId || !purpose.trim()) return;
    setBusy(true);
    try {
      await api.createDepartmentRequest({
        document_id: documentId,
        purpose: purpose.trim(),
        requested_access_level: accessLevel,
        to_department: toDepartment.trim() || undefined,
      });
      setPurpose("");
      setDocumentId("");
      setCaseId("");
      setToDepartment("");
      onNotify("Department access request filed & logged");
      loadAll();
    } catch (err: any) {
      onNotify(err.message || "Failed to file request");
    } finally {
      setBusy(false);
    }
  }

  async function reviewRequest(req: DeptRequest, status: "approved" | "rejected") {
    setBusy(true);
    try {
      await api.actionDepartmentRequest(req.id, { status, review_notes: `Reviewed via console (${status})` });
      onNotify(`Request ${status} — access ${status === "approved" ? "granted" : "denied"}`);
      loadAll();
    } catch (err: any) {
      onNotify(err.message || "Failed to review request");
    } finally {
      setBusy(false);
    }
  }

  async function actOnTransfer(t: TransferItem, action: "accept" | "reject") {
    setBusy(true);
    try {
      if (action === "accept") await api.acceptTransfer(t.id);
      else await api.rejectTransfer(t.id, "Declined via console");
      onNotify(`Transfer ${action === "accept" ? "accepted — purpose-bound grant created" : "declined"}`);
      loadAll();
    } catch (err: any) {
      onNotify(err.message || "Failed to update transfer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }} initial="hidden" animate="show" className="max-w-6xl mx-auto p-8 space-y-6">
      <motion.div variants={itemV} className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] font-mono font-bold text-cybergold tracking-[0.2em] mb-2">CROSS-DEPARTMENT OPERATIONS</div>
          <h1 className="text-3xl font-bold text-ink font-mono tracking-wide mb-1">Departments</h1>
          <p className="text-[#6B7280] text-sm">
            Request evidence held by another department, review incoming requests and action secure transfers.
            {myDepartment ? <span className="text-[#4B5563]"> · Your unit: <span className="text-cybergold">{myDepartment}</span></span> : null}
          </p>
        </div>
        <button onClick={loadAll} disabled={loading} className="h-9 px-4 border border-fileline rounded-lg text-[10px] font-mono font-bold text-ink hover:bg-ink/5 disabled:opacity-40 transition-all flex items-center gap-2">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> REFRESH
        </button>
      </motion.div>

      <motion.div variants={itemV} className="flex gap-2">
        {([["requests", "ACCESS REQUESTS", requests.length], ["transfers", "EVIDENCE TRANSFERS", transfers.length]] as [typeof tab, string, number][]).map(([key, label, count]) => (
          <button key={key} onClick={() => setTab(key)} className={`h-10 px-5 rounded-xl font-mono text-[10px] font-bold tracking-widest transition-all ${tab === key ? "bg-registry text-paper" : "bg-obsidian-700 text-[#4B5563] border border-fileline hover:border-ink/20"}`}>
            {label}{count > 0 ? ` · ${count}` : ""}
          </button>
        ))}
      </motion.div>

      {tab === "requests" && (
        <motion.form variants={itemV} onSubmit={submitRequest} className="glass-panel rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-mono font-bold text-ink tracking-widest">FILE A NEW DEPARTMENT ACCESS REQUEST</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-[9px] font-mono text-[#6B7280] tracking-widest block mb-2">CASE FILE</span>
              <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className="w-full h-10 px-3 bg-obsidian-900 border border-fileline rounded-lg text-xs font-mono text-ink focus:outline-none focus:border-cybergold/50">
                <option value="">Select a case…</option>
                {cases.map((c) => <option key={c.id} value={c.id}>{c.case_number} — {c.title}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[9px] font-mono text-[#6B7280] tracking-widest block mb-2">EVIDENCE</span>
              <select value={documentId} onChange={(e) => setDocumentId(e.target.value)} disabled={!caseId} className="w-full h-10 px-3 bg-obsidian-900 border border-fileline rounded-lg text-xs font-mono text-ink focus:outline-none focus:border-cybergold/50 disabled:opacity-40">
                <option value="">{caseId ? "Select evidence…" : "Pick a case first"}</option>
                {caseDocs.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[9px] font-mono text-[#6B7280] tracking-widest block mb-2">DESTINATION DEPARTMENT</span>
              <input value={toDepartment} onChange={(e) => setToDepartment(e.target.value)} placeholder="Auto-detect from holder" className="w-full h-10 px-3 bg-obsidian-900 border border-fileline rounded-lg text-xs font-mono text-ink placeholder:text-[#9CA3AF] focus:outline-none focus:border-cybergold/50" />
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_auto] gap-4 items-end">
            <label className="block">
              <span className="text-[9px] font-mono text-[#6B7280] tracking-widest block mb-2">PURPOSE (LOGGED IN AUDIT TRAIL)</span>
              <input value={purpose} onChange={(e) => setPurpose(e.target.value)} required placeholder="Why is this evidence needed?" className="w-full h-10 px-3 bg-obsidian-900 border border-fileline rounded-lg text-xs font-mono text-ink placeholder:text-[#9CA3AF] focus:outline-none focus:border-cybergold/50" />
            </label>
            <label className="block">
              <span className="text-[9px] font-mono text-[#6B7280] tracking-widest block mb-2">ACCESS LEVEL</span>
              <select value={accessLevel} onChange={(e) => setAccessLevel(e.target.value)} className="w-full h-10 px-3 bg-obsidian-900 border border-fileline rounded-lg text-xs font-mono text-ink focus:outline-none focus:border-cybergold/50">
                <option value="read">read</option>
                <option value="write">write</option>
              </select>
            </label>
            <button type="submit" disabled={busy || !documentId || !purpose.trim()} className="h-10 px-5 bg-registry text-paper rounded-lg text-[10px] font-mono font-bold disabled:opacity-40 transition-all flex items-center gap-2">
              <Send size={12} /> FILE REQUEST
            </button>
          </div>
        </motion.form>
      )}

      <motion.div variants={itemV} className="space-y-3">
        {loading ? (
          <div className="py-16 text-center text-[#6B7280] font-mono text-sm">LOADING…</div>
        ) : tab === "requests" ? (
          requests.length === 0 ? (
            <div className="py-16 text-center text-[#6B7280] font-mono text-sm">NO DEPARTMENT ACCESS REQUESTS VISIBLE TO YOU</div>
          ) : requests.map((r) => (
            <div key={r.id} className="glass-panel rounded-2xl p-5 border border-fileline">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-cybergold/10 border border-cybergold/20 flex items-center justify-center shrink-0">
                    <Building2 size={18} className="text-cybergold" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-mono text-ink truncate">{r.document_title || `${r.document_id.slice(0, 12)}…`}</div>
                    <div className="text-[10px] font-mono text-[#6B7280] mt-1">
                      {r.from_user_name || r.from_user_id.slice(0, 8)} · {r.from_department || "unassigned"}
                      <ArrowRightLeft size={10} className="inline mx-1" />{r.to_department || "unassigned"}
                    </div>
                    <div className="text-[10px] font-mono text-[#4B5563] mt-2 border-l-2 border-fileline pl-3">{r.purpose}</div>
                    <div className="text-[9px] font-mono text-[#6B7280] mt-2">
                      filed {formatDate(r.created_at)} · access {r.requested_access_level}
                      {r.reviewed_by_name ? ` · reviewed by ${r.reviewed_by_name}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusPill status={r.status} />
                  {canReview(r) && (
                    <>
                      <button onClick={() => reviewRequest(r, "approved")} disabled={busy} className="h-8 px-3 bg-biometric/10 border border-biometric/30 text-biometric rounded-lg text-[10px] font-mono font-bold hover:bg-biometric/20 disabled:opacity-40 transition-all flex items-center gap-1">
                        <Check size={11} /> APPROVE
                      </button>
                      <button onClick={() => reviewRequest(r, "rejected")} disabled={busy} className="h-8 px-3 border border-seal/30 text-seal rounded-lg text-[10px] font-mono font-bold hover:bg-seal/10 disabled:opacity-40 transition-all flex items-center gap-1">
                        <XCircle size={11} /> REJECT
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : transfers.length === 0 ? (
          <div className="py-16 text-center text-[#6B7280] font-mono text-sm">NO EVIDENCE TRANSFERS RECORDED</div>
        ) : transfers.map((t) => (
          <div key={t.id} className="glass-panel rounded-2xl p-5 border border-fileline">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-biometric/10 border border-biometric/20 flex items-center justify-center shrink-0">
                  <ArrowRightLeft size={18} className="text-biometric" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-mono text-ink truncate">{t.transfer_purpose}</div>
                  <div className="text-[10px] font-mono text-[#6B7280] mt-1">
                    {t.from_department || "—"} ({t.from_agency || "—"})
                    <ArrowRightLeft size={10} className="inline mx-1" />
                    {t.to_department || "—"} ({t.to_agency || "—"})
                  </div>
                  <div className="text-[9px] font-mono text-[#6B7280] mt-2">
                    access {t.access_level} · created {formatDate(t.created_at)} · seal {t.transfer_hash.slice(0, 16)}…
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusPill status={t.status} />
                {t.status === "pending" && (isAdmin || t.to_user_id === currentUser?.id) && (
                  <>
                    <button onClick={() => actOnTransfer(t, "accept")} disabled={busy} className="h-8 px-3 bg-biometric/10 border border-biometric/30 text-biometric rounded-lg text-[10px] font-mono font-bold hover:bg-biometric/20 disabled:opacity-40 transition-all flex items-center gap-1">
                      <Check size={11} /> ACCEPT
                    </button>
                    <button onClick={() => actOnTransfer(t, "reject")} disabled={busy} className="h-8 px-3 border border-seal/30 text-seal rounded-lg text-[10px] font-mono font-bold hover:bg-seal/10 disabled:opacity-40 transition-all flex items-center gap-1">
                      <XCircle size={11} /> DECLINE
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}






