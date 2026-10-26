'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { completeReceiptMetadata } from '@/lib/inventory/complete-receipt-metadata';

export async function fillReceiptMetadata(form: FormData) {
  const id = String(form.get('receiptId') ?? '');
  let result = 'metadataSaved=1';
  try {
    const user = await getCurrentUser();
    if (!user || !['admin','warehouse','finance'].includes(user.role)) throw new Error('無權限');
    await completeReceiptMetadata(prisma, { receiptId: id, vendorId: String(form.get('vendorId') ?? ''), date: String(form.get('receiptDate') ?? ''), actorId: user.userId, actorName: user.name ?? user.userId });
  } catch {
    result = 'metadataError=1';
  }
  revalidatePath('/inventory/purchases');
  revalidatePath(`/inventory/purchases/${encodeURIComponent(id)}`);
  redirect(`/inventory/purchases/${encodeURIComponent(id)}?${result}`);
}
