import type { Metadata } from 'next';

import { Analytics } from '@vercel/analytics/react';

import './globals.css';

export const metadata: Metadata = {
  title: '螞蟻窩甜點 | 智能客服',
  description: '螞蟻窩甜點 ANT NEST 線上客服助理',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className="antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
