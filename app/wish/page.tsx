import { notFound } from 'next/navigation';
import { issueWishToken } from '@/lib/guide/wishes';
import { WishForm } from './wish-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: '許願池｜FURMOSA 匠寵', robots: { index: false, follow: false } };
export default async function WishPage({ searchParams }: { searchParams: Promise<{ species?: string }> }) {
  const secret = process.env.WISH_FORM_SECRET ?? '';
  if (process.env.FURMOSA_WISHES_ENABLED !== 'true' || secret.length < 32 || !process.env.WISH_TRUSTED_IP_HEADER) notFound();
  const params = await searchParams;
  const species = typeof params.species === 'string' && params.species.length <= 40 ? params.species : '';
  return <main className="min-h-dvh bg-[#fffaf2] px-5 py-10 text-[#182955] sm:py-16">
    <div className="mx-auto max-w-xl rounded-[40px] border-2 border-[#89ace0] p-6 sm:p-10">
      <p className="font-bold tracking-wider">FURMOSA 匠寵</p>
      <h1 className="mb-3 mt-8 text-4xl font-bold">許願池</h1>
      <p className="mb-8 text-lg leading-relaxed">還沒找到適合的？把想找的留給我們。</p>
      <WishForm token={issueWishToken(secret, Date.now())} species={species} />
    </div>
  </main>;
}
