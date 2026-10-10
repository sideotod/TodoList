import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Providers from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: '일정과 할 일',
  description: '날짜별 할 일과 기간 일정을 관리합니다.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/app-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/app-icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icons/app-icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: '일정과 할 일',
    statusBarStyle: 'default',
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
