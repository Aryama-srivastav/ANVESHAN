import React, { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type Toast = { id: number; title: string; message?: string; kind: 'success' | 'info' | 'warning' | 'alert' };

type Store = {
  loading: boolean;
  error: string | null;
  cases: any[];
  documents: any[];
  blocks: any[];
  transactions: any[];
  audit: any[];
  shares: any[];
  users: any[];
  notifications: any[];
  toasts: Toast[];
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  refresh: (silent?: boolean) => Promise<void>;
  api: (resource: string, method: string, body?: any) => Promise<any>;
  currentUser: any;
  setCurrentUser: (u: any) => void;
  unreadCount: number;
  markAllRead: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('store missing');
  return v;
};

const RESOURCES = ['cases', 'documents', 'blocks', 'transactions', 'audit', 'shares', 'users', 'notifications'];

const getFallbackData = () => ({
  cases: [
    { id: 1, case_number: 'CASE-2026-0147', title: 'Statewide Electoral Integrity Review', description: 'Cross-jurisdiction suspicious entry and impersonation analysis across district records.', classification: 'Restricted', status: 'Active', officer: 'Ananya Sharma', department: 'Cyber Crime Wing', doc_count: 4, last_activity: new Date(Date.now() - 1000 * 60 * 22).toISOString() },
    { id: 2, case_number: 'CASE-2026-0181', title: 'Forgery Network — Land Registry Files', description: 'Investigation into forged property transfer documents and registry sequencing anomalies.', classification: 'Confidential', status: 'Under Review', officer: 'Vikram Singh', department: 'Economic Offences', doc_count: 3, last_activity: new Date(Date.now() - 1000 * 60 * 65).toISOString() },
    { id: 3, case_number: 'CASE-2026-0206', title: 'Digital Evidence Chain-of-Custody', description: 'High-sensitivity forensic reconstruction for mobile and system records.', classification: 'Top Secret', status: 'Sealed', officer: 'Meera Nair', department: 'Forensic Lab', doc_count: 5, last_activity: new Date(Date.now() - 1000 * 60 * 120).toISOString() },
    { id: 4, case_number: 'CASE-2026-0215', title: 'Infrastructure Bribery Records', description: 'Review of procurement records, recipient registers and shared digital archives.', classification: 'Internal', status: 'Pending Verification', officer: 'Rahul Yadav', department: 'Anti-Corruption Cell', doc_count: 2, last_activity: new Date(Date.now() - 1000 * 60 * 290).toISOString() },
  ],
  documents: [
    { id: 'DOC-20260448', filename: 'CDR_Analysis_March.xlsx', file_type: 'xlsx', case_number: 'CASE-2026-0147', ref_number: 'REF-0147-03', integrity_status: 'Mismatch', sha256: 'b2bcf6d6b0c55a5abc63d3c8b637b91ef8e01dd1f7bc6249d5f6a428ddc9d2a7', tx_id: 'TX-38BAAB4F', version: 'v3.2', updated_at: new Date(Date.now() - 1000 * 60 * 18).toISOString() },
    { id: 'DOC-20260611', filename: 'KYC_Affidavits_01.pdf', file_type: 'pdf', case_number: 'CASE-2026-0147', ref_number: 'REF-0147-11', integrity_status: 'Verified', sha256: '9bd0fbc3771f9222b5e87088dc9d7fbca3038479b1210c7051f78f8f911f5d26', tx_id: 'TX-1A11C6D2', version: 'v1.0', updated_at: new Date(Date.now() - 1000 * 60 * 53).toISOString() },
    { id: 'DOC-20260621', filename: 'Asset_Transfer_Chain.pdf', file_type: 'pdf', case_number: 'CASE-2026-0181', ref_number: 'REF-0181-02', integrity_status: 'Verified', sha256: '1ff1d7bb743f8d7fe3dcf6d6151a5d1b8480ce3d0f7fd0c0da0e97d8af13d85d', tx_id: 'TX-7DAA8D5C', version: 'v2.1', updated_at: new Date(Date.now() - 1000 * 60 * 88).toISOString() },
    { id: 'DOC-20260713', filename: 'Scene_Logs_Alpha.mov', file_type: 'mov', case_number: 'CASE-2026-0206', ref_number: 'REF-0206-08', integrity_status: 'Pending', sha256: '2c8a3a6a9b13114d5d4d632b335496d7b90d59e38d0c5626d4838e3155ed9b77', tx_id: 'TX-E3819F25', version: 'v1.1', updated_at: new Date(Date.now() - 1000 * 60 * 164).toISOString() },
    { id: 'DOC-20260742', filename: 'Procurement_Registers.xlsx', file_type: 'xlsx', case_number: 'CASE-2026-0215', ref_number: 'REF-0215-17', integrity_status: 'Verified', sha256: '816b84f70dcf4ea2e7cb6f9a14b0a0a6d1bfd2d8243cedb9fb7a7d2ec3b4cd8b', tx_id: 'TX-FC41C386', version: 'v4.0', updated_at: new Date(Date.now() - 1000 * 60 * 330).toISOString() },
  ],
  blocks: [
    { block_number: 48291, hash: '0xeb4d9546f2b9ceca8df3fdb2d7370b88741c3d5d2f6f1d39d6f7b6a4c5656211', tx_count: 14, timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString() },
    { block_number: 48290, hash: '0xbaf31ed95c0f4f53d16c71032a2c5771712ff0a2efebcbddcad6cdaa1f6be984', tx_count: 12, timestamp: new Date(Date.now() - 1000 * 60 * 190).toISOString() },
    { block_number: 48289, hash: '0x4ec69dcc15d9857b70f0cf0d1fa7ac9fc5232e9d9230e8ca33ed2d64d392005c', tx_count: 17, timestamp: new Date(Date.now() - 1000 * 60 * 280).toISOString() },
  ],
  transactions: [
    { tx_id: 'TX-1A11C6D2', doc_id: 'DOC-20260611', doc_name: 'KYC_Affidavits_01.pdf', case_number: 'CASE-2026-0147', hash: '9bd0fbc3771f9222b5e87088dc9d7fbca3038479b1210c7051f78f8f911f5d26', timestamp: new Date(Date.now() - 1000 * 60 * 53).toISOString(), status: 'Anchored', actor: 'System', block_number: 48291 },
    { tx_id: 'TX-38BAAB4F', doc_id: 'DOC-20260448', doc_name: 'CDR_Analysis_March.xlsx', case_number: 'CASE-2026-0147', hash: 'b2bcf6d6b0c55a5abc63d3c8b637b91ef8e01dd1f7bc6249d5f6a428ddc9d2a7', timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(), status: 'Failed', actor: 'Ananya Sharma', block_number: 48290 },
    { tx_id: 'TX-7DAA8D5C', doc_id: 'DOC-20260621', doc_name: 'Asset_Transfer_Chain.pdf', case_number: 'CASE-2026-0181', hash: '1ff1d7bb743f8d7fe3dcf6d6151a5d1b8480ce3d0f7fd0c0da0e97d8af13d85d', timestamp: new Date(Date.now() - 1000 * 60 * 88).toISOString(), status: 'Anchored', actor: 'Vikram Singh', block_number: 48289 },
    { tx_id: 'TX-E3819F25', doc_id: 'DOC-20260713', doc_name: 'Scene_Logs_Alpha.mov', case_number: 'CASE-2026-0206', hash: '2c8a3a6a9b13114d5d4d632b335496d7b90d59e38d0c5626d4838e3155ed9b77', timestamp: new Date(Date.now() - 1000 * 60 * 164).toISOString(), status: 'Pending', actor: 'Meera Nair', block_number: 48288 },
    { tx_id: 'TX-FC41C386', doc_id: 'DOC-20260742', doc_name: 'Procurement_Registers.xlsx', case_number: 'CASE-2026-0215', hash: '816b84f70dcf4ea2e7cb6f9a14b0a0a6d1bfd2d8243cedb9fb7a7d2ec3b4cd8b', timestamp: new Date(Date.now() - 1000 * 60 * 330).toISOString(), status: 'Anchored', actor: 'Rahul Yadav', block_number: 48291 },
  ],
  audit: [
    { id: 1, actor: 'Ananya Sharma', action: 'Login', resource: 'VERITAS Console', resource_id: 'SESSION', result: 'Success', reference: 'MFA-OK', details: 'Successful login with MFA challenge issued to registered device.', timestamp: new Date(Date.now() - 1000 * 60 * 9).toISOString() },
    { id: 2, actor: 'System', action: 'Hash Generation', resource: 'CDR_Analysis_March.xlsx', resource_id: 'DOC-20260448', result: 'Mismatch', reference: 'TX-38BAAB4F', details: 'Document hash differs from registered ledger record and requires investigation.', timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString() },
    { id: 3, actor: 'Vikram Singh', action: 'Share', resource: 'Asset_Transfer_Chain.pdf', resource_id: 'DOC-20260621', result: 'Success', reference: 'SHR-104', details: 'Shared with external counsel under legal review access profile.', timestamp: new Date(Date.now() - 1000 * 60 * 78).toISOString() },
    { id: 4, actor: 'Meera Nair', action: 'Verification', resource: 'Scene_Logs_Alpha.mov', resource_id: 'DOC-20260713', result: 'Pending', reference: 'TX-E3819F25', details: 'Cryptographic verification pending consensus approval.', timestamp: new Date(Date.now() - 1000 * 60 * 166).toISOString() },
  ],
  shares: [
    { id: 101, doc_id: 'DOC-20260621', doc_name: 'Asset_Transfer_Chain.pdf', recipient: 'Legal Team', permission: 'Read only', expiry: '14 days', status: 'Active', created_by: 'Vikram Singh', created_at: new Date(Date.now() - 1000 * 60 * 250).toISOString() },
    { id: 102, doc_id: 'DOC-20260448', doc_name: 'CDR_Analysis_March.xlsx', recipient: 'Forensic Review', permission: 'Review + export', expiry: 'Custom (7d)', status: 'Expiring Soon', created_by: 'Ananya Sharma', created_at: new Date(Date.now() - 1000 * 60 * 500).toISOString() },
    { id: 103, doc_id: 'DOC-20260742', doc_name: 'Procurement_Registers.xlsx', recipient: 'Audit Board', permission: 'Read only', expiry: '30 days', status: 'Revoked', created_by: 'Rahul Yadav', created_at: new Date(Date.now() - 1000 * 60 * 1700).toISOString() },
  ],
  users: [
    { id: 1, name: 'Ananya Sharma', role: 'Investigating Officer', email: 'ananya.sharma@veritas.gov.in', department: 'Cyber Crime Wing', status: 'Active', mfa: 'Enabled', last_login: new Date(Date.now() - 1000 * 60 * 12).toISOString(), cases_assigned: 4 },
    { id: 2, name: 'Vikram Singh', role: 'Legal Officer', email: 'vikram.singh@veritas.gov.in', department: 'Legal Division', status: 'Active', mfa: 'Enabled', last_login: new Date(Date.now() - 1000 * 60 * 43).toISOString(), cases_assigned: 2 },
    { id: 3, name: 'Meera Nair', role: 'Forensic Officer', email: 'meera.nair@veritas.gov.in', department: 'Forensic Lab', status: 'Active', mfa: 'Enabled', last_login: new Date(Date.now() - 1000 * 60 * 76).toISOString(), cases_assigned: 3 },
    { id: 4, name: 'Aisha Khan', role: 'Auditor', email: 'aisha.khan@veritas.gov.in', department: 'Internal Audit', status: 'Active', mfa: 'Enabled', last_login: new Date(Date.now() - 1000 * 60 * 130).toISOString(), cases_assigned: 1 },
    { id: 5, name: 'Rohit Verma', role: 'Administrator', email: 'rohit.verma@veritas.gov.in', department: 'Operations', status: 'Active', mfa: 'Enabled', last_login: new Date(Date.now() - 1000 * 60 * 335).toISOString(), cases_assigned: 6 },
  ],
  notifications: [
    { id: 1, title: 'Ledger sync healthy', message: 'Node DL-04 is synced and all critical services remain operational.', type: 'success', time: new Date(Date.now() - 1000 * 60 * 7).toISOString(), read: false, link: 'ledger' },
    { id: 2, title: 'Integrity review required', message: 'CDR_Analysis_March.xlsx no longer matches its ledger record.', type: 'alert', time: new Date(Date.now() - 1000 * 60 * 20).toISOString(), read: false, link: 'verify' },
    { id: 3, title: 'New access grant', message: 'Asset_Transfer_Chain.pdf has been shared with Legal Team.', type: 'info', time: new Date(Date.now() - 1000 * 60 * 84).toISOString(), read: true, link: 'sharing' },
  ],
});

async function fetchResource(resource: string) {
  try {
    const r = await fetch(`/api/data?resource=${resource}`);
    if (!r.ok) throw new Error(`Failed to load ${resource}`);
    const contentType = r.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) throw new Error(`No JSON API for ${resource}`);
    const j = await r.json();
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [shares, setShares] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [currentUser, setCurrentUserState] = useState<any>(() => {
    try {
      const raw = localStorage.getItem('veritas_user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const toastId = useRef(1);

  const pushToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = toastId.current++;
    setToasts((p) => [...p.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 5200);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((p) => p.filter((x) => x.id !== id)), []);

  const setCurrentUser = useCallback((u: any) => {
    setCurrentUserState(u);
    try {
      if (u) localStorage.setItem('veritas_user', JSON.stringify(u));
      else localStorage.removeItem('veritas_user');
    } catch {}
  }, []);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [c, d, b, t, a, s, u, n] = await Promise.all(RESOURCES.map(fetchResource));
      const allEmpty = [c, d, b, t, a, s, u, n].every((arr) => arr.length === 0);
      const data = allEmpty ? getFallbackData() : { cases: c, documents: d, blocks: b, transactions: t, audit: a, shares: s, users: u, notifications: n };

      setCases(data.cases); setDocuments(data.documents); setBlocks(data.blocks); setTransactions(data.transactions);
      setAudit(data.audit); setShares(data.shares); setUsers(data.users); setNotifications(data.notifications);
      if (allEmpty) {
        setError(null);
      }
    } catch (e: any) {
      const fallback = getFallbackData();
      setCases(fallback.cases); setDocuments(fallback.documents); setBlocks(fallback.blocks); setTransactions(fallback.transactions);
      setAudit(fallback.audit); setShares(fallback.shares); setUsers(fallback.users); setNotifications(fallback.notifications);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const api = useCallback(async (resource: string, method: string, body?: any) => {
    const r = await fetch(`/api/data?resource=${resource}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error || `API ${method} ${resource} failed`);
    }
    return r.json().catch(() => ({}));
  }, []);

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.read);
    await Promise.all(unread.map((n) => api('notifications', 'PUT', { idCol: 'id', idVal: n.id, patch: { read: true } }).catch(() => null)));
    setNotifications((p) => p.map((n) => ({ ...n, read: true })));
  }, [notifications, api]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value: Store = {
    loading, error, cases, documents, blocks, transactions, audit, shares, users, notifications,
    toasts, pushToast, dismissToast, refresh, api, currentUser, setCurrentUser, unreadCount, markAllRead,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
