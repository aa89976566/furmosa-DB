import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'POS 預覽 · Furmosa',
  description: '操作預覽｜資料不會儲存',
};

export default function MerchantPosPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-canvas text-foreground">{children}</div>;
}
