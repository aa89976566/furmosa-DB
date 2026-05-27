import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '匠寵罐罐存款',
  description: 'LINE 會員 — 註冊、存罐紀錄、兌換獎勵',
};

export default function LiffLayout({ children }: { children: React.ReactNode }) {
  return children;
}
