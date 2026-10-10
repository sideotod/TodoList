import { describe, expect, it } from 'vitest';
import { readSupabaseConfig } from '../../src/lib/supabase/config';

const validConfig = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://project-ref.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_public-key',
};

describe('Supabase public configuration', () => {
  it('requires the project URL and publishable key', () => {
    expect(readSupabaseConfig({})).toMatchObject({ status: 'missing' });
    expect(readSupabaseConfig(validConfig)).toMatchObject({
      status: 'configured',
      config: { url: validConfig.NEXT_PUBLIC_SUPABASE_URL, publishableKey: validConfig.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
    });
  });

  it('rejects non-HTTPS remote URLs and non-root project URLs', () => {
    expect(readSupabaseConfig({ ...validConfig, NEXT_PUBLIC_SUPABASE_URL: 'http://project-ref.supabase.co' })).toMatchObject({ status: 'invalid' });
    expect(readSupabaseConfig({ ...validConfig, NEXT_PUBLIC_SUPABASE_URL: 'https://project-ref.supabase.co/rest/v1' })).toMatchObject({ status: 'invalid' });
  });

  it('allows a local HTTP URL for local development', () => {
    expect(readSupabaseConfig({ ...validConfig, NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' })).toMatchObject({ status: 'configured' });
  });
});
