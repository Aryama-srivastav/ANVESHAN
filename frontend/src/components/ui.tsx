import React from "react";
import { motion } from "framer-motion";

// ── Shared types mirroring the FastAPI response models ───────────────
export interface CaseItem {
  id: string;
  case_number: string;
  title: string;
  description?: string;
  status: string;
  created_at: string;
}

export interface DocItem {
  id: string;
  title: string;
  doc_type: string;
  sensitivity_level: string;
  status: string;
  created_at: string;
}

export interface VersionItem {
  id: string;
  document_id: string;
  version_number: number;
  is_original: boolean;
  content_hash: string;
  storage_uri?: string;
  notes?: string | null;
  created_by_user_id?: string | null;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  case_id: string;
  actor_user_id: string;
  event_type: string;
  action: string;
  details: Record<string, any>;
  event_hash?: string;
  created_at: string;
}

export interface LedgerRecord {
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

export interface SearchHit {
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
  entities: Record<string, string[]>;
  matched_fields: string[];
  activity_at: string;
  version_count: number;
}

export interface SearchFacets {
  entities: Record<string, string[]>;
  doc_types: string[];
  tags: string[];
  sensitivity_levels: string[];
}

export interface MlSuggestion {
  document_id: string;
  engine: string;
  status: string;
  category: string;
  confidence: number;
  tags: string[];
  entities: Record<string, string[]>;
  scores: Record<string, number>;
  excerpt: string;
  scored_at: string | null;
}

export interface IntegrityItem {
  version_id: string;
  version_number: number;
  is_original: boolean;
  expected_hash: string;
  observed_hash: string | null;
  status: string;
  created_at: string;
}

export interface IntegritySummary {
  document_id: string;
  versions: IntegrityItem[];
  intact: boolean;
}

export interface SignatureItem {
  id: string;
  document_version_id: string;
  signer_user_id: string | null;
  signature_algorithm: string;
  signature_value: string;
  signed_at: string;
  verified?: boolean | null;
}

export interface TransferItem {
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
  transferred_at: string | null;
  accepted_at: string | null;
  document_title?: string | null;
  case_number?: string | null;
}

export interface UserInfo {
  id: string;
  full_name: string;
  email: string;
  roles: string[];
  department?: string | null;
  agency?: string | null;
  is_active?: boolean;
}

export interface GovVerification {
  id: string;
  user_id: string;
  verification_method: string;
  verifier: string;
  status: string;
  verified_at: string | null;
  notes: string | null;
}

// ─ Helpers ──────────────────────────────────────────────────────────
export function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

export function shortHash(value: string | null | undefined, size = 16) {
  if (!value) return "—";
  return value.length <= size ? value : `${value.slice(0, size)}…`;
}

export function errorMessage(err: any, fallback = "Request failed") {
  return err?.message || fallback;
}

// ── Primitives ───────────────────────────────────────────────────────
export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`glass-panel rounded-2xl ${className}`}>{children}</div>;
}

export function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-sm font-mono font-bold text-white tracking-widest">{children}</h2>
      {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export function Btn({
  children, onClick, variant = "ghost", disabled, type = "button", className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "accent";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const styles: Record<string, string> = {
    primary: "bg-white text-obsidian-900 hover:shadow-[0_0_15px_rgba(255,255,255,0.2)]",
    accent: "bg-biometric text-obsidian-900 hover:shadow-[0_0_15px_rgba(0,240,255,0.3)]",
    ghost: "border border-white/10 text-slate-300 hover:bg-white/5 hover:border-white/20",
    danger: "border border-red-500/30 text-red-400 hover:bg-red-500/10",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`h-10 px-4 rounded-xl text-[11px] font-mono font-bold tracking-widest transition-all disabled:opacity-40 inline-flex items-center justify-center gap-2 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-mono text-slate-500 tracking-widest block mb-2">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full h-11 px-4 bg-obsidian-900 border border-white/10 rounded-xl text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-biometric/50 transition-all";

export function StatusPill({ status }: { status: string }) {
  const key = (status || "").toLowerCase();
  const map: Record<string, string> = {
    active: "bg-biometric/10 text-biometric border-biometric/30",
    open: "bg-biometric/10 text-biometric border-biometric/30",
    pending: "bg-cybergold/10 text-cybergold border-cybergold/30",
    verified: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    intact: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    accepted: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    signed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    closed: "bg-slate-500/10 text-slate-400 border-slate-500/30",
    archived: "bg-slate-500/10 text-slate-400 border-slate-500/30",
    rejected: "bg-red-500/10 text-red-400 border-red-500/30",
    failed: "bg-red-500/10 text-red-400 border-red-500/30",
    tampered: "bg-red-500/10 text-red-400 border-red-500/30",
    unclassified: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  };
  const cls = map[key] || "bg-white/5 text-slate-300 border-white/10";
  return (
    <span className={`px-2.5 py-1 rounded-full border text-[10px] font-mono font-bold tracking-wider ${cls}`}>
      {(status || "unknown").toUpperCase()}
    </span>
  );
}

export function ModalBackdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative glass-panel rounded-2xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-hide"
      >
        {children}
      </motion.div>
    </div>
  );
}

export function Empty({
  icon: Icon, title, hint,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  hint?: string;
}) {
  return (
    <div className="py-16 text-center">
      <Icon size={40} className="text-slate-700 mx-auto mb-4" />
      <p className="text-white font-bold font-mono mb-1">{title}</p>
      {hint && <p className="text-slate-500 text-sm">{hint}</p>}
    </div>
  );
}

export function Loading({ label }: { label: string }) {
  return <div className="py-16 text-center text-slate-500 font-mono text-sm">{label}</div>;
}

export function Banner({ kind = "info", children }: { kind?: "info" | "error" | "success"; children: React.ReactNode }) {
  const styles = {
    info: "bg-white/5 border-white/10 text-slate-300",
    error: "bg-red-500/10 border-red-500/30 text-red-400",
    success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  }[kind];
  return <div className={`p-3 rounded-xl border text-xs font-mono ${styles}`}>{children}</div>;
}

export const docIconFor = (docType: string) => {
  if (docType?.includes("image")) return "image";
  if (docType?.includes("audio")) return "audio";
  if (docType?.includes("video")) return "video";
  return "file";
};