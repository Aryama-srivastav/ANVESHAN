import { useState } from 'react';
import { ShieldCheck, ShieldX, Search } from 'lucide-react';
import { useStore } from '../store';
import { SectionTitle, EmptyState } from '../components/Badges';
import { timeAgo } from '../lib/utils';

const MODULES = ['Cases', 'Documents', 'Upload', 'Verify', 'Share', 'Audit', 'Ledger', 'Users', 'Settings'];

export default function Users() {
  const { users } = useStore();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('All');

  const matrix: Record<string, Record<string, boolean>> = {
    'Investigating Officer': { Cases: true, Documents: true, Upload: true, Verify: true, Share: true, Audit: false, Ledger: true, Users: false, Settings: false },
    'Legal Officer': { Cases: true, Documents: true, Upload: true, Verify: true, Share: true, Audit: true, Ledger: true, Users: false, Settings: false },
    'Forensic Officer': { Cases: true, Documents: true, Upload: true, Verify: true, Share: false, Audit: false, Ledger: true, Users: false, Settings: false },
    Auditor: { Cases: true, Documents: true, Upload: false, Verify: true, Share: false, Audit: true, Ledger: true, Users: false, Settings: false },
    Administrator: { Cases: true, Documents: true, Upload: true, Verify: true, Share: true, Audit: true, Ledger: true, Users: true, Settings: true },
  };

  const filtered = users.filter((u) => {
    if (role !== 'All' && u.role !== role) return false;
    if (q.trim()) {
      const s = q.toLowerCase();
      return u.name.toLowerCase().includes(s) || u.department.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
    }
    return true;
  });

  const roles = ['Investigating Officer', 'Legal Officer', 'Forensic Officer', 'Auditor', 'Administrator'];

  return (
    <div className="space-y-5">
      <SectionTitle kicker="Governance" title="Users & Permissions" sub="Role-gated access for investigation, legal, forensic, audit and administration functions. Every permission change is audited." />

      <div className="v-card flex flex-col gap-2.5 p-3.5 sm:flex-row">
        <label className="relative block flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a96ad]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, department, email…" className="v-input pl-9" aria-label="Search users" />
        </label>
        <select value={role} onChange={(e) => setRole(e.target.value)} className="v-input sm:w-[220px]" aria-label="Filter by role">
          {['All', ...roles].map((r) => <option key={r}>{r}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No users match" sub="Adjust search or role filter." />
      ) : (
        <div className="v-table-wrap">
          <div className="overflow-x-auto">
            <table className="v-table w-full min-w-[820px]">
              <thead><tr><th>User</th><th>Role</th><th>Department</th><th>Status</th><th>MFA</th><th>Last login</th><th>Cases</th></tr></thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <span className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#0a2342] text-[10.5px] font-semibold text-white">{u.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}</span>
                        <span><span className="block text-[13px] font-semibold text-[#1c2c46]">{u.name}</span><span className="mono block text-[10.5px] text-[#8a96ad]">{u.email}</span></span>
                      </span>
                    </td>
                    <td><span className="rounded bg-[#eef2f7] px-1.5 py-0.5 text-[11.5px] font-semibold text-[#0a2342]">{u.role}</span></td>
                    <td className="text-[12.5px]">{u.department}</td>
                    <td><span className="v-pill v-pill-ok">{u.status}</span></td>
                    <td className="text-[12.5px] font-medium text-[#2c6b45]">{u.mfa}</td>
                    <td className="whitespace-nowrap text-[12px] text-[#68778e]">{timeAgo(u.last_login)}</td>
                    <td className="text-center font-semibold">{u.cases_assigned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <section className="v-table-wrap" aria-label="Permission matrix">
        <div className="px-5 pb-2 pt-4"><SectionTitle title="Permission Matrix" sub="Module access by role. Changes require dual administrator approval in production." /></div>
        <div className="overflow-x-auto">
          <table className="v-table w-full min-w-[760px]">
            <thead><tr><th>Role</th>{MODULES.map((m) => <th key={m} className="text-center">{m}</th>)}</tr></thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r}>
                  <td className="whitespace-nowrap text-[12.5px] font-semibold text-[#1c2c46]">{r}</td>
                  {MODULES.map((m) => (
                    <td key={m} className="text-center">
                      {matrix[r]?.[m]
                        ? <span className="inline-flex items-center justify-center rounded-full bg-[#eef5ef] p-1.5 text-[#359268]" title={`${r} can access ${m}`}><ShieldCheck size={14} strokeWidth={2} /></span>
                        : <span className="inline-flex items-center justify-center rounded-full bg-[#f1f4f8] p-1.5 text-[#b6c1d2]" title={`${r} cannot access ${m}`}><ShieldX size={14} strokeWidth={2} /></span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        {roles.map((r) => (
          <div key={r} className="v-card px-4 py-3.5">
            <p className="text-[12.5px] font-semibold text-[#1c2c46]">{r}</p>
            <p className="mono mt-0.5 text-[10.5px] text-[#68778e]">{users.filter((u) => u.role === r).length} member(s)</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[#68778e]">{Object.entries(matrix[r]).filter(([, v]) => v).length} of {MODULES.length} modules granted</p>
          </div>
        ))}
      </div>
    </div>
  );
}
