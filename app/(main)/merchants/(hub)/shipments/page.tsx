import { redirect } from 'next/navigation';

/** 舊路徑 → 統一出貨隊列（寄賣分類） */
export default async function MerchantShipmentsRedirect(
  props: {
    searchParams?: Promise<{ status?: string; s?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = new URLSearchParams();
  params.set('type', 'consignment');
  if (searchParams?.status) params.set('status', searchParams.status);
  if (searchParams?.s) params.set('s', searchParams.s);
  redirect(`/shipments?${params.toString()}`);
}
