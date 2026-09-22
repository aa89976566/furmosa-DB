import { redirect } from 'next/navigation';

// 店家 POS 的起點就是收銀台；登入與店家資料驗證仍由 /pos/sell 處理。
export default function PosHomePage() {
  redirect('/pos/sell');
}
