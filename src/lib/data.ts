import { EVIDENCE_DOCUMENTS_BUCKET, supabase } from './supabase';
import type {
  AppCase,
  AppDocument,
  AuditItem,
  BlockItem,
  CurrentUser,
  NotificationItem,
  ShareItem,
  TransactionItem,
  UserItem,
} from '../store';

type Row = Record<string, unknown>;

type SupabaseResources = {
  cases: AppCase[];
  documents: AppDocument[];
  blocks: BlockItem[];
  transactions: TransactionItem[];
  audit: AuditItem[];
  shares: ShareItem[];
  users: UserItem[];
  notifications: NotificationItem[];
};

const rows = (value: unknown): Row[] =>
  Array.isArray(value)
    ? value.filter((item): item is Row => Boolean(item) && typeof item === 'object')
    : [];

const text = (value: unknown, fallback = ''): string =>
  typeof value === 'string' && value.trim() ? value : fallback;

const number = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const date = (row: Row, ...keys: string[]): string => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value) return value;
  }
  return '';
};

const queryRows = async (table: string, order?: string): Promise<Row[]> => {
  if (!supabase) return [];
  const query = supabase.from(table).select('*');
  const response = order
    ? await query.order(order, { ascending: false })
    : await query;
  if (response.error) {
    console.warn(`Could not load ${table}:`, response.error.message);
    return [];
  }
  return rows(response.data);
};

const displayName = (row: Row | undefined, fallback = 'Unassigned'): string =>
  text(row?.name) || text(row?.full_name) || text(row?.display_name) || fallback;

export async function fetchSupabaseResources(): Promise<SupabaseResources> {
  if (!supabase) {
    return {
      cases: [],
      documents: [],
      blocks: [],
      transactions: [],
      audit: [],
      shares: [],
      users: [],
      notifications: [],
    };
  }

  const [caseRows, documentRows, profileRows, versionRows, auditRows, transactionRows, permissionRows, notificationRows] = await Promise.all([
    queryRows('cases', 'updated_at'),
    queryRows('documents', 'updated_at'),
    queryRows('profiles'),
    queryRows('document_versions', 'created_at'),
    queryRows('audit_logs', 'created_at'),
    queryRows('blockchain_transactions', 'created_at'),
    queryRows('access_permissions', 'created_at'),
    queryRows('notifications', 'created_at'),
  ]);

  const profiles = new Map<string, Row>();
  profileRows.forEach((profile) => {
    if (profile.id !== undefined && profile.id !== null) profiles.set(String(profile.id), profile);
  });

  const versions = new Map<string, Row>();
  versionRows.forEach((version) => {
    const documentId = version.document_id ?? version.doc_id;
    if (documentId !== undefined && documentId !== null && !versions.has(String(documentId))) {
      versions.set(String(documentId), version);
    }
  });

  const caseNumbers = new Map<string, string>();
  caseRows.forEach((row) => {
    const id = text(row.id);
    if (id) caseNumbers.set(id, text(row.case_number, id));
  });

  const documentCaseNumbers = new Map<string, string>();
  const documents = documentRows.map((row) => {
    const id = text(row.id);
    const caseId = text(row.case_id);
    const version = versions.get(id);
    const uploader = profiles.get(text(row.uploaded_by) || text(row.created_by));
    const transaction = transactionRows.find((item) => String(item.document_id ?? item.doc_id ?? '') === id);
    const caseNumber = text(row.case_number, caseNumbers.get(caseId) || caseId);
    documentCaseNumbers.set(id, caseNumber);
    return {
      id,
      case_id: caseId || undefined,
      filename: text(row.name, text(row.filename, 'Unnamed document')),
      file_type: text(row.document_type, text(row.file_type, 'file')),
      case_number: caseNumber,
      ref_number: text(row.reference_number, text(row.ref_number, '—')),
      integrity_status: text(row.integrity_status, text(row.verification_status, text(row.status, 'Pending'))),
      sha256: text(row.current_hash, text(row.sha256)),
      tx_id: text(row.transaction_id, text(row.tx_id, text(transaction?.transaction_id, text(transaction?.tx_id)))),
      version: version ? `v${number(version.version_number, 1)}` : text(row.version, 'v1.0'),
      updated_at: date(row, 'updated_at', 'created_at'),
      description: text(row.description),
      classification: text(row.classification, 'Internal'),
      size_text: number(row.file_size, number(row.size_bytes)) > 0 ? `${Math.ceil(number(row.file_size, number(row.size_bytes)) / 1024)} KB` : undefined,
      uploader: displayName(uploader, text(row.uploaded_by, 'Unknown')),
      tags: text(row.tags),
    } satisfies AppDocument;
  });

  const cases = caseRows.map((row) => {
    const id = text(row.id);
    const assigned = profiles.get(text(row.assigned_officer));
    return {
      id,
      case_number: text(row.case_number, id),
      title: text(row.title, 'Untitled case'),
      description: text(row.description),
      classification: text(row.classification, 'Internal'),
      status: text(row.status, 'Active'),
      officer: displayName(assigned),
      department: text(assigned?.department, '—'),
      doc_count: documents.filter((document) => documentCaseNumbers.get(document.id) === text(row.case_number, id) || document.id === id).length,
      last_activity: date(row, 'updated_at', 'created_at'),
    } satisfies AppCase;
  });

  const audit = auditRows.map((row, index) => ({
    id: typeof row.id === 'string' ? row.id : number(row.id, index + 1),
    actor: text(row.actor_name, text(row.actor, text(row.user_id, 'System'))),
    action: text(row.action, text(row.event_type, 'Activity')),
    resource: text(row.resource_name, text(row.resource, text(row.entity_type, 'Record'))),
    resource_id: text(row.resource_id, text(row.entity_id, text(row.document_id))),
    result: text(row.result, text(row.status, 'Success')),
    reference: text(row.reference, text(row.transaction_id)),
    details: text(row.details, text(row.description, '')), 
    timestamp: date(row, 'created_at', 'timestamp'),
  } satisfies AuditItem));

  const transactions = transactionRows.map((row, index) => ({
    tx_id: text(row.transaction_id, text(row.tx_id, text(row.id, `TX-${index + 1}`))),
    doc_id: text(row.document_id, text(row.doc_id)),
    doc_name: text(row.document_name, documents.find((document) => document.id === text(row.document_id, text(row.doc_id)))?.filename),
    case_number: text(row.case_number, documents.find((document) => document.id === text(row.document_id, text(row.doc_id)))?.case_number),
    hash: text(row.hash, text(row.document_hash)),
    timestamp: date(row, 'created_at', 'timestamp'),
    status: text(row.status, 'Pending'),
    actor: text(row.actor_name, text(row.actor, text(row.created_by, 'System'))),
    block_number: number(row.block_number),
  } satisfies TransactionItem));

  const blocks = Array.from(
    transactions.reduce((map, transaction) => {
      if (transaction.block_number <= 0) return map;
      const current = map.get(transaction.block_number);
      map.set(transaction.block_number, {
        block_number: transaction.block_number,
        hash: current?.hash || transaction.hash,
        tx_count: (current?.tx_count || 0) + 1,
        timestamp: current?.timestamp || transaction.timestamp,
      });
      return map;
    }, new Map<number, BlockItem>()).values()
  );

  const shares = permissionRows.map((row, index) => {
    const documentId = text(row.document_id, text(row.doc_id));
    const expiresAt = date(row, 'expires_at', 'expires_on');
    const expires = expiresAt ? new Date(expiresAt).getTime() : 0;
    return {
      id: typeof row.id === 'string' ? row.id : number(row.id, index + 1),
      doc_id: documentId,
      doc_name: text(row.document_name, documents.find((document) => document.id === documentId)?.filename),
      recipient: text(row.recipient_name, text(row.recipient, text(row.granted_to, 'Authorised recipient'))),
      permission: text(row.permission, text(row.access_level, 'View')),
      expiry: expiresAt,
      status: text(row.status, expires > 0 && expires < Date.now() ? 'Expired' : 'Active'),
      created_by: text(row.created_by, text(row.granted_by, 'System')),
      created_at: date(row, 'created_at', 'granted_at'),
      expires_at: expiresAt,
      expiry_label: expiresAt ? new Date(expiresAt).toLocaleDateString('en-IN') : 'No expiry',
      recipient_detail: text(row.recipient_email, text(row.email)),
    } satisfies ShareItem;
  });

  const users = profileRows.map((row, index) => ({
    id: typeof row.id === 'string' ? row.id : number(row.id, index + 1),
    name: displayName(row, 'Unnamed user'),
    role: text(row.role, 'Officer'),
    email: text(row.email),
    department: text(row.department, '—'),
    status: text(row.status, 'Active'),
    mfa: text(row.mfa_status, text(row.mfa, 'Not configured')),
    last_login: date(row, 'last_login', 'last_sign_in_at', 'updated_at'),
    cases_assigned: cases.filter((item) => item.officer === displayName(row)).length,
  } satisfies UserItem));

  const notifications = notificationRows.map((row, index) => ({
    id: number(row.id, index + 1),
    title: text(row.title, 'Security activity'),
    message: text(row.message, text(row.description)),
    type: (['success', 'info', 'warning', 'alert'] as const).includes(text(row.type) as 'success' | 'info' | 'warning' | 'alert') ? text(row.type) as NotificationItem['type'] : 'info',
    time: date(row, 'created_at', 'time'),
    read: row.read === true || row.is_read === true,
    link: text(row.link, 'audit'),
  } satisfies NotificationItem));

  return { cases, documents, blocks, transactions, audit, shares, users, notifications };
}

export type UploadDocumentInput = {
  file: File;
  caseId: string;
  classification: string;
  documentType: string;
  description: string;
  referenceNumber: string;
  hash: string;
  user: CurrentUser | null;
};

export async function uploadDocumentToSupabase(input: UploadDocumentInput): Promise<{ documentId: string; versionId: string }> {
  if (!supabase) throw new Error('Supabase is not configured.');
  if (!input.user?.id) throw new Error('A signed-in user is required to upload evidence.');

  const documentId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${input.user.id}/${input.caseId}/${documentId}/${safeName}`;

  const upload = await supabase.storage.from(EVIDENCE_DOCUMENTS_BUCKET).upload(storagePath, input.file, {
    contentType: input.file.type || 'application/octet-stream',
    upsert: false,
  });
  if (upload.error) throw new Error(`Storage upload failed: ${upload.error.message}`);

  const document = await supabase.from('documents').insert({
    id: documentId,
    case_id: input.caseId,
    name: input.file.name,
    document_type: input.documentType,
    classification: input.classification,
    storage_bucket: EVIDENCE_DOCUMENTS_BUCKET,
    storage_path: storagePath,
    current_hash: input.hash,
    uploaded_by: input.user.id,
    created_at: now,
    updated_at: now,
    description: input.description || null,
    reference_number: input.referenceNumber || null,
  }).select('id').single();
  if (document.error) throw new Error(`Document metadata could not be saved: ${document.error.message}`);

  const version = await supabase.from('document_versions').insert({
    id: versionId,
    document_id: documentId,
    version_number: 1,
    hash: input.hash,
    storage_path: storagePath,
    uploaded_by: input.user.id,
    file_size: input.file.size,
    created_at: now,
  });
  if (version.error) throw new Error(`Document version could not be saved: ${version.error.message}`);

  await supabase.from('documents').update({ current_version_id: versionId }).eq('id', documentId);
  await supabase.from('audit_logs').insert({
    actor: input.user.id,
    action: 'DOCUMENT_UPLOADED',
    resource: input.file.name,
    resource_id: documentId,
    result: 'Success',
    details: `SHA-256 ${input.hash}`,
    created_at: now,
  });
  await supabase.from('chain_of_custody').insert({
    document_id: documentId,
    version_id: versionId,
    actor: input.user.id,
    action: 'Uploaded',
    status: 'Success',
    created_at: now,
  });

  return { documentId, versionId };
}

export async function recordSupabaseAudit(input: {
  action: string;
  resource: string;
  resourceId: string;
  result: string;
  reference?: string;
  details?: string;
  user: CurrentUser | null;
}): Promise<void> {
  if (!supabase || !input.user?.id) return;
  const { error } = await supabase.from('audit_logs').insert({
    actor: input.user.id,
    action: input.action,
    resource: input.resource,
    resource_id: input.resourceId,
    result: input.result,
    reference: input.reference || null,
    details: input.details || null,
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Audit event could not be saved: ${error.message}`);
}
