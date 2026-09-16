import React, { useEffect, useState } from "react";
import { api } from "./api";
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

const reviewItems = [
  { icon: FileCheck2, title: "Integrity check complete", detail: "ANV-24-0179 / version 04", tone: "sage" },
  { icon: Users, title: "Access request pending", detail: "North district procurement trail", tone: "amber" },
  { icon: ClipboardList, title: "Timeline event added", detail: "Riverside warehouse incident", tone: "coral" },
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
  const [mfaChallenge, setMfaChallenge] = useState(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [caseStatus, setCaseStatus] = useState("All");
  const [caseNewestFirst, setCaseNewestFirst] = useState(true);
  const [grantSearch, setGrantSearch] = useState("");
  const [grantStatus, setGrantStatus] = useState("All");

  useEffect(() => {
    if (stage !== "app") return;
    api.listCases().then((remoteCases) => {
      setCases(remoteCases.map((item) => ({
        id: item.id,
        number: item.case_number,
        title: item.title,
        status: item.status === "open" ? "Active" : item.status,
        evidence: 0,
        updated: "Just now",
        signal: "Archive loaded from API",
      })));
    }).catch(() => {
      notify("Showing local prototype cases");
    });
  }, [stage]);

  if (stage === "login") return <Login onContinue={(selectedRole) => { setRole(selectedRole); setStage("app"); }} onMfa={(challenge) => { setMfaChallenge(challenge); setStage("mfa"); }} onReset={() => setModal("reset")} />;
  if (stage === "mfa") return <Mfa challenge={mfaChallenge} onVerified={() => setStage("app")} onBack={() => { setMfaChallenge(null); setStage("login"); }} />;

  const currentRole = roles[role];
  const canAdmin = role === "admin";
  const filteredCases = cases.filter((item) => `${item.number} ${item.title}`.toLowerCase().includes(search.toLowerCase()) && (caseStatus === "All" || item.status === caseStatus));

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  async function switchRole(nextRole) {
    try {
      const result = await api.prototypeLogin(nextRole, nextRole);
      localStorage.setItem("anveshan_token", result.access_token);
      localStorage.setItem("anveshan_user_id", result.user.id);
      setRole(nextRole);
      setActiveView("overview");
    } catch {
      notify("Unable to switch prototype role");
    }
  }

  async function createCase(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const created = await api.createCase({ case_number: form.get("number"), title: form.get("title"), description: form.get("description") });
      setCases([{ id: created.id, number: created.case_number, title: created.title, status: "Active", evidence: 0, updated: "Just now", signal: "Created through API" }, ...cases]);
      setModal(null);
      notify("Case archive created");
    } catch {
      notify("Unable to create case archive");
    }
  }

  async function createGrant(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const caseId = cases[0]?.id;
    if (!caseId) {
      notify("Create or load a case before issuing access");
      return;
    }
    try {
      const created = await api.createGrant({
        user_id: localStorage.getItem("anveshan_user_id"),
        case_id: caseId,
        purpose: "Prototype access review",
        department: form.get("department"),
        access_level: String(form.get("level")).toLowerCase(),
        valid_until: new Date(`${form.get("expiry")}T23:59:59Z`).toISOString(),
      });
      setGrants([{
        id: created.id,
        person: form.get("person"),
        email: form.get("email"),
        role: form.get("grantRole"),
        scope: form.get("scope"),
        department: form.get("department"),
        level: form.get("level"),
        expiry: form.get("expiry"),
        state: "Active",
      }, ...grants]);
      setModal(null);
      notify("Access grant issued");
    } catch {
      notify("Unable to issue access grant");
    }
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
        <header className="topbar"><button className="icon-button menu-button" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Open navigation"><Menu size={20} /></button><div className="breadcrumb"><span>Workspace</span><ChevronDown size={14} /><strong>{activeView === "overview" ? "Overview" : activeView === "cases" ? "Case archives" : activeView === "access" ? "Authorized access" : "Admin console"}</strong></div><div className="topbar-actions"><div className="notification-wrap"><button className="icon-button" aria-label="Notifications" onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell size={18} /><i /></button>{notificationsOpen && <div className="notification-popover"><strong>Notifications</strong>{reviewItems.map((item) => <button key={item.title} onClick={() => { setNotificationsOpen(false); setModal({ type: "caseDetail", item: { number: item.detail.split(" /")[0], title: item.detail, status: "Review", evidence: 0, signal: item.title } }); }}>{item.title}<small>{item.detail}</small></button>)}</div>}</div><div className="user-menu"><div className={`avatar ${currentRole.tone}`}>{currentRole.initials}</div><div className="user-copy"><strong>Arjun Rao</strong><span>{currentRole.label}</span></div><select value={role} onChange={(event) => switchRole(event.target.value)} aria-label="Switch demo role"><option value="investigator">Investigator</option><option value="auditor">Auditor</option><option value="admin">Administrator</option></select></div></div></header>
        <div className="page-wrap">
          {activeView === "overview" && <Overview cases={filteredCases} search={search} setSearch={setSearch} onNewCase={() => setModal("case")} onOpenCases={() => setActiveView("cases")} onReview={() => setModal("review")} onOpenCase={(item) => setModal({ type: "caseDetail", item })} />}
          {activeView === "cases" && <Cases cases={filteredCases} search={search} setSearch={setSearch} onNewCase={() => setModal("case")} caseStatus={caseStatus} setCaseStatus={setCaseStatus} caseNewestFirst={caseNewestFirst} setCaseNewestFirst={setCaseNewestFirst} onOpenCase={(item) => setModal({ type: "caseDetail", item })} />}
          {activeView === "access" && <Access grants={grants} canManage={canAdmin} onNewGrant={() => setModal("grant")} onOpenGrant={(grant) => setModal({ type: "grantDetail", grant })} search={grantSearch} setSearch={setGrantSearch} filterState={grantStatus} setFilterState={setGrantStatus} />}
          {activeView === "admin" && <Admin onNotify={notify} />}
        </div>
      </main>
      {modal === "case" && <Modal title="Create case archive" icon={ClipboardList} onClose={() => setModal(null)}><form className="modal-form" onSubmit={createCase}><label>Case number<input name="number" defaultValue="ANV-24-" required /></label><label>Case title<input name="title" placeholder="Enter a working title" required /></label><label>Brief description<textarea name="description" placeholder="Optional context for the archive" /></label><button className="primary-button" type="submit"><Plus size={17} /> Create archive</button></form></Modal>}
      {modal === "grant" && <Modal title="Issue access grant" icon={LockKeyhole} onClose={() => setModal(null)}><form className="modal-form" onSubmit={createGrant}><div className="form-grid"><label>Person<input name="person" placeholder="Full name" required /></label><label>Email<input name="email" type="email" placeholder="name@agency.gov" required /></label></div><label>Case scope<select name="scope" defaultValue="ANV-24-0187"><option>ANV-24-0187</option><option>ANV-24-0179</option><option>ANV-24-0164</option></select></label><div className="form-grid"><label>Department<input name="department" placeholder="Department" required /></label><label>Role<select name="grantRole" defaultValue="Investigator"><option>Investigator</option><option>Auditor</option><option>Administrator</option></select></label></div><div className="form-grid"><label>Access level<select name="level" defaultValue="Read"><option>Read</option><option>Write</option><option>Admin</option></select></label><label>Valid until<input name="expiry" type="date" required /></label></div><button className="primary-button" type="submit"><KeyRound size={17} /> Issue grant</button></form></Modal>}
      {modal === "review" && <ReviewQueue items={reviewItems} onClose={() => setModal(null)} onOpenCase={(item) => setModal({ type: "caseDetail", item })} />}
      {modal === "reset" && <PasswordReset onClose={() => setModal(null)} onComplete={(message) => { setModal(null); notify(message); }} />}
      {modal?.type === "caseDetail" && <CaseDetail item={modal.item} onClose={() => setModal(null)} />}
      {modal?.type === "grantDetail" && <GrantDetail grant={modal.grant} onClose={() => setModal(null)} />}
      {toast && <div className="toast"><Check size={17} /> {toast}</div>}
    </div>
  );
}

function Login({ onContinue, onMfa, onReset }) { const [error, setError] = useState(""); const [loading, setLoading] = useState(false); async function demoLogin(role) { setLoading(true); try { const result = await api.prototypeLogin(role, role); localStorage.setItem("anveshan_token", result.access_token); localStorage.setItem("anveshan_user_id", result.user.id); onContinue(role); } catch { setError("Prototype login is unavailable. Start the backend on port 8000."); } finally { setLoading(false); } } async function login(event) { event.preventDefault(); setError(""); setLoading(true); const form = new FormData(event.currentTarget); try { const result = await api.login(form.get("email"), form.get("password")); if (result.mfa_required) onMfa(result.challenge_token); else { localStorage.setItem("anveshan_token", result.access_token); onContinue("investigator"); } } catch { setError("Unable to verify your credentials."); } finally { setLoading(false); } } return <div className="auth-shell"><PrototypeBanner /><div className="auth-panel"><div className="auth-brand"><div className="brand-mark">A</div><div><strong>ANVESHAN</strong><span>Evidence intelligence platform</span></div></div><div className="auth-intro"><div className="eyebrow">Secure investigator access</div><h1>Enter the evidence workspace.</h1><p>Review case archives, trace custody, and manage authorized access from one protected session.</p></div><form className="auth-form" onSubmit={login}><label>Agency email<input name="email" type="email" required /></label><label>Password<div className="password-input"><input name="password" type="password" required /><Fingerprint size={18} /></div></label><div className="auth-row"><label className="check-label"><input type="checkbox" defaultChecked /> Remember this device</label><button type="button" className="text-button" onClick={onReset}>Reset password</button></div><button className="primary-button auth-submit" type="submit" disabled={loading}>{loading ? "Connecting..." : "Continue"} {!loading && <ArrowUpRight size={17} />}</button></form><div className="prototype-logins"><span>Demo identities bypass MFA</span><div><button type="button" onClick={() => demoLogin("investigator")} disabled={loading}>Investigator</button><button type="button" onClick={() => demoLogin("auditor")} disabled={loading}>Auditor</button><button type="button" onClick={() => demoLogin("admin")} disabled={loading}>Administrator</button></div></div>{error && <p className="auth-error">{error}</p>}<div className="auth-foot"><span><LockKeyhole size={14} /> End-to-end protected</span><span>Local preview</span></div></div><div className="auth-aside"><div className="aside-grid" /><div className="aside-copy"><span className="aside-kicker">Chain of custody</span><h2>Every record has a history.</h2><p>Immutable originals. Traceable handling. Access shaped by purpose.</p></div><div className="aside-stamp"><BadgeCheck size={18} /><span>Integrity first<br /><strong>V1 workspace</strong></span></div></div></div> }

function Mfa({ challenge, onVerified, onBack }) { const [code, setCode] = useState(""); const [error, setError] = useState(""); const [verifying, setVerifying] = useState(false); async function verify(event) { event.preventDefault(); setVerifying(true); setError(""); try { const result = await api.verifyMfa(challenge, code); localStorage.setItem("anveshan_token", result.access_token); onVerified(); } catch { setError("That authentication code could not be verified."); } finally { setVerifying(false); } } return <div className="auth-shell"><PrototypeBanner /><div className="auth-panel mfa-panel"><button className="back-button" onClick={onBack}>Back to sign in</button><div className={`mfa-icon fingerprint-scan ${verifying ? "is-scanning" : ""}`}><Fingerprint size={25} /></div><div className="auth-intro"><div className="eyebrow">Step 2 of 2</div><h1>Verify your session.</h1><p>Enter the six-digit code from your registered authenticator to continue.</p></div><form className="auth-form" onSubmit={verify}><label>Authentication code<input className="code-input" inputMode="numeric" placeholder="000 000" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus required /></label><button className="primary-button auth-submit" type="submit" disabled={verifying}>{verifying ? "Verifying signature..." : "Verify identity"} <ArrowUpRight size={17} /></button></form>{error && <p className="auth-error">{error}</p>}<div className="mfa-help"><span>Having trouble?</span><button className="text-button">Use a recovery code</button></div></div><div className="auth-aside mfa-aside"><div className="aside-grid" /><div className="aside-copy"><span className="aside-kicker">MFA required</span><h2>A quiet second check.</h2><p>Protected case access requires a verified identity and an active session.</p></div><div className="aside-stamp"><ShieldCheck size={18} /><span>Session status<br /><strong>{verifying ? "Verifying" : "Awaiting code"}</strong></span></div></div></div> }

function PrototypeBanner() { return <div className="prototype-banner">PROTOTYPE VERSION</div>; }

function Overview({ cases, search, setSearch, onNewCase, onOpenCases, onReview, onOpenCase }) { return <><PageHeader eyebrow="Investigator workspace" title="Good evening, Arjun." description="A clear view of the cases and evidence that need your attention." action={<button className="primary-button" onClick={onNewCase}><Plus size={17} /> New case</button>} /><div className="metric-grid"><Metric icon={ClipboardList} label="Active cases" value="08" trend="+2 this month" tone="ink" /><Metric icon={FileCheck2} label="Evidence items" value="214" trend="99.8% integrity verified" tone="sage" /><Metric icon={LockKeyhole} label="Access grants" value="17" trend="2 expire this week" tone="amber" /><Metric icon={ShieldCheck} label="MFA coverage" value="100%" trend="Protected workspace" tone="coral" /></div><div className="content-grid"><section className="panel case-panel"><div className="panel-heading"><div><span className="section-label">Recent case activity</span><h2>Case archives</h2></div><button className="link-button" onClick={onOpenCases}>View all <ArrowUpRight size={15} /></button></div><div className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by case number or title" /></div><div className="case-list">{cases.map((item) => <CaseRow key={item.id} item={item} onOpen={() => onOpenCase(item)} />)}</div></section><section className="panel attention-panel"><div className="panel-heading"><div><span className="section-label">Needs attention</span><h2>Review queue</h2></div><span className="queue-count">{reviewItems.length}</span></div><div className="queue-list">{reviewItems.map((item) => <QueueItem key={item.title} {...item} onClick={() => onOpenCase({ number: item.detail.split(" /")[0], title: item.detail, status: "Review", evidence: 0, signal: item.title })} />)}</div><button className="quiet-button" onClick={onReview}>Open review queue <ArrowUpRight size={15} /></button></section></div></> }

function Cases({ cases, search, setSearch, onNewCase, caseStatus, setCaseStatus, caseNewestFirst, setCaseNewestFirst, onOpenCase }) { const ordered = [...cases].sort((a, b) => caseNewestFirst ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id)); return <><PageHeader eyebrow="Evidence operations" title="Case archives" description="Every investigation starts with a controlled, traceable archive." action={<button className="primary-button" onClick={onNewCase}><Plus size={17} /> New case</button>} /><div className="toolbar"><div className="search-box wide"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search case archives" /></div><button className="filter-button" onClick={() => setCaseStatus(caseStatus === "All" ? "Active" : caseStatus === "Active" ? "Review" : "All")}>Status: {caseStatus} <ChevronDown size={15} /></button><button className="filter-button" onClick={() => setCaseNewestFirst(!caseNewestFirst)}>{caseNewestFirst ? "Newest" : "Oldest"} <ChevronDown size={15} /></button></div><section className="panel table-panel"><div className="table-wrap"><table><thead><tr><th>Archive</th><th>Status</th><th>Evidence</th><th>Last activity</th><th>Signal</th><th /></tr></thead><tbody>{ordered.map((item) => <tr key={item.id} onClick={() => onOpenCase(item)} className="interactive-row"><td><strong>{item.number}</strong><span>{item.title}</span></td><td><StatusPill state={item.status} /></td><td>{item.evidence} items</td><td>{item.updated}</td><td><span className="table-signal"><span className="signal-dot" />{item.signal}</span></td><td><button className="row-action" aria-label={`Open ${item.number}`} onClick={(event) => { event.stopPropagation(); onOpenCase(item); }}><ArrowUpRight size={17} /></button></td></tr>)}</tbody></table></div></section></> }

function Access({ grants, canManage, onNewGrant, onOpenGrant, search, setSearch, filterState, setFilterState }) { const visible = grants.filter((grant) => `${grant.person} ${grant.email} ${grant.scope} ${grant.department}`.toLowerCase().includes(search.toLowerCase()) && (filterState === "All" || grant.state === filterState)); return <><PageHeader eyebrow="Policy and permissions" title="Authorized access" description="Grant evidence access by case, purpose, role, and time window." action={canManage ? <button className="primary-button" onClick={onNewGrant}><Plus size={17} /> New grant</button> : <span className="access-readonly"><LockKeyhole size={14} /> Read-only review</span>} /><div className="access-summary"><div><span className="section-label">Access posture</span><strong>Controlled and reviewable</strong><p>Every grant is scoped, time-bound, and recorded against the case archive.</p></div><div className="access-stats"><span><b>{grants.filter((grant) => grant.state === "Active").length}</b> active</span><span><b>02</b> expiring soon</span><span><b>01</b> expired</span></div></div><section className="panel table-panel"><div className="panel-heading"><div><span className="section-label">Grant register</span><h2>People with access</h2></div><div className="grant-tools"><div className="search-box"><Search size={17} /><input aria-label="Search grants" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search grants" /></div><button className="filter-button" onClick={() => setFilterState(filterState === "All" ? "Active" : filterState === "Active" ? "Expired" : "All")}>{filterState} <ChevronDown size={15} /></button></div></div><div className="table-wrap"><table><thead><tr><th>Person</th><th>Role</th><th>Scope</th><th>Policy attributes</th><th>Level</th><th>Validity</th><th /></tr></thead><tbody>{visible.map((grant) => <tr key={grant.id} onClick={() => onOpenGrant(grant)} className="interactive-row"><td><div className="person-cell"><div className="mini-avatar">{grant.person.split(" ").map((part) => part[0]).join("")}</div><div><strong>{grant.person}</strong><span>{grant.email}</span></div></div></td><td>{grant.role}</td><td><strong>{grant.scope}</strong></td><td><span className="attribute-chip">{grant.department}</span></td><td><span className="level-text">{grant.level}</span></td><td><StatusPill state={grant.state} detail={grant.expiry} /></td><td><button className="row-action" aria-label={`Open grant for ${grant.person}`} onClick={(event) => { event.stopPropagation(); onOpenGrant(grant); }}><ArrowUpRight size={17} /></button></td></tr>)}</tbody></table></div></section></> }

function Admin({ onNotify }) { return <><PageHeader eyebrow="System administration" title="Admin console" description="Manage identity, role coverage, and platform guardrails." action={<button className="secondary-button" onClick={() => onNotify("System settings opened")}><Settings2 size={17} /> Settings</button>} /><div className="admin-grid"><AdminCard icon={Users} title="User directory" value="42" detail="3 pending invitations" action="Manage users" onClick={onNotify} /><AdminCard icon={KeyRound} title="Role coverage" value="04" detail="All privileged roles reviewed" action="Review roles" onClick={onNotify} /><AdminCard icon={ShieldCheck} title="Security controls" value="100%" detail="MFA required for sensitive access" action="View controls" onClick={onNotify} /></div><section className="panel audit-panel"><div className="panel-heading"><div><span className="section-label">System activity</span><h2>Recent administration</h2></div><button className="link-button" onClick={() => onNotify("Audit log opened")}>Full audit log <ArrowUpRight size={15} /></button></div><div className="audit-list"><AuditItem title="Access policy updated" detail="Arjun Rao changed sensitivity policy for Forensics" time="18 min ago" /><AuditItem title="Role assignment reviewed" detail="Auditor role reviewed for 4 active users" time="2 hr ago" /><AuditItem title="MFA enforcement confirmed" detail="Sensitive case access requires verified MFA" time="Yesterday" /></div></section></> }

function ReviewQueue({ items, onClose, onOpenCase }) { return <Modal title="Review queue" icon={ClipboardList} onClose={onClose}><div className="review-queue">{items.map((item) => <button key={item.title} className="review-row" onClick={() => onOpenCase({ number: item.detail.split(" /")[0], title: item.detail, status: "Review", evidence: 0, signal: item.title })}><div className={`queue-icon ${item.tone}`}><item.icon size={17} /></div><div><strong>{item.title}</strong><span>{item.detail}</span></div><ArrowUpRight size={16} /></button>)}</div></Modal> }
function CaseDetail({ item, onClose }) { return <Modal title={item.number || "Case archive"} icon={ClipboardList} onClose={onClose}><div className="detail-stack"><span className="eyebrow">Controlled archive</span><h3>{item.title}</h3><StatusPill state={item.status || "Review"} /><p>This archive is ready for document operations, integrity checks, and authorized review.</p><div className="detail-grid"><span>Evidence<strong>{item.evidence ?? 0} items</strong></span><span>Latest signal<strong>{item.signal || "No new activity"}</strong></span></div><button className="primary-button" onClick={onClose}>Close archive view</button></div></Modal> }
function GrantDetail({ grant, onClose }) { return <Modal title="Access grant" icon={LockKeyhole} onClose={onClose}><div className="detail-stack"><span className="eyebrow">Purpose-bound access</span><h3>{grant.person}</h3><p>{grant.email}</p><div className="detail-grid"><span>Scope<strong>{grant.scope}</strong></span><span>Department<strong>{grant.department}</strong></span><span>Level<strong>{grant.level}</strong></span><span>Validity<strong>{grant.expiry}</strong></span></div><button className="primary-button" onClick={onClose}>Close grant view</button></div></Modal> }
function PasswordReset({ onClose, onComplete }) { const [email, setEmail] = useState(""); const [token, setToken] = useState(""); const [password, setPassword] = useState(""); const [requested, setRequested] = useState(false); const [error, setError] = useState(""); async function request(event) { event.preventDefault(); setError(""); try { const result = await api.requestPasswordReset(email); setToken(result.development_reset_token || ""); setRequested(true); } catch { setError("Unable to start password reset."); } } async function confirm(event) { event.preventDefault(); setError(""); try { const result = await api.confirmPasswordReset(token, password); onComplete(result.message); } catch { setError("The reset token is invalid or the password is too short."); } } return <Modal title="Reset password" icon={KeyRound} onClose={onClose}>{!requested ? <form className="modal-form" onSubmit={request}><p>Enter your agency email to issue a short-lived reset instruction.</p><label>Agency email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><button className="primary-button" type="submit">Issue reset instruction</button></form> : <form className="modal-form" onSubmit={confirm}><p>{token ? "Development reset token issued. Choose a new password." : "Check your approved agency mailbox for the reset token."}</p><label>Reset token<input value={token} onChange={(event) => setToken(event.target.value)} required /></label><label>New password<input type="password" minLength="12" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button className="primary-button" type="submit">Update password</button></form>}{error && <p className="auth-error">{error}</p>}</Modal> }

function PageHeader({ eyebrow, title, description, action }) { return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div> }
function NavItem({ icon: Icon, label, active, onClick, count }) { return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}><Icon size={18} /><span>{label}</span>{count && <em>{count}</em>}</button> }
function Metric({ icon: Icon, label, value, trend, tone }) { return <div className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={19} /></div><span className="metric-label">{label}</span><strong>{value}</strong><span className="metric-trend">{trend}</span></div> }
function CaseRow({ item, onOpen }) { return <div className="case-row" onClick={onOpen}><div className="case-icon"><FileCheck2 size={18} /></div><div className="case-row-copy"><strong>{item.number}</strong><span>{item.title}</span></div><StatusPill state={item.status} /><span className="case-evidence">{item.evidence} evidence</span><ArrowUpRight className="row-arrow" size={17} /></div> }
function QueueItem({ icon: Icon, title, detail, tone, onClick }) { return <button className="queue-item" onClick={onClick} style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer' }}><div className={`queue-icon ${tone}`}><Icon size={17} /></div><div><strong>{title}</strong><span>{detail}</span></div><ArrowUpRight size={16} /></button> }
function StatusPill({ state, detail }) { return <span className={`status-pill ${state.toLowerCase()}`}><i />{state}{detail && <small>{detail}</small>}</span> }
function AdminCard({ icon: Icon, title, value, detail, action, onClick }) { return <div className="admin-card"><div className="admin-card-top"><div className="metric-icon sage"><Icon size={19} /></div><span>{title}</span></div><strong>{value}</strong><p>{detail}</p><button className="link-button" onClick={() => onClick(`${action} opened`)}>{action} <ArrowUpRight size={15} /></button></div> }
function AuditItem({ title, detail, time }) { return <div className="audit-item"><div className="audit-check"><Check size={14} /></div><div><strong>{title}</strong><span>{detail}</span></div><time>{time}</time></div> }
function Modal({ title, icon: Icon, children, onClose }) { return <div className="modal-backdrop" role="presentation"><div className="modal"><div className="modal-header"><div><div className="modal-icon"><Icon size={19} /></div><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></div>{children}</div></div> }

export default App;
