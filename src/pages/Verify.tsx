import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, AlertTriangle, Copy, ArrowRight, CheckCircle2, FileSearch, Fingerprint, GitCompareArrows, Landmark } from 'lucide-react';
import { useStore, type AuditItem, type TransactionItem } from '../store';
import { isSupabaseConfigured } from '../lib/supabase';
import { recordSupabaseAudit } from '../lib/data';
import { sha256File } from '../lib/utils';
import { SectionTitle, IntegrityBadge } from '../components/Badges';
import { fmtDateTime, copyText, cx, shortHash } from '../lib/utils';

const STEPS = [
  { label: 'Preparing Document', sub: 'Load registered record' },
  { label: 'Computing SHA-256', sub: 'Recompute fingerprint' },
  { label: 'Comparing Fingerprints', sub: 'Match both hashes' },
  { label: 'Checking Permissioned Ledger', sub: 'Confirm consensus' },
] as const;

const STEP_ICONS = [FileSearch, Fingerprint, GitCompareArrows, Landmark];

export default function Verify() {
  const { documents, transactions, audit, api, refresh, pushToast, currentUser } = useStore();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [docId, setDocId] = useState(() => params.get('doc') || 'DOC-20260441');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formError, setFormError] = useState('');
  const [tamper, setTamper] = useState(false);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(-1);
  const [liveHash, setLiveHash] = useState('');
  const [result, setResult] = useState<null | { ok: boolean; registered: string; current: string; tx: TransactionItem | undefined; verifiedAt: string; auditId?: number }>(null);
  const [copied, setCopied] = useState<'reg' | 'cur' | null>(null);

  const doc = useMemo(() => documents.find((d) => d.id === docId), [documents, docId]);
  const tx = useMemo(() => transactions.find((t) => t.tx_id === doc?.tx_id) || transactions.find((t) => t.doc_id === doc?.id), [transactions, doc]);

  const run = async () => {
    if (!doc) return;
    if (isSupabaseConfigured && !selectedFile) {
      setFormError('Select the evidence file to calculate its current SHA-256 hash.');
      return;
    }
    setRunning(true); setResult(null); setLiveHash(''); setStep(0);
    setFormError('');
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const registered = tx?.hash || doc.sha256;
    const isMismatchDoc = doc.integrity_status === 'Mismatch';
    let current = selectedFile ? await sha256File(selectedFile) : doc.sha256;
    if (!selectedFile && (isMismatchDoc || tamper)) {
      current = flipHash(doc.sha256);
    }
    await wait(750); setStep(1);
    for (let i = 0; i < current.length; i += 4) {
      setLiveHash(current.slice(0, i + 4));
      await wait(45);
    }
    setStep(2);
    await wait(950);
    setStep(3);
    await wait(1050);
    const ok = registered.toLowerCase() === current.toLowerCase();
    const verifiedAt = new Date().toISOString();
    const actor = currentUser?.name || 'Inspector Ananya Sharma';
    let auditId: number | undefined;
    try {
      const res = isSupabaseConfigured
        ? null
        : await api('audit', 'POST', { row: { actor, action: 'Verification', resource: doc.filename, resource_id: doc.id, result: ok ? 'Success' : 'Mismatch', reference: doc.tx_id, details: ok ? `Integrity verification completed. Current hash matches ledger record${tx ? ` at block #${tx.block_number}` : ''}.` : 'INTEGRITY MISMATCH: current hash differs from registered ledger record. Possible tampering or unsanctioned edit.', timestamp: verifiedAt } });
      if (isSupabaseConfigured) {
        await recordSupabaseAudit({
          action: 'DOCUMENT_VERIFIED',
          resource: doc.filename,
          resourceId: doc.id,
          result: ok ? 'Success' : 'Mismatch',
          reference: doc.tx_id,
          details: ok ? 'Current file hash matches the registered document hash.' : 'Current file hash does not match the registered document hash.',
          user: currentUser,
        });
      }
      auditId = Array.isArray(res) ? (res[0] as { id?: number } | undefined)?.id : undefined;
      if (!ok) {
        if (!isSupabaseConfigured) {
          await api('documents', 'PUT', { idCol: 'id', idVal: doc.id, patch: { integrity_status: 'Mismatch' } }).catch(() => null);
          await api('notifications', 'POST', { row: { title: 'Integrity mismatch detected', message: `${doc.filename} does not match its ledger record.`, type: 'alert', time: verifiedAt, read: false, link: 'verify' } });
        }
      } else if (doc.integrity_status !== 'Verified') {
        if (!isSupabaseConfigured) await api('documents', 'PUT', { idCol: 'id', idVal: doc.id, patch: { integrity_status: 'Verified' } }).catch(() => null);
      }
      await refresh(true);
    } catch {
      // verification log may fail in the mock backend without affecting the UI flow
    }
    setResult({ ok, registered, current, tx, verifiedAt, auditId });
    setStep(4);
    setRunning(false);
    pushToast({ title: ok ? 'Integrity verified' : 'Integrity mismatch', message: `${doc.filename} · ${doc.tx_id}`, kind: ok ? 'success' : 'alert' });
  };

  const mismatchEvent = useMemo(() => {
    if (!result || result.ok || !doc) return null;
    const found = audit.find((a) => a.resource_id === doc.id && (a.result === 'Mismatch' || a.action === 'Verification'));
    if (found) return found;
    return result.auditId ? ({ id: result.auditId } satisfies Pick<AuditItem, 'id'>) : null;
  }, [result, audit, doc]);

  return (
    <div className="mx-auto max-w-[840px] space-y-5">
      <SectionTitle kicker="Integrity" title="Verify Document Integrity" sub="Recompute the SHA-256 fingerprint, compare it against the registered ledger record, and confirm consensus — without moving the source file." />

      {/* Control strip — one composed surface */}
      <div className="v-card px-5 py-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_200px] sm:items-end">
          <div>
            <label className="mb-1 block" htmlFor="vdoc">Registered document</label>
            <select id="vdoc" value={docId} onChange={(e) => { setDocId(e.target.value); setResult(null); setStep(-1); setLiveHash(''); }} className="v-input" disabled={running}>
              {documents.map((d) => <option key={d.id} value={d.id}>{d.filename} · {d.id} · {d.tx_id}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block" htmlFor="verification-file">Current evidence file</label>
            <input id="verification-file" type="file" accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} disabled={running} className="v-input file:mr-2 file:rounded file:border-0 file:bg-[#eef2f7] file:px-2 file:py-1 file:text-[11px]" />
          </div>
          <button onClick={run} disabled={running || !doc} className="v-btn-primary w-full">
            {running ? <span className="v-spin h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white" /> : <ShieldCheck size={15} />} {running ? 'Verifying…' : 'Run verification'}
          </button>
        </div>
        {formError && <p className="mt-3 rounded-lg border border-[#efc5c1] bg-[#fdf1f0] px-3 py-2 text-[12.5px] font-medium text-[#93312a]">{formError}</p>}
        {doc && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[#e8edf3] pt-3">
            <IntegrityBadge status={doc.integrity_status} />
            <span className="mono text-[11.5px] text-[#68778e]">{doc.id} · {doc.tx_id} · {doc.case_number}</span>
            {!isSupabaseConfigured && doc.id !== 'DOC-20260448' && (
              <label className="ml-auto flex cursor-pointer items-center gap-2 text-[12.5px] font-medium text-[#3c4f68]">
                <input type="checkbox" checked={tamper} onChange={(e) => setTamper(e.target.checked)} disabled={running} className="h-3.5 w-3.5 rounded border-[#cfd7e3] accent-[#0a2342]" />
                Simulate tampered copy
              </label>
            )}
          </div>
        )}
      </div>

      {/* Sequence — quiet stepper */}
      {(step >= 0) && (
        <div className="v-card v-fade-up px-5 py-4" aria-live="polite">
          <ol className="flex items-center" aria-label="Verification progress">
            {STEPS.map((s, i) => {
              const done = step > i;
              const active = step === i && running;
              const Icon = STEP_ICONS[i];
              return (
                <li key={s.label} className="flex min-w-0 flex-1 items-center last:flex-none">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={cx(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition',
                      done ? 'bg-[#0a2342] text-white' : active ? 'border-2 border-[#0a2342] bg-white text-[#0a2342]' : 'border border-[#cfd7e3] bg-white text-[#8a96ad]',
                    )}>
                      {done ? <CheckCircle2 size={15} /> : <Icon size={15} strokeWidth={1.9} />}
                    </span>
                    <span className="hidden min-w-0 sm:block">
                      <span className={cx('block truncate text-[12.5px] font-semibold leading-tight', done || active ? 'text-[#0a2342]' : 'text-[#8a96ad]')}>{s.label}</span>
                      <span className="block truncate text-[11px] text-[#8a96ad]">{s.sub}</span>
                    </span>
                  </div>
                  {i < STEPS.length - 1 && <span className={cx('mx-2 h-px min-w-4 flex-1 sm:mx-3', done ? 'bg-[#0a2342]' : 'bg-[#dde3ec]')} aria-hidden />}
                </li>
              );
            })}
          </ol>

          {/* live computing readout — single dark strip */}
          {running && step >= 1 && step <= 2 && (
            <div className="mt-4 rounded-lg bg-[#0a2342] px-4 py-3">
              <p className="mono text-[10.5px] uppercase tracking-[0.07em] text-blue-200/70">Computing SHA-256 · local — source never transmitted</p>
              <p className="mono mt-1.5 break-all text-[11.5px] leading-[1.7] text-emerald-100/95">{liveHash}<span className="v-pulse-dot">▌</span></p>
            </div>
          )}

          {/* ——— The comparison: extremely clear, visually convincing ——— */}
          {!running && result && (
            <div className="mt-4">
              <div className={cx(
                'flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-[13px] font-semibold',
                result.ok ? 'bg-[#f3faf5] text-[#2c6b45]' : 'bg-[#fdf3f2] text-[#93312a]',
              )} role={result.ok ? 'status' : 'alert'}>
                {result.ok
                  ? <><CheckCircle2 size={16} /> Fingerprints match — 64 of 64 bytes identical</>
                  : <><AlertTriangle size={16} /> Fingerprints differ — see highlighted bytes below</>}
              </div>
              <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                <HashCard
                  title="Registered hash"
                  caption={`Ledger record · ${doc?.tx_id}${result.tx ? ` · Block #${result.tx.block_number}` : ''}`}
                  value={result.registered}
                  tone={result.ok ? 'match' : 'neutral'}
                  copied={copied === 'reg'}
                  onCopy={async () => { await copyText(result.registered); setCopied('reg'); setTimeout(() => setCopied(null), 1800); }}
                />
                <HashCard
                  title="Current hash"
                  caption="Recomputed just now from local copy"
                  value={result.current}
                  tone={result.ok ? 'match' : 'differ'}
                  copied={copied === 'cur'}
                  onCopy={async () => { await copyText(result.current); setCopied('cur'); setTimeout(() => setCopied(null), 1800); }}
                />
              </div>
              {!result.ok && <DiffBar a={result.registered} b={result.current} />}
            </div>
          )}
        </div>
      )}

      {/* Result — trustworthy premium (verified) / clear but calm (mismatch) */}
      {!running && result && (
        result.ok ? (
          <div className="v-card v-fade-up overflow-hidden" role="status">
            <div className="flex items-center gap-4 border-b border-[#e1e7ef] bg-[#f3faf5] px-6 py-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0a2342]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 3l7 2.6v5.5c0 4.5-3 7.7-7 9.1-4-1.4-7-4.6-7-9.1V5.6L12 3z" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" />
                  <path d="M9 12.2l2.2 2.2 4-4.4" stroke="#7ee2b0" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="v-draw-check" />
                </svg>
              </span>
              <div className="min-w-0">
                <h3 className="text-[16px] font-semibold text-[#1c2c46]">Integrity Verified</h3>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#3c4f68]">Current hash matches the registered ledger record. Bit-for-bit identical to the sealed version.</p>
              </div>
              <span className="v-pill v-pill-ok ml-auto hidden shrink-0 sm:inline-flex">Verified</span>
            </div>
            <dl className="grid gap-x-6 gap-y-0 px-6 py-2 sm:grid-cols-2">
              {[
                ['Document', `${doc?.filename} · ${doc?.id}`],
                ['Transaction', `${doc?.tx_id}${tx ? ` · Block #${tx.block_number}` : ''}`],
                ['Registered', fmtDateTime(tx?.timestamp || doc?.updated_at || new Date().toISOString())],
                ['Verified', fmtDateTime(result.verifiedAt)],
                ['Verified by', currentUser?.name || 'Inspector Ananya Sharma'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 border-b border-[#f0f3f7] py-2.5 last:border-0 sm:last:border-b">
                  <dt className="v-meta-label shrink-0">{k}</dt>
                  <dd className="mono break-all text-right text-[11.5px] text-[#2e4a6b]">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2 border-t border-[#e8edf3] bg-[#f8fafc] px-6 py-3.5">
              <button onClick={() => nav(`/documents/${doc?.id}`)} className="v-btn-secondary">View document</button>
              <button onClick={() => nav('/audit')} className="v-btn-ghost">View audit event</button>
              <button onClick={() => nav(`/ledger/${doc?.tx_id}`)} className="v-btn-primary ml-auto">Open ledger transaction <ArrowRight size={14} /></button>
            </div>
          </div>
        ) : (
          <div className="v-card v-fade-up overflow-hidden" role="alert">
            <div className="flex items-center gap-4 border-b border-[#efc5c1] bg-[#fdf3f2] px-6 py-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#e0aca7] bg-white text-[#a32e26]">
                <AlertTriangle size={20} strokeWidth={1.9} />
              </span>
              <div className="min-w-0">
                <h3 className="text-[16px] font-semibold text-[#5f1f1a]">Integrity Mismatch</h3>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#7a3530]">This copy does not match the registered record — it may have been altered, replaced or corrupted. Quarantine it and escalate to the assigned officer.</p>
              </div>
              <span className="v-pill v-pill-bad ml-auto hidden shrink-0 sm:inline-flex">Mismatch</span>
            </div>
            <div className="grid gap-2 px-6 py-4">
              <div className="v-panel px-3.5 py-2.5">
                <p className="v-meta-label">Registered hash · ledger record</p>
                <p className="mono mt-1 break-all text-[11px] leading-[1.7] text-[#2e4a6b]">{result.registered}</p>
              </div>
              <div className="rounded-lg border border-[#efc5c1] bg-[#fdf7f6] px-3.5 py-2.5">
                <p className="v-meta-label v-meta-attn">Current hash · differs</p>
                <p className="mono mt-1 break-all text-[11px] leading-[1.7] text-[#5f1f1a]">{result.current}</p>
              </div>
              <p className="mono text-[11px] text-[#68778e]">{doc?.tx_id} · Block #{result.tx?.block_number || '—'} · {shortHash(result.registered, 12, 8)}</p>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-[#e8edf3] bg-[#f8fafc] px-6 py-3.5">
              <button onClick={() => nav('/audit')} className="v-btn-danger-solid">View audit event</button>
              <button onClick={() => nav(`/documents/${doc?.id}`)} className="v-btn-secondary">Open document</button>
            </div>
            {mismatchEvent && <p className="mono border-t border-[#e8edf3] px-6 py-2.5 text-[11px] text-[#8a96ad]">Linked audit event #{mismatchEvent.id || result.auditId} · auto-logged at {fmtDateTime(result.verifiedAt)}</p>}
          </div>
        )
      )}
    </div>
  );
}

function HashCard({ title, caption, value, tone, copied, onCopy }: { title: string; caption: string; value: string; tone: 'match' | 'neutral' | 'differ'; copied: boolean; onCopy: () => void }) {
  return (
    <div className={cx(
      'rounded-lg border px-3.5 py-3',
      tone === 'match' && 'border-[#cfe5d6] bg-[#f7fbf8]',
      tone === 'neutral' && 'border-[#e1e7ef] bg-white',
      tone === 'differ' && 'border-[#efc5c1] bg-[#fdf7f6]',
    )}>
      <div className="flex items-center justify-between gap-2">
        <p className="v-meta-label">{title}</p>
        <button onClick={onCopy} className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-semibold text-[#2456c6] hover:underline" aria-label={`Copy ${title.toLowerCase()}`}>
          <Copy size={11} /> {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className={cx('mono mt-1.5 break-all text-[11px] leading-[1.75]', tone === 'differ' ? 'text-[#5f1f1a]' : 'text-[#2e4a6b]')}>{value}</p>
      <p className="mono mt-1.5 truncate text-[10px] text-[#8a96ad]">{caption}</p>
    </div>
  );
}

function flipHash(h: string) {
  const arr = h.split('');
  const flips: Record<string, string> = { a: 'f', f: 'a', '0': '9', '9': '0', '1': 'e', e: '1' };
  for (let i = 4; i < arr.length; i += 7) {
    const c = arr[i].toLowerCase();
    arr[i] = flips[c] || 'b';
  }
  return arr.join('');
}

function DiffBar({ a, b }: { a: string; b: string }) {
  const cells = a.split('').map((ch, i) => ({ ch, same: ch.toLowerCase() === (b[i] || '').toLowerCase() }));
  const diff = cells.filter((c) => !c.same).length;
  return (
    <div className="v-panel mt-2.5 px-3.5 py-3" aria-label="Byte comparison">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="v-meta-label">Byte-level comparison</span>
        <span className="text-[11.5px] font-semibold text-[#93312a]">{diff} of {cells.length} bytes differ</span>
      </p>
      <div className="mono mt-2 flex flex-wrap gap-[3px]" aria-hidden>
        {cells.map((c, i) => (
          <span key={i} className={cx(
            'flex h-5 w-5 items-center justify-center rounded text-[10px] font-medium',
            c.same ? 'bg-[#eef1f6] text-[#8a96ad]' : 'bg-[#fdf1f0] font-semibold text-[#93312a] ring-1 ring-inset ring-[#e0aca7]',
          )}>{c.ch}</span>
        ))}
      </div>
    </div>
  );
}
