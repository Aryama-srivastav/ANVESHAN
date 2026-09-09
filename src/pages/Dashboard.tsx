import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Files, ClipboardCheck, ArrowRight, ShieldCheck, Activity, AlertTriangle, Clock, ChevronRight, Network } from 'lucide-react';
import { useStore } from '../store';
import { StatusBadge, IntegrityBadge, SectionTitle } from '../components/Badges';
import { timeAgo, fmtDateTime, shortHash, cx } from '../lib/utils';

function useCountUp(target: number, dur = 850) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf: number; const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return v;
}

function Kpi({ icon: Icon, label, value, suffix, sub, badge, onClick }: any) {
  const n = useCountUp(typeof value === 'number' ? value : 0);
  return (
    <button onClick={onClick} className="v-card v-card-hover p-4 text-left" aria-label={label}>
      <div className="flex items-center justify-between gap-2">
        <p className="v-meta-label">{label}</p>
        <span className="text-[#8a99ae]"><Icon size={16} strokeWidth={1.8} /></span>
      </div>
      <p className="mt-1 text-[27px] font-bold leading-none tracking-tight text-[#101f36]">
        {typeof value === 'number' ? n.toLocaleString() : value}{suffix && <span className="text-[17px] font-semibold text-[#3c4f68]">{suffix}</span>}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        {badge}
      </div>
      <p className="mt-1 text-[12px] leading-snug text-[#68778e]">{sub}</p>
    </button>
  );
}

export default function Dashboard() {
  const { cases, documents, transactions, blocks, audit, shares } = useStore();
  const nav = useNavigate();

  const activeCases = cases.filter((c) => c.status === 'Active').length;
  const highPri = documents.filter((d) => d.integrity_status === 'Pending').length;
  const latestBlock = blocks.length ? [...blocks].sort((a, b) => b.block_number - a.block_number)[0] : null;
  const anchored = transactions.filter((t) => t.status === 'Anchored').length;

  const recentCases = useMemo(() => [...cases].sort((a, b) => +new Date(b.last_activity) - +new Date(a.last_activity)).slice(0, 4), [cases]);
  const recentDocs = useMemo(() => [...documents].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)).slice(0, 5), [documents]);
  const recentAudit = useMemo(() => [...audit].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)).slice(0, 6), [audit]);

  const secStats = useMemo(() => ([
    { label: 'Verified documents', v: documents.filter((d) => d.integrity_status === 'Verified').length, total: documents.length },
    { label: 'Anchored transactions', v: anchored, total: transactions.length },
    { label: 'MFA coverage', v: 100, total: 100, pct: true },
    { label: 'Access-denied events (logged)', v: audit.filter((a) => a.result === 'Denied' || a.action === 'Access Denied').length, total: Math.max(audit.length, 1) },
  ]), [documents, transactions, audit, anchored]);

  return (
    <div className="space-y-6">
      {/* Hero — Stitch authority panel, single accent surface */}
      <section className="overflow-hidden rounded-xl bg-[#0a2342] px-6 py-6 text-white sm:px-7 sm:py-7" aria-label="VERITAS overview">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mono rounded bg-white/10 px-2 py-[3px] text-[10px] font-medium uppercase tracking-[0.08em] text-blue-100">Secure Digital Document Management</span>
              <span className="mono rounded border border-white/20 px-2 py-[3px] text-[10px] tracking-[0.08em] text-blue-100/80">ISO/IEC 27037 Evidentiary Standard</span>
            </div>
            <h1 className="mt-3 max-w-xl text-[24px] font-bold leading-[1.2] sm:text-[28px]">Sovereign Digital Evidence Management Architecture</h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-blue-100/80">“Every document is controlled. Every action is traceable. Every record can be verified.” Judicial-grade evidentiary vault engineered for investigation, legal and forensic workflows.</p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
            <button onClick={() => nav('/verify')} className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-[13px] font-semibold text-[#0a2342] transition hover:bg-[#e8eef5]"><ShieldCheck size={15} /> Verify Document Hash</button>
            <button onClick={() => nav('/ledger')} className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-white/10"><Network size={15} /> Command Ledger</button>
          </div>
        </div>
      </section>

      {/* KPI strip — quiet labels, strong numbers */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key metrics">
        <Kpi icon={FolderOpen} label="Active Cases" value={activeCases || 24} sub="Dossiers sealed under CrPC Section 65B" badge={<span className="v-pill v-pill-ok">+2 this week</span>} onClick={() => nav('/cases')} />
        <Kpi icon={ClipboardCheck} label="Pending Verification" value={7} sub="Awaiting cryptographic check against IO signature" badge={<span className="v-pill v-pill-warn">{highPri} high priority</span>} onClick={() => nav('/verify')} />
        <Kpi icon={Files} label="Documents" value={documents.length} sub="Sealed repository · SHA-256 fingerprinted" badge={<span className="v-pill v-pill-ok">{documents.filter((d) => d.integrity_status === 'Verified').length} verified</span>} onClick={() => nav('/documents')} />
        <Kpi icon={Network} label="Ledger Sync Health" value="99.98" suffix="%" sub="Node DL-04 · 8 MHA zones · 14ms latency" badge={<span className="v-pill v-pill-info">Synchronized</span>} onClick={() => nav('/ledger')} />
      </section>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        {/* Security overview */}
        <section className="v-card p-5" aria-label="Security overview">
          <SectionTitle title="Security Overview" sub="Posture across documents, ledger and access control." />
          <div className="mt-4 space-y-3.5">
            {secStats.map((s) => {
              const pct = s.pct ? s.v : Math.round((s.v / Math.max(s.total, 1)) * 100);
              return (
                <div key={s.label}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12.5px] font-medium text-[#33475f]">{s.label}</span>
                    <span className="mono text-[12px] font-medium text-[#0a2342]">{s.pct ? `${s.v}%` : `${s.v}/${s.total}`}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#edf1f6]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={s.label}>
                    <div className="h-full rounded-full bg-[#0a2342] transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="v-panel px-3.5 py-3 text-[12.5px] leading-relaxed text-[#3c4f68]">
              <span className="font-semibold text-[#0a2342]">Chain-of-custody intact.</span>{' '}
              {documents.filter((d) => d.integrity_status === 'Mismatch').length} mismatch under review · {transactions.filter((t) => t.status === 'Failed').length} failed anchor awaiting retry.
            </div>
          </div>
        </section>

        {/* Recent cases */}
        <section className="v-card flex flex-col p-5" aria-label="Recent cases">
          <div className="flex items-start justify-between gap-2">
            <SectionTitle title="Recent Cases" />
            <button onClick={() => nav('/cases')} className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[#2456c6] hover:underline">View all <ArrowRight size={13} /></button>
          </div>
          <div className="mt-3 flex-1 space-y-2">
            {recentCases.map((c) => (
              <button key={c.id} onClick={() => nav(`/cases/${c.id}`)} className="flex w-full items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-left transition hover:border-[#e1e7ef] hover:bg-[#f7f9fc]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#eef2f7] text-[#0a2342]"><Files size={15} strokeWidth={1.8} /></span>
                <span className="min-w-0 flex-1">
                  <span className="mono block text-[10.5px] font-medium text-[#7d8b9f]">{c.case_number}</span>
                  <span className="block truncate text-[13px] font-semibold text-[#1c2c46]">{c.title}</span>
                </span>
                <span className="hidden shrink-0 sm:block"><StatusBadge status={c.status} /></span>
              </button>
            ))}
          </div>
        </section>

        {/* Ledger health */}
        <section className="v-card flex flex-col p-5" aria-label="Ledger health">
          <div className="flex items-start justify-between gap-2">
            <SectionTitle title="Ledger Health" sub={latestBlock ? `Block #${latestBlock.block_number} · ${timeAgo(latestBlock.timestamp)}` : undefined} />
            <button onClick={() => nav('/ledger')} className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[#2456c6] hover:underline">Explorer <ArrowRight size={13} /></button>
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-[#0a2342] px-4 py-3 text-white">
            <div className="min-w-0">
              <p className="v-meta-label v-meta-on-dark">Latest sealed block</p>
              <p className="mono text-[21px] font-semibold leading-tight">#{latestBlock?.block_number || 48291}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="v-meta-label v-meta-on-dark">Anchored</p>
              <p className="text-[14px] font-semibold">{anchored} documents</p>
            </div>
          </div>
          <div className="mt-2.5 space-y-1.5">
            {[...blocks].sort((a, b) => b.block_number - a.block_number).slice(0, 3).map((b) => (
              <div key={b.block_number} className="flex items-center gap-2.5 px-1 py-1.5">
                <span className="mono rounded bg-[#eef2f7] px-1.5 py-0.5 text-[11px] font-semibold text-[#0a2342]">#{b.block_number}</span>
                <span className="mono truncate text-[11px] text-[#68778e]">{shortHash(b.hash, 12, 8)}</span>
                <span className="ml-auto shrink-0 text-[11.5px] text-[#68778e]">{b.tx_count} txns</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {/* Recent documents — single table surface */}
        <section className="v-table-wrap" aria-label="Recent documents">
          <div className="flex items-center justify-between px-5 pb-2 pt-4">
            <SectionTitle title="Recent Documents" />
            <button onClick={() => nav('/documents')} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#2456c6] hover:underline">Repository <ArrowRight size={13} /></button>
          </div>
          <div className="overflow-x-auto">
            <table className="v-table w-full min-w-[560px]">
              <thead><tr><th>Document</th><th>Case</th><th>Integrity</th><th>Updated</th></tr></thead>
              <tbody>
                {recentDocs.map((d) => (
                  <tr key={d.id} className="cursor-pointer" onClick={() => nav(`/documents/${d.id}`)}>
                    <td><span className="block text-[13px] font-semibold text-[#1c2c46]">{d.filename}</span><span className="mono text-[10.5px] text-[#8a96ad]">{d.id} · {d.version}</span></td>
                    <td className="mono text-[11.5px] text-[#3c4f68]">{d.case_number.split('/').slice(-1)}</td>
                    <td><IntegrityBadge status={d.integrity_status} /></td>
                    <td className="whitespace-nowrap text-[12px] text-[#68778e]">{timeAgo(d.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent activity — timeline, quiet markers */}
        <section className="v-card p-5" aria-label="Recent activity">
          <div className="flex items-start justify-between gap-2">
            <SectionTitle title="Recent Activity" sub="Latest audited events across the vault." />
            <button onClick={() => nav('/audit')} className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[#2456c6] hover:underline">Audit trail <ArrowRight size={13} /></button>
          </div>
          <ol className="mt-4">
            {recentAudit.map((a, i) => (
              <li key={a.id} className="relative flex gap-3 pb-3.5 last:pb-0">
                {i < recentAudit.length - 1 && <span className="absolute left-[4px] top-4 h-full w-px bg-[#e4e9f0]" />}
                <span className={cx('z-10 mt-[5px] h-2 w-2 shrink-0 rounded-full', a.result === 'Success' ? 'bg-[#359268]' : a.result === 'Denied' || a.result === 'Mismatch' || a.result === 'Failed' ? 'bg-[#c05148]' : 'bg-[#c99a2e]')} />
                <div className="min-w-0">
                  <p className="text-[12.5px] leading-snug text-[#1c2c46]"><span className="font-semibold">{a.actor}</span> <span className="text-[#68778e]">· {a.action} ·</span> <button onClick={() => a.resource_id?.startsWith('DOC') && nav(`/documents/${a.resource_id}`)} className="font-medium text-[#2456c6] hover:underline">{a.resource}</button></p>
                  <p className="mono mt-0.5 text-[10.5px] text-[#8a96ad]">{fmtDateTime(a.timestamp)} · {a.reference}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* Tamper demo — restrained notice strip */}
      <section className="flex flex-col items-start gap-3 rounded-xl border border-[#eed9ae] bg-[#fdf9ef] px-5 py-4 sm:flex-row sm:items-center" aria-label="Tamper detection demo">
        <span className="rounded-full bg-[#f6ead0] p-2 text-[#8a6116]"><AlertTriangle size={16} strokeWidth={2} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-[#1c2c46]">Tamper-detection demo ready</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#6d5a2e]">CDR_Analysis_March.xlsx no longer matches its ledger record. Run verification to see the <span className="font-semibold">Integrity Mismatch</span> state and linked audit event.</p>
        </div>
        <button onClick={() => nav('/verify?doc=DOC-20260448')} className="v-btn-primary shrink-0">Run tamper demo <ChevronRight size={14} /></button>
      </section>

      {/* Shares expiring */}
      {shares.filter((s) => s.status !== 'Revoked').length > 0 && (
        <section className="v-card p-5" aria-label="Access expiring">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-[#3c4f68]" strokeWidth={1.8} />
            <SectionTitle title="Access Expiring" sub="Active shares approaching expiry." />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {shares.filter((s) => s.status !== 'Revoked').slice(0, 2).map((s) => (
              <button key={s.id} onClick={() => nav('/sharing')} className="v-panel flex items-center gap-3 px-3.5 py-2.5 text-left transition hover:border-[#b6c1d2]">
                <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-[#1c2c46]">{s.doc_name}</span><span className="block truncate text-[12px] text-[#68778e]">{s.recipient} · {s.permission}</span></span>
                <StatusBadge status={s.status} />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
