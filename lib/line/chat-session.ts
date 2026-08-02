import { prisma } from '@/lib/prisma';

export type RegisterResumeAfter = 'enter_code';

export type RegisterDraft = {
  signupStore?: string | null;
  name?: string;
  phone?: string | null;
  petSpecies?: string | null;
  petSpeciesOther?: string | null;
  petName?: string | null;
  petBreed?: string | null;
  petAgeYears?: number | null;
  petBirthday?: string | null;
  /** 開戶完成後自動接回的下一步（例：從輸入序號閘道進來） */
  resumeAfter?: RegisterResumeAfter | null;
  /** 各步驟最後一次提示時間（ISO），24 小時內不重複追問 */
  stepPromptAt?: Partial<Record<string, string>>;
};

export type JibaUnboxDraft = {
  phase?: string;
  applicationId?: string;
};

export type LineChatFlow = 'register' | 'jiba_unbox';

export type LineChatPayload = RegisterDraft | JibaUnboxDraft;

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
  payload: LineChatPayload,
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

/**
 * 開箱背景寫入用：若使用者已在開戶流程，禁止覆寫 lineChatSession。
 * （避免 runAfterReply 的延遲 upsert 把 register 洗成 jiba_unbox）
 */
export async function upsertJibaLineChatSessionIfIdle(
  lineUserId: string,
  step: string,
  payload: JibaUnboxDraft,
) {
  const current = await prisma.lineChatSession.findUnique({
    where: { lineUserId },
    select: { flow: true },
  });
  if (current?.flow === 'register') {
    console.warn('[line] skip jiba session upsert; register in progress', lineUserId);
    return null;
  }
  return upsertLineChatSession(lineUserId, 'jiba_unbox', step, payload);
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
