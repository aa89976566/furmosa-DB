import { redirect } from 'next/navigation';

export default async function SettlementDetailRedirect(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  redirect(`/merchants/settlements/${params.id}`);
}
