import React from 'react';
import { cx } from '../lib/utils';

function Pill({ tone, pulse, children }: { tone: 'ok' | 'warn' | 'bad' | 'info' | 'neutral' | 'navy'; pulse?: boolean; children: React.ReactNode }) {
  return (
    <span className={cx('v-pill', `v-pill-${tone}`)}>
      <span className={cx('v-dot', pulse && 'v-pulse-dot')} aria-hidden />
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase();
  if (['active', 'anchored', 'success', 'verified', 'sealed', 'synced'].includes(s)) return <Pill tone="ok">{status}</Pill>;
  if (['pending', 'under review', 'pending verification', 'expiring soon', 'warning'].includes(s))
    return <Pill tone="warn" pulse={s === 'pending' || s === 'pending verification'}>{status}</Pill>;
  if (['mismatch', 'failed', 'denied', 'alert', 'revoked', 'critical'].includes(s)) return <Pill tone="bad">{status}</Pill>;
  if (['high'].includes(s)) return <Pill tone="warn">{status}</Pill>;
  if (['info', 'new'].includes(s)) return <Pill tone="info">{status}</Pill>;
  return <Pill tone="neutral">{status}</Pill>;
}

export function ClassificationBadge({ level }: { level?: string }) {
  const safeLevel = level || 'Internal';
  const l = safeLevel.toLowerCase();
  if (l === 'top secret')
    return (
      <span className="inline-flex items-center rounded-md bg-[#0a2342] px-2 py-[3px] text-[10.5px] font-semibold uppercase tracking-[0.06em] text-white whitespace-nowrap">
        {safeLevel}
      </span>
    );
  const tone =
    l === 'restricted'
      ? 'border-[#ddd3b8] bg-[#faf6ea] text-[#7a5c14]'
      : l === 'confidential'
        ? 'border-[#c8d5e6] bg-[#f2f6fb] text-[#2e4a6b]'
        : 'border-[#dde3ec] bg-[#f4f6f9] text-[#5b6b82]';
  return (
    <span className={cx('inline-flex items-center rounded-md border px-2 py-[3px] text-[10.5px] font-semibold uppercase tracking-[0.06em] whitespace-nowrap', tone)}>
      {safeLevel}
    </span>
  );
}

export function IntegrityBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase();
  if (s === 'verified')
    return (
      <span className="v-pill v-pill-ok">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
        Verified
      </span>
    );
  if (s === 'pending')
    return <Pill tone="warn" pulse>Pending</Pill>;
  if (s === 'mismatch')
    return (
      <span className="v-pill v-pill-bad">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
        Mismatch
      </span>
    );
  if (s === 'failed')
    return (
      <span className="v-pill v-pill-bad">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
        Failed
      </span>
    );
  return <StatusBadge status={status} />;
}

export function MonoId({ value }: { value: string; short?: boolean }) {
  return <span className="mono text-[12px] text-[#2e4a6b] break-all">{value}</span>;
}

export function SectionTitle({ kicker, title, sub }: { kicker?: string; title: string; sub?: string }) {
  return (
    <div className="min-w-0">
      {kicker && <p className="v-meta-label">{kicker}</p>}
      <h2 className={cx('font-semibold text-[#101f36]', kicker ? 'mt-0.5 text-[17px] leading-snug' : 'text-[17px] leading-snug')}>{title}</h2>
      {sub && <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-[#5d6d84]">{sub}</p>}
    </div>
  );
}

export function EmptyState({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#c6cfdb] bg-[#f8fafc] px-6 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8edf3]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3c4f68" strokeWidth="1.8" aria-hidden><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
      </div>
      <p className="mt-3 text-[13.5px] font-semibold text-[#1c2c46]">{title}</p>
      {sub && <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-[#68778e]">{sub}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
