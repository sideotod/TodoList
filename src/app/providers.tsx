'use client';

import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { AuthProvider } from '../auth/session';
import { RepositorySessionProvider } from '../lib/repository-context';
import { PersistentBottomNavigation } from '../features/shell/PersistentBottomNavigation';
import { PwaLifecycle } from '../features/shell/PwaLifecycle';

export default function Providers({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AuthProvider>
      <RepositorySessionProvider>
        {children}
        <Suspense fallback={null}>
          <PersistentBottomNavigation />
        </Suspense>
        <PwaLifecycle />
      </RepositorySessionProvider>
    </AuthProvider>
  );
}
