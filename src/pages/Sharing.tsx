import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Share2, Plus, Trash2, AlertTriangle, X } from 'lucide-react';
import { useStore, type ShareItem } from '../store';
import { StatusBadge, SectionTitle, EmptyState } from '../components/Badges';
import { fmtDateTime, timeAgo } from '../lib/utils';

export default function Sharing() {
  const { shares, documents, users, api, refresh, pushToast, currentUser } = useStore();
  const nav = useNavigate();
  const [showNew, setShowNew] = useState(false);
  const [docId, setDocId] = useState(documents[0]?.id || '');
  const [recipient, setRecipient] = useState('');
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState('View');
  const [expiry, setExpiry] = useState('7 days');
  const [customDays, setCustomDays] = useState('14');
  const [formError, setFormError] = useState('');
  const [revoking, setRevoking] = useState<ShareItem | null>(null);
  const [filter, setFilter] = useState('All');

  const active = shares.filter((s) => s.status !== 'Revoked');
  const filtered = useMemo(() => (filter === 'All' ? shares : shares.filter((s) => s.status === filter)), [shares, filter]);

  const createShare = async () => {
    setFormError('');
    if (!docId) { setFormError('Select a document.'); return; }
    if (!recipient.trim()) { setFormError('Recipient name is required.'); return; }
    if (!email.includes('@')) { setFormError('Enter a valid recipient email.'); return; }
    const doc = documents.find((d) => d.id === docId);
    const days = expiry === '24 hours' ? 1 : expiry === '7 days' ? 7 : Math.max(1, parseInt(customDays) || 14);
    const now = new Date();
    const exp = new Date(now.getTime() + days * 864e5);
    try {
      const res = await api('shares', 'POST', {
        row: {
          doc_id: docId, doc_name: doc?.filename || docId,
          recipient: recipient.trim(), recipient_detail: `${email.trim()} · ${permission}`,
          permission, created_by: currentUser?.name || 'Inspector Ananya Sharma',
          created_at: now.toISOString(), expires_at: exp.toISOString(),
          expiry_label: expiry === 'Custom' ? `Custom (${days}d)` : expiry, status: 'Active',
        },
      });
      const createdShare = Array.isArray(res) ? (res[0] as { id?: number } | undefined) : undefined;
      await api('audit', 'POST', { row: { actor: currentUser?.name || 'Inspector Ananya Sharma', action: 'Share', resource: doc?.filename || docId, resource_id: docId, result: 'Success', reference: createdShare?.id ? `SHR-${createdShare.id}` : 'SHR-NEW', details: `${permission} access granted to ${recipient.trim()}, ${expiry === 'Custom' ? `${days}-day` : expiry} expiry.`, timestamp: now.toISOString() } });
      await refresh(true);
      setShowNew(false); setRecipient(''); setEmail('');
      pushToast({ title: 'Access granted', message: `${doc?.filename} shared with ${recipient.trim()} (${permission}).`, kind: 'success' });
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : 'Failed to create share.');
    }
  };

  const confirmRevoke = async () => {
    if (!revoking) return;
    try {
      await api('shares', 'PUT', { idCol: 'id', idVal: revoking.id, patch: { status: 'Revoked' } });
      await api('audit', 'POST', { row: { actor: currentUser?.name || 'Inspector Ananya Sharma', action: 'Revoke', resource: revoking.doc_name, resource_id: revoking.doc_id, result: 'Success', reference: `SHR-${revoking.id}`, details: `Share revoked before expiry. Recipient ${revoking.recipient} access terminated immediately.`, timestamp: new Date().toISOString() } });
      await refresh(true);
      pushToast({ title: 'Access revoked', message: `${revoking.doc_name} — ${revoking.recipient}. Audit event created.`, kind: 'warning' });
    } catch {
      /* keep the revoke action non-blocking for the UI */
    }
    setRevoking(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionTitle kicker="Access" title="Sharing & Access Management" sub="Grant View or Download access to authorised recipients with expiry. Revocation is immediate and always audited." />
        <button onClick={() => setShowNew(true)} className="v-btn-primary"><Plus size={14} /> New share</button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ['Active shares', String(active.filter((s) => s.status === 'Active').length), 'Active'],
          ['Expiring soon', String(active.filter((s) => s.status === 'Expiring Soon').length), 'Expiring Soon'],
          ['Revoked (logged)', String(shares.filter((s) => s.status === 'Revoked').length), 'Revoked'],
        ].map(([k, v, st]) => (
          <div key={k} className="v-card flex items-baseline justify-between px-4 py-3.5"><div><p className="v-meta-label">{k}</p><p className="mt-0.5 text-[24px] font-bold leading-none text-[#101f36]">{v}</p></div><StatusBadge status={st} /></div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {['All', 'Active', 'Expiring Soon', 'Revoked'].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${filter === f ? 'border-[#0a2342] bg-[#0a2342] text-white' : 'border-[#cfd7e3] bg-white text-[#3c4f68] hover:border-[#aeb9cb]'}`}>{f}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No shares in this view" sub="Create a share to grant controlled access." />
      ) : (
        <div className="v-table-wrap">
          <div className="overflow-x-auto">
            <table className="v-table w-full min-w-[860px]">
              <thead><tr><th>Document</th><th>Recipient</th><th>Permission</th><th>Created by</th><th>Expires</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td><button className="text-[13px] font-semibold text-[#2456c6] hover:underline" onClick={() => nav(`/documents/${s.doc_id}`)}>{s.doc_name}</button><span className="mono block text-[10.5px] text-[#8a96ad]">{s.doc_id}</span></td>
                    <td><span className="block text-[12.5px] font-medium text-[#1c2c46]">{s.recipient}</span><span className="block text-[11px] text-[#68778e]">{s.recipient_detail}</span></td>
                    <td><span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${s.permission === 'Download' ? 'bg-[#eef3fa] text-[#2c4a72]' : 'bg-[#f1f4f8] text-[#55677f]'}`}>{s.permission}</span></td>
                    <td className="text-[12.5px]">{s.created_by}<span className="mono block text-[10.5px] text-[#8a96ad]">{timeAgo(s.created_at)}</span></td>
                    <td className="whitespace-nowrap text-[12px] text-[#3c4f68]">{fmtDateTime(s.expires_at)}<span className="block text-[11px] text-[#68778e]">{s.expiry_label}</span></td>
                    <td><StatusBadge status={s.status} /></td>
                    <td>{s.status !== 'Revoked' && <button onClick={() => setRevoking(s)} className="v-btn-danger v-btn-sm" aria-label={`Revoke ${s.doc_name}`}><Trash2 size={12} /> Revoke</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New share modal */}
      {showNew && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" role="dialog" aria-label="New share">
          <div className="absolute inset-0 bg-[#0a2342]/40" onClick={() => setShowNew(false)} />
          <div className="v-card relative w-full max-w-[520px] v-fade-up p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-[#1c2c46]"><Share2 size={16} /> Grant controlled access</h3>
              <button onClick={() => setShowNew(false)} className="rounded-lg p-1.5 text-[#68778e] hover:bg-[#eef1f6]" aria-label="Close"><X size={16} /></button>
            </div>
            <div className="mt-4 space-y-3">
              <div><label className="mb-1 block">Document</label>
                <select value={docId} onChange={(e) => setDocId(e.target.value)} className="v-input">{documents.map((d) => <option key={d.id} value={d.id}>{d.filename} · {d.classification}</option>)}</select></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="mb-1 block">Recipient (name / office)</label>
                  <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="e.g. Public Prosecutor Office" className="v-input" /></div>
                <div><label className="mb-1 block">Recipient email</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@dept.gov.in" className="v-input" /></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="mb-1 block">Permission</label>
                  <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Permission">
                    {['View', 'Download'].map((p) => (
                      <button key={p} type="button" role="radio" aria-checked={permission === p} onClick={() => setPermission(p)} className={`rounded-lg border px-3 py-2 text-[12.5px] font-semibold transition ${permission === p ? 'border-[#0a2342] bg-[#0a2342] text-white' : 'border-[#cfd7e3] bg-white text-[#3c4f68] hover:border-[#aeb9cb]'}`}>{p}</button>
                    ))}
                  </div></div>
                <div><label className="mb-1 block">Expiry</label>
                  <select value={expiry} onChange={(e) => setExpiry(e.target.value)} className="v-input">{['24 hours', '7 days', 'Custom'].map((o) => <option key={o}>{o}</option>)}</select></div>
              </div>
              {expiry === 'Custom' && (
                <div><label className="mb-1 block">Custom duration (days)</label>
                  <input value={customDays} onChange={(e) => setCustomDays(e.target.value)} inputMode="numeric" className="v-input" /></div>
              )}
              <div><label className="mb-1 block">Authorised by</label>
                <select className="v-input" defaultValue={users[0]?.name}>{users.map((u) => <option key={u.id}>{u.name} — {u.role}</option>)}</select></div>
              {formError && <p className="flex items-center gap-2 rounded-lg border border-[#efc5c1] bg-[#fdf1f0] px-3 py-2 text-[12.5px] font-medium text-[#93312a]"><AlertTriangle size={14} />{formError}</p>}
              <div className="flex gap-2 border-t border-[#e8edf3] pt-3.5">
                <button onClick={createShare} className="v-btn-primary flex-1 justify-center">Grant access</button>
                <button onClick={() => setShowNew(false)} className="v-btn-ghost">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revoke confirm */}
      {revoking && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" role="alertdialog" aria-label="Confirm revocation">
          <div className="absolute inset-0 bg-[#0a2342]/40" onClick={() => setRevoking(null)} />
          <div className="v-card relative w-full max-w-[420px] v-fade-up p-6 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-[#e0aca7] bg-[#fdf3f2] text-[#a32e26]"><AlertTriangle size={20} strokeWidth={1.9} /></span>
            <h3 className="mt-2.5 text-[15px] font-semibold text-[#1c2c46]">Revoke access?</h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#5d6d84]"><span className="font-semibold text-[#1c2c46]">{revoking.recipient}</span> will immediately lose <span className="font-semibold">{revoking.permission}</span> access to <span className="font-semibold text-[#1c2c46]">{revoking.doc_name}</span>. An audit event will be created.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setRevoking(null)} className="v-btn-secondary flex-1 justify-center">Keep access</button>
              <button onClick={confirmRevoke} className="v-btn-danger-solid flex-1 justify-center">Revoke access</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
