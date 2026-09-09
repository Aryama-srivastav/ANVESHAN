import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, Files, UploadCloud, ShieldCheck, Share2,
  ScrollText, Boxes, Users, Settings, Bell, Search, Menu, X,
  Shield, ChevronRight, LogOut, FileCheck2, Activity,
} from 'lucide-react';
import { useStore } from '../store';
import { cx, timeAgo, initials } from '../lib/utils';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/cases', label: 'Cases', icon: FolderKanban },
  { to: '/documents', label: 'Documents', icon: Files },
  { to: '/upload', label: 'Upload Document', icon: UploadCloud },
  { to: '/verify', label: 'Verification', icon: ShieldCheck },
  { to: '/sharing', label: 'Sharing', icon: Share2 },
  { to: '/audit', label: 'Audit Trail', icon: ScrollText },
  { to: '/ledger', label: 'Permissioned Ledger', icon: Boxes },
  { to: '/users', label: 'Users & Permissions', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const CRUMBS: Record<string, string[]> = {
  '/': ['Dashboard'],
  '/cases': ['Cases'],
  '/documents': ['Documents'],
  '/upload': ['Upload Document'],
  '/verify': ['Verification'],
  '/sharing': ['Sharing & Access'],
  '/audit': ['Audit Trail'],
  '/ledger': ['Permissioned Ledger'],
  '/users': ['Users & Permissions'],
  '/settings': ['Settings'],
};

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0a2342]">
        <Shield size={18} className="text-white" strokeWidth={2.2} />
      </div>
      <div className="leading-tight">
        <p className="text-[15px] font-bold tracking-tight text-[#0a2342]">VERITAS</p>
        <p className="mono text-[10px] tracking-wide text-[#68778e]"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#359268] align-middle" />Sovereign Node · DL-04</p>
      </div>
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const { unreadCount, notifications, currentUser, setCurrentUser, blocks, transactions } = useStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true); }
      if (e.key === 'Escape') { setSearchOpen(false); setNotifOpen(false); setMobileOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { setMobileOpen(false); setNotifOpen(false); }, [loc.pathname]);

  const crumbs = useMemo(() => {
    const path = loc.pathname;
    if (path.startsWith('/cases/')) return ['Cases', 'Case Detail'];
    if (path.startsWith('/documents/')) return ['Documents', 'Document Detail'];
    if (path.startsWith('/ledger/')) return ['Permissioned Ledger', 'Transaction'];
    return CRUMBS[path] || ['Dashboard'];
  }, [loc.pathname]);

  const latestBlock = blocks && blocks.length ? blocks.reduce((a, b) => (a.block_number > b.block_number ? a : b)) : null;
  const pendingCount = transactions.filter((t) => t.status === 'Pending').length;
  const failedCount = transactions.filter((t) => t.status === 'Failed').length;
  const ledgerOk = failedCount === 0;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-1 pt-5"><Brand /></div>
      <div className="px-3 pb-2 pt-3">
        <button onClick={() => nav('/upload')} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0a2342] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#14315c]" aria-label="Upload document">
          <UploadCloud size={15} /> Upload Document
        </button>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4 pt-1" aria-label="Primary">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('v-navlink', (isActive || (n.to !== '/' && loc.pathname.startsWith(n.to + '/'))) && 'active')}>
            <n.icon size={16} strokeWidth={2} className="shrink-0 opacity-70" />
            <span>{n.label}</span>
            {n.to === '/verify' && pendingCount > 0 && (
              <span className="v-pill v-pill-warn v-pill-xs ml-auto">{pendingCount}</span>
            )}
            {n.to === '/ledger' && failedCount > 0 && (
              <span className="v-pill v-pill-bad v-pill-xs ml-auto">{failedCount}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-[#e1e7ef] px-3 py-3">
        <button onClick={() => { setCurrentUser(null); nav('/login'); }} className="v-navlink w-full text-left" aria-label="Sign out">
          <LogOut size={16} className="opacity-70" /> Sign out
        </button>
        <div className="mt-2 flex items-center gap-2.5 rounded-lg border border-[#e1e7ef] bg-white p-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#0a2342] text-[11px] font-semibold text-white">
            {initials(currentUser?.name || 'Ananya Sharma')}
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[12.5px] font-semibold text-[#1c2c46]">{currentUser?.name || 'Insp. Ananya Sharma'}</p>
            <p className="mono truncate text-[10px] text-[#68778e]">{currentUser?.role || 'Investigating Officer'}</p>
          </div>
          <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[#359268]" title="Online" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#edf0f5]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 border-r border-[#e1e7ef] bg-[#f1f4f8] lg:block">
        {sidebar}
      </aside>
      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-[#0a2342]/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[272px] overflow-y-auto bg-[#f1f4f8] shadow-xl">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-[#e1e7ef] bg-white/95 backdrop-blur">
          <div className="flex items-center gap-2.5 px-4 py-2 sm:px-6">
            <button className="rounded-lg p-2 text-[#3c4f68] hover:bg-[#eef1f6] lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={18} /></button>
            <div className="hidden min-w-0 items-center gap-2 text-[12.5px] sm:flex" aria-label="Breadcrumbs">
              <span className="text-[13px] font-bold tracking-tight text-[#0a2342]">VERITAS</span>
              <span className="text-[#b6c1d2]">/</span>
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 && <ChevronRight size={12} className="text-[#b6c1d2]" />}
                  <span className={i === crumbs.length - 1 ? 'font-semibold text-[#33475f]' : 'text-[#7d8b9f]'}>{c}</span>
                </span>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <button onClick={() => setSearchOpen(true)} className="hidden items-center gap-2 rounded-lg border border-[#cfd7e3] bg-white px-3 py-[7px] text-[12.5px] text-[#7d8b9f] transition hover:border-[#aeb9cb] hover:bg-[#f8fafc] md:flex md:w-[232px]" aria-label="Global search">
                <Search size={14} /> <span className="flex-1 text-left">Search hash, case…</span> <span className="kbd">⌘K</span>
              </button>
              <button onClick={() => setSearchOpen(true)} className="rounded-lg border border-[#cfd7e3] bg-white p-2 text-[#3c4f68] md:hidden" aria-label="Search"><Search size={15} /></button>
              <button onClick={() => nav('/ledger')} className={cx('v-pill mono mr-1 hidden sm:inline-flex', ledgerOk ? 'v-pill-ok' : 'v-pill-warn')} title="Ledger status">
                Ledger Synced · #{latestBlock ? latestBlock.block_number : '48291'}
              </button>
              <div className="relative">
                <button onClick={() => setNotifOpen((v) => !v)} className="relative rounded-lg p-2 text-[#3c4f68] transition hover:bg-[#eef1f6]" aria-label="Notifications" aria-expanded={notifOpen}>
                  <Bell size={17} />
                  {unreadCount > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#b3362c] px-1 text-[10px] font-semibold text-white">{unreadCount}</span>}
                </button>
                {notifOpen && (
                  <div className="v-card absolute right-0 top-11 z-50 w-[336px] max-w-[86vw] overflow-hidden v-fade-up">
                    <div className="flex items-center justify-between border-b border-[#e8edf3] px-4 py-2.5">
                      <p className="text-[13px] font-semibold text-[#1c2c46]">Notifications</p>
                      <button onClick={() => nav('/settings')} className="text-[12px] font-semibold text-[#2456c6] hover:underline">Settings</button>
                    </div>
                    <div className="max-h-[336px] overflow-y-auto">
                      {notifications.slice(0, 7).map((n) => (
                        <button key={n.id} onClick={() => { setNotifOpen(false); nav(n.link === 'ledger' ? '/ledger' : n.link === 'verify' ? '/verify' : n.link === 'sharing' ? '/sharing' : n.link === 'audit' ? '/audit' : '/'); }} className="flex w-full gap-2.5 border-b border-[#f0f3f7] px-4 py-2.5 text-left last:border-0 hover:bg-[#f7f9fc]">
                          <span className={cx('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', n.type === 'success' ? 'bg-[#359268]' : n.type === 'warning' ? 'bg-[#c99a2e]' : n.type === 'alert' ? 'bg-[#c05148]' : 'bg-[#3f6ea5]')} />
                          <span className="min-w-0">
                            <span className="block text-[12.5px] font-semibold text-[#1c2c46]">{n.title} {!n.read && <span className="v-pill v-pill-navy v-pill-xs ml-1">New</span>}</span>
                            <span className="block text-[12px] leading-snug text-[#5d6d84]">{n.message}</span>
                            <span className="mono block pt-0.5 text-[10.5px] text-[#8a96ad]">{timeAgo(n.time)}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                    <button onClick={() => { setNotifOpen(false); nav('/settings'); }} className="block w-full bg-[#f8fafc] px-4 py-2 text-center text-[12px] font-semibold text-[#2456c6] hover:bg-[#f1f4f8]">View all notifications</button>
                  </div>
                )}
              </div>
              <button onClick={() => nav('/verify')} className="hidden rounded-lg p-2 text-[#3c4f68] transition hover:bg-[#eef1f6] sm:block" aria-label="Verify integrity" title="Verify integrity"><FileCheck2 size={17} /></button>
              <button onClick={() => nav('/audit')} className="hidden rounded-lg p-2 text-[#3c4f68] transition hover:bg-[#eef1f6] sm:block" aria-label="Audit trail" title="Audit trail"><Activity size={17} /></button>
              <div className="ml-1 hidden text-right leading-tight xl:block">
                <p className="mono text-[10px] font-medium uppercase tracking-wider text-[#68778e]">Node DL-04 · Active</p>
                <p className="mono text-[10px] text-[#68778e]">Consensus Validated</p>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-6 sm:px-6" id="main">
          {children}
        </main>
        <footer className="border-t border-[#e1e7ef] bg-[#f1f4f8] px-6 py-2.5">
          <p className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[#7d8b9f]">
            <span className="font-bold text-[#0a2342]">VERITAS</span>
            <span>Secure. Traceable. Verifiable.</span>
            <span className="mono ml-auto">Prototype demo data · Permissioned Ledger Node DL-04 · 08 Sep 2026</span>
          </p>
        </footer>
      </div>

      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
    </div>
  );
}

function GlobalSearch({ onClose }: { onClose: () => void }) {
  const { cases, documents, users, transactions, audit } = useStore();
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const inputRef = React.useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (query.length < 2) return [];
    const out: any[] = [];
    cases.forEach((c) => {
      if (c.case_number.toLowerCase().includes(query) || c.title.toLowerCase().includes(query))
        out.push({ kind: 'Case', label: c.case_number, sub: c.title, go: `/cases/${c.id}` });
    });
    documents.forEach((d) => {
      if (d.filename.toLowerCase().includes(query) || d.id.toLowerCase().includes(query) || (d.sha256 || '').toLowerCase().includes(query) || (d.tx_id || '').toLowerCase().includes(query))
        out.push({ kind: 'Document', label: d.filename, sub: `${d.id} · ${d.tx_id}`, go: `/documents/${d.id}` });
    });
    transactions.forEach((t) => {
      if (t.tx_id.toLowerCase().includes(query) || (t.hash || '').toLowerCase().includes(query))
        out.push({ kind: 'Transaction', label: t.tx_id, sub: `${t.doc_name} · Block #${t.block_number}`, go: `/ledger/${t.tx_id}` });
    });
    users.forEach((u) => {
      if (u.name.toLowerCase().includes(query) || u.role.toLowerCase().includes(query))
        out.push({ kind: 'User', label: u.name, sub: `${u.role} · ${u.department}`, go: '/users' });
    });
    audit.forEach((a) => {
      if ((a.reference || '').toLowerCase().includes(query) || (a.resource || '').toLowerCase().includes(query))
        out.push({ kind: 'Audit', label: `${a.action} — ${a.resource}`, sub: `${a.reference} · ${a.actor}`, go: '/audit' });
    });
    return out.slice(0, 12);
  }, [q, cases, documents, users, transactions, audit]);

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh]" role="dialog" aria-label="Global search">
      <div className="absolute inset-0 bg-[#0a2342]/40" onClick={onClose} />
      <div className="relative w-full max-w-[560px] overflow-hidden rounded-xl border border-[#e1e7ef] bg-white shadow-xl v-fade-up">
        <div className="flex items-center gap-2 border-b border-[#e8edf3] px-4 py-3">
          <Search size={16} className="shrink-0 text-[#68778e]" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cases, documents, users, transactions, hashes…" className="flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-[#93a0b4]" aria-label="Search VERITAS" />
          <span className="kbd">ESC</span>
        </div>
        <div className="max-h-[320px] overflow-y-auto p-1.5">
          {q.trim().length < 2 && <p className="px-3 py-5 text-center text-[12.5px] leading-relaxed text-[#7d8b9f]">Type at least 2 characters. Search across Cases, Documents, Users, Transaction IDs, Document IDs, Case Numbers and Hashes.</p>}
          {q.trim().length >= 2 && results.length === 0 && <p className="px-3 py-5 text-center text-[12.5px] text-[#7d8b9f]">No results for “{q}”.</p>}
          {results.map((r, i) => (
            <button key={i} onClick={() => { onClose(); nav(r.go); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-[#f1f5f9]">
              <span className="mono rounded-md bg-[#eef2f7] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0a2342]">{r.kind}</span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-[#1c2c46]">{r.label}</span>
                <span className="block truncate text-[12px] text-[#5d6d84]">{r.sub}</span>
              </span>
              <ChevronRight size={14} className="ml-auto shrink-0 text-[#b6c1d2]" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function XIcon() { return <X size={16} />; }
