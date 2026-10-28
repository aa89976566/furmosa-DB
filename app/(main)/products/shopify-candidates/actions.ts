'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  blockCatalogCandidate,
  candidateResolutionMessage,
  CANDIDATE_BLOCK_REASONS,
  linkCatalogCandidate,
} from '@/lib/shopify/catalog-candidate-resolution';

export type CandidateActionState = { ok: boolean; message: string };

const linkSchema = z.object({
  candidateId: z.string().min(1),
  tierId: z.string().min(1),
  notes: z.string().max(500).optional(),
});

const blockSchema = z.object({
  candidateId: z.string().min(1),
  reason: z.enum(CANDIDATE_BLOCK_REASONS),
  note: z.string().max(500).optional(),
});

async function requireFreshAdmin() {
  const session = await getCurrentUser();
  if (!session) return null;
  const actor = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true },
  });
  return actor?.role === 'admin' ? actor : null;
}

export async function linkCandidateAction(
  _previous: CandidateActionState,
  formData: FormData,
): Promise<CandidateActionState> {
  const actor = await requireFreshAdmin();
  if (!actor) return { ok: false, message: '只有 HQ 管理員可以連結商品規格。' };
  const parsed = linkSchema.safeParse({
    candidateId: String(formData.get('candidateId') ?? ''),
    tierId: String(formData.get('tierId') ?? ''),
    notes: String(formData.get('notes') ?? ''),
  });
  if (!parsed.success) return { ok: false, message: '處理資料不完整，請重新選擇商品規格。' };

  try {
    await linkCatalogCandidate(prisma, { ...parsed.data, actorId: actor.id });
  } catch (error) {
    console.error('[SHOPIFY_CANDIDATE_LINK_FAILED]', candidateResolutionMessage(error));
    return { ok: false, message: candidateResolutionMessage(error) };
  }

  revalidatePath('/products/shopify-candidates');
  revalidatePath(`/products/shopify-candidates/${parsed.data.candidateId}`);
  redirect('/products/shopify-candidates?updated=linked');
}

export async function blockCandidateAction(
  _previous: CandidateActionState,
  formData: FormData,
): Promise<CandidateActionState> {
  const actor = await requireFreshAdmin();
  if (!actor) return { ok: false, message: '只有 HQ 管理員可以標記不需建立。' };
  const parsed = blockSchema.safeParse({
    candidateId: String(formData.get('candidateId') ?? ''),
    reason: String(formData.get('reason') ?? ''),
    note: String(formData.get('note') ?? ''),
  });
  if (!parsed.success) return { ok: false, message: '請選擇不需建立的原因。' };

  try {
    await blockCatalogCandidate(prisma, { ...parsed.data, actorId: actor.id });
  } catch (error) {
    console.error('[SHOPIFY_CANDIDATE_BLOCK_FAILED]', candidateResolutionMessage(error));
    return { ok: false, message: candidateResolutionMessage(error) };
  }

  revalidatePath('/products/shopify-candidates');
  revalidatePath(`/products/shopify-candidates/${parsed.data.candidateId}`);
  redirect('/products/shopify-candidates?updated=blocked');
}
