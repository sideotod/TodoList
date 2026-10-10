import type { SupabasePublicConfig } from './supabase/config';
import { createRepository, type Repository } from './repository';
import { createSupabaseStore } from './storage/supabase';
import { createIndexedDbJournal } from './storage/journal';

export type RepositorySession = { uid: string; generation: number };
export type BrowserRepository = { repository: Repository; dispose: () => void };

export function createBrowserRepository(session: RepositorySession, config: SupabasePublicConfig): BrowserRepository {
  const journal = createIndexedDbJournal();
  const remote = createSupabaseStore(config);
  const repository = createRepository(session, {
    remote,
    journal,
    clock: () => Date.now(),
    idFactory: createId,
  });
  return {
    repository,
    dispose: () => {
      repository.dispose();
      journal.close();
    },
  };
}

function createId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
