import { redirect } from 'next/navigation';
import { parseStoreAccessSegment } from '@/lib/stores/redeem-url';

type Props = { params: Promise<{ access: string }> };

/** 舊版專屬連結 → 統一核銷頁並預選店家 */
export default async function LegacyStoreAccessPage({ params }: Props) {
  const { access } = await params;
  const parsed = parseStoreAccessSegment(access);
  if (parsed?.slug) {
    redirect(`/store-redeem?store=${encodeURIComponent(parsed.slug)}`);
  }
  redirect('/store-redeem');
}
