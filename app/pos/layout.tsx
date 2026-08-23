import type { CSSProperties } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Furmosa 店家',
  description: 'Furmosa 合作店家 POS',
};

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const posTheme = {
    '--primary': '0 0% 10%',
    '--primary-foreground': '0 0% 100%',
    '--ring': '0 0% 10%',
    '--canvas': '240 5% 96%',
    '--card': '0 0% 100%',
    '--border': '24 6% 90%',
    '--radius': '0.5rem',
  } as CSSProperties;

  return (
    <div className="min-h-screen bg-canvas text-foreground" style={posTheme}>
      {children}
    </div>
  );
}
