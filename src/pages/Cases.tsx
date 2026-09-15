import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowUpDown, ChevronLeft, ChevronRight, FolderKanban } from 'lucide-react';
import { useStore } from '../store';
import { StatusBadge, ClassificationBadge, SectionTitle, EmptyState } from '../components/Badges';
import { timeAgo } from '../lib/utils';

const PAGE = 6;

export default function Cases() {
  const { cases } = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');
  const [cls, setCls] = useState('All');
  const [sort, setSort] = useState<'recent' | 'docs' | 'az'>('recent');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let r = [...cases];
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter((c) => c.case_number.toLowerCase().includes(s) || c.title.toLowerCase().includes(s) || c.officer.toLowerCase().includes(s));
    }
    if (status !== 'All') r = r.filter((c) => c.status === status);
    if (cls !== 'All') r = r.filter((c) => c.classification === cls);
    if (sort === 'recent') r.sort((a, b) => +new Date(b.last_activity) - +new Date(a.last_activity));
    if (sort === 'docs') r.sort((a, b) => b.doc_count - a.doc_count);
    if (sort === 'az') r.sort((a, b) => a.title.localeCompare(b.title));
    return r;
  }, [cases, q, status, cls, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const view = filtered.slice((page - 1) * PAGE, page * PAGE);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionTitle kicker="Module 01" title="Cases" sub="Investigation dossiers with sealed chain-of-custody. Select a case for documents, timeline, access and audit." />
        <button onClick={() => nav('/upload')} className="v-btn-primary">+ New case document</button>
      </div>

      <div className="v-card p-3.5">
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-[1fr_170px_170px_150px]">
          <label className="relative block">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a96ad]" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search case number, title, officer…" className="v-input pl-9" aria-label="Search cases" />
          </label>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="v-input" aria-label="Filter by status">
            {['All', 'Active', 'Under Review', 'Pending Verification', 'Sealed', 'Closed'].map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={cls} onChange={(e) => { setCls(e.target.value); setPage(1); }} className="v-input" aria-label="Filter by classification">
            {['All', 'Top Secret', 'Restricted', 'Confidential', 'Internal'].map((s) => <option key={s}>{s}</option>)}
          </select>
          <button onClick={() => setSort(sort === 'recent' ? 'docs' : sort === 'docs' ? 'az' : 'recent')} className="v-btn-secondary justify-center" aria-label="Change sorting">
            <ArrowUpDown size={14} /> {sort === 'recent' ? 'Recent' : sort === 'docs' ? 'Most docs' : 'A–Z'}
          </button>
        </div>
      </div>

      {view.length === 0 ? (
        <EmptyState title="No cases match" sub="Adjust search or filters to find a dossier." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {view.map((c) => (
            <button key={c.id} onClick={() => nav(`/cases/${c.id}`)} className="v-card v-card-hover p-4 text-left" aria-label={`Open ${c.case_number}`}>
              <div className="flex items-start gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#eef2f7] text-[#0a2342]"><FolderKanban size={16} strokeWidth={1.8} /></span>
                <div className="min-w-0 flex-1">
                  <p className="mono text-[10.5px] font-medium text-[#7d8b9f]">{c.case_number}</p>
                  <p className="truncate text-[14px] font-semibold text-[#1c2c46]">{c.title}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>
              <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-[#5d6d84]">{c.description}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-[#f0f3f7] pt-2.5">
                <ClassificationBadge level={c.classification} />
                <span className="rounded bg-[#eef2f7] px-1.5 py-0.5 text-[11px] font-medium text-[#3c4f68]">{c.doc_count} documents</span>
                <span className="ml-auto text-[11.5px] text-[#8a96ad]">{c.officer} · {timeAgo(c.last_activity)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-[12px] text-[#68778e]">
        <p>Showing {view.length} of {filtered.length} cases · Page {page}/{pages}</p>
        <div className="flex gap-1.5">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="v-btn-secondary v-btn-sm disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={14} /></button>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="v-btn-secondary v-btn-sm disabled:opacity-40" aria-label="Next page"><ChevronRight size={14} /></button>
        </div>
      </div>
    </div>
  );
}
