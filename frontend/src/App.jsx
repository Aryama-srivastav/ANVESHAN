import React, { useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Check,
  ChevronDown,
  ClipboardList,
  FileCheck2,
  Fingerprint,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

const roles = {
  investigator: { label: "Investigator", initials: "AR", tone: "sage" },
  auditor: { label: "Auditor", initials: "AU", tone: "amber" },
  admin: { label: "Administrator", initials: "AD", tone: "coral" },
};

const seedCases = [
  { id: "case-001", number: "ANV-24-0187", title: "Riverside warehouse incident", status: "Active", evidence: 24, updated: "12 min ago", signal: "3 items need review" },
  { id: "case-002", number: "ANV-24-0179", title: "North district procurement trail", status: "Review", evidence: 11, updated: "48 min ago", signal: "Integrity verified" },
  { id: "case-003", number: "ANV-24-0164", title: "Harbor camera sequence", status: "Active", evidence: 38, updated: "Yesterday", signal: "2 access requests" },
];

const seedGrants = [
  { id: "grant-01", person: "Meera Joshi", email: "meera.joshi@forensics.gov", role: "Auditor", scope: "ANV-24-0187", department: "Forensics", level: "Read", expiry: "30 Sep 2026", state: "Active" },
  { id: "grant-02", person: "Daniel Okafor", email: "daniel.okafor@agency.gov", role: "Investigator", scope: "ANV-24-0179", department: "Investigations", level: "Write", expiry: "18 Oct 2026", state: "Active" },
  { id: "grant-03", person: "Lina Park", email: "lina.park@oversight.gov", role: "Auditor", scope: "ANV-24-0164", department: "Oversight", level: "Read", expiry: "Expired 02 Sep", state: "Expired" },
];

function App() {
  const [stage, setStage] = useState("login");
  const [role, setRole] = useState("investigator");
  const [activeView, setActiveView] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [cases, setCases] = useState(seedCases);
  const [grants, setGrants] = useState(seedGrants);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");

  if (stage === "login") return <Login onContinue={(selectedRole) => { setRole(selectedRole); setStage("mfa"); }} />;
  if (stage === "mfa") return <Mfa onVerified={() => setStage("app")} onBack={() => setStage("login")} />;

  const currentRole = roles[role];
  const canAdmin = role === "admin";
  const filteredCases = cases.filter((item) => `${item.number} ${item.title}`.toLowerCase().includes(search.toLowerCase()));

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  function createCase(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newCase = {
      id: `case-${cases.length + 1}`,
      number: form.get("number"),
      title: form.get("title"),
      status: "Active",
      evidence: 0,
      updated: "Just now",
      signal: "New case archive",
    };
    setCases([newCase, ...cases]);
    setModal(null);
    notify("Case archive created");
  }

  function createGrant(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setGrants([
      {
        id: `grant-${grants.length + 1}`,
        person: form.get("person"),
        email: form.get("email"),
        role: form.get("grantRole"),
        scope: form.get("scope"),
        department: form.get("department"),
        level: form.get("level"),
        expiry: form.get("expiry"),
        state: "Active",
      },
      ...grants,
    ]);
    setModal(null);
    notify("Access grant issued");
  }

  return (
    <div className="app-shell"><PrototypeBanner />
      <aside className={`sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="brand-lockup"><div className="brand-mark">A</div><div><strong>ANVESHAN</strong><span>Evidence workspace</span></div></div>
        <div className="workspace-label">Workspace <span>V1</span></div>
        <nav className="primary-nav">
          <NavItem icon={LayoutDashboard} label="Overview" active={activeView === "overview"} onClick={() => { setActiveView("overview"); setSidebarOpen(false); }} />
          <NavItem icon={ClipboardList} label="Case archives" active={activeView === "cases"} onClick={() => { setActiveView("cases"); setSidebarOpen(false); }} count={cases.length} />
          <NavItem icon={LockKeyhole} label="Authorized access" active={activeView === "access"} onClick={() => { setActiveView("access"); setSidebarOpen(false); }} />
          {canAdmin && <NavItem icon={Settings2} label="Admin console" active={activeView === "admin"} onClick={() => { setActiveView("admin"); setSidebarOpen(false); }} />}
        </nav>
        <div className="sidebar-bottom"><div className="security-note"><ShieldCheck size={17} /><div><strong>Protected session</strong><span>MFA verified</span></div></div><button className="sidebar-link" onClick={() => setStage("login")}><LogOut size={16} /> Sign out</button></div>
      </aside>
      {sidebarOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
      <main className="main-content">
        <header className="topbar"><button className="icon-button menu-button" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Open navigation"><Menu size={20} /></button><div className="breadcrumb"><span>Workspace</span><ChevronDown size={14} /><strong>{activeView === "overview" ? "Overview" : activeView === "cases" ? "Case archives" : activeView === "access" ? "Authorized access" : "Admin console"}</strong></div><div className="topbar-actions"><button className="icon-button" aria-label="Notifications"><Bell size={18} /><i /></button><div className="user-menu"><div className={`avatar ${currentRole.tone}`}>{currentRole.initials}</div><div className="user-copy"><strong>Arjun Rao</strong><span>{currentRole.label}</span></div><select value={role} onChange={(event) => { setRole(event.target.value); setActiveView("overview"); }} aria-label="Switch demo role"><option value="investigator">Investigator</option><option value="auditor">Auditor</option><option value="admin">Administrator</option></select></div></div></header>
        <div className="page-wrap">
          {activeView === "overview" && <Overview cases={filteredCases} search={search} setSearch={setSearch} onNewCase={() => setModal("case")} onOpenCases={() => setActiveView("cases")} />}
          {activeView === "cases" && <Cases cases={filteredCases} search={search} setSearch={setSearch} onNewCase={() => setModal("case")} onNotify={notify} />}
          {activeView === "access" && <Access grants={grants} onNewGrant={() => setModal("grant")} onNotify={notify} />}
          {activeView === "admin" && <Admin onNotify={notify} />}
        </div>
      </main>
      {modal === "case" && <Modal title="Create case archive" icon={ClipboardList} onClose={() => setModal(null)}><form className="modal-form" onSubmit={createCase}><label>Case number<input name="number" defaultValue="ANV-24-" required /></label><label>Case title<input name="title" placeholder="Enter a working title" required /></label><label>Brief description<textarea name="description" placeholder="Optional context for the archive" /></label><button className="primary-button" type="submit"><Plus size={17} /> Create archive</button></form></Modal>}
      {modal === "grant" && <Modal title="Issue access grant" icon={LockKeyhole} onClose={() => setModal(null)}><form className="modal-form" onSubmit={createGrant}><div className="form-grid"><label>Person<input name="person" placeholder="Full name" required /></label><label>Email<input name="email" type="email" placeholder="name@agency.gov" required /></label></div><label>Case scope<select name="scope" defaultValue="ANV-24-0187"><option>ANV-24-0187</option><option>ANV-24-0179</option><option>ANV-24-0164</option></select></label><div className="form-grid"><label>Department<input name="department" placeholder="Department" required /></label><label>Role<select name="grantRole" defaultValue="Investigator"><option>Investigator</option><option>Auditor</option><option>Administrator</option></select></label></div><div className="form-grid"><label>Access level<select name="level" defaultValue="Read"><option>Read</option><option>Write</option><option>Admin</option></select></label><label>Valid until<input name="expiry" type="date" required /></label></div><button className="primary-button" type="submit"><KeyRound size={17} /> Issue grant</button></form></Modal>}
      {toast && <div className="toast"><Check size={17} /> {toast}</div>}
    </div>
  );
}

function Login({ onContinue }) { return <div className="auth-shell"><PrototypeBanner /><div className="auth-panel"><div className="auth-brand"><div className="brand-mark">A</div><div><strong>ANVESHAN</strong><span>Evidence intelligence platform</span></div></div><div className="auth-intro"><div className="eyebrow">Secure investigator access</div><h1>Enter the evidence workspace.</h1><p>Review case archives, trace custody, and manage authorized access from one protected session.</p></div><form className="auth-form" onSubmit={(event) => { event.preventDefault(); onContinue("investigator"); }}><label>Agency email<input type="email" defaultValue="arjun.rao@agency.gov" required /></label><label>Password<div className="password-input"><input type="password" defaultValue="investigator" required /><Fingerprint size={18} /></div></label><div className="auth-row"><label className="check-label"><input type="checkbox" defaultChecked /> Remember this device</label><button type="button" className="text-button">Reset password</button></div><button className="primary-button auth-submit" type="submit">Continue <ArrowUpRight size={17} /></button></form><div className="prototype-logins"><span>Use a default prototype login</span><div><button type="button" onClick={() => onContinue("investigator")}>Investigator</button><button type="button" onClick={() => onContinue("auditor")}>Auditor</button><button type="button" onClick={() => onContinue("admin")}>Administrator</button></div></div><div className="auth-foot"><span><LockKeyhole size={14} /> End-to-end protected</span><span>Local preview</span></div></div><div className="auth-aside"><div className="aside-grid" /><div className="aside-copy"><span className="aside-kicker">Chain of custody</span><h2>Every record has a history.</h2><p>Immutable originals. Traceable handling. Access shaped by purpose.</p></div><div className="aside-stamp"><BadgeCheck size={18} /><span>Integrity first<br /><strong>V1 workspace</strong></span></div></div></div> }

function Mfa({ onVerified, onBack }) { const [code, setCode] = useState(""); return <div className="auth-shell"><PrototypeBanner /><div className="auth-panel mfa-panel"><button className="back-button" onClick={onBack}>Back to sign in</button><div className="mfa-icon"><Fingerprint size={25} /></div><div className="auth-intro"><div className="eyebrow">Step 2 of 2</div><h1>Verify your session.</h1><p>Enter the six-digit code from your registered authenticator to continue.</p></div><form className="auth-form" onSubmit={(event) => { event.preventDefault(); if (code.length >= 6) onVerified(); }}><label>Authentication code<input className="code-input" inputMode="numeric" maxLength="6" placeholder="000 000" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} autoFocus required /></label><button className="primary-button auth-submit" type="submit">Verify identity <ArrowUpRight size={17} /></button></form><div className="mfa-help"><span>Having trouble?</span><button className="text-button">Use a recovery code</button></div></div><div className="auth-aside mfa-aside"><div className="aside-grid" /><div className="aside-copy"><span className="aside-kicker">MFA required</span><h2>A quiet second check.</h2><p>Protected case access requires a verified identity and an active session.</p></div><div className="aside-stamp"><ShieldCheck size={18} /><span>Session status<br /><strong>Awaiting code</strong></span></div></div></div> }

function PrototypeBanner() { return <div className="prototype-banner">PROTOTYPE VERSION</div>; }

function Overview({ cases, search, setSearch, onNewCase, onOpenCases }) { return <><PageHeader eyebrow="Investigator workspace" title="Good evening, Arjun." description="A clear view of the cases and evidence that need your attention." action={<button className="primary-button" onClick={onNewCase}><Plus size={17} /> New case</button>} /><div className="metric-grid"><Metric icon={ClipboardList} label="Active cases" value="08" trend="+2 this month" tone="ink" /><Metric icon={FileCheck2} label="Evidence items" value="214" trend="99.8% integrity verified" tone="sage" /><Metric icon={LockKeyhole} label="Access grants" value="17" trend="2 expire this week" tone="amber" /><Metric icon={ShieldCheck} label="MFA coverage" value="100%" trend="Protected workspace" tone="coral" /></div><div className="content-grid"><section className="panel case-panel"><div className="panel-heading"><div><span className="section-label">Recent case activity</span><h2>Case archives</h2></div><button className="link-button" onClick={onOpenCases}>View all <ArrowUpRight size={15} /></button></div><div className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by case number or title" /></div><div className="case-list">{cases.map((item) => <CaseRow key={item.id} item={item} />)}</div></section><section className="panel attention-panel"><div className="panel-heading"><div><span className="section-label">Needs attention</span><h2>Review queue</h2></div><span className="queue-count">05</span></div><div className="queue-list"><QueueItem icon={FileCheck2} title="Integrity check complete" detail="ANV-24-0179 / version 04" tone="sage" /><QueueItem icon={Users} title="Access request pending" detail="North district procurement trail" tone="amber" /><QueueItem icon={ClipboardList} title="Timeline event added" detail="Riverside warehouse incident" tone="coral" /></div><button className="quiet-button">Open review queue <ArrowUpRight size={15} /></button></section></div></> }

function Cases({ cases, search, setSearch, onNewCase, onNotify }) { return <><PageHeader eyebrow="Evidence operations" title="Case archives" description="Every investigation starts with a controlled, traceable archive." action={<button className="primary-button" onClick={onNewCase}><Plus size={17} /> New case</button>} /><div className="toolbar"><div className="search-box wide"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search case archives" /></div><button className="filter-button">Status <ChevronDown size={15} /></button><button className="filter-button">Updated <ChevronDown size={15} /></button></div><section className="panel table-panel"><div className="table-wrap"><table><thead><tr><th>Archive</th><th>Status</th><th>Evidence</th><th>Last activity</th><th>Signal</th><th /></tr></thead><tbody>{cases.map((item) => <tr key={item.id}><td><strong>{item.number}</strong><span>{item.title}</span></td><td><StatusPill state={item.status} /></td><td>{item.evidence} items</td><td>{item.updated}</td><td><span className="table-signal"><span className="signal-dot" />{item.signal}</span></td><td><button className="row-action" onClick={() => onNotify(`Opening ${item.number}`)}><ArrowUpRight size={17} /></button></td></tr>)}</tbody></table></div></section></> }

function Access({ grants, onNewGrant, onNotify }) { return <><PageHeader eyebrow="Policy and permissions" title="Authorized access" description="Grant evidence access by case, purpose, role, and time window." action={<button className="primary-button" onClick={onNewGrant}><Plus size={17} /> New grant</button>} /><div className="access-summary"><div><span className="section-label">Access posture</span><strong>Controlled and reviewable</strong><p>Every grant is scoped, time-bound, and recorded against the case archive.</p></div><div className="access-stats"><span><b>{grants.filter((grant) => grant.state === "Active").length}</b> active</span><span><b>02</b> expiring soon</span><span><b>01</b> expired</span></div></div><section className="panel table-panel"><div className="panel-heading"><div><span className="section-label">Grant register</span><h2>People with access</h2></div><button className="icon-button" aria-label="Search grants"><Search size={17} /></button></div><div className="table-wrap"><table><thead><tr><th>Person</th><th>Role</th><th>Scope</th><th>Policy attributes</th><th>Level</th><th>Validity</th><th /></tr></thead><tbody>{grants.map((grant) => <tr key={grant.id}><td><div className="person-cell"><div className="mini-avatar">{grant.person.split(" ").map((part) => part[0]).join("")}</div><div><strong>{grant.person}</strong><span>{grant.email}</span></div></div></td><td>{grant.role}</td><td><strong>{grant.scope}</strong></td><td><span className="attribute-chip">{grant.department}</span></td><td><span className="level-text">{grant.level}</span></td><td><StatusPill state={grant.state} detail={grant.expiry} /></td><td><button className="row-action" onClick={() => onNotify(`Grant for ${grant.person} selected`)}><ArrowUpRight size={17} /></button></td></tr>)}</tbody></table></div></section></> }

function Admin({ onNotify }) { return <><PageHeader eyebrow="System administration" title="Admin console" description="Manage identity, role coverage, and platform guardrails." action={<button className="secondary-button" onClick={() => onNotify("System settings opened")}><Settings2 size={17} /> Settings</button>} /><div className="admin-grid"><AdminCard icon={Users} title="User directory" value="42" detail="3 pending invitations" action="Manage users" onClick={onNotify} /><AdminCard icon={KeyRound} title="Role coverage" value="04" detail="All privileged roles reviewed" action="Review roles" onClick={onNotify} /><AdminCard icon={ShieldCheck} title="Security controls" value="100%" detail="MFA required for sensitive access" action="View controls" onClick={onNotify} /></div><section className="panel audit-panel"><div className="panel-heading"><div><span className="section-label">System activity</span><h2>Recent administration</h2></div><button className="link-button" onClick={() => onNotify("Audit log opened")}>Full audit log <ArrowUpRight size={15} /></button></div><div className="audit-list"><AuditItem title="Access policy updated" detail="Arjun Rao changed sensitivity policy for Forensics" time="18 min ago" /><AuditItem title="Role assignment reviewed" detail="Auditor role reviewed for 4 active users" time="2 hr ago" /><AuditItem title="MFA enforcement confirmed" detail="Sensitive case access requires verified MFA" time="Yesterday" /></div></section></> }

function PageHeader({ eyebrow, title, description, action }) { return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div> }
function NavItem({ icon: Icon, label, active, onClick, count }) { return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}><Icon size={18} /><span>{label}</span>{count && <em>{count}</em>}</button> }
function Metric({ icon: Icon, label, value, trend, tone }) { return <div className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={19} /></div><span className="metric-label">{label}</span><strong>{value}</strong><span className="metric-trend">{trend}</span></div> }
function CaseRow({ item }) { return <div className="case-row"><div className="case-icon"><FileCheck2 size={18} /></div><div className="case-row-copy"><strong>{item.number}</strong><span>{item.title}</span></div><StatusPill state={item.status} /><span className="case-evidence">{item.evidence} evidence</span><ArrowUpRight className="row-arrow" size={17} /></div> }
function QueueItem({ icon: Icon, title, detail, tone }) { return <div className="queue-item"><div className={`queue-icon ${tone}`}><Icon size={17} /></div><div><strong>{title}</strong><span>{detail}</span></div><ArrowUpRight size={16} /></div> }
function StatusPill({ state, detail }) { return <span className={`status-pill ${state.toLowerCase()}`}><i />{state}{detail && <small>{detail}</small>}</span> }
function AdminCard({ icon: Icon, title, value, detail, action, onClick }) { return <div className="admin-card"><div className="admin-card-top"><div className="metric-icon sage"><Icon size={19} /></div><span>{title}</span></div><strong>{value}</strong><p>{detail}</p><button className="link-button" onClick={() => onClick(`${action} opened`)}>{action} <ArrowUpRight size={15} /></button></div> }
function AuditItem({ title, detail, time }) { return <div className="audit-item"><div className="audit-check"><Check size={14} /></div><div><strong>{title}</strong><span>{detail}</span></div><time>{time}</time></div> }
function Modal({ title, icon: Icon, children, onClose }) { return <div className="modal-backdrop" role="presentation"><div className="modal"><div className="modal-header"><div><div className="modal-icon"><Icon size={19} /></div><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></div>{children}</div></div> }

export default App;
