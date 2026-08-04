import { prisma } from '@/lib/prisma';
import { isValidJarCodeFormat, normalizeJarCode } from '@/lib/jar-exchange/codes';
import { appendPointsLedger } from '@/lib/jar-exchange/points';
import { ensureJarExchangeService } from '@/lib/jar-exchange/services';
import { recordJarExchangeSaleOnRedeem } from '@/lib/jar-exchange/revenue';
import { listActiveRefillFlavours } from '@/lib/jar-exchange/refill-flavours';
import { revalidatePath } from 'next/cache';

export type RedeemJarCodeResult =
  | {
      ok: true;
      pointsEarned: number;
      balanceAfter: number;
      code: string;
      flavourName: string | null;
    }
  | { ok: false; error: string; status: number };

export type PreviewJarCodeResult =
  | { ok: true; code: string }
  | { ok: false; error: string; status: number };

/** 僅檢查序號可否兌換（尚未入罐），供 LINE 先問口味 */
export async function previewJarCodeForRedeem(
  codeRaw: string,
): Promise<PreviewJarCodeResult> {
  const code = normalizeJarCode(codeRaw);
  if (!code) return { ok: false, error: '請輸入序號', status: 400 };
  if (!isValidJarCodeFormat(code)) {
    return { ok: false, error: '序號須為 8 位數字', status: 400 };
  }

  const row = await prisma.jarCode.findUnique({
    where: { code },
    select: { status: true },
  });
  if (!row) return { ok: false, error: '序號不存在', status: 404 };
  if (row.status === 'used') return { ok: false, error: '序號已使用', status: 409 };
  if (row.status === 'expired') return { ok: false, error: '序號已過期', status: 409 };
  if (row.status !== 'unused') {
    return { ok: false, error: '此序號目前無法用 LINE 入罐（可能已出貨給其他流程）', status: 409 };
  }
  return { ok: true, code };
}

export async function resolveRedeemFlavour(
  flavourCodeRaw: string | null | undefined,
): Promise<{ code: string; name: string } | null> {
  const flavourCode = flavourCodeRaw?.trim();
  if (!flavourCode) return null;
  const flavours = await listActiveRefillFlavours();
  const hit = flavours.find((f) => f.code === flavourCode);
  if (!hit) return null;
  return { code: hit.code, name: hit.name };
}

export async function redeemJarCode(
  customerId: string,
  codeRaw: string,
  opts?: { flavourCode?: string | null },
): Promise<RedeemJarCodeResult> {
  const code = normalizeJarCode(codeRaw);
  if (!code) return { ok: false, error: '請輸入序號', status: 400 };
  if (!isValidJarCodeFormat(code)) {
    return { ok: false, error: '序號須為 8 位數字', status: 400 };
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });
  if (!customer) return { ok: false, error: '找不到會員', status: 404 };

  const flavour = await resolveRedeemFlavour(opts?.flavourCode);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const row = await tx.jarCode.findUnique({ where: { code } });
      if (!row) throw new JarExchangeError('序號不存在', 404);
      if (row.status === 'used') throw new JarExchangeError('序號已使用', 409);
      if (row.status === 'expired') throw new JarExchangeError('序號已過期', 409);

      const claimed = await tx.jarCode.updateMany({
        where: { id: row.id, status: 'unused' },
        data: {
          status: 'used',
          redeemedByCustomerId: customerId,
          redeemedAt: new Date(),
        },
      });
      if (claimed.count === 0) throw new JarExchangeError('序號已使用', 409);

      await ensureJarExchangeService(tx, customerId);

      const flavourNote = flavour ? ` · ${flavour.name}` : '';
      const ledger = await appendPointsLedger(tx, {
        customerId,
        sourceType: 'jar_code_redeem',
        sourceRefId: row.id,
        pointsChange: row.pointValue,
        note: `序號 ${code}${flavourNote}`,
      });

      await recordJarExchangeSaleOnRedeem(customerId, row.id, code, tx, {
        flavourCode: flavour?.code ?? null,
        flavourName: flavour?.name ?? null,
      });

      return {
        pointsEarned: row.pointValue,
        balanceAfter: ledger.balanceAfter,
        code,
        flavourName: flavour?.name ?? null,
      };
    });

    try {
      revalidatePath('/dashboard');
      revalidatePath('/orders');
    } catch {
      // 單元測試／非 request 脈絡沒有 static generation store
    }
    return { ok: true, ...result };
  } catch (e) {
    if (e instanceof JarExchangeError) {
      return { ok: false, error: e.message, status: e.status };
    }
    throw e;
  }
}

class JarExchangeError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'JarExchangeError';
  }
}
