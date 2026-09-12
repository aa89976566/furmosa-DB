import { redirect } from 'next/navigation';

export default async function ShipmentHistoryRedirect(
  props: {
    searchParams?: Promise<{ s?: string; type?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = new URLSearchParams();
  params.set('status', 'shipped');
  if (searchParams?.s) params.set('s', searchParams.s);
  if (searchParams?.type) params.set('type', searchParams.type);
  redirect(`/shipments?${params.toString()}`);
}
