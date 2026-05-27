import { createCustomerRecord } from '@/lib/customers/create-customer';
import { resolvePetSpeciesLabel, type PetSpeciesCode } from '@/lib/customers/pet-fields';
import { ensureJarExchangeService } from '@/lib/jar-exchange/services';
import { findCustomerByLineUserId } from '@/lib/line/bind-customer';
import {
  clearLineChatSession,
  getLineChatSession,
  parseRegisterDraft,
  upsertLineChatSession,
  type RegisterDraft,
} from '@/lib/line/chat-session';
import { buildMainMenuMessages, buildSpeciesPickerMessages, buildRegisterConfirmMessages } from '@/lib/line/flex-menu';
import { replyLineMessage, replyLineText, replyLineTextPlus } from '@/lib/line/reply';
import { prisma } from '@/lib/prisma';
import { PET_SPECIES_CODES } from '@/lib/customers/pet-fields';

const SKIP_RE = /^(略過|跳过|skip|不填|沒有|没有)$/i;
const CANCEL_RE = /^(取消|cancel|退出)$/i;

export async function startRegisterFlow(replyToken: string, lineUserId: string) {
  const existing = await findCustomerByLineUserId(lineUserId);
  if (existing) {
    await replyLineTextPlus(
      replyToken,
      `您已是會員（${existing.name}）！\n傳 8 位序號即可存罐，或點「金庫」查紀錄。`,
      buildMainMenuMessages({ registered: true }),
    );
    return;
  }

  await upsertLineChatSession(lineUserId, 'register', 'name', {});
  await replyLineMessage(replyToken, [
    {
      type: 'text',
      text: '【加入會員】請直接在對話框輸入您的稱呼（例：王小姐）\n\n輸入「取消」可結束。',
    },
  ]);
}

export async function handleRegisterFlowMessage(
  replyToken: string,
  lineUserId: string,
  text: string,
): Promise<boolean> {
  const session = await getLineChatSession(lineUserId);
  if (!session || session.flow !== 'register') return false;

  const draft = parseRegisterDraft(session.payload);
  const trimmed = text.trim();

  if (CANCEL_RE.test(trimmed)) {
    await clearLineChatSession(lineUserId);
    await replyLineMessage(
      replyToken,
      buildMainMenuMessages({
        registered: Boolean(await findCustomerByLineUserId(lineUserId)),
        body: '已取消加入會員。',
      }),
    );
    return true;
  }

  if (session.step === 'name') {
    if (!trimmed || trimmed.length > 80) {
      await replyLineText(replyToken, '請輸入有效的稱呼（1–80 字）。');
      return true;
    }
    draft.name = trimmed;
    await upsertLineChatSession(lineUserId, 'register', 'species', draft);
    await replyLineMessage(replyToken, buildSpeciesPickerMessages());
    return true;
  }

  if (session.step === 'pet_name') {
    if (SKIP_RE.test(trimmed)) {
      await replyLineText(replyToken, '已選了毛孩種類，請輸入毛孩名字，或傳「取消」改選種類。');
      return true;
    }
    draft.petName = trimmed.slice(0, 80);
    await upsertLineChatSession(lineUserId, 'register', 'phone', draft);
    await replyLineText(replyToken, '手機號碼？（選填，直接傳「略過」）');
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
        await replyLineText(replyToken, '手機格式好像不對，請再試一次，或傳「略過」。');
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
  if (action !== 'sp' && action !== 'reg_ok' && action !== 'reg_no') return false;

  const session = await getLineChatSession(lineUserId);
  if (!session || session.flow !== 'register') {
    if (action === 'sp') {
      await replyLineText(replyToken, '請先點「加入會員」開始填寫。');
      return true;
    }
    return false;
  }

  const draft = parseRegisterDraft(session.payload);

  if (action === 'reg_no') {
    await clearLineChatSession(lineUserId);
    await replyLineMessage(
      replyToken,
      buildMainMenuMessages({ registered: false, body: '已取消，需要時再點「加入會員」。' }),
    );
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
      await replyLineText(replyToken, '資料不完整，請重新點「加入會員」。');
      await clearLineChatSession(lineUserId);
      return true;
    }

    try {
      const created = await createCustomerRecord({
        name: draft.name,
        phone: draft.phone ?? null,
        lineUserId,
        petSpecies: draft.petSpecies ?? null,
        petSpeciesOther: draft.petSpeciesOther ?? null,
        petName: draft.petName ?? null,
        petAgeYears: null,
        petBirthday: null,
      });
      await ensureJarExchangeService(prisma, created.id);
      await clearLineChatSession(lineUserId);

      const petLabel = resolvePetSpeciesLabel(
        draft.petSpecies ?? null,
        draft.petSpeciesOther ?? null,
      );
      const petLine =
        draft.petName && petLabel
          ? `\n毛孩：${petLabel} · ${draft.petName}`
          : draft.petName
            ? `\n毛孩：${draft.petName}`
            : '';

      await replyLineMessage(replyToken, [
        {
          type: 'text',
          text: `✅ 加入完成！${draft.name}${petLine}\n\n之後直接傳 8 位空罐序號就會入帳。`,
        },
        ...buildMainMenuMessages({ registered: true }),
      ]);
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
  const lines = [`稱呼：${draft.name ?? '—'}`];
  if (draft.petSpecies) {
    lines.push(
      `毛孩：${resolvePetSpeciesLabel(draft.petSpecies, draft.petSpeciesOther ?? null) ?? draft.petSpecies}`,
    );
    if (draft.petName) lines.push(`名字：${draft.petName}`);
  } else {
    lines.push('毛孩：（未填）');
  }
  lines.push(`手機：${draft.phone ?? '（未填）'}`);
  return lines.join('\n');
}
