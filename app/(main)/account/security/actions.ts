'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function revokePasskey(formData: FormData) {
  const session = await getCurrentUser();
  if (!session) throw new Error('請先登入 HQ');
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('缺少 Face ID 裝置');
  await prisma.hqPasskeyCredential.deleteMany({
    where: { id, userId: session.userId },
  });
  revalidatePath('/account/security');
}

