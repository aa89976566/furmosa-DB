import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';

const posFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-pos',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Furmosa 店家',
  description: 'Furmosa 合作店家 POS',
};

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${posFont.variable} min-h-screen bg-canvas font-pos text-foreground antialiased`}>
      {children}
    </div>
  );
}
