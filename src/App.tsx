import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { StoreProvider, useStore } from './store';
import Shell from './components/Shell';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cases from './pages/Cases';
import CaseDetail from './pages/CaseDetail';
import Documents from './pages/Documents';
import DocumentDetail from './pages/DocumentDetail';
import Upload from './pages/Upload';
import Verify from './pages/Verify';
import Sharing from './pages/Sharing';
import Audit from './pages/Audit';
import Ledger, { TransactionDetail } from './pages/Ledger';
import Users from './pages/Users';
import Settings from './pages/Settings';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';
import { cx } from './lib/utils';

function Guard({ children }: { children: React.ReactNode }) {
  const { currentUser } = useStore();
  const loc = useLocation();
  if (!currentUser) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

function Toasts() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[80] flex w-[340px] max-w-[calc(100vw-40px)] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="v-fade-up pointer-events-auto flex items-start gap-2.5 rounded-lg border border-[#e1e7ef] bg-white px-3.5 py-3 shadow-[0_4px_16px_rgba(10,35,66,0.10)]">
          <span className={cx('mt-0.5 shrink-0', t.kind === 'success' ? 'text-[#2c6b45]' : t.kind === 'warning' ? 'text-[#8a6116]' : t.kind === 'alert' ? 'text-[#93312a]' : 'text-[#2456c6]')}>
            {t.kind === 'success' ? <CheckCircle2 size={16} /> : t.kind === 'warning' ? <AlertTriangle size={16} /> : t.kind === 'alert' ? <XCircle size={16} /> : <Info size={16} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-semibold text-[#1c2c46]">{t.title}</span>
            {t.message && <span className="block truncate text-[12px] text-[#5d6d84]">{t.message}</span>}
          </span>
          <button onClick={() => dismissToast(t.id)} className="rounded p-1 text-[#8a96ad] hover:bg-[#eef1f6]" aria-label="Dismiss"><X size={13} /></button>
        </div>
      ))}
    </div>
  );
}

function Boot() {
  const { loading, error, refresh } = useStore();
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2.5 bg-[#edf0f5]">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0a2342] text-white"><span className="v-spin h-5 w-5 rounded-full border-2 border-white/30 border-t-white" /></span>
        <p className="text-[14px] font-bold text-[#0a2342]">VERITAS</p>
        <p className="mono text-[11px] text-[#68778e]">Connecting to Sovereign Node DL-04…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#edf0f5] px-4">
        <div className="v-card max-w-md p-6 text-center">
          <p className="text-[15px] font-semibold text-[#1c2c46]">Could not reach VERITAS data services</p>
          <p className="mono mt-1 break-all text-[11.5px] text-[#68778e]">{error}</p>
          <button onClick={() => refresh()} className="v-btn-primary mx-auto mt-4">Retry connection</button>
        </div>
      </div>
    );
  }
  return null;
}

function AppRoutes() {
  const { loading, error } = useStore();
  if (loading || error) return <Boot />;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Guard><Shell><Dashboard /></Shell></Guard>} />
      <Route path="/cases" element={<Guard><Shell><Cases /></Shell></Guard>} />
      <Route path="/cases/:id" element={<Guard><Shell><CaseDetail /></Shell></Guard>} />
      <Route path="/documents" element={<Guard><Shell><Documents /></Shell></Guard>} />
      <Route path="/documents/:id" element={<Guard><Shell><DocumentDetail /></Shell></Guard>} />
      <Route path="/upload" element={<Guard><Shell><Upload /></Shell></Guard>} />
      <Route path="/verify" element={<Guard><Shell><Verify /></Shell></Guard>} />
      <Route path="/sharing" element={<Guard><Shell><Sharing /></Shell></Guard>} />
      <Route path="/audit" element={<Guard><Shell><Audit /></Shell></Guard>} />
      <Route path="/ledger" element={<Guard><Shell><Ledger /></Shell></Guard>} />
      <Route path="/ledger/:txId" element={<Guard><Shell><TransactionDetail /></Shell></Guard>} />
      <Route path="/users" element={<Guard><Shell><Users /></Shell></Guard>} />
      <Route path="/settings" element={<Guard><Shell><Settings /></Shell></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <StoreProvider>
        <AppRoutes />
        <Toasts />
      </StoreProvider>
    </HashRouter>
  );
}
