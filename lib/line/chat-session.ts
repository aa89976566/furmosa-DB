import { prisma } from '@/lib/prisma';

export type RegisterDraft = {
  signupStore?: string | null;
  name?: string;
  petSpecies?: string | null;
  petSpeciesOther?: string | null;
  petName?: string | null;
  petAgeYears?: number | null;
  petBirthday?: string | null;
  phone?: string | null;
  /** 各步驟最後一次提示時間（ISO），24 小時內不重複追問 */
  stepPromptAt?: Partial<Record<string, string>>;
};

export type LineChatFlow = 'register';

/** 未完成開戶流程超過此時間視為過期，不再攔截一般訊息 */
export const REGISTER_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function isRegisterSessionExpired(
  session: { updatedAt: Date },
  now: Date = new Date(),
): boolean {
  return now.getTime() - session.updatedAt.getTime() > REGISTER_SESSION_TTL_MS;
}

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
