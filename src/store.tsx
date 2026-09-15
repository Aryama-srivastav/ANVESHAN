/* eslint-disable react-refresh/only-export-components */

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  isSupabaseConfigured,
  sessionToCurrentUser,
  supabase,
  testSupabaseConnection,
} from './lib/supabase';
import { fetchSupabaseResources } from './lib/data';

export type Toast = {
  id: number;
  title: string;
  message?: string;
  kind: 'success' | 'info' | 'warning' | 'alert';
};

export type CurrentUser = {
  id?: number | string;
  name?: string;
  role?: string;
  email?: string;
  department?: string;
  status?: string;
  mfa?: string;
  last_login?: string;
  cases_assigned?: number;
};

export type AppCase = {
  id: string;
  case_number: string;
  title: string;
  description: string;
  classification: string;
  status: string;
  officer: string;
  department: string;
  doc_count: number;
  last_activity: string;
};

export type AppDocument = {
  id: string;
  case_id?: string;
  filename: string;
  file_type: string;
  case_number: string;
  ref_number: string;
  integrity_status: string;
  sha256: string;
  tx_id: string;
  version: string;
  updated_at: string;
  description?: string;
  classification?: string;
  size_text?: string;
  uploader?: string;
  tags?: string;
};

export type BlockItem = {
  block_number: number;
  hash: string;
  tx_count: number;
  timestamp: string;
};

export type TransactionItem = {
  tx_id: string;
  doc_id: string;
  doc_name: string;
  case_number: string;
  hash: string;
  timestamp: string;
  status: string;
  actor: string;
  block_number: number;
};

export type AuditItem = {
  id: number | string;
  actor: string;
  action: string;
  resource: string;
  resource_id: string;
  result: string;
  reference: string;
  details: string;
  timestamp: string;
};

export type ShareItem = {
  id: number | string;
  doc_id: string;
  doc_name: string;
  recipient: string;
  permission: string;
  expiry: string;
  status: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  expiry_label?: string;
  recipient_detail?: string;
};

export type UserItem = {
  id: number | string;
  name: string;
  role: string;
  email: string;
  department: string;
  status: string;
  mfa: string;
  last_login: string;
  cases_assigned: number;
};

export type NotificationItem = {
  id: number;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'alert';
  time: string;
  read: boolean;
  link: string;
};

export type ResourceName =
  | 'cases'
  | 'documents'
  | 'blocks'
  | 'transactions'
  | 'audit'
  | 'shares'
  | 'users'
  | 'notifications';

export type ApiBody = Record<string, unknown> | undefined;

export type Store = {
  loading: boolean;
  error: string | null;
  cases: AppCase[];
  documents: AppDocument[];
  blocks: BlockItem[];
  transactions: TransactionItem[];
  audit: AuditItem[];
  shares: ShareItem[];
  users: UserItem[];
  notifications: NotificationItem[];
  toasts: Toast[];
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  refresh: (silent?: boolean) => Promise<void>;
  api: (
    resource: ResourceName,
    method: string,
    body?: ApiBody
  ) => Promise<unknown>;
  currentUser: CurrentUser | null;
  setCurrentUser: (u: CurrentUser | null) => void;
  signInWithPassword: (
    email: string,
    password: string
  ) => Promise<CurrentUser>;
  signUpWithPassword: (
    email: string,
    password: string,
    metadata?: Record<string, unknown>
  ) => Promise<CurrentUser | null>;
  signOut: () => Promise<void>;
  testSupabaseConnection: () => Promise<{
    ok: boolean;
    message: string;
  }>;
  unreadCount: number;
  markAllRead: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);

export const useStore = () => {
  const v = useContext(Ctx);

  if (!v) {
    throw new Error('store missing');
  }

  return v;
};

/* -------------------------------------------------------------------------- */
/* FALLBACK / DEMO DATA                                                       */
/* -------------------------------------------------------------------------- */

const getFallbackData = (): {
  cases: AppCase[];
  documents: AppDocument[];
  blocks: BlockItem[];
  transactions: TransactionItem[];
  audit: AuditItem[];
  shares: ShareItem[];
  users: UserItem[];
  notifications: NotificationItem[];
} => ({
  cases: [
    {
      id: '1',
      case_number: 'CASE-2026-0147',
      title: 'Statewide Electoral Integrity Review',
      description:
        'Cross-jurisdiction suspicious entry and impersonation analysis across district records.',
      classification: 'Restricted',
      status: 'Active',
      officer: 'Ananya Sharma',
      department: 'Cyber Crime Wing',
      doc_count: 4,
      last_activity: new Date(
        Date.now() - 1000 * 60 * 22
      ).toISOString(),
    },
    {
      id: '2',
      case_number: 'CASE-2026-0181',
      title: 'Forgery Network — Land Registry Files',
      description:
        'Investigation into forged property transfer documents and registry sequencing anomalies.',
      classification: 'Confidential',
      status: 'Under Review',
      officer: 'Vikram Singh',
      department: 'Economic Offences',
      doc_count: 3,
      last_activity: new Date(
        Date.now() - 1000 * 60 * 65
      ).toISOString(),
    },
    {
      id: '3',
      case_number: 'CASE-2026-0206',
      title: 'Digital Evidence Chain-of-Custody',
      description:
        'High-sensitivity forensic reconstruction for mobile and system records.',
      classification: 'Top Secret',
      status: 'Sealed',
      officer: 'Meera Nair',
      department: 'Forensic Lab',
      doc_count: 5,
      last_activity: new Date(
        Date.now() - 1000 * 60 * 120
      ).toISOString(),
    },
    {
      id: '4',
      case_number: 'CASE-2026-0215',
      title: 'Infrastructure Bribery Records',
      description:
        'Review of procurement records, recipient registers and shared digital archives.',
      classification: 'Internal',
      status: 'Pending Verification',
      officer: 'Rahul Yadav',
      department: 'Anti-Corruption Cell',
      doc_count: 2,
      last_activity: new Date(
        Date.now() - 1000 * 60 * 290
      ).toISOString(),
    },
  ],

  documents: [
    {
      id: 'DOC-20260448',
      filename: 'CDR_Analysis_March.xlsx',
      file_type: 'xlsx',
      case_number: 'CASE-2026-0147',
      ref_number: 'REF-0147-03',
      integrity_status: 'Mismatch',
      sha256:
        'b2bcf6d6b0c55a5abc63d3c8b637b91ef8e01dd1f7bc6249d5f6a428ddc9d2a7',
      tx_id: 'TX-38BAAB4F',
      version: 'v3.2',
      updated_at: new Date(
        Date.now() - 1000 * 60 * 18
      ).toISOString(),
    },
    {
      id: 'DOC-20260611',
      filename: 'KYC_Affidavits_01.pdf',
      file_type: 'pdf',
      case_number: 'CASE-2026-0147',
      ref_number: 'REF-0147-11',
      integrity_status: 'Verified',
      sha256:
        '9bd0fbc3771f9222b5e87088dc9d7fbca3038479b1210c7051f78f8f911f5d26',
      tx_id: 'TX-1A11C6D2',
      version: 'v1.0',
      updated_at: new Date(
        Date.now() - 1000 * 60 * 53
      ).toISOString(),
    },
    {
      id: 'DOC-20260621',
      filename: 'Asset_Transfer_Chain.pdf',
      file_type: 'pdf',
      case_number: 'CASE-2026-0181',
      ref_number: 'REF-0181-02',
      integrity_status: 'Verified',
      sha256:
        '1ff1d7bb743f8d7fe3dcf6d6151a5d1b8480ce3d0f7fd0c0da0e97d8af13d85d',
      tx_id: 'TX-7DAA8D5C',
      version: 'v2.1',
      updated_at: new Date(
        Date.now() - 1000 * 60 * 88
      ).toISOString(),
    },
    {
      id: 'DOC-20260713',
      filename: 'Scene_Logs_Alpha.mov',
      file_type: 'mov',
      case_number: 'CASE-2026-0206',
      ref_number: 'REF-0206-08',
      integrity_status: 'Pending',
      sha256:
        '2c8a3a6a9b13114d5d4d632b335496d7b90d59e38d0c5626d4838e3155ed9b77',
      tx_id: 'TX-E3819F25',
      version: 'v1.1',
      updated_at: new Date(
        Date.now() - 1000 * 60 * 164
      ).toISOString(),
    },
    {
      id: 'DOC-20260742',
      filename: 'Procurement_Registers.xlsx',
      file_type: 'xlsx',
      case_number: 'CASE-2026-0215',
      ref_number: 'REF-0215-17',
      integrity_status: 'Verified',
      sha256:
        '816b84f70dcf4ea2e7cb6f9a14b0a0a6d1bfd2d8243cedb9fb7a7d2ec3b4cd8b',
      tx_id: 'TX-FC41C386',
      version: 'v4.0',
      updated_at: new Date(
        Date.now() - 1000 * 60 * 330
      ).toISOString(),
    },
  ],

  blocks: [
    {
      block_number: 48291,
      hash: '0xeb4d9546f2b9ceca8df3fdb2d7370b88741c3d5d2f6f1d39d6f7b6a4c5656211',
      tx_count: 14,
      timestamp: new Date(
        Date.now() - 1000 * 60 * 90
      ).toISOString(),
    },
    {
      block_number: 48290,
      hash: '0xbaf31ed95c0f4f53d16c71032a2c5771712ff0a2efebcbddcad6cdaa1f6be984',
      tx_count: 12,
      timestamp: new Date(
        Date.now() - 1000 * 60 * 190
      ).toISOString(),
    },
    {
      block_number: 48289,
      hash: '0x4ec69dcc15d9857b70f0cf0d1fa7ac9fc5232e9d9230e8ca33ed2d64d392005c',
      tx_count: 17,
      timestamp: new Date(
        Date.now() - 1000 * 60 * 280
      ).toISOString(),
    },
  ],

  transactions: [
    {
      tx_id: 'TX-1A11C6D2',
      doc_id: 'DOC-20260611',
      doc_name: 'KYC_Affidavits_01.pdf',
      case_number: 'CASE-2026-0147',
      hash:
        '9bd0fbc3771f9222b5e87088dc9d7fbca3038479b1210c7051f78f8f911f5d26',
      timestamp: new Date(
        Date.now() - 1000 * 60 * 53
      ).toISOString(),
      status: 'Anchored',
      actor: 'System',
      block_number: 48291,
    },
    {
      tx_id: 'TX-38BAAB4F',
      doc_id: 'DOC-20260448',
      doc_name: 'CDR_Analysis_March.xlsx',
      case_number: 'CASE-2026-0147',
      hash:
        'b2bcf6d6b0c55a5abc63d3c8b637b91ef8e01dd1f7bc6249d5f6a428ddc9d2a7',
      timestamp: new Date(
        Date.now() - 1000 * 60 * 18
      ).toISOString(),
      status: 'Failed',
      actor: 'Ananya Sharma',
      block_number: 48290,
    },
    {
      tx_id: 'TX-7DAA8D5C',
      doc_id: 'DOC-20260621',
      doc_name: 'Asset_Transfer_Chain.pdf',
      case_number: 'CASE-2026-0181',
      hash:
        '1ff1d7bb743f8d7fe3dcf6d6151a5d1b8480ce3d0f7fd0c0da0e97d8af13d85d',
      timestamp: new Date(
        Date.now() - 1000 * 60 * 88
      ).toISOString(),
      status: 'Anchored',
      actor: 'Vikram Singh',
      block_number: 48289,
    },
    {
      tx_id: 'TX-E3819F25',
      doc_id: 'DOC-20260713',
      doc_name: 'Scene_Logs_Alpha.mov',
      case_number: 'CASE-2026-0206',
      hash:
        '2c8a3a6a9b13114d5d4d632b335496d7b90d59e38d0c5626d4838e3155ed9b77',
      timestamp: new Date(
        Date.now() - 1000 * 60 * 164
      ).toISOString(),
      status: 'Pending',
      actor: 'Meera Nair',
      block_number: 48288,
    },
    {
      tx_id: 'TX-FC41C386',
      doc_id: 'DOC-20260742',
      doc_name: 'Procurement_Registers.xlsx',
      case_number: 'CASE-2026-0215',
      hash:
        '816b84f70dcf4ea2e7cb6f9a14b0a0a6d1bfd2d8243cedb9fb7a7d2ec3b4cd8b',
      timestamp: new Date(
        Date.now() - 1000 * 60 * 330
      ).toISOString(),
      status: 'Anchored',
      actor: 'Rahul Yadav',
      block_number: 48291,
    },
  ],

  audit: [
    {
      id: 1,
      actor: 'Ananya Sharma',
      action: 'Login',
      resource: 'ANVESHAN Console',
      resource_id: 'SESSION',
      result: 'Success',
      reference: 'MFA-OK',
      details:
        'Successful login with MFA challenge issued to registered device.',
      timestamp: new Date(
        Date.now() - 1000 * 60 * 9
      ).toISOString(),
    },
    {
      id: 2,
      actor: 'System',
      action: 'Hash Generation',
      resource: 'CDR_Analysis_March.xlsx',
      resource_id: 'DOC-20260448',
      result: 'Mismatch',
      reference: 'TX-38BAAB4F',
      details:
        'Document hash differs from registered ledger record and requires investigation.',
      timestamp: new Date(
        Date.now() - 1000 * 60 * 18
      ).toISOString(),
    },
    {
      id: 3,
      actor: 'Vikram Singh',
      action: 'Share',
      resource: 'Asset_Transfer_Chain.pdf',
      resource_id: 'DOC-20260621',
      result: 'Success',
      reference: 'SHR-104',
      details:
        'Shared with external counsel under legal review access profile.',
      timestamp: new Date(
        Date.now() - 1000 * 60 * 78
      ).toISOString(),
    },
    {
      id: 4,
      actor: 'Meera Nair',
      action: 'Verification',
      resource: 'Scene_Logs_Alpha.mov',
      resource_id: 'DOC-20260713',
      result: 'Pending',
      reference: 'TX-E3819F25',
      details:
        'Cryptographic verification pending consensus approval.',
      timestamp: new Date(
        Date.now() - 1000 * 60 * 166
      ).toISOString(),
    },
  ],

  shares: [
    {
      id: 101,
      doc_id: 'DOC-20260621',
      doc_name: 'Asset_Transfer_Chain.pdf',
      recipient: 'Legal Team',
      permission: 'Read only',
      expiry: '14 days',
      status: 'Active',
      created_by: 'Vikram Singh',
      created_at: new Date(
        Date.now() - 1000 * 60 * 250
      ).toISOString(),
      expires_at: new Date(
        Date.now() + 1000 * 60 * 60 * 24 * 14
      ).toISOString(),
      expiry_label: '14 days',
    },
    {
      id: 102,
      doc_id: 'DOC-20260448',
      doc_name: 'CDR_Analysis_March.xlsx',
      recipient: 'Forensic Review',
      permission: 'Review + export',
      expiry: 'Custom (7d)',
      status: 'Expiring Soon',
      created_by: 'Ananya Sharma',
      created_at: new Date(
        Date.now() - 1000 * 60 * 500
      ).toISOString(),
      expires_at: new Date(
        Date.now() + 1000 * 60 * 60 * 24 * 7
      ).toISOString(),
      expiry_label: 'Custom (7d)',
    },
    {
      id: 103,
      doc_id: 'DOC-20260742',
      doc_name: 'Procurement_Registers.xlsx',
      recipient: 'Audit Board',
      permission: 'Read only',
      expiry: '30 days',
      status: 'Revoked',
      created_by: 'Rahul Yadav',
      created_at: new Date(
        Date.now() - 1000 * 60 * 1700
      ).toISOString(),
      expires_at: new Date(
        Date.now() - 1000 * 60 * 60 * 24 * 30
      ).toISOString(),
      expiry_label: '30 days',
    },
  ],

  users: [
    {
      id: 1,
      name: 'Ananya Sharma',
      role: 'Investigating Officer',
      email: 'ananya.sharma@anveshan.gov.in',
      department: 'Cyber Crime Wing',
      status: 'Active',
      mfa: 'Enabled',
      last_login: new Date(
        Date.now() - 1000 * 60 * 12
      ).toISOString(),
      cases_assigned: 4,
    },
    {
      id: 2,
      name: 'Vikram Singh',
      role: 'Legal Officer',
      email: 'vikram.singh@anveshan.gov.in',
      department: 'Legal Division',
      status: 'Active',
      mfa: 'Enabled',
      last_login: new Date(
        Date.now() - 1000 * 60 * 43
      ).toISOString(),
      cases_assigned: 2,
    },
    {
      id: 3,
      name: 'Meera Nair',
      role: 'Forensic Officer',
      email: 'meera.nair@anveshan.gov.in',
      department: 'Forensic Lab',
      status: 'Active',
      mfa: 'Enabled',
      last_login: new Date(
        Date.now() - 1000 * 60 * 76
      ).toISOString(),
      cases_assigned: 3,
    },
    {
      id: 4,
      name: 'Aisha Khan',
      role: 'Auditor',
      email: 'aisha.khan@anveshan.gov.in',
      department: 'Internal Audit',
      status: 'Active',
      mfa: 'Enabled',
      last_login: new Date(
        Date.now() - 1000 * 60 * 130
      ).toISOString(),
      cases_assigned: 1,
    },
    {
      id: 5,
      name: 'Rohit Verma',
      role: 'Administrator',
      email: 'rohit.verma@anveshan.gov.in',
      department: 'Operations',
      status: 'Active',
      mfa: 'Enabled',
      last_login: new Date(
        Date.now() - 1000 * 60 * 335
      ).toISOString(),
      cases_assigned: 6,
    },
  ],

  notifications: [
    {
      id: 1,
      title: 'Ledger sync healthy',
      message:
        'Node DL-04 is synced and all critical services remain operational.',
      type: 'success',
      time: new Date(
        Date.now() - 1000 * 60 * 7
      ).toISOString(),
      read: false,
      link: 'ledger',
    },
    {
      id: 2,
      title: 'Integrity review required',
      message:
        'CDR_Analysis_March.xlsx no longer matches its ledger record.',
      type: 'alert',
      time: new Date(
        Date.now() - 1000 * 60 * 20
      ).toISOString(),
      read: false,
      link: 'verify',
    },
    {
      id: 3,
      title: 'New access grant',
      message:
        'Asset_Transfer_Chain.pdf has been shared with Legal Team.',
      type: 'info',
      time: new Date(
        Date.now() - 1000 * 60 * 84
      ).toISOString(),
      read: true,
      link: 'sharing',
    },
  ],
});

/* -------------------------------------------------------------------------- */
/* OLD API FETCH                                                               */
/* -------------------------------------------------------------------------- */

async function fetchResource<T>(
  resource: ResourceName
): Promise<T[]> {
  try {
    const r = await fetch(`/api/data?resource=${resource}`);

    if (!r.ok) {
      throw new Error(`Failed to load ${resource}`);
    }

    const contentType =
      r.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      throw new Error(`No JSON API for ${resource}`);
    }

    const j = await r.json();

    return Array.isArray(j) ? (j as T[]) : [];
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* SUPABASE CASES FETCH                                                       */
/* -------------------------------------------------------------------------- */

export async function fetchSupabaseCases(): Promise<AppCase[]> {
  if (!supabase) {
    return [];
  }

  const { data: rawCaseRows, error: casesError } =
    await supabase
      .from('cases')
      .select('*')
      .order('updated_at', { ascending: false });

  if (casesError) {
    console.error('Failed to load cases from Supabase:', casesError);
    return [];
  }

  const caseRows = (rawCaseRows ?? []) as Record<string, unknown>[];
  if (caseRows.length === 0) {
    return [];
  }

  const caseIds = caseRows
    .map((row) => row.id)
    .filter((id): id is string | number =>
      typeof id === 'string' || typeof id === 'number'
    )
    .map(String);

  const officerIds = [
    ...new Set(
      caseRows
        .map((row) => row.assigned_officer)
        .filter(
          (id): id is string =>
            typeof id === 'string' && id.length > 0
        )
    ),
  ];

  const profilesPromise =
    officerIds.length > 0
      ? supabase
          .from('profiles')
          .select('*')
          .in('id', officerIds)
      : Promise.resolve({ data: [], error: null });

  const documentsPromise =
    caseIds.length > 0
      ? supabase
          .from('documents')
          .select('case_id')
          .in('case_id', caseIds)
      : Promise.resolve({ data: [], error: null });

  const [
    { data: profiles, error: profilesError },
    { data: documents, error: documentsError },
  ] = await Promise.all([profilesPromise, documentsPromise]);

  if (profilesError) {
    console.warn('Could not load assigned officer profiles:', profilesError);
  }

  if (documentsError) {
    console.warn('Could not load document counts:', documentsError);
  }

  const profileMap = new Map<string, Record<string, unknown>>();
  (profiles ?? []).forEach((profile) => {
    const profileRow = profile as Record<string, unknown>;
    if (profileRow.id !== undefined && profileRow.id !== null) {
      profileMap.set(String(profileRow.id), profileRow);
    }
  });

  const documentCountMap = new Map<string, number>();
  (documents ?? []).forEach((document) => {
    const documentRow = document as Record<string, unknown>;
    if (documentRow.case_id === undefined || documentRow.case_id === null) {
      return;
    }

    const caseId = String(documentRow.case_id);
    documentCountMap.set(caseId, (documentCountMap.get(caseId) ?? 0) + 1);
  });

  return caseRows.map((row) => {
    const assignedOfficerId = row.assigned_officer
      ? String(row.assigned_officer)
      : '';
    const officer = assignedOfficerId
      ? profileMap.get(assignedOfficerId)
      : undefined;
    const officerName = [
      officer?.name,
      officer?.full_name,
      officer?.display_name,
    ].find(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0
    );
    const department =
      typeof officer?.department === 'string' &&
      officer.department.trim().length > 0
        ? officer.department
        : '—';

    return {
      id: String(row.id ?? ''),
      case_number: String(row.case_number ?? ''),
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      classification: String(row.classification ?? 'Internal'),
      status: String(row.status ?? 'Active'),
      officer: officerName?.trim() || 'Unassigned',
      department,
      doc_count: documentCountMap.get(String(row.id)) ?? 0,
      last_activity: String(row.updated_at ?? row.created_at ?? ''),
    };
  });
}

/* -------------------------------------------------------------------------- */
/* STORE PROVIDER                                                             */
/* -------------------------------------------------------------------------- */

export function StoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] =
    useState(!isSupabaseConfigured);

  const [error, setError] =
    useState<string | null>(null);

  const [cases, setCases] =
    useState<AppCase[]>([]);

  const [documents, setDocuments] =
    useState<AppDocument[]>([]);

  const [blocks, setBlocks] =
    useState<BlockItem[]>([]);

  const [transactions, setTransactions] =
    useState<TransactionItem[]>([]);

  const [audit, setAudit] =
    useState<AuditItem[]>([]);

  const [shares, setShares] =
    useState<ShareItem[]>([]);

  const [users, setUsers] =
    useState<UserItem[]>([]);

  const [notifications, setNotifications] =
    useState<NotificationItem[]>([]);

  const [toasts, setToasts] =
    useState<Toast[]>([]);

  const [currentUser, setCurrentUserState] =
    useState<CurrentUser | null>(null);

  const toastId = useRef(1);

  const pushToast = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = toastId.current++;

      setToasts((p) => [
        ...p.slice(-3),
        { ...t, id },
      ]);

      setTimeout(
        () =>
          setToasts((p) =>
            p.filter((x) => x.id !== id)
          ),
        5200
      );
    },
    []
  );

  const dismissToast = useCallback(
    (id: number) =>
      setToasts((p) =>
        p.filter((x) => x.id !== id)
      ),
    []
  );

  const setCurrentUser = useCallback(
    (u: CurrentUser | null) => {
      setCurrentUserState(u);
    },
    []
  );

  /* ------------------------------------------------------------------------ */
  /* LOGIN                                                                     */
  /* ------------------------------------------------------------------------ */

  const signInWithPassword = useCallback(
    async (
      email: string,
      password: string
    ) => {
      if (!supabase) {
        throw new Error(
          'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your local environment.'
        );
      }

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (error) {
        throw error;
      }

      const signedInUser =
        await sessionToCurrentUser(
          data.session
        );

      if (!signedInUser) {
        throw new Error(
          'Sign-in succeeded, but no Supabase session was returned.'
        );
      }

      setCurrentUserState(signedInUser);

      return signedInUser;
    },
    []
  );

  /* ------------------------------------------------------------------------ */
  /* SIGN UP                                                                   */
  /* ------------------------------------------------------------------------ */

  const signUpWithPassword = useCallback(
    async (
      email: string,
      password: string,
      metadata?: Record<string, unknown>
    ) => {
      if (!supabase) {
        throw new Error(
          'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your local environment.'
        );
      }

      const { data, error } =
        await supabase.auth.signUp({
          email,
          password,
          options: {
            data: metadata,
          },
        });

      if (error) {
        throw error;
      }

      const signedUpUser =
        await sessionToCurrentUser(
          data.session
        );

      setCurrentUserState(signedUpUser);

      return signedUpUser;
    },
    []
  );

  /* ------------------------------------------------------------------------ */
  /* LOGOUT                                                                    */
  /* ------------------------------------------------------------------------ */

  const signOut = useCallback(
    async () => {
      if (supabase) {
        const { error } =
          await supabase.auth.signOut();

        if (error) {
          throw error;
        }
      }

      setCurrentUserState(null);
    },
    []
  );

  /* ------------------------------------------------------------------------ */
  /* SUPABASE AUTH SESSION                                                     */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;

    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (error) {
          throw error;
        }

        const sessionUser =
          await sessionToCurrentUser(
            data.session
          );

        if (active) {
          setCurrentUserState(
            sessionUser
          );
        }
      })
      .catch(() => {
        if (active) {
          setCurrentUserState(null);
        }
      })
      .finally(() => {
        if (active) {
          setAuthReady(true);
        }
      });

    const { data: listener } =
      supabase.auth.onAuthStateChange(
        (event, session) => {
          window.setTimeout(() => {
            if (!active) {
              return;
            }

            if (
              event === 'SIGNED_OUT' ||
              !session
            ) {
              setCurrentUserState(null);
              return;
            }

            void sessionToCurrentUser(
              session
            ).then((sessionUser) => {
              if (active) {
                setCurrentUserState(
                  sessionUser
                );
              }
            });
          }, 0);
        }
      );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  /* ------------------------------------------------------------------------ */
  /* REFRESH ALL DATA                                                          */
  /* ------------------------------------------------------------------------ */

  const refresh = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }

      setError(null);

      try {
        const data = isSupabaseConfigured
          ? await fetchSupabaseResources()
          : await Promise.all([
              fetchResource<AppCase>('cases'),
              fetchResource<AppDocument>('documents'),
              fetchResource<BlockItem>('blocks'),
              fetchResource<TransactionItem>('transactions'),
              fetchResource<AuditItem>('audit'),
              fetchResource<ShareItem>('shares'),
              fetchResource<UserItem>('users'),
              fetchResource<NotificationItem>('notifications'),
            ]).then(([c, d, b, t, a, s, u, n]) => ({
              cases: c,
              documents: d,
              blocks: b,
              transactions: t,
              audit: a,
              shares: s,
              users: u,
              notifications: n,
            }));

        const allEmpty = [
          data.cases,
          data.documents,
          data.blocks,
          data.transactions,
          data.audit,
          data.shares,
          data.users,
          data.notifications,
        ].every(
          (arr) => arr.length === 0
        );

        const fallback = getFallbackData();
        const visibleData = !isSupabaseConfigured && allEmpty
          ? fallback
          : data;

        setCases(visibleData.cases);
        setDocuments(visibleData.documents);
        setBlocks(visibleData.blocks);
        setTransactions(visibleData.transactions);
        setAudit(visibleData.audit);
        setShares(visibleData.shares);
        setUsers(visibleData.users);
        setNotifications(visibleData.notifications);

        if (allEmpty) {
          setError(null);
        }
      } catch (refreshError) {
        console.error(
          'Store refresh failed:',
          refreshError
        );

        if (isSupabaseConfigured) {
          setCases([]);
          setDocuments([]);
          setBlocks([]);
          setTransactions([]);
          setAudit([]);
          setShares([]);
          setUsers([]);
          setNotifications([]);
          setError(
            'Supabase data could not be loaded. Check table access policies and retry.'
          );
          return;
        }

        const fallback =
          getFallbackData();

        setCases(fallback.cases);
        setDocuments(
          fallback.documents
        );
        setBlocks(fallback.blocks);
        setTransactions(
          fallback.transactions
        );
        setAudit(fallback.audit);
        setShares(fallback.shares);
        setUsers(fallback.users);
        setNotifications(
          fallback.notifications
        );

        setError(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /* ------------------------------------------------------------------------ */
  /* INITIAL DATA LOAD                                                         */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    const handle = window.setTimeout(
      () => {
        void refresh();
      },
      0
    );

    return () =>
      window.clearTimeout(handle);
  }, [refresh]);

  /* ------------------------------------------------------------------------ */
  /* OLD API                                                                    */
  /* ------------------------------------------------------------------------ */

  const api = useCallback(
    async (
      resource: ResourceName,
      method: string,
      body?: ApiBody
    ) => {
      const r = await fetch(
        `/api/data?resource=${resource}`,
        {
          method,
          headers: {
            'Content-Type':
              'application/json',
          },
          body: body
            ? JSON.stringify(body)
            : undefined,
        }
      );

      if (!r.ok) {
        const j = await r
          .json()
          .catch(() => ({}));

        throw new Error(
          (j as { error?: string })
            .error ||
            `API ${method} ${resource} failed`
        );
      }

      return r.json().catch(() => ({}));
    },
    []
  );

  /* ------------------------------------------------------------------------ */
  /* MARK ALL NOTIFICATIONS READ                                               */
  /* ------------------------------------------------------------------------ */

  const markAllRead = useCallback(
    async () => {
      const unread =
        notifications.filter(
          (n) => !n.read
        );

      await Promise.all(
        unread.map((n) =>
          api(
            'notifications',
            'PUT',
            {
              idCol: 'id',
              idVal: n.id,
              patch: {
                read: true,
              },
            }
          ).catch(() => null)
        )
      );

      setNotifications((p) =>
        p.map((n) => ({
          ...n,
          read: true,
        }))
      );
    },
    [notifications, api]
  );

  const unreadCount = useMemo(
    () =>
      notifications.filter(
        (n) => !n.read
      ).length,
    [notifications]
  );

  /* ------------------------------------------------------------------------ */
  /* STORE VALUE                                                               */
  /* ------------------------------------------------------------------------ */

  const value: Store = {
    loading:
      loading || !authReady,

    error,

    cases,
    documents,
    blocks,
    transactions,
    audit,
    shares,
    users,
    notifications,

    toasts,
    pushToast,
    dismissToast,

    refresh,
    api,

    currentUser,
    setCurrentUser,

    signInWithPassword,
    signUpWithPassword,
    signOut,

    testSupabaseConnection,

    unreadCount,
    markAllRead,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
    </Ctx.Provider>
  );
}