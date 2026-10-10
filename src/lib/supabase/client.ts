import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SupabasePublicConfig } from './config';
import type { Database } from './database.types';

let browserClient: { key: string; client: SupabaseClient<Database> } | null = null;

export function getSupabaseBrowserClient(config: SupabasePublicConfig): SupabaseClient<Database> {
  if (typeof window === 'undefined') throw new Error('Supabase 브라우저 클라이언트는 브라우저에서만 사용할 수 있습니다.');
  const key = JSON.stringify(config);
  if (browserClient) {
    if (browserClient.key !== key) throw new Error('한 브라우저 세션에서 Supabase 프로젝트 설정을 바꿀 수 없습니다.');
    return browserClient.client;
  }
  const client = createClient<Database>(config.url, config.publishableKey, {
    auth: { autoRefreshToken: true, detectSessionInUrl: true, persistSession: true },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  browserClient = { key, client };
  return client;
}
