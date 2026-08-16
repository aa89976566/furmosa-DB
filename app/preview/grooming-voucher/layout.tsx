import type { Metadata } from 'next';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export const metadata: Metadata = {
  title: '美容券預覽',
  robots: { index: false, follow: false },
};

export default function GroomingVoucherPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
