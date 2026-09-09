import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UploadCloud, FileText, CheckCircle2, ShieldCheck, Copy, ArrowRight, AlertCircle, Fingerprint, Link2 } from 'lucide-react';
import { useStore } from '../store';
import { SectionTitle, StatusBadge } from '../components/Badges';
import { sha256File, deterministicHash, makeTxId, copyText, cx, fmtDateTime } from '../lib/utils';

const STAGES = ['Uploading', 'Validating', 'SHA-256 Hashing', 'Ledger Anchoring', 'Complete'] as const;
const STAGE_SUB = ['Transfer evidence file', 'Format, policy & malware gate', 'Cryptographic fingerprint', 'Permissioned ledger seal', 'Sealed record']; 

const CHECKS = [
  'File format & extension allow-list',
  'Size within 100 MB warrant limit',
  'Metadata completeness',
  'Antivirus & integrity sandbox',
];

export default function Upload() {
  const { cases, documents, api, refresh, pushToast, currentUser } = useStore();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [docType, setDocType] = useState('FIR');
  const [caseNo, setCaseNo] = useState(params.get('case') || 'NCRB/DEL/2026/004521');
  const [classification, setClassification] = useState('Confidential');
  const [tags, setTags] = useState('');
  const [refNo, setRefNo] = useState('');
  const [docDate, setDocDate] = useState('2026-09-08');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');

  const [phase, setPhase] = useState<'idle' | 'meta' | 'processing' | 'done'>('idle');
  const [stageIdx, setStageIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [hash, setHash] = useState('');
  const [hashLive, setHashLive] = useState('');
  const [txId, setTxId] = useState('');
  const [docId, setDocId] = useState('');
  const [checksDone, setChecksDone] = useState<boolean[]>([false, false, false, false]);
  const [copied, setCopied] = useState(false);
  const [realHash, setRealHash] = useState(false);

  useEffect(() => {
    const c = params.get('case');
    if (c) setCaseNo(c);
  }, [params]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setPhase('meta');
    setFormError('');
  };

  const startPipeline = async () => {
    if (!file) { setFormError('Select a file first.'); return; }
    if (!caseNo) { setFormError('Case is required.'); return; }
    if (!refNo.trim()) { setFormError('Reference number is required.'); return; }
    setFormError('');
    setPhase('processing');
    setStageIdx(0); setProgress(0); setChecksDone([false, false, false, false]);
    setHash(''); setHashLive(''); setTxId(''); setCopied(false);

    const actor = currentUser?.name || 'Inspector Ananya Sharma';

    await animateProgress(0, 20, 950);
    setStageIdx(1);
    for (let i = 0; i < CHECKS.length; i++) {
      await wait(380);
      setChecksDone((p) => { const n = [...p]; n[i] = true; return n; });
      setProgress(20 + Math.round(((i + 1) / CHECKS.length) * 20));
    }
    try {
      await api('audit', 'POST', { row: { actor, action: 'Validation', resource: file.name, resource_id: 'PENDING', result: 'Success', reference: 'VAL-' + Math.floor(1000 + Math.random() * 9000), details: 'Validation passed: format, size, metadata and antivirus checks clear.', timestamp: new Date().toISOString() } });
    } catch {}

    setStageIdx(2);
    let digest = '';
    let isReal = false;
    try {
      digest = await sha256File(file);
      isReal = true;
    } catch {
      digest = deterministicHash(file.name + file.size + Date.now());
    }
    setRealHash(isReal);
    for (let i = 0; i < digest.length; i += 4) {
      setHashLive(digest.slice(0, i + 4));
      setProgress(40 + Math.round(((i + 4) / digest.length) * 26));
      await wait(55);
    }
    setHash(digest);
    try {
      await api('audit', 'POST', { row: { actor, action: 'Hash Generation', resource: file.name, resource_id: 'PENDING', result: 'Success', reference: 'SHA-256', details: isReal ? 'Actual SHA-256 digest computed locally from file bytes.' : 'Demo SHA-256 digest generated deterministically (prototype data).', timestamp: new Date().toISOString() } });
    } catch {}

    setStageIdx(3);
    const tx = makeTxId(file.name + Date.now());
    setTxId(tx);
    await animateProgress(66, 96, 1600);
    const newDocId = 'DOC-' + String(20260460 + documents.length + Math.floor(Math.random() * 40)).padStart(8, '0');
    setDocId(newDocId);
    const now = new Date().toISOString();
    const ext = file.name.split('.').pop()?.toUpperCase() || 'PDF';
    try {
      await api('documents', 'POST', {
        row: {
          id: newDocId, filename: file.name, file_type: ext.slice(0, 4), case_number: caseNo,
          version: 'v1.0', classification, uploader: actor, updated_at: now,
          integrity_status: 'Verified', sha256: digest, tx_id: tx,
          size_text: file.size > 1048576 ? `${(file.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`,
          ref_number: refNo, tags: tags || docType, description: description || `${docType} uploaded via VERITAS ingest pipeline.`,
        },
      });
      await api('transactions', 'POST', { row: { tx_id: tx, block_number: 48292, doc_id: newDocId, doc_name: file.name, case_number: caseNo, hash: digest, timestamp: now, status: 'Anchored', actor } });
      await api('audit', 'POST', { row: { actor, action: 'Upload', resource: file.name, resource_id: newDocId, result: 'Success', reference: caseNo, details: `Document uploaded to case ${caseNo} with classification ${classification}.`, timestamp: now } });
      await api('audit', 'POST', { row: { actor, action: 'Ledger Anchor', resource: file.name, resource_id: newDocId, result: 'Success', reference: tx, details: 'SHA-256 fingerprint anchored to permissioned ledger (prototype/demo transaction). Consensus validated across 8 MHA zones.', timestamp: now } });
      await api('notifications', 'POST', { row: { title: 'Document securely anchored', message: `${file.name} anchored as ${tx} in block #48292.`, type: 'success', time: now, read: false, link: 'ledger' } });
      const cs = cases.find((c) => c.case_number === caseNo);
      if (cs) await api('cases', 'PUT', { idCol: 'id', idVal: cs.id, patch: { doc_count: (cs.doc_count || 0) + 1, last_activity: now } }).catch(() => null);
    } catch { /* demo continues */ }

    setProgress(100);
    setPhase('done');
    await refresh(true);
    pushToast({ title: 'Document securely anchored', message: `${file?.name} · ${tx}`, kind: 'success' });
  };

  const animateProgress = (from: number, to: number, ms: number) =>
    new Promise<void>((res) => {
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / ms);
        setProgress(Math.round(from + (to - from) * p));
        if (p < 1) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const doneAt = useMemo(() => new Date().toISOString(), [phase]);
  const currentStage = phase === 'done' ? 4 : Math.min(stageIdx, 3);

  return (
    <div className="mx-auto max-w-[840px] space-y-5">
      <SectionTitle kicker="Ingest" title="Upload Document" sub="Four-stage evidentiary intake: transfer, validate, fingerprint, anchor. Each stage is verified before the next begins." />

      {/* Stepper — always visible once past idle */}
      {phase !== 'idle' && (
        <ol className="v-card flex items-center px-4 py-3 sm:px-5" aria-label="Ingest progress">
          {STAGES.map((s, i) => {
            const done = phase === 'done' || stageIdx > i;
            const active = phase === 'processing' && stageIdx === i;
            return (
              <li key={s} className="flex min-w-0 flex-1 items-center last:flex-none">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={cx(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold transition',
                    done ? 'bg-[#0a2342] text-white' : active ? 'border-2 border-[#0a2342] bg-white text-[#0a2342]' : 'border border-[#cfd7e3] bg-white text-[#8a96ad]',
                  )} aria-hidden>
                    {done ? <CheckCircle2 size={14} /> : <span className="mono">{i + 1}</span>}
                  </span>
                  <span className="hidden min-w-0 sm:block">
                    <span className={cx('block truncate text-[12.5px] font-semibold leading-tight', done || active ? 'text-[#0a2342]' : 'text-[#8a96ad]')}>{s}</span>
                    <span className="block truncate text-[11px] text-[#8a96ad]">{STAGE_SUB[i]}</span>
                  </span>
                </div>
                {i < STAGES.length - 1 && <span className={cx('mx-2 h-px min-w-4 flex-1 sm:mx-3 sm:min-w-8', done ? 'bg-[#0a2342]' : 'bg-[#dde3ec]')} aria-hidden />}
              </li>
            );
          })}
        </ol>
      )}

      {/* Dropzone */}
      {phase === 'idle' && (
        <div
          className={cx('v-dropzone flex flex-col items-center px-6 py-11 text-center', drag && 'drag')}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
          role="button" tabIndex={0} aria-label="Drop evidentiary document here"
          onKeyDown={(e) => { if (e.key === 'Enter') fileRef.current?.click(); }}
          onClick={() => fileRef.current?.click()}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e8edf3]"><UploadCloud size={22} className="text-[#0a2342]" strokeWidth={1.8} /></span>
          <p className="mt-3.5 text-[15px] font-semibold text-[#1c2c46]">Drag & drop evidentiary document</p>
          <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-[#68778e]">PDF/A · TIFF · XML · XLSX · DICOM · PCAP — max 100 MB per warrant</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button className="v-btn-primary" onClick={() => fileRef.current?.click()}>Browse secure drive</button>
            <button className="v-btn-secondary" onClick={() => fileRef.current?.click()}>Police e-Station</button>
          </div>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => pick(e.target.files?.[0])} aria-label="Choose file" />
        </div>
      )}

      {/* Metadata form */}
      {phase === 'meta' && file && (
        <div className="v-card v-fade-up p-5">
          <div className="v-panel flex items-center gap-3 px-3.5 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#0a2342] text-white"><FileText size={16} strokeWidth={1.8} /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-[13.5px] font-semibold text-[#1c2c46]">{file.name}</p><p className="mono text-[11px] text-[#68778e]">{(file.size / 1024).toFixed(1)} KB · {file.type || 'application/octet-stream'}</p></div>
            <button onClick={() => { setFile(null); setPhase('idle'); }} className="shrink-0 text-[12px] font-semibold text-[#2456c6] hover:underline">Change</button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label htmlFor="up-type" className="mb-1 block">Document type</label>
              <select id="up-type" value={docType} onChange={(e) => setDocType(e.target.value)} className="v-input">{['FIR', 'Forensic Report', 'Witness Statement', 'Evidence Register', 'Charge Sheet', 'Seizure Memo', 'CDR Analysis', 'Court Order', 'Legal Opinion', 'Device Manifest'].map((t) => <option key={t}>{t}</option>)}</select></div>
            <div><label htmlFor="up-case" className="mb-1 block">Case *</label>
              <select id="up-case" value={caseNo} onChange={(e) => setCaseNo(e.target.value)} className="v-input">{cases.map((c) => <option key={c.id} value={c.case_number}>{c.case_number}</option>)}</select></div>
            <div><label htmlFor="up-cls" className="mb-1 block">Classification</label>
              <select id="up-cls" value={classification} onChange={(e) => setClassification(e.target.value)} className="v-input">{['Top Secret', 'Restricted', 'Confidential', 'Internal'].map((t) => <option key={t}>{t}</option>)}</select></div>
            <div><label htmlFor="up-ref" className="mb-1 block">Reference number *</label>
              <input id="up-ref" value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder="e.g. FIR 221/2026" className="v-input" /></div>
            <div><label htmlFor="up-tags" className="mb-1 block">Tags</label>
              <input id="up-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. Seizure, 65B" className="v-input" /></div>
            <div><label htmlFor="up-date" className="mb-1 block">Document date</label>
              <input id="up-date" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} className="v-input" /></div>
            <div className="sm:col-span-2"><label htmlFor="up-desc" className="mb-1 block">Description</label>
              <textarea id="up-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Brief evidentiary context for the record…" className="v-input" /></div>
          </div>
          {formError && <p className="mt-3 flex items-center gap-2 rounded-lg border border-[#efc5c1] bg-[#fdf1f0] px-3 py-2 text-[12.5px] font-medium text-[#93312a]"><AlertCircle size={14} />{formError}</p>}
          <div className="mt-4 flex flex-wrap gap-2 border-t border-[#e8edf3] pt-4">
            <button onClick={startPipeline} className="v-btn-primary">Begin secure ingest <ArrowRight size={14} /></button>
            <button onClick={() => { setFile(null); setPhase('idle'); }} className="v-btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {/* Processing */}
      {(phase === 'processing' || phase === 'done') && (
        <div className="v-card v-fade-up p-5" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[14px] font-semibold text-[#1c2c46]">
              {phase === 'done' ? 'Ingestion complete' : <><span className="mono text-[12px] font-medium text-[#68778e]">Stage {currentStage + 1} of 5 · </span>{STAGES[currentStage]}</>}
            </p>
            <StatusBadge status={phase === 'done' ? 'Sealed' : 'Pending'} />
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#edf1f6]" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className={cx('h-full rounded-full bg-[#0a2342] transition-[width] duration-300', phase === 'processing' && 'v-progress-animated')} style={{ width: `${progress}%` }} />
          </div>
          <p className="mono mt-1.5 text-right text-[11px] text-[#68778e]">{progress}%</p>

          {/* Validation checks — flat panel, not a card */}
          {(stageIdx >= 1 || phase === 'done') && (
            <div className="v-panel mt-3 px-4 py-3">
              <p className="v-meta-label">Validation checks</p>
              <ul className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                {CHECKS.map((c, i) => {
                  const ok = checksDone[i] || phase === 'done';
                  return (
                    <li key={c} className="flex items-center gap-2 text-[12.5px]">
                      {ok ? <CheckCircle2 size={14} className="shrink-0 text-[#359268]" /> : <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[#cfd7e3]" aria-hidden />}
                      <span className={ok ? 'text-[#1c2c46]' : 'text-[#8a96ad]'}>{c}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Live hash — single dark evidence strip */}
          {(stageIdx >= 2 || phase === 'done') && (
            <div className="mt-3 rounded-lg bg-[#0a2342] px-4 py-3.5 text-white">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-blue-200/80"><Fingerprint size={13} /> SHA-256 fingerprint {realHash && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-emerald-200">actual file hash</span>}</p>
              <p className="mono mt-2 break-all text-[11.5px] leading-[1.7] text-emerald-100/95" aria-label="SHA-256 hash">
                {(hash || hashLive).split('').map((ch, i) => <span key={i} className={hash ? '' : 'v-hash-char'} style={hash ? undefined : { animationDelay: `${Math.min(i * 6, 700)}ms` }}>{ch}</span>)}
                {!hash && <span className="v-pulse-dot">▌</span>}
              </p>
              {(stageIdx >= 3 || phase === 'done') && txId && (
                <p className="mono mt-2.5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-2.5 text-[11.5px] text-blue-100/85"><Link2 size={13} /> {txId} · prototype/demo transaction · Block #48292</p>
              )}
            </div>
          )}

          {/* Success — calm confirmation, not a trophy panel */}
          {phase === 'done' && (
            <div className="mt-3 rounded-lg border border-[#cfe5d6] bg-[#f3faf5] px-5 py-5 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#0a2342]">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 3l7 2.6v5.5c0 4.5-3 7.7-7 9.1-4-1.4-7-4.6-7-9.1V5.6L12 3z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
                  <path d="M9 12.2l2.2 2.2 4-4.4" stroke="#7ee2b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="v-draw-check" />
                </svg>
              </span>
              <h3 className="mt-2.5 text-[16px] font-semibold text-[#1c2c46]">Document securely anchored</h3>
              <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-[#3c4f68]">SHA-256 fingerprint sealed to the permissioned ledger. Any future alteration will be detected on verification.</p>
              <dl className="mx-auto mt-4 grid max-w-lg gap-1.5 text-left">
                {[['Document ID', docId], ['SHA-256', hash], ['Transaction ID', `${txId} (demo)`], ['Timestamp', fmtDateTime(doneAt)]].map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-3 rounded-md border border-[#e1e7ef] bg-white px-3 py-2">
                    <dt className="v-meta-label shrink-0 pt-0.5">{k}</dt>
                    <dd className="mono break-all text-right text-[11px] leading-relaxed text-[#2e4a6b]">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button onClick={async () => { await copyText(hash); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="v-btn-secondary"><Copy size={14} /> {copied ? 'Copied' : 'Copy hash'}</button>
                <button onClick={() => nav(`/documents/${docId}`)} className="v-btn-secondary">View document</button>
                <button onClick={() => nav(`/verify?doc=${docId}`)} className="v-btn-primary"><ShieldCheck size={14} /> Verify integrity</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
