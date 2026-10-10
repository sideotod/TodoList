import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '../lib/supabase/client';
import { readSupabaseConfig, type ConfigResult, type SupabasePublicConfig } from '../lib/supabase/config';
import type { Database } from '../lib/supabase/database.types';

export type AuthClientResult =
  | { status: 'configured'; client: SupabaseClient<Database>; config: SupabasePublicConfig }
  | Extract<ConfigResult, { status: 'missing' | 'invalid' }>;

function readClientConfig(): ConfigResult {
  return readSupabaseConfig({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

export function readPublicSupabaseConfig(): ConfigResult {
  return readClientConfig();
}

export function createAuthClient(): AuthClientResult {
  const result = readClientConfig();
  if (result.status !== 'configured') return result;
  return { status: 'configured', client: getSupabaseBrowserClient(result.config), config: result.config };
}

export function observeAuth(client: SupabaseClient<Database>, onUser: (user: User | null) => void): () => void {
  const { data } = client.auth.onAuthStateChange((_event, session) => onUser(session?.user ?? null));
  return () => data.subscription.unsubscribe();
}

export async function redirectToGoogle(client: SupabaseClient<Database>): Promise<void> {
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${window.location.pathname}${window.location.search}` },
  });
  if (error) throw error;
}

export async function signOutFromSupabase(client: SupabaseClient<Database>): Promise<void> {
  const { error } = await client.auth.signOut();
  if (error) throw error;
}
