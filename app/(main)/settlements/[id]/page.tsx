import { redirect } from 'next/navigation';

export default function SettlementDetailRedirect({ params }: { params: { id: string } }) {
  redirect(`/merchants/settlements/${params.id}`);
}
