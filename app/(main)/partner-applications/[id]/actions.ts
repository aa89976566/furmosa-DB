'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function requireHqUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export type PartnerApplicationActionState = { error?: string };

export async function reviewPartnerApplicationAction(
  _prev: PartnerApplicationActionState,
  formData: FormData,
): Promise<PartnerApplicationActionState> {
  const user = await requireHqUser();
  const applicationId = String(formData.get('applicationId') ?? '').trim();
  const decision = String(formData.get('decision') ?? '').trim();
  const reviewNote = String(formData.get('reviewNote') ?? '').trim();

  if (!applicationId) return { error: '找不到合作申請' };
  if (decision !== 'approved' && decision !== 'rejected') {
    return { error: '請選擇核准或退回' };
  }
  if (decision === 'rejected' && !reviewNote) {
    return { error: '退回申請前請填寫原因' };
  }

  const result = await prisma.partnerApplication.updateMany({
    where: { id: applicationId, status: 'pending_review' },
    data: {
      status: decision,
      reviewedByUserId: user.userId,
      reviewedAt: new Date(),
      reviewNote: reviewNote || null,
    },
  });

  if (result.count === 0) return { error: '申請已被處理，請重新整理頁面' };

  revalidatePath('/reviews');
  revalidatePath(`/partner-applications/${applicationId}`);
  redirect('/reviews');
}
