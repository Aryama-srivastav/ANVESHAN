import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, ShieldCheck, Copy, Download, Share2, AlertTriangle, Clock, Link2, History } from 'lucide-react';
import { useStore, type ShareItem } from '../store';
import { IntegrityBadge, ClassificationBadge, StatusBadge } from '../components/Badges';
import { fmtDateTime, timeAgo, shortHash, copyText, cx } from '../lib/utils';

export default function DocumentDetail() {
  const { id } = useParams();
  const { documents, transactions, audit, shares, cases, api, refresh, pushToast, currentUser } = useStore();
  const nav = useNavigate();
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'audit' | 'versions' | 'access'>('audit');

  const doc = documents.find((d) => d.id === id);
  const tx = useMemo(() => transactions.find((t) => t.tx_id === doc?.tx_id) || transactions.find((t) => t.doc_id === doc?.id), [transactions, doc]);
  const history = useMemo(() => audit.filter((a) => a.resource_id === doc?.id || a.resource === doc?.filename).sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)), [audit, doc]);
  const docShares = useMemo(() => shares.filter((s) => s.doc_id === doc?.id), [shares, doc]);
  const caseRec = cases.find((c) => c.case_number === doc?.case_number);

  if (!doc) return <div className="v-card p-8 text-center"><p className="font-semibold">Document not found</p><button onClick={() => nav('/documents')} className="v-btn-secondary mt-3">Back to Documents</button></div>;

  const doCopy = async () => { await copyText(doc.sha256); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const doDownload = async () => {
    try {
      await api('audit', 'POST', { row: { actor: currentUser?.name || 'Inspector Ananya Sharma', action: 'Download', resource: doc.filename, resource_id: doc.id, result: 'Success', reference: doc.tx_id, details: 'Authorised download. Watermarked copy issued and logged.', timestamp: new Date().toISOString() } });
      await refresh(true);
      pushToast({ title: 'Download logged', message: `${doc.filename} — watermarked copy issued.`, kind: 'info' });
    } catch {
      // The demo backend is intentionally best-effort for UI actions.
    }
  };

  const versions = [
    { v: doc.version, date: doc.updated_at, note: 'Current sealed version', current: true },
    ...(doc.version !== 'v1.0' ? [{ v: 'v1.0', date: new Date(new Date(doc.updated_at).getTime() - 6 * 864e5).toISOString(), note: 'Initial ingest — retained immutably', current: false }] : []),
  ];

  return (
    <div className="space-y-5">
      <button onClick={() => nav('/documents')} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#3c4f68] hover:text-[#0a2342]"><ArrowLeft size={14} /> Back to Documents</button>

      <section className="v-card overflow-hidden">
        <div className="flex flex-col gap-3.5 bg-[#0a2342] px-5 py-5 text-white sm:px-6 lg:flex-row lg:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10"><FileText size={19} strokeWidth={1.8} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[18px] font-semibold tracking-tight sm:text-[20px]">{doc.filename}</h1>
              <IntegrityBadge status={doc.integrity_status} />
            </div>
            <p className="mono mt-1 text-[11.5px] text-blue-200/80">{doc.id} · {doc.version} · {doc.file_type} · {doc.size_text}</p>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-blue-100/75">{doc.description}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button onClick={() => nav(`/verify?doc=${doc.id}`)} className="inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-[13px] font-semibold text-[#0a2342] transition hover:bg-[#e8eef5]"><ShieldCheck size={14} /> Verify integrity</button>
            <button onClick={doDownload} className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-white/10"><Download size={14} /> Download</button>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1fr_330px]">
          <div className="min-w-0 space-y-5 px-5 py-5">
            {/* Metadata */}
            <div>
              <h3 className="v-meta-label">Metadata</h3>
              <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-0 sm:grid-cols-2">
                {[
                  ['Case', doc.case_number], ['Reference', doc.ref_number], ['Document type', doc.file_type],
                  ['Classification', doc.classification], ['Uploader', doc.uploader], ['Updated', fmtDateTime(doc.updated_at)],
                  ['Tags', doc.tags || '—'], ['Size', doc.size_text],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3 border-b border-[#f0f3f7] py-2">
                    <dt className="v-meta-label shrink-0">{k}</dt>
                    <dd className="truncate text-right text-[12.5px] font-medium text-[#1c2c46]" title={String(v)}>
                      {k === 'Classification' ? <ClassificationBadge level={String(v)} /> : k === 'Case' ? <button className="font-semibold text-[#2456c6] hover:underline" onClick={() => caseRec && nav(`/cases/${caseRec.id}`)}>{String(v)}</button> : String(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Preview */}
            <div>
              <h3 className="v-meta-label">Document preview</h3>
              <div className="mt-2 overflow-hidden rounded-lg border border-[#e1e7ef]">
                <div className="flex items-center gap-1.5 border-b border-[#e8edf3] bg-[#f8fafc] px-3.5 py-2">
                  <span className="h-2 w-2 rounded-full bg-[#d3dae4]" /><span className="h-2 w-2 rounded-full bg-[#d3dae4]" /><span className="h-2 w-2 rounded-full bg-[#d3dae4]" />
                  <span className="mono ml-2 truncate text-[11px] text-[#68778e]">{doc.filename} — sealed preview (prototype)</span>
                </div>
                <div className="bg-white px-5 py-6">
                  <p className="mono text-center text-[10.5px] uppercase tracking-[0.08em] text-[#8a96ad]">{doc.case_number}</p>
                  <p className="mt-1 text-center text-[15px] font-semibold text-[#0a2342]">{doc.filename.replace(/_/g, ' ').replace(/\.\w+$/, '')}</p>
                  <p className="mx-auto mt-1 max-w-sm text-center text-[11.5px] text-[#68778e]">Ref {doc.ref_number} · {doc.classification} · Sealed {fmtDateTime(doc.updated_at)}</p>
                  <div className="mx-auto mt-4 max-w-md space-y-1.5">
                    {[92, 100, 97, 88, 100, 70].map((w, i) => (
                      <div key={i} className="h-1.5 rounded bg-[#edf1f6]" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                  <div className="mx-auto mt-4 flex max-w-md items-center justify-between rounded-md border border-dashed border-[#c6cfdb] px-3 py-1.5">
                    <span className="mono text-[10px] text-[#8a96ad]">DIGITALLY SEALED · {doc.tx_id}</span>
                    <ShieldCheck size={14} className="text-[#359268]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div>
              <div className="flex gap-0.5 border-b border-[#e8edf3]" role="tablist">
                {(['audit', 'versions', 'access'] as const).map((t) => (
                  <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx('px-3 py-2.5 text-[13px] font-semibold capitalize', tab === t ? 'border-b-2 border-[#0a2342] text-[#0a2342]' : 'text-[#7d8b9f] hover:text-[#33475f]')}>{t === 'audit' ? 'Audit history' : t}</button>
                ))}
              </div>
              <div className="pt-3">
                {tab === 'audit' && (
                  <div className="space-y-1.5">
                    {history.length === 0 && <p className="py-4 text-center text-[12.5px] text-[#68778e]">No audit events for this document yet.</p>}
                    {history.map((a) => (
                      <div key={a.id} className="v-panel flex items-start gap-2.5 px-3.5 py-2.5">
                        <History size={14} className="mt-0.5 shrink-0 text-[#0a2342]" strokeWidth={1.8} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px]"><span className="font-semibold text-[#1c2c46]">{a.action}</span> <span className="text-[#68778e]">by {a.actor}</span></p>
                          <p className="text-[12px] leading-relaxed text-[#5d6d84]">{a.details}</p>
                          <p className="mono mt-0.5 text-[10.5px] text-[#8a96ad]">{fmtDateTime(a.timestamp)} · {a.reference}</p>
                        </div>
                        <StatusBadge status={a.result} />
                      </div>
                    ))}
                  </div>
                )}
                {tab === 'versions' && (
                  <div className="space-y-1.5">
                    {versions.map((v) => (
                      <div key={v.v} className="v-panel flex items-center gap-3 px-3.5 py-2.5">
                        <span className="mono rounded bg-[#eef2f7] px-1.5 py-0.5 text-[11px] font-semibold text-[#0a2342]">{v.v}</span>
                        <span className="min-w-0 flex-1"><span className="block text-[12.5px] font-medium text-[#1c2c46]">{v.note}</span><span className="mono block text-[10.5px] text-[#8a96ad]">{fmtDateTime(v.date)}</span></span>
                        {v.current && <span className="v-pill v-pill-ok">Current</span>}
                      </div>
                    ))}
                  </div>
                )}
                {tab === 'access' && (
                  <div className="space-y-1.5">
                    {docShares.length === 0 && <p className="py-4 text-center text-[12.5px] text-[#68778e]">No shares for this document.</p>}
                    {docShares.map((s: ShareItem) => (
                      <div key={s.id} className="v-panel flex items-center gap-3 px-3.5 py-2.5">
                        <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-semibold text-[#1c2c46]">{s.recipient}</span><span className="block text-[11px] text-[#68778e]">{s.permission} · expires {fmtDateTime(s.expires_at)}</span></span>
                        <StatusBadge status={s.status} />
                      </div>
                    ))}
                    <button onClick={() => nav('/sharing')} className="v-btn-secondary mt-1"><Share2 size={14} /> Manage sharing</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Security panel — quiet rail, not a stack of cards */}
          <aside className="space-y-4 border-t border-[#e8edf3] bg-[#f8fafc] px-5 py-5 lg:border-l lg:border-t-0">
            <div>
              <h3 className="v-meta-label flex items-center gap-1.5"><ShieldCheck size={13} /> Security status</h3>
              <div className="mt-2 flex items-center justify-between rounded-lg border border-[#e1e7ef] bg-white px-3 py-2.5">
                <span className="text-[12.5px] font-medium text-[#3c4f68]">Integrity</span>
                <IntegrityBadge status={doc.integrity_status} />
              </div>
              <div className="mt-2 rounded-lg bg-[#0a2342] px-3 py-2.5">
                <p className="flex items-center justify-between">
                  <span className="mono text-[10px] uppercase tracking-[0.07em] text-blue-200/70">SHA-256</span>
                  <button onClick={doCopy} className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-100/90 hover:text-white"><Copy size={11} /> {copied ? 'Copied' : 'Copy'}</button>
                </p>
                <p className="mono mt-1.5 break-all text-[10.5px] leading-[1.7] text-emerald-100/95">{doc.sha256}</p>
              </div>
              <dl className="mt-2 space-y-0 rounded-lg border border-[#e1e7ef] bg-white px-3 py-1">
                {[
                  ['Ledger transaction', doc.tx_id, true],
                  ['Block', `#${tx?.block_number || '—'}`, false],
                  ['Registered', timeAgo(doc.updated_at), false],
                ].map(([k, v, link]) => (
                  <div key={k as string} className="flex items-baseline justify-between gap-2 border-b border-[#f0f3f7] py-2 last:border-0">
                    <dt className="text-[11.5px] text-[#68778e]">{k}</dt>
                    <dd className="mono text-[11.5px] font-medium text-[#2e4a6b]">{link ? <button onClick={() => tx && nav(`/ledger/${tx.tx_id}`)} className="font-semibold text-[#2456c6] hover:underline">{v}</button> : v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {doc.integrity_status === 'Mismatch' && (
              <div className="rounded-lg border border-[#efc5c1] bg-[#fdf3f2] px-3.5 py-3 text-[12px] leading-relaxed text-[#7a3530]">
                <p className="flex items-center gap-1.5 text-[12.5px] font-semibold"><AlertTriangle size={14} /> Integrity mismatch</p>
                <p className="mt-1">Local copy differs from the ledger record. Do not rely on this file until re-verified.</p>
                <button onClick={() => nav(`/verify?doc=${doc.id}`)} className="v-btn-danger-solid mt-2.5 w-full justify-center">Open verification</button>
              </div>
            )}
            {doc.integrity_status === 'Pending' && (
              <div className="rounded-lg border border-[#eed9ae] bg-[#fdf9ef] px-3.5 py-3 text-[12px] leading-relaxed text-[#6d5a2e]">
                <p className="flex items-center gap-1.5 text-[12.5px] font-semibold"><Clock size={14} /> Anchoring pending</p>
                <p className="mt-1">Queued for consensus. Never treat as anchored until sealed.</p>
                <button onClick={() => nav('/ledger')} className="v-btn-secondary mt-2.5 w-full justify-center">View ledger queue</button>
              </div>
            )}
            <div>
              <p className="v-meta-label flex items-center gap-1.5"><Link2 size={12} /> Linked records</p>
              <p className="mt-1.5 text-[12.5px]"><button onClick={() => caseRec && nav(`/cases/${caseRec.id}`)} className="font-semibold text-[#2456c6] hover:underline">{doc.case_number}</button></p>
              <p className="mono mt-0.5 text-[11px] text-[#68778e]">{shortHash(doc.sha256, 16, 10)}</p>
            </div>
            <p className="border-t border-[#e8edf3] pt-3 text-[11.5px] leading-relaxed text-[#68778e]">{doc.classification} handling applies. Access is role-gated; every open, download and share is audited.</p>
          </aside>
        </div>
      </section>
    </div>
  );
}
