import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Career Pipeline',
  description: 'career-ops live dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen" style={{ backgroundColor: 'var(--base)' }}>
        {children}
      </body>
    </html>
  );
}
