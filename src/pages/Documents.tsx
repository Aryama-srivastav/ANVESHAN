import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LayoutGrid, List, ChevronLeft, ChevronRight, FileText, FileSpreadsheet, FileCode2, FileImage, File } from 'lucide-react';
import { useStore } from '../store';
import { IntegrityBadge, ClassificationBadge, SectionTitle, EmptyState } from '../components/Badges';
import { timeAgo, shortHash, cx } from '../lib/utils';

const PAGE = 8;

function TypeIcon({ filename }: { filename: string }) {
  const ext = filename.split('.').pop()?.toLowerCase();
  const cls = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ';
  if (ext === 'pdf') return <span className={cls + 'border-[#e8d5d3] bg-[#faf3f2] text-[#a32e26]'}><FileText size={15} strokeWidth={1.8} /></span>;
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return <span className={cls + 'border-[#d4e2d4] bg-[#f2f7f2] text-[#2c6b45]'}><FileSpreadsheet size={15} strokeWidth={1.8} /></span>;
  if (ext === 'xml' || ext === 'json') return <span className={cls + 'border-[#e6dcc2] bg-[#faf7ec] text-[#8a6116]'}><FileCode2 size={15} strokeWidth={1.8} /></span>;
  if (['jpg', 'jpeg', 'png', 'tiff'].includes(ext || '')) return <span className={cls + 'border-[#d8d5e8] bg-[#f4f3fa] text-[#5b5491]'}><FileImage size={15} strokeWidth={1.8} /></span>;
  return <span className={cls + 'border-[#dde3ec] bg-[#f4f6f9] text-[#5b6b82]'}><File size={15} strokeWidth={1.8} /></span>;
}

export default function Documents() {
  const { documents } = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [integrity, setIntegrity] = useState('All');
  const [cls, setCls] = useState('All');
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<'updated' | 'name'>('updated');

  const filtered = useMemo(() => {
    let r = [...documents];
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter((d) => d.filename.toLowerCase().includes(s) || d.id.toLowerCase().includes(s) || d.case_number.toLowerCase().includes(s) || (d.sha256 || '').toLowerCase().includes(s) || (d.tx_id || '').toLowerCase().includes(s));
    }
    if (integrity !== 'All') r = r.filter((d) => d.integrity_status === integrity);
    if (cls !== 'All') r = r.filter((d) => d.classification === cls);
    if (sort === 'updated') r.sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at));
    if (sort === 'name') r.sort((a, b) => a.filename.localeCompare(b.filename));
    return r;
  }, [documents, q, integrity, cls, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows = filtered.slice((page - 1) * PAGE, page * PAGE);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionTitle kicker="Module 02" title="Documents" sub="Sealed repository. Every file carries a SHA-256 fingerprint anchored to the permissioned ledger." />
        <button onClick={() => nav('/upload')} className="v-btn-primary">+ Upload Document</button>
      </div>

      <div className="v-card flex flex-col gap-3 p-3.5 lg:flex-row lg:items-center">
        <label className="relative block flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a96ad]" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search filename, ID, case, hash, transaction…" className="v-input pl-9" aria-label="Search documents" />
        </label>
        <div className="flex flex-wrap gap-2">
          <select value={integrity} onChange={(e) => { setIntegrity(e.target.value); setPage(1); }} className="v-input v-input-auto" aria-label="Integrity filter">
            {['All', 'Verified', 'Pending', 'Mismatch', 'Failed'].map((s) => <option key={s} value={s}>{s === 'All' ? 'All integrity' : s}</option>)}
          </select>
          <select value={cls} onChange={(e) => { setCls(e.target.value); setPage(1); }} className="v-input v-input-auto" aria-label="Classification filter">
            {['All', 'Top Secret', 'Restricted', 'Confidential', 'Internal'].map((s) => <option key={s} value={s}>{s === 'All' ? 'All classifications' : s}</option>)}
          </select>
          <select value={sort} onChange={(e) => { setSort(e.target.value as any); setPage(1); }} className="v-input v-input-auto" aria-label="Sort documents">
            <option value="updated">Recently updated</option>
            <option value="name">Filename A–Z</option>
          </select>
          <div className="flex overflow-hidden rounded-lg border border-[#cfd7e3]" role="group" aria-label="View mode">
            <button onClick={() => setView('table')} className={cx('p-2', view === 'table' ? 'bg-[#0a2342] text-white' : 'bg-white text-[#68778e] hover:bg-[#f4f6f9]')} aria-label="Table view"><List size={15} /></button>
            <button onClick={() => setView('grid')} className={cx('p-2', view === 'grid' ? 'bg-[#0a2342] text-white' : 'bg-white text-[#68778e] hover:bg-[#f4f6f9]')} aria-label="Grid view"><LayoutGrid size={15} /></button>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No documents found" sub="Try a different search or filter — or upload a new document." action={<button onClick={() => nav('/upload')} className="v-btn-primary">Upload Document</button>} />
      ) : view === 'table' ? (
        <div className="v-table-wrap">
          <div className="overflow-x-auto">
            <table className="v-table w-full min-w-[900px]">
              <thead><tr><th>Filename</th><th>Type</th><th>Case</th><th>Ver</th><th>Classification</th><th>Uploader</th><th>Updated</th><th>Integrity</th></tr></thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="cursor-pointer" onClick={() => nav(`/documents/${d.id}`)}>
                    <td>
                      <span className="flex items-center gap-2.5"><TypeIcon filename={d.filename} />
                        <span><span className="block text-[13px] font-semibold text-[#1c2c46]">{d.filename}</span><span className="mono block text-[10.5px] text-[#8a96ad]">{d.id} · {shortHash(d.sha256, 8, 6)}</span></span>
                      </span>
                    </td>
                    <td><span className="mono rounded bg-[#eef2f7] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#3c4f68]">{d.file_type}</span></td>
                    <td className="mono whitespace-nowrap text-[11.5px] text-[#3c4f68]">{d.case_number}</td>
                    <td className="mono text-[12px] text-[#3c4f68]">{d.version}</td>
                    <td><ClassificationBadge level={d.classification} /></td>
                    <td className="whitespace-nowrap text-[12.5px]">{d.uploader}</td>
                    <td className="whitespace-nowrap text-[12px] text-[#68778e]">{timeAgo(d.updated_at)}</td>
                    <td><IntegrityBadge status={d.integrity_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((d) => (
            <button key={d.id} onClick={() => nav(`/documents/${d.id}`)} className="v-card v-card-hover p-4 text-left">
              <div className="flex items-start gap-2.5">
                <TypeIcon filename={d.filename} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-[#1c2c46]">{d.filename}</p>
                  <p className="mono text-[10.5px] text-[#8a96ad]">{d.id} · {d.version}</p>
                </div>
                <IntegrityBadge status={d.integrity_status} />
              </div>
              <p className="mono mt-2 truncate text-[11px] text-[#68778e]">{d.case_number}</p>
              <div className="mt-2 flex items-center gap-2">
                <ClassificationBadge level={d.classification} />
                <span className="ml-auto text-[11px] text-[#8a96ad]">{timeAgo(d.updated_at)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-[12px] text-[#68778e]">
        <p>Showing {rows.length} of {filtered.length} documents · Page {page}/{pages}</p>
        <div className="flex gap-1.5">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="v-btn-secondary v-btn-sm disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={14} /></button>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="v-btn-secondary v-btn-sm disabled:opacity-40" aria-label="Next page"><ChevronRight size={14} /></button>
        </div>
      </div>
    </div>
  );
}
