import { createCustomerRecord } from '@/lib/customers/create-customer';
import { resolvePetSpeciesLabel, type PetSpeciesCode } from '@/lib/customers/pet-fields';
import { ensureJarExchangeService } from '@/lib/jar-exchange/services';
import { findCustomerByLineUserId } from '@/lib/line/bind-customer';
import {
  clearLineChatSession,
  getLineChatSession,
  isRegisterSessionExpired,
  parseRegisterDraft,
  upsertLineChatSession,
  type RegisterDraft,
} from '@/lib/line/chat-session';
import {
  buildSpeciesPickerMessages,
  buildRegisterConfirmMessages,
  buildStorePickerMessages,
} from '@/lib/line/flex-menu';
import {
  LINE_BTN,
  LINE_PET_AGE_PROMPT,
  LINE_REGISTER_INTRO,
  resolveSignupStoreLabel,
} from '@/lib/line/line-copy';
import { formatGroomingCouponDiscountForStore } from '@/lib/coupons/constants';
import { isSignupStoreId } from '@/lib/stores/signup-stores';
import { replyLineMessage, replyLineText } from '@/lib/line/reply';
import { replyLineTextWithMenu, replyMenuHub } from '@/lib/line/reply-menu';
import {
  isRegisterStepPromptOnCooldown,
  markRegisterStepPrompt,
} from '@/lib/line/register-step-throttle';
import { prisma } from '@/lib/prisma';
import { PET_SPECIES_CODES } from '@/lib/customers/pet-fields';

const SKIP_RE = /^(略過|跳过|skip|不填|沒有|没有|不知道)$/i;
const CANCEL_RE = /^(取消|cancel|退出)$/i;

/** 開戶「選店家」步驟：僅接受取消；其餘文字應離開流程、改走一般訊息處理 */
export function registerStoreStepAction(text: string): 'cancel' | 'leave' {
  if (CANCEL_RE.test(text.trim())) return 'cancel';
  return 'leave';
}

async function clearExpiredRegisterSession(lineUserId: string) {
  const session = await getLineChatSession(lineUserId);
  if (session?.flow === 'register' && isRegisterSessionExpired(session)) {
    await clearLineChatSession(lineUserId);
    return true;
  }
  return false;
}

function parsePetAgeOrBirthday(input: string): {
  petAgeYears: number | null;
  petBirthday: string | null;
  error?: string;
} {
  const t = input.trim();
  if (SKIP_RE.test(t)) {
    return { petAgeYears: null, petBirthday: null };
  }

  const ageMatch = t.match(/^(\d{1,2})\s*歲?$/);
  if (ageMatch) {
    const n = parseInt(ageMatch[1], 10);
    if (n >= 0 && n <= 30) return { petAgeYears: n, petBirthday: null };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const d = new Date(`${t}T12:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) {
      return { petAgeYears: null, petBirthday: t };
    }
  }

  return {
    petAgeYears: null,
    petBirthday: null,
    error: '請傳 0–30 的歲數（例：3）、生日（2020-05-06）或「略過」',
  };
}

function petBirthdayToDate(iso: string | null | undefined): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 同一步驟 24 小時內只提示一次；冷卻中則靜默不回复 */
async function replyRegisterStepPromptOnce(
  replyToken: string,
  lineUserId: string,
  step: string,
  draft: RegisterDraft,
  message: string,
): Promise<void> {
  if (isRegisterStepPromptOnCooldown(draft, step)) return;
  const updated = markRegisterStepPrompt(draft, step);
  await upsertLineChatSession(lineUserId, 'register', step, updated);
  await replyLineText(replyToken, message);
}

export async function startRegisterFlow(replyToken: string, lineUserId: string) {
  const existing = await findCustomerByLineUserId(lineUserId);
  if (existing) {
    await replyLineTextWithMenu(
      replyToken,
      lineUserId,
      `您已是會員（${existing.name}）！\n傳 8 位序號即可存罐，或點「${LINE_BTN.vault}」查紀錄。`,
      { registered: true },
    );
    return;
  }

  await upsertLineChatSession(lineUserId, 'register', 'store', {});
  await replyLineMessage(replyToken, await buildStorePickerMessages());
}

export async function handleRegisterFlowMessage(
  replyToken: string,
  lineUserId: string,
  text: string,
): Promise<boolean> {
  if (await clearExpiredRegisterSession(lineUserId)) {
    return false;
  }

  const session = await getLineChatSession(lineUserId);
  if (!session || session.flow !== 'register') return false;

  const draft = parseRegisterDraft(session.payload);
  const trimmed = text.trim();

  if (session.step === 'store') {
    const action = registerStoreStepAction(trimmed);
    if (action === 'cancel') {
      await clearLineChatSession(lineUserId);
      await replyMenuHub(replyToken, lineUserId, {
        registered: Boolean(await findCustomerByLineUserId(lineUserId)),
        body: '已取消加入會員。',
      });
      return true;
    }
    // 店家須用按鈕 postback 選擇；勿對每則文字重送選單泡泡
    await clearLineChatSession(lineUserId);
    return false;
  }

  if (CANCEL_RE.test(trimmed)) {
    await clearLineChatSession(lineUserId);
    await replyMenuHub(replyToken, lineUserId, {
      registered: Boolean(await findCustomerByLineUserId(lineUserId)),
      body: '已取消加入會員。',
    });
    return true;
  }

  if (session.step === 'name') {
    if (!trimmed || trimmed.length > 80) {
      await replyRegisterStepPromptOnce(
        replyToken,
        lineUserId,
        'name',
        draft,
        '請輸入有效的稱呼（1–80 字）。',
      );
      return true;
    }
    draft.name = trimmed;
    await upsertLineChatSession(lineUserId, 'register', 'species', draft);
    await replyLineMessage(replyToken, buildSpeciesPickerMessages());
    return true;
  }

  if (session.step === 'pet_name') {
    if (SKIP_RE.test(trimmed)) {
      await replyRegisterStepPromptOnce(
        replyToken,
        lineUserId,
        'pet_name',
        draft,
        '已選了毛孩種類，請輸入毛孩名字，或傳「取消」改選種類。',
      );
      return true;
    }
    draft.petName = trimmed.slice(0, 80);
    const withPrompt = markRegisterStepPrompt(draft, 'pet_age');
    await upsertLineChatSession(lineUserId, 'register', 'pet_age', withPrompt);
    await replyLineText(replyToken, LINE_PET_AGE_PROMPT);
    return true;
  }

  if (session.step === 'pet_age') {
    const parsed = parsePetAgeOrBirthday(trimmed);
    if (parsed.error) {
      await replyRegisterStepPromptOnce(replyToken, lineUserId, 'pet_age', draft, parsed.error);
      return true;
    }
    draft.petAgeYears = parsed.petAgeYears;
    draft.petBirthday = parsed.petBirthday;
    await upsertLineChatSession(lineUserId, 'register', 'phone', draft);
    await replyLineText(replyToken, '手機號碼？（選填，傳「略過」可跳過）');
    return true;
  }

  if (session.step === 'pet_other') {
    draft.petSpeciesOther = trimmed.slice(0, 120);
    await upsertLineChatSession(lineUserId, 'register', 'pet_name', draft);
    await replyLineText(replyToken, '請輸入毛孩名字：');
    return true;
  }

  if (session.step === 'phone') {
    if (SKIP_RE.test(trimmed)) {
      draft.phone = null;
    } else {
      const phone = trimmed.replace(/\s/g, '');
      if (!/^09\d{8}$/.test(phone) && !/^\+?\d{8,15}$/.test(phone)) {
        await replyRegisterStepPromptOnce(
          replyToken,
          lineUserId,
          'phone',
          draft,
          '手機格式好像不對，請再試一次，或傳「略過」。',
        );
        return true;
      }
      draft.phone = phone;
    }
    await upsertLineChatSession(lineUserId, 'register', 'confirm', draft);
    await replyLineMessage(replyToken, buildRegisterConfirmMessages(formatRegisterSummary(draft)));
    return true;
  }

  return false;
}

export async function handleRegisterPostback(
  replyToken: string,
  lineUserId: string,
  params: URLSearchParams,
): Promise<boolean> {
  const action = params.get('jd');
  if (
    action !== 'store' &&
    action !== 'sp' &&
    action !== 'reg_ok' &&
    action !== 'reg_no'
  ) {
    return false;
  }

  if (await clearExpiredRegisterSession(lineUserId)) {
    if (action === 'store' || action === 'sp') {
      await replyLineText(replyToken, `請先點「${LINE_BTN.register}」開始填寫。`);
      return true;
    }
    return false;
  }

  let session = await getLineChatSession(lineUserId);
  if (!session || session.flow !== 'register') {
    if (action === 'store' || action === 'sp') {
      await replyLineText(replyToken, `請先點「${LINE_BTN.register}」開始填寫。`);
      return true;
    }
    return false;
  }

  const draft = parseRegisterDraft(session.payload);

  if (action === 'store') {
    const code = params.get('c');
    if (!code || !(await isSignupStoreId(code))) {
      await replyLineMessage(replyToken, await buildStorePickerMessages());
      return true;
    }
    draft.signupStore = code;
    await upsertLineChatSession(lineUserId, 'register', 'name', draft);
    await replyLineText(replyToken, LINE_REGISTER_INTRO);
    return true;
  }

  if (action === 'reg_no') {
    await clearLineChatSession(lineUserId);
    await replyMenuHub(replyToken, lineUserId, {
      registered: false,
      body: `已取消，需要時再點「${LINE_BTN.register}」。`,
    });
    return true;
  }

  if (action === 'sp') {
    const code = params.get('c');
    if (code === 'none') {
      draft.petSpecies = null;
      draft.petSpeciesOther = null;
      draft.petName = null;
      await upsertLineChatSession(lineUserId, 'register', 'phone', draft);
      await replyLineText(replyToken, '手機號碼？（選填，傳「略過」可跳過）');
      return true;
    }
    if (!code || !PET_SPECIES_CODES.includes(code as PetSpeciesCode)) {
      await replyLineText(replyToken, '請點選下方毛孩種類按鈕。');
      return true;
    }
    draft.petSpecies = code;
    draft.petSpeciesOther = null;
    if (code === 'other') {
      await upsertLineChatSession(lineUserId, 'register', 'pet_other', draft);
      await replyLineText(replyToken, '請輸入其他種類（例：刺蝟）：');
      return true;
    }
    await upsertLineChatSession(lineUserId, 'register', 'pet_name', draft);
    await replyLineText(replyToken, '請輸入毛孩名字：');
    return true;
  }

  if (action === 'reg_ok') {
    if (session.step !== 'confirm' || !draft.name) {
      await replyLineText(replyToken, `資料不完整，請重新點「${LINE_BTN.register}」。`);
      await clearLineChatSession(lineUserId);
      return true;
    }
    if (!draft.signupStore) {
      await replyLineText(
        replyToken,
        '請先選擇開戶合作店家，才能完成開戶並存罐累點。請重新點「幫毛孩開戶」。',
      );
      await clearLineChatSession(lineUserId);
      return true;
    }

    try {
      const created = await createCustomerRecord({
        name: draft.name,
        phone: draft.phone ?? null,
        lineUserId,
        signupStore: draft.signupStore,
        petSpecies: draft.petSpecies ?? null,
        petSpeciesOther: draft.petSpeciesOther ?? null,
        petName: draft.petName ?? null,
        petAgeYears: draft.petAgeYears ?? null,
        petBirthday: petBirthdayToDate(draft.petBirthday),
      });
      await ensureJarExchangeService(prisma, created.id);
      await clearLineChatSession(lineUserId);

      const petLabel = resolvePetSpeciesLabel(
        draft.petSpecies ?? null,
        draft.petSpeciesOther ?? null,
      );
      const agePart =
        draft.petBirthday != null
          ? ` · 生日 ${draft.petBirthday}`
          : draft.petAgeYears != null
            ? ` · 約 ${draft.petAgeYears} 歲`
            : '';
      const petLine =
        draft.petName && petLabel
          ? `\n毛孩：${petLabel} · ${draft.petName}${agePart}`
          : draft.petName
            ? `\n毛孩：${draft.petName}${agePart}`
            : '';
      const storeLabel = resolveSignupStoreLabel(draft.signupStore ?? null);
      const storeLine = storeLabel ? `\n開戶店家：${storeLabel}` : '';

      await replyLineTextWithMenu(
        replyToken,
        lineUserId,
        `✅ 加入完成！${draft.name}${storeLine}${petLine}\n\n之後直接傳 8 位空罐序號就會入帳。`,
        { registered: true },
      );
    } catch (e) {
      await replyLineText(
        replyToken,
        e instanceof Error ? e.message : '註冊失敗，請稍後再試或聯絡客服。',
      );
    }
    return true;
  }

  return false;
}

export function formatRegisterSummary(draft: RegisterDraft): string {
  const lines: string[] = [];
  const storeLabel = resolveSignupStoreLabel(draft.signupStore ?? null);
  if (storeLabel) {
    const storeId = draft.signupStore ?? '';
    lines.push(`開戶店家：${storeLabel}`);
    lines.push(`美容折價券：${formatGroomingCouponDiscountForStore(storeId, storeLabel)}`);
  }
  lines.push(`稱呼：${draft.name ?? '—'}`);
  if (draft.petSpecies) {
    lines.push(
      `毛孩：${resolvePetSpeciesLabel(draft.petSpecies, draft.petSpeciesOther ?? null) ?? draft.petSpecies}`,
    );
    if (draft.petName) lines.push(`名字：${draft.petName}`);
    if (draft.petBirthday) lines.push(`生日：${draft.petBirthday}`);
    else if (draft.petAgeYears != null) lines.push(`約幾歲：${draft.petAgeYears} 歲`);
    else if (draft.petName || draft.petSpecies) lines.push('年齡／生日：（未填）');
  } else {
    lines.push('毛孩：（未填）');
  }
  lines.push(`手機：${draft.phone ?? '（未填）'}`);
  return lines.join('\n');
}
