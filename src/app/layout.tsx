import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fab Craft 3D — Semiconductor Equipment Layout',
  description: 'Interactive 3D layout tool for semiconductor fab equipment',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
