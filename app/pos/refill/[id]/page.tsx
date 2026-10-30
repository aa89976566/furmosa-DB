import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LegacyPosRefillDetailPage() {
  // 舊版為店員掃碼／輸入序號頁；新版統一回到店家唯讀中心。
  redirect('/pos/refill');
}
