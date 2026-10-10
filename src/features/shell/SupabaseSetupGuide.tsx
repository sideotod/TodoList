import styles from './SupabaseSetupGuide.module.css';

export function SupabaseSetupGuide() {
  return (
    <main className={styles.page}>
      <section className={styles.content} aria-labelledby="supabase-setup-title">
        <span className={styles.eyebrow}>처음 한 번만 설정해 주세요</span>
        <h1 id="supabase-setup-title">계정 동기화를 준비해요</h1>
        <p className={styles.intro}>
          Supabase 프로젝트 설정이 아직 연결되지 않았습니다. 새 프로젝트와 Google 로그인을 설정한 뒤 프로젝트 URL과 publishable key를 로컬 환경 파일에 넣어 주세요.
        </p>
        <ol className={styles.steps}>
          <li>Supabase Dashboard에서 새 프로젝트를 만들고 데이터베이스 암호를 따로 보관합니다.</li>
          <li>Project Settings → API에서 Project URL과 publishable key를 확인합니다.</li>
          <li>Authentication → Sign In / Providers에서 Google 로그인을 켜고 Supabase callback URL을 Google Cloud OAuth 설정에 등록합니다.</li>
          <li>Authentication → URL Configuration에 로컬 개발 주소와 배포 도메인을 추가합니다.</li>
          <li><code>supabase/migrations</code>의 초기 SQL을 SQL Editor에서 실행해 테이블, RLS 정책, 저장 함수를 준비합니다.</li>
          <li><code>.env.example</code>을 <code>.env.local</code>로 복사하고 아래 환경변수에 프로젝트 값을 입력합니다.</li>
          <li>개발 서버를 다시 시작합니다: <code>pnpm dev</code></li>
        </ol>
        <pre className={styles.env}><code>{`NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`}</code></pre>
        <p className={styles.note}>
          브라우저에는 publishable key만 사용합니다. <code>service_role</code> 키와 데이터베이스 암호를 넣지 마세요. 데이터 접근은 로그인 사용자별 RLS 정책으로 제한하며, <code>.env.local</code>은 저장소에 커밋하지 마세요.
        </p>
        <nav className={styles.links} aria-label="Supabase 설정 도움말">
          <a href="https://supabase.com/dashboard/projects" target="_blank" rel="noreferrer">Supabase Dashboard 열기</a>
          <a href="https://supabase.com/docs/guides/auth/social-login/auth-google" target="_blank" rel="noreferrer">Google 로그인 설정</a>
          <a href="https://supabase.com/docs/guides/database/postgres/row-level-security" target="_blank" rel="noreferrer">Row Level Security 안내</a>
        </nav>
      </section>
    </main>
  );
}
