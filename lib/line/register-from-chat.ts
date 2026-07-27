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
import { buildEnterCodePromptMessages, buildWorldHubMessages } from '@/lib/line/flex-hubs';
import {
  LINE_BTN,
  LINE_PET_BIRTHDAY_PROMPT,
  LINE_PET_BREED_PROMPT,
  LINE_PET_NAME_PROMPT,
  LINE_REGISTER_INTRO,
  LINE_REGISTER_PHONE_PROMPT,
  resolveSignupStoreLabel,
} from '@/lib/line/line-copy';
import {
  buildPostBindPointsHint,
  formatGroomingCouponDiscountForStore,
  GROOMING_COUPON_POINTS,
} from '@/lib/coupons/constants';
import { isSignupStoreId } from '@/lib/stores/signup-stores';
import { replyLineMessage, replyLineText } from '@/lib/line/reply';
import { replyLineTextWithMenu, replyMenuHub } from '@/lib/line/reply-menu';
import {
  isRegisterStepPromptOnCooldown,
  markRegisterStepPrompt,
} from '@/lib/line/register-step-throttle';
import { prisma } from '@/lib/prisma';
import { PET_SPECIES_CODES } from '@/lib/customers/pet-fields';
import type { RegisterResumeAfter } from '@/lib/line/chat-session';
import { JAR_ENTER_HINT_REGISTERED } from '@/lib/line/brand-worlds';

const SKIP_RE = /^(略過|跳过|skip|不填|沒有|没有|不知道)$/i;
const CANCEL_RE = /^(取消|cancel|退出)$/i;

/**
 * Rich Menu／世界入口：開戶進行中若點這些，應離開開戶、改走對應入口。
 * （否則「回家」會被手機步驟當成無效號碼，重送「手機號碼？」）
 */
const REGISTER_NAV_LEAVE_RE =
  /^(?:一起野放|野放一下|預約美容|漂亮一下|換罐計畫|換罐計劃|回家|還有很多故事|野放中)$/;

export function isRegisterNavLeaveText(text: string): boolean {
  return REGISTER_NAV_LEAVE_RE.test(text.trim());
}

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

function petBirthdayToDate(iso: string | null | undefined): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseBirthdayOptional(input: string): {
  petBirthday: string | null;
  error?: string;
} {
  const t = input.trim();
  if (SKIP_RE.test(t)) return { petBirthday: null };
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const d = new Date(`${t}T12:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) return { petBirthday: t };
  }
  return {
    petBirthday: null,
    error: '請傳生日（2020-05-06）或「略過」',
  };
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

/**
 * 開戶：主人（暱稱／手機／店）→ 毛孩 → 完成
 * resumeAfter=enter_code：完成後自動回到「輸入序號」提示，不必再按一次。
 */
export async function startRegisterFlow(
  replyToken: string,
  lineUserId: string,
  opts?: { resumeAfter?: RegisterResumeAfter | null },
) {
  const existing = await findCustomerByLineUserId(lineUserId);
  if (existing) {
    if (opts?.resumeAfter === 'enter_code') {
      await replyLineMessage(replyToken, [
        { type: 'text', text: `你已經開過戶了（${existing.name}）。` },
        ...buildEnterCodePromptMessages(),
      ]);
      return;
    }
    await replyLineTextWithMenu(
      replyToken,
      lineUserId,
      `你已經幫毛孩開過戶囉（${existing.name}）。\n罐底 8 碼直接傳上來，或去「毛孩罐庫」看紀錄都可以喔。`,
      { registered: true },
    );
    return;
  }

  await upsertLineChatSession(lineUserId, 'register', 'name', {
    resumeAfter: opts?.resumeAfter ?? null,
  });
  await replyLineText(
    replyToken,
    opts?.resumeAfter === 'enter_code'
      ? `${LINE_REGISTER_INTRO}\n\n（開完會自動帶你回輸入序號）`
      : LINE_REGISTER_INTRO,
  );
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

  if (CANCEL_RE.test(trimmed)) {
    await clearLineChatSession(lineUserId);
    await replyMenuHub(replyToken, lineUserId, {
      registered: Boolean(await findCustomerByLineUserId(lineUserId)),
      body: '好喔，開戶先幫你暫停。想繼續再開時，再點「開戶」就好。',
    });
    return true;
  }

  // 四格選單／世界入口優先：清掉開戶暫存，交回一般訊息處理
  if (isRegisterNavLeaveText(trimmed)) {
    await clearLineChatSession(lineUserId);
    return false;
  }

  if (session.step === 'store') {
    const action = registerStoreStepAction(trimmed);
    if (action === 'cancel') {
      await clearLineChatSession(lineUserId);
      await replyMenuHub(replyToken, lineUserId, {
        registered: false,
        body: '好，開戶先暫停。',
      });
      return true;
    }
    await clearLineChatSession(lineUserId);
    return false;
  }

  if (session.step === 'name') {
    if (!trimmed || trimmed.length > 80) {
      await replyRegisterStepPromptOnce(
        replyToken,
        lineUserId,
        'name',
        draft,
        '暱稱請填 1–80 字。',
      );
      return true;
    }
    draft.name = trimmed;
    await upsertLineChatSession(lineUserId, 'register', 'phone', draft);
    await replyLineText(replyToken, LINE_REGISTER_PHONE_PROMPT);
    return true;
  }

  if (session.step === 'phone') {
    const phone = trimmed.replace(/\s/g, '');
    if (!/^09\d{8}$/.test(phone) && !/^\+?\d{8,15}$/.test(phone)) {
      await replyRegisterStepPromptOnce(
        replyToken,
        lineUserId,
        'phone',
        draft,
        '手機格式好像不對，再試一次（例：0912345678）。',
      );
      return true;
    }
    draft.phone = phone;
    await upsertLineChatSession(lineUserId, 'register', 'store', draft);
    await replyLineMessage(replyToken, await buildStorePickerMessages());
    return true;
  }

  if (session.step === 'pet_name') {
    if (!trimmed || SKIP_RE.test(trimmed)) {
      await replyRegisterStepPromptOnce(
        replyToken,
        lineUserId,
        'pet_name',
        draft,
        '毛孩名字可以先填一下嗎？這樣罐庫才知道要記在誰名下喔。',
      );
      return true;
    }
    draft.petName = trimmed.slice(0, 80);
    await upsertLineChatSession(lineUserId, 'register', 'species', draft);
    await replyLineMessage(replyToken, buildSpeciesPickerMessages());
    return true;
  }

  if (session.step === 'pet_other') {
    draft.petSpeciesOther = trimmed.slice(0, 120);
    await upsertLineChatSession(lineUserId, 'register', 'breed', draft);
    await replyLineText(replyToken, LINE_PET_BREED_PROMPT);
    return true;
  }

  if (session.step === 'breed') {
    if (SKIP_RE.test(trimmed)) {
      draft.petBreed = null;
    } else {
      draft.petBreed = trimmed.slice(0, 80);
    }
    const withPrompt = markRegisterStepPrompt(draft, 'birthday');
    await upsertLineChatSession(lineUserId, 'register', 'birthday', withPrompt);
    await replyLineText(replyToken, LINE_PET_BIRTHDAY_PROMPT);
    return true;
  }

  if (session.step === 'birthday') {
    const parsed = parseBirthdayOptional(trimmed);
    if (parsed.error) {
      await replyRegisterStepPromptOnce(replyToken, lineUserId, 'birthday', draft, parsed.error);
      return true;
    }
    draft.petBirthday = parsed.petBirthday;
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
      await replyLineText(replyToken, `請先點「${LINE_BTN.register}」重新開始。`);
      return true;
    }
    return false;
  }

  const session = await getLineChatSession(lineUserId);
  if (!session || session.flow !== 'register') {
    if (action === 'store' || action === 'sp') {
      await replyLineText(replyToken, `請先點「${LINE_BTN.register}」重新開始。`);
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
    await upsertLineChatSession(lineUserId, 'register', 'pet_name', draft);
    await replyLineText(replyToken, LINE_PET_NAME_PROMPT);
    return true;
  }

  if (action === 'reg_no') {
    await clearLineChatSession(lineUserId);
    await replyMenuHub(replyToken, lineUserId, {
      registered: false,
      body: `好，先不算。要開再點「${LINE_BTN.register}」。`,
    });
    return true;
  }

  if (action === 'sp') {
    const code = params.get('c');
    if (!code || !PET_SPECIES_CODES.includes(code as PetSpeciesCode)) {
      await replyLineText(replyToken, '請點選下方毛孩種類按鈕。');
      return true;
    }
    draft.petSpecies = code;
    draft.petSpeciesOther = null;
    if (code === 'other') {
      await upsertLineChatSession(lineUserId, 'register', 'pet_other', draft);
      await replyLineText(replyToken, '其他種類是？（例：刺蝟）');
      return true;
    }
    await upsertLineChatSession(lineUserId, 'register', 'breed', draft);
    await replyLineText(replyToken, LINE_PET_BREED_PROMPT);
    return true;
  }

  if (action === 'reg_ok') {
    if (session.step !== 'confirm' || !draft.name || !draft.phone || !draft.petName || !draft.petSpecies) {
      await replyLineText(replyToken, `資料不完整，請重新點「${LINE_BTN.register}」。`);
      await clearLineChatSession(lineUserId);
      return true;
    }

    try {
      const created = await createCustomerRecord({
        name: draft.name,
        phone: draft.phone,
        lineUserId,
        signupStore: draft.signupStore ?? null,
        petSpecies: draft.petSpecies,
        petSpeciesOther: draft.petSpeciesOther ?? null,
        petName: draft.petName,
        petBreed: draft.petBreed ?? null,
        petAgeYears: draft.petAgeYears ?? null,
        petBirthday: petBirthdayToDate(draft.petBirthday),
      });
      await ensureJarExchangeService(prisma, created.id);
      const resumeAfter = draft.resumeAfter;
      await clearLineChatSession(lineUserId);

      const petLabel = resolvePetSpeciesLabel(
        draft.petSpecies ?? null,
        draft.petSpeciesOther ?? null,
      );
      const breedPart = draft.petBreed ? ` · ${draft.petBreed}` : '';
      const bdayPart = draft.petBirthday ? ` · 生日 ${draft.petBirthday}` : '';
      const storeLabel = resolveSignupStoreLabel(draft.signupStore ?? null);
      const storeLine = storeLabel ? `\n合作店：${storeLabel}` : '';
      const doneText = `開戶完成囉，謝謝你～${draft.name}${storeLine}\n毛孩：${petLabel ?? ''} · ${draft.petName}${breedPart}${bdayPart}`;
      const storeId = draft.signupStore ?? '';
      const nextHint =
        storeId && storeLabel
          ? buildPostBindPointsHint({
              storeId,
              storeName: storeLabel,
              pointsToRedeem: GROOMING_COUPON_POINTS,
            })
          : JAR_ENTER_HINT_REGISTERED;

      if (resumeAfter === 'enter_code') {
        await replyLineMessage(replyToken, [
          { type: 'text', text: `${doneText}\n\n接下來可以這樣做～` },
          { type: 'text', text: nextHint },
        ]);
      } else {
        await replyLineMessage(replyToken, [
          {
            type: 'text',
            text: `${doneText}\n\n${nextHint}`,
          },
          ...buildWorldHubMessages('jar', { registered: true }),
        ]);
      }
    } catch (e) {
      await replyLineText(
        replyToken,
        e instanceof Error ? e.message : '開戶好像沒成功，晚點再試一次，或直接跟我們說喔。',
      );
    }
    return true;
  }

  return false;
}

export function formatRegisterSummary(draft: RegisterDraft): string {
  const lines: string[] = [];
  lines.push(`稱呼：${draft.name ?? '—'}`);
  lines.push(`手機：${draft.phone ?? '—'}`);
  const storeLabel = resolveSignupStoreLabel(draft.signupStore ?? null);
  if (storeLabel) {
    const storeId = draft.signupStore ?? '';
    lines.push(`合作店：${storeLabel}`);
    if (storeId) {
      lines.push(`可折美容：${formatGroomingCouponDiscountForStore(storeId, storeLabel)}`);
    }
  }
  if (draft.petName) {
    lines.push(
      `毛孩：${resolvePetSpeciesLabel(draft.petSpecies ?? null, draft.petSpeciesOther ?? null) ?? '—'} · ${draft.petName}`,
    );
    if (draft.petBreed) lines.push(`品種：${draft.petBreed}`);
    if (draft.petBirthday) lines.push(`生日：${draft.petBirthday}`);
    else lines.push('生日：（略過）');
  }
  return lines.join('\n');
}
