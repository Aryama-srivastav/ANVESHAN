import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useStore, type AuditItem } from '../store';
import { StatusBadge, SectionTitle, EmptyState } from '../components/Badges';
import { fmtDateTime } from '../lib/utils';

const ACTIONS = ['All', 'Login', 'Upload', 'Validation', 'Hash Generation', 'Ledger Anchor', 'Verification', 'Share', 'Revoke', 'Download', 'Permission Change', 'Access Denied'];
const PAGE = 9;

export default function Audit() {
  const { audit } = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [action, setAction] = useState('All');
  const [result, setResult] = useState('All');
  const [open, setOpen] = useState<number | string | null>(null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let r = [...audit].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter((a) => a.actor.toLowerCase().includes(s) || a.resource.toLowerCase().includes(s) || (a.reference || '').toLowerCase().includes(s) || (a.details || '').toLowerCase().includes(s));
    }
    if (action !== 'All') r = r.filter((a) => a.action === action);
    if (result !== 'All') r = r.filter((a) => a.result === result);
    return r;
  }, [audit, q, action, result]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows = filtered.slice((page - 1) * PAGE, page * PAGE);

  const goResource = (a: AuditItem) => {
    if (a.resource_id?.startsWith('DOC')) nav(`/documents/${a.resource_id}`);
    else if (a.reference?.startsWith('TX-')) nav(`/ledger/${a.reference}`);
  };

  return (
    <div className="space-y-5">
      <SectionTitle kicker="Oversight" title="Audit Trail" sub="Immutable record of every action — login to verification. Expand any event for full evidentiary detail." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Total events', String(audit.length)],
          ['Successful', String(audit.filter((a) => a.result === 'Success').length)],
          ['Denied / Mismatch', String(audit.filter((a) => ['Denied', 'Mismatch', 'Failed'].includes(a.result)).length)],
          ['Retention', '7 years'],
        ].map(([k, v]) => (
          <div key={k} className="v-card px-4 py-3"><p className="v-meta-label">{k}</p><p className="mt-0.5 text-[21px] font-bold leading-none text-[#101f36]">{v}</p></div>
        ))}
      </div>

      <div className="v-card grid grid-cols-1 gap-2.5 p-3.5 md:grid-cols-[1fr_200px_170px]">
        <label className="relative block">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a96ad]" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search actor, resource, reference, details…" className="v-input pl-9" aria-label="Search audit trail" />
        </label>
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="v-input" aria-label="Filter by action">
          {ACTIONS.map((a) => <option key={a}>{a}</option>)}
        </select>
        <select value={result} onChange={(e) => { setResult(e.target.value); setPage(1); }} className="v-input" aria-label="Filter by result">
          {['All', 'Success', 'Pending', 'Mismatch', 'Failed', 'Denied'].map((a) => <option key={a}>{a}</option>)}
        </select>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No audit events match" sub="Adjust search or filters." />
      ) : (
        <div className="v-table-wrap">
          <div className="overflow-x-auto">
            <table className="v-table w-full min-w-[880px]">
              <thead><tr><th></th><th>Timestamp</th><th>Actor</th><th>Action</th><th>Resource</th><th>Result</th><th>Reference</th></tr></thead>
              <tbody>
                {rows.map((a) => (
                  <>
                    <tr key={a.id} className="cursor-pointer" onClick={() => setOpen(open === a.id ? null : a.id)}>
                      <td className="w-8">{open === a.id ? <ChevronDown size={14} className="text-[#3c4f68]" /> : <ChevronRight size={14} className="text-[#b6c1d2]" />}</td>
                      <td className="mono whitespace-nowrap text-[11px] text-[#3c4f68]">{fmtDateTime(a.timestamp)}</td>
                      <td className="whitespace-nowrap text-[12.5px] font-medium text-[#1c2c46]">{a.actor}</td>
                      <td className="whitespace-nowrap text-[12.5px]"><span className="rounded bg-[#eef2f7] px-1.5 py-0.5 text-[11.5px] font-semibold text-[#0a2342]">{a.action}</span></td>
                      <td className="text-[12.5px]">{a.resource}<span className="mono block text-[10.5px] text-[#8a96ad]">{a.resource_id}</span></td>
                      <td><StatusBadge status={a.result} /></td>
                      <td className="mono text-[11px] text-[#3c4f68]">{a.reference}</td>
                    </tr>
                    {open === a.id && (
                      <tr key={`${a.id}-d`} className="v-row-open">
                        <td />
                        <td colSpan={6} className="v-cell-tight">
                          <div className="v-panel px-3.5 py-3 text-[12.5px] leading-relaxed text-[#3c4f68]">
                            <p><span className="font-semibold text-[#1c2c46]">Event #{a.id} — {a.action}.</span> {a.details}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <button onClick={(e) => { e.stopPropagation(); goResource(a); }} className="rounded-lg border border-[#cfd7e3] bg-white px-2.5 py-1 text-[11.5px] font-semibold text-[#2456c6] hover:bg-[#f1f5f9]">Open linked record</button>
                              <span className="mono rounded bg-[#eef2f7] px-2 py-1 text-[10.5px] text-[#3c4f68]">{a.resource_id} · {a.reference}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-[12px] text-[#68778e]">
        <p>Showing {rows.length} of {filtered.length} events · Page {page}/{pages}</p>
        <div className="flex gap-1.5">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="v-btn-secondary v-btn-sm disabled:opacity-40">Prev</button>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="v-btn-secondary v-btn-sm disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}
