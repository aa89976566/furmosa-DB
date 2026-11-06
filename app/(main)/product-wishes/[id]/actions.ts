'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export type ProductWishActionState = { error?: string };

export async function reviewProductWishAction(
  _prev: ProductWishActionState,
  formData: FormData,
): Promise<ProductWishActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const wishId = String(formData.get('wishId') ?? '').trim();
  const decision = String(formData.get('decision') ?? '').trim();
  const reviewNote = String(formData.get('reviewNote') ?? '').trim();

  if (!wishId) return { error: '找不到這筆許願' };
  if (decision !== 'planned' && decision !== 'closed') {
    return { error: '請選擇規劃商品或結案' };
  }

  const result = await prisma.productWish.updateMany({
    where: { id: wishId, status: 'pending_review' },
    data: {
      status: decision,
      reviewedByUserId: user.userId,
      reviewedAt: new Date(),
      reviewNote: reviewNote || null,
    },
  });

  if (result.count === 0) return { error: '這筆許願已被處理，請重新整理頁面' };

  revalidatePath('/reviews');
  revalidatePath(`/product-wishes/${wishId}`);
  redirect('/reviews');
}
