import { redirect } from 'next/navigation';

export default function SettlementsRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === 'string') sp.set(k, v);
  }
  const q = sp.toString();
  redirect(q ? `/merchants/settlements?${q}` : '/merchants/settlements');
}
