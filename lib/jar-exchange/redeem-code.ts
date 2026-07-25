import { prisma } from '@/lib/prisma';
import { isValidJarCodeFormat, normalizeJarCode } from '@/lib/jar-exchange/codes';
import { applyJarDepositStockDeduction } from '@/lib/jar-exchange/deposit-stock';
import {
  resolveSignupLocationIdForCustomer,
  SIGNUP_REQUIRED_FOR_DEPOSIT_MESSAGE,
} from '@/lib/jar-exchange/location';
import { appendPointsLedger } from '@/lib/jar-exchange/points';
import { ensureJarExchangeService } from '@/lib/jar-exchange/services';
import { recordJarExchangeSaleOnRedeem } from '@/lib/jar-exchange/revenue';
import { revalidatePath } from 'next/cache';

export type RedeemJarCodeResult =
  | {
      ok: true;
      pointsEarned: number;
      balanceAfter: number;
      code: string;
      stockWentNegative?: boolean;
    }
  | { ok: false; error: string; status: number };

export async function redeemJarCode(
  customerId: string,
  codeRaw: string,
  opts?: { sourceSystem?: 'line' | 'hq' },
): Promise<RedeemJarCodeResult> {
  const code = normalizeJarCode(codeRaw);
  if (!code) return { ok: false, error: '請輸入序號', status: 400 };
  if (!isValidJarCodeFormat(code)) {
    return { ok: false, error: '序號須為 8 位數字', status: 400 };
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      signupLocationId: true,
      storeId: true,
      signupStore: true,
    },
  });
  if (!customer) return { ok: false, error: '找不到會員', status: 404 };

  // 開戶門檻：未綁合作店 → 不累點、不消耗序號
  const locationId = await resolveSignupLocationIdForCustomer(customer);
  if (!locationId) {
    return {
      ok: false,
      error: SIGNUP_REQUIRED_FOR_DEPOSIT_MESSAGE,
      status: 403,
    };
  }

  // 補寫 signupLocationId（舊會員僅有 store 字串時）
  if (customer.signupLocationId !== locationId) {
    await prisma.customer.update({
      where: { id: customerId },
      data: { signupLocationId: locationId },
    });
  }

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
          redeemedLocationId: locationId,
        },
      });
      if (claimed.count === 0) throw new JarExchangeError('序號已使用', 409);

      await ensureJarExchangeService(tx, customerId);

      const stock = await applyJarDepositStockDeduction(tx, {
        locationId,
        productId: row.productId,
        tierId: row.tierId,
        jarCodeId: row.id,
        code,
        sourceSystem: opts?.sourceSystem ?? 'line',
      });

      const ledger = await appendPointsLedger(tx, {
        customerId,
        sourceType: 'jar_code_redeem',
        sourceRefId: row.id,
        pointsChange: row.pointValue,
        note: `序號 ${code}`,
      });

      await recordJarExchangeSaleOnRedeem(customerId, row.id, code, tx);

      return {
        pointsEarned: row.pointValue,
        balanceAfter: ledger.balanceAfter,
        code,
        stockWentNegative: stock.wentNegative,
      };
    });

    revalidatePath('/dashboard');
    revalidatePath('/orders');
    revalidatePath('/jar-exchange/ops');
    revalidatePath(`/merchants/${locationId}`);
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
