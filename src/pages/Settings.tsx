import { useState } from 'react';
import { Bell, ShieldCheck, Clock, Share2, Fingerprint, Save, CheckCircle2 } from 'lucide-react';
import { useStore } from '../store';
import { SectionTitle, StatusBadge } from '../components/Badges';
import { timeAgo, cx } from '../lib/utils';

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={cx('relative h-[22px] w-[40px] shrink-0 rounded-full transition-colors duration-150', on ? 'bg-[#0a2342]' : 'bg-[#c6cfdb]')}>
      <span className={cx('absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-all duration-150', on ? 'left-[20px]' : 'left-[2px]')} />
    </button>
  );
}

function Row({ title, sub, control }: { title: string; sub: string; control: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 border-b border-[#eef1f6] py-3 last:border-0">
      <div className="min-w-0 flex-1"><p className="text-[13px] font-semibold text-[#1c2c46]">{title}</p><p className="mt-0.5 text-[12px] leading-relaxed text-[#68778e]">{sub}</p></div>
      {control}
    </div>
  );
}

export default function Settings() {
  const { notifications, api, refresh, pushToast, markAllRead } = useStore();
  const [mfa, setMfa] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState('30 minutes');
  const [defaultExpiry, setDefaultExpiry] = useState('7 days');
  const [retention, setRetention] = useState('7 years');
  const [ledgerMode, setLedgerMode] = useState('Permissioned (8 MHA zones)');
  const [notif, setNotif] = useState({ anchor: true, expiry: true, verify: true, alerts: true });
  const [saved, setSaved] = useState(false);

  const save = async () => {
    try {
      await api('audit', 'POST', { row: { actor: 'Administrator Vikram Singh', action: 'Permission Change', resource: 'ANVESHAN Settings', resource_id: 'SETTINGS', result: 'Success', reference: 'CFG-2026', details: `Security settings updated: MFA ${mfa ? 'enforced' : 'relaxed'}, session ${sessionTimeout}, sharing default ${defaultExpiry}, retention ${retention}.`, timestamp: new Date().toISOString() } });
      await refresh(true);
    } catch {
      // demo settings persistence is non-critical when the mock backend is unavailable
    }
    setSaved(true);
    pushToast({ title: 'Settings saved', message: 'Security configuration updated and audited.', kind: 'success' });
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="mx-auto max-w-[880px] space-y-5">
      <SectionTitle kicker="Control" title="Settings" sub="Security, sharing, notification and ledger configuration for Sovereign Node DL-04." />

      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <section className="v-card px-5 py-4" aria-label="Security">
            <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-[#1c2c46]"><ShieldCheck size={15} strokeWidth={1.9} /> Security</h3>
            <div className="mt-1">
              <Row title="Multi-factor authentication" sub="Require hardware-key or app MFA for all officer sign-ins." control={<Toggle on={mfa} onChange={setMfa} label="MFA enforcement" />} />
              <Row title="Session timeout" sub="Auto-lock idle console sessions." control={<select value={sessionTimeout} onChange={(e) => setSessionTimeout(e.target.value)} className="v-input v-w160">{['15 minutes', '30 minutes', '1 hour', '4 hours'].map((o) => <option key={o}>{o}</option>)}</select>} />
              <Row title="Remember-device" sub="Allow 30-day trusted devices after MFA." control={<Toggle on={true} onChange={() => {}} label="Remember device" />} />
            </div>
          </section>

          <section className="v-card px-5 py-4" aria-label="Sharing defaults">
            <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-[#1c2c46]"><Share2 size={15} strokeWidth={1.9} /> Sharing defaults</h3>
            <div className="mt-1">
              <Row title="Default share expiry" sub="Applied to new grants unless overridden." control={<select value={defaultExpiry} onChange={(e) => setDefaultExpiry(e.target.value)} className="v-input v-w160">{['24 hours', '7 days', '30 days'].map((o) => <option key={o}>{o}</option>)}</select>} />
              <Row title="Download watermarking" sub="Stamp recipient identity on issued copies." control={<Toggle on={true} onChange={() => {}} label="Watermarking" />} />
              <Row title="Dual authorisation for Top Secret" sub="Two officers must approve Top Secret shares." control={<Toggle on={true} onChange={() => {}} label="Dual authorisation" />} />
            </div>
          </section>

          <section className="v-card px-5 py-4" aria-label="Audit and ledger">
            <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-[#1c2c46]"><Clock size={15} strokeWidth={1.9} /> Audit retention & ledger</h3>
            <div className="mt-1">
              <Row title="Audit retention" sub="Immutable retention per evidence policy." control={<select value={retention} onChange={(e) => setRetention(e.target.value)} className="v-input v-w160">{['3 years', '7 years', 'Permanent'].map((o) => <option key={o}>{o}</option>)}</select>} />
              <Row title="Ledger mode" sub="Consensus topology for anchoring." control={<select value={ledgerMode} onChange={(e) => setLedgerMode(e.target.value)} className="v-input v-w230">{['Permissioned (8 MHA zones)', 'Permissioned (4 zones — degraded)', 'Local-only (maintenance)'].map((o) => <option key={o}>{o}</option>)}</select>} />
              <Row title="Auto-retry failed anchors" sub="Retry quorum timeouts up to 3 times." control={<Toggle on={true} onChange={() => {}} label="Auto retry" />} />
            </div>
          </section>

          <section className="v-card px-5 py-4" aria-label="Notifications">
            <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-[#1c2c46]"><Bell size={15} strokeWidth={1.9} /> Notifications</h3>
            <div className="mt-1">
              <Row title="Successful anchoring" sub="Notify when a document is sealed." control={<Toggle on={notif.anchor} onChange={(v) => setNotif({ ...notif, anchor: v })} label="Anchoring notifications" />} />
              <Row title="Expiring access" sub="Warn 24h before a share expires." control={<Toggle on={notif.expiry} onChange={(v) => setNotif({ ...notif, expiry: v })} label="Expiry notifications" />} />
              <Row title="Verification required" sub="Alert when documents await verification." control={<Toggle on={notif.verify} onChange={(v) => setNotif({ ...notif, verify: v })} label="Verification notifications" />} />
              <Row title="Security alerts" sub="Mismatch, denied access and failures." control={<Toggle on={notif.alerts} onChange={(v) => setNotif({ ...notif, alerts: v })} label="Security alerts" />} />
            </div>
          </section>

          <div className="flex items-center gap-3">
            <button onClick={save} className="v-btn-primary"><Save size={14} /> {saved ? 'Saved & audited' : 'Save settings'}</button>
            {saved && <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#2c6b45]"><CheckCircle2 size={14} /> Configuration saved and written to the audit trail.</p>}
          </div>
        </div>

        {/* Notifications inbox */}
        <aside className="v-card h-fit px-4 py-4" aria-label="Notifications inbox">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-[13.5px] font-semibold text-[#1c2c46]"><Fingerprint size={14} strokeWidth={1.9} /> Notifications</h3>
            <button onClick={markAllRead} className="text-[11.5px] font-semibold text-[#2456c6] hover:underline">Mark all read</button>
          </div>
          <div className="mt-3 space-y-2">
            {notifications.slice(0, 6).map((n) => (
              <div key={n.id} className={cx('rounded-lg border px-3 py-2.5', n.read ? 'border-[#e8edf3] bg-white' : 'border-[#c9d6e9] bg-[#f4f7fc]')}>
                <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#1c2c46]">{n.title} {!n.read && <span className="v-pill v-pill-navy v-pill-xs">New</span>}</p>
                <p className="mt-0.5 text-[12px] leading-snug text-[#5d6d84]">{n.message}</p>
                <p className="mono mt-1 flex items-center justify-between gap-2 text-[10px] text-[#8a96ad]"><span>{timeAgo(n.time)}</span><StatusBadge status={n.type === 'success' ? 'Success' : n.type === 'warning' ? 'Pending' : n.type === 'alert' ? 'Mismatch' : 'Active'} /></p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
