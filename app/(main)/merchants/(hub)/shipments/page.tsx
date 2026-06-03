import { redirect } from 'next/navigation';

/** 舊路徑 → 統一出貨隊列（寄賣分類） */
export default function MerchantShipmentsRedirect({
  searchParams,
}: {
  searchParams?: { status?: string; s?: string };
}) {
  const params = new URLSearchParams();
  params.set('type', 'consignment');
  if (searchParams?.status) params.set('status', searchParams.status);
  if (searchParams?.s) params.set('s', searchParams.s);
  redirect(`/shipments?${params.toString()}`);
}
