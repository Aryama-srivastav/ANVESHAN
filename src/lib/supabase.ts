import { createClient, type Session, type User } from '@supabase/supabase-js';
import type { CurrentUser } from '../store';

export const EVIDENCE_DOCUMENTS_BUCKET = 'evidence-documents';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const evidenceDocumentsStorage = supabase?.storage.from(EVIDENCE_DOCUMENTS_BUCKET) ?? null;

type ProfileRow = Record<string, unknown>;

const asString = (value: unknown) => (typeof value === 'string' ? value : undefined);
const asNumber = (value: unknown) => (typeof value === 'number' ? value : undefined);

export function profileToCurrentUser(user: User, profile?: ProfileRow | null): CurrentUser {
  const name =
    asString(profile?.name) ||
    asString(profile?.full_name) ||
    asString(profile?.display_name) ||
    asString(user.user_metadata?.name) ||
    asString(user.user_metadata?.full_name) ||
    user.email;

  return {
    id: asString(profile?.id) || user.id,
    name,
    role: asString(profile?.role) || asString(user.user_metadata?.role) || 'Officer',
    email: asString(profile?.email) || user.email,
    department: asString(profile?.department),
    status: asString(profile?.status) || 'Active',
    mfa: asString(profile?.mfa) || 'Enabled',
    last_login: asString(profile?.last_login) || user.last_sign_in_at || user.created_at,
    cases_assigned: asNumber(profile?.cases_assigned),
  };
}

export async function getProfileForUser(user: User): Promise<ProfileRow | null> {
  if (!supabase) return null;
  const byId = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!byId.error && byId.data) return byId.data;

  const byUserId = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
  if (!byUserId.error && byUserId.data) return byUserId.data;

  if (!user.email) return null;
  const byEmail = await supabase.from('profiles').select('*').eq('email', user.email).maybeSingle();
  if (!byEmail.error && byEmail.data) return byEmail.data;

  return null;
}

export async function sessionToCurrentUser(session: Session | null): Promise<CurrentUser | null> {
  if (!session?.user) return null;
  const profile = await getProfileForUser(session.user);
  return profileToCurrentUser(session.user, profile);
}

export async function testSupabaseConnection(): Promise<{ ok: boolean; message: string }> {
  if (!supabase) {
    return {
      ok: false,
      message: 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY.',
    };
  }

  const { error } = await supabase.auth.getSession();
  if (error) return { ok: false, message: error.message };

  return { ok: true, message: 'Supabase auth client reachable.' };
}
