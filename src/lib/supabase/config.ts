const PUBLIC_KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'] as const;

export type PublicEnvironment = Partial<Record<(typeof PUBLIC_KEYS)[number], string | undefined>>;
export type SupabasePublicConfig = { url: string; publishableKey: string };
export type ConfigResult =
  | { status: 'configured'; config: SupabasePublicConfig }
  | { status: 'missing'; missingKeys: string[] }
  | { status: 'invalid'; issues: string[] };

export function readSupabaseConfig(env: PublicEnvironment): ConfigResult {
  const missingKeys = PUBLIC_KEYS.filter((key) => !env[key]?.trim());
  if (missingKeys.length > 0) return { status: 'missing', missingKeys };

  const url = env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!.trim();
  const issues: string[] = [];
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/') {
      issues.push('Supabase URL은 프로젝트 루트 주소여야 합니다.');
    }
    if (parsed.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
      issues.push('로컬 개발 이외에는 HTTPS Supabase URL을 사용해 주세요.');
    }
  } catch {
    issues.push('올바른 Supabase 프로젝트 URL이 필요합니다.');
  }
  if (/\s/.test(publishableKey)) issues.push('Supabase publishable key에는 공백을 넣을 수 없습니다.');

  return issues.length > 0
    ? { status: 'invalid', issues }
    : { status: 'configured', config: { url, publishableKey } };
}
