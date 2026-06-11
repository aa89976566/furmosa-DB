import { redirect } from 'next/navigation';

export default function ShipmentHistoryRedirect({
  searchParams,
}: {
  searchParams?: { s?: string; type?: string };
}) {
  const params = new URLSearchParams();
  params.set('status', 'shipped');
  if (searchParams?.s) params.set('s', searchParams.s);
  if (searchParams?.type) params.set('type', searchParams.type);
  redirect(`/shipments?${params.toString()}`);
}
