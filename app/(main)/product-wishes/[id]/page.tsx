import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';
import { PRODUCT_WISH_SPECIES } from '@/lib/product-wishes/validation';
import { prisma } from '@/lib/prisma';
import { ProductWishReviewForm } from './review-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: '許願池 · Furmosa HQ' };

const statusLabel: Record<string, string> = {
  pending_review: '待審核',
  planned: '列入找貨',
  closed: '暫時結案',
};

export default async function ProductWishPage(
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const wish = await prisma.productWish.findUnique({
    where: { id },
    include: { reviewedBy: { select: { name: true } } },
  });
  if (!wish) notFound();

  const pending = wish.status === 'pending_review';
  const species = PRODUCT_WISH_SPECIES[wish.species as keyof typeof PRODUCT_WISH_SPECIES] ?? '其他小夥伴';

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <Link href="/reviews" className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground">
        ← 待審核
      </Link>
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold text-navy md:text-3xl">許願池</h1>
        <Badge variant={pending ? 'warning' : 'secondary'}>
          {statusLabel[wish.status] ?? wish.status}
        </Badge>
      </header>

      <section className="rounded-2xl border bg-card p-5">
        <dl className="grid gap-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">毛孩種類</dt>
            <dd className="mt-1 font-medium">{species}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">送出時間</dt>
            <dd className="mt-1">{formatDateTime(wish.createdAt)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">想找的東西</dt>
            <dd className="mt-1 whitespace-pre-wrap text-base">{wish.requestText}</dd>
          </div>
          {wish.intent ? (
            <div>
              <dt className="text-xs text-muted-foreground">導購情境</dt>
              <dd className="mt-1">{wish.intent}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {pending ? <ProductWishReviewForm wishId={wish.id} /> : (
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">處理結果</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {wish.reviewedAt ? formatDateTime(wish.reviewedAt) : '—'}
            {wish.reviewedBy ? ` · ${wish.reviewedBy.name}` : ''}
          </p>
          <p className="mt-4 whitespace-pre-wrap text-sm">{wish.reviewNote || '未留下備註'}</p>
        </section>
      )}
    </div>
  );
}
