import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Furmosa 店家',
  description: 'Furmosa 合作店家 POS',
};

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas text-foreground">
      {children}
    </div>
  );
}
