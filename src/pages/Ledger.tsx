import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, ArrowLeft, Clock, XCircle, Link2, ArrowRight, Boxes } from 'lucide-react';
import { useStore } from '../store';
import { StatusBadge, SectionTitle, EmptyState } from '../components/Badges';
import { fmtDateTime, timeAgo, shortHash, cx } from '../lib/utils';

export default function Ledger() {
  const { transactions, blocks, documents, cases, api, refresh, pushToast, currentUser } = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('All');
  const [retrying, setRetrying] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let r = [...transactions].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter((t) => t.tx_id.toLowerCase().includes(s) || t.doc_id.toLowerCase().includes(s) || t.doc_name.toLowerCase().includes(s) || (t.hash || '').toLowerCase().includes(s) || t.case_number.toLowerCase().includes(s));
    }
    if (filter !== 'All') r = r.filter((t) => t.status === filter);
    return r;
  }, [transactions, q, filter]);

  const latest = blocks.length ? [...blocks].sort((a, b) => b.block_number - a.block_number)[0] : null;
  const anchored = transactions.filter((t) => t.status === 'Anchored').length;
  const pending = transactions.filter((t) => t.status === 'Pending');
  const failed = transactions.filter((t) => t.status === 'Failed');
  const chain = useMemo(() => [...blocks].sort((a, b) => a.block_number - b.block_number).slice(-5), [blocks]);

  const retry = async (txId: string) => {
    setRetrying(txId);
    await new Promise((r) => setTimeout(r, 1600));
    const t = transactions.find((x) => x.tx_id === txId);
    try {
      await api('transactions', 'PUT', { idCol: 'tx_id', idVal: txId, patch: { status: 'Anchored', block_number: latest?.block_number || 48291, timestamp: new Date().toISOString() } });
      if (t) {
        await api('documents', 'PUT', { idCol: 'id', idVal: t.doc_id, patch: { integrity_status: 'Verified', tx_id: txId } }).catch(() => null);
        await api('audit', 'POST', { row: { actor: currentUser?.name || 'System', action: 'Ledger Anchor', resource: t.doc_name, resource_id: t.doc_id, result: 'Success', reference: txId, details: 'Retry anchoring succeeded. Consensus reached across 8 MHA zones; transaction sealed.', timestamp: new Date().toISOString() } });
        await api('notifications', 'POST', { row: { title: 'Retry anchoring succeeded', message: `${t.doc_name} sealed as ${txId}.`, type: 'success', time: new Date().toISOString(), read: false, link: 'ledger' } });
      }
      await refresh(true);
      pushToast({ title: 'Anchoring sealed', message: `${txId} is now anchored.`, kind: 'success' });
    } catch {}
    setRetrying(null);
  };

  return (
    <div className="space-y-5">
      <SectionTitle kicker="Infrastructure" title="Permissioned Ledger" sub="Append-only integrity layer for document fingerprints — not a currency, not a trading venue. Every anchor is consensus-validated and traceable to document, case and audit event." />

      {/* Status strip — quiet stat row */}
      <div className="v-card flex flex-col divide-y divide-[#eef1f6] px-5 sm:flex-row sm:items-center sm:divide-x sm:divide-y-0" aria-label="Ledger status">
        <div className="flex flex-1 items-center gap-2.5 py-3.5 sm:pr-5">
          <span className="v-pill v-pill-ok">Synchronized</span>
          <span className="text-[12px] text-[#68778e]">8-zone consensus · 14ms</span>
        </div>
        <div className="flex-1 py-3.5 sm:px-5"><p className="v-meta-label">Latest sealed block</p><p className="mono mt-0.5 text-[19px] font-semibold text-[#0a2342]">#{latest?.block_number || 48291}</p></div>
        <div className="flex-1 py-3.5 sm:px-5"><p className="v-meta-label">Anchored documents</p><p className="mt-0.5 text-[19px] font-bold text-[#101f36]">{anchored}</p></div>
        <div className="flex-1 py-3.5 sm:pl-5"><p className="v-meta-label">Pending / Failed</p><p className="mt-0.5 text-[19px] font-bold text-[#101f36]"><span className="text-[#8a6116]">{pending.length}</span> <span className="font-normal text-[#b6c1d2]">/</span> <span className="text-[#93312a]">{failed.length}</span></p></div>
      </div>

      {/* Block chain visualization */}
      <section className="v-card px-5 py-4" aria-label="Block chain">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-[#1c2c46]"><Boxes size={15} strokeWidth={1.8} /> Connected sealed blocks</h3>
          <span className="mono text-[11px] text-[#68778e]">Each block links to the previous hash · 8-zone consensus</span>
        </div>
        <div className="mt-3.5 overflow-x-auto pb-1">
          <div className="flex min-w-[720px] items-stretch gap-0" role="list">
            {chain.map((b, i) => (
              <div key={b.block_number} className="flex flex-1 items-center" role="listitem">
                <div className="w-full rounded-lg border border-[#d7e0ec] bg-[#f6f9fc] px-3 py-3 text-center">
                  <p className="mono text-[14px] font-semibold text-[#0a2342]">#{b.block_number}</p>
                  <p className="mono mt-0.5 text-[10px] text-[#68778e]">{shortHash(b.hash, 8, 6)}</p>
                  <p className="mt-1 text-[10.5px] text-[#68778e]">{b.tx_count} txns · {timeAgo(b.timestamp)}</p>
                  <span className="v-pill v-pill-ok mt-1.5">Sealed</span>
                </div>
                {i < chain.length - 1 && (
                  <svg width="30" height="24" viewBox="0 0 30 24" className="shrink-0" aria-hidden>
                    <line x1="2" y1="12" x2="28" y2="12" stroke="#8a99ae" strokeWidth="2" className="v-ledger-flow" />
                    <path d="M21 6l7 6-7 6" fill="none" stroke="#8a99ae" strokeWidth="2" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lookup */}
      <div className="v-card flex flex-col gap-2.5 p-3.5 lg:flex-row lg:items-center">
        <label className="relative block flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a96ad]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lookup by transaction ID, document ID, filename or hash…" className="v-input mono pl-9" aria-label="Transaction lookup" />
        </label>
        <div className="flex gap-1.5">
          {['All', 'Anchored', 'Pending', 'Failed'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cx('rounded-full border px-3 py-1.5 text-[12px] font-semibold transition', filter === f ? 'border-[#0a2342] bg-[#0a2342] text-white' : 'border-[#cfd7e3] bg-white text-[#3c4f68] hover:border-[#aeb9cb]')}>{f}</button>
          ))}
        </div>
      </div>

      {/* Pending / failed attention — calm notice rows */}
      {(pending.length > 0 || failed.length > 0) && (
        <div className="grid gap-2.5 lg:grid-cols-2">
          {pending.map((t) => (
            <div key={t.tx_id} className="flex items-center gap-3 rounded-lg border border-[#eed9ae] bg-[#fdf9ef] px-4 py-3">
              <Clock size={16} className="shrink-0 text-[#8a6116]" strokeWidth={1.9} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[#1c2c46]">Anchoring pending — <span className="mono text-[12px]">{t.tx_id}</span></p>
                <p className="mt-0.5 text-[12px] text-[#6d5a2e]">{t.doc_name} · awaiting consensus — not yet anchored.</p>
              </div>
              <button onClick={() => retry(t.tx_id)} disabled={retrying === t.tx_id} className="v-btn-secondary v-btn-sm shrink-0">
                {retrying === t.tx_id ? 'Retrying…' : 'Retry anchoring'}
              </button>
            </div>
          ))}
          {failed.map((t) => (
            <div key={t.tx_id} className="flex items-center gap-3 rounded-lg border border-[#efc5c1] bg-[#fdf3f2] px-4 py-3">
              <XCircle size={16} className="shrink-0 text-[#a32e26]" strokeWidth={1.9} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[#1c2c46]">Anchoring failed — <span className="mono text-[12px]">{t.tx_id}</span></p>
                <p className="mt-0.5 text-[12px] text-[#7a3530]">{t.doc_name} · quorum timeout at zone DL-04.</p>
              </div>
              <button onClick={() => retry(t.tx_id)} disabled={retrying === t.tx_id} className="v-btn-danger-solid v-btn-sm shrink-0">
                {retrying === t.tx_id ? 'Retrying…' : 'Retry anchoring'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Transactions */}
      {filtered.length === 0 ? (
        <EmptyState title="No transactions match" sub="Try a different lookup." />
      ) : (
        <div className="v-table-wrap">
          <div className="overflow-x-auto">
            <table className="v-table w-full min-w-[900px]">
              <thead><tr><th>Transaction</th><th>Document</th><th>Block</th><th>Hash</th><th>Time</th><th>Status</th></tr></thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.tx_id} className="cursor-pointer" onClick={() => nav(`/ledger/${t.tx_id}`)}>
                    <td><span className="mono text-[12.5px] font-semibold text-[#2456c6]">{t.tx_id}</span><span className="block text-[11px] text-[#8a96ad]">{t.actor}</span></td>
                    <td><span className="block text-[13px] font-semibold text-[#1c2c46]">{t.doc_name}</span><span className="mono block text-[10.5px] text-[#8a96ad]">{t.doc_id} · {t.case_number.split('/').slice(-1)}</span></td>
                    <td className="mono text-[12px] text-[#3c4f68]">#{t.block_number}</td>
                    <td className="mono text-[11px] text-[#3c4f68]">{shortHash(t.hash, 10, 8)}</td>
                    <td className="whitespace-nowrap text-[12px] text-[#68778e]">{timeAgo(t.timestamp)}</td>
                    <td><StatusBadge status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function TransactionDetail() {
  const { txId } = useParams();
  const { transactions, documents, cases, audit, blocks } = useStore();
  const nav = useNavigate();
  const t = transactions.find((x) => x.tx_id === txId);
  const doc = documents.find((d) => d.id === t?.doc_id);
  const caseRec = cases.find((c) => c.case_number === t?.case_number);
  const events = audit.filter((a) => a.reference === txId || a.resource_id === t?.doc_id).sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
  const block = blocks.find((b) => b.block_number === t?.block_number);

  if (!t) return <div className="v-card p-8 text-center"><p className="font-semibold">Transaction not found</p><button onClick={() => nav('/ledger')} className="v-btn-secondary mt-3">Back to Ledger</button></div>;

  return (
    <div className="mx-auto max-w-[840px] space-y-5">
      <button onClick={() => nav('/ledger')} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#3c4f68] hover:text-[#0a2342]"><ArrowLeft size={14} /> Back to Ledger</button>
      <section className="v-card overflow-hidden">
        <div className="bg-[#0a2342] px-5 py-5 text-white sm:px-6">
          <p className="mono text-[10.5px] uppercase tracking-[0.07em] text-blue-200/70">Ledger transaction · {t.status}</p>
          <h1 className="mono mt-1 text-[22px] font-semibold tracking-tight">{t.tx_id}</h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <StatusBadge status={t.status} />
            <span className="mono rounded border border-white/20 px-2 py-0.5 text-[11px] text-blue-100/85">Block #{t.block_number}</span>
            <span className="mono rounded border border-white/20 px-2 py-0.5 text-[11px] text-blue-100/85">{fmtDateTime(t.timestamp)}</span>
          </div>
        </div>
        <div className="space-y-2.5 px-5 py-4">
          <div className="v-panel px-3.5 py-3">
            <p className="v-meta-label">Anchored SHA-256</p>
            <p className="mono mt-1 break-all text-[11.5px] leading-[1.7] text-[#2e4a6b]">{t.hash}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <button onClick={() => doc && nav(`/documents/${doc.id}`)} className="v-panel px-3.5 py-3 text-left transition hover:border-[#aeb9cb]">
              <p className="v-meta-label">Document →</p>
              <p className="mt-1 truncate text-[13px] font-semibold text-[#1c2c46]">{t.doc_name}</p><p className="mono text-[10.5px] text-[#68778e]">{t.doc_id}</p>
            </button>
            <button onClick={() => caseRec && nav(`/cases/${caseRec.id}`)} className="v-panel px-3.5 py-3 text-left transition hover:border-[#aeb9cb]">
              <p className="v-meta-label">Case →</p>
              <p className="mono mt-1 truncate text-[12.5px] font-semibold text-[#1c2c46]">{t.case_number}</p><p className="truncate text-[11px] text-[#68778e]">{caseRec?.title?.slice(0, 40) || ''}</p>
            </button>
            <button onClick={() => nav('/audit')} className="v-panel px-3.5 py-3 text-left transition hover:border-[#aeb9cb]">
              <p className="v-meta-label">Audit events →</p>
              <p className="mt-1 text-[13px] font-semibold text-[#1c2c46]">{events.length} linked events</p><p className="truncate text-[11px] text-[#68778e]">Actor: {t.actor}</p>
            </button>
          </div>
          {block && (
            <div className="flex items-center gap-2.5 rounded-lg border border-[#e1e7ef] bg-white px-3.5 py-2.5 text-[12.5px] text-[#3c4f68]">
              <Link2 size={14} className="shrink-0 text-[#0a2342]" strokeWidth={1.8} />
              <span>Sealed in block <span className="mono font-semibold">#{block.block_number}</span> with <span className="font-semibold">{block.tx_count} transactions</span></span>
              <span className="mono ml-auto hidden text-[10.5px] text-[#8a96ad] sm:block">{shortHash(block.hash, 10, 8)}</span>
            </div>
          )}
          <button onClick={() => nav('/audit')} className="v-btn-secondary">View audit events <ArrowRight size={14} /></button>
        </div>
      </section>
    </div>
  );
}
