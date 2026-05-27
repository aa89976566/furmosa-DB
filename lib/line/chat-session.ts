import { prisma } from '@/lib/prisma';

export type RegisterDraft = {
  name?: string;
  petSpecies?: string | null;
  petSpeciesOther?: string | null;
  petName?: string | null;
  petAgeYears?: number | null;
  petBirthday?: string | null;
  phone?: string | null;
};

export type LineChatFlow = 'register';

export async function getLineChatSession(lineUserId: string) {
  return prisma.lineChatSession.findUnique({ where: { lineUserId } });
}

export async function upsertLineChatSession(
  lineUserId: string,
  flow: LineChatFlow,
  step: string,
  payload: RegisterDraft,
) {
  return prisma.lineChatSession.upsert({
    where: { lineUserId },
    create: {
      lineUserId,
      flow,
      step,
      payload: JSON.stringify(payload),
    },
    update: {
      flow,
      step,
      payload: JSON.stringify(payload),
    },
  });
}

export async function clearLineChatSession(lineUserId: string) {
  await prisma.lineChatSession.deleteMany({ where: { lineUserId } });
}

export function parseRegisterDraft(payload: string): RegisterDraft {
  try {
    return JSON.parse(payload) as RegisterDraft;
  } catch {
    return {};
  }
}
