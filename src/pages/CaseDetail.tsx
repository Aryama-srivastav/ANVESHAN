import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FolderKanban, ShieldCheck, Users, History, FileText, UploadCloud } from 'lucide-react';
import { useStore } from '../store';
import { StatusBadge, ClassificationBadge, IntegrityBadge } from '../components/Badges';
import { timeAgo, fmtDateTime, shortHash, cx } from '../lib/utils';

const TABS = ['Documents', 'Timeline', 'Access', 'Audit Trail'] as const;

export default function CaseDetail() {
  const { id } = useParams();
  const { cases, documents, audit, shares, users } = useStore();
  const nav = useNavigate();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Documents');

  const c = cases.find((x) => String(x.id) === String(id));
  const docs = useMemo(() => documents.filter((d) => c && d.case_number === c.case_number), [documents, c]);
  const events = useMemo(() => {
    if (!c) return [];
    const names = new Set(docs.map((d) => d.filename).concat(docs.map((d) => d.id)));
    return audit.filter((a) => names.has(a.resource) || names.has(a.resource_id) || a.reference === c.case_number).sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
  }, [audit, docs, c]);
  const caseShares = useMemo(() => shares.filter((s) => docs.some((d) => d.id === s.doc_id)), [shares, docs]);

  if (!c) return <div className="v-card p-8 text-center"><p className="font-semibold">Case not found</p><button onClick={() => nav('/cases')} className="v-btn-secondary mt-3">Back to Cases</button></div>;

  const verified = docs.filter((d) => d.integrity_status === 'Verified').length;
  const assigned = users.filter((u) => u.name === c.officer || u.department === c.department).slice(0, 4);

  return (
    <div className="space-y-5">
      <button onClick={() => nav('/cases')} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#3c4f68] hover:text-[#0a2342]"><ArrowLeft size={14} /> Back to Cases</button>

      <section className="v-card overflow-hidden">
        <div className="bg-[#0a2342] px-5 py-5 text-white sm:px-6">
          <div className="flex flex-wrap items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10"><FolderKanban size={19} strokeWidth={1.8} /></span>
            <div className="min-w-0 flex-1">
              <p className="mono text-[11px] tracking-wide text-blue-200/80">{c.case_number} · {c.department}</p>
              <h1 className="mt-0.5 text-[19px] font-semibold leading-snug sm:text-[21px]">{c.title}</h1>
              <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-blue-100/75">{c.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusBadge status={c.status} />
              <ClassificationBadge level={c.classification} />
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-0 border-t border-white/10 pt-3 sm:grid-cols-4">
            {[
              ['Assigned officer', c.officer],
              ['Documents', String(docs.length || c.doc_count)],
              ['Verified', `${verified}/${docs.length || c.doc_count}`],
              ['Last activity', timeAgo(c.last_activity)],
            ].map(([k, v]) => (
              <div key={k} className="border-b border-white/5 py-2 sm:border-0 sm:py-0">
                <dt className="mono text-[10px] uppercase tracking-[0.07em] text-blue-200/60">{k}</dt>
                <dd className="mt-0.5 truncate text-[13px] font-semibold text-white">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex gap-0.5 overflow-x-auto border-b border-[#e8edf3] px-3" role="tablist" aria-label="Case sections">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={cx('whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-semibold transition', tab === t ? 'border-[#0a2342] text-[#0a2342]' : 'border-transparent text-[#7d8b9f] hover:text-[#33475f]')}>{t}</button>
          ))}
        </div>

        <div className="px-5 py-4">
          {tab === 'Documents' && (
            <div>
              {docs.length === 0 ? <p className="py-6 text-center text-[13px] text-[#68778e]">No documents yet in this dossier.</p> : (
                <div className="v-table-wrap">
                  <div className="overflow-x-auto">
                    <table className="v-table w-full min-w-[640px]">
                      <thead><tr><th>Document</th><th>Version</th><th>Classification</th><th>Integrity</th><th>Uploader</th><th>Updated</th></tr></thead>
                      <tbody>
                        {docs.map((d) => (
                          <tr key={d.id} className="cursor-pointer" onClick={() => nav(`/documents/${d.id}`)}>
                            <td><span className="text-[13px] font-semibold text-[#1c2c46]">{d.filename}</span><span className="mono block text-[10.5px] text-[#8a96ad]">{d.id}</span></td>
                            <td className="mono text-[12px] text-[#3c4f68]">{d.version}</td>
                            <td><ClassificationBadge level={d.classification} /></td>
                            <td><IntegrityBadge status={d.integrity_status} /></td>
                            <td className="text-[12.5px]">{d.uploader}</td>
                            <td className="whitespace-nowrap text-[12px] text-[#68778e]">{timeAgo(d.updated_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <button onClick={() => nav(`/upload?case=${encodeURIComponent(c.case_number)}`)} className="v-btn-primary mt-3.5"><UploadCloud size={14} /> Upload to this case</button>
            </div>
          )}

          {tab === 'Timeline' && (
            <ol>
              {events.length === 0 && <p className="py-6 text-center text-[13px] text-[#68778e]">No timeline events yet.</p>}
              {events.map((a, i) => (
                <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < events.length - 1 && <span className="absolute left-[4px] top-4 h-full w-px bg-[#e4e9f0]" />}
                  <span className="z-10 mt-[5px] h-2 w-2 shrink-0 rounded-full bg-[#0a2342]" />
                  <div className="v-panel min-w-0 flex-1 px-3.5 py-2.5">
                    <p className="text-[12.5px]"><span className="font-semibold text-[#1c2c46]">{a.action}</span> <span className="text-[#3c4f68]">· {a.resource}</span> <span className="text-[#68778e]">by {a.actor}</span></p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-[#5d6d84]">{a.details}</p>
                    <p className="mono mt-1 text-[10.5px] text-[#8a96ad]">{fmtDateTime(a.timestamp)} · {a.reference}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {tab === 'Access' && (
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <h3 className="v-meta-label flex items-center gap-1.5"><Users size={13} /> Assigned officers</h3>
                <div className="mt-2 space-y-1.5">
                  {(assigned.length ? assigned : users.slice(0, 3)).map((u) => (
                    <div key={u.id} className="flex items-center gap-2.5 px-1 py-1.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#0a2342] text-[10.5px] font-semibold text-white">{u.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}</span>
                      <span className="min-w-0"><span className="block truncate text-[13px] font-semibold text-[#1c2c46]">{u.name}</span><span className="block text-[11.5px] text-[#68778e]">{u.role} · {u.department}</span></span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="v-meta-label flex items-center gap-1.5"><ShieldCheck size={13} /> Active shares</h3>
                <div className="mt-2 space-y-1.5">
                  {caseShares.length === 0 && <p className="rounded-lg border border-dashed border-[#c6cfdb] bg-[#f8fafc] px-3 py-3.5 text-center text-[12px] text-[#68778e]">No active shares for this case.</p>}
                  {caseShares.map((s) => (
                    <div key={s.id} className="v-panel flex items-center gap-2.5 px-3 py-2">
                      <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-semibold text-[#1c2c46]">{s.doc_name}</span><span className="block truncate text-[11px] text-[#68778e]">{s.recipient} · {s.permission}</span></span>
                      <StatusBadge status={s.status} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'Audit Trail' && (
            <div className="v-table-wrap">
              <div className="overflow-x-auto">
                <table className="v-table w-full min-w-[640px]">
                  <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Resource</th><th>Result</th><th>Reference</th></tr></thead>
                  <tbody>
                    {events.map((a) => (
                      <tr key={a.id}>
                        <td className="mono whitespace-nowrap text-[11px] text-[#3c4f68]">{fmtDateTime(a.timestamp)}</td>
                        <td className="text-[12.5px] font-medium">{a.actor}</td>
                        <td className="text-[12.5px]">{a.action}</td>
                        <td className="text-[12.5px]">{a.resource}</td>
                        <td><StatusBadge status={a.result} /></td>
                        <td className="mono text-[11px]">{a.reference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Security summary — one composed strip, not three floating cards */}
      <section className="v-card flex flex-col divide-y divide-[#eef1f6] px-5 sm:flex-row sm:items-center sm:divide-x sm:divide-y-0" aria-label="Case security summary">
        <div className="flex flex-1 items-center gap-2.5 py-3.5 sm:pr-5"><ShieldCheck size={16} className="shrink-0 text-[#359268]" strokeWidth={1.9} /><div><p className="text-[12.5px] font-semibold text-[#1c2c46]">Chain-of-custody</p><p className="text-[12px] text-[#68778e]">{verified} of {docs.length || c.doc_count} verified · sealed</p></div></div>
        <div className="flex flex-1 items-center gap-2.5 py-3.5 sm:px-5"><FileText size={16} className="shrink-0 text-[#3f6ea5]" strokeWidth={1.9} /><div><p className="text-[12.5px] font-semibold text-[#1c2c46]">Ledger coverage</p><p className="mono text-[11.5px] text-[#68778e]">{docs.filter((d) => d.tx_id && !d.tx_id.startsWith('TX-PENDING') && !d.tx_id.startsWith('TX-FAILED')).length} anchored · {shortHash(docs[0]?.sha256 || '', 8, 6)}</p></div></div>
        <div className="flex flex-1 items-center gap-2.5 py-3.5 sm:pl-5"><History size={16} className="shrink-0 text-[#68778e]" strokeWidth={1.9} /><div><p className="text-[12.5px] font-semibold text-[#1c2c46]">Audit completeness</p><p className="text-[12px] text-[#68778e]">{events.length} events recorded · 100% retained</p></div></div>
      </section>
    </div>
  );
}
